'use strict';
// İlk kurulumda yüklenen kategori ve hammadde listesi.
// Kodlar sırayla otomatik verilir: KYN-<KATEGORİ>-<NNN>

const categories = [
  { code: 'PRF', name: 'Preform', unit: 'adet' },
  { code: 'KPK', name: 'Kapak', unit: 'adet' },
  { code: 'KLP', name: 'Kulp / Handle', unit: 'adet' },
  { code: 'ETK', name: 'Etiket', unit: 'adet' },
  { code: 'BRD', name: 'Bardak Su Ambalajı', unit: 'kg' },
  { code: 'FLM', name: 'Shrink / Stretch Film', unit: 'kg' },
  { code: 'KOL', name: 'Koli', unit: 'adet' },
  { code: 'PLT', name: 'Palet ve Ara Malzeme', unit: 'adet' },
  { code: 'TUT', name: 'Tutkal', unit: 'kg' },
  { code: 'BNT', name: 'Bant', unit: 'rulo' },
  { code: 'CAM', name: 'Cam Şişe', unit: 'adet' },
  { code: 'GDA', name: 'Gıda Hammaddesi ve Katkı', unit: 'kg' },
  { code: 'KOD', name: 'Kodlama Sarfı', unit: 'L' },
  { code: 'KAY', name: 'Bant Kaydırıcı', unit: 'kg' },
  { code: 'TMZ', name: 'Temizlik ve Dezenfeksiyon', unit: 'kg' },
];

// [kategori, ad, birim(opsiyonel - yoksa kategori birimi)]
const products = [
  ['PRF', '0,33 L Preform'], ['PRF', '0,33 L İhracat Preform'], ['PRF', '0,5 L Preform'], ['PRF', '0,5 L İhracat Preform'],
  ['PRF', '1 L Preform'], ['PRF', '1 L İhracat Preform'], ['PRF', '1,5 L Preform'], ['PRF', '1,5 L İhracat Preform'],
  ['PRF', '5 L Preform'], ['PRF', '5 L İhracat Preform'], ['PRF', '19 L Preform'],

  ['KPK', '29 mm Kapak'], ['KPK', '29 mm Logosuz Şeffaf Kapak'], ['KPK', '29 mm Logosuz Mavi Kapak'], ['KPK', '38 mm Kapak'],
  ['KPK', '38 mm Logosuz Mavi Kapak'], ['KPK', '38 mm Logosuz Şeffaf Kapak'], ['KPK', '55 mm Kapak'], ['KPK', 'Sıvama Su Kapağı'],

  ['KLP', '38 mm Kulp'], ['KLP', '55 mm Kulp'], ['KLP', '5 L Handle'], ['KLP', 'Handle Bandı', 'rulo'],

  ['ETK', '0,33 L Karapınar Etiket'], ['ETK', '0,33 L Eskipazar Etiket'], ['ETK', '0,33 L Magic Etiket'], ['ETK', '0,33 L Fyne Etiket'],
  ['ETK', '0,5 L Karapınar Etiket'], ['ETK', '0,5 L Karapınar A3 84.000 Etiket'], ['ETK', '0,5 L Eskipazar Etiket'], ['ETK', '0,5 L Magic Etiket'],
  ['ETK', '0,5 L Magic Depozito Etiket'], ['ETK', '0,5 L Fyne Etiket'], ['ETK', '0,5 L Fontera Etiket'], ['ETK', '0,5 L UNO Etiket'],
  ['ETK', '1 L Karapınar Etiket'], ['ETK', '1 L Eskipazar Etiket'],
  ['ETK', '1,5 L Karapınar Etiket'], ['ETK', '1,5 L Karapınar A3 84.000 Etiket'], ['ETK', '1,5 L Eskipazar Etiket'], ['ETK', '1,5 L Magic Etiket'],
  ['ETK', '1,5 L Magic Depozito Etiket'], ['ETK', '1,5 L Fyne Etiket'], ['ETK', '1,5 L Fontera Etiket'],
  ['ETK', '5 L Karapınar Etiket'], ['ETK', '5 L Eskipazar Etiket'], ['ETK', '5 L Magic Etiket'],
  ['ETK', '19 L Pet Karapınar Etiket'], ['ETK', '19 L Pet Eskipazar Etiket'], ['ETK', '19 L Damacana Karapınar Etiket'], ['ETK', '19 L Damacana Eskipazar Etiket'],
  ['ETK', '330 ml Cam Etiket'], ['ETK', '750 ml Cam Etiket'],

  ['BRD', '420 mm 550 mic. Pet Levha'], ['BRD', '350 mm 600 mic. Pet Levha'],
  ['BRD', '420 mm Bardak Su 200 ml Üst Folyo'], ['BRD', '350 mm Karadut 200 ml Üst Folyo'], ['BRD', '350 mm Limonata 200 ml Üst Folyo'],
  ['BRD', '350 mm Mandalina 200 ml Üst Folyo'], ['BRD', '350 mm Mango-Ananas 200 ml Üst Folyo'],

  ['FLM', '750 mm 38 mic. Shrink'], ['FLM', '360 mm 40 mic. Shrink'], ['FLM', '1650 mm 40 mic. Shrink'], ['FLM', '390 mm 60 mic. Shrink'],
  ['FLM', 'Stretch'],

  ['KOL', "200 ml Bardak Su Kolisi 72'li"], ['KOL', "200 ml Karadut Kolisi 60'lı"], ['KOL', "200 ml Limonata Kolisi 60'lı"],
  ['KOL', "200 ml Mandalina Kolisi 60'lı"], ['KOL', "200 ml Mango-Ananas Kolisi 60'lı"],

  ['PLT', '800*1200 mm Tek Dalga'], ['PLT', '1000*1200 mm Tek Dalga'], ['PLT', '800*1240 mm Çift Dalga'], ['PLT', 'Sunta'],
  ['PLT', 'Euro A. Palet'], ['PLT', 'Standart A. Palet'], ['PLT', 'İhracat Paleti'], ['PLT', 'Viyol'],

  ['TUT', 'Krones Tutkal'], ['TUT', 'Makro Tutkal'],

  ['BNT', 'Koli Bandı'], ['BNT', 'Emniyet Bandı'],

  ['CAM', '330 ml Cam Şişe'], ['CAM', '750 ml Cam Şişe'],

  ['GDA', 'Şeker'], ['GDA', 'Tatlandırıcı - Sweet UP2'], ['GDA', 'Citric Acid Anhydrous'], ['GDA', 'Sodium Benzoate Wuhan Youji'],
  ['GDA', 'Potassium Sorbate Nantong'], ['GDA', 'VC Ascorbik Acid Powder 100 Mesh 99%'], ['GDA', 'Y. Safran Ekstraktı L4'],
  ['GDA', 'Beyaz Emülsiyon'], ['GDA', 'Limon Emülsiyonu'], ['GDA', 'Lime Limon Aroma Vericisi'], ['GDA', 'Red Shade Type Sourcherry'],
  ['GDA', 'Mulberry Flavouring'], ['GDA', 'Caramel Colour L 46'], ['GDA', 'Bcomp Em Type Tangerine'], ['GDA', 'Mandarin Flavouring'],

  ['KOD', 'İnk (V-4211 L)'], ['KOD', 'Make Up (V-7206 L)'],

  ['KAY', 'Sulu Bant Kaydırıcı'], ['KAY', 'Kuru Bant Kaydırıcı'],

  ['TMZ', 'Yıkama Solüsyonu'], ['TMZ', 'Damacana Yıkama'], ['TMZ', 'Damacana Dezenfektanı'], ['TMZ', 'Tutkal Temizleyici'],
  ['TMZ', 'Sistem'], ['TMZ', 'UF Kostik Temizleme'], ['TMZ', 'UF Asidik Temizleme'], ['TMZ', 'UF Dezenfektan'],
  ['TMZ', 'Aromalı Sistem Temizlik HCl'], ['TMZ', 'El Dezenfektanı', 'L'], ['TMZ', 'El Sabunu', 'L'], ['TMZ', 'Cip Yıkama'],
  ['TMZ', 'Makine Yıkama'], ['TMZ', 'Genel Temizlik'], ['TMZ', 'Zemin Yıkama'], ['TMZ', 'Ağır Kir Yağ Temizleyici'], ['TMZ', 'Dezenfektan'],
];

module.exports = { categories, products };
