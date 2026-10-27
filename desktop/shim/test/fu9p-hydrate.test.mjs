// fu9p: a saved keychain session must not raise Connect to Plex at cold start.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coldStartOverlay, shouldDismissConnect } from '../cold-start.js';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = readFileSync(join(here, '..', 'desktop.js'), 'utf8');

const demo = (reason) => ({ kind: 'demo', reason });
const plex = { kind: 'plex', server: 'moxneo', connection: 'manual', owned: true };

test('signed-in + first-run placeholder does not open Connect', () => {
  assert.equal(coldStartOverlay({ signedIn: true, keychain: 'ok', source: demo('first-run') }), 'none');
  assert.equal(coldStartOverlay({ signedIn: true, keychain: 'ok', source: plex }), 'none');
  assert.equal(coldStartOverlay({ signedIn: true, keychain: 'ok', source: demo('offline') }), 'none');
});

test('no keychain token still asks to sign in, except an offline reconnect', () => {
  assert.equal(coldStartOverlay({ signedIn: false, keychain: 'ok', source: demo('first-run') }), 'connect');
  assert.equal(coldStartOverlay({ signedIn: false, keychain: 'error', source: demo('chosen') }), 'connect');
  assert.equal(coldStartOverlay({ signedIn: false, keychain: 'ok', source: demo('offline') }), 'none');
  assert.equal(coldStartOverlay({ signedIn: false, keychain: 'ok', source: plex }), 'none');
});

test('missing keychain is the keychain card, not OAuth', () => {
  assert.equal(coldStartOverlay({ signedIn: false, keychain: 'unavailable', source: demo('first-run') }), 'keychain');
});

test('a live plex-source dismisses Connect unless a PIN is on screen', () => {
  assert.equal(shouldDismissConnect(plex, false, true), true);
  assert.equal(shouldDismissConnect(plex, true, true), false);
  assert.equal(shouldDismissConnect(plex, false, false), false);
  assert.equal(shouldDismissConnect(demo('first-run'), false, true), false);
});

test('desktop.js uses the hydrate gate and still has no demo mode', () => {
  assert.match(desktop, /coldStartOverlay\(st\)/);
  assert.match(desktop, /shouldDismissConnect\(ev\.payload,\s*pinUp,\s*!ov\.hidden\)/);
  assert.match(desktop, /showSource\(st\.source,\s*st\.signedIn\)/);
  assert.doesNotMatch(desktop, /kind==='demo'&&st\.source\.reason!=='offline'&&ov\.hidden\)welcome\(\)/);
  assert.doesNotMatch(desktop, /use_demo/);
  assert.match(desktop, /Not signed in/);
  assert.match(desktop, /Signed in/);
});
