# Source status

| Layer | Status |
|-------|--------|
| GitHub `moxneo/PlexUW` | **Tip remote** — keep in sync with Origin tip (Scott 2026-10-26). Replaces the Oct 21 userscript-only tree. |
| Origin `moxneo/PlexUW` | Cursor coding forge — open tip PRs here (`cursor/live-versions-home-nav-8486` and successors). |
| Product shape | Rust/Tauri desktop app (not Tampermonkey). |
| Tip wipe lesson | 2026-10-24 local tip worktree removed with no remote — never rely on box-only trees. |

## Historical (recovery era)

After the 2026-10-24 tip wipe, Origin was seeded from recovered fu7h @ `22de557` plus carved tip frontend. Subsequent tips (including `e8a340e` / PR #2 era) were rebuilt on Origin. GitHub held only the early userscript seed until the 2026-10-26 sync.

## Build

See root `README.md`. Prefer `npx tauri` / `cargo tauri` after `desktop/` deps and `sync-web.sh`. Exact tip Rust between lost commits is gone; parity is validated by dual gate against live builds, not by claiming pixel match to every historical SHA.
