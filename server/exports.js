'use strict';
// Excel çıktıları (formüllü). writeXlsx: başlık + alt başlık + boş satır => sütun başlıkları 4. satır, veriler 5. satırdan başlar.
const { writeXlsx, colName } = require('./xlsx');

const START = 5;
const trD = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('.') : '');
const N = (h, w, extra) => ({ header: h, width: w || 13, type: 'num', ...extra });
const T = (h, w) => ({ header: h, width: w || 14 });

function ayAdi(ay) { const [y, m] = ay.split('-').map(Number); return new Date(y, m - 1, 15).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }); }

// Dönem adı: ay seçiliyse "Ekim 2026", tarih aralığıysa "01.10.2026 – 15.10.2026"
function donem(ctx) { return ctx.donem || (ctx.ay ? ayAdi(ctx.ay) : new Date().toLocaleDateString('tr-TR')); }

// Sütun harfi bulucu
function L(cols, header) { const i = cols.findIndex((c) => c.header === header); if (i < 0) throw new Error('Sütun yok: ' + header); return colName(i); }

function hammaddeSheet(rows, ctx) {
  const cols = [T('KYN Kodu', 14), T('Grup', 18), T('Hammadde', 38), T('Birim', 7), T('Gramaj', 10),
    N('Devreden'), N('Kullanılan'), N('Fire'), N('Top. Çıkan'), N('Satın Alınan'), N('İade Edilen'), N('Sayım Farkı'), N('İmha'),
    N('Kalan'), N('Iskarta'), N('Kullanılabilen'), N('Ana Depo'), N('Cep Depo'), N("Cep'e Verilen"), N('Yak. Koli'), N('Asgari Stok'), T('Durum', 14)];
  const c = (h) => L(cols, h);
  const data = rows.map((r, i) => {
    const n = START + i; const x = (h) => `${c(h)}${n}`;
    return [r.kod, r.grup, r.ad, r.birim, r.gramaj, r.devreden, r.kullanilan, r.fire,
      { f: `${x('Kullanılan')}+${x('Fire')}`, v: r.topCikan }, r.alim, r.iade, r.sayimFark, r.imha,
      { f: `${x('Devreden')}-${x('Top. Çıkan')}+${x('Satın Alınan')}-${x('İade Edilen')}+${x('Sayım Farkı')}-${x('İmha')}`, v: r.kalan },
      r.iskarta, { f: `${x('Kalan')}-${x('Iskarta')}`, v: r.kullanilabilen }, r.ana, { f: `${x('Kalan')}-${x('Ana Depo')}`, v: r.cep }, r.cepNet,
      r.yakKoli, r.asgari,
      { f: `IF(AND(${x('Asgari Stok')}>0,${x('Kullanılabilen')}<${x('Asgari Stok')}),"SİPARİŞ VER","")`, v: r.durum === 'siparis' || r.durum === 'tukendi' ? 'SİPARİŞ VER' : '' }];
  });
  const last = START + rows.length - 1;
  const tot = ['TOPLAM', '', '', '', ''];
  for (let i = 5; i < cols.length; i++) tot.push(['Yak. Koli', 'Asgari Stok', 'Durum'].includes(cols[i].header) ? '' : (rows.length ? { f: `SUBTOTAL(9,${colName(i)}${START}:${colName(i)}${last})`, v: null } : 0));
  return { name: 'Hammadde', title: `${ctx.company} — Hammadde Stok Raporu`, subtitle: `${donem(ctx)} · Devreden = ay başındaki stok · Kalan = Devreden − Top. Çıkan + Satın Alınan − İade + Sayım Farkı − İmha`,
    columns: cols, rows: data,
    cf: [
      { cols: [c('Kullanılabilen'), c('Durum')], formula: (r) => `AND($${c('Asgari Stok')}${r}>0,$${c('Kullanılabilen')}${r}<$${c('Asgari Stok')}${r})`, style: 0 },
      { cols: [c('Kalan')], formula: (r) => `${c('Kalan')}${r}<0`, style: 0 },
    ] };
}

// Aylık takip (TRK şablonu: A–J hammadde)
function takipSheet(rows, ctx) {
  const cols = [T('KYN Kodu', 14), T('Hammadde', 36), T('Birim', 7),
    N('ÖNCEKİ AYDAN DEVREDEN KALAN ANA DEPO', 16), N('HAMMADDE ALIMI'), N('ANA DEPO'), N('CEP DEPOYA VERİLEN ÜRETİM', 16), N('KALAN ANA DEPO'),
    N('ASGARİ STOK'), N('ÜRETİLEN (KULLANILAN)'), N('FİRE MİKTARI'), N('ÜRETİLEN + FİRE'), T('KARŞILAŞTIRMA CEP DEPO = ÜRETİM + FİRE', 18),
    N('DİĞER ANA DEPO HAREKETİ (iade, sayım, imha)', 16), N('CEP DEPODA KALAN', 14), T('UYARI', 20)];
  const c = (h) => L(cols, h);
  const data = rows.filter((r) => r.trk.A || r.trk.B || r.trk.D || r.trk.G || r.trk.E || r.hareket).map((r, i) => {
    const n = START + i; const x = (h) => `${c(h)}${n}`; const t = r.trk;
    return [r.kod, r.ad, r.birim, t.A, t.B, { f: `${x('ÖNCEKİ AYDAN DEVREDEN KALAN ANA DEPO')}+${x('HAMMADDE ALIMI')}`, v: t.C }, t.D,
      { f: `${x('ANA DEPO')}-${x('CEP DEPOYA VERİLEN ÜRETİM')}+${x('DİĞER ANA DEPO HAREKETİ (iade, sayım, imha)')}`, v: t.E }, t.F || null, t.G, t.H,
      { f: `${x('ÜRETİLEN (KULLANILAN)')}+${x('FİRE MİKTARI')}`, v: t.I }, { f: `${x('CEP DEPOYA VERİLEN ÜRETİM')}=${x('ÜRETİLEN + FİRE')}`, v: t.J },
      t.diger, t.cepSon, { f: `IF(AND(${x('ASGARİ STOK')}>0,${x('KALAN ANA DEPO')}<${x('ASGARİ STOK')}),"ASGARİ STOK ALTINDA","")`, v: t.F > 0 && t.E < t.F ? 'ASGARİ STOK ALTINDA' : '' }];
  });
  return { name: 'Aylık Takip', title: `${ctx.company} — Aylık Hammadde Takibi`, subtitle: donem(ctx), columns: cols, rows: data,
    cf: [
      { cols: [c('KALAN ANA DEPO'), c('ASGARİ STOK'), c('UYARI')], formula: (r) => `AND($${c('ASGARİ STOK')}${r}>0,$${c('KALAN ANA DEPO')}${r}<$${c('ASGARİ STOK')}${r})`, style: 0 },
      { cols: [c('KARŞILAŞTIRMA CEP DEPO = ÜRETİM + FİRE')], formula: (r) => `$${c('KARŞILAŞTIRMA CEP DEPO = ÜRETİM + FİRE')}${r}=FALSE`, style: 0 },
      { cols: [c('KARŞILAŞTIRMA CEP DEPO = ÜRETİM + FİRE')], formula: (r) => `$${c('KARŞILAŞTIRMA CEP DEPO = ÜRETİM + FİRE')}${r}=TRUE`, style: 1 },
    ] };
}

// Ürün stok (TRK şablonu: K–O ürün)
function urunSheet(rows, ctx) {
  const cols = [T('Ürün', 22), N('MEVCUT ÜRÜN STOK (devir)'), N('ÜRETİLEN (koli)'), N('TOPLAM ÜRÜN STOK'), N('SEVK (yurtiçi)'), N('SEVK (ihracat)'), N('ÜRÜN SEVK'),
    N('SAYIM FARKI'), N('SEVKTEN KALAN ÜRÜN STOK'), N('TOPLAM STOKLA SEVK ARASINDAKİ FARK', 16), N('Kalan palet'), N('Kalan kg')];
  const c = (h) => L(cols, h);
  const data = rows.map((r, i) => {
    const n = START + i; const x = (h) => `${c(h)}${n}`;
    return [r.ad, r.devir, r.uretilen, { f: `${x('MEVCUT ÜRÜN STOK (devir)')}+${x('ÜRETİLEN (koli)')}`, v: r.toplam }, r.sevk, r.ihracat,
      { f: `${x('SEVK (yurtiçi)')}+${x('SEVK (ihracat)')}`, v: r.sevkToplam }, r.sayimFark,
      { f: `${x('TOPLAM ÜRÜN STOK')}-${x('ÜRÜN SEVK')}+${x('SAYIM FARKI')}`, v: r.kalan }, { f: `${x('TOPLAM ÜRÜN STOK')}-${x('ÜRÜN SEVK')}`, v: r.fark },
      r.kalanPalet, r.kalanKg];
  });
  return { name: 'Ürün Stok', title: `${ctx.company} — Ürün Stok (koli)`, subtitle: donem(ctx), columns: cols, rows: data,
    cf: [{ cols: [c('SEVKTEN KALAN ÜRÜN STOK'), c('TOPLAM STOKLA SEVK ARASINDAKİ FARK')], formula: (r) => `${c('SEVKTEN KALAN ÜRÜN STOK')}${r}<0`, style: 0 }] };
}

function uretimOzetSheet(o, ctx) {
  const cols = [T('Ürün', 22), N('Kayıt', 7), N('Giren adet'), N('Çıkan şişe'), N('Preform / Alt folyo fire'), N('Pet / Şişe / Bardak fire'), N('Kapak fire'), N('Etiket fire'), N('Kulp fire'),
    N('Shrink fire (gr)'), N('Net üretim adeti'), N('Standart palet'), N('İhracat palet'), N('Euro palet'), N('Paletsiz koli'), N('Toplam koli'), N('Üretimin %'), N('Sayaç farkı'),
    N('Vardiya süresi (dk)'), N('Üretim süresi (dk)'), N('Ort. vardiya verimi %'), N('Ort. üretim verimi %')];
  const row = (a, ad) => [ad, a.kayit, a.giren, a.cikan, a.fPrf, a.fPet, a.fKapak, a.fEtiket, a.fKulp, a.fShrink, a.net, a.pStd, a.pIhr, a.pEuro, a.paletsiz, a.koli, a.oran ?? 100, a.sayacFarki, a.vardiyaSure, a.sure, a.vardiyaVrm, a.uretimVrm];
  const rows = o.urunler.filter((u) => u.kayit).map((u) => row(u, u.ad));
  rows.push(row(o.toplam, 'TOPLAM'));
  const hat = o.hatlar.map((h) => row(h, 'Hat: ' + h.ad));
  return { name: 'Üretim Özeti', title: `${ctx.company} — Üretim Özeti`, subtitle: donem(ctx), columns: cols, rows: rows.concat([[]], hat) };
}

function kullanimSheet(list, ctx) {
  const cols = [T('Ürün', 20), N('Üretilen koli'), T('KYN Kodu', 14), T('Hammadde', 36), N('Reçete miktarı', 12), T('Birim', 9), T('Taban', 10), N('Üretimde kullanılan'), N('Fire'), N('Toplam çıkan'), N('Fire oranı %', 10)];
  const rows = [];
  for (const u of list) {
    if (!u.koli) continue;
    for (const s of u.satirlar) {
      if (!s.toplam) continue;
      const n = START + rows.length;
      rows.push([u.ad, u.koli, s.kod, s.ad, s.miktar, s.birim, s.baz, s.kullanilan, s.fire, { f: `H${n}+I${n}`, v: s.toplam }, { f: `IF(J${n}>0,I${n}/J${n}*100,0)`, v: s.oran }]);
    }
  }
  return { name: 'Reçete Kullanımı', title: `${ctx.company} — Reçeteye Göre Hammadde Kullanımı`, subtitle: donem(ctx), columns: cols, rows };
}

function sevkiyatSheet(rep, ctx) {
  const ur = rep.urunler.filter((u) => u.toplam > 0 || true);
  const cols = [T('Tarih', 11)];
  for (const u of ur) cols.push(N(u.ad, 11));
  for (const u of ur.filter((x) => x.ihracat > 0)) cols.push(N(u.ad + ' İhracat', 11));
  const ihr = ur.filter((x) => x.ihracat > 0);
  cols.push(N('Toplam koli'), N('Palet'), N('Kg'), N('Araç'), N('Tır (kg)'), N('Tır (palet)'));
  const first = colName(1); const lastP = colName(ur.length + ihr.length);
  const rows = rep.gunler.map((g, i) => {
    const n = START + i;
    return [trD(g.tarih), ...ur.map((u) => g.miktar[u.id] || null), ...ihr.map((u) => g.ihracat[u.id] || null), { f: `SUM(${first}${n}:${lastP}${n})`, v: g.toplam }, g.palet, g.kg, g.arac, g.tirKg, g.tirPalet];
  });
  const last = START + rows.length - 1;
  if (rows.length) rows.push(['TOPLAM', ...cols.slice(1).map((c, i) => (['Tır (kg)', 'Tır (palet)'].includes(c.header) ? null : { f: `SUM(${colName(i + 1)}${START}:${colName(i + 1)}${last})`, v: null }))]);
  return { name: 'Sevkiyat', title: `${ctx.company} — Sevkiyat`, subtitle: `${donem(ctx)} · ${rep.toplam.sevkGun} sevkiyat günü · günlük ort. ${rep.toplam.gunlukOrt} koli`, columns: cols, rows };
}

// Kayıt listesi (her tür için)
function listeSheet(store, calc, coll, docs, ctx, label) {
  const fields = store.fields(coll).filter((f) => !f.hidden);
  const S = require('./schema').C[coll];
  const comp = (S && S.computed) || [];
  const cols = [];
  const name = (rc, id) => { const d = store.get(rc, id); return d ? d.ad || d.kod || d.firma || '' : ''; };
  for (const f of fields) {
    if (f.t === 'map') { for (const u of store.all('urun')) cols.push({ ...N(`${f.l}: ${u.ad}`, 10), _f: f, _u: u.id }); continue; }
    if (f.t === 'mat') { cols.push({ ...T('KYN Kodu', 13), _f: f, _code: 1 }); cols.push({ ...T(f.l, 32), _f: f }); continue; }
    cols.push({ ...(f.t === 'num' || f.t === 'int' ? N(f.l, 12) : T(f.l, f.t === 'date' ? 11 : f.t === 'note' ? 30 : 16)), _f: f });
  }
  for (const c of comp) cols.push({ ...N(c.l, 12), _c: c });
  cols.push(T('Giren', 14), T('Kayıt no', 8));
  const rows = docs.map((d) => {
    const cv = calc.computedFor(coll, d);
    return cols.map((c) => {
      if (c._c) return cv[c._c.k] ?? null;
      if (c.header === 'Giren') return d._byName || '';
      if (c.header === 'Kayıt no') return d.id;
      const f = c._f; const v = d[f.k];
      if (f.t === 'map') return (v || {})[c._u] || null;
      if (v === undefined || v === null || v === '') return null;
      if (f.t === 'mat') { const m = store.get('hammadde', v); return c._code ? (m ? m.kod : '') : (m ? m.ad : ''); }
      if (f.t === 'ref') return name(f.ref, v);
      if (f.t === 'date') return trD(v);
      if (f.t === 'bool') return v ? 'Evet' : 'Hayır';
      if (f.t === 'sel') { const o = (f.opts || []).find((x) => (Array.isArray(x) ? x[0] : x) === v); return o ? (Array.isArray(o) ? o[1] : o) : v; }
      if (f.t === 'multi') return (v || []).map((k) => { const o = (f.opts || []).find((x) => (Array.isArray(x) ? x[0] : x) === k); return o ? (Array.isArray(o) ? o[1] : o) : k; }).join(', ');
      return v;
    });
  });
  return { name: (label || S.label).slice(0, 31), title: `${ctx.company} — ${label || S.label}`, subtitle: donem(ctx), columns: cols.map(({ _f, _c, _u, _code, ...c }) => c), rows };
}

function sayimSablonu(store, calc) {
  const g = calc.guncel();
  const cols = [T('KYN Kodu', 14), T('Hammadde', 38), T('Grup', 18), T('Birim', 8), N('Ana Depo Sayım', 14), N('Cep Depo Sayım', 14), N('Asgari Stok', 12), N('Sistemde Ana (bilgi)', 14), N('Sistemde Cep (bilgi)', 14)];
  const rows = store.all('hammadde').filter((d) => d.aktif !== false).sort((a, b) => ((store.get('grup', a.grup) || {}).sira || 0) - ((store.get('grup', b.grup) || {}).sira || 0) || (a.sira || 0) - (b.sira || 0))
    .map((d) => { const x = g.get(d.id) || {}; return [d.kod, d.ad, (store.get('grup', d.grup) || {}).ad || '', d.birim, null, null, d.asgari || null, x.ana, x.cep]; });
  return [{ name: 'Sayım', columns: cols, rows },
    { name: 'Açıklama', columns: [T('Nasıl doldurulur?', 110)], rows: [
      ['1) "Ana Depo Sayım" ve "Cep Depo Sayım" sütunlarına saydığınız miktarı yazın. Boş hücreler değiştirilmez.'],
      ['2) Sistem, sayılan ile hesaplanan stok arasındaki farkı "Hammadde Sayımı" kaydı olarak işler (sayım tarihi yükleme ekranında seçilir).'],
      ['3) "Asgari Stok" sütununu değiştirirseniz hammadde kartındaki asgari stok güncellenir.'],
      ['4) Dosyayı Ayarlar → İçe aktar → Sayım şablonu bölümünden yükleyin; önce önizleme gösterilir. Yapılan aktarma "Geri al" ile tek seferde geri alınabilir.'],
    ] }];
}

// ---------- 2.1: depo raporları ----------
function anaDepoSheet(rows, ctx) {
  const cols = [T('KYN Kodu', 14), T('Grup', 18), T('Hammadde', 36), T('Birim', 7), N('Devreden (ana)'), N('Satın alınan'), N('Tedarikçiye iade'), N("Cep'e verilen (net)"), N('Sayım farkı (ana)'), N('İmha'), N('Kalan ana depo'), N('Asgari stok')];
  const c = (h) => L(cols, h);
  const data = rows.filter((r) => r.devAna || r.alim || r.iade || r.cepNet || r.sayimAna || r.imha || r.ana).map((r, i) => {
    const n = START + i; const x = (h) => `${c(h)}${n}`;
    return [r.kod, r.grup, r.ad, r.birim, r.devAna, r.alim, r.iade, r.cepNet, r.sayimAna, r.imha,
      { f: `${x('Devreden (ana)')}+${x('Satın alınan')}-${x('Tedarikçiye iade')}-${x("Cep'e verilen (net)")}+${x('Sayım farkı (ana)')}-${x('İmha')}`, v: r.ana }, r.asgari];
  });
  return { name: 'Ana Depo', title: `${ctx.company} — Ana Depo Raporu`, subtitle: `${donem(ctx)} · Kalan = Devreden + Alım − İade − Cep'e verilen ± Sayım − İmha`, columns: cols, rows: data,
    cf: [{ cols: [c('Kalan ana depo')], formula: (r) => `${c('Kalan ana depo')}${r}<0`, style: 0 }] };
}
function cepDepoSheet(rows, ctx) {
  const cols = [T('KYN Kodu', 14), T('Grup', 18), T('Hammadde', 36), T('Birim', 7), N('Devreden (cep)'), N('Ana depodan gelen (net)'), N('Üretimde kullanılan'), N('Üretim firesi'), N('Sayım farkı (cep)'), N('Kalan cep depo')];
  const c = (h) => L(cols, h);
  const data = rows.filter((r) => r.devCep || r.cepNet || r.kullanilan || r.fire || r.sayimCep || r.cep).map((r, i) => {
    const n = START + i; const x = (h) => `${c(h)}${n}`;
    return [r.kod, r.grup, r.ad, r.birim, r.devCep, r.cepNet, r.kullanilan, r.fire, r.sayimCep,
      { f: `${x('Devreden (cep)')}+${x('Ana depodan gelen (net)')}-${x('Üretimde kullanılan')}-${x('Üretim firesi')}+${x('Sayım farkı (cep)')}`, v: r.cep }];
  });
  return { name: 'Cep Depo', title: `${ctx.company} — Cep Depo Raporu`, subtitle: `${donem(ctx)} · Kalan = Devreden + Gelen − Kullanılan − Fire ± Sayım`, columns: cols, rows: data,
    cf: [{ cols: [c('Kalan cep depo')], formula: (r) => `${c('Kalan cep depo')}${r}<0`, style: 0 }] };
}
function hareketSheet(list, ctx, names) {
  const cols = [T('Tarih', 11), T('Hareket', 26), T('KYN Kodu', 14), T('Hammadde', 34), T('Birim', 7), N('Ana depo ±'), N('Cep depo ±'), N('Sayılan'), N('Sayım farkı'), T('Lot no', 12), T('Belge / irsaliye', 14), T('Firma', 18), T('Giren', 16), T('Kayıt zamanı', 16), T('Kayıt no', 8)];
  const rows = list.map((e) => [trD(e.t), e.ad + (e.kind === 'sayim' ? (e.depo === 'cep' ? ' (cep)' : ' (ana)') : ''), e.kod, e.matAd, e.birim, e.ana || null, e.cep || null,
    e.kind === 'sayim' ? e.val : null, e.kind === 'sayim' ? e.delta : null, e.lotNo, e.belge, e.firma, names.get(e.by) || '', e.at ? new Date(e.at).toLocaleString('tr-TR') : '', e.id]);
  return { name: 'Hammadde Hareketleri', title: `${ctx.company} — Hammadde Hareket Raporu`, subtitle: donem(ctx), columns: cols, rows };
}
function islemSheet(list, ctx) {
  const cols = [T('Zaman', 17), T('Kullanıcı', 18), T('İşlem', 14), T('Kayıt türü', 20), T('Kayıt', 40), T('Değişen alanlar', 50), T('Açıklama', 30), T('Durum', 12)];
  const rows = list.map((r) => [new Date(r.at).toLocaleString('tr-TR'), r.user || 'Sistem', r.islem, r.tur, r.kayit, r.alanlar, r.label || '', r.geriAlindi ? 'Geri alındı' : '']);
  return { name: 'Kullanıcı İşlemleri', title: `${ctx.company} — Kullanıcı İşlem Raporu`, subtitle: donem(ctx), columns: cols, rows };
}
function durumSheet(d, ctx) {
  const cols = [T('KYN Kodu', 14), T('Grup', 18), T('Hammadde', 36), T('Birim', 7), N('Ana depo'), N('Cep depo'), N('Toplam'), N('Iskarta'), N('Kullanılabilen'), N('Asgari'), T('Durum', 12)];
  const DUR = { normal: '', siparis: 'SİPARİŞ VER', tukendi: 'TÜKENDİ', eksi: 'EKSİ STOK' };
  const rows = d.hammadde.map((r, i) => { const n = START + i; return [r.kod, r.grup, r.ad, r.birim, r.ana, r.cep, { f: `E${n}+F${n}`, v: r.kalan }, r.iskarta || null, { f: `G${n}-H${n}`, v: r.kullanilabilen }, r.asgari, DUR[r.durum] || '']; });
  const ucols = [T('Mamul kodu', 12), T('Ürün', 26), N('Stok (koli)'), N('Palet'), N('Asgari (koli)')];
  const urows = d.urunler.map((u) => [u.kod || '', u.ad, u.koli, u.palet, u.asgari]);
  const sub = `${trD(d.tarih)} günü sonundaki stok`;
  return [{ name: 'Hammadde Durumu', title: `${ctx.company} — Stok Durumu`, subtitle: sub, columns: cols, rows,
    cf: [{ cols: ['I', 'K'], formula: (r) => `AND($J${r}>0,$I${r}<$J${r})`, style: 0 }] },
  { name: 'Mamul Durumu', title: `${ctx.company} — Mamul Stok Durumu`, subtitle: sub, columns: ucols, rows: urows }];
}

module.exports = { anaDepoSheet, cepDepoSheet, hareketSheet, islemSheet, durumSheet, donem, T, N, trD,
  hammaddeSheet, takipSheet, urunSheet, uretimOzetSheet, kullanimSheet, sevkiyatSheet, listeSheet, sayimSablonu, writeXlsx, ayAdi, START };
