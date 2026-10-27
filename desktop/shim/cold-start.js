// Cold start (fu9p). Rust always begins on a first-run demo source, then reconnects
// in the background when the keychain already holds this clientId's account token.
// That placeholder is not a signed-out state. Opening "Connect to Plex" here forced
// OAuth on top of a live Home (e41547f hydrated the same keyring with no card).

/** @returns {'none'|'connect'|'keychain'} */
export function coldStartOverlay(st) {
  if (!st || st.signedIn) return 'none';
  if (st.keychain === 'unavailable') return 'keychain';
  const s = st.source || {};
  if (s.kind === 'demo' && s.reason !== 'offline') return 'connect';
  return 'none';
}

/** Drop a sign-in card once the saved session has a live server. Pin entry stays. */
export function shouldDismissConnect(source, pinUp, overlayOpen) {
  return !!(overlayOpen && !pinUp && source && source.kind === 'plex');
}
