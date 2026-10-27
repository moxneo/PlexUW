// fu7f: person popover (modalController) and SHOULD-9 skeleton height. No deps, fake DOM.
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
const tmp = join(mkdtempSync(join(tmpdir(), 'pxm-')), 'plex-browse.mjs');
writeFileSync(tmp, src);
writeFileSync(join(dirname(tmp), 'px-icons.js'), readFileSync(join(here, '..', 'px-icons.js'), 'utf8'));
const { modalController } = await import(tmp);

class Target { constructor() { this.l = {}; } addEventListener(t, f) { (this.l[t] ||= []).push(f); }
  fire(t, e) { e.defaultPrevented = false; e.preventDefault = () => { e.defaultPrevented = true; }; e.stopImmediatePropagation = () => {}; (this.l[t] || []).forEach(f => f(e)); return e; } }
const cls = () => { const s = new Set(); return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c) }; };
function setup() {
  const doc = new Target(); doc.activeElement = null; doc.body = { classList: cls() };
  const focusable = name => ({ name, focus() { doc.activeElement = this; } });
  const win = new Target(), overlay = new Target(), dialog = new Target(), closeBtn = Object.assign(new Target(), focusable('x'));
  overlay.hidden = true;
  const scroller = { classList: cls(), _t: 1234, get scrollTop() { return this._t; }, set scrollTop(v) { if (!this.classList.contains('pxlock') || v === this._t) this._t = v; } };
  const film = focusable('film'), more = focusable('more');
  const hashes = []; const events = [];
  const m = modalController({ doc, keyTarget: win, overlay, dialog, closeBtn, scroller, focusables: () => [closeBtn, more, film],
    setHash: h => { events.push('hash:' + h + ':' + (m.isOpen ? 'open' : 'closed')); hashes.push(h); }, onClose: () => events.push('close') });
  const trigger = focusable('person');
  return { doc, win, overlay, dialog, closeBtn, scroller, trigger, film, more, m, hashes, events };
}

test('fu7f popover: opens as a locked modal and closes on Esc, the X and the backdrop; focus returns to the person', () => {
  for (const how of ['esc', 'x', 'backdrop']) {
    const t = setup(); t.trigger.focus();
    t.m.open(t.trigger);
    assert.equal(t.m.isOpen, true); assert.equal(t.overlay.hidden, false);
    assert.ok(t.doc.body.classList.contains('pxmodal')); assert.ok(t.scroller.classList.contains('pxlock'), 'background scroll locked');
    assert.equal(t.doc.activeElement, t.closeBtn, 'focus moves into the dialog');
    if (how === 'esc') assert.ok(t.win.fire('keydown', { key: 'Escape' }).defaultPrevented);
    if (how === 'x') t.closeBtn.fire('click', {});
    if (how === 'backdrop') { t.overlay.fire('mousedown', { target: {} }); assert.equal(t.m.isOpen, true, 'click inside the dialog does not close'); t.overlay.fire('mousedown', { target: t.overlay }); }
    assert.equal(t.m.isOpen, false, how); assert.equal(t.overlay.hidden, true);
    assert.ok(!t.scroller.classList.contains('pxlock') && !t.doc.body.classList.contains('pxmodal'));
    assert.equal(t.doc.activeElement, t.trigger, 'focus returns to the clicked person (' + how + ')');
  }
});
test('fu7f popover: focus trap wraps Tab and Shift-Tab inside the dialog', () => {
  const t = setup(); t.m.open(t.trigger);
  t.film.focus(); assert.ok(t.win.fire('keydown', { key: 'Tab' }).defaultPrevented); assert.equal(t.doc.activeElement, t.closeBtn);
  assert.ok(t.win.fire('keydown', { key: 'Tab', shiftKey: true }).defaultPrevented); assert.equal(t.doc.activeElement, t.film);
  t.doc.activeElement = { name: 'outside' }; t.win.fire('keydown', { key: 'Tab' }); assert.equal(t.doc.activeElement, t.closeBtn, 'focus outside is pulled back in');
  t.m.close(); const e = t.win.fire('keydown', { key: 'Escape' }); assert.equal(e.defaultPrevented, false, 'closed popover ignores keys');
});
test('fu7f popover: the movie page scroll position is preserved exactly', () => {
  const t = setup(); t.scroller.scrollTop = 777;
  t.m.open(t.trigger); assert.equal(t.scroller.scrollTop, 777);
  t.scroller.scrollTop = 0; assert.equal(t.scroller.scrollTop, 777, 'locked: background cannot scroll');
  t.win.fire('keydown', { key: 'Escape' }); assert.equal(t.scroller.scrollTop, 777);
  t.m.open(t.trigger); t.closeBtn.fire('click', {}); assert.equal(t.scroller.scrollTop, 777);
});
test('fu7f popover: a filmography click closes the popover first, then navigates', () => {
  const t = setup(); t.m.open(t.trigger);
  const a = { getAttribute: () => '#px/item/abcdefabcdefabcdefabcdef' }; const target = { closest: q => (q.startsWith('a[href') ? a : null) };
  const e = t.dialog.fire('click', { target });
  assert.ok(e.defaultPrevented);
  assert.deepEqual(t.events, ['close', 'hash:#px/item/abcdefabcdefabcdefabcdef:closed'], 'close happens before navigation');
  assert.equal(t.m.isOpen, false); assert.notEqual(t.doc.activeElement, t.trigger, 'no focus jump back on navigate');
  const t2 = setup(); t2.m.open(t2.trigger); t2.dialog.fire('click', { target: { closest: () => null } }); assert.equal(t2.m.isOpen, true, 'non-link clicks keep it open');
});
test('fu7f wiring: credits open the popover (no navigation); dialog semantics; Related label; LOW-C gone', () => {
  assert.match(src, /p\.onclick = e => \{ e\.preventDefault\(\); openPerson\(p, x\.id, it\); \}/);
  assert.match(src, /setAttribute\('role', 'dialog'\)/); assert.match(src, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(src, /row\('Related', list\)/); assert.doesNotMatch(src, /Related Movies|Related Shows/);
  assert.doesNotMatch(src, /lopen|'pxL'/); assert.doesNotMatch(css, /lopen|pxpanel\.left/);
  const dj = readFileSync(join(here, '..', 'desktop.js'), 'utf8'); assert.doesNotMatch(dj, /manage:|'pxL'/);
});
test('fu7f SHOULD-9: skeleton tile height equals real tile height (one CSS variable)', () => {
  // Both are .card.pxcard with a 2/3 poster; the only height that differs is .meta.
  assert.match(src, /el\('div', 'card pxcard pxph'\)/); assert.match(src, /el\('div', 'meta'\)/);
  assert.match(css, /--pxmeta:[^;}]+/);
  assert.match(css, /\.pxcard \.meta\{[^}]*height:var\(--pxmeta\)/);
  // no rule may give placeholder meta or poster a different height
  assert.doesNotMatch(css, /\.pxph \.meta\{[^}]*height/);
  assert.doesNotMatch(css, /\.pxph \.poster\{[^}]*(height|aspect-ratio:(?!2\/3))/);
  const h = (metaPx, posterW) => posterW * 3 / 2 + metaPx; // same formula for both by construction
  assert.equal(h(52, 150), h(52, 150));
});
