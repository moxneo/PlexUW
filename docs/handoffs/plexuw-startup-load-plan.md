# PlexUW startup Libraries/Home fail — PLAN (Foreman 2026-10-24 ~7:18 PM ET)

Status: PLAN ONLY — idle until Scott GO. No code. Critics not queued.

## Symptom
First open: orange Libraries didn't load · Retry + Couldn't load Home. Retry / navigate away+back recovers. Recurring across tips (not eefc9c0-only).

## Primary suspects
1. Dual-flight: setSource → loadSections + home both invoke browse_home cold
2. Restore path skips servers_warm before first home
3. navState desync (fail affordance vs home paint)
4. Transient PMS/conn under Win cold start (amplified by 1)
5. Tip hydrate unlikely on Home — park

## Fix after GO
- Single-flight browse_home; home owns first paint; loadSections joins
- Sync navState from that result once
- Soft one-shot retry (or brief warm) on session restore before error UI
- Keep tip UI: Versions-only, Media hydrate, pills, hero, Credits

## Done-when (later)
Cold-start 5× Win/Linux: no false blank (silent retry ok). Dual then Win.

## Critics
da Vinci + Sentinel: NOT queued until Scott GO + Foreman READY
