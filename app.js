/* Our Charism — offline reader for ourcharism.org */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const view = $('#view');
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MSHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SITE = 'https://ourcharism.org';

// ------------------------------------------------------------------ storage
const store = {
  get(k, d) { try { const v = localStorage.getItem('ourcharism:en:draft:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ourcharism:en:draft:' + k, JSON.stringify(v)); } catch {} }
};
const S = Object.assign({ theme: 'auto', fs: 19, lh: 1.68, font: 'serif', autoDl: true }, store.get('settings', {}));
let favs = store.get('favs', []);
let hist = store.get('hist:en', []);
let pos = store.get('pos:en', {});
const saveS = () => store.set('settings', S);

function applySettings() {
  const r = document.documentElement;
  if (S.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme);
  r.style.setProperty('--fs', S.fs + 'px');
  r.style.setProperty('--lh', S.lh);
  r.setAttribute('data-font', S.font);
}
applySettings();

// ------------------------------------------------------------------ utils
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MARKS = /[̀-ͯ]/g;
const fcache = new Map();
function fold(s) {
  const a = s.toLowerCase().normalize('NFD').replace(MARKS, '');
  if (a.length === s.length) return a;
  let o = '';
  for (const c of s) {
    if (c.length !== 1) { o += c; continue; }
    let f = fcache.get(c);
    if (f === undefined) { f = c.toLowerCase().normalize('NFD').replace(MARKS, ''); if (f.length !== 1) f = c; fcache.set(c, f); }
    o += f;
  }
  return o;
}
function fmtDate(d) { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return `${dd} ${MSHORT[m - 1]} ${y}`; }
function mins(w) { const m = Math.max(1, Math.round(w / 210)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; }
function toast(msg, action, fn, ms = 4200) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button>${esc(action)}</button>` : '');
  t.hidden = false;
  if (action) t.querySelector('button').onclick = () => { t.hidden = true; fn(); };
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms);
}
function sheet(html, onOpen) {
  const sh = $('#sheet');
  $('.sheet-body', sh).innerHTML = html;
  sh.hidden = false;
  const close = () => { sh.hidden = true; document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  sh.onclick = e => { if (e.target === sh || e.target.closest('.sheet-x')) close(); };
  if (onOpen) onOpen($('.sheet-body', sh), close);
  return close;
}

const IC = {
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
  letter: '<rect x="3.5" y="6" width="17" height="12.5" rx="1.5"/><path d="M4 7l8 6 8-6"/>',
  quill: '<path d="M19.5 4.5c-6 .5-10.5 5-12 11.5l-1.5 4"/><path d="M19.5 4.5c.5 6-4 10.5-10.5 11.5M9 12.5h4.5"/>',
  lectern: '<path d="M5 8.5l7-3 7 3-7 3zM12 11.5V20M8.5 20h7"/>',
  ambo: '<path d="M7 4.5h10M12 4.5v3M6 7.5h12l-1.5 12h-9z"/><path d="M12 11v5M10 13h4"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M12 8v7M9.5 10.5h5"/>',
  chalice: '<path d="M6.5 4h11c0 5-2.5 8-5.5 8s-5.5-3-5.5-8zM12 12v6M8 20h8"/><circle cx="12" cy="7" r="0"/>',
  scroll: '<path d="M7 4.5h10.5a2 2 0 0 1 2 2V8h-3M7 4.5a2 2 0 0 0-2 2V17a2.5 2.5 0 0 0 2.5 2.5h9"/><path d="M16.5 8v9.5a2 2 0 0 0 2 2M8.5 9h5M8.5 12.5h5"/>',
  book: '<path d="M12 6.5c-2-1.5-4.5-2-8-2V18c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4.5c-3.5 0-6 .5-8 2zM12 6.5V20"/>',
  mountain: '<path d="M3 19.5l6.5-11 3.5 6 2-3 6 8z"/><path d="M12 4v4M10.3 5.7h3.4"/>',
  voice: '<path d="M4 10v4M8 7v10M12 4.5v15M16 8v8M20 10.5v3"/>',
  timeline: '<path d="M12 3.5v17"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M14 7h5M5 17h5"/>',
  tag: '<path d="M4 4.5h7.5l8.5 8.5-7 7-8.5-8.5z"/><circle cx="8.5" cy="9" r="1.3"/>',
  home: '<path d="M4 11l8-6.5L20 11v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  bookmark: '<path d="M6.5 4h11v16l-5.5-4-5.5 4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  audio: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3.5" y="13" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="13" width="4" height="6.5" rx="1.5"/>',
  video: '<rect x="3.5" y="6" width="12" height="12" rx="2"/><path d="M15.5 10.5l5-3v9l-5-3z"/>',
  pdf: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/>',
  share: '<path d="M12 15V4M8 7.5l4-4 4 4"/><path d="M6 12v7.5h12V12"/>',
  ext: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v5.5H5V7.5h5.5"/>',
  aa: '<path d="M3.5 18l4.5-12 4.5 12M5.2 13.5h5.6"/><path d="M14.5 13.2c.5-1.4 1.6-2 3-2 1.9 0 2.9 1 2.9 3V18M20.4 15c-3.6-.4-6.1.4-6.1 1.8 0 .9.8 1.5 2 1.5 2.1 0 4.1-1.2 4.1-3.3"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r=".9"/><circle cx="15" cy="15" r=".9"/><circle cx="15" cy="9" r=".9"/><circle cx="9" cy="15" r=".9"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18.5z"/><path d="M12 10.5v5.5M9.5 13.5L12 16l2.5-2.5"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
};
const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${IC[n] || IC.book}</svg>`;

// ------------------------------------------------------------------ data
let IDX = null, ORDER = [], SIBS = {};
const contentCache = new Map();
async function loadIndex() {
  const r = await fetch('data/index.json', { cache: 'no-cache' }).catch(() => fetch('data/index.json'));
  IDX = await r.json();
  // flatten tree for prev/next and paths
  IDX.sections.forEach((s, si) => {
    s.idx = si;
    const walk = (items, path) => {
      const ids = items.filter(i => i.id != null).map(i => String(i.id));
      ids.forEach(id => { if (!SIBS[id]) SIBS[id] = { list: ids, sec: si, path }; ORDER.push(id); });
      items.forEach(i => { if (i.g) walk(i.g, path.concat(i.t)); });
    };
    walk(s.items, [s.t]);
  });
}
const doc = id => IDX.docs[String(id)];
async function getContent(id) {
  id = String(id);
  if (contentCache.has(id)) return contentCache.get(id);
  const r = await fetch(`data/c/${id}.html`);
  if (!r.ok) throw new Error('Not available offline');
  const h = await r.text();
  contentCache.set(id, h);
  if (contentCache.size > 40) contentCache.delete(contentCache.keys().next().value);
  return h;
}
function secIndexByName(n) { return IDX.sections.findIndex(s => s.t === n); }

// ------------------------------------------------------------------ search worker
let worker = null, wseq = 0;
const wcb = new Map();
function getWorker() {
  if (!worker) {
    worker = new Worker('search-worker.js');
    worker.onmessage = e => { const m = e.data; if (m.type === 'results' && wcb.has(m.seq)) { wcb.get(m.seq)(m); wcb.delete(m.seq); } };
    worker.postMessage({ type: 'load', url: 'data/search.json' });
  }
  return worker;
}
function runSearch(q, titlesOnly) {
  return new Promise(res => { const seq = ++wseq; wcb.set(seq, res); getWorker().postMessage({ type: 'search', q, titlesOnly, seq, url: 'data/search.json' }); });
}
function parseNeedles(q) {
  q = q.replace(/[“”«»„]/g, '"'); const out = [];
  q = q.replace(/"([^"]+)"/g, (_, p) => { out.push(fold(p.trim())); return ' '; });
  q.split(/\s+/).forEach(w => { if (!w || w[0] === '-') return; w = fold(w).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); if (w) out.push(w); });
  return out.filter(Boolean);
}
function markText(s, needles) {
  const f = fold(s); const h = [];
  needles.forEach(n => { let i = 0; while ((i = f.indexOf(n, i)) !== -1) { h.push([i, i + n.length]); i += n.length; } });
  return applyMarks(s, h);
}
function applyMarks(s, h) {
  h = h.sort((a, b) => a[0] - b[0]); let out = '', last = 0;
  for (const [a, b] of h) { if (a < last) continue; out += esc(s.slice(last, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>'; last = b; }
  return out + esc(s.slice(last));
}

// ------------------------------------------------------------------ components
function badges(m) {
  let b = '';
  if (m.a) b += `<span class="badge" title="Audio">${icon('audio')}</span>`;
  if (m.v) b += `<span class="badge" title="Video">${icon('video')}</span>`;
  if (m.f) b += `<span class="badge" title="PDF">${icon('pdf')}</span>`;
  return b ? `<span class="badges">${b}</span>` : '';
}
const hasReadingText = m => !['resource-entry','empty-source-entry','official-pdf'].includes(m.entry_kind);
function itemRow(id, opts = {}) {
  const m = doc(id); if (!m) return '';
  const read = pos[id] != null;
  const meta = [m.d && !String(id).startsWith('pg-') ? fmtDate(m.d) : '', m.w > 40 && hasReadingText(m) ? mins(m.w) : ''].filter(Boolean).join(' · ');
  return `<a class="item${read ? ' read' : ''}" href="#/p/${id}${opts.q ? '?q=' + encodeURIComponent(opts.q) : ''}">
    ${opts.num != null ? `<span class="num">${opts.num}</span>` : ''}
    <div class="body">${opts.where ? `<div class="where">${esc(m.p.join(' · '))}</div>` : ''}
      <div class="it-t">${opts.titleHtml || esc(opts.t || m.t)}</div>
      <div class="it-m">${meta ? `<span>${meta}</span>` : ''}${badges(m)}</div>
      ${opts.x !== false ? `<div class="it-x">${opts.xHtml || esc(m.x)}</div>` : ''}
    </div><span class="chev">${icon('chev')}</span></a>`;
}
function extRow(it) {
  return `<a class="item" href="${esc(it.ext)}" target="_blank" rel="noopener"><div class="body"><div class="it-t">${esc(it.t)}</div><div class="it-m"><span>${it.source_language === 'Spanish' ? 'Spanish source resource' : it.kind === 'pdf' ? 'PDF on the source website' : 'External link'}</span><span class="badges"><span class="badge">${icon(it.kind === 'pdf' ? 'pdf' : 'ext')}</span></span></div></div><span class="chev">${icon('ext')}</span></a>`;
}

function pendingRow(it) {
  return `<div class="item translation-pending" data-source-id="${esc(it.source_id)}"><div class="body"><div class="it-t">${esc(it.t)}</div><div class="it-m">English text pending · <a href="${esc(it.u)}" target="_blank" rel="noopener">Spanish original ↗</a></div></div></div>`;
}
function renderSidebar(cur) {
  const sb = $('#sidebar');
  const l = (href, ic, t, n, key) => `<a href="${href}" class="${cur === key ? 'cur' : ''}">${icon(ic)}<span>${esc(t)}</span>${n != null ? `<em>${n}</em>` : ''}</a>`;
  sb.innerHTML = `<div class="side">
    ${l('#/', 'home', 'Home', null, 'home')}
    ${l('#/buscar', 'search', 'Search', null, 'buscar')}
    ${l('#/guardados', 'bookmark', 'Saved', favs.length || null, 'guardados')}
    <div class="side-h">Sections</div>
    ${IDX.sections.map((s, i) => l('#/s/' + i, s.i, s.t, s.n, 's' + i)).join('')}
    <div class="side-h">Explore</div>
    ${Object.keys(IDX.tags).length ? l('#/temas', 'tag', 'Topics', null, 'temas') : ''}
    ${l('#/ajustes', 'gear', 'Settings', null, 'ajustes')}
  </div>`;
}
function setChrome(key, sub) {
  document.body.classList.toggle('sub', !!sub);
  document.body.classList.toggle('reading', key === 'reader');
  $$('.tabbar a').forEach(a => a.classList.toggle('cur', a.dataset.tab === key || (key && key[0] === 's' && key !== 'secciones' && a.dataset.tab === 'secciones' && /^s\d/.test(key))));
  renderSidebar(key);
  $('#progress').style.width = '0';
}

// ------------------------------------------------------------------ views
function feastList() {
  const lit = IDX.sections.find(s => s.t === 'Liturgy'); if (!lit) return [];
  const g = lit.items.find(i => i.t === 'Patron Saints'); if (!g) return [];
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return g.g.filter(i => i.id != null).map(i => {
    const m = doc(i.id); const [mo, d] = (m.fd || m.d.slice(5)).split('-').map(Number);
    let dt = new Date(today.getFullYear(), mo - 1, d);
    if (dt < today) dt = new Date(today.getFullYear() + 1, mo - 1, d);
    return { id: i.id, t: m.t, mo, d, diff: Math.round((dt - today) / 864e5) };
  }).sort((a, b) => a.diff - b.diff);
}
function dayHash() { const d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); }

async function viewHome() {
  setChrome('home');
  const last = hist.find(h => doc(h.id) && (pos[h.id] ?? 0) < 96);
  const feasts = feastList().slice(0, 10);
  const recent = Object.entries(IDX.docs).filter(([k]) => !k.startsWith('pg-')).sort((a, b) => b[1].d.localeCompare(a[1].d)).slice(0, 6);
  view.innerHTML = `<div class="wrap fade-in">
    <section class="hero">
      <div class="eyebrow">Institute of the Incarnate Word</div>
      <h1>Our Charism</h1>
      <blockquote>We want to love and serve Jesus Christ – His Body and His Spirit – and to help others love and serve Him.<cite><a href="sources/constitutions-official-en.pdf#page=17" target="_blank" rel="noopener" style="color:inherit">CONSTITUTIONS, N. 7 ↗</a></cite></blockquote>
      <div class="hero-actions"><button class="searchfake" id="heroSearch">${icon('search')}<span>Search in ${Object.keys(IDX.docs).length} entries…</span></button></div>
    </section>
    ${last ? `<a class="card continue" href="#/p/${last.id}"><div class="ring" style="--p:${Math.round(pos[last.id] || 0)}"><span>${Math.round(pos[last.id] || 0)}%</span></div><div><small>Continue reading</small><b>${esc(doc(last.id).t)}</b><small>${esc(doc(last.id).p.join(' · '))}</small></div></a>` : ''}
    <div class="h2"><h2>Reading of the day</h2><a href="#" id="rndBtn">Another reading ↻</a></div>
    <div id="daily"><div class="card randomcard"><div class="eyebrow">Loading…</div></div></div>
    ${feasts.length ? `<div class="h2"><h2>Upcoming feasts</h2><a href="#/s/${secIndexByName('Liturgy')}">Liturgy →</a></div>
    <div class="hscroll">${feasts.map(f => `<a class="card feast${f.diff === 0 ? ' today' : ''}" href="#/p/${f.id}"><div class="date"><b>${f.d}</b><span>${MSHORT[f.mo - 1]}</span></div><div class="nm">${esc(f.t)}</div><div class="tag">${f.diff === 0 ? 'Today' : f.diff === 1 ? 'Tomorrow' : 'In ' + f.diff + ' days'}</div></a>`).join('')}</div>` : ''}
    <div class="h2"><h2>Sections</h2></div>
    <div class="secgrid">${IDX.sections.map((s, i) => `<a class="card sec" href="#/s/${i}"><span class="ic">${icon(s.i)}</span><em>${s.n}</em><b>${esc(s.t)}</b><small>${esc(s.s)}</small></a>`).join('')}
    </div>
    <div class="h2"><h2>Latest entries</h2><a href="#/recientes">View all →</a></div>
    <div class="card"><div class="list" style="padding:0 14px">${recent.map(([k]) => itemRow(k, { where: true })).join('')}</div></div>
  </div>`;
  $('#heroSearch').onclick = () => location.hash = '#/buscar';
  const pool = ORDER.filter(id => { const m = doc(id); return m && m.w > 300 && ['Writings', 'Homilies', 'Founder', 'The Founder', 'Non-negotiables', 'Circular letters', 'Conferences', 'St. John of the Cross'].includes(m.p[0]); });
  let seed = dayHash();
  const showDaily = async (rand) => {
    const box = $('#daily'); if (!box) return;
    for (let tries = 0; tries < 6; tries++) {
      const id = pool[rand ? Math.floor(Math.random() * pool.length) : (seed * 7919 + tries * 104729) % pool.length];
      try {
        const h = await getContent(id);
        const d = document.createElement('div'); d.innerHTML = h; d.querySelectorAll('.edition-note').forEach(n => n.remove());
        const ps = $$('p', d).map(p => { $$('a[href^="#_ftn"],sup', p).forEach(x => x.remove()); return p.textContent.trim(); }).filter(t => t.length > 180 && t.length < 620 && !/^(Queridos|Muy queridos|Estimados)/.test(t));
        if (!ps.length) continue;
        const t = ps[(rand ? Math.floor(Math.random() * ps.length) : seed % ps.length)];
        const m = doc(id);
        box.innerHTML = `<a class="card randomcard fade-in" href="#/p/${id}?q=${encodeURIComponent('"' + t.slice(0, 60).replace(/["“”].*$/, '') + '"')}"><div class="eyebrow">${esc(m.p[0])}</div><p class="q">${esc(t)}</p><div class="src"><b>${esc(m.t)}</b> · ${fmtDate(m.d)}</div></a>`;
        return;
      } catch { /* offline & not cached: try another */ }
    }
    box.innerHTML = `<div class="card randomcard"><p class="muted">Readings will appear here after they are downloaded.</p></div>`;
  };
  showDaily(false);
  $('#rndBtn').onclick = e => { e.preventDefault(); showDaily(true); };
}

function viewSections() {
  setChrome('secciones');
  view.innerHTML = `<div class="wrap fade-in"><div class="sechead"><div><div class="eyebrow">Index</div><h1 class="title">Sections</h1><p class="lede">The English library: reading texts and linked resources, with Circular Letters grouped by year.</p></div></div>
    <div class="secgrid">${IDX.sections.map((s, i) => `<a class="card sec" href="#/s/${i}"><span class="ic">${icon(s.i)}</span><em>${s.n}</em><b>${esc(s.t)}</b><small>${esc(s.s)}</small></a>`).join('')}
    <a class="card sec" href="#/recientes"><span class="ic">${icon('refresh')}</span><b>Recent</b><small>All articles by publication date</small></a></div></div>`;
}

function countIn(items) { let n = 0; items.forEach(i => { if (i.g) n += countIn(i.g); else if (i.id != null || i.ext || i.pending) n++; }); return n; }
function viewSection(si, sort) {
  const s = IDX.sections[si]; if (!s) return viewNotFound();
  setChrome('s' + si, true);
  const openAll = s.items.filter(i => i.g).length <= 3;
  const renderItems = (items, depth) => {
    let html = '', run = [], n = 0;
    const flush = () => { if (run.length) { html += `<div class="list"${depth ? '' : ' style="padding:0 14px"'}>${run.join('')}</div>`; run = []; } };
    items.forEach(it => {
      if (it.g) { flush(); html += `<details class="card group"${openAll || depth ? ' open' : ''}><summary>${icon('chev')}<b>${esc(it.t)}</b><em>${countIn(it.g)}</em></summary>${renderItems(it.g, depth + 1)}</details>`; }
      else if (it.pending) run.push(pendingRow(it));
      else if (it.ext) run.push(extRow(it));
      else if (it.id != null) run.push(itemRow(it.id, { t: it.t, x: false }));
    });
    flush();
    return html;
  };
  let body;
  if (sort === 'fecha') {
    const rows = []; const w = items => items.forEach(i => { if (i.g) w(i.g); else rows.push(i); }); w(s.items);
    rows.sort((a, b) => (b.id != null ? doc(b.id).d : b.d || '').localeCompare(a.id != null ? doc(a.id).d : a.d || ''));
    body = `<div class="card"><div class="list" style="padding:0 14px">${rows.map(i => i.pending ? pendingRow(i) : i.ext ? extRow(i) : itemRow(i.id, { where: true })).join('')}</div></div>`;
  } else {
    const plain = s.items.every(i => !i.g);
    body = plain ? `<div class="card">${renderItems(s.items, 0)}</div>` : renderItems(s.items, 0);
  }
  view.innerHTML = `<div class="wrap fade-in">
    <div class="sechead"><span class="ic">${icon(s.i)}</span><div><div class="eyebrow">${s.n} catalogue entries · ${s.english_entries ?? s.n} in English</div><h1 class="title">${esc(s.t)}</h1><p class="lede">${esc(s.s)}</p><p class="catalogue-note">The tree follows the Spanish app. Entries awaiting English text are marked below.</p></div></div>
    <div class="toolbar"><a class="chip${sort !== 'fecha' ? ' on' : ''}" href="#/s/${si}">Source order</a><a class="chip${sort === 'fecha' ? ' on' : ''}" href="#/s/${si}?orden=fecha">Most recent</a><span class="sp"></span><a class="chip" href="#/buscar?sec=${si}">${icon('search')} Search this section</a></div>
    ${body}</div>`;
}

function viewRecent() {
  setChrome('secciones', true);
  const ids = Object.keys(IDX.docs).filter(k => !k.startsWith('pg-')).sort((a, b) => doc(b).d.localeCompare(doc(a).d));
  let html = '', curY = '';
  const chunks = [];
  ids.forEach(id => { const y = doc(id).d.slice(0, 4); if (y !== curY) { chunks.push({ y, ids: [] }); curY = y; } chunks[chunks.length - 1].ids.push(id); });
  html = chunks.map(c => `<details class="card group"${c === chunks[0] ? ' open' : ''}><summary>${icon('chev')}<b>${c.y}</b><em>${c.ids.length}</em></summary><div class="list">${c.ids.map(id => itemRow(id, { where: true, x: false })).join('')}</div></details>`).join('');
  view.innerHTML = `<div class="wrap fade-in"><div class="sechead"><span class="ic">${icon('refresh')}</span><div><div class="eyebrow">${ids.length} entries</div><h1 class="title">By date</h1><p class="lede">Articles ordered by their source publication date.</p></div></div>${html}</div>`;
}

// ---------- reader
let readerCleanup = null;
async function viewReader(id, params) {
  id = String(id);
  const m = doc(id); if (!m) return viewNotFound();
  setChrome('reader', true);
  const sib = SIBS[id];
  const si = sib ? sib.sec : secIndexByName(m.p[0]);
  view.innerHTML = `<article class="reader fade-in"><div class="crumbs">${m.p.map((p, i) => i === 0 && si >= 0 ? `<a href="#/s/${si}">${esc(p)}</a>` : `<span>${esc(p)}</span>`).join('<i>/</i>')}</div>
    <h1>${esc(m.t)}</h1>
    <div class="rmeta">${m.d && !id.startsWith('pg-') ? `<span>${fmtDate(m.d)}</span>` : ''}${m.w > 40 && hasReadingText(m) ? `<span>${mins(m.w)} reading</span>` : ''}${badges(m)}${['user-supplied-working-translation','app-working-translation'].includes(m.source_type) ? '<span>Working English translation</span>' : ''}${m.editorial_status === 'awaiting-owner-review' ? '<span>Awaiting editorial review</span>' : ''}${m.u ? `<a href="${esc(m.u)}" target="_blank" rel="noopener">${['user-supplied-working-translation','app-working-translation'].includes(m.source_type) ? 'Spanish original ↗' : 'English source ↗'}</a>` : `<span>Official English edition · pp. ${(m.source_pages || []).join('–')}</span>`}</div>
    <div class="ractions">
      <button class="iconbtn${favs.includes(id) ? ' on' : ''}" id="favBtn" aria-label="Save">${icon('bookmark')}</button>
      <button class="iconbtn" id="aaBtn" aria-label="Text size">${icon('aa')}</button>
      <button class="iconbtn" id="shareBtn" aria-label="Share">${icon('share')}</button>
    </div>
    <div class="prose" id="prose"><p class="muted">Loading…</p></div>
    <div class="finis">✠</div>
    ${m.g ? `<div class="tags">${m.g.map(t => `<a class="chip" href="#/tema/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
    <nav class="endnav" id="endnav"></nav></article>`;
  // history
  hist = [{ id, at: Date.now() }].concat(hist.filter(h => h.id !== id)).slice(0, 80); store.set('hist:en', hist);
  $('#favBtn').onclick = e => { const on = !favs.includes(id); favs = on ? [id, ...favs] : favs.filter(x => x !== id); store.set('favs', favs); e.currentTarget.classList.toggle('on', on); toast(on ? 'Saved to your list' : 'Removed from saved'); renderSidebar('reader'); };
  $('#aaBtn').onclick = openAppearance;
  $('#shareBtn').onclick = async () => {
    const data = { title: m.t, text: m.t + ' — Our Charism', url: m.u || (location.origin + location.pathname + '#/p/' + id) };
    if (navigator.share) { try { await navigator.share(data); } catch {} }
    else { try { await navigator.clipboard.writeText(data.url); toast('Link copied'); } catch { toast(data.url); } }
  };
  // prev / next
  if (sib) {
    const i = sib.list.indexOf(id), pv = sib.list[i - 1], nx = sib.list[i + 1];
    $('#endnav').innerHTML = (pv ? `<a class="card prev" href="#/p/${pv}"><small>← Previous</small><b>${esc(doc(pv).t)}</b></a>` : '') + (nx ? `<a class="card next" href="#/p/${nx}"><small>Next →</small><b>${esc(doc(nx).t)}</b></a>` : '');
  }
  const prose = $('#prose');
  try {
    prose.innerHTML = await getContent(id);
  } catch (e) {
    prose.innerHTML = `<div class="empty">This reading has not been downloaded and you are offline.<br><br><a class="button ghost" href="${esc(m.u)}" target="_blank" rel="noopener">Open source website</a></div>`;
    return;
  }
  if (location.hash.split('?')[0] !== '#/p/' + id) return;
  enhanceProse(prose);
  // search highlights
  const q = params.get('q');
  let restored = false;
  if (q) { const n = highlight(prose, parseNeedles(q)); if (n) restored = true; }
  const saved = pos[id];
  if (!restored && saved > 2 && saved < 98) {
    requestAnimationFrame(() => {
      const h = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, h * saved / 100);
      toast(`Resumed at ${Math.round(saved)}%`, 'Go to start', () => scrollTo({ top: 0, behavior: 'smooth' }));
    });
  } else if (!restored) scrollTo(0, 0);
  // progress tracking
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const art = $('.reader'); if (!art) return;
      const h = document.documentElement.scrollHeight - innerHeight;
      const p = h > 0 ? Math.min(100, Math.max(0, scrollY / h * 100)) : 100;
      $('#progress').style.width = p + '%';
      pos[id] = Math.round(p * 10) / 10;
      clearTimeout(onScroll._t); onScroll._t = setTimeout(() => store.set('pos:en', pos), 400);
      const y = scrollY; document.body.classList.toggle('showbars', y < (onScroll._y || 0) || p > 98); onScroll._y = y;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  if (pos[id] == null) { pos[id] = 0; store.set('pos:en', pos); }
  readerCleanup = () => removeEventListener('scroll', onScroll);
}

function enhanceProse(prose) {
  // YouTube cards
  $$('.m-yt', prose).forEach(el => {
    const yt = el.dataset.yt;
    el.style.backgroundImage = `url(https://i.ytimg.com/vi/${yt}/hqdefault.jpg)`;
    el.innerHTML = `<span class="play"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg></span><span class="lbl">Watch video${navigator.onLine ? '' : ' (requires connection)'}</span>`;
    el.onclick = () => { el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Video"></iframe>`; el.onclick = null; };
  });
  $$('audio,video', prose).forEach(a => a.addEventListener('error', () => { if (!navigator.onLine && !a.nextElementSibling) a.insertAdjacentHTML('afterend', '<div class="offline-note">Audio and video require an internet connection.</div>'); }, true));
  // footnotes
  prose.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const h = decodeURIComponent(a.getAttribute('href').slice(1)); if (!h || h.startsWith('/')) return;
    e.preventDefault();
    const t = prose.querySelector(`[name="${CSS.escape(h)}"],[id="${CSS.escape(h)}"]`);
    if (!t) return;
    const isNote = /ftn\d/i.test(h) && !/ftnref/i.test(h) || /^_?edn\d/i.test(h);
    if (isNote) {
      const block = t.closest('p,li,div') || t.parentElement;
      const c = block.cloneNode(true);
      $$('a[href^="#_ftnref"],a[href^="#_ednref"]', c).forEach(x => x.remove());
      const num = (a.textContent.match(/\d+/) || [''])[0];
      sheet(`<div class="fnref">Note ${esc(num)}</div><div class="fntext">${c.innerHTML}</div>`, (b, close) => {
        $$('a[href^="#"]', b).forEach(x => x.onclick = ev => { ev.preventDefault(); close(); });
      });
    } else {
      t.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

function highlight(root, needles) {
  if (!needles.length) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  let count = 0;
  nodes.forEach(node => {
    const s = node.nodeValue; if (!s.trim()) return;
    const f = fold(s); const h = [];
    needles.forEach(n => { let i = 0; while ((i = f.indexOf(n, i)) !== -1) { h.push([i, i + n.length]); i += n.length; } });
    if (!h.length) return;
    h.sort((a, b) => a[0] - b[0]);
    const frag = document.createDocumentFragment(); let last = 0;
    h.forEach(([a, b]) => { if (a < last) return; frag.append(s.slice(last, a)); const mk = document.createElement('mark'); mk.className = 'hit'; mk.textContent = s.slice(a, b); frag.append(mk); last = b; count++; });
    frag.append(s.slice(last)); node.replaceWith(frag);
  });
  const marks = $$('mark.hit', root);
  if (!marks.length) return 0;
  let cur = 0;
  const bar = document.createElement('div'); bar.className = 'hitbar';
  const go = i => { marks[cur]?.classList.remove('cur'); cur = (i + marks.length) % marks.length; marks[cur].classList.add('cur'); marks[cur].scrollIntoView({ behavior: 'smooth', block: 'center' }); bar.querySelector('span').textContent = `${cur + 1} of ${marks.length}`; };
  bar.innerHTML = `<span></span><button class="iconbtn" aria-label="Anterior">${icon('up')}</button><button class="iconbtn" aria-label="Siguiente">${icon('down')}</button><button class="iconbtn" aria-label="Cerrar">${icon('x')}</button>`;
  const [bp, bn, bx] = $$('button', bar);
  bp.onclick = () => go(cur - 1); bn.onclick = () => go(cur + 1);
  bx.onclick = () => { bar.remove(); marks.forEach(mk => mk.replaceWith(mk.textContent)); };
  view.append(bar);
  setTimeout(() => go(0), 80);
  return marks.length;
}

// ---------- search
let lastSearch = { q: '', sec: '', titles: false };
function viewSearch(params) {
  setChrome('buscar');
  const q0 = params.get('q') ?? lastSearch.q;
  let sec = params.has('sec') ? params.get('sec') : lastSearch.sec;
  let titles = lastSearch.titles;
  view.innerHTML = `<div class="wrap fade-in">
    <div class="searchbox"><label class="sfield">${icon('search')}<input id="q" type="search" placeholder="Search English entries…" autocomplete="off" enterkeyhint="search" value="${esc(q0)}"></label>
      <div class="filters" id="filters"></div></div>
    <div id="sinfo" class="sinfo"></div><div id="results"></div></div>`;
  const input = $('#q');
  const filters = $('#filters');
  const drawFilters = () => {
    filters.innerHTML = `<button class="chip${sec === '' ? ' on' : ''}" data-s="">All</button>` + IDX.sections.map((s, i) => `<button class="chip${String(i) === String(sec) ? ' on' : ''}" data-s="${i}">${esc(s.t)}</button>`).join('') + `<button class="chip${titles ? ' on' : ''}" data-t="1">Titles only</button>`;
  };
  drawFilters();
  filters.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) titles = !titles; else sec = b.dataset.s;
    drawFilters(); go();
  };
  let tmr;
  const go = async () => {
    const q = input.value.trim();
    lastSearch = { q, sec, titles };
    history.replaceState(null, '', '#/buscar' + (q ? '?q=' + encodeURIComponent(q) : '') + (sec !== '' ? (q ? '&' : '?') + 'sec=' + sec : ''));
    const info = $('#sinfo'), out = $('#results');
    if (q.length < 2) {
      info.textContent = '';
      out.innerHTML = `<div class="tips"><p>Search words or phrases across ${Object.keys(IDX.docs).length} entries — regardless of accents or case.</p>
      <p>• <code>"religious life"</code> finds the exact phrase<br>• <code>incarnation culture</code> encuentra articles con ambas palabras<br>• <code>-joy</code> excludes a word</p>
      ${hist.length ? `<div class="h2"><h2>Recently read</h2></div><div class="card"><div class="list" style="padding:0 14px">${hist.slice(0, 5).filter(h => doc(h.id)).map(h => itemRow(h.id, { where: true, x: false })).join('')}</div></div>` : ''}</div>`;
      return;
    }
    info.textContent = 'Searching…';
    const r = await runSearch(q, titles);
    if (input.value.trim() !== q) return;
    let res = r.results;
    if (sec !== '') res = res.filter(x => doc(x.id).p.includes(IDX.sections[Number(sec)]?.t));
    const tot = sec !== '' ? res.length : r.total;
    info.textContent = tot ? `${tot} ${tot === 1 ? 'entry' : 'entries'}${tot > res.length ? ` (showing ${res.length})` : ''} · ${r.ms} ms` : '';
    out.innerHTML = res.length ? `<div class="card res"><div class="list" style="padding:0 14px">${res.map(x => itemRow(x.id, { q, where: true, titleHtml: markText(doc(x.id).t, r.needles), xHtml: applyMarks(x.s, x.h) })).join('')}</div></div>` : `<div class="empty">No results for «${esc(q)}».</div>`;
  };
  input.oninput = () => { clearTimeout(tmr); tmr = setTimeout(go, 220); };
  input.onkeydown = e => { if (e.key === 'Enter') { clearTimeout(tmr); go(); input.blur(); } };
  go();
  if (!q0) setTimeout(() => input.focus(), 50);
}

// ---------- saved
function viewSaved(params) {
  setChrome('guardados');
  const tab = params.get('t') || 'fav';
  const ids = tab === 'fav' ? favs.filter(doc) : hist.map(h => h.id).filter(doc);
  view.innerHTML = `<div class="wrap fade-in"><div class="sechead"><span class="ic">${icon('bookmark')}</span><div><div class="eyebrow">Your library</div><h1 class="title">Saved</h1></div></div>
    <div class="toolbar"><a class="chip${tab === 'fav' ? ' on' : ''}" href="#/guardados">Favorites (${favs.length})</a><a class="chip${tab === 'hist' ? ' on' : ''}" href="#/guardados?t=hist">History (${hist.length})</a><span class="sp"></span>${tab === 'hist' && hist.length ? '<button class="chip" id="clr">Clear history</button>' : ''}</div>
    ${ids.length ? `<div class="card"><div class="list" style="padding:0 14px">${ids.map(id => itemRow(id, { where: true, x: false })).join('')}</div></div>` : `<div class="empty">${tab === 'fav' ? 'Tap the bookmark on any article to save it here.' : 'You have not read any articles yet.'}</div>`}</div>`;
  const c = $('#clr'); if (c) c.onclick = () => { hist = []; pos = {}; store.set('hist:en', hist); store.set('pos:en', pos); viewSaved(params); };
}

// ---------- topics
function viewTopics() {
  setChrome('temas', true);
  const tags = Object.entries(IDX.tags);
  const groups = {};
  tags.forEach(([t, ids]) => { const L = fold(t)[0].toUpperCase(); (groups[L] = groups[L] || []).push([t, ids.length]); });
  const letters = Object.keys(groups).sort();
  view.innerHTML = `<div class="wrap fade-in"><div class="sechead"><span class="ic">${icon('tag')}</span><div><div class="eyebrow">${tags.length} topics</div><h1 class="title">Topics</h1><p class="lede">Topics will become available in a later English batch.</p></div></div>
    <div class="letters">${letters.map(l => `<a href="#L-${l}" data-l="${l}">${l}</a>`).join('')}</div>
    ${letters.map(l => `<div class="lt" id="L-${l}">${l}</div><div class="tagcloud">${groups[l].map(([t, n]) => `<a class="chip" href="#/tema/${encodeURIComponent(t)}">${esc(t)} <em>${n}</em></a>`).join('')}</div>`).join('')}</div>`;
  $$('.letters a').forEach(a => a.onclick = e => { e.preventDefault(); $('#L-' + a.dataset.l).scrollIntoView({ behavior: 'smooth' }); });
}
function viewTheme(t) {
  setChrome('temas', true);
  const ids = (IDX.tags[t] || []).slice().sort((a, b) => doc(b).d.localeCompare(doc(a).d));
  view.innerHTML = `<div class="wrap fade-in"><div class="sechead"><span class="ic">${icon('tag')}</span><div><div class="eyebrow"><a href="#/temas" style="text-decoration:none">Topics</a></div><h1 class="title">${esc(t)}</h1><p class="lede">${ids.length} ${ids.length === 1 ? 'entry' : 'entries'}</p></div></div>
  <div class="card"><div class="list" style="padding:0 14px">${ids.map(id => itemRow(id, { where: true })).join('')}</div></div></div>`;
}

// ---------- timeline
function viewTimeline() {
  setChrome('timeline', true);
  let y = '';
  const html = IDX.timeline.map(e => { const yr = e.y !== y ? `<div class="tl-year">${esc(e.y)}</div>` : ''; y = e.y; return yr + `<div class="card tl-ev"><small>${esc(e.d)}</small><b>${esc(e.t)}</b>${e.b ? `<p>${esc(e.b)}</p>` : ''}</div>`; }).join('');
  view.innerHTML = `<div class="wrap fade-in" style="max-width:44rem"><div class="sechead"><span class="ic">${icon('timeline')}</span><div><div class="eyebrow">${IDX.timeline.length} acontecimientos</div><h1 class="title">Línea de tiempo del IVE</h1><p class="lede">Desde la gracia fundacional en 1981 hasta hoy.</p></div></div><div class="timeline">${html}</div></div>`;
}

// ---------- appearance
function openAppearance() {
  const seg = (k, opts) => `<div class="seg" data-k="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(S[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  sheet(`<h3>Appearance</h3>
    <div class="row"><div class="lbl"><b>Theme</b></div>${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['sepia', 'Sepia'], ['dark', 'Dark']])}</div>
    <div class="row"><div class="lbl"><b>Typeface</b></div>${seg('font', [['serif', 'Serif'], ['sans', 'Sans']])}</div>
    <div class="row"><div class="lbl"><b>Size</b><small id="fsv">${S.fs}px</small></div><div class="range"><span style="font-size:13px">A</span><input type="range" min="15" max="27" step="1" value="${S.fs}" id="fs"><span style="font-size:20px">A</span></div></div>
    <div class="row"><div class="lbl"><b>Line spacing</b></div>${seg('lh', [[1.5, 'Compact'], [1.68, 'Normal'], [1.9, 'Spacious']])}</div>`, b => {
    $$('.seg', b).forEach(sg => sg.onclick = e => { const bt = e.target.closest('button'); if (!bt) return; const k = sg.dataset.k; S[k] = k === 'lh' ? Number(bt.dataset.v) : bt.dataset.v; saveS(); applySettings(); $$('button', sg).forEach(x => x.classList.toggle('on', x === bt)); });
    $('#fs', b).oninput = e => { S.fs = Number(e.target.value); $('#fsv', b).textContent = S.fs + 'px'; saveS(); applySettings(); };
  });
}
$('#themeBtn').onclick = openAppearance;
$('#topSearch').onclick = () => location.hash = '#/buscar';
$('#backBtn').onclick = () => { if (history.length > 1 && document.referrer !== undefined && navState.depth > 0) history.back(); else location.hash = '#/'; };

// ---------- offline + settings
async function cacheStatus() {
  if (!('caches' in window)) return { have: 0, total: Object.keys(IDX.docs).length };
  const c = await caches.open('nc-draft-data-' + IDX.v);
  const keys = await c.keys();
  const have = keys.filter(k => k.url.includes('/data/c/')).length;
  return { have, total: Object.keys(IDX.docs).length, search: keys.some(k => k.url.endsWith('/data/search.json')) };
}
let dlRunning = null;
function downloadAll(onProgress) {
  if (dlRunning) { dlRunning.listeners.push(onProgress); return dlRunning.p; }
  const listeners = [onProgress].filter(Boolean);
  const p = (async () => {
    const c = await caches.open('nc-draft-data-' + IDX.v);
    const keys = new Set((await c.keys()).filter(k => k.url.includes('/data/')).map(k => new URL(k.url).pathname.split('/').pop()));
    const ids = Object.keys(IDX.docs);
    const urls = ids.filter(id => !keys.has(id + '.html')).map(id => `data/c/${id}.html`);
    if (!keys.has('search.json')) urls.unshift('data/search.json');
    let done = ids.length - urls.length + (keys.has('search.json') ? 0 : 1) - 1, total = ids.length;
    done = Math.max(0, total - urls.filter(u => u.includes('/c/')).length);
    const tick = () => { listeners.forEach(f => f && f(done, total)); dispatchEvent(new CustomEvent('ncdl', { detail: { done, total } })); };
    tick();
    let i = 0, failed = 0;
    const workerFn = async () => {
      while (i < urls.length) {
        const u = urls[i++];
        try { const r = await fetch(u); if (r.ok) { await c.put(u, r.clone()); if (u.includes('/c/')) done++; } else failed++; }
        catch { failed++; }
        tick();
      }
    };
    await Promise.all([1, 2, 3, 4, 5, 6].map(workerFn));
    dlRunning = null;
    return { done, total, failed };
  })();
  dlRunning = { p, listeners };
  return p;
}

async function viewSettings() {
  setChrome('ajustes');
  const st = await cacheStatus();
  const pct = Math.round(st.have / st.total * 100);
  view.innerHTML = `<div class="wrap fade-in" style="max-width:44rem"><div class="sechead"><span class="ic">${icon('gear')}</span><div><div class="eyebrow">Preferences</div><h1 class="title">Settings</h1></div></div>
    <div class="h2"><h2>Reading</h2></div>
    <div class="card set"><div class="row"><div class="lbl"><b>Appearance</b><small>Theme, typeface and text size</small></div><button class="button ghost" id="appBtn">${icon('aa')} Adjust</button></div></div>
    <div class="h2"><h2>Offline</h2></div>
    <div class="card set">
      <div class="row"><div class="lbl"><b>Articles saved on this device</b><small id="dlTxt">${st.have} of ${st.total} (${pct}%)${st.search ? ' · search ready' : ''}</small><div class="bar"><i id="dlBar" style="width:${pct}%"></i></div></div></div>
      <div class="row"><div class="lbl"><b>Download library</b><small>Download the English articles for offline reading. The official English Constitutions PDF is included with the app. Other external media needs a connection.</small></div><button class="button" id="dlBtn"${pct >= 100 ? ' disabled style="opacity:.5"' : ''}>${icon('cloud')} ${pct >= 100 ? 'Ready' : 'Download'}</button></div>
      <div class="row"><div class="lbl"><b>Automatic download</b><small>Save the library in the background when opening the app</small></div><div class="seg" id="autoSeg"><button data-v="1" class="${S.autoDl ? 'on' : ''}">Yes</button><button data-v="0" class="${!S.autoDl ? 'on' : ''}">No</button></div></div>
    </div>
    <div class="h2"><h2>Updates</h2></div>
    <div class="card set">
      <div class="row"><div class="lbl"><b>Content</b><small>Library updated: ${fmtDate(IDX.fetched)} · version ${esc(IDX.v)}</small></div><button class="button ghost" id="updBtn">${icon('refresh')} Search</button></div>
      <div class="row"><div class="lbl"><b>Source website updates</b><small id="newsTxt">Check for later English-source posts</small></div><button class="button ghost" id="newsBtn">Check</button></div>
      <div id="newsList"></div>
    </div>
    <div class="h2"><h2>Install</h2></div>
    <div class="card set"><div class="row"><div class="lbl"><b>Add to Home Screen</b><small>iPhone/iPad: Safari → Share → Add to Home Screen. Android/Chrome: menu → Install app.</small></div>${deferredInstall ? '<button class="button" id="instBtn">Install</button>' : ''}</div></div>
    <div class="h2"><h2>About</h2></div><p><a class="button ghost" href="sources/constitutions-official-en.pdf" target="_blank" rel="noopener">Official English Constitutions ↗</a></p>
    <div class="card set"><div class="row"><div class="lbl"><small style="font-size:14px;line-height:1.6;display:block;font-family:var(--serif)">This library includes the official English Circular Letters and Constitutions supplied for this app, working translations supplied by the owner, and articles from <a href="${SITE}" target="_blank" rel="noopener">ourcharism.org</a>. Working translations are not official editions and remain subject to review. Linked external media may be in Spanish.</small></div></div>
    <div class="row"><div class="lbl"><b>Reset</b><small>Clear reading history, positions and shared favorites</small></div><button class="button ghost" id="rstBtn">Reset</button></div></div>
  </div>`;
  $('#appBtn').onclick = openAppearance;
  $('#autoSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.autoDl = b.dataset.v === '1'; saveS(); $$('#autoSeg button').forEach(x => x.classList.toggle('on', x === b)); if (S.autoDl) downloadAll(); };
  const prog = (d, t) => { const b = $('#dlBar'), tx = $('#dlTxt'); if (b) b.style.width = Math.round(d / t * 100) + '%'; if (tx) tx.textContent = `${d} of ${t} (${Math.round(d / t * 100)}%)`; };
  $('#dlBtn').onclick = async () => {
    if (!navigator.onLine) return toast('Connect to the internet to download');
    $('#dlBtn').disabled = true;
    const r = await downloadAll();
    toast(r.failed ? `Downloaded ${r.done} of ${r.total}. Some downloads failed; please retry.` : 'The library is ready for offline reading');
    if (location.hash === '#/ajustes') viewSettings();
  };
  $('#updBtn').onclick = async () => {
    if (!swReg) return toast('Updates are unavailable in this browser');
    toast('Searching…');
    try { await swReg.update(); } catch {}
    setTimeout(() => { if (!swReg.waiting && !swReg.installing) toast('You have the latest draft'); }, 2500);
  };
  $('#newsBtn').onclick = checkNews;
  const ib = $('#instBtn'); if (ib) ib.onclick = async () => { deferredInstall.prompt(); deferredInstall = null; };
  $('#rstBtn').onclick = () => { if (!confirm('Clear history, reading positions and shared favorites?')) return; favs = []; hist = []; pos = {}; ['favs', 'hist:en', 'pos:en'].forEach(k => store.set(k, [])); store.set('pos:en', {}); toast('Reset complete'); };
}
async function checkNews() {
  const tx = $('#newsTxt'), list = $('#newsList');
  tx.textContent = 'Checking ourcharism.org…';
  try {
    const after = IDX.fetched + 'T00:00:00';
    const r = await fetch(`${SITE}/wp-json/wp/v2/posts?per_page=20&after=${after}&_fields=id,date,title,link`, { mode: 'cors' });
    const j = await r.json();
    const fresh = j.filter(p => !IDX.docs[String(p.id)]);
    tx.textContent = fresh.length ? `${fresh.length} ${fresh.length === 1 ? 'new post' : 'new posts'} — available on the source website:` : 'No later posts found.';
    list.innerHTML = fresh.length ? `<div class="list">${fresh.map(p => `<a class="item" href="${esc(p.link)}" target="_blank" rel="noopener"><div class="body"><div class="it-t">${p.title.rendered}</div><div class="it-m">${fmtDate(p.date.slice(0, 10))}</div></div><span class="chev">${icon('ext')}</span></a>`).join('')}</div>` : '';
  } catch {
    tx.textContent = 'Could not check the source website. Check your connection.';
  }
}

function viewNotFound() { setChrome('', true); view.innerHTML = `<div class="empty">This document is not included in the first English batch.<br><br><a class="button" href="#/">Back to English home</a><br><br><a class="button ghost" href="https://vcfe1984.github.io/nuestro_carisma/${location.hash}" target="_blank" rel="noopener">Open Spanish app</a></div>`; }

// ------------------------------------------------------------------ router
const navState = { depth: 0 };
async function route() {
  if (readerCleanup) { readerCleanup(); readerCleanup = null; }
  $$('.hitbar').forEach(b => b.remove());
  $('#sheet').hidden = true;
  const h = location.hash || '#/';
  if (h.startsWith('#L-') || h.startsWith('#_')) return;
  const [path, qs] = h.slice(1).split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b] = parts;
  if (a !== 'p') scrollTo(0, 0);
  if (!a) return viewHome();
  if (a === 'p') return viewReader(b, params);
  if (a === 's') return viewSection(Number(b), params.get('orden'));
  if (a === 'secciones') return viewSections();
  if (a === 'recientes') return viewRecent();
  if (a === 'buscar') return viewSearch(params);
  if (a === 'guardados') return viewSaved(params);
  if (a === 'temas') return viewTopics();
  if (a === 'tema') return viewTheme(b);
  if (a === 'ajustes') return viewSettings();
  viewNotFound();
}
addEventListener('hashchange', () => { navState.depth++; route(); });
addEventListener('ncdl', e => {
  const { done, total } = e.detail, b = $('#dlBar'), tx = $('#dlTxt');
  if (b) b.style.width = Math.round(done / total * 100) + '%';
  if (tx) tx.textContent = `${done} of ${total} (${Math.round(done / total * 100)}%)`;
});
addEventListener('keydown', e => {
  if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); location.hash = '#/buscar'; }
});

// ------------------------------------------------------------------ service worker
let swReg = null, deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function setupSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    swReg = reg;
    const notify = w => toast('An updated draft is available', 'Update', () => w.postMessage('skipWaiting'), 30000);
    if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) notify(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 6 * 3600e3);
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

// ------------------------------------------------------------------ boot
(async () => {
  try { await loadIndex(); }
  catch { view.innerHTML = '<div class="empty">Could not load the library. Connect and try again.</div>'; return; }
  route();
  setupSW();
  if (S.autoDl && navigator.onLine && 'caches' in window) {
    setTimeout(async () => {
      const st = await cacheStatus();
      if (st.have < st.total) downloadAll().then(r => { if (r.done >= r.total && st.have < st.total * 0.5) toast('The library is ready for offline reading'); });
    }, 3500);
  }
  // warm the search index in idle time
  (window.requestIdleCallback || setTimeout)(() => getWorker(), { timeout: 6000 });
})();
})();
