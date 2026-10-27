# PlexUW tip recovery options — 2026-10-24 ~11:25 PM ET (America/New_York)

**Scope:** SAVE/COPY investigation after `rm -rf /workspace/plexuw-fu7i` (~10:53 PM ET).  
**Hard rule observed:** no delete/overwrite of originals; reports + copies only under `/workspace/perf-fu9n/`.  
**Tip path fact:** deleted tree lived on the **shared Linux bot box** (`/workspace/plexuw-fu7i`), **not** on BigBoy. BigBoy only ever held Win installers/binaries.

---

## Recoverable now

| Asset | Where | Notes |
|-------|-------|-------|
| Git rebuild base fu7h | `/tmp/clone7h` @ `22de557` (also copied under `recovered/clone7h-fu7h/`) | Full desktop/src-tauri Rust + app.js at fu7h; tip SHAs **absent** |
| Tip-era HANDOFF docs | `recovered/handoffs/` + originals under `/home/box/plexuw-artifacts/*/HANDOFF*.md` | fu9k/l/m detail MUST/files/parent SHAs — rebuild recipe, not source |
| Tip-era Linux binaries | `/home/box/plexuw-artifacts/{07e369e,28cb8e1,93cdcf0,56c5cdb,887b9e2,...}/` | AppImage/deb/`plexuw` — **compiled**; `opaque_get` / `allow-opaque-get` strings present in `07e369e/plexuw` |
| Frontend dist (mid tip) | `recovered/artifact-dist/887b9e2-dist/` (`app.js` 69929 B) | Newer than fu7h (64294 B); still has Music rail — **pre** Music-gone tips |
| Older frontend snaps | `recovered/dist-survivors/dist-fu7{i,j,l,m}-*` | Same 64294 B app.js class as fu7h — UI reference only |
| Win installers (BigBoy live) | Downloads setup+portable = artifact **6b370e9**; AppData `plexuw.exe` different hash | Already CopyToBox’d earlier as `bigboy-*.exe` |
| Win installers (Recycle) | Copied to `C:\Users\Mox\Downloads\plexuw-recycle-rescue\` and box `extracted/recycle/` | fu7m/fu7l setups + plexuw.exe; NSIS → nested `plexuw.exe` only — **no** `.rs` / tip `app.js` |
| Build scripts | `/workspace/build-fu*.sh` still on disk | Reference paths into deleted `plexuw-fu7i/desktop` |

**Not tip git, but useful for rebuild:** HANDOFF file lists (e.g. fu9k: `commands.rs` opaque_get, `app.js` mediaDur/`#player/plex`, shim tests).

---

## Possibly recoverable with Scott GO

| Avenue | What Scott must approve | Odds / risks |
|--------|-------------------------|--------------|
| **Offline ext4 undelete** | Quiesce box; remount `/` **read-only** or boot live USB; run `extundelete` / `debugfs` with **output on external disk** (not `/dev/vdb`) | **Low–medium and falling.** `extundelete` installed; on mounted `/dev/vdb` it refused (`Mounted filesystem detected`, `EXT3_FEATURE_INCOMPAT_RECOVER`). Hours of writes since ~10:53 PM (incl. this rescue) overwrite free space. **Do not** restore onto the live root. |
| **photorec / testdisk** | Explicit Scott GO; install `testdisk`; carve to external media | Last-ditch file carve; won’t restore git history; high noise; same overwrite risk |
| **BigBoy VSS (admin)** | Elevated admin shell: `vssadmin list shadows` | **Unlikely to help tip source** — tip was never on BigBoy. This pass: non-admin `vssadmin` denied; WMI `Win32_ShadowCopy` returned **empty**; no File History dir |
| **Restore Recycle remaining fu6/fu7b/fu7c setups** | Already path-listed via Shell.Application; copy rest like fu7m/l | Installers only — UI/binary reference, not tip git |
| **Off-box tip clone/bundle** | Scott provides USB/laptop/cloud copy if any agent ever bundled tip | Only path that resurrects exact SHAs `07e369e`… |

**Stopped short (need GO / unsafe):** no `--restore-directory` / `--restore-all` while root mounted; no photorec; no format; Recycle `C:\$Recycle.Bin` still outside normal local-exec root (COM copy worked for named `$R*` files).

---

## Gone for good (on known surfaces)

- Tip git objects/SHAs after fu7h: `07e369e` `28cb8e1` `93cdcf0` `56c5cdb` `887b9e2` `6b370e9` `eefc9c0` `a94deec` `da1c68d` — **not** in `/tmp/clone7h`, other `/tmp/*/.git`, GitHub `moxneo/PlexUW` @ `9dc0463` (Tampermonkey), or probed packs/bundles
- Live `/workspace/plexuw-fu7i` tree — deleted; `/proc/*/cwd` holders (gnome-keyring) had **empty** directory listings; no open fds on source files
- Box Trash / timeshift / snapper / btrfs/LVM snapshots / `.snapshots` / `lost+found` — **none** present; FS is **ext4 on `/dev/vdb`**
- Docker volumes with tip source — none found
- BigBoy tip/fu7i/Rust source folders — none (only unrelated `Cargo.toml` under old eliza/TechTool trees)
- Other machines this sweep: **TTG, Asus-LTOP, omarchy, iPhone — offline**; only BigBoy connected
- Exact tip SHAs cannot be resurrected from AppImage/Win PE alone (compiled Tauri; no extractable `.rs` / tip `app.js` as plain files from PE/NSIS)

---

## This-pass actions taken (copy-only)

1. Confirmed tip was Linux-box path; BigBoy VSS/File History not usable without admin; no shadows via WMI.
2. Installed lightweight `extundelete` (~55 KB pkg); **listed refusal on mounted FS**; did **not** restore.
3. Copied surviving dist + `887b9e2` artifact dist + HANDOFFs under `recovered/`.
4. Copied Recycle fu7m/fu7l/plexuw.exe → BigBoy Downloads rescue → box `extracted/recycle/`; NSIS extract = nested exe only.
5. Probed AppImage (SquashFS): `usr/bin/plexuw` + libs — no separate `app.js` path; tip cmd names in binary.
6. Machines: BigBoy connected; others offline.

---

## Recommendation

### **B — Rebuild tip from fu7h + HANDOFF notes** (default)

- Base: `/tmp/clone7h` @ `22de557` (fu7h) + `recovered/handoffs/HANDOFF-fu9{k,l,m}.md` + `/workspace/perf-fu9k|l|m/` notes.
- New SHAs; cannot claim `07e369e`. Use artifact AppImages for smoke/UI reference; `887b9e2-dist` for mid-tip frontend delta vs fu7h.
- Immediately after next READY: `git bundle create` + copy **off-box** before any cleanup.

### **A — Off-box tip clone/bundle** (only if Scott has one)

- If any laptop/USB/agent ever saved a tip bundle/clone, provide it — only way to restore exact tip SHAs.

### Undelete?

**Not worth blocking rebuild.** Worth a **single offline attempt** only if Scott can take the box down tonight and attach external storage; odds drop every minute of writes. Prefer **B** in parallel; treat undelete as optional hail-mary, not the plan.

---

## Scott decision (one line)

**Pick A (hand over off-box tip) or B (GO rebuild from fu7h + HANDOFFs).** Optional: **GO offline undelete** to external disk (does not replace B).
