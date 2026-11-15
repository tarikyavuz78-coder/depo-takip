/* Depo Takip 2 — alanlar, aranabilir seçim kutusu, kayıt formu ve genel liste */
'use strict';

// ================= Alan değeri gösterimi =================
function optLabel(f, v) {
  const o = (f.opts || []).find((x) => (Array.isArray(x) ? x[0] : x) === v);
  return o ? (Array.isArray(o) ? o[1] : o) : v;
}
function cellVal(f, v) {
  if (v === undefined || v === null || v === '') return '';
  switch (f.t) {
    case 'num': case 'int': return fmt(v);
    case 'date': return trD(v);
    case 'bool': return v ? 'Evet' : 'Hayır';
    case 'sel': return esc(optLabel(f, v));
    case 'multi': return esc((v || []).map((k) => optLabel(f, k)).join(', '));
    case 'ref': return esc(refName(f.ref, v));
    case 'mat': return esc(matName(v));
    case 'map': { const t = Object.values(v || {}).reduce((a, b) => a + b, 0); return fmt(t); }
    default: return esc(v);
  }
}
const isNumF = (f) => f.t === 'num' || f.t === 'int' || f.t === 'map';

// ================= Aranabilir seçim (hammadde) =================
// items: [{id, label, sub, group}]
function comboHtml(name, items, value, { placeholder = 'Yazın veya seçin…', req } = {}) {
  const cur = items.find((i) => String(i.id) === String(value));
  return `<div class="cb" data-cb="${esc(name)}"><input type="hidden" name="${esc(name)}" value="${value ?? ''}">
    <input class="input cb-in" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(cur ? cur.label : '')}" ${req ? 'data-req="1"' : ''}>
    <button type="button" class="ib sm clr" tabindex="-1" title="Temizle">${icon('x')}</button></div>`;
}
function bindCombo(root, name, items, onPick) {
  const box = $(`[data-cb="${CSS.escape(name)}"]`, root); if (!box) return;
  const hid = $('input[type=hidden]', box); const inp = $('.cb-in', box);
  let list = null; let act = -1; let shown = [];
  const c0 = items.find((i) => String(i.id) === hid.value); if (c0) inp.value = c0.label;
  const close = () => { if (list) { list.remove(); list = null; } act = -1; };
  const pick = (it) => {
    hid.value = it ? it.id : ''; inp.value = it ? it.label : ''; close();
    hid.dispatchEvent(new Event('change', { bubbles: true }));
    if (onPick) onPick(it);
  };
  const draw = () => {
    const q = fold(inp.value);
    const curLbl = (items.find((i) => String(i.id) === hid.value) || {}).label;
    const all = q && inp.value !== curLbl ? items.filter((i) => fold(i.label + ' ' + (i.sub || '') + ' ' + (i.group || '')).includes(q)) : items;
    shown = all.slice(0, 300);
    if (!list) { list = document.createElement('div'); list.className = 'cb-list'; box.appendChild(list); list.addEventListener('mousedown', (e) => e.preventDefault()); list.addEventListener('click', (e) => { const o = e.target.closest('.o'); if (o) pick(shown[+o.dataset.i]); }); }
    let g = null; let h = '';
    shown.forEach((it, i) => {
      if (it.group && it.group !== g) { g = it.group; h += `<div class="g">${esc(g)}</div>`; }
      h += `<div class="o ${i === act ? 'act' : ''}" data-i="${i}"><span>${esc(it.label)}</span>${it.sub ? `<span class="k">${esc(it.sub)}</span>` : ''}</div>`;
    });
    list.innerHTML = h || '<div class="none">Bulunamadı</div>';
    const a = list.querySelector('.o.act'); if (a) a.scrollIntoView({ block: 'nearest' });
  };
  inp.addEventListener('focus', () => { inp.select(); draw(); });
  inp.addEventListener('input', () => { act = 0; draw(); });
  inp.addEventListener('blur', () => {
    setTimeout(() => {
      close();
      const cur = items.find((i) => String(i.id) === hid.value);
      if (!inp.value.trim()) { if (hid.value) pick(null); } else if (!cur || cur.label !== inp.value) {
        const q = fold(inp.value); const ex = items.filter((i) => fold(i.label) === q || fold(i.sub || '') === q);
        if (ex.length === 1) pick(ex[0]); else inp.value = cur ? cur.label : '';
      }
    }, 120);
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!list) draw(); act = Math.min(shown.length - 1, act + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act - 1); draw(); }
    else if (e.key === 'Enter') { if (list && shown[act]) { e.preventDefault(); pick(shown[act]); } }
    else if (e.key === 'Escape') { if (list) { e.stopPropagation(); close(); } }
  });
  $('.clr', box).addEventListener('click', () => { pick(null); inp.focus(); });
  box.setValue = (id) => { const it = items.find((i) => String(i.id) === String(id)); hid.value = it ? it.id : ''; inp.value = it ? it.label : ''; };
}
function matItems(filterIds, keep) {
  let mats = defs('hammadde').slice().sort(matSort);
  if (filterIds && filterIds.size) mats = mats.filter((m) => filterIds.has(m.id));
  if (keep && !mats.some((m) => m.id === Number(keep)) && D('hammadde', keep)) mats.unshift(D('hammadde', keep));
  return mats.map((m) => ({ id: m.id, label: m.ad, sub: m.kod, group: refName('grup', m.grup) }));
}

// ================= Form alanı =================
function refOptions(f, value, ctx = {}) {
  let list = defs(f.ref).slice();
  if (ctx.filter) list = list.filter(ctx.filter);
  list.sort(f.ref === 'koliTipi' || f.ref === 'kapasite' ? (a, b) => refName(f.ref, a.id).localeCompare(refName(f.ref, b.id), 'tr') : bySira);
  if (value && !list.some((d) => d.id === Number(value)) && D(f.ref, value)) list.unshift(D(f.ref, value));
  return `<option value=""></option>` + list.map((d) => `<option value="${d.id}" ${Number(value) === d.id ? 'selected' : ''}>${esc(refName(f.ref, d.id))}${d._deleted ? ' (silinmiş)' : ''}</option>`).join('');
}
function fieldHtml(f, v, ctx = {}) {
  const id = 'f_' + f.k;
  const lab = `<span>${esc(f.l)}${f.req ? ' <em>*</em>' : ''}</span>`;
  const help = f.help ? `<div class="help">${esc(f.help)}</div>` : '';
  const ro = f.ro ? 'readonly' : '';
  const val = v === undefined || v === null ? '' : v;
  let inner;
  switch (f.t) {
    case 'num': case 'int':
      inner = `<input class="input num" name="${f.k}" id="${id}" inputmode="decimal" autocomplete="off" value="${val === '' ? '' : esc(String(val).replace('.', ','))}" ${ro}>`; break;
    case 'date': inner = `<input class="input" type="date" name="${f.k}" id="${id}" value="${esc(val)}" ${ro}>`; break;
    case 'bool': return `<div class="fld"><span>&nbsp;</span><label class="chk"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}> ${esc(f.l)}</label>${help}</div>`;
    case 'sel': inner = `<select class="input" name="${f.k}" id="${id}">${f.req && f.def !== undefined ? '' : '<option value=""></option>'}${(f.opts || []).map((o) => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`; break;
    case 'multi': inner = `<div class="chips" data-multi="${f.k}">${(f.opts || []).map((o) => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<label class="chk"><input type="checkbox" value="${esc(k)}" ${(v || []).includes(k) ? 'checked' : ''}> ${esc(l)}</label>`; }).join('')}</div>`; return `<div class="fld wide">${lab}${inner}${help}</div>`;
    case 'ref': inner = `<select class="input" name="${f.k}" id="${id}">${refOptions(f, v, ctx.refCtx && ctx.refCtx[f.k])}</select>`; break;
    case 'mat': inner = comboHtml(f.k, [], v, { req: f.req }); return `<div class="fld ${ctx.wideMat ? 'wide' : ''}">${lab}<div class="row" style="flex-wrap:nowrap"><div class="grow">${inner}</div>${ctx.noScan ? '' : `<button type="button" class="ib" data-scan="${f.k}" title="QR okut">${icon('scan')}</button>`}</div>${help}</div>`;
    case 'note': inner = `<textarea class="input" name="${f.k}" id="${id}" rows="3">${esc(val)}</textarea>`; return `<label class="fld wide">${lab}${inner}${help}</label>`;
    case 'map': return '';
    default: {
      const dl = f.sug ? `list="dl_${f.sug}"` : '';
      inner = `<input class="input" name="${f.k}" id="${id}" value="${esc(val)}" ${dl} ${ro} autocomplete="off" ${f.max ? `maxlength="${f.max}"` : ''}>`;
    }
  }
  return `<label class="fld ${f.t === 'note' ? 'wide' : ''}">${lab}${inner}${help}</label>`;
}
function datalists(fields) {
  const keys = [...new Set(fields.filter((f) => f.sug).map((f) => f.sug))];
  return keys.map((k) => `<datalist id="dl_${k}">${((S.meta.sug || {})[k] || []).map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`).join('');
}
function readForm(form, fields) {
  const o = {};
  for (const f of fields) {
    if (f.ro || f.t === 'map') continue;
    if (f.t === 'multi') { const box = $(`[data-multi="${f.k}"]`, form); if (box) o[f.k] = $$('input:checked', box).map((i) => i.value); continue; }
    const el = form.querySelector(`[name="${f.k}"]`);
    if (!el) continue;
    if (f.t === 'bool') o[f.k] = el.checked;
    else if (f.t === 'num' || f.t === 'int') { const s = el.value.trim(); o[f.k] = s === '' ? null : parseNum(s); if (s !== '' && !isFinite(o[f.k])) throw new Error(`"${f.l}" geçerli bir sayı değil`); }
    else if (f.t === 'ref' || f.t === 'mat') o[f.k] = el.value ? Number(el.value) : null;
    else o[f.k] = el.value.trim() === '' ? null : el.value;
  }
  return o;
}
// QR ile hammadde seçimi
function bindScanButtons(root) {
  $$('[data-scan]', root).forEach((b) => b.addEventListener('click', async () => {
    const code = codeFromScan(await scanQR());
    if (!code) return;
    try { const r = await api('GET', '/api/qr/' + encodeURIComponent(code) + '?tip=hammadde'); const box = $(`[data-cb="${b.dataset.scan}"]`, root); box.setValue(r.id); $('input[type=hidden]', box).dispatchEvent(new Event('change', { bubbles: true })); beep(true); }
    catch (e) { beep(false); toast(e.message, 'err'); }
  }));
}

// ================= Kayıt formu =================
// coll: kayıt türü, doc: düzenlenecek kayıt (yoksa yeni), preset: yeni kayıt için ön değerler
function openForm(coll, doc, preset = {}, opts = {}) {
  const sc = SC(coll);
  const fields = sc.fields.filter((f) => !f.hidden || (doc && doc[f.k] !== undefined && f.k !== 'eskiKod'));
  const isNew = !doc;
  const v = isNew ? { ...preset } : { ...doc };
  if (isNew) for (const f of fields) {
    if (v[f.k] !== undefined) continue;
    if (f.today) v[f.k] = defTarih();
    else if (f.def !== undefined) v[f.k] = f.def;
  }
  const isDef = sc.kind === 'def' || sc.kind === 'sys';
  const readOnly = isDef ? !can.admin() : (isNew ? !can.e(coll) : !can.d(coll));
  const canDel = isDef ? can.admin() : can.s(coll);
  const canNew = isDef ? can.admin() : can.e(coll);
  const special = FORM_SPECIAL[sc.form] || null;
  const body = special ? special.html(fields, v, doc) : `<div class="fgrid">${fields.map((f) => fieldHtml(f, v[f.k], { wideMat: true })).join('')}</div>`;
  const title = (isNew ? 'Yeni ' : '') + sc.one.toLocaleLowerCase('tr-TR') + (doc && doc.kod ? ` · ${doc.kod}` : '');
  const delCopy = !isNew ? `${canDel ? `<button class="btn danger" data-del>${icon('trash')}Sil</button>` : ''}${canNew ? `<button class="btn ghost" data-copy title="Bu kaydın kopyasıyla yeni kayıt">${icon('copy')}<span class="hide-m">Kopyala</span></button>` : ''}` : '';
  const foot = readOnly ? `${delCopy}<span class="spacer"></span><button class="btn" data-close>Kapat</button>` : `
    ${delCopy}
    <span class="spacer"></span><button class="btn" data-close>Vazgeç</button>
    ${isNew && sc.kind === 'rec' ? '<button class="btn" data-save-new>Kaydet ve yeni</button>' : ''}
    <button class="btn primary" data-save>${icon('check')}Kaydet</button>`;
  const cap = title.charAt(0).toLocaleUpperCase('tr-TR') + title.slice(1);
  return modal({
    title: esc(cap), size: special && special.size ? special.size : 'wide', body: `<form class="stack" autocomplete="off" onsubmit="return false">${body}${datalists(fields)}${!isNew ? `<div class="foot-note">Giren: ${esc(doc._by || '—')} · Son değişiklik: ${fmtDT(doc._u)}</div>` : ''}</form>`, foot,
    onMount: (m, close) => {
      const form = $('form', m);
      // hammadde seçimleri
      for (const f of fields.filter((x) => x.t === 'mat')) bindCombo(form, f.k, matItems(null, v[f.k]));
      bindScanButtons(form);
      if (special && special.mount) special.mount(form, fields, v, doc);
      if (readOnly) $$('input, select, textarea, button.clr, button[data-scan]', form).forEach((el) => { el.disabled = true; });
      const save = async (btn, again) => {
        let data;
        try { data = special && special.read ? special.read(form, fields) : readForm(form, fields); } catch (e) { return toast(e.message, 'err'); }
        if (opts.fixed) Object.assign(data, opts.fixed);
        setBusy(btn, true);
        try {
          const r = isNew ? await api('POST', `/api/c/${coll}`, data) : await api('PUT', `/api/c/${coll}/${doc.id}`, data);
          setBusy(btn, false);
          changed(r.change, isNew ? `${sc.one} kaydedildi` : `${sc.one} güncellendi`);
          if (sc.kind !== 'rec') await afterRemote(true);
          if (opts.onSaved) opts.onSaved(r.doc);
          if (again) {
            // Sık değişmeyen alanlar korunur
            const keep = {}; for (const k of opts.keepKeys || ['tarih', 'vardiya', 'hat', 'urun', 'firma', 'irsNo', 'depo', 'yon', 'durum', 'kisi', 'sorumlu', 'preformFirma']) if (data[k] !== undefined && data[k] !== null) keep[k] = data[k];
            close(); openForm(coll, null, { ...preset, ...keep }, opts);
          } else close();
          if (sc.kind === 'rec') rerender(true);
        } catch (e) { setBusy(btn, false); toast(e.message, 'err', { title: 'Kaydedilemedi' }); }
      };
      const sb = $('[data-save]', m); if (sb) sb.addEventListener('click', () => save(sb, false));
      const sn = $('[data-save-new]', m); if (sn) sn.addEventListener('click', () => save(sn, true));
      form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey && sb) { e.preventDefault(); save(sb, false); } });
      const db = $('[data-del]', m);
      if (db) db.addEventListener('click', async () => { if (await removeDoc(coll, doc)) close(); });
      const cp = $('[data-copy]', m);
      if (cp) cp.addEventListener('click', () => {
        const c = {}; for (const f of sc.fields) if (doc[f.k] !== undefined && !f.ro && !f.uniq) c[f.k] = doc[f.k];
        if (c.tarih) c.tarih = defTarih();
        close(); openForm(coll, null, c, opts);
      });
    },
  });
}
async function removeDoc(coll, doc) {
  const sc = SC(coll);
  if (sc.kind !== 'rec') {
    const name = refName(coll, doc.id) || sc.one;
    if (!await confirmBox(`${sc.one} silinsin mi?`, `<b>${esc(name)}</b> silinecek. Bağlı eski kayıtlar bozulmaz; yeni kayıtlarda seçilemez.<br><span class="muted small">"Geri al" ile geri getirebilirsiniz.</span>`, 'Sil', true)) return false;
  }
  try {
    const r = await api('DELETE', `/api/c/${coll}/${doc.id}`);
    changed(r.change, `${sc.one} silindi`);
    if (sc.kind !== 'rec') await afterRemote(true); else rerender(true);
    return true;
  } catch (e) { toast(e.message, 'err'); return false; }
}

// ================= Özel formlar =================
const FORM_SPECIAL = {};
const groupFs = (title, html) => `<fieldset class="fs"><legend>${esc(title)}</legend><div class="fgrid">${html}</div></fieldset>`;

// Üretim raporu: ürün seçilince preform/kapak/etiket/koli seçenekleri reçeteye göre süzülür, toplam koli anında hesaplanır
FORM_SPECIAL.uretim = {
  size: 'xwide',
  html(fields, v) {
    const F = (k) => fields.find((f) => f.k === k);
    const pick = (list) => list.map(F).filter(Boolean);
    const used = new Set(['tarih', 'vardiya', 'vardiyaSure', 'urun', 'hat', 'sorumlu', 'preform', 'kapak', 'etiket', 'preformFirma', 'preformAgirlik', 'koliTipi', 'aciklama']);
    const grp = (g) => fields.filter((f) => f.grp === g);
    for (const g of ['sayac', 'fire', 'palet']) grp(g).forEach((f) => used.add(f.k));
    const extra = fields.filter((f) => !used.has(f.k));
    const h = (list, o) => list.map((f) => fieldHtml(f, v[f.k], o)).join('');
    return `<div class="live" id="u-live"></div>
      ${groupFs('Genel', h(pick(['tarih', 'vardiya', 'vardiyaSure', 'urun', 'hat', 'sorumlu'])))}
      ${groupFs('Malzeme', h(pick(['preform', 'kapak', 'etiket']), { noScan: false }) + h(pick(['preformFirma', 'preformAgirlik', 'koliTipi'])))}
      ${groupFs('Sayaç ve süre', h(grp('sayac')))}
      ${groupFs('Fireler (adet; shrink gram)', h(grp('fire')))}
      ${groupFs('Palet / koli', h(grp('palet')))}
      ${extra.length ? groupFs('Diğer', h(extra)) : ''}
      <div class="fgrid">${h(pick(['aciklama']))}</div>`;
  },
  mount(form, fields, v) {
    const urunSel = $('[name=urun]', form);
    const pickSets = (urun) => {
      const r = defs('recete', { all: true }).filter((x) => x.urun === Number(urun));
      const s = (k) => new Set(r.filter((x) => x.secim === k).map((x) => x.hammadde));
      return { preform: s('preform'), kapak: s('kapak'), etiket: s('etiket') };
    };
    const refresh = (first) => {
      const u = Number(urunSel.value) || null;
      const sets = pickSets(u);
      for (const k of ['preform', 'kapak', 'etiket']) {
        const box = $(`[data-cb="${k}"]`, form); if (!box) continue;
        const cur = $('input[type=hidden]', box).value;
        const items = matItems(sets[k].size ? sets[k] : null, cur);
        box.replaceWith(Object.assign(document.createElement('div'), { innerHTML: comboHtml(k, items, cur) }).firstElementChild);
        bindCombo(form, k, items, () => calc());
        if (!first && sets[k].size === 1 && !cur) $(`[data-cb="${k}"]`, form).setValue([...sets[k]][0]);
      }
      const kt = $('[name=koliTipi]', form);
      if (kt) { const cur = kt.value; kt.innerHTML = refOptions({ ref: 'koliTipi' }, cur, { filter: (d) => !u || d.urun === u }); if (!first && !cur) { const o = defs('koliTipi').filter((d) => d.urun === u); if (o.length === 1) kt.value = o[0].id; } }
      const pf = $('[name=preformFirma]', form);
      if (pf) { let dlx = $('#dl_pf', form); if (!dlx) { dlx = document.createElement('datalist'); dlx.id = 'dl_pf'; form.appendChild(dlx); } pf.setAttribute('list', 'dl_pf'); dlx.innerHTML = defs('preformFirma').filter((d) => !u || d.urun === u).map((d) => `<option value="${esc(d.firma)}">${esc(d.agirlik || '')}</option>`).join(''); }
      calc();
    };
    const pfInp = $('[name=preformFirma]', form);
    if (pfInp) pfInp.addEventListener('change', () => {
      const u = Number(urunSel.value); const d = defs('preformFirma').find((x) => x.urun === u && fold(x.firma) === fold(pfInp.value));
      const ag = $('[name=preformAgirlik]', form); if (d && d.agirlik && ag && !ag.value) ag.value = d.agirlik;
    });
    const vs = $('[name=vardiya]', form);
    if (vs) vs.addEventListener('change', () => { const d = D('vardiya', vs.value); const s = $('[name=vardiyaSure]', form); if (d && s && !s.value) s.value = d.sure || ''; calc(); });
    const num = (k) => { const el = $(`[name=${k}]`, form); const n = el ? parseNum(el.value) : NaN; return isFinite(n) ? n : 0; };
    const calc = () => {
      const u = Number(urunSel.value);
      const kpp = {}; for (const p of defs('paletTipi')) if (p.urun === u) kpp[p.palet] = p.koliPalet;
      const koli = num('pStd') * (kpp.std || 0) + num('pIhr') * (kpp.ihr || 0) + num('pEuro') * (kpp.euro || 0) + num('paletsiz');
      const kt = D('koliTipi', ($('[name=koliTipi]', form) || {}).value);
      const adetKoli = kt ? (kt.adet || 0) * (kt.carpan || 1) : 0;
      const hat = Number(($('[name=hat]', form) || {}).value);
      const kap = (defs('kapasite').find((k) => k.hat === hat && k.urun === u) || {}).kapasite || 0;
      const vSure = num('vardiyaSure') || ((D('vardiya', vs && vs.value) || {}).sure || 0);
      const net = num('net');
      const vrm = (s) => (kap && s && net ? fmt(net / (kap * s / 60) * 100, 1) + ' %' : '—');
      const fire = num('fPrf') + num('fPet') + num('fKapak') + num('fEtiket') + num('fKulp');
      const giren = num('giren');
      const missing = ['pStd', 'pIhr', 'pEuro'].filter((k) => num(k) && !kpp[{ pStd: 'std', pIhr: 'ihr', pEuro: 'euro' }[k]]);
      $('#u-live', form).innerHTML = `<span>Toplam koli: <b>${fmt(koli)}</b></span>${adetKoli ? `<span>Net ÷ koli: <b>${fmt(net / adetKoli, 1)}</b></span>` : ''}<span>Vardiya verimi: <b>${vrm(vSure)}</b></span><span>Üretim verimi: <b>${vrm(num('sure'))}</b></span><span>Toplam fire: <b>${fmt(fire)}</b></span>${giren ? `<span>Sayaç farkı: <b>${fmt(num('fPrf') + num('fPet') + net - giren)}</b></span>` : ''}${missing.length ? `<span class="neg">Bu ürün için ${missing.map((k) => SC('uretim').fields.find((f) => f.k === k).l).join(', ')} koli/palet tanımı yok</span>` : ''}`;
    };
    urunSel.addEventListener('change', () => refresh(false));
    form.addEventListener('input', calc);
    form.addEventListener('change', calc);
    refresh(true);
  },
};

// Sevkiyat: tüm ürünler tek tabloda, yurtiçi ve ihracat yan yana
FORM_SPECIAL.sevkiyat = {
  size: 'wide',
  html(fields, v) {
    const urunler = defs('urun').slice().sort(bySira);
    const extra = fields.filter((f) => f.t !== 'map');
    const mv = v.miktar || {}; const iv = v.ihracat || {};
    const val = (x) => (x ? String(x).replace('.', ',') : '');
    const dog = new Set((v.dogrulanan || []).map(Number));
    return `<div class="fgrid">${extra.filter((f) => f.k !== 'aciklama' && f.k !== 'dogrulanan').map((f) => fieldHtml(f, v[f.k])).join('')}</div>
      <div class="scanbar" style="margin-top:12px"><div class="row" style="gap:8px;flex-wrap:wrap">
        ${cameraAvailable() ? `<button type="button" class="btn" data-sv-cam>${icon('scan')}Ürün QR okut</button>` : ''}
        <input class="input mono grow" data-scanbox data-sv-in placeholder="Barkod okuyucu ile okutun veya MML kodu yazıp Enter" style="min-width:200px" autocomplete="off">
        <label class="chk small" title="Okutulan ürünün sevk miktarını 1 koli artırır"><input type="checkbox" data-sv-add> Her okutmada +1 koli</label></div>
        <div class="small muted" data-sv-info style="margin-top:6px">Gönderilen ürünlerin etiketini okutarak doğrulayın. Doğrulanan satırlar ✓ ile işaretlenir.</div></div>
      <div class="tw" style="margin-top:12px"><table class="t dense"><thead><tr><th>Ürün</th><th class="num">Sevk (koli)</th><th class="num">İhracat (koli)</th><th class="num hide-m">Palet</th><th class="num hide-m">Stok</th><th>QR</th></tr></thead><tbody>
      ${urunler.map((u) => `<tr data-u="${u.id}"><td class="nm">${esc(u.ad)}${u.kod ? ` <span class="small muted mono">${esc(u.kod)}</span>` : ''}</td><td style="width:130px"><input class="input num" data-m="miktar" inputmode="decimal" value="${val(mv[u.id])}"></td><td style="width:130px"><input class="input num" data-m="ihracat" inputmode="decimal" value="${val(iv[u.id])}"></td><td class="num hide-m muted" data-p></td><td class="num hide-m small" data-st></td><td data-ok="${dog.has(u.id) ? 1 : ''}">${dog.has(u.id) ? '<span class="bdg ok">✓</span>' : ''}</td></tr>`).join('')}
      </tbody><tfoot><tr><td>Toplam</td><td class="num" data-t="miktar"></td><td class="num" data-t="ihracat"></td><td class="num hide-m" data-t="palet"></td><td class="hide-m"></td><td data-t="dog"></td></tr></tfoot></table></div>
      <div class="fgrid" style="margin-top:12px">${extra.filter((f) => f.k === 'aciklama').map((f) => fieldHtml(f, v[f.k])).join('')}</div>`;
  },
  mount(form, fields, v, doc) {
    let stok = null;
    // Güncel mamul stoğu (bu kaydın kendi miktarı geri eklenerek)
    api('GET', `/api/r/durum?tarih=${today()}`).then((r) => { stok = new Map(r.urunler.map((u) => [u.id, u.koli])); if (doc) for (const m of [doc.miktar, doc.ihracat]) for (const [k, q] of Object.entries(m || {})) stok.set(Number(k), (stok.get(Number(k)) || 0) + q); calc(); }).catch(() => {});
    const mark = (tr) => { const c = $('[data-ok]', tr); c.dataset.ok = '1'; c.innerHTML = '<span class="bdg ok">✓</span>'; tr.classList.add('flash'); setTimeout(() => tr.classList.remove('flash'), 900); };
    const onCode = async (raw) => {
      const code = codeFromScan(raw); if (!code) return;
      const info = $('[data-sv-info]', form);
      try {
        const r = await api('GET', '/api/qr/' + encodeURIComponent(code) + '?tip=urun');
        const tr = $(`tr[data-u="${r.id}"]`, form);
        if (!tr) throw new Error(`${r.ad} bu listede yok (pasif ürün)`);
        if ($('[data-sv-add]', form).checked) { const inp = $('[data-m=miktar]', tr); inp.value = String((parseNum(inp.value) || 0) + 1).replace('.', ','); }
        const q = (parseNum($('[data-m=miktar]', tr).value) || 0) + (parseNum($('[data-m=ihracat]', tr).value) || 0);
        mark(tr); beep(true);
        info.innerHTML = `<b>${esc(r.ad)}</b> doğrulandı${q ? ` · ${fmt(q)} koli` : ' · <span class="neg">sevk miktarı girilmemiş</span>'}`;
        if (!q) $('[data-m=miktar]', tr).focus();
        calc();
      } catch (e) { beep(false); info.innerHTML = `<span class="neg">${esc(e.message)}</span>`; }
    };
    const inp = $('[data-sv-in]', form);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onCode(inp.value); inp.value = ''; } });
    const cam = $('[data-sv-cam]', form); if (cam) cam.addEventListener('click', async () => onCode(await scanQR()));
    window.__scanTarget = onCode;
    const mo = new MutationObserver(() => { if (!document.body.contains(form)) { if (window.__scanTarget === onCode) window.__scanTarget = null; mo.disconnect(); } });
    mo.observe(document.body, { childList: true, subtree: true });
    const calc = () => {
      const t = { miktar: 0, ihracat: 0, palet: 0, dog: 0, sat: 0 };
      $$('tr[data-u]', form).forEach((tr) => {
        const u = D('urun', tr.dataset.u) || {};
        let pal = 0;
        for (const inp of $$('[data-m]', tr)) {
          const n = parseNum(inp.value) || 0; t[inp.dataset.m] += n;
          const kpp = inp.dataset.m === 'ihracat' ? u.ihrKoliPalet || u.sevkKoliPalet : u.sevkKoliPalet;
          if (kpp) pal += n / kpp;
        }
        t.palet += pal; $('[data-p]', tr).textContent = pal ? fmt(pal, 1) : '';
        const q = $$('[data-m]', tr).reduce((a, i) => a + (parseNum(i.value) || 0), 0);
        if (q) { t.sat++; if ($('[data-ok]', tr).dataset.ok) t.dog++; }
        const st = $('[data-st]', tr);
        if (stok) { const k = stok.get(Number(tr.dataset.u)) || 0; st.innerHTML = q > 0 && q > k + 1e-9 ? `<span class="neg" title="Sevk miktarı mamul stoğundan fazla">${fmt(k, 0)} ⚠</span>` : `<span class="muted">${fmt(k, 0)}</span>`; }
      });
      for (const k of ['miktar', 'ihracat', 'palet']) $(`[data-t=${k}]`, form).textContent = fmt(t[k], k === 'palet' ? 1 : undefined);
      $('[data-t=dog]', form).innerHTML = t.sat ? `<span class="bdg ${t.dog === t.sat ? 'ok' : 'warn'}">${t.dog}/${t.sat}</span>` : '';
    };
    form.addEventListener('input', calc); calc();
  },
  read(form, fields) {
    const o = readForm(form, fields.filter((f) => f.t !== 'map' && f.k !== 'dogrulanan'));
    o.miktar = {}; o.ihracat = {};
    o.dogrulanan = $$('[data-ok="1"]', form).map((td) => Number(td.closest('tr').dataset.u));
    $$('tr[data-u]', form).forEach((tr) => {
      for (const inp of $$('[data-m]', tr)) {
        const s = inp.value.trim(); if (!s) continue;
        const n = parseNum(s); if (!isFinite(n)) throw new Error(`${D('urun', tr.dataset.u).ad}: geçersiz sayı`);
        if (n) o[inp.dataset.m][tr.dataset.u] = n;
      }
    });
    return o;
  },
};

// ================= Genel kayıt listesi =================
const LIST_STATE = {};
function listCols(coll) {
  const sc = SC(coll);
  const cols = [];
  for (const f of sc.fields) {
    if (f.hidden || !f.list) continue;
    if (f.t === 'mat') cols.push({ k: f.k + '__kod', l: 'KYN kodu', get: (d) => matCode(d[f.k]), cls: 'mono small' });
    cols.push({ k: f.k, l: f.l, f, num: isNumF(f), get: (d) => (f.t === 'map' ? Object.values(d[f.k] || {}).reduce((a, b) => a + b, 0) : d[f.k]), html: (d) => cellVal(f, d[f.k]) });
  }
  for (const c of sc.computed || []) if (c.list) cols.push({ k: '_x.' + c.k, l: c.l, num: true, comp: true, get: (d) => (d._x || {})[c.k], html: (d) => fmt((d._x || {})[c.k], c.k.includes('Vrm') ? 1 : undefined) });
  if (sc.kind === 'rec') cols.push({ k: '_by', l: 'Giren', get: (d) => d._by || '', html: (d) => `${esc(d._by || '')}<div class="small muted">${fmtDT(d._c)}</div>`, cls: 'small' });
  return cols;
}
async function renderRecList(main, ctx) {
  const coll = ctx.m[1];
  const sc = SC(coll);
  if (sc.kind !== 'rec') throw new Error('Bilinmeyen kayıt türü');
  setTitle(sc.label);
  const st = LIST_STATE[coll] || (LIST_STATE[coll] = { q: '', sort: null, desc: true, mat: '' });
  if (ctx.q.hammadde) st.mat = ctx.q.hammadde;
  const r = await api('GET', `/api/c/${coll}?ay=${S.ay}`);
  if (!ctx.alive()) return;
  const rows = r.rows;
  const cols = listCols(coll);
  const hasMat = sc.fields.some((f) => f.k === 'hammadde');
  main.innerHTML = pageHead(esc(sc.label), `${ayAdi(S.ay)} · <span id="cnt"></span>`,
    `<button class="btn" data-act="xls-list" data-coll="${coll}">${icon('excel')}<span class="hide-m">Excel</span></button>
     ${can.e(coll) ? `<button class="btn primary" data-act="new-rec" data-coll="${coll}">${icon('plus')}Yeni kayıt</button>` : ''}`) +
    `<div class="card"><div class="card-h">
      <div class="search grow" style="max-width:360px">${icon('search')}<input class="input" id="lq" placeholder="Listede ara…" value="${esc(st.q)}"></div>
      ${hasMat ? `<div style="width:min(320px,100%)">${comboHtml('fmat', [], st.mat, { placeholder: 'Hammaddeye göre süz…' })}</div>` : ''}
      <span class="spacer"></span>${coll === 'sayim' ? '<span class="muted small">Fark = sayılan − sistemdeki stok (sayım anında)</span>' : ''}
    </div><div class="tw tbl-scroll" id="lt"></div></div>`;
  if (hasMat) bindCombo(main, 'fmat', matItems(new Set(rows.map((d) => d.hammadde))), (it) => { st.mat = it ? String(it.id) : ''; draw(); });
  const draw = () => {
    const q = fold(st.q);
    let list = rows.filter((d) => (!st.mat || String(d.hammadde) === st.mat));
    if (q) list = list.filter((d) => fold(cols.map((c) => { const v = c.get(d); return c.f ? (c.f.t === 'ref' ? refName(c.f.ref, v) : c.f.t === 'mat' ? matName(v) : c.f.t === 'sel' ? optLabel(c.f, v) : v) : v; }).join(' ') + ' ' + (d.aciklama || '') + ' ' + (d.lotNo || '')).includes(q));
    const sk = st.sort;
    if (sk) {
      const c = cols.find((x) => x.k === sk);
      const key = (d) => { const v = c.get(d); return c.f && c.f.t === 'ref' ? refName(c.f.ref, v) : c.f && c.f.t === 'mat' ? matName(v) : v ?? ''; };
      list.sort((a, b) => { const x = key(a), y = key(b); const r2 = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'tr', { numeric: true }); return st.desc ? -r2 : r2; });
    } else list.sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : b.id - a.id));
    $('#cnt').textContent = `${fmt(list.length)} kayıt`;
    const tot = {};
    for (const c of cols) if (c.num && !/Vrm|fark/i.test(c.k)) tot[c.k] = list.reduce((a, d) => a + (Number(c.get(d)) || 0), 0);
    const showTot = list.length > 1 && Object.keys(tot).length && (hasMat ? !!st.mat : true);
    $('#lt').innerHTML = list.length ? `<table class="t cards"><thead><tr>${cols.map((c) => `<th class="sortable ${c.num ? 'num' : ''}" data-sort="${c.k}">${esc(c.l)}${st.sort === c.k ? (st.desc ? ' ↓' : ' ↑') : ''}</th>`).join('')}<th></th></tr></thead><tbody>
      ${list.map((d) => `<tr class="click" data-id="${d.id}">${cols.map((c, i) => `<td data-l="${esc(c.l)}" class="${i === 0 ? 'first ' : ''}${c.num ? 'num' : ''} ${c.cls || ''}">${c.html ? c.html(d) : esc(c.get(d) ?? '')}</td>`).join('')}
        <td class="acts">${can.s(coll) ? `<button class="ib sm" data-del="${d.id}" title="Sil">${icon('trash')}</button>` : ''}</td></tr>`).join('')}
      </tbody>${showTot ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.num ? 'num' : ''}" data-l="${esc(c.l)}">${i === 0 ? 'Toplam' : tot[c.k] !== undefined ? fmt(tot[c.k]) : ''}</td>`).join('')}<td></td></tr></tfoot>` : ''}</table>`
      : `<div class="empty">${rows.length ? 'Aramaya uygun kayıt yok' : `${ayAdi(S.ay)} için kayıt yok.`}${can.e(coll) && !rows.length ? `<div style="margin-top:10px"><button class="btn primary" data-act="new-rec" data-coll="${coll}">${icon('plus')}İlk kaydı ekle</button></div>` : ''}</div>`;
  };
  draw();
  $('#lq').addEventListener('input', (e) => { st.q = e.target.value; draw(); });
  $('#lt').addEventListener('click', async (e) => {
    const th = e.target.closest('[data-sort]');
    if (th) { if (st.sort === th.dataset.sort) { if (!st.desc) st.sort = null; else st.desc = false; } else { st.sort = th.dataset.sort; st.desc = true; } return draw(); }
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); const d = rows.find((x) => x.id === Number(del.dataset.del)); return removeDoc(coll, d); }
    const tr = e.target.closest('tr[data-id]');
    if (tr) openForm(coll, rows.find((x) => x.id === Number(tr.dataset.id)));
  });
}
route(/^\/k\/(\w+)$/, renderRecList);
ACTS['new-rec'] = (el) => openForm(el.dataset.coll, null, el.dataset.preset ? JSON.parse(el.dataset.preset) : {});
ACTS['xls-list'] = (el) => dl(`/api/x/liste?coll=${el.dataset.coll}&ay=${S.ay}`);

// ================= QR okuma =================
let scanResolve = null;
window.__onNativeScan = (text) => { if (scanResolve) { const r = scanResolve; scanResolve = null; r(text); } };
window.__onNativeScanCancel = () => { if (scanResolve) { const r = scanResolve; scanResolve = null; r(null); } };
function cameraAvailable() { return !!(native && native.scanQR) || ('BarcodeDetector' in window && window.isSecureContext && navigator.mediaDevices); }
function scanQR() {
  if (native && native.scanQR) return new Promise((resolve) => { scanResolve = resolve; native.scanQR(); });
  if ('BarcodeDetector' in window && window.isSecureContext && navigator.mediaDevices) return scanWithBrowser();
  toast('Bu cihazda kamera ile okutma yok. Kodu yazın veya USB/Bluetooth barkod okuyucu kullanın.', 'warn');
  return Promise.resolve(null);
}
function scanWithBrowser() {
  return new Promise(async (resolve) => {
    let stream, stop = false, done = false;
    const m = modal({ title: 'QR okut', body: '<div class="cam"><video playsinline muted></video><div class="frame"></div></div><p class="muted small" style="text-align:center;margin-top:8px">QR kodu çerçevenin içine getirin</p>', onClose: () => finish(null) });
    const finish = (v) => { if (done) return; done = true; stop = true; if (stream) stream.getTracks().forEach((t) => t.stop()); m.close(); resolve(v); };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const vid = $('video', m.el); vid.srcObject = stream; await vid.play();
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => { if (stop) return; try { const r = await det.detect(vid); if (r.length) return finish(r[0].rawValue); } catch (e) { /* yoksay */ } requestAnimationFrame(tick); };
      tick();
    } catch (e) { toast('Kamera açılamadı: ' + e.message, 'err'); finish(null); }
  });
}
function codeFromScan(text) {
  if (!text) return null;
  const t = String(text).trim();
  const mm = t.match(/KYN-[A-Z]{2,4}-\d{3,}|MML-\d{3,}/i);
  return mm ? mm[0].toUpperCase() : t;
}
