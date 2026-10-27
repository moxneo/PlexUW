# Desk standing rules

Captured 2026-10-11, confirmed by Scott. Updated 2026-10-18 (overnight merge exception from Scott 2026-10-10; merge ping and relayed approvals from Scott 2026-10-15). Updated 2026-10-19 (Tailscale duty to Master Control, one dev bot, Oracle owns documents; Scott via Master Control). Updated 2026-10-21 (Hermes host update hold; Scott via Master Control). Updated 2026-10-22 (Scott update traffic; Scott via Master Control). Updated 2026-10-23 (Scott requests via voice message; Vxara overnight merge QA gate is **da Vinci Vxara**, not original **da Vinci**; Scott via Master Control). Updated 2026-10-24 (UX QA equal to functional QA for reviewers and Foreman; Sentinel breadth-first and not limited by brief scope; Scott via Master Control). Apply to every agent.

- Merges: Scott does all merges during the day. Scott merges after QA and Sentinel PASS on the head SHA: **da Vinci Vxara** and Sentinel for **TTGDevX/Vxara** PRs; **da Vinci** and Sentinel for all other work.
- Overnight merges (midnight to 8 AM ET): Master Control may merge a TTGDevX PR only if it isn't a draft, CI is green, and the repo-appropriate QA critic and Sentinel have both PASSed on the current head — **da Vinci Vxara** and Sentinel for **TTGDevX/Vxara**; **da Vinci** and Sentinel for other TTGDevX repos. Changes to live servers wait for morning. No other agent merges. (Scott, 2026-10-10; Vxara QA gate clarified 2026-10-23.)
- Merge ping: only Master Control sends it, once per PR. Wording: 'Scott, merge' plus the PR link, naming both PASSes. (Scott, 2026-10-15.)
- Fix loop: write a LESSONS note first, then rework. Cap of 3 tries, then escalate to Scott (through Master Control) with the LESSONS notes.
- Relayed approvals: an approval Master Control relays from Scott counts as Scott's. (Scott, 2026-10-15.)
- Stay in constant contact with Master Control.
- Confirmation asks go through Master Control.
- Development goes on GitHub TTGDevX, not Cursor Origin.
- No development on Cursor Origin or any Origin repo without Scott's explicit approval via Master Control. GitHub TTGDevX is the default.
- The Library is knowledge only.
- Naming: the Library uses real names (TTG, Scott Moyer, TTGDevX, ttgonline.ca). Customer/client names, contacts and machines are always stripped. See constraints/library-naming-2026-10-11.md. Two-tier cleansing applies to Mox Neo surfaces only, not the Library.
- New servers and Tailscale: for every new server, Master Control asks Scott whether grokbot-box needs Tailscale access. If yes, Master Control drafts the ACL grant, applied only after Scott approves it himself. (Scott, 2026-10-18; Tailscale Admin retired and duty moved to Master Control, Scott 2026-10-19.) See constraints/tailscale-new-server-access.md.
- One developer bot: Foreman does all development, Phoenix panel included. No separate specialist bot per dev area; overlapping agents get merged (e.g. Ember's Phoenix work went to Foreman) and duplicate routines get cut. (Scott, 2026-10-19.)
- Documents: Oracle owns all documents and the Library. Dev agents keep internal dev notes in their own repos; Oracle collects what matters. (Scott, 2026-10-19.)
- Hermes host updates: Scott put Hermes **v0.22.3** on hold 2026-10-21. No Hermes host updates until Scott says go (through Master Control). See [constraints/hermes-host-update-hold-2026-10-21.md](../constraints/hermes-host-update-hold-2026-10-21.md). (Scott, 2026-10-21.)
- Scott update traffic: Master Control and agents send Scott **no routine team updates** unless he **must answer a question**, plus **one update** when a **test he is waiting on** is done. (Scott via Master Control, 2026-10-22.)
- Scott requests: when the team **needs something from Scott**, send it as a **voice message**. (Scott via Master Control, 2026-10-23.)
- Reviews: **UX QA is a primary job, equal to functional QA**, for da Vinci, da Vinci Vxara and Foreman. UX problems noticed outside a review's scope are flagged, never ignored. **Sentinel** is not limited by brief scope: breadth-first hunt across the whole authorized surface, flag everything, then go deep. (Scott via Master Control, 2026-10-24.)
