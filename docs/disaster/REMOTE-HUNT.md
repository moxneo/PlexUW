# REMOTE-HUNT — PlexUW tip remote / push status
**When:** Sat Oct 24, 2026 ~11:12–11:15 PM ET (America/New_York)  
**Scope:** READ-ONLY. No push, commit, delete, or remote changes.  
**Question:** Did the bot-computer PlexUW project have a git remote, and were tip commits pushed before `/workspace/plexuw-fu7i` was deleted (~10:53 PM ET)?

## Master speak fields

- **remote_exists:** no (no GitHub remote on surviving tip-related clones; only a dead local path remote)
- **remote_url:** none for tip worktree; surviving `/tmp/clone7h` has `origin` → `/workspace/plexuw-fu7d` (path gone). Public repo URL that exists but is unrelated to tip chain: `https://github.com/moxneo/PlexUW.git`
- **latest_pushed_sha:** `9dc0463a2c978d80dcb4ea3b4ff6a880216955b9` (moxneo/PlexUW `main` only; Tampermonkey/static installer, pushed 2026-10-21)
- **tip_commits_recoverable_from_remote:** no (esp. `07e369e` — all listed tip SHAs HTTP 422 on moxneo/PlexUW)
- **evidence:** see bullets below
- **other_machines:** BigBoy connected; this run’s Shell to BigBoy failed (temp ps-script file lock). Prior RECOVERY-FAILED.md (~same night): Downloads Win installers only; no plexuw `.git` / tip objects. TTG/Asus/omarchy/iPhone offline. TTGDevX/PlexUW: GitHub App `scm_repo_not_accessible` (missing/ungranted/nonexistent).

## Evidence (short)

- `/workspace/plexuw-fu7i` and `/workspace/plexuw-fu7d` are **gone**; tip worktree deletion noted ~10:53 PM ET in `/workspace/perf-fu9n/RECOVERY-FAILED.md` / `BLOCKED.md`.
- Surviving `/tmp/clone7h`: `remote.origin.url = /workspace/plexuw-fu7d` (local path only, not github.com). HEAD `22de557` (fu7h). `git cat-file` cannot resolve any tip SHA (`07e369e`…`da1c68d`).
- HANDOFF-fu9k/l/m each say: worktree `/workspace/plexuw-fu7i` — **“detached local tip; no push/merge/main/Win”**.
- `BLOCKED.md`: “Tip history is **local-only** (not on GitHub `moxneo/PlexUW`).”
- GitHub API (this hunt): `moxneo/PlexUW` exists; branches=`main` only @ `9dc0463…`; `pushed_at` 2026-10-21. Tip SHAs via `gh api …/commits/<sha>` → **422** for: 07e369e, 28cb8e1, 93cdcf0, 56c5cdb, 887b9e2, 6b370e9, eefc9c0, a94deec, da1c68d.
- `TTGDevX/PlexUW`: connector returns not accessible; do not treat as a tip remote.
- `/home/box/.bash_history`: no matches for `git remote`/`git push`/`moxneo/PlexUW` in this scan.
- Artifacts under `/home/box/plexuw-artifacts/{07e369e,28cb8e1,…}/` are binaries + HANDOFF only — not git object stores.
- Cursor stores: only incidental plexuw note (`READY-a94deec.md`); no tip remote URL found in store scan.

## Conclusion for voice

Tips after fu7h lived only on the deleted local worktree. They were **never pushed**. Remote cannot recover `07e369e` or the listed tip chain.
