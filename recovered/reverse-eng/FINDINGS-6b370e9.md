# Reverse-eng findings — tip 6b370e9 (interim)

Source binaries on box (copy-only; originals untouched):
- `/home/box/plexuw-artifacts/6b370e9/plexuw` (ELF ~11MB)
- AppImage/deb alongside; Win portable/setup under `/workspace/perf-fu9n/bigboy-*.exe`

## Confirmed in tip ELF strings
- Embedded asset path: `assets/sample.mp4` (Demo / offline play stub)
- Demo flags: `use_demo` / `use-demo` / `OnDemand` + `useDemo` settings field
- Plex auth: `plex.tv/link/pin`, `chosen.plex.direct`, `discover.provider.plex.tv`, `/api/v2/user`
- Playback-related settings fields: `localQuality`, `remoteQuality`, `relayQuality`, skip intro/recap/credits
- `musicPlayback` / `themeMusic` still present as settings keys in binary (product Music tab removal is a later frontend tip @ 887b9e2 — verify in tip-dist app.js)
- Tauri desktop stack (webview, menu, keychain)

## Size deltas (frontend)
- fu7h `app.js`: 64294 bytes
- tip-dist `887b9e2/dist/app.js`: 69929 bytes (~5.6KB larger — tip UI/player work landed in JS after fu7h)

## opaque_get
- Not yet isolated as a clear symbol name in first `strings|rg` pass; continue in AppImage squashfs / win extract.

## Parity (honest)
- Tip **git source after fu7h `22de557` is gone**. Rebuild base = fu7h tree + tip frontend carve + binary clues.
- Looking/working **identical** to BigBoy tip install is **not verified** until a rebuilt binary matches release QA against the kept 6b370e9 artifact.
