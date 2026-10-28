// fu6: the rail icon set is one original, stroke-based set with the #FF7A1A accent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { PX_ICONS } = await import(join(here, '..', 'px-icons.js'));
const browse = readFileSync(join(here, '..', 'plex-browse.js'), 'utf8');
const css = readFileSync(join(here, '..', 'desktop.css'), 'utf8');

test('covers every rail destination', () => {
  for (const n of ['mark', 'home', 'search', 'ask', 'film', 'tv', 'music', 'playlist', 'photo', 'folder', 'gear', 'server', 'profile', 'sidebar'])
    assert.ok(PX_ICONS.includes(n), n);
});
test('Movies and TV are not play triangles', () => {
  const m = browse.match(/const SECIC = \{([^}]*)\}/)[1];
  assert.match(m, /movie: 'film'/); assert.match(m, /show: 'tv'/);
  assert.doesNotMatch(m, /play'/);
});
test('stroke-based, accent #FF7A1A, 44px hit targets, 22–24px icons', () => {
  assert.match(css, /\.pxi\{[^}]*fill:none;stroke:currentColor/);
  assert.match(css, /\.pxi \.pxia\{stroke:#FF7A1A\}/);
  assert.match(css, /#pxNav a\{min-height:44px/);
  assert.match(css, /#pxNav a \.pxi\{width:22px;height:22px\}/);
  assert.match(css, /#pxNav a\{width:44px;height:44px[^}]*\}#pxNav a \.pxi\{width:22px;height:22px\}/);
  assert.match(css, /--rail:72px;--rail-icon:22px/);
  assert.doesNotMatch(css, /#pxNav a \.pxi\{width:24px/);
});
test('plex mode: no pxprof button; the legacy rail profile and side-foot are hidden', () => {
  assert.doesNotMatch(browse, /el\('button', 'pxprof'\)/);
  assert.match(css, /body\.plexmode #nav,body\.plexmode \.side-foot,\.pxprof\{display:none!important\}/);
});
test('fu6 details: poster never cropped; ultrawide layout gated to big screens', () => {
  const css = readFileSync(join(here, '..', 'desktop.css'), 'utf8');
  assert.match(css, /\.pxposter\{object-fit:contain/);
  assert.match(css, /@media \(min-width:2560px\),\(min-aspect-ratio:21\/9\) and \(min-width:1800px\)\{\n \.pxshell:not\(\.ropen\) \.pxdet\{[^}]*grid-template-columns/);
});
test('fix-loop 1: poster hugs 2:3; AppImage bundles GStreamer plugins', () => {
  const css = readFileSync(join(here, '..', 'desktop.css'), 'utf8');
  assert.match(css, /\.pxposter\{aspect-ratio:2\/3;height:auto;align-self:flex-start\}/);
  const conf = JSON.parse(readFileSync(join(here, '..', '..', 'src-tauri', 'tauri.conf.json'), 'utf8'));
  assert.equal(conf.bundle.linux.appimage.bundleMediaFramework, true);
});
