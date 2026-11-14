'use strict';
// Depo Takip — yerel ağ sunucusu (Node.js 22.13+ / 24, harici paket gerektirmez)
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const D = require('./db');
const { writeXlsx, readXlsx } = require('./xlsx');

const VERSION = '1.0.0';
const PORT = Number(process.env.DEPO_PORT) || 8765;
const DATA_DIR = process.env.DEPO_DATA_DIR ||
  (process.platform === 'win32' ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'DepoTakip') : path.join(__dirname, '..', 'data'));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BACKUP_DIR = path.join(DATA_DIR, 'yedekler');
const LOG_FILE = path.join(DATA_DIR, 'sunucu.log');

const { db, file: DB_FILE } = D.open(DATA_DIR);
const { AppError } = D;

function log(...a) {
  const line = new Date().toLocaleString('tr-TR') + ' ' + a.join(' ');
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + os.EOL); } catch (e) { /* yoksay */ }
}

// ---------- Canlı güncelleme (Server-Sent Events) ----------
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`;
  for (const c of clients) { try { c.write(msg); } catch (e) { clients.delete(c); } }
}
setInterval(() => { for (const c of clients) { try { c.write(': ping\n\n'); } catch (e) { clients.delete(c); } } }, 25000);

// ---------- Yedekleme ----------
function backup(tag = 'otomatik') {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  const target = path.join(BACKUP_DIR, `depo-${stamp}-${tag}.db`);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('depo-') && f.endsWith('-otomatik.db')).sort();
  while (all.length > 60) fs.unlinkSync(path.join(BACKUP_DIR, all.shift()));
  return target;
}
function scheduleBackups() {
  const last = db.prepare("SELECT value FROM meta WHERE key='last_backup'").get();
  const due = !last || Date.now() - Date.parse(last.value) > 12 * 3600000;
  if (due) {
    try { const f = backup(); db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_backup', ?)").run(D.nowIso()); log('Yedek alındı:', f); } catch (e) { log('Yedek hatası:', e.message); }
  }
}
setInterval(scheduleBackups, 3600000);

// ---------- Yardımcılar ----------
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push({ name, address: a.address });
    }
  }
  // Wi-Fi / Ethernet adaptörlerini öne al, sanal adaptörleri sona at
  const score = (n) => (/vmware|virtual|vbox|hyper-v|vethernet|docker|wsl|tailscale|zerotier|loopback/i.test(n) ? 1 : 0);
  out.sort((a, b) => score(a.name) - score(b.name));
  return out;
}

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': isBuf ? 'application/octet-stream' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new AppError(413, 'Dosya çok büyük')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const b = await readBody(req, 4 * 1024 * 1024);
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

function company() { return (db.prepare("SELECT value FROM meta WHERE key='company'").get() || {}).value || 'Depo Takip'; }
function trDate(iso) { return iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : ''; }
function trDay(iso) { return iso ? new Date(iso).toLocaleDateString('tr-TR') : ''; }
const STATUS_TR = { NORMAL: 'Normal', KRITIK: 'Kritik', TUKENDI: 'Tükendi', TRANSFER: 'Cep depoya transfer gerekli' };

// ---------- Oturum ----------
function auth(req, url) {
  let token = null;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) token = h.slice(7);
  if (!token) token = url.searchParams.get('t');
  if (!token) return null;
  const s = db.prepare(`SELECT s.token, s.last_seen, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  if (!s || !s.active) return null;
  if (Date.now() - Date.parse(s.last_seen) > 30 * 86400000) { db.prepare('DELETE FROM sessions WHERE token = ?').run(token); return null; }
  if (Date.now() - Date.parse(s.last_seen) > 60000) db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?').run(D.nowIso(), token);
  return { id: s.id, username: s.username, fullName: s.full_name, role: s.role, token };
}
function need(user, ...roles) {
  if (!user) throw new AppError(401, 'Oturum açmanız gerekiyor');
  if (roles.length && !roles.includes(user.role)) throw new AppError(403, 'Bu işlem için yetkiniz yok');
}
function createSession(userId, device) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = D.nowIso();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, last_seen, device) VALUES (?, ?, ?, ?, ?)').run(token, userId, now, now, String(device || '').slice(0, 100));
  return token;
}
function publicUser(u) { return { id: u.id, username: u.username, fullName: u.full_name ?? u.fullName, role: u.role, active: u.active }; }

function validatePassword(pw) {
  if (String(pw || '').length < 4) throw new AppError(400, 'Şifre en az 4 karakter olmalı');
}

// ---------- Raporlar → Excel ----------
function stockSheet() {
  const rows = D.listProducts(db).map((p) => [p.code, p.name, p.cat_name, p.unit, p.ham, p.cep, { v: p.total, alert: p.status !== 'NORMAL' },
    p.min_stock || null, p.cep_min || null, STATUS_TR[p.status], p.daily_use || null, p.days_left, trDate(p.last_at)]);
  return { name: 'Stok Durumu', title: `${company()} — Stok Durumu`, subtitle: `Rapor tarihi: ${new Date().toLocaleString('tr-TR')}`,
    columns: [
      { header: 'KYN Kodu', width: 15 }, { header: 'Ürün Adı', width: 40 }, { header: 'Kategori', width: 24 }, { header: 'Birim', width: 8 },
      { header: 'Ham Depo', width: 13, type: 'num' }, { header: 'Cep Depo', width: 13, type: 'num' }, { header: 'Toplam', width: 13, type: 'num' },
      { header: 'Asgari Stok', width: 12, type: 'num' }, { header: 'Cep Asgari', width: 12, type: 'num' }, { header: 'Durum', width: 26 },
      { header: 'Günlük Ort. Tüketim (30 gün)', width: 16, type: 'num' }, { header: 'Tahmini Yeterlilik (gün)', width: 14, type: 'int' },
      { header: 'Son Hareket', width: 17 },
    ], rows };
}
function movementSheet(filters) {
  const { rows } = D.listMovements(db, { ...filters, limit: 20000 });
  const r = rows.map((m) => [trDate(m.created_at), D.TYPES[m.type] || m.type, m.product_code, m.product_name,
    m.from_depot ? D.DEPOTS[m.from_depot] : '', m.to_depot ? D.DEPOTS[m.to_depot] : '',
    (m.to_depot && !m.from_depot ? 1 : m.from_depot && !m.to_depot ? -1 : 1) * m.qty, m.unit,
    m.counted, m.doc_no, m.supplier, m.lot_no, m.note, m.user_name,
    m.cancelled_by ? `İptal edildi (#${m.cancelled_by})` : m.cancels_id ? `#${m.cancels_id} iptali` : '', m.id]);
  return { name: 'Hareketler', title: `${company()} — Stok Hareketleri`,
    subtitle: `${filters.from ? trDay(filters.from) : 'Başlangıç'} – ${filters.to ? trDay(new Date(Date.parse(filters.to) - 1).toISOString()) : 'Bugün'} · ${rows.length} kayıt`,
    columns: [
      { header: 'Tarih', width: 17 }, { header: 'İşlem', width: 17 }, { header: 'KYN Kodu', width: 15 }, { header: 'Ürün', width: 36 },
      { header: 'Çıkan Depo', width: 11 }, { header: 'Giren Depo', width: 11 }, { header: 'Miktar (+giriş / −çıkış)', width: 14, type: 'num' },
      { header: 'Birim', width: 7 }, { header: 'Sayılan', width: 10, type: 'num' }, { header: 'Belge / İrsaliye', width: 15 },
      { header: 'Tedarikçi', width: 18 }, { header: 'Parti / Lot', width: 12 }, { header: 'Açıklama', width: 30 }, { header: 'Kullanıcı', width: 16 },
      { header: 'İptal Durumu', width: 18 }, { header: 'Kayıt No', width: 9, type: 'int' },
    ], rows: r };
}
function periodSheet(from, to, categoryId) {
  const rows = D.periodReport(db, from, to, categoryId).map((r) => [r.code, r.name, r.cat_name, r.unit, r.opening, r.giris, r.transfer_cep,
    r.uretim, r.iade, r.fire, r.fire_rate, r.sayim, { v: r.closing, alert: r.min_stock > 0 && r.closing <= r.min_stock }]);
  return { name: 'Dönem Raporu', title: `${company()} — Dönem Hareket Raporu`,
    subtitle: `${trDay(from)} – ${trDay(new Date(Date.parse(to) - 1).toISOString())}`,
    columns: [
      { header: 'KYN Kodu', width: 15 }, { header: 'Ürün Adı', width: 38 }, { header: 'Kategori', width: 22 }, { header: 'Birim', width: 7 },
      { header: 'Dönem Başı', width: 13, type: 'num' }, { header: 'Depo Girişi', width: 13, type: 'num' }, { header: 'Cep Depoya Transfer', width: 13, type: 'num' },
      { header: 'Üretime Verilen', width: 13, type: 'num' }, { header: 'Üretimden İade', width: 12, type: 'num' }, { header: 'Fire', width: 11, type: 'num' },
      { header: 'Fire Oranı %', width: 10, type: 'num' }, { header: 'Sayım Farkı', width: 11, type: 'num' }, { header: 'Dönem Sonu', width: 13, type: 'num' },
    ], rows };
}
function alertSheet() {
  const rows = D.listProducts(db).filter((p) => p.status !== 'NORMAL').map((p) => [p.code, p.name, p.unit, STATUS_TR[p.status], p.ham, p.cep, p.total,
    p.min_stock || null, p.cep_min || null, p.min_stock > 0 ? D.round(Math.max(0, p.min_stock - p.total)) : null, p.days_left]);
  return { name: 'Stok Uyarıları', title: `${company()} — Asgari Stok Uyarıları`, subtitle: new Date().toLocaleString('tr-TR'),
    columns: [{ header: 'KYN Kodu', width: 15 }, { header: 'Ürün Adı', width: 40 }, { header: 'Birim', width: 7 }, { header: 'Durum', width: 26 },
      { header: 'Ham Depo', width: 12, type: 'num' }, { header: 'Cep Depo', width: 12, type: 'num' }, { header: 'Toplam', width: 12, type: 'num' },
      { header: 'Asgari Stok', width: 12, type: 'num' }, { header: 'Cep Asgari', width: 12, type: 'num' }, { header: 'Asgariye Eksik', width: 13, type: 'num' },
      { header: 'Tahmini Yeterlilik (gün)', width: 14, type: 'int' }], rows };
}
const TEMPLATE_HEADERS = ['KYN Kodu', 'Ürün Adı', 'Kategori Kodu', 'Birim', 'Ham Depo Sayım', 'Cep Depo Sayım', 'Asgari Stok (Toplam)', 'Cep Asgari', 'Tedarikçi', 'Mevcut Ham (bilgi)', 'Mevcut Cep (bilgi)'];
function templateSheet() {
  const rows = D.listProducts(db).map((p) => [p.code, p.name, p.cat_code, p.unit, null, null, p.min_stock || null, p.cep_min || null, p.supplier || null, p.ham, p.cep]);
  const cats = db.prepare('SELECT code, name, unit FROM categories ORDER BY sort').all().map((c) => [c.code, c.name, c.unit]);
  return [
    { name: 'Stok ve Asgari Seviye', columns: TEMPLATE_HEADERS.map((h, i) => ({ header: h, width: [15, 40, 13, 8, 15, 15, 17, 12, 20, 15, 15][i], type: i >= 4 && i !== 8 ? 'num' : undefined })), rows },
    { name: 'Kategori Kodları', columns: [{ header: 'Kategori Kodu', width: 14 }, { header: 'Kategori', width: 30 }, { header: 'Varsayılan Birim', width: 16 }], rows: cats },
    { name: 'Açıklama', columns: [{ header: 'Nasıl doldurulur?', width: 110 }], rows: [
      ['1) "Ham Depo Sayım" ve "Cep Depo Sayım" sütunlarına depoda fiilen saydığınız miktarı yazın. Boş bırakılan hücreler değiştirilmez.'],
      ['2) Sistem, sayılan miktar ile mevcut stok arasındaki farkı "Sayım Düzeltme" hareketi olarak kaydeder (ilk kurulumda açılış stoğu olur).'],
      ['3) "Asgari Stok (Toplam)" iki deponun toplamı için alt sınırdır. "Cep Asgari" ise Cep Depo için alt sınırdır; altına inince transfer uyarısı verilir.'],
      ['4) Yeni hammadde eklemek için en alta satır ekleyin: KYN Kodu BOŞ kalsın, Ürün Adı ve Kategori Kodu (2. sayfadaki listeden) dolu olsun. Kod otomatik verilir.'],
      ['5) "Mevcut" sütunları yalnızca bilgi içindir, dikkate alınmaz. Sütun başlıklarını ve sırasını değiştirmeyin.'],
      ['6) Dosyayı uygulamada Ayarlar → Excel\'den İçe Aktar bölümünden yükleyin. Önce önizleme gösterilir, onaylarsanız kaydedilir.'],
    ] },
  ];
}

function importFile(buf, user, apply) {
  const rows = readXlsx(buf);
  const hi = rows.findIndex((r) => r && String(r[0] || '').trim() === 'KYN Kodu' && String(r[1] || '').trim() === 'Ürün Adı');
  if (hi < 0) throw new AppError(400, 'Şablon tanınmadı. Lütfen uygulamadan indirdiğiniz Excel şablonunu kullanın.');
  const head = rows[hi].map((h) => String(h || '').trim());
  const col = (name) => head.indexOf(name);
  const C = Object.fromEntries(TEMPLATE_HEADERS.map((h) => [h, col(h)]));
  const changes = [];
  const errors = [];
  const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
  const numOrErr = (v, label, line) => { try { return D.num(v); } catch (e) { errors.push(`Satır ${line}: ${label} geçersiz (${v})`); return null; } };
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const line = i + 1;
    const code = String(r[C['KYN Kodu']] || '').trim();
    const name = String(r[C['Ürün Adı']] || '').trim();
    if (!code && !name) continue;
    let p = code ? D.getProduct(db, code) : null;
    if (code && !p) { errors.push(`Satır ${line}: ${code} kodlu ürün bulunamadı`); continue; }
    if (!p) {
      const catCode = String(r[C['Kategori Kodu']] || '').trim().toUpperCase();
      const cat = db.prepare('SELECT * FROM categories WHERE code = ?').get(catCode);
      if (!cat) { errors.push(`Satır ${line}: "${name}" için geçerli bir Kategori Kodu yazılmalı`); continue; }
      const exists = db.prepare('SELECT code FROM products WHERE lower(name) = lower(?)').get(name);
      if (exists) { errors.push(`Satır ${line}: "${name}" zaten var (${exists.code}); kod sütununu doldurun`); continue; }
      changes.push({ line, kind: 'YENI', name, catCode, unit: String(r[C['Birim']] || '').trim() || cat.unit,
        minStock: isBlank(r[C['Asgari Stok (Toplam)']]) ? 0 : numOrErr(r[C['Asgari Stok (Toplam)']], 'Asgari stok', line),
        cepMin: isBlank(r[C['Cep Asgari']]) ? 0 : numOrErr(r[C['Cep Asgari']], 'Cep asgari', line),
        supplier: String(r[C['Tedarikçi']] || '').trim(),
        ham: isBlank(r[C['Ham Depo Sayım']]) ? null : numOrErr(r[C['Ham Depo Sayım']], 'Ham sayım', line),
        cep: isBlank(r[C['Cep Depo Sayım']]) ? null : numOrErr(r[C['Cep Depo Sayım']], 'Cep sayım', line) });
      continue;
    }
    const upd = {};
    const ms = r[C['Asgari Stok (Toplam)']], cm = r[C['Cep Asgari']], sp = C['Tedarikçi'] >= 0 ? r[C['Tedarikçi']] : null;
    if (!isBlank(ms)) { const v = numOrErr(ms, 'Asgari stok', line); if (v !== null && v !== p.min_stock) upd.min_stock = v; }
    if (!isBlank(cm)) { const v = numOrErr(cm, 'Cep asgari', line); if (v !== null && v !== p.cep_min) upd.cep_min = v; }
    if (!isBlank(sp) && String(sp).trim() !== (p.supplier || '')) upd.supplier = String(sp).trim();
    if (Object.keys(upd).length) changes.push({ line, kind: 'AYAR', code: p.code, name: p.name, upd, before: { min_stock: p.min_stock, cep_min: p.cep_min } });
    for (const [d, key] of [['HAM', 'Ham Depo Sayım'], ['CEP', 'Cep Depo Sayım']]) {
      const v = r[C[key]];
      if (isBlank(v)) continue;
      const counted = numOrErr(v, key, line);
      if (counted === null) continue;
      const current = d === 'HAM' ? p.ham : p.cep;
      if (Math.abs(counted - current) > 1e-9) {
        if (p.unit === 'adet' && Math.abs(counted - Math.round(counted)) > 1e-9) { errors.push(`Satır ${line}: ${p.name} adet ile takip ediliyor, küsurat olamaz`); continue; }
        changes.push({ line, kind: 'SAYIM', code: p.code, name: p.name, unit: p.unit, depot: d, current, counted, delta: D.round(counted - current) });
      }
    }
  }
  if (!apply || errors.length) return { applied: false, changes, errors };
  db.exec('BEGIN IMMEDIATE');
  try {
    const now = D.nowIso();
    for (const c of changes) {
      if (c.kind === 'YENI') {
        const id = D.insertProduct(db, { categoryCode: c.catCode, name: c.name, unit: c.unit, minStock: c.minStock, cepMin: c.cepMin, supplier: c.supplier }, user.id, now);
        c.code = db.prepare('SELECT code FROM products WHERE id = ?').get(id).code;
        for (const [d, v] of [['HAM', c.ham], ['CEP', c.cep]]) {
          if (v && v > 0) db.prepare(`INSERT INTO movements (uuid, type, product_id, qty, to_depot, counted, note, user_id, created_at) VALUES (?, 'SAYIM', ?, ?, ?, ?, ?, ?, ?)`)
            .run(crypto.randomUUID(), id, v, d, v, 'Excel ile açılış/sayım', user.id, now);
        }
      } else if (c.kind === 'AYAR') {
        const p = D.getProduct(db, c.code);
        const sets = Object.keys(c.upd).map((k) => `${k} = ?`).join(', ');
        db.prepare(`UPDATE products SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(c.upd), now, p.id);
        db.prepare('INSERT INTO product_log (product_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)').run(p.id, user.id, 'EXCEL_GUNCELLEME', JSON.stringify(c.upd), now);
      } else if (c.kind === 'SAYIM') {
        const p = D.getProduct(db, c.code);
        const current = c.depot === 'HAM' ? p.ham : p.cep;
        const delta = D.round(c.counted - current);
        if (Math.abs(delta) < 1e-9) continue;
        db.prepare(`INSERT INTO movements (uuid, type, product_id, qty, from_depot, to_depot, counted, note, user_id, created_at) VALUES (?, 'SAYIM', ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(crypto.randomUUID(), p.id, Math.abs(delta), delta < 0 ? c.depot : null, delta > 0 ? c.depot : null, c.counted, 'Excel ile açılış/sayım', user.id, now);
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { applied: true, changes, errors };
}

// ---------- API yönlendirme ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  const user = auth(req, url);
  const q = Object.fromEntries(url.searchParams);
  let mm;

  if (p === '/api/status' && m === 'GET') {
    const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    return send(res, 200, { app: 'DepoTakip', version: VERSION, company: company(), needsSetup: n === 0, time: D.nowIso() });
  }
  if (p === '/api/setup' && m === 'POST') {
    const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    if (n > 0) throw new AppError(400, 'Kurulum zaten yapılmış');
    const b = await readJson(req);
    if (!String(b.fullName || '').trim() || !String(b.username || '').trim()) throw new AppError(400, 'Ad soyad ve kullanıcı adı gerekli');
    validatePassword(b.password);
    const r = db.prepare('INSERT INTO users (username, full_name, role, pass_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)')
      .run(String(b.username).trim(), String(b.fullName).trim(), 'admin', D.hashPassword(b.password), D.nowIso());
    if (String(b.company || '').trim()) db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('company', ?)").run(String(b.company).trim());
    const token = createSession(Number(r.lastInsertRowid), b.device);
    log('İlk kurulum tamamlandı, yönetici:', b.username);
    return send(res, 200, { token, user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid))) });
  }
  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req);
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(b.username || '').trim());
    if (!u || !u.active || !D.verifyPassword(b.password || '', u.pass_hash)) {
      await new Promise((r) => setTimeout(r, 700));
      throw new AppError(401, 'Kullanıcı adı veya şifre hatalı');
    }
    const token = createSession(u.id, b.device);
    return send(res, 200, { token, user: publicUser(u) });
  }
  if (p === '/api/logout' && m === 'POST') {
    if (user) db.prepare('DELETE FROM sessions WHERE token = ?').run(user.token);
    return send(res, 200, { ok: true });
  }

  // --- Buradan sonrası oturum ister ---
  need(user);

  if (p === '/api/me' && m === 'GET') return send(res, 200, { user: publicUser(user), company: company() });
  if (p === '/api/me/password' && m === 'POST') {
    const b = await readJson(req);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (!D.verifyPassword(b.oldPassword || '', u.pass_hash)) throw new AppError(400, 'Mevcut şifre hatalı');
    validatePassword(b.newPassword);
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(D.hashPassword(b.newPassword), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(user.id, user.token);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/events' && m === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    res.write(`event: hello\ndata: ${JSON.stringify({ time: D.nowIso() })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (p === '/api/meta' && m === 'GET') {
    return send(res, 200, {
      depots: D.DEPOTS, types: D.TYPES, roles: D.ROLES, company: company(), version: VERSION,
      categories: db.prepare('SELECT * FROM categories ORDER BY sort').all(),
      units: db.prepare('SELECT DISTINCT unit FROM products UNION SELECT unit FROM categories ORDER BY 1').all().map((r) => r.unit),
    });
  }
  if (p === '/api/dashboard' && m === 'GET') return send(res, 200, D.dashboard(db));
  if (p === '/api/alerts' && m === 'GET') return send(res, 200, D.listProducts(db).filter((x) => x.status !== 'NORMAL'));

  // Ürünler
  if (p === '/api/products' && m === 'GET') return send(res, 200, D.listProducts(db, { includeInactive: q.all === '1' }));
  if (p === '/api/products' && m === 'POST') {
    need(user, 'admin');
    const b = await readJson(req);
    db.exec('BEGIN IMMEDIATE');
    let id;
    try { id = D.insertProduct(db, b, user.id); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    broadcast('change', { kind: 'product', id });
    return send(res, 200, D.getProduct(db, id));
  }
  if ((mm = p.match(/^\/api\/products\/code\/(.+)$/)) && m === 'GET') {
    const code = decodeURIComponent(mm[1]).trim();
    const prod = D.getProduct(db, code);
    if (!prod) throw new AppError(404, `"${code}" kodlu ürün bulunamadı`);
    return send(res, 200, prod);
  }
  if ((mm = p.match(/^\/api\/products\/(\d+)$/))) {
    const id = Number(mm[1]);
    const prod = D.getProduct(db, id);
    if (!prod) throw new AppError(404, 'Ürün bulunamadı');
    if (m === 'GET') {
      const mov = D.listMovements(db, { productId: id, limit: 50 }).rows;
      const logRows = db.prepare('SELECT l.*, u.full_name AS user_name FROM product_log l LEFT JOIN users u ON u.id = l.user_id WHERE product_id = ? ORDER BY l.id DESC LIMIT 20').all(id);
      return send(res, 200, { product: prod, movements: mov, log: logRows });
    }
    if (m === 'PUT') {
      need(user, 'admin');
      const b = await readJson(req);
      const upd = {};
      if (b.name !== undefined) {
        const name = String(b.name).replace(/\s+/g, ' ').trim();
        if (!name) throw new AppError(400, 'Ürün adı boş olamaz');
        const dup = db.prepare('SELECT code FROM products WHERE lower(name) = lower(?) AND id <> ?').get(name, id);
        if (dup) throw new AppError(409, `Bu adla bir ürün zaten var (${dup.code})`);
        upd.name = name;
      }
      if (b.unit !== undefined) { const u = String(b.unit).trim(); if (!u) throw new AppError(400, 'Birim boş olamaz'); upd.unit = u; }
      if (b.minStock !== undefined) upd.min_stock = D.num(b.minStock);
      if (b.cepMin !== undefined) upd.cep_min = D.num(b.cepMin);
      if (b.supplier !== undefined) upd.supplier = String(b.supplier).trim();
      if (b.note !== undefined) upd.note = String(b.note).trim();
      if (b.active !== undefined) upd.active = b.active ? 1 : 0;
      const changed = {};
      for (const [k, v] of Object.entries(upd)) if (prod[k] !== v) changed[k] = { once: prod[k], sonra: v };
      if (Object.keys(changed).length) {
        const keys = Object.keys(changed);
        db.prepare(`UPDATE products SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => upd[k]), D.nowIso(), id);
        db.prepare('INSERT INTO product_log (product_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)').run(id, user.id, 'GUNCELLENDI', JSON.stringify(changed), D.nowIso());
        broadcast('change', { kind: 'product', id });
      }
      return send(res, 200, D.getProduct(db, id));
    }
    if (m === 'DELETE') {
      need(user, 'admin');
      const n = db.prepare('SELECT COUNT(*) AS n FROM movements WHERE product_id = ?').get(id).n;
      if (n > 0) throw new AppError(400, 'Bu ürünün hareket geçmişi var; silinemez. Bunun yerine pasif yapabilirsiniz.');
      db.prepare('DELETE FROM product_log WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      broadcast('change', { kind: 'product', id });
      return send(res, 200, { ok: true });
    }
  }
  if (p === '/api/categories' && m === 'POST') {
    need(user, 'admin');
    const b = await readJson(req);
    const code = String(b.code || '').trim().toUpperCase();
    if (!/^[A-Z]{2,4}$/.test(code)) throw new AppError(400, 'Kategori kodu 2-4 harf olmalı (Türkçe karakter olmadan)');
    if (!String(b.name || '').trim()) throw new AppError(400, 'Kategori adı gerekli');
    if (db.prepare('SELECT 1 FROM categories WHERE code = ?').get(code)) throw new AppError(409, 'Bu kategori kodu zaten var');
    const sort = (db.prepare('SELECT MAX(sort) AS s FROM categories').get().s || 0) + 1;
    db.prepare('INSERT INTO categories (code, name, unit, sort) VALUES (?, ?, ?, ?)').run(code, String(b.name).trim(), String(b.unit || 'adet').trim(), sort);
    broadcast('change', { kind: 'category' });
    return send(res, 200, { ok: true });
  }

  // Hareketler
  if (p === '/api/movements' && m === 'GET') return send(res, 200, D.listMovements(db, q));
  if (p === '/api/movements' && m === 'POST') {
    need(user, 'admin', 'depo');
    const b = await readJson(req);
    const list = Array.isArray(b) ? b : Array.isArray(b.items) ? b.items : [b];
    for (const it of list) if (String(it.type || '').toUpperCase() === 'SAYIM') need(user, 'admin');
    const results = D.addMovements(db, list, user.id);
    const ids = [...new Set(results.map((r) => r.productId).filter(Boolean))];
    if (results.some((r) => !r.duplicate)) {
      broadcast('change', { kind: 'movement', productIds: ids, by: user.fullName });
      log(`${user.username}: ${list.length} hareket kaydedildi`);
    }
    const products = ids.map((id) => D.getProduct(db, id));
    return send(res, 200, { results, products, alerts: products.filter((x) => x.status !== 'NORMAL') });
  }
  if ((mm = p.match(/^\/api\/movements\/(\d+)\/cancel$/)) && m === 'POST') {
    need(user, 'admin');
    const b = await readJson(req);
    const r = D.cancelMovement(db, Number(mm[1]), user.id, b.reason);
    broadcast('change', { kind: 'movement', productIds: [r.productId], by: user.fullName });
    log(`${user.username}: #${mm[1]} hareketi iptal edildi`);
    return send(res, 200, { ...r, product: D.getProduct(db, r.productId) });
  }

  // Raporlar
  if (p === '/api/reports/period' && m === 'GET') {
    if (!q.from || !q.to) throw new AppError(400, 'Tarih aralığı seçin');
    return send(res, 200, D.periodReport(db, q.from, q.to, q.categoryId));
  }

  // Excel dışa aktarma
  if ((mm = p.match(/^\/api\/export\/(\w+)\.xlsx$/)) && m === 'GET') {
    const kind = mm[1];
    const day = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    if (kind === 'stock') return xlsxResponse(res, `Stok_Durumu_${day}.xlsx`, writeXlsx([stockSheet(), alertSheet()]));
    if (kind === 'alerts') return xlsxResponse(res, `Stok_Uyarilari_${day}.xlsx`, writeXlsx([alertSheet()]));
    if (kind === 'movements') return xlsxResponse(res, `Hareketler_${day}.xlsx`, writeXlsx([movementSheet(q)]));
    if (kind === 'period') {
      if (!q.from || !q.to) throw new AppError(400, 'Tarih aralığı seçin');
      return xlsxResponse(res, `Donem_Raporu_${day}.xlsx`, writeXlsx([periodSheet(q.from, q.to, q.categoryId), movementSheet({ from: q.from, to: q.to, categoryId: q.categoryId })]));
    }
    if (kind === 'template') { need(user, 'admin'); return xlsxResponse(res, `Stok_Sablonu_${day}.xlsx`, writeXlsx(templateSheet())); }
    throw new AppError(404, 'Bilinmeyen rapor');
  }
  if (p === '/api/import' && m === 'POST') {
    need(user, 'admin');
    const buf = await readBody(req, 20 * 1024 * 1024);
    const result = importFile(buf, user, q.apply === '1');
    if (result.applied && result.changes.length) {
      broadcast('change', { kind: 'import', by: user.fullName });
      log(`${user.username}: Excel içe aktarıldı (${result.changes.length} değişiklik)`);
    }
    return send(res, 200, result);
  }

  // Kullanıcılar
  if (p === '/api/users' && m === 'GET') {
    need(user, 'admin');
    return send(res, 200, db.prepare('SELECT * FROM users ORDER BY active DESC, full_name').all().map(publicUser));
  }
  if (p === '/api/users' && m === 'POST') {
    need(user, 'admin');
    const b = await readJson(req);
    if (!String(b.fullName || '').trim() || !String(b.username || '').trim()) throw new AppError(400, 'Ad soyad ve kullanıcı adı gerekli');
    if (!D.ROLES[b.role]) throw new AppError(400, 'Geçersiz rol');
    validatePassword(b.password);
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(String(b.username).trim())) throw new AppError(409, 'Bu kullanıcı adı alınmış');
    db.prepare('INSERT INTO users (username, full_name, role, pass_hash, active, created_at) VALUES (?, ?, ?, ?, 1, ?)')
      .run(String(b.username).trim(), String(b.fullName).trim(), b.role, D.hashPassword(b.password), D.nowIso());
    return send(res, 200, { ok: true });
  }
  if ((mm = p.match(/^\/api\/users\/(\d+)$/)) && m === 'PUT') {
    need(user, 'admin');
    const id = Number(mm[1]);
    const b = await readJson(req);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!u) throw new AppError(404, 'Kullanıcı bulunamadı');
    if (id === user.id && (b.active === false || (b.role && b.role !== 'admin'))) throw new AppError(400, 'Kendi hesabınızı pasif yapamaz veya yetkisini düşüremezsiniz');
    if (b.fullName !== undefined) db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(String(b.fullName).trim() || u.full_name, id);
    if (b.role !== undefined) { if (!D.ROLES[b.role]) throw new AppError(400, 'Geçersiz rol'); db.prepare('UPDATE users SET role = ? WHERE id = ?').run(b.role, id); }
    if (b.active !== undefined) { db.prepare('UPDATE users SET active = ? WHERE id = ?').run(b.active ? 1 : 0, id); if (!b.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); }
    if (b.password) { validatePassword(b.password); db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(D.hashPassword(b.password), id); db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); }
    return send(res, 200, { ok: true });
  }

  // Ayarlar / sistem
  if (p === '/api/settings' && m === 'PUT') {
    need(user, 'admin');
    const b = await readJson(req);
    if (b.company !== undefined) db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('company', ?)").run(String(b.company).trim() || 'Depo Takip');
    broadcast('change', { kind: 'settings' });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/server-info' && m === 'GET') {
    const backups = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort().reverse() : [];
    return send(res, 200, {
      version: VERSION, port: PORT, hostname: os.hostname(), addresses: lanAddresses().map((a) => ({ ...a, url: `http://${a.address}:${PORT}` })),
      dataDir: DATA_DIR, dbFile: DB_FILE, backupDir: BACKUP_DIR, backupCount: backups.length, lastBackup: backups[0] || null,
      clients: clients.size, movementCount: db.prepare('SELECT COUNT(*) AS n FROM movements').get().n,
    });
  }
  if (p === '/api/backup' && m === 'POST') {
    need(user, 'admin');
    const f = backup('elle');
    log(`${user.username}: elle yedek alındı ${f}`);
    return send(res, 200, { file: f });
  }
  if (p === '/api/backup/download' && m === 'GET') {
    need(user, 'admin');
    const f = backup('indirilen');
    const buf = fs.readFileSync(f);
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${path.basename(f)}"`, 'Cache-Control': 'no-store' });
    return res.end(buf);
  }

  throw new AppError(404, 'Bulunamadı');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // Android uygulaması ve diğer istemciler için CORS
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
