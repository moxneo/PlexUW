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
  assert.match(desktop, /step=hls reset/);
  assert.match(desktop, /recoverMediaError/);
  assert.match(desktop, /data\.details==='mediaSourceRequiresReset'/);
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
  assert.match(app, /\$\('#ambient'\)\.style\.backgroundImage=art\(cur,320,180\)/);
  assert.match(app, /\$\$\('#stage \.art'\)/);
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
  assert.match(desktop, /playback_frame/);
  assert.match(desktop, /opacity:\.02/);
  assert.match(desktop, /scrubDraw\(sec,canvas,plexOrigin\(\)\+out\.url/);
  assert.match(desktop, /function scrubWant/);
  assert.match(app, /const frame=f\*\(d\|\|0\)/);
  assert.match(app, /if\(seek\.matches\(':hover'\)\)return/);
  assert.doesNotMatch(app, /closest\('#thumb'\)\)return/);
  assert.doesNotMatch(app, /\(ti\?c\.at:f\)/);
  assert.doesNotMatch(desktop, /scrubDraw\(sec,0\.25/);
  assert.doesNotMatch(desktop, /el\.style\.opacity='1'/);
  assert.match(desktop, /opacity:\.02;object-fit:cover;pointer-events:none;z-index:2'/);
  assert.doesNotMatch(desktop, /aim\+'@'/);
  assert.match(desktop, /function scrubCanOpen\(main\)/);
  assert.match(desktop, /main&&main\.__pxFrame&&main\.__pxMsRetry!=='busy'&&!main\.__pxHoldScrub/);
  assert.doesNotMatch(desktop, /addEventListener\('loadeddata'/);
  assert.doesNotMatch(desktop, /playback_thumb/);
  assert.doesNotMatch(desktop, /left:-9999px/);
  assert.doesNotMatch(styles, /#stage #bar \.playbtn,#stage #bar \.playbtn\.paused\{[^}]*rgba\(255,255,255,\.92\)/);
  assert.match(styles, /#stage #bar \.playbtn,#stage #bar \.playbtn\.paused\{[^}]*background:transparent/);
  assert.match(styles, /#stage #bar \.playbtn:hover,#stage #bar \.playbtn\.paused:hover\{background:rgba\(255,255,255,\.12\)/);
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

test('scrub preview is the hover time, not a chapter still', () => {
  const start = desktop.indexOf('function scrubSpan');
  const end = desktop.indexOf('function mountScrub');
  assert.ok(start > 0 && end > start);
  const api = new Function(`${desktop.slice(start, end)}\nreturn { scrubHold, scrubAim };`)();
  const buf = ranges => ({ length: ranges.length, start: i => ranges[i][0], end: i => ranges[i][1] });
  const vid = (t, ranges, extra) => Object.assign({ videoWidth: 320, currentTime: t, buffered: buf(ranges) }, extra || {});
  assert.equal(api.scrubHold({ videoWidth: 0, currentTime: 10, buffered: buf([[0, 4]]) }, 10), false);
  assert.equal(api.scrubHold(vid(10.4, [[0, 20]]), 10), true);
  assert.equal(api.scrubHold(vid(30, [[0, 40]]), 10), false);
  assert.equal(api.scrubHold(vid(0, [[0, 4]]), 2280), false, 'blank init frame');
  assert.equal(api.scrubAim(vid(0, [[0, 4]]), 2280), 0.25, 'step off the blank 0-based frame');
  assert.equal(api.scrubHold(vid(0.2, [[0, 4]]), 2280), true, '0-based offset session');
  assert.equal(api.scrubHold(vid(0.25, [[4475, 4480]]), 4475), false, 'opening still is not the far window');
  assert.equal(api.scrubHold(vid(4475.2, [[4475, 4480]]), 4475), true, 'absolute playlist at the scrub offset');
  assert.equal(api.scrubHold(vid(2012, [[2012, 2020]]), 2280), false, 'chapter keyframe is not the hover');
  assert.equal(api.scrubAim(vid(2012, [[2012, 2020]]), 2280), 2280, 'seek off the chapter onto the hover');
  assert.equal(api.scrubAim(vid(0.25, [[4475, 4480]]), 4475), 4475);
  assert.equal(api.scrubAim(vid(4475.2, [[4475, 4480]]), 4475), -1);
  const snapped = vid(0.2, [[0, 4]], { __pxWin: 2012 });
  assert.equal(api.scrubHold(snapped, 2280), false, 'sequence parked on the chapter');
  assert.equal(api.scrubAim(snapped, 2280), 268);
  const parked = vid(0.3, [[0, 4]], { __pxWin: 2280 });
  assert.equal(api.scrubHold(parked, 2280), true, 'sequence clock is the hover');
  const hlsLong = vid(0.2, [[0, 4]], { duration: 5713, __pxKind: 'hls' });
  assert.equal(api.scrubHold(hlsLong, 2280), true, 'hls duration is not the movie clock');
  assert.equal(api.scrubAim(hlsLong, 2280), -1);
  const absDur = vid(0.25, [[4475, 4480]], { duration: 5713, __pxKind: 'hls' });
  assert.equal(api.scrubHold(absDur, 4475), false, 'full-title duration does not make the still the hover');
  assert.equal(api.scrubAim(absDur, 4475), 4475);
  assert.equal(api.scrubHold(vid(0.2, []), 2280), false);
  assert.equal(api.scrubHold(vid(10, [[0, 40]], { duration: 100 }), 10), true);
  assert.equal(api.scrubAim(vid(0, [[0, 4]], { duration: 100 }), 10), 10);
});

test('hover scrub does not open a second MediaSource before the first frame', () => {
  const start = desktop.indexOf('function scrubCanOpen');
  const end = desktop.indexOf('window.__pxScrubTo');
  assert.ok(start > 0 && end > start);
  const playing = { id: 'playing', videoWidth: 1920, __pxFrame: 0, __pxMsRetry: 0, __pxHoldScrub: 0 };
  const thumb = { kids: [], insertBefore(el) { this.kids.push(el); return el; } };
  const document = {
    getElementById(id) {
      if (id === 'vid') return playing;
      if (id === 'thumb') return thumb;
      return null;
    },
    createElement() {
      return { style: {}, setAttribute() {}, addEventListener() {} };
    },
    body: { appendChild() {} },
  };
  const opens = [];
  function Hls() {
    opens.push('new');
    this.loadSource = () => opens.push('load');
    this.attachMedia = (el) => opens.push(el);
    this.on = () => {};
    this.destroy = () => {};
  }
  Hls.isSupported = () => true;
  Hls.Events = { LEVEL_LOADED: 'LEVEL_LOADED' };
  const api = new Function('document', 'Hls', 'PlexLoader',
    'let scrubVid=null,scrubHls=null,scrubAbs="",scrubTimer=0,scrubGive=0,scrubGen=0;\n' +
    'const scrubCache=new Map();\n' +
    desktop.slice(start, end) +
    '\nreturn { scrubNow, mountScrub };')(document, Hls, function PlexLoader() {});
  assert.doesNotThrow(() => api.scrubNow(120, { width: 172, height: 97 }),
    'hover before a frame must return before scrubBucket/playback_frame');
  api.mountScrub('plexuw://localhost/hls/' + 'ab'.repeat(16), 'hls');
  assert.deepEqual(opens, [], 'videoWidth alone must not construct a preview Hls');
  assert.equal(playing.id, 'playing');
  assert.equal(playing.__pxFrame, 0);
  assert.equal(thumb.kids.length, 0);
  playing.__pxFrame = 1;
  playing.__pxHoldScrub = 1;
  api.mountScrub('plexuw://localhost/hls/' + 'ab'.repeat(16), 'hls');
  assert.deepEqual(opens, [], 'hold during a play-source resume keeps the preview off');
  playing.__pxHoldScrub = 0;
  playing.__pxMsRetry = 'busy';
  api.mountScrub('plexuw://localhost/hls/' + 'ab'.repeat(16), 'hls');
  assert.deepEqual(opens, []);
  playing.__pxMsRetry = 0;
  api.mountScrub('plexuw://localhost/hls/' + 'cd'.repeat(16), 'hls');
  assert.equal(opens[0], 'new');
  assert.equal(opens[1], 'load');
  assert.ok(opens[2] && opens[2] !== playing, 'preview attaches to its own element');
  assert.equal(thumb.kids.length, 1);
});

test('play reset resumes the same MediaSource instead of rebuilding it twice', () => {
  const start = desktop.indexOf('function resumePlaySource');
  const end = desktop.indexOf('async function beginPlexPlay');
  assert.ok(start > 0 && end > start);
  const resumePlaySource = new Function(desktop.slice(start, end) + '\nreturn resumePlaySource;')();
  const calls = [];
  const hls = {
    recoverMediaError() { calls.push('recover'); },
    startLoad(t) { calls.push('start:' + t); },
  };
  resumePlaySource(hls, { errorAction: { flags: 16 } });
  assert.deepEqual(calls, ['start:-1'], 'ResetMediaSource already ran inside hls.js');
  calls.length = 0;
  resumePlaySource(hls, { errorAction: { flags: 0 } });
  assert.deepEqual(calls, ['recover', 'start:-1']);
  calls.length = 0;
  resumePlaySource(hls, {});
  assert.deepEqual(calls, ['recover', 'start:-1']);
  const err = desktop.slice(desktop.indexOf("data.details==='mediaSourceRequiresReset'"), desktop.indexOf('step=hls fatal'));
  assert.match(err, /resumePlaySource\(hls,data\)/);
  assert.match(err, /if\(n>=3\)return/);
  assert.doesNotMatch(err, /showPlayErr/);
  assert.doesNotMatch(err, /clearVid/);
  assert.doesNotMatch(err, /hls\.recoverMediaError\(\)/);
});
