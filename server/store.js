'use strict';
// Genel kayıt deposu: her kayıt "docs" tablosunda JSON olarak durur; her değişiklik "changes" tablosuna
// önceki ve sonraki haliyle yazılır. Böylece her işlem geri alınabilir (ve geri alma da geri alınabilir).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { C } = require('./schema');

class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
const nowIso = () => new Date().toISOString();
const J = (s, d) => { try { const v = JSON.parse(s); return v ?? d; } catch (e) { return d; } };
const round = (n) => Math.round(n * 1e6) / 1e6;
const trKey = (s) => String(s ?? '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();

function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(`
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, full_name TEXT NOT NULL,
    role TEXT NOT NULL, pass_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, perms TEXT);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT NOT NULL, last_seen TEXT NOT NULL, device TEXT);
  CREATE TABLE IF NOT EXISTS docs (
    id INTEGER PRIMARY KEY, coll TEXT NOT NULL, data TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by INTEGER, updated_by INTEGER);
  CREATE INDEX IF NOT EXISTS ix_docs_coll ON docs(coll);
  CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id INTEGER, coll TEXT NOT NULL, doc_id INTEGER NOT NULL,
    action TEXT NOT NULL, before TEXT, after TEXT, batch TEXT, label TEXT, undo_of INTEGER, undone_by INTEGER);
  CREATE INDEX IF NOT EXISTS ix_changes_batch ON changes(batch);
  CREATE INDEX IF NOT EXISTS ix_changes_doc ON changes(coll, doc_id);
  `);
  // 2.1: kullanıcı bazında yetki sütunu (eski veritabanına eklenir)
  if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'perms')) db.exec('ALTER TABLE users ADD COLUMN perms TEXT');
  db.exec("UPDATE users SET role = 'rapor' WHERE role = 'izleyici'");
  return db;
}

class Store {
  constructor(file) {
    this.file = file;
    this.db = openDb(file);
    this.version = 0;
    this.cache = new Map(); // coll -> Map(id -> doc)
    for (const k of Object.keys(C)) this.cache.set(k, new Map());
    for (const r of this.db.prepare('SELECT * FROM docs').all()) {
      if (!this.cache.has(r.coll)) this.cache.set(r.coll, new Map());
      this.cache.get(r.coll).set(r.id, this.rowToDoc(r));
    }
    this.listeners = [];
  }

  meta(key, def) { const r = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key); return r ? J(r.value, def) : def; }
  setMeta(key, val) { this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, JSON.stringify(val)); this.bump(); }
  onChange(fn) { this.listeners.push(fn); }
  bump(info) { this.version++; for (const fn of this.listeners) { try { fn(info || {}); } catch (e) { /* yoksay */ } } }

  rowToDoc(r) {
    return { id: r.id, ...J(r.data, {}), _deleted: !!r.deleted, _c: r.created_at, _u: r.updated_at, _by: r.created_by, _ub: r.updated_by };
  }
  all(coll, { withDeleted = false } = {}) {
    const m = this.cache.get(coll);
    if (!m) return [];
    const out = [];
    for (const d of m.values()) if (withDeleted || !d._deleted) out.push(d);
    return out;
  }
  get(coll, id) { const m = this.cache.get(coll); return m ? m.get(Number(id)) || null : null; }
  dataOf(doc) { const o = {}; for (const [k, v] of Object.entries(doc)) if (!k.startsWith('_') && k !== 'id') o[k] = v; return o; }

  // ---------- Alanlar (hazır + kullanıcı tanımlı) ----------
  fields(coll) {
    const base = (C[coll] && C[coll].fields) || [];
    const custom = this.all('alan').filter((a) => a.coll === coll);
    const out = base.map((f) => {
      const ov = custom.find((a) => a.builtin && a.k === f.k);
      if (!ov) return { ...f };
      return { ...f, l: ov.l || f.l, hidden: ov.hidden ? 1 : f.hidden, req: ov.req ? 1 : f.req, list: ov.list === undefined ? f.list : (ov.list ? 1 : 0), _ov: ov.id };
    });
    for (const a of custom.filter((x) => !x.builtin).sort((x, y) => (x.sira || 0) - (y.sira || 0) || x.id - y.id)) {
      out.push({ k: a.k, l: a.l, t: a.t || 'text', opts: a.t === 'sel' ? String(a.opts || '').split(/\n|;/).map((s) => s.trim()).filter(Boolean) : undefined,
        req: a.req ? 1 : 0, hidden: a.hidden ? 1 : 0, list: a.list ? 1 : 0, custom: 1, _ov: a.id });
    }
    return out;
  }

  // ---------- Doğrulama ----------
  normalize(coll, input, current, opts = {}) {
    const fields = this.fields(coll);
    const out = current ? this.dataOf(current) : {};
    const errs = [];
    for (const f of fields) {
      if (f.ro && !opts.system) continue;
      if (!(f.k in input)) { if (!current && f.def !== undefined && out[f.k] === undefined) out[f.k] = f.def; continue; }
      let v = input[f.k];
      const blank = v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
      if (blank) { delete out[f.k]; continue; }
      try { out[f.k] = this.normValue(f, v, coll, current); } catch (e) { errs.push(e.message); }
    }
    if (errs.length) throw new AppError(400, errs[0]);
    for (const f of fields) {
      if (f.hidden && !f.req) continue;
      const v = out[f.k];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (f.t === 'map' && !Object.keys(v || {}).length);
      if (f.req && empty && !(f.zero && v === 0)) throw new AppError(400, `"${f.l}" alanı zorunludur`);
      if (f.pos && typeof v === 'number' && v <= 0) throw new AppError(400, `"${f.l}" sıfırdan büyük olmalı`);
      if (f.uniq && !empty) {
        const key = trKey(v);
        const dup = this.all(coll).find((d) => d.id !== (current && current.id) && trKey(d[f.k]) === key);
        if (dup) throw new AppError(409, `"${v}" zaten kayıtlı (${f.l})`);
      }
    }
    return out;
  }
  normValue(f, v, coll, current) {
    const L = f.l;
    switch (f.t) {
      case 'num': case 'int': {
        let n = typeof v === 'number' ? v : parseNum(v);
        if (!isFinite(n)) throw new AppError(400, `"${L}" geçerli bir sayı olmalı`);
        if (n < 0 && !f.custom) throw new AppError(400, `"${L}" negatif olamaz`);
        if (f.t === 'int' && Math.abs(n - Math.round(n)) > 1e-9) throw new AppError(400, `"${L}" tam sayı olmalı`);
        return f.t === 'int' ? Math.round(n) : Number(n.toPrecision(12));
      }
      case 'date': return dateOnly(v, L);
      case 'bool': return v === true || v === 1 || v === '1' || v === 'true' || /^(evet|e|yes)$/i.test(String(v));
      case 'sel': {
        const keys = (f.opts || []).map((o) => (Array.isArray(o) ? o[0] : o));
        const s = String(v).trim();
        if (keys.length && !keys.includes(s)) throw new AppError(400, `"${L}" için geçersiz seçim: ${s}`);
        return s;
      }
      case 'multi': {
        const keys = (f.opts || []).map((o) => (Array.isArray(o) ? o[0] : o));
        const arr = (Array.isArray(v) ? v : String(v).split(',')).map((x) => String(x).trim()).filter(Boolean);
        for (const x of arr) if (!keys.includes(x)) throw new AppError(400, `"${L}" için geçersiz seçim: ${x}`);
        return [...new Set(arr)];
      }
      case 'ref': case 'mat': {
        const rc = f.t === 'mat' ? 'hammadde' : f.ref;
        const id = Number(v);
        const d = this.get(rc, id);
        if (!d) throw new AppError(400, `"${L}" bulunamadı`);
        if (d._deleted && !(current && Number(current[f.k]) === id)) throw new AppError(400, `"${L}" silinmiş bir kayda bağlanamaz`);
        return id;
      }
      case 'map': {
        if (typeof v !== 'object') throw new AppError(400, `"${L}" geçersiz`);
        const o = {};
        for (const [k, x] of Object.entries(v)) {
          if (x === null || x === '' || x === undefined) continue;
          const n = typeof x === 'number' ? x : parseNum(x);
          if (!isFinite(n) || n < 0) throw new AppError(400, `"${L}" içinde geçersiz sayı: ${x}`);
          if (n === 0) continue;
          if (!this.get(f.ref, Number(k))) throw new AppError(400, `"${L}" içinde bilinmeyen kalem`);
          o[Number(k)] = round(n);
        }
        return o;
      }
      case 'idlist': {
        const arr = (Array.isArray(v) ? v : String(v).split(',')).map(Number).filter((x) => x > 0 && this.get(f.ref, x));
        return [...new Set(arr)];
      }
      case 'note': return String(v).slice(0, 4000);
      default: {
        let s = String(v).replace(/\s+/g, ' ').trim().slice(0, f.max || 500);
        if (f.upper) s = s.toLocaleUpperCase('tr-TR');
        return s;
      }
    }
  }

  // ---------- Yazma (tek işlem içinde, geri alınabilir) ----------
  tx(fn) {
    if (this.inTx) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    this.inTx = true;
    const touched = [];
    this.pending = touched;
    try {
      const r = fn();
      this.db.exec('COMMIT');
      this.inTx = false; this.pending = null;
      this.bump({ colls: [...new Set(touched)] });
      return r;
    } catch (e) {
      this.db.exec('ROLLBACK');
      this.inTx = false; this.pending = null;
      // önbelleği veritabanından yenile (yarım kalan değişiklikleri at)
      for (const coll of new Set(touched)) this.reloadColl(coll);
      throw e;
    }
  }
  reloadColl(coll) {
    const m = new Map();
    for (const r of this.db.prepare('SELECT * FROM docs WHERE coll = ?').all(coll)) m.set(r.id, this.rowToDoc(r));
    this.cache.set(coll, m);
  }
  stateOf(doc) { return doc ? { data: this.dataOf(doc), deleted: !!doc._deleted } : null; }
  writeState(coll, id, state, userId, at) {
    if (!state) return;
    const exists = this.db.prepare('SELECT id FROM docs WHERE id = ?').get(id);
    if (exists) this.db.prepare('UPDATE docs SET data = ?, deleted = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(JSON.stringify(state.data), state.deleted ? 1 : 0, at, userId, id);
    else this.db.prepare('INSERT INTO docs (id, coll, data, deleted, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, coll, JSON.stringify(state.data), state.deleted ? 1 : 0, at, at, userId, userId);
    const r = this.db.prepare('SELECT * FROM docs WHERE id = ?').get(id);
    this.cache.get(coll).set(id, this.rowToDoc(r));
    if (this.pending) this.pending.push(coll);
  }
  logChange(coll, id, action, before, after, userId, batch, label, undoOf) {
    const r = this.db.prepare('INSERT INTO changes (at, user_id, coll, doc_id, action, before, after, batch, label, undo_of) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(nowIso(), userId, coll, id, action, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, batch, label || null, undoOf || null);
    return Number(r.lastInsertRowid);
  }

  create(coll, input, user, { batch, label, system } = {}) {
    if (!C[coll]) throw new AppError(404, 'Bilinmeyen kayıt türü');
    return this.tx(() => {
      const data = this.normalize(coll, input, null, { system });
      if (coll === 'hammadde' && !data.kod) data.kod = this.nextCode(data.grup);
      if (coll === 'urun' && !data.kod) data.kod = this.nextUrunCode();
      if (coll === 'hammadde' && data.kod && this.all('hammadde', { withDeleted: true }).some((d) => d.kod === data.kod)) throw new AppError(409, `${data.kod} kodu kullanımda`);
      const at = nowIso();
      const r = this.db.prepare('INSERT INTO docs (coll, data, deleted, created_at, updated_at, created_by, updated_by) VALUES (?, ?, 0, ?, ?, ?, ?)').run(coll, JSON.stringify(data), at, at, user ? user.id : null, user ? user.id : null);
      const id = Number(r.lastInsertRowid);
      this.cache.get(coll).set(id, this.rowToDoc(this.db.prepare('SELECT * FROM docs WHERE id = ?').get(id)));
      if (this.pending) this.pending.push(coll);
      const ch = this.logChange(coll, id, 'create', null, { data, deleted: false }, user ? user.id : null, batch || crypto.randomUUID(), label);
      return { doc: this.get(coll, id), change: ch };
    });
  }
  update(coll, id, input, user, { batch, label, system } = {}) {
    return this.tx(() => {
      const cur = this.get(coll, id);
      if (!cur || cur._deleted) throw new AppError(404, 'Kayıt bulunamadı');
      const before = this.stateOf(cur);
      const data = this.normalize(coll, input, cur, { system });
      if ((coll === 'hammadde' || coll === 'urun') && cur.kod) data.kod = system && input.kod ? input.kod : cur.kod;
      if (JSON.stringify(data) === JSON.stringify(before.data)) return { doc: cur, change: null };
      const after = { data, deleted: false };
      this.writeState(coll, cur.id, after, user ? user.id : null, nowIso());
      const ch = this.logChange(coll, cur.id, 'update', before, after, user ? user.id : null, batch || crypto.randomUUID(), label);
      return { doc: this.get(coll, cur.id), change: ch };
    });
  }
  remove(coll, id, user, { batch, label } = {}) {
    return this.tx(() => {
      const cur = this.get(coll, id);
      if (!cur || cur._deleted) throw new AppError(404, 'Kayıt bulunamadı');
      const before = this.stateOf(cur);
      const after = { data: before.data, deleted: true };
      this.writeState(coll, cur.id, after, user ? user.id : null, nowIso());
      const ch = this.logChange(coll, cur.id, 'delete', before, after, user ? user.id : null, batch || crypto.randomUUID(), label);
      return { change: ch };
    });
  }

  // ---------- Geri al ----------
  // Bir değişikliği (veya aynı paketteki tüm değişiklikleri) geri alır. Geri almanın kendisi de yeni bir
  // değişiklik olarak kaydedilir; onu geri almak "yinele" anlamına gelir.
  undo(changeId, user, { force = false } = {}) {
    const ch = this.db.prepare('SELECT * FROM changes WHERE id = ?').get(changeId);
    if (!ch) throw new AppError(404, 'Değişiklik bulunamadı');
    const group = ch.batch ? this.db.prepare('SELECT * FROM changes WHERE batch = ? ORDER BY id DESC').all(ch.batch) : [ch];
    if (group.every((g) => g.undone_by)) throw new AppError(400, 'Bu değişiklik zaten geri alınmış');
    const todo = group.filter((g) => !g.undone_by);
    // Çakışma kontrolü: kayıt, bu değişiklikten sonra başka biri tarafından değiştirildiyse uyar
    for (const g of todo) {
      const cur = this.stateOf(this.get(g.coll, g.doc_id));
      const after = J(g.after, null);
      if (!force && JSON.stringify(cur) !== JSON.stringify(after)) {
        const later = this.db.prepare('SELECT c.*, u.full_name FROM changes c LEFT JOIN users u ON u.id = c.user_id WHERE c.coll = ? AND c.doc_id = ? AND c.id > ? ORDER BY c.id DESC LIMIT 1').get(g.coll, g.doc_id, g.id);
        throw new AppError(409, `Bu kayıt sonradan değiştirilmiş${later ? ` (${later.full_name || 'sistem'}, ${new Date(later.at).toLocaleString('tr-TR')})` : ''}. Önce sonraki değişikliği geri alın.`);
      }
    }
    const batch = crypto.randomUUID();
    const base = String(ch.label || '').replace(/ — (geri alındı|yinelendi)$/, '').replace(/^(geri alındı|yinelendi)$/, '');
    const label = (base ? base + ' — ' : '') + (ch.action === 'undo' ? 'yinelendi' : 'geri alındı');
    return this.tx(() => {
      const at = nowIso();
      for (const g of todo) {
        const cur = this.stateOf(this.get(g.coll, g.doc_id));
        const before = J(g.before, null);
        const target = before || { data: J(g.after, { data: {} }).data, deleted: true };
        this.writeState(g.coll, g.doc_id, target, user ? user.id : null, at);
        const nid = this.logChange(g.coll, g.doc_id, 'undo', cur, target, user ? user.id : null, batch, label, g.id);
        this.db.prepare('UPDATE changes SET undone_by = ? WHERE id = ?').run(nid, g.id);
      }
      return { batch, count: todo.length, label };
    });
  }
  lastUndoable(userId) {
    const r = this.db.prepare("SELECT * FROM changes WHERE user_id = ? AND action <> 'undo' AND undone_by IS NULL ORDER BY id DESC LIMIT 1").get(userId);
    return r || null;
  }
  history({ limit = 100, offset = 0, coll, userId, docId } = {}) {
    const w = []; const a = [];
    if (coll) { w.push('c.coll = ?'); a.push(coll); }
    if (userId) { w.push('c.user_id = ?'); a.push(Number(userId)); }
    if (docId) { w.push('c.doc_id = ?'); a.push(Number(docId)); }
    // Aynı paketteki değişiklikler tek satır olarak gösterilir
    const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const rows = this.db.prepare(`SELECT c.batch, MAX(c.id) AS id, MIN(c.at) AS at, COUNT(*) AS n FROM changes c ${where} GROUP BY c.batch ORDER BY MAX(c.id) DESC LIMIT ? OFFSET ?`).all(...a, limit, offset);
    const total = this.db.prepare(`SELECT COUNT(DISTINCT c.batch) AS n FROM changes c ${where}`).get(...a).n;
    const out = rows.map((r) => {
      const items = this.db.prepare('SELECT c.*, u.full_name AS user_name FROM changes c LEFT JOIN users u ON u.id = c.user_id WHERE c.batch = ? ORDER BY c.id').all(r.batch);
      const first = items[0];
      return {
        id: r.id, batch: r.batch, at: first.at, n: r.n, user_id: first.user_id, user_name: first.user_name, label: first.label,
        action: first.action, undone: items.every((i) => i.undone_by), undoOf: first.undo_of,
        items: items.slice(0, 25).map((i) => ({ id: i.id, coll: i.coll, doc_id: i.doc_id, action: i.action, before: J(i.before, null), after: J(i.after, null), undone_by: i.undone_by })),
      };
    });
    return { total, rows: out };
  }

  // ---------- KYN kodu ----------
  nextCode(grupId) {
    const g = this.get('grup', grupId);
    if (!g) throw new AppError(400, 'Grup seçilmedi');
    const re = new RegExp(`^KYN-${g.kod}-(\\d+)$`);
    let max = 0;
    for (const d of this.all('hammadde', { withDeleted: true })) {
      for (const c of [d.kod, ...String(d.eskiKod || '').split(',')]) { const m = re.exec(String(c || '').trim()); if (m) max = Math.max(max, Number(m[1])); }
    }
    return `KYN-${g.kod}-${String(max + 1).padStart(3, '0')}`;
  }
  nextUrunCode() {
    let max = 0;
    for (const d of this.all('urun', { withDeleted: true })) { const m = /^MML-(\d+)$/.exec(String(d.kod || '')); if (m) max = Math.max(max, Number(m[1])); }
    return `MML-${String(max + 1).padStart(3, '0')}`;
  }
  // QR / barkod: hammadde (KYN-…) veya mamul (MML-…) kodu
  findAnyCode(code) {
    const c = String(code || '').trim().toUpperCase();
    const u = this.all('urun').find((d) => String(d.kod || '').toUpperCase() === c);
    if (u) return { type: 'urun', doc: u };
    const h = this.findByCode(c);
    return h ? { type: 'hammadde', doc: h } : null;
  }
  findByCode(code) {
    const c = String(code || '').trim().toUpperCase();
    const all = this.all('hammadde');
    return all.find((d) => String(d.kod).toUpperCase() === c) || all.find((d) => String(d.eskiKod || '').toUpperCase().split(',').map((s) => s.trim()).includes(c)) || null;
  }
}

function parseNum(v) {
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  return Number(s);
}
function dateOnly(v, label) {
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) { const t = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/); if (t) m = [null, t[3], t[2].padStart(2, '0'), t[1].padStart(2, '0')]; }
  if (!m) throw new AppError(400, `"${label}" geçersiz tarih (${s})`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || +m[1] < 2000 || +m[1] > 2100) throw new AppError(400, `"${label}" geçersiz tarih (${s})`);
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  return crypto.timingSafeEqual(crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 32), Buffer.from(hashHex, 'hex'));
}

module.exports = { Store, AppError, nowIso, J, round, trKey, parseNum, dateOnly, hashPassword, verifyPassword };
