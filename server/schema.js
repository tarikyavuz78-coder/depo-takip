'use strict';
// Depo Takip 2 — kayıt türleri ve alanları
// Tür kodları: text, num, int, date, sel (sabit liste), ref (başka listeden seçim), mat (hammadde seçimi),
//              multi (çoklu seçim), bool, note (uzun metin), map (ürün bazında miktar tablosu)

const PALETLER = [['std', 'Standart A. Palet'], ['ihr', 'İhracat Paleti'], ['euro', 'Euro A. Palet']];
const FIRE_KAYNAK = [
  ['fPrf', 'Preform / Alt folyo firesi'], ['fPet', 'Pet / Şişe / Bardak firesi'], ['fKapak', 'Kapak firesi'],
  ['fEtiket', 'Etiket / Üst folyo firesi'], ['fKulp', 'Kulp firesi'], ['fShrink', 'Shrink / E. bandı / Koli firesi'],
];

const C = {};

// ---------------- TANIMLAR ----------------
C.grup = {
  label: 'Gruplar', one: 'Grup', kind: 'def', icon: 'tag', sort: ['sira', 'ad'],
  fields: [
    { k: 'ad', l: 'Grup adı', t: 'text', req: 1, list: 1, uniq: 1 },
    { k: 'kod', l: 'Kod (KYN kodlarında kullanılır)', t: 'text', req: 1, list: 1, uniq: 1, max: 4, upper: 1, help: '2-4 harf. Verilmiş kodları korumak için sonradan değiştirmeyin.' },
    { k: 'birim', l: 'Varsayılan birim', t: 'text', list: 1, def: 'adet', sug: 'birimler' },
    { k: 'sira', l: 'Sıra', t: 'int', list: 0 },
  ],
};
C.hammadde = {
  label: 'Hammaddeler', one: 'Hammadde', kind: 'def', icon: 'box', sort: ['grupSira', 'sira'],
  fields: [
    { k: 'kod', l: 'KYN kodu', t: 'text', list: 1, ro: 1, help: 'Otomatik verilir, QR kodda bu yazar.' },
    { k: 'grup', l: 'Grup', t: 'ref', ref: 'grup', req: 1, list: 1 },
    { k: 'ad', l: 'Hammadde adı', t: 'text', req: 1, list: 1, uniq: 1 },
    { k: 'birim', l: 'Birim', t: 'text', req: 1, list: 1, sug: 'birimler', help: 'Reçetedeki miktarla aynı birim olmalı (adet, kg, L…)' },
    { k: 'gramaj', l: 'Gramaj / Özellik', t: 'text', list: 1 },
    { k: 'asgari', l: 'Asgari stok', t: 'num', list: 1, help: 'Kullanılabilir stok bunun altına inince uyarı verilir.' },
    { k: 'oncelik', l: 'Öncelikli ürün (yaklaşık koli hesabı)', t: 'ref', ref: 'urun', help: 'Boşsa tüm reçetelerdeki miktarların toplamı kullanılır (Excel\'deki gibi).' },
    { k: 'tedarikci', l: 'Tedarikçi', t: 'text', sug: 'firmalar' },
    { k: 'not', l: 'Not', t: 'note' },
    { k: 'aktif', l: 'Aktif', t: 'bool', def: true },
    { k: 'sira', l: 'Sıra', t: 'int' },
    { k: 'eskiKod', l: 'Eski kodlar', t: 'text', hidden: 1 },
  ],
};
C.urun = {
  label: 'Ürünler', one: 'Ürün', kind: 'def', icon: 'bottle', sort: ['sira', 'ad'],
  fields: [
    { k: 'kod', l: 'Mamul kodu', t: 'text', list: 1, ro: 1, help: 'Otomatik verilir (MML-001 gibi), ürün QR etiketinde bu yazar.' },
    { k: 'ad', l: 'Ürün adı', t: 'text', req: 1, list: 1, uniq: 1 },
    { k: 'asgari', l: 'Asgari mamul stoğu (koli)', t: 'num', help: 'Mamul stoğu bunun altına inince panelde uyarı verilir.' },
    { k: 'kgKoli', l: 'Kg / koli', t: 'num', list: 1 },
    { k: 'sevkKoliPalet', l: 'Sevkiyatta koli / palet', t: 'num', list: 1 },
    { k: 'kgPalet', l: 'Kg / palet', t: 'num', list: 1 },
    { k: 'ihrKoliPalet', l: 'İhracat sevkiyatında koli / palet', t: 'num' },
    { k: 'aktif', l: 'Aktif', t: 'bool', def: true },
    { k: 'sira', l: 'Sıra', t: 'int' },
  ],
};
C.recete = {
  label: 'Reçeteler', one: 'Reçete satırı', kind: 'def', icon: 'list', sort: ['urunSira', 'sira'],
  fields: [
    { k: 'urun', l: 'Ürün', t: 'ref', ref: 'urun', req: 1, list: 1 },
    { k: 'hammadde', l: 'Hammadde', t: 'mat', req: 1, list: 1 },
    { k: 'miktar', l: 'Miktar', t: 'num', req: 1, list: 1, help: 'Hesap tabanının 1 birimi için (genellikle 1 koli için) kullanılan miktar.' },
    { k: 'birim', l: 'Birim', t: 'sel', opts: ['Ad./Koli', 'Kg/Koli', 'L/Koli', 'Ad./Palet'], def: 'Ad./Koli', list: 1 },
    { k: 'baz', l: 'Hesap tabanı', t: 'sel', opts: [['koli', 'Üretilen toplam koli'], ['paletsiz', 'Paletsiz koli'], ['palet', 'Palet sayısı']], def: 'koli', list: 1 },
    { k: 'paletler', l: 'Palet türleri (taban "Palet sayısı" ise)', t: 'multi', opts: PALETLER },
    { k: 'secim', l: 'Ne zaman kullanılır?', t: 'sel', opts: [['hepsi', 'Her üretimde'], ['preform', 'Üretimde bu preform seçilirse'], ['kapak', 'Üretimde bu kapak seçilirse'], ['etiket', 'Üretimde bu etiket seçilirse'], ['hat', 'Üretim belirli hatta yapılırsa']], def: 'hepsi', list: 1 },
    { k: 'secimHat', l: 'Hat (seçim "hat" ise)', t: 'ref', ref: 'hat' },
    { k: 'fireKaynak', l: 'Fire bu üretim alanlarından gelir', t: 'multi', opts: FIRE_KAYNAK, list: 1 },
    { k: 'fireCarpan', l: 'Fire çarpanı', t: 'num', def: 1, help: '1 = adet olarak; 0,001 = gramdan kg\'a; bardakta kg/koli ÷ adet/koli' },
    { k: 'aktif', l: 'Hesaba katılır', t: 'bool', def: true, list: 1 },
    { k: 'not', l: 'Not', t: 'text' },
    { k: 'sira', l: 'Sıra', t: 'int' },
  ],
};
C.hat = {
  label: 'Hatlar', one: 'Hat', kind: 'def', icon: 'factory', sort: ['sira', 'ad'],
  fields: [
    { k: 'ad', l: 'Hat adı', t: 'text', req: 1, list: 1, uniq: 1 },
    { k: 'aktif', l: 'Aktif', t: 'bool', def: true, list: 1 },
    { k: 'sira', l: 'Sıra', t: 'int' },
  ],
};
C.kapasite = {
  label: 'Hat kapasiteleri', one: 'Kapasite', kind: 'def', icon: 'gauge', sort: ['hatSira', 'urunSira'],
  fields: [
    { k: 'hat', l: 'Hat', t: 'ref', ref: 'hat', req: 1, list: 1 },
    { k: 'urun', l: 'Ürün', t: 'ref', ref: 'urun', req: 1, list: 1 },
    { k: 'kapasite', l: 'Kapasite (adet / saat)', t: 'num', req: 1, list: 1 },
  ],
};
C.koliTipi = {
  label: 'Koli / paket tipleri', one: 'Koli tipi', kind: 'def', icon: 'package', sort: ['urunSira', 'ad'],
  fields: [
    { k: 'urun', l: 'Ürün', t: 'ref', ref: 'urun', req: 1, list: 1 },
    { k: 'ad', l: 'Koli / paket tipi', t: 'text', req: 1, list: 1, sug: 'koliAdlari' },
    { k: 'adet', l: 'Adet', t: 'num', req: 1, list: 1 },
    { k: 'carpan', l: 'Çarpan', t: 'num', def: 1, list: 1, help: 'Bir kolideki paket sayısı. Koli başına adet = adet × çarpan' },
  ],
};
C.paletTipi = {
  label: 'Palet tipleri', one: 'Palet tipi', kind: 'def', icon: 'pallet', sort: ['urunSira', 'palet'],
  fields: [
    { k: 'urun', l: 'Ürün', t: 'ref', ref: 'urun', req: 1, list: 1 },
    { k: 'palet', l: 'Palet', t: 'sel', opts: PALETLER, req: 1, list: 1 },
    { k: 'koliPalet', l: 'Koli / palet', t: 'num', req: 1, list: 1 },
  ],
};
C.preformFirma = {
  label: 'Preform firmaları', one: 'Preform firması', kind: 'def', icon: 'truck', sort: ['urunSira', 'firma'],
  fields: [
    { k: 'urun', l: 'Ürün', t: 'ref', ref: 'urun', req: 1, list: 1 },
    { k: 'firma', l: 'Firma', t: 'text', req: 1, list: 1, sug: 'firmalar' },
    { k: 'agirlik', l: 'Ağırlık', t: 'text', list: 1 },
  ],
};
C.vardiya = {
  label: 'Vardiyalar', one: 'Vardiya', kind: 'def', icon: 'clock', sort: ['sira', 'ad'],
  fields: [
    { k: 'ad', l: 'Vardiya', t: 'text', req: 1, list: 1, uniq: 1 },
    { k: 'sure', l: 'Süre (dk)', t: 'int', def: 480, list: 1 },
    { k: 'sira', l: 'Sıra', t: 'int' },
  ],
};
C.personel = {
  label: 'Personel', one: 'Kişi', kind: 'def', icon: 'user', sort: ['ad'],
  fields: [
    { k: 'ad', l: 'Ad soyad', t: 'text', req: 1, list: 1, uniq: 1 },
    { k: 'gorev', l: 'Görevi', t: 'text', def: 'Hat sorumlusu', list: 1 },
    { k: 'aktif', l: 'Aktif', t: 'bool', def: true, list: 1 },
  ],
};

// ---------------- KAYITLAR ----------------
const tarih = { k: 'tarih', l: 'Tarih', t: 'date', req: 1, list: 1, today: 1 };
const aciklama = { k: 'aciklama', l: 'Açıklama', t: 'text', list: 1 };

C.uretim = {
  label: 'Üretim Raporu', one: 'Üretim kaydı', kind: 'rec', icon: 'factory', sort: ['-tarih', 'vardiyaSira'], form: 'uretim',
  fields: [
    tarih,
    { k: 'vardiya', l: 'Vardiya', t: 'ref', ref: 'vardiya', req: 1, list: 1 },
    { k: 'vardiyaSure', l: 'Vardiya süresi (dk)', t: 'int' },
    { k: 'urun', l: 'Ürün', t: 'ref', ref: 'urun', req: 1, list: 1 },
    { k: 'hat', l: 'Hat', t: 'ref', ref: 'hat', list: 1 },
    { k: 'preform', l: 'Preform tipi', t: 'mat', pick: 'preform' },
    { k: 'kapak', l: 'Kapak tipi', t: 'mat', pick: 'kapak' },
    { k: 'etiket', l: 'Etiket', t: 'mat', pick: 'etiket' },
    { k: 'preformFirma', l: 'Preform firması', t: 'text', sug: 'preformFirma' },
    { k: 'preformAgirlik', l: 'Preform ağırlığı', t: 'text' },
    { k: 'sorumlu', l: 'Hat sorumlusu', t: 'ref', ref: 'personel', list: 0 },
    { k: 'koliTipi', l: 'Koli tipi', t: 'ref', ref: 'koliTipi' },
    { k: 'giren', l: 'Giren adet', t: 'int', list: 1, grp: 'sayac' },
    { k: 'cikan', l: 'Çıkan şişe', t: 'int', grp: 'sayac' },
    { k: 'fPrf', l: 'Preform / Alt folyo fire', t: 'num', grp: 'fire' },
    { k: 'fPet', l: 'Pet / Şişe / Bardak fire', t: 'num', grp: 'fire' },
    { k: 'fKapak', l: 'Kapak fire', t: 'num', grp: 'fire' },
    { k: 'fEtiket', l: 'Etiket fire', t: 'num', grp: 'fire' },
    { k: 'fKulp', l: 'Kulp fire', t: 'num', grp: 'fire' },
    { k: 'fShrink', l: 'Shrink (gr) / E. bandı / Koli fire', t: 'num', grp: 'fire' },
    { k: 'sure', l: 'Üretim süresi (dk)', t: 'int', grp: 'sayac' },
    { k: 'net', l: 'Net üretim adeti', t: 'int', list: 1, grp: 'sayac' },
    { k: 'pStd', l: 'Standart A. Palet', t: 'int', grp: 'palet' },
    { k: 'pIhr', l: 'İhracat Paleti', t: 'int', grp: 'palet' },
    { k: 'pEuro', l: 'Euro A. Palet', t: 'int', grp: 'palet' },
    { k: 'paletsiz', l: 'Paletsiz ürün (koli)', t: 'int', grp: 'palet' },
    aciklama,
  ],
  computed: [
    { k: 'koli', l: 'Toplam koli', t: 'num', list: 1 },
    { k: 'adetKoli', l: 'Adet / koli', t: 'num' },
    { k: 'sayacFarki', l: 'Sayaç–ürün farkı', t: 'num' },
    { k: 'vardiyaVrm', l: 'Vardiya verimi %', t: 'num', list: 1 },
    { k: 'uretimVrm', l: 'Üretim verimi %', t: 'num' },
    { k: 'fireToplam', l: 'Toplam fire', t: 'num', list: 1 },
  ],
};
C.satinalma = {
  label: 'Satınalma (Giriş)', one: 'Satınalma kaydı', kind: 'rec', icon: 'download', sort: ['-tarih', '-seq'],
  fields: [
    { k: 'tarih', l: 'İrsaliye tarihi', t: 'date', req: 1, list: 1, today: 1 },
    { k: 'irsNo', l: 'İrsaliye no', t: 'text', list: 1 },
    { k: 'hammadde', l: 'Hammadde', t: 'mat', req: 1, list: 1 },
    { k: 'miktar', l: 'Miktar', t: 'num', req: 1, list: 1, pos: 1 },
    { k: 'firma', l: 'Firma', t: 'text', list: 1, sug: 'firmalar' },
    { k: 'ozellik', l: 'Özelliği', t: 'text' },
    { k: 'lotNo', l: 'Lot / parti no', t: 'text', list: 1 },
    { k: 'uretimTarihi', l: 'Hammadde üretim tarihi', t: 'date' },
    { k: 'skt', l: 'Son kullanma tarihi', t: 'date' },
    { k: 'fiyat', l: 'Birim fiyat', t: 'num' },
    { k: 'doviz', l: 'Döviz', t: 'sel', opts: ['TL', 'Euro', 'Dolar'], def: 'TL' },
    { k: 'kur', l: 'Döviz kuru', t: 'num', def: 1 },
    { k: 'carpan', l: 'Fiyat çarpanı (bölen)', t: 'num', def: 1, help: 'Fiyat 1000 adet için ise 1000 yazın' },
    aciklama,
  ],
  computed: [{ k: 'tutar', l: 'Toplam tutar (TL)', t: 'num', list: 1 }],
};
C.cep = {
  label: "Cep Depoya Verilen", one: 'Cep kaydı', kind: 'rec', icon: 'swap', sort: ['-tarih', '-seq'],
  fields: [
    tarih,
    { k: 'hammadde', l: 'Hammadde', t: 'mat', req: 1, list: 1 },
    { k: 'miktar', l: 'Miktar', t: 'num', req: 1, list: 1, pos: 1 },
    { k: 'yon', l: 'Yön', t: 'sel', opts: [['cebe', 'Ana depodan cep depoya'], ['anaya', 'Cep depodan ana depoya (geri)']], def: 'cebe', list: 1 },
    { k: 'firma', l: 'Firma', t: 'text', list: 1, sug: 'firmalar' },
    { k: 'ozellik', l: 'Özelliği', t: 'text' },
    { k: 'lotNo', l: 'Lot / parti no', t: 'text' },
    { k: 'uretimTarihi', l: 'Hammadde üretim tarihi', t: 'date' },
    aciklama,
  ],
};
C.sevkiyat = {
  label: 'Sevkiyat', one: 'Sevkiyat', kind: 'rec', icon: 'truck', sort: ['-tarih'], form: 'sevkiyat',
  fields: [
    tarih,
    { k: 'musteri', l: 'Müşteri', t: 'text', list: 1, sug: 'musteriler' },
    { k: 'adres', l: 'Sevk adresi', t: 'text', sug: 'adresler' },
    { k: 'irsNo', l: 'İrsaliye no', t: 'text', list: 1 },
    { k: 'plaka', l: 'Araç plakası', t: 'text', sug: 'plakalar' },
    { k: 'miktar', l: 'Sevk edilen (koli)', t: 'map', ref: 'urun', list: 1 },
    { k: 'ihracat', l: 'İhracat sevkiyatı (koli)', t: 'map', ref: 'urun' },
    { k: 'arac', l: 'Araç sayısı', t: 'int', list: 1 },
    { k: 'dogrulanan', l: 'QR ile doğrulanan ürünler', t: 'idlist', ref: 'urun', hidden: 1 },
    aciklama,
  ],
  computed: [{ k: 'toplam', l: 'Toplam koli', t: 'num', list: 1 }, { k: 'palet', l: 'Palet', t: 'num', list: 1 }, { k: 'kg', l: 'Kg', t: 'num', list: 1 }],
};
C.iade = {
  label: 'Tedarikçiye İade', one: 'İade kaydı', kind: 'rec', icon: 'undo', sort: ['-tarih', '-seq'],
  fields: [
    { k: 'tarih', l: 'İrsaliye tarihi', t: 'date', req: 1, list: 1, today: 1 },
    { k: 'irsNo', l: 'İrsaliye no', t: 'text', list: 1 },
    { k: 'hammadde', l: 'Hammadde', t: 'mat', req: 1, list: 1 },
    { k: 'miktar', l: 'İade miktarı', t: 'num', req: 1, list: 1, pos: 1 },
    { k: 'firma', l: 'Firma', t: 'text', list: 1, sug: 'firmalar' },
    { k: 'ozellik', l: 'Özelliği', t: 'text' },
    { k: 'neden', l: 'İade nedeni', t: 'text', list: 1 },
    aciklama,
  ],
};
C.iskarta = {
  label: 'Iskarta', one: 'Iskarta kaydı', kind: 'rec', icon: 'alert', sort: ['-tarih', '-seq'],
  fields: [
    tarih,
    { k: 'hammadde', l: 'Hammadde', t: 'mat', req: 1, list: 1 },
    { k: 'miktar', l: 'Ayrılan miktar', t: 'num', req: 1, list: 1, pos: 1 },
    { k: 'durum', l: 'Durum', t: 'sel', opts: [['bekliyor', 'Ayrıldı (kullanılamaz)'], ['imha', 'İmha edildi (stoktan düşer)'], ['kapandi', 'Kapandı (iade edildi / kullanıma alındı)']], def: 'bekliyor', list: 1, help: '"Ayrıldı" iken kullanılabilir stoktan düşer; "İmha edildi" stoktan tamamen düşer.' },
    { k: 'firma', l: 'Firma', t: 'text', sug: 'firmalar' },
    { k: 'ozellik', l: 'Özelliği', t: 'text' },
    { k: 'neden', l: 'Kullanılamama nedeni', t: 'text', list: 1 },
    aciklama,
  ],
};
C.sayim = {
  label: 'Hammadde Sayımı', one: 'Sayım', kind: 'rec', icon: 'check', sort: ['-tarih', '-seq'],
  fields: [
    tarih,
    { k: 'hammadde', l: 'Hammadde', t: 'mat', req: 1, list: 1 },
    { k: 'depo', l: 'Depo', t: 'sel', opts: [['ana', 'Ana depo'], ['cep', 'Cep depo']], def: 'ana', list: 1 },
    { k: 'sayilan', l: 'Sayılan miktar', t: 'num', req: 1, list: 1, zero: 1 },
    aciklama,
  ],
  computed: [{ k: 'fark', l: 'Fark', t: 'num', list: 1 }],
};
C.urunSayim = {
  label: 'Ürün Sayımı', one: 'Ürün sayımı', kind: 'rec', icon: 'check', sort: ['-tarih', '-seq'],
  fields: [
    tarih,
    { k: 'urun', l: 'Ürün', t: 'ref', ref: 'urun', req: 1, list: 1 },
    { k: 'koli', l: 'Sayılan (koli)', t: 'num', req: 1, list: 1, zero: 1 },
    aciklama,
  ],
  computed: [{ k: 'fark', l: 'Fark', t: 'num', list: 1 }],
};
C.fireTartim = {
  label: 'Fire Tartımı', one: 'Fire tartımı', kind: 'rec', icon: 'scale', sort: ['-tarih', '-seq'],
  fields: [
    tarih,
    { k: 'kalem', l: 'Fire cinsi', t: 'text', req: 1, list: 1, sug: 'fireKalem' },
    { k: 'kg', l: 'Kg', t: 'num', req: 1, list: 1, pos: 1 },
    aciklama,
  ],
};
C.palet = {
  label: 'Palet Takibi', one: 'Palet kaydı', kind: 'rec', icon: 'pallet', sort: ['-tarih', '-seq'],
  fields: [
    tarih,
    { k: 'kisi', l: 'Kişi / firma', t: 'text', list: 1, sug: 'paletKisi' },
    { k: 'standart', l: 'Standart', t: 'int', list: 1 },
    { k: 'epal', l: 'EPAL', t: 'int', list: 1 },
    { k: 'iade', l: 'İade', t: 'int', list: 1 },
    aciklama,
  ],
  computed: [{ k: 'toplam', l: 'Toplam', t: 'num', list: 1 }],
};

// Kullanıcının eklediği / değiştirdiği alanlar
C.alan = {
  label: 'Form alanları', one: 'Alan', kind: 'sys', icon: 'layout', sort: ['coll', 'sira'],
  fields: [
    { k: 'coll', l: 'Kayıt türü', t: 'text', req: 1 },
    { k: 'k', l: 'Alan anahtarı', t: 'text', req: 1 },
    { k: 'l', l: 'Alan adı', t: 'text', req: 1 },
    { k: 't', l: 'Türü', t: 'sel', opts: [['text', 'Metin'], ['num', 'Sayı'], ['date', 'Tarih'], ['sel', 'Seçim listesi'], ['bool', 'Evet / Hayır'], ['note', 'Uzun metin']] },
    { k: 'opts', l: 'Seçenekler', t: 'note' },
    { k: 'req', l: 'Zorunlu', t: 'bool' },
    { k: 'hidden', l: 'Gizli', t: 'bool' },
    { k: 'list', l: 'Listede göster', t: 'bool' },
    { k: 'builtin', l: 'Hazır alan', t: 'bool' },
    { k: 'sira', l: 'Sıra', t: 'int' },
  ],
};

const DEF_COLLS = Object.keys(C).filter((k) => C[k].kind === 'def');
const REC_COLLS = Object.keys(C).filter((k) => C[k].kind === 'rec');

module.exports = { C, PALETLER, FIRE_KAYNAK, DEF_COLLS, REC_COLLS };
