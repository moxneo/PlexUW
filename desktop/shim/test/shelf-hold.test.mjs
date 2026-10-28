// Home → Movies must keep the already-painted shelf <img> nodes on screen.
// A clone replayed the poster fade and left empty tiles for ~0.28s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const here = dirname(fileURLToPath(import.meta.url));
const esbuild = join(here, '..', '..', 'node_modules', '.bin', 'esbuild');
const bundle = execFileSync(esbuild, [join(here, '..', 'plex-browse.js'), '--bundle', '--format=iife', '--global-name=PXB', '--log-level=error'], { encoding: 'utf8' });

const SEC = 'a'.repeat(24);
const A = 'b'.repeat(32);
const B = 'c'.repeat(32);
const home = {
  sections: [{ id: SEC, kind: 'movie', title: 'Movies' }],
  continueWatching: [
    { id: 'd'.repeat(24), kind: 'movie', title: 'Coven Academy', year: 2024, poster: A },
    { id: 'e'.repeat(24), kind: 'movie', title: 'Chompy & the Girls', year: 2020, poster: B },
  ],
  onDeck: [], hubs: [],
};
let hubsGo;
const hubsGate = new Promise(r => { hubsGo = r; });
function invoke(cmd) {
  if (cmd === 'browse_home') return Promise.resolve(home);
  if (cmd === 'prefs_get') return Promise.resolve({});
  if (cmd === 'prefs_set') return Promise.resolve({});
  if (cmd === 'browse_section_hubs') return hubsGate.then(() => [{ title: 'Recently Added', ident: 'recent', items: [{ id: 'f'.repeat(24), kind: 'movie', title: 'Anaconda', year: 1997, poster: A }] }]);
  if (cmd === 'browse_section') return Promise.resolve({ total: 0, items: [] });
  if (cmd === 'browse_facet' || cmd === 'browse_letters') return Promise.resolve([]);
  return Promise.resolve(null);
}
const wait = ms => new Promise(r => setTimeout(r, ms));

test('Home → Movies holds the painted shelf imgs, then Home gets those same nodes back', async () => {
  const dom = new JSDOM('<body><div id="nav"></div><main id="main"></main></body>', {
    url: 'http://plexuw.test/#px/home', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.eval(bundle);
  const pb = w.PXB.mountPlexBrowse(invoke, {});
  pb.setSource({ kind: 'plex', server: 'Fixture', connection: 'local' });
  let imgs = [];
  for (let i = 0; i < 40 && imgs.length < 1; i++) {
    await wait(25);
    imgs = [...w.document.querySelectorAll('#pxView .pxcard .poster img')];
  }
  assert.ok(imgs.length >= 1, 'continue-watching posters painted');
  imgs.forEach(img => img.classList.add('in'));
  const poster = imgs[0].parentElement;
  w.location.hash = '#px/sec/' + SEC;
  let ghost = null;
  for (let i = 0; i < 20 && !ghost; i++) { await wait(15); ghost = w.document.querySelector('.pxghost'); }
  assert.equal(ghost.contains(imgs[0]), true, 'shelf img is the original node');
  assert.equal(poster.contains(imgs[0]), true);
  assert.equal(w.document.getElementById('pxView').contains(imgs[0]), false);
  assert.equal(imgs[0].style.opacity, '1', 'painted poster does not restart the fade');
  assert.equal(imgs[0].style.transition, 'none');
  hubsGo();
  for (let i = 0; i < 40 && w.document.querySelector('.pxghost'); i++) await wait(25);
  assert.equal(w.document.querySelector('.pxghost'), null, 'hold drops after the destination paints');
  assert.equal(imgs[0].isConnected, false, 'park keeps the node off-screen, it does not destroy it');
  w.location.hash = '#px/home';
  await wait(50);
  assert.equal(w.document.getElementById('pxView').contains(imgs[0]), true, 'return trip reattaches the same poster');
  assert.equal(imgs[0].parentElement, poster);
  w.close();
});
