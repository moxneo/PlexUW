# plexuw-prototype install lock (2026-10-22) — OPEN

**Status:** OPEN (as of Library write, 2026-10-22).

**When:** 2026-10-22 — stale installer on **plexuw-prototype** (panel server).

## Symptom

A **stale installer** remained stuck after a **git clone** that returned **404**, which held the panel **install lock** for that server.

## Remediation (reported)

Agent 0:

1. Stopped the stuck installer process.
2. Cleared **only that server's installing flag** (no broader panel sweep described).
3. Started the server again.

Reported by **Agent 0, not verified** in this repo.

## Follow-up (open)

**Wings** may still show **Starting** because of an **egg done-marker mismatch** between the egg definition and what the install actually completed. Root cause and fix tracked in dev work, not confirmed here.

## Related

- Server note: [../servers/plexuw-prototype.md](../servers/plexuw-prototype.md).
- Prior TTG8 install pain (404 clone, mixed content): [2026-10-21-ttg8-stuck-installs.md](2026-10-21-ttg8-stuck-installs.md).

Sources: Master Control relay and Agent 0, 2026-10-22.
