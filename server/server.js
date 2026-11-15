'use strict';
// Depo Takip 2 — yerel ağ sunucusu (Node.js 22.13+ / 24, harici paket gerektirmez)
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { Store, AppError, nowIso, trKey, round, parseNum, dateOnly, hashPassword, verifyPassword } = require('./store');
const { C, DEF_COLLS, REC_COLLS } = require('./schema');
const { Calc, nextDay } = require('./calc');
const XI = require('./excel-import');
const X = require('./exports');
const { readXlsx } = require('./xlsx');
const P = require('./perm');
const KI = require('./kayit-import');

const VERSION = '2.1.0';
const PORT = Number(process.env.DEPO_PORT) || 8765;
const DATA_DIR = process.env.DEPO_DATA_DIR ||
  (process.platform === 'win32' ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'DepoTakip') : path.join(__dirname, '..', 'data'));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BACKUP_DIR = path.join(DATA_DIR, 'yedekler');
const LOG_FILE = path.join(DATA_DIR, 'sunucu.log');
const DB_FILE = path.join(DATA_DIR, 'depo2.db');
const OLD_DB = path.join(DATA_DIR, 'depo.db');
const ROLES = P.ROLES;

fs.mkdirSync(DATA_DIR, { recursive: true });
const store = new Store(DB_FILE);
const db = store.db;
const calc = new Calc(store);

function log(...a) {
  const line = new Date().toLocaleString('tr-TR') + ' ' + a.join(' ');
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + os.EOL); } catch (e) { /* yoksay */ }
}

// ---------- İlk açılış: hazır tanımlar + eski sürümden kullanıcılar ----------
function firstRun() {
  if (!store.meta('seeded', false) && !store.all('hammadde', { withDeleted: true }).length) {
    try {
      const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
      const r = XI.apply(store, seed, null, { kayitlar: false, devir: false });
      db.prepare('UPDATE changes SET label = ? WHERE batch = ?').run('Hazır tanımlar yüklendi (Ekim 2026 Excel dosyasından)', r.batch);
      log(`Hazır tanımlar yüklendi: ${r.olusan} kayıt`);
    } catch (e) { log('Hazır tanımlar yüklenemedi:', e.message); }
    store.setMeta('seeded', true);
  }
  const nUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (!nUsers && fs.existsSync(OLD_DB)) {
    try {
      const old = new DatabaseSync(OLD_DB, { readOnly: true });
      const users = old.prepare('SELECT * FROM users').all();
      const ins = db.prepare('INSERT INTO users (username, full_name, role, pass_hash, active, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      for (const u of users) ins.run(u.username, u.full_name, ROLES[P.normRole(u.role)] ? P.normRole(u.role) : 'depo', u.pass_hash, u.active, u.created_at);
      const comp = old.prepare("SELECT value FROM meta WHERE key = 'company'").get();
      if (comp && comp.value) store.setMeta('settings', { ...store.meta('settings', {}), company: comp.value });
      old.close();
      log(`Eski sürümden ${users.length} kullanıcı aktarıldı`);
    } catch (e) { log('Eski kullanıcılar aktarılamadı:', e.message); }
  }
}
firstRun();
// 2.1: kodu olmayan ürünlere mamul kodu (MML-001 …) ver — ürün QR etiketleri için
(function urunKodlari() {
  const eksik = store.all('urun', { withDeleted: true }).filter((u) => !u.kod).sort((a, b) => (a.sira || 0) - (b.sira || 0) || a.id - b.id);
  if (!eksik.length) return;
  const batch = crypto.randomUUID();
  try {
    store.tx(() => { for (const u of eksik) { if (u._deleted) continue; store.update('urun', u.id, { kod: store.nextUrunCode() }, null, { batch, label: 'Ürünlere mamul kodu verildi (2.1)', system: true }); } });
    log(`${eksik.length} ürüne mamul kodu verildi`);
  } catch (e) { log('Ürün kodları verilemedi:', e.message); }
})();

// ---------- Canlı güncelleme (Server-Sent Events) ----------
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`;
  for (const c of clients) { try { c.write(msg); } catch (e) { clients.delete(c); } }
}
setInterval(() => { for (const c of clients) { try { c.write(': ping\n\n'); } catch (e) { clients.delete(c); } } }, 25000);
let pendingColls = new Set(); let bTimer = null;
store.onChange((info) => {
  for (const c of info.colls || ['*']) pendingColls.add(c);
  clearTimeout(bTimer);
  bTimer = setTimeout(() => { broadcast('change', { colls: [...pendingColls], v: store.version, by: lastActor }); pendingColls = new Set(); }, 150);
});
let lastActor = null;

// ---------- Yedekleme ----------
function stamp() {
  const d = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function backup(tag = 'otomatik') {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  let target = path.join(BACKUP_DIR, `depo2-${stamp()}-${tag}.db`);
  for (let i = 2; fs.existsSync(target); i++) target = path.join(BACKUP_DIR, `depo2-${stamp()}-${tag}-${i}.db`);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('depo2-') && f.endsWith('-otomatik.db')).sort();
  while (all.length > 60) fs.unlinkSync(path.join(BACKUP_DIR, all.shift()));
  return target;
}
function scheduleBackups() {
  const last = store.meta('last_backup', null);
  if (!last || Date.now() - Date.parse(last) > 12 * 3600000) {
    try { const f = backup(); db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_backup', ?)").run(JSON.stringify(nowIso())); log('Yedek alındı:', f); } catch (e) { log('Yedek hatası:', e.message); }
  }
}
setInterval(scheduleBackups, 3600000);

// ---------- Yardımcılar ----------
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push({ name, address: a.address });
  }
  const score = (n) => (/vmware|virtual|vbox|hyper-v|vethernet|docker|wsl|tailscale|zerotier|loopback/i.test(n) ? 1 : 0);
  out.sort((a, b) => score(a.name) - score(b.name));
  return out;
}
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(isBuf ? body : JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new AppError(413, 'Dosya çok büyük')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const b = await readBody(req, 8 * 1024 * 1024);
  if (!b.length) return {};
  try { return JSON.parse(b.toString('utf8')); } catch (e) { throw new AppError(400, 'Geçersiz istek gövdesi'); }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const full = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!full.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Yasak' });
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, { error: 'Bulunamadı' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}
function xlsxResponse(res, filename, buf) {
  res.writeHead(200, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Cache-Control': 'no-store',
  });
  res.end(buf);
}

// Ay seçimi: ?ay=2026-10  →  [from, to)
function period(q) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.bas || '') && /^\d{4}-\d{2}-\d{2}$/.test(q.bit || '')) {
    const from = dateOnly(q.bas, 'Başlangıç'); const bit = dateOnly(q.bit, 'Bitiş');
    if (bit < from) throw new AppError(400, 'Bitiş tarihi başlangıçtan önce olamaz');
    const tr = (t) => t.split('-').reverse().join('.');
    return { ay: from.slice(0, 7), from, to: nextDay(bit), donem: `${tr(from)} – ${tr(bit)}`, tag: `${from}_${bit}` };
  }
  let ay = q.ay;
  if (!/^\d{4}-\d{2}$/.test(ay || '')) { const d = new Date(); ay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  const from = ay + '-01';
  return { ay, from, to: XI.nextMonth(from) };
}
const userNames = () => new Map(db.prepare('SELECT id, full_name FROM users').all().map((u) => [u.id, u.full_name]));

// ---------- Oturum ----------
function auth(req, url) {
  let token = null;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) token = h.slice(7);
  if (!token) token = url.searchParams.get('t');
  if (!token) return null;
  const s = db.prepare('SELECT s.token, s.last_seen, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token);
  if (!s || !s.active) return null;
  if (Date.now() - Date.parse(s.last_seen) > 30 * 86400000) { db.prepare('DELETE FROM sessions WHERE token = ?').run(token); return null; }
  if (Date.now() - Date.parse(s.last_seen) > 60000) db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').run(nowIso(), token);
  const role = P.normRole(s.role);
  return { id: s.id, username: s.username, fullName: s.full_name, role, token, perm: P.effective(role, s.perms) };
}
function need(user, ...roles) {
  if (!user) throw new AppError(401, 'Oturum açmanız gerekiyor');
  if (roles.length && !roles.includes(user.role)) throw new AppError(403, 'Bu işlem için yetkiniz yok');
}
// Kayıt türü bazında yetki: op = create | update | delete | view
function canWrite(user, coll, op = 'create') {
  need(user);
  const k = C[coll] && C[coll].kind;
  if (!k) throw new AppError(404, 'Bilinmeyen kayıt türü');
  if (k === 'def' || k === 'sys') { if (user.role !== 'admin') throw new AppError(403, 'Tanımları yalnızca ana yönetici değiştirebilir'); return; }
  const ch = P.OP_CH[op] || 'e';
  if (!P.has(user.perm, coll, ch)) throw new AppError(403, `${C[coll].label}: ${P.OP_TR[ch]} yetkiniz yok`);
}
function canView(user, coll) {
  need(user);
  if (C[coll] && C[coll].kind === 'rec' && !P.has(user.perm, coll, 'g')) throw new AppError(403, `${C[coll].label} kayıtlarını görme yetkiniz yok`);
}
function canReport(user, key) {
  need(user);
  if (!user.perm.admin && !user.perm.r.includes(key)) throw new AppError(403, `"${P.REPORTS[key] || key}" raporunu görme yetkiniz yok`);
}
function createSession(userId, device) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = nowIso();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, last_seen, device) VALUES (?, ?, ?, ?, ?)').run(token, userId, now, now, String(device || '').slice(0, 100));
  return token;
}
const publicUser = (u) => ({ id: u.id, username: u.username, fullName: u.full_name ?? u.fullName, role: P.normRole(u.role), active: u.active,
  custom: !!u.perms, perm: u.perm || P.effective(u.role, u.perms) });
function validatePassword(pw) { if (String(pw || '').length < 4) throw new AppError(400, 'Şifre en az 4 karakter olmalı'); }

// ---------- Kayıt çıktısı ----------
function outDoc(coll, d, names) {
  const o = { id: d.id };
  for (const [k, v] of Object.entries(d)) if (!k.startsWith('_')) o[k] = v;
  if (d._deleted) o._deleted = true;
  o._u = d._u; o._c = d._c;
  if (names) o._by = names.get(d._by) || null;
  if (C[coll] && C[coll].kind === 'rec') o._x = calc.computedFor(coll, d);
  return o;
}
function schemaOut() {
  const out = {};
  for (const [k, s] of Object.entries(C)) {
    out[k] = { label: s.label, one: s.one, kind: s.kind, icon: s.icon, form: s.form, sort: s.sort, fields: store.fields(k), computed: s.computed || [] };
  }
  return out;
}
function suggestions() {
  const set = (arr) => [...new Set(arr.map((x) => String(x || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const pick = (colls, key) => set(colls.flatMap((c) => store.all(c).map((d) => d[key])));
  return {
    birimler: set(['adet', 'kg', 'L', 'm', 'rulo', 'paket', 'koli', ...store.all('hammadde').map((d) => d.birim), ...store.all('grup').map((d) => d.birim)]),
    firmalar: set([...pick(['satinalma', 'iade', 'cep', 'iskarta'], 'firma'), ...pick(['hammadde'], 'tedarikci'), ...pick(['preformFirma'], 'firma')]),
    preformFirma: pick(['preformFirma'], 'firma'),
    koliAdlari: pick(['koliTipi'], 'ad'),
    fireKalem: set(['Pet Şişe', 'Preform', 'Kapak', 'Etiket', 'Shrink', 'Koli', 'Karton', 'Bardak', 'Folyo', ...pick(['fireTartim'], 'kalem')]),
    paletKisi: pick(['palet'], 'kisi'),
    musteriler: pick(['sevkiyat'], 'musteri'),
    adresler: pick(['sevkiyat'], 'adres'),
    plakalar: pick(['sevkiyat'], 'plaka'),
  };
}

// Silme öncesi bağlılık kontrolü
function checkDelete(coll, id) {
  if (coll === 'grup' && store.all('hammadde').some((d) => d.grup === id)) throw new AppError(400, 'Bu grupta hammadde var. Önce hammaddeleri başka gruba taşıyın veya silin.');
  if (coll === 'alan') {
    const a = store.get('alan', id);
    if (a && a.builtin) return;
  }
}

// ---------- Toplu işlem (tek "geri al" paketi) ----------
function runOps(ops, user, label) {
  if (!Array.isArray(ops) || !ops.length) throw new AppError(400, 'İşlem yok');
  if (ops.length > 5000) throw new AppError(400, 'Tek seferde en fazla 5000 işlem');
  const batch = crypto.randomUUID();
  const o = { batch, label: String(label || '').slice(0, 120) || undefined };
  const out = [];
  store.tx(() => {
    for (const op of ops) {
      canWrite(user, op.coll, op.op);
      if (op.op === 'create') out.push(store.create(op.coll, op.data || {}, user, o).doc.id);
      else if (op.op === 'update') out.push(store.update(op.coll, Number(op.id), op.data || {}, user, o).doc.id);
      else if (op.op === 'delete') { checkDelete(op.coll, Number(op.id)); store.remove(op.coll, Number(op.id), user, o); out.push(Number(op.id)); }
      else throw new AppError(400, 'Geçersiz işlem');
    }
  });
  const ch = db.prepare('SELECT MAX(id) AS id, COUNT(*) AS n FROM changes WHERE batch = ?').get(batch);
  return { ids: out, batch, change: ch.id, n: ch.n };
}

// ---------- Sayım şablonu içe aktarma ----------
function sayimImport(buf, user, tarih, apply) {
  const rows = readXlsx(buf);
  const hi = rows.findIndex((r) => r && String(r[0] || '').trim() === 'KYN Kodu');
  if (hi < 0) throw new AppError(400, 'Şablon tanınmadı. Uygulamadan indirdiğiniz sayım şablonunu kullanın.');
  const head = rows[hi].map((h) => trKey(h));
  const col = (n) => head.indexOf(trKey(n));
  const ci = { kod: col('KYN Kodu'), ad: col('Hammadde'), ana: col('Ana Depo Sayım'), cep: col('Cep Depo Sayım'), asg: col('Asgari Stok') };
  const g = calc.guncel();
  const blank = (v) => v === null || v === undefined || String(v).trim() === '';
  const changes = []; const errors = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const line = i + 1;
    const kod = String(r[ci.kod] ?? '').trim(); const ad = String(r[ci.ad] ?? '').trim();
    if (!kod && !ad) continue;
    const m = (kod && store.findByCode(kod)) || store.all('hammadde').find((d) => trKey(d.ad) === trKey(ad));
    if (!m) { errors.push(`Satır ${line}: "${kod || ad}" bulunamadı`); continue; }
    const cur = g.get(m.id) || { ana: 0, cep: 0 };
    for (const depo of ['ana', 'cep']) {
      if (ci[depo] < 0 || blank(r[ci[depo]])) continue;
      const v = typeof r[ci[depo]] === 'number' ? r[ci[depo]] : parseNum(r[ci[depo]]);
      if (!isFinite(v) || v < 0) { errors.push(`Satır ${line}: ${m.ad} ${depo} sayımı geçersiz`); continue; }
      changes.push({ kind: 'sayim', id: m.id, kod: m.kod, ad: m.ad, birim: m.birim, depo, mevcut: cur[depo], sayilan: v, fark: round(v - cur[depo]) });
    }
    if (ci.asg >= 0 && !blank(r[ci.asg])) {
      const v = typeof r[ci.asg] === 'number' ? r[ci.asg] : parseNum(r[ci.asg]);
      if (isFinite(v) && v >= 0 && Math.abs(v - (m.asgari || 0)) > 1e-9) changes.push({ kind: 'asgari', id: m.id, kod: m.kod, ad: m.ad, eski: m.asgari || 0, yeni: v });
    }
  }
  if (!apply || errors.length) return { applied: false, changes, errors };
  const ops = changes.map((c) => (c.kind === 'sayim'
    ? { op: 'create', coll: 'sayim', data: { tarih, hammadde: c.id, depo: c.depo, sayilan: c.sayilan, aciklama: 'Excel sayım şablonu' } }
    : { op: 'update', coll: 'hammadde', id: c.id, data: { asgari: c.yeni } }));
  if (ops.some((o) => o.coll === 'hammadde') && user.role !== 'admin') throw new AppError(403, 'Asgari stok değişikliği için yönetici olmalısınız');
  const r = ops.length ? runOps(ops, user, `Sayım şablonu içe aktarıldı (${tarih})`) : null;
  return { applied: true, changes, errors, batch: r && r.batch };
}

// ---------- Eski sürümden (1.x) stok aktarma ----------
function v1Info() {
  if (!fs.existsSync(OLD_DB)) return { var: false };
  const old = new DatabaseSync(OLD_DB, { readOnly: true });
  try {
    const depots = old.prepare('SELECT * FROM depots').all();
    const role = (code) => (depots.find((d) => d.code === code) || {}).role || (code === 'CEP' ? 'line' : 'main');
    const prods = old.prepare('SELECT * FROM products').all();
    const st = new Map();
    for (const mv of old.prepare('SELECT product_id, from_depot, to_depot, qty FROM movements').all()) {
      const s = st.get(mv.product_id) || { ana: 0, cep: 0, urun: 0 };
      const add = (d, q) => { if (!d) return; const r = role(d); if (r === 'line') s.cep += q; else if (r === 'product') s.urun += q; else s.ana += q; };
      add(mv.to_depot, mv.qty); add(mv.from_depot, -mv.qty);
      st.set(mv.product_id, s);
    }
    const out = [];
    for (const p of prods) {
      const s = st.get(p.id) || { ana: 0, cep: 0 };
      const m = store.findByCode(p.code) || store.all('hammadde').find((d) => trKey(d.ad) === trKey(p.name));
      out.push({ eskiKod: p.code, ad: p.name, birim: p.unit, ana: round(s.ana), cep: round(s.cep), asgari: p.min_stock || 0, eslesen: m ? { id: m.id, kod: m.kod, ad: m.ad } : null });
    }
    return { var: true, dosya: OLD_DB, urunler: out, hareket: old.prepare('SELECT COUNT(*) AS n FROM movements').get().n };
  } finally { old.close(); }
}
function v1Apply(user, tarih, stok) {
  const info = v1Info();
  if (!info.var) throw new AppError(400, 'Eski sürüm veritabanı bulunamadı');
  const ops = [];
  for (const p of info.urunler) {
    if (!p.eslesen) continue;
    const m = store.get('hammadde', p.eslesen.id);
    const kodlar = String(m.eskiKod || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (p.eskiKod !== m.kod && !kodlar.includes(p.eskiKod)) ops.push({ op: 'update', coll: 'hammadde', id: m.id, data: { eskiKod: [...kodlar, p.eskiKod].join(',') } });
    if (stok) {
      ops.push({ op: 'create', coll: 'sayim', data: { tarih, hammadde: m.id, depo: 'ana', sayilan: Math.max(0, p.ana), aciklama: `Eski sürümden aktarıldı (${p.eskiKod})` } });
      ops.push({ op: 'create', coll: 'sayim', data: { tarih, hammadde: m.id, depo: 'cep', sayilan: Math.max(0, p.cep), aciklama: `Eski sürümden aktarıldı (${p.eskiKod})` } });
    }
  }
  if (!ops.length) return { n: 0 };
  // eskiKod alanı gizli/salt-okunur değil; ama yönetici yetkisi gerekir
  need(user, 'admin');
  return runOps(ops, user, stok ? 'Eski sürümden stok ve kodlar aktarıldı' : 'Eski sürüm kodları eşleştirildi');
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  const user = auth(req, url);
  const q = Object.fromEntries(url.searchParams);
  let mm;
  lastActor = user ? user.fullName : null;

  if (p === '/api/status' && m === 'GET') {
    const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    return send(res, 200, { app: 'DepoTakip', version: VERSION, company: calc.settings().company, needsSetup: n === 0, time: nowIso() });
  }
  if (p === '/api/setup' && m === 'POST') {
    if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) throw new AppError(400, 'Kurulum zaten yapılmış');
    const b = await readJson(req);
    if (!String(b.fullName || '').trim() || !String(b.username || '').trim()) throw new AppError(400, 'Ad soyad ve kullanıcı adı gerekli');
    validatePassword(b.password);
    const r = db.prepare('INSERT INTO users (username, full_name, role, pass_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)')
      .run(String(b.username).trim(), String(b.fullName).trim(), 'admin', hashPassword(b.password), nowIso());
    if (String(b.company || '').trim()) store.setMeta('settings', { ...store.meta('settings', {}), company: String(b.company).trim() });
    const token = createSession(Number(r.lastInsertRowid), b.device);
    log('İlk kurulum tamamlandı, yönetici:', b.username);
    return send(res, 200, { token, user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid))) });
  }
  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req);
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(b.username || '').trim());
    if (!u || !u.active || !verifyPassword(b.password || '', u.pass_hash)) { await new Promise((r) => setTimeout(r, 700)); throw new AppError(401, 'Kullanıcı adı veya şifre hatalı'); }
    return send(res, 200, { token: createSession(u.id, b.device), user: publicUser(u) });
  }
  if (p === '/api/logout' && m === 'POST') { if (user) db.prepare('DELETE FROM sessions WHERE token = ?').run(user.token); return send(res, 200, { ok: true }); }

  need(user);

  if (p === '/api/me' && m === 'GET') return send(res, 200, { user: publicUser(user) });
  if (p === '/api/me/password' && m === 'POST') {
    const b = await readJson(req);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (!verifyPassword(b.oldPassword || '', u.pass_hash)) throw new AppError(400, 'Mevcut şifre hatalı');
    validatePassword(b.newPassword);
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(b.newPassword), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(user.id, user.token);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/events' && m === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    res.write(`event: hello\ndata: ${JSON.stringify({ v: store.version })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // --- Şema, tanımlar, öneriler ---
  if (p === '/api/meta' && m === 'GET') {
    return send(res, 200, { version: VERSION, v: store.version, settings: calc.settings(), roles: ROLES, roleDesc: P.ROLE_DESC, schemas: schemaOut(), user: publicUser(user), sug: suggestions(),
      perm: user.perm, permKat: { reports: P.REPORTS, rec: P.REC, defaults: P.DEFAULTS }, aktarTurler: KI.TURLER });
  }
  if (p === '/api/defs' && m === 'GET') {
    const out = {};
    for (const c of [...DEF_COLLS, 'alan']) out[c] = store.all(c, { withDeleted: true }).map((d) => outDoc(c, d));
    return send(res, 200, { v: store.version, defs: out });
  }

  // --- Genel kayıt işlemleri ---
  if ((mm = p.match(/^\/api\/c\/(\w+)$/))) {
    const coll = mm[1];
    if (!C[coll]) throw new AppError(404, 'Bilinmeyen kayıt türü');
    if (m === 'GET') {
      canView(user, coll);
      let list = store.all(coll);
      if (C[coll].kind === 'rec' && !q.hepsi) { const { from, to } = period(q); list = list.filter((d) => d.tarih >= from && d.tarih < to); }
      if (q.hammadde) list = list.filter((d) => d.hammadde === Number(q.hammadde));
      const names = userNames();
      return send(res, 200, { v: store.version, rows: list.map((d) => outDoc(coll, d, names)) });
    }
    if (m === 'POST') {
      canWrite(user, coll, 'create');
      const b = await readJson(req);
      const r = store.create(coll, b, user, { label: b._label });
      return send(res, 200, { doc: outDoc(coll, r.doc, userNames()), change: r.change });
    }
  }
  if ((mm = p.match(/^\/api\/c\/(\w+)\/(\d+)$/))) {
    const coll = mm[1]; const id = Number(mm[2]);
    if (!C[coll]) throw new AppError(404, 'Bilinmeyen kayıt türü');
    if (m === 'GET') {
      canView(user, coll);
      const d = store.get(coll, id);
      if (!d) throw new AppError(404, 'Kayıt bulunamadı');
      return send(res, 200, { doc: outDoc(coll, d, userNames()), history: store.history({ coll, docId: id, limit: 30 }).rows });
    }
    if (m === 'PUT') {
      canWrite(user, coll, 'update');
      const b = await readJson(req);
      const r = store.update(coll, id, b, user, {});
      return send(res, 200, { doc: outDoc(coll, r.doc, userNames()), change: r.change });
    }
    if (m === 'DELETE') {
      canWrite(user, coll, 'delete');
      checkDelete(coll, id);
      const r = store.remove(coll, id, user, {});
      return send(res, 200, { change: r.change });
    }
  }
  if (p === '/api/batch' && m === 'POST') {
    need(user);
    const b = await readJson(req);
    return send(res, 200, runOps(b.ops, user, b.label));
  }

  // --- Geri al / geçmiş ---
  if (p === '/api/undo' && m === 'POST') {
    const b = await readJson(req);
    let id = Number(b.changeId) || null;
    if (!id) { const last = store.lastUndoable(user.id); if (!last) throw new AppError(400, 'Geri alınacak bir işleminiz yok'); id = last.id; }
    const ch = db.prepare('SELECT * FROM changes WHERE id = ?').get(id);
    if (!ch) throw new AppError(404, 'Değişiklik bulunamadı');
    if (user.role !== 'admin') {
      if (ch.user_id !== user.id) throw new AppError(403, 'Yalnızca kendi işlemlerinizi geri alabilirsiniz');
      const items = db.prepare('SELECT coll FROM changes WHERE batch = ?').all(ch.batch);
      if (items.some((i) => C[i.coll] && C[i.coll].kind !== 'rec')) throw new AppError(403, 'Tanım değişikliklerini yalnızca yönetici geri alabilir');
      if (items.some((i) => !P.has(user.perm, i.coll, 'd') && !P.has(user.perm, i.coll, 's'))) throw new AppError(403, 'Bu kayıt türünde düzenleme / silme yetkiniz yok');
    }
    const r = store.undo(id, user, { force: !!b.force && user.role === 'admin' });
    log(`${user.username}: geri al #${id} (${r.count} değişiklik)`);
    return send(res, 200, r);
  }
  if (p === '/api/history' && m === 'GET') {
    if (!user.perm.admin && user.perm.gecmis === 'yok') return send(res, 200, { total: 0, rows: [], lastUndoable: null, yetkiYok: true });
    if (!user.perm.admin && user.perm.gecmis === 'kendi') q.mine = '1';
    const h = store.history({ limit: Math.min(200, Number(q.limit) || 50), offset: Number(q.offset) || 0, coll: q.coll || undefined, userId: q.mine ? user.id : (q.user || undefined), docId: q.doc || undefined });
    // Kayıt adlarını ekle
    for (const r of h.rows) for (const it of r.items) {
      const d = store.get(it.coll, it.doc_id);
      it.title = d ? docTitle(it.coll, d) : '';
    }
    const last = store.lastUndoable(user.id);
    return send(res, 200, { ...h, lastUndoable: last ? { id: last.id, label: last.label, at: last.at } : null });
  }

  // --- Raporlar ---
  if ((mm = p.match(/^\/api\/r\/(\w+)(?:\/(\d+))?$/)) && m === 'GET') {
    const { ay, from, to, donem } = period(q);
    const k = mm[1];
    const RK = { hammadde: 'hammadde', urun: 'urun', uretim: 'uretim', kullanim: 'kullanim', sevkiyat: 'sevkiyat', durum: 'durum', hareket: 'hareket' };
    if (RK[k]) canReport(user, RK[k]);
    if (k === 'panel' && !user.perm.panel) throw new AppError(403, 'Paneli görme yetkiniz yok');
    if (k === 'durum') return send(res, 200, calc.durum(dateOnly(q.tarih || new Date().toISOString().slice(0, 10), 'Tarih')));
    if (k === 'hareket') return send(res, 200, { ay, donem, rows: calc.hareketler(from, to, q.hammadde ? Number(q.hammadde) : null).reverse().slice(0, 3000).map((e) => ({ ...e, byName: userNames().get(e.by) || '' })) });
    if (k === 'urunkart') {
      const id = Number(mm[2]); const d = store.get('urun', id);
      if (!d) throw new AppError(404, 'Ürün bulunamadı');
      const ub = calc.urunGuncel();
      const ur = calc.urunRaporu(from, to).find((x) => x.id === id) || null;
      if (ur) delete ur._set;
      const ev = calc.productEvents().filter((e) => e.urun === id).slice(-60).reverse().map((e) => ({ t: e.t, kind: e.kind, q: e.q, val: e.val, coll: e.coll, id: e.id, musteri: e.coll === 'sevkiyat' ? (store.get('sevkiyat', e.id) || {}).musteri || '' : '' }));
      return send(res, 200, { ay, doc: outDoc('urun', d), stok: ub.get(id) || 0, ozet: ur, hareketler: ev });
    }
    if (k === 'hammadde') return send(res, 200, { ay, rows: calc.hammaddeRaporu(from, to) });
    if (k === 'urun') return send(res, 200, { ay, rows: calc.urunRaporu(from, to).map(({ _set, ...r }) => r) });
    if (k === 'uretim') return send(res, 200, { ay, ...calc.uretimOzet(from, to) });
    if (k === 'kullanim') return send(res, 200, { ay, rows: calc.kullanimRaporu(from, to, q.urun) });
    if (k === 'sevkiyat') return send(res, 200, { ay, ...calc.sevkiyatRaporu(from, to) });
    if (k === 'panel') return send(res, 200, { ay, ...calc.panel(from, to) });
    if (k === 'guncel') return send(res, 200, { rows: Object.fromEntries(calc.guncel()) });
    if (k === 'kart') {
      const id = Number(mm[2]); const d = store.get('hammadde', id);
      if (!d) throw new AppError(404, 'Hammadde bulunamadı');
      const tum = q.tum === '1';
      return send(res, 200, { ay, doc: outDoc('hammadde', d), guncel: calc.guncel().get(id), ozet: calc.hammaddeRaporu(from, to).find((r) => r.id === id) || null,
        hareketler: calc.hammaddeKarti(id, tum ? null : from, tum ? null : to).slice(0, 500), receteler: store.all('recete').filter((r) => r.hammadde === id).map((r) => ({ id: r.id, urun: r.urun, miktar: r.miktar, birim: r.birim, secim: r.secim, aktif: r.aktif })) });
    }
  }
  if ((mm = p.match(/^\/api\/qr\/(.+)$/)) && m === 'GET') {
    const code = decodeURIComponent(mm[1]).trim();
    const f = store.findAnyCode(code);
    if (!f || (q.tip && f.type !== q.tip)) throw new AppError(404, `"${code}" kodlu ${q.tip === 'urun' ? 'ürün' : q.tip === 'hammadde' ? 'hammadde' : 'hammadde veya ürün'} bulunamadı`);
    return send(res, 200, { id: f.doc.id, type: f.type, kod: f.doc.kod, ad: f.doc.ad });
  }

  // --- Excel çıktıları ---
  if ((mm = p.match(/^\/api\/x\/(\w+)$/)) && m === 'GET') {
    const k = mm[1];
    if (k === 'kayitSablon') {
      const coll = q.coll;
      if (!KI.TURLER[coll]) throw new AppError(404, 'Bu tür için şablon yok');
      return xlsxResponse(res, `Sablon_${(C[coll].label || coll).replace(/[^\wçğıöşüÇĞİÖŞÜ]+/g, '_')}.xlsx`, KI.template(store, coll));
    }
    const per = period(q);
    const { ay, from, to } = per;
    const ctx = { ay, company: calc.settings().company, donem: per.donem };
    const tag = per.tag || X.ayAdi(ay).replace(/\s+/g, '_');
    const one = (sheet, name) => xlsxResponse(res, `${name}_${tag}.xlsx`, X.writeXlsx([sheet]));
    const XK = { hammadde: 'hammadde', takip: 'takip', urun: 'urun', uretim: 'uretim', kullanim: 'kullanim', sevkiyat: 'sevkiyat', anaDepo: 'anaDepo', cepDepo: 'cepDepo', hareket: 'hareket', islem: 'islem', durum: 'durum', aylik: 'genel', genel: 'genel' };
    if (XK[k]) canReport(user, XK[k]);
    if (k === 'sablon' && !P.has(user.perm, 'sayim', 'g')) throw new AppError(403, 'Sayım yetkiniz yok');
    if (k === 'anaDepo') return one(X.anaDepoSheet(calc.hammaddeRaporu(from, to), ctx), 'Ana_Depo');
    if (k === 'cepDepo') return one(X.cepDepoSheet(calc.hammaddeRaporu(from, to), ctx), 'Cep_Depo');
    if (k === 'hareket') return one(X.hareketSheet(calc.hareketler(from, to, q.hammadde ? Number(q.hammadde) : null), ctx, userNames()), 'Hammadde_Hareketleri');
    if (k === 'islem') return one(X.islemSheet(islemListesi(from, to, q.user), ctx), 'Kullanici_Islemleri');
    if (k === 'durum') {
      const t = dateOnly(q.tarih || new Date().toISOString().slice(0, 10), 'Tarih');
      return xlsxResponse(res, `Stok_Durumu_${t}.xlsx`, X.writeXlsx(X.durumSheet(calc.durum(t), ctx)));
    }
    if (k === 'hammadde') return one(X.hammaddeSheet(calc.hammaddeRaporu(from, to), ctx), 'Hammadde_Stok');
    if (k === 'takip') return one(X.takipSheet(calc.hammaddeRaporu(from, to), ctx), 'Aylik_Takip');
    if (k === 'urun') return one(X.urunSheet(calc.urunRaporu(from, to), ctx), 'Urun_Stok');
    if (k === 'uretim') return one(X.uretimOzetSheet(calc.uretimOzet(from, to), ctx), 'Uretim_Ozeti');
    if (k === 'kullanim') return one(X.kullanimSheet(calc.kullanimRaporu(from, to), ctx), 'Recete_Kullanimi');
    if (k === 'sevkiyat') return one(X.sevkiyatSheet(calc.sevkiyatRaporu(from, to), ctx), 'Sevkiyat');
    if (k === 'liste') {
      const coll = q.coll; if (!C[coll] || C[coll].kind === 'sys') throw new AppError(404, 'Bilinmeyen liste');
      canView(user, coll);
      let list = store.all(coll);
      const rec = C[coll].kind === 'rec';
      if (rec) list = list.filter((d) => d.tarih >= from && d.tarih < to).sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : a.id - b.id));
      const names = userNames();
      const docs = list.map((d) => ({ ...d, _byName: names.get(d._by) || '' }));
      const sh = X.listeSheet(store, calc, coll, docs, rec ? ctx : { company: ctx.company }, C[coll].label);
      return xlsxResponse(res, `${C[coll].label.replace(/[^\wçğıöşüÇĞİÖŞÜ]+/g, '_')}${rec ? '_' + tag : ''}.xlsx`, X.writeXlsx([sh]));
    }
    if (k === 'aylik' || k === 'genel') {
      const names = userNames();
      const hr = calc.hammaddeRaporu(from, to);
      const sheets = [X.hammaddeSheet(hr, ctx), X.anaDepoSheet(hr, ctx), X.cepDepoSheet(hr, ctx), X.takipSheet(hr, ctx), X.urunSheet(calc.urunRaporu(from, to), ctx),
        X.uretimOzetSheet(calc.uretimOzet(from, to), ctx), X.kullanimSheet(calc.kullanimRaporu(from, to), ctx), X.sevkiyatSheet(calc.sevkiyatRaporu(from, to), ctx),
        X.hareketSheet(calc.hareketler(from, to), ctx, names)];
      if (user.perm.admin || user.perm.r.includes('islem')) sheets.push(X.islemSheet(islemListesi(from, to), ctx));
      for (const coll of ['uretim', 'satinalma', 'cep', 'iade', 'iskarta', 'sayim', 'sevkiyat']) {
        const docs = store.all(coll).filter((d) => d.tarih >= from && d.tarih < to).sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : a.id - b.id)).map((d) => ({ ...d, _byName: names.get(d._by) || '' }));
        sheets.push(X.listeSheet(store, calc, coll, docs, ctx, C[coll].label));
      }
      return xlsxResponse(res, `${k === 'genel' ? 'Genel_Yonetici_Raporu' : 'Depo_Aylik_Rapor'}_${tag}.xlsx`, X.writeXlsx(sheets));
    }
    if (k === 'sablon') return xlsxResponse(res, `Sayim_Sablonu_${new Date().toISOString().slice(0, 10)}.xlsx`, X.writeXlsx(X.sayimSablonu(store, calc)));
    throw new AppError(404, 'Bilinmeyen rapor');
  }

  // --- İçe aktarma ---
  if (p === '/api/import/excel' && m === 'POST') {
    need(user, 'admin');
    const buf = await readBody(req, 40 * 1024 * 1024);
    let pkg;
    try { pkg = XI.parse(buf); } catch (e) { throw new AppError(400, 'Excel dosyası okunamadı: ' + e.message); }
    const son = XI.nextMonth(pkg.ayBas);
    const mevcut = {};
    for (const c of ['uretim', 'satinalma', 'iade', 'iskarta', 'cep', 'sevkiyat']) mevcut[c] = store.all(c).filter((d) => d.tarih >= pkg.ayBas && d.tarih < son).length;
    const info = { ozet: pkg.ozet, ay: pkg.ay, uyarilar: pkg.uyarilar, duzeltilen: pkg.duzeltilen, pasif: pkg.pasif, mevcut,
      yeniHammadde: pkg.hammaddeler.filter((x) => !store.all('hammadde').some((d) => trKey(d.ad) === trKey(x.ad))).map((x) => x.ad) };
    if (q.apply !== '1') return send(res, 200, { preview: true, ...info });
    const opts = { tanimlar: q.tanimlar === '1', kayitlar: q.kayitlar !== '0', devir: q.devir !== '0', ayiTemizle: q.temizle === '1' };
    backup('ice-aktarma-oncesi');
    const r = XI.apply(store, pkg, user, opts);
    log(`${user.username}: Excel içe aktarıldı ${pkg.ay} (${r.olusan} yeni, ${r.guncellenen} güncelleme, ${r.silinen} silme)`);
    const ch = db.prepare('SELECT MAX(id) AS id FROM changes WHERE batch = ?').get(r.batch);
    return send(res, 200, { applied: true, ...info, sonuc: r, change: ch.id, uyarilar: pkg.uyarilar });
  }
  if (p === '/api/import/sayim' && m === 'POST') {
    if (!P.has(user.perm, 'sayim', 'e')) throw new AppError(403, 'Sayım girme yetkiniz yok');
    const buf = await readBody(req, 20 * 1024 * 1024);
    const tarih = dateOnly(q.tarih || new Date().toISOString().slice(0, 10), 'Sayım tarihi');
    return send(res, 200, sayimImport(buf, user, tarih, q.apply === '1'));
  }
  if (p === '/api/import/kayit' && m === 'POST') {
    const coll = q.coll;
    if (!KI.TURLER[coll]) throw new AppError(404, 'Bu tür Excel\'den yüklenemez');
    if (!user.perm.admin && !user.perm.aktar) throw new AppError(403, 'Excel\'den kayıt yükleme yetkiniz yok');
    canWrite(user, coll, 'create');
    const buf = await readBody(req, 30 * 1024 * 1024);
    const a = KI.analyze(store, coll, buf);
    if (q.rapor === '1') return xlsxResponse(res, `Yukleme_Raporu_${coll}.xlsx`, KI.errorReport(a, q.hepsi === '1'));
    const view = { ...a, rows: a.rows.slice(0, 1000).map(({ raw, data, ...r }) => ({ ...r, raw: raw.map((v) => (v === undefined ? null : v)) })) };
    if (q.apply !== '1') return send(res, 200, { preview: true, ...view });
    if (a.hatali && q.atla !== '1') throw new AppError(400, `${a.hatali} hatalı satır var. Düzeltip yeniden yükleyin veya "hatalı satırları atla" seçeneğini işaretleyin.`);
    const list = KI.ops(store, a);
    if (!list.length) throw new AppError(400, 'Yüklenecek geçerli satır yok');
    backup('kayit-yukleme-oncesi');
    const r = runOps(list, user, `Excel'den yüklendi: ${KI.TURLER[coll]} (${list.length} kayıt)`);
    log(`${user.username}: Excel'den ${list.length} ${coll} kaydı yüklendi`);
    return send(res, 200, { applied: true, ...view, sonuc: { n: list.length }, change: r.change });
  }
  if (p === '/api/v1' && m === 'GET') { need(user, 'admin'); return send(res, 200, v1Info()); }
  if (p === '/api/v1' && m === 'POST') {
    need(user, 'admin');
    const b = await readJson(req);
    return send(res, 200, v1Apply(user, dateOnly(b.tarih || new Date().toISOString().slice(0, 10), 'Tarih'), b.stok !== false));
  }

  // --- Kullanıcılar ---
  if (p === '/api/users' && m === 'GET') { need(user, 'admin'); return send(res, 200, db.prepare('SELECT * FROM users ORDER BY active DESC, full_name').all().map(publicUser)); }
  if (p === '/api/users/islem' && m === 'GET') {
    canReport(user, 'islem');
    const { from, to } = period(q);
    return send(res, 200, { rows: islemListesi(from, to, q.user).slice(0, 2000) });
  }
  if (p === '/api/users' && m === 'POST') {
    need(user, 'admin');
    const b = await readJson(req);
    if (!String(b.fullName || '').trim() || !String(b.username || '').trim()) throw new AppError(400, 'Ad soyad ve kullanıcı adı gerekli');
    if (!ROLES[b.role]) throw new AppError(400, 'Geçersiz rol');
    validatePassword(b.password);
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(String(b.username).trim())) throw new AppError(409, 'Bu kullanıcı adı alınmış');
    const perms = b.perms && b.role !== 'admin' ? JSON.stringify(P.clean(b.perms, b.role)) : null;
    db.prepare('INSERT INTO users (username, full_name, role, pass_hash, active, created_at, perms) VALUES (?, ?, ?, ?, 1, ?, ?)').run(String(b.username).trim(), String(b.fullName).trim(), b.role, hashPassword(b.password), nowIso(), perms);
    log(`${user.username}: kullanıcı eklendi ${b.username} (${ROLES[b.role]})`);
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/users\/(\d+)$/)) && m === 'PUT') {
    need(user, 'admin');
    const id = Number(mm[1]); const b = await readJson(req);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!u) throw new AppError(404, 'Kullanıcı bulunamadı');
    if (id === user.id && (b.active === false || (b.role && b.role !== 'admin'))) throw new AppError(400, 'Kendi hesabınızı pasif yapamaz veya yetkisini düşüremezsiniz');
    if (b.fullName !== undefined) db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(String(b.fullName).trim() || u.full_name, id);
    if (b.role !== undefined) { if (!ROLES[b.role]) throw new AppError(400, 'Geçersiz rol'); db.prepare('UPDATE users SET role = ? WHERE id = ?').run(b.role, id); }
    if (b.perms !== undefined) {
      const role = b.role || P.normRole(u.role);
      db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(b.perms && role !== 'admin' ? JSON.stringify(P.clean(b.perms, role)) : null, id);
    }
    if (b.active !== undefined) { db.prepare('UPDATE users SET active = ? WHERE id = ?').run(b.active ? 1 : 0, id); if (!b.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); }
    if (b.password) { validatePassword(b.password); db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(b.password), id); db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); }
    log(`${user.username}: kullanıcı güncellendi ${u.username}`);
    broadcast('change', { colls: ['*'], v: store.version, user: id });
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/users\/(\d+)$/)) && m === 'DELETE') {
    need(user, 'admin');
    const id = Number(mm[1]);
    if (id === user.id) throw new AppError(400, 'Kendi hesabınızı silemezsiniz');
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!u) throw new AppError(404, 'Kullanıcı bulunamadı');
    const iz = db.prepare('SELECT COUNT(*) AS n FROM changes WHERE user_id = ?').get(id).n;
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    if (iz) {
      // İşlem geçmişi korunur: hesap silinmez, kapatılır ve adı işaretlenir
      db.prepare("UPDATE users SET active = 0, username = username || '#silindi' || id, full_name = full_name || ' (silindi)' WHERE id = ?").run(id);
      log(`${user.username}: kullanıcı silindi (geçmiş korundu) ${u.username}`);
      return send(res, 200, { ok: true, korundu: iz });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    log(`${user.username}: kullanıcı silindi ${u.username}`);
    return send(res, 200, { ok: true });
  }

  // --- Ayarlar / sistem ---
  if (p === '/api/settings' && m === 'PUT') {
    need(user, 'admin');
    const b = await readJson(req);
    const cur = store.meta('settings', {});
    const next = { ...cur };
    if (b.company !== undefined) next.company = String(b.company).trim() || 'Depo Takip';
    for (const k of ['kgTir', 'paletTir', 'koliTir']) if (b[k] !== undefined) { const v = parseNum(b[k]); if (!(v > 0)) throw new AppError(400, 'Tır değerleri sıfırdan büyük olmalı'); next[k] = v; }
    store.setMeta('settings', next);
    return send(res, 200, { ok: true, settings: calc.settings() });
  }
  if (p === '/api/server-info' && m === 'GET') {
    const backups = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort().reverse() : [];
    return send(res, 200, {
      version: VERSION, port: PORT, hostname: os.hostname(), addresses: lanAddresses().map((a) => ({ ...a, url: `http://${a.address}:${PORT}` })),
      dataDir: DATA_DIR, dbFile: DB_FILE, backupDir: BACKUP_DIR, backupCount: backups.length, lastBackup: backups[0] || null, clients: clients.size,
      kayit: db.prepare('SELECT COUNT(*) AS n FROM docs WHERE deleted = 0').get().n, degisiklik: db.prepare('SELECT COUNT(*) AS n FROM changes').get().n, eskiSurum: fs.existsSync(OLD_DB),
    });
  }
  if (p === '/api/backup' && m === 'POST') { need(user, 'admin'); const f = backup('elle'); log(`${user.username}: elle yedek alındı ${f}`); return send(res, 200, { file: f }); }
  if (p === '/api/backup/download' && m === 'GET') {
    need(user, 'admin');
    const f = backup('indirilen');
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${path.basename(f)}"`, 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(f));
  }
  throw new AppError(404, 'Bulunamadı');
}

// Kullanıcı işlem raporu: değişiklik tablosundan, tarih aralığında
function islemListesi(from, to, uid) {
  const fromIso = new Date(from + 'T00:00:00').toISOString(); const toIso = new Date(to + 'T00:00:00').toISOString();
  const rows = db.prepare(`SELECT c.*, u.full_name FROM changes c LEFT JOIN users u ON u.id = c.user_id WHERE c.at >= ? AND c.at < ? ${uid ? 'AND c.user_id = ?' : ''} ORDER BY c.id DESC LIMIT 20000`).all(...[fromIso, toIso, ...(uid ? [Number(uid)] : [])]);
  const ACT = { create: 'Ekleme', update: 'Düzenleme', delete: 'Silme', undo: 'Geri alma' };
  return rows.map((r) => {
    const b = r.before ? JSON.parse(r.before) : null; const a = r.after ? JSON.parse(r.after) : null;
    let islem = ACT[r.action] || r.action;
    if (r.action === 'update' && b && a && b.deleted !== a.deleted) islem = a.deleted ? 'Silme' : 'Geri getirme';
    let alanlar = '';
    if (b && a && (r.action === 'update' || r.action === 'undo')) {
      const fl = store.fields(r.coll);
      const keys = [...new Set([...Object.keys(b.data || {}), ...Object.keys(a.data || {})])].filter((k) => JSON.stringify((b.data || {})[k]) !== JSON.stringify((a.data || {})[k]));
      alanlar = keys.map((k) => { const f = fl.find((x) => x.k === k); const v = (x) => (x === undefined || x === null ? '(boş)' : typeof x === 'object' ? JSON.stringify(x) : String(x)); return `${f ? f.l : k}: ${v((b.data || {})[k])} → ${v((a.data || {})[k])}`; }).join(' · ');
    }
    const d = store.get(r.coll, r.doc_id);
    return { at: r.at, user: r.full_name || '', userId: r.user_id, islem, tur: (C[r.coll] || {}).label || r.coll, kayit: d ? docTitle(r.coll, d) : '#' + r.doc_id, alanlar, label: r.label, geriAlindi: !!r.undone_by };
  });
}

function docTitle(coll, d) {
  const mat = (id) => (store.get('hammadde', id) || {}).ad || '';
  const ur = (id) => (store.get('urun', id) || {}).ad || '';
  const tr = (s) => (s ? s.split('-').reverse().join('.') : '');
  switch (coll) {
    case 'hammadde': return `${d.kod || ''} ${d.ad || ''}`.trim();
    case 'recete': return `${ur(d.urun)} → ${mat(d.hammadde)}`;
    case 'kapasite': return `${(store.get('hat', d.hat) || {}).ad || ''} / ${ur(d.urun)}`;
    case 'koliTipi': case 'paletTipi': case 'preformFirma': return `${ur(d.urun)} · ${d.ad || d.palet || d.firma || ''}`;
    case 'uretim': return `${tr(d.tarih)} ${ur(d.urun)} ${(store.get('vardiya', d.vardiya) || {}).ad || ''}`;
    case 'sevkiyat': return `${tr(d.tarih)} sevkiyat${d.musteri ? ' · ' + d.musteri : ''}${d.irsNo ? ' · ' + d.irsNo : ''}`;
    case 'urun': return `${d.kod || ''} ${d.ad || ''}`.trim();
    case 'urunSayim': return `${tr(d.tarih)} ${ur(d.urun)}`;
    case 'fireTartim': return `${tr(d.tarih)} ${d.kalem || ''} ${d.kg || ''} kg`;
    case 'palet': return `${tr(d.tarih)} ${d.kisi || ''}`;
    case 'alan': return `${(C[d.coll] || {}).label || d.coll}: ${d.l}`;
    default: return d.hammadde ? `${tr(d.tarih)} ${mat(d.hammadde)} ${d.miktar ?? d.sayilan ?? ''}`.trim() : (d.ad || d.firma || '');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url.pathname);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) log('HATA', req.method, url.pathname, e.stack || e.message);
    if (!res.headersSent) send(res, status, { error: status >= 500 ? 'Sunucu hatası: ' + e.message : e.message });
    else res.end();
  }
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { log(`Port ${PORT} kullanımda. Sunucu zaten çalışıyor olabilir.`); process.exit(2); }
  throw e;
});
server.listen(PORT, '0.0.0.0', () => {
  log(`Depo Takip ${VERSION} çalışıyor → http://localhost:${PORT}`);
  for (const a of lanAddresses()) log(`  Telefon bağlantı adresi (${a.name}): http://${a.address}:${PORT}`);
  log('  Veri klasörü:', DATA_DIR);
  scheduleBackups();
});
function shutdown() { log('Sunucu kapatılıyor'); try { db.close(); } catch (e) { /* yoksay */ } process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
