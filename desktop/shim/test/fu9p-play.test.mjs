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
