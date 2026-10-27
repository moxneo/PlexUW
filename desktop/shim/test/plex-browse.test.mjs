// node --test desktop/shim/test  (no deps). da Vinci S1: library-load failure message.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'plex-browse.js'), 'utf8');
globalThis.navigator ??= { userAgent: 'node' };
const tmp = join(mkdtempSync(join(tmpdir(), 'pxb-')), 'plex-browse.mjs');
writeFileSync(tmp, src);
writeFileSync(join(dirname(tmp), 'px-icons.js'), readFileSync(join(here, '..', 'px-icons.js'), 'utf8'));
const { missingLibraryText, cwMeter, cardArt } = await import(tmp);
const WHY = { unreachable: 'None of this server’s addresses answered.', timeout: 'The server took too long to answer.' };
const why = e => WHY[String(e)] || 'Something went wrong. Try again.';

test('unreachable server: shows the load-failure category, not "isn’t on this server"', () => {
  const t = missingLibraryText('unreachable', why);
  assert.equal(t, 'Couldn’t load your libraries. None of this server’s addresses answered.');
  assert.doesNotMatch(t, /isn’t on this server/);
});
test('timeout and unknown categories map to fixed text; raw error text never shown', () => {
  assert.match(missingLibraryText('timeout', why), /took too long/);
  const t = missingLibraryText('dns error: plex.example.com 203.0.113.9', why);
  assert.equal(t, 'Couldn’t load your libraries. Something went wrong. Try again.');
  assert.doesNotMatch(t, /plex\.example|203\./);
  assert.equal(missingLibraryText(null, undefined), 'Couldn’t load your libraries. Something went wrong. Try again.');
});
test('list loaded without that id: "That library isn’t on this server."', () => {
  assert.equal(missingLibraryText(undefined, why), 'That library isn’t on this server.');
});
test('section() captures the load error and routes it through missingLibraryText', () => {
  const body = src.slice(src.indexOf('async function section('), src.indexOf('async function section(') + 1200);
  assert.match(body, /catch \(e\) \{ loadErr = e; \}/);
  assert.match(body, /if \(!s\) return status\(missingLibraryText\(loadErr, hooks\.why\)\)/);
  assert.doesNotMatch(src, /catch \{ \/\* handled below \*\/ \}/);
});
test('fail() never prints raw error text', () => {
  assert.doesNotMatch(src, /String\(e\)\.slice/);
});
test('da Vinci LOW: Home and Details errors match the libraries wording', async () => {
  const { loadErrorText } = await import(tmp);
  assert.equal(loadErrorText('home', 'unreachable', why), 'Couldn’t load Home. None of this server’s addresses answered.');
  assert.equal(loadErrorText('item', 'timeout', why), 'Couldn’t load this title. The server took too long to answer.');
  const raw = loadErrorText('item', 'http 500 at https://plex.example.com:32400/library', why);
  assert.equal(raw, 'Couldn’t load this title. Something went wrong. Try again.');
  assert.doesNotMatch(raw, /plex\.example|500/);
});

// fu7e: infinite scroll keeps every mounted tile; pages append, placeholders swap in place.
test('fu7e appendGrid: scrolling appends pages and never remounts existing tiles', async () => {
  const { appendGrid } = await import(tmp);
  const children = []; let created = 0;
  const node = (kind, data) => { const n = { kind, data, isPlaceholder: kind === 'ph', id: created++,
    replaceWith(m) { const i = children.indexOf(n); assert.ok(i >= 0, 'replaced node is mounted'); children[i] = m; } }; return n; };
  const grid = { appendChild(n) { children.push(n); },
    replaceChildren() { throw new Error('replaceChildren would remount tiles'); },
    removeChild() { throw new Error('removeChild would unmount a tile'); } };
  const all = Array.from({ length: 250 }, (_, i) => ({ id: 'i' + i }));
  const fetched = [];
  const ag = appendGrid({ grid, total: all.length, pageSize: 100,
    fetchPage: start => { fetched.push(start); return Promise.resolve(all.slice(start, start + 100)); },
    tile: it => node('tile', it), placeholder: () => node('ph') });
  ag.ensure(100); await ag.load(0);
  const first = children.slice(0, 100);
  assert.ok(first.every(n => n.kind === 'tile'), 'page 0 tiles mounted');
  // scroll: grow + load page 1, twice (duplicate requests are ignored)
  ag.ensure(200); assert.equal(children.length, 200);
  assert.ok(children.slice(100).every(n => n.isPlaceholder), 'next page shows placeholders first');
  ag.want(100, 200); ag.want(100, 200); await ag.load(1);
  assert.deepEqual(fetched, [0, 100], 'each page fetched once');
  assert.ok(first.every((n, i) => children[i] === n), 'page 0 nodes are the very same objects (no remount)');
  const second = children.slice(100, 200); assert.ok(second.every(n => n.kind === 'tile'));
  ag.ensure(1000); assert.equal(children.length, 250, 'never more slots than items');
  await ag.load(2); assert.ok(children.every(n => n.kind === 'tile'));
  assert.ok(first.every((n, i) => children[i] === n) && second.every((n, i) => children[100 + i] === n), 'earlier pages untouched');
  // a stale page (null, route changed) leaves placeholders and does not throw
  const ag2 = appendGrid({ grid: { appendChild() {} }, total: 5, fetchPage: () => null, tile: () => assert.fail('no tile'), placeholder: () => node('ph') });
  ag2.ensure(5); await ag2.load(0); assert.equal(ag2.pages.size, 0);
});
test('fu7e details: no Info panel, no ⋯ button; one Versions list; person + related wired', () => {
  assert.doesNotMatch(src, /panelBtn\(/);
  assert.match(src, /function chaptersSection\(it, g0\)/);
  assert.match(src, /el\('h2', 'pxrowh', 'Chapters & Up Next'\)/);
  assert.match(src, /el\('p', 'pxsum pxbio', pv\.bio\)/);
  const itemFn = src.slice(src.indexOf('async function item('), src.indexOf('async function person('));
  const chAt = itemFn.indexOf('chaptersSection(it, g)');
  const playAt = itemFn.indexOf('playRow(it)');
  const credAt = itemFn.indexOf("el('h2', 'pxrowh'");
  assert.ok(chAt !== -1 && playAt > chAt && credAt > playAt, 'Play row sits under Chapters & Up Next and before Credits');
  assert.doesNotMatch(itemFn, /panelBtn\(|sidePanel\(|pxR/);
  assert.doesNotMatch(src, /rb\('more'/);
  assert.doesNotMatch(src, /infoPanel\(/);
  assert.equal((src.match(/versionsList\(it\)\)/g) || []).length, 1, 'versions list rendered once (one Preferred)');
  assert.match(src, /invoke\('browse_related'/);
  assert.match(src, /invoke\('browse_person'/);
  assert.match(src, /'#px\/person\/' \+ x\.id/);
  assert.doesNotMatch(src, /replaceChildren\(f\)/, 'old windowed grid gone');
});
test('music libraries never reach the nav, home rows, search, or item page', () => {
  assert.match(src, /MUSIC_KINDS = new Set\(\['artist', 'album', 'track'\]\)/);
  assert.match(src, /sections = dropMusicLibs\(v\.sections\)/);
  assert.match(src, /sections = dropMusicLibs\(v\)/);
  assert.match(src, /dropMusic\(v\.continueWatching\)/);
  assert.match(src, /dropMusic\(h\.items\)/);
  assert.match(src, /if \(MUSIC_KINDS\.has\(it\.kind\)\)/);
  assert.doesNotMatch(src, /artist: 'Albums'/);
  assert.doesNotMatch(src, /Search movies, shows, episodes, music/);
});
test('late versions: item page re-reads on plex-merge-fill and clears the spinner', () => {
  assert.match(src, /plex-merge-fill/);
  assert.match(src, /function refillMerged\(\)/);
  assert.match(src, /#px\\\/item\\\//);
  assert.match(src, /view\.querySelector\('\.pxvpend'\)/);
  assert.match(src, /function armPendingRefresh\(id, g0\)/);
  assert.match(src, /· owned/);
  assert.match(src, /· shared/);
  assert.match(src, /invoke\('version_pick', \{ id: v\.id \}\)/);
  assert.doesNotMatch(src.slice(src.indexOf('function versionsList'), src.indexOf('function chaptersSection')), /innerHTML/);
});
test('home hero is continue-watching chrome and is not repeated as a strip card', () => {
  const home = src.slice(src.indexOf('async function home('), src.indexOf('async function section('));
  assert.match(home, /pxcwmark', 'Continue Watching'/);
  assert.match(home, /pxhprog/);
  assert.match(home, /pxhleft/);
  assert.match(home, /cwMeter\(hi\)/);
  assert.match(home, /img\(hi\.poster, 420, 630\)/);
  assert.match(home, /'Resume'/);
  assert.doesNotMatch(home, /Pick up where you left off/);
  assert.doesNotMatch(home, /hi\.thumb \|\| hi\.art/);
  assert.doesNotMatch(home, /fromCw && hi\.viewOffsetMs/);
  assert.match(src, /classList\.add\('pxpast'\)/);
  assert.match(src, /classList\.remove\('pxpast'\)/);
  assert.match(src, /x\.id === hi\.id\) return false/);
  assert.match(src, /row\('Continue Watching', cwAll\.filter\(notHi\), false, true\)/);
  assert.match(src, /export function cwMeter\(it\)/);
});
test('episode cards: continue watching keeps the still; small TV cards use the series cover', () => {
  const ep = { kind: 'episode', thumb: 'still', art: 'fan', poster: 'cover' };
  assert.equal(cardArt(ep, false, true), 'still');
  assert.equal(cardArt(ep, true, false), 'still');
  assert.equal(cardArt(ep, false, false), 'cover');
  assert.equal(cardArt({ kind: 'show', poster: 'p', thumb: 't', art: 'a' }, false, false), 'p');
  assert.match(src, /row\('Next Up', odAll\.filter\(notHi\), false, true\)/);
  assert.match(src, /img\(it\.poster \|\| it\.thumb \|\| it\.art, 260, 390\)/);
  assert.match(src, /export function cardArt\(it, wide, still\)/);
  const home = src.slice(src.indexOf('async function home('), src.indexOf('async function section('));
  assert.match(home, /img\(hi\.poster, 420, 630\)/);
  assert.doesNotMatch(home, /hi\.thumb \|\| hi\.art/);
});
test('cw meter shows a track and time left when playback has not reported an offset', () => {
  const fresh = cwMeter({ viewOffsetMs: 0, durationMs: 17 * 60000 });
  assert.equal(fresh.left, '17 min left');
  assert.equal(fresh.width, '0.0%');
  const mid = cwMeter({ viewOffsetMs: 5 * 60000, durationMs: 17 * 60000 });
  assert.equal(mid.left, '12 min left');
  assert.ok(parseFloat(mid.width) > 2);
});
test('strip chevrons: both ends mid-scroll, left hidden on the first tile', async () => {
  const { arrowFlags } = await import(tmp);
  const css = readFileSync(join(here, '..', 'desktop.css'), 'utf8');
  const mid = arrowFlags(400, 800, 2400);
  assert.equal(mid.fits, false);
  assert.equal(mid.atl, false);
  assert.equal(mid.atr, false);
  const start = arrowFlags(0, 800, 2400);
  assert.equal(start.atl, true);
  assert.equal(start.atr, false);
  const end = arrowFlags(1600, 800, 2400);
  assert.equal(end.atl, false);
  assert.equal(end.atr, true);
  assert.match(css, /\.pxarr\.l\{grid-column:1\}/);
  assert.match(css, /\.pxstw\{display:grid;grid-template-columns:56px/);
  assert.doesNotMatch(css, /\.pxarr\{[^}]*position:\s*absolute/);
  assert.match(css, /--px-gutter:max\(var\(--s5\),56px\)/);
  assert.match(css, /\.pxhomehero,\.pxstrip\.pxcw\{padding-left:calc\(var\(--px-gutter\) - var\(--s5\)\)/);
  assert.match(css, /\.pxstrip\.pxcw \.pxstw\{width:calc\(100% \+ 2 \* var\(--px-gutter\)\)/);
  assert.match(css, /\.pxstrip\.pxcw \.pxstw\{[^}]*column-gap:0\}/);
  assert.match(css, /\.pxstrip\.pxcw \.pxsts\{padding-left:0;padding-right:0/);
  assert.match(css, /\.pxbackdrop\{transition:opacity 1100ms ease-in-out\}/);
  assert.match(css, /transition:opacity 1400ms ease-in-out/);
  assert.match(css, /\.pxfeatmenu\{[^}]*var\(--chrome-bg\)/);
  assert.match(css, /backdrop-filter:var\(--chrome-blur\)/);
  assert.match(css, /body\.desktop\.plexmode \.sidebar\{[^}]*var\(--chrome-bg\)/);
});
test('expanded rail has no stuck native tooltip', () => {
  const app = readFileSync(join(here, '..', '..', '..', 'app.js'), 'utf8');
  const desk = readFileSync(join(here, '..', 'desktop.js'), 'utf8');
  const css = readFileSync(join(here, '..', 'desktop.css'), 'utf8') + readFileSync(join(here, '..', '..', '..', 'styles.css'), 'utf8');
  const html = readFileSync(join(here, '..', '..', '..', 'index.html'), 'utf8');
  assert.match(app, /t\.removeAttribute\('title'\)/);
  assert.doesNotMatch(app, /t\.title\s*=/);
  assert.match(desk, /tg\.removeAttribute\('title'\)/);
  assert.doesNotMatch(desk, /tg\.title\s*=/);
  assert.match(desk, /dataset\.label='Expand'/);
  assert.doesNotMatch(desk, /dataset\.tip=/);
  assert.doesNotMatch(css, /button\.logo\[data-tip\]/);
  assert.match(css, /button\.logo\[data-label\]::after/);
  assert.match(desk, /navo/);
  assert.doesNotMatch(desk, /navx/);
  assert.match(html, /class="av pxrailav"/);
  assert.match(html, /class="pxwho"/);
  assert.match(html, /class="pxset" href="#settings">Settings/);
  assert.doesNotMatch(html, /class="pxset" href="#settings" aria-label="Settings"><\/a><span class="pn">/);
  assert.match(desk, /plexOrigin\(\)\+'\/img\/'\+id\+'\/80x80'/);
  assert.match(desk, /fill\(rail,id,true\)/);
  const land = src.slice(src.indexOf('async function sectionLanding'), src.indexOf('function fileLine'));
  assert.match(land, /img\(heroIt\.poster \|\| heroIt\.thumb, 420, 630\)/);
  assert.match(land, /pxcase/);
  const home = src.slice(src.indexOf('async function home('), src.indexOf('async function section('));
  assert.doesNotMatch(home, /hi\.thumb \|\| hi\.art/);
  assert.match(src, /Math\.max\(240, menu\.offsetHeight \|\| 0\)/);
});
test('parity tip: section hubs, play row, watch-together stub, no stream URI', () => {
  assert.match(src, /invoke\('browse_section_hubs'/);
  assert.match(src, /Play · choose server/);
  assert.match(src, /Watch together is not available yet/);
  assert.match(src, /Watchlist · coming soon/);
  assert.match(src, /mark_watched/);
  assert.doesNotMatch(src, /rb\('more'/);
  assert.doesNotMatch(src, /plex\.tv\/watch|watch\.plex\.tv|Start watch together/);
  assert.doesNotMatch(src, /audioStreamID|subtitleStreamID/);
  assert.equal((src.match(/versionsList\(it\)\)/g) || []).length, 1);
});
