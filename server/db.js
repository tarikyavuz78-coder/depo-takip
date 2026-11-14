'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const seed = require('./seed-data');

const DEPOTS = { HAM: 'Ham Depo', CEP: 'Cep Depo' };
const TYPES = {
  GIRIS: 'Depo Girişi',
  TRANSFER: 'Transfer',
  URETIM: 'Üretime Çıkış',
  FIRE: 'Fire',
  IADE: 'Üretimden İade',
  SAYIM: 'Sayım Düzeltme',
  IPTAL: 'İptal (Ters Kayıt)',
};
const ROLES = { admin: 'Yönetici', depo: 'Depocu', izleyici: 'İzleyici' };
const EPS = 1e-9;

class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function round(n) { return Math.round(n * 1e6) / 1e6; }

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'depo.db');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return { db, file };
}

function migrate(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'adet', sort INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    seq INTEGER NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    min_stock REAL NOT NULL DEFAULT 0,
    cep_min REAL NOT NULL DEFAULT 0,
    supplier TEXT DEFAULT '',
    note TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, full_name TEXT NOT NULL,
    role TEXT NOT NULL, pass_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, last_seen TEXT NOT NULL, device TEXT
  );
  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY,
    uuid TEXT UNIQUE,
    type TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    qty REAL NOT NULL CHECK (qty > 0),
    from_depot TEXT,
    to_depot TEXT,
    counted REAL,
    doc_no TEXT DEFAULT '',
    supplier TEXT DEFAULT '',
    lot_no TEXT DEFAULT '',
    note TEXT DEFAULT '',
    user_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL,
    cancels_id INTEGER REFERENCES movements(id),
    cancelled_by INTEGER REFERENCES movements(id)
  );
  CREATE INDEX IF NOT EXISTS ix_mov_product ON movements(product_id, created_at);
  CREATE INDEX IF NOT EXISTS ix_mov_created ON movements(created_at);
  CREATE TABLE IF NOT EXISTS product_log (
    id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, user_id INTEGER, action TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL
  );
  `);
  const v = db.prepare("SELECT value FROM meta WHERE key='seeded'").get();
  if (!v) {
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      const insCat = db.prepare('INSERT INTO categories (code, name, unit, sort) VALUES (?, ?, ?, ?)');
      seed.categories.forEach((c, i) => insCat.run(c.code, c.name, c.unit, i + 1));
      for (const [cat, name, unit] of seed.products) {
        insertProduct(db, { categoryCode: cat, name, unit }, null, now);
      }
      db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', ?)").run(now);
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('company', 'Depo Takip')").run();
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}

function nowIso() { return new Date().toISOString(); }

function insertProduct(db, p, userId, now = nowIso()) {
  const cat = p.categoryId
    ? db.prepare('SELECT * FROM categories WHERE id = ?').get(p.categoryId)
    : db.prepare('SELECT * FROM categories WHERE code = ?').get(p.categoryCode);
  if (!cat) throw new AppError(400, 'Kategori bulunamadı');
  const name = String(p.name || '').replace(/\s+/g, ' ').trim();
  if (!name) throw new AppError(400, 'Ürün adı boş olamaz');
  const dup = db.prepare('SELECT code FROM products WHERE lower(name) = lower(?)').get(name);
  if (dup) throw new AppError(409, `Bu adla bir ürün zaten var (${dup.code})`);
  const row = db.prepare('SELECT MAX(seq) AS m FROM products WHERE category_id = ?').get(cat.id);
  const seq = (row.m || 0) + 1;
  const code = `KYN-${cat.code}-${String(seq).padStart(3, '0')}`;
  const r = db.prepare(`INSERT INTO products (code, category_id, seq, name, unit, min_stock, cep_min, supplier, note, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(
    code, cat.id, seq, name, (p.unit || cat.unit).trim(), num(p.minStock), num(p.cepMin),
    String(p.supplier || '').trim(), String(p.note || '').trim(), now, now);
  const id = Number(r.lastInsertRowid);
  db.prepare('INSERT INTO product_log (product_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, 'OLUSTURULDU', JSON.stringify({ code, name }), now);
  return id;
}

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  let n;
  if (typeof v === 'number') n = v;
  else {
    const s = String(v).trim().replace(/\s/g, '');
    // "1.234,5" (Türkçe) veya "1234.5" biçimlerini kabul et
    n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  }
  if (!isFinite(n) || n < 0) throw new AppError(400, 'Geçersiz sayı: ' + v);
  return round(n);
}

// ---------- Stok hesaplama ----------
const STOCK_SQL = `
  SELECT product_id,
    SUM(CASE WHEN to_depot='HAM' THEN qty ELSE 0 END) - SUM(CASE WHEN from_depot='HAM' THEN qty ELSE 0 END) AS ham,
    SUM(CASE WHEN to_depot='CEP' THEN qty ELSE 0 END) - SUM(CASE WHEN from_depot='CEP' THEN qty ELSE 0 END) AS cep
  FROM movements`;

function stockOf(db, productId) {
  const r = db.prepare(STOCK_SQL + ' WHERE product_id = ?').get(productId);
  return { HAM: round(r.ham || 0), CEP: round(r.cep || 0) };
}

function statusOf(p) {
  const total = p.ham + p.cep;
  if (p.min_stock > 0 && total <= EPS) return 'TUKENDI';
  if (p.min_stock > 0 && total <= p.min_stock + EPS) return 'KRITIK';
  if (p.cep_min > 0 && p.cep <= p.cep_min + EPS) return p.ham > EPS ? 'TRANSFER' : 'KRITIK';
  return 'NORMAL';
}

function listProducts(db, { includeInactive = false } = {}) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = db.prepare(`
    SELECT p.*, c.code AS cat_code, c.name AS cat_name,
      COALESCE(s.ham, 0) AS ham, COALESCE(s.cep, 0) AS cep,
      COALESCE(u.used, 0) AS used30, l.last_at
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN (${STOCK_SQL} GROUP BY product_id) s ON s.product_id = p.id
    LEFT JOIN (SELECT product_id, SUM(CASE WHEN type IN ('URETIM','FIRE') THEN qty WHEN type='IADE' THEN -qty ELSE 0 END) AS used
               FROM movements WHERE created_at >= ? AND cancelled_by IS NULL AND cancels_id IS NULL GROUP BY product_id) u ON u.product_id = p.id
    LEFT JOIN (SELECT product_id, MAX(created_at) AS last_at FROM movements GROUP BY product_id) l ON l.product_id = p.id
    ${includeInactive ? '' : 'WHERE p.active = 1'}
    ORDER BY c.sort, p.seq`).all(since);
  return rows.map(decorate);
}

function decorate(p) {
  p.ham = round(p.ham || 0);
  p.cep = round(p.cep || 0);
  p.total = round(p.ham + p.cep);
  p.status = statusOf(p);
  const daily = (p.used30 || 0) / 30;
  p.daily_use = round(daily);
  p.days_left = daily > EPS ? Math.floor(p.total / daily) : null;
  return p;
}

function getProduct(db, idOrCode) {
  const where = typeof idOrCode === 'number' ? 'p.id = ?' : 'upper(p.code) = upper(?)';
  const p = db.prepare(`SELECT p.*, c.code AS cat_code, c.name AS cat_name FROM products p JOIN categories c ON c.id = p.category_id WHERE ${where}`).get(idOrCode);
  if (!p) return null;
  const s = stockOf(db, p.id);
  p.ham = s.HAM; p.cep = s.CEP;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const u = db.prepare(`SELECT SUM(CASE WHEN type IN ('URETIM','FIRE') THEN qty WHEN type='IADE' THEN -qty ELSE 0 END) AS used
    FROM movements WHERE product_id = ? AND created_at >= ? AND cancelled_by IS NULL AND cancels_id IS NULL`).get(p.id, since);
  p.used30 = u.used || 0;
  return decorate(p);
}

// ---------- Hareketler ----------
function normalizeMovement(db, m) {
  const type = String(m.type || '').toUpperCase();
  if (!TYPES[type] || type === 'IPTAL') throw new AppError(400, 'Geçersiz hareket türü');
  const product = typeof m.productId === 'number' || /^\d+$/.test(String(m.productId || ''))
    ? getProduct(db, Number(m.productId))
    : getProduct(db, String(m.productCode || ''));
  if (!product) throw new AppError(404, 'Ürün bulunamadı');
  if (!product.active) throw new AppError(400, `${product.code} pasif durumda; hareket girilemez`);
  const out = {
    uuid: m.uuid ? String(m.uuid).slice(0, 64) : crypto.randomUUID(),
    type, product, from: null, to: null, qty: 0, counted: null,
    docNo: String(m.docNo || '').trim().slice(0, 100),
    supplier: String(m.supplier || '').trim().slice(0, 150),
    lotNo: String(m.lotNo || '').trim().slice(0, 100),
    note: String(m.note || '').trim().slice(0, 500),
  };
  const depot = (d) => { const x = String(d || '').toUpperCase(); if (!DEPOTS[x]) throw new AppError(400, 'Depo seçilmedi'); return x; };
  if (type === 'SAYIM') {
    const d = depot(m.depot || m.to || m.from);
    const counted = num(m.counted);
    const current = product[d === 'HAM' ? 'ham' : 'cep'];
    const delta = round(counted - current);
    if (Math.abs(delta) < EPS) throw new AppError(400, `Sayım sonucu mevcut stokla aynı (${current} ${product.unit}); düzeltme gerekmiyor`);
    out.counted = counted;
    out.qty = Math.abs(delta);
    if (delta > 0) out.to = d; else out.from = d;
    return out;
  }
  out.qty = num(m.qty);
  if (out.qty <= EPS) throw new AppError(400, 'Miktar sıfırdan büyük olmalı');
  if (product.unit === 'adet' && Math.abs(out.qty - Math.round(out.qty)) > EPS) throw new AppError(400, `${product.name} adet ile takip ediliyor; küsuratlı miktar girilemez`);
  if (type === 'GIRIS' || type === 'IADE') out.to = depot(m.to || m.depot || (type === 'IADE' ? 'CEP' : 'HAM'));
  else if (type === 'URETIM' || type === 'FIRE') out.from = depot(m.from || m.depot || 'CEP');
  else if (type === 'TRANSFER') {
    out.from = depot(m.from); out.to = depot(m.to);
    if (out.from === out.to) throw new AppError(400, 'Kaynak ve hedef depo aynı olamaz');
  }
  if (type === 'FIRE' && !out.note) throw new AppError(400, 'Fire için açıklama (neden) yazılmalı');
  return out;
}

function insertMovement(db, n, userId, createdAt) {
  const r = db.prepare(`INSERT INTO movements (uuid, type, product_id, qty, from_depot, to_depot, counted, doc_no, supplier, lot_no, note, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    n.uuid, n.type, n.product.id, n.qty, n.from, n.to, n.counted, n.docNo, n.supplier, n.lotNo, n.note, userId, createdAt || nowIso());
  return Number(r.lastInsertRowid);
}

// Birden çok hareketi tek işlemde (hepsi ya da hiçbiri) kaydeder.
function addMovements(db, list, userId) {
  if (!Array.isArray(list) || !list.length) throw new AppError(400, 'Kaydedilecek hareket yok');
  if (list.length > 500) throw new AppError(400, 'Tek seferde en fazla 500 satır kaydedilebilir');
  const results = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.uuid) {
        const ex = db.prepare('SELECT id FROM movements WHERE uuid = ?').get(String(m.uuid));
        if (ex) { results.push({ id: ex.id, duplicate: true }); continue; }
      }
      let n;
      try { n = normalizeMovement(db, m); } catch (e) { e.message = (list.length > 1 ? `Satır ${i + 1}: ` : '') + e.message; throw e; }
      if (n.from) {
        const s = stockOf(db, n.product.id)[n.from];
        if (n.qty > s + EPS) {
          throw new AppError(409, `${list.length > 1 ? `Satır ${i + 1}: ` : ''}Yetersiz stok — ${n.product.name} için ${DEPOTS[n.from]} mevcudu ${fmt(s)} ${n.product.unit}, istenen ${fmt(n.qty)} ${n.product.unit}`);
        }
      }
      const id = insertMovement(db, n, userId);
      results.push({ id, productId: n.product.id });
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return results;
}

function cancelMovement(db, id, userId, reason) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const m = db.prepare('SELECT * FROM movements WHERE id = ?').get(id);
    if (!m) throw new AppError(404, 'Hareket bulunamadı');
    if (m.cancels_id) throw new AppError(400, 'İptal kaydı iptal edilemez');
    if (m.cancelled_by) throw new AppError(400, 'Bu hareket zaten iptal edilmiş');
    const why = String(reason || '').trim();
    if (!why) throw new AppError(400, 'İptal nedeni yazılmalı');
    const p = getProduct(db, m.product_id);
    // Ters kayıt: giriş çıkış olur, çıkış giriş olur
    const from = m.to_depot, to = m.from_depot;
    if (from) {
      const s = stockOf(db, m.product_id)[from];
      if (m.qty > s + EPS) throw new AppError(409, `İptal edilemiyor: ${DEPOTS[from]} mevcudu (${fmt(s)} ${p.unit}) iptal edilecek miktardan (${fmt(m.qty)}) az. Önce ilgili çıkışları kontrol edin.`);
    }
    const r = db.prepare(`INSERT INTO movements (uuid, type, product_id, qty, from_depot, to_depot, note, user_id, created_at, cancels_id)
      VALUES (?, 'IPTAL', ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), m.product_id, m.qty, from, to, why, userId, nowIso(), m.id);
    const newId = Number(r.lastInsertRowid);
    db.prepare('UPDATE movements SET cancelled_by = ? WHERE id = ?').run(newId, m.id);
    db.exec('COMMIT');
    return { id: newId, productId: m.product_id };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function fmt(n) { return Number(round(n)).toLocaleString('tr-TR', { maximumFractionDigits: 3 }); }

function listMovements(db, f = {}) {
  const where = [];
  const args = [];
  if (f.from) { where.push('m.created_at >= ?'); args.push(f.from); }
  if (f.to) { where.push('m.created_at < ?'); args.push(f.to); }
  if (f.productId) { where.push('m.product_id = ?'); args.push(Number(f.productId)); }
  if (f.categoryId) { where.push('p.category_id = ?'); args.push(Number(f.categoryId)); }
  if (f.type) { where.push('m.type = ?'); args.push(String(f.type)); }
  if (f.depot) { where.push('(m.from_depot = ? OR m.to_depot = ?)'); args.push(f.depot, f.depot); }
  if (f.userId) { where.push('m.user_id = ?'); args.push(Number(f.userId)); }
  if (f.q) {
    where.push('(p.name LIKE ? OR p.code LIKE ? OR m.note LIKE ? OR m.doc_no LIKE ? OR m.supplier LIKE ? OR m.lot_no LIKE ?)');
    const q = `%${f.q}%`; args.push(q, q, q, q, q, q);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(Number(f.limit) || 200, 20000);
  const offset = Number(f.offset) || 0;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM movements m JOIN products p ON p.id = m.product_id ${w}`).get(...args).n;
  const rows = db.prepare(`
    SELECT m.*, p.code AS product_code, p.name AS product_name, p.unit, u.full_name AS user_name
    FROM movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.user_id
    ${w} ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  return { total, rows };
}

// Dönem raporu: açılış, giriş, iade, üretim, fire, sayım farkı, kapanış
function periodReport(db, from, to, categoryId) {
  const rows = db.prepare(`
    SELECT p.id, p.code, p.name, p.unit, c.name AS cat_name, p.min_stock,
      SUM(CASE WHEN m.created_at < ? THEN (CASE WHEN m.to_depot IS NOT NULL THEN m.qty ELSE 0 END) - (CASE WHEN m.from_depot IS NOT NULL THEN m.qty ELSE 0 END) ELSE 0 END) AS opening,
      SUM(CASE WHEN m.created_at < ? THEN (CASE WHEN m.to_depot IS NOT NULL THEN m.qty ELSE 0 END) - (CASE WHEN m.from_depot IS NOT NULL THEN m.qty ELSE 0 END) ELSE 0 END) AS closing,
      SUM(CASE WHEN m.created_at >= ? AND m.created_at < ? AND m.type='GIRIS' AND m.cancelled_by IS NULL THEN m.qty ELSE 0 END) AS giris,
      SUM(CASE WHEN m.created_at >= ? AND m.created_at < ? AND m.type='IADE' AND m.cancelled_by IS NULL THEN m.qty ELSE 0 END) AS iade,
      SUM(CASE WHEN m.created_at >= ? AND m.created_at < ? AND m.type='URETIM' AND m.cancelled_by IS NULL THEN m.qty ELSE 0 END) AS uretim,
      SUM(CASE WHEN m.created_at >= ? AND m.created_at < ? AND m.type='FIRE' AND m.cancelled_by IS NULL THEN m.qty ELSE 0 END) AS fire,
      SUM(CASE WHEN m.created_at >= ? AND m.created_at < ? AND m.type='SAYIM' AND m.cancelled_by IS NULL THEN (CASE WHEN m.to_depot IS NOT NULL THEN m.qty ELSE -m.qty END) ELSE 0 END) AS sayim,
      SUM(CASE WHEN m.created_at >= ? AND m.created_at < ? AND m.type='TRANSFER' AND m.cancelled_by IS NULL AND m.to_depot='CEP' THEN m.qty ELSE 0 END) AS transfer_cep
    FROM products p JOIN categories c ON c.id = p.category_id
    LEFT JOIN movements m ON m.product_id = p.id
    WHERE (p.active = 1 OR m.id IS NOT NULL) ${categoryId ? 'AND p.category_id = ' + Number(categoryId) : ''}
    GROUP BY p.id ORDER BY c.sort, p.seq`).all(from, to, from, to, from, to, from, to, from, to, from, to, from, to);
  return rows.map((r) => {
    const o = {};
    for (const k of Object.keys(r)) o[k] = typeof r[k] === 'number' ? round(r[k] || 0) : r[k];
    const used = o.uretim + o.fire;
    o.fire_rate = used > EPS ? round((o.fire / used) * 100) : null;
    return o;
  });
}

function dashboard(db) {
  const products = listProducts(db);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = db.prepare(`SELECT type, COUNT(*) AS n FROM movements WHERE created_at >= ? GROUP BY type`).all(start.toISOString());
  const recent = listMovements(db, { limit: 12 }).rows;
  const counts = { TUKENDI: 0, KRITIK: 0, TRANSFER: 0, NORMAL: 0 };
  products.forEach((p) => counts[p.status]++);
  return {
    productCount: products.length,
    counts,
    alerts: products.filter((p) => p.status !== 'NORMAL'),
    today: Object.fromEntries(today.map((t) => [t.type, t.n])),
    recent,
    noMinCount: products.filter((p) => !(p.min_stock > 0)).length,
  };
}

// ---------- Kullanıcılar / oturum ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 32);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}
function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 32);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

module.exports = {
  DEPOTS, TYPES, ROLES, AppError, open, insertProduct, num, round, fmt,
  listProducts, getProduct, stockOf, addMovements, cancelMovement, listMovements,
  periodReport, dashboard, hashPassword, verifyPassword, nowIso,
};
