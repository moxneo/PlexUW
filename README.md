# PlexUW

**Plex for ultrawide** — a native **Rust + Tauri** desktop app for Plex (TV & Movies). Not a Tampermonkey userscript.

This repository started on 2026-10-21 as a Plex Web injection layer (`pw.js` / Tampermonkey). The product has since evolved into a standalone desktop client. Treat anything that only describes the old userscript install path as **historical**.

## What it is now

- Desktop shell: Tauri 2 / Rust (`desktop/src-tauri`)
- UI: web frontend bundled into the desktop app (`desktop/`, root web assets)
- Features in active tip work: multi-server Versions, Home hero + Continue Watching chrome, compact-only nav tips, real playback (demo/mock stripped)
- Music library UI is **removed** from the current product tip (TV/Movies only)

## Source of truth

| Remote | Role |
|--------|------|
| **[github.com/moxneo/PlexUW](https://github.com/moxneo/PlexUW)** | Public GitHub clone Scott wants kept current with the tip |
| **[Cursor Origin moxneo/PlexUW](https://cursor.com/codebase/moxneo/PlexUW)** | Cursor cloud coding forge (PR tip branch `cursor/live-versions-home-nav-8486`) |

Tip SHA at last GitHub sync: see `SOURCE-STATUS.md` / commit history. Coding agents may open PRs on Origin; GitHub must stay synced so the tip is never box-only.

## Build / run (desktop)

Requirements: Rust stable, Node.js, Linux WebKit/Tauri system deps (or Windows/macOS Tauri prerequisites).

```bash
cd desktop
npm install
# Sync web bundle into desktop/dist (script name may be sync-web.sh)
./sync-web.sh   # or: bash sync-web.sh
# Prefer the Tauri CLI:
npx tauri dev      # development
npx tauri build    # release (AppImage / installers per target)
```

If `npm run tauri` is missing, use `npx @tauri-apps/cli` or `cargo install tauri-cli --locked`.

Unit/smoke checks used on tip (examples):

```bash
node --test desktop/shim/test/plex-browse.test.mjs
# selected Rust tests under desktop/src-tauri as wired in CI / agent runs
```

## Layout

| Path | Purpose |
|------|---------|
| `desktop/` | Tauri app, Rust backend, shim, tests |
| `app.js` / `index.html` / `styles.css` | Frontend shell bundled into desktop |
| `docs/` | Standing rules, HANDOFFs, Library mirrors, incident notes |
| `recovered/` | Historical carve/recovery artifacts — **not** the live product tree |
| `userscript/`, `pw.js`, `pw.css`, `install.sh` | **Legacy** Oct 2021→2026-10-21 injection seed (kept for history if present; not how you run PlexUW today) |

## Legacy userscript (historical only)

The original README described injecting `pw.js`/`pw.css` into Plex Web via Tampermonkey or `install.sh`. That is **not** the current product. Do not install the userscript expecting the desktop app.

## Status notes

- Demo mode / `sample.mp4` / mock library: removed from the product tip (Scott GO 2026-10-25).
- Windows builds are delivered after dual gate (LIVE QA + security CODE) passes on the Origin tip; setup + portable land in Scott’s Downloads.
- Disk cleanup on the shared bot computer must never delete PlexUW tip trees or QA packs.

See `SOURCE-STATUS.md` and `docs/` for recovery history and standing rules.
