# PlexUW release notes

## 0.1.0-fu7 (windows-app branch, local build, 2026-10-23)

### Bundled media framework (Sentinel LOW-12)
- The Linux AppImage bundles GStreamer **1.26.2** (Debian 13 packages: core 1.26.2-2; plugins-base and plugins-good 1.26.2-1+deb13u2; plugins-bad 1.26.2-3+deb13u3; libav 1.26.2-1+deb13u1).
- Rebuild the AppImage whenever GStreamer publishes a security advisory against 1.26.x.
- The .deb uses the system GStreamer. The Windows build uses WebView2 media, with no GStreamer.

### Changes
- Connecting tries every address at once (local and manual first, remote, then relay), so a dead remote no longer delays the connection.
- Linux sign-in now uses the default Secret Service collection. With no keyring service, the app shows a hint; it never falls back to plaintext. **After upgrading, sign in again once.** There is no migration from the old collection.
- The PIN code always stays in the app with a waiting state. Cancel returns you to the sign-in screen, not to demo Home.
- Below 1600px, the rail toggle opens the full rail as an overlay. Click outside it or press Esc to close it.
- Home no longer shows Continue Watching twice.
- Music artists and albums now use square tiles, with no watched badges and a placeholder initial when there is no art. The Studios tab is gone for music.
- Episode cards in a season row use their own thumbnail.
- Esc closes the Info and Chapters panels.
- The server picker dropdown is gone. A title's page and Info panel now list its **Versions** across your servers:
  - Owned servers come first, then the rest by quality.
  - Each row shows a server badge. There is no badge when there is only one version.
  - Clicking a row remembers your preferred copy. That preference stays inside the app core.
