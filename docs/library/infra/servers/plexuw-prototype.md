# PlexUW prototype (panel server)

**PlexUW** is a Plex **ultrawide** player. A native **Windows/Mac desktop app** is being explored. The **KuchiSofts VLC** redesign is a **visual style reference only** — not a dependency, not a code source.

## This server

- **Server name:** plexuw-prototype.
- **Node:** TTG8 (Wings).
- **Role:** Host the **HTML prototype** of the ultrawide player for review in a browser.

## Status (2026-10-21)

As of ~3:03 PM ET the install was stuck: the egg installer hung on a **git clone** that returned **404**. Foreman switched the egg to **file upload** and reinstalled; it **still failed**. Browser uploads and the server console were blocked because the HTTPS panel cannot reach TTG8 Wings over plain HTTP (mixed content).

**Incident (OPEN):** [../incidents/2026-10-21-ttg8-stuck-installs.md](../incidents/2026-10-21-ttg8-stuck-installs.md).

Sources: Master Control relay, 2026-10-21. Reported by Master Control / Agent 0, not verified.

## Status (2026-10-22)

A **stale installer** (same **404** clone class as above) left the panel **install lock** engaged. Agent 0 stopped the installer, cleared **this server's installing flag only**, and started the server again.

**Wings** may still display **Starting** due to an **egg done-marker mismatch** — open follow-up.

**Incident (OPEN):** [../incidents/2026-10-22-plexuw-prototype-install-lock.md](../incidents/2026-10-22-plexuw-prototype-install-lock.md).

Sources: Master Control relay and Agent 0, 2026-10-22. Reported by Agent 0, not verified.
