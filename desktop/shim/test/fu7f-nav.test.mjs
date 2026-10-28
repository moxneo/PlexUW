// fu7f round 2: app-level back stack with scroll restore, Alt+Left / mouse 4, page swap without raw loading text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'plex-browse.js'), 'utf8');
const css = readFileSync(join(here, '..', 'desktop.css'), 'utf8');
globalThis.navigator ??= { userAgent: 'node' };
const tmp = join(mkdtempSync(join(tmpdir(), 'pxn-')), 'plex-browse.mjs');
writeFileSync(tmp, src);
writeFileSync(join(dirname(tmp), 'px-icons.js'), readFileSync(join(here, '..', 'px-icons.js'), 'utf8'));
const { scrollMemory, navInput, pageSwap } = await import(tmp);

// Minimal browser history: hash entries with state, back/forward.
function fakeHistory() {
  const h = { list: [{ url: '#px/home', state: null }], i: 0,
    get state() { return this.list[this.i].state; },
    replaceState(s) { this.list[this.i].state = s; },
    push(url) { this.list.splice(this.i + 1); this.list.push({ url, state: null }); this.i++; },
    back() { if (this.i > 0) this.i--; }, forward() { if (this.i < this.list.length - 1) this.i++; } };
  return h;
}

test('fu7f back stack: Back restores the previous page scroll; new pages start at the top', () => {
  const hist = fakeHistory(), sc = { scrollTop: 0 };
  const sm = scrollMemory({ scroller: sc, hist });
  // route() order: save (old entry) → enter (new entry)
  const nav = () => { sm.save(); return sm.enter(); };
  assert.equal(sm.enter(), null); assert.equal(sm.index, 0);
  sc.scrollTop = 1500;                       // scrolled the library
  hist.push('#px/item/a'); assert.equal(nav(), null, 'new page has no saved scroll'); assert.equal(sm.index, 1); sc.scrollTop = 0;
  sc.scrollTop = 300;                        // scrolled the movie page
  hist.push('#px/item/b'); assert.equal(nav(), null); assert.equal(sm.index, 2); sc.scrollTop = 0;
  hist.back(); assert.equal(nav(), 300, 'Back to the movie restores its scroll'); assert.equal(sm.index, 1); sc.scrollTop = 300;
  hist.back(); assert.equal(nav(), 1500, 'Back again restores the library scroll'); assert.equal(sm.index, 0);
  sc.scrollTop = 1500; hist.forward(); assert.equal(nav(), 300, 'Forward restores too');
  assert.ok(hist.list.every(e => e.state && typeof e.state.pxk === 'number'), 'each entry is keyed');
});

test('fu7f back stack: memory is bounded', () => {
  const hist = fakeHistory(), sc = { scrollTop: 5 };
  const sm = scrollMemory({ scroller: sc, hist, max: 3 });
  sm.enter(); for (let k = 0; k < 10; k++) { hist.push('#px/item/' + k); sm.save(); sm.enter(); }
  hist.i = 0; sm.save(); assert.equal(sm.enter(), null, 'oldest entry evicted');
});

test('fu7f nav input: Alt+Left / Alt+Right, mouse buttons 4 and 5', () => {
  assert.equal(navInput({ type: 'keydown', altKey: true, key: 'ArrowLeft' }), 'back');
  assert.equal(navInput({ type: 'keydown', altKey: true, key: 'ArrowRight' }), 'fwd');
  assert.equal(navInput({ type: 'keydown', altKey: false, key: 'ArrowLeft' }), null, 'plain arrows are not navigation');
  assert.equal(navInput({ type: 'keydown', altKey: true, ctrlKey: true, key: 'ArrowLeft' }), null);
  assert.equal(navInput({ type: 'mouseup', button: 3 }), 'back', 'mouse button 4');
  assert.equal(navInput({ type: 'mouseup', button: 4 }), 'fwd', 'mouse button 5');
  assert.equal(navInput({ type: 'mouseup', button: 0 }), null);
  assert.equal(navInput({ type: 'mouseup', button: 1 }), null);
});

// Tiny DOM for pageSwap.
function node(tag) { return { tagName: tag, children: [], parentNode: null, style: {}, attrs: {}, className: '', textContent_: '',
  classList: { s: new Set(), add(c) { this.s.add(c); }, contains(c) { return this.s.has(c); } },
  setAttribute(k, v) { this.attrs[k] = v; },
  get firstChild() { return this.children[0] || null; },
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; },
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); c.parentNode = null; },
  get textContent() { return this.textContent_ + this.children.map(c => c.textContent).join(''); },
  set textContent(v) { this.children.forEach(c => { c.parentNode = null; }); this.children = []; this.textContent_ = v; } }; }

test('fu7f page swap: the old page stays visible during navigation and no raw loading text appears', async () => {
  const doc = { body: node('body'), createElement: node };
  const view = node('div'); view.hidden = false; const sc = { scrollTop: 420, getBoundingClientRect: () => ({ top: 48, left: 240, width: 1000, height: 700 }) };
  const old = node('div'); old.textContent = 'Old movie page'; view.appendChild(old);
  const sw = pageSwap({ doc, scroller: sc, view, fadeMs: 1 });
  sw.begin();
  const g = doc.body.children[0];
  assert.ok(sw.active && g && g.className === 'pxghost', 'snapshot layer mounted');
  assert.equal(g.textContent, 'Old movie page', 'old page content kept on screen');
  const inner = g.children.find(c => c.className === 'pxghosti') || g.children.flatMap(c => c.children).find(c => c.className === 'pxghosti');
  assert.equal(inner.style.transform, 'translateY(-420px)', 'snapshot keeps the scroll offset');
  assert.equal(view.children.length, 0);
  // what route() renders under the snapshot while waiting: a skeleton, never text
  const sk = node('div'); sk.className = 'pxload'; view.appendChild(sk);
  for (const n of [view, g]) assert.doesNotMatch(n.textContent, /loading/i);
  sw.begin(); assert.equal(doc.body.children.length, 1, 'a second navigation reuses the snapshot');
  sw.end(); assert.ok(g.classList.contains('out'), 'crossfade out'); await new Promise(r => setTimeout(r, 60));
  assert.equal(doc.body.children.length, 0, 'snapshot removed after the fade'); assert.equal(sw.active, false);
});

test('page swap keeps the fanart on the viewport box, not the content column', () => {
  const doc = { body: node('body'), createElement: node };
  const view = node('div'); view.hidden = false;
  const sc = { scrollTop: 0, getBoundingClientRect: () => ({ top: 48, left: 240, width: 1000, height: 700 }) };
  const bd = node('div'); bd.className = 'pxbackdrop'; bd.classList.add('pxbackdrop');
  const old = node('div'); old.textContent = 'Library';
  view.appendChild(bd); view.appendChild(old);
  const sw = pageSwap({ doc, scroller: sc, view, fadeMs: 1 });
  sw.begin();
  const g = doc.body.children[0];
  const held = g.children.find(c => c.className === 'pxbackdrop');
  assert.ok(held, 'fanart stays with the snapshot');
  assert.equal(held.style.position, 'fixed');
  assert.equal(held.style.width, '100vw');
  assert.equal(held.style.height, '100vh');
  assert.equal(held.style.top, '0');
  assert.equal(held.style.left, '0');
  const clip = g.children.find(c => c.className === 'pxghostclip');
  assert.ok(clip, 'page content is clipped separately');
  assert.equal(clip.children.some(c => c.className === 'pxbackdrop'), false);
  assert.match(css, /\.pxghost\{[^}]*overflow:visible/);
  assert.match(css, /\.pxghost \.pxbackdrop\{[^}]*position:fixed/);
  assert.match(css, /\.pxghostclip\{[^}]*overflow:hidden/);
});

test('fu7f wiring: no raw loading text, back control, fade-in posters, show-page popover, dimmed backdrop', () => {
  assert.doesNotMatch(src, /'Loading…'|'Loading libraries…'/, 'no visible loading strings left');
  assert.match(src, /function loading\(target\) \{[^\n]*aria-label', 'Loading'[^\n]*pxsk/);
  assert.match(src, /pm\.close\(false\); sm\.save\(\); const back = sm\.enter\(\);[^\n]*swap\.begin\(\)/);
  assert.match(src, /swap\.end\(\);\n\s*if \(back != null\) restoreScroll\(back, g\);/);
  assert.match(src, /if \(d === 'back'\) \{ if \(sm\.index > 0\) history\.back\(\)/);
  assert.match(src, /else if \(sm\.canForward\) history\.forward\(\)/);
  assert.doesNotMatch(src, /pxbkb/);
  assert.match(src, /addEventListener\('mouseup'/);
  assert.match(src, /i\.className = 'pxfade'; i\.onload = \(\) => i\.classList\.add\('in'\)/);
  assert.match(css, /\.pxcard \.poster img\.pxfade\{opacity:0;transition:opacity/);
  // credits without a person id (seen on some show pages) still open the popover
  assert.match(src, /p\.onclick = \(\) => openPersonLocal\(p, x, it\)/);
  assert.match(src, /function pmBackdrop\(it\)/);
  assert.match(css, /\.pxpm\{[^}]*background:rgba\(14,14,16,\.72\)/);
  assert.match(css, /\.pxpmd>\.pxbackdrop\{position:absolute/);
  assert.match(src, /hooks\.navDelay/);
});
