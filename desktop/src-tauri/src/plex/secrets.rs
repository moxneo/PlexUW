//! OS keychain via `keyring` (PLAN §6). Tokens are `SecretString`s (no Debug/Display).
//! Entry names: `PlexUW/<clientId>/account`, `PlexUW/<clientId>/server/<machineId>`.
//! An index entry (`PlexUW/index`) lists every key ever written, across client ids,
//! so sign-out / wipe can remove all `PlexUW/*` entries (§6a M7) without platform
//! enumeration APIs.
use secrecy::{ExposeSecret, SecretString};
use std::collections::BTreeSet;
use zeroize::Zeroizing;

#[derive(Debug, Clone, PartialEq)]
pub enum StoreError {
    /// No usable keychain (e.g. Linux without a Secret Service). UI shows dedicated copy.
    Unavailable,
    Other(String),
}

pub trait SecretStore: Send + Sync {
    fn get(&self, key: &str) -> Result<Option<SecretString>, StoreError>;
    fn set_raw(&self, key: &str, v: &SecretString) -> Result<(), StoreError>;
    fn delete_raw(&self, key: &str) -> Result<(), StoreError>;
    /// fu7d-fl1 (Sentinel H1/M2): one lock + sign-out epoch per store instance.
    fn sync(&self) -> &StoreSync;
    /// Drop any in-memory copies (token cache). Default: nothing cached.
    fn forget_all(&self) {}
}

/// Serialises every index read-modify-write, put and wipe on one store, and carries the
/// sign-out epoch. Wipes bump the epoch BEFORE taking the lock; a write checks the epoch
/// it was started with UNDER the lock, so a write that timed out and is still running in
/// the background is discarded instead of landing after sign-out.
#[derive(Default)]
pub struct StoreSync { lock: std::sync::Mutex<()>, epoch: std::sync::atomic::AtomicU64 }
impl StoreSync {
    pub fn epoch(&self) -> u64 { self.epoch.load(std::sync::atomic::Ordering::SeqCst) }
    fn bump(&self) { self.epoch.fetch_add(1, std::sync::atomic::Ordering::SeqCst); }
    /// SHOULD-8: never wait forever behind a hung keychain call; give up with E_BUSY.
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, ()>, StoreError> {
        let end = std::time::Instant::now() + LOCK_TIMEOUT;
        loop {
            match self.lock.try_lock() {
                Ok(g) => return Ok(g),
                Err(std::sync::TryLockError::Poisoned(e)) => return Ok(e.into_inner()),
                Err(std::sync::TryLockError::WouldBlock) if std::time::Instant::now() < end =>
                    std::thread::sleep(std::time::Duration::from_millis(5)),
                Err(_) => return Err(StoreError::Other(E_BUSY.into())),
            }
        }
    }
}
#[cfg(not(test))]
pub const LOCK_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
#[cfg(test)]
pub const LOCK_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(200);
/// SHOULD-7: fixed texts, each mapped to its own UI category (api::ApiError::category).
pub const E_TOOLONG: &str = "keychain value too long";
pub const E_TIMEOUT: &str = "keychain timeout";
pub const E_BUSY: &str = "keychain busy";
pub const E_MISSING: &str = "keychain chunk missing";

/// SHOULD-7: fixed UI category per store failure (never the raw text).
pub fn category(e: &StoreError) -> &'static str {
    match e {
        StoreError::Unavailable => "keychain-unavailable",
        StoreError::Other(s) => match s.as_str() {
            E_TOOLONG => "keychain-toolong",
            E_TIMEOUT | E_BUSY => "keychain-timeout",
            E_STALE => "keychain-stale",
            E_MISSING | E_CORRUPT => "keychain-missing",
            E_PARTIAL_WIPE => "signout-incomplete",
            _ => "keychain",
        },
    }
}
pub const E_STALE: &str = "keychain write discarded after sign-out";
pub const E_CORRUPT: &str = "keychain header invalid";
pub const E_PARTIAL_WIPE: &str = "keychain wipe incomplete";

pub const INDEX: &str = "PlexUW/index";

pub fn account_key(cid: &str) -> String { format!("PlexUW/{cid}/account") }
pub fn server_key(cid: &str, mid: &str) -> String { format!("PlexUW/{cid}/server/{mid}") }

fn index(s: &dyn SecretStore) -> Result<BTreeSet<String>, StoreError> {
    Ok(s.get(INDEX)?
        .map(|v| v.expose_secret().lines().map(str::to_string).filter(|l| l.starts_with("PlexUW/")).collect())
        .unwrap_or_default())
}

/// Write + read back + compare (same discipline as the M7 migration).
pub fn put(s: &dyn SecretStore, key: &str, v: &SecretString) -> Result<(), StoreError> {
    put_at(s, key, v, s.sync().epoch())
}

/// `put` that is discarded if a wipe happened after `epoch` was read (H1).
pub fn put_at(s: &dyn SecretStore, key: &str, v: &SecretString, epoch: u64) -> Result<(), StoreError> {
    let _g = s.sync().lock()?;
    if s.sync().epoch() != epoch { return Err(StoreError::Other(E_STALE.into())); }
    put_locked(s, key, v)
}

fn put_locked(s: &dyn SecretStore, key: &str, v: &SecretString) -> Result<(), StoreError> {
    // fu7d-fl2 (L2/H3): a corrupt index header is rebuilt on write (the write path sweeps
    // its stray parts); any other read error still fails the write.
    let mut idx = match index(s) { Err(StoreError::Other(e)) if e == E_CORRUPT => BTreeSet::new(), r => r? };
    if idx.insert(key.to_string()) {
        let joined: Vec<_> = idx.iter().cloned().collect();
        s.set_raw(INDEX, &SecretString::from(joined.join("\n")))?;
    }
    s.set_raw(key, v)?;
    match s.get(key)? {
        Some(r) if r.expose_secret() == v.expose_secret() => Ok(()),
        _ => Err(StoreError::Other("keychain read-back mismatch".into())),
    }
}

/// Remove every indexed `PlexUW/*` entry (all client ids) and the index itself.
/// `known` = keys to delete even if the index can't be read (see `wipe_plex_known`).
pub fn wipe_all(s: &dyn SecretStore) -> Result<usize, StoreError> { wipe(s, &[], true) }

/// fu7d-fl2 (H3): delete everything, keep going on errors, report any failure.
/// If the index is unreadable (corrupt, unknown format) fall back to `known` (the current
/// account key, current server keys, AI keys) and still delete the index itself.
fn wipe(s: &dyn SecretStore, known: &[String], include_ai: bool) -> Result<usize, StoreError> {
    s.sync().bump();
    let _g = s.sync().lock()?;
    s.forget_all();
    let (idx, mut failed) = match index(s) { Ok(i) => (i, false), Err(_) => (BTreeSet::new(), true) };
    let mut all: BTreeSet<String> = idx.into_iter().chain(known.iter().cloned()).collect();
    let ai: Vec<String> = all.iter().filter(|k| is_ai_key(k)).cloned().collect();
    if !include_ai { for k in &ai { all.remove(k); } }
    let mut n = 0;
    // LOW-9: a key whose delete failed stays in the index so a later wipe retries it.
    let mut keep: Vec<String> = if include_ai { vec![] } else { ai };
    for k in all.iter() { if s.delete_raw(k).is_ok() { n += 1; } else { failed = true; keep.push(k.clone()); } }
    let r = if keep.is_empty() { s.delete_raw(INDEX) } else { s.set_raw(INDEX, &SecretString::from(keep.join("\n"))) };
    if r.is_err() { failed = true; }
    s.forget_all(); // nothing read during the wipe stays cached
    if failed { Err(StoreError::Other(E_PARTIAL_WIPE.into())) } else { Ok(n) }
}

/// AI provider key (mock AI in v1; keychain only, never localStorage; §6a M7).
/// Name per §6a M7: `PlexUW/<clientId>/ai/<provider>`.
pub fn ai_key(cid: &str, provider: &str) -> String { format!("PlexUW/{cid}/ai/{provider}") }
/// M1 name, kept only to migrate from.
pub fn legacy_ai_key(provider: &str) -> String { format!("PlexUW/ai/{provider}") }
pub const AI_PROVIDERS: &[&str] = &["xai", "openai", "openrouter", "self"];

/// `PlexUW/<cid>/ai/<p>` (any client id) or the legacy `PlexUW/ai/<p>`.
pub fn is_ai_key(k: &str) -> bool {
    let parts: Vec<&str> = k.split('/').collect();
    matches!(parts.as_slice(), ["PlexUW", "ai", _] | ["PlexUW", _, "ai", _])
}

/// L2 migration (§6a M7 order): write new → read back → compare → remove old.
/// On any failure the old entry is left in place. Returns how many moved.
pub fn migrate_ai_keys(s: &dyn SecretStore, cid: &str) -> Result<usize, StoreError> {
    let _g = s.sync().lock()?;
    let mut n = 0;
    for p in AI_PROVIDERS {
        let old = legacy_ai_key(p);
        let Some(v) = s.get(&old)? else { continue };
        // LOW-3: anything over the 512-byte key limit is not a valid key; drop it.
        if v.expose_secret().len() > 512 { remove_locked(s, &old)?; continue; }
        let new = ai_key(cid, p);
        if s.get(&new)?.is_none() { put_locked(s, &new, &v)?; } // put = write + read-back + compare
        match s.get(&new)? {
            Some(r) if r.expose_secret() == v.expose_secret() => { remove_locked(s, &old)?; n += 1; }
            _ => {} // a different key was already saved under the new name: keep the new one, keep old for safety
        }
    }
    Ok(n)
}

#[cfg(test)]
#[test]
fn migrate_drops_oversized_legacy_key() {
    let s = MemStore::default();
    put(&s, &legacy_ai_key("xai"), &SecretString::from("x".repeat(600))).unwrap();
    assert_eq!(migrate_ai_keys(&s, "cid").unwrap(), 0);
    assert!(s.get(&legacy_ai_key("xai")).unwrap().is_none());
    assert!(s.get(&ai_key("cid", "xai")).unwrap().is_none());
}

/// Plex sign-out: remove every indexed entry except AI keys; keep the index consistent.
pub fn wipe_plex(s: &dyn SecretStore) -> Result<usize, StoreError> { wipe(s, &[], false) }
/// Same, with fallback keys used when the index is unreadable or incomplete.
pub fn wipe_plex_known(s: &dyn SecretStore, known: &[String]) -> Result<usize, StoreError> { wipe(s, known, false) }

/// Remove one indexed entry.
pub fn remove(s: &dyn SecretStore, key: &str) -> Result<(), StoreError> {
    let _g = s.sync().lock()?;
    remove_locked(s, key)
}
fn remove_locked(s: &dyn SecretStore, key: &str) -> Result<(), StoreError> {
    let mut idx = index(s)?;
    let _ = s.delete_raw(key);
    if idx.remove(key) {
        let joined: Vec<_> = idx.iter().cloned().collect();
        if joined.is_empty() { let _ = s.delete_raw(INDEX); } else { s.set_raw(INDEX, &SecretString::from(joined.join("\n")))?; }
    }
    Ok(())
}

/// Raw OS keychain backend (one credential per key, no size handling).
#[derive(Default)]
pub struct RawKeyring { sync: StoreSync }

impl RawKeyring {
    fn entry(key: &str) -> Result<keyring::Entry, StoreError> {
        // Windows: generic credential target = the key itself, e.g. "PlexUW/<cid>/account".
        #[cfg(windows)]
        { keyring::Entry::new_with_target(key, "PlexUW", key).map_err(map_err) }
        // Linux Secret Service (fu7, da Vinci B2 SHOULD): a non-"default" target makes keyring
        // create a NEW collection per item (one gcr unlock prompt per secret). With no target
        // the item goes into the user's default collection (normally "login", already
        // unlocked at session login), so there is at most one prompt. service="PlexUW",
        // user=<key> keeps each item distinct. No default collection / no Secret Service
        // maps to `Unavailable` and the UI shows the install hint; there is NO plaintext fallback.
        #[cfg(not(windows))]
        { keyring::Entry::new("PlexUW", key).map_err(map_err) }
    }
}

fn map_err(e: keyring::Error) -> StoreError {
    match e {
        keyring::Error::NoStorageAccess(_) | keyring::Error::PlatformFailure(_) => StoreError::Unavailable,
        // fu7d: keep the variant name only; never echo attribute values.
        keyring::Error::TooLong(..) => StoreError::Other(E_TOOLONG.into()),
        other => StoreError::Other(super::redact::redact(&other.to_string())),
    }
}

impl SecretStore for RawKeyring {
    fn get(&self, key: &str) -> Result<Option<SecretString>, StoreError> {
        match Self::entry(key)?.get_password() {
            Ok(p) => Ok(Some(SecretString::from(p))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(map_err(e)),
        }
    }
    fn set_raw(&self, key: &str, v: &SecretString) -> Result<(), StoreError> {
        Self::entry(key)?.set_password(v.expose_secret()).map_err(map_err)
    }
    fn delete_raw(&self, key: &str) -> Result<(), StoreError> {
        match Self::entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(map_err(e)),
        }
    }
    fn sync(&self) -> &StoreSync { &self.sync }
}

/// fu7d: Windows Credential Manager caps a generic credential blob at
/// CRED_MAX_CREDENTIAL_BLOB_SIZE = 2560 bytes, and keyring stores the password as
/// UTF-16, so only 1280 UTF-16 units fit. `PlexUW/index` grows by ~92 units per server
/// and per client id, so a real account outgrew it and every save failed with
/// `TooLong` -> category "keychain" -> "The system keychain didn't respond."
/// Values over `CHUNK_UNITS` are split: the main entry holds a header
/// `CHUNK_MAGIC<n>`, parts live at `<key>#<i>` (i = 1..=n). Nothing is dropped or
/// written anywhere but the keychain.
pub const CHUNK_UNITS: usize = 1000; // < 1280 with headroom
pub const MAX_CHUNKS: usize = 64;
/// fu7d-fl1 (M1/M2): two part slots, `a` and `b`. A write fills the slot the header does
/// NOT point at, then flips the header (`CHUNK_MAGIC<slot>:<n>`) in one write, then
/// deletes the old slot. Readers only ever see a complete old set or a complete new set.
/// Slots are a fixed, known set, so wipe can probe every possible part name
/// (`#a#1..64`, `#b#1..64`, and fu7d's v1 `#1..64`) and remove orphans.
const CHUNK_MAGIC: &str = "\u{1}plexuw-chunks:v2:";
const SLOTS: [char; 2] = ['a', 'b'];

pub fn part_key(key: &str, slot: char, i: usize) -> String { format!("{key}#{slot}#{i}") }
fn v1_part_key(key: &str, i: usize) -> String { format!("{key}#{i}") }

fn split_utf16(v: &str, units: usize) -> Vec<Zeroizing<String>> {
    // INFO (fl2): buffers are Zeroizing and preallocated (no realloc copies left behind).
    let mut out = vec![]; let mut cur = Zeroizing::new(String::with_capacity(units * 4)); let mut n = 0;
    for c in v.chars() {
        let w = c.len_utf16();
        if n + w > units { out.push(std::mem::replace(&mut cur, Zeroizing::new(String::with_capacity(units * 4)))); n = 0; }
        cur.push(c); n += w;
    }
    if !cur.is_empty() || out.is_empty() { out.push(cur); }
    out
}

/// fu7d (v1) header: `\u{1}plexuw-chunks:v1:<n>`, parts `<key>#<i>`. Read-only; the next
/// write migrates to v2 and deletes the v1 parts. Represented as pseudo-slot `V1`.
const CHUNK_MAGIC_V1: &str = "\u{1}plexuw-chunks:v1:";
const V1: char = 'v';
fn slot_part(key: &str, slot: char, i: usize) -> String { if slot == V1 { v1_part_key(key, i) } else { part_key(key, slot, i) } }

/// Header -> (slot, parts). Anything else is a plain value.
fn parse_header(head: &str) -> Option<(char, usize)> {
    if let Some(n) = head.strip_prefix(CHUNK_MAGIC_V1) {
        return n.parse::<usize>().ok().filter(|n| (1..=MAX_CHUNKS).contains(n)).map(|n| (V1, n));
    }
    let rest = head.strip_prefix(CHUNK_MAGIC)?;
    let (slot, n) = rest.split_once(':')?;
    let slot = slot.parse::<char>().ok().filter(|c| SLOTS.contains(c))?;
    let n = n.parse::<usize>().ok().filter(|n| (1..=MAX_CHUNKS).contains(n))?;
    Some((slot, n))
}

/// Header state of a key: plain/absent, chunked (slot, parts), or unreadable.
enum Head { Plain, Chunked(char, usize), Corrupt, Unknown }

pub struct Chunked<S: SecretStore> {
    pub inner: S,
    sync: StoreSync,
    /// fu7d-fl1: in-memory token cache so Egress::send doesn't hit the keychain
    /// (up to 65 calls) per request. Memory only, never logged (SecretString has no
    /// Debug/Display). Updated on write, removed on delete, cleared on every wipe.
    cache: std::sync::Mutex<Cache>,
}

/// fu7d-fl2 (H2): `gen` is bumped (under the cache mutex) by every write, delete and wipe.
/// A read records `gen` before touching the keychain and may only fill the cache if it is
/// unchanged, so a read racing a wipe or a write can't leave a stale token in memory.
#[derive(Default)]
struct Cache { map: std::collections::HashMap<String, SecretString>, gen: u64 }

impl<S: SecretStore> Chunked<S> {
    pub fn new(inner: S) -> Self { Chunked { inner, sync: StoreSync::default(), cache: Default::default() } }
    fn head(&self, key: &str) -> Head {
        match self.inner.get(key) {
            Ok(None) => Head::Plain,
            Ok(Some(h)) => match parse_header(h.expose_secret()) {
                Some((c, n)) => Head::Chunked(c, n),
                None if h.expose_secret().starts_with('\u{1}') => Head::Corrupt, // L2
                None => Head::Plain,
            },
            Err(_) => Head::Unknown,
        }
    }
    fn clear_slot(&self, key: &str, slot: char, upto: usize) {
        for i in 1..=upto { let _ = self.inner.delete_raw(&slot_part(key, slot, i)); }
    }
    /// L1 + orphan sweep: every name a part could have.
    fn probe_all_parts(&self, key: &str) {
        for slot in SLOTS { self.clear_slot(key, slot, MAX_CHUNKS); }
        for i in 1..=MAX_CHUNKS { let _ = self.inner.delete_raw(&v1_part_key(key, i)); }
    }
    fn cache(&self) -> std::sync::MutexGuard<'_, Cache> { self.cache.lock().unwrap_or_else(|e| e.into_inner()) }
    fn uncache(&self, key: &str) { let mut c = self.cache(); c.gen += 1; c.map.remove(key); }
    #[cfg(test)]
    fn cache_gen(&self) -> u64 { self.cache().gen }
    fn fill(&self, key: &str, v: &SecretString, gen: u64) {
        let mut c = self.cache();
        if c.gen == gen { c.map.insert(key.to_string(), v.clone()); }
    }
    fn get_uncached(&self, key: &str) -> Result<Option<SecretString>, StoreError> {
        let Some(head) = self.inner.get(key)? else { return Ok(None) };
        let Some((slot, n)) = parse_header(head.expose_secret()) else {
            if head.expose_secret().starts_with('\u{1}') { return Err(StoreError::Other(E_CORRUPT.into())); }
            return Ok(Some(head));
        };
        let mut v = Zeroizing::new(String::with_capacity(n * CHUNK_UNITS * 4));
        for i in 1..=n {
            match self.inner.get(&slot_part(key, slot, i))? {
                Some(p) => v.push_str(p.expose_secret()),
                None => return Err(StoreError::Other(E_MISSING.into())),
            }
        }
        Ok(Some(SecretString::from(v.as_str().to_owned())))
    }
    fn set_uncached(&self, key: &str, v: &SecretString) -> Result<(), StoreError> {
        let s = v.expose_secret();
        if s.starts_with('\u{1}') { return Err(StoreError::Other("invalid keychain value".into())); }
        let old = self.head(key);
        if s.encode_utf16().count() <= CHUNK_UNITS {
            self.inner.set_raw(key, v)?; // single write replaces the header atomically
        } else {
            let parts = split_utf16(s, CHUNK_UNITS);
            if parts.len() > MAX_CHUNKS { return Err(StoreError::Other(E_TOOLONG.into())); }
            let slot = match old { Head::Chunked('a', _) => 'b', Head::Chunked(..) | Head::Plain | Head::Corrupt => 'a',
                                   Head::Unknown => return Err(StoreError::Other("keychain header unreadable".into())) };
            // SHOULD-8: the target slot is unreferenced (the previous flip cleared it), so
            // parts are written in place; only a Corrupt header gets the bounded probe.
            if matches!(old, Head::Corrupt) { self.probe_all_parts(key); }
            for (i, p) in parts.iter().enumerate() {
                if let Err(e) = self.inner.set_raw(&part_key(key, slot, i + 1), &SecretString::from(p.as_str().to_owned())) {
                    self.clear_slot(key, slot, i + 1); // M2 rollback: no orphan fragments
                    return Err(e);
                }
            }
            // Pointer flip: only now does the header reference the new slot.
            if let Err(e) = self.inner.set_raw(key, &SecretString::from(format!("{CHUNK_MAGIC}{slot}:{}", parts.len()))) {
                self.clear_slot(key, slot, parts.len());
                return Err(e);
            }
            match old {
                Head::Chunked(os, on) if os != slot => self.clear_slot(key, os, on), // incl. v1 -> v2 migration
                _ => {}
            }
            return Ok(());
        }
        match old {
            Head::Chunked(os, on) => self.clear_slot(key, os, on),
            Head::Unknown | Head::Corrupt => self.probe_all_parts(key),
            Head::Plain => {}
        }
        Ok(())
    }
}

impl<S: SecretStore> SecretStore for Chunked<S> {
    fn get(&self, key: &str) -> Result<Option<SecretString>, StoreError> {
        let gen = { let c = self.cache(); if let Some(v) = c.map.get(key) { return Ok(Some(v.clone())); } c.gen };
        let r = self.get_uncached(key)?;
        if let Some(v) = &r { self.fill(key, v, gen); }
        Ok(r)
    }
    fn set_raw(&self, key: &str, v: &SecretString) -> Result<(), StoreError> {
        self.uncache(key);
        let r = self.set_uncached(key, v);
        self.uncache(key); // a read that started mid-write must not cache the old value
        r
        // Not cached on write: `put` reads back through `get`, which fills the cache from
        // the keychain, so the cache only ever holds what the keychain really returned.
    }
    fn delete_raw(&self, key: &str) -> Result<(), StoreError> {
        self.uncache(key);
        let old = self.head(key);
        let r = self.inner.delete_raw(key);
        self.uncache(key);
        r?;
        match old {
            // SHOULD-8: delete only the parts the header names (n <= 64).
            Head::Chunked(os, on) => self.clear_slot(key, os, on),
            Head::Plain => {}
            // L1/H3: header unreadable -> bounded probe of every part name (3 x 64).
            Head::Unknown | Head::Corrupt => self.probe_all_parts(key),
        }
        Ok(())
    }
    fn sync(&self) -> &StoreSync { &self.sync }
    fn forget_all(&self) { let mut c = self.cache(); c.gen += 1; c.map.clear(); }
}

/// The production store: OS keychain with Credential-Manager-safe chunking.
pub type KeyringStore = Chunked<RawKeyring>;
pub fn keyring_store() -> KeyringStore { Chunked::new(RawKeyring::default()) }

/// In-memory store for tests and the `mockplex` screenshot build.
#[derive(Default)]
pub struct MemStore {
    pub map: std::sync::Mutex<std::collections::HashMap<String, String>>,
    pub unavailable: bool,
    /// Simulate Credential Manager: reject values over this many UTF-16 units.
    pub max_units: Option<usize>,
    /// Test hook: the Nth set_raw (1-based) and later ones fail.
    pub fail_set_from: Option<usize>,
    pub sets: std::sync::atomic::AtomicUsize,
    /// SHOULD-8: delete calls seen; LOW-9: deletes of this exact key fail.
    pub dels: std::sync::atomic::AtomicUsize,
    pub fail_del: Option<String>,
    pub sync: StoreSync,
}

impl SecretStore for MemStore {
    fn get(&self, key: &str) -> Result<Option<SecretString>, StoreError> {
        if self.unavailable { return Err(StoreError::Unavailable); }
        Ok(self.map.lock().unwrap().get(key).cloned().map(SecretString::from))
    }
    fn set_raw(&self, key: &str, v: &SecretString) -> Result<(), StoreError> {
        if self.unavailable { return Err(StoreError::Unavailable); }
        let n = self.sets.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
        if self.fail_set_from.is_some_and(|f| n >= f) { return Err(StoreError::Other("injected".into())); }
        if self.max_units.is_some_and(|m| v.expose_secret().encode_utf16().count() > m) {
            return Err(StoreError::Other(E_TOOLONG.into()));
        }
        self.map.lock().unwrap().insert(key.into(), v.expose_secret().to_string());
        Ok(())
    }
    fn delete_raw(&self, key: &str) -> Result<(), StoreError> {
        self.dels.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        if self.fail_del.as_deref() == Some(key) { return Err(StoreError::Other("injected".into())); }
        self.map.lock().unwrap().remove(key);
        Ok(())
    }
    fn sync(&self) -> &StoreSync { &self.sync }
}

#[cfg(test)]
mod t {
    use super::*;
    #[test]
    fn index_and_wipe_across_client_ids() {
        let s = MemStore::default();
        put(&s, &account_key("old"), &SecretString::from("a".to_string())).unwrap();
        put(&s, &account_key("new"), &SecretString::from("b".to_string())).unwrap();
        put(&s, &server_key("new", "m1"), &SecretString::from("c".to_string())).unwrap();
        assert_eq!(wipe_all(&s).unwrap(), 3);
        assert!(s.map.lock().unwrap().is_empty());
    }
    #[test]
    fn unavailable_is_reported() {
        let s = MemStore { unavailable: true, ..Default::default() };
        assert_eq!(put(&s, "PlexUW/x/account", &SecretString::from("t".to_string())), Err(StoreError::Unavailable));
    }

    #[test]
    fn plex_signout_keeps_ai_key() {
        let s = MemStore::default();
        put(&s, &account_key("c"), &SecretString::from("a".to_string())).unwrap();
        put(&s, &ai_key("c", "xai"), &SecretString::from("k".to_string())).unwrap();
        assert_eq!(wipe_plex(&s).unwrap(), 1);
        assert!(s.get(&account_key("c")).unwrap().is_none());
        assert!(s.get(&ai_key("c", "xai")).unwrap().is_some());
        remove(&s, &ai_key("c", "xai")).unwrap();
        assert!(s.get(&ai_key("c", "xai")).unwrap().is_none());
    }

    #[test]
    fn l2_ai_key_migration() {
        let s = MemStore::default();
        put(&s, &legacy_ai_key("xai"), &SecretString::from("k1".to_string())).unwrap();
        put(&s, &legacy_ai_key("openai"), &SecretString::from("k2".to_string())).unwrap();
        put(&s, &account_key("c"), &SecretString::from("a".to_string())).unwrap();
        assert_eq!(migrate_ai_keys(&s, "c").unwrap(), 2);
        assert!(s.get(&legacy_ai_key("xai")).unwrap().is_none());
        assert_eq!(s.get(&ai_key("c", "xai")).unwrap().unwrap().expose_secret(), "k1");
        assert_eq!(s.get(&ai_key("c", "openai")).unwrap().unwrap().expose_secret(), "k2");
        assert_eq!(migrate_ai_keys(&s, "c").unwrap(), 0); // idempotent
        assert!(is_ai_key("PlexUW/c/ai/xai") && is_ai_key("PlexUW/ai/xai") && !is_ai_key("PlexUW/c/account") && !is_ai_key("PlexUW/c/server/ai"));
        // sign-out keeps AI keys; full wipe removes them
        wipe_plex(&s).unwrap();
        assert!(s.get(&ai_key("c", "xai")).unwrap().is_some());
        assert_eq!(wipe_all(&s).unwrap(), 2);
        assert!(s.map.lock().unwrap().is_empty());
    }

    #[test]
    fn l2_migration_keeps_old_on_failed_write() {
        let s = MemStore::default();
        put(&s, &legacy_ai_key("xai"), &SecretString::from("k1".to_string())).unwrap();
        let broken = MemStore { unavailable: true, ..Default::default() };
        assert!(migrate_ai_keys(&broken, "c").is_err());
        assert!(s.get(&legacy_ai_key("xai")).unwrap().is_some());
    }

    /// fu7d regression: an account with many servers (plus older client ids) makes
    /// PlexUW/index exceed Credential Manager's 2560-byte (1280 UTF-16 unit) blob.
    #[test]
    fn fu7d_index_over_credential_manager_limit() {
        let wincm = || MemStore { max_units: Some(1280), ..Default::default() };
        let mid = |i: usize| format!("{:040x}", i);
        let cid = "0f0e0d0c-0b0a-4908-8706-050403020100";
        // Unchunked store reproduces the bug.
        let raw = wincm();
        let r = (0..20).try_for_each(|i| put(&raw, &server_key(cid, &mid(i)), &SecretString::from("fixture-token".to_string())));
        assert_eq!(r, Err(StoreError::Other(E_TOOLONG.into())));
        // Chunked store saves, reads back, and wipes everything including parts.
        let s = Chunked::new(wincm());
        put(&s, &account_key(cid), &SecretString::from("fixture-account".to_string())).unwrap();
        for i in 0..60 { put(&s, &server_key(cid, &mid(i)), &SecretString::from("fixture-token".to_string())).unwrap(); }
        let idx = s.get(INDEX).unwrap().unwrap();
        assert!(idx.expose_secret().encode_utf16().count() > 1280);
        assert_eq!(idx.expose_secret().lines().count(), 61);
        assert!(s.inner.map.lock().unwrap().values().all(|v| v.encode_utf16().count() <= 1280));
        // A long value (e.g. a future JWT) round-trips too, with non-BMP chars at the seams.
        let long: String = "a\u{1F600}".repeat(900);
        put(&s, &account_key(cid), &SecretString::from(long.clone())).unwrap();
        assert_eq!(s.get(&account_key(cid)).unwrap().unwrap().expose_secret(), &long);
        // Shrinking removes stale parts.
        put(&s, &account_key(cid), &SecretString::from("short".to_string())).unwrap();
        assert!(s.inner.map.lock().unwrap().get(&part_key(&account_key(cid), 'a', 1)).is_none());
        assert_eq!(wipe_all(&s).unwrap(), 61);
        assert!(s.inner.map.lock().unwrap().is_empty());
    }

    fn big(c: char) -> SecretString { SecretString::from(c.to_string().repeat(2500)) } // 3 parts
    fn parts(s: &Chunked<MemStore>) -> Vec<String> { s.inner.map.lock().unwrap().keys().filter(|k| k.contains('#')).cloned().collect() }

    /// H1: a write started before sign-out (e.g. timed out, still running) is discarded.
    #[test]
    fn fl1_h1_stale_write_cannot_land_after_signout() {
        let s = Chunked::new(MemStore::default());
        let ep = s.sync().epoch(); // captured when the background write was spawned
        wipe_plex(&s).unwrap();    // user signs out meanwhile
        assert_eq!(put_at(&s, &account_key("c"), &SecretString::from("t".to_string()), ep), Err(StoreError::Other(E_STALE.into())));
        assert!(s.inner.map.lock().unwrap().is_empty());
        // Threaded: the write holds the lock while wipe waits; wipe runs after and removes it.
        let s = std::sync::Arc::new(Chunked::new(MemStore::default()));
        let hs: Vec<_> = (0..8).map(|i| { let s = s.clone(); std::thread::spawn(move || {
            let _ = put(&*s, &server_key("c", &format!("m{i}")), &big('x')); }) }).collect();
        let w = { let s = s.clone(); std::thread::spawn(move || wipe_plex(&*s).unwrap()) };
        for h in hs { h.join().unwrap(); } w.join().unwrap();
        wipe_plex(&*s).unwrap();
        assert!(s.inner.map.lock().unwrap().is_empty());
    }

    /// M1: replacing a chunked value never mixes generations; failure keeps the old value.
    #[test]
    fn fl1_m1_replace_chunked_is_atomic() {
        let s = Chunked::new(MemStore::default());
        put(&s, &account_key("c"), &big('A')).unwrap();
        let before = s.inner.sets.load(std::sync::atomic::Ordering::SeqCst);
        // Fail on the 2nd new part: old header must still point at a complete old set.
        let s2 = Chunked::new(MemStore { fail_set_from: Some(before + 2), ..Default::default() });
        *s2.inner.map.lock().unwrap() = s.inner.map.lock().unwrap().clone();
        s2.inner.sets.store(before, std::sync::atomic::Ordering::SeqCst);
        assert!(s2.set_raw(&account_key("c"), &big('B')).is_err());
        assert_eq!(s2.get(&account_key("c")).unwrap().unwrap().expose_secret(), &"A".repeat(2500));
        assert!(parts(&s2).iter().all(|k| k.contains("#a#")), "new-slot parts rolled back");
        // Successful replace flips to slot b and removes slot a; shrinking to 1 part too.
        put(&s, &account_key("c"), &big('B')).unwrap();
        assert!(parts(&s).iter().all(|k| k.contains("#b#")) && parts(&s).len() == 3);
        put(&s, &account_key("c"), &SecretString::from("B".repeat(1500))).unwrap();
        assert!(parts(&s).iter().all(|k| k.contains("#a#")) && parts(&s).len() == 2);
        assert_eq!(s.get(&account_key("c")).unwrap().unwrap().expose_secret(), &"B".repeat(1500));
    }

    /// M2: failed first-time chunked write leaves no parts; concurrent index updates are kept;
    /// wipe sweeps orphans in every slot and the v1 names.
    #[test]
    fn fl1_m2_rollback_index_lock_and_orphan_sweep() {
        let s = Chunked::new(MemStore { fail_set_from: Some(4), ..Default::default() }); // index, p1, p2 ok; p3 fails
        assert!(put(&s, &account_key("c"), &big('Z')).is_err());
        assert!(parts(&s).is_empty());
        let s = std::sync::Arc::new(Chunked::new(MemStore::default()));
        let hs: Vec<_> = (0..16).map(|i| { let s = s.clone(); std::thread::spawn(move ||
            put(&*s, &server_key("c", &format!("m{i}")), &SecretString::from("t".to_string())).unwrap()) }).collect();
        for h in hs { h.join().unwrap(); }
        assert_eq!(index(&*s).unwrap().len(), 16);
        let k = account_key("c");
        for o in [part_key(&k, 'a', 7), part_key(&k, 'b', 64), v1_part_key(&k, 3)] { s.inner.map.lock().unwrap().insert(o, "frag".into()); }
        // SHOULD-8: orphans are probed only under an unreadable (corrupt) header.
        s.inner.map.lock().unwrap().insert(k.clone(), "\u{1}plexuw-chunks:bogus".into());
        let mut ix = index(&*s).unwrap(); ix.insert(k.clone());
        s.inner.set_raw(INDEX, &SecretString::from(ix.into_iter().collect::<Vec<_>>().join("\n"))).unwrap();
        assert_eq!(wipe_plex(&*s).unwrap(), 17);
        assert!(s.inner.map.lock().unwrap().is_empty());
    }

    /// Token cache: one keychain read for repeated gets; cleared by wipe; updated by write.
    #[test]
    fn fl1_token_cache() {
        let s = Chunked::new(MemStore::default());
        put(&s, &account_key("c"), &SecretString::from("t1".to_string())).unwrap();
        s.inner.map.lock().unwrap().clear(); // keychain changed behind our back
        assert_eq!(s.get(&account_key("c")).unwrap().unwrap().expose_secret(), "t1"); // served from memory
        put(&s, &account_key("c"), &SecretString::from("t2".to_string())).unwrap();
        assert_eq!(s.get(&account_key("c")).unwrap().unwrap().expose_secret(), "t2");
        wipe_plex(&s).unwrap();
        assert!(s.get(&account_key("c")).unwrap().is_none());
    }

    /// fu7d-fl2 (Master priority): fu7c wrote plain, unchunked values. A failed link on
    /// Windows can leave a partial plain index (account indexed and stored; some servers
    /// stored and indexed; the overflowing server never written). Read it, migrate on the
    /// next write, and wipe it completely.
    #[test]
    fn fl2_fu7c_plain_partial_index_reads_migrates_and_wipes() {
        let s = Chunked::new(MemStore::default());
        let cid = "0f0e0d0c-0b0a-4908-8706-050403020100";
        let mid = |i: usize| format!("{:040x}", i);
        let mut idx = vec![account_key(cid)];
        { let mut m = s.inner.map.lock().unwrap();
          m.insert(account_key(cid), "fixture-account".into());
          for i in 0..12 { idx.push(server_key(cid, &mid(i))); m.insert(server_key(cid, &mid(i)), "fixture-token".into()); }
          m.insert(INDEX.into(), idx.join("\n")); }
        assert_eq!(s.get(&account_key(cid)).unwrap().unwrap().expose_secret(), "fixture-account");
        assert_eq!(index(&s).unwrap().len(), 13);
        for i in 12..40 { put(&s, &server_key(cid, &mid(i)), &SecretString::from("fixture-token".to_string())).unwrap(); }
        let head = s.inner.map.lock().unwrap().get(INDEX).cloned().unwrap();
        assert!(head.starts_with(CHUNK_MAGIC), "index migrated to v2 once it outgrew one entry");
        assert_eq!(index(&s).unwrap().len(), 41);
        assert_eq!(wipe_plex(&s).unwrap(), 41);
        assert!(s.inner.map.lock().unwrap().is_empty());
        // Partial: a token exists that the index never got (index write failed) -> the
        // known-keys fallback removes it.
        { let mut m = s.inner.map.lock().unwrap();
          m.insert(account_key(cid), "fixture-account".into()); m.insert(server_key(cid, &mid(99)), "fixture-token".into());
          m.insert(INDEX.into(), account_key(cid)); }
        wipe_plex_known(&s, &[account_key(cid), server_key(cid, &mid(99))]).unwrap();
        assert!(s.inner.map.lock().unwrap().is_empty());
    }

    fn seed_v1(s: &Chunked<MemStore>, key: &str, val: &str) {
        let parts = split_utf16(val, CHUNK_UNITS);
        let mut m = s.inner.map.lock().unwrap();
        for (i, p) in parts.iter().enumerate() { m.insert(v1_part_key(key, i + 1), p.as_str().to_owned()); }
        m.insert(key.into(), format!("{CHUNK_MAGIC_V1}{}", parts.len()));
    }

    /// H3: fu7d v1 chunked index reads, migrates on write (v1 parts deleted), and wipes.
    #[test]
    fn fl2_v1_index_reads_and_migrates() {
        let s = Chunked::new(MemStore::default());
        let keys: Vec<String> = (0..30).map(|i| server_key("c", &format!("{:040x}", i))).collect();
        { let mut m = s.inner.map.lock().unwrap(); for k in &keys { m.insert(k.clone(), "t".into()); } }
        seed_v1(&s, INDEX, &keys.join("\n"));
        assert_eq!(index(&s).unwrap().len(), 30);
        put(&s, &account_key("c"), &SecretString::from("a".to_string())).unwrap();
        assert!(s.inner.map.lock().unwrap().keys().all(|k| !k.starts_with("PlexUW/index#") || k.contains("#a#") || k.contains("#b#")), "v1 parts removed");
        assert_eq!(index(&s).unwrap().len(), 31);
    }

    #[test]
    fn fl2_v1_wipe() {
        let s = Chunked::new(MemStore::default());
        let keys: Vec<String> = (0..30).map(|i| server_key("c", &format!("{:040x}", i))).collect();
        { let mut m = s.inner.map.lock().unwrap(); for k in &keys { m.insert(k.clone(), "t".into()); } }
        seed_v1(&s, INDEX, &keys.join("\n"));
        seed_v1(&s, &account_key("c"), &"x".repeat(2500));
        { let mut ix = keys.clone(); ix.push(account_key("c")); seed_v1(&s, INDEX, &ix.join("\n")); }
        assert_eq!(s.get(&account_key("c")).unwrap().unwrap().expose_secret(), &"x".repeat(2500));
        assert_eq!(wipe_plex(&s).unwrap(), 31);
        assert!(s.inner.map.lock().unwrap().is_empty());
    }

    /// H3 + L2: corrupt index -> wipe keeps deleting known keys and REPORTS failure;
    /// a write rebuilds the index and sweeps stray parts.
    #[test]
    fn fl2_corrupt_index() {
        let s = Chunked::new(MemStore::default());
        { let mut m = s.inner.map.lock().unwrap();
          m.insert(INDEX.into(), "\u{1}plexuw-chunks:v9:zz".into());
          m.insert(v1_part_key(INDEX, 2), "frag".into()); m.insert(part_key(INDEX, 'b', 1), "frag".into());
          m.insert(account_key("c"), "a".into()); }
        assert_eq!(wipe_plex_known(&s, &[account_key("c")]), Err(StoreError::Other(E_PARTIAL_WIPE.into())));
        assert!(s.inner.map.lock().unwrap().is_empty(), "known keys, index and its stray parts deleted");
        { let mut m = s.inner.map.lock().unwrap();
          m.insert(INDEX.into(), "\u{1}garbage".into()); m.insert(v1_part_key(INDEX, 1), "frag".into()); m.insert(part_key(INDEX, 'b', 3), "frag".into()); }
        put(&s, &account_key("c"), &SecretString::from("a".to_string())).unwrap();
        let m = s.inner.map.lock().unwrap();
        assert_eq!(m.get(INDEX).map(String::as_str), Some(account_key("c").as_str()));
        assert!(!m.keys().any(|k| k.contains('#')), "L2: write path swept stray parts");
    }

    /// H2: a read that raced a wipe or a write must not fill the cache.
    #[test]
    fn fl2_h2_cache_fill_race() {
        let s = Chunked::new(MemStore::default());
        put(&s, &account_key("c"), &SecretString::from("old".to_string())).unwrap();
        s.forget_all();
        // Deterministic interleaving: read starts, wipe runs, read tries to fill.
        let g = s.cache_gen(); let v = s.get_uncached(&account_key("c")).unwrap().unwrap();
        wipe_plex(&s).unwrap();
        s.fill(&account_key("c"), &v, g);
        assert!(s.get(&account_key("c")).unwrap().is_none(), "signed-out token not cached");
        put(&s, &account_key("c"), &SecretString::from("old".to_string())).unwrap(); s.forget_all();
        let g = s.cache_gen(); let v = s.get_uncached(&account_key("c")).unwrap().unwrap();
        put(&s, &account_key("c"), &SecretString::from("new".to_string())).unwrap();
        s.fill(&account_key("c"), &v, g);
        assert_eq!(s.get(&account_key("c")).unwrap().unwrap().expose_secret(), "new");
        // Threaded stress: readers hammer get() while the main thread signs out.
        let s = std::sync::Arc::new(Chunked::new(MemStore::default()));
        for round in 0..50 {
            put(&*s, &account_key("c"), &SecretString::from(format!("t{round}"))).unwrap();
            let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
            let rs: Vec<_> = (0..4).map(|_| { let (s, stop) = (s.clone(), stop.clone()); std::thread::spawn(move || {
                while !stop.load(std::sync::atomic::Ordering::SeqCst) { let _ = s.get(&account_key("c")); } }) }).collect();
            wipe_plex(&*s).unwrap();
            stop.store(true, std::sync::atomic::Ordering::SeqCst);
            for r in rs { r.join().unwrap(); }
            assert!(s.cache().map.is_empty(), "round {round}: token cached after sign-out");
        }
    }

    fn dels(s: &Chunked<MemStore>) -> usize { s.inner.dels.swap(0, std::sync::atomic::Ordering::SeqCst) }

    /// SHOULD-8: wipe/sign-in delete only what the index and headers name; the 3x64 probe
    /// runs only for a key whose header can't be read.
    #[test]
    fn fl2_should8_delete_counts_are_bounded() {
        let s = Chunked::new(MemStore::default());
        let k = account_key("c");
        put(&s, &k, &big('A')).unwrap(); // sign-in: 3-part token
        for i in 0..16 { put(&s, &server_key("c", &format!("m{i}")), &SecretString::from("t".to_string())).unwrap(); }
        assert_eq!(dels(&s), 0, "sign-in writes delete nothing");
        put(&s, &k, &big('B')).unwrap(); // re-sign-in: flip a->b, clear 3 old parts
        assert_eq!(dels(&s), 3);
        assert_eq!(wipe_plex(&s).unwrap(), 17);
        assert_eq!(dels(&s), 17 + 3 + 1, "17 keys + 3 named parts + index");
        assert!(s.inner.map.lock().unwrap().is_empty());
        // Corrupt header: bounded probe, still deletes everything.
        s.inner.map.lock().unwrap().insert(k.clone(), "\u{1}plexuw-chunks:zz".into());
        s.inner.map.lock().unwrap().insert(part_key(&k, 'b', 40), "frag".into());
        assert_eq!(wipe_plex_known(&s, &[k.clone()]).unwrap(), 1);
        assert_eq!(dels(&s), 1 + 3 * MAX_CHUNKS + 1, "key + bounded probe + index");
        assert!(s.inner.map.lock().unwrap().is_empty());
    }

    /// LOW-9: a failed delete is reported and the key stays indexed for a later retry.
    #[test]
    fn fl2_low9_failed_delete_stays_indexed() {
        let k = server_key("c", "m1");
        let s = Chunked::new(MemStore { fail_del: Some(k.clone()), ..Default::default() });
        put(&s, &account_key("c"), &SecretString::from("t".to_string())).unwrap();
        put(&s, &k, &SecretString::from("t".to_string())).unwrap();
        assert_eq!(wipe_plex(&s), Err(StoreError::Other(E_PARTIAL_WIPE.into())));
        assert_eq!(index(&s).unwrap().into_iter().collect::<Vec<_>>(), vec![k.clone()]);
        assert!(s.get(&account_key("c")).unwrap().is_none());
    }

    /// SHOULD-8: a wipe behind a hung writer gives up with E_BUSY instead of hanging.
    #[test]
    fn fl2_should8_lock_timeout() {
        let s = std::sync::Arc::new(Chunked::new(MemStore::default()));
        let (tx, rx) = std::sync::mpsc::channel();
        let s2 = s.clone();
        let h = std::thread::spawn(move || { let _g = s2.sync().lock().unwrap(); tx.send(()).unwrap(); std::thread::sleep(LOCK_TIMEOUT * 3); });
        rx.recv().unwrap();
        let t0 = std::time::Instant::now();
        assert_eq!(wipe_plex(&*s), Err(StoreError::Other(E_BUSY.into())));
        assert!(t0.elapsed() < LOCK_TIMEOUT * 2);
        h.join().unwrap();
        assert!(wipe_plex(&*s).is_ok());
    }
}
