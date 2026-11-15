/* Depo Takip 2 — tanımlar, reçeteler, form alanları, değişiklik geçmişi, ayarlar, etiketler */
'use strict';

// ================= Tanım listeleri =================
function defTable(coll, { rows, extraCols = [], onRow, group } = {}) {
  const sc = SC(coll);
  const cols = sc.fields.filter((f) => f.list && !f.hidden);
  const list = rows || defs(coll, { all: true }).slice().sort(bySira);
  if (!list.length) return '<div class="empty">Kayıt yok</div>';
  let g = null;
  return `<table class="t dense cards" data-coll="${coll}"><thead><tr>${cols.map((f) => `<th class="${isNumF(f) ? 'num' : ''}">${esc(f.l)}</th>`).join('')}${extraCols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.l)}</th>`).join('')}<th></th></tr></thead><tbody>
    ${list.map((d) => { const gk = group ? group(d) : null; const gr = group && gk !== g ? `<tr class="grp"><td colspan="${cols.length + extraCols.length + 1}">${esc(g = gk)}</td></tr>` : '';
      return gr + `<tr class="click ${d.aktif === false ? 'off' : ''}" data-id="${d.id}">${cols.map((f, i) => `<td class="${i === 0 ? 'first ' : ''}${isNumF(f) ? 'num' : ''} ${f.k === 'kod' ? 'mono small' : ''}" data-l="${esc(f.l)}">${cellVal(f, d[f.k])}</td>`).join('')}${extraCols.map((c) => `<td class="${c.num ? 'num' : ''}" data-l="${esc(c.l)}">${c.html(d)}</td>`).join('')}
      <td class="acts">${can.admin() ? `<button class="ib sm" data-edit="${d.id}" title="Düzenle">${icon('edit')}</button><button class="ib sm" data-del="${d.id}" title="Sil">${icon('trash')}</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table>`;
}
function bindDefTable(root, coll, onRow) {
  root.addEventListener('click', (e) => {
    const t = e.target.closest(`table[data-coll="${coll}"]`); if (!t) return;
    const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); return removeDoc(coll, D(coll, del.dataset.del)); }
    const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); return openForm(coll, D(coll, ed.dataset.edit)); }
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (onRow) onRow(Number(tr.dataset.id)); else openForm(coll, D(coll, tr.dataset.id));
  });
}
const addBtn = (coll, label, preset) => (can.admin() ? `<button class="btn primary" data-act="new-def" data-coll="${coll}" ${preset ? `data-preset='${esc(JSON.stringify(preset))}'` : ''}>${icon('plus')}${label || 'Yeni'}</button>` : '');
ACTS['new-def'] = (el) => openForm(el.dataset.coll, null, el.dataset.preset ? JSON.parse(el.dataset.preset) : {});

const DEF_HELP = {
  grup: 'Hammadde grupları. Grup kodu KYN kodlarında kullanılır (KYN-PRF-001).',
  urun: 'Mamul ürünler. Sevkiyat koli/palet ve kg bilgileri sevkiyat raporunda palet, kg ve tır hesabı için kullanılır.',
};
route(/^\/t\/(\w+)$/, async (main, ctx) => {
  const coll = ctx.m[1];
  const sc = SC(coll);
  if (sc.kind !== 'def') throw new Error('Bilinmeyen tanım');
  setTitle(sc.label);
  if (coll === 'hammadde') return renderMatList(main, ctx);
  main.innerHTML = pageHead(esc(sc.label), DEF_HELP[coll] || '', `<button class="btn" data-act="xls-list" data-coll="${coll}">${icon('excel')}<span class="hide-m">Excel</span></button>${addBtn(coll, 'Yeni ' + sc.one.toLocaleLowerCase('tr-TR'))}`) +
    `<div class="card"><div class="tw">${defTable(coll)}</div></div>`;
  bindDefTable(main, coll);
});

async function renderMatList(main, ctx) {
  const st = LIST_STATE.mat || (LIST_STATE.mat = { q: '', grup: '' });
  const g = (await api('GET', '/api/r/guncel')).rows;
  if (!ctx.alive()) return;
  main.innerHTML = pageHead('Hammaddeler', 'KYN kodu otomatik verilir ve değişmez. Satıra tıklayınca hammadde kartı açılır.',
    `<button class="btn" data-act="xls-list" data-coll="hammadde">${icon('excel')}<span class="hide-m">Excel</span></button><a class="btn" href="#/etiket">${icon('print')}<span class="hide-m">Etiketler</span></a>${addBtn('hammadde', 'Yeni hammadde')}`) +
    `<div class="card"><div class="card-h"><div class="search" style="width:min(320px,100%)">${icon('search')}<input class="input" id="mq" placeholder="Ad veya KYN kodu…" value="${esc(st.q)}"></div>
      <select class="input" id="mg" style="width:auto"><option value="">Tüm gruplar</option>${defs('grup', { all: true }).sort(bySira).map((x) => `<option value="${x.id}" ${String(x.id) === st.grup ? 'selected' : ''}>${esc(x.ad)}</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" id="mp" ${st.pasif ? 'checked' : ''}> Pasifleri göster</label><span class="spacer"></span><span class="muted small" id="mc"></span></div>
      <div class="tw tbl-scroll" id="mt"></div></div>`;
  const extra = [
    { l: 'Ana depo', num: true, html: (d) => sgn((g[d.id] || {}).ana) },
    { l: 'Cep depo', num: true, html: (d) => sgn((g[d.id] || {}).cep) },
    { l: 'Kullanılabilen', num: true, html: (d) => `<b>${sgn((g[d.id] || {}).kullanilabilen)}</b>` },
    { l: 'Durum', html: (d) => { const x = g[d.id]; return x && x.durum !== 'normal' ? durumBdg(x.durum) : ''; } },
  ];
  const draw = () => {
    const q = fold(st.q);
    const rows = defs('hammadde', { all: true }).filter((d) => (st.pasif || d.aktif !== false) && (!st.grup || String(d.grup) === st.grup) && (!q || fold(d.ad + ' ' + d.kod + ' ' + (d.eskiKod || '')).includes(q))).sort(matSort);
    $('#mc').textContent = `${rows.length} kalem`;
    $('#mt').innerHTML = defTable('hammadde', { rows, extraCols: extra, group: (d) => refName('grup', d.grup) });
  };
  $('#mq').addEventListener('input', (e) => { st.q = e.target.value; draw(); });
  $('#mg').addEventListener('change', (e) => { st.grup = e.target.value; draw(); });
  $('#mp').addEventListener('change', (e) => { st.pasif = e.target.checked; draw(); });
  bindDefTable(main, 'hammadde', (id) => go('/h/' + id));
  draw();
}

// Diğer tanımlar (sekmeli)
const TANIM_TABS = [['hat', 'Hatlar'], ['kapasite', 'Hat kapasiteleri'], ['koliTipi', 'Koli tipleri'], ['paletTipi', 'Palet tipleri'], ['preformFirma', 'Preform firmaları'], ['vardiya', 'Vardiyalar'], ['personel', 'Personel']];
const TANIM_HELP = {
  hat: 'Üretim hatları.', kapasite: 'Hat + ürün için saatlik kapasite (adet). Verimlilik hesabında kullanılır.',
  koliTipi: 'Ürün başına koli / paket tipi ve adedi. Üretim formunda seçilir.', paletTipi: 'Ürün başına palet türündeki koli sayısı. Toplam koli = palet × koli/palet + paletsiz koli.',
  preformFirma: 'Ürün başına preform tedarikçisi ve ağırlığı (üretim formunda öneri olarak gelir).', vardiya: 'Vardiyalar ve süreleri (dakika).', personel: 'Hat sorumluları.',
};
route(/^\/tanim$/, async (main, ctx) => {
  const tab = ctx.q.tab && SC(ctx.q.tab).kind === 'def' ? ctx.q.tab : (LIST_STATE.tanimTab || 'hat');
  LIST_STATE.tanimTab = tab;
  setTitle('Tanımlar');
  const byUrun = ['kapasite', 'koliTipi', 'paletTipi', 'preformFirma'].includes(tab);
  const rows = defs(tab, { all: true }).slice().sort(byUrun ? (a, b) => (D('urun', a.urun) || {}).sira - (D('urun', b.urun) || {}).sira || refName(tab, a.id).localeCompare(refName(tab, b.id), 'tr') : bySira);
  main.innerHTML = pageHead('Hat, palet, koli ve diğer tanımlar', TANIM_HELP[tab], `<button class="btn" data-act="xls-list" data-coll="${tab}">${icon('excel')}<span class="hide-m">Excel</span></button>${addBtn(tab, 'Yeni ' + SC(tab).one.toLocaleLowerCase('tr-TR'))}`) +
    `<div class="tabs">${TANIM_TABS.map(([k, l]) => `<a href="#/tanim?tab=${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>
    <div class="card"><div class="tw">${defTable(tab, { rows, group: byUrun ? (d) => refName('urun', d.urun) : null })}</div></div>`;
  bindDefTable(main, tab);
});

// ================= Reçeteler =================
route(/^\/recete$/, async (main, ctx) => {
  setTitle('Reçeteler');
  const urunler = defs('urun', { all: true }).slice().sort(bySira);
  const uid = Number(ctx.q.urun) || LIST_STATE.recUrun || (urunler[0] || {}).id;
  LIST_STATE.recUrun = uid;
  const u = D('urun', uid);
  const lines = defs('recete', { all: true }).filter((r) => r.urun === uid).sort((a, b) => (a.sira || 0) - (b.sira || 0) || a.id - b.id);
  const SEC = { hepsi: '', preform: 'Preform seçilirse', kapak: 'Kapak seçilirse', etiket: 'Etiket seçilirse', hat: 'Hat' };
  const BAZ = { koli: 'Koli', paletsiz: 'Paletsiz koli', palet: 'Palet' };
  const fk = Object.fromEntries((SC('recete').fields.find((f) => f.k === 'fireKaynak') || { opts: [] }).opts);
  main.innerHTML = pageHead('Reçeteler', 'Her üretim kaydında: kullanılan = taban × miktar; fire = seçili fire alanlarının toplamı × çarpan. "Ne zaman" koşulu seçilen preform/kapak/etiket/hattı ifade eder.',
    `${can.admin() ? `<button class="btn" data-act="rec-copy">${icon('copy')}Başka üründen kopyala</button>${addBtn('recete', 'Satır ekle', { urun: uid, sira: (lines.length + 1) })}` : ''}`) +
    `<div class="card"><div class="card-h"><select class="input" id="ru" style="width:auto;min-width:220px">${urunler.map((x) => `<option value="${x.id}" ${x.id === uid ? 'selected' : ''}>${esc(x.ad)}</option>`).join('')}</select>
      <span class="muted small">${lines.filter((l) => l.aktif !== false).length} aktif satır</span><span class="spacer"></span>
      ${u ? `<span class="small muted">Koli/palet: ${defs('paletTipi').filter((p) => p.urun === uid).map((p) => `${PAL_TR[p.palet]} ${fmt(p.koliPalet)}`).join(' · ') || '—'}</span>` : ''}</div>
      ${lines.length ? `<div class="tw"><table class="t dense cards"><thead><tr><th>Hammadde</th><th class="num">Miktar</th><th>Birim</th><th>Taban</th><th>Ne zaman</th><th>Fire kaynağı</th><th class="num">Fire çarpanı</th><th></th></tr></thead><tbody>
      ${lines.map((r, i) => `<tr class="click ${r.aktif === false ? 'off' : ''}" data-id="${r.id}"><td class="first" data-l="Hammadde"><div class="nm">${esc(matName(r.hammadde))}</div><div class="small muted"><span class="mono">${esc(matCode(r.hammadde))}</span>${r.not ? ' · ' + esc(r.not) : ''}${r.aktif === false ? ' · hesaba katılmaz' : ''}</div></td>
        <td class="num" data-l="Miktar">${fmtP(r.miktar)}</td><td data-l="Birim">${esc(r.birim || '')}</td><td data-l="Taban">${BAZ[r.baz || 'koli']}${r.baz === 'palet' ? ` <span class="small muted">(${(r.paletler || []).map((p) => PAL_TR[p]).join(', ')})</span>` : ''}</td>
        <td data-l="Ne zaman">${r.secim === 'hat' ? 'Hat: ' + esc(refName('hat', r.secimHat)) : SEC[r.secim || 'hepsi'] || ''}</td><td data-l="Fire" class="small">${(r.fireKaynak || []).map((k) => esc(fk[k] || k)).join(', ')}</td><td class="num" data-l="Çarpan">${r.fireKaynak && r.fireKaynak.length ? fmt(r.fireCarpan ?? 1) : ''}</td>
        <td class="acts">${can.admin() ? `<button class="ib sm" data-mv="-1" data-i="${i}" title="Yukarı" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="ib sm" data-mv="1" data-i="${i}" title="Aşağı" ${i === lines.length - 1 ? 'disabled' : ''}>${icon('down')}</button><button class="ib sm" data-del="${r.id}" title="Sil">${icon('trash')}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Bu ürünün reçetesi boş</div>'}</div>`;
  $('#ru').addEventListener('change', (e) => go('/recete?urun=' + e.target.value));
  main.addEventListener('click', async (e) => {
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      e.stopPropagation();
      const i = Number(mv.dataset.i), j = i + Number(mv.dataset.mv);
      const arr = lines.slice(); [arr[i], arr[j]] = [arr[j], arr[i]];
      const ops = arr.map((r, k) => ({ op: 'update', coll: 'recete', id: r.id, data: { sira: k + 1 } })).filter((o, k) => arr[k].sira !== k + 1);
      try { const r = await api('POST', '/api/batch', { ops, label: `${u.ad} reçete sırası` }); S.lastChange = r.change; await afterRemote(true); } catch (er) { toast(er.message, 'err'); }
      return;
    }
    const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); return removeDoc('recete', D('recete', del.dataset.del)); }
    const tr = e.target.closest('tr[data-id]'); if (tr) openForm('recete', D('recete', tr.dataset.id));
  });
  ACTS['rec-copy'] = () => {
    const others = urunler.filter((x) => x.id !== uid && defs('recete', { all: true }).some((r) => r.urun === x.id));
    modal({
      title: `${esc(u.ad)} için reçete kopyala`, body: `<div class="stack"><label class="fld"><span>Kaynak ürün</span><select class="input" id="cs">${others.map((x) => `<option value="${x.id}">${esc(x.ad)}</option>`).join('')}</select></label>
        <label class="chk"><input type="checkbox" id="cr"> Mevcut ${lines.length} satırı sil (tamamen değiştir)</label><p class="foot-note">İşlem tek seferde "Geri al" ile geri alınabilir.</p></div>`,
      foot: '<span class="spacer"></span><button class="btn" data-close>Vazgeç</button><button class="btn primary" data-ok>Kopyala</button>',
      onMount: (m, close) => $('[data-ok]', m).addEventListener('click', async () => {
        const src = Number($('#cs', m).value);
        const ops = [];
        if ($('#cr', m).checked) for (const r of lines) ops.push({ op: 'delete', coll: 'recete', id: r.id });
        const base = $('#cr', m).checked ? 0 : lines.length;
        defs('recete', { all: true }).filter((r) => r.urun === src).sort((a, b) => (a.sira || 0) - (b.sira || 0)).forEach((r, k) => {
          const data = {}; for (const f of SC('recete').fields) if (r[f.k] !== undefined) data[f.k] = r[f.k];
          data.urun = uid; data.sira = base + k + 1; ops.push({ op: 'create', coll: 'recete', data });
        });
        try { const r = await api('POST', '/api/batch', { ops, label: `${D('urun', src).ad} reçetesi ${u.ad} ürününe kopyalandı` }); close(); changed(r.change, `${ops.length} işlem yapıldı`); await afterRemote(true); } catch (er) { toast(er.message, 'err'); }
      }),
    });
  };
});

// ================= Form alanları =================
route(/^\/alanlar$/, async (main, ctx) => {
  setTitle('Form alanları');
  const colls = Object.entries(S.meta.schemas).filter(([, s]) => s.kind === 'rec' || s.kind === 'def');
  const coll = ctx.q.coll && S.meta.schemas[ctx.q.coll] ? ctx.q.coll : (LIST_STATE.alanColl || 'uretim');
  LIST_STATE.alanColl = coll;
  const sc = SC(coll);
  const TT = { text: 'Metin', num: 'Sayı', int: 'Tam sayı', date: 'Tarih', sel: 'Seçim listesi', ref: 'Listeden seçim', mat: 'Hammadde', multi: 'Çoklu seçim', bool: 'Evet/Hayır', note: 'Uzun metin', map: 'Ürün tablosu' };
  main.innerHTML = pageHead('Form alanları', 'Formlara kendi alanlarınızı ekleyin; hazır alanların adını değiştirin, gizleyin, zorunlu yapın veya listede gösterin. Her değişiklik geri alınabilir.',
    can.admin() ? `<button class="btn primary" data-act="alan-new">${icon('plus')}Yeni alan</button>` : '') +
    `<div class="card"><div class="card-h"><select class="input" id="ac" style="width:auto">
      <optgroup label="Kayıtlar">${colls.filter(([, s]) => s.kind === 'rec').map(([k, s]) => `<option value="${k}" ${k === coll ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</optgroup>
      <optgroup label="Tanımlar">${colls.filter(([, s]) => s.kind === 'def').map(([k, s]) => `<option value="${k}" ${k === coll ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</optgroup></select>
      <span class="spacer"></span><button class="btn sm" data-act="alan-preview">${icon('edit')}Formu önizle</button></div>
    <div class="tw"><table class="t dense cards"><thead><tr><th>Alan adı</th><th>Türü</th><th>Zorunlu</th><th>Listede</th><th>Durum</th><th></th></tr></thead><tbody>
    ${sc.fields.filter((f) => f.k !== 'eskiKod').map((f) => `<tr class="click ${f.hidden ? 'off' : ''}" data-k="${esc(f.k)}"><td class="first" data-l="Alan"><span class="nm">${esc(f.l)}</span>${f.custom ? ' <span class="bdg brand">eklenen</span>' : ''}${f._ov && !f.custom ? ' <span class="bdg">değiştirildi</span>' : ''}</td>
      <td data-l="Tür">${TT[f.t] || f.t}${f.t === 'sel' && f.custom ? ` <span class="small muted">(${(f.opts || []).length} seçenek)</span>` : ''}</td><td data-l="Zorunlu">${f.req ? 'Evet' : ''}</td><td data-l="Listede">${f.list ? 'Evet' : ''}</td><td data-l="Durum">${f.hidden ? '<span class="bdg">gizli</span>' : '<span class="bdg ok">görünür</span>'}</td>
      <td class="acts">${can.admin() ? `<button class="ib sm" title="Düzenle">${icon('edit')}</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div></div>
    <p class="foot-note" style="margin-top:10px">Eklenen alanlar kayıt formunda en altta görünür ve Excel listelerine sütun olarak eklenir. Bir alanı silmek, eski kayıtlardaki değerleri silmez.</p>`;
  $('#ac').addEventListener('change', (e) => go('/alanlar?coll=' + e.target.value));
  main.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-k]'); if (tr && can.admin()) alanModal(coll, sc.fields.find((f) => f.k === tr.dataset.k)); });
  ACTS['alan-new'] = () => alanModal(coll, null);
  ACTS['alan-preview'] = () => openForm(coll, null, {}, {});
});
function alanModal(coll, f) {
  const isNew = !f; const custom = isNew || f.custom;
  const ov = f && f._ov ? D('alan', f._ov) : null;
  const TYPES = [['text', 'Metin'], ['num', 'Sayı'], ['date', 'Tarih'], ['sel', 'Seçim listesi'], ['bool', 'Evet / Hayır'], ['note', 'Uzun metin']];
  const lockHide = !custom && f.req;
  modal({
    title: isNew ? `${esc(SC(coll).label)} · yeni alan` : `Alan: ${esc(f.l)}`,
    body: `<div class="stack">
      <label class="fld"><span>Alan adı <em>*</em></span><input class="input" id="al" value="${esc(f ? f.l : '')}" maxlength="60"></label>
      ${custom ? `<label class="fld"><span>Türü</span><select class="input" id="at" ${isNew ? '' : 'disabled'}>${TYPES.map(([k, l]) => `<option value="${k}" ${f && f.t === k ? 'selected' : ''}>${l}</option>`).join('')}</select>${isNew ? '' : '<div class="help">Tür, veri girildikten sonra değiştirilemez.</div>'}</label>
        <label class="fld" id="aow"><span>Seçenekler (her satıra bir tane)</span><textarea class="input" id="ao" rows="4">${esc(f && f.opts ? f.opts.join('\n') : '')}</textarea></label>` : `<div class="foot-note">Hazır alan · tür: ${esc(f.t)}${ov ? ` · özgün adı: ${esc((SC(coll).fields.find((x) => x.k === f.k) || {}).l)}` : ''}</div>`}
      <div class="chips"><label class="chk"><input type="checkbox" id="ar" ${f && f.req ? 'checked' : ''} ${!custom && f.req && !(ov && ov.req) ? 'disabled' : ''}> Zorunlu</label>
        <label class="chk"><input type="checkbox" id="ali" ${f && f.list ? 'checked' : ''}> Listede göster</label>
        <label class="chk"><input type="checkbox" id="ah" ${f && f.hidden ? 'checked' : ''} ${lockHide ? 'disabled' : ''}> Gizle</label></div>
      ${lockHide ? '<div class="foot-note">Zorunlu hazır alanlar gizlenemez.</div>' : ''}</div>`,
    foot: `${!isNew && (custom || ov) ? `<button class="btn danger" data-rm>${icon('trash')}${custom ? 'Alanı sil' : 'Özgün haline döndür'}</button>` : ''}<span class="spacer"></span><button class="btn" data-close>Vazgeç</button><button class="btn primary" data-ok>Kaydet</button>`,
    onMount: (m, close) => {
      const at = $('#at', m); const sync = () => { const w = $('#aow', m); if (w) w.classList.toggle('hidden', at.value !== 'sel'); };
      if (at) { at.addEventListener('change', sync); sync(); }
      $('[data-ok]', m).addEventListener('click', async () => {
        const l = $('#al', m).value.trim(); if (!l) return toast('Alan adı yazın', 'err');
        const data = { l, req: $('#ar', m).checked, list: $('#ali', m).checked, hidden: $('#ah', m).checked };
        try {
          let r;
          if (isNew) r = await api('POST', '/api/c/alan', { ...data, coll, k: 'x' + Date.now().toString(36), t: at.value, opts: $('#ao', m).value, sira: Date.now() % 1e6 });
          else if (custom) r = await api('PUT', `/api/c/alan/${f._ov}`, { ...data, opts: $('#ao', m) ? $('#ao', m).value : undefined });
          else if (ov) r = await api('PUT', `/api/c/alan/${ov.id}`, data);
          else r = await api('POST', '/api/c/alan', { ...data, coll, k: f.k, builtin: true });
          close(); changed(r.change, 'Alan kaydedildi'); await afterRemote(true);
        } catch (e) { toast(e.message, 'err'); }
      });
      const rm = $('[data-rm]', m);
      if (rm) rm.addEventListener('click', async () => { try { const r = await api('DELETE', `/api/c/alan/${f._ov}`); close(); changed(r.change, custom ? 'Alan silindi' : 'Alan özgün haline döndü'); await afterRemote(true); } catch (e) { toast(e.message, 'err'); } });
    },
  });
}

// ================= Değişiklik geçmişi =================
const ACT_TR = { create: 'eklendi', update: 'değiştirildi', delete: 'silindi', undo: 'geri alındı' };
function fieldOf(coll, k) { return (SC(coll).fields || []).find((f) => f.k === k) || { k, l: k, t: 'text' }; }
function diffHtml(it) {
  if (it.action !== 'update' && it.action !== 'undo') return '';
  const b = (it.before && it.before.data) || {}; const a = (it.after && it.after.data) || {};
  if (it.before && it.after && it.before.deleted !== it.after.deleted) return `<span class="d">${it.after.deleted ? 'silindi' : 'geri getirildi'}</span>`;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  return keys.slice(0, 6).map((k) => { const f = fieldOf(it.coll, k); const c = (v) => (v === undefined || v === null || v === '' ? '(boş)' : f.t === 'map' ? fmt(Object.values(v).reduce((x, y) => x + y, 0)) + ' koli' : cellVal(f, v) || '(boş)');
    return `<span class="d diff">${esc(f.l)}: <del>${c(b[k])}</del> → <ins>${c(a[k])}</ins></span>`; }).join('') + (keys.length > 6 ? `<span class="d">+${keys.length - 6} alan</span>` : '');
}
function histRow(r) {
  const it = r.items[0] || {};
  const sc = SC(it.coll);
  const what = r.label && !/^(geri alındı|yinelendi)$/.test(r.label) ? r.label : `${sc.one} ${r.label || ACT_TR[it.action] || it.action}`;
  const title = r.n === 1 && it.title ? `: <span class="muted">${esc(it.title)}</span>` : '';
  const mine = S.user && r.user_id === S.user.id;
  const canU = can.admin() || (mine && sc.kind === 'rec' && r.items.every((x) => can.d(x.coll) || can.s(x.coll)));
  let btn = '';
  if (r.undone) btn = '<span class="bdg">geri alındı</span>';
  else if (canU) btn = r.action === 'undo' ? `<button class="btn sm" data-undo="${r.id}" title="Geri almayı geri al">${icon('redo')}Yinele</button>` : `<button class="btn sm" data-undo="${r.id}">${icon('undo')}Geri al</button>`;
  return `<div class="it ${r.undone ? 'undone' : ''}"><div class="when" title="${fmtDT(r.at)}">${ago(r.at)}<div>${esc(r.user_name || 'Sistem')}</div></div>
    <div class="grow what"><b>${esc(what)}</b>${title}${r.n > 1 ? ` <span class="bdg">${fmt(r.n)} değişiklik</span>` : ''}<div class="det">${r.n === 1 ? diffHtml(it) : ''}</div></div>${btn}</div>`;
}
function bindHist(root) {
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-undo]'); if (b) { e.stopPropagation(); undoChange(Number(b.dataset.undo)); } });
}
route(/^\/gecmis$/, async (main, ctx) => {
  setTitle('Değişiklik geçmişi');
  const st = LIST_STATE.hist || (LIST_STATE.hist = { mine: false, coll: '', page: 0 });
  const per = 50;
  const qs = `limit=${per}&offset=${st.page * per}${st.mine ? '&mine=1' : ''}${st.coll ? '&coll=' + st.coll : ''}`;
  const h = await api('GET', '/api/history?' + qs);
  if (!ctx.alive()) return;
  const colls = Object.entries(S.meta.schemas).filter(([, s]) => s.kind !== 'sys');
  main.innerHTML = pageHead('Değişiklik geçmişi', 'Yapılan her ekleme, değişiklik ve silme burada. "Geri al" işlemi kaydı önceki haline döndürür; geri almayı da "Yinele" ile geri alabilirsiniz.') +
    `<div class="card"><div class="card-h">${can.admin() || P().gecmis === 'hepsi' ? `<div class="seg"><button data-m="0" class="${st.mine ? '' : 'on'}">Herkes</button><button data-m="1" class="${st.mine ? 'on' : ''}">Benim işlemlerim</button></div>` : '<span class="bdg">Yalnızca kendi işlemleriniz</span>'}
      <select class="input" id="hc" style="width:auto"><option value="">Tüm türler</option>${colls.map(([k, s]) => `<option value="${k}" ${st.coll === k ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
      <span class="spacer"></span><span class="muted small">${fmt(h.total)} işlem</span></div>
      <div class="list hist">${h.rows.map(histRow).join('') || '<div class="empty">Kayıt yok</div>'}</div>
      ${h.total > per ? `<div class="card-h" style="border-top:1px solid var(--line-2);border-bottom:0"><button class="btn sm" data-pg="-1" ${st.page ? '' : 'disabled'}>${icon('left')}Yeni</button><span class="muted small">Sayfa ${st.page + 1} / ${Math.ceil(h.total / per)}</span><button class="btn sm" data-pg="1" ${(st.page + 1) * per >= h.total ? 'disabled' : ''}>Eski${icon('right')}</button></div>` : ''}</div>`;
  bindHist(main);
  $$('[data-m]', main).forEach((b) => b.addEventListener('click', () => { st.mine = b.dataset.m === '1'; st.page = 0; rerender(); }));
  $('#hc').addEventListener('change', (e) => { st.coll = e.target.value; st.page = 0; rerender(); });
  $$('[data-pg]', main).forEach((b) => b.addEventListener('click', () => { st.page += Number(b.dataset.pg); rerender(); }));
});

// ================= Ayarlar =================
route(/^\/ayarlar$/, async (main, ctx) => {
  setTitle('Ayarlar');
  const tabs = [['genel', 'Genel'], ['telefon', 'Telefon bağlantısı']];
  if (can.admin()) tabs.push(['kullanicilar', 'Kullanıcılar ve yetkiler'], ['aktar', 'Excel içe aktarma'], ['yedek', 'Yedekleme']);
  else if (can.aktar() || can.e('sayim')) tabs.push(['aktar', 'Excel içe aktarma']);
  const tab = tabs.some(([k]) => k === ctx.q.tab) ? ctx.q.tab : 'genel';
  main.innerHTML = pageHead('Ayarlar') + `<div class="tabs">${tabs.map(([k, l]) => `<a href="#/ayarlar?tab=${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div><div id="sb"></div>`;
  const body = $('#sb', main);
  await ({ genel: setGenel, telefon: setTelefon, kullanicilar: setUsers, aktar: setAktar, yedek: setYedek })[tab](body, ctx);
});
async function setGenel(body) {
  const st = S.meta.settings;
  body.innerHTML = `<div class="grid g2" style="align-items:start">
    ${can.admin() ? `<section class="card card-b stack"><h2>Firma ve hesap ayarları</h2>
      <label class="fld"><span>Firma adı (raporlarda görünür)</span><input class="input" id="s-co" value="${esc(st.company)}"></label>
      <div class="fgrid"><label class="fld"><span>Tır kapasitesi (kg)</span><input class="input num" id="s-kg" value="${esc(st.kgTir)}"></label>
      <label class="fld"><span>Tır kapasitesi (palet)</span><input class="input num" id="s-pt" value="${esc(st.paletTir)}"></label>
      <label class="fld"><span>Tır kapasitesi (koli)</span><input class="input num" id="s-kt" value="${esc(st.koliTir)}"></label></div>
      <div><button class="btn primary" id="s-save">Kaydet</button></div></section>` : ''}
    <section class="card card-b stack"><h2>Hesabım</h2>
      <dl class="kv"><dt>Ad soyad</dt><dd>${esc(S.user.fullName)}</dd><dt>Kullanıcı adı</dt><dd>${esc(S.user.username)}</dd><dt>Yetki</dt><dd>${ROLE_TR[S.user.role]}</dd></dl>
      <form id="pw" class="stack"><label class="fld"><span>Mevcut şifre</span><input class="input" type="password" name="oldPassword" required autocomplete="current-password"></label>
      <label class="fld"><span>Yeni şifre</span><input class="input" type="password" name="newPassword" required minlength="4" autocomplete="new-password"></label>
      <div class="row"><button class="btn" type="submit">Şifreyi değiştir</button><span class="spacer"></span><button type="button" class="btn ghost" data-act="logout">${icon('logout')}Çıkış yap</button></div></form></section>
    <section class="card card-b stack"><h2>Bildirimler</h2><p class="muted small">Bir hammadde asgari stok altına indiğinde açık tüm ekranlarda uyarı gösterilir.${native ? ' Telefonda Android bildirimi olarak da gelir.' : ''}</p>
      ${!native && 'Notification' in window ? `<div><button class="btn" id="s-notif" ${Notification.permission === 'granted' ? 'disabled' : ''}>${icon('bell')}${Notification.permission === 'granted' ? 'Masaüstü bildirimleri açık' : 'Masaüstü bildirimlerini aç'}</button></div>` : ''}</section>
    <section class="card card-b stack"><h2>Hakkında</h2><div><a class="btn" href="/kilavuz.html" target="_blank">${icon('book')}Kullanım kılavuzu</a></div><dl class="kv" id="about"><dt>Sürüm</dt><dd>${esc(S.meta.version)}</dd></dl></section></div>`;
  const sv = $('#s-save', body);
  if (sv) sv.addEventListener('click', async () => {
    try { await api('PUT', '/api/settings', { company: $('#s-co', body).value, kgTir: $('#s-kg', body).value, paletTir: $('#s-pt', body).value, koliTir: $('#s-kt', body).value }); await loadMeta(); toast('Ayarlar kaydedildi', 'ok'); renderShell(); rerender(); } catch (e) { toast(e.message, 'err'); }
  });
  $('#pw', body).addEventListener('submit', async (e) => { e.preventDefault(); try { await api('POST', '/api/me/password', Object.fromEntries(new FormData(e.target))); toast('Şifre değiştirildi', 'ok'); e.target.reset(); } catch (er) { toast(er.message, 'err'); } });
  const nb = $('#s-notif', body); if (nb) nb.addEventListener('click', async () => { await Notification.requestPermission(); rerender(true); });
  try {
    const i = await api('GET', '/api/server-info');
    $('#about', body).innerHTML += `<dt>Sunucu bilgisayar</dt><dd>${esc(i.hostname)}</dd><dt>Bağlı ekran</dt><dd>${i.clients}</dd><dt>Kayıt sayısı</dt><dd>${fmt(i.kayit)}</dd><dt>Değişiklik sayısı</dt><dd>${fmt(i.degisiklik)}</dd>${can.admin() ? `<dt>Veri klasörü</dt><dd class="mono small">${esc(i.dataDir)}</dd>` : ''}${native && native.getVersion ? `<dt>Android uygulaması</dt><dd>${esc(native.getVersion())}</dd>` : ''}`;
  } catch (e) { /* yoksay */ }
}
async function setTelefon(body) {
  const i = await api('GET', '/api/server-info');
  const addrs = i.addresses;
  body.innerHTML = `<div class="grid g2" style="align-items:start">
    <section class="card card-b stack"><h2>Telefonu bağlayın</h2>
      <ol style="margin:0;padding-left:18px;line-height:1.8">
        <li>Telefonun Wi-Fi'si, bu bilgisayarın bağlı olduğu <b>modeme</b> bağlı olsun (bilgisayar kabloyla bağlı olabilir; aynı modem yeterlidir).</li>
        <li><b>Depo Takip</b> Android uygulamasını açın, “Sunucuyu QR ile bul” düğmesine basıp yandaki kodu okutun.</li>
        <li>Kendi kullanıcı adınız ve şifrenizle giriş yapın.</li></ol>
      <p class="foot-note">Elle girmek için adres: <b class="mono">${addrs[0] ? esc(addrs[0].url) : '—'}</b><br>Bağlanamıyorsanız: Windows güvenlik duvarında 8765 numaralı bağlantı noktasına izin verildiğinden (kurulum bunu yapar), ağın "Özel ağ" olarak ayarlandığından ve modemde "misafir ağı / AP yalıtımı" kapalı olduğundan emin olun.</p>
    </section>
    <section class="card card-b stack" style="justify-items:center;text-align:center">
      ${addrs.length ? addrs.map((a, idx) => `<div class="stack" style="justify-items:center;${idx ? 'opacity:.8' : ''}"><div class="pair-qr">${window.QR.toSvg(a.url, { ecl: 'M', border: 2 })}</div><div><b class="mono">${esc(a.url)}</b><div class="small muted">${esc(a.name)}${idx === 0 ? ' · önerilen' : ''}</div></div></div>`).join('<div class="divider" style="width:100%"></div>') : '<div class="empty">Bu bilgisayar bir ağa bağlı görünmüyor.</div>'}
    </section></div>`;
}
async function setUsers(body) {
  const users = await api('GET', '/api/users');
  const K = S.meta.permKat;
  const permSum = (u) => {
    if (u.role === 'admin') return 'Her şey';
    const p = u.perm; const w = Object.entries(p.c).filter(([, v]) => /[eds]/.test(v)).map(([c]) => SC(c).label);
    return `${w.length ? 'Yazar: ' + w.join(', ') : 'Yalnızca görüntüler'} · ${p.r.length} rapor${u.custom ? ' · <span class="bdg info">özel</span>' : ''}`;
  };
  body.innerHTML = `<div class="card"><div class="card-h"><h2>Kullanıcılar</h2><span class="spacer"></span>${can.r('islem') ? `<a class="btn" href="#/r/islem">${icon('history')}İşlem raporu</a>` : ''}<button class="btn primary" id="u-new">${icon('plus')}Yeni kullanıcı</button></div>
    <div class="tw"><table class="t cards"><thead><tr><th>Ad soyad</th><th>Kullanıcı adı</th><th>Rol</th><th>Yetkiler</th><th>Durum</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr class="click ${u.active ? '' : 'off'}" data-id="${u.id}"><td class="first nm" data-l="Ad">${esc(u.fullName)}</td><td data-l="Kullanıcı adı">${esc(u.username)}</td><td data-l="Rol">${esc(ROLE_TR[u.role])}</td><td data-l="Yetkiler" class="small">${permSum(u)}</td><td data-l="Durum">${u.active ? '<span class="bdg ok">aktif</span>' : '<span class="bdg">pasif</span>'}</td><td class="acts"><button class="ib sm">${icon('edit')}</button></td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card card-b" style="margin-top:10px"><table class="t dense"><tbody>${Object.entries(S.meta.roles).map(([k, l]) => `<tr><td class="nm">${esc(l)}</td><td class="small muted">${esc(S.meta.roleDesc[k] || '')}</td></tr>`).join('')}</tbody></table>
    <p class="foot-note">Rol, varsayılan yetkileri belirler. Kullanıcıyı açıp "Yetkileri özelleştir" ile hangi ekranı göreceğini ve kayıt ekleme / düzenleme / silme yetkilerini ayrı ayrı verebilirsiniz. Silinen veya düzeltilen kayıtlar geçmişten kaybolmaz.</p></div>`;
  const CH = [['g', 'Görür'], ['e', 'Ekler'], ['d', 'Düzenler'], ['s', 'Siler']];
  const permHtml = (p) => `<div class="tw"><table class="t dense perm"><thead><tr><th>Ekran / kayıt türü</th>${CH.map(([, l]) => `<th class="c">${l}</th>`).join('')}</tr></thead><tbody>
    ${K.rec.map((c) => `<tr data-pc="${c}"><td>${esc(SC(c).label)}</td>${CH.map(([ch]) => `<td class="c"><input type="checkbox" data-ch="${ch}" ${(p.c[c] || '').includes(ch) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="fs-t">Raporlar</div><div class="chips perm-r">${Object.entries(K.reports).map(([k, l]) => `<label class="chk"><input type="checkbox" data-r="${k}" ${p.r.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
    <div class="fgrid" style="margin-top:10px"><label class="fld"><span>Değişiklik geçmişi</span><select class="input" data-gecmis>${[['yok', 'Göremez'], ['kendi', 'Yalnızca kendi işlemleri'], ['hepsi', 'Herkesin işlemleri']].map(([k, l]) => `<option value="${k}" ${p.gecmis === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="chk" style="margin-top:20px"><input type="checkbox" data-panel ${p.panel !== false ? 'checked' : ''}> Ana paneli görür</label>
    <label class="chk" style="margin-top:20px"><input type="checkbox" data-aktar ${p.aktar ? 'checked' : ''}> Excel'den kayıt yükleyebilir</label></div>`;
  const readPerm = (box) => {
    const c = {}; $$('tr[data-pc]', box).forEach((tr) => { c[tr.dataset.pc] = $$('[data-ch]:checked', tr).map((i) => i.dataset.ch).join(''); });
    return { c, r: $$('[data-r]:checked', box).map((i) => i.dataset.r), gecmis: $('[data-gecmis]', box).value, panel: $('[data-panel]', box).checked, aktar: $('[data-aktar]', box).checked };
  };
  const um = (u) => modal({
    title: u ? esc(u.fullName) : 'Yeni kullanıcı', size: 'wide',
    body: `<form class="stack" id="uf"><div class="fgrid"><label class="fld"><span>Ad soyad</span><input class="input" name="fullName" value="${esc(u ? u.fullName : '')}" required></label>
      ${u ? `<label class="fld"><span>Kullanıcı adı</span><input class="input" value="${esc(u.username)}" disabled></label>` : '<label class="fld"><span>Kullanıcı adı</span><input class="input" name="username" autocapitalize="none" required></label>'}
      <label class="fld"><span>Rol</span><select class="input" name="role">${Object.entries(S.meta.roles).map(([k, l]) => `<option value="${k}" ${(u ? u.role : 'depo') === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="fld"><span>${u ? 'Yeni şifre (değiştirmek için)' : 'Şifre'}</span><input class="input" name="password" type="password" ${u ? '' : 'required'} minlength="4" autocomplete="new-password"></label></div>
      ${u ? `<label class="chk"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Aktif (pasif kullanıcı giriş yapamaz)</label>` : ''}
      <fieldset class="fs" id="pf"><legend><label class="chk"><input type="checkbox" id="pcust" ${u && u.custom ? 'checked' : ''}> Yetkileri özelleştir</label></legend><div id="pbox"></div></fieldset></form>`,
    foot: `${u && u.id !== S.user.id ? `<button class="btn danger" data-delu>${icon('trash')}Sil</button>` : ''}<span class="spacer"></span><button class="btn" data-close>Vazgeç</button><button class="btn primary" data-ok>Kaydet</button>`,
    onMount: (m, close) => {
      const f = $('#uf', m); const box = $('#pbox', m); const cust = $('#pcust', m);
      const draw = () => {
        const role = f.role.value;
        $('#pf', m).classList.toggle('hidden', role === 'admin');
        const p = cust.checked && u && u.custom && u.role === role ? u.perm : (box.dataset.role === role && box.innerHTML && cust.checked ? readPerm(box) : K.defaults[role]);
        box.innerHTML = permHtml(p); box.dataset.role = role;
        $$('input, select', box).forEach((i) => { i.disabled = !cust.checked; });
        if (!cust.checked) box.insertAdjacentHTML('afterbegin', `<p class="small muted" style="margin:0 0 8px">${esc(ROLE_TR[role])} rolünün varsayılan yetkileri. Değiştirmek için "Yetkileri özelleştir"i işaretleyin.</p>`);
      };
      f.role.addEventListener('change', () => { box.innerHTML = ''; draw(); });
      cust.addEventListener('change', () => { if (!cust.checked) box.innerHTML = ''; draw(); });
      box.addEventListener('change', (e) => { const i = e.target; if (i.dataset.ch && i.dataset.ch !== 'g' && i.checked) $('[data-ch=g]', i.closest('tr')).checked = true; if (i.dataset.ch === 'g' && !i.checked) $$('[data-ch]', i.closest('tr')).forEach((x) => { x.checked = false; }); });
      draw();
      $('[data-ok]', m).addEventListener('click', async () => {
        const d = Object.fromEntries(new FormData(f)); if (u) d.active = f.active.checked; if (!d.password) delete d.password;
        d.perms = cust.checked && d.role !== 'admin' ? readPerm(box) : null;
        try { if (u) await api('PUT', `/api/users/${u.id}`, d); else await api('POST', '/api/users', d); close(); toast('Kaydedildi', 'ok'); setUsers(body); } catch (e) { toast(e.message, 'err'); }
      });
      const del = $('[data-delu]', m);
      if (del) del.addEventListener('click', async () => {
        if (!await confirmBox('Kullanıcı silinsin mi?', `<b>${esc(u.fullName)}</b> silinecek. Bu kullanıcının yaptığı işlemler geçmişte korunur (hesap kapatılır, adı "(silindi)" olarak görünür).`, 'Sil', true)) return;
        try { const r = await api('DELETE', `/api/users/${u.id}`); close(); toast(r.korundu ? 'Kullanıcı kapatıldı, işlem geçmişi korundu' : 'Kullanıcı silindi', 'ok'); setUsers(body); } catch (e) { toast(e.message, 'err'); }
      });
    },
  });
  $('#u-new', body).addEventListener('click', () => um(null));
  $$('tr[data-id]', body).forEach((tr) => tr.addEventListener('click', () => um(users.find((x) => x.id === Number(tr.dataset.id)))));
}
function pickFile(accept) {
  return new Promise((resolve) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept || '.xlsx'; i.onchange = () => resolve(i.files[0] || null); i.click(); });
}
function dropzone(el, onFile) {
  el.addEventListener('click', async () => { const f = await pickFile('.xlsx,.xlsm'); if (f) onFile(f); });
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) onFile(f); });
}
async function setAktar(body) {
  const turler = Object.entries(S.meta.aktarTurler || {}).filter(([c]) => (SC(c).kind === 'def' ? can.admin() : can.e(c)));
  const kt = ls.get('kayitTur', turler[0] && turler[0][0]);
  body.innerHTML = `<div class="stack">
    ${(can.admin() || can.aktar()) && turler.length ? `<section class="card"><div class="card-h"><h2>Excel'den kayıt yükle</h2></div><div class="card-b stack">
      <p class="small muted">Geçmiş hammadde girişleri, çıkışlar, depolar arası transferler, üretim ve sevkiyat kayıtları, hammadde / mamul listeleri ve açılış stokları. Önce şablonu indirip doldurun; yüklediğinizde önizleme, hatalı satırlar ve mükerrer kayıtlar gösterilir.</p>
      <div class="row"><label class="fld grow" style="max-width:420px"><span>Ne yüklenecek?</span><select class="input" id="kt">${turler.map(([k, l]) => `<option value="${k}" ${k === kt ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <button class="btn" id="kt-s" style="margin-top:18px">${icon('download')}Şablonu indir</button></div>
      <div class="dropzone" id="dz3">${icon('upload')}<div>Doldurulmuş şablonu buraya bırakın veya seçmek için tıklayın</div></div><div id="imp3"></div></div></section>` : ''}
    ${can.admin() ? `<section class="card"><div class="card-h"><h2>Aylık Excel raporunu içe aktar</h2></div><div class="card-b stack">
      <p class="small muted">"Depo Stok Hammadde Raporu" Excel dosyanızı (Hammadde, Reçete, Üretim Raporu, Satınalma, Cep, İade, Iskarta, Sevkiyat sayfaları) yükleyin. Önce özet gösterilir; onaylarsanız o ayın tüm kayıtları uygulamaya aktarılır. Aktarma tek seferde geri alınabilir.</p>
      <div class="dropzone" id="dz1">${icon('upload')}<div>Excel dosyasını buraya bırakın veya seçmek için tıklayın</div></div><div id="imp1"></div></div></section>` : ''}
    <section class="card"><div class="card-h"><h2>Sayım şablonu</h2><span class="spacer"></span><button class="btn sm" data-act="xls" data-k="sablon">${icon('download')}Şablonu indir</button></div><div class="card-b stack">
      <p class="small muted">Şablona saydığınız ana depo / cep depo miktarlarını yazıp yükleyin. Farklar "Hammadde Sayımı" kaydı olarak işlenir.</p>
      <label class="fld" style="max-width:220px"><span>Sayım tarihi</span><input class="input" type="date" id="sy-t" value="${defTarih()}"></label>
      <div class="dropzone" id="dz2">${icon('upload')}<div>Doldurulmuş sayım şablonunu bırakın veya seçin</div></div><div id="imp2"></div></div></section>
    ${can.admin() ? '<section class="card" id="v1c"></section>' : ''}</div>`;
  if (can.admin()) dropzone($('#dz1', body), (f) => excelImport(f, $('#imp1', body)));
  if (can.e('sayim')) dropzone($('#dz2', body), (f) => sayimImport(f, $('#imp2', body), $('#sy-t', body).value));
  else { const c = $('#dz2', body); if (c) c.closest('section').remove(); }
  const ktS = $('#kt', body);
  if (ktS) {
    ktS.addEventListener('change', () => { ls.set('kayitTur', ktS.value); $('#imp3', body).innerHTML = ''; });
    $('#kt-s', body).addEventListener('click', () => dl(`/api/x/kayitSablon?coll=${ktS.value}`));
    dropzone($('#dz3', body), (f) => kayitImport(f, $('#imp3', body), ktS.value));
  }
  if (can.admin()) v1Card($('#v1c', body));
}
// 2.1: şablonla kayıt yükleme — önizleme, hata raporu, uygulama
async function postBlob(path, buf, name) {
  const res = await fetch(path, { method: 'POST', headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/octet-stream' }, body: buf });
  if (!res.ok) { let m = 'İndirilemedi'; try { m = (await res.json()).error; } catch (e) { /* yoksay */ } throw new Error(m); }
  const b = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function kayitImport(file, out, coll) {
  out.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const buf = await file.arrayBuffer();
  let p;
  try { p = await api('POST', `/api/import/kayit?coll=${coll}`, buf); } catch (e) { out.innerHTML = `<div class="banner danger">${icon('alert')}<div>${esc(e.message)}</div></div>`; return; }
  const DUR = { ok: ['Yüklenecek', 'ok'], guncelle: ['Güncellenecek', 'info'], hata: ['Hata', 'danger'], mukerrer: ['Mükerrer', 'warn'] };
  const st = { f: p.hatali ? 'hata' : '' };
  const yuk = p.kayitSayisi;
  const draw = () => {
    const rows = p.rows.filter((r) => !st.f || r.durum === st.f);
    out.innerHTML = `<div class="stack">
      <div class="banner ${p.hatali ? 'warn' : 'ok'}">${icon(p.hatali ? 'alert' : 'check')}<div><b>${esc(file.name)}</b> · ${esc(p.ad)}<br>${p.toplam} satır: <b>${p.gecerli}</b> geçerli${p.guncelle ? `, <b>${p.guncelle}</b> güncelleme` : ''}, <b>${p.hatali}</b> hatalı, <b>${p.mukerrer}</b> mükerrer (atlanır)${coll === 'sevkiyat' ? ` → ${yuk} sevkiyat kaydı` : ''}</div></div>
      <div class="row"><div class="seg" id="kf">${[['', 'Tümü'], ['hata', `Hatalı (${p.hatali})`], ['mukerrer', `Mükerrer (${p.mukerrer})`], ['ok', `Geçerli (${p.gecerli + p.guncelle})`]].map(([k, l]) => `<button data-f="${k}" class="${st.f === k ? 'on' : ''}">${l}</button>`).join('')}</div><span class="spacer"></span>
        ${p.hatali || p.mukerrer ? `<button class="btn sm" id="k-rap">${icon('excel')}Hata raporunu indir</button>` : ''}</div>
      <div class="tw" style="max-height:380px"><table class="t dense"><thead><tr><th class="num">Satır</th><th>Durum</th><th>Açıklama</th>${p.cols.slice(0, 6).map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
      ${rows.slice(0, 400).map((r) => `<tr><td class="num">${r.line}</td><td><span class="bdg ${DUR[r.durum][1]}">${DUR[r.durum][0]}</span></td><td class="small">${esc(r.mesaj || r.ozet || '')}</td>${r.raw.slice(0, 6).map((v) => `<td class="small">${esc(typeof v === 'number' && v > 30000 && v < 80000 ? trD(new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString()) : v ?? '')}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="9" class="empty">Satır yok</td></tr>'}
      </tbody></table></div>
      ${yuk ? `<div class="row">${p.hatali ? `<label class="chk"><input type="checkbox" id="k-atla"> Hatalı satırları atla, geçerli olanları yükle</label>` : ''}<button class="btn primary" id="k-go">${icon('upload')}${yuk} kaydı yükle</button><span class="muted small">Yüklemeden önce otomatik yedek alınır; tek seferde geri alınabilir.</span></div>` : '<div class="banner">Yüklenecek geçerli satır yok.</div>'}</div>`;
    $$('#kf button', out).forEach((b) => b.addEventListener('click', () => { st.f = b.dataset.f; draw(); }));
    const rp = $('#k-rap', out); if (rp) rp.addEventListener('click', () => postBlob(`/api/import/kayit?coll=${coll}&rapor=1`, buf, `Hata_Raporu_${file.name}`).catch((e) => toast(e.message, 'err')));
    const go2 = $('#k-go', out);
    if (go2) go2.addEventListener('click', async () => {
      const atla = $('#k-atla', out);
      if (p.hatali && !(atla && atla.checked)) return toast('Önce hataları düzeltin veya "hatalı satırları atla"yı işaretleyin', 'warn');
      setBusy(go2, true, 'Yükleniyor…');
      try {
        const r = await api('POST', `/api/import/kayit?coll=${coll}&apply=1${atla && atla.checked ? '&atla=1' : ''}`, buf);
        out.innerHTML = `<div class="banner ok">${icon('check')}<div><b>${r.sonuc.n} kayıt yüklendi.</b> <a href="#/${SC(coll).kind === 'rec' ? 'k/' + coll : coll === 'hammadde' ? 't/hammadde' : 't/urun'}">Kayıtları açın</a>.</div></div>`;
        changed(r.change, `Excel'den ${r.sonuc.n} kayıt yüklendi`);
        await afterRemote(true);
      } catch (e) { setBusy(go2, false); toast(e.message, 'err'); }
    });
  };
  draw();
}
async function excelImport(file, out) {
  out.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const buf = await file.arrayBuffer();
  let p;
  try { p = await api('POST', '/api/import/excel', buf); } catch (e) { out.innerHTML = `<div class="banner danger">${icon('alert')}<div>${esc(e.message)}</div></div>`; return; }
  const o = p.ozet; const mevcutTop = Object.values(p.mevcut).reduce((a, b) => a + b, 0);
  const ilk = !defs('hammadde', { all: true }).length;
  out.innerHTML = `<div class="stack">
    <div class="banner ok">${icon('check')}<div><b>${esc(file.name)}</b> okundu · <b>${ayAdi(p.ay)}</b><br>${o.hammadde} hammadde (${o.yeniHammadde} yeni) · ${o.urun} ürün · ${o.recete} reçete satırı · ${o.uretim} üretim · ${o.satinalma} satınalma · ${o.cep} cep · ${o.iade} iade · ${o.iskarta} ıskarta · ${o.sevkiyat} sevkiyat günü · ${o.devreden} kalemde devreden stok</div></div>
    ${p.uyarilar.length ? `<div class="banner warn">${icon('alert')}<div><b>Dikkat edilecekler</b><ul>${p.uyarilar.map((u) => `<li>${esc(u)}</li>`).join('')}</ul></div></div>` : ''}
    ${p.duzeltilen.length || p.pasif.length ? `<div class="banner">${icon('info')}<div><b>Excel reçetesindeki hatalar</b><ul>${p.duzeltilen.map((d) => `<li>${esc(d.urun)} · ${esc(d.ad)}: Excel'de "${esc(d.eski)}" sütununa bağlıydı → etiket seçimine göre düzeltildi (satır ${d.excelSatir}).</li>`).join('')}${p.pasif.map((d) => `<li>${esc(d.urun)} · ${esc(d.ad)}: Excel'de hiç hesaba katılmıyordu → "hesaba katılmaz" olarak alındı (satır ${d.excelSatir}). Reçeteler ekranından açabilirsiniz.</li>`).join('')}</ul></div></div>` : ''}
    ${mevcutTop ? `<div class="banner warn">${icon('alert')}<div>Uygulamada ${ayAdi(p.ay)} için zaten <b>${mevcutTop}</b> kayıt var (${Object.entries(p.mevcut).filter(([, n]) => n).map(([k, n]) => `${SC(k).label}: ${n}`).join(', ')}).</div></div>` : ''}
    <div class="chips" style="flex-direction:column;gap:8px">
      ${mevcutTop ? '<label class="chk"><input type="checkbox" id="io-t" checked> Bu ayın mevcut kayıtlarını silip dosyadakilerle değiştir (yoksa eklenir, çift kayıt olur)</label>' : ''}
      <label class="chk"><input type="checkbox" id="io-d" checked> "Devreden" stokları ${ayAdi(ayKaydir(p.ay, -1))} son gününe sayım olarak işle (ay başı stoğu)</label>
      <label class="chk"><input type="checkbox" id="io-n" ${ilk ? 'checked disabled' : ''}> Tanımları da güncelle (reçeteler, asgari stoklar, palet/koli tipleri, kapasiteler) — uygulamada yaptığınız tanım değişikliklerinin üzerine yazar</label>
    </div>
    <div class="row"><button class="btn primary" id="io-go">${icon('upload')}İçe aktar</button><span class="muted small">Aktarmadan önce otomatik yedek alınır.</span></div></div>`;
  $('#io-go', out).addEventListener('click', async (e) => {
    const b = e.currentTarget; setBusy(b, true, 'Aktarılıyor…');
    const qs = `apply=1&devir=${$('#io-d', out).checked ? 1 : 0}&tanimlar=${$('#io-n', out).checked ? 1 : 0}&temizle=${$('#io-t', out) && $('#io-t', out).checked ? 1 : 0}`;
    try {
      const r = await api('POST', '/api/import/excel?' + qs, buf);
      out.innerHTML = `<div class="banner ok">${icon('check')}<div><b>Aktarıldı.</b> ${r.sonuc.olusan} yeni kayıt, ${r.sonuc.guncellenen} güncelleme, ${r.sonuc.silinen} silme. <a href="#/r/hammadde">Hammadde stok raporunu açın</a>.</div></div>`;
      changed(r.change, `${ayAdi(p.ay)} Excel dosyası aktarıldı`);
      if (S.ay !== p.ay) { S.ay = p.ay; ls.set('ay', p.ay); $('#ay-lbl').textContent = ayAdi(p.ay); $('#ay-inp').value = p.ay; }
      await afterRemote(true);
    } catch (er) { setBusy(b, false); toast(er.message, 'err'); }
  });
}
async function sayimImport(file, out, tarih) {
  const buf = await file.arrayBuffer();
  let p;
  try { p = await api('POST', `/api/import/sayim?tarih=${tarih}`, buf); } catch (e) { out.innerHTML = `<div class="banner danger">${icon('alert')}<div>${esc(e.message)}</div></div>`; return; }
  const ch = p.changes;
  out.innerHTML = `<div class="stack">${p.errors.length ? `<div class="banner danger">${icon('alert')}<div><b>Hatalar (düzeltip tekrar yükleyin)</b><ul>${p.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
    ${ch.length ? `<div class="tw" style="max-height:360px"><table class="t dense"><thead><tr><th>Hammadde</th><th>İşlem</th><th class="num">Sistemde</th><th class="num">Yeni</th><th class="num">Fark</th></tr></thead><tbody>
    ${ch.map((c) => c.kind === 'sayim' ? `<tr><td>${esc(c.ad)}</td><td>${c.depo === 'ana' ? 'Ana depo sayımı' : 'Cep depo sayımı'}</td><td class="num">${fmt(c.mevcut)}</td><td class="num">${fmt(c.sayilan)}</td><td class="num">${sgn(c.fark)}</td></tr>` : `<tr><td>${esc(c.ad)}</td><td>Asgari stok</td><td class="num">${fmt(c.eski)}</td><td class="num">${fmt(c.yeni)}</td><td></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Dosyada işlenecek değer yok</div>'}
    ${ch.length && !p.errors.length ? `<div><button class="btn primary" id="sy-go">${icon('check')}${ch.length} değişikliği uygula (${trD(tarih)})</button></div>` : ''}</div>`;
  const g = $('#sy-go', out);
  if (g) g.addEventListener('click', async () => {
    setBusy(g, true);
    try { const r = await api('POST', `/api/import/sayim?apply=1&tarih=${tarih}`, buf); out.innerHTML = `<div class="banner ok">${icon('check')}<div>Sayım işlendi.</div></div>`; const h = await api('GET', '/api/history?limit=1&mine=1'); changed(h.rows[0] && h.rows[0].id, 'Sayım şablonu işlendi'); await afterRemote(true); }
    catch (e) { setBusy(g, false); toast(e.message, 'err'); }
  });
}
async function v1Card(el) {
  let i;
  try { i = await api('GET', '/api/v1'); } catch (e) { el.remove(); return; }
  if (!i.var) { el.remove(); return; }
  const es = i.urunler.filter((u) => u.eslesen); const yok = i.urunler.filter((u) => !u.eslesen);
  el.innerHTML = `<div class="card-h"><h2>Eski sürümden (1.x) aktar</h2></div><div class="card-b stack">
    <p class="small muted">Eski sürümün veritabanı bulundu (${fmt(i.hareket)} hareket). Kullanıcılar ilk açılışta otomatik aktarıldı. Eski stokları sayım olarak aktarabilir, eski KYN kodlarını yeni hammaddelerle eşleştirebilirsiniz (eski QR etiketleri çalışmaya devam eder).</p>
    <div>${es.length} kalem adından eşleşti${yok.length ? `, ${yok.length} kalem eşleşmedi: <span class="small muted">${yok.slice(0, 12).map((u) => esc(u.ad)).join(', ')}${yok.length > 12 ? '…' : ''}</span>` : ''}.</div>
    <div class="row"><label class="fld"><span>Sayım tarihi</span><input class="input" type="date" id="v1t" value="${ayKaydir(today().slice(0, 7), 0)}-01"></label>
      <label class="chk" style="margin-top:18px"><input type="checkbox" id="v1s"> Eski stokları da aktar (ana + cep sayımı)</label></div>
    <div><button class="btn" id="v1go">${icon('db')}Aktar</button></div></div>`;
  $('#v1go', el).addEventListener('click', async () => {
    try { const r = await api('POST', '/api/v1', { tarih: $('#v1t', el).value, stok: $('#v1s', el).checked }); if (!r.change) return toast('Aktarılacak bir şey yok'); changed(r.change, `${r.n} değişiklik aktarıldı`); await afterRemote(true); } catch (e) { toast(e.message, 'err'); }
  });
}
async function setYedek(body) {
  const i = await api('GET', '/api/server-info');
  body.innerHTML = `<div class="grid g2" style="align-items:start"><section class="card card-b stack"><h2>Yedekleme</h2>
    <p class="small muted">Veritabanı 12 saatte bir otomatik yedeklenir (son 60 yedek saklanır). Excel içe aktarma öncesinde de yedek alınır.</p>
    <dl class="kv"><dt>Yedek klasörü</dt><dd class="mono small">${esc(i.backupDir)}</dd><dt>Yedek sayısı</dt><dd>${i.backupCount}</dd><dt>Son yedek</dt><dd class="mono small">${esc(i.lastBackup || '—')}</dd></dl>
    <div class="row"><button class="btn" id="bk1">${icon('db')}Şimdi yedek al</button><button class="btn" id="bk2">${icon('download')}Yedeği indir</button></div></section>
    <section class="card card-b stack"><h2>Geri yükleme</h2><p class="small muted">Tek tek işlemleri geri almak için <a href="#/gecmis">Değişiklik geçmişi</a> ekranını kullanın. Tüm veritabanını bir yedeğe döndürmek için sunucuyu kapatıp yedek dosyasını veri klasörüne <span class="mono">depo2.db</span> adıyla kopyalayın (kılavuzda anlatılıyor).</p></section></div>`;
  $('#bk1', body).addEventListener('click', async () => { try { const r = await api('POST', '/api/backup'); toast('Yedek alındı: ' + r.file, 'ok'); setYedek(body); } catch (e) { toast(e.message, 'err'); } });
  $('#bk2', body).addEventListener('click', () => dl('/api/backup/download'));
}

// ================= QR etiketleri =================
const LABEL_SIZES = {
  'a4-24': { name: 'A4 · 24 etiket (70×37 mm)', per: 24 }, 'a4-14': { name: 'A4 · 14 etiket (99×38 mm)', per: 14 }, 'a4-8': { name: 'A4 · 8 büyük etiket (99×67 mm)', per: 8 },
  't-100x50': { name: 'Etiket yazıcı · 100×50 mm', per: 1 }, 't-60x40': { name: 'Etiket yazıcı · 60×40 mm', per: 1 },
};
const labelHtml = (p, size) => `<div class="lbl s-${size}"><div class="q">${window.QR.toSvg(p.kod, { ecl: 'M', border: 1 })}</div><div class="tx"><div class="cd">${esc(p.kod)}</div><div class="nm">${esc(p.ad)}</div><div class="ct">${p._urun ? esc(p.birim) : `${esc(refName('grup', p.grup))} · ${esc(p.birim)}`}</div></div></div>`;
function printLabels(mats, size, copies = 1) {
  const all = []; mats.forEach((p) => { for (let i = 0; i < copies; i++) all.push(p); });
  const per = LABEL_SIZES[size].per; let html = '';
  for (let i = 0; i < all.length; i += per) html += `<div class="sheet ${size}">${all.slice(i, i + per).map((p) => labelHtml(p, size)).join('')}</div>`;
  $('#print-area').innerHTML = html;
  let st = $('#print-page-style'); if (!st) { st = document.createElement('style'); st.id = 'print-page-style'; document.head.appendChild(st); }
  st.textContent = '@media print { ' + (size.startsWith('t-') ? `@page { size: ${size === 't-100x50' ? '100mm 50mm' : '60mm 40mm'}; margin: 0; }` : '@page { size: A4; margin: 0; }') + ' }';
  setTimeout(() => { if (native && native.print) native.print('QR Etiketleri'); else window.print(); }, 60);
}
ACTS['lbl-one'] = (el) => printLabels([D('hammadde', el.dataset.id)], ls.get('lblSize', 'a4-24'), 1);
// Mamul etiketleri: grup yerine "Mamul" ve koli/palet bilgisi
const urunLbl = (u) => ({ kod: u.kod, ad: u.ad, grup: null, birim: `Mamul${u.sevkKoliPalet ? ' · ' + fmt(u.sevkKoliPalet) + ' koli/palet' : ''}`, _urun: 1 });
ACTS['lbl-urun'] = (el) => printLabels([urunLbl(D('urun', el.dataset.id))], ls.get('lblSize', 'a4-24'), 1);
route(/^\/etiket$/, async (main) => {
  setTitle('QR etiketleri');
  const lf = LIST_STATE.lbl || (LIST_STATE.lbl = { grup: '', q: '', size: ls.get('lblSize', 'a4-24'), copies: 1, sel: new Set(), tur: 'hammadde' });
  const UR = lf.tur === 'urun';
  const pool = () => (UR ? defs('urun').filter((u) => u.kod).slice().sort(bySira).map((u) => ({ ...urunLbl(u), id: u.id })) : defs('hammadde').slice().sort(matSort));
  main.innerHTML = pageHead('QR etiketleri', 'Raf ve palet etiketleri. Her etikette kalıcı KYN kodu ve QR bulunur.') + `<div class="grid g2" style="align-items:start">
    <section class="card"><div class="card-h"><div class="seg" id="lt"><button data-t="hammadde" class="${UR ? '' : 'on'}">Hammadde</button><button data-t="urun" class="${UR ? 'on' : ''}">Mamul</button></div><span class="spacer"></span><span class="bdg brand" id="lc"></span></div><div class="card-b stack">
      <div class="row"><input class="input grow" id="lq" placeholder="Ara…" value="${esc(lf.q)}" style="min-width:150px">${UR ? '' : `<select class="input" id="lg" style="width:auto"><option value="">Tüm gruplar</option>${defs('grup', { all: true }).sort(bySira).map((g) => `<option value="${g.id}" ${String(g.id) === lf.grup ? 'selected' : ''}>${esc(g.ad)}</option>`).join('')}</select>`}</div>
      <div class="row"><button class="btn sm" id="la">Görünenleri seç</button><button class="btn sm" id="ln">Seçimi temizle</button></div><div class="sel-list" id="ll"></div></div></section>
    <section class="card"><div class="card-h"><h2>Baskı</h2></div><div class="card-b stack">
      <label class="fld"><span>Etiket boyutu</span><select class="input" id="ls">${Object.entries(LABEL_SIZES).map(([k, v]) => `<option value="${k}" ${k === lf.size ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
      <label class="fld"><span>Her hammaddeden kaç adet</span><input class="input" id="lk" type="number" min="1" max="50" value="${lf.copies}"></label>
      <div class="fld"><span>Önizleme</span><div class="label-preview" id="lp"></div></div>
      <button class="btn primary lg" id="lpr">${icon('print')}Seçilenleri yazdır</button>
      <p class="foot-note">Yazdırma penceresinde <b>Ölçek: %100</b> ve <b>Kenar boşluğu: Yok</b> seçin.</p></div></section></div>`;
  let vis = [];
  const draw = () => {
    const q = fold(lf.q);
    vis = pool().filter((p) => (UR || !lf.grup || String(p.grup) === lf.grup) && (!q || fold(p.ad + ' ' + p.kod).includes(q)));
    $('#ll').innerHTML = vis.map((p) => `<label><input type="checkbox" data-id="${p.id}" ${lf.sel.has(p.id) ? 'checked' : ''}><span class="code">${esc(p.kod)}</span><span>${esc(p.ad)}</span></label>`).join('') || '<div class="empty">Bulunamadı</div>';
    $('#lc').textContent = `${lf.sel.size} seçili`;
    const first = pool().find((p) => lf.sel.has(p.id)) || vis[0];
    $('#lp').innerHTML = first ? labelHtml(first, lf.size) : '';
  };
  $('#lq').addEventListener('input', (e) => { lf.q = e.target.value; draw(); });
  if ($('#lg')) $('#lg').addEventListener('change', (e) => { lf.grup = e.target.value; draw(); });
  $$('#lt button').forEach((b) => b.addEventListener('click', () => { lf.tur = b.dataset.t; lf.sel.clear(); rerender(); }));
  $('#ls').addEventListener('change', (e) => { lf.size = e.target.value; ls.set('lblSize', lf.size); draw(); });
  $('#lk').addEventListener('input', (e) => { lf.copies = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)); });
  $('#ll').addEventListener('change', (e) => { const id = +e.target.dataset.id; if (e.target.checked) lf.sel.add(id); else lf.sel.delete(id); draw(); });
  $('#la').addEventListener('click', () => { vis.forEach((p) => lf.sel.add(p.id)); draw(); });
  $('#ln').addEventListener('click', () => { lf.sel.clear(); draw(); });
  $('#lpr').addEventListener('click', () => { const mats = pool().filter((p) => lf.sel.has(p.id)); if (!mats.length) return toast('Önce etiket seçin', 'warn'); printLabels(mats, lf.size, lf.copies); });
  draw();
});

// ================= Başlat =================
startApp();
