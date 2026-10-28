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
const { missingLibraryText, cwMeter, cardArt, menuOpensUp, paintMode, singleFlight, watchlistBtnState, watchlistFilter, emptyWatchlistText, snapSafe, HOME_TTL_MS, htpcCommand, browseMove } = await import(tmp);
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
  assert.match(src, /el\('button', 'pxrowh pxchuph', 'Chapters & Up Next'\)/);
  assert.match(src, /body\.hidden = true/);
  assert.match(src, /aria-expanded', 'false'/);
  assert.match(src, /el\('p', 'pxsum pxbio', pv\.bio\)/);
  const itemFn = src.slice(src.indexOf('async function item('), src.indexOf('async function person('));
  const chAt = itemFn.indexOf('chaptersSection(it, g)');
  const playAt = itemFn.indexOf('playRow(it)');
  const credAt = itemFn.indexOf("el('h2', 'pxrowh'");
  assert.ok(chAt !== -1 && chAt > playAt && credAt > chAt, 'Chapters & Up Next sits under the action row and before Credits');
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
  const vers = src.slice(src.indexOf('function versionsList'), src.indexOf('function chaptersSection'));
  assert.doesNotMatch(vers, /innerHTML/);
  assert.match(vers, /if \(v\.server\)/);
  assert.doesNotMatch(vers, /size > 1/);
  assert.match(src, /srvNames\.length > 1/);
  assert.match(src, /Checking other servers…/);
  assert.match(src, /still checking other servers/);
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
  assert.match(src, /sec\.classList\.contains\('pxcw'\)/);
  assert.match(src, /pxcwplay/);
  assert.match(src, /g\.appendChild\(playMark\(\)\)/);
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
  assert.match(css, /\.pxcwplay\{[^}]*background:#e5a00d/);
  assert.match(css, /\.pxcwplay \.ic path\{fill:#111;stroke:none\}/);
  assert.match(css, /\.pxbackdrop\{transition:opacity 1100ms ease-in-out\}/);
  assert.match(css, /transition:opacity 1400ms ease-in-out/);
  assert.match(css, /\.pxfeatmenu\{[^}]*background:var\(--px-glass\)/);
  assert.match(css, /\.pxfeatmenu\{[^}]*backdrop-filter:var\(--px-glass-blur\)/);
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
  assert.match(html, /<a class="profile" href="#settings">/);
  assert.doesNotMatch(html, /class="pxset"/);
  assert.match(desk, /plexOrigin\(\)\+'\/img\/'\+id\+'\/80x80'/);
  assert.match(desk, /fill\(rail,id,true\)/);
  const land = src.slice(src.indexOf('async function sectionLanding'), src.indexOf('function fileLine'));
  assert.match(land, /img\(heroIt\.poster \|\| heroIt\.thumb, 420, 630\)/);
  assert.match(land, /pxcase/);
  const home = src.slice(src.indexOf('async function home('), src.indexOf('async function section('));
  assert.doesNotMatch(home, /hi\.thumb \|\| hi\.art/);
  assert.equal(menuOpensUp(700, 140, 420), false);
  assert.equal(menuOpensUp(360, 520, 480), false);
  assert.equal(menuOpensUp(200, 640, 180), false);
  assert.equal(menuOpensUp(90, 700, 420), true);
  assert.equal(menuOpensUp(80, 40, 420), false);
  assert.match(src, /menuOpensUp\(below, above, need\)\) menu\.classList\.add\('pxup'\)/);
  assert.match(css, /\.pxfeatmenu\.pxup\{top:auto;bottom:calc\(100% \+ 8px\)\}/);
  assert.doesNotMatch(src, /classList\.add\('up'\)/);
  assert.match(src, /menu\.style\.left = '0px'/);
  assert.match(src, /box\.right > right/);
  assert.match(desk, /dataset\.label='Settings'/);
  assert.match(desk, /prof\.addEventListener\('click',e=>\{e\.preventDefault\(\);openAccount\(\)\}\)/);
});
test('single-flight joins one browse, then a later run calls again', async () => {
  let n = 0;
  const f = singleFlight();
  const a = f.run('home', false, () => new Promise(r => setTimeout(() => r(++n), 20)));
  const b = f.run('home', true, () => { n++; return 99; });
  assert.equal(await a, await b);
  assert.equal(n, 1);
  const c = f.run('home', true, () => ++n);
  assert.equal(await c, 2);
  f.reset();
  const d = f.run('home', false, () => ++n);
  assert.equal(await d, 3);
});
test('watchlist button, filter, empty copy, and paint mode', () => {
  const off = watchlistBtnState(false, '5d7700000000000000000000');
  assert.equal(off.label, 'Add to Watchlist');
  assert.equal(off.disabled, false);
  const on = watchlistBtnState(true, '5d7700000000000000000000');
  assert.equal(on.label, 'On Watchlist');
  assert.equal(on.on, true);
  const bad = watchlistBtnState(false, '');
  assert.equal(bad.label, 'Watchlist unavailable');
  assert.equal(bad.disabled, true);
  const list = [{ kind: 'movie', title: 'A' }, { kind: 'show', title: 'B' }];
  assert.equal(watchlistFilter(list, 'movies').length, 1);
  assert.equal(watchlistFilter(list, 'tv')[0].title, 'B');
  assert.equal(watchlistFilter(list, 'all').length, 2);
  assert.equal(emptyWatchlistText('all', 0), 'Your watchlist is empty.');
  assert.equal(emptyWatchlistText('movies', 0), 'No movies on your watchlist.');
  assert.equal(emptyWatchlistText('tv', 0), 'No TV shows on your watchlist.');
  assert.equal(emptyWatchlistText('all', 2), '');
  assert.equal(paintMode({}), 'skeleton');
  assert.equal(paintMode({ parked: true, json: true, disk: true }), 'reattach');
  assert.equal(paintMode({ json: true }), 'paint-cached');
  assert.equal(paintMode({ disk: true }), 'paint-disk');
  assert.equal(snapSafe({ home: { title: 'Ok' } }).includes('Ok'), true);
  assert.equal(snapSafe({ token: 'X-Plex-Token' }), null);
  assert.equal(snapSafe({ host: 'a.plex.direct' }), null);
  assert.equal(HOME_TTL_MS, 120000);
});
test('parity tip: section hubs, play row, watch-together stub, no stream URI', () => {
  assert.match(src, /invoke\('browse_section_hubs'/);
  assert.match(src, /Play · choose server/);
  assert.match(src, /Watch together is not available yet/);
  assert.match(src, /Watchlist unavailable/);
  assert.match(src, /Add to Watchlist/);
  assert.match(src, /On Watchlist/);
  assert.doesNotMatch(src, /coming soon/);
  assert.equal((src.match(/invoke\('browse_home'\)/g) || []).length, 1);
  assert.doesNotMatch(src, /shot_id|__plexShot|__PLEXUW_MOCK__|mockplex/);
  assert.match(src, /mark_watched/);
  assert.doesNotMatch(src, /rb\('more'/);
  assert.doesNotMatch(src, /plex\.tv\/watch|watch\.plex\.tv|Start watch together/);
  assert.doesNotMatch(src, /audioStreamID|subtitleStreamID/);
  assert.equal((src.match(/versionsList\(it\)\)/g) || []).length, 1);
});
test('subtitle control paints a menu, including an empty state, and keeps the bar up', () => {
  const app = readFileSync(join(here, '..', '..', '..', 'app.js'), 'utf8');
  assert.match(app, /function paintCc\(info\)/);
  assert.match(app, /No subtitles/);
  assert.match(app, /ccPop\.hidden=false/);
  assert.match(app, /aria-haspopup','menu'/);
  assert.match(app, /const ccEl=\$\('#ccPop'\), cc=!!\(ccEl&&!ccEl\.hidden\)/);
  assert.match(app, /window\.__pxPickSub\(n<0\?null:n\)/);
  assert.doesNotMatch(app, /toast\('No subtitles'\)/);
  const slice = app.slice(app.indexOf('function closeCc'), app.indexOf('function paintLiveChap'));
  const bCc = { hidden: false, attrs: {}, classList: { toggle() {} }, setAttribute(k, v) { this.attrs[k] = v; } };
  const bar = { children: [], appendChild(c) { this.children.push(c); } };
  const gear = { hidden: false };
  const made = [];
  const prev = globalThis.document;
  globalThis.document = {
    createElement() {
      const n = { hidden: true, className: '', attrs: {}, innerHTML: '', setAttribute(k, v) { this.attrs[k] = v; } };
      made.push(n); return n;
    },
    addEventListener() {},
  };
  const $ = s => s === '#bar' ? bar : s === '#gearMenu' ? gear : null;
  let ctx = {};
  const picked = [];
  const api = new Function('bCc', '$', 'vid', 'plexNow', 'plexCtx', 'esc', 'toast', 'chrome', 'window', `let ccPop=null;
    ${slice}
    return { open() { bCc.onclick({ stopPropagation() {} }); }, pop: () => ccPop };`)(
    bCc, $, { textTracks: [] }, () => !!(ctx.subs && ctx.subs.length), () => ctx, s => String(s), () => {}, () => {},
    { __pxPickSub(n) { picked.push(n); } });
  api.open();
  assert.equal(api.pop().hidden, false);
  assert.match(api.pop().innerHTML, /Subtitles/);
  assert.match(api.pop().innerHTML, /No subtitles/);
  assert.equal(bCc.attrs['aria-expanded'], 'true');
  assert.equal(gear.hidden, true);
  api.open();
  assert.equal(api.pop().hidden, false, 'a second click still shows the menu');
  ctx = { subs: [{ i: 0, label: 'English' }, { i: 1, label: 'Spanish' }], subIndex: -1 };
  api.open();
  assert.match(api.pop().innerHTML, /English/);
  assert.match(api.pop().innerHTML, /data-sub="1"/);
  api.pop().onclick({ target: { closest(sel) { return sel === '[data-sub]' ? { dataset: { sub: '1' } } : null; } } });
  assert.deepEqual(picked, [1]);
  assert.equal(api.pop().hidden, true);
  if (prev === undefined) delete globalThis.document; else globalThis.document = prev;
  assert.equal(made.length, 1);
});

const key = (k, extra) => Object.assign({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, extra);
test('HTPC default keys: browse moves, playback commands, remap hook', () => {
  assert.equal(htpcCommand(key('ArrowRight')), 'right');
  assert.equal(htpcCommand(key('ArrowLeft')), 'left');
  assert.equal(htpcCommand(key('ArrowUp')), 'up');
  assert.equal(htpcCommand(key('ArrowDown')), 'down');
  assert.equal(htpcCommand(key('Enter')), 'enter');
  assert.equal(htpcCommand(key('Escape')), 'back');
  assert.equal(htpcCommand(key('Backspace')), 'back');
  assert.equal(htpcCommand(key('b')), 'back');
  assert.equal(htpcCommand(key('h')), 'home');
  assert.equal(htpcCommand(key(' ')), 'play_pause');
  assert.equal(htpcCommand(key('p')), 'play_pause');
  assert.equal(htpcCommand(key('x')), 'stop');
  assert.equal(htpcCommand(key('PageUp')), 'seek_backward');
  assert.equal(htpcCommand(key('PageDown')), 'seek_forward');
  assert.equal(htpcCommand(key('Home')), 'step_backward');
  assert.equal(htpcCommand(key('End')), 'step_forward');
  assert.equal(htpcCommand(key('s')), 'toggle_subtitles');
  assert.equal(htpcCommand(key('l')), 'cycle_subtitles');
  assert.equal(htpcCommand(key('l', { ctrlKey: true })), 'cycle_subtitles_back');
  assert.equal(htpcCommand(key('i')), 'info');
  assert.equal(htpcCommand(key('w')), 'toggle_watched');
  assert.equal(htpcCommand(key('z')), 'cycle_aspect_ratio');
  assert.equal(htpcCommand(key('=')), 'increase_volume');
  assert.equal(htpcCommand(key('-')), 'decrease_volume');
  assert.equal(htpcCommand(key('\\')), 'toggle_fullscreen');
  assert.equal(htpcCommand(key('F11')), 'toggle_fullscreen');
  assert.equal(htpcCommand(key('f', { ctrlKey: true })), 'search');
  assert.equal(htpcCommand(key('k', { metaKey: true })), 'search');
  assert.equal(htpcCommand(key('M', { shiftKey: true })), 'jump+M');
  assert.equal(htpcCommand(key('ArrowLeft', { altKey: true })), null);
  assert.equal(htpcCommand(key('p', { ctrlKey: true })), null);
  assert.equal(htpcCommand(key('p'), { p: '' }), null);
  assert.equal(htpcCommand(key('p'), { p: 'home' }), 'home');
  const row = [{ x: 0, y: 0, w: 100, h: 40 }, { x: 120, y: 0, w: 100, h: 40 }, { x: 240, y: 0, w: 100, h: 40 }];
  const grid = row.concat([{ x: 0, y: 80, w: 100, h: 40 }, { x: 120, y: 80, w: 100, h: 40 }]);
  assert.equal(browseMove(row, 0, 'right'), 1);
  assert.equal(browseMove(row, 1, 'left'), 0);
  assert.equal(browseMove(row, 0, 'left'), -1);
  assert.equal(browseMove(grid, 0, 'down'), 3);
  assert.equal(browseMove(grid, 4, 'up'), 1);
  assert.equal(browseMove(grid, 1, 'left'), 0);
  const app = readFileSync(join(here, '..', '..', '..', 'app.js'), 'utf8');
  for (const name of ['play_pause', 'seek_backward', 'seek_forward', 'step_backward', 'step_forward', 'toggle_subtitles', 'cycle_subtitles', 'increase_volume', 'decrease_volume']) {
    assert.match(app, new RegExp(name));
  }
  assert.match(src, /a\.dataset\.label = label/);
  assert.doesNotMatch(src, /dataset\.label = label \+/);
  assert.doesNotMatch(src, /data-label.*Ctrl|aria-label', label \+/);
});
