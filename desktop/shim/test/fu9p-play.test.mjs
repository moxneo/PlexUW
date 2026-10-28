// fu9p: real play wiring, demo stripped from the ship path, KEEP music-off + credits gold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const read = p => readFileSync(p, 'utf8');
const browse = read(join(here, '..', 'plex-browse.js'));
const desktop = read(join(here, '..', 'desktop.js'));
const css = read(join(here, '..', 'desktop.css'));
const app = read(join(root, 'app.js'));
const html = read(join(root, 'index.html'));
const styles = read(join(root, 'styles.css'));
const sync = read(join(here, '..', '..', 'sync-web.sh'));
const play = read(join(root, 'desktop', 'src-tauri', 'src', 'plex', 'play.rs'));

test('KEEP music-off and credits gold hover', () => {
  assert.match(browse, /MUSIC_KINDS = new Set\(\['artist', 'album', 'track'\]\)/);
  assert.match(browse, /dropMusicLibs/);
  assert.match(app, /#music/);
  assert.match(css, /a\.pxcred:hover i,a\.pxcred:focus-visible i,button\.pxcred:hover i,button\.pxcred:focus-visible i\{transform:scale\(1\.12\)/);
  assert.match(css, /#e5a00d/);
  assert.match(css, /\.pxheadrow\{[^}]*padding:22px 18px 28px/);
  assert.match(styles, /\.dcast \.person:hover \.av,\.dcast \.person:focus-visible \.av\{transform:scale\(1\.12\)/);
});

test('Play starts a real session and Escape leaves to returnHash', () => {
  assert.match(browse, /function startTitlePlay\(it, fromStart\)/);
  assert.match(browse, /location\.hash = '#player\/plex'/);
  assert.match(browse, /returnHash: back/);
  assert.doesNotMatch(browse, /Playback arrives in M3/);
  assert.match(browse, /rb\('play', 'Play', \(\) => startTitlePlay\(it, false\)\)/);
  assert.match(app, /id==='plex'/);
  assert.match(app, /goBackFromPlayer/);
  assert.match(app, /#player\/plex/);
  assert.match(desktop, /invoke\('play_start'/);
  assert.match(desktop, /invoke\('opaque_get'/);
  assert.match(desktop, /class PlexLoader extends Hls\.DefaultConfig\.loader/);
  assert.doesNotMatch(desktop, /super\.load\(/);
  assert.match(desktop, /enableWorker:false/);
  assert.match(play, /directPlay=0/);
  assert.match(play, /directStream=0/);
  assert.match(play, /videoQuality=100/);
  assert.match(play, /HLS_PREFIX/);
});

test('duration is not the 10s sample and failures do not fall back to it', () => {
  assert.doesNotMatch(html, /sample\.mp4/);
  assert.match(html, /--:--:--/);
  assert.doesNotMatch(html, /00:00:10/);
  assert.doesNotMatch(app, /vid\.duration\|\|10/);
  assert.doesNotMatch(app, /sample\.mp4/);
  assert.match(app, /function dur\(\)/);
  assert.match(app, /__pxPlayDur/);
  assert.match(desktop, /clearVid/);
  assert.match(desktop, /Could not start playback/);
  assert.match(desktop, /rewrite\|redirect\|denied\|network\|segment\|auth/);
  assert.match(desktop, /Could not start playback \(mse\)/);
  assert.match(desktop, /step=mse Hls\.isSupported=false/);
  assert.match(desktop, /step=hls fatal/);
  assert.doesNotMatch(desktop, /sample\.mp4/);
});

test('player chrome: glass edge bars, real controls, scrub frame, volume', () => {
  assert.match(app, /__pxReadVol/);
  assert.match(app, /__pxScrubTo/);
  assert.match(app, /showtop/);
  assert.match(app, /showbot/);
  assert.match(app, /armEdge/);
  assert.match(app, /CHROME_DWELL=3000/);
  assert.match(app, /function armBar\(which,want\)/);
  assert.match(app, /d\.t=setTimeout\(\(\)=>\{d\.hold=false;if\(!d\.on\)chrome\(\);\},CHROME_DWELL\)/);
  assert.match(app, /classList\.add\('povl'\)/);
  assert.match(app, /setProperty\('--vl','0px'\)/);
  assert.match(app, /function paintPlexDrawers\(\)/);
  assert.match(app, /px-play-drawers/);
  assert.doesNotMatch(app, /Fit while a side panel is open/);
  assert.doesNotMatch(app, /innerWidth<1600/);
  assert.doesNotMatch(app, /#play use/);
  assert.doesNotMatch(app, /sprite\.jpg/);
  assert.doesNotMatch(app, /Fit · panel/);
  assert.match(html, /id="playIc"/);
  assert.match(html, /id="volWedge"/);
  assert.match(html, /id="thumbimg"/);
  assert.doesNotMatch(html, /assets\/icons\.svg#tplay/);
  assert.doesNotMatch(styles, /sprite\.jpg/);
  assert.match(styles, /showtop/);
  assert.match(styles, /showbot/);
  assert.match(styles, /--px-plate:rgba\(16,17,20,\.97\)/);
  assert.match(styles, /--px-plate-blur:blur\(18px\) saturate\(140%\)/);
  assert.match(styles, /--px-glass:[^;]*rgba\(92,92,98,\.46\)/);
  assert.match(styles, /--px-glass-blur:blur\(40px\) saturate\(180%\)/);
  assert.match(styles, /--px-glass-shadow:[^;]*inset 0 1px 0/);
  assert.match(styles, /#stage #topctl,#stage #bar\{\s*background:var\(--px-glass\)/);
  assert.match(styles, /#stage #topctl,#stage #bar\{[^}]*box-shadow:var\(--px-glass-shadow\)/);
  assert.match(styles, /#player \.bar \.glass,#player \.glass,#player \.panel \.glass,#stage\.fill \.panel \.glass\{\s*background:var\(--px-glass\)/);
  assert.match(styles, /#thumb\{\s*background:var\(--px-glass\)/);
  assert.match(styles, /#player \.menu\{background:var\(--px-glass\)/);
  assert.match(styles, /#player \.menu \.mi\.on[^}]*background:rgba\(255,255,255,\.16\)/);
  assert.match(styles, /#player \.aptog\.on span\{background:rgba\(255,255,255,\.28\)\}/);
  assert.match(styles, /#player \.bias input,#player #bias\{accent-color:#fff\}/);
  assert.match(styles, /#stage #bar #knob\{background:#fff/);
  assert.match(styles, /#stage \.edge \.pill[^}]*var\(--px-glass\)/);
  assert.match(app, /const wash=art\(cur,320,180\)/);
  assert.match(app, /\$\('#ambient'\)\.style\.backgroundImage=wash/);
  assert.match(app, /\$\$\('#stage \.panel \.art'\)/);
  assert.match(styles, /#player \.panel \.art\{display:none\}/);
  assert.match(styles, /#stage\.povl #vidwrap\{left:0;width:100%\}/);
  assert.match(browse, /function upNextList\(it\)/);
  assert.match(browse, /summary: clip\(it\.summary, 600\)/);
  assert.match(browse, /upNextReady: false/);
  assert.match(browse, /new CustomEvent\('px-play-drawers'\)/);
  assert.doesNotMatch(html, /stop-color="var\(--accent/);
  assert.match(html, /stop-color="#ffffff"/);
  assert.match(css, /background:var\(--px-plate\)/);
  assert.match(css, /\.pxfeatmenu\{[^}]*var\(--px-glass\)/);
  assert.match(desktop, /__pxScrubTo/);
  assert.match(desktop, /drawImage/);
  assert.match(desktop, /__pxReadVol/);
  assert.match(browse, /const chapters = durMs/);
});
test('top and bottom chrome dwell 3s and cancel on re-enter', () => {
  const start = app.indexOf('const CHROME_DWELL=3000;');
  const end = app.indexOf('function hideChromeNow');
  assert.ok(start > 0 && end > start);
  const classes = new Set();
  const st = { classList: {
    toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
    contains(name) { return classes.has(name); },
  } };
  const pending = [];
  let seq = 1;
  const setTimeout = (fn, ms) => { const id = seq++; pending.push({ id, fn, ms }); return id; };
  const clearTimeout = id => { const i = pending.findIndex(p => p.id === id); if (i >= 0) pending.splice(i, 1); };
  const api = new Function('st', '$', 'setTimeout', 'clearTimeout', 'pin', 'kbd', `${app.slice(start, end)}
    return { armBar, CHROME_DWELL };`)(st, () => ({ hidden: true }), setTimeout, clearTimeout, false, false);
  const shown = which => classes.has(which === 'top' ? 'showtop' : 'showbot');
  api.armBar('top', true);
  api.armBar('bot', true);
  assert.equal(shown('top'), true);
  assert.equal(shown('bot'), true);
  api.armBar('top', false);
  assert.equal(shown('top'), true, 'top stays through the grace');
  assert.equal(shown('bot'), true, 'bottom is untouched');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].ms, api.CHROME_DWELL);
  api.armBar('top', true);
  assert.equal(pending.length, 0, 're-enter cancels the hide');
  assert.equal(shown('top'), true);
  api.armBar('top', false);
  api.armBar('bot', false);
  assert.equal(shown('top'), true);
  assert.equal(shown('bot'), true);
  pending.splice(0).forEach(p => p.fn());
  assert.equal(shown('top'), false);
  assert.equal(shown('bot'), false);
});

test('plex drawers paint one info side and one up-next list over the picture', () => {
  const start = app.indexOf('function pxImg');
  const end = app.indexOf("addEventListener('px-play-drawers'");
  assert.ok(start > 0 && end > start);
  const nodes = [];
  function make(tag) {
    const node = { tag, className: '', style: {}, children: [], attrs: {}, listeners: {}, dataset: {} };
    node.childNodes = node.children;
    let text = '';
    Object.defineProperty(node, 'textContent', {
      get() { return text; },
      set(v) { text = String(v); if (v === '') node.children.length = 0; },
    });
    node.appendChild = c => { node.children.push(c); return c; };
    node.setAttribute = (k, v) => { node.attrs[k] = v; };
    node.addEventListener = (type, fn) => { (node.listeners[type] ||= []).push(fn); };
    nodes.push(node);
    return node;
  }
  const details = make('div'), up = make('div');
  const ctx = {
    title: 'Guns Up', year: 2025, kind: 'movie', summary: 'A real synopsis.', studio: 'Example',
    rating: 7.5, genres: ['Action'], tagline: 'Hold the line', contentRating: 'R',
    poster: 'a'.repeat(32), directors: ['Ada Morrow'], cast: [{ name: 'Ada Morrow', role: 'Lead' }],
    upNextReady: true,
    upNext: [{ id: 'b'.repeat(24), title: 'Next Reel', year: 2024, kind: 'movie', thumb: 'c'.repeat(32) }],
  };
  const location = { hash: '' };
  const api = new Function('document', '$', 'plexCtx', 'cur', 'navigator', 'window', 'location', `${app.slice(start, end)}
    return { paintPlexDrawers, pxImg };`)(
    { createElement: make },
    sel => sel === '#detailsBody' ? details : sel === '#upList' ? up : null,
    () => ctx,
    { title: 'Guns Up', mins: 100 },
    { userAgent: 'Linux' },
    { devicePixelRatio: 1 },
    location,
  );
  assert.equal(api.pxImg('http://evil.example/x', 10, 10), '');
  assert.match(api.pxImg('a'.repeat(32), 240, 360), /^plexuw:\/\/localhost\/img\/a{32}\//);
  api.paintPlexDrawers();
  const texts = n => [n.textContent || '', ...(n.children || []).flatMap(texts)];
  const infoText = texts(details).join('\n');
  assert.match(infoText, /Guns Up/);
  assert.match(infoText, /A real synopsis/);
  assert.match(infoText, /Ada Morrow/);
  assert.doesNotMatch(infoText, /Playing from your Plex library/);
  const upText = texts(up).join('\n');
  assert.match(upText, /Next Reel/);
  assert.match(upText, /2024/);
  const row = up.children.find(n => n.className === 'up');
  assert.ok(row, 'up next row');
  row.listeners.click[0]({ stopPropagation() {} });
  assert.equal(location.hash, '#px/item/' + 'b'.repeat(24));
  assert.match(app, /if\(now\)\{const other=id==='#pDetails'\?'#pUpnext':'#pDetails'/);
  assert.match(styles, /#stage\.povl #vidwrap\{left:0;width:100%\}/);
});

test('play icon sync runs after chrome dwell exists', () => {
  // sync() calls vis() → chrome(). const dwell is in the temporal dead zone until its line.
  // Calling sync on the play-handler line aborted app.js, so #player/plex never mounted and Home stayed up.
  const dwell = app.indexOf('const dwell=');
  const call = app.indexOf('\nsync();');
  assert.ok(dwell > 0 && call > dwell);
  assert.doesNotMatch(app, /vid\.onplay=vid\.onpause=sync;sync\(\)/);
});

test('shipping UI has no demo mode and sync-web stubs the catalog', () => {
  assert.doesNotMatch(desktop, /use_demo/);
  assert.doesNotMatch(desktop, /demo data/i);
  assert.doesNotMatch(desktop, /Demo data/);
  assert.match(desktop, /Not signed in/);
  assert.match(sync, /__PLEXUW_SHIP/);
  assert.match(sync, /window\.MOCK=\[\]/);
  assert.match(sync, /rm -f "\$out\/assets\/sample\.mp4"/);
  assert.match(css, /body\.pxneedsign/);
  assert.match(css, /body\.inplayer #pxView/);
});
