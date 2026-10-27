# PlexUW proto disk cleanup (2026-10-23) — OPEN

**Status:** OPEN (as of Library write, 2026-10-23).

**When:** 2026-10-23 — disk cleanup on **PlexUW** (reported).

## Symptom

Disk cleanup **deleted** **`/workspace/plexuw-proto`** and **lost unpushed git history**. Other **`fu7*`** working folders on the box were **git worktrees** tied to that repository; removing the main tree left those worktrees without their parent and without recoverable unpushed commits on the server.

## Root cause (reported)

Cleanup ran **without** checking **`git worktree list`** or confirming branches were **pushed** before removing git directories.

Reported by **Master Control / Agent 0, not verified** in this repo.

## Standing rules (Library)

1. **Never delete** **`/workspace/plexuw-*`** or **`artifacts-*`** folders as part of routine disk cleanup.
2. **Before deleting any git folder**, run **`git worktree list`**, confirm no active worktrees depend on it, and confirm **all work is pushed** (or copied into the Library / a keeper archive).
3. **Abandoned PlexUW build files** that already failed or were superseded **may** be deleted when **notes stay in the Library** (changelog, decisions, or incident).
4. Artifacts Scott wants to keep go in a **PlexUW keep** folder in Scott's Downloads on **BigBoy** (not in git).

## Follow-up (open)

- Whether any **fu7\*** commits can be recovered from local clones on **BigBoy** or elsewhere is **unverified**.
- Process owner: **Master Control** (disk) with **Foreman** / PlexUW dev for worktree hygiene.

## Related

- Prior install-lock pain on prototype hosting: [2026-10-22-plexuw-prototype-install-lock.md](2026-10-22-plexuw-prototype-install-lock.md).
- PlexUW QA release-binary rule: [../../constraints/plexuw-qa-release-binary-2026-10-23.md](../../constraints/plexuw-qa-release-binary-2026-10-23.md).

Sources: Master Control relay, 2026-10-23.
