'use strict';
// Hesap motoru: reçete ile hammadde tüketimi, ana/cep depo stokları, ürün stoğu ve aylık raporlar.
// Hiçbir stok sayısı saklanmaz; her şey kayıtlardan her seferinde yeniden hesaplanır.
const { round } = require('./store');

const EPS = 1e-9;
const FIRE_COLS = ['fPrf', 'fPet', 'fKapak', 'fEtiket', 'fKulp', 'fShrink'];
const PAL = ['std', 'ihr', 'euro'];
const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

class Calc {
  constructor(store) {
    this.s = store;
    this.memo = { v: -1 };
  }

  // ---------- Önbellekli dizinler ----------
  idx() {
    if (this.memo.v === this.s.version) return this.memo;
    const s = this.s;
    const m = { v: s.version };
    m.urun = new Map(s.all('urun', { withDeleted: true }).map((d) => [d.id, d]));
    m.mat = new Map(s.all('hammadde', { withDeleted: true }).map((d) => [d.id, d]));
    m.grup = new Map(s.all('grup', { withDeleted: true }).map((d) => [d.id, d]));
    m.recete = new Map();
    for (const r of s.all('recete')) {
      if (!m.recete.has(r.urun)) m.recete.set(r.urun, []);
      m.recete.get(r.urun).push(r);
    }
    for (const arr of m.recete.values()) arr.sort((a, b) => n(a.sira) - n(b.sira) || a.id - b.id);
    m.kpp = new Map(); // urun -> {std, ihr, euro}
    for (const p of s.all('paletTipi')) {
      if (!m.kpp.has(p.urun)) m.kpp.set(p.urun, {});
      m.kpp.get(p.urun)[p.palet] = n(p.koliPalet);
    }
    m.koliTipi = new Map(s.all('koliTipi', { withDeleted: true }).map((d) => [d.id, d]));
    m.kap = new Map(s.all('kapasite').map((d) => [`${d.hat}|${d.urun}`, n(d.kapasite)]));
    m.vardiya = new Map(s.all('vardiya', { withDeleted: true }).map((d) => [d.id, d]));
    m.usage = new Map();
    m.ledger = null; m.pledger = null;
    this.memo = m;
    return m;
  }
  settings() {
    return Object.assign({ company: 'Depo Takip', kgTir: 26500, paletTir: 31, koliTir: 1650, anaAd: 'Ana depo', cepAd: 'Cep depo' }, this.s.meta('settings', {}));
  }

  // ---------- Üretim kaydı hesapları ----------
  koli(u) {
    const k = this.idx().kpp.get(u.urun) || {};
    return round(n(u.pStd) * n(k.std) + n(u.pIhr) * n(k.ihr) + n(u.pEuro) * n(k.euro) + n(u.paletsiz));
  }
  uretimComputed(u) {
    const m = this.idx();
    const koli = this.koli(u);
    const kt = u.koliTipi ? m.koliTipi.get(u.koliTipi) : null;
    const adetKoli = kt ? n(kt.adet) * (n(kt.carpan) || 1) : null;
    const kap = u.hat ? m.kap.get(`${u.hat}|${u.urun}`) || 0 : 0;
    const vs = n(u.vardiyaSure) || n((m.vardiya.get(u.vardiya) || {}).sure);
    const vrm = (sure) => (kap > 0 && sure > 0 && n(u.net) > 0 ? round((n(u.net) / (kap * sure / 60)) * 100) : null);
    return {
      koli, adetKoli,
      sayacFarki: (u.giren ? round(n(u.fPrf) + n(u.fPet) + n(u.net) - n(u.giren)) : null),
      vardiyaVrm: vrm(vs), uretimVrm: vrm(n(u.sure)),
      fireToplam: round(n(u.fPrf) + n(u.fPet) + n(u.fKapak) + n(u.fEtiket) + n(u.fKulp)),
      netKoliFark: adetKoli && u.net ? round(n(u.net) / adetKoli - koli) : null,
      kapasite: kap || null, vardiyaSureHesap: vs || null,
    };
  }
  // Bir üretim kaydının reçeteye göre hammadde kullanımı: [{mat, kul, fire, line}]
  usageOf(u) {
    const m = this.idx();
    const key = `${u.id}|${u._u}`;
    if (m.usage.has(key)) return m.usage.get(key);
    const lines = m.recete.get(u.urun) || [];
    const koli = this.koli(u);
    const out = [];
    for (const r of lines) {
      if (!r.hammadde || r.aktif === false) continue;
      const sel = r.secim || 'hepsi';
      if (sel === 'preform' && u.preform !== r.hammadde) continue;
      if (sel === 'kapak' && u.kapak !== r.hammadde) continue;
      if (sel === 'etiket' && u.etiket !== r.hammadde) continue;
      if (sel === 'hat' && u.hat !== r.secimHat) continue;
      let baz;
      if (r.baz === 'paletsiz') baz = n(u.paletsiz);
      else if (r.baz === 'palet') baz = (r.paletler || []).reduce((a, p) => a + n(u[{ std: 'pStd', ihr: 'pIhr', euro: 'pEuro' }[p]]), 0);
      else baz = koli;
      const kul = baz * n(r.miktar);
      let fire = 0;
      for (const c of r.fireKaynak || []) fire += n(u[c]);
      fire *= (r.fireCarpan === undefined ? 1 : n(r.fireCarpan));
      if (kul || fire) out.push({ mat: r.hammadde, kul, fire, line: r.id });
    }
    m.usage.set(key, out);
    return out;
  }

  // ---------- Hammadde hareket defteri ----------
  // Her olay: {t: tarih, o: sıra, mat, kind, ana, cep, set: {depo, val}, ref}
  events() {
    const m = this.idx();
    if (m.events) return m.events;
    const s = this.s;
    const ev = [];
    const push = (e) => ev.push(e);
    for (const d of s.all('satinalma')) push({ t: d.tarih, o: 1, id: d.id, mat: d.hammadde, kind: 'alim', ana: n(d.miktar), cep: 0, coll: 'satinalma' });
    for (const d of s.all('iade')) push({ t: d.tarih, o: 2, id: d.id, mat: d.hammadde, kind: 'iade', ana: -n(d.miktar), cep: 0, coll: 'iade' });
    for (const d of s.all('cep')) {
      const q = n(d.miktar) * (d.yon === 'anaya' ? -1 : 1);
      push({ t: d.tarih, o: 3, id: d.id, mat: d.hammadde, kind: 'cep', ana: -q, cep: q, coll: 'cep' });
    }
    for (const d of s.all('uretim')) {
      for (const u of this.usageOf(d)) {
        if (u.kul) push({ t: d.tarih, o: 4, id: d.id, mat: u.mat, kind: 'kul', ana: 0, cep: -u.kul, coll: 'uretim' });
        if (u.fire) push({ t: d.tarih, o: 4, id: d.id, mat: u.mat, kind: 'fire', ana: 0, cep: -u.fire, coll: 'uretim' });
      }
    }
    for (const d of s.all('iskarta')) {
      if (d.durum === 'imha') push({ t: d.tarih, o: 5, id: d.id, mat: d.hammadde, kind: 'imha', ana: -n(d.miktar), cep: 0, coll: 'iskarta' });
      else if (!d.durum || d.durum === 'bekliyor') push({ t: d.tarih, o: 5, id: d.id, mat: d.hammadde, kind: 'iskarta', ana: 0, cep: 0, isk: n(d.miktar), coll: 'iskarta' });
    }
    for (const d of s.all('sayim')) push({ t: d.tarih, o: 9, id: d.id, mat: d.hammadde, kind: 'sayim', depo: d.depo === 'cep' ? 'cep' : 'ana', val: n(d.sayilan), coll: 'sayim' });
    ev.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.o - b.o || a.id - b.id));
    // Sayım farklarını bir kez hesapla (liste ekranında göstermek için)
    const bal = new Map();
    m.sayimFark = new Map();
    for (const e of ev) {
      if (!bal.has(e.mat)) bal.set(e.mat, { ana: 0, cep: 0 });
      const b = bal.get(e.mat);
      if (e.kind === 'sayim') { e.delta = round(e.val - b[e.depo]); m.sayimFark.set(e.id, e.delta); b[e.depo] = e.val; }
      else { b.ana += e.ana; b.cep += e.cep; }
    }
    m.events = ev;
    m.current = bal;
    return ev;
  }
  // Belirli bir aralık için hammadde bazında özet
  ledger(from, to) {
    const ev = this.events();
    const st = new Map();
    const z = () => ({ dAna: 0, dCep: 0, ana: 0, cep: 0, alim: 0, iade: 0, cepNet: 0, kul: 0, fire: 0, imha: 0, sayimAna: 0, sayimCep: 0, isk: 0, iskDonem: 0, n: 0, sonSayim: null });
    for (const e of ev) {
      if (to && e.t >= to) break;
      if (!st.has(e.mat)) st.set(e.mat, z());
      const r = st.get(e.mat);
      const inP = !from || e.t >= from;
      if (e.kind === 'sayim') {
        const delta = e.val - r[e.depo];
        r[e.depo] = e.val;
        if (inP) { if (e.depo === 'ana') r.sayimAna += delta; else r.sayimCep += delta; r.n++; r.sonSayim = { t: e.t, depo: e.depo, val: e.val }; }
      } else {
        r.ana += e.ana; r.cep += e.cep;
        if (e.kind === 'iskarta') { r.isk += e.isk; if (inP) r.iskDonem += e.isk; }
        if (inP) {
          r.n++;
          if (e.kind === 'alim') r.alim += e.ana;
          else if (e.kind === 'iade') r.iade -= e.ana;
          else if (e.kind === 'cep') r.cepNet += e.cep;
          else if (e.kind === 'kul') r.kul -= e.cep;
          else if (e.kind === 'fire') r.fire -= e.cep;
          else if (e.kind === 'imha') r.imha -= e.ana;
        }
      }
      if (!inP) { r.dAna = r.ana; r.dCep = r.cep; }
    }
    return st;
  }

  // Yaklaşık koli: kullanılabilir stok ÷ reçetedeki koli başına miktar (Excel "Yak. Koli")
  receteMiktar(matId, urunId) {
    const m = this.idx();
    let sum = 0;
    for (const [u, lines] of m.recete) {
      if (urunId && u !== urunId) continue;
      for (const r of lines) if (r.hammadde === matId && r.aktif !== false && (r.baz || 'koli') === 'koli') sum += n(r.miktar);
    }
    return sum;
  }

  // ---------- RAPOR: Hammadde stok (Excel "Hammadde" sayfası + aylık takip) ----------
  hammaddeRaporu(from, to) {
    const m = this.idx();
    const L = this.ledger(from, to);
    const rows = [];
    const mats = this.s.all('hammadde');
    const grupSira = (g) => { const x = m.grup.get(g); return x ? n(x.sira) * 1e4 + x.id : 1e9; };
    mats.sort((a, b) => grupSira(a.grup) - grupSira(b.grup) || n(a.sira) - n(b.sira) || a.id - b.id);
    for (const d of mats) {
      const r = L.get(d.id) || { dAna: 0, dCep: 0, ana: 0, cep: 0, alim: 0, iade: 0, cepNet: 0, kul: 0, fire: 0, imha: 0, sayimAna: 0, sayimCep: 0, isk: 0, n: 0 };
      if (d.aktif === false && !r.n && !r.ana && !r.cep) continue;
      const g = m.grup.get(d.grup) || {};
      const devreden = round(r.dAna + r.dCep);
      const kalan = round(r.ana + r.cep);
      const kullanilabilen = round(kalan - r.isk);
      const rm = this.receteMiktar(d.id, d.oncelik) || this.receteMiktar(d.id);
      const asgari = n(d.asgari);
      const A = round(r.dAna), B = round(r.alim), Cc = round(A + B), D = round(r.cepNet), E = round(r.ana);
      const G = round(r.kul), H = round(r.fire), I = round(G + H);
      rows.push({
        id: d.id, kod: d.kod, grup: g.ad || '', grupKod: g.kod || '', ad: d.ad, birim: d.birim, gramaj: d.gramaj || '', aktif: d.aktif !== false,
        devreden, devAna: A, devCep: round(r.dCep), kullanilan: G, fire: H, topCikan: I, alim: B, iade: round(r.iade),
        cepNet: D, imha: round(r.imha), sayimFark: round(r.sayimAna + r.sayimCep), sayimAna: round(r.sayimAna), sayimCep: round(r.sayimCep),
        kalan, iskarta: round(r.isk), kullanilabilen, ana: E, cep: round(r.cep),
        yakKoli: rm > 0 ? round(kullanilabilen / rm) : null,
        asgari: asgari || null,
        durum: asgari > 0 && kullanilabilen < asgari - EPS ? (kullanilabilen <= EPS ? 'tukendi' : 'siparis') : (kalan < -EPS ? 'eksi' : 'normal'),
        // Aylık takip (TRK) sütunları
        trk: { A, B, C: Cc, D, E, F: asgari || 0, G, H, I, J: Math.abs(D - I) < 1e-6, fark: round(D - I), diger: round(E - (Cc - D)), cepSon: round(r.cep) },
        sonSayim: r.sonSayim || null, hareket: r.n,
      });
    }
    return rows;
  }

  // ---------- Ürün stok defteri ----------
  productEvents() {
    const m = this.idx();
    if (m.pevents) return m.pevents;
    const s = this.s;
    const ev = [];
    for (const d of s.all('uretim')) ev.push({ t: d.tarih, o: 1, id: d.id, urun: d.urun, kind: 'uretim', q: this.koli(d), coll: 'uretim' });
    for (const d of s.all('sevkiyat')) {
      for (const [k, v] of Object.entries(d.miktar || {})) ev.push({ t: d.tarih, o: 2, id: d.id, urun: Number(k), kind: 'sevk', q: -n(v), coll: 'sevkiyat' });
      for (const [k, v] of Object.entries(d.ihracat || {})) ev.push({ t: d.tarih, o: 2, id: d.id, urun: Number(k), kind: 'ihr', q: -n(v), coll: 'sevkiyat' });
    }
    for (const d of s.all('urunSayim')) ev.push({ t: d.tarih, o: 9, id: d.id, urun: d.urun, kind: 'sayim', val: n(d.koli), coll: 'urunSayim' });
    ev.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.o - b.o || a.id - b.id));
    const bal = new Map();
    m.urunSayimFark = new Map();
    for (const e of ev) {
      const b = bal.get(e.urun) || 0;
      if (e.kind === 'sayim') { m.urunSayimFark.set(e.id, round(e.val - b)); bal.set(e.urun, e.val); } else bal.set(e.urun, b + e.q);
    }
    m.pevents = ev; m.pcurrent = bal;
    return ev;
  }
  urunRaporu(from, to) {
    const m = this.idx();
    const ev = this.productEvents();
    const st = new Map();
    const z = () => ({ dev: 0, bal: 0, uretim: 0, sevk: 0, ihr: 0, sayim: 0, n: 0 });
    for (const e of ev) {
      if (to && e.t >= to) break;
      if (!st.has(e.urun)) st.set(e.urun, z());
      const r = st.get(e.urun);
      const inP = !from || e.t >= from;
      if (e.kind === 'sayim') { const d = e.val - r.bal; r.bal = e.val; if (inP) { r.sayim += d; r.n++; } }
      else { r.bal += e.q; if (inP) { r.n++; if (e.kind === 'uretim') r.uretim += e.q; else if (e.kind === 'sevk') r.sevk -= e.q; else r.ihr -= e.q; } }
      if (!inP) r.dev = r.bal;
    }
    const prod = this.uretimOzet(from, to).urunler;
    const pmap = new Map(prod.map((p) => [p.id, p]));
    const set = this.settings();
    return this.s.all('urun').sort((a, b) => n(a.sira) - n(b.sira) || a.id - b.id).map((u) => {
      const r = st.get(u.id) || z();
      const K = round(r.dev), G = round(r.uretim), L = round(K + G), M = round(r.sevk + r.ihr), N = round(r.bal);
      const p = pmap.get(u.id) || {};
      const kpp = n(u.sevkKoliPalet);
      return {
        id: u.id, ad: u.ad, aktif: u.aktif !== false,
        devir: K, uretilen: G, toplam: L, sevk: round(r.sevk), ihracat: round(r.ihr), sevkToplam: M, sayimFark: round(r.sayim), kalan: N, fark: round(L - M),
        kalanPalet: kpp > 0 ? round(N / kpp) : null, kalanKg: n(u.kgKoli) > 0 ? round(N * n(u.kgKoli)) : null,
        uretimPalet: round(n(p.pStd) + n(p.pIhr) + n(p.pEuro)), net: n(p.net), hareket: r.n,
        _set: set,
      };
    });
  }

  // ---------- RAPOR: Üretim özeti (Excel "Üretim_Özet") ----------
  uretimOzet(from, to) {
    const m = this.idx();
    const recs = this.s.all('uretim').filter((d) => (!from || d.tarih >= from) && (!to || d.tarih < to));
    const keys = ['giren', 'cikan', 'fPrf', 'fPet', 'fKapak', 'fEtiket', 'fKulp', 'fShrink', 'net', 'pStd', 'pIhr', 'pEuro', 'paletsiz', 'sure', 'vardiyaSure'];
    const agg = (list) => {
      const o = { kayit: list.length, koli: 0, sayacFarki: 0, vrmV: [], vrmU: [] };
      for (const k of keys) o[k] = 0;
      for (const d of list) {
        const c = this.uretimComputed(d);
        for (const k of keys) o[k] += k === 'vardiyaSure' ? n(c.vardiyaSureHesap) : n(d[k]);
        o.koli += c.koli;
        if (c.sayacFarki !== null) o.sayacFarki += c.sayacFarki;
        if (c.vardiyaVrm !== null) o.vrmV.push(c.vardiyaVrm);
        if (c.uretimVrm !== null) o.vrmU.push(c.uretimVrm);
      }
      const avg = (a) => (a.length ? round(a.reduce((x, y) => x + y, 0) / a.length) : null);
      o.vardiyaVrm = avg(o.vrmV); o.uretimVrm = avg(o.vrmU); delete o.vrmV; delete o.vrmU;
      for (const k of Object.keys(o)) if (typeof o[k] === 'number') o[k] = round(o[k]);
      return o;
    };
    const by = (keyFn) => { const g = new Map(); for (const d of recs) { const k = keyFn(d); if (!g.has(k)) g.set(k, []); g.get(k).push(d); } return g; };
    const toplam = agg(recs);
    const urunler = this.s.all('urun').sort((a, b) => n(a.sira) - n(b.sira) || a.id - b.id).map((u) => {
      const a = agg(recs.filter((d) => d.urun === u.id));
      return { id: u.id, ad: u.ad, ...a, oran: toplam.koli > 0 ? round((a.koli / toplam.koli) * 100) : 0 };
    });
    const hatG = by((d) => d.hat || 0);
    const hatlar = [...hatG.entries()].map(([id, l]) => ({ id, ad: id ? (this.s.get('hat', id) || {}).ad || '?' : '(hat yok)', ...agg(l) }));
    const vardG = by((d) => d.vardiya || 0);
    const vardiyalar = [...vardG.entries()].map(([id, l]) => ({ id, ad: id ? (m.vardiya.get(id) || {}).ad || '?' : '-', ...agg(l) }));
    const gunG = by((d) => d.tarih);
    const gunler = [...gunG.entries()].sort().map(([t, l]) => ({ tarih: t, ...agg(l) }));
    return { toplam, urunler, hatlar, vardiyalar, gunler };
  }

  // ---------- RAPOR: Reçete kullanımı (Excel "Reçete"/"Kullanım") ----------
  kullanimRaporu(from, to, urunId) {
    const m = this.idx();
    const recs = this.s.all('uretim').filter((d) => (!from || d.tarih >= from) && (!to || d.tarih < to) && (!urunId || d.urun === Number(urunId)));
    const byLine = new Map();
    const koliU = new Map();
    for (const d of recs) {
      koliU.set(d.urun, (koliU.get(d.urun) || 0) + this.koli(d));
      for (const u of this.usageOf(d)) {
        const x = byLine.get(u.line) || { kul: 0, fire: 0 };
        x.kul += u.kul; x.fire += u.fire; byLine.set(u.line, x);
      }
    }
    const out = [];
    for (const u of this.s.all('urun').sort((a, b) => n(a.sira) - n(b.sira) || a.id - b.id)) {
      if (urunId && u.id !== Number(urunId)) continue;
      const lines = (m.recete.get(u.id) || []).map((r) => {
        const x = byLine.get(r.id) || { kul: 0, fire: 0 };
        const mat = m.mat.get(r.hammadde) || {};
        const top = x.kul + x.fire;
        return { id: r.id, hammadde: r.hammadde, kod: mat.kod, ad: mat.ad || '?', birim: r.birim, matBirim: mat.birim, miktar: r.miktar, baz: r.baz || 'koli', secim: r.secim || 'hepsi',
          kullanilan: round(x.kul), fire: round(x.fire), toplam: round(top), oran: top > 0 ? round((x.fire / top) * 100) : 0 };
      });
      out.push({ id: u.id, ad: u.ad, koli: round(koliU.get(u.id) || 0), satirlar: lines });
    }
    return out;
  }

  // ---------- RAPOR: Sevkiyat (Excel "Sevkiyat") ----------
  sevkiyatRaporu(from, to) {
    const set = this.settings();
    const urunler = this.s.all('urun').filter((u) => u.aktif !== false).sort((a, b) => n(a.sira) - n(b.sira) || a.id - b.id);
    const recs = this.s.all('sevkiyat').filter((d) => (!from || d.tarih >= from) && (!to || d.tarih < to)).sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
    const palOf = (u, q, ihr) => { const k = n(ihr ? u.ihrKoliPalet || u.sevkKoliPalet : u.sevkKoliPalet); return k > 0 ? q / k : 0; };
    const kgOf = (u, q, ihr) => { const kpp = n(ihr ? u.ihrKoliPalet || u.sevkKoliPalet : u.sevkKoliPalet); return n(u.kgPalet) > 0 && kpp > 0 ? (q / kpp) * n(u.kgPalet) : q * n(u.kgKoli); };
    const gunler = recs.map((d) => {
      let top = 0, pal = 0, kg = 0;
      for (const u of urunler) {
        for (const [map, ihr] of [[d.miktar, false], [d.ihracat, true]]) {
          const q = n((map || {})[u.id]); if (!q) continue;
          top += q; pal += palOf(u, q, ihr); kg += kgOf(u, q, ihr);
        }
      }
      return { id: d.id, tarih: d.tarih, miktar: d.miktar || {}, ihracat: d.ihracat || {}, toplam: round(top), palet: round(pal), kg: round(kg), arac: d.arac || null,
        tirKg: round(kg / (n(set.kgTir) || 1)), tirPalet: round(pal / (n(set.paletTir) || 1)), tirKoli: round(top / (n(set.koliTir) || 1)), aciklama: d.aciklama || '' };
    });
    const sevkGun = gunler.filter((g) => g.toplam > 0).length;
    const ur = urunler.map((u) => {
      let q = 0, qi = 0;
      for (const g of gunler) { q += n(g.miktar[u.id]); qi += n(g.ihracat[u.id]); }
      return { id: u.id, ad: u.ad, yurtici: round(q), ihracat: round(qi), toplam: round(q + qi), palet: round(palOf(u, q, false) + palOf(u, qi, true)), kg: round(kgOf(u, q, false) + kgOf(u, qi, true)), gunlukOrt: sevkGun ? round((q + qi) / sevkGun) : 0 };
    });
    const t = { toplam: 0, palet: 0, kg: 0, arac: 0 };
    for (const g of gunler) { t.toplam += g.toplam; t.palet += g.palet; t.kg += g.kg; t.arac += n(g.arac); }
    for (const k of Object.keys(t)) t[k] = round(t[k]);
    return { urunler: ur, gunler, toplam: { ...t, sevkGun, gunlukOrt: sevkGun ? round(t.toplam / sevkGun) : 0, tirKg: round(t.kg / (n(set.kgTir) || 1)), tirPalet: round(t.palet / (n(set.paletTir) || 1)) }, ayar: set };
  }

  // ---------- Hammadde kartı: hareketler ve yürüyen bakiye ----------
  hammaddeKarti(matId, from, to) {
    const ev = this.events();
    const out = [];
    let ana = 0, cep = 0;
    const names = { alim: 'Satınalma', iade: 'Tedarikçiye iade', cep: 'Cep depoya verilen', kul: 'Üretimde kullanılan', fire: 'Üretim firesi', imha: 'Iskarta – imha', iskarta: 'Iskartaya ayrıldı', sayim: 'Sayım' };
    let start = null;
    for (const e of ev) {
      if (e.mat !== matId) continue;
      if (to && e.t >= to) break;
      if (e.kind === 'sayim') { if (e.depo === 'ana') ana = e.val; else cep = e.val; }
      else { ana += e.ana; cep += e.cep; }
      if (from && e.t < from) continue;
      if (start === null) start = { ana: round(ana - (e.kind === 'sayim' ? 0 : e.ana)), cep: round(cep - (e.kind === 'sayim' ? 0 : e.cep)) };
      out.push({ t: e.t, kind: e.kind, ad: names[e.kind] || e.kind, coll: e.coll, id: e.id, ana: round(e.ana || 0), cep: round(e.cep || 0), delta: e.delta, depo: e.depo, val: e.val, isk: e.isk, balAna: round(ana), balCep: round(cep) });
    }
    // Aynı üretim kaydındaki kullanım + fire satırlarını birleştirmeden göster (ayrı satırlar daha anlaşılır)
    return out.reverse();
  }

  // Güncel stok (tüm zamanlar) — QR ekranı ve listeler için
  guncel() {
    this.events();
    const m = this.idx();
    const isk = new Map();
    for (const d of this.s.all('iskarta')) if (!d.durum || d.durum === 'bekliyor') isk.set(d.hammadde, (isk.get(d.hammadde) || 0) + n(d.miktar));
    const out = new Map();
    for (const d of this.s.all('hammadde')) {
      const b = m.current.get(d.id) || { ana: 0, cep: 0 };
      const kalan = round(b.ana + b.cep);
      const kul = round(kalan - (isk.get(d.id) || 0));
      const asg = n(d.asgari);
      out.set(d.id, { ana: round(b.ana), cep: round(b.cep), kalan, iskarta: round(isk.get(d.id) || 0), kullanilabilen: kul,
        durum: asg > 0 && kul < asg - EPS ? (kul <= EPS ? 'tukendi' : 'siparis') : (kalan < -EPS ? 'eksi' : 'normal') });
    }
    return out;
  }

  // Liste ekranları için hesaplanan alanlar
  computedFor(coll, d) {
    if (coll === 'uretim') return this.uretimComputed(d);
    if (coll === 'satinalma') return { tutar: d.fiyat ? round(n(d.miktar) * n(d.fiyat) * (n(d.kur) || 1) / (n(d.carpan) || 1)) : null };
    if (coll === 'sayim') { this.events(); const f = this.idx().sayimFark.get(d.id); return { fark: f === undefined ? null : f }; }
    if (coll === 'urunSayim') { this.productEvents(); const f = this.idx().urunSayimFark.get(d.id); return { fark: f === undefined ? null : f }; }
    if (coll === 'palet') return { toplam: n(d.standart) + n(d.epal) };
    if (coll === 'sevkiyat') {
      let top = 0, pal = 0, kg = 0;
      for (const [map, ihr] of [[d.miktar, false], [d.ihracat, true]]) {
        for (const [k, v] of Object.entries(map || {})) {
          const u = this.s.get('urun', k) || {}; const q = n(v); top += q;
          const kpp = n(ihr ? u.ihrKoliPalet || u.sevkKoliPalet : u.sevkKoliPalet);
          if (kpp > 0) pal += q / kpp;
          kg += n(u.kgPalet) > 0 && kpp > 0 ? (q / kpp) * n(u.kgPalet) : q * n(u.kgKoli);
        }
      }
      return { toplam: round(top), palet: round(pal), kg: round(kg) };
    }
    return {};
  }

  // ---------- 2.1: mamul güncel stoğu ----------
  urunGuncel(tarihSonu) {
    const ev = this.productEvents();
    const bal = new Map();
    for (const e of ev) {
      if (tarihSonu && e.t >= tarihSonu) break;
      if (e.kind === 'sayim') bal.set(e.urun, e.val); else bal.set(e.urun, (bal.get(e.urun) || 0) + e.q);
    }
    for (const [k, v] of bal) bal.set(k, round(v));
    return bal;
  }

  // ---------- 2.1: geçmiş bir günün sonundaki stok durumu ----------
  durum(tarih) {
    const m = this.idx();
    const son = nextDay(tarih);
    const L = this.ledger(null, son);
    const isk = new Map();
    for (const d of this.s.all('iskarta')) if (d.tarih < son && (!d.durum || d.durum === 'bekliyor')) isk.set(d.hammadde, (isk.get(d.hammadde) || 0) + n(d.miktar));
    const mats = this.s.all('hammadde').slice();
    const grupSira = (g) => { const x = m.grup.get(g); return x ? n(x.sira) * 1e4 + x.id : 1e9; };
    mats.sort((a, b) => grupSira(a.grup) - grupSira(b.grup) || n(a.sira) - n(b.sira) || a.id - b.id);
    const hammadde = [];
    for (const d of mats) {
      const r = L.get(d.id) || { ana: 0, cep: 0 };
      if (d.aktif === false && !r.ana && !r.cep) continue;
      const kalan = round(r.ana + r.cep); const kul = round(kalan - (isk.get(d.id) || 0)); const asg = n(d.asgari);
      hammadde.push({ id: d.id, kod: d.kod, ad: d.ad, birim: d.birim, grup: (m.grup.get(d.grup) || {}).ad || '', ana: round(r.ana), cep: round(r.cep), kalan, iskarta: round(isk.get(d.id) || 0), kullanilabilen: kul, asgari: asg || null,
        durum: asg > 0 && kul < asg - EPS ? (kul <= EPS ? 'tukendi' : 'siparis') : (kalan < -EPS ? 'eksi' : 'normal') });
    }
    const ub = this.urunGuncel(son);
    const urunler = this.s.all('urun').sort((a, b) => n(a.sira) - n(b.sira) || a.id - b.id).filter((u) => u.aktif !== false || ub.get(u.id))
      .map((u) => ({ id: u.id, kod: u.kod, ad: u.ad, koli: ub.get(u.id) || 0, palet: n(u.sevkKoliPalet) > 0 ? round((ub.get(u.id) || 0) / n(u.sevkKoliPalet)) : null, asgari: n(u.asgari) || null }));
    return { tarih, hammadde, urunler, birimler: birimTop(hammadde) };
  }

  // ---------- 2.1: hammadde hareket listesi (tarih aralığı) ----------
  hareketler(from, to, matId) {
    const ev = this.events();
    const m = this.idx();
    const names = { alim: 'Satınalma (ana depoya giriş)', iade: 'Tedarikçiye iade', cep: 'Ana → cep transfer', kul: 'Üretimde kullanılan', fire: 'Üretim firesi', imha: 'Iskarta – imha', iskarta: 'Iskartaya ayrıldı', sayim: 'Sayım' };
    const out = [];
    for (const e of ev) {
      if (to && e.t >= to) break;
      if (from && e.t < from) continue;
      if (matId && e.mat !== matId) continue;
      const mat = m.mat.get(e.mat) || {};
      const doc = this.s.get(e.coll, e.id) || {};
      let ad = names[e.kind] || e.kind;
      if (e.kind === 'cep' && e.cep < 0) ad = 'Cep → ana geri dönüş';
      out.push({ t: e.t, kind: e.kind, ad, coll: e.coll, id: e.id, mat: e.mat, kod: mat.kod, matAd: mat.ad, birim: mat.birim,
        ana: e.kind === 'sayim' ? null : round(e.ana || 0), cep: e.kind === 'sayim' ? null : round(e.cep || 0), depo: e.depo, val: e.val, delta: e.delta, isk: e.isk,
        lotNo: doc.lotNo || '', belge: doc.irsNo || '', firma: doc.firma || '', by: doc._by, at: doc._c });
    }
    return out;
  }

  // ---------- Panel ----------
  panel(from, to) {
    const hr = this.hammaddeRaporu(from, to);
    const uo = this.uretimOzet(from, to);
    const sv = this.sevkiyatRaporu(from, to);
    const g = this.guncel();
    const uyarilar = [];
    for (const d of this.s.all('hammadde')) {
      const x = g.get(d.id);
      if (x && x.durum !== 'normal') uyarilar.push({ id: d.id, kod: d.kod, ad: d.ad, birim: d.birim, asgari: d.asgari || null, ...x });
    }
    const ord = { tukendi: 0, eksi: 1, siparis: 2 };
    uyarilar.sort((a, b) => ord[a.durum] - ord[b.durum]);
    const fireAdet = uo.toplam.fPrf + uo.toplam.fPet;
    return {
      uretimKoli: uo.toplam.koli, uretimKayit: uo.toplam.kayit, net: uo.toplam.net, giren: uo.toplam.giren,
      fireOrani: uo.toplam.giren > 0 ? round((fireAdet / uo.toplam.giren) * 100) : null,
      sevkKoli: sv.toplam.toplam, sevkPalet: sv.toplam.palet, sevkGun: sv.toplam.sevkGun,
      alimKalem: hr.filter((r) => r.alim > 0).length,
      uyarilar, urunler: uo.urunler.filter((u) => u.koli > 0).map((u) => ({ ad: u.ad, koli: u.koli, oran: u.oran })),
      cepFarkli: hr.filter((r) => r.trk.D !== 0 || r.trk.I !== 0).filter((r) => !r.trk.J).length,
      ...this.panelEk(from, to, hr, uo, sv),
    };
  }
  // 2.1: depo toplamları, dağılım, günlük üretim/sevkiyat, mamul stoğu
  panelEk(from, to, hr, uo, sv) {
    const m = this.idx();
    const g = this.guncel();
    const cur = [];
    for (const d of this.s.all('hammadde')) { const x = g.get(d.id); if (x) cur.push({ ...x, birim: d.birim, grup: (m.grup.get(d.grup) || {}).ad || '—', grupId: d.grup }); }
    const birimler = birimTop(cur);
    // grup bazında ana/cep dağılımı (grubun ağırlıklı birimine göre)
    const gm = new Map();
    for (const x of cur) {
      if (!gm.has(x.grupId)) gm.set(x.grupId, { ad: x.grup, kalem: 0, b: new Map() });
      const o = gm.get(x.grupId); o.kalem++;
      const b = o.b.get(x.birim) || { ana: 0, cep: 0 }; b.ana += Math.max(0, x.ana); b.cep += Math.max(0, x.cep); o.b.set(x.birim, b);
    }
    const dagilim = [...gm.entries()].sort((a, b) => n((m.grup.get(a[0]) || {}).sira) - n((m.grup.get(b[0]) || {}).sira))
      .map(([, o]) => { const [birim, b] = [...o.b.entries()].sort((x, y) => (y[1].ana + y[1].cep) - (x[1].ana + x[1].cep))[0] || ['', { ana: 0, cep: 0 }]; return { ad: o.ad, kalem: o.kalem, birim, ana: round(b.ana), cep: round(b.cep) }; })
      .filter((x) => x.ana || x.cep);
    // dönemde üretimde kullanılan (birim bazında)
    const kulB = new Map();
    for (const r of hr) { if (!r.kullanilan && !r.fire) continue; const k = kulB.get(r.birim) || { kul: 0, fire: 0 }; k.kul += r.kullanilan; k.fire += r.fire; kulB.set(r.birim, k); }
    const kullanim = [...kulB.entries()].map(([birim, k]) => ({ birim, kul: round(k.kul), fire: round(k.fire) })).sort((a, b) => b.kul - a.kul);
    // günlük üretim ve sevkiyat
    const days = new Map();
    const day = (t) => { if (!days.has(t)) days.set(t, { tarih: t, uretim: 0, sevk: 0 }); return days.get(t); };
    for (const x of uo.gunler) day(x.tarih).uretim = x.koli;
    for (const x of sv.gunler) day(x.tarih).sevk += x.toplam;
    const gunluk = [...days.values()].sort((a, b) => (a.tarih < b.tarih ? -1 : 1)).map((x) => ({ ...x, sevk: round(x.sevk) }));
    // mamul stoğu
    const ub = this.urunGuncel();
    let mamul = 0; const mamulUyari = [];
    for (const u of this.s.all('urun')) {
      const k = ub.get(u.id) || 0; mamul += k;
      if (n(u.asgari) > 0 && k < n(u.asgari)) mamulUyari.push({ id: u.id, ad: u.ad, koli: k, asgari: n(u.asgari) });
    }
    return { birimler, dagilim, kullanim, gunluk, mamulKoli: round(mamul), mamulUyari, mamulKalem: [...ub.values()].filter((v) => v > 0).length };
  }
}

function nextDay(t) { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
// Birim bazında ana / cep / toplam
function birimTop(rows) {
  const b = new Map();
  for (const x of rows) {
    const k = x.birim || '—'; const o = b.get(k) || { birim: k, kalem: 0, ana: 0, cep: 0, kalan: 0 };
    o.kalem++; o.ana += x.ana; o.cep += x.cep; o.kalan += x.kalan; b.set(k, o);
  }
  return [...b.values()].map((o) => ({ ...o, ana: round(o.ana), cep: round(o.cep), kalan: round(o.kalan) })).sort((a, b2) => b2.kalem - a.kalem);
}

module.exports = { Calc, FIRE_COLS, PAL, nextDay };
