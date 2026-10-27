# PlexUW product decisions

**PlexUW** is the Plex **ultrawide** player (HTML prototype and planned desktop clients). Visual reference: KuchiSofts VLC redesign — style only, not a dependency.

Source for decisions below: **per Scott via Master Control, 2026-10-22**, unless noted.

## Roadmap and content

- **Real Plex library content is next** — planned before additional build-out beyond what is already in flight.
- **Linux QA** comes before the **Windows** port.
- **Seerr** request integration is **parked under Later**.

## Server connection and auth

- **Generic server URL** setting (user-configurable base URL).
- **Plex PIN login** on **any** server (not tied to one host).
- **Sign-in for testing:** the team takes the link code from PlexUW's sign-in screen; Scott enters it at **plex.tv/link**. No codes are stored in the Library.

## Playback and account prefs

- **Music** is **low priority** (Scott uses Plexamp).
- **Audio and subtitle preferences** sync with the **Plex account**.
- **Quality presets** follow **Plex-style** presets.
- **Skip** (intro/credits behavior): either **automatic** or a **10–20 second** prompt — product choice still to be implemented against this rule.

## Layout and UI (reference: Plex HTPC)

- **One search button** opening **one** search screen.
- **Bigger navigation icons**.
- Scott's **name shown once** (not repeated in the chrome).
- **Clean collapsed sidebar**.
- **Custom category icon set** (project-specific, not default Plex icons only).

## Ultrawide vs normal displays

- **Ultrawide:** use extra width — e.g. **credits in a side column**, **full cover art** where it fits the layout.
- **Normal screens:** behavior and layout **unchanged** from the non-ultrawide baseline.

## Multi-server library model

Source: **per Scott via Master Control, 2026-10-22** (~11:24 PM ET).

- **No server picker** — one merged library experience.
- **MoxBox**, **Slowpoke**, and **BLACKBOX** merge into **one library**.
- Titles that exist on **more than one server** list versions with **4K first** and a **small server badge** on each version row.
- Titles on **only one server** have **no badge** and **play straight in**.
- **Approved** to build overnight for a **morning test on BigBoy**.
- **Sentinel** reviews the multi-server work.

Implementation status in TTGDevX is outside this doc; treat build/test outcomes as **not verified** until confirmed in chat or CI.

## 2026-10-23 (UI and playback ordering)

Source: **per Scott via Master Control, 2026-10-23**.

### Theme and audio chrome

- **Theme music** plays **by default**.
- **Settings** includes an **on/off switch** and **volume control** for theme music.

### Watchlist and row layout

- **One watchlist** with filters: **All**, **Movies**, and **TV**.
- **Row posters:** one **standard size**, **slightly smaller** than the **Last Airbender** poster reference, so a full row fits on screen at **first load**.

### Navigation chrome

- **Collapsed sidebar:** the **logo** is the **expand** control; collapse animates in a **clean order** (no overlapping or jumpy elements).

### Person page

- **Short bio** plus separate **Movies** and **TV** rows.
- If **Plex** has **no bios**, ask **Scott** before wiring an **outside movie database**.

### Movie page

- Clicking a **credit** opens that **person's page**.
- **Recommendations** row sits **below** the main content.
- **Info** and **three-dot** buttons are **removed**.
- Long lists **scroll smoothly** with **no flash** when the next page loads.

### Playback and platform order

- **Playback (M3)** stays **last**, after the **UI path** and **ultrawide** work.
- **Keyboard shortcuts** follow **Plex HTPC** defaults and can be **customized per customer**.

### QA (release binary)

- From **fu7k** onward, QA uses **release-binary** renders (or explicit mock/release labels). See [../../constraints/plexuw-qa-release-binary-2026-10-23.md](../../constraints/plexuw-qa-release-binary-2026-10-23.md).

## 2026-10-24 (profile egress, parked idea, builds)

Source: **per Scott via Master Control, 2026-10-24**.

### Real Plex profile (approved ~10:18 AM ET)

- Scott approved implementing the **real Plex profile** under **Sentinel's 8 MUSTs**.
- Only the **avatar** and **username** are read from plex.tv's user endpoint (`/api/v2/user`). **No other fields.**
- **Critic and Sentinel re-PASS** are required before the **Windows** build.

### Parked idea (no build) (~10:19 AM ET)

- **Available on:** list every server that has the title; clicking a server shows that copy's quality and file info and plays from it. **Parked** — not approved to build.

### Build rounds

- **~6:21 PM ET:** Scott **GO** on a tip after `da1c68d`: drop the "Available on" row, Metadata hydrate, pill row, smaller hero with fanart/collage.
- **~6:57 PM ET:** tip **`eefc9c0`** — dual PASS (critic and Sentinel); Windows setup and portable builds put in Scott's Downloads on **BigBoy**. Scott to retest Versions-only, Metadata hydrate, pills, smaller hero and fanart.
- **~7:20 PM ET:** Scott **GO** on tip items A–D: startup load race, bio More/Less, Credits hover/focus, Music server checks.
- **~9:09 PM ET:** tip **`6b370e9`** — dual PASS; Windows setup and portable builds on **BigBoy**. Scott to retest cold start, Cruise More/Less, Credits hover/focus, Music checks.

Build SHAs, PASS verdicts and delivery are **reported by Master Control, not verified** in this repo. The PlexUW source repo and these commits were not checked by Oracle.
