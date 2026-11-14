/* Depo Takip — istemci uygulaması (bağımlılıksız) */
(function () {
  'use strict';

  // ================= Temel yardımcılar =================
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const trLower = (s) => String(s || '').toLocaleLowerCase('tr-TR');
  const fold = (s) => trLower(s).replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c])).replace(/\s+/g, ' ');
  const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 });
  const fmt = (n) => (n === null || n === undefined || n === '' || isNaN(n) ? '—' : nf.format(n));
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '');
  const ago = (iso) => {
    if (!iso) return '';
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return 'az önce';
    if (s < 3600) return Math.floor(s / 60) + ' dk önce';
    if (s < 86400) return Math.floor(s / 3600) + ' sa önce';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' gün önce';
    return fmtDay(iso);
  };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const parseNum = (v) => {
    if (typeof v === 'number') return v;
    const s = String(v || '').trim().replace(/\s/g, '');
    if (!s) return NaN;
    return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('dt.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('dt.' + k, JSON.stringify(v)); } catch (e) { /* yoksay */ } },
    del(k) { try { localStorage.removeItem('dt.' + k); } catch (e) { /* yoksay */ } },
  };
  const native = window.DepoAndroid || null; // Android uygulaması köprüsü

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
    GIRIS: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    TRANSFER: '<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>',
    URETIM: '<path d="M3 21V10l6 4V10l6 4V4h6v17z"/>',
    FIRE: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z"/>',
    IADE: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    SAYIM: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    IPTAL: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    excel: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13l4 5M13 13l-4 5"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    swap: '<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z"/>',
  };
  const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

  const TYPE_INFO = {
    GIRIS: { label: 'Depo Girişi', short: 'Giriş', verb: 'Giriş yap' },
    TRANSFER: { label: 'Transfer', short: 'Transfer', verb: 'Transfer et' },
    URETIM: { label: 'Üretime Çıkış', short: 'Üretim', verb: 'Üretime ver' },
    FIRE: { label: 'Fire', short: 'Fire', verb: 'Fire kaydet' },
    IADE: { label: 'Üretimden İade', short: 'İade', verb: 'İade al' },
    SAYIM: { label: 'Sayım Düzeltme', short: 'Sayım', verb: 'Sayımı kaydet' },
    IPTAL: { label: 'İptal (Ters Kayıt)', short: 'İptal', verb: '' },
  };
  const DEPOTS = { HAM: 'Ham Depo', CEP: 'Cep Depo' };
  const STATUS = {
    NORMAL: ['Normal', 'ok'], KRITIK: ['Kritik', 'danger'], TUKENDI: ['Tükendi', 'danger'], TRANSFER: ['Transfer gerekli', 'warn'],
  };
  const FIRE_REASONS = ['Makine arızası', 'Ayar firesi', 'Hasarlı ambalaj', 'Baskı / etiket hatası', 'Bozuk / kusurlu malzeme', 'Numune'];
  const ROLE_TR = { admin: 'Yönetici', depo: 'Depocu', izleyici: 'İzleyici' };

  // ================= Durum =================
  const S = {
    token: store.get('token', null),
    user: store.get('user', null),
    company: store.get('company', 'Depo Takip'),
    meta: null,
    products: [],
    productsAt: 0,
    online: true,
    sse: null,
    sseOk: false,
    alertCodes: new Set(store.get('alertCodes', [])),
    route: null,
    queue: store.get('queue', []),
    failed: store.get('failed', []),
  };
  const can = {
    move: () => S.user && (S.user.role === 'admin' || S.user.role === 'depo'),
    admin: () => S.user && S.user.role === 'admin',
  };

  // ================= API =================
  class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  async function api(method, path, body, opts = {}) {
    const headers = {};
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    let payload;
    if (body instanceof Blob || body instanceof ArrayBuffer) { payload = body; headers['Content-Type'] = 'application/octet-stream'; }
    else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
    let res;
    try {
      res = await fetch(path, { method, headers, body: payload, cache: 'no-store', signal: opts.signal });
    } catch (e) {
      setOnline(false);
      throw new ApiError(0, 'Sunucuya ulaşılamıyor. Ağ bağlantısını kontrol edin.');
    }
    setOnline(true);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401 && path !== '/api/login') { logoutLocal(); throw new ApiError(401, (data && data.error) || 'Oturum sona erdi'); }
    if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'İşlem başarısız (' + res.status + ')');
    return data;
  }
  const dl = (path) => {
    const sep = path.includes('?') ? '&' : '?';
    const url = path + sep + 't=' + encodeURIComponent(S.token);
    if (native && native.download) { native.download(location.origin + url); return; }
    const a = document.createElement('a'); a.href = url; a.download = ''; document.body.appendChild(a); a.click(); a.remove();
  };

  // ================= Bildirim / toast =================
  function toast(msg, type = '', title = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<div>${title ? `<b>${esc(title)}</b>` : ''}${esc(msg)}</div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, type === 'err' ? 6500 : 3800);
    el.addEventListener('click', () => el.remove());
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

  // ================= Modal =================
  function modal({ title, body, foot, wide, onMount }) {
    const root = $('#modal-root');
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Kapat">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    back.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    root.appendChild(back);
    const m = back.querySelector('.modal');
    if (onMount) onMount(m, close);
    const f = m.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
    if (f && matchMedia('(pointer:fine)').matches) f.focus();
    return { el: m, close };
  }
  function confirmBox(title, text, okLabel = 'Onayla', danger = false) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title, body: `<p style="margin:0">${text}</p>`,
        foot: `<button class="btn" data-close>Vazgeç</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button>`,
        onMount: (el, close) => {
          el.querySelector('[data-ok]').addEventListener('click', () => { done = true; close(); resolve(true); });
        },
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe($('#modal-root'), { childList: true });
    });
  }
  function formData(el) {
    const o = {};
    $$('[name]', el).forEach((i) => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
    return o;
  }
  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || 'Kaydediliyor…'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  // ================= Bağlantı / canlı senkron =================
  function setOnline(v) {
    if (S.online === v) return;
    S.online = v;
    renderConn();
    if (v) flushQueue();
  }
  function renderConn() {
    const el = $('#conn');
    if (!el) return;
    const pending = S.queue.length;
    let cls = '', txt = 'Senkron';
    if (!S.online) { cls = 'off'; txt = 'Bağlantı yok'; }
    else if (!S.sseOk) { cls = 'wait'; txt = 'Bağlanıyor'; }
    if (pending) { cls = cls || 'wait'; txt += ` · ${pending} bekleyen`; }
    el.className = 'conn ' + cls;
    el.innerHTML = `<i></i>${txt}`;
    el.title = S.online ? 'Sunucuya bağlı; değişiklikler tüm cihazlara anında yansır' : 'Sunucuya ulaşılamıyor';
  }
  function connectSSE() {
    if (S.sse) { try { S.sse.close(); } catch (e) { /* yoksay */ } }
    if (!S.token || !window.EventSource) return;
    const es = new EventSource('/api/events?t=' + encodeURIComponent(S.token));
    S.sse = es;
    es.addEventListener('hello', () => { S.sseOk = true; setOnline(true); renderConn(); flushQueue(); });
    es.addEventListener('change', (ev) => {
      let d = {};
      try { d = JSON.parse(ev.data); } catch (e) { /* yoksay */ }
      onRemoteChange(d);
    });
    es.onerror = () => { S.sseOk = false; renderConn(); };
  }
  let changeTimer = null;
  function onRemoteChange(d) {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(async () => {
      await loadProducts(true).catch(() => {});
      checkAlerts();
      if (d.kind === 'settings' || d.kind === 'category') { S.meta = null; await loadMeta().catch(() => {}); }
      // Kullanıcı form doldururken ekranı yeniden çizme
      const r = S.route && S.route.name;
      if (['panel', 'stoklar', 'urun', 'hareketler', 'uyarilar'].includes(r)) rerender(true);
      else if (r === 'islem') refreshSelectedProduct();
      updateBadges();
    }, 250);
  }

  // Çevrimdışı kuyruk: bağlantı koparsa hareketler cihazda bekler, bağlantı gelince gönderilir
  function saveQueue() { store.set('queue', S.queue); store.set('failed', S.failed); renderConn(); renderQueueBanner(); }
  let flushing = false;
  async function flushQueue() {
    if (flushing || !S.queue.length || !S.token) return;
    flushing = true;
    try {
      while (S.queue.length) {
        const item = S.queue[0];
        try {
          await api('POST', '/api/movements', { items: [item] });
          S.queue.shift();
          saveQueue();
        } catch (e) {
          if (e.status === 0) break;
          S.queue.shift();
          S.failed.push({ ...item, error: e.message, failedAt: new Date().toISOString() });
          saveQueue();
          toast(e.message, 'err', 'Bekleyen işlem gönderilemedi');
        }
      }
      if (!S.queue.length) { await loadProducts(true).catch(() => {}); }
    } finally { flushing = false; }
  }
  setInterval(() => { if (S.queue.length) flushQueue(); }, 15000);
  function renderQueueBanner() {
    const el = $('#queue-banner');
    if (!el) return;
    const q = S.queue.length, f = S.failed.length;
    if (!q && !f) { el.innerHTML = ''; return; }
    el.innerHTML = `${q ? `<div class="banner warn">${icon('cloud')}<div class="grow"><b>${q} işlem gönderilmeyi bekliyor.</b> Bağlantı gelince otomatik gönderilecek.</div><button class="btn sm" data-act="flush">Şimdi dene</button></div>` : ''}
      ${f ? `<div class="banner danger">${icon('alert')}<div class="grow"><b>${f} işlem sunucu tarafından reddedildi.</b> Kontrol edip yeniden girmeniz gerekiyor.</div><button class="btn sm" data-act="show-failed">Göster</button></div>` : ''}`;
  }

  // ================= Veri =================
  async function loadMeta() {
    if (S.meta) return S.meta;
    S.meta = await api('GET', '/api/meta');
    if (S.meta.company) { S.company = S.meta.company; store.set('company', S.company); }
    return S.meta;
  }
  async function loadProducts(force) {
    if (!force && S.products.length && Date.now() - S.productsAt < 60000) return S.products;
    S.products = await api('GET', '/api/products');
    S.productsAt = Date.now();
    return S.products;
  }
  function findProduct(id) { return S.products.find((p) => p.id === Number(id)); }
  function checkAlerts() {
    const now = new Set(S.products.filter((p) => p.status !== 'NORMAL').map((p) => p.code));
    const fresh = S.products.filter((p) => p.status !== 'NORMAL' && !S.alertCodes.has(p.code));
    if (fresh.length) {
      const t = fresh.length === 1 ? `${fresh[0].name}: ${STATUS[fresh[0].status][0]}` : `${fresh.length} kalem asgari seviyenin altına indi`;
      toast(fresh.slice(0, 4).map((p) => `${p.name} — ${STATUS[p.status][0]} (${fmt(p.total)} ${p.unit})`).join(' · '), 'warn', 'Stok uyarısı');
      sysNotify('Stok uyarısı', t);
    }
    S.alertCodes = now;
    store.set('alertCodes', [...now]);
  }
  function updateBadges() {
    const n = S.products.filter((p) => p.status !== 'NORMAL').length;
    $$('[data-alert-count]').forEach((el) => { el.textContent = n; el.classList.toggle('hidden', !n); });
  }

  // ================= Yönlendirme =================
  const routes = [
    [/^\/?$/, 'panel', renderDashboard],
    [/^\/tara$/, 'tara', renderScan],
    [/^\/islem(?:\/(\w+))?$/, 'islem', renderMovementForm],
    [/^\/stoklar$/, 'stoklar', renderStock],
    [/^\/uyarilar$/, 'uyarilar', renderAlerts],
    [/^\/urun\/(\d+)$/, 'urun', renderProduct],
    [/^\/hareketler$/, 'hareketler', renderHistory],
    [/^\/raporlar$/, 'raporlar', renderReports],
    [/^\/etiketler$/, 'etiketler', renderLabels],
    [/^\/ayarlar$/, 'ayarlar', renderSettings],
    [/^\/menu$/, 'menu', renderMenu],
  ];
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  function go(path) { if (location.hash === '#' + path) rerender(); else location.hash = path; }
  let renderSeq = 0;
  async function rerender(soft) {
    const { path, query } = parseHash();
    for (const [re, name, fn] of routes) {
      const m = path.match(re);
      if (!m) continue;
      S.route = { name, params: m.slice(1), query };
      highlightNav(name);
      const seq = ++renderSeq;
      const main = $('#main');
      if (!main) return;
      if (!soft) { main.innerHTML = '<div class="empty"><div class="spinner" style="margin:auto"></div></div>'; window.scrollTo(0, 0); }
      try {
        await fn(main, { p: m.slice(1), q: query, soft, alive: () => seq === renderSeq });
      } catch (e) {
        if (seq === renderSeq) main.innerHTML = `<div class="banner danger">${icon('alert')}<div class="grow">${esc(e.message)}</div><button class="btn sm" data-act="reload">Tekrar dene</button></div>`;
      }
      return;
    }
    go('/');
  }
  function setTitle(t) { const el = $('#page-title'); if (el) el.textContent = t; document.title = t + ' · ' + S.company; }
  function highlightNav(name) {
    const map = { urun: 'stoklar', uyarilar: 'stoklar' };
    const key = map[name] || name;
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  }

  // ================= Kabuk =================
  function renderShell() {
    const navItem = (nav, href, ic, label, extra = '') => `<a href="#${href}" data-nav="${nav}">${icon(ic)}<span>${label}</span>${extra}</a>`;
    $('#app').innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><img src="icon.svg" alt=""><div><b>${esc(S.company)}</b><span>Depo Takip</span></div></div>
        <nav class="nav">
          ${navItem('panel', '/', 'home', 'Panel')}
          ${navItem('tara', '/tara', 'scan', 'QR Okut')}
          <div class="nav-sec">Stok İşlemleri</div>
          ${can.move() ? navItem('islem', '/islem/GIRIS', 'plus', 'Yeni İşlem') : ''}
          ${navItem('stoklar', '/stoklar', 'box', 'Stoklar', '<span class="badge count hidden" data-alert-count></span>')}
          ${navItem('hareketler', '/hareketler', 'list', 'Hareket Geçmişi')}
          <div class="nav-sec">Raporlar</div>
          ${navItem('raporlar', '/raporlar', 'chart', 'Raporlar')}
          ${navItem('etiketler', '/etiketler', 'tag', 'QR Etiketleri')}
          <div class="nav-sec">Sistem</div>
          ${navItem('ayarlar', '/ayarlar', 'gear', 'Ayarlar')}
        </nav>
        <div class="side-foot"><div class="who">${esc(S.user.fullName)}</div>${ROLE_TR[S.user.role] || ''} · <a href="#" data-act="logout" style="color:#bfe0e0">Çıkış</a></div>
      </aside>
      <div class="main-wrap">
        <header class="topbar">
          <img class="mobile-brand" src="icon.svg" alt="">
          <div class="title" id="page-title"></div>
          <span id="conn" class="conn"></span>
          <a class="icon-btn" href="#/uyarilar" title="Stok uyarıları">${icon('bell')}<span class="badge count dot hidden" data-alert-count></span></a>
        </header>
        <main><div id="queue-banner"></div><div id="main"></div></main>
      </div>
      <nav class="bottom-nav">
        <a href="#/" data-nav="panel">${icon('home')}<span>Panel</span></a>
        <a href="#/stoklar" data-nav="stoklar">${icon('box')}<span>Stoklar</span><span class="badge count hidden" data-alert-count></span></a>
        <a href="#/tara" data-nav="tara" class="scan"><span class="fab">${icon('scan')}</span><span>QR Okut</span></a>
        ${can.move() ? `<a href="#/islem/GIRIS" data-nav="islem">${icon('plus')}<span>İşlem</span></a>` : `<a href="#/hareketler" data-nav="hareketler">${icon('list')}<span>Geçmiş</span></a>`}
        <a href="#/menu" data-nav="menu">${icon('menu')}<span>Menü</span></a>
      </nav>
    </div>`;
    renderConn();
    renderQueueBanner();
    updateBadges();
  }

  // ================= Oturum =================
  function logoutLocal() {
    S.token = null; S.user = null; store.del('token'); store.del('user');
    if (S.sse) { try { S.sse.close(); } catch (e) { /* yoksay */ } S.sse = null; }
    renderLogin();
  }
  async function startApp() {
    try {
      const st = await api('GET', '/api/status');
      S.company = st.company || S.company; store.set('company', S.company);
      if (st.needsSetup) return renderSetup();
    } catch (e) {
      if (!S.token) return renderOffline(e.message);
    }
    if (!S.token) return renderLogin();
    try {
      const me = await api('GET', '/api/me');
      S.user = me.user; S.company = me.company; store.set('user', S.user); store.set('company', S.company);
    } catch (e) {
      if (e.status === 401) return;
      if (!S.user) return renderOffline(e.message);
    }
    renderShell();
    try { await Promise.all([loadMeta(), loadProducts(true)]); checkAlerts(); updateBadges(); } catch (e) { /* çevrimdışı */ }
    connectSSE();
    flushQueue();
    rerender();
  }
  function renderOffline(msg) {
    $('#app').innerHTML = `<div class="auth"><div class="card auth-card"><div class="brand-lg"><img src="icon.svg" alt=""><div><h1>Depo Takip</h1><div class="muted small">Sunucuya bağlanılamadı</div></div></div>
      <p>${esc(msg)}</p><p class="muted small">Depo bilgisayarının açık olduğundan ve aynı Wi-Fi ağına bağlı olduğunuzdan emin olun.</p>
      <div class="row"><button class="btn primary" data-act="reload-app">Tekrar dene</button>${native && native.changeServer ? '<button class="btn" data-act="change-server">Sunucu adresini değiştir</button>' : ''}</div></div></div>`;
  }
  function renderLogin() {
    $('#app').innerHTML = `<div class="auth"><form class="card auth-card" id="login-form" autocomplete="on">
      <div class="brand-lg"><img src="icon.svg" alt=""><div><h1>${esc(S.company)}</h1><div class="muted small">Depo Takip Sistemi</div></div></div>
      <div class="stack">
        <label class="field"><span>Kullanıcı adı</span><input class="input" name="username" autocomplete="username" autocapitalize="none" required></label>
        <label class="field"><span>Şifre</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn primary lg block" type="submit">Giriş yap</button>
        ${native && native.changeServer ? `<div class="foot-note">Sunucu: ${esc(location.host)} · <a href="#" data-act="change-server">Değiştir</a></div>` : ''}
      </div></form></div>`;
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      setBusy(btn, true, 'Giriş yapılıyor…');
      try {
        const d = formData(e.target);
        const r = await api('POST', '/api/login', { ...d, device: native ? 'Android' : navigator.platform });
        S.token = r.token; S.user = r.user; store.set('token', r.token); store.set('user', r.user);
        startApp();
      } catch (err) { toast(err.message, 'err'); setBusy(btn, false); }
    });
  }
  function renderSetup() {
    $('#app').innerHTML = `<div class="auth"><form class="card auth-card" id="setup-form">
      <div class="brand-lg"><img src="icon.svg" alt=""><div><h1>İlk Kurulum</h1><div class="muted small">Yönetici hesabını oluşturun</div></div></div>
      <div class="stack">
        <label class="field"><span>Firma adı</span><input class="input" name="company" placeholder="Örn. Karapınar Su" required></label>
        <label class="field"><span>Ad Soyad</span><input class="input" name="fullName" required></label>
        <label class="field"><span>Kullanıcı adı</span><input class="input" name="username" value="admin" autocapitalize="none" required></label>
        <label class="field"><span>Şifre <em>(en az 4 karakter)</em></span><input class="input" name="password" type="password" required minlength="4"></label>
        <label class="field"><span>Şifre (tekrar)</span><input class="input" name="password2" type="password" required></label>
        <button class="btn primary lg block" type="submit">Kurulumu tamamla</button>
        <div class="foot-note">120 hammadde ve KYN kodları hazır olarak yüklendi. Diğer kullanıcıları kurulumdan sonra Ayarlar bölümünden ekleyebilirsiniz.</div>
      </div></form></div>`;
    $('#setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(e.target);
      if (d.password !== d.password2) return toast('Şifreler aynı değil', 'err');
      try {
        const r = await api('POST', '/api/setup', d);
        S.token = r.token; S.user = r.user; store.set('token', r.token); store.set('user', r.user);
        toast('Kurulum tamamlandı. Hoş geldiniz!', 'ok');
        startApp();
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  // ================= Ortak parçalar =================
  const statusBadge = (s) => `<span class="badge ${STATUS[s][1]}">${STATUS[s][0]}</span>`;
  const typeBadge = (t) => `<span class="badge ty-badge ty-${t}">${esc(TYPE_INFO[t] ? TYPE_INFO[t].short : t)}</span>`;
  function movementDesc(m) {
    const d = (x) => DEPOTS[x] || '';
    if (m.type === 'TRANSFER') return `${d(m.from_depot)} → ${d(m.to_depot)}`;
    if (m.type === 'SAYIM') return `${d(m.from_depot || m.to_depot)} · sayılan ${fmt(m.counted)}`;
    if (m.type === 'IPTAL') return `#${m.cancels_id} kaydının iptali`;
    return d(m.from_depot || m.to_depot);
  }
  function signedQty(m) {
    if (m.type === 'TRANSFER') return `<span class="num">${fmt(m.qty)}</span>`;
    const sign = m.to_depot && !m.from_depot ? '+' : '−';
    return `<span class="num delta ${sign === '+' ? 'up' : 'down'}">${sign}${fmt(m.qty)}</span>`;
  }
  function movementRows(rows, { showProduct = true, cancel = false } = {}) {
    if (!rows.length) return '<div class="empty">Kayıt bulunamadı</div>';
    const desk = `<div class="table-wrap hide-m"><table class="t"><thead><tr>
      <th>Tarih</th><th>İşlem</th>${showProduct ? '<th>Ürün</th>' : ''}<th>Depo</th><th class="n">Miktar</th><th>Belge / Açıklama</th><th>Kullanıcı</th>${cancel ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map((m) => `<tr class="${m.cancelled_by ? 'cancelled' : ''}">
        <td class="num" style="white-space:nowrap">${fmtDate(m.created_at)}</td>
        <td>${typeBadge(m.type)}</td>
        ${showProduct ? `<td><a href="#/urun/${m.product_id}" style="color:inherit;text-decoration:none"><div class="code">${esc(m.product_code)}</div>${esc(m.product_name)}</a></td>` : ''}
        <td class="small">${esc(movementDesc(m))}</td>
        <td class="n">${signedQty(m)} <span class="muted small">${esc(m.unit)}</span></td>
        <td class="small">${[m.doc_no && `<b>${esc(m.doc_no)}</b>`, m.supplier && esc(m.supplier), m.lot_no && 'Lot: ' + esc(m.lot_no), m.note && esc(m.note)].filter(Boolean).join(' · ')}${m.cancelled_by ? ' <span class="badge gray">iptal edildi</span>' : ''}</td>
        <td class="small">${esc(m.user_name || '')}</td>
        ${cancel ? `<td>${!m.cancelled_by && !m.cancels_id ? `<button class="btn sm ghost" data-act="cancel-mov" data-id="${m.id}" title="İptal et">${icon('IPTAL')}</button>` : ''}</td>` : ''}
      </tr>`).join('')}</tbody></table></div>`;
    const mob = `<div class="list hide-d">${rows.map((m) => `<div class="li ${m.cancelled_by ? 'muted' : ''}" ${cancel && !m.cancelled_by && !m.cancels_id ? `data-act="cancel-mov" data-id="${m.id}"` : ''}>
        <div class="grow">
          <div class="row" style="gap:6px">${typeBadge(m.type)}${m.cancelled_by ? '<span class="badge gray">iptal edildi</span>' : ''}<span class="sub">${fmtDate(m.created_at)}</span></div>
          ${showProduct ? `<div class="name" style="margin-top:3px">${esc(m.product_name)}</div>` : ''}
          <div class="sub">${esc(movementDesc(m))}${m.note ? ' · ' + esc(m.note) : ''}${m.doc_no ? ' · ' + esc(m.doc_no) : ''} · ${esc(m.user_name || '')}</div>
        </div>
        <div class="right qty">${signedQty(m)}<div class="sub">${esc(m.unit)}</div></div>
      </div>`).join('')}</div>`;
    return desk + mob;
  }
  function productMeter(p) {
    if (!(p.min_stock > 0)) return '';
    const ratio = Math.min(1, p.total / (p.min_stock * 2));
    const cls = p.status === 'NORMAL' ? '' : p.status === 'TRANSFER' ? 'warn' : 'danger';
    return `<div class="meter ${cls}" title="Asgari: ${fmt(p.min_stock)}"><i style="width:${Math.max(3, ratio * 100)}%"></i></div>`;
  }

  // ================= PANEL =================
  async function renderDashboard(main, c) {
    const alive = c.alive;
    setTitle('Panel');
    const d = await api('GET', '/api/dashboard');
    if (!alive()) return;
    const crit = d.counts.KRITIK + d.counts.TUKENDI;
    const todayTotal = Object.values(d.today).reduce((a, b) => a + b, 0);
    const qa = (t) => `<a class="card qa ty-${t}" href="#/islem/${t}"><span class="ic">${icon(t)}</span>${TYPE_INFO[t].label}</a>`;
    main.innerHTML = `
      <div class="page-head"><div class="grow"><h1>Merhaba, ${esc(S.user.fullName.split(' ')[0])}</h1><p>${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        <a class="btn" href="#/tara">${icon('scan')}QR Okut</a></div>
      ${can.admin() && d.noMinCount > 20 ? `<div class="banner info">${icon('alert')}<div class="grow"><b>${d.noMinCount} kalemde asgari stok seviyesi tanımlı değil.</b> Uyarıların çalışması için asgari seviyeleri ve açılış stoklarını Excel şablonuyla toplu girebilirsiniz.</div><a class="btn sm" href="#/ayarlar?tab=excel">Excel ile gir</a></div>` : ''}
      <div class="grid g4" style="margin-bottom:14px">
        <a class="card kpi brand" href="#/stoklar"><span class="label">Takip edilen kalem</span><span class="value">${d.productCount}</span><span class="hint">15 kategoride</span></a>
        <a class="card kpi ${crit ? 'danger' : 'ok'}" href="#/uyarilar"><span class="label">Kritik / tükenen</span><span class="value">${crit}</span><span class="hint">${crit ? 'Asgari seviyenin altında' : 'Asgari seviye altında kalem yok'}</span></a>
        <a class="card kpi ${d.counts.TRANSFER ? 'warn' : 'ok'}" href="#/uyarilar"><span class="label">Cep depoya transfer gerekli</span><span class="value">${d.counts.TRANSFER}</span><span class="hint">Ham depoda stok var</span></a>
        <a class="card kpi" href="#/hareketler"><span class="label">Bugünkü hareket</span><span class="value">${todayTotal}</span><span class="hint">${['GIRIS', 'URETIM', 'FIRE'].map((t) => `${TYPE_INFO[t].short} ${d.today[t] || 0}`).join(' · ')}</span></a>
      </div>
      ${can.move() ? `<div class="quick" style="margin-bottom:14px">${['GIRIS', 'TRANSFER', 'URETIM', 'FIRE', 'IADE'].map(qa).join('')}<a class="card qa" href="#/tara"><span class="ic" style="background:var(--brand);color:var(--brand-ink)">${icon('scan')}</span>QR Okut</a></div>` : ''}
      <div class="grid g2">
        <section class="card">
          <div class="card-head"><h2>Stok uyarıları</h2>${d.alerts.length ? `<a class="btn sm" href="#/uyarilar">Tümü (${d.alerts.length})</a>` : ''}</div>
          ${d.alerts.length ? `<div class="list">${d.alerts.slice(0, 8).map((p) => `<a class="li" href="#/urun/${p.id}">
            <div class="grow"><div class="name">${esc(p.name)}</div><div class="sub"><span class="mono">${esc(p.code)}</span> · Ham ${fmt(p.ham)} · Cep ${fmt(p.cep)} · Asgari ${fmt(p.min_stock)}</div></div>
            <div class="right">${statusBadge(p.status)}<div class="qty" style="margin-top:3px">${fmt(p.total)} <span class="muted small">${esc(p.unit)}</span></div></div></a>`).join('')}</div>`
            : `<div class="empty">${icon('SAYIM', '')}<div>Tüm kalemler asgari seviyenin üzerinde.</div></div>`}
        </section>
        <section class="card">
          <div class="card-head"><h2>Son hareketler</h2><a class="btn sm" href="#/hareketler">Tümü</a></div>
          <div class="list">${d.recent.length ? d.recent.map((m) => `<a class="li" href="#/urun/${m.product_id}">
            <div class="grow"><div class="row" style="gap:6px">${typeBadge(m.type)}<span class="sub">${ago(m.created_at)} · ${esc(m.user_name || '')}</span></div>
            <div class="name" style="margin-top:3px">${esc(m.product_name)}</div><div class="sub">${esc(movementDesc(m))}</div></div>
            <div class="right qty">${signedQty(m)}<div class="sub">${esc(m.unit)}</div></div></a>`).join('') : '<div class="empty">Henüz hareket yok. İlk giriş için “Depo Girişi”ni kullanın.</div>'}</div>
        </section>
      </div>`;
  }

  // ================= STOKLAR =================
  async function renderStock(main, c) {
    const q = c.q, soft = c.soft;
    setTitle('Stoklar');
    await Promise.all([loadMeta(), loadProducts(!soft)]);
    const st = S.stockFilter || (S.stockFilter = { q: '', cat: '', only: '' });
    if (q && q.durum) st.only = q.durum;
    if (!soft) {
      main.innerHTML = `
      <div class="page-head"><div class="grow"><h1>Stoklar</h1><p>Ham Depo ve Cep Depo anlık stok durumu</p></div>
        <button class="btn" data-act="export" data-kind="stock">${icon('excel')}Excel'e aktar</button>
        ${can.admin() ? `<button class="btn primary" data-act="new-product">${icon('plus')}Yeni hammadde</button>` : ''}</div>
      <div class="card card-pad" style="margin-bottom:12px"><div class="stack">
        <div class="row"><div class="input-group" style="flex:1;min-width:220px"><input class="input" id="st-q" placeholder="Ad veya KYN kodu ile ara…" value="${esc(st.q)}"><span class="addon">${icon('search')}</span></div>
          <select class="input" id="st-cat" style="width:auto;min-width:200px"><option value="">Tüm kategoriler</option>${S.meta.categories.map((c) => `<option value="${c.id}" ${String(c.id) === st.cat ? 'selected' : ''}>${esc(c.name)} (${c.code})</option>`).join('')}</select></div>
        <div class="chips" id="st-only">${[['', 'Tümü'], ['uyari', 'Uyarılı'], ['TRANSFER', 'Transfer gerekli'], ['KRITIK', 'Kritik / tükenen'], ['bos', 'Stoğu olmayan'], ['minyok', 'Asgari tanımsız']].map(([k, l]) => `<button class="chip ${st.only === k ? 'on' : ''}" data-only="${k}">${l}</button>`).join('')}</div>
      </div></div>
      <div class="card" id="st-res"></div>`;
      const qi = $('#st-q', main);
      qi.addEventListener('input', () => { st.q = qi.value; drawStock(); });
      $('#st-cat', main).addEventListener('change', (e) => { st.cat = e.target.value; drawStock(); });
      $('#st-only', main).addEventListener('click', (e) => {
        const b = e.target.closest('[data-only]'); if (!b) return;
        st.only = b.dataset.only; $$('#st-only .chip').forEach((c) => c.classList.toggle('on', c === b)); drawStock();
      });
    }
    drawStock();
  }
  function drawStock() {
    const st = S.stockFilter;
    const el = $('#st-res');
    if (!el) return;
    const fq = fold(st.q);
    let list = S.products.filter((p) => (!st.cat || String(p.category_id) === st.cat) && (!fq || fold(p.name + ' ' + p.code).includes(fq)));
    if (st.only === 'uyari') list = list.filter((p) => p.status !== 'NORMAL');
    else if (st.only === 'TRANSFER') list = list.filter((p) => p.status === 'TRANSFER');
    else if (st.only === 'KRITIK') list = list.filter((p) => p.status === 'KRITIK' || p.status === 'TUKENDI');
    else if (st.only === 'bos') list = list.filter((p) => p.total <= 0);
    else if (st.only === 'minyok') list = list.filter((p) => !(p.min_stock > 0));
    if (!list.length) { el.innerHTML = '<div class="empty">Eşleşen hammadde yok</div>'; return; }
    el.innerHTML = `<div class="card-head"><h2 class="small muted" style="font-weight:600">${list.length} kalem</h2></div>
    <div class="table-wrap hide-m"><table class="t"><thead><tr><th>KYN Kodu</th><th>Hammadde</th><th class="n">Ham Depo</th><th class="n">Cep Depo</th><th class="n">Toplam</th><th class="n">Asgari</th><th>Durum</th><th class="n">Yeterlilik</th></tr></thead><tbody>
    ${list.map((p) => `<tr class="click" data-href="#/urun/${p.id}">
      <td class="code">${esc(p.code)}</td>
      <td><div style="font-weight:600">${esc(p.name)}</div><div class="small muted">${esc(p.cat_name)}</div></td>
      <td class="n num">${fmt(p.ham)}</td><td class="n num">${fmt(p.cep)}</td>
      <td class="n"><b class="num">${fmt(p.total)}</b> <span class="muted small">${esc(p.unit)}</span></td>
      <td class="n num muted">${p.min_stock > 0 ? fmt(p.min_stock) : '—'}</td>
      <td>${statusBadge(p.status)}</td>
      <td class="n small">${p.days_left !== null ? `<span class="${p.days_left < 7 ? 'delta down' : ''}">${p.days_left} gün</span>` : '<span class="muted">—</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="list hide-d">${list.map((p) => `<a class="li" href="#/urun/${p.id}">
      <div class="grow"><div class="name">${esc(p.name)}</div><div class="sub"><span class="mono">${esc(p.code)}</span> · Ham ${fmt(p.ham)} · Cep ${fmt(p.cep)}</div>${productMeter(p)}</div>
      <div class="right"><div class="qty">${fmt(p.total)} <span class="muted small">${esc(p.unit)}</span></div>${p.status !== 'NORMAL' ? statusBadge(p.status) : ''}</div></a>`).join('')}</div>`;
  }

  async function renderAlerts(main, c) {
    const soft = c.soft, alive = c.alive;
    setTitle('Stok Uyarıları');
    await loadProducts(!soft);
    if (!alive()) return;
    const list = S.products.filter((p) => p.status !== 'NORMAL');
    const order = { TUKENDI: 0, KRITIK: 1, TRANSFER: 2 };
    list.sort((a, b) => order[a.status] - order[b.status] || (a.days_left ?? 1e9) - (b.days_left ?? 1e9));
    main.innerHTML = `<div class="page-head"><div class="grow"><h1>Stok Uyarıları</h1><p>Asgari seviyenin altına inen veya Cep Depo'da azalan kalemler</p></div>
      ${'Notification' in window && !native && Notification.permission === 'default' ? `<button class="btn" data-act="notif-perm">${icon('bell')}Masaüstü bildirimlerini aç</button>` : ''}
      <button class="btn" data-act="export" data-kind="alerts">${icon('excel')}Excel'e aktar</button></div>
      <div class="card">${list.length ? `<div class="list">${list.map((p) => `<div class="li">
        <a class="grow" href="#/urun/${p.id}" style="color:inherit;text-decoration:none"><div class="row" style="gap:8px">${statusBadge(p.status)}<span class="name">${esc(p.name)}</span></div>
          <div class="sub" style="margin-top:3px"><span class="mono">${esc(p.code)}</span> · Ham <b>${fmt(p.ham)}</b> · Cep <b>${fmt(p.cep)}</b> · Toplam <b>${fmt(p.total)}</b> ${esc(p.unit)} · Asgari ${fmt(p.min_stock)}${p.cep_min ? ' · Cep asgari ' + fmt(p.cep_min) : ''}${p.days_left !== null ? ` · ≈${p.days_left} gün yeter` : ''}</div></a>
        <div class="right row" style="gap:6px">${can.move() ? (p.status === 'TRANSFER'
          ? `<a class="btn sm" href="#/islem/TRANSFER?p=${p.id}">${icon('TRANSFER')}Transfer</a>`
          : `<a class="btn sm" href="#/islem/GIRIS?p=${p.id}">${icon('GIRIS')}Giriş</a>`) : ''}</div></div>`).join('')}</div>`
        : '<div class="empty">Uyarı yok. Tüm kalemler asgari seviyenin üzerinde.</div>'}</div>
      <p class="foot-note" style="margin-top:12px"><b>Kritik:</b> iki deponun toplamı asgari stok seviyesine eşit veya altında. <b>Transfer gerekli:</b> Cep Depo, cep asgari seviyesinin altında ama Ham Depo'da stok var. Asgari seviyeler ürün sayfasından veya Excel şablonuyla girilir.</p>`;
  }

  // ================= ÜRÜN DETAYI =================
  async function renderProduct(main, c) {
    const id = c.p[0], alive = c.alive;
    const d = await api('GET', '/api/products/' + id);
    if (!alive()) return;
    const p = d.product;
    setTitle(p.name);
    const qr = window.QR.toSvg(p.code, { ecl: 'M' });
    const act = (t) => `<a class="btn ty-${t}" href="#/islem/${t}?p=${p.id}" style="color:var(--c)">${icon(t)}${TYPE_INFO[t].short}</a>`;
    main.innerHTML = `
      <div class="page-head"><div class="grow"><a href="#/stoklar" class="small" style="text-decoration:none">← Stoklar</a></div>
        <button class="btn" data-act="print-one" data-id="${p.id}">${icon('print')}Etiket yazdır</button>
        ${can.admin() ? `<button class="btn" data-act="edit-product" data-id="${p.id}">${icon('edit')}Düzenle</button>` : ''}</div>
      <section class="card card-pad" style="margin-bottom:14px">
        <div class="prod-head">
          <div style="flex:1;min-width:0" class="stack">
            <div><div class="row" style="gap:8px"><span class="badge brand mono">${esc(p.code)}</span>${statusBadge(p.status)}${p.active ? '' : '<span class="badge gray">Pasif</span>'}</div>
              <h1 style="margin-top:8px">${esc(p.name)}</h1>
              <div class="muted small" style="margin-top:3px">${esc(p.cat_name)} · Birim: ${esc(p.unit)}${p.supplier ? ' · Tedarikçi: ' + esc(p.supplier) : ''}</div></div>
            <div class="stock-trio">
              <div class="stock-box"><div class="label">Ham Depo</div><div class="value">${fmt(p.ham)}<small>${esc(p.unit)}</small></div></div>
              <div class="stock-box"><div class="label">Cep Depo</div><div class="value">${fmt(p.cep)}<small>${esc(p.unit)}</small></div>${p.cep_min ? `<div class="small muted">Cep asgari ${fmt(p.cep_min)}</div>` : ''}</div>
              <div class="stock-box total"><div class="label">Toplam</div><div class="value">${fmt(p.total)}<small>${esc(p.unit)}</small></div>${p.min_stock ? `<div class="small muted">Asgari ${fmt(p.min_stock)}</div>` : ''}</div>
            </div>
            ${productMeter(p)}
            <div class="small muted">Son 30 gün günlük ortalama tüketim: <b>${fmt(Math.round(p.daily_use * 10) / 10)}</b> ${esc(p.unit)}${p.days_left !== null ? ` · Mevcut stok yaklaşık <b>${p.days_left} gün</b> yeter` : ''}</div>
          </div>
          <div class="qr-box">${qr}</div>
        </div>
        ${can.move() && p.active ? `<div class="divider"></div><div class="row">${['GIRIS', 'TRANSFER', 'URETIM', 'FIRE', 'IADE'].map(act).join('')}${can.admin() ? act('SAYIM') : ''}</div>` : ''}
        ${p.note ? `<div class="divider"></div><div class="small"><b>Not:</b> ${esc(p.note)}</div>` : ''}
      </section>
      <section class="card" style="margin-bottom:14px">
        <div class="card-head"><h2>Hareket geçmişi</h2><a class="btn sm" href="#/hareketler?productId=${p.id}">Tümü ve filtreler</a></div>
        ${movementRows(d.movements, { showProduct: false, cancel: can.admin() })}
      </section>
      ${d.log.length ? `<section class="card"><div class="card-head"><h2>Kart değişiklikleri</h2></div><div class="list">${d.log.map((l) => {
        let det = ''; try { const o = JSON.parse(l.details || '{}'); det = Object.entries(o).map(([k, v]) => (v && typeof v === 'object' && 'sonra' in v ? `${fieldTr(k)}: ${fmtv(v.once)} → ${fmtv(v.sonra)}` : `${fieldTr(k)}: ${fmtv(v)}`)).join(' · '); } catch (e) { det = l.details; }
        return `<div class="li"><div class="grow"><div class="name small">${esc({ OLUSTURULDU: 'Kart oluşturuldu', GUNCELLENDI: 'Kart güncellendi', EXCEL_GUNCELLEME: 'Excel ile güncellendi' }[l.action] || l.action)}</div><div class="sub">${esc(det)}</div></div><div class="right sub">${fmtDate(l.created_at)}<br>${esc(l.user_name || 'Sistem')}</div></div>`;
      }).join('')}</div></section>` : ''}`;
  }
  const fieldTr = (k) => ({ name: 'Ad', unit: 'Birim', min_stock: 'Asgari stok', cep_min: 'Cep asgari', supplier: 'Tedarikçi', note: 'Not', active: 'Aktif', code: 'Kod' }[k] || k);
  const fmtv = (v) => (typeof v === 'number' ? fmt(v) : v === '' || v === null ? '(boş)' : String(v));

  function productModal(p) {
    const isNew = !p;
    const cats = S.meta.categories;
    const units = S.meta.units;
    modal({
      title: isNew ? 'Yeni hammadde' : 'Hammadde kartını düzenle',
      body: `<form id="pf" class="form-grid">
        ${isNew ? `<label class="field full"><span>Kategori</span><select class="input" name="categoryId" required>${cats.map((c) => `<option value="${c.id}" data-unit="${esc(c.unit)}">${esc(c.name)} (${c.code})</option>`).join('')}</select></label>`
          : `<div class="full"><span class="badge brand mono">${esc(p.code)}</span> <span class="muted small">KYN kodu kalıcıdır, değiştirilemez.</span></div>`}
        <label class="field full"><span>Hammadde adı</span><input class="input" name="name" value="${esc(p ? p.name : '')}" required></label>
        <label class="field"><span>Birim</span><input class="input" name="unit" list="units" value="${esc(p ? p.unit : cats[0].unit)}" required><datalist id="units">${units.map((u) => `<option value="${esc(u)}">`).join('')}</datalist></label>
        <label class="field"><span>Tedarikçi <em>(isteğe bağlı)</em></span><input class="input" name="supplier" value="${esc(p ? p.supplier : '')}"></label>
        <label class="field"><span>Asgari stok <em>(toplam)</em></span><input class="input" name="minStock" inputmode="decimal" value="${p && p.min_stock ? String(p.min_stock).replace('.', ',') : ''}" placeholder="0"></label>
        <label class="field"><span>Cep Depo asgari <em>(isteğe bağlı)</em></span><input class="input" name="cepMin" inputmode="decimal" value="${p && p.cep_min ? String(p.cep_min).replace('.', ',') : ''}" placeholder="0"></label>
        <label class="field full"><span>Not</span><textarea class="input" name="note">${esc(p ? p.note : '')}</textarea></label>
        ${!isNew ? `<label class="check full"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Aktif (pasif kalemler listelerde görünmez, hareket girilemez)</label>` : ''}
      </form>`,
      foot: `${!isNew ? '<button class="btn ghost" data-del style="margin-right:auto;color:var(--danger)">Sil</button>' : ''}<button class="btn" data-close>Vazgeç</button><button class="btn primary" data-save>Kaydet</button>`,
      onMount: (el, close) => {
        const f = $('#pf', el);
        if (isNew) {
          const sel = f.categoryId;
          sel.addEventListener('change', () => { f.unit.value = sel.selectedOptions[0].dataset.unit; });
        }
        el.querySelector('[data-save]').addEventListener('click', async (e) => {
          if (!f.reportValidity()) return;
          const d = formData(f);
          d.minStock = d.minStock ? parseNum(d.minStock) : 0;
          d.cepMin = d.cepMin ? parseNum(d.cepMin) : 0;
          if (isNaN(d.minStock) || isNaN(d.cepMin)) return toast('Asgari seviye geçerli bir sayı olmalı', 'err');
          setBusy(e.target, true);
          try {
            const r = isNew ? await api('POST', '/api/products', { ...d, categoryId: Number(d.categoryId) }) : await api('PUT', '/api/products/' + p.id, d);
            close();
            toast(isNew ? `${r.code} koduyla oluşturuldu` : 'Kaydedildi', 'ok');
            await loadProducts(true);
            go('/urun/' + r.id);
          } catch (err) { toast(err.message, 'err'); setBusy(e.target, false); }
        });
        const del = el.querySelector('[data-del]');
        if (del) del.addEventListener('click', async () => {
          close();
          if (!(await confirmBox('Hammaddeyi sil', `<b>${esc(p.name)}</b> silinsin mi? Hareket geçmişi olan kalemler silinemez; bunun yerine pasif yapın.`, 'Sil', true))) return;
          try { await api('DELETE', '/api/products/' + p.id); toast('Silindi', 'ok'); await loadProducts(true); go('/stoklar'); } catch (err) { toast(err.message, 'err'); }
        });
      },
    });
  }

  // ================= İŞLEM FORMU =================
  const formState = { type: 'GIRIS', product: null, lines: [], header: {} };
  async function renderMovementForm(main, c) {
    let type = c.p[0];
    const q = c.q;
    if (!can.move()) { main.innerHTML = '<div class="empty">Stok hareketi girme yetkiniz yok.</div>'; return; }
    type = (type || 'GIRIS').toUpperCase();
    if (!TYPE_INFO[type] || type === 'IPTAL') type = 'GIRIS';
    if (type === 'SAYIM' && !can.admin()) { toast('Sayım düzeltmesini yalnızca yönetici yapabilir', 'err'); type = 'GIRIS'; }
    await Promise.all([loadMeta(), loadProducts()]);
    if (formState.type !== type) { formState.lines = []; formState.header = {}; }
    formState.type = type;
    if (q && q.p) formState.product = findProduct(q.p) || formState.product;
    if (formState.product && !findProduct(formState.product.id)) formState.product = null;
    if (formState.product) formState.product = findProduct(formState.product.id);
    setTitle(TYPE_INFO[type].label);
    const types = ['GIRIS', 'TRANSFER', 'URETIM', 'FIRE', 'IADE'].concat(can.admin() ? ['SAYIM'] : []);
    const h = formState.header;
    const depotSel = (name, val, label) => `<label class="field"><span>${label}</span><select class="input" name="${name}">${Object.entries(DEPOTS).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
    let depotFields = '';
    if (type === 'GIRIS') depotFields = depotSel('to', h.to || 'HAM', 'Giriş yapılan depo');
    else if (type === 'IADE') depotFields = depotSel('to', h.to || 'CEP', 'İade alınan depo');
    else if (type === 'URETIM' || type === 'FIRE') depotFields = depotSel('from', h.from || 'CEP', 'Çıkış yapılan depo');
    else if (type === 'SAYIM') depotFields = depotSel('depot', h.depot || 'HAM', 'Sayılan depo');
    else if (type === 'TRANSFER') depotFields = `<div class="depot-flow full">${depotSel('from', h.from || 'HAM', 'Kaynak depo')}<button type="button" class="btn swap" data-act="swap-depot" title="Yer değiştir">${icon('swap')}</button>${depotSel('to', h.to || 'CEP', 'Hedef depo')}</div>`;
    const typeHints = {
      GIRIS: 'Tedarikçiden gelen hammaddeyi depoya alın. Aynı irsaliyedeki birden çok kalemi listeye ekleyip tek seferde kaydedebilirsiniz.',
      TRANSFER: 'Ham Depo ile Cep Depo arasında malzeme taşıyın. Toplam stok değişmez.',
      URETIM: 'Üretim hattına verilen hammaddeyi düşün. Varsayılan olarak Cep Depo\'dan çıkış yapılır.',
      FIRE: 'Kullanılamaz hale gelen malzemeyi nedeniyle birlikte kaydedin.',
      IADE: 'Üretimde kullanılmayıp geri gelen malzemeyi depoya alın.',
      SAYIM: 'Depoda fiilen saydığınız miktarı girin. Sistem farkı otomatik düzeltme kaydı olarak işler.',
    };
    main.innerHTML = `
      <div class="type-tabs">${types.map((t) => `<a href="#/islem/${t}" class="ty-${t} ${t === type ? 'on' : ''}">${icon(t)}<span>${TYPE_INFO[t].short}</span></a>`).join('')}</div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr);max-width:880px">
        <section class="card">
          <div class="card-head ty-${type}"><span class="badge ty-badge" style="padding:6px">${icon(type)}</span><h2>${TYPE_INFO[type].label}</h2></div>
          <div class="card-pad stack">
            <p class="muted small" style="margin:0">${typeHints[type]}</p>
            <form id="mv" class="form-grid" autocomplete="off">
              <div class="full field"><span>Hammadde</span><div id="picker-slot"></div></div>
              ${type === 'SAYIM'
                ? `<label class="field"><span>Sayılan miktar</span><div class="input-group"><input class="input big" name="counted" inputmode="decimal" placeholder="0"><span class="addon" data-unit>—</span></div></label><div class="field"><span>Fark</span><div id="sayim-delta" class="input big" style="display:flex;align-items:center;background:var(--surface-2)">—</div></div>`
                : `<label class="field"><span>Miktar</span><div class="input-group"><input class="input big" name="qty" inputmode="decimal" placeholder="0"><span class="addon" data-unit>—</span></div></label>`}
              ${type !== 'TRANSFER' ? depotFields : ''}
              ${type === 'TRANSFER' ? depotFields : ''}
              ${type === 'GIRIS' ? `
                <label class="field"><span>İrsaliye / belge no</span><input class="input" name="docNo" value="${esc(h.docNo || '')}"></label>
                <label class="field"><span>Tedarikçi</span><input class="input" name="supplier" list="sup-list" value="${esc(h.supplier || '')}"><datalist id="sup-list">${[...new Set(S.products.map((p) => p.supplier).filter(Boolean))].map((s) => `<option value="${esc(s)}">`).join('')}</datalist></label>
                <label class="field"><span>Parti / lot no <em>(isteğe bağlı)</em></span><input class="input" name="lotNo"></label>` : ''}
              <label class="field ${type === 'GIRIS' ? '' : 'full'}"><span>${type === 'FIRE' ? 'Fire nedeni' : 'Açıklama'} ${type === 'FIRE' ? '' : '<em>(isteğe bağlı)</em>'}</span>
                <input class="input" name="note" placeholder="${type === 'URETIM' ? 'Örn. Hat 2, sabah vardiyası' : type === 'SAYIM' ? 'Örn. Ay sonu sayımı' : ''}">
                ${type === 'FIRE' ? `<div class="chips reason-chips">${FIRE_REASONS.map((r) => `<button type="button" class="chip" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}</label>
            </form>
          </div>
          <div class="sticky-actions">
            <button class="btn" data-act="add-line">${icon('plus')}Listeye ekle</button>
            <span class="spacer"></span>
            <button class="btn primary lg" data-act="save-mv">${icon(type)}<span id="save-label">${TYPE_INFO[type].verb}</span></button>
          </div>
        </section>
        <section class="card ${formState.lines.length ? '' : 'hidden'}" id="lines-card">
          <div class="card-head"><h2>Kaydedilecek liste</h2><button class="btn sm ghost" data-act="clear-lines">Temizle</button></div>
          <div class="lines" id="lines"></div>
        </section>
      </div>`;
    mountPicker($('#picker-slot', main), (p) => { formState.product = p; onProductPicked(); });
    const f = $('#mv', main);
    f.addEventListener('input', (e) => {
      if (['to', 'from', 'depot', 'docNo', 'supplier'].includes(e.target.name)) formState.header[e.target.name] = e.target.value;
      if (e.target.name === 'counted' || e.target.name === 'depot') updateSayimDelta();
    });
    f.addEventListener('change', (e) => {
      if (['to', 'from', 'depot'].includes(e.target.name)) { formState.header[e.target.name] = e.target.value; onProductPicked(true); }
    });
    f.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.closest('.picker')) { e.preventDefault(); $('[data-act=save-mv]').click(); }
    });
    if (type === 'FIRE') $$('[data-reason]', f).forEach((b) => b.addEventListener('click', () => { f.note.value = b.dataset.reason; $$('[data-reason]', f).forEach((x) => x.classList.toggle('on', x === b)); }));
    onProductPicked();
    drawLines();
  }
  function refreshSelectedProduct() {
    if (formState.product) { formState.product = findProduct(formState.product.id) || formState.product; onProductPicked(true); }
  }
  function onProductPicked(keepFocus) {
    const p = formState.product;
    const slot = $('#picker-slot');
    if (!slot) return;
    const sel = $('.sel-prod', slot);
    const pick = $('.picker', slot);
    $$('[data-unit]').forEach((u) => { u.textContent = p ? p.unit : '—'; });
    if (!p) { sel && sel.remove(); pick.classList.remove('hidden'); return; }
    pick.classList.add('hidden');
    const html = `<div class="sel-prod"><div class="grow"><div class="nm">${esc(p.name)}</div>
      <div class="avail"><span class="mono">${esc(p.code)}</span><span>Ham: <b>${fmt(p.ham)}</b></span><span>Cep: <b>${fmt(p.cep)}</b></span><span>${esc(p.unit)}</span>${p.status !== 'NORMAL' ? statusBadge(p.status) : ''}</div></div>
      <button type="button" class="btn sm" data-act="clear-product">Değiştir</button></div>`;
    if (sel) sel.outerHTML = html; else slot.insertAdjacentHTML('beforeend', html);
    updateSayimDelta();
    updateSaveLabel();
    if (!keepFocus) { const q = $('#mv [name=qty], #mv [name=counted]'); if (q) { const ae = document.activeElement; if (!ae || ae === document.body || ae.closest('.picker') || ae.closest('.sel-prod')) q.focus(); } }
  }
  function updateSayimDelta() {
    const el = $('#sayim-delta');
    if (!el) return;
    const p = formState.product;
    const f = $('#mv');
    const c = parseNum(f.counted.value);
    if (!p || isNaN(c)) { el.innerHTML = '—'; return; }
    const cur = f.depot.value === 'HAM' ? p.ham : p.cep;
    const d = Math.round((c - cur) * 1e6) / 1e6;
    el.innerHTML = `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${fmt(d)}</span><span class="muted small" style="margin-left:8px">(sistem: ${fmt(cur)})</span>`;
  }
  function readLine() {
    const f = $('#mv');
    const p = formState.product;
    const t = formState.type;
    if (!p) { toast('Önce hammadde seçin veya QR okutun', 'err'); $('#picker-slot input') && $('#picker-slot input').focus(); return null; }
    const line = { uuid: uuid(), type: t, productId: p.id, _name: p.name, _code: p.code, _unit: p.unit, note: f.note.value.trim() };
    if (t === 'SAYIM') {
      const c = parseNum(f.counted.value);
      if (isNaN(c) || c < 0) { toast('Sayılan miktarı girin', 'err'); f.counted.focus(); return null; }
      line.counted = c; line.depot = f.depot.value;
    } else {
      const q = parseNum(f.qty.value);
      if (isNaN(q) || q <= 0) { toast('Geçerli bir miktar girin', 'err'); f.qty.focus(); return null; }
      if (p.unit === 'adet' && !Number.isInteger(q)) { toast('Adet ile takip edilen kalemde küsurat olamaz', 'err'); return null; }
      line.qty = q;
      if (f.from) line.from = f.from.value;
      if (f.to) line.to = f.to.value;
      const src = line.from;
      if (src) {
        const avail = (src === 'HAM' ? p.ham : p.cep) - formState.lines.filter((l) => l.productId === p.id && l.from === src).reduce((a, l) => a + l.qty, 0);
        if (q > avail + 1e-9) { toast(`${DEPOTS[src]} mevcudu yetersiz: ${fmt(avail)} ${p.unit}`, 'err'); return null; }
      }
    }
    if (t === 'FIRE' && !line.note) { toast('Fire nedenini yazın veya seçin', 'err'); f.note.focus(); return null; }
    if (t === 'GIRIS') { line.docNo = f.docNo.value.trim(); line.supplier = f.supplier.value.trim(); line.lotNo = f.lotNo.value.trim(); }
    return line;
  }
  function resetLineInputs() {
    const f = $('#mv');
    formState.product = null;
    if (f.qty) f.qty.value = '';
    if (f.counted) f.counted.value = '';
    if (formState.type !== 'GIRIS' && formState.type !== 'URETIM') f.note.value = '';
    if (f.lotNo) f.lotNo.value = '';
    $$('[data-reason]').forEach((x) => x.classList.remove('on'));
    onProductPicked();
    const pi = $('#picker-slot input'); if (pi) { pi.value = ''; if (matchMedia('(pointer:fine)').matches) pi.focus(); }
  }
  function drawLines() {
    const card = $('#lines-card');
    if (!card) return;
    card.classList.toggle('hidden', !formState.lines.length);
    $('#lines').innerHTML = formState.lines.map((l, i) => `<div class="line"><span class="muted small" style="width:20px">${i + 1}</span>
      <div class="grow" style="flex:1;min-width:0"><div style="font-weight:600">${esc(l._name)}</div><div class="small muted"><span class="mono">${esc(l._code)}</span>${l.from ? ' · ' + DEPOTS[l.from] : ''}${l.to ? ' → ' + DEPOTS[l.to] : ''}${l.depot ? ' · ' + DEPOTS[l.depot] : ''}${l.note ? ' · ' + esc(l.note) : ''}</div></div>
      <b class="num">${l.type === 'SAYIM' ? 'Sayılan ' + fmt(l.counted) : fmt(l.qty)}</b> <span class="muted small">${esc(l._unit)}</span>
      <button class="btn sm ghost" data-act="del-line" data-i="${i}" aria-label="Sil">${icon('x')}</button></div>`).join('');
    updateSaveLabel();
  }
  function updateSaveLabel() {
    const lab = $('#save-label');
    if (lab) lab.textContent = formState.lines.length ? `${formState.lines.length + (formState.product ? 1 : 0)} satırı kaydet` : TYPE_INFO[formState.type].verb;
  }
  async function saveMovements(btn) {
    let items = formState.lines.slice();
    const f = $('#mv');
    const hasInput = formState.product && ((f.qty && f.qty.value) || (f.counted && f.counted.value));
    if (hasInput) { const l = readLine(); if (!l) return; items.push(l); }
    else if (!items.length) { readLine(); return; }
    // GIRIS için ortak irsaliye/tedarikçi bilgisini tüm satırlara uygula
    if (formState.type === 'GIRIS') items = items.map((l) => ({ ...l, docNo: l.docNo || f.docNo.value.trim(), supplier: l.supplier || f.supplier.value.trim() }));
    const payload = items.map(({ _name, _code, _unit, ...rest }) => rest);
    setBusy(btn, true);
    try {
      const r = await api('POST', '/api/movements', { items: payload });
      beep(true);
      toast(`${payload.length} satır kaydedildi`, 'ok', TYPE_INFO[formState.type].label);
      formState.lines = [];
      r.products.forEach((np) => { const i = S.products.findIndex((x) => x.id === np.id); if (i >= 0) S.products[i] = { ...S.products[i], ...np }; });
      checkAlerts(); updateBadges();
      resetLineInputs();
      drawLines();
    } catch (e) {
      if (e.status === 0) {
        // Çevrimdışı: kuyruğa al
        S.queue.push(...payload);
        saveQueue();
        toast(`Bağlantı yok. ${payload.length} satır cihazda bekletiliyor; bağlantı gelince otomatik gönderilecek.`, 'warn');
        formState.lines = []; resetLineInputs(); drawLines();
      } else { beep(false); toast(e.message, 'err', 'Kaydedilemedi'); }
    } finally { setBusy(btn, false); }
  }

  // Ürün seçici (arama + QR)
  function mountPicker(slot, onPick) {
    slot.innerHTML = `<div class="picker"><div class="row" style="flex-wrap:nowrap">
      <div class="input-group" style="flex:1"><input class="input" placeholder="Ad veya kod yazın ya da barkod okuyucuyla okutun" data-picker-input><span class="addon">${icon('search')}</span></div>
      <button type="button" class="btn" data-act="picker-scan" title="QR okut">${icon('scan')}<span class="hide-m">QR</span></button></div>
      <div class="picker-list hidden"></div></div>`;
    const inp = $('[data-picker-input]', slot);
    const list = $('.picker-list', slot);
    let hits = [], hl = 0;
    const draw = () => {
      const fq = fold(inp.value);
      if (!fq) { list.classList.add('hidden'); return; }
      const exact = S.products.find((p) => p.code.toUpperCase() === inp.value.trim().toUpperCase());
      hits = exact ? [exact] : S.products.filter((p) => fold(p.name + ' ' + p.code).includes(fq)).slice(0, 30);
      hl = 0;
      list.innerHTML = hits.length ? hits.map((p, i) => `<button type="button" data-i="${i}" class="${i === hl ? 'hl' : ''}"><span class="code">${esc(p.code)}</span><span style="flex:1">${esc(p.name)}</span><span class="small muted num">${fmt(p.total)} ${esc(p.unit)}</span></button>`).join('') : '<div class="empty">Bulunamadı</div>';
      list.classList.remove('hidden');
    };
    const choose = (p) => { inp.value = ''; list.classList.add('hidden'); onPick(p); };
    inp.addEventListener('input', draw);
    inp.addEventListener('focus', draw);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, hits.length - 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (hits[hl]) choose(hits[hl]); return; }
      else if (e.key === 'Escape') { list.classList.add('hidden'); return; }
      else return;
      $$('button', list).forEach((b, i) => b.classList.toggle('hl', i === hl));
    });
    list.addEventListener('mousedown', (e) => { const b = e.target.closest('button[data-i]'); if (b) { e.preventDefault(); choose(hits[+b.dataset.i]); } });
    document.addEventListener('click', (e) => { if (!slot.contains(e.target)) list.classList.add('hidden'); });
    slot._choose = choose;
  }

  // ================= QR OKUTMA =================
  let scanResolve = null;
  window.__onNativeScan = (text) => { if (scanResolve) { const r = scanResolve; scanResolve = null; r(text); } };
  window.__onNativeScanCancel = () => { if (scanResolve) { const r = scanResolve; scanResolve = null; r(null); } };
  function cameraAvailable() { return !!(native && native.scanQR) || ('BarcodeDetector' in window && window.isSecureContext && navigator.mediaDevices); }
  function scanQR() {
    if (native && native.scanQR) {
      return new Promise((resolve) => { scanResolve = resolve; native.scanQR(); });
    }
    if ('BarcodeDetector' in window && window.isSecureContext && navigator.mediaDevices) return scanWithBrowser();
    return Promise.resolve(promptCode());
  }
  function promptCode() {
    toast('Bu cihazda kamera ile okutma yok. Kodu yazın veya USB/Bluetooth barkod okuyucu kullanın.', 'warn');
    return null;
  }
  function scanWithBrowser() {
    return new Promise(async (resolve) => {
      let stream, stop = false, done = false;
      const m = modal({
        title: 'QR okut', body: '<div class="cam"><video playsinline muted></video><div class="frame"></div></div><p class="muted small" style="text-align:center">QR kodu çerçevenin içine getirin</p>',
        onMount: () => {},
      });
      const finish = (v) => {
        if (done) return; done = true; stop = true;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        m.close(); resolve(v);
      };
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); finish(null); } });
      obs.observe($('#modal-root'), { childList: true });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = $('video', m.el); v.srcObject = stream; await v.play();
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stop) return;
          try { const r = await det.detect(v); if (r.length) return finish(r[0].rawValue); } catch (e) { /* yoksay */ }
          requestAnimationFrame(tick);
        };
        tick();
      } catch (e) { toast('Kamera açılamadı: ' + e.message, 'err'); finish(null); }
    });
  }
  function codeFromScan(text) {
    if (!text) return null;
    const t = String(text).trim();
    const m = t.match(/KYN-[A-Z]{2,4}-\d{3,}/i);
    return m ? m[0].toUpperCase() : t;
  }
  async function lookupCode(raw) {
    const code = codeFromScan(raw);
    if (!code) return null;
    let p = S.products.find((x) => x.code.toUpperCase() === code.toUpperCase());
    if (!p) {
      try { p = await api('GET', '/api/products/code/' + encodeURIComponent(code)); } catch (e) { p = null; }
    }
    if (!p) { beep(false); toast(`"${code}" kodlu hammadde bulunamadı`, 'err'); return null; }
    beep(true);
    return p;
  }

  async function renderScan(main) {
    setTitle('QR Okut');
    await loadProducts();
    main.innerHTML = `<div style="max-width:620px;margin:0 auto" class="stack">
      <section class="card scan-hero">
        <div class="big-ic">${icon('scan')}</div>
        <div><h1>QR kodu okutun</h1><p class="muted" style="margin:6px 0 0">Hammaddeyi bulun, stoğunu görün ve hemen işlem yapın.</p></div>
        ${cameraAvailable() ? `<button class="btn primary lg" data-act="scan-now" style="min-width:240px">${icon('scan')}Kamerayı aç</button>` : ''}
        <div class="row" style="width:100%;max-width:440px;flex-wrap:nowrap">
          <input class="input" id="code-in" placeholder="${cameraAvailable() ? 'veya KYN kodunu yazın' : 'Barkod okuyucuyla okutun veya KYN kodunu yazın'}" autocapitalize="characters" style="flex:1">
          <button class="btn" data-act="code-go">Bul</button></div>
        ${!cameraAvailable() ? '<p class="foot-note">Bilgisayarda USB/Bluetooth barkod okuyucu bu kutuya doğrudan yazar. Telefonda Android uygulaması kamerayı kullanır.</p>' : ''}
      </section>
      <div id="scan-result"></div></div>`;
    const ci = $('#code-in', main);
    ci.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-act=code-go]').click(); } });
    if (!cameraAvailable() && matchMedia('(pointer:fine)').matches) ci.focus();
    if (S.route.query.auto === '1' && cameraAvailable()) $('[data-act=scan-now]', main).click();
  }
  function showScanResult(p) {
    const el = $('#scan-result');
    if (!el) return go('/urun/' + p.id);
    const act = (t) => `<a class="btn ty-${t}" style="color:var(--c)" href="#/islem/${t}?p=${p.id}">${icon(t)}${TYPE_INFO[t].short}</a>`;
    el.innerHTML = `<section class="card card-pad stack">
      <div class="row"><span class="badge brand mono">${esc(p.code)}</span>${statusBadge(p.status)}</div>
      <h2 style="font-size:20px">${esc(p.name)}</h2>
      <div class="stock-trio">
        <div class="stock-box"><div class="label">Ham Depo</div><div class="value">${fmt(p.ham)}<small>${esc(p.unit)}</small></div></div>
        <div class="stock-box"><div class="label">Cep Depo</div><div class="value">${fmt(p.cep)}<small>${esc(p.unit)}</small></div></div>
        <div class="stock-box total"><div class="label">Toplam</div><div class="value">${fmt(p.total)}<small>${esc(p.unit)}</small></div></div></div>
      ${can.move() ? `<div class="row">${['GIRIS', 'TRANSFER', 'URETIM', 'FIRE', 'IADE'].map(act).join('')}</div>` : ''}
      <div class="row"><a class="btn" href="#/urun/${p.id}">Kartı ve geçmişi aç</a>${cameraAvailable() ? `<button class="btn primary" data-act="scan-now">${icon('scan')}Yeni okutma</button>` : ''}</div>
    </section>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Barkod okuyucu (klavye gibi çalışan) için genel dinleyici: hızlı yazılıp Enter ile biten KYN kodu
  let kbBuf = '', kbLast = 0;
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!S.user) return;
    const now = Date.now();
    if (now - kbLast > 80) kbBuf = '';
    kbLast = now;
    if (e.key === 'Enter') {
      const code = codeFromScan(kbBuf);
      kbBuf = '';
      if (code && /^KYN-/i.test(code)) { e.preventDefault(); lookupCode(code).then((p) => p && go('/urun/' + p.id)); }
      return;
    }
    if (e.key.length === 1) kbBuf += e.key;
  });

  // ================= HAREKET GEÇMİŞİ =================
  function rangePreset(k) {
    const now = new Date(); const s = new Date(now); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(e.getDate() + 1);
    if (k === 'today') return [s, e];
    if (k === '7') { const a = new Date(s); a.setDate(a.getDate() - 6); return [a, e]; }
    if (k === '30') { const a = new Date(s); a.setDate(a.getDate() - 29); return [a, e]; }
    if (k === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
    if (k === 'lastmonth') return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
    if (k === 'year') return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)];
    return [null, null];
  }
  const ymd = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
  function dateRangeFields(prefix, preset) {
    const [a, b] = rangePreset(preset);
    const end = b ? new Date(b.getTime() - 86400000) : null;
    return `<label class="field"><span>Başlangıç</span><input class="input" type="date" name="${prefix}from" value="${ymd(a)}"></label>
      <label class="field"><span>Bitiş</span><input class="input" type="date" name="${prefix}to" value="${ymd(end)}"></label>`;
  }
  function rangeToIso(fromStr, toStr) {
    const from = fromStr ? new Date(fromStr + 'T00:00:00') : null;
    const to = toStr ? new Date(toStr + 'T00:00:00') : null;
    if (to) to.setDate(to.getDate() + 1);
    return [from ? from.toISOString() : '', to ? to.toISOString() : ''];
  }
  async function renderHistory(main, c) {
    const q = c.q, soft = c.soft;
    setTitle('Hareket Geçmişi');
    await Promise.all([loadMeta(), loadProducts()]);
    let users = [];
    if (can.admin()) { try { users = await api('GET', '/api/users'); } catch (e) { /* yoksay */ } }
    const hf = S.histFilter || (S.histFilter = { preset: '30', type: '', depot: '', q: '', userId: '', productId: '' });
    if (q.productId) { hf.productId = q.productId; hf.preset = ''; }
    const prod = hf.productId ? findProduct(hf.productId) : null;
    if (!soft || !$('#hf')) {
      main.innerHTML = `<div class="page-head"><div class="grow"><h1>Hareket Geçmişi</h1><p>Tüm stok hareketleri değiştirilemez şekilde kayıt altındadır. Hatalı kayıtlar silinmez, ters kayıtla iptal edilir.</p></div>
        <button class="btn" data-act="export-mov">${icon('excel')}Excel'e aktar</button></div>
        <form class="card card-pad" id="hf" style="margin-bottom:12px"><div class="stack">
          <div class="chips">${[['today', 'Bugün'], ['7', 'Son 7 gün'], ['30', 'Son 30 gün'], ['month', 'Bu ay'], ['lastmonth', 'Geçen ay'], ['year', 'Bu yıl'], ['', 'Tümü']].map(([k, l]) => `<button type="button" class="chip ${hf.preset === k ? 'on' : ''}" data-preset="${k}">${l}</button>`).join('')}</div>
          <div class="grid g4" style="gap:10px">
            ${dateRangeFields('', hf.preset)}
            <label class="field"><span>İşlem türü</span><select class="input" name="type"><option value="">Tümü</option>${Object.entries(TYPE_INFO).map(([k, v]) => `<option value="${k}" ${hf.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
            <label class="field"><span>Depo</span><select class="input" name="depot"><option value="">Her iki depo</option>${Object.entries(DEPOTS).map(([k, v]) => `<option value="${k}" ${hf.depot === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="field"><span>Ara <em>(ürün, kod, belge, açıklama)</em></span><input class="input" name="q" value="${esc(hf.q)}"></label>
            ${can.admin() ? `<label class="field"><span>Kullanıcı</span><select class="input" name="userId"><option value="">Tümü</option>${users.map((u) => `<option value="${u.id}" ${String(hf.userId) === String(u.id) ? 'selected' : ''}>${esc(u.fullName)}</option>`).join('')}</select></label>` : ''}
            <div class="field"><span>Ürün</span>${prod ? `<div class="row" style="min-height:44px"><span class="badge brand">${esc(prod.name)}</span><button type="button" class="btn sm ghost" data-act="hist-clear-prod">${icon('x')}</button></div>` : '<div class="muted small" style="min-height:44px;display:flex;align-items:center">Tüm ürünler</div>'}</div>
          </div></div></form>
        <section class="card" id="hres"></section>`;
      const f = $('#hf', main);
      f.addEventListener('click', (e) => {
        const b = e.target.closest('[data-preset]'); if (!b) return;
        hf.preset = b.dataset.preset;
        const [a, c] = rangePreset(hf.preset);
        f.from.value = ymd(a); f.to.value = c ? ymd(new Date(c.getTime() - 86400000)) : '';
        $$('[data-preset]', f).forEach((x) => x.classList.toggle('on', x === b));
        loadHist(true);
      });
      let t;
      f.addEventListener('input', (e) => {
        if (e.target.name === 'from' || e.target.name === 'to') { hf.preset = 'x'; $$('[data-preset]', f).forEach((x) => x.classList.remove('on')); }
        clearTimeout(t); t = setTimeout(() => loadHist(true), 300);
      });
    }
    await loadHist(true);
  }
  function histQuery() {
    const f = $('#hf'); const hf = S.histFilter;
    hf.type = f.type.value; hf.depot = f.depot.value; hf.q = f.q.value.trim(); hf.userId = f.userId ? f.userId.value : '';
    const [from, to] = rangeToIso(f.from.value, f.to.value);
    const qs = new URLSearchParams();
    if (from) qs.set('from', from); if (to) qs.set('to', to);
    ['type', 'depot', 'q', 'userId', 'productId'].forEach((k) => { if (hf[k]) qs.set(k, hf[k]); });
    return qs;
  }
  async function loadHist(reset) {
    const el = $('#hres'); if (!el) return;
    const qs = histQuery();
    S.histOffset = reset ? 0 : (S.histOffset || 0) + 100;
    qs.set('limit', 100); qs.set('offset', S.histOffset);
    const d = await api('GET', '/api/movements?' + qs);
    S.histRows = reset ? d.rows : (S.histRows || []).concat(d.rows);
    el.innerHTML = `<div class="card-head"><h2 class="small muted" style="font-weight:600">${d.total} kayıt</h2></div>${movementRows(S.histRows, { cancel: can.admin() })}
      ${S.histRows.length < d.total ? '<div style="padding:12px;text-align:center"><button class="btn" data-act="hist-more">Daha fazla yükle</button></div>' : ''}`;
  }
  function cancelMovementDialog(id) {
    const row = (S.histRows || []).find((r) => r.id === id);
    modal({
      title: 'Hareketi iptal et',
      body: `<div class="stack"><p style="margin:0">Hareket silinmez; tersine bir <b>iptal kaydı</b> eklenir ve stok eski haline döner. Her iki kayıt da geçmişte görünmeye devam eder.</p>
        ${row ? `<div class="banner info" style="margin:0"><div class="grow">${typeBadge(row.type)} <b>${esc(row.product_name)}</b> · ${fmt(row.qty)} ${esc(row.unit)} · ${fmtDate(row.created_at)}</div></div>` : ''}
        <label class="field"><span>İptal nedeni</span><input class="input" name="reason" required placeholder="Örn. Yanlış miktar girildi"></label></div>`,
      foot: '<button class="btn" data-close>Vazgeç</button><button class="btn danger" data-ok>İptal kaydını oluştur</button>',
      onMount: (el, close) => {
        el.querySelector('[data-ok]').addEventListener('click', async (e) => {
          const reason = el.querySelector('[name=reason]').value.trim();
          if (!reason) return toast('İptal nedenini yazın', 'err');
          setBusy(e.target, true);
          try { await api('POST', `/api/movements/${id}/cancel`, { reason }); close(); toast('Hareket iptal edildi', 'ok'); await loadProducts(true); rerender(true); }
          catch (err) { toast(err.message, 'err'); setBusy(e.target, false); }
        });
      },
    });
  }

  // ================= RAPORLAR =================
  async function renderReports(main) {
    setTitle('Raporlar');
    await loadMeta();
    const rf = S.repFilter || (S.repFilter = { preset: 'month', cat: '' });
    main.innerHTML = `<div class="page-head"><div class="grow"><h1>Raporlar</h1><p>Dönem bazında giriş, üretime verilen, fire ve kalan stok</p></div></div>
      <div class="grid g3" style="margin-bottom:14px">
        <div class="card card-pad stack"><h3>Stok durumu</h3><p class="muted small" style="margin:0">Tüm kalemlerin Ham/Cep/Toplam stoğu, asgari seviyeleri, durumları ve tahmini yeterlilik süresi.</p><button class="btn" data-act="export" data-kind="stock">${icon('excel')}Excel indir</button></div>
        <div class="card card-pad stack"><h3>Asgari stok uyarıları</h3><p class="muted small" style="margin:0">Kritik, tükenen ve Cep Depo'ya transfer gereken kalemler; asgariye eksik miktarlar.</p><button class="btn" data-act="export" data-kind="alerts">${icon('excel')}Excel indir</button></div>
        <div class="card card-pad stack"><h3>Hareket dökümü</h3><p class="muted small" style="margin:0">Filtrelenmiş tüm hareketler (tarih, kullanıcı, belge, açıklama).</p><a class="btn" href="#/hareketler">${icon('list')}Hareket geçmişine git</a></div>
      </div>
      <section class="card">
        <div class="card-head"><h2>Dönem hareket raporu</h2></div>
        <form class="card-pad stack" id="rf">
          <div class="chips">${[['today', 'Bugün'], ['7', 'Son 7 gün'], ['month', 'Bu ay'], ['lastmonth', 'Geçen ay'], ['year', 'Bu yıl']].map(([k, l]) => `<button type="button" class="chip ${rf.preset === k ? 'on' : ''}" data-preset="${k}">${l}</button>`).join('')}</div>
          <div class="grid g4" style="gap:10px;align-items:end">${dateRangeFields('', rf.preset)}
            <label class="field"><span>Kategori</span><select class="input" name="cat"><option value="">Tümü</option>${S.meta.categories.map((c) => `<option value="${c.id}" ${String(c.id) === rf.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <label class="check"><input type="checkbox" name="moving" ${rf.moving !== false ? 'checked' : ''}> Yalnızca hareketi olanlar</label></div>
          <div class="row"><button type="button" class="btn primary" data-act="run-report">Raporu göster</button><button type="button" class="btn" data-act="export-period">${icon('excel')}Excel indir</button><button type="button" class="btn" data-act="print-report">${icon('print')}Yazdır</button></div>
        </form>
        <div id="rep-out"></div>
      </section>`;
    const f = $('#rf', main);
    f.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]'); if (!b) return;
      rf.preset = b.dataset.preset; const [a, c] = rangePreset(rf.preset);
      f.from.value = ymd(a); f.to.value = ymd(new Date(c.getTime() - 86400000));
      $$('[data-preset]', f).forEach((x) => x.classList.toggle('on', x === b));
      runReport();
    });
    f.addEventListener('change', (e) => { if (e.target.name === 'cat') rf.cat = e.target.value; if (e.target.name === 'moving') rf.moving = e.target.checked; runReport(); });
    runReport();
  }
  function reportParams() {
    const f = $('#rf');
    const [from, to] = rangeToIso(f.from.value, f.to.value);
    if (!from || !to) { toast('Başlangıç ve bitiş tarihini seçin', 'err'); return null; }
    const qs = new URLSearchParams({ from, to });
    if (f.cat.value) qs.set('categoryId', f.cat.value);
    return qs;
  }
  async function runReport() {
    const qs = reportParams(); if (!qs) return;
    const out = $('#rep-out');
    out.innerHTML = '<div class="empty"><div class="spinner" style="margin:auto"></div></div>';
    let rows = await api('GET', '/api/reports/period?' + qs);
    if ($('#rf').moving.checked) rows = rows.filter((r) => r.giris || r.uretim || r.fire || r.iade || r.sayim || r.transfer_cep);
    S.lastReport = { rows, from: $('#rf').from.value, to: $('#rf').to.value };
    if (!rows.length) { out.innerHTML = '<div class="empty">Bu dönemde hareket yok</div>'; return; }
    const topFire = rows.filter((r) => r.fire > 0).sort((a, b) => (b.fire_rate || 0) - (a.fire_rate || 0)).slice(0, 5);
    out.innerHTML = `${topFire.length ? `<div class="card-pad" style="padding-top:0"><div class="banner warn" style="margin:0"><div class="grow"><b>En yüksek fire oranı:</b> ${topFire.map((r) => `${esc(r.name)} %${fmt(Math.round(r.fire_rate * 100) / 100)}`).join(' · ')}</div></div></div>` : ''}
      <div class="table-wrap"><table class="t"><thead><tr><th>KYN Kodu</th><th>Hammadde</th><th class="n">Dönem başı</th><th class="n">Giriş</th><th class="n">Cep'e transfer</th><th class="n">Üretime verilen</th><th class="n">İade</th><th class="n">Fire</th><th class="n">Fire %</th><th class="n">Sayım farkı</th><th class="n">Dönem sonu</th><th>Birim</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="click" data-href="#/urun/${r.id}"><td class="code">${esc(r.code)}</td><td>${esc(r.name)}</td>
        <td class="n num">${fmt(r.opening)}</td><td class="n num">${r.giris ? fmt(r.giris) : '·'}</td><td class="n num">${r.transfer_cep ? fmt(r.transfer_cep) : '·'}</td><td class="n num">${r.uretim ? fmt(r.uretim) : '·'}</td>
        <td class="n num">${r.iade ? fmt(r.iade) : '·'}</td><td class="n num ${r.fire ? 'delta down' : ''}">${r.fire ? fmt(r.fire) : '·'}</td><td class="n num">${r.fire_rate !== null ? '%' + fmt(Math.round(r.fire_rate * 100) / 100) : '·'}</td>
        <td class="n num">${r.sayim ? (r.sayim > 0 ? '+' : '') + fmt(r.sayim) : '·'}</td><td class="n"><b class="num">${fmt(r.closing)}</b></td><td class="small muted">${esc(r.unit)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  // ================= QR ETİKETLERİ =================
  const LABEL_SIZES = {
    'a4-24': { name: 'A4 · 24 etiket (70×37 mm)', per: 24 },
    'a4-14': { name: 'A4 · 14 etiket (99×38 mm)', per: 14 },
    'a4-8': { name: 'A4 · 8 büyük etiket (99×67 mm)', per: 8 },
    't-100x50': { name: 'Etiket yazıcı · 100×50 mm', per: 1 },
    't-60x40': { name: 'Etiket yazıcı · 60×40 mm', per: 1 },
  };
  function labelHtml(p, size) {
    return `<div class="lbl s-${size}"><div class="q">${window.QR.toSvg(p.code, { ecl: 'M', border: 1 })}</div>
      <div class="tx"><div class="cd">${esc(p.code)}</div><div class="nm">${esc(p.name)}</div><div class="ct">${esc(p.cat_name)} · ${esc(p.unit)}</div></div></div>`;
  }
  function printLabels(products, size, copies = 1) {
    const all = [];
    products.forEach((p) => { for (let i = 0; i < copies; i++) all.push(p); });
    const per = LABEL_SIZES[size].per;
    let html = '';
    for (let i = 0; i < all.length; i += per) html += `<div class="sheet ${size}">${all.slice(i, i + per).map((p) => labelHtml(p, size)).join('')}</div>`;
    const area = $('#print-area');
    area.innerHTML = html;
    const pageCss = size.startsWith('t-') ? `@page { size: ${size === 't-100x50' ? '100mm 50mm' : '60mm 40mm'}; margin: 0; }` : '@page { size: A4; margin: 0; }';
    let st = $('#print-page-style');
    if (!st) { st = document.createElement('style'); st.id = 'print-page-style'; document.head.appendChild(st); }
    st.textContent = '@media print { ' + pageCss + ' }';
    doPrint('QR Etiketleri');
  }
  function doPrint(job) {
    setTimeout(() => {
      if (native && native.print) native.print(job || 'Depo Takip'); else window.print();
    }, 60);
  }
  async function renderLabels(main) {
    setTitle('QR Etiketleri');
    await Promise.all([loadMeta(), loadProducts()]);
    const lf = S.labelFilter || (S.labelFilter = { cat: '', q: '', size: 'a4-24', copies: 1, sel: new Set() });
    main.innerHTML = `<div class="page-head"><div class="grow"><h1>QR Etiketleri</h1><p>Raf ve palet etiketlerini yazdırın. Her etikette kalıcı KYN kodu ve QR bulunur.</p></div></div>
      <div class="grid g2" style="align-items:start">
        <section class="card"><div class="card-head"><h2>Hammadde seçimi</h2><span class="badge brand" id="lbl-count"></span></div>
          <div class="card-pad stack">
            <div class="row"><input class="input" id="lbl-q" placeholder="Ara…" style="flex:1;min-width:160px" value="${esc(lf.q)}">
              <select class="input" id="lbl-cat" style="width:auto"><option value="">Tüm kategoriler</option>${S.meta.categories.map((c) => `<option value="${c.id}" ${String(c.id) === lf.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="row"><button class="btn sm" data-act="lbl-all">Görünenleri seç</button><button class="btn sm" data-act="lbl-none">Seçimi temizle</button></div>
            <div class="sel-list" id="lbl-list"></div>
          </div></section>
        <section class="card"><div class="card-head"><h2>Baskı ayarları</h2></div>
          <div class="card-pad stack">
            <label class="field"><span>Etiket boyutu</span><select class="input" id="lbl-size">${Object.entries(LABEL_SIZES).map(([k, v]) => `<option value="${k}" ${k === lf.size ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
            <label class="field"><span>Her hammaddeden kaç adet</span><input class="input" id="lbl-copies" type="number" min="1" max="50" value="${lf.copies}"></label>
            <div class="field"><span>Önizleme</span><div class="label-preview" id="lbl-prev"></div></div>
            <button class="btn primary lg" data-act="lbl-print">${icon('print')}Seçilenleri yazdır</button>
            <p class="foot-note">Yazdırma penceresinde <b>Ölçek: %100 (Gerçek boyut)</b> ve <b>Kenar boşluğu: Yok</b> seçin. Etiket yazıcısında kağıt boyutunu etiket ölçüsüne ayarlayın.</p>
          </div></section></div>`;
    const draw = () => {
      const fq = fold(lf.q);
      const vis = S.products.filter((p) => (!lf.cat || String(p.category_id) === lf.cat) && (!fq || fold(p.name + ' ' + p.code).includes(fq)));
      S.labelVisible = vis;
      $('#lbl-list').innerHTML = vis.map((p) => `<label><input type="checkbox" data-id="${p.id}" ${lf.sel.has(p.id) ? 'checked' : ''}><span class="code">${esc(p.code)}</span><span>${esc(p.name)}</span></label>`).join('') || '<div class="empty">Bulunamadı</div>';
      $('#lbl-count').textContent = `${lf.sel.size} seçili`;
      const first = S.products.find((p) => lf.sel.has(p.id)) || vis[0];
      $('#lbl-prev').innerHTML = first ? labelHtml(first, lf.size) : '';
    };
    $('#lbl-q').addEventListener('input', (e) => { lf.q = e.target.value; draw(); });
    $('#lbl-cat').addEventListener('change', (e) => { lf.cat = e.target.value; draw(); });
    $('#lbl-size').addEventListener('change', (e) => { lf.size = e.target.value; draw(); });
    $('#lbl-copies').addEventListener('input', (e) => { lf.copies = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)); });
    $('#lbl-list').addEventListener('change', (e) => { const id = +e.target.dataset.id; if (e.target.checked) lf.sel.add(id); else lf.sel.delete(id); $('#lbl-count').textContent = `${lf.sel.size} seçili`; draw(); });
    S.drawLabels = draw;
    draw();
  }

  // ================= AYARLAR =================
  async function renderSettings(main, c) {
    const q = c.q;
    setTitle('Ayarlar');
    await loadMeta();
    const tabs = [['genel', 'Genel'], ['telefon', 'Telefon bağlantısı']];
    if (can.admin()) tabs.push(['kullanicilar', 'Kullanıcılar'], ['excel', 'Excel ile toplu giriş'], ['kategoriler', 'Kategoriler'], ['yedek', 'Yedekleme']);
    const tab = (q && q.tab) || S.settingsTab || 'genel';
    S.settingsTab = tab;
    main.innerHTML = `<div class="page-head"><div class="grow"><h1>Ayarlar</h1></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<a href="#/ayarlar?tab=${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div><div id="set-body"></div>`;
    const body = $('#set-body', main);
    if (tab === 'genel') return settingsGeneral(body);
    if (tab === 'telefon') return settingsPhone(body);
    if (tab === 'kullanicilar') return settingsUsers(body);
    if (tab === 'excel') return settingsExcel(body);
    if (tab === 'kategoriler') return settingsCategories(body);
    if (tab === 'yedek') return settingsBackup(body);
  }
  async function settingsGeneral(body) {
    body.innerHTML = `<div class="grid g2" style="align-items:start">
      ${can.admin() ? `<section class="card card-pad stack"><h2>Firma</h2><label class="field"><span>Firma adı (raporlarda ve etiketlerde görünür)</span><input class="input" id="company" value="${esc(S.company)}"></label><div><button class="btn primary" data-act="save-company">Kaydet</button></div></section>` : ''}
      <section class="card card-pad stack"><h2>Hesabım</h2>
        <dl class="kv"><dt>Ad Soyad</dt><dd>${esc(S.user.fullName)}</dd><dt>Kullanıcı adı</dt><dd>${esc(S.user.username)}</dd><dt>Yetki</dt><dd>${ROLE_TR[S.user.role]}</dd></dl>
        <form id="pw" class="stack"><label class="field"><span>Mevcut şifre</span><input class="input" type="password" name="oldPassword" required autocomplete="current-password"></label>
        <label class="field"><span>Yeni şifre</span><input class="input" type="password" name="newPassword" required minlength="4" autocomplete="new-password"></label>
        <div class="row"><button class="btn" type="submit">Şifreyi değiştir</button><span class="spacer"></span><button type="button" class="btn ghost" data-act="logout">${icon('logout')}Çıkış yap</button></div></form></section>
      <section class="card card-pad stack"><h2>Bildirimler</h2>
        <p class="muted small" style="margin:0">Bir kalem asgari seviyenin altına indiğinde, hareketi kim girerse girsin tüm açık ekranlarda uyarı gösterilir.${native ? ' Telefonda Android bildirimi olarak da gelir.' : ''}</p>
        ${!native && 'Notification' in window ? `<div><button class="btn" data-act="notif-perm" ${Notification.permission === 'granted' ? 'disabled' : ''}>${icon('bell')}${Notification.permission === 'granted' ? 'Masaüstü bildirimleri açık' : 'Masaüstü bildirimlerini aç'}</button></div>` : ''}
      </section>
      <section class="card card-pad stack"><h2>Hakkında</h2><div><a class="btn" href="/kilavuz.html" target="_blank">Kullanım kılavuzunu aç</a></div><dl class="kv" id="about"><dt>Sürüm</dt><dd>${esc(S.meta.version)}</dd></dl></section>
    </div>`;
    $('#pw', body).addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api('POST', '/api/me/password', formData(e.target)); toast('Şifre değiştirildi', 'ok'); e.target.reset(); } catch (err) { toast(err.message, 'err'); }
    });
    try {
      const i = await api('GET', '/api/server-info');
      $('#about', body).innerHTML += `<dt>Sunucu bilgisayar</dt><dd>${esc(i.hostname)}</dd><dt>Bağlı ekran</dt><dd>${i.clients}</dd><dt>Toplam hareket</dt><dd>${fmt(i.movementCount)}</dd>${native && native.getVersion ? `<dt>Android uygulaması</dt><dd>${esc(native.getVersion())}</dd>` : ''}`;
    } catch (e) { /* yoksay */ }
  }
  async function settingsPhone(body) {
    const i = await api('GET', '/api/server-info');
    const addrs = i.addresses;
    body.innerHTML = `<div class="grid g2" style="align-items:start">
      <section class="card card-pad stack"><h2>Telefonu bağlayın</h2>
        <ol style="margin:0;padding-left:18px;line-height:1.7">
          <li>Telefonun, bu bilgisayarla <b>aynı Wi-Fi ağına</b> bağlı olduğundan emin olun.</li>
          <li><b>Depo Takip</b> Android uygulamasını açın.</li>
          <li>“Sunucuyu QR ile bul” düğmesine basıp yandaki kodu okutun.</li>
          <li>Kendi kullanıcı adınız ve şifrenizle giriş yapın.</li></ol>
        <p class="foot-note">Elle girmek isterseniz adres: <b class="mono">${addrs[0] ? esc(addrs[0].url) : '—'}</b><br>Bu adres değişmesin diye modem arayüzünden bu bilgisayara sabit IP (DHCP rezervasyonu) verilmesi önerilir.</p>
      </section>
      <section class="card card-pad stack" style="justify-items:center;text-align:center">
        ${addrs.length ? addrs.map((a, idx) => `<div class="stack" style="justify-items:center;${idx ? 'opacity:.8' : ''}"><div class="pair-qr">${window.QR.toSvg(a.url, { ecl: 'M', border: 2 })}</div><div><b class="mono">${esc(a.url)}</b><div class="small muted">${esc(a.name)}${idx === 0 ? ' · önerilen' : ''}</div></div></div>`).join('<div class="divider" style="width:100%"></div>')
          : '<div class="empty">Bu bilgisayar bir ağa bağlı görünmüyor.</div>'}
      </section></div>`;
  }
  async function settingsUsers(body) {
    const users = await api('GET', '/api/users');
    body.innerHTML = `<section class="card"><div class="card-head"><h2>Kullanıcılar</h2><button class="btn primary sm" data-act="user-new">${icon('plus')}Yeni kullanıcı</button></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Ad Soyad</th><th>Kullanıcı adı</th><th>Yetki</th><th>Durum</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr><td><b>${esc(u.fullName)}</b></td><td class="mono">${esc(u.username)}</td><td>${ROLE_TR[u.role]}</td><td>${u.active ? '<span class="badge ok">Aktif</span>' : '<span class="badge gray">Pasif</span>'}</td>
        <td class="n"><button class="btn sm" data-act="user-edit" data-id="${u.id}">${icon('edit')}Düzenle</button></td></tr>`).join('')}
      </tbody></table></div></section>
      <p class="foot-note" style="margin-top:12px"><b>Yönetici:</b> her şey (kartlar, sayım, iptal, kullanıcılar, Excel içe aktarma). <b>Depocu:</b> giriş, transfer, üretime çıkış, fire, iade; raporları görür. <b>İzleyici:</b> yalnızca görüntüler ve rapor alır.</p>`;
    S.usersCache = users;
  }
  function userModal(u) {
    const isNew = !u;
    modal({
      title: isNew ? 'Yeni kullanıcı' : 'Kullanıcıyı düzenle',
      body: `<form id="uf" class="form-grid">
        <label class="field full"><span>Ad Soyad</span><input class="input" name="fullName" value="${esc(u ? u.fullName : '')}" required></label>
        <label class="field"><span>Kullanıcı adı</span><input class="input" name="username" value="${esc(u ? u.username : '')}" ${u ? 'disabled' : ''} required autocapitalize="none"></label>
        <label class="field"><span>Yetki</span><select class="input" name="role">${Object.entries(ROLE_TR).map(([k, v]) => `<option value="${k}" ${(u ? u.role : 'depo') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field full"><span>${isNew ? 'Şifre' : 'Yeni şifre <em>(değiştirmek istemiyorsanız boş bırakın)</em>'}</span><input class="input" type="text" name="password" ${isNew ? 'required minlength="4"' : ''} autocomplete="off"></label>
        ${!isNew ? `<label class="check full"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Aktif</label>` : ''}</form>`,
      foot: '<button class="btn" data-close>Vazgeç</button><button class="btn primary" data-save>Kaydet</button>',
      onMount: (el, close) => {
        el.querySelector('[data-save]').addEventListener('click', async () => {
          const f = $('#uf', el); if (!f.reportValidity()) return;
          const d = formData(f);
          try {
            if (isNew) await api('POST', '/api/users', d);
            else { if (!d.password) delete d.password; delete d.username; await api('PUT', '/api/users/' + u.id, d); }
            close(); toast('Kaydedildi', 'ok'); rerender();
          } catch (err) { toast(err.message, 'err'); }
        });
      },
    });
  }
  function settingsExcel(body) {
    body.innerHTML = `<div class="grid g2" style="align-items:start">
      <section class="card card-pad stack"><h2>1. Şablonu indirin</h2>
        <p class="muted" style="margin:0">Şablonda tüm hammaddeler KYN kodlarıyla listelenir. Depoda saydığınız miktarları, asgari stok seviyelerini ve yeni kalemleri doldurun.</p>
        <div><button class="btn" data-act="export" data-kind="template">${icon('excel')}Excel şablonunu indir</button></div>
        <ul class="small muted" style="margin:0;padding-left:18px;line-height:1.6"><li><b>Ham / Cep Depo Sayım:</b> boş bırakılırsa değişmez. Dolu ise fark “Sayım Düzeltme” olarak kaydedilir.</li><li><b>Asgari Stok:</b> iki deponun toplamı için alt sınır.</li><li><b>Cep Asgari:</b> Cep Depo için alt sınır (transfer uyarısı).</li><li>Yeni kalem için KYN Kodu boş, Ad ve Kategori Kodu dolu bir satır ekleyin.</li></ul>
      </section>
      <section class="card card-pad stack"><h2>2. Doldurulan dosyayı yükleyin</h2>
        <label class="btn" style="justify-self:start">${icon('upload')}Excel dosyası seç<input type="file" id="imp-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
        <div id="imp-out" class="muted small">Önce değişikliklerin önizlemesi gösterilir; onaylamadan hiçbir şey kaydedilmez.</div>
      </section></div>`;
    $('#imp-file', body).addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const buf = await file.arrayBuffer();
      S.importBuf = buf;
      const out = $('#imp-out');
      out.innerHTML = '<div class="spinner"></div>';
      try { const r = await api('POST', '/api/import', buf); showImport(r, out); } catch (err) { out.innerHTML = `<div class="banner danger">${esc(err.message)}</div>`; }
      e.target.value = '';
    });
  }
  function showImport(r, out) {
    const kinds = { YENI: 'Yeni kalem', AYAR: 'Asgari / tedarikçi', SAYIM: 'Sayım düzeltme' };
    const cnt = (k) => r.changes.filter((c) => c.kind === k).length;
    out.innerHTML = `${r.errors.length ? `<div class="banner danger"><div class="grow"><b>${r.errors.length} hata var; düzeltip tekrar yükleyin.</b><ul style="margin:6px 0 0;padding-left:18px">${r.errors.slice(0, 15).map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div></div>` : ''}
      ${r.applied ? '<div class="banner info"><b>Değişiklikler kaydedildi.</b></div>' : ''}
      <div class="row" style="margin-bottom:8px">${Object.keys(kinds).map((k) => `<span class="badge brand">${kinds[k]}: ${cnt(k)}</span>`).join('')}</div>
      ${r.changes.length ? `<div class="table-wrap" style="max-height:340px;border:1px solid var(--line);border-radius:8px"><table class="t"><thead><tr><th>Satır</th><th>Tür</th><th>Hammadde</th><th>Değişiklik</th></tr></thead><tbody>
      ${r.changes.map((c) => `<tr><td class="num">${c.line}</td><td>${kinds[c.kind]}</td><td>${esc(c.code || '(yeni)')} ${esc(c.name)}</td><td class="small">${c.kind === 'SAYIM' ? `${DEPOTS[c.depot]}: ${fmt(c.current)} → <b>${fmt(c.counted)}</b> (<span class="delta ${c.delta > 0 ? 'up' : 'down'}">${c.delta > 0 ? '+' : ''}${fmt(c.delta)}</span>)`
        : c.kind === 'AYAR' ? Object.entries(c.upd).map(([k, v]) => `${fieldTr(k)}: ${fmtv(v)}`).join(' · ') : `${esc(c.catCode)} · ${esc(c.unit)}${c.ham ? ' · Ham ' + fmt(c.ham) : ''}${c.cep ? ' · Cep ' + fmt(c.cep) : ''}`}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Değişiklik yok</div>'}
      ${!r.applied && !r.errors.length && r.changes.length ? `<div class="row" style="margin-top:12px"><button class="btn primary" data-act="imp-apply">${r.changes.length} değişikliği kaydet</button></div>` : ''}`;
  }
  async function settingsCategories(body) {
    await loadMeta();
    const counts = {};
    S.products.forEach((p) => { counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
    body.innerHTML = `<section class="card"><div class="card-head"><h2>Kategoriler</h2><button class="btn sm primary" data-act="cat-new">${icon('plus')}Yeni kategori</button></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Kod</th><th>Kategori</th><th>Varsayılan birim</th><th class="n">Kalem</th></tr></thead><tbody>
      ${S.meta.categories.map((c) => `<tr><td class="code">KYN-${esc(c.code)}-…</td><td>${esc(c.name)}</td><td>${esc(c.unit)}</td><td class="n num">${counts[c.id] || 0}</td></tr>`).join('')}</tbody></table></div></section>
      <p class="foot-note" style="margin-top:12px">Yeni hammadde eklendiğinde kategorinin bir sonraki sıra numarasıyla otomatik kod verilir (örn. KYN-ETK-031). Kodlar kalıcıdır, yeniden kullanılmaz.</p>`;
  }
  async function settingsBackup(body) {
    const i = await api('GET', '/api/server-info');
    body.innerHTML = `<div class="grid g2" style="align-items:start"><section class="card card-pad stack"><h2>Yedekleme</h2>
      <p class="muted" style="margin:0">Veritabanı her 12 saatte bir otomatik yedeklenir; son 60 otomatik yedek saklanır.</p>
      <dl class="kv"><dt>Veri klasörü</dt><dd class="mono small">${esc(i.dataDir)}</dd><dt>Yedek klasörü</dt><dd class="mono small">${esc(i.backupDir)}</dd><dt>Yedek sayısı</dt><dd>${i.backupCount}</dd><dt>Son yedek</dt><dd class="small">${esc(i.lastBackup || '—')}</dd></dl>
      <div class="row"><button class="btn" data-act="backup-now">Şimdi yedek al</button><button class="btn" data-act="backup-dl">${icon('download')}Yedeği indir</button></div>
      <p class="foot-note">Yedekleri düzenli olarak bir USB belleğe veya başka bir bilgisayara kopyalamanız önerilir. Geri yükleme adımları kullanım kılavuzundadır.</p></section></div>`;
  }

  // Mobil menü
  function renderMenu(main) {
    setTitle('Menü');
    const it = (href, ic, l, sub) => `<a class="li" href="${href}"><span class="badge brand" style="padding:8px">${icon(ic)}</span><div class="grow"><div class="name">${l}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div></a>`;
    main.innerHTML = `<section class="card" style="margin-bottom:12px"><div class="li"><div class="grow"><div class="name">${esc(S.user.fullName)}</div><div class="sub">${ROLE_TR[S.user.role]} · ${esc(S.company)}</div></div></div></section>
      <section class="card list">
        ${it('#/hareketler', 'list', 'Hareket Geçmişi', 'Filtrele, iptal et, Excel’e aktar')}
        ${it('#/uyarilar', 'bell', 'Stok Uyarıları', 'Asgari seviye altındaki kalemler')}
        ${it('#/raporlar', 'chart', 'Raporlar', 'Dönem raporu, fire oranları')}
        ${it('#/etiketler', 'tag', 'QR Etiketleri', 'Etiket yazdır')}
        ${it('#/ayarlar', 'gear', 'Ayarlar', 'Hesap, kullanıcılar, Excel, yedek')}
        <a class="li" href="/kilavuz.html"><span class="badge brand" style="padding:8px">${icon('list')}</span><div class="grow"><div class="name">Kullanım Kılavuzu</div></div></a>
      </section>
      <div style="margin-top:12px" class="row"><button class="btn block" data-act="logout">${icon('logout')}Çıkış yap</button>${native && native.changeServer ? '<button class="btn block" data-act="change-server">Sunucu adresini değiştir</button>' : ''}</div>`;
  }

  // ================= Olay yönetimi =================
  document.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('a,button')) { location.hash = tr.dataset.href; return; }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
    try {
      switch (act) {
        case 'logout':
          if (!(await confirmBox('Çıkış', 'Oturumu kapatmak istiyor musunuz?', 'Çıkış yap'))) return;
          api('POST', '/api/logout').catch(() => {}); logoutLocal(); break;
        case 'reload': rerender(); break;
        case 'reload-app': location.reload(); break;
        case 'change-server': if (native && native.changeServer) native.changeServer(); break;
        case 'flush': flushQueue(); break;
        case 'show-failed':
          modal({ title: 'Gönderilemeyen işlemler', wide: true,
            body: `<p class="muted" style="margin-top:0">Bu işlemler bağlantı yokken girildi ancak sunucu kabul etmedi (örneğin stok yetersizdi). Gerekirse yeniden girin.</p><div class="list">${S.failed.map((f) => `<div class="li"><div class="grow"><div class="name">${typeBadge(f.type)} ${esc((findProduct(f.productId) || {}).name || f.productId)}</div><div class="sub">${fmt(f.qty ?? f.counted)} · ${esc(f.error)}</div></div></div>`).join('')}</div>`,
            foot: '<button class="btn" data-close>Kapat</button><button class="btn danger" data-clear-failed>Listeyi temizle</button>',
            onMount: (m, close) => m.querySelector('[data-clear-failed]').addEventListener('click', () => { S.failed = []; saveQueue(); close(); }) });
          break;
        case 'export': dl(`/api/export/${el.dataset.kind}.xlsx`); toast('Excel dosyası hazırlanıyor…'); break;
        case 'export-mov': { const qs = histQuery(); dl('/api/export/movements.xlsx?' + qs); break; }
        case 'export-period': { const qs = reportParams(); if (qs) dl('/api/export/period.xlsx?' + qs); break; }
        case 'run-report': runReport(); break;
        case 'print-report': {
          const r = S.lastReport; if (!r) return;
          $('#print-area').innerHTML = `<div class="report"><h2>${esc(S.company)} — Dönem Hareket Raporu</h2><p>${esc(r.from)} – ${esc(r.to)}</p>${$('#rep-out').innerHTML}</div>`;
          let st = $('#print-page-style'); if (!st) { st = document.createElement('style'); st.id = 'print-page-style'; document.head.appendChild(st); }
          st.textContent = '@media print { @page { size: A4 landscape; margin: 0; } }';
          doPrint('Dönem Raporu'); break;
        }
        case 'new-product': await loadMeta(); productModal(null); break;
        case 'edit-product': { await loadMeta(); const d = await api('GET', '/api/products/' + el.dataset.id); productModal(d.product); break; }
        case 'print-one': { const p = findProduct(el.dataset.id) || (await api('GET', '/api/products/' + el.dataset.id)).product; printLabels([p], (S.labelFilter && S.labelFilter.size) || 'a4-24', 1); break; }
        case 'cancel-mov': cancelMovementDialog(Number(el.dataset.id)); break;
        case 'hist-more': loadHist(false); break;
        case 'hist-clear-prod': S.histFilter.productId = ''; location.hash = '/hareketler'; rerender(); break;
        case 'swap-depot': {
          const f = $('#mv'); const a = f.from.value; f.from.value = f.to.value; f.to.value = a;
          formState.header.from = f.from.value; formState.header.to = f.to.value; onProductPicked(true); break;
        }
        case 'clear-product': formState.product = null; onProductPicked(); { const pi = $('#picker-slot input'); if (pi) pi.focus(); } break;
        case 'add-line': { const l = readLine(); if (l) { formState.lines.push(l); resetLineInputs(); drawLines(); toast('Listeye eklendi'); } break; }
        case 'del-line': formState.lines.splice(+el.dataset.i, 1); drawLines(); break;
        case 'clear-lines': formState.lines = []; drawLines(); break;
        case 'save-mv': saveMovements(el); break;
        case 'picker-scan': {
          const t = await scanQR(); if (!t) return;
          const p = await lookupCode(t); if (p) { formState.product = findProduct(p.id) || p; onProductPicked(); }
          break;
        }
        case 'scan-now': { const t = await scanQR(); if (!t) return; const p = await lookupCode(t); if (p) showScanResult(findProduct(p.id) || p); break; }
        case 'code-go': { const v = $('#code-in').value.trim(); if (!v) return; let p = await lookupCode(v.toUpperCase());
          if (!p) { const m = S.products.filter((x) => fold(x.name).includes(fold(v))); if (m.length === 1) p = m[0]; }
          if (p) { $('#code-in').value = ''; showScanResult(findProduct(p.id) || p); } break; }
        case 'notif-perm': if ('Notification' in window) { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Masaüstü bildirimleri açıldı' : 'Bildirim izni verilmedi', r === 'granted' ? 'ok' : 'warn'); rerender(true); } break;
        case 'save-company':
          await api('PUT', '/api/settings', { company: $('#company').value });
          S.meta = null; await loadMeta(); toast('Kaydedildi', 'ok'); renderShell(); rerender(); break;
        case 'user-new': userModal(null); break;
        case 'user-edit': userModal((S.usersCache || []).find((u) => u.id === +el.dataset.id)); break;
        case 'imp-apply': {
          setBusy(el, true);
          const r = await api('POST', '/api/import?apply=1', S.importBuf);
          showImport(r, $('#imp-out')); await loadProducts(true); checkAlerts(); updateBadges();
          toast('Excel verileri işlendi', 'ok'); break;
        }
        case 'cat-new':
          modal({ title: 'Yeni kategori', body: `<form id="cf" class="form-grid"><label class="field"><span>Kod <em>(2-4 harf, örn. YAG)</em></span><input class="input" name="code" maxlength="4" required style="text-transform:uppercase"></label>
            <label class="field"><span>Varsayılan birim</span><input class="input" name="unit" value="adet" required></label><label class="field full"><span>Kategori adı</span><input class="input" name="name" required></label></form>`,
            foot: '<button class="btn" data-close>Vazgeç</button><button class="btn primary" data-save>Ekle</button>',
            onMount: (m, close) => m.querySelector('[data-save]').addEventListener('click', async () => {
              const f = $('#cf', m); if (!f.reportValidity()) return;
              try { await api('POST', '/api/categories', formData(f)); S.meta = null; close(); toast('Kategori eklendi', 'ok'); rerender(); } catch (err) { toast(err.message, 'err'); }
            }) });
          break;
        case 'backup-now': { const r = await api('POST', '/api/backup'); toast('Yedek alındı: ' + r.file.split(/[\\/]/).pop(), 'ok'); rerender(); break; }
        case 'backup-dl': dl('/api/backup/download'); break;
        case 'lbl-all': S.labelVisible.forEach((p) => S.labelFilter.sel.add(p.id)); S.drawLabels(); break;
        case 'lbl-none': S.labelFilter.sel.clear(); S.drawLabels(); break;
        case 'lbl-print': {
          const sel = S.products.filter((p) => S.labelFilter.sel.has(p.id));
          if (!sel.length) return toast('Önce hammadde seçin', 'err');
          printLabels(sel, S.labelFilter.size, S.labelFilter.copies); break;
        }
        default: break;
      }
    } catch (err) { toast(err.message, 'err'); setBusy(el, false); }
  });

  window.addEventListener('hashchange', () => { if (S.user && $('#main')) rerender(); });
  window.addEventListener('online', () => { setOnline(true); connectSSE(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && S.user) { if (!S.sseOk) connectSSE(); loadProducts(true).then(() => { checkAlerts(); updateBadges(); }).catch(() => {}); }
  });
  // Android uygulaması geri tuşu
  window.__onNativeBack = () => {
    const m = $$('.modal-back'); if (m.length) { m[m.length - 1].remove(); return true; }
    if (location.hash && location.hash !== '#/' && location.hash !== '#') { history.back(); return true; }
    return false;
  };

  startApp();
})();
