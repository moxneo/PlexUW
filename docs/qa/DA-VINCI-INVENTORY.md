# da Vinci PlexUW QA inventory (read-only snapshot 2026-10-24 ~11:24 PM ET)

Reported by da Vinci to Master Control. Scorecard files were not re-verified against disk in this write — paths below are as reported.

## LOST tonight
- Entire Critic QA tree: `/workspace/plexuw-qa-m2/` (all SCORECARD-fu*.md + shot dirs including fu9g)
- Artifact dirs: ce60647, 98dd345, 9385cf2
- Critic never kept a PlexUW git worktree

## RETAINED
- Binaries: `/home/box/plexuw-artifacts/{07e369e,28cb8e1,56c5cdb,6b370e9,887b9e2,93cdcf0,a94deec,da1c68d,eefc9c0}/`
- fu9g dual-PASS binary + Foreman smoke under `…/6b370e9/smoke/`
- Foreman LIVE FAIL packs: `/workspace/perf-fu9k|l|m/` (not Critic dual)
- Loop docs: plexuw-tip-ad-loop.md, plexuw-tip-fu9-loop.md, plexuw-fu9b-report.md, plexuw-startup-load-plan.md
- Journal memory of PASS/FAIL (table below) — disk scorecards gone

## Critic results (journal; SCORECARDs lost)

| Tip | SHA | ~ET | Result |
|---|---|---|---|
| fu9g | 6b370e9 | 9:01 PM | PASS A–D LIVE |
| fu9d | 9385cf2 | 7:50 PM | FAIL (#2 no More/Less) |
| fu9c | 98dd345 | 7:36 PM | FAIL (#2 no More/Less) |
| fu9b | eefc9c0 | 6:50 PM | PASS |
| fu9a | ce60647 | 6:37 PM | FAIL (Credits overlay + hero) |
| fu8g | da1c68d | earlier | PASS note-5b |
| fu8f | 58382c6 | 5:49 PM | FAIL Available-on |
| fu8c | 4082a5b | 2:52 PM | FAIL A–R edge posters |
| fu8a | 974e343 | 2:00 PM | FAIL P8/P9 |
| fu7y | f7f45d6 | 12:43 PM | PASS avatar-chrome |
| fu7q | d3a43f6 | 1:20 AM | PASS Demo (later BigBoy override FAIL) |

## Post-fu9g (Foreman smoke; Critic not re-scored)
fu9i @ 887b9e2 FAIL sample.mp4 → fu9j @ 56c5cdb → fu9k/l/m FAIL Play/Escape
