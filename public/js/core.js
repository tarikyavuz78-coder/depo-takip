/* Depo Takip 2 — çekirdek: yardımcılar, durum, sunucu bağlantısı, kabuk, yönlendirme, geri al */
'use strict';

// ================= Yardımcılar =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const trLower = (s) => String(s ?? '').toLocaleLowerCase('tr-TR');
const fold = (s) => trLower(s).replace(/[çğıöşüâî]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i' }[c])).replace(/\s+/g, ' ').trim();
const NF = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 });
const NF0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const isNum = (n) => typeof n === 'number' && isFinite(n);
const fmt = (n, d) => (!isNum(n) ? '' : (d === 0 ? NF0 : d === 1 ? NF1 : NF).format(Math.abs(n) < 1e-9 ? 0 : n));
const NFP = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 });
const fmtP = (n) => (!isNum(n) ? '' : NFP.format(n));
const fmtZ = (n, d) => (!isNum(n) || Math.abs(n) < 1e-9 ? '' : fmt(n, d));
const sgn = (n, d) => (!isNum(n) ? '' : `<span class="${n < -1e-9 ? 'neg' : ''}">${fmt(n, d)}</span>`);
const trD = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('.') : '');
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const ago = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'az önce';
  if (s < 3600) return Math.floor(s / 60) + ' dk önce';
  if (s < 86400) return Math.floor(s / 3600) + ' sa önce';
  if (s < 86400 * 7) return Math.floor(s / 86400) + ' gün önce';
  return trD(iso);
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parseNum = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
};
const ls = {
  get(k, d) { try { const v = localStorage.getItem('dt2.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dt2.' + k, JSON.stringify(v)); } catch (e) { /* yoksay */ } },
  del(k) { try { localStorage.removeItem('dt2.' + k); } catch (e) { /* yoksay */ } },
};
const native = window.DepoAndroid || null;
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const ayAdi = (ay) => { const [y, m] = String(ay).split('-').map(Number); return `${AYLAR[m - 1]} ${y}`; };
const ayKaydir = (ay, d) => { let [y, m] = ay.split('-').map(Number); m += d; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
const ayBas = () => S.ay + '-01';
const aySon = () => { const [y, m] = S.ay.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
// Yeni kayıt için varsayılan tarih: seçili ay bu aysa bugün, değilse ayın son günü
const defTarih = () => (today().slice(0, 7) === S.ay ? today() : (today() < ayBas() ? ayBas() : aySon()));

// ================= Simgeler =================
const IC = {
  home: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  factory: '<path d="M3 21V10l6 4V10l6 4V4h6v17z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  swap: '<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
  truck: '<path d="M1 4h14v12H1zM15 9h4l4 4v3h-8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0zM8 21h8"/>',
  pallet: '<path d="M3 14h18M3 18h18M5 14v4M12 14v4M19 14v4M6 14V6h12v8"/>',
  bottle: '<path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/><path d="M8 13h8"/>',
  package: '<path d="M16.5 9.4 7.5 4.2M21 16V8l-9-5-9 5v8l9 5z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a9 9 0 1 1 17.4 0z"/>',
  layout: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  excel: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13l4 5M13 13l-4 5"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || IC.box}</svg>`;

// ================= Durum =================
const S = {
  token: ls.get('token', null),
  user: ls.get('user', null),
  meta: null,          // şemalar, ayarlar, öneriler
  defs: null,          // tanım listeleri (silinmişler dahil)
  idx: {},             // coll -> Map(id -> doc)
  ay: ls.get('ay', today().slice(0, 7)),
  online: true, sseOk: false, sse: null,
  route: null,
  dirty: false,        // modal açıkken gelen değişiklik
  lastChange: null,    // son yapılan değişiklik (geri al düğmesi)
};
// Yetkiler (sunucudan gelir; sunucu da her işlemde ayrıca kontrol eder)
const P = () => (S.meta && S.meta.perm) || { c: {}, r: [], admin: false };
const pc = (coll, ch) => { const p = P(); return !!(p.admin || (p.c[coll] || '').includes(ch)); };
const can = {
  admin: () => !!P().admin,
  g: (coll) => pc(coll, 'g'), e: (coll) => pc(coll, 'e'), d: (coll) => pc(coll, 'd'), s: (coll) => pc(coll, 's'),
  r: (k) => !!(P().admin || (P().r || []).includes(k)),
  edit: () => P().admin || Object.values(P().c || {}).some((v) => /[eds]/.test(v)),
  aktar: () => !!(P().admin || P().aktar),
  panel: () => P().admin || P().panel !== false,
  gecmis: () => P().admin || P().gecmis !== 'yok',
};
const ROLE_TR = new Proxy({ admin: 'Ana yönetici', depo: 'Depo sorumlusu', uretim: 'Üretim sorumlusu', sevkiyat: 'Sevkiyat sorumlusu', rapor: 'Rapor kullanıcısı' }, { get: (t, k) => (S.meta && S.meta.roles && S.meta.roles[k]) || t[k] || k });
// Tarih aralığı (rapor merkezi, hareket ve işlem raporları)
const AR = ls.get('aralik', null) || { bas: today().slice(0, 8) + '01', bit: today() };
const saveAR = () => ls.set('aralik', AR);
const SC = (coll) => (S.meta && S.meta.schemas[coll]) || { label: coll, one: coll, fields: [], computed: [] };

// ================= Sunucu =================
class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
async function api(method, path, body, opts = {}) {
  const headers = {};
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  let payload;
  if (body instanceof Blob || body instanceof ArrayBuffer) { payload = body; headers['Content-Type'] = 'application/octet-stream'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(path, { method, headers, body: payload, cache: 'no-store' }); }
  catch (e) { setOnline(false); throw new ApiError(0, 'Sunucuya ulaşılamıyor. Ağ bağlantısını kontrol edin.'); }
  setOnline(true);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (res.status === 401 && !opts.noLogout && path !== '/api/login') { logoutLocal(); throw new ApiError(401, (data && data.error) || 'Oturum sona erdi'); }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'İşlem başarısız (' + res.status + ')');
  return data;
}
function dl(path) {
  const url = path + (path.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(S.token);
  if (native && native.download) { native.download(location.origin + url); return; }
  const a = document.createElement('a'); a.href = url; a.download = ''; document.body.appendChild(a); a.click(); a.remove();
}
async function loadMeta() { S.meta = await api('GET', '/api/meta'); ls.set('company', S.meta.settings.company); return S.meta; }
async function loadDefs() {
  const r = await api('GET', '/api/defs');
  S.defs = r.defs; S.idx = {};
  for (const [c, arr] of Object.entries(S.defs)) S.idx[c] = new Map(arr.map((d) => [d.id, d]));
  return S.defs;
}
// Tanım yardımcıları
const D = (coll, id) => (S.idx[coll] && S.idx[coll].get(Number(id))) || null;
const defs = (coll, { all = false } = {}) => ((S.defs && S.defs[coll]) || []).filter((d) => !d._deleted && (all || d.aktif !== false));
const bySira = (a, b) => (a.sira || 0) - (b.sira || 0) || String(a.ad || '').localeCompare(String(b.ad || ''), 'tr') || a.id - b.id;
const grupSira = (gid) => { const g = D('grup', gid); return g ? (g.sira || 0) * 1e4 + g.id : 1e9; };
const matSort = (a, b) => grupSira(a.grup) - grupSira(b.grup) || (a.sira || 0) - (b.sira || 0) || a.id - b.id;
const PAL_TR = { std: 'Standart A. Palet', ihr: 'İhracat Paleti', euro: 'Euro A. Palet' };
function refName(coll, id) {
  const d = D(coll, id);
  if (!d) return id ? '?' : '';
  if (coll === 'koliTipi') return `${d.ad} (${fmt(d.adet)}${d.carpan && d.carpan !== 1 ? ' × ' + fmt(d.carpan) : ''})`;
  if (coll === 'kapasite') return `${refName('hat', d.hat)} · ${refName('urun', d.urun)}`;
  if (coll === 'paletTipi') return `${refName('urun', d.urun)} · ${PAL_TR[d.palet] || d.palet}`;
  if (coll === 'preformFirma') return `${d.firma}${d.agirlik ? ' (' + d.agirlik + ')' : ''}`;
  return d.ad || d.kod || d.firma || '#' + d.id;
}
const matName = (id) => { const m = D('hammadde', id); return m ? m.ad : ''; };
const matCode = (id) => { const m = D('hammadde', id); return m ? m.kod : ''; };

// ================= Bildirim =================
function toast(msg, type = '', opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<div class="tx">${opts.title ? `<b>${esc(opts.title)}</b>` : ''}${esc(msg)}</div>${opts.action ? `<button>${opts.actionIcon ? icon(opts.actionIcon) : ''} ${esc(opts.action)}</button>` : ''}`;
  $('#toasts').appendChild(el);
  const kill = () => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 260); };
  const t = setTimeout(kill, opts.ms || (opts.action ? 9000 : type === 'err' ? 7000 : 3500));
  if (opts.action) el.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(t); kill(); opts.onAction(); });
  el.addEventListener('click', () => { clearTimeout(t); kill(); });
  // Aynı anda en fazla 4 bildirim
  const all = $$('.toast', $('#toasts')); if (all.length > 2) all.slice(0, all.length - 2).forEach((x) => x.remove());
}
function sysNotify(title, body) {
  try {
    if (native && native.notify) { native.notify(title, body); return; }
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'icon.svg' });
  } catch (e) { /* yoksay */ }
}
function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = ok ? 1250 : 330; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    o.start(); o.stop(ctx.currentTime + 0.17);
    if (navigator.vibrate) navigator.vibrate(ok ? 40 : [60, 40, 60]);
  } catch (e) { /* yoksay */ }
}

// ================= Geri al =================
// Her kayıt işleminden sonra "Geri al" düğmeli bildirim gösterilir. Geri alınan işlem "Yinele" ile geri getirilebilir.
function changed(changeId, msg) {
  if (!changeId) { toast('Değişiklik yok', ''); return; }
  S.lastChange = changeId;
  updateUndoBtn();
  toast(msg || 'Kaydedildi', 'ok', { action: 'Geri al', actionIcon: 'undo', onAction: () => undoChange(changeId) });
}
async function undoChange(changeId, force) {
  try {
    const r = await api('POST', '/api/undo', changeId ? { changeId, force } : {});
    const ch = await api('GET', '/api/history?limit=1&mine=1');
    const nextId = ch.rows[0] ? ch.rows[0].id : null;
    const redo = / — yinelendi$|^yinelendi$/.test(r.label || '');
    const base = String(r.label || '').replace(/ — (geri alındı|yinelendi)$/, '').replace(/^(geri alındı|yinelendi)$/, '');
    toast(`${base ? base + ' · ' : ''}${r.count} değişiklik`, 'ok', { title: redo ? 'Yinelendi' : 'Geri alındı', action: redo ? 'Geri al' : 'Yinele', actionIcon: redo ? 'undo' : 'redo', onAction: () => undoChange(nextId) });
    await afterRemote(true);
  } catch (e) {
    if (e.status === 409 && can.admin()) {
      if (await confirmBox('Kayıt sonradan değiştirilmiş', esc(e.message) + '<br><br>Yine de geri almak, sonraki değişikliğin üzerine yazar.', 'Yine de geri al', true)) return undoChange(changeId, true);
      return;
    }
    toast(e.message, 'err', { title: 'Geri alınamadı' });
  }
}
async function updateUndoBtn() {
  const b = $('#undo-btn'); if (!b) return;
  b.disabled = !can.edit();
}

// ================= Modal =================
function modal({ title, body, foot, size, onMount, onClose }) {
  const back = document.createElement('div');
  back.className = 'mback';
  back.innerHTML = `<div class="modal ${size || ''}" role="dialog" aria-modal="true">
    <div class="mh"><h2>${title}</h2><button class="ib" data-close aria-label="Kapat">${icon('x')}</button></div>
    <div class="mb">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ''}</div>`;
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    back.remove(); document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
    if (!$('.mback') && S.dirty) { S.dirty = false; rerender(true); }
  };
  const onKey = (e) => { if (e.key === 'Escape' && back === $$('.mback').pop()) close(); };
  back.addEventListener('mousedown', (e) => { if (e.target === back) back.dataset.down = '1'; });
  back.addEventListener('mouseup', (e) => { if (e.target === back && back.dataset.down) close(); delete back.dataset.down; });
  back.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  $('#modal-root').appendChild(back);
  const m = back.querySelector('.modal');
  m.close = close;
  if (onMount) onMount(m, close);
  const f = m.querySelector('.mb input:not([type=hidden]):not([type=checkbox]):not([readonly]), .mb select, .mb textarea');
  if (f && matchMedia('(pointer:fine)').matches) setTimeout(() => f.focus(), 30);
  return { el: m, close };
}
function confirmBox(title, html, okLabel = 'Onayla', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    modal({
      title: esc(title), body: `<div style="font-size:14px">${html}</div>`,
      foot: `<span class="spacer"></span><button class="btn" data-close>Vazgeç</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-ok>${esc(okLabel)}</button>`,
      onMount: (el, close) => el.querySelector('[data-ok]').addEventListener('click', () => { done = true; close(); resolve(true); }),
      onClose: () => { if (!done) resolve(false); },
    });
  });
}
function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || 'Kaydediliyor…'; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

// ================= Bağlantı / canlı güncelleme =================
function setOnline(v) { if (S.online === v) return; S.online = v; renderConn(); }
function renderConn() {
  const el = $('#conn'); if (!el) return;
  let cls = '', txt = 'Canlı';
  if (!S.online) { cls = 'off'; txt = 'Bağlantı yok'; } else if (!S.sseOk) { cls = 'wait'; txt = 'Bağlanıyor'; }
  el.className = 'conn ' + cls;
  el.innerHTML = `<i></i><span>${txt}</span>`;
  el.title = S.online ? 'Sunucuya bağlı; değişiklikler tüm cihazlara anında yansır' : 'Sunucuya ulaşılamıyor';
}
function connectSSE() {
  if (S.sse) { try { S.sse.close(); } catch (e) { /* yoksay */ } }
  if (!S.token || !window.EventSource) return;
  const es = new EventSource('/api/events?t=' + encodeURIComponent(S.token));
  S.sse = es;
  es.addEventListener('hello', () => { S.sseOk = true; setOnline(true); renderConn(); });
  es.addEventListener('change', (ev) => { let d = {}; try { d = JSON.parse(ev.data); } catch (e) { /* yoksay */ } onRemote(d); });
  es.onerror = () => { S.sseOk = false; renderConn(); };
}
let remoteTimer = null; let pendColls = new Set();
function onRemote(d) {
  for (const c of d.colls || ['*']) pendColls.add(c);
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(() => { const cs = pendColls; pendColls = new Set(); afterRemote(false, cs); }, 300);
}
const DEF_SET = new Set(['grup', 'hammadde', 'urun', 'recete', 'hat', 'kapasite', 'koliTipi', 'paletTipi', 'preformFirma', 'vardiya', 'personel', 'alan', '*']);
async function afterRemote(force, colls) {
  try {
    const needDefs = force || !colls || [...colls].some((c) => DEF_SET.has(c));
    const oldPerm = JSON.stringify(P());
    if (needDefs) await Promise.all([loadDefs(), loadMeta()]);
    if (JSON.stringify(P()) !== oldPerm && $('#main')) { renderShell(); }
  } catch (e) { return; }
  if ($('.mback')) { S.dirty = true; return; }
  rerender(true);
  updateAlerts();
}
// Asgari stok uyarıları (yeni düşenler bildirilir)
let alertSet = new Set(ls.get('alerts', []));
async function updateAlerts() {
  try {
    const r = await api('GET', '/api/r/guncel');
    const now = new Set(); const fresh = [];
    for (const [id, g] of Object.entries(r.rows)) {
      if (g.durum !== 'normal') { now.add(id); if (!alertSet.has(id) && g.durum !== 'eksi') fresh.push(Number(id)); }
    }
    if (fresh.length && alertSet.size) {
      const t = fresh.length === 1 ? `${matName(fresh[0])} asgari stok altına indi` : `${fresh.length} hammadde asgari stok altına indi`;
      toast(fresh.slice(0, 4).map(matName).join(' · '), 'warn', { title: 'Stok uyarısı' });
      sysNotify('Stok uyarısı', t);
    }
    alertSet = now; ls.set('alerts', [...now]);
    $$('[data-alert-count]').forEach((el) => { el.textContent = now.size; el.classList.toggle('hidden', !now.size); });
  } catch (e) { /* yoksay */ }
}

// ================= Kabuk =================
const REC_NAV = [['uretim', 'factory'], ['satinalma', 'download'], ['cep', 'swap'], ['sevkiyat', 'truck'], ['iade', 'undo'], ['iskarta', 'alert'], ['sayim', 'check'], ['urunSayim', 'check'], ['fireTartim', 'scale'], ['palet', 'pallet']];
const REP_NAV = [['hammadde', 'Hammadde Stok', 'box'], ['takip', 'Aylık Takip (TRK)', 'list'], ['urun', 'Mamul Stok', 'bottle'], ['uretim', 'Üretim Özeti', 'factory'], ['kullanim', 'Reçete Kullanımı', 'package'], ['sevkiyat', 'Sevkiyat Raporu', 'truck'],
  ['durum', 'Geçmiş gün stok', 'clock'], ['hareket', 'Hammadde hareketleri', 'swap'], ['islem', 'Kullanıcı işlemleri', 'users']];
const MERKEZ_KEYS = ['anaDepo', 'cepDepo', 'hareket', 'islem', 'genel', 'hammadde', 'urun', 'uretim', 'sevkiyat'];
const repNav = () => REP_NAV.filter(([k]) => can.r(k)).concat(MERKEZ_KEYS.some((k) => can.r(k)) ? [['merkez', 'Excel rapor merkezi', 'excel']] : []);
const recNav = () => REC_NAV.filter(([c]) => can.g(c));
const defNav = () => (can.admin() ? DEF_NAV : can.edit() ? DEF_NAV.filter(([h]) => h === '/etiket') : []);
const stokHref = () => (can.r('hammadde') ? '/r/hammadde' : can.r('urun') ? '/r/urun' : can.r('durum') ? '/r/durum' : '/qr');
const DEF_NAV = [['/t/hammadde', 'Hammaddeler', 'box'], ['/recete', 'Reçeteler', 'package'], ['/t/urun', 'Ürünler', 'bottle'], ['/t/grup', 'Gruplar', 'tag'], ['/tanim', 'Hat, palet, koli…', 'layout'], ['/alanlar', 'Form alanları', 'edit'], ['/etiket', 'QR etiketleri', 'print']];
function renderShell() {
  const a = (href, ic, label, extra = '') => `<a href="#${href}" data-nav="${href}">${icon(ic)}<span>${esc(label)}</span>${extra}</a>`;
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand"><img src="icon.svg" alt=""><div><b>${esc(S.meta.settings.company)}</b><span>Depo Takip ${esc(S.meta.version)}</span></div></div>
      <nav class="nav">
        ${a('/', 'home', can.panel() ? 'Panel' : 'Ana sayfa', '<span class="cnt hidden" data-alert-count></span>')}
        ${a('/qr', 'scan', 'QR / barkod okut')}
        ${recNav().length ? `<div class="sec">Kayıtlar</div>${recNav().map(([c, ic]) => a('/k/' + c, ic, SC(c).label)).join('')}` : ''}
        ${repNav().length ? `<div class="sec">Raporlar</div>${repNav().map(([k, l, ic]) => a('/r/' + k, ic, l)).join('')}` : ''}
        ${defNav().length ? `<div class="sec">Tanımlar</div>${defNav().map(([h, l, ic]) => a(h, ic, l)).join('')}` : ''}
        <div class="sec">Sistem</div>
        ${can.gecmis() ? a('/gecmis', 'history', 'Değişiklik geçmişi') : ''}
        ${a('/ayarlar', 'gear', 'Ayarlar')}
      </nav>
      <div class="foot"><b>${esc(S.user.fullName)}</b>${ROLE_TR[S.user.role] || ''} · <a href="#" data-act="logout">Çıkış</a></div>
    </aside>
    <div class="main">
      <header class="top">
        <img class="mbrand" src="icon.svg" alt="">
        <div class="title" id="page-title"></div>
        <span class="spacer"></span>
        <div class="month" id="month">
          <button data-act="ay-prev" title="Önceki ay">${icon('left')}</button>
          <label class="lbl-m" title="Ay seçin"><span id="ay-lbl">${ayAdi(S.ay)}</span><input type="month" id="ay-inp" value="${S.ay}"></label>
          <button data-act="ay-next" title="Sonraki ay">${icon('right')}</button>
        </div>
        <button class="ib" id="undo-btn" data-act="undo-last" title="Son işlemimi geri al (Ctrl+Z)">${icon('undo')}</button>
        <span id="conn" class="conn"></span>
      </header>
      <div class="content" id="main"></div>
    </div>
    <nav class="bnav">
      <a href="#/" data-nav="/">${icon('home')}<span>Panel</span></a>
      <a href="#/kayit" data-nav="/kayit">${icon('plus')}<span>Kayıt</span></a>
      <a href="#/qr" data-nav="/qr"><span class="fab">${icon('scan')}</span><span>QR</span></a>
      <a href="#${stokHref()}" data-nav="${stokHref()}">${icon('box')}<span>Stok</span></a>
      <a href="#/menu" data-nav="/menu">${icon('menu')}<span>Menü</span></a>
    </nav>
  </div>`;
  const inp = $('#ay-inp');
  $('.lbl-m').addEventListener('click', (e) => { e.preventDefault(); try { inp.showPicker(); } catch (er) { const v = prompt('Ay (YYYY-AA)', S.ay); if (/^\d{4}-\d{2}$/.test(v || '')) setAy(v); } });
  inp.addEventListener('change', () => { if (/^\d{4}-\d{2}$/.test(inp.value)) setAy(inp.value); });
  renderConn(); updateUndoBtn();
}
function setAy(ay) { S.ay = ay; ls.set('ay', ay); $('#ay-lbl').textContent = ayAdi(ay); $('#ay-inp').value = ay; rerender(); }
function setTitle(t) { const el = $('#page-title'); if (el) el.textContent = t; document.title = t + ' · Depo Takip'; }
const pageHead = (title, sub, acts = '') => `<div class="ph"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="acts">${acts}</div></div>`;

// ================= Yönlendirme =================
const ROUTES = [];
const route = (re, fn, opts = {}) => ROUTES.push({ re, fn, ...opts });
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [p, qs] = h.split('?');
  return { path: p, q: Object.fromEntries(new URLSearchParams(qs || '')) };
}
function go(path) { if (location.hash === '#' + path) rerender(); else location.hash = path; }
let renderSeq = 0;
async function rerender(soft) {
  if (!S.meta || !$('#main')) return;
  const { path, q } = parseHash();
  const r = ROUTES.find((x) => x.re.test(path));
  $$('[data-nav]').forEach((a) => { const n = a.dataset.nav; a.classList.toggle('on', n === path || (n !== '/' && path.startsWith(n + '/')) || (n === '/kayit' && path.startsWith('/k/'))); });
  // Her çizimde temiz bir kap: eski olay dinleyicileri birikmesin (yumuşak yenilemede içerik görünür kalır)
  const old = $('#main');
  const main = old.cloneNode(!!soft);
  old.replaceWith(main);
  const seq = ++renderSeq;
  if (!r) { main.innerHTML = '<div class="empty">Sayfa bulunamadı</div>'; return; }
  const m = path.match(r.re);
  const scroll = soft ? window.scrollY : 0;
  if (!soft) main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const ctx = { q, m, soft, seq, alive: () => seq === renderSeq };
    await r.fn(main, ctx);
    if (soft) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
  } catch (e) {
    if (seq !== renderSeq) return;
    main.innerHTML = `<div class="banner danger">${icon('alert')}<div>${esc(e.message)}</div></div>`;
  }
}
window.addEventListener('hashchange', () => rerender());

// ================= Oturum =================
function logoutLocal() {
  S.token = null; S.user = null; ls.del('token'); ls.del('user');
  if (S.sse) { try { S.sse.close(); } catch (e) { /* yoksay */ } S.sse = null; }
  renderLogin();
}
async function startApp() {
  let st;
  try { st = await api('GET', '/api/status'); } catch (e) { return renderOffline(e.message); }
  if (st.needsSetup) return renderSetup(st);
  if (!S.token) return renderLogin(st);
  try {
    await Promise.all([loadMeta(), loadDefs()]);
    S.user = S.meta.user; ls.set('user', S.user);
    document.body.dataset.role = S.user.role;
  } catch (e) { if (e.status === 401) return; return renderOffline(e.message); }
  renderShell();
  connectSSE();
  rerender();
  updateAlerts();
}
function renderOffline(msg) {
  $('#app').innerHTML = `<div class="auth"><div class="card auth-card"><div class="brand-lg"><img src="icon.svg" alt=""><div><h1>Depo Takip</h1><div class="muted small">Sunucuya bağlanılamadı</div></div></div>
    <p>${esc(msg)}</p><p class="muted small" style="margin-top:8px">Depo bilgisayarının açık olduğundan ve telefonun aynı ağa bağlı olduğundan emin olun.</p>
    <div class="row" style="margin-top:14px"><button class="btn primary" data-act="reload">Tekrar dene</button>${native && native.changeServer ? '<button class="btn" data-act="change-server">Sunucu adresini değiştir</button>' : ''}</div></div></div>`;
}
function renderLogin(st) {
  const company = (st && st.company) || ls.get('company', 'Depo Takip');
  $('#app').innerHTML = `<div class="auth"><form class="card auth-card" id="login-form" autocomplete="on">
    <div class="brand-lg"><img src="icon.svg" alt=""><div><h1>${esc(company)}</h1><div class="muted small">Depo Takip Sistemi</div></div></div>
    <div class="stack">
      <label class="fld"><span>Kullanıcı adı</span><input class="input" name="username" autocomplete="username" autocapitalize="none" required></label>
      <label class="fld"><span>Şifre</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn primary lg block" type="submit">Giriş yap</button>
      ${native && native.changeServer ? `<div class="foot-note">Sunucu: ${esc(location.host)} · <a href="#" data-act="change-server">Değiştir</a></div>` : ''}
    </div></form></div>`;
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    setBusy(btn, true, 'Giriş yapılıyor…');
    try {
      const f = new FormData(e.target);
      const r = await api('POST', '/api/login', { username: f.get('username'), password: f.get('password'), device: native ? 'Android' : navigator.platform });
      S.token = r.token; S.user = r.user; ls.set('token', r.token); ls.set('user', r.user);
      startApp();
    } catch (err) { toast(err.message, 'err'); setBusy(btn, false); }
  });
}
function renderSetup() {
  $('#app').innerHTML = `<div class="auth"><form class="card auth-card" id="setup-form">
    <div class="brand-lg"><img src="icon.svg" alt=""><div><h1>İlk kurulum</h1><div class="muted small">Yönetici hesabını oluşturun</div></div></div>
    <div class="stack">
      <label class="fld"><span>Firma adı</span><input class="input" name="company" required></label>
      <label class="fld"><span>Ad soyad</span><input class="input" name="fullName" required></label>
      <label class="fld"><span>Kullanıcı adı</span><input class="input" name="username" value="admin" autocapitalize="none" required></label>
      <label class="fld"><span>Şifre (en az 4 karakter)</span><input class="input" name="password" type="password" required minlength="4"></label>
      <label class="fld"><span>Şifre (tekrar)</span><input class="input" name="password2" type="password" required></label>
      <button class="btn primary lg block" type="submit">Kurulumu tamamla</button>
      <div class="foot-note">Hammaddeler, ürünler, reçeteler, hatlar ve palet/koli tipleri Ekim 2026 Excel dosyanızdan hazır yüklendi.</div>
    </div></form></div>`;
  $('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.password !== d.password2) return toast('Şifreler aynı değil', 'err');
    try {
      const r = await api('POST', '/api/setup', d);
      S.token = r.token; S.user = r.user; ls.set('token', r.token); ls.set('user', r.user);
      toast('Kurulum tamamlandı. Hoş geldiniz!', 'ok');
      startApp();
    } catch (err) { toast(err.message, 'err'); }
  });
}

// ================= Genel tıklamalar =================
const ACTS = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTS[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});
ACTS.logout = async () => { try { await api('POST', '/api/logout'); } catch (e) { /* yoksay */ } logoutLocal(); };
ACTS.reload = () => location.reload();
ACTS['change-server'] = () => native && native.changeServer && native.changeServer();
ACTS['ay-prev'] = () => setAy(ayKaydir(S.ay, -1));
ACTS['ay-next'] = () => setAy(ayKaydir(S.ay, 1));
ACTS['undo-last'] = () => undoChange(null);
ACTS.go = (el) => go(el.dataset.href);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    if ($('.mback') || !S.user || !can.edit()) return;
    e.preventDefault();
    undoChange(null);
  }
});
// ================= El tipi barkod okuyucu (klavye gibi çalışan USB / Bluetooth okuyucular) =================
// Okuyucu karakterleri çok hızlı yazar ve sonunda Enter gönderir. Bir yazı alanında değilken okutulan kod
// QR ekranındaki gibi işlenir; açık bir pencere kendi okuyucu dinleyicisini (window.__scanTarget) tanımlamışsa ona gider.
(function wedge() {
  let buf = ''; let last = 0; let fast = 0;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    const inField = !!(t && t.closest && t.closest('input, textarea, select, [contenteditable]'));
    const now = Date.now();
    if (e.key === 'Enter') {
      const code = buf; const ok = fast >= 4 && code.length >= 5;
      buf = ''; fast = 0;
      if (!ok || inField) return;
      e.preventDefault();
      if (typeof window.__scanTarget === 'function') window.__scanTarget(code);
      else if (S.user && !$('.mback')) handleScan(code);
      return;
    }
    if (e.key.length !== 1) return;
    if (now - last > 60) { buf = ''; fast = 0; } else fast++;
    last = now; buf += e.key;
  }, true);
})();
// Okutulan kodu aç: hammadde kartı veya ürün kartı
async function handleScan(raw) {
  const code = codeFromScan(raw); if (!code) return;
  try { const r = await api('GET', '/api/qr/' + encodeURIComponent(code)); beep(true); go((r.type === 'urun' ? '/u/' : '/h/') + r.id); }
  catch (e) { beep(false); toast(e.message, 'err'); }
}

// Android geri tuşu: önce açık pencereyi kapat
window.__onNativeBack = () => {
  const ms = $$('.mback');
  if (ms.length) { const m = ms.pop().querySelector('.modal'); if (m && m.close) m.close(); return true; }
  if (parseHash().path !== '/') { history.back(); return true; }
  return false;
};
