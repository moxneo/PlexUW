# tip(fu9n) recovery FAILED — 07e369e unrecoverable on shared box

**Time (America/New_York):** 2026-10-24 ~11:08 PM ET  
**Target HEAD:** `07e369e4b9d38d898c2b34fd440299203b7400a9` (fu9m)  
**Deleted path:** `/workspace/plexuw-fu7i` (rm -rf ~10:53 PM ET)  
**Outcome:** **NOT RECOVERED.** No clone, bundle, pack, or git object store on the box (or BigBoy) contains reachable `07e369e` or nearer tip SHAs (`28cb8e1`, `93cdcf0`, `56c5cdb`, `887b9e2`, `6b370e9`, …). Did **not** invent commits or claim AppImage/deb as source.

## Verified negative (git objects)

- Probed **72** `.git` dirs under `/workspace`, `/tmp`, `/home/box`, `/cursor/stores` with `git cat-file -t` for tip + parent + mid-chain SHAs → **0 hits**.
- No loose object `objects/07/e369e4…` anywhere (xdev find).
- No `*.bundle` / orphan `*.pack` for PlexUW (only unrelated `gpu-shim.bundle` under cloud-agent-artifacts).

## Paths searched

| Avenue | Result |
|--------|--------|
| `/workspace/plexuw-fu7i` / `plexuw-fu7i.git` / `plexuw-tip` | Gone |
| `/workspace/plexuw-proto` (+ worktrees `fu6wt`/`fu2wt` gitdir pointers) | Proto gone; worktrees dangling |
| `/workspace/plexuw-fu7d` (clone7h origin) | Gone |
| `/tmp/clone7h` | HEAD=`22de557` (fu7h); tip SHAs absent |
| `/tmp/base7i`, `/tmp/h7` | Source trees, **no `.git`**, fu7h-era |
| `/tmp/bchk` | HEAD=`3fa0933` baseline=fu7h content; tip absent |
| `/workspace/plexuw-live` | README only, no `.git` |
| `/workspace/dist-fu9*`, `dist-fu7*`, snaps | Binaries / frontend snaps; no tip `.git` |
| `/home/box/plexuw-artifacts/{07e369e,28cb8e1,93cdcf0,56c5cdb,887b9e2,6b370e9,…}` | AppImage/deb/plexuw + HANDOFF only; `bundle/` = packaging dirs not git |
| `/cursor/stores/*` | Attachments/media + READY notes; no tip git |
| `/home/box/agent-data` | Transcripts/handoffs mention SHA; no objects |
| Trash / Timeshift / `.snapshots` / `lost+found` | None usable |
| `extundelete` / `debugfs` / `testdisk` | **Not installed**; skipped non-destructive undelete (would need tools + risk) |
| `/proc/*/cwd` still `plexuw-fu7i (deleted)` | gnome-keyring only; cwd empty; no file FDs |
| GitHub `moxneo/PlexUW` (`gh` as ttgonlineca) | Only old Tampermonkey tip `9dc0463…` (pushed 2026-10-21); **all tip SHAs 422 Not Found**; branches: `main` only |
| Cursor Origin `moxneo` | filter `plex` → **0 repos** |
| BigBoy (connected) | Downloads has Win installers only; no plexuw `.git` / tip objects |

## Nearest surviving git HEAD (NOT tip chain)

- `/tmp/clone7h` → `22de5570d54198f8bf7c13be5ee5c032fb4e5e4b` (fu7h)  
- **Missing tip commits after that:** entire local tip chain through at least `6b370e9` … `887b9e2` … `56c5cdb` … `93cdcf0` … `28cb8e1` … **`07e369e`**.  
- **Not restored** to `/workspace/plexuw-tip` — too far behind to label a tip fallback per brief (nearer tips were `28cb8e1`/`93cdcf0`/etc., none present).

## Surviving non-source evidence (do not treat as tip tree)

- `/home/box/plexuw-artifacts/07e369e/` (+ `/workspace/dist-fu9m-out/`)
- `/workspace/perf-fu9m/HANDOFF-fu9m.md`, `LIVE-SMOKE-FAIL.md`, smoke/
- `/workspace/plexuw-tip-ad-loop.md`
- `/workspace/perf-fu9n/BLOCKED.md`

## Next step for Foreman / Master

1. Tip history is **local-only and destroyed** unless an off-box copy exists (laptop clone, Time Machine, another agent machine, prior `git bundle` not on this box).  
2. If no off-box copy: **rebuild tip chain from last known good source tree** (fu7h `/tmp/clone7h` or equivalent) + re-apply tip work from HANDOFF/LESSONS — new SHAs; cannot resurrect `07e369e`.  
3. Until a real tree with reachable tip exists: **fu9n stays BLOCKED**.  
4. Policy: after any future tip READY, `git bundle create` + copy off-box before cleanup `rm -rf`.
