// Detail page: Chapters & Up Next is a real section, and the action row sits under it.
// Person page: a non-empty summary is the bio beside the face.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

const here = dirname(fileURLToPath(import.meta.url));
const esbuild = join(here, '..', '..', 'node_modules', '.bin', 'esbuild');
const bundle = execFileSync(esbuild, [join(here, '..', 'plex-browse.js'), '--bundle', '--format=iife', '--global-name=PXB', '--log-level=error'], { encoding: 'utf8' });
const css = readFileSync(join(here, '..', 'desktop.css'), 'utf8');

const ITEM = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PERSON = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const home = { sections: [{ id: '1', kind: 'movie', title: 'Movies' }], continueWatching: [], onDeck: [], hubs: [] };
const movie = {
  id: ITEM, kind: 'movie', title: 'Queen of the Damned', year: 2002, summary: 'The mother of all vampires.',
  genres: ['Horror'], directors: ['Michael Rymer'], writers: ['Scott Abbott'],
  cast: [{ id: PERSON, name: 'Aaliyah', role: 'Akasha' }],
  chapters: [], markers: [], versions: [], media: [], tracks: [],
};
const bio = 'Aaliyah Dana Haughton was an American singer and actress.';

function invoke(cmd) {
  if (cmd === 'browse_home') return Promise.resolve(home);
  if (cmd === 'browse_item') return Promise.resolve(movie);
  if (cmd === 'browse_person') return Promise.resolve({ name: 'Aaliyah', bio, items: [], sources: [] });
  if (cmd === 'browse_related' || cmd === 'browse_section_hubs') return Promise.resolve([]);
  return Promise.resolve([]);
}

const wait = ms => new Promise(r => setTimeout(r, ms));

test('actions render under Chapters & Up Next, and a summary fills the bio pane', async () => {
  assert.match(css, /\.pxperson\{display:grid;grid-template-columns:minmax\(160px,220px\) minmax\(0,1fr\)/);
  assert.match(css, /\.pxchup\{/);
  const dom = new JSDOM('<body><div id="nav"></div><main id="main"></main></body>', {
    url: 'http://plexuw.test/#px/home', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.eval(bundle);
  const pb = w.PXB.mountPlexBrowse(invoke, {});
  assert.ok(pb);
  pb.setSource({ kind: 'plex', server: 'Fixture' });
  w.location.hash = '#px/item/' + ITEM;
  await wait(80);
  const doc = w.document;
  const sec = doc.querySelector('#pxView section.pxchup');
  assert.ok(sec, doc.querySelector('#pxView') ? doc.querySelector('#pxView').textContent.slice(0, 400) : 'no view');
  assert.equal(sec.querySelector('h2').textContent, 'Chapters & Up Next');
  assert.equal(sec.querySelectorAll('.chrow').length, 0, 'an empty chapter list still keeps the heading');
  const play = doc.querySelector('#pxView .pxround');
  assert.ok(play);
  const after = w.Node.DOCUMENT_POSITION_FOLLOWING;
  assert.ok(sec.compareDocumentPosition(play) & after, 'action row follows the section');
  const credits = doc.querySelector('#pxView section.pxheads');
  assert.ok(credits && (play.compareDocumentPosition(credits) & after), 'credits follow the action row');
  assert.equal([...doc.querySelectorAll('button')].some(b => b.textContent.trim() === 'Chapters & Up Next'), false);
  const labels = [...play.querySelectorAll('.pxrbl')].map(n => n.textContent);
  for (const lab of ['Play', 'Play from start', 'Mark watched', 'Watchlist · coming soon', 'More']) {
    assert.ok(labels.includes(lab), labels.join(' | '));
  }

  const cred = doc.querySelector('#pxView a.pxcred');
  assert.equal(cred.textContent.includes('Aaliyah'), true);
  cred.click();
  await wait(80);
  const face = doc.querySelector('.pxpm .pxpface');
  const text = doc.querySelector('.pxpm .pxptext');
  assert.ok(face && text && (face.compareDocumentPosition(text) & after), doc.querySelector('.pxpm') ? doc.querySelector('.pxpm').textContent.slice(0, 300) : 'no modal');
  assert.equal(face.querySelector('.pxpname').textContent, 'Aaliyah');
  assert.equal(doc.querySelector('.pxpm .pxbio').textContent, bio);
  w.close();
});
