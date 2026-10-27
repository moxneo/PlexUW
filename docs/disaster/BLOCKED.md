# tip(fu9n) BLOCKED — worktree missing @ 07e369e

**Time (America/New_York):** 2026-10-24 ~11:00 PM ET  
**Executor:** Foreman tip-roll fu9n (local, no Cursor cloud, no push/merge/main)  
**Required HEAD:** `07e369e4b9d38d898c2b34fd440299203b7400a9` (fu9m parent)  
**Worktree:** `/workspace/plexuw-fu7i` — **GONE**

## What happened
1. Executor verified HEAD at `07e369e` on `/workspace/plexuw-fu7i` at start of fu9n GO.
2. Concurrent Master Control cleanup (same ~10:53 PM ET turn that GO’d fu9n) ran:
   `fu7i idle — deleting` → `rm -rf /workspace/plexuw-fu7i` (todo: Delete leftover once rustc finishes).
3. Tree removed mid-tip. Tip history is **local-only** (not on GitHub `moxneo/PlexUW`).

## Recovery attempted (all failed)
- GitHub tip SHAs / public repo: no `07e369e` / no tip history.
- BigBoy: no plexuw source repo for this tip chain.
- Git bundles / tarballs of tip tree: none found.
- `/tmp/h7`, `/tmp/clone7h`, `/tmp/base7i`, `/workspace/dist-fu7i`: older baseline (pre-fu9 tip chain); `git cat-file` cannot resolve `07e369e`.
- `/proc/*/cwd` still labeled `plexuw-fu7i (deleted)` (gnome-keyring-daemon) but inode empty — no files/FDs recoverable.
- AppImage/deb at `/home/box/plexuw-artifacts/07e369e/`: binaries + HANDOFF only; cannot reconstruct Rust/JS tip history or parent commit.
- Dist snaps at `56c5cdb` / `887b9e2` artifacts: frontend only, wrong SHA, insufficient for tip(fu9n) on parent `07e369e`.

## Surviving evidence (do not treat as source tree)
- Prior LIVE FAIL: `/workspace/perf-fu9m/LIVE-SMOKE-FAIL.md` + `/workspace/perf-fu9m/smoke/`
- Artifacts (binaries): `/home/box/plexuw-artifacts/07e369e/` (+ mirror pattern `/workspace/dist-fu9m-out/` if present)
- Plan log: `/workspace/plexuw-tip-ad-loop.md`
- Master transcript: cleanup + GO fu9n same turn (agent `e6c49ca6-6d2c-4580-a775-3c64053ca72a`)

## Binding RCA (unchanged — for when tree returns)
**A Play:** absolute `/hls/<32hex>` in `rewrite_m3u8` + status-class toasts (`Could not start playback (NNN)`); keep force-transcode + preflight + opaque_get.  
**B tdur:** HTML `#tdur` default `--:--:--`; paint from `durationMs` on stashDur / enter player / showErr.  
**C Escape:** force `#home` shown / `#player` hidden; hide `#pxcollage`/`#pxbdstack`; rebuild empty `#pxView` after returnHash.

## Not done (stopped per brief)
- No A–C code, no `tip(fu9n)` commit, no RELEASE/Gate-B, no artifacts under `/home/box/plexuw-artifacts/<fu9nsha>/`, no LINUX_READY_SMOKE_HANDOFF claiming PASS.
- Did **not** invent tip history or LIVE PASS.

## Need from Foreman / Master
Restore `/workspace/plexuw-fu7i` (or equivalent) with git history at **`07e369e`** as HEAD, then re-GO fu9n. Prefer: undelete from backup / re-copy tip worktree / provide git bundle with `07e369e` reachable. Until then: **BLOCKED**.
