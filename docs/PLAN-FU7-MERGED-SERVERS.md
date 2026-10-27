# PLAN — FU7: Merged servers (no server picker)

PLAN ONLY. No code until Scott approves and Sentinel reviews. Base: `windows-app` @ 1fb9c89. Builds on PLAN-REAL-PLEX.md and its multi-server addendum (§§1–10) and on plexuw-research/PLEX-MULTI-SERVER.md. **This plan replaces** the addendum's "All servers + per-server filter" switcher (§1) and the auto "best source" pick (§2). The user picks a version on the title page.

## 1. UX model
- Remove the server picker. Library, Home and Search show titles from **all connected servers** (for example 3), merged and deduped.
- Title page: if a title is on 2 or more servers, show a **Versions** list sorted by quality, each row with a small server-name badge. Play uses the top row unless the user picks another row.
- If a title is on only one server, show no badge and no list. Play goes straight in.
- Offline or slow servers: a quiet "1 server unavailable · Retry" note. They never show an error wall.

## 2. Data model (Rust is the source of truth; the renderer gets a projection)
```
MergedItem { id: OpaqueId, kind, title, year, thumbId, sortKeys{addedAt,lastViewedAt,titleSort},
             watch: {viewed, offsetMs, lastViewedAt}, versions: [Version] }
Version    { versionId: OpaqueId, serverSlot, ratingKey, media: {height, bitrate, hdr, codec, container},
             serverName (display only), connKind: local|remote|relay }
```
- Opaque ids follow addendum §5: `slot.ratingKey` or an HMAC of it. They map to `(machineId, ratingKey)` only inside Rust. Every slot rotates on sign-out and on resources refresh, and an old id returns 404.
- Ordering of `versions[]`: resolution tier (4K ≥2160 > 1080 > 720 > SD), then bitrate desc, then HDR, then connKind (local > remote > relay), then owned before shared, then server name (for a stable order). Inside one server, the existing per-server Media/Part versions become separate rows.
- The merged item's art and metadata come from the top-ranked version. Relay rows show the 2 Mbps cap (addendum §10).

## 3. Fan-out and partial results
- Every list call (sections, hubs, search, paging) goes to all online servers in parallel. Limits: at most 4 servers in flight and at most 4 requests per server (addendum §6). Each server has its own **soft deadline of 1.5 s** and **hard timeout of 5 s**.
- Results stream to the UI. At the soft deadline Rust emits a first merged batch from the servers that have answered. Late servers merge in as more `batch` events. After the hard timeout a server is marked `slow/offline` for that request. It is not retried in a loop. A user Retry or a network change re-runs the race.
- A 401 from one server marks only that server offline and triggers one resources refetch. It never falls back to another server's token (addendum §9).

## 4. Paging and sorting across servers
- Use a k-way merge over a cursor per server. Each server keeps its own `X-Plex-Container-Start/Size` cursor and returns pages of 50, sorted **on the server** by the same key (`titleSort`, `addedAt:desc`, `lastViewedAt:desc`).
- Rust merges the heads and dedupes (§5), then emits a merged page of N. When a server's buffer drops below a low-water mark, Rust pulls that server's next page. The merged cursor is an opaque token held in Rust. It is a vector of per-server offsets and is never shown to the UI.
- Server-side sorts that don't match across servers: titleSort is normalized in Rust (case-fold, articles stripped, the same rule PMS uses). Ties break on GUID.
- Total count is shown as "≈" (the sum minus duplicates seen so far). We don't block to get an exact count.
- A server that drops out mid-scroll stops contributing. Items already shown stay, and a Version row for that server goes grey.

## 5. Dedupe keys and edge cases
- Primary key: `plex://movie|show|season|episode/<id>`, from the modern agents.
- Fallback when there is no plex GUID: the external Guid tags (`imdb://tt…`, `tmdb://…`, `tvdb://…`). Two items merge if **any** external id matches **and** their kinds match. For episodes, the show id and season/episode index must also match.
- Legacy agents (`com.plexapp.agents.imdb://tt…?lang=en`, `…themoviedb://`, `…thetvdb://`): parse them into the same normalized ids.
- `local://`, `none://`, personal media, or no GUID at all: **never merged.** They show as separate cards with a server badge. There is no title or year matching (addendum §2 rule; we accept the duplicates).
- Conflicts: if the plex GUIDs differ but an imdb id matches, trust the plex GUID and don't merge. Union-find over the keys, capped per page, stays O(n).
- Music and photos are not merged in FU7. They are listed per server with a badge.

## 6. Continue Watching / On Deck and watched state
- Fetch `/hubs/continueWatching` (fallback: `/library/onDeck`) per server. Merge by GUID and keep the entry with the newest `lastViewedAt`. Its offset becomes the "resume" point. Sort desc and cap at 50.
- Watched state is **per server and never synced**. The merged badge shows "watched" if any version is watched, and the progress bar shows the most recent progress. On the title page, each Version row shows its own state.
- Timeline, scrobble and mark-watched calls go **only to the server of the version being played or acted on**. Mark-watched on a merged card writes to the top version's server only. Cross-server sync is explicitly out of scope.
- Resume from a different server than the one holding the progress: offer "Resume from X:YY". The progress is reported to the playing server only.

## 7. Image proxy (LOW-10 cross-server rule)
- URL: `plexuw://img/<slot>/<opaqueThumbId>?w=&h=`. Rust resolves slot → machineId → that server's winning connection → **that server's** keychain token. The cache key is `(machineId, path, w, h)`, so the LRU never serves server A's bytes for server B.
- The thumb path must come from metadata already fetched from that same server. An unknown or stale slot, or a path not on the allowlist, returns 404. Merged cards use the top version's slot. There is no fallback to another server's token or host.

## 8. Cancellation and stale replies
- Every fan-out has a `requestId` (generation counter per view: library/section/sort, home, search query). A new query, navigation or sort change cancels the previous generation: Rust drops its tokio tasks (`AbortHandle`) and in-flight reqwest futures.
- The renderer drops any `batch` whose `requestId` ≠ current. Rust also refuses to emit for cancelled generations, so there are two guards.
- Search is debounced at 250 ms, and each keystroke supersedes the previous generation. Resources refresh or sign-out bumps a global epoch, and any reply from an older epoch is discarded before merge.

## 9. Security invariants (Sentinel checklist)
- [ ] **No token in the frontend.** No account or server token, machineId, host or connection URI reaches the renderer, IPC payloads, logs, errors, crash output or the merged cursor.
- [ ] **Server-id allowlist comes from resources only.** Slots are created only for `provides=server` entries in the latest plex.tv `/api/v2/resources` (plus an approved manual host bound to one machineId after an identity check). An unknown slot returns 404.
- [ ] **HTTPS only (P-1).** `load_resources` drops non-https connections. The fan-out, image proxy and media egress refuse `http://`. The existing test is extended to the parallel fan-out path.
- [ ] **No cross-server token use.** Token lookup goes machineId → `server:<machineId>` keychain entry, and the host must be in that server's own connection set (H2). Test: swap hosts across 3 fixture servers and confirm each request is denied with no token sent.
- [ ] **The account token is used only for plex.tv calls.** It is never sent to any PMS. Server tokens are never sent to plex.tv.
- [ ] **Opaque ids.** Item, version, thumb and cursor ids are opaque and rotate on sign-out and refresh. Prefs store at most a machineId for a sticky version, never a token or host.
- [ ] Cancellation leaves no task holding a token after sign-out. The sign-out wipe covers all `server:*` entries, slots, caches and cursors.
- [ ] Image LRU and metadata caches are keyed by machineId. A server that is removed or revoked purges its entries.

## 9a. Sentinel MUSTs (GO 2026-10-22 23:26). Status in FU7 build
- **MUST-1, sticky version stays Rust-only:** DONE. `merge::Sticky` maps guid→machineId inside `Plex` and is not Serialize. JS calls `version_pick({id})` with an opaque version id and only ever gets back `picked: true`. Nothing goes to localStorage or the WebView. Tests: `must1_sticky_is_rust_only`, `fu7_s9_versions_fanout_opaque_and_bound`.
- **MUST-2, shared servers are untrusted.** fu7c met this with the allowed alternative, after Scott's da Vinci SHOULD-3 spec. There are two orderings, kept apart on purpose:
  - **Versions LIST (display only):** `merge::sort_versions` orders purely by quality: 4K, then 1080p, 720p, SD and Unknown, then bitrate and HDR. Owned versus shared does not matter. A shared 4K is listed above an owned 1080p.
  - **TRUST (what the app acts on):** `merge::best_version` picks the best OWNED copy when one exists (owned first, then quality), otherwise the best copy overall. That copy alone supplies:
    - card art and metadata (title, summary, art, genres, ratings, cast) when the connected server is shared
    - `default_version`, the version Play uses unless the user picked one (the sticky pick, MUST-1)
  - Version rows are text only, with control characters stripped. A server badge is shown only when the copies span more than one server (SHOULD-4).
  - Tests:
    - `should3_list_by_quality_must2_best_owned_for_default` (merge)
    - `fu7_s9_versions_fanout_opaque_and_bound`: the list is non-increasing in tier and the default is the best owned copy
    - `low14_best_owned_metadata_and_pending_versions`
- **MUST-3, the HMAC key lives only in Rust:** DONE.
  - `merge::Slots` holds a 32-byte key that never leaves Rust. Server ids and version ids are 24 hex characters of HMAC-SHA256.
  - `rotate()` runs on sign-out and on every resources refresh (`Plex::set_servers`). It clears the slot map, the connection cache and, on sign-out, the sticky picks.
  - Old ids resolve to not-found (404). Tests: `must3_old_ids_404_after_rotation`, plus the rotation tail of the §9 test.
- **SHOULD, fan-out caps:** DONE.
  - At most 4 servers in flight and 16 servers in total.
  - `X-Plex-Container-Size=4` plus `take(4)` per server, and at most 8 media per item.
  - Each response is limited by the egress `MAX_API_BODY` cap, with a 5 s timeout per server and per call.
- **No "mark watched on all copies":** not implemented, by design.
- **§9 tests:** DONE (`fu7_s9_versions_fanout_opaque_and_bound`). It checks:
  - no token, machineId, plex.direct host or port in the serialized item
  - a host swap across MoxBox/Slowpoke/BLACKBOX is denied in all 4 swaps, with a control
  - https-only connections
- **Merged Home/library paging (§4) and opaque item ids (§2):** done in fu7b.

## 10. Milestones (estimates)
| Step | Scope | Effort |
|---|---|---|
| FU7-a | MergedItem/Version model, dedupe keys + unit fixtures (plex://, legacy, imdb/tmdb, local, conflicts) | 2 d |
| FU7-b | Fan-out with soft/hard deadlines, streamed batches, generation cancel | 2 d |
| FU7-c | k-way paging/sort, Home + CW merge, search | 2–3 d |
| FU7-d | Title page Versions list + badges, play routing, per-server watch writes | 2 d |
| FU7-e | Image proxy keyed by slot, invariant tests, Sentinel review | 1–2 d |

Open questions: should we offer an opt-in "mark watched on all copies"? The soft deadline value (1.5 s) needs measuring against real relay latency.

## Status: fu7b implemented
Merged home, libraries (per-type Movies and TV Shows; other sections as "title · server"), search, facets, letters and collections use a 1.5 s soft and 5 s hard deadline, at most 4 requests in flight, a 60 s TTL and the `plex-merge-fill` late refresh. Dedupe uses guid then title and year. The card is the best owned copy, and progress comes from the most recent copy. The cursor is opaque and HMAC-bound to its view. A 401 marks only that server offline. Item, image, cursor, library and section ids are all HMAC slots with epoch (mint_if) guards. `/library/all` is allowlisted only for a single plex:// guid plus bounded paging (LOW-15).

## Status: fu7c
- SHOULD-3 and MUST-2 split as described in §9a.
- SHOULD-4: no server badge when every copy is on one server.
- SHOULD-1: episodes without a guid dedupe on show + season + episode. The show is its plex:// guid when present, else its normalised title (`merge::episode_key`).
- SHOULD-2: cards list their source servers only when the title is on more than one server (`Item.sources`).
- INFO: the connect race, the semaphore wait and the request all share the single 5 s HARD deadline (`mx::fetch_on`). Test: `info_semaphore_wait_inside_deadline`.
- LOW-16: everything for `shot_id` exists only with `--features mockplex`: the command, its registration, the build.rs manifest entry, the permission, and the JS call (dropped with `__PLEXUW_MOCK__`).
