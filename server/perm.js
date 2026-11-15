'use strict';
// Depo Takip 2.1 — rol ve yetki sistemi
// Her kullanıcının bir rolü vardır; rol varsayılan yetkileri belirler. Yönetici, kullanıcı bazında
// ekran / kayıt türü / rapor yetkilerini ayrıca değiştirebilir (users.perms sütununda saklanır).
//
// Yetki yapısı:
//   c: { <kayıt türü>: 'geds' }   g = görür, e = ekler, d = düzenler, s = siler
//   r: [<rapor anahtarı>, ...]      görebileceği raporlar (Excel çıktıları dahil)
//   gecmis: 'yok' | 'kendi' | 'hepsi'  değişiklik geçmişi
//   aktar: bool                     Excel'den kayıt yükleyebilir (yalnızca yazma yetkisi olduğu türlere)
//   panel: bool                     ana paneli görür

const ROLES = {
  admin: 'Ana yönetici',
  depo: 'Depo sorumlusu',
  uretim: 'Üretim sorumlusu',
  sevkiyat: 'Sevkiyat sorumlusu',
  rapor: 'Rapor kullanıcısı',
};
const ROLE_DESC = {
  admin: 'Her şeyi görür ve yönetir',
  depo: 'Depo giriş, çıkış ve transfer',
  uretim: 'Üretim ve hammadde tüketimi',
  sevkiyat: 'Mamul çıkışı ve sevkiyat',
  rapor: 'Yetkili olduğu raporları görür',
};
// Eski sürüm rolleri
const LEGACY = { izleyici: 'rapor' };

const REC = ['uretim', 'satinalma', 'cep', 'sevkiyat', 'iade', 'iskarta', 'sayim', 'urunSayim', 'fireTartim', 'palet'];
const REPORTS = {
  hammadde: 'Hammadde stok', takip: 'Aylık takip (TRK)', urun: 'Mamul stok', uretim: 'Üretim özeti', kullanim: 'Reçete kullanımı',
  sevkiyat: 'Sevkiyat raporu', durum: 'Geçmiş gün stok durumu', hareket: 'Hammadde hareketleri', anaDepo: 'Ana depo raporu',
  cepDepo: 'Cep depo raporu', islem: 'Kullanıcı işlem raporu', genel: 'Genel yönetici raporu',
};
const ALL = 'geds';

function build(c, r, extra = {}) {
  const out = { c: {}, r: [...r], gecmis: 'kendi', aktar: false, panel: true, ...extra };
  for (const k of REC) out.c[k] = c[k] || (c['*'] !== undefined ? c['*'] : '');
  return out;
}
const DEFAULTS = {
  admin: build({ '*': ALL }, Object.keys(REPORTS), { gecmis: 'hepsi', aktar: true }),
  depo: build({ satinalma: ALL, cep: ALL, iade: ALL, iskarta: ALL, sayim: ALL, uretim: 'g', sevkiyat: 'g', urunSayim: 'g', fireTartim: 'g', palet: 'g' },
    ['hammadde', 'takip', 'durum', 'hareket', 'anaDepo', 'cepDepo', 'kullanim'], { aktar: true }),
  uretim: build({ uretim: ALL, fireTartim: ALL, urunSayim: 'ge', cep: 'g', sayim: 'ge', satinalma: 'g' },
    ['hammadde', 'takip', 'urun', 'uretim', 'kullanim', 'cepDepo', 'durum']),
  sevkiyat: build({ sevkiyat: ALL, urunSayim: ALL, palet: ALL, uretim: 'g' }, ['urun', 'sevkiyat', 'durum']),
  rapor: build({ '*': 'g' }, ['hammadde', 'takip', 'urun', 'uretim', 'kullanim', 'sevkiyat', 'durum', 'hareket', 'anaDepo', 'cepDepo'], { gecmis: 'yok' }),
};

const normRole = (r) => (ROLES[r] ? r : LEGACY[r] || 'rapor');

// Kaydedilmiş özel yetkiyi temizler (bilinmeyen anahtarları atar)
function clean(p, role) {
  const base = DEFAULTS[role] || DEFAULTS.rapor;
  if (!p || typeof p !== 'object') return null;
  const c = {};
  for (const k of REC) {
    const v = p.c && typeof p.c[k] === 'string' ? p.c[k] : base.c[k];
    let s = [...new Set(String(v).split('').filter((x) => ALL.includes(x)))].join('');
    if (s && !s.includes('g')) s = 'g' + s; // yazabilen görür
    c[k] = s;
  }
  const r = Array.isArray(p.r) ? p.r.filter((x) => REPORTS[x]) : base.r;
  return {
    c, r,
    gecmis: ['yok', 'kendi', 'hepsi'].includes(p.gecmis) ? p.gecmis : base.gecmis,
    aktar: p.aktar === undefined ? base.aktar : !!p.aktar,
    panel: p.panel === undefined ? base.panel : !!p.panel,
  };
}

// Kullanıcının geçerli yetkileri
function effective(role, stored) {
  role = normRole(role);
  if (role === 'admin') return { ...DEFAULTS.admin, admin: true };
  let p = null;
  if (stored) { try { p = clean(typeof stored === 'string' ? JSON.parse(stored) : stored, role); } catch (e) { p = null; } }
  return { ...(p || JSON.parse(JSON.stringify(DEFAULTS[role]))), admin: false, custom: !!p };
}

const has = (perm, coll, ch) => !!(perm && (perm.admin || (perm.c[coll] || '').includes(ch)));
const OP_CH = { create: 'e', update: 'd', delete: 's', view: 'g' };
const OP_TR = { e: 'kayıt ekleme', d: 'kayıt düzenleme', s: 'kayıt silme', g: 'görüntüleme' };

module.exports = { ROLES, ROLE_DESC, REPORTS, REC, DEFAULTS, effective, clean, has, normRole, OP_CH, OP_TR };
