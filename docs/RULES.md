# PlexUW standing rules (recovered into SoT repo)

## No repo, no work (2026-10-24 night — Scott after tip loss)
Tip worktrees were local-only and never pushed. Going forward, PlexUW source of truth is this Origin repo (`moxneo/PlexUW`). Do not treat box worktrees as the only copy.

## Never delete plexuw worktrees as disk cleanup
From Library incident `infra/incidents/2026-10-23-plexuw-proto-disk-cleanup.md`:
1. Never delete `/workspace/plexuw-*` or `artifacts-*` as routine disk cleanup.
2. Before deleting any git folder: `git worktree list`, confirm no active worktrees, confirm work is pushed or copied to Library/keeper.
3. Abandoned build files may be deleted when notes stay in the Library.
4. Keepers go in a **PlexUW keep** folder in Scott's Downloads on BigBoy (not in git).

HARD (Master memory): Never delete PlexUW tip worktrees until Foreman reports tip parked or READY delivered.

## QA release-binary lesson (fu7k+)
From Library `constraints/plexuw-qa-release-binary-2026-10-23.md`: QA renders from release binary (or labelled mock/release); decode embedded assets and fail on dist mismatch; release-mode QA before Scott test; build id in Settings > About; verify BigBoy installer delivery.

## Voice desk dual gate
On dual Linux PASS (da Vinci LIVE + Sentinel CODE), Master GO Foreman Windows → CopyFromBox to BigBoy Downloads → voice-memo Scott. No BigBoy until both pass.
