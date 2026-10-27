# PlexUW next tip after 6b370e9 (Scott GO voice ~9:16 PM ET 2026-10-24)

Base: 6b370e9ae0d5383e306a58b2e1dd0adf5a1fad78

## MUST
1. Remove Music completely — TV + Movies only
2. Cast hover — clear visual cue on cast/actor circles + names
3. Video player — real playback so Scott can play and test player UI

## KEEP (already in 6b370e9)
Startup load, bio More/Less, Versions-only, Media hydrate, pills, hero+fanart

## DROP
Music merge / Music page fix / nav-from-Music follow-up

## Gate
Linux READY → dual → Win BigBoy

## Loop

| When | Tip | Result |
|------|-----|--------|
| ~9:59 PM | fu9i @ 887b9e2 | FAIL — sample.mp4 stub |
| ~10:11 PM | fu9j @ 56c5cdb | FAIL — toast + 10s + Escape→Neon |
| ~10:22 PM | fu9k @ 93cdcf0 | FAIL LIVE MUST3 — HEVC Play "Could not start", 00:00:10, Escape blank blur. KEEP1 PASS. Evidence `/workspace/perf-fu9k/smoke/` |

### Last critique (fu9k)
- mediaDur prefers vid.duration → sample 10s wins
- HLS directStream=1 fails HEVC/MKV (need force transcode)
- Escape not goBackFromPlayer → blank shell

### Next
**GO fu9l from 93cdcf0** — force-transcode HLS non-native; clear sample before play; mediaDur plex-first; Escape→returnHash. LIVE prove advance. KEEP MUST1+2. Win HELD until dual PASS.

| ~10:37 PM | fu9l @ 28cb8e1 | FAIL LIVE MUST3 — same Play fail + Escape blank. Evidence `/workspace/perf-fu9l/smoke/` |

### Last critique (fu9l)
- play_start OK after fire-and-forget /decision; no preflight start.m3u8 → opaque_get 502
- mediaDur hardcodes 10 when plexId missing
- Escape hides chrome (ambient blur) instead of goBackFromPlayer

### Next
**GO fu9m from 28cb8e1** — HTPC-complete universal + validate playlist before JS OK; seed durationMs; Escape→returnHash. KEEP MUST1+2. Win HELD.

| ~10:53 PM | fu9m @ 07e369e | FAIL LIVE MUST3 — preflight ok then hls fatal; 10s default; Escape empty browse. Evidence `/workspace/perf-fu9m/` |

### Last critique (fu9m)
- play_start Ok then hls/video fatal code 0 (segment/opaque/decode)
- Fake 10s = HTML #tdur default never painted on fail
- Escape returnHash leaves empty collage/bdstack ambient

### Next
**GO fu9n from 07e369e** — absolute /hls ids + status-class errors + tdur seed paint + Escape force-restore browse. Prefer LIVE advancing media. KEEP MUST1+2. Win HELD.

## BLOCKER 2026-10-24 ~11:08 PM ET
Master accidentally deleted `/workspace/plexuw-fu7i` (active tip worktree). Recovery FAILED — tip `07e369e` and entire local tip chain after fu7h unrecoverable. See `/workspace/perf-fu9n/RECOVERY-FAILED.md`.

Foreman idle on Play. Win HELD.

Await Scott: (A) off-box tip clone/bundle, or (B) GO rebuild tip from fu7h + HANDOFFs (new SHAs).
