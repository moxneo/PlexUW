// M2 Plex browsing UI. Every server-provided string is rendered with textContent
// (§6a M1); this file uses no HTML-parsing sink at all
// (enforced by lint-shim.sh). JS only sends typed values to Rust; images are opaque
// ids rendered through the plexuw protocol (§6a H1/M5).
const WIN = /Windows/.test(navigator.userAgent);
const ORIGIN = WIN ? 'http://plexuw.localhost' : 'plexuw://localhost';
import { pxIcon } from './px-icons.js';
const HEX = /^[0-9a-f]{32}$/;
const ID = /^[0-9a-f]{24}$/; // fu7b: opaque HMAC slot ids (never raw ratingKeys)

export function img(id, w, h) {
  if (!id || !HEX.test(id)) return null;
  const d = Math.min(3, window.devicePixelRatio || 1);
  const q = n => Math.max(16, Math.min(4096, Math.ceil(n * d / 40) * 40));
  return `${ORIGIN}/img/${id}/${q(w)}x${q(h)}`;
}

// Continue Watching chrome. Offset 0 still yields a track and the full runtime left.
export function cwMeter(it) {
  const off = Math.max(0, Number(it && it.viewOffsetMs) || 0);
  const dur = Math.max(0, Number(it && it.durationMs) || 0);
  const pct = dur ? Math.min(100, off / dur * 100) : 0;
  const mins = n => { const m = Math.round((n || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  return { off, dur, width: (off > 0 ? Math.max(pct, 2) : 0).toFixed(1) + '%', left: dur ? mins(Math.max(0, dur - off)) + ' left' : '' };
}

// da Vinci S1: when the library list itself failed to load, say so with the failure
// category's fixed text; "isn't on this server" only when the list loaded without it.
export function missingLibraryText(loadErr, why) {
  if (loadErr === undefined) return 'That library isn’t on this server.';
  return 'Couldn’t load your libraries. ' + (why ? why(loadErr) : 'Something went wrong. Try again.');
}

// da Vinci LOW (a535fd6 review): Home and Details load errors use the same wording as the
// libraries message: "Couldn’t load <what>." plus the fixed failure-category text.
const LOADWHAT = { home: 'Home', item: 'this title', sec: 'this library', search: 'search results', person: 'this person' };
export function loadErrorText(kind, err, why) {
  return 'Couldn’t load ' + (LOADWHAT[kind] || 'this page') + '. ' + (why ? why(err) : 'Something went wrong. Try again.');
}

// fu7e: append-only library grid. Tiles, once mounted, are never removed or re-created
// while scrolling: the grid grows by whole pages of placeholders, and each placeholder is
// swapped in place for its tile when the page arrives. No replaceChildren, no padding
// windows, no remount flash. DOM-light so node can test it with a fake container.
export function appendGrid({ grid, total, pageSize = 100, fetchPage, tile, placeholder, onError }) {
  const tiles = [], pages = new Map(), pending = new Set();
  const g = {
    tiles, pages,
    get total() { return total; },
    // grow to at least n slots (placeholders) without touching existing nodes
    ensure(n) { n = Math.min(total, n); while (tiles.length < n) { const ph = placeholder(tiles.length); tiles.push(ph); grid.appendChild(ph); } },
    // fetch every page overlapping [a, b) once
    want(a, b) { for (let p = Math.floor(Math.max(0, a) / pageSize); p * pageSize < Math.min(total, b); p++) g.load(p).catch(e => onError && onError(e)); },
    load(p) {
      if (pages.has(p) || pending.has(p)) return Promise.resolve();
      pending.add(p);
      return Promise.resolve(fetchPage(p * pageSize)).then(items => { pending.delete(p); if (!items) return; pages.set(p, items); g.fill(p); }, e => { pending.delete(p); throw e; });
    },
    fill(p) {
      const items = pages.get(p) || [];
      items.forEach((it, k) => { const i = p * pageSize + k; const old = tiles[i]; if (!old || !old.isPlaceholder) return; const t = tile(it); old.replaceWith(t); tiles[i] = t; });
    },
  };
  return g;
}

// fu7f: person popover controller (pure; DOM nodes are injected so node tests can fake them).
// Opens over a dimmed backdrop, traps focus, locks background scroll, keeps the page's scroll
// position exactly, and returns focus to the element that opened it. navigate() closes first.
export function modalController({ doc, keyTarget, overlay, dialog, closeBtn, scroller, focusables, setHash, onClose }) {
  let open = false, trigger = null, saved = 0;
  const m = {
    get isOpen() { return open; },
    open(t) {
      if (!open) { trigger = t || doc.activeElement || null; saved = scroller.scrollTop; }
      open = true; overlay.hidden = false; doc.body.classList.add('pxmodal'); scroller.classList.add('pxlock');
      scroller.scrollTop = saved; closeBtn.focus({ preventScroll: true });
    },
    close(restore = true) {
      if (!open) return; open = false; overlay.hidden = true;
      doc.body.classList.remove('pxmodal'); scroller.classList.remove('pxlock'); scroller.scrollTop = saved;
      const t = trigger; trigger = null; if (onClose) onClose();
      if (restore && t && t.focus) t.focus({ preventScroll: true });
    },
    navigate(href) { m.close(false); setHash(href); },
  };
  overlay.addEventListener('mousedown', e => { if (e.target !== overlay) return; e.preventDefault(); m.close(); });
  closeBtn.addEventListener('click', () => m.close());
  dialog.addEventListener('click', e => { const a = e.target && e.target.closest && e.target.closest('a[href^="#px/"]'); if (!a) return; e.preventDefault(); m.navigate(a.getAttribute('href')); });
  keyTarget.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); m.close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); const a = doc.activeElement, i = f.indexOf(a);
    if (!f.length) { e.preventDefault(); return; }
    if (e.shiftKey ? i <= 0 : (i === -1 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
  }, true);
  return m;
}

// fu7f: app-level back/forward. Every history entry gets a small key in history.state;
// the scroll position of each entry is remembered so Back restores where you were.
export function scrollMemory({ scroller, hist, max = 60 }) {
  const mem = new Map(); let cur = null, curI = -1, topI = -1, seq = Date.now() % 1e9;
  return {
    get index() { return curI; },
    // fu7g: Forward only when there is forward history (a new page truncates it, like the browser).
    get canForward() { return curI < topI; },
    save() { if (cur != null) mem.set(cur, scroller.scrollTop); },
    // Call at the start of each route. Returns the saved scroll for this entry (Back/Forward) or null (new entry).
    enter() {
      let st = hist.state;
      if (!st || typeof st.pxk !== 'number') { st = Object.assign({}, st || {}, { pxk: ++seq, pxi: curI + 1 }); hist.replaceState(st, ''); topI = st.pxi; }
      cur = st.pxk; curI = typeof st.pxi === 'number' ? st.pxi : 0; if (curI > topI) topI = curI;
      while (mem.size > max) mem.delete(mem.keys().next().value);
      return mem.has(cur) ? mem.get(cur) : null;
    },
  };
}
// Mouse button 4/5 (DOM buttons 3/4) and Alt+Left/Right → 'back' | 'fwd' | null.
// Strip chevrons: both ends while the row is mid-scroll; the left one hides only at the start
// so it never sits on the first tile (the button lives in the gutter, not over the poster).
export function arrowFlags(scrollLeft, clientWidth, scrollWidth) {
  const max = Math.max(0, scrollWidth - clientWidth);
  return {
    fits: max <= 2,
    atl: scrollLeft <= 2,
    atr: scrollLeft + clientWidth >= scrollWidth - 2,
  };
}
export function navInput(e) {
  if (!e) return null;
  if (e.type === 'keydown') { if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null; return e.key === 'ArrowLeft' ? 'back' : e.key === 'ArrowRight' ? 'fwd' : null; }
  if (e.type === 'mouseup' || e.type === 'mousedown' || e.type === 'auxclick') return e.button === 3 ? 'back' : e.button === 4 ? 'fwd' : null;
  return null;
}
// fu7f: keep the old page on screen while the next one loads (no black flash, no raw text):
// begin() moves the current page into a fixed snapshot layer over the scroller; end() fades it out.
export function pageSwap({ doc, scroller, view, host, fadeMs = 180 }) {
  let ghost = null, t = 0;
  const drop = g => { if (g && g.parentNode) g.parentNode.removeChild(g); };
  return {
    get active() { return !!ghost; },
    begin() {
      if (ghost) { view.textContent = ''; return; } // already showing the old page
      if (!view.firstChild || view.hidden) return;
      const r = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0, left: 0, width: 0, height: 0 };
      const g = doc.createElement('div'); g.className = 'pxghost'; g.setAttribute('aria-hidden', 'true');
      Object.assign(g.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' });
      // Same box as the live view: below the top bar (where the next page starts), same width/padding.
      const vr = view.getBoundingClientRect ? view.getBoundingClientRect() : { top: r.top - scroller.scrollTop, left: r.left, width: r.width };
      const gt = Math.max(r.top, vr.top + scroller.scrollTop); g.style.top = gt + 'px'; g.style.height = Math.max(0, r.top + r.height - gt) + 'px';
      const inner = doc.createElement('div'); inner.className = 'pxghosti'; inner.style.transform = 'translateY(' + (vr.top - gt) + 'px)';
      inner.style.marginLeft = (vr.left - r.left) + 'px'; if (vr.width) inner.style.width = vr.width + 'px';
      const cs = doc.defaultView && doc.defaultView.getComputedStyle ? doc.defaultView.getComputedStyle(view) : null; if (cs) inner.style.padding = cs.padding;
      while (view.firstChild) { const c = view.firstChild; (c.classList && c.classList.contains('pxbackdrop') ? g : inner).appendChild(c); }
      g.appendChild(inner); (host || doc.body).appendChild(g); ghost = g;
      clearTimeout(t); t = setTimeout(() => this.end(), 30000); // safety net; route() normally ends it
    },
    end() {
      clearTimeout(t); const g = ghost; ghost = null; if (!g) return;
      g.classList.add('out'); setTimeout(() => drop(g), fadeMs + 40);
    },
  };
}

export function mountPlexBrowse(invoke, hooks = {}) {
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = String(txt); return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const icon = n => { const v = document.createElementNS(NS, 'svg'); v.setAttribute('class', 'ic'); const u = document.createElementNS(NS, 'use'); u.setAttribute('href', 'assets/icons.svg#' + n); v.appendChild(u); return v; };
  const main = document.getElementById('main'); if (!main) return null;
  const view = el('div', 'pxv'); view.id = 'pxView'; view.hidden = true;
  const top = main.querySelector('.topbar'); top ? top.after(view) : main.prepend(view);
  // fu7f: person popover (role=dialog, aria-modal). Registered before the global key handler
  // so Esc closes the popover first.
  const pmo = el('div', 'pxpm'); pmo.hidden = true;
  const pmd = el('div', 'pxpmd'); pmd.setAttribute('role', 'dialog'); pmd.setAttribute('aria-modal', 'true'); pmd.setAttribute('aria-labelledby', 'pxpmTitle'); pmd.tabIndex = -1; pmo.appendChild(pmd);
  const pmx = el('button', 'pxpmx', '✕'); pmx.type = 'button'; pmx.setAttribute('aria-label', 'Close'); pmd.appendChild(pmx);
  const pmb = el('div', 'pxpmb'); pmd.appendChild(pmb); document.body.appendChild(pmo);
  let pmGen = 0;
  const pm = modalController({ doc: document, keyTarget: window, overlay: pmo, dialog: pmd, closeBtn: pmx, scroller: main,
    focusables: () => [...pmd.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null || x === pmx),
    setHash: h => { location.hash = h; }, onClose: () => { pmGen++; } });
  const nav = el('nav', 'pxnav'); nav.id = 'pxNav'; nav.hidden = true;
  const side = document.getElementById('nav'); if (side) side.before(nav);
  let on = false, sections = [], gen = 0, server = '', onScroll = null, srcGen = 0;
  const sm = scrollMemory({ scroller: main, hist: history }), swap = pageSwap({ doc: document, scroller: main, view, host: main });
  // fu7f: Back/Forward in the top bar, mouse buttons 4/5 and Alt+Left/Right.
  const bk = el('div', 'pxbk'); bk.hidden = true;
  const mkb = (cls, lbl, d) => { const b = el('button', 'pxbkb ' + cls); b.type = 'button'; b.setAttribute('aria-label', lbl); b.title = lbl; b.appendChild(pxIcon('chev')); b.onclick = () => d === 'back' ? history.back() : history.forward(); bk.appendChild(b); return b; };
  const bkb = mkb('back', 'Back (Alt+Left)', 'back'), fwb = mkb('fwd', 'Forward (Alt+Right)', 'fwd');
  if (top) top.prepend(bk);
  const navGo = d => { if (!on || !location.hash.startsWith('#px/')) return false; if (d === 'back') { if (sm.index > 0) history.back(); } else if (sm.canForward) history.forward(); return true; };
  for (const t of ['mousedown', 'auxclick']) addEventListener(t, e => { if (on && navInput(e)) e.preventDefault(); }, true);
  addEventListener('mouseup', e => { const d = navInput(e); if (d && navGo(d)) e.preventDefault(); }, true);
  const go = h => { location.hash = h; };
  const left = it => it.viewOffsetMs && it.durationMs && it.viewOffsetMs < it.durationMs ? ms(it.durationMs - it.viewOffsetMs) + ' left' : '';
  // HTPC-style full-bleed dimmed fanart behind the page (art, else the poster/still).
  function backdrop(it) { const u = img(it.art || it.thumb, 1920, 1080); if (!u) return null; const b = el('div', 'pxbackdrop'); const i = el('img'); i.alt = ''; i.src = u; i.onerror = () => b.remove(); b.appendChild(i); return b; }
  function heroFacts(it, extra) { const f = el('div', 'pxfacts pxhf'); [it.year, it.durationMs ? ms(it.durationMs) : '', it.contentRating, ...(extra || [])].filter(Boolean).forEach(x => f.appendChild(el('span', null, String(x)))); const l = left(it); if (l) f.appendChild(el('span', 'pxleft', l)); return f; }
  const ms = n => { const m = Math.round((n || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  const tc = n => { const s = Math.floor((n || 0) / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const SECIC = { movie: 'film', show: 'tv', artist: 'music', photo: 'photo', playlist: 'playlist' };
  // Music is not a product surface. Artist/album/track libraries, rows, and search hits stay off the nav and off every route.
  const MUSIC_KINDS = new Set(['artist', 'album', 'track']);
  const dropMusic = list => (list || []).filter(it => it && !MUSIC_KINDS.has(it.kind));
  const dropMusicLibs = list => (list || []).filter(s => s && !MUSIC_KINDS.has(s.kind));

  function poster(it, wide) {
    const a = el('a', 'card pxcard' + (wide ? ' wide' : '')); a.href = '#px/item/' + it.id; a.dataset.kind = it.kind;
    // FU7: episodes use their own still (thumb) first; music is square and never shows watched state.
    const music = it.kind === 'artist' || it.kind === 'album', sq = music ? 300 : 200;
    const p = el('div', 'poster'); const src = img(wide ? (it.kind === 'episode' ? (it.thumb || it.art) : (it.art || it.thumb)) : it.thumb, wide ? 320 : sq, wide ? 180 : 300);
    const ph = () => { if (!music) return; p.appendChild(el('span', 'pxph', ((it.title || '?').match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase())); };
    if (src) { const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; i.className = 'pxfade'; i.onload = () => i.classList.add('in'); i.src = src; i.onerror = () => { i.remove(); ph(); }; p.appendChild(i); if (i.complete && i.naturalWidth) i.classList.add('in'); } else ph();
    if (it.viewOffsetMs && it.durationMs) { const b = el('div', 'pxprog'); const f = el('i'); f.style.width = Math.min(100, it.viewOffsetMs / it.durationMs * 100).toFixed(1) + '%'; b.appendChild(f); p.appendChild(b); }
    if (it.watched && !music) p.appendChild(el('span', 'pxwatched', '✓'));
    a.appendChild(p);
    const m = el('div', 'meta');
    m.appendChild(el('div', 't', (it.kind === 'episode' ? (it.grandparentTitle || it.title) : it.title) || 'Untitled'));
    const sub = it.kind === 'episode' ? `S${it.parentIndex ?? '?'} · E${it.index ?? '?'} · ${it.title}` : it.kind === 'season' ? `${it.leafCount ?? 0} episodes` : it.kind === 'album' ? it.parentTitle : (it.year ?? '');
    m.appendChild(el('div', 'muted small', sub));
    // fu7c: name the servers only when the title is on more than one (Rust sends [] otherwise).
    const srcs = Array.isArray(it.sources) ? it.sources.filter(x => typeof x === 'string').slice(0, 4) : [];
    if (srcs.length > 1) { const sv = el('div', 'pxsrc small', srcs.join(' · ')); sv.title = 'On ' + srcs.join(', '); m.appendChild(sv); }
    a.appendChild(m);
    return a;
  }
  function row(title, list, wide) {
    if (!list || !list.length) return null;
    return strip({ title, items: list, wide: !!wide, count: list.length, key: title });
  }
  const afterPaint = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
  function toast(msg) {
    let t = document.getElementById('pxtoast');
    if (!t) { t = el('div', 'pxtoast'); t.id = 'pxtoast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function collageUrl(u) {
    if (typeof u !== 'string') return '';
    const re = ORIGIN === 'plexuw://localhost' ? /^plexuw:\/\/localhost\/img\/[0-9a-f]{32}\/\d+x\d+$/ : /^http:\/\/plexuw\.localhost\/img\/[0-9a-f]{32}\/\d+x\d+$/;
    return re.test(u) ? u : '';
  }
  let colKey = '';
  function clearCollage() {
    colKey = '';
    document.body.classList.remove('pxpast');
    const host = document.getElementById('pxcollage'); if (host) host.remove();
    document.documentElement.style.removeProperty('--pxamb');
  }
  function paintCollage(urls) {
    const list = (urls || []).map(collageUrl).filter(Boolean).slice(0, 9);
    const key = list.join('|');
    if (!list.length || key === colKey) return;
    colKey = key;
    let host = document.getElementById('pxcollage');
    if (!host) {
      host = el('div', 'pxcollage'); host.id = 'pxcollage'; host.setAttribute('aria-hidden', 'true');
      host.appendChild(el('div', 'pxcol a')); host.appendChild(el('div', 'pxcol b'));
      (main.parentNode || document.body).insertBefore(host, main);
    }
    const layers = host.querySelectorAll('.pxcol');
    const next = layers[0], prev = layers[1];
    next.textContent = '';
    list.forEach(u => { const i = el('i'); i.style.backgroundImage = 'url("' + u + '")'; next.appendChild(i); });
    while (next.children.length && next.children.length < 3) next.appendChild(next.children[0].cloneNode(true));
    requestAnimationFrame(() => { next.classList.add('on'); if (prev) prev.classList.remove('on'); });
  }
  function ambientHue(src) {
    const u = collageUrl(src); if (!u) return;
    try {
      const c = document.createElement('canvas'); c.width = 12; c.height = 12;
      const x = c.getContext('2d', { willReadFrequently: true }); if (!x) return;
      const im = new Image();
      im.onload = () => {
        try {
          x.drawImage(im, 0, 0, 12, 12);
          const d = x.getImageData(0, 0, 12, 12).data; let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          if (n) document.documentElement.style.setProperty('--pxamb', 'rgb(' + (r / n | 0) + ',' + (g / n | 0) + ',' + (b / n | 0) + ')');
        } catch (e) { /* tainted canvas: the backdrop art is the fallback */ }
      };
      im.src = u;
    } catch (e) {}
  }
  function syncArrows(sec) {
    const sc = sec.querySelector('.pxsts'); if (!sc) return;
    const f = arrowFlags(sc.scrollLeft, sc.clientWidth, sc.scrollWidth);
    sec.classList.toggle('fits', f.fits);
    sec.classList.toggle('atl', f.atl);
    sec.classList.toggle('atr', f.atr);
  }
  function stripScroll(sc, dir) {
    const card = sc.querySelector('.pxcard, .card');
    const gap = parseFloat(getComputedStyle(sc).columnGap || getComputedStyle(sc).gap) || 0;
    const w = card ? card.getBoundingClientRect().width : 0;
    const unit = w > 0 ? w + gap : Math.max(120, sc.clientWidth * 0.85);
    const n = Math.max(1, Math.floor((sc.clientWidth + gap) / (unit || 1)));
    const step = unit * n;
    const max = Math.max(0, sc.scrollWidth - sc.clientWidth);
    sc.scrollTo({ left: Math.max(0, Math.min(max, sc.scrollLeft + dir * step)), behavior: 'smooth' });
  }
  function strip(r) {
    const sec = el('section', 'pxstrip' + (r.wide ? ' pxwd' : ''));
    if (r.key) sec.dataset.row = String(r.key).slice(0, 80);
    if (r.title) {
      const h = el('h2', 'pxsth');
      h.appendChild(el('span', 'pxstt', r.title));
      h.appendChild(el('span', 'pxstc', ' · ' + (r.count ?? r.items.length)));
      if (r.see) { h.appendChild(el('span', 'pxstc', ' · ')); const a = el('a', 'pxsee', 'See all ›'); a.href = r.see; h.appendChild(a); }
      sec.appendChild(h);
    }
    const wrap = el('div', 'pxstw');
    const sc = el('div', 'row pxrow pxsts' + (r.wide ? ' pxwd' : ''));
    const ranked = /top\s*10/i.test((r.title || '') + ' ' + (r.key || ''));
    r.items.forEach((it, i) => {
      const c = poster(it, !!r.wide);
      if (ranked) { c.classList.add('pxranked'); const pp = c.querySelector('.poster'); if (pp) pp.appendChild(el('span', 'pxrank', String(i + 1))); }
      sc.appendChild(c);
    });
    const arr = d => {
      const b = el('button', 'pxarr ' + d); b.type = 'button'; b.tabIndex = -1;
      b.setAttribute('aria-label', (d === 'l' ? 'Scroll left in ' : 'Scroll right in ') + (r.title || 'row'));
      b.appendChild(pxIcon('chev'));
      b.onclick = e => { e.preventDefault(); e.stopPropagation(); stripScroll(sc, d === 'l' ? -1 : 1); };
      return b;
    };
    wrap.appendChild(arr('l')); wrap.appendChild(sc); wrap.appendChild(arr('r')); sec.appendChild(wrap);
    sc.addEventListener('scroll', () => syncArrows(sec), { passive: true });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => syncArrows(sec)).observe(sc);
    return sec;
  }
  function bindHomeHero(g0) {
    const strips = [...view.querySelectorAll('.pxstrip')];
    const cw = strips.find(s => /continue watching/i.test((s.querySelector('.pxstt') || {}).textContent || '')) || strips[0];
    const artOf = sec => sec ? [...sec.querySelectorAll('.pxcard .poster img')].map(i => collageUrl(i.currentSrc || i.src)).filter(Boolean).slice(0, 9) : [];
    const score = sec => {
      if (!sec) return 0;
      const r = sec.getBoundingClientRect(), mr = main.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, mr.bottom) - Math.max(r.top, mr.top));
    };
    const tick = () => {
      if (g0 !== gen) return;
      const mr = main.getBoundingClientRect();
      const cwRect = cw ? cw.getBoundingClientRect() : null;
      const hero = view.querySelector('.pxhomehero');
      // Past the continue row: the sharp hero still gives way to a blurred collage of the row on screen.
      const past = cwRect ? cwRect.bottom < mr.top + 48 : main.scrollTop > (hero ? 280 : 160);
      if (!past) {
        document.body.classList.remove('pxpast');
        const host = document.getElementById('pxcollage'); if (host) host.querySelectorAll('.pxcol').forEach(c => c.classList.remove('on'));
        colKey = '';
        return;
      }
      let best = null, bestS = 0;
      strips.forEach(s => { if (s === cw) return; const n = score(s); if (n > bestS) { bestS = n; best = s; } });
      const urls = artOf(best).length ? artOf(best) : artOf(strips.find(s => s !== cw));
      if (urls.length) { paintCollage(urls); document.body.classList.add('pxpast'); }
    };
    strips.forEach(sec => sec.querySelectorAll('.pxcard .poster img').forEach(i => { if (!i.complete) i.addEventListener('load', () => tick(), { once: true }); }));
    const prev = onScroll;
    onScroll = r => { if (prev) prev(r); tick(); };
    afterPaint(tick);
  }
  function status(msg) { view.textContent = ''; view.appendChild(el('p', 'muted pxstatus', msg)); }
  function loading(target) { const w = el('div', 'pxload'); w.setAttribute('role', 'status'); w.setAttribute('aria-label', 'Loading'); w.setAttribute('aria-busy', 'true'); for (const c of ['a', 'b', 'c']) w.appendChild(el('i', 'pxsk ' + c)); (target || view).appendChild(w); return w; }
  // Fixed text per Rust failure category (hooks.why); raw error text is never shown.
  function fail(e, kind) { status(loadErrorText(kind, e, hooks.why)); }

  // Sidebar: icon + label so the links survive the collapsed (72px) rail at <1600px.
  function navLink(label, hash, r, ic) { const a = el('a'); a.href = hash; a.dataset.r = r; a.dataset.label = label; a.setAttribute('aria-label', label); a.appendChild(pxIcon(ic)); a.appendChild(el('span', null, label)); return a; }
  let conn = '', navState = 'ok';
  function loadSections() {
    // srcGen: a reply from the previous server (or from before the pick) must never
    // overwrite the new server's library list; that left category links pointing at stale ids.
    const sg = srcGen; navState = 'loading'; renderNav();
    invoke('browse_home').then(v => { if (sg !== srcGen) return; sections = dropMusicLibs(v.sections); navState = 'ok'; renderNav(); }).catch(() => { if (sg !== srcGen) return; navState = 'fail'; renderNav(); });
  }
  function renderNav() {
    nav.textContent = '';
    // fu6: the name lives only on the bottom profile card; switching lives in Profile → Switch server.
    // FU7: no server picker in the rail; versions on the title page replace it.
    const sl = navLink('Search', '#px/search', 'search', 'search'); sl.setAttribute('aria-keyshortcuts', 'Control+K'); sl.onclick = e => { e.preventDefault(); pkOpen(); }; nav.appendChild(sl);
    nav.appendChild(navLink('Home', '#px/home', 'home', 'home'));
    nav.appendChild(el('div', 'navh muted small', 'Libraries'));
    sections.forEach(s => nav.appendChild(navLink(s.title, '#px/sec/' + s.id, 'sec/' + s.id, SECIC[s.kind] || 'folder')));
    if (navState === 'loading' && !sections.length) { const m = el('div', 'pxnavmsg pxload'); m.setAttribute('role', 'status'); m.setAttribute('aria-label', 'Loading libraries'); m.appendChild(el('i', 'pxsk a')); m.appendChild(el('i', 'pxsk b')); nav.appendChild(m); }
    if (navState === 'fail' && !sections.length) { const r = el('button', 'pxnavmsg pxlink', 'Libraries didn’t load · Retry'); r.type = 'button'; r.onclick = loadSections; nav.appendChild(r); }
    mark(cur);
  }
  let cur = 'home';
  function mark(r) { cur = r; nav.querySelectorAll('a').forEach(a => { const y = r === a.dataset.r || r.startsWith(a.dataset.r + '/'); a.classList.toggle('on', y); y ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); }); }

  async function home(g) {
    mark('home'); view.textContent = ''; loading();
    const sg = srcGen; const v = await invoke('browse_home'); if (g !== gen || sg !== srcGen) return;
    sections = dropMusicLibs(v.sections); renderNav(); mark('home');
    view.textContent = ''; clearCollage();
    const cwAll = dropMusic(v.continueWatching);
    const odAll = dropMusic(v.onDeck);
    const hi = cwAll[0] || odAll[0];
    const fromCw = !!(cwAll[0] && hi && hi.id === cwAll[0].id);
    // The hero title is not a Continue Watching card. Id match is the real copy; title+year
    // catches a second server's card if dedupe ever missed it. Episodes stay (different chapters).
    const notHi = x => {
      if (!x || !hi) return true;
      if (x.id === hi.id) return false;
      if (x.kind !== 'episode' && hi.kind !== 'episode' && x.title && x.title === hi.title && String(x.year || '') === String(hi.year || '')) return false;
      return true;
    };
    if (hi) {
      const bd = backdrop(hi); if (bd) view.appendChild(bd);
      const hue = img(hi.art || hi.thumb, 64, 64); if (hue) ambientHue(hue);
      const hw = el('div', 'pxhomehero');
      const meter = fromCw ? cwMeter(hi) : null;
      // Tall glass is the official cover only (`poster`). An episode's `thumb` is the scene still;
      // the show cover is grandparentThumb, which Rust puts on `poster`. Never fall back to thumb or art here.
      const cu = img(hi.poster, 420, 630);
      if (cu) {
        const c2 = el('a', 'pxcase'); c2.href = '#px/item/' + hi.id; c2.tabIndex = -1; c2.setAttribute('aria-hidden', 'true');
        const ci = el('img'); ci.alt = ''; ci.decoding = 'async'; ci.src = cu; ci.onerror = () => { c2.remove(); hw.classList.remove('hascase'); };
        c2.appendChild(ci); c2.appendChild(el('i', 'pxcasesp'));
        if (meter && meter.dur) {
          const b = el('div', 'pxprog'); const f = el('i');
          f.style.width = meter.width;
          b.appendChild(f); c2.appendChild(b);
        }
        hw.appendChild(c2); hw.classList.add('hascase');
      }
      const h = el('div', 'pxhtext');
      if (fromCw) {
        h.appendChild(el('div', 'pxcwmark', 'Continue Watching'));
        const bar = el('div', 'pxhprog'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'Progress');
        if (meter.dur) { bar.setAttribute('aria-valuemax', String(meter.dur)); bar.setAttribute('aria-valuenow', String(Math.min(meter.off, meter.dur))); }
        const f = el('i'); f.style.width = meter.width; bar.appendChild(f); h.appendChild(bar);
        if (meter.left) h.appendChild(el('div', 'pxhleft', meter.left));
      } else h.appendChild(el('div', 'pxhkick', 'Up next'));
      const t = el('a', 'pxhtitle', hi.kind === 'episode' && hi.grandparentTitle ? hi.grandparentTitle : (hi.title || 'Untitled'));
      t.href = '#px/item/' + hi.id; h.appendChild(t);
      if (hi.kind === 'episode') h.appendChild(el('div', 'muted', `S${hi.parentIndex ?? '?'} · E${hi.index ?? '?'} · ${hi.title}`));
      const facts = heroFacts(hi);
      if (fromCw) facts.querySelectorAll('.pxleft').forEach(n => n.remove());
      h.appendChild(facts);
      if (hi.genres && hi.genres.length) h.appendChild(el('div', 'muted', hi.genres.join(', ')));
      if (hi.summary) h.appendChild(el('p', 'pxsum', hi.summary));
      if (fromCw) {
        const rs = el('button', 'pxresume'); rs.type = 'button';
        rs.appendChild(icon('play')); rs.appendChild(el('span', null, 'Resume'));
        rs.setAttribute('aria-label', 'Resume');
        rs.onclick = () => startTitlePlay(hi, false);
        h.appendChild(rs);
      }
      hw.appendChild(h); view.appendChild(hw);
    } else view.appendChild(el('h1', 'pxh', 'Home'));
    if ((v.servers || 0) > 1) view.appendChild(el('p', 'muted small pxmsrv', 'Browsing ' + (v.answered || v.servers) + ' of ' + v.servers + ' servers'));
    // FU7: the promoted hubs can repeat Continue Watching / On Deck; show each once.
    const dup = h => /continue|ondeck|on deck|next up/i.test((h.ident || '') + ' ' + (h.title || ''));
    [row('Continue Watching', cwAll.filter(notHi)), row('Next Up', odAll.filter(notHi)), ...v.hubs.filter(h => !dup(h)).map(h => row(h.title, dropMusic(h.items)))].forEach(x => x && view.appendChild(x));
    if (!view.querySelector('.pxrow')) view.appendChild(el('p', 'muted', 'Nothing here yet.'));
    afterPaint(() => { if (g === gen) { view.querySelectorAll('.pxstrip').forEach(syncArrows); if (hi) bindHomeHero(g); } });
  }

  // ---- Library: Jellyfin-style tabs, filter bar, tiles, A–Z jump, virtualised grid
  const TABS = [['all', 'All'], ['collections', 'Collections'], ['genres', 'Genres'], ['studios', 'Studios']];
  const FK = /^(genre|year|studio)$/;
  async function section(id, tab, fk, fv, g) {
    if (!ID.test(id)) return status('Not found');
    tab = TABS.some(t => t[0] === tab) ? tab : 'all';
    if (!FK.test(fk || '')) { fk = ''; fv = ''; }
    let loadErr;
    if (!sections.length) { const sg = srcGen; try { const v = (await invoke('browse_home')).sections; if (sg === srcGen) sections = dropMusicLibs(v); } catch (e) { loadErr = e; } if (g !== gen) return; }
    const s = sections.find(x => String(x.id) === id); mark('sec/' + id);
    if (!s) return status(missingLibraryText(loadErr, hooks.why));
    view.textContent = '';
    const hd = el('div', 'pxhead'); hd.appendChild(el('h1', 'pxh', s.title));
    const count = el('span', 'muted small'); hd.appendChild(count); view.appendChild(hd);
    const tabs = el('div', 'pxtabs'); tabs.setAttribute('role', 'tablist');
    TABS.filter(t => !(s && s.kind === 'artist' && (t[0] === 'collections' || t[0] === 'studios'))).forEach(([k, n]) => { const a = el('a', 'pxtab' + (k === tab ? ' on' : ''), n); a.href = `#px/sec/${id}/${k}`; a.setAttribute('role', 'tab'); a.setAttribute('aria-selected', String(k === tab)); tabs.appendChild(a); });
    view.appendChild(tabs);
    const landing = (s.kind === 'movie' || s.kind === 'show') && tab === 'all' && !fk;
    if (landing) { const box = await sectionLanding(id, g); if (g !== gen) return; if (box) view.appendChild(box); }
    if (tab === 'collections') {
      const w = loading(); const cs = await invoke('browse_collections', { id }); if (g !== gen) return; w.remove();
      const gr = el('div', 'grid pxgrid'); cs.forEach(c => gr.appendChild(poster(c))); view.appendChild(cs.length ? gr : el('p', 'muted', 'No collections.')); count.textContent = `${cs.length} collections`; return;
    }
    if (tab === 'genres' || tab === 'studios') {
      const kind = tab === 'genres' ? 'genre' : 'studio';
      const w = loading(); const fs = await invoke('browse_facet', { id, facet: kind }); if (g !== gen) return; w.remove();
      const tl = el('div', 'pxtiles'); count.textContent = `${fs.length} ${tab}`;
      fs.forEach((f, i) => { const v = kind === 'genre' ? f.key : f.title; if (!v) return; const a = el('a', 'pxtile t' + (i % 6)); a.href = `#px/sec/${id}/all/${kind}/${encodeURIComponent(v)}`; a.appendChild(icon(kind === 'genre' ? 'genre' : 'studio')); a.appendChild(el('b', null, f.title)); tl.appendChild(a); });
      view.appendChild(fs.length ? tl : el('p', 'muted', 'Nothing to show.')); return;
    }
    // All: filter bar
    const sort = sessionStorage.getItem('pxSort') || 'title';
    const bar = el('div', 'pxfilters');
    const sel = (cls, label, opts, val, fn) => { const x = el('select', 'pxsort ' + cls); x.setAttribute('aria-label', label); opts.forEach(([k, n]) => { const o = el('option', null, n); o.value = k; x.appendChild(o); }); x.value = val; x.onchange = () => fn(x.value); bar.appendChild(x); return x; };
    sel('', 'Sort', [['title', 'Title'], ['added', 'Recently added'], ['year', 'Year'], ['rating', 'Rating']], sort, v => { sessionStorage.setItem('pxSort', v); route(); });
    const fsel = (kind, label) => { const x = sel('pxf', label, [['', label]], fk === kind ? fv : '', v => go(v ? `#px/sec/${id}/all/${kind}/${encodeURIComponent(v)}` : `#px/sec/${id}/all`));
      invoke('browse_facet', { id, facet: kind }).then(fs => { if (g !== gen) return; fs.forEach(f => { const v = kind === 'genre' ? f.key : f.title; if (!v) return; const o = el('option', null, f.title); o.value = v; x.appendChild(o); }); x.value = fk === kind ? fv : ''; }).catch(() => {}); };
    fsel('genre', 'Genre'); fsel('year', 'Year'); fsel('studio', 'Studio');
    if (fk) { const c = el('a', 'pxfchip'); c.href = `#px/sec/${id}/all`; c.title = 'Clear filter'; c.appendChild(el('span', 'muted', fk[0].toUpperCase() + fk.slice(1) + ': ')); const nm = el('b', null, fv); c.appendChild(nm); c.appendChild(el('span', null, ' ✕')); bar.appendChild(c);
      if (fk === 'genre') invoke('browse_facet', { id, facet: 'genre' }).then(fs => { const f = fs.find(x => x.key === fv); if (f && g === gen) nm.textContent = f.title; }).catch(() => {}); }
    view.appendChild(bar);
    const wrap = el('div', 'pxgridwrap'); view.appendChild(wrap);
    const grid = el('div', 'grid pxgrid pxvgrid'); wrap.appendChild(grid);
    const letterBar = el('div', 'pxaz'); letterBar.setAttribute('aria-label', 'Jump to letter');
    const args = start => ({ id, start, cursor: null, sort, fkind: fk || null, fvalue: fk ? fv : null });
    const w = loading(wrap);
    const p0 = await invoke('browse_section', args(0)); if (g !== gen) return; w.remove();
    const total = p0.total; count.textContent = `${total} items`;
    if (!total) {
      const em = el('div', 'pxempty');
      if (fk) { em.appendChild(el('h2', null, 'Nothing matches this filter')); const a = el('a', 'pxchip', 'Clear filter'); a.href = `#px/sec/${id}/all`; em.appendChild(a); }
      else { em.appendChild(el('h2', null, 'This library is empty')); em.appendChild(el('p', 'muted', 'Add media to this library on your Plex server and it will show up here.')); }
      grid.appendChild(em); return;
    }
    // fu7e: append-only infinite scroll (see appendGrid). Pages of 100 load as the user
    // nears the end; placeholders hold the layout so nothing jumps or flashes.
    const ag = appendGrid({ grid, total,
      fetchPage: start => start === 0 ? p0.items : Promise.resolve(hooks.pageDelay && hooks.pageDelay()).then(d => d && new Promise(r => setTimeout(r, d))).then(() => invoke('browse_section', args(start))).then(p => g === gen ? p.items : null),
      tile: it => poster(it),
      onError: e => { if (g === gen && !ag.pages.size) fail(e); },
      placeholder: () => { const ph = el('div', 'card pxcard pxph'); ph.isPlaceholder = true; ph.setAttribute('aria-hidden', 'true'); ph.appendChild(el('div', 'poster')); ph.appendChild(el('div', 'meta')); return ph; } });
    let cols = 1, rowH = 300;
    function measure() {
      cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
      const c = grid.querySelector('.card'); if (c) rowH = c.getBoundingClientRect().height + (parseFloat(getComputedStyle(grid).rowGap) || 0);
    }
    function check() {
      if (!grid.isConnected) return;
      const mr = main.getBoundingClientRect(), gr = grid.getBoundingClientRect();
      // grow one page ahead when within ~1.5 screens of the end
      if (ag.tiles.length < total && gr.bottom - mr.bottom < mr.height * 1.5) ag.ensure(ag.tiles.length + 100);
      const r0 = Math.max(0, Math.floor((mr.top - gr.top) / rowH) - 2), r1 = Math.ceil((mr.bottom - gr.top) / rowH) + 4;
      ag.want(r0 * cols, Math.min(ag.tiles.length, r1 * cols));
    }
    let raf = 0; onScroll = r => { if (r) measure(); if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); }); };
    ag.ensure(100); await ag.load(0); measure(); check();
    if (sort === 'title' && total > 12) {
      invoke('browse_letters', { id, fkind: fk || null, fvalue: fk ? fv : null }).then(ls => {
        if (g !== gen) return; let off = 0; const at = {}; ls.forEach(l => { if (!(l.key in at)) at[l.key] = off; off += l.count; });
        ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].forEach(k => { const bt = el('button', 'pxazb', k); bt.type = 'button'; bt.disabled = !(k in at);
          bt.onclick = () => { const i = Math.min(total - 1, at[k]); ag.ensure(i + cols * 8); ag.want(i - cols * 2, i + cols * 8); const t = ag.tiles[i]; if (t) main.scrollTop += t.getBoundingClientRect().top - main.getBoundingClientRect().top - 8; }; letterBar.appendChild(bt); });
        wrap.appendChild(letterBar); wrap.classList.add('hasaz'); measure(); check();
      }).catch(() => {});
    }
  }

  async function sectionLanding(id, g) {
    let hubs;
    try { hubs = await invoke('browse_section_hubs', { id }); } catch (e) { return null; }
    if (g !== gen) return null;
    const rows = (hubs || []).map(h => ({ title: h.title || '', ident: h.ident || '', items: dropMusic(h.items) })).filter(h => h.title && h.items.length);
    if (!rows.length) return null;
    const cw = rows.find(h => /continue/i.test(h.ident + ' ' + h.title));
    const heroHub = cw || rows[0];
    const heroIt = heroHub.items[0];
    const box = el('div', 'pxland');
    if (heroIt) {
      const bd = backdrop(heroIt); if (bd) view.appendChild(bd);
      const hue = img(heroIt.art || heroIt.thumb, 64, 64); if (hue) ambientHue(hue);
      const w = el('div', 'pxlhero'); const tx = el('div', 'pxhtext');
      const a = el('a', 'pxhtitle', heroIt.kind === 'episode' && heroIt.grandparentTitle ? heroIt.grandparentTitle : (heroIt.title || 'Untitled'));
      a.href = '#px/item/' + heroIt.id; tx.appendChild(a);
      if (heroIt.kind === 'episode') tx.appendChild(el('div', 'muted', `S${heroIt.parentIndex ?? '?'} · E${heroIt.index ?? '?'} · ${heroIt.title}`));
      tx.appendChild(heroFacts(heroIt, (heroIt.genres || []).slice(0, 2)));
      if (heroIt.summary) tx.appendChild(el('p', 'pxsum pxclamp', heroIt.summary));
      w.appendChild(tx); box.appendChild(w);
    }
    rows.forEach(h => {
      const items = h === heroHub ? h.items.filter(it => !heroIt || it.id !== heroIt.id) : h.items;
      if (!items.length) return;
      const see = /genre/i.test(h.ident) ? `#px/sec/${id}/all/genre/${encodeURIComponent(h.title)}` : '';
      box.appendChild(strip({ title: h.title, ident: h.ident, items, see, count: h.items.length, key: h.ident || h.title, wide: false }));
    });
    afterPaint(() => { if (g === gen) box.querySelectorAll('.pxstrip').forEach(syncArrows); });
    return box;
  }

  // ---- Details: hero + LEFT Info panel (cast, format, servers) + RIGHT panel (chapters, Up Next)
  // fu7f LOW-C: only the right panel (Chapters & Up Next) remains.
  function panelBtn(label, ic, shell) { const b = el('button', 'px-btn pxpbtn'); b.type = 'button'; b.appendChild(icon(ic)); b.appendChild(el('span', null, label));
    const sync = () => { const o = shell.classList.contains('ropen'); b.classList.toggle('on', o); b.setAttribute('aria-pressed', String(o)); };
    b.onclick = () => { const o = !shell.classList.contains('ropen'); shell.classList.toggle('ropen', o); sessionStorage.setItem('pxR', o ? '1' : '0'); sync(); }; sync(); shell.addEventListener('pxsync', sync); return b; }
  function phead(title, shell) { const h = el('div', 'ptabs'); h.appendChild(el('b', null, title)); const x = el('button', 'pxclose', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close ' + title); x.onclick = () => { shell.classList.remove('ropen'); sessionStorage.setItem('pxR', '0'); shell.dispatchEvent(new Event('pxsync')); }; h.appendChild(x); return h; }
  const fmtRes = r => !r ? '' : /^\d+$/.test(r) ? r + 'p' : r.toUpperCase();
  const fmtSize = b => b == null ? '' : b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e6) + ' MB';
  // fu7e: the left Info panel and its Info / ⋯ buttons are gone. Their unique content now
  // lives on the page: one Versions list (the only Preferred), a File line, and the credits.
  function fileLine(it) {
    const m = (it.media || [])[0]; if (!m || (it.versions || []).length > 1) return null;
    const ch = m.audioChannels ? (m.audioChannels === 6 ? '5.1' : m.audioChannels === 8 ? '7.1' : m.audioChannels + ' ch') : '';
    const t = [(m.container || '').toUpperCase(), [(m.videoCodec || '').toUpperCase(), fmtRes(m.videoResolution)].filter(Boolean).join(' '), [(m.audioCodec || '').toUpperCase(), ch].filter(Boolean).join(' '), m.bitrateKbps ? (m.bitrateKbps / 1000).toFixed(1) + ' Mbps' : '', fmtSize(m.sizeBytes)].filter(Boolean).join(' · ');
    return t ? el('p', 'muted small pxfile', 'File · ' + t) : null;
  }
  // FU7: every copy of this title across your servers, best first (Rust sorts owned
  // before shared, then quality). Text only; ids are opaque; a server badge only when >1.
  function versionsList(it) {
    const multi = new Set((it.versions || []).map(v => v.server)).size > 1;
    const w = el('div', 'pxvers'); w.setAttribute('role', 'list');
    (it.versions || []).forEach(v => { const b = el('button', 'pxver' + (v.current ? ' cur' : '')); b.type = 'button'; b.setAttribute('role', 'listitem');
      b.appendChild(el('b', null, v.label || 'Unknown'));
      b.appendChild(el('span', 'muted small', [v.hdr ? 'HDR' : '', (v.codec || '').toUpperCase(), v.bitrateKbps ? (v.bitrateKbps / 1000).toFixed(1) + ' Mbps' : ''].filter(Boolean).join(' · ')));
      // SHOULD-4: server badge only when the copies span more than one server.
      if (multi) b.appendChild(el('span', 'pxbadge' + (v.owned ? ' ow' : ' sh'), v.server + (v.owned ? ' · owned' : ' · shared')));
      if (v.picked) b.appendChild(el('span', 'pxbadge pk', 'Preferred'));
      b.title = v.current ? 'This copy' : 'Prefer this copy';
      b.onclick = () => invoke('version_pick', { id: v.id }).then(() => { w.querySelectorAll('.pxbadge.pk').forEach(x => x.remove()); /* LOW-C: every Preferred badge carries .pk, so only one survives */ const t = el('span', 'pxbadge pk', 'Preferred'); b.appendChild(t); }).catch(() => {});
      w.appendChild(b); });
    return w;
  }
  function sidePanel(it, shell, g0) {
    const p = el('aside', 'pxpanel right'); p.setAttribute('aria-label', 'Chapters and Up Next'); const g = el('div', 'pxpin'); p.appendChild(g);
    g.appendChild(phead('Chapters & Up Next', shell));
    if (it.chapters.length) { g.appendChild(el('h4', null, 'Chapters')); it.chapters.forEach((c, i) => { const r = el('div', 'chrow'); r.appendChild(el('b', 'pxtc', tc(c.startMs))); r.appendChild(el('span', null, c.title || 'Chapter ' + (i + 1))); g.appendChild(r); }); }
    if (it.markers.length) { const m = el('p', 'muted small'); m.textContent = it.markers.map(x => `${x.kind === 'credits' ? 'Credits' : 'Intro'} ${tc(x.startMs)}–${tc(x.endMs)}`).join(' · '); g.appendChild(m); }
    g.appendChild(el('h4', null, 'Up Next')); const up = el('div', 'pxuplist'); g.appendChild(up); const w = loading(up);
    const add = list => { w.remove(); if (!list.length) { up.appendChild(el('p', 'muted small', 'Nothing queued.')); return; }
      list.slice(0, 12).forEach(x => { const a = el('a', 'up'); a.href = '#px/item/' + x.id; const pp = el('div', 'poster'); const src = img(x.thumb || x.art, 224, 126); if (src) { const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = src; i.onerror = () => i.remove(); pp.appendChild(i); } a.appendChild(pp);
        const t = el('div'); t.appendChild(el('b', null, x.kind === 'episode' ? `E${x.index ?? '?'} · ${x.title}` : x.title)); t.appendChild(el('div', 'muted small', x.kind === 'episode' ? (x.grandparentTitle || '') : (x.year ?? ''))); a.appendChild(t); up.appendChild(a); }); };
    const q = it.kind === 'episode' && ID.test(it.parentId || '') ? invoke('browse_children', { id: it.parentId }).then(k => k.filter(x => (x.index ?? 0) > (it.index ?? 0)))
      : it.kind === 'season' ? invoke('browse_children', { id: it.id }).then(k => k.filter(x => !x.watched))
      : invoke('browse_home').then(v => dropMusic(v.onDeck).filter(x => x.id !== it.id));
    q.then(l => { if (gen === g0) add(l); }).catch(() => { if (gen === g0) add([]); });
    return p;
  }
  function startTitlePlay(it, fromStart) {
    if (!it || !it.id) return;
    const back = (location.hash && location.hash.indexOf('#px/') === 0) ? location.hash : '#px/home';
    // playVersion is the opaque slot only, cleared before the context is stored. Audio/subtitle picks stay
    // in sessionStorage and are not sent here, so play_start's HLS query (and the /hls/<hex> rewrite) is unchanged.
    const versionId = it.playVersion || it.defaultVersion || null;
    it.playVersion = null;
    const ctx = { plexId: it.id, versionId, returnHash: back, durationMs: it.durationMs || 0, title: it.title || '', year: it.year || '', kind: it.kind || '', show: it.grandparentTitle || it.parentTitle || '', season: it.parentIndex || '', episode: it.index || '', fromStart: !!fromStart, viewOffsetMs: fromStart ? 0 : (it.viewOffsetMs || 0) };
    try { sessionStorage.setItem('pxPlayCtx', JSON.stringify(ctx)); } catch (e) {}
    location.hash = '#player/plex';
  }
  function pickedVersion(it) {
    const vs = it.versions || [];
    const v = vs.find(x => x.picked) || vs.find(x => x.current) || vs[0];
    return (v && v.id) || it.defaultVersion || null;
  }
  function choiceLabel(v) {
    return [v.server, v.label, (v.codec || '').toUpperCase()].filter(x => typeof x === 'string' && x).join(' · ');
  }
  function readyLine(it) {
    const vs = it.versions || [];
    const v = vs.find(x => x.picked) || vs.find(x => x.current) || vs[0];
    if (!v) return null;
    const bits = ['play from ' + (typeof v.server === 'string' && v.server ? v.server : 'library')];
    if (v.label) bits.push(v.label);
    if (v.codec) bits.push(String(v.codec).toUpperCase());
    if (v.bitrateKbps) bits.push((v.bitrateKbps / 1000).toFixed(1) + ' Mbps');
    return el('p', 'muted small pxready', 'Ready · ' + bits.join(' · '));
  }
  function trackRows(it, kind) {
    const bad = /https?:|\/library\/|token|plex\./i;
    return (it.tracks || []).filter(t => t && t.kind === kind && typeof t.label === 'string' && t.label && !bad.test(t.label) && !/[\\/]/.test(t.label)).slice(0, 8);
  }
  function avMemory(id) {
    try { const o = JSON.parse(sessionStorage.getItem('pxAv:' + id) || '{}'); return { audio: Number.isInteger(o.audio) ? o.audio : null, sub: Number.isInteger(o.sub) ? o.sub : null }; }
    catch (e) { return { audio: null, sub: null }; }
  }
  function moreMenu(it) {
    const feat = el('div', 'pxfeat');
    const fb = el('button', 'pxrb lab'); fb.type = 'button'; fb.setAttribute('aria-haspopup', 'menu'); fb.setAttribute('aria-expanded', 'false');
    fb.title = 'More'; fb.setAttribute('aria-label', 'More');
    fb.appendChild(el('span', 'pxglyph', '⋯')); fb.appendChild(el('span', 'pxrbl', 'More'));
    const fm = el('div', 'pxfeatmenu'); fm.hidden = true; fm.setAttribute('role', 'menu');
    const shut = () => { fm.hidden = true; fb.setAttribute('aria-expanded', 'false'); };
    fm.appendChild(el('div', 'mh', 'Watch together'));
    const wt = el('button', null, 'Watch together'); wt.type = 'button';
    wt.onclick = () => { shut(); toast('Watch together is not available yet'); };
    fm.appendChild(wt);
    let audios = trackRows(it, 'audio');
    if (!audios.length) {
      const m = (it.media || [])[0];
      const ch = m && m.audioChannels ? (m.audioChannels === 6 ? '5.1' : m.audioChannels === 8 ? '7.1' : m.audioChannels + ' ch') : '';
      const lab = m ? [(m.audioCodec || '').toUpperCase(), ch].filter(Boolean).join(' ') : '';
      if (lab && !/[\\/]/.test(lab)) audios = [{ label: lab, selected: true }];
    }
    const mem = avMemory(it.id);
    const save = o => { try { sessionStorage.setItem('pxAv:' + it.id, JSON.stringify({ audio: o.audio, sub: o.sub })); } catch (e) {} };
    if (audios.length) {
      fm.appendChild(el('div', 'mh', 'Audio'));
      audios.forEach((t, i) => {
        const on = mem.audio === i || (mem.audio == null && !!t.selected) || (mem.audio == null && !audios.some(x => x.selected) && i === 0);
        const b = el('button', on ? 'on' : null, t.label); b.type = 'button';
        b.onclick = () => { fm.querySelectorAll('[data-audio]').forEach(x => x.classList.remove('on')); b.classList.add('on'); save({ audio: i, sub: avMemory(it.id).sub }); shut(); };
        b.dataset.audio = String(i); fm.appendChild(b);
      });
    }
    const subs = trackRows(it, 'sub');
    fm.appendChild(el('div', 'mh', 'Subtitles'));
    const offOn = mem.sub === -1 || (mem.sub == null && !subs.some(t => t.selected));
    const off = el('button', offOn ? 'on' : null, 'Off'); off.type = 'button'; off.dataset.cc = 'off';
    off.onclick = () => { fm.querySelectorAll('[data-cc]').forEach(x => x.classList.remove('on')); off.classList.add('on'); save({ audio: avMemory(it.id).audio, sub: -1 }); shut(); };
    fm.appendChild(off);
    subs.forEach((t, i) => {
      const on = mem.sub === i || (mem.sub == null && !!t.selected);
      const b = el('button', on ? 'on' : null, t.label); b.type = 'button'; b.dataset.cc = String(i);
      b.onclick = () => { fm.querySelectorAll('[data-cc]').forEach(x => x.classList.remove('on')); b.classList.add('on'); save({ audio: avMemory(it.id).audio, sub: i }); shut(); };
      fm.appendChild(b);
    });
    fb.onclick = e => { e.stopPropagation(); const open = fm.hidden; fm.hidden = !open; fb.setAttribute('aria-expanded', String(open)); };
    document.addEventListener('click', e => { if (!feat.contains(e.target)) shut(); });
    feat.appendChild(fb); feat.appendChild(fm); return feat;
  }
  function watchlistBtn() {
    const b = el('button', 'pxrb lab'); b.type = 'button';
    b.appendChild(pxIcon('playlist')); b.appendChild(el('span', 'pxrbl', 'Watchlist · coming soon'));
    b.title = 'Watchlist · coming soon'; b.setAttribute('aria-label', 'Watchlist · coming soon');
    b.onclick = () => toast('Watchlist · coming soon');
    return b;
  }
  function playRow(it) {
    const ra = el('div', 'pxround');
    const choices = (it.versions || []).filter(v => v && typeof v.id === 'string' && ID.test(v.id)).slice(0, 12);
    const multi = new Set(choices.map(v => v.server)).size > 1 || choices.length > 1;
    const rb = (ic, lab, fn) => { const b = el('button', 'pxrb lab'); b.type = 'button'; b.title = lab; b.setAttribute('aria-label', lab); b.appendChild(ic.length === 1 ? el('span', 'pxglyph', ic) : icon(ic)); b.appendChild(el('span', 'pxrbl', lab)); b.onclick = fn; ra.appendChild(b); return b; };
    if (multi && choices.length) {
      const slot = el('div', 'pxfeat');
      const pb = el('button', 'pxrb lab'); pb.type = 'button'; pb.appendChild(icon('play')); pb.appendChild(el('span', 'pxrbl', 'Play · choose server'));
      pb.title = 'Play · choose server'; pb.setAttribute('aria-label', 'Play · choose server');
      const menu = el('div', 'pxfeatmenu'); menu.hidden = true; menu.setAttribute('role', 'menu');
      menu.appendChild(el('div', 'mh', 'Play from'));
      choices.forEach(v => {
        const b = el('button', null, choiceLabel(v) || 'Version'); b.type = 'button';
        b.onclick = e => { e.stopPropagation(); menu.hidden = true; invoke('version_pick', { id: v.id }).catch(() => {}); it.playVersion = v.id; startTitlePlay(it, false); };
        menu.appendChild(b);
      });
      pb.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
      document.addEventListener('click', e => { if (!slot.contains(e.target)) menu.hidden = true; });
      slot.appendChild(pb); slot.appendChild(menu); ra.appendChild(slot);
    } else rb('play', 'Play', () => startTitlePlay(it, false));
    const from = el('button', 'pxrb lab'); from.type = 'button'; from.appendChild(icon('rew')); from.appendChild(el('span', 'pxrbl', 'Play from start'));
    from.title = 'Play from start'; from.setAttribute('aria-label', 'Play from start');
    from.onclick = () => { it.playVersion = pickedVersion(it); startTitlePlay(it, true); };
    ra.appendChild(from);
    const mk = el('button', 'pxrb lab'); mk.type = 'button'; mk.appendChild(el('span', 'pxglyph', '✓'));
    const ml = el('span', 'pxrbl', it.watched ? 'Mark unwatched' : 'Mark watched'); mk.appendChild(ml);
    const syncMk = () => { const t = it.watched ? 'Mark unwatched' : 'Mark watched'; ml.textContent = t; mk.title = t; mk.setAttribute('aria-label', t); };
    syncMk();
    mk.onclick = () => { const next = !it.watched; invoke('mark_watched', { id: it.id, watched: next }).then(() => { it.watched = next; syncMk(); }).catch(() => toast('Couldn’t update watched state')); };
    ra.appendChild(mk);
    ra.appendChild(watchlistBtn());
    ra.appendChild(moreMenu(it));
    return ra;
  }
  async function item(id, g) {
    if (!ID.test(id)) return status('Not found');
    view.textContent = ''; loading();
    const it = await invoke('browse_item', { id }); if (g !== gen) return;
    if (MUSIC_KINDS.has(it.kind)) { view.textContent = ''; return status('Not found'); }
    const sec = sections.find(s => s.kind === ({ movie: 'movie', show: 'show', season: 'show', episode: 'show' }[it.kind]));
    mark(sec ? 'sec/' + sec.id : 'item');
    view.textContent = '';
    const shell = el('div', 'pxshell'); if (sessionStorage.getItem('pxR') === '1') shell.classList.add('ropen');
    const mid = el('div', 'pxcenter');
    shell.appendChild(mid); shell.appendChild(sidePanel(it, shell, g));
    const d = el('div', 'pxdet');
    const bd = backdrop(it); if (bd) view.appendChild(bd);
    const body = el('div', 'pxdbody'); d.appendChild(body);
    const ps = img(it.thumb, 260, 390); if (ps) { const p = el('img', 'pxposter'); p.alt = ''; p.src = ps; p.onerror = () => p.remove(); body.appendChild(p); }
    const tx = el('div', 'pxdtext'); body.appendChild(tx);
    if (it.kind === 'episode' || it.kind === 'season') { const ctx = el('div', 'pxctx'); const sh = el('a', 'pxup', it.kind === 'episode' ? it.grandparentTitle : it.parentTitle); sh.href = '#px/item/' + (it.kind === 'episode' ? it.grandparentId : it.parentId); ctx.appendChild(sh);
      if (it.kind === 'episode') { ctx.appendChild(el('span', 'muted', ' › ')); const se = el('a', 'pxup', 'Season ' + (it.parentIndex ?? '?')); se.href = '#px/item/' + it.parentId; ctx.appendChild(se); ctx.appendChild(el('span', 'muted', ' · Episode ' + (it.index ?? '?'))); }
      tx.appendChild(ctx); }
    tx.appendChild(el('h1', 'pxh', it.title));
    const aired = it.aired ? new Date(it.aired + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const facts = [it.kind === 'episode' && aired ? 'Aired ' + aired : it.year, it.contentRating, it.durationMs ? ms(it.durationMs) : '', it.criticRating != null ? 'Critics ' + it.criticRating.toFixed(1) : '', it.audienceRating != null ? 'Audience ★ ' + it.audienceRating.toFixed(1) : (it.criticRating == null && it.rating != null ? '★ ' + it.rating.toFixed(1) : ''), it.studio].filter(Boolean);
    const fl = el('div', 'muted pxfacts', facts.join(' · ')); const lf = left(it); if (lf) { fl.appendChild(el('span', 'pxleft', lf)); }
    const rz = it.media && it.media[0] && fmtRes(it.media[0].videoResolution); if (rz) fl.appendChild(el('span', 'pxres', rz)); tx.appendChild(fl);
    if (it.tagline) tx.appendChild(el('p', 'pxtag', it.tagline));
    if (it.genres.length) { const gl = el('div', 'pxgenres'); it.genres.forEach(x => gl.appendChild(el('span', 'pxgenre', x))); tx.appendChild(gl); }
    if (it.summary) tx.appendChild(el('p', 'pxsum', it.summary));
    // Action row sits above credits so Play stays on screen (not under the photo row).
    if (it.kind === 'movie' || it.kind === 'episode') tx.appendChild(playRow(it));
    else if (it.kind === 'show' || it.kind === 'season') { const ra = el('div', 'pxround'); ra.appendChild(watchlistBtn()); ra.appendChild(moreMenu(it)); tx.appendChild(ra); }
    const srvNames = [...new Set((it.versions || []).map(v => v.server).filter(s => typeof s === 'string' && s))];
    if (srvNames.length > 1) {
      const avl = el('p', 'muted small pxavail'); avl.appendChild(document.createTextNode('Available on '));
      srvNames.forEach((s, i) => { if (i) avl.appendChild(document.createTextNode(' · ')); avl.appendChild(el('span', null, s)); });
      tx.appendChild(avl);
    }
    // da Vinci SHOULD-6: the single Versions list (the only place "Preferred" can appear), including one copy.
    if ((it.versions || []).length || it.versionsPending) {
      tx.appendChild(el('h4', 'pxvh', 'Versions'));
      if ((it.versions || []).length) tx.appendChild(versionsList(it));
      if (it.versionsPending) tx.appendChild(el('span', 'muted small pxvpend', 'Checking other servers…'));
    }
    const ready = readyLine(it); if (ready) tx.appendChild(ready);
    const fln = fileLine(it); if (fln) tx.appendChild(fln);
    // Key credits under the actions; "Full cast" scrolls to the photo row below.
    const cr = el('dl', 'pxcredits'); const crow = (k, v, more) => { if (!v) return; cr.appendChild(el('dt', 'muted', k)); const dd = el('dd', null, v); if (more) { const a = el('button', 'pxlink', more); a.type = 'button'; a.onclick = () => { const h = d.querySelector('.pxheads'); if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; dd.appendChild(document.createTextNode(' ')); dd.appendChild(a); } cr.appendChild(dd); };
    const mainCast = it.cast.filter(c => !/^guest/i.test(c.role)), guests = it.cast.filter(c => /^guest/i.test(c.role));
    crow('Starring', mainCast.slice(0, 4).map(c => c.name).join(', '), it.cast.length ? 'Full cast' : '');
    crow('Guest stars', guests.slice(0, 4).map(c => c.name).join(', '));
    crow(it.directors.length > 1 ? 'Directors' : 'Director', it.directors.join(', ')); crow(it.writers.length > 1 ? 'Writers' : 'Writer', it.writers.join(', '));
    if (cr.childNodes.length) tx.appendChild(cr);
    const acts = el('div', 'pxacts'); acts.appendChild(panelBtn('Chapters & Up Next', 'list', shell)); tx.appendChild(acts);
    if (it.cast.length) { const cs = el('section', 'pxheads'); cs.appendChild(el('h2', 'pxrowh', it.kind === 'episode' ? 'Cast & guest stars' : 'Credits')); const r = el('div', 'pxheadrow');
      it.cast.slice(0, 20).forEach(x => { const p = el(ID.test(x.id || '') ? 'a' : 'button', 'pxcred'); p.title = x.name; if (p.tagName === 'A') { p.href = '#px/person/' + x.id; p.onclick = e => { e.preventDefault(); openPerson(p, x.id, it); }; } else { p.type = 'button'; p.onclick = () => openPersonLocal(p, x, it); } const av = el('i', null, x.name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2)); const ps = img(x.thumb, 240, 240); if (ps) { const pi = el('img'); pi.alt = ''; pi.loading = 'lazy'; pi.src = ps; pi.onerror = () => pi.remove(); av.appendChild(pi); } p.appendChild(av); p.appendChild(el('b', null, x.name)); p.appendChild(el('span', 'muted small', x.role)); r.appendChild(p); });
      cs.appendChild(r); d.appendChild(cs); }
    mid.appendChild(d); view.appendChild(shell);
    if (it.versionsPending) armPendingRefresh(it.id, g);
    if (it.kind === 'episode' && ID.test(it.parentId || '')) invoke('browse_children', { id: it.parentId }).then(k => { if (g !== gen) return;
      const nv = el('div', 'pxacts pxepnav'); const lnk = (x, lab) => { const a = el('a', 'px-btn', lab + (x ? ' · E' + (x.index ?? '?') + ' ' + x.title : '')); if (x) a.href = '#px/item/' + x.id; else a.classList.add('off'); nv.appendChild(a); };
      lnk(k.find(x => x.index === (it.index ?? 0) - 1), '‹ Previous'); lnk(k.find(x => x.index === (it.index ?? 0) + 1), 'Next ›'); tx.appendChild(nv); }).catch(() => {});
    // fu7e: Related row at the very bottom (movies and shows), merged across servers in Rust.
    const relBox = ['movie', 'show'].includes(it.kind) ? el('section', 'pxrelated') : null;
    if (relBox) { mid.appendChild(relBox); invoke('browse_related', { id }).then(list => { if (g !== gen) return; const r = row('Related', list); if (r) relBox.appendChild(r); else relBox.remove(); }).catch(() => relBox.remove()); }
    if (['show', 'season'].includes(it.kind)) {
      const kids = await invoke('browse_children', { id }); if (g !== gen) return;
      const label = { show: 'Seasons', season: 'Episodes' }[it.kind];
      const r = row(label, kids, it.kind === 'season'); if (r) relBox ? mid.insertBefore(r, relBox) : mid.appendChild(r);
    }
  }
  // ---- fu7e: person page. Photo, name, born, bio and one filmography merged across servers.
  async function person(id, g) {
    if (!ID.test(id)) return status('Not found');
    view.textContent = ''; loading();
    const pv = await invoke('browse_person', { id }); if (g !== gen) return;
    mark('person'); view.textContent = ''; const pb = backdrop((pv.items || []).find(x => x.art || x.thumb)); if (pb) view.appendChild(pb); personInto(view, pv);
  }
  // fu7f: clicking a person opens the popover over the current page; the page never changes.
  // fu7f: the popover carries the page's own dimmed backdrop (same .pxbackdrop style as the title page).
  function pmBackdrop(it) { pmd.querySelectorAll(':scope>.pxbackdrop').forEach(n => n.remove()); const b = it && backdrop(it); if (b) pmd.insertBefore(b, pmd.firstChild); }
  async function openPerson(trigger, id, it) {
    if (!ID.test(id)) return;
    const my = ++pmGen; pmb.textContent = ''; pmBackdrop(it); loading(pmb); pm.open(trigger);
    try { const pv = await invoke('browse_person', { id }); if (my !== pmGen || !pm.isOpen) return; pmb.textContent = ''; personInto(pmb, pv); }
    catch (e) { if (my === pmGen) { pmb.textContent = ''; pmb.appendChild(el('p', 'muted pxstatus', loadErrorText('person', e, hooks.why))); } }
  }
  function openPersonLocal(trigger, x, it) {
    ++pmGen; pmb.textContent = ''; pmBackdrop(it);
    personInto(pmb, { name: x.name, thumb: x.thumb, bio: x.role ? 'As ' + x.role : '', items: [], noFilm: true }); pm.open(trigger);
  }
  function personInto(view, pv) {
    const hd = el('div', 'pxperson');
    const av = el('i', 'pxpav', (pv.name || '?').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2));
    const u = img(pv.thumb, 220, 220); if (u) { const pi = el('img'); pi.alt = ''; pi.src = u; pi.onerror = () => pi.remove(); av.appendChild(pi); }
    hd.appendChild(av);
    const tx = el('div', 'pxptext'); const h1 = el('h1', 'pxh', pv.name || 'Unknown'); if (view === pmb) h1.id = 'pxpmTitle'; tx.appendChild(h1);
    const born = pv.born ? new Date(pv.born + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const facts = [born ? 'Born ' + born : '', pv.birthplace].filter(Boolean).join(' · '); if (facts) tx.appendChild(el('div', 'muted pxfacts', facts));
    if (pv.bio) { const b = el('p', 'pxsum pxbio', pv.bio); tx.appendChild(b); if (pv.bio.length > 420) { b.classList.add('clamp'); const m = el('button', 'pxlink', 'More'); m.type = 'button'; m.onclick = () => { const c = b.classList.toggle('clamp'); m.textContent = c ? 'More' : 'Less'; }; tx.appendChild(m); } }
    const srcs = (pv.sources || []).filter(x => typeof x === 'string').slice(0, 6); if (srcs.length > 1) tx.appendChild(el('div', 'pxsrc small', 'On ' + srcs.join(' · ')));
    hd.appendChild(tx); view.appendChild(hd);
    view.appendChild(el('h2', 'row-title', 'Filmography' + (pv.items.length ? ` · ${pv.items.length}` : '')));
    if (!pv.items.length) { view.appendChild(el('p', 'muted', pv.noFilm ? 'This server has no person page for them.' : 'No titles with this person in your libraries.')); return; }
    const gr = el('div', 'grid pxgrid'); pv.items.forEach(x => gr.appendChild(poster(x))); view.appendChild(gr);
  }
  // ---- fu6: one search surface. The Search rail item, the "Ask your library" button,
  // Ctrl/Cmd-K and #px/search/<q> all open this overlay (the demo palette stays demo-only).
  // Results are grouped by type (one group per server hub), with type filters,
  // ↑/↓ + Enter, Tab / Shift-Tab across types, and Esc to close.
  const pk = el('div', 'pxso'); pk.id = 'pxPalette'; pk.hidden = true; pk.setAttribute('role', 'dialog'); pk.setAttribute('aria-modal', 'true'); pk.setAttribute('aria-label', 'Search your library');
  const pkc = el('div', 'pxsocard'); pk.appendChild(pkc);
  const phd = el('div', 'pxsohd'); phd.appendChild(pxIcon('search')); pkc.appendChild(phd);
  const pin = el('input', 'pxsoin'); pin.type = 'search'; pin.placeholder = 'Search movies, shows, episodes and people'; pin.maxLength = 100; pin.setAttribute('aria-label', 'Search your library'); pin.setAttribute('role', 'combobox'); pin.setAttribute('aria-controls', 'pxsoOut'); pin.setAttribute('aria-expanded', 'true'); pin.autocomplete = 'off'; phd.appendChild(pin);
  const pesc = el('button', 'pxsoesc', 'Esc'); pesc.type = 'button'; pesc.title = 'Close search'; pesc.onclick = () => pkClose(); phd.appendChild(pesc);
  const pfl = el('div', 'pxsofl'); pfl.setAttribute('role', 'tablist'); pfl.setAttribute('aria-label', 'Result type'); pkc.appendChild(pfl);
  const pout = el('div', 'pxsoout'); pout.id = 'pxsoOut'; pout.setAttribute('role', 'listbox'); pkc.appendChild(pout);
  const pft = el('div', 'pxsoft muted small'); [['↑↓', 'move'], ['Enter', 'open'], ['Tab', 'type'], ['Esc', 'close']].forEach(([k, t]) => { const s = el('span'); s.appendChild(el('kbd', null, k)); s.appendChild(document.createTextNode(' ' + t)); pft.appendChild(s); }); pkc.appendChild(pft);
  document.body.appendChild(pk);
  const KINDIC = { movie: 'film', show: 'tv', season: 'tv', episode: 'tv', artist: 'music', album: 'music', track: 'music', person: 'profile', photo: 'photo', playlist: 'playlist' };
  let pkt, pkg = 0, pksel = 0, pkHubs = [], pkType = 'all';
  const pkItems = () => [...pout.querySelectorAll('a.pxsor')];
  const pkMark = () => pkItems().forEach((a, i) => { const y = i === pksel; a.classList.toggle('on', y); a.setAttribute('aria-selected', String(y)); if (y) { pin.setAttribute('aria-activedescendant', a.id); a.scrollIntoView({ block: 'nearest' }); } });
  function pkHint(t, sub) { const w = el('div', 'pxsoempty'); w.appendChild(pxIcon('search')); w.appendChild(el('b', null, t)); if (sub) w.appendChild(el('span', 'muted small', sub)); pout.appendChild(w); }
  function pkRender() {
    pout.textContent = ''; pfl.textContent = ''; pksel = 0; pin.removeAttribute('aria-activedescendant');
    const hubs = pkHubs.filter(h => h.items && h.items.length);
    if (!hubs.length) return;
    if (pkType !== 'all' && !hubs.some(h => h.title === pkType)) pkType = 'all';
    [['all', 'All', hubs.reduce((n, h) => n + h.items.length, 0)], ...hubs.map(h => [h.title, h.title, h.items.length])].forEach(([k, t, n]) => {
      const b = el('button', 'pxsotab' + (k === pkType ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(k === pkType)); b.tabIndex = -1;
      b.appendChild(el('span', null, t)); b.appendChild(el('i', null, n)); b.onclick = () => { pkType = k; pkRender(); pin.focus(); }; pfl.appendChild(b); });
    let n = 0;
    hubs.filter(h => pkType === 'all' || h.title === pkType).forEach(h => {
      const g = el('section', 'pxsogrp'); g.appendChild(el('h4', null, h.title));
      h.items.slice(0, pkType === 'all' ? 6 : 40).forEach(x => {
        const a = el('a', 'pxsor'); a.href = '#px/item/' + x.id; a.id = 'pxsor' + n++; a.setAttribute('role', 'option'); a.onclick = () => pkClose();
        const th = el('span', 'pxsoth' + (x.kind === 'episode' ? ' wide' : '') + (x.kind === 'person' ? ' round' : '')); const u = img(x.thumb, x.kind === 'episode' ? 96 : 48, x.kind === 'episode' ? 54 : 72);
        if (u) { const i = el('img'); i.alt = ''; i.loading = 'lazy'; i.src = u; i.onerror = () => i.remove(); th.appendChild(i); } else th.appendChild(pxIcon(KINDIC[x.kind] || 'folder'));
        a.appendChild(th); const tx = el('span', 'pxsotx');
        tx.appendChild(el('b', null, x.kind === 'episode' && x.grandparentTitle ? x.grandparentTitle : x.title));
        tx.appendChild(el('span', 'muted small', (x.kind === 'episode' ? [`S${x.parentIndex ?? '?'} · E${x.index ?? '?'}`, x.title] : [x.year]).filter(Boolean).join(' · ')));
        a.appendChild(tx); a.appendChild(el('span', 'pxsok', x.kind || '')); a.onmousemove = () => { const i = pkItems().indexOf(a); if (i !== pksel) { pksel = i; pkMark(); } };
        g.appendChild(a); });
      pout.appendChild(g); });
    pkMark();
  }
  async function pkRun() {
    const my = ++pkg, v = pin.value.trim(); pkHubs = [];
    if (!v) { pout.textContent = ''; pfl.textContent = ''; pkHint('Search your library', 'Titles, people and episodes on ' + (server || 'your server') + '.'); return; }
    pk.classList.add('busy');
    try { const hubs = await invoke('browse_search', { query: v }); if (my !== pkg) return; pkHubs = (hubs || []).map(h => ({ ...h, items: dropMusic(h.items) })).filter(h => h.items.length); pkRender();
      if (!pout.children.length) pkHint('No results for “' + v + '”', 'Try a shorter title or a person’s name.');
    } catch (e) { if (my === pkg) { pout.textContent = ''; pfl.textContent = ''; pkHint('Search failed', hooks.why ? hooks.why(e) : 'Something went wrong. Try again.'); } }
    finally { if (my === pkg) pk.classList.remove('busy'); }
  }
  let pkAt = 0, pkFocus = null;
  function pkOpen(q) { pkAt = Date.now(); if (pk.hidden) pkFocus = document.activeElement; pk.hidden = false; document.body.classList.add('pxsoopen'); pkType = 'all'; pin.value = typeof q === 'string' ? q : ''; pkRun(); setTimeout(() => { pin.focus(); pin.select(); }, 0); }
  function pkClose() { if (pk.hidden) return; pk.hidden = true; document.body.classList.remove('pxsoopen'); if (pkFocus && pkFocus.focus && document.contains(pkFocus)) pkFocus.focus(); pkFocus = null; }
  pin.oninput = () => { clearTimeout(pkt); pkt = setTimeout(pkRun, 180); };
  pk.addEventListener('mousedown', e => { if (e.target === pk) pkClose(); });
  pk.addEventListener('keydown', e => { const n = pkItems();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!n.length) return; pksel = (pksel + (e.key === 'ArrowDown' ? 1 : -1) + n.length) % n.length; pkMark(); }
    else if (e.key === 'Enter' && n[pksel]) { e.preventDefault(); location.hash = n[pksel].getAttribute('href'); pkClose(); }
    else if (e.key === 'Tab') { e.preventDefault(); const t = [...pfl.children]; if (!t.length) return; const i = t.findIndex(b => b.classList.contains('on')); t[(i + (e.shiftKey ? -1 : 1) + t.length) % t.length].click(); } });
  addEventListener('keydown', e => {
    if (!on) return;
    const nd = navInput(e); if (nd && !pm.isOpen && pk.hidden && navGo(nd)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); if (pk.hidden) pkOpen(); else if (Date.now() - pkAt > 400) pkClose(); }
    else if (e.key === 'Escape' && !pk.hidden) { e.preventDefault(); e.stopImmediatePropagation(); pkClose(); }
    else if (e.key === 'Escape' && String(location.hash || '').indexOf('#px/') === 0) { const sh = document.querySelector('.pxshell.ropen'); if (sh) { e.preventDefault(); e.stopImmediatePropagation(); sh.classList.remove('ropen'); sessionStorage.setItem('pxR', '0'); sh.dispatchEvent(new Event('pxsync')); } }
  }, true);
  addEventListener('click', e => { if (on && e.target.closest && e.target.closest('#askBtn')) { e.preventDefault(); e.stopImmediatePropagation(); pkOpen(); } }, true);
  main.addEventListener('scroll', () => { if (!swap.active) sm.save(); if (onScroll) onScroll(); }, { passive: true });
  addEventListener('resize', () => { if (on) view.querySelectorAll('.pxstrip').forEach(syncArrows); if (onScroll && on) onScroll(true); });

  async function route() {
    if (!on) return;
    let h = location.hash || '#home';
    if (h === '#home' || h === '#') { go('#px/home'); return; }
    const isPx = h.startsWith('#px/');
    document.body.classList.toggle('pxroute', isPx); view.hidden = !isPx; clearCollage();
    if (!isPx) { bk.hidden = true; swap.end(); mark(h === '#settings' ? 'settings' : ''); return; }
    pm.close(false); sm.save(); const back = sm.enter(); bk.hidden = false; bkb.disabled = sm.index <= 0; fwb.disabled = !sm.canForward; swap.begin(); const g = ++gen; onScroll = null; const [, kind, ...rest] = h.split('/'); const part = rest.map(x => { try { return decodeURIComponent(x); } catch { return ''; } });
    main.scrollTop = 0;
    if (hooks.navDelay) { const d = hooks.navDelay(); if (d) await new Promise(r => setTimeout(r, d)); if (g !== gen) return; } // mock builds only
    try {
      if (kind === 'home') await home(g);
      else if (kind === 'sec') await section(part[0], part[1], part[2], part.slice(3).join('/'), g);
      else if (kind === 'item') await item(part[0], g);
      else if (kind === 'person') await person(part[0], g);
      else if (kind === 'search') { pkOpen(part.join('/')); history.replaceState(null, '', '#px/home'); await home(g); }
      else status('Not found');
    } catch (e) { if (g === gen) fail(e, kind); }
    if (g !== gen) return;
    swap.end();
    if (back != null) restoreScroll(back, g);
  }
  // Grids grow as they scroll, so restore in a few steps until the page is tall enough.
  function restoreScroll(y, g, n = 0) {
    main.scrollTop = y; if (onScroll) onScroll(true);
    if (Math.abs(main.scrollTop - y) > 2 && n < 20 && g === gen) setTimeout(() => restoreScroll(y, g, n + 1), 50);
  }
  addEventListener('hashchange', route);
  // fu7b: slow servers answer after the soft deadline; Rust emits plex-merge-fill (no payload).
  // Home re-reads its rows. A title page must re-read too: Versions are gathered with the same
  // soft deadline, and the first paint keeps `versionsPending` until this event (or the fallback).
  let fillT = 0, pendT = 0, pendTries = 0, pendId = '';
  function refillMerged() {
    if (!on) return;
    const h = location.hash || '';
    const home = /^#px\/home$/.test(h);
    const itemPending = /^#px\/item\//.test(h) && !!view.querySelector('.pxvpend');
    if (!home && !itemPending) return;
    const y = main.scrollTop;
    route().then(() => { if (on) main.scrollTop = y; });
  }
  function armPendingRefresh(id, g0) {
    if (pendId !== id) { pendId = id; pendTries = 0; }
    if (pendTries >= 8) return;
    pendTries++;
    clearTimeout(pendT);
    pendT = setTimeout(() => { if (g0 === gen && view.querySelector('.pxvpend')) refillMerged(); }, 4000);
  }
  if (hooks.listen) hooks.listen('plex-merge-fill', () => { clearTimeout(fillT); fillT = setTimeout(refillMerged, 400); });
  return {
    // Called with each source change: Plex → browse views; demo → app.js views.
    setSource(s) {
      const was = on, prev = server; srcGen++; on = s && s.kind === 'plex'; server = on ? String(s.server || '') : ''; conn = on ? String(s.connection || '') : '';
      document.body.classList.toggle('plexmode', on); nav.hidden = !on;
      if (!on) { pkClose(); view.hidden = true; view.textContent = ''; nav.textContent = ''; document.body.classList.remove('pxroute'); if (location.hash.startsWith('#px/')) go('#home'); }
      // Every connect (including a switch to another server) reloads the library list,
      // so the categories never disappear after picking a server.
      else if (!was || prev !== server || s.reload) { sections = []; loadSections(); if (was && location.hash !== '#px/home') go('#px/home'); else route(); }
      else renderNav();
    },
  };
}
