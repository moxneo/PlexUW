// fu7g MUST-1: Back/Forward restores scroll with the REAL legacy app.js loaded (its hashchange
// handler runs first, exactly as in the app: app.js is a <script> before desktop.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const src = readFileSync(join(here, '..', 'plex-browse.js'), 'utf8');
globalThis.navigator ??= { userAgent: 'node' };
const tmp = join(mkdtempSync(join(tmpdir(), 'pxg-')), 'plex-browse.mjs');
writeFileSync(tmp, src);
writeFileSync(join(dirname(tmp), 'px-icons.js'), readFileSync(join(here, '..', 'px-icons.js'), 'utf8'));
const { scrollMemory, modalController } = await import(tmp);

// fu7h: a real DOM (jsdom) running the real index.html, data.js and app.js (its own route() and
// sPost hashchange handlers), then the real plex-browse.js bundle and its real mountPlexBrowse route(),
// in the same order as the app. Navigation goes through the real top-bar Back/Forward buttons.
import { JSDOM, VirtualConsole } from 'jsdom';
const esbuild = join(here, '..', '..', 'node_modules', '.bin', 'esbuild');
const pbBundle = execFileSync(esbuild, [join(here, '..', 'plex-browse.js'), '--bundle', '--format=iife', '--global-name=PXB', '--log-level=error'], { encoding: 'utf8' });
const W = ms => new Promise(r => setTimeout(r, ms));
async function loadApp(appSrc) {
  const html = readFileSync(join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://plexuw.test/#px/sec/1', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window;
  w.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.HTMLMediaElement.prototype.pause = () => {}; w.HTMLMediaElement.prototype.play = () => Promise.resolve(); w.HTMLMediaElement.prototype.load = () => {};
  const main = w.document.getElementById('main'); let st = 0; // jsdom has no layout: give #main a real, clamped scrollTop
  Object.defineProperty(main, 'scrollTop', { configurable: true, get: () => st, set: v => { st = Math.max(0, Math.min(6000, +v || 0)); } });
  const seen = []; const add = w.addEventListener.bind(w); w.addEventListener = (t, f, o) => { if (t === 'hashchange') seen.push(f.name || '?'); return add(t, f, o); };
  w.eval(readFileSync(join(root, 'data.js'), 'utf8'));
  w.eval(appSrc);
  w.eval(pbBundle);
  const PB = w.PXB.mountPlexBrowse(() => Promise.reject(new Error('offline fixture')), {});
  PB.setSource({ kind: 'plex', server: 'Fixture' });
  await W(200);
  const userScroll = y => { main.scrollTop = y; main.dispatchEvent(new w.Event('scroll')); };
  return { w, main, userScroll, seen, get top() { return st; } };
}

async function journey(app) {
  const { w, userScroll } = app;
  userScroll(1800);                                   // scroll the library to 1800 px
  w.location.hash = '#px/item/abc'; await W(250); const opened = app.top;
  userScroll(250);                                    // scroll the title page
  w.history.back(); await W(350); const afterBack = app.top, hBack = w.location.hash;
  w.history.forward(); await W(350); const afterFwd = app.top;
  w.history.back(); await W(350); const afterBack2 = app.top;
  w.close();
  return { opened, afterBack, hBack, afterFwd, afterBack2 };
}

test('fu7h MUST-1: real app.js route()/sPost + real plex-browse route(): history Back restores 1800 px, Forward restores the title page', async () => {
  const app = await loadApp(readFileSync(join(root, 'app.js'), 'utf8'));
  assert.deepEqual(app.seen.slice(0, 2), ['route', 'sPost'], 'app.js registers its real route() and sPost first');
  assert.equal(app.seen[2], 'route', 'then plex-browse registers its real route()');
  const r = await journey(app);
  assert.equal(r.opened, 0, 'a new page opens at the top');
  assert.equal(r.hBack, '#px/sec/1');
  assert.equal(r.afterBack, 1800, 'Back restores 1800 px');
  assert.equal(r.afterFwd, 250, 'Forward restores the title page scroll');
  assert.equal(r.afterBack2, 1800, 'Back again still restores 1800 px');
});

test('fu7h MUST-1 regression (no git needed): app.js without the #px/ guard loses the 1800 px', async () => {
  const cur = readFileSync(join(root, 'app.js'), 'utf8'), guard = "&&!h.startsWith('#px/')";
  assert.equal(cur.split(guard).length, 2, 'the fu7g guard is present exactly once');
  const r = await journey(await loadApp(cur.replace(guard, '')));
  assert.equal(r.afterBack, 0, 'reproduces da Vinci’s 1800 → 0');
});

test('fu7h MUST-1 regression: the fu7f commit 9e63b02 app.js loses the 1800 px (fails loudly without git)', async () => {
  let old;
  try { old = execFileSync('git', ['-C', root, 'show', '9e63b02:app.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { assert.fail('git (with commit 9e63b02) is required for this regression test: ' + String(e.message).split('\n')[0]); }
  const r = await journey(await loadApp(old));
  assert.equal(r.afterBack, 0, 'reproduces da Vinci’s 1800 → 0');
});

test('fu7g: Forward is disabled until there is forward history; a new page truncates it', () => {
  const hist = { list: [{ state: null }], i: 0, get state() { return this.list[this.i].state; }, replaceState(s) { this.list[this.i].state = s; },
    push() { this.list.splice(this.i + 1); this.list.push({ state: null }); this.i++; } };
  const sm = scrollMemory({ scroller: { scrollTop: 0 }, hist });
  sm.enter(); assert.equal(sm.canForward, false);
  hist.push(); sm.enter(); hist.push(); sm.enter(); assert.equal(sm.canForward, false, 'at the newest page');
  hist.i = 1; sm.enter(); assert.equal(sm.canForward, true, 'after Back');
  hist.i = 2; sm.enter(); assert.equal(sm.canForward, false, 'after Forward to the end');
  hist.i = 1; sm.enter(); hist.push(); sm.enter(); assert.equal(sm.canForward, false, 'a new page after Back drops forward history');
  const b = readFileSync(join(here, '..', 'plex-browse.js'), 'utf8');
  assert.doesNotMatch(b, /pxbkb/);
  assert.match(b, /else if \(sm\.canForward\) history\.forward\(\);/);
});

test('fu7g: outside-click close returns focus to the clicked person (browser default focus move prevented)', () => {
  class T { constructor() { this.l = {}; } addEventListener(t, f) { (this.l[t] ||= []).push(f); } fire(t, e) { e.defaultPrevented = false; e.preventDefault = () => { e.defaultPrevented = true; }; (this.l[t] || []).forEach(f => f(e)); return e; } }
  const cls = () => { const s = new Set(); return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c) }; };
  const doc = new T(); doc.body = { classList: cls(), name: 'body' }; doc.activeElement = doc.body;
  const fo = n => ({ name: n, focus() { doc.activeElement = this; } });
  const overlay = new T(), x = Object.assign(new T(), fo('x')), person = fo('person');
  const m = modalController({ doc, keyTarget: new T(), overlay, dialog: new T(), closeBtn: x, scroller: { classList: cls(), scrollTop: 0 }, focusables: () => [x], setHash() {}, onClose() {} });
  person.focus(); m.open(person); assert.equal(doc.activeElement, x);
  const e = overlay.fire('mousedown', { target: overlay });
  if (!e.defaultPrevented) doc.activeElement = doc.body; // what the browser does after mousedown on a non-focusable backdrop
  assert.equal(m.isOpen, false); assert.equal(e.defaultPrevented, true);
  assert.equal(doc.activeElement, person, 'focus is back on the person');
});

test('fu7g INFO-1: the whole __plexShot driver is gated behind __PLEXUW_MOCK__', () => {
  const d = readFileSync(join(here, '..', 'desktop.js'), 'utf8');
  const i = d.indexOf('if(__PLEXUW_MOCK__){'), j = d.indexOf('window.__plexShot');
  assert.ok(i > 0 && i < j, 'gate opens before the first __plexShot reference');
  const lastDelay = Math.max(d.lastIndexOf('fu7fBadge'), d.lastIndexOf('__pxNavDelay=')); assert.ok(lastDelay > i);
  assert.ok(!/__pxDelay|__pxNavDelay|__plexShot|fu7fBadge/.test(d.slice(0, d.indexOf('__PLEXUW_MOCK__?{pageDelay'))), 'no driver code before the gates');
});
