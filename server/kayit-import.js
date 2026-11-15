'use strict';
// Depo Takip 2.1 — Excel'den kayıt yükleme (geçmiş girişler, çıkışlar, transferler, üretim, sevkiyat, listeler, açılış stokları)
// Akış: şablon indir → doldur → yükle → önizleme (hatalı satırlar, mükerrer kayıtlar) → uygula (tek "geri al" paketi)
const { readXlsx } = require('./xlsx');
const { trKey, parseNum, dateOnly, AppError } = require('./store');
const { C } = require('./schema');
const { T, N, writeXlsx } = require('./exports');

const TURLER = {
  satinalma: 'Geçmiş hammadde girişleri (satınalma)',
  cep: 'Depolar arası transferler (ana ↔ cep)',
  iade: 'Hammadde çıkışları — tedarikçiye iade',
  iskarta: 'Hammadde çıkışları — ıskarta / imha',
  sayim: 'Hammadde açılış stokları / sayım',
  uretim: 'Geçmiş üretim kayıtları',
  sevkiyat: 'Geçmiş sevkiyat kayıtları',
  urunSayim: 'Mamul açılış stokları / sayım',
  fireTartim: 'Fire tartımları',
  hammadde: 'Hammadde listesi',
  urun: 'Mamul (ürün) listesi',
};
const SEVK_URUN = 'Ürün (ad veya mamul kodu)';
const SEVK_Y = 'Yurtiçi (koli)';
const SEVK_I = 'İhracat (koli)';
const MAT_KOD = 'KYN Kodu';

// Şablon sütunları
function columns(store, coll) {
  const out = [];
  for (const f of store.fields(coll)) {
    if (f.hidden || f.ro) continue;
    if (coll === 'hammadde' && ['sira', 'eskiKod'].includes(f.k)) continue;
    if (coll === 'urun' && f.k === 'sira') continue;
    if (f.t === 'map') continue;
    if (f.t === 'mat') { out.push({ h: MAT_KOD, f, code: 1 }); out.push({ h: f.l, f }); continue; }
    out.push({ h: f.l, f });
  }
  if (coll === 'sevkiyat') {
    const i = out.findIndex((c) => c.f.k === 'arac');
    out.splice(i < 0 ? out.length : i, 0, { h: SEVK_URUN, sev: 'urun' }, { h: SEVK_Y, sev: 'y' }, { h: SEVK_I, sev: 'i' });
  }
  return out;
}
const optText = (o) => (Array.isArray(o) ? `${o[1]} (${o[0]})` : o);
function helpOf(c) {
  const f = c.f;
  if (c.sev === 'urun') return 'Ürün adı veya MML kodu. Aynı tarih + müşteri + irsaliye satırları tek sevkiyat kaydında birleşir.';
  if (c.sev) return 'Koli sayısı';
  if (c.code) return 'KYN kodu veya yandaki sütuna hammadde adı (biri yeterli)';
  const req = f.req ? 'ZORUNLU. ' : '';
  switch (f.t) {
    case 'date': return req + 'Tarih: GG.AA.YYYY';
    case 'num': case 'int': return req + 'Sayı' + (f.pos ? ' (sıfırdan büyük)' : '');
    case 'mat': return req + 'Hammadde adı';
    case 'ref': return req + `${(C[f.ref] || {}).one || f.ref} adı`;
    case 'sel': return req + 'Seçenekler: ' + (f.opts || []).map(optText).join(' · ');
    case 'multi': return req + 'Virgülle ayırın: ' + (f.opts || []).map(optText).join(' · ');
    case 'bool': return req + 'Evet / Hayır';
    default: return req + (f.help || 'Metin');
  }
}

function template(store, coll) {
  if (!TURLER[coll]) throw new AppError(404, 'Bu tür için şablon yok');
  const cols = columns(store, coll);
  const sheet = { name: 'Kayıtlar', columns: cols.map((c) => ((c.f && (c.f.t === 'num' || c.f.t === 'int')) || c.sev === 'y' || c.sev === 'i' ? N(c.h, 14) : T(c.h, c.f && c.f.t === 'date' ? 12 : c.f && (c.f.t === 'mat' || c.f.t === 'note') ? 30 : 16))), rows: [] };
  const help = { name: 'Açıklama', columns: [T('Sütun', 28), T('Nasıl doldurulur?', 100)], rows: [
    ...cols.map((c) => [c.h, helpOf(c)]),
    [],
    ['Genel', '1) "Kayıtlar" sayfasında başlık satırını değiştirmeyin; her satır bir kayıttır. Boş satırlar atlanır.'],
    ['', '2) Dosyayı Ayarlar → Excel içe aktarma → "Excel\'den kayıt yükle" bölümünden yükleyin. Önce önizleme gösterilir.'],
    ['', '3) Hatalı satırlar ve sistemde zaten bulunan (mükerrer) kayıtlar önizlemede işaretlenir; hata raporunu indirip düzeltebilirsiniz.'],
    ['', '4) Yükleme tek işlem olarak kaydedilir; Değişiklik geçmişinden tek seferde geri alınabilir.'],
  ] };
  if (['hammadde'].includes(coll)) help.rows.push(['', 'Gruplar: ' + store.all('grup').map((g) => g.ad).join(' · ')]);
  return writeXlsx([sheet, help]);
}

// ---- okuma ----
function findHeader(rows, cols) {
  const keys = new Set(cols.map((c) => trKey(c.h)));
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i] || [];
    const hit = r.filter((x) => keys.has(trKey(x))).length;
    if (hit >= Math.min(2, cols.length)) return i;
  }
  return -1;
}
const blank = (v) => v === null || v === undefined || String(v).trim() === '';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function resolveRef(store, coll, v) {
  const k = trKey(v);
  const list = store.all(coll);
  const id = Number(v);
  const hit = list.find((d) => trKey(d.ad) === k || trKey(d.kod) === k || trKey(d.firma) === k) || (Number.isInteger(id) && store.get(coll, id) && !store.get(coll, id)._deleted ? store.get(coll, id) : null);
  return hit ? hit.id : null;
}
function cellToInput(store, c, v) {
  const f = c.f;
  if (blank(v)) return undefined;
  switch (f.t) {
    case 'date': {
      if (typeof v === 'number') return v;
      return String(v).trim();
    }
    case 'num': case 'int': return typeof v === 'number' ? v : parseNum(v);
    case 'ref': {
      const id = resolveRef(store, f.ref, v);
      if (!id) throw new Error(`"${f.l}": "${v}" bulunamadı`);
      return id;
    }
    case 'sel': {
      const s = String(v).trim(); const k = trKey(s);
      const o = (f.opts || []).find((x) => (Array.isArray(x) ? trKey(x[0]) === k || trKey(x[1]) === k : trKey(x) === k));
      if (!o) throw new Error(`"${f.l}": "${s}" geçerli bir seçenek değil`);
      return Array.isArray(o) ? o[0] : o;
    }
    case 'multi': {
      return String(v).split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((s) => {
        const k = trKey(s); const o = (f.opts || []).find((x) => (Array.isArray(x) ? trKey(x[0]) === k || trKey(x[1]) === k : trKey(x) === k));
        if (!o) throw new Error(`"${f.l}": "${s}" geçerli değil`);
        return Array.isArray(o) ? o[0] : o;
      });
    }
    case 'bool': return /^(evet|e|yes|1|true|x|var)$/i.test(String(v).trim());
    default: return typeof v === 'number' ? String(v) : String(v);
  }
}

const sig = (o) => JSON.stringify(Object.keys(o).filter((k) => k !== 'aciklama' && !k.startsWith('_') && k !== 'id').sort().map((k) => [k, o[k]]));

// Dosyayı çözümler; satır bazında sonuç döner
function analyze(store, coll, buf) {
  if (!TURLER[coll]) throw new AppError(404, 'Bu tür Excel\'den yüklenemez');
  let rows;
  try { rows = readXlsx(buf); } catch (e) { throw new AppError(400, 'Excel dosyası okunamadı: ' + e.message); }
  const cols = columns(store, coll);
  const hi = findHeader(rows, cols);
  if (hi < 0) throw new AppError(400, `Başlık satırı bulunamadı. "${TURLER[coll]}" için uygulamadan indirdiğiniz şablonu kullanın.`);
  const head = rows[hi].map((h) => trKey(h));
  const idx = cols.map((c) => head.indexOf(trKey(c.h)));
  const eksik = cols.filter((c, i) => idx[i] < 0 && c.f && c.f.req && !(c.f.t === 'mat')).map((c) => c.h);
  if (coll === 'sevkiyat' && idx[cols.findIndex((c) => c.sev === 'urun')] < 0) eksik.push(SEVK_URUN);
  if (eksik.length) throw new AppError(400, 'Dosyada zorunlu sütunlar yok: ' + eksik.join(', '));

  const isRec = C[coll].kind === 'rec';
  const existing = new Map();
  if (isRec) for (const d of store.all(coll)) existing.set(sig(store.dataOf(d)), d.id);
  const seen = new Map();
  const bugun = today();
  const out = [];
  const sevGroups = new Map();

  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const line = i + 1;
    if (cols.every((c, j) => idx[j] < 0 || blank(r[idx[j]]))) continue;
    const raw = cols.map((c, j) => (idx[j] < 0 ? null : r[idx[j]]));
    const item = { line, raw, durum: 'ok', mesaj: '' };
    out.push(item);
    try {
      const input = {};
      let matKod = null, matAd = null, sev = {};
      cols.forEach((c, j) => {
        const v = raw[j];
        if (c.sev) { sev[c.sev] = v; return; }
        if (c.f.t === 'mat') { if (c.code) matKod = v; else matAd = v; return; }
        const x = cellToInput(store, c, v);
        if (x !== undefined) input[c.f.k] = x;
      });
      const matF = cols.find((c) => c.f && c.f.t === 'mat' && !c.code);
      if (matF) {
        let m = null;
        if (!blank(matKod)) { m = store.findByCode(matKod); if (!m) throw new Error(`KYN kodu "${matKod}" bulunamadı`); }
        else if (!blank(matAd)) { m = store.all('hammadde').find((d) => trKey(d.ad) === trKey(matAd)); if (!m) throw new Error(`Hammadde "${matAd}" bulunamadı`); }
        if (m) input[matF.f.k] = m.id;
      }
      if (coll === 'sevkiyat') {
        if (blank(sev.urun)) throw new Error('Ürün boş');
        const u = resolveRef(store, 'urun', sev.urun);
        if (!u) throw new Error(`Ürün "${sev.urun}" bulunamadı`);
        const y = blank(sev.y) ? 0 : (typeof sev.y === 'number' ? sev.y : parseNum(sev.y));
        const ih = blank(sev.i) ? 0 : (typeof sev.i === 'number' ? sev.i : parseNum(sev.i));
        if (!isFinite(y) || !isFinite(ih) || y < 0 || ih < 0) throw new Error('Koli sayısı geçersiz');
        if (!y && !ih) throw new Error('Yurtiçi veya ihracat koli sayısı girilmeli');
        // satırları tek sevkiyat kaydında birleştir
        const key = [input.tarih, input.musteri, input.irsNo, input.plaka, input.adres].map((x) => trKey(x)).join('|');
        let g = sevGroups.get(key);
        if (!g) { g = { input: { ...input, miktar: {}, ihracat: {} }, items: [] }; sevGroups.set(key, g); }
        if (y) g.input.miktar[u] = (g.input.miktar[u] || 0) + y;
        if (ih) g.input.ihracat[u] = (g.input.ihracat[u] || 0) + ih;
        if (input.arac && !g.input.arac) g.input.arac = input.arac;
        if (input.aciklama && !g.input.aciklama) g.input.aciklama = input.aciklama;
        g.items.push(item);
        item.ozet = `${(store.get('urun', u) || {}).ad}: ${y ? y + ' koli' : ''}${ih ? ' ihracat ' + ih : ''}`;
        continue;
      }
      finish(store, coll, input, item, { isRec, existing, seen, bugun });
    } catch (e) { item.durum = 'hata'; item.mesaj = e.message; }
  }
  // sevkiyat grupları
  for (const g of sevGroups.values()) {
    const probe = { durum: 'ok', mesaj: '' };
    finish(store, coll, g.input, probe, { isRec, existing, seen, bugun });
    for (const it of g.items) { if (it.durum === 'ok') { it.durum = probe.durum; it.mesaj = probe.mesaj; } }
    g.ok = probe.durum === 'ok'; g.data = probe.data;
    if (g.ok) g.items[0].data = probe.data; // ilk satır kaydı taşır
  }
  const say = (d) => out.filter((x) => x.durum === d).length;
  return { coll, ad: TURLER[coll], cols: cols.map((c) => c.h), rows: out, toplam: out.length, gecerli: say('ok'), guncelle: say('guncelle'), hatali: say('hata'), mukerrer: say('mukerrer'),
    kayitSayisi: coll === 'sevkiyat' ? [...sevGroups.values()].filter((g) => g.ok).length : say('ok') + say('guncelle') };
}

function finish(store, coll, input, item, { isRec, existing, seen, bugun }) {
  try {
    if (isRec) {
      const data = store.normalize(coll, input, null);
      if (data.tarih && data.tarih > bugun) throw new Error(`İleri tarih olamaz (${data.tarih.split('-').reverse().join('.')})`);
      const s = sig(data);
      if (existing.has(s)) { item.durum = 'mukerrer'; item.mesaj = `Sistemde aynı kayıt var (kayıt no ${existing.get(s)})`; return; }
      if (seen.has(s)) { item.durum = 'mukerrer'; item.mesaj = `Dosyada tekrar ediyor (satır ${seen.get(s)})`; return; }
      seen.set(s, item.line);
      item.data = data; item.durum = 'ok';
    } else {
      // tanım listeleri: adı (veya kodu) aynı olan varsa güncellenir
      const cur = store.all(coll).find((d) => trKey(d.ad) === trKey(input.ad));
      if (cur) {
        const data = store.normalize(coll, input, cur);
        if (sig(data) === sig(store.dataOf(cur))) { item.durum = 'mukerrer'; item.mesaj = 'Sistemde aynısı var'; return; }
        item.data = input; item.id = cur.id; item.durum = 'guncelle'; item.mesaj = `${cur.kod || cur.ad} güncellenecek`;
        return;
      }
      const k = trKey(input.ad);
      if (seen.has('ad:' + k)) { item.durum = 'mukerrer'; item.mesaj = `Dosyada tekrar ediyor (satır ${seen.get('ad:' + k)})`; return; }
      store.normalize(coll, input, null);
      seen.set('ad:' + k, item.line);
      item.data = input; item.durum = 'ok';
    }
  } catch (e) { item.durum = 'hata'; item.mesaj = e.message; }
}

function ops(store, a) {
  const out = [];
  for (const it of a.rows) {
    if (it.durum === 'ok' && it.data) out.push({ op: 'create', coll: a.coll, data: it.data });
    else if (it.durum === 'guncelle') out.push({ op: 'update', coll: a.coll, id: it.id, data: it.data });
  }
  return out;
}

const DUR_TR = { ok: 'Yüklenecek', guncelle: 'Güncellenecek', hata: 'HATA', mukerrer: 'Mükerrer (atlanır)' };
function errorReport(a, all) {
  const list = all ? a.rows : a.rows.filter((r) => r.durum === 'hata' || r.durum === 'mukerrer');
  const cols = [N('Excel satırı', 8), T('Durum', 18), T('Açıklama', 50), ...a.cols.map((h) => T(h, 16))];
  const rows = list.map((r) => [r.line, DUR_TR[r.durum] || r.durum, r.mesaj, ...r.raw.map((v) => (v === undefined ? null : v))]);
  return writeXlsx([{ name: 'Hata Raporu', title: `${a.ad} — yükleme raporu`, subtitle: `${a.toplam} satır · ${a.gecerli + a.guncelle} geçerli · ${a.hatali} hatalı · ${a.mukerrer} mükerrer`, columns: cols, rows,
    cf: [{ cols: ['B', 'C'], formula: (r) => `$B${r}="HATA"`, style: 0 }] }]);
}

module.exports = { TURLER, template, analyze, ops, errorReport };
