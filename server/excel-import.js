'use strict';
// Aylık "Depo Stok Hammadde Raporu" Excel dosyasını okur ve uygulamaya aktarır.
// Tanımlar: Bilgiler (hatlar, kapasiteler, koli/palet tipleri, preform firmaları, vardiyalar, hat sorumluları),
//           Hammadde (liste, gramaj, asgari stok, öncelik), Reçete (formüllerden çözülür)
// Kayıtlar: Üretim Raporu, Satınalma, İade, Iskarta, Cep, Sevkiyat; Hammadde[Devreden] -> ay başı sayımı
const crypto = require('crypto');
const { readWorkbook } = require('./xlsx');
const { AppError, trKey, round } = require('./store');

const GRUP_KOD = {
  Preform: 'PRF', Kapak: 'KPK', Kulp: 'KLP', Etiket: 'ETK', Alt_Folyo: 'ALF', 'Üst.Folyo': 'USF', Tutkal_Bant: 'TBN',
  Shrink_Sleve: 'SHR', Koli: 'KOL', Karton: 'KRT', Stretch: 'STR', Handle: 'HND', Palet_Sunta: 'PLT', 'Aromalılar_Ortak': 'ARO',
  Limonata: 'LMN', Karadut: 'KRD', Mandalina: 'MND', MangoAnanas: 'MNG', 'Cam_Şişe': 'CAM', 'Mürekkep': 'MRK',
  'Üretim_Kimyasalı': 'URK', 'Temizlik_Kimyasalı': 'TMZ',
};
const GRUP_AD = {
  Alt_Folyo: 'Alt Folyo', 'Üst.Folyo': 'Üst Folyo', Tutkal_Bant: 'Tutkal / Bant', Shrink_Sleve: 'Shrink / Sleeve', Palet_Sunta: 'Palet / Sunta',
  'Aromalılar_Ortak': 'Aromalılar Ortak', MangoAnanas: 'Mango Ananas', 'Cam_Şişe': 'Cam Şişe', 'Üretim_Kimyasalı': 'Üretim Kimyasalı', 'Temizlik_Kimyasalı': 'Temizlik Kimyasalı',
};
const GRUP_BIRIM = {
  Preform: 'adet', Kapak: 'adet', Kulp: 'adet', Etiket: 'adet', Koli: 'adet', Karton: 'adet', Handle: 'adet', Palet_Sunta: 'adet', 'Cam_Şişe': 'adet', 'Mürekkep': 'L',
};
// Excel'deki yazım farklılıkları -> uygulamadaki ad
const AD_DUZELT = {
  'damacan dezenfektanı': 'Damacana Dezenfektanı',
  'vc ascorbik acid powdwer 100 mesh 99%': 'VC Ascorbik Acid Powder 100 Mesh 99%',
  '350 mm karadut 200 ml üst folyo': '350 mm Karadut 200 ml Üst Folyo',
  '0,5 l karapınar a3- 84.000 etiket': '0,5 L Karapınar A3 84.000 Etiket',
  '1,5 l karapınar 84.000 etiket': '1,5 L Karapınar A3 84.000 Etiket',
  '390 mm*60 mic. shrink': '390 mm 60 mic. Shrink',
};
const FIRE_COL = {
  'Preform/ Alt Folyo Fire': 'fPrf', 'Pet/Şişe/Bardak Fire': 'fPet', 'Kapak Fire': 'fKapak', 'Etiket Fire': 'fEtiket', 'Kulp Fire': 'fKulp', 'Shrink/ E. Bandı/ Koli Fire': 'fShrink',
};
const PAL_KEY = { 'Standart A. Palet': 'std', 'İhracat Paleti': 'ihr', 'Euro A. Palet': 'euro' };

const clean = (s) => (s === null || s === undefined ? '' : (typeof s === 'object' ? '' : String(s))).replace(/\s+/g, ' ').trim();
const fixName = (s) => { const c = clean(s); return AD_DUZELT[trKey(c)] || c; };
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && v.trim() && isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : 0));
const serialToDate = (v) => {
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  if (typeof v === 'string') { const m = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); }
  return null;
};
const titleTr = (s) => clean(s).toLocaleLowerCase('tr-TR').split(' ').map((w) => (w ? w[0].toLocaleUpperCase('tr-TR') + w.slice(1) : w)).join(' ');

// ---------------- 1) OKU ----------------
function parse(buf) {
  let wb;
  try { wb = readWorkbook(buf); } catch (e) { throw new AppError(400, 'Excel dosyası okunamadı: ' + e.message); }
  const need = ['Tablo14', 'Reçete', 'Üretim_Raporu'];
  for (const t of need) if (!wb.tables.has(t)) throw new AppError(400, 'Bu dosya tanınmadı. "Depo Stok Hammadde Raporu" biçimindeki aylık Excel dosyasını yükleyin. (Eksik tablo: ' + t + ')');
  const uyarilar = [];
  const pkg = { uyarilar, gruplar: [], hammaddeler: [], urunler: [], hatlar: [], kapasiteler: [], koliTipleri: [], paletTipleri: [], preformFirmalari: [], vardiyalar: [], personel: [], receteler: [],
    uretim: [], satinalma: [], iade: [], iskarta: [], cep: [], sevkiyat: [], excel: {}, duzeltilen: [], pasif: [] };

  // Ay
  const n2 = wb.cell('Üretim Raporu', 'N2');
  let ayBas = n2 ? serialToDate(n2.v) : null;
  const ur = wb.tableRows('Üretim_Raporu');
  if (!ayBas) { const d = ur.map((r) => serialToDate(r['Üretim Tarihi'])).filter(Boolean).sort()[0]; ayBas = d ? d.slice(0, 8) + '01' : null; }
  if (!ayBas) throw new AppError(400, 'Dosyanın ait olduğu ay bulunamadı (Üretim Raporu N2 hücresi boş).');
  pkg.ay = ayBas.slice(0, 7);
  pkg.ayBas = ayBas.slice(0, 8) + '01';
  const d0 = new Date(pkg.ayBas + 'T00:00:00Z'); d0.setUTCDate(0);
  pkg.oncekiGun = d0.toISOString().slice(0, 10);

  // ---- Ürünler
  const hk = wb.tableRows('Hat_Kapasitesi') || [];
  const urunAd = [];
  for (const r of hk) { const a = clean(r['Ürün Adı']); if (a && !urunAd.includes(a)) urunAd.push(a); }
  const t54 = new Map((wb.tableRows('Tablo54') || []).map((r) => [clean(r['Ürün Adı']), r]));
  const sv = wb.sheets.get('Sevkiyat');
  const svHead = new Map(); // ürün adı -> {kpp, kgPal}
  if (sv) {
    const h = sv.rows[1] || []; const k = sv.rows[2] || []; const kg = sv.rows[3] || [];
    h.forEach((c, i) => { const a = c ? clean(c.v) : ''; if (a && i >= 2) svHead.set(a, { kpp: k[i] ? num(k[i].v) : 0, kgPal: kg[i] ? num(kg[i].v) : 0 }); });
  }
  urunAd.forEach((a, i) => {
    const t = t54.get(a) || {}; const sh = svHead.get(a) || {}; const ih = svHead.get(a + ' İhracat') || {};
    pkg.urunler.push({ ad: a, kgKoli: round(num(t['Koli/Kg'])) || undefined, sevkKoliPalet: sh.kpp || num(t['Koli/Palet']) || undefined, kgPalet: sh.kgPal || undefined, ihrKoliPalet: ih.kpp || undefined, sira: i + 1 });
  });
  const urunVar = (a) => pkg.urunler.some((u) => trKey(u.ad) === trKey(a));

  // ---- Hatlar ve kapasiteler
  for (const r of hk) { const a = clean(r['Hat Adı']); if (a && !pkg.hatlar.includes(a)) pkg.hatlar.push(a); }
  for (const r of hk) {
    const h = clean(r['Hatlar']); const u = clean(r['Ürünler']); const k = num(r['Kapasitesi']);
    if (h && u && k) { if (!pkg.hatlar.includes(h)) pkg.hatlar.push(h); pkg.kapasiteler.push({ hat: h, urun: u, kapasite: k }); }
  }
  for (const r of wb.tableRows('Koli_Adetleri') || []) { const u = clean(r['Ürün Adı']); const a = clean(r['Koli Tipi']); if (u && a && num(r['Adeti'])) pkg.koliTipleri.push({ urun: u, ad: a, adet: num(r['Adeti']), carpan: num(r['Çarpan']) || 1 }); }
  for (const r of wb.tableRows('Palet_Tipi') || []) { const u = clean(r['Ürün Adı']); const p = PAL_KEY[clean(r['Palet Tipi'])]; if (u && p && num(r['Koli/Palet'])) pkg.paletTipleri.push({ urun: u, palet: p, koliPalet: num(r['Koli/Palet']) }); }
  for (const r of wb.tableRows('Preform_Tipi') || []) { const u = clean(r['Ürün Adı']); const f = clean(r['Firma Adı']); if (u && f) pkg.preformFirmalari.push({ urun: u, firma: f, agirlik: clean(r['Ağırlığı']) }); }
  for (const r of wb.tableRows('Vardiya_Sayısı') || []) { const a = clean(r['Vardiyalar']); if (a) pkg.vardiyalar.push({ ad: a, sure: 480 }); }
  const kisi = new Map();
  const addKisi = (a) => { const t = titleTr(a); if (t && !kisi.has(trKey(t))) kisi.set(trKey(t), t); return t; };
  for (const r of wb.tableRows('Hat_Sorumlusu') || []) addKisi(r['Hat Sorumlusu']);

  // ---- Hammaddeler
  const grupSira = [];
  const t14 = wb.tableRows('Tablo14');
  const matByKey = new Map();
  for (const r of t14) {
    const g = clean(r['Cinsi']); const ad = fixName(r['Hammadde Adı']);
    if (g && !grupSira.includes(g)) grupSira.push(g);
    if (!g || !ad) continue;
    if (matByKey.has(trKey(ad))) { uyarilar.push(`Hammadde listesinde "${ad}" iki kez geçiyor; ikincisi atlandı.`); continue; }
    const m = { grupX: g, ad, gramaj: clean(r['Gramaj']), asgari: num(r['Asgari Stok']) || undefined, oncelikAd: clean(r['Öncelik']), devreden: num(r['Devreden']), sira: matByKey.size + 1 };
    matByKey.set(trKey(ad), m); pkg.hammaddeler.push(m);
    pkg.excel[ad] = { devreden: num(r['Devreden']), kullanilan: num(r['Kullanılan']), fire: num(r['Fire']), alim: num(r['Satın Alınan']), iade: num(r['İade Edilen']), iskarta: num(r['Iskarta']), cep: num(r['Cep']), kalan: num(r['Kalan']), kullanilabilen: num(r['Kullanılabilen']) };
  }
  const ensureMat = (rawAd, grupX, neden) => {
    const ad = fixName(rawAd); if (!ad) return null;
    if (matByKey.has(trKey(ad))) return matByKey.get(trKey(ad)).ad;
    const g = grupX && GRUP_KOD[clean(grupX)] ? clean(grupX) : null;
    if (!g) { uyarilar.push(`"${ad}" hammadde listesinde yok ve grubu bilinmiyor (${neden}); atlandı.`); return null; }
    if (!grupSira.includes(g)) grupSira.push(g);
    const m = { grupX: g, ad, devreden: 0, sira: matByKey.size + 1, yeni: true };
    matByKey.set(trKey(ad), m); pkg.hammaddeler.push(m);
    uyarilar.push(`"${ad}" hammadde listesinde yoktu; ${neden} nedeniyle "${GRUP_AD[g] || g}" grubuna eklendi.`);
    return ad;
  };

  // ---- Reçeteler (formüllerden)
  const rec = wb.tableRows('Reçete', { formulas: true });
  const recSh = 'Reçete';
  const cellVal = (addr) => { const c = wb.cell(recSh, addr.replace(/\$/g, '')); return c ? c.v : null; };
  const kppOf = (urun, palet) => { const p = pkg.paletTipleri.find((x) => trKey(x.urun) === trKey(urun) && x.palet === palet); return p ? p.koliPalet : 0; };
  let sira = 0;
  const birimSay = new Map();
  for (const r of rec) {
    const urun = clean(r['Ürün Adı']); const cins = clean(r['Cinsi']); const rawMat = r['Hammadde Adı'];
    if (!urun || !rawMat || cins === 'Üretilen' || trKey(rawMat) === 'üretilen koli') continue;
    if (!urunVar(urun)) continue;
    const fI = String(r['Üretimde Kullanılan#f'] || ''); const fJ = String(r['Fire#f'] || '');
    const miktar = num(r['Reçete']); const birim = clean(r['Birimi']) || 'Ad./Koli';
    const sut1 = r['Sütun1'];
    if (!fI && !miktar) continue;
    const ad = ensureMat(rawMat, cins, 'reçetede kullanıldığı');
    if (!ad) continue;
    if (!birimSay.has(ad)) birimSay.set(ad, birim);
    const base = { urun, hammadde: ad, birim, excelSatir: r._row };
    const ek = () => ({ aktif, not });
    const lines = [];
    // Seçim türü
    let secim = 'hepsi'; let secimHat; let aktif = true; let not;
    const m1 = /Üretim_Raporu\[(Preform Tipi|Kapak Tipi|Etiket Adı|Hat Adı)\],Reçete\[\[#This Row\],\[(Hammadde Adı|Sütun1)\]\]/.exec(fI);
    if (m1) {
      secim = { 'Preform Tipi': 'preform', 'Kapak Tipi': 'kapak', 'Etiket Adı': 'etiket', 'Hat Adı': 'hat' }[m1[1]];
      if (secim === 'hat') secimHat = clean(sut1);
      // Excel'deki kopyalama hatalarını düzelt: etiket satırında "Kapak Tipi" filtresi vb.
      const beklenen = { Preform: 'preform', Kapak: 'kapak', Etiket: 'etiket' }[cins];
      if (secim !== 'hat' && beklenen && beklenen !== secim) { pkg.duzeltilen.push({ urun, ad, excelSatir: r._row, eski: m1[1], yeni: beklenen }); secim = beklenen; }
      else if (secim !== 'hat' && !beklenen) {
        // Excel'de bu satır hiçbir üretimle eşleşmediği için hep 0 hesaplanıyor; aynı sonucu korumak için pasif aktarılır
        pkg.pasif.push({ urun, ad, excelSatir: r._row }); secim = 'hepsi'; aktif = false; not = 'Excel\'de hesaba katılmıyordu (kapak sütununa bağlıydı)';
      }
    }
    // Fire
    const fireKaynak = []; let fireCarpan = 1;
    if (fJ && !/^\s*$/.test(fJ)) {
      for (const [col, key] of Object.entries(FIRE_COL)) if (fJ.includes(`Üretim_Raporu[${col}]`)) fireKaynak.push(key);
      if (/\/\s*1000\b/.test(fJ)) fireCarpan = 0.001;
      else if (/\*Reçete\[\[#This Row\],\[Reçete\]\]\/Reçete\[\[#This Row\],\[Sütun1\]\]/.test(fJ)) fireCarpan = num(sut1) ? miktar / num(sut1) : miktar;
      else if (/\*Reçete\[\[#This Row\],\[Reçete\]\]/.test(fJ)) fireCarpan = miktar;
      // Fire hesabı "Üretilen" satırına bağlanmışsa (Excel hatası) yok say
    }
    // Taban
    if (/Üretim_Raporu\[(Euro A\. Palet|İhracat Paleti|Standart A\. Palet)\]/.test(fI) && !/Toplam Üretilen/.test(fI)) {
      // Palet sayısı tabanlı satırlar (palet, karton)
      const pal = [];
      if (fI.includes('Üretim_Raporu[Standart A. Palet]')) pal.push('std');
      if (fI.includes('Üretim_Raporu[İhracat Paleti]')) pal.push('ihr');
      if (fI.includes('Üretim_Raporu[Euro A. Palet]')) pal.push('euro');
      // Hangi palet tipinin koli/palet değeri kullanılıyor?
      let refPal = null;
      const mRef = /Palet_Tipi\[Palet Tipi\],'?Reçete'?!\$?([A-Z]+)\$?(\d+)/.exec(fI);
      if (mRef) refPal = PAL_KEY[clean(cellVal(mRef[1] + mRef[2]))] || null;
      else if (/Palet_Tipi\[Palet Tipi\],Reçete\[\[#This Row\],\[Hammadde Adı\]\]/.test(fI)) refPal = PAL_KEY[clean(rawMat)] || null;
      const kpp = refPal ? kppOf(urun, refPal) : 0;
      const perPalet = miktar * (kpp || 1);
      lines.push({ ...base, ...ek(), baz: 'palet', paletler: pal, miktar: perPalet, birim: 'Ad./Palet', secim, secimHat, fireKaynak, fireCarpan });
      if (/Paletsiz Ürün/.test(fI)) lines.push({ ...base, ...ek(), baz: 'paletsiz', miktar, secim, secimHat });
    } else {
      // Koli tabanlı. "=I193*Reçete" gibi başka satıra bağlı formüller de koli tabanlıdır; "=I225/12" -> miktar 1/12
      let mk = miktar;
      const mDiv = /^I\d+\/(\d+(?:\.\d+)?)$/.exec(fI.replace(/\s/g, ''));
      if (mDiv) mk = 1 / Number(mDiv[1]);
      lines.push({ ...base, ...ek(), baz: 'koli', miktar: mk, secim, secimHat, fireKaynak, fireCarpan });
    }
    for (const l of lines) { l.sira = ++sira; if (!l.fireKaynak || !l.fireKaynak.length) { delete l.fireKaynak; delete l.fireCarpan; } pkg.receteler.push(l); }
  }
  // Hammadde birimleri
  for (const m of pkg.hammaddeler) {
    const rb = birimSay.get(m.ad);
    m.birim = rb === 'Kg/Koli' ? 'kg' : (GRUP_BIRIM[m.grupX] || (rb === 'Ad./Koli' ? 'adet' : 'kg'));
  }
  // Öncelik ürün adı kontrolü
  for (const m of pkg.hammaddeler) if (m.oncelikAd && !urunVar(m.oncelikAd)) { uyarilar.push(`"${m.ad}" için öncelikli ürün "${m.oncelikAd}" bulunamadı.`); m.oncelikAd = ''; }
  pkg.gruplar = grupSira.map((g, i) => ({ x: g, ad: GRUP_AD[g] || g.replace(/_/g, ' '), kod: GRUP_KOD[g] || g.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), birim: GRUP_BIRIM[g] || 'kg', sira: i + 1 }));

  // ---- Üretim kayıtları
  const matAd = (v) => { const a = fixName(v); return a && matByKey.has(trKey(a)) ? matByKey.get(trKey(a)).ad : null; };
  let kayik = 0;
  for (const r of ur) {
    const urun = clean(r['Ürün Adı']); if (!urun) continue;
    const tarih = serialToDate(r['Üretim Tarihi']);
    if (!tarih) { uyarilar.push(`Üretim Raporu satır ${r._row}: tarih yok, atlandı.`); continue; }
    const prf = matAd(r['Preform Tipi']); const kpk = matAd(r['Kapak Tipi']); const etk = matAd(r['Etiket Adı']);
    const grpOf = (a) => (a ? matByKey.get(trKey(a)).grupX : null);
    const bad = (prf && grpOf(prf) !== 'Preform') || (kpk && grpOf(kpk) !== 'Kapak') || (etk && grpOf(etk) !== 'Etiket');
    if (bad) kayik++;
    const sor = clean(r['Hat Sorumlusu']);
    pkg.uretim.push({
      tarih, vardiya: clean(r['Vardiya']), vardiyaSure: num(r['Vardiya Süresi (dk)']) || undefined, urun, hat: clean(r['Hat Adı']),
      preform: prf, kapak: kpk, etiket: etk, preformFirma: clean(r['Preform Firması']), preformAgirlik: clean(r['Preform Ağırlığı']),
      sorumlu: sor ? addKisi(sor) : '', koliTipi: clean(r['Koli Tipi']),
      giren: num(r['Giren Adet']) || undefined, cikan: num(r['Çıkan Şişe']) || undefined,
      fPrf: num(r['Preform/ Alt Folyo Fire']) || undefined, fPet: num(r['Pet/Şişe/Bardak Fire']) || undefined, fKapak: num(r['Kapak Fire']) || undefined,
      fEtiket: num(r['Etiket Fire']) || undefined, fKulp: num(r['Kulp Fire']) || undefined, fShrink: num(r['Shrink/ E. Bandı/ Koli Fire']) || undefined,
      sure: num(r['Üretim Süresi (dk)']) || undefined, net: num(r['Net Üretim Adeti']) || undefined,
      pStd: num(r['Standart A. Palet']) || undefined, pIhr: num(r['İhracat Paleti']) || undefined, pEuro: num(r['Euro A. Palet']) || undefined, paletsiz: num(r['Paletsiz Ürün  (Koli)']) || undefined,
      _excelKoli: num(r['Toplam Üretilen (Koli)']), _row: r._row,
      _ham: { preform: clean(r['Preform Tipi']), kapak: clean(r['Kapak Tipi']), etiket: clean(r['Etiket Adı']) },
    });
  }
  if (kayik) uyarilar.push(`Üretim Raporu'nda ${kayik} satırda Preform / Kapak / Etiket sütunları kaymış görünüyor (örneğin preform sütununda kapak adı yazıyor). Bu satırlarda preform/kapak/etiket tüketimi Excel'deki gibi hesaplanmaz; Üretim kayıtlarından düzeltebilirsiniz.`);
  pkg.personel = [...kisi.values()];

  // ---- Satınalma / İade / Iskarta / Cep
  for (const r of wb.tableRows('Satınalma') || []) {
    const ad = clean(r['H. Adı']); const q = num(r['Miktarı']); if (!ad || !q) continue;
    const m = ensureMat(ad, r['H. Cinsi'], 'satınalmada geçtiği'); if (!m) continue;
    const tarih = serialToDate(r['İrs. Tarihi']) || pkg.ayBas;
    pkg.satinalma.push({ tarih, irsNo: clean(r['İrs. No']), hammadde: m, miktar: q, firma: clean(r['Firma Adı']), ozellik: clean(r['Özelliği']),
      fiyat: num(r['B. Fiyat']) || undefined, doviz: ['TL', 'Euro', 'Dolar'].includes(clean(r['Döviz'])) ? clean(r['Döviz']) : undefined, kur: num(r['D. Kuru']) || undefined, carpan: num(r['Çarpan']) || undefined, aciklama: clean(r['Açıklama']), _row: r._row });
  }
  for (const r of wb.tableRows('İade') || []) {
    const ad = clean(r['H. Adı']); const q = num(r['İade Miktarı']); if (!ad || !q) continue;
    const m = ensureMat(ad, r['H. Cinsi'], 'iadede geçtiği'); if (!m) continue;
    pkg.iade.push({ tarih: serialToDate(r['İrs. Tarihi']) || pkg.ayBas, irsNo: clean(r['İrs. No']), hammadde: m, miktar: q, firma: clean(r['Firma Adı']), ozellik: clean(r['Özelliği']), neden: clean(r['İade Nedeni']), aciklama: clean(r['Açıklama']) });
  }
  for (const r of wb.tableRows('Iskarta') || []) {
    const ad = clean(r['H. Adı']); const q = num(r['Ayrılan Miktarı']); if (!ad || !q) continue;
    const m = ensureMat(ad, r['H. Cinsi'], 'ıskartada geçtiği'); if (!m) continue;
    pkg.iskarta.push({ tarih: pkg.ayBas, hammadde: m, miktar: q, durum: 'bekliyor', firma: clean(r['Firma Adı']), ozellik: clean(r['Özelliği']), neden: clean(r['Kullanılamama Nedeni']), aciklama: clean(r['Açıklama']) });
  }
  for (const r of wb.tableRows('Iskarta57') || []) {
    const ad = clean(r['H. Adı']); const q = num(r['Cebe Verilen Miktar']); if (!ad || !q) continue;
    const m = ensureMat(ad, r['H. Cinsi'], 'cep kayıtlarında geçtiği'); if (!m) continue;
    pkg.cep.push({ tarih: serialToDate(r['Tarih']) || pkg.ayBas, hammadde: m, miktar: Math.abs(q), yon: q < 0 ? 'anaya' : 'cebe', firma: clean(r['Firma Adı']), ozellik: clean(r['Özelliği']), uretimTarihi: serialToDate(r['Ham. Ürt. Tar.']) || undefined, aciklama: clean(r['Açıklama']) });
  }
  // ---- Sevkiyat (günlük, ürün sütunları)
  const svt = wb.tables.get('Sevkiyat');
  if (svt) {
    for (const r of wb.tableRows('Sevkiyat') || []) {
      const tarih = serialToDate(r['Tarih']); if (!tarih) continue;
      const miktar = {}; const ihracat = {};
      for (const c of svt.cols) {
        const q = num(r[c]); if (!q) continue;
        const a = clean(c);
        if (urunVar(a)) miktar[a] = (miktar[a] || 0) + q;
        else if (/ İhracat$/.test(a) && urunVar(a.replace(/ İhracat$/, ''))) { const b = a.replace(/ İhracat$/, ''); ihracat[b] = (ihracat[b] || 0) + q; }
      }
      if (Object.keys(miktar).length || Object.keys(ihracat).length) pkg.sevkiyat.push({ tarih, miktar, ihracat });
    }
  }
  // Ay dışında tarihli kayıtlar: Excel bunları tarihine bakmadan bu aya katıyor. Aynı sonucu vermek için ayın ilk gününe alınır.
  const son = nextMonth(pkg.ayBas); const tr = (t) => t.split('-').reverse().join('.');
  const disari = {};
  for (const [coll, ad] of [['satinalma', 'Satınalma'], ['iade', 'İade'], ['cep', 'Cep'], ['uretim', 'Üretim Raporu'], ['sevkiyat', 'Sevkiyat']]) {
    for (const r of pkg[coll]) {
      if (r.tarih >= pkg.ayBas && r.tarih < son) continue;
      disari[ad] = (disari[ad] || 0) + 1;
      r.aciklama = [r.aciklama, `Excel'deki tarih: ${tr(r.tarih)}`].filter(Boolean).join(' · ');
      r.tarih = pkg.ayBas;
    }
  }
  for (const [ad, k] of Object.entries(disari)) uyarilar.push(`${ad} sayfasında ${k} kayıt ${pkg.ay} ayı dışında tarihli (muhtemelen yazım hatası). Excel bunları bu aya kattığı için ayın 1'ine alındı; asıl tarih açıklamaya yazıldı.`);
  pkg.ozet = {
    ay: pkg.ay, hammadde: pkg.hammaddeler.length, yeniHammadde: pkg.hammaddeler.filter((m) => m.yeni).length, urun: pkg.urunler.length, recete: pkg.receteler.length,
    uretim: pkg.uretim.length, satinalma: pkg.satinalma.length, iade: pkg.iade.length, iskarta: pkg.iskarta.length, cep: pkg.cep.length, sevkiyat: pkg.sevkiyat.length,
    devreden: pkg.hammaddeler.filter((m) => m.devreden).length,
  };
  return pkg;
}

// ---------------- 2) UYGULA ----------------
// opts: { tanimlar: bool (mevcut tanımları güncelle), kayitlar: bool, devir: bool, ayiTemizle: bool }
function apply(store, pkg, user, opts = {}) {
  const batch = crypto.randomUUID();
  const label = `Excel içe aktarma (${pkg.ay})`;
  const o = { batch, label, system: true };
  const res = { olusan: 0, guncellenen: 0, silinen: 0 };
  const C = (coll, data) => { const r = store.create(coll, data, user, o); res.olusan++; return r.doc; };
  const U = (coll, id, data) => { const r = store.update(coll, id, data, user, o); if (r.change) res.guncellenen++; return r.doc; };
  const find = (coll, key, val) => store.all(coll).find((d) => trKey(d[key]) === trKey(val));
  const ilk = !store.all('urun').length && !store.all('hammadde').length;
  const tanim = ilk || !!opts.tanimlar;
  store.tx(() => {
    // Gruplar
    const grupId = {};
    for (const g of pkg.gruplar) {
      let d = find('grup', 'ad', g.ad) || store.all('grup').find((x) => x.kod === g.kod);
      if (!d) d = C('grup', { ad: g.ad, kod: g.kod, birim: g.birim, sira: g.sira });
      else if (tanim) d = U('grup', d.id, { sira: g.sira });
      grupId[g.x] = d.id;
    }
    // Ürünler
    const urunId = {};
    for (const u of pkg.urunler) {
      let d = find('urun', 'ad', u.ad);
      const data = { ad: u.ad, kgKoli: u.kgKoli, sevkKoliPalet: u.sevkKoliPalet, kgPalet: u.kgPalet, ihrKoliPalet: u.ihrKoliPalet, sira: u.sira };
      if (!d) d = C('urun', data); else if (tanim) d = U('urun', d.id, data);
      urunId[trKey(u.ad)] = d.id;
    }
    const uid = (a) => urunId[trKey(a)] || (find('urun', 'ad', a) || {}).id;
    // Hammaddeler
    const matId = {};
    for (const m of pkg.hammaddeler) {
      let d = find('hammadde', 'ad', m.ad);
      const data = { ad: m.ad, grup: grupId[m.grupX], birim: m.birim, gramaj: m.gramaj || undefined, asgari: m.asgari, oncelik: m.oncelikAd ? uid(m.oncelikAd) : undefined, sira: m.sira };
      if (!d) d = C('hammadde', data);
      else if (tanim) { const up = { ...data }; delete up.ad; delete up.grup; d = U('hammadde', d.id, up); }
      matId[trKey(m.ad)] = d.id;
    }
    const mid = (a) => (a ? matId[trKey(a)] || (find('hammadde', 'ad', a) || {}).id : undefined);
    // Basit tanım listeleri
    const hatId = {};
    pkg.hatlar.forEach((h, i) => { let d = find('hat', 'ad', h); if (!d) d = C('hat', { ad: h, sira: i + 1 }); hatId[trKey(h)] = d.id; });
    const vardId = {};
    pkg.vardiyalar.forEach((v, i) => { let d = find('vardiya', 'ad', v.ad); if (!d) d = C('vardiya', { ad: v.ad, sure: v.sure, sira: i + 1 }); vardId[trKey(v.ad)] = d.id; });
    const kisiId = {};
    for (const k of pkg.personel) { let d = find('personel', 'ad', k); if (!d) d = C('personel', { ad: k, gorev: 'Hat sorumlusu' }); kisiId[trKey(k)] = d.id; }
    if (tanim || !store.all('kapasite').length) {
      for (const k of pkg.kapasiteler) {
        const h = hatId[trKey(k.hat)]; const u = uid(k.urun); if (!h || !u) continue;
        const ex = store.all('kapasite').find((x) => x.hat === h && x.urun === u);
        if (ex) U('kapasite', ex.id, { kapasite: k.kapasite }); else C('kapasite', { hat: h, urun: u, kapasite: k.kapasite });
      }
    }
    if (tanim || !store.all('koliTipi').length) {
      for (const k of pkg.koliTipleri) {
        const u = uid(k.urun); if (!u) continue;
        const ex = store.all('koliTipi').find((x) => x.urun === u && trKey(x.ad) === trKey(k.ad));
        if (ex) U('koliTipi', ex.id, { adet: k.adet, carpan: k.carpan }); else C('koliTipi', { urun: u, ad: k.ad, adet: k.adet, carpan: k.carpan });
      }
    }
    if (tanim || !store.all('paletTipi').length) {
      for (const k of pkg.paletTipleri) {
        const u = uid(k.urun); if (!u) continue;
        const ex = store.all('paletTipi').find((x) => x.urun === u && x.palet === k.palet);
        if (ex) U('paletTipi', ex.id, { koliPalet: k.koliPalet }); else C('paletTipi', { urun: u, palet: k.palet, koliPalet: k.koliPalet });
      }
    }
    if (tanim || !store.all('preformFirma').length) {
      for (const k of pkg.preformFirmalari) {
        const u = uid(k.urun); if (!u) continue;
        const ex = store.all('preformFirma').find((x) => x.urun === u && trKey(x.firma) === trKey(k.firma));
        if (ex) U('preformFirma', ex.id, { agirlik: k.agirlik }); else C('preformFirma', { urun: u, firma: k.firma, agirlik: k.agirlik });
      }
    }
    // Reçeteler: dosyadaki ürünlerin reçetesi baştan yazılır
    if (tanim || !store.all('recete').length) {
      const urunSet = new Set(pkg.receteler.map((r) => uid(r.urun)));
      for (const r of store.all('recete')) if (urunSet.has(r.urun)) { store.remove('recete', r.id, user, o); res.silinen++; }
      for (const r of pkg.receteler) {
        const u = uid(r.urun); const h = mid(r.hammadde); if (!u || !h) continue;
        C('recete', { urun: u, hammadde: h, miktar: r.miktar, birim: r.birim, baz: r.baz, paletler: r.paletler, secim: r.secim, secimHat: r.secimHat ? hatId[trKey(r.secimHat)] : undefined, fireKaynak: r.fireKaynak, fireCarpan: r.fireCarpan, aktif: r.aktif, not: r.not, sira: r.sira });
      }
    }
    if (opts.kayitlar === false) return;
    // Bu ayın mevcut kayıtlarını temizle
    if (opts.ayiTemizle) {
      const bas = pkg.ayBas; const son = nextMonth(pkg.ayBas);
      for (const coll of ['uretim', 'satinalma', 'iade', 'iskarta', 'cep', 'sevkiyat']) {
        for (const d of store.all(coll)) if (d.tarih >= bas && d.tarih < son) { store.remove(coll, d.id, user, o); res.silinen++; }
      }
      for (const d of store.all('sayim')) if (d.tarih === pkg.oncekiGun && /Excel devreden/.test(d.aciklama || '')) { store.remove('sayim', d.id, user, o); res.silinen++; }
    }
    // Devreden -> önceki ayın son günü ana depo sayımı (cep depo sıfırlanır)
    if (opts.devir !== false) {
      for (const m of pkg.hammaddeler) {
        const id = mid(m.ad); if (!id) continue;
        C('sayim', { tarih: pkg.oncekiGun, hammadde: id, depo: 'ana', sayilan: Math.max(0, m.devreden || 0), aciklama: `Excel devreden (${pkg.ay})` });
        C('sayim', { tarih: pkg.oncekiGun, hammadde: id, depo: 'cep', sayilan: 0, aciklama: `Excel devreden (${pkg.ay})` });
        if ((m.devreden || 0) < 0) pkg.uyarilar.push(`"${m.ad}" devreden miktarı eksi (${m.devreden}); sıfır olarak alındı.`);
      }
    }
    const koliTipiId = (u, ad) => { if (!ad) return undefined; const d = store.all('koliTipi').find((x) => x.urun === u && trKey(x.ad) === trKey(ad)); return d ? d.id : undefined; };
    for (const r of pkg.uretim) {
      const u = uid(r.urun); if (!u) continue;
      let v = vardId[trKey(r.vardiya)]; if (!v && r.vardiya) { v = C('vardiya', { ad: r.vardiya, sure: 480 }).id; vardId[trKey(r.vardiya)] = v; }
      let h = r.hat ? hatId[trKey(r.hat)] : undefined; if (!h && r.hat) { h = C('hat', { ad: r.hat }).id; hatId[trKey(r.hat)] = h; }
      const data = { ...r, urun: u, vardiya: v, hat: h, preform: mid(r.preform), kapak: mid(r.kapak), etiket: mid(r.etiket), sorumlu: r.sorumlu ? kisiId[trKey(r.sorumlu)] : undefined, koliTipi: koliTipiId(u, r.koliTipi) };
      for (const k of Object.keys(data)) if (k.startsWith('_')) delete data[k];
      if (!data.preform && r._ham.preform && !/alt folyo/i.test(r._ham.preform)) data.aciklama = [data.aciklama, `Excel preform: ${r._ham.preform}`].filter(Boolean).join(' · ');
      C('uretim', data);
    }
    for (const r of pkg.satinalma) { const d = { ...r, hammadde: mid(r.hammadde) }; delete d._row; if (d.hammadde) C('satinalma', d); }
    for (const r of pkg.iade) { const d = { ...r, hammadde: mid(r.hammadde) }; if (d.hammadde) C('iade', d); }
    for (const r of pkg.iskarta) { const d = { ...r, hammadde: mid(r.hammadde) }; if (d.hammadde) C('iskarta', d); }
    for (const r of pkg.cep) { const d = { ...r, hammadde: mid(r.hammadde) }; if (d.hammadde) C('cep', d); }
    for (const r of pkg.sevkiyat) {
      const map = (o2) => { const x = {}; for (const [a, q] of Object.entries(o2)) { const u = uid(a); if (u) x[u] = q; } return x; };
      C('sevkiyat', { tarih: r.tarih, miktar: map(r.miktar), ihracat: map(r.ihracat) });
    }
  });
  return { ...res, batch };
}
function nextMonth(ayBas) { const d = new Date(ayBas + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); }

module.exports = { parse, apply, GRUP_KOD, nextMonth };
