/* Depo Takip 2 — panel, QR, raporlar, hammadde kartı */
'use strict';

const DURUM = { normal: ['Normal', 'ok'], siparis: ['Sipariş ver', 'warn'], tukendi: ['Tükendi', 'danger'], eksi: ['Eksi stok', 'danger'] };
const durumBdg = (d) => { const x = DURUM[d] || DURUM.normal; return `<span class="bdg ${x[1]}">${x[0]}</span>`; };

// ================= PANEL =================
const QA = [['uretim', 'factory', 'Üretim gir'], ['satinalma', 'download', 'Hammadde girişi'], ['cep', 'swap', "Cep'e transfer"], ['sevkiyat', 'truck', 'Sevkiyat gir'], ['urunSayim', 'check', 'Mamul sayımı'], ['sayim', 'check', 'Hammadde sayımı']];
const quickActs = () => { const qa = (href, ic, l) => `<a href="#${href}"><span class="ic">${icon(ic)}</span>${esc(l)}</a>`;
  const list = QA.filter(([c]) => can.e(c)).slice(0, 5).map(([c, ic, l]) => qa(`/k/${c}?yeni=1`, ic, l));
  return `<div class="qa">${list.join('')}${qa('/qr', 'scan', 'QR okut')}</div>`; };
route(/^\/$/, async (main, ctx) => {
  if (!can.panel()) {
    setTitle('Ana sayfa');
    main.innerHTML = pageHead(`Hoş geldiniz, ${esc(S.user.fullName)}`, esc(ROLE_TR[S.user.role])) + quickActs() +
      `<div class="card"><div class="list">${recNav().map(([c, ic]) => `<a class="it" href="#/k/${c}">${icon(ic)}<span class="grow">${esc(SC(c).label)}</span></a>`).join('')}${repNav().map(([k, l, ic]) => `<a class="it" href="#/r/${k}">${icon(ic)}<span class="grow">${esc(l)}</span></a>`).join('')}</div></div>`;
    return;
  }
  setTitle('Panel');
  const [p, h] = await Promise.all([api('GET', `/api/r/panel?ay=${S.ay}`), can.gecmis() ? api('GET', '/api/history?limit=8') : Promise.resolve({ rows: [] })]);
  if (!ctx.alive()) return;
  const maxK = Math.max(1, ...p.urunler.map((u) => u.koli));
  const maxG = Math.max(1, ...p.gunluk.map((g) => Math.max(g.uretim, g.sevk)));
  const birim = (b) => `<div class="kpi"><div class="l">Toplam hammadde · ${esc(b.birim)}</div><div class="v">${fmt(b.kalan, 0)}</div><div class="s">ana ${fmt(b.ana, 0)} · cep ${fmt(b.cep, 0)} · ${b.kalem} kalem</div></div>`;
  const kul = p.kullanim.slice(0, 3).map((k) => `${fmt(k.kul, 0)} ${esc(k.birim)}`).join(' · ') || '—';
  main.innerHTML = pageHead(`${esc(S.meta.settings.company)}`, `${ayAdi(S.ay)} özeti`,
    `${can.r('durum') ? `<a class="btn" href="#/r/durum">${icon('clock')}Geçmiş gün stok</a>` : ''}${can.r('genel') ? `<button class="btn" data-act="xls" data-k="aylik">${icon('excel')}Aylık Excel raporu</button>` : ''}`) +
    quickActs() +
    `<div class="kpis">
      ${p.birimler.slice(0, 3).map(birim).join('')}
      <div class="kpi"><div class="l">Üretimde kullanılan</div><div class="v" style="font-size:18px">${kul}</div><div class="s">bu ay, reçeteye göre (fire hariç)</div></div>
      <div class="kpi"><div class="l">Mamul stoğu</div><div class="v">${fmt(p.mamulKoli, 0)}</div><div class="s">koli · ${p.mamulKalem} ürün</div></div>
      <div class="kpi"><div class="l">Toplam üretim</div><div class="v">${fmt(p.uretimKoli, 0)}</div><div class="s">koli · ${p.uretimKayit} kayıt</div></div>
      <div class="kpi"><div class="l">Toplam sevkiyat</div><div class="v">${fmt(p.sevkKoli, 0)}</div><div class="s">koli · ${fmt(p.sevkPalet, 0)} palet · ${p.sevkGun} gün</div></div>
      <div class="kpi"><div class="l">Preform + şişe firesi</div><div class="v">${p.fireOrani === null ? '—' : fmt(p.fireOrani, 1) + ' %'}</div><div class="s">giren adede göre</div></div>
      <div class="kpi ${p.uyarilar.length + p.mamulUyari.length ? 'warn' : ''}"><div class="l">Kritik stok</div><div class="v">${p.uyarilar.length + p.mamulUyari.length}</div><div class="s">${p.uyarilar.length} hammadde · ${p.mamulUyari.length} mamul</div></div>
      <div class="kpi ${p.cepFarkli ? 'warn' : ''}"><div class="l">Cep ≠ üretim+fire</div><div class="v">${p.cepFarkli}</div><div class="s">kalem (aylık takip)</div></div>
    </div>
    <div class="grid g2" style="align-items:start">
      <section class="card"><div class="card-h"><h2>Günlük üretim ve sevkiyat</h2><span class="spacer"></span><span class="lg-dot brand"></span><span class="small muted">üretim</span><span class="lg-dot warn"></span><span class="small muted">sevkiyat (koli)</span></div>
        ${p.gunluk.length ? `<div class="daychart">${p.gunluk.map((g) => `<div class="d" title="${trD(g.tarih)} · üretim ${fmt(g.uretim, 0)} · sevkiyat ${fmt(g.sevk, 0)} koli"><div class="bars"><i class="u" style="height:${(g.uretim / maxG * 100).toFixed(1)}%"></i><i class="s" style="height:${(g.sevk / maxG * 100).toFixed(1)}%"></i></div><span>${g.tarih.slice(8)}</span></div>`).join('')}</div>` : '<div class="empty">Bu ay üretim veya sevkiyat yok</div>'}
      </section>
      <section class="card"><div class="card-h"><h2>Kritik stok uyarıları</h2><span class="spacer"></span>${can.r('hammadde') ? '<a href="#/r/hammadde?f=uyari" class="small">Tümü</a>' : ''}</div>
        ${p.uyarilar.length || p.mamulUyari.length ? `<div class="tw"><table class="t dense"><thead><tr><th>Kalem</th><th class="num">Kullanılabilen</th><th class="num">Asgari</th><th></th></tr></thead><tbody>
        ${p.mamulUyari.map((u) => `<tr class="click" data-href="/u/${u.id}"><td><div class="nm">${esc(u.ad)}</div><div class="small muted">mamul</div></td><td class="num">${sgn(u.koli)} <span class="muted small">koli</span></td><td class="num">${fmt(u.asgari)}</td><td>${durumBdg(u.koli <= 0 ? 'tukendi' : 'siparis')}</td></tr>`).join('')}
        ${p.uyarilar.slice(0, 12).map((u) => `<tr class="click" data-href="/h/${u.id}"><td><div class="nm">${esc(u.ad)}</div><div class="small muted mono">${esc(u.kod)}</div></td><td class="num">${sgn(u.kullanilabilen)} <span class="muted small">${esc(u.birim)}</span></td><td class="num">${fmt(u.asgari)}</td><td>${durumBdg(u.durum)}</td></tr>`).join('')}
        </tbody></table></div>${p.uyarilar.length > 12 ? `<div class="card-b small muted">+${p.uyarilar.length - 12} kalem daha</div>` : ''}` : '<div class="empty">Tüm kalemler asgari stok üzerinde</div>'}
      </section>
      <section class="card"><div class="card-h"><h2>Depolar arası stok dağılımı</h2><span class="spacer"></span><span class="lg-dot brand"></span><span class="small muted">ana</span><span class="lg-dot info"></span><span class="small muted">cep</span></div>
        ${p.dagilim.length ? `<div class="list">${p.dagilim.map((g) => { const t = g.ana + g.cep || 1; return `<div class="it"><div style="width:130px" class="nm">${esc(g.ad)}</div><div class="grow"><div class="bar split"><i style="width:${(g.ana / t * 100).toFixed(1)}%"></i><b style="width:${(g.cep / t * 100).toFixed(1)}%"></b></div></div><div class="num small" style="width:150px">${fmt(g.ana, 0)} / ${fmt(g.cep, 0)} <span class="muted">${esc(g.birim)}</span></div></div>`; }).join('')}</div>` : '<div class="empty">Stok yok</div>'}
      </section>
      <section class="card"><div class="card-h"><h2>Ürün bazında üretim</h2><span class="spacer"></span>${can.r('uretim') ? '<a href="#/r/uretim" class="small">Üretim özeti</a>' : ''}</div>
        ${p.urunler.length ? `<div class="list">${p.urunler.map((u) => `<div class="it"><div style="width:110px" class="nm">${esc(u.ad)}</div><div class="grow"><div class="bar"><i style="width:${(u.koli / maxK * 100).toFixed(1)}%"></i></div></div><div class="num" style="width:120px">${fmt(u.koli, 0)} <span class="muted small">koli</span></div></div>`).join('')}</div>` : '<div class="empty">Bu ay üretim kaydı yok</div>'}
      </section>
      ${can.gecmis() ? `<section class="card"><div class="card-h"><h2>Son yapılan işlemler</h2><span class="spacer"></span><a href="#/gecmis" class="small">Değişiklik geçmişi</a></div>
        <div class="list hist">${h.rows.map(histRow).join('') || '<div class="empty">Henüz değişiklik yok</div>'}</div></section>` : ''}
    </div>`;
  $$('tr[data-href]', main).forEach((tr) => tr.addEventListener('click', () => go(tr.dataset.href)));
  bindHist(main);
});
ACTS.xls = (el) => dl(`/api/x/${el.dataset.k}?ay=${S.ay}`);
// "?yeni=1" ile gelen kayıt listesi açılır açılmaz yeni kayıt formu
window.addEventListener('hashchange', () => {
  const { path, q } = parseHash();
  const m = path.match(/^\/k\/(\w+)$/);
  if (m && q.yeni && !q.urun) { history.replaceState(null, '', '#' + path); setTimeout(() => openForm(m[1], null, q.hammadde ? { hammadde: Number(q.hammadde) } : {}), 350); }
});

// Mobil: kayıt türü seçimi
route(/^\/kayit$/, async (main) => {
  setTitle('Kayıtlar');
  main.innerHTML = pageHead('Kayıtlar', ayAdi(S.ay)) + `<div class="card"><div class="list">${recNav().map(([c, ic]) => `<a class="it" href="#/k/${c}">${icon(ic)}<span class="grow">${esc(SC(c).label)}</span>${can.e(c) ? `<button class="btn sm" data-act="new-rec" data-coll="${c}">${icon('plus')}Yeni</button>` : ''}</a>`).join('')}</div></div>`;
});
route(/^\/menu$/, async (main) => {
  setTitle('Menü');
  const sec = (t, items) => `<section class="card"><div class="card-h"><h2>${t}</h2></div><div class="list">${items.map(([h, l, ic]) => `<a class="it" href="#${h}">${icon(ic)}<span>${esc(l)}</span></a>`).join('')}</div></section>`;
  main.innerHTML = `<div class="menu-grid">
    ${repNav().length ? sec('Raporlar', repNav().map(([k, l, ic]) => ['/r/' + k, l, ic])) : ''}
    ${defNav().length ? sec('Tanımlar', defNav()) : ''}
    ${sec('Sistem', [...(can.gecmis() ? [['/gecmis', 'Değişiklik geçmişi', 'history']] : []), ['/ayarlar', 'Ayarlar', 'gear']])}
    <div class="card card-b small muted">${esc(S.user.fullName)} · ${ROLE_TR[S.user.role]} · <a href="#" data-act="logout">Çıkış yap</a></div></div>`;
});

// ================= QR =================
route(/^\/qr$/, async (main) => {
  setTitle('QR okut');
  main.innerHTML = pageHead('QR / barkod okut', 'Hammadde (KYN) veya mamul (MML) etiketini okutun ya da kodu yazın. El tipi barkod okuyucu bu ekranda doğrudan çalışır.') + `<div class="card"><div class="scan-hero">
    <div class="big">${icon('scan')}</div>
    ${cameraAvailable() ? `<button class="btn primary lg" id="scan-go">${icon('scan')}Kamerayla okut</button>` : '<p class="muted small">Bu cihazda kamera ile okuma desteklenmiyor. USB/Bluetooth barkod okuyucu kullanabilir veya kodu yazabilirsiniz.</p>'}
    <form id="code-f" class="row" style="justify-content:center;width:min(420px,100%)"><input class="input grow mono" id="code-in" placeholder="KYN-PRF-001 veya MML-001" autocapitalize="characters" autocomplete="off"><button class="btn" type="submit">Bul</button></form>
  </div></div>`;
  const find = (raw) => handleScan(raw);
  const b = $('#scan-go'); if (b) b.addEventListener('click', async () => find(await scanQR()));
  $('#code-f').addEventListener('submit', (e) => { e.preventDefault(); find($('#code-in').value); });
  if (matchMedia('(pointer:fine)').matches) $('#code-in').focus();
});

// ================= HAMMADDE KARTI =================
route(/^\/h\/(\d+)$/, async (main, ctx) => {
  const id = Number(ctx.m[1]);
  const tum = ctx.q.tum === '1';
  const r = await api('GET', `/api/r/kart/${id}?ay=${S.ay}${tum ? '&tum=1' : ''}`);
  if (!ctx.alive()) return;
  const d = r.doc; const g = r.guncel || {}; const o = r.ozet || {};
  setTitle(d.ad);
  const KIND = { alim: ['Satınalma', 'ok'], iade: ['İade', 'warn'], cep: ['Cep depo', 'info'], kul: ['Üretim', 'brand'], fire: ['Fire', 'danger'], imha: ['İmha', 'danger'], iskarta: ['Iskarta', 'warn'], sayim: ['Sayım', ''] };
  const act = (coll, l, ic) => `<a class="btn sm" href="#/k/${coll}?yeni=1&hammadde=${id}">${icon(ic)}${l}</a>`;
  main.innerHTML = pageHead(esc(d.ad), `<span class="mono">${esc(d.kod)}</span> · ${esc(refName('grup', d.grup))} · ${esc(d.birim)}${d.gramaj ? ' · ' + esc(d.gramaj) : ''}${d._deleted ? ' · <span class="bdg danger">silinmiş</span>' : d.aktif === false ? ' · <span class="bdg">pasif</span>' : ''}`,
    `${can.admin() ? `<button class="btn" data-act="edit-def" data-coll="hammadde" data-id="${id}">${icon('edit')}Düzenle</button>` : ''}<button class="btn" data-act="lbl-one" data-id="${id}">${icon('print')}Etiket</button>`) +
    `<div class="grid" style="grid-template-columns:minmax(0,1fr) auto;align-items:start;margin-bottom:14px">
      <section class="card card-b stack">
        <div class="row"><h2 class="grow">Güncel stok</h2>${durumBdg(g.durum)}</div>
        <div class="stockbox">
          <div><div class="l">Kalan (ana + cep)</div><div class="v">${sgn(g.kalan)}</div></div>
          <div><div class="l">Kullanılabilen</div><div class="v">${sgn(g.kullanilabilen)}</div></div>
          <div><div class="l">Ana depo</div><div class="v">${sgn(g.ana)}</div></div>
          <div><div class="l">Cep depo</div><div class="v">${sgn(g.cep)}</div></div>
          <div><div class="l">Iskartada</div><div class="v">${fmt(g.iskarta)}</div></div>
          <div><div class="l">Asgari stok</div><div class="v">${fmt(d.asgari) || '—'}</div></div>
        </div>
        <div class="row">${[['satinalma', 'Giriş', 'download'], ['cep', 'Transfer', 'swap'], ['sayim', 'Sayım', 'check'], ['iade', 'İade', 'undo'], ['iskarta', 'Iskarta', 'alert']].filter(([c]) => can.e(c)).map(([c, l, ic]) => act(c, l, ic)).join('')}${can.r('hareket') ? `<a class="btn sm ghost" href="#/r/hareket?hammadde=${id}">${icon('list')}Tüm hareketler</a>` : ''}</div>
      </section>
      <div class="card card-b hide-m" style="text-align:center"><div class="qrbox">${window.QR.toSvg(d.kod, { ecl: 'M', border: 1 })}</div><div class="mono small" style="margin-top:4px">${esc(d.kod)}</div></div>
    </div>
    <div class="grid g2" style="align-items:start">
      <section class="card"><div class="card-h"><h2>${ayAdi(S.ay)} özeti</h2></div><div class="card-b">
        <dl class="kv">
          <dt>Devreden</dt><dd class="num" style="text-align:left">${fmt(o.devreden) || 0}</dd>
          <dt>Satın alınan</dt><dd>${fmt(o.alim) || 0}</dd><dt>Tedarikçiye iade</dt><dd>${fmt(o.iade) || 0}</dd>
          <dt>Cep depoya verilen</dt><dd>${fmt(o.cepNet) || 0}</dd>
          <dt>Üretimde kullanılan</dt><dd>${fmt(o.kullanilan) || 0}</dd><dt>Fire</dt><dd>${fmt(o.fire) || 0}</dd>
          <dt>Sayım farkı</dt><dd>${sgn(o.sayimFark || 0)}</dd><dt>İmha</dt><dd>${fmt(o.imha) || 0}</dd>
          <dt>Ay sonu kalan</dt><dd><b>${sgn(o.kalan || 0)}</b></dd><dt>Yaklaşık koli</dt><dd>${fmt(o.yakKoli, 0) || '—'}</dd>
        </dl></div></section>
      <section class="card"><div class="card-h"><h2>Reçetelerde</h2></div>
        ${r.receteler.length ? `<div class="list">${r.receteler.map((x) => `<a class="it" href="#/recete?urun=${x.urun}"><span class="grow nm">${esc(refName('urun', x.urun))}</span><span class="num">${fmt(x.miktar)} ${esc(x.birim || '')}</span>${x.secim && x.secim !== 'hepsi' ? `<span class="bdg">${esc(x.secim)} seçilirse</span>` : ''}${x.aktif === false ? '<span class="bdg">hesaba katılmaz</span>' : ''}</a>`).join('')}</div>` : '<div class="empty">Hiçbir reçetede kullanılmıyor</div>'}
      </section>
    </div>
    <section class="card" style="margin-top:14px"><div class="card-h"><h2>Hareketler</h2><span class="muted small">${tum ? 'tüm zamanlar' : ayAdi(S.ay)}</span><span class="spacer"></span>
      <div class="seg"><button class="${tum ? '' : 'on'}" data-act="go" data-href="/h/${id}">Bu ay</button><button class="${tum ? 'on' : ''}" data-act="go" data-href="/h/${id}?tum=1">Tümü</button></div></div>
      ${r.hareketler.length ? `<div class="tw"><table class="t dense cards"><thead><tr><th>Tarih</th><th>Hareket</th><th class="num">Ana depo</th><th class="num">Cep depo</th><th class="num">Ana bakiye</th><th class="num">Cep bakiye</th></tr></thead><tbody>
      ${r.hareketler.map((e) => { const k = KIND[e.kind] || [e.ad, '']; const sayim = e.kind === 'sayim';
        return `<tr class="click" data-c="${e.coll}" data-i="${e.id}"><td class="first" data-l="Tarih">${trD(e.t)}</td><td data-l="Hareket"><span class="bdg ${k[1]}">${esc(k[0])}</span>${sayim ? ` <span class="small muted">${e.depo === 'cep' ? 'cep' : 'ana'} = ${fmt(e.val)} (fark ${fmt(e.delta)})</span>` : ''}${e.kind === 'iskarta' ? ` <span class="small muted">${fmt(e.isk)} ayrıldı</span>` : ''}</td>
          <td class="num" data-l="Ana depo">${sayim || !e.ana ? '' : sgn(e.ana)}</td><td class="num" data-l="Cep depo">${sayim || !e.cep ? '' : sgn(e.cep)}</td><td class="num" data-l="Ana bakiye">${sgn(e.balAna)}</td><td class="num" data-l="Cep bakiye">${sgn(e.balCep)}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="empty">Hareket yok</div>'}</section>`;
  $$('tr[data-c]', main).forEach((tr) => tr.addEventListener('click', async () => {
    try { const x = await api('GET', `/api/c/${tr.dataset.c}/${tr.dataset.i}`); openForm(tr.dataset.c, x.doc); } catch (e) { toast(e.message, 'err'); }
  }));
});
ACTS['edit-def'] = (el) => openForm(el.dataset.coll, D(el.dataset.coll, el.dataset.id));

// ================= RAPORLAR =================
const RS = ls.get('rs', { grup: '', q: '', f: '' });
const saveRS = () => ls.set('rs', RS);
function reportFilters(rows, opts = {}) {
  const grups = defs('grup', { all: true }).slice().sort(bySira);
  return `<div class="card-h">
    <div class="search" style="width:min(300px,100%)">${icon('search')}<input class="input" id="rq" placeholder="Hammadde ara…" value="${esc(RS.q)}"></div>
    <select class="input" id="rg" style="width:auto"><option value="">Tüm gruplar</option>${grups.map((g) => `<option value="${esc(g.ad)}" ${RS.grup === g.ad ? 'selected' : ''}>${esc(g.ad)}</option>`).join('')}</select>
    <div class="seg" id="rf">${(opts.filters || [['', 'Tümü'], ['hareket', 'Hareket görenler'], ['uyari', 'Uyarılar']]).map(([k, l]) => `<button data-f="${k}" class="${RS.f === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <span class="spacer"></span><span class="muted small" id="rc"></span></div>`;
}
function bindFilters(main, draw) {
  $('#rq', main).addEventListener('input', (e) => { RS.q = e.target.value; saveRS(); draw(); });
  $('#rg', main).addEventListener('change', (e) => { RS.grup = e.target.value; saveRS(); draw(); });
  $('#rf', main).addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; RS.f = b.dataset.f; saveRS(); $$('#rf button', main).forEach((x) => x.classList.toggle('on', x === b)); draw(); });
}
const filt = (rows, fn) => rows.filter((r) => (!RS.grup || r.grup === RS.grup) && (!RS.q || fold(r.ad + ' ' + r.kod).includes(fold(RS.q))) && (!fn || fn(r)));
function bindRowLinks(main) { main.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-h]'); if (tr) go('/h/' + tr.dataset.h); }); }

route(/^\/r\/hammadde$/, async (main, ctx) => {
  setTitle('Hammadde stok');
  if (ctx.q.f) { RS.f = ctx.q.f; saveRS(); }
  const r = await api('GET', `/api/r/hammadde?ay=${S.ay}`);
  if (!ctx.alive()) return;
  main.innerHTML = pageHead('Hammadde stok raporu', `${ayAdi(S.ay)} · Excel "Hammadde" sayfasıyla aynı hesap: Kalan = Devreden − (Kullanılan + Fire) + Satın alınan − İade ± Sayım − İmha`,
    `<button class="btn" data-act="xls" data-k="hammadde">${icon('excel')}Excel</button><button class="btn" data-act="xls" data-k="sablon">${icon('download')}Sayım şablonu</button>`) +
    `<div class="card">${reportFilters(r.rows)}<div class="tw tbl-scroll" id="rt"></div></div>
    <p class="foot-note" style="margin-top:8px">Kullanılabilen = Kalan − Iskarta (sarı sütun). Cep depo eksi görünüyorsa üretimde kullanılan miktar için "Cep Depoya Verilen" kaydı girilmemiştir; toplam stok (Kalan) yine doğrudur.</p>`;
  const cols = [['devreden', 'Devreden'], ['kullanilan', 'Kullanılan'], ['fire', 'Fire'], ['alim', 'Satın alınan'], ['iade', 'İade'], ['sayimFark', 'Sayım farkı'], ['kalan', 'Kalan'], ['iskarta', 'Iskarta'], ['kullanilabilen', 'Kullanılabilen'], ['ana', 'Ana depo'], ['cep', 'Cep depo'], ['yakKoli', 'Yak. koli'], ['asgari', 'Asgari']];
  const draw = () => {
    const rows = filt(r.rows, RS.f === 'hareket' ? (x) => x.hareket > 0 : RS.f === 'uyari' ? (x) => x.durum !== 'normal' : null);
    $('#rc').textContent = `${rows.length} kalem`;
    let g = null;
    $('#rt').innerHTML = rows.length ? `<table class="t dense cards"><thead><tr><th>Hammadde</th><th>Birim</th>${cols.map(([, l]) => `<th class="num">${l}</th>`).join('')}<th>Durum</th></tr></thead><tbody>
      ${rows.map((x) => { const gr = x.grup !== g ? `<tr class="grp"><td colspan="${cols.length + 3}">${esc(g = x.grup)}</td></tr>` : '';
        return gr + `<tr class="click ${x.durum === 'normal' ? '' : x.durum === 'siparis' ? 'warnr' : 'alert'}" data-h="${x.id}"><td class="first" data-l="Hammadde"><div class="nm">${esc(x.ad)}</div><div class="small muted mono">${esc(x.kod)}</div></td><td data-l="Birim">${esc(x.birim)}</td>
        ${cols.map(([k, l]) => `<td class="num ${k === 'kullanilabilen' ? 'hl' : ''}" data-l="${l}">${k === 'yakKoli' ? fmt(x[k], 0) : ['kalan', 'kullanilabilen', 'ana', 'cep', 'sayimFark'].includes(k) ? (x[k] ? sgn(x[k]) : '') : fmtZ(x[k])}</td>`).join('')}<td data-l="Durum">${x.durum === 'normal' ? '' : durumBdg(x.durum)}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="empty">Kayıt yok</div>';
  };
  bindFilters(main, draw); bindRowLinks(main); draw();
});

route(/^\/r\/takip$/, async (main, ctx) => {
  setTitle('Aylık takip');
  const r = await api('GET', `/api/r/hammadde?ay=${S.ay}`);
  if (!ctx.alive()) return;
  main.innerHTML = pageHead('Aylık hammadde takibi (TRK şablonu)', `${ayAdi(S.ay)} · A + B = C · C − D ± diğer = E · G + H = I · J: Cep depoya verilen = Üretilen + Fire mi?`,
    `<button class="btn" data-act="xls" data-k="takip">${icon('excel')}Excel</button><a class="btn" href="#/r/urun">${icon('bottle')}Ürün stok (K–O)</a>`) +
    `<div class="card">${reportFilters(r.rows, { filters: [['', 'Tümü'], ['hareket', 'Hareket görenler'], ['uyari', 'Asgari altı'], ['fark', 'J = YANLIŞ']] })}<div class="tw tbl-scroll" id="rt"></div></div>`;
  const H = [['A', 'Önceki aydan devreden ana depo'], ['B', 'Hammadde alımı'], ['C', 'Ana depo (A+B)'], ['D', 'Cep depoya verilen'], ['E', 'Kalan ana depo'], ['F', 'Asgari stok'], ['G', 'Üretilen (kullanılan)'], ['H', 'Fire'], ['I', 'Üretilen + fire']];
  const draw = () => {
    const rows = filt(r.rows, RS.f === 'hareket' ? (x) => x.hareket > 0 : RS.f === 'uyari' ? (x) => x.trk.F > 0 && x.trk.E < x.trk.F : RS.f === 'fark' ? (x) => !x.trk.J && (x.trk.D || x.trk.I) : (x) => x.trk.A || x.trk.B || x.trk.D || x.trk.G || x.trk.E || x.hareket);
    $('#rc').textContent = `${rows.length} kalem`;
    $('#rt').innerHTML = rows.length ? `<table class="t dense cards"><thead><tr><th>Hammadde</th>${H.map(([k, l]) => `<th class="num" title="${l}">${k}<div class="small muted" style="font-weight:500;white-space:normal;min-width:80px">${l}</div></th>`).join('')}<th>J<div class="small muted" style="font-weight:500">Cep = üretim + fire</div></th><th class="num">Diğer ana depo<div class="small muted" style="font-weight:500">iade, sayım, imha</div></th></tr></thead><tbody>
      ${rows.map((x) => { const t = x.trk; const low = t.F > 0 && t.E < t.F;
        return `<tr class="click ${low ? 'alert' : ''}" data-h="${x.id}"><td class="first" data-l="Hammadde"><div class="nm">${esc(x.ad)}</div><div class="small muted"><span class="mono">${esc(x.kod)}</span> · ${esc(x.birim)}</div></td>
        ${H.map(([k, l]) => `<td class="num ${k === 'E' && low ? 'neg' : ''}" data-l="${k} · ${l}">${k === 'E' ? sgn(t[k]) : fmtZ(t[k])}</td>`).join('')}
        <td data-l="J">${t.D || t.I ? (t.J ? '<span class="bdg ok">DOĞRU</span>' : `<span class="bdg danger" title="Fark: ${fmt(t.fark)}">YANLIŞ</span> <span class="small muted">${fmt(t.fark)}</span>`) : ''}</td><td class="num" data-l="Diğer">${fmtZ(t.diger)}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="empty">Kayıt yok</div>';
  };
  bindFilters(main, draw); bindRowLinks(main); draw();
});

route(/^\/r\/urun$/, async (main, ctx) => {
  setTitle('Ürün stok');
  const r = await api('GET', `/api/r/urun?ay=${S.ay}`);
  if (!ctx.alive()) return;
  const rows = r.rows.filter((x) => x.aktif || x.hareket || x.kalan);
  const t = {}; for (const k of ['devir', 'uretilen', 'toplam', 'sevk', 'ihracat', 'sevkToplam', 'sayimFark', 'kalan']) t[k] = rows.reduce((a, x) => a + (x[k] || 0), 0);
  main.innerHTML = pageHead('Ürün stok (koli)', `${ayAdi(S.ay)} · K mevcut + G üretilen = L toplam · L − M sevk = N kalan. Açılış için "Ürün Sayımı" kaydı girin.`,
    `<button class="btn" data-act="xls" data-k="urun">${icon('excel')}Excel</button>${can.e('urunSayim') ? `<a class="btn" href="#/k/urunSayim?yeni=1">${icon('check')}Ürün sayımı</a>` : ''}`) +
    `<div class="card"><div class="tw"><table class="t cards"><thead><tr><th>Ürün</th><th class="num">K · Mevcut (devir)</th><th class="num">G · Üretilen</th><th class="num">L · Toplam</th><th class="num">Sevk</th><th class="num">İhracat</th><th class="num">M · Ürün sevk</th><th class="num">Sayım farkı</th><th class="num">N · Kalan</th><th class="num">Kalan palet</th></tr></thead><tbody>
    ${rows.map((x) => `<tr><td class="first nm" data-l="Ürün">${esc(x.ad)}</td><td class="num" data-l="K">${fmtZ(x.devir)}</td><td class="num" data-l="G">${fmtZ(x.uretilen)}</td><td class="num" data-l="L">${fmtZ(x.toplam)}</td><td class="num" data-l="Sevk">${fmtZ(x.sevk)}</td><td class="num" data-l="İhracat">${fmtZ(x.ihracat)}</td><td class="num" data-l="M">${fmtZ(x.sevkToplam)}</td><td class="num" data-l="Sayım">${x.sayimFark ? sgn(x.sayimFark) : ''}</td><td class="num hl" data-l="N"><b>${sgn(x.kalan)}</b></td><td class="num" data-l="Palet">${fmt(x.kalanPalet, 1)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Toplam</td>${['devir', 'uretilen', 'toplam', 'sevk', 'ihracat', 'sevkToplam', 'sayimFark', 'kalan'].map((k) => `<td class="num" data-l="${k}">${fmt(t[k])}</td>`).join('')}<td></td></tr></tfoot></table></div></div>
    ${rows.some((x) => x.kalan < 0) ? `<div class="banner warn" style="margin-top:12px">${icon('alert')}<div>Eksi görünen ürünlerde ay başı ürün stoğu (devir) girilmemiş olabilir. "Ürün Sayımı" ile önceki ayın son gününe sayım girerek açılış yapabilirsiniz.</div></div>` : ''}`;
});

route(/^\/r\/uretim$/, async (main, ctx) => {
  setTitle('Üretim özeti');
  const r = await api('GET', `/api/r/uretim?ay=${S.ay}`);
  if (!ctx.alive()) return;
  const C = [['kayit', 'Kayıt'], ['giren', 'Giren'], ['net', 'Net üretim'], ['koli', 'Koli'], ['pStd', 'Std palet'], ['pIhr', 'İhr. palet'], ['pEuro', 'Euro palet'], ['paletsiz', 'Paletsiz'], ['fPrf', 'Preform fire'], ['fPet', 'Şişe fire'], ['fKapak', 'Kapak fire'], ['fEtiket', 'Etiket fire'], ['fKulp', 'Kulp fire'], ['fShrink', 'Shrink (gr)'], ['vardiyaVrm', 'Vard. verim %'], ['uretimVrm', 'Üret. verim %']];
  const tbl = (rows, first, foot) => `<div class="tw"><table class="t dense cards"><thead><tr><th>${first}</th>${C.map(([, l]) => `<th class="num">${l}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((x) => `<tr><td class="first nm" data-l="${first}">${esc(x.ad || trD(x.tarih))}</td>${C.map(([k, l]) => `<td class="num" data-l="${l}">${k.includes('Vrm') ? fmt(x[k], 1) : fmtZ(x[k])}</td>`).join('')}</tr>`).join('')}</tbody>
    ${foot ? `<tfoot><tr><td>Toplam</td>${C.map(([k]) => `<td class="num">${k.includes('Vrm') ? fmt(foot[k], 1) : fmt(foot[k])}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  const ur = r.urunler.filter((x) => x.kayit);
  main.innerHTML = pageHead('Üretim özeti', `${ayAdi(S.ay)} · verim = net üretim ÷ (hat kapasitesi × süre)`, `<button class="btn" data-act="xls" data-k="uretim">${icon('excel')}Excel</button><a class="btn" href="#/k/uretim">${icon('list')}Üretim kayıtları</a>`) +
    (ur.length ? `<div class="stack"><section class="card"><div class="card-h"><h2>Ürünler</h2></div>${tbl(ur, 'Ürün', r.toplam)}</section>
      <section class="card"><div class="card-h"><h2>Hatlar</h2></div>${tbl(r.hatlar, 'Hat')}</section>
      <section class="card"><div class="card-h"><h2>Vardiyalar</h2></div>${tbl(r.vardiyalar, 'Vardiya')}</section>
      <section class="card"><div class="card-h"><h2>Günler</h2></div>${tbl(r.gunler, 'Tarih')}</section></div>` : '<div class="card empty">Bu ay üretim kaydı yok</div>');
});

route(/^\/r\/kullanim$/, async (main, ctx) => {
  setTitle('Reçete kullanımı');
  const r = await api('GET', `/api/r/kullanim?ay=${S.ay}`);
  if (!ctx.alive()) return;
  const list = r.rows.filter((u) => u.koli);
  const BAZ = { koli: 'koli', paletsiz: 'paletsiz koli', palet: 'palet' };
  main.innerHTML = pageHead('Reçeteye göre hammadde kullanımı', `${ayAdi(S.ay)} · her üretim kaydı ürünün reçetesiyle çarpılarak hesaplanır`, `<button class="btn" data-act="xls" data-k="kullanim">${icon('excel')}Excel</button>`) +
    (list.length ? `<div class="stack">${list.map((u) => `<section class="card"><div class="card-h"><h2>${esc(u.ad)}</h2><span class="bdg brand">${fmt(u.koli, 0)} koli</span><span class="spacer"></span><a class="small" href="#/recete?urun=${u.id}">Reçeteyi düzenle</a></div>
      <div class="tw"><table class="t dense cards"><thead><tr><th>Hammadde</th><th class="num">Reçete</th><th>Taban</th><th class="num">Kullanılan</th><th class="num">Fire</th><th class="num">Toplam</th><th class="num">Fire %</th></tr></thead><tbody>
      ${u.satirlar.filter((s) => s.toplam).map((s) => `<tr class="click" data-h="${s.hammadde}"><td class="first" data-l="Hammadde"><div class="nm">${esc(s.ad)}</div><div class="small muted mono">${esc(s.kod || '')}</div></td><td class="num" data-l="Reçete">${fmtP(s.miktar)} <span class="muted small">${esc(s.birim || '')}</span></td><td data-l="Taban" class="small">${BAZ[s.baz] || s.baz}${s.secim !== 'hepsi' ? ` · ${esc(s.secim)}` : ''}</td><td class="num" data-l="Kullanılan">${fmtZ(s.kullanilan)}</td><td class="num" data-l="Fire">${fmtZ(s.fire)}</td><td class="num" data-l="Toplam"><b>${fmt(s.toplam)}</b></td><td class="num" data-l="Fire %">${s.oran ? fmt(s.oran, 1) : ''}</td></tr>`).join('')}
      </tbody></table></div></section>`).join('')}</div>` : '<div class="card empty">Bu ay üretim kaydı yok</div>');
  bindRowLinks(main);
});

route(/^\/r\/sevkiyat$/, async (main, ctx) => {
  setTitle('Sevkiyat');
  const r = await api('GET', `/api/r/sevkiyat?ay=${S.ay}`);
  if (!ctx.alive()) return;
  const ur = r.urunler.filter((u) => u.toplam);
  const t = r.toplam;
  main.innerHTML = pageHead('Sevkiyat raporu', `${ayAdi(S.ay)} · tır: ${fmt(r.ayar.kgTir)} kg / ${fmt(r.ayar.paletTir)} palet (Ayarlar'dan değiştirilebilir)`, `<button class="btn" data-act="xls" data-k="sevkiyat">${icon('excel')}Excel</button><a class="btn" href="#/k/sevkiyat">${icon('list')}Sevkiyat kayıtları</a>`) +
    `<div class="kpis"><div class="kpi"><div class="l">Toplam</div><div class="v">${fmt(t.toplam, 0)}</div><div class="s">koli</div></div><div class="kpi"><div class="l">Palet</div><div class="v">${fmt(t.palet, 0)}</div></div><div class="kpi"><div class="l">Ağırlık</div><div class="v">${fmt(t.kg / 1000, 1)}</div><div class="s">ton</div></div><div class="kpi"><div class="l">Sevkiyat günü</div><div class="v">${t.sevkGun}</div><div class="s">günlük ort. ${fmt(t.gunlukOrt, 0)} koli</div></div><div class="kpi"><div class="l">Tır (kg / palet)</div><div class="v">${fmt(t.tirKg, 1)} / ${fmt(t.tirPalet, 1)}</div></div></div>
    <div class="stack"><section class="card"><div class="card-h"><h2>Ürünler</h2></div><div class="tw"><table class="t cards"><thead><tr><th>Ürün</th><th class="num">Yurtiçi</th><th class="num">İhracat</th><th class="num">Toplam koli</th><th class="num">Palet</th><th class="num">Kg</th><th class="num">Günlük ort.</th></tr></thead><tbody>
    ${ur.map((u) => `<tr><td class="first nm" data-l="Ürün">${esc(u.ad)}</td><td class="num" data-l="Yurtiçi">${fmtZ(u.yurtici)}</td><td class="num" data-l="İhracat">${fmtZ(u.ihracat)}</td><td class="num" data-l="Toplam"><b>${fmt(u.toplam)}</b></td><td class="num" data-l="Palet">${fmt(u.palet, 1)}</td><td class="num" data-l="Kg">${fmt(u.kg, 0)}</td><td class="num" data-l="Ort.">${fmt(u.gunlukOrt, 0)}</td></tr>`).join('') || `<tr><td colspan="7" class="empty">Sevkiyat yok</td></tr>`}</tbody></table></div></section>
    <section class="card"><div class="card-h"><h2>Günler</h2></div><div class="tw"><table class="t dense cards"><thead><tr><th>Tarih</th>${ur.map((u) => `<th class="num">${esc(u.ad)}</th>`).join('')}<th class="num">Toplam</th><th class="num">Palet</th><th class="num">Tır</th></tr></thead><tbody>
    ${r.gunler.map((g) => `<tr class="click" data-sid="${g.id}"><td class="first" data-l="Tarih">${trD(g.tarih)}</td>${ur.map((u) => `<td class="num" data-l="${esc(u.ad)}">${fmtZ((g.miktar[u.id] || 0) + (g.ihracat[u.id] || 0))}</td>`).join('')}<td class="num" data-l="Toplam"><b>${fmt(g.toplam)}</b></td><td class="num" data-l="Palet">${fmt(g.palet, 1)}</td><td class="num" data-l="Tır">${fmt(g.tirKg, 1)}</td></tr>`).join('')}
    </tbody></table></div></section></div>`;
  $$('tr[data-sid]', main).forEach((tr) => tr.addEventListener('click', async () => { const x = await api('GET', `/api/c/sevkiyat/${tr.dataset.sid}`); openForm('sevkiyat', x.doc); }));
});

// ================= 2.1: ÜRÜN (MAMUL) KARTI =================
route(/^\/u\/(\d+)$/, async (main, ctx) => {
  const id = Number(ctx.m[1]);
  const r = await api('GET', `/api/r/urunkart/${id}?ay=${S.ay}`);
  if (!ctx.alive()) return;
  const d = r.doc; const o = r.ozet || {};
  setTitle(d.ad);
  const KIND = { uretim: ['Üretim (mamul girişi)', 'brand'], sevk: ['Sevkiyat', 'warn'], ihr: ['İhracat sevkiyatı', 'warn'], sayim: ['Sayım', ''] };
  const act = (coll, l, ic) => (can.e(coll) ? `<a class="btn sm" href="#/k/${coll}?yeni=1&urun=${id}">${icon(ic)}${l}</a>` : '');
  const low = d.asgari && r.stok < d.asgari;
  main.innerHTML = pageHead(esc(d.ad), `<span class="mono">${esc(d.kod || '')}</span> · mamul${d.aktif === false ? ' · <span class="bdg">pasif</span>' : ''}`,
    `${can.admin() ? `<button class="btn" data-act="edit-def" data-coll="urun" data-id="${id}">${icon('edit')}Düzenle</button>` : ''}${d.kod ? `<button class="btn" data-act="lbl-urun" data-id="${id}">${icon('print')}Etiket</button>` : ''}`) +
    `<div class="grid" style="grid-template-columns:minmax(0,1fr) auto;align-items:start;margin-bottom:14px">
      <section class="card card-b stack">
        <div class="row"><h2 class="grow">Güncel mamul stoğu</h2>${low ? durumBdg(r.stok <= 0 ? 'tukendi' : 'siparis') : ''}</div>
        <div class="stockbox">
          <div><div class="l">Stok (koli)</div><div class="v">${sgn(r.stok, 0)}</div></div>
          <div><div class="l">Palet</div><div class="v">${d.sevkKoliPalet ? fmt(r.stok / d.sevkKoliPalet, 1) : '—'}</div></div>
          <div><div class="l">${ayAdi(S.ay)} üretim</div><div class="v">${fmt(o.uretilen || 0, 0)}</div></div>
          <div><div class="l">${ayAdi(S.ay)} sevkiyat</div><div class="v">${fmt(o.sevkToplam || 0, 0)}</div></div>
          <div><div class="l">Asgari</div><div class="v">${fmt(d.asgari) || '—'}</div></div>
        </div>
        <div class="row">${act('uretim', 'Üretim / mamul girişi', 'factory')}${act('sevkiyat', 'Sevkiyat çıkışı', 'truck')}${act('urunSayim', 'Sayım', 'check')}</div>
      </section>
      ${d.kod ? `<div class="card card-b hide-m" style="text-align:center"><div class="qrbox">${window.QR.toSvg(d.kod, { ecl: 'M', border: 1 })}</div><div class="mono small" style="margin-top:4px">${esc(d.kod)}</div></div>` : ''}
    </div>
    <section class="card"><div class="card-h"><h2>Son hareketler</h2><span class="muted small">Önceki stok + Üretim − Sevkiyat = Güncel stok</span></div>
      ${r.hareketler.length ? `<div class="tw"><table class="t dense cards"><thead><tr><th>Tarih</th><th>Hareket</th><th class="num">Koli</th><th>Müşteri</th></tr></thead><tbody>
      ${r.hareketler.map((e) => { const k = KIND[e.kind] || [e.kind, '']; return `<tr class="click" data-c="${e.coll}" data-i="${e.id}"><td class="first" data-l="Tarih">${trD(e.t)}</td><td data-l="Hareket"><span class="bdg ${k[1]}">${k[0]}</span></td><td class="num" data-l="Koli">${e.kind === 'sayim' ? '= ' + fmt(e.val) : sgn(e.q)}</td><td data-l="Müşteri">${esc(e.musteri)}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="empty">Hareket yok</div>'}</section>`;
  $$('tr[data-c]', main).forEach((tr) => tr.addEventListener('click', async () => {
    try { const x = await api('GET', `/api/c/${tr.dataset.c}/${tr.dataset.i}`); openForm(tr.dataset.c, x.doc); } catch (e) { toast(e.message, 'err'); }
  }));
});
// ?urun=… ile yeni kayıt: ürün ön seçili (sevkiyatta satıra odaklanır)
window.addEventListener('hashchange', () => {
  const { path, q } = parseHash();
  const m = path.match(/^\/k\/(\w+)$/);
  if (m && q.yeni && q.urun) { history.replaceState(null, '', '#' + path); setTimeout(() => {
    if (m[1] === 'sevkiyat') { const md = openForm('sevkiyat', null, {}); const inp = md && $(`tr[data-u="${q.urun}"] [data-m=miktar]`, md.el); if (inp) inp.focus(); }
    else openForm(m[1], null, { urun: Number(q.urun) });
  }, 350); }
});

// ================= 2.1: GEÇMİŞ GÜN STOK DURUMU =================
route(/^\/r\/durum$/, async (main, ctx) => {
  setTitle('Stok durumu');
  const t = /^\d{4}-\d{2}-\d{2}$/.test(ctx.q.tarih || '') ? ctx.q.tarih : today();
  const r = await api('GET', `/api/r/durum?tarih=${t}`);
  if (!ctx.alive()) return;
  main.innerHTML = pageHead('Stok durumu', `Seçtiğiniz günün sonundaki ana depo, cep depo ve mamul stokları — tüm kayıtlardan yeniden hesaplanır`,
    `<input class="input" type="date" id="dt" value="${t}" max="${today()}" style="width:auto"><button class="btn" data-act="xls-durum" data-t="${t}">${icon('excel')}Excel</button>`) +
    `<div class="kpis">${r.birimler.slice(0, 4).map((b) => `<div class="kpi"><div class="l">${esc(b.birim)}</div><div class="v">${fmt(b.kalan, 0)}</div><div class="s">ana ${fmt(b.ana, 0)} · cep ${fmt(b.cep, 0)}</div></div>`).join('')}
      <div class="kpi"><div class="l">Mamul</div><div class="v">${fmt(r.urunler.reduce((a, u) => a + u.koli, 0), 0)}</div><div class="s">koli</div></div></div>
    <div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);align-items:start">
    <div class="card">${reportFilters(r.hammadde, { filters: [['', 'Tümü'], ['hareket', 'Stoğu olanlar'], ['uyari', 'Uyarılar']] })}<div class="tw tbl-scroll" id="rt"></div></div>
    <section class="card"><div class="card-h"><h2>Mamul stoğu</h2><span class="muted small">${trD(t)}</span></div><div class="tw"><table class="t dense"><thead><tr><th>Ürün</th><th class="num">Koli</th><th class="num">Palet</th></tr></thead><tbody>
      ${r.urunler.map((u) => `<tr class="click" data-u="${u.id}"><td class="nm">${esc(u.ad)}</td><td class="num">${sgn(u.koli, 0)}</td><td class="num">${fmt(u.palet, 1)}</td></tr>`).join('')}</tbody></table></div></section></div>`;
  const draw = () => {
    const rows = filt(r.hammadde, RS.f === 'hareket' ? (x) => x.kalan : RS.f === 'uyari' ? (x) => x.durum !== 'normal' : null);
    $('#rc').textContent = `${rows.length} kalem`;
    let g = null;
    $('#rt').innerHTML = rows.length ? `<table class="t dense cards"><thead><tr><th>Hammadde</th><th>Birim</th><th class="num">Ana depo</th><th class="num">Cep depo</th><th class="num">Toplam</th><th class="num">Kullanılabilen</th><th>Durum</th></tr></thead><tbody>
      ${rows.map((x) => (x.grup !== g ? `<tr class="grp"><td colspan="7">${esc(g = x.grup)}</td></tr>` : '') + `<tr class="click" data-h="${x.id}"><td class="first" data-l="Hammadde"><div class="nm">${esc(x.ad)}</div><div class="small muted mono">${esc(x.kod)}</div></td><td data-l="Birim">${esc(x.birim)}</td><td class="num" data-l="Ana">${x.ana ? sgn(x.ana) : ''}</td><td class="num" data-l="Cep">${x.cep ? sgn(x.cep) : ''}</td><td class="num" data-l="Toplam"><b>${x.kalan ? sgn(x.kalan) : ''}</b></td><td class="num hl" data-l="Kullanılabilen">${x.kullanilabilen ? sgn(x.kullanilabilen) : ''}</td><td data-l="Durum">${x.durum === 'normal' ? '' : durumBdg(x.durum)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Kayıt yok</div>';
  };
  bindFilters(main, draw); bindRowLinks(main); draw();
  $('#dt').addEventListener('change', (e) => { if (e.target.value) go('/r/durum?tarih=' + e.target.value); });
  $$('tr[data-u]', main).forEach((tr) => tr.addEventListener('click', () => go('/u/' + tr.dataset.u)));
});
ACTS['xls-durum'] = (el) => dl(`/api/x/durum?tarih=${el.dataset.t}`);

// ================= 2.1: TARİH ARALIĞI SEÇİCİ =================
const rangeBox = (id = 'ar') => `<div class="row range" id="${id}"><input class="input" type="date" data-ar="bas" value="${AR.bas}" style="width:auto"><span class="muted">–</span><input class="input" type="date" data-ar="bit" value="${AR.bit}" style="width:auto">
  <div class="seg"><button data-pre="ay">Bu ay</button><button data-pre="gecen">Geçen ay</button><button data-pre="yil">Bu yıl</button></div></div>`;
function bindRange(root, onChange) {
  $$('[data-ar]', root).forEach((i) => i.addEventListener('change', () => { if (!i.value) return; AR[i.dataset.ar] = i.value; if (AR.bit < AR.bas) AR.bit = AR.bas; saveAR(); onChange(); }));
  $$('[data-pre]', root).forEach((b) => b.addEventListener('click', () => {
    const t = today(); const y = t.slice(0, 4);
    if (b.dataset.pre === 'ay') { AR.bas = t.slice(0, 8) + '01'; AR.bit = t; }
    else if (b.dataset.pre === 'gecen') { const a = ayKaydir(t.slice(0, 7), -1); AR.bas = a + '-01'; const [yy, mm] = a.split('-').map(Number); AR.bit = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10); }
    else { AR.bas = y + '-01-01'; AR.bit = t; }
    saveAR(); onChange();
  }));
}
const arQS = () => `bas=${AR.bas}&bit=${AR.bit}`;

// ================= 2.1: HAMMADDE HAREKETLERİ =================
route(/^\/r\/hareket$/, async (main, ctx) => {
  setTitle('Hammadde hareketleri');
  const mat = ctx.q.hammadde || '';
  const r = await api('GET', `/api/r/hareket?${arQS()}${mat ? '&hammadde=' + mat : ''}`);
  if (!ctx.alive()) return;
  const KIND = { alim: 'ok', iade: 'warn', cep: 'info', kul: 'brand', fire: 'danger', imha: 'danger', iskarta: 'warn', sayim: '' };
  main.innerHTML = pageHead('Hammadde hareketleri', `${r.donem || ''} · giriş, transfer, üretim tüketimi, fire, iade, ıskarta ve sayımlar — tarih, kullanıcı ve lot bilgisiyle`,
    `<button class="btn" data-act="xls-ar" data-k="hareket" data-mat="${esc(mat)}">${icon('excel')}Excel</button>`) +
    `<div class="card"><div class="card-h">${rangeBox()}<div style="width:min(300px,100%)">${comboHtml('fm', [], mat, { placeholder: 'Hammadde seçin (tümü)…' })}</div><span class="spacer"></span><span class="muted small">${fmt(r.rows.length)} hareket${r.rows.length >= 3000 ? ' (ilk 3000)' : ''}</span></div>
    <div class="tw tbl-scroll">${r.rows.length ? `<table class="t dense cards"><thead><tr><th>Tarih</th><th>Hareket</th><th>Hammadde</th><th class="num">Ana ±</th><th class="num">Cep ±</th><th>Lot / belge</th><th>Giren</th></tr></thead><tbody>
    ${r.rows.map((e) => `<tr class="click" data-c="${e.coll}" data-i="${e.id}"><td class="first" data-l="Tarih">${trD(e.t)}</td><td data-l="Hareket"><span class="bdg ${KIND[e.kind] || ''}">${esc(e.ad)}</span>${e.kind === 'sayim' ? ` <span class="small muted">${e.depo} = ${fmt(e.val)} (fark ${fmt(e.delta)})</span>` : ''}</td>
      <td data-l="Hammadde"><div class="nm">${esc(e.matAd)}</div><div class="small muted mono">${esc(e.kod)} · ${esc(e.birim)}</div></td><td class="num" data-l="Ana">${e.ana ? sgn(e.ana) : ''}</td><td class="num" data-l="Cep">${e.cep ? sgn(e.cep) : ''}</td>
      <td data-l="Lot / belge" class="small">${esc([e.lotNo, e.belge, e.firma].filter(Boolean).join(' · '))}</td><td data-l="Giren" class="small">${esc(e.byName)}<div class="muted">${fmtDT(e.at)}</div></td></tr>`).join('')}
    </tbody></table>` : '<div class="empty">Bu aralıkta hareket yok</div>'}</div></div>`;
  bindRange(main, () => rerender());
  bindCombo(main, 'fm', matItems(null, mat), (it) => go('/r/hareket' + (it ? '?hammadde=' + it.id : '')));
  $$('tr[data-c]', main).forEach((tr) => tr.addEventListener('click', async () => { try { const x = await api('GET', `/api/c/${tr.dataset.c}/${tr.dataset.i}`); openForm(tr.dataset.c, x.doc); } catch (e) { toast(e.message, 'err'); } }));
});
ACTS['xls-ar'] = (el) => dl(`/api/x/${el.dataset.k}?${arQS()}${el.dataset.mat ? '&hammadde=' + el.dataset.mat : ''}${el.dataset.user ? '&user=' + el.dataset.user : ''}`);

// ================= 2.1: KULLANICI İŞLEM RAPORU =================
route(/^\/r\/islem$/, async (main, ctx) => {
  setTitle('Kullanıcı işlemleri');
  const uid = ctx.q.user || '';
  const [r, users] = await Promise.all([api('GET', `/api/users/islem?${arQS()}${uid ? '&user=' + uid : ''}`), can.admin() ? api('GET', '/api/users') : Promise.resolve([])]);
  if (!ctx.alive()) return;
  const say = {}; for (const x of r.rows) say[x.user || 'Sistem'] = (say[x.user || 'Sistem'] || 0) + 1;
  main.innerHTML = pageHead('Kullanıcı işlem raporu', 'Kim, ne zaman, hangi kaydı ekledi / değiştirdi / sildi. Silinen ve düzeltilen kayıtların eski hali korunur.',
    `<button class="btn" data-act="xls-ar" data-k="islem" data-user="${esc(uid)}">${icon('excel')}Excel</button>`) +
    `<div class="card"><div class="card-h">${rangeBox()}${users.length ? `<select class="input" id="iu" style="width:auto"><option value="">Tüm kullanıcılar</option>${users.map((u) => `<option value="${u.id}" ${String(u.id) === uid ? 'selected' : ''}>${esc(u.fullName)}</option>`).join('')}</select>` : ''}<span class="spacer"></span><span class="muted small">${Object.entries(say).map(([k, n]) => `${esc(k)}: ${n}`).join(' · ')}</span></div>
    <div class="tw tbl-scroll">${r.rows.length ? `<table class="t dense cards"><thead><tr><th>Zaman</th><th>Kullanıcı</th><th>İşlem</th><th>Kayıt</th><th>Değişen alanlar</th></tr></thead><tbody>
    ${r.rows.map((x) => `<tr class="${x.geriAlindi ? 'off' : ''}"><td class="first" data-l="Zaman">${fmtDT(x.at)}</td><td data-l="Kullanıcı">${esc(x.user || 'Sistem')}</td><td data-l="İşlem"><span class="bdg ${x.islem === 'Silme' ? 'danger' : x.islem === 'Ekleme' ? 'ok' : x.islem === 'Geri alma' ? 'warn' : 'info'}">${esc(x.islem)}</span>${x.geriAlindi ? ' <span class="bdg">geri alındı</span>' : ''}</td>
      <td data-l="Kayıt"><div class="small muted">${esc(x.tur)}</div>${esc(x.kayit)}${x.label ? `<div class="small muted">${esc(x.label)}</div>` : ''}</td><td data-l="Alanlar" class="small">${esc(x.alanlar)}</td></tr>`).join('')}
    </tbody></table>${r.rows.length >= 2000 ? '<div class="card-b small muted">İlk 2000 işlem gösteriliyor; tamamı için Excel\'i indirin.</div>' : ''}` : '<div class="empty">Bu aralıkta işlem yok</div>'}</div></div>`;
  bindRange(main, () => rerender());
  const iu = $('#iu', main); if (iu) iu.addEventListener('change', () => go('/r/islem' + (iu.value ? '?user=' + iu.value : '')));
});

// ================= 2.1: EXCEL RAPOR MERKEZİ =================
route(/^\/r\/merkez$/, async (main) => {
  setTitle('Excel rapor merkezi');
  const R = [
    ['genel', 'Genel yönetici raporu', 'Tüm raporlar ve kayıt listeleri tek dosyada (hammadde, ana/cep depo, takip, mamul, üretim, reçete, sevkiyat, hareketler, kullanıcı işlemleri)', 'genel'],
    ['anaDepo', 'Ana depo raporu', 'Devreden, giriş, iade, cep\'e verilen, sayım, imha, kalan', 'anaDepo'],
    ['cepDepo', 'Cep depo raporu', 'Devreden, ana depodan gelen, üretimde kullanılan, fire, sayım, kalan', 'cepDepo'],
    ['hareket', 'Hammadde hareket raporu', 'Her hareket satır satır; lot, belge, kullanıcı ve kayıt zamanıyla', 'hareket'],
    ['hammadde', 'Hammadde stok raporu', 'Excel "Hammadde" sayfasıyla aynı düzen, formüllü', 'hammadde'],
    ['uretim', 'Üretim raporu', 'Ürün, hat, vardiya bazında üretim, fire ve verim', 'uretim'],
    ['kullanim', 'Reçete kullanımı', 'Reçeteye göre hammadde tüketimi ve fire oranları', 'kullanim'],
    ['urun', 'Mamul stok raporu', 'Önceki stok + üretim − sevkiyat = güncel mamul stoğu', 'urun'],
    ['sevkiyat', 'Sevkiyat raporu', 'Ürün ve gün bazında koli, palet, kg ve tır', 'sevkiyat'],
    ['islem', 'Kullanıcı işlem raporu', 'Tüm ekleme, düzenleme, silme ve geri almalar', 'islem'],
  ].filter((x) => can.r(x[3]));
  main.innerHTML = pageHead('Excel rapor merkezi', 'Tarih aralığı seçin, istediğiniz raporu indirin. Toplamlar ve hesaplı sütunlar formüllüdür.') +
    `<div class="card"><div class="card-h">${rangeBox()}</div><div class="list">${R.map(([k, l, d]) => `<div class="it"><span class="ic">${icon('excel')}</span><div class="grow"><b>${esc(l)}</b><div class="small muted">${esc(d)}</div></div><button class="btn sm" data-act="xls-ar" data-k="${k}">${icon('download')}İndir</button></div>`).join('')}
    ${can.r('durum') ? `<div class="it"><span class="ic">${icon('clock')}</span><div class="grow"><b>Belirli bir günün stok durumu</b><div class="small muted">Ana depo, cep depo ve mamul stokları — o günün sonundaki haliyle</div></div><input class="input" type="date" id="md" value="${AR.bit}" style="width:auto"><button class="btn sm" id="mdb">${icon('download')}İndir</button></div>` : ''}</div></div>`;
  bindRange(main, () => rerender(true));
  const mdb = $('#mdb', main); if (mdb) mdb.addEventListener('click', () => dl(`/api/x/durum?tarih=${$('#md', main).value || today()}`));
});
