# tip-frontend-6b370e9 — provenance

- Tip `6b370e9` AppImage has **no loose web tree**; frontend is **embedded inside** `usr/bin/plexuw` ELF (~11MB).
- Files here are copied from `/home/box/plexuw-artifacts/887b9e2/dist/` (post-6b370e9 tip dist, Music-nav still present in app.js — see FINDINGS).
- Binary confirms embedded `assets/sample.mp4`, `use_demo`, build id `6b370e9…` in ELF strings.
- Treat as **best recovered tip frontend**, not a byte-identical extract of the 6b370e9 embed until a full Tauri asset carve succeeds.
