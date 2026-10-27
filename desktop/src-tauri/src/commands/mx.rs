//! fu7b merged servers (docs/PLAN-FU7-MERGED-SERVERS.md): Home, Library and Search
//! across every online server. Fan-out rules: at most 4 requests in flight, a 1.5 s soft
//! deadline (partial results, late answers fill in via the `plex-merge-fill` event), a 5 s
//! hard deadline (16 s for the version guid scan), a 401 marks only that server offline. Every reply is tagged with the key
//! epoch it was started under and dropped if a sign-out/refresh rotated the key meanwhile
//! (LOW-12): no ids are minted and no images registered for a stale generation.
use super::*;
use crate::plex::merge::{self as mg, Row};
use serde_json::Value;
use std::collections::{HashMap, HashSet, VecDeque};
use std::time::Instant;

pub const MAX_INFLIGHT: usize = 4;
pub const SOFT: Duration = Duration::from_millis(1500);
pub const HARD: Duration = Duration::from_secs(5);
/// `/library/all?guid=` walks the library. The 5 s cap was caching a timeout as "no copy".
pub const VERSION_BUDGET: Duration = Duration::from_secs(16);
pub const TTL: Duration = Duration::from_secs(60);
pub const MAX_SERVERS: usize = 16;
pub const LIB_CAP: usize = 20_000;

type Key = (String, String); // (request key, machineId)

#[derive(Default)]
struct Cache {
    epoch: u64,
    done: HashMap<Key, (Instant, Option<Value>)>,
    inflight: HashSet<Key>,
    /// Failed attempts that were not stored in `done`. The second failure settles.
    misses: HashMap<Key, u8>,
}

pub struct Mx {
    cache: Mutex<Cache>,
    sem: Arc<tokio::sync::Semaphore>,
    views: Mutex<(u64, HashMap<String, Arc<tokio::sync::Mutex<View>>>)>,
    pub notify: Mutex<Option<Arc<dyn Fn() + Send + Sync>>>,
    pub fills: AtomicU64,
    pub dropped: AtomicU64,
}
impl Default for Mx {
    fn default() -> Self {
        Mx { cache: Default::default(), sem: Arc::new(tokio::sync::Semaphore::new(MAX_INFLIGHT)), views: Default::default(),
             notify: Mutex::new(None), fills: AtomicU64::new(0), dropped: AtomicU64::new(0) }
    }
}
impl Mx {
    /// Sign-out / refresh: forget every cached reply and library cursor.
    pub fn reset(&self) {
        *self.cache.lock().unwrap() = Cache::default();
        self.views.lock().unwrap().1.clear();
    }
}

/// Online servers in merge order: the connected one first, then owned, then by name.
pub fn ranked(p: &Plex) -> Vec<Server> {
    let cur = p.current().ok().map(|(m, _)| m);
    let mut v: Vec<Server> = p.servers.lock().unwrap().iter().filter(|s| s.online && (!s.conns.is_empty() || Some(&s.machine_id) == cur.as_ref())).cloned().collect();
    v.sort_by(|a, b| (Some(&b.machine_id) == cur.as_ref()).cmp(&(Some(&a.machine_id) == cur.as_ref())).then(b.owned.cmp(&a.owned)).then(a.name.cmp(&b.name)));
    v.truncate(MAX_SERVERS);
    v
}

/// The connection for `mid`: the connected server's own, else that server's cached/raced one.
pub async fn conn_of(p: &Arc<Plex>, s: &Server) -> Option<Conn> {
    if let Ok((m, c)) = p.current() { if m == s.machine_id { return Some(c); } }
    conn_for(p, s).await
}

fn mark_offline(p: &Plex, mid: &str) {
    if let Some(s) = p.servers.lock().unwrap().iter_mut().find(|s| s.machine_id == mid) { s.online = false; }
    p.conns.lock().unwrap().remove(mid);
}

pub async fn fetch_on(p: &Arc<Plex>, mid: &str, api: &Api) -> Result<Value, String> {
    let budget = match api { Api::ByGuid { .. } => VERSION_BUDGET, _ => HARD };
    fetch_budget(p, mid, api, budget).await
}

async fn fetch_budget(p: &Arc<Plex>, mid: &str, api: &Api, budget: Duration) -> Result<Value, String> {
    // fu7c (Sentinel INFO): the connect race, the semaphore wait AND the request all sit
    // inside one deadline, so no single server call can exceed that budget end to end.
    let r = tokio::time::timeout(budget, async {
        let s = p.servers.lock().unwrap().iter().find(|s| s.machine_id == mid).cloned();
        let c = match s { Some(s) => conn_of(p, &s).await.ok_or_else(|| "unreachable".to_string())?, None => { let (m, c) = p.current()?; if m != mid { return Err("not found".to_string()); } c } };
        let _permit = p.mx.sem.clone().acquire_owned().await.map_err(|_| "closed".to_string())?;
        match browse::get(&p.egress, &c, mid, api).await {
            Ok(v) => Ok(v),
            Err(ApiError::Egress(crate::plex::egress::EgressError::Status(401))) => { mark_offline(p, mid); Err("signed-out".to_string()) }
            Err(e) => Err(err(e)),
        }
    }).await;
    r.unwrap_or_else(|_| Err("timeout".into()))
}

pub struct Gathered { pub got: Vec<(usize, Server, Value)>, pub pending: bool, pub answered: usize, pub ep: u64 }

/// Fan `api` out to `servers` (cache key `key`). Returns what answered by the soft
/// deadline; the rest keep running (hard deadline) and fill in through the cache.
pub async fn gather(p: &Arc<Plex>, key: &str, api: Api, servers: &[Server]) -> Result<Gathered, String> {
    let ep = p.slots.epoch();
    let t0 = Instant::now();
    {
        let mut c = p.mx.cache.lock().unwrap();
        if c.epoch != ep { *c = Cache { epoch: ep, ..Default::default() }; }
        if c.done.len() > 2000 { c.done.retain(|_, (t, _)| t.elapsed() < TTL); }
        for s in servers {
            let k = (key.to_string(), s.machine_id.clone());
            if c.done.get(&k).is_some_and(|(t, _)| t.elapsed() < TTL) || c.inflight.contains(&k) { continue; }
            c.inflight.insert(k.clone());
            let (p2, s2, api2) = (p.clone(), s.clone(), api.clone());
            tokio::spawn(async move {
                let guid_scan = matches!(api2, Api::ByGuid { .. });
                let r = fetch_on(&p2, &s2.machine_id, &api2).await.ok();
                let late = t0.elapsed() >= SOFT;
                let mut c = p2.mx.cache.lock().unwrap();
                // A rotated key must not publish ids, but it also must not leave the
                // in-flight mark behind: that mark makes every later gather skip the
                // server and report `pending` forever (the Versions spinner).
                if c.epoch != ep || p2.slots.epoch() != ep {
                    if c.epoch == ep { c.inflight.remove(&k); }
                    p2.mx.dropped.fetch_add(1, Ordering::SeqCst);
                    return;
                }
                c.inflight.remove(&k);
                match r {
                    Some(v) => {
                        c.misses.remove(&k);
                        c.done.insert(k, (Instant::now(), Some(v)));
                    }
                    // A guid-scan miss is not "this server has no copy". One miss stays
                    // pending and is retried; the second miss settles. Other fan-outs
                    // still count a timeout or 401 as answered (the 5 s hard deadline).
                    None if guid_scan => {
                        let n = c.misses.entry(k.clone()).or_insert(0);
                        *n = n.saturating_add(1);
                        if *n >= 2 { c.done.insert(k, (Instant::now(), None)); }
                    }
                    None => { c.done.insert(k, (Instant::now(), None)); }
                }
                drop(c);
                if late {
                    p2.mx.fills.fetch_add(1, Ordering::SeqCst);
                    let n = p2.mx.notify.lock().unwrap().clone();
                    if let Some(n) = n { n(); }
                }
            });
        }
    }
    loop {
        let all = { let c = p.mx.cache.lock().unwrap(); servers.iter().all(|s| c.done.contains_key(&(key.to_string(), s.machine_id.clone()))) };
        if all || t0.elapsed() >= SOFT { break; }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    if p.slots.epoch() != ep { return Err("stale".into()); }
    let c = p.mx.cache.lock().unwrap();
    if c.epoch != ep { return Err("stale".into()); }
    let (mut got, mut pending, mut answered) = (vec![], false, 0);
    for (i, s) in servers.iter().enumerate() {
        match c.done.get(&(key.to_string(), s.machine_id.clone())) {
            Some((_, Some(v))) => { answered += 1; got.push((i, s.clone(), v.clone())) }
            Some((_, None)) => answered += 1,
            None => pending = true,
        }
    }
    Ok(Gathered { got, pending, answered, ep })
}

fn metas(v: &Value) -> impl Iterator<Item = &Value> { v.get("Metadata").and_then(Value::as_array).into_iter().flatten().take(500) }
fn raw_hubs(v: &Value) -> Vec<(String, String, Vec<&Value>)> {
    v.get("Hub").and_then(Value::as_array).into_iter().flatten().take(40).map(|h| {
        let st = |k: &str, n: usize| h.get(k).and_then(Value::as_str).map(|x| browse::clean(x, n)).unwrap_or_default();
        (st("title", 120), st("hubIdentifier", 80), metas(h).collect())
    }).collect()
}

fn rows_of<'a>(it: impl Iterator<Item = &'a Value>, rank: usize, s: &Server, img: &Images, p: &Plex, ep: u64) -> Vec<Row> {
    it.filter_map(|raw| mg::row(raw, &s.machine_id, s.owned, rank, img, &p.slots, ep)).map(|mut r| { r.server = s.name.clone(); r }).collect()
}

/// A list of items from one server with sealed ids, images committed only if the epoch held.
pub fn sealed_items(p: &Plex, v: &Value, mid: &str, ep: u64) -> Result<Vec<browse::Item>, String> {
    let img = p.images.fork();
    let out = browse::item_list(v, mid, &img).into_iter().filter_map(|mut it| mg::seal(&mut it, mid, &p.slots, ep).map(|_| it)).collect();
    if p.slots.epoch() != ep || !p.images.commit(img) { return Err("stale".into()); }
    Ok(out)
}

pub fn item_target(p: &Plex, id: &str) -> Result<(String, u64), String> {
    match p.slots.resolve(id) { Some(Target::Item { mid, rk }) => Ok((mid, rk)), _ => Err("not found".into()) }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LibView { pub id: String, pub title: String, pub kind: String, pub servers: u32 }

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HomeView { pub sections: Vec<LibView>, pub continue_watching: Vec<browse::Item>, pub on_deck: Vec<browse::Item>, pub hubs: Vec<browse::Hub>, pub pending: bool, pub answered: u32, pub servers: u32 }

fn lib_title(kind: &str) -> Option<&'static str> { match kind { "movie" => Some("Movies"), "show" => Some("TV Shows"), _ => None } }

pub fn libraries(p: &Plex, g: &Gathered) -> Vec<LibView> {
    let mut out: Vec<LibView> = vec![];
    for kind in ["movie", "show"] {
        let n = g.got.iter().filter(|(_, _, v)| browse::sections(v).iter().any(|s| s.kind == kind)).count();
        if n > 0 { if let Some(id) = p.slots.mint_if(g.ep, Target::Lib(kind.into())) { out.push(LibView { id, title: lib_title(kind).unwrap().into(), kind: kind.into(), servers: n as u32 }); } }
    }
    for (_, s, v) in &g.got {
        for sec in browse::sections(v).into_iter().filter(|x| lib_title(&x.kind).is_none()) {
            if let Some(id) = p.slots.mint_if(g.ep, Target::Section { mid: s.machine_id.clone(), id: sec.id }) {
                let title = if g.got.len() > 1 { format!("{} · {}", sec.title, s.name) } else { sec.title };
                out.push(LibView { id, title, kind: sec.kind, servers: 1 });
            }
        }
    }
    out
}

pub async fn home(p: &Arc<Plex>) -> Result<HomeView, String> {
    let srv = ranked(p);
    if srv.is_empty() { p.current()?; }
    let (a, b, c, d) = tokio::join!(gather(p, "sections", Api::Sections, &srv), gather(p, "cw", Api::ContinueWatching, &srv), gather(p, "od", Api::OnDeck, &srv), gather(p, "promoted", Api::Promoted, &srv));
    let (secs, cw, od, pr) = (a?, b?, c?, d?);
    if secs.got.is_empty() && !secs.pending { return Err("unreachable".into()); }
    let ep = secs.ep;
    if [cw.ep, od.ep, pr.ep].iter().any(|e| *e != ep) { return Err("stale".into()); }
    let img = p.images.fork();
    let mut cwr = vec![];
    for (rank, s, v) in &cw.got { for (_, _, items) in raw_hubs(v) { cwr.extend(rows_of(items.into_iter(), *rank, s, &img, p, ep)); } }
    let mut odr = vec![];
    for (rank, s, v) in &od.got { odr.extend(rows_of(metas(v), *rank, s, &img, p, ep)); }
    let per = pr.got.iter().map(|(rank, s, v)| raw_hubs(v).into_iter().map(|(t, i, items)| (t, i, rows_of(items.into_iter(), *rank, s, &img, p, ep))).collect()).collect();
    let view = HomeView {
        sections: libraries(p, &secs),
        continue_watching: mg::dedupe(cwr, true).into_iter().take(40).map(|r| r.item).collect(),
        on_deck: mg::dedupe(odr, true).into_iter().take(40).map(|r| r.item).collect(),
        hubs: mg::merge_hubs(per, 24),
        pending: secs.pending || cw.pending || od.pending || pr.pending,
        answered: secs.answered as u32, servers: srv.len() as u32,
    };
    if p.slots.epoch() != ep || !p.images.commit(img) { return Err("stale".into()); }
    Ok(view)
}

pub async fn search(p: &Arc<Plex>, q: String) -> Result<Vec<browse::Hub>, String> {
    let srv = ranked(p);
    let g = gather(p, &format!("search\0{q}"), Api::Search(q), &srv).await?;
    let img = p.images.fork();
    let per = g.got.iter().map(|(rank, s, v)| raw_hubs(v).into_iter().map(|(t, i, items)| (t, i, rows_of(items.into_iter(), *rank, s, &img, p, g.ep))).collect()).collect();
    let out = mg::merge_hubs(per, 24);
    if p.slots.epoch() != g.ep || !p.images.commit(img) { return Err("stale".into()); }
    Ok(out)
}

// ---- Libraries: one or many (server, section) sources merged and paged in Rust.

#[derive(Clone)]
pub struct Src { pub s: Server, pub rank: usize, pub sec: u32 }

pub async fn lib_sources(p: &Arc<Plex>, id: &str) -> Result<Vec<Src>, String> {
    match p.slots.resolve(id) {
        Some(Target::Section { mid, id }) => {
            let s = p.servers.lock().unwrap().iter().find(|s| s.machine_id == mid).cloned();
            let s = match s { Some(s) => s, None => { let (m, c) = p.current()?; if m != mid { return Err("not found".into()) } Server { machine_id: m, name: String::new(), owned: true, online: true, conns: vec![c] } } };
            Ok(vec![Src { s, rank: 0, sec: id }])
        }
        Some(Target::Lib(kind)) => {
            let srv = ranked(p);
            let g = gather(p, "sections", Api::Sections, &srv).await?;
            Ok(g.got.iter().flat_map(|(rank, s, v)| browse::sections(v).into_iter().filter(|x| x.kind == kind).map(|x| Src { s: s.clone(), rank: *rank, sec: x.id }).collect::<Vec<_>>()).collect())
        }
        _ => Err("not found".into()),
    }
}

/// The filter as each source understands it. A genre is chosen by title (merged facets
/// use the title as key) and mapped to that server's own numeric key; a source without
/// that genre gets None (it contributes nothing).
pub async fn src_filters(p: &Arc<Plex>, srcs: &[Src], fkind: &str, fvalue: &str) -> Result<Vec<Option<browse::Filter>>, String> {
    if fkind != "genre" {
        let f = browse::Filter::parse(fkind, fvalue).ok_or("invalid filter")?;
        return Ok(vec![Some(f); srcs.len()]);
    }
    let want = browse::clean(fvalue.trim(), 120);
    if want.is_empty() { return Err("invalid filter".into()); }
    let futs = srcs.iter().map(|x| { let want = want.clone(); async move {
        let v = fetch_on(p, &x.s.machine_id, &Api::SectionFacet { id: x.sec, facet: Facet::Genre }).await.ok()?;
        browse::facets(&v).into_iter().find(|f| f.title.eq_ignore_ascii_case(&want) || f.key == want).and_then(|f| f.key.parse().ok()).map(browse::Filter::Genre)
    }});
    Ok(futures::future::join_all(futs).await)
}

struct SrcState { src: Src, filter: Option<browse::Filter>, buf: VecDeque<Row>, next: u32, total: u32, done: bool }
pub struct View { srcs: Vec<SrcState>, out: Vec<browse::Item>, seen: HashMap<String, usize>, dups: u32, partial: bool, sort: Sort, ep: u64 }

async fn view_for(p: &Arc<Plex>, id: &str, sort: Sort, sname: &str, fkind: &str, fvalue: &str) -> Result<(String, Arc<tokio::sync::Mutex<View>>), String> {
    let ep = p.slots.epoch();
    let key = format!("{id}\0{sname}\0{fkind}\0{fvalue}");
    {
        let mut g = p.mx.views.lock().unwrap();
        if g.0 != ep { *g = (ep, HashMap::new()); }
        if let Some(v) = g.1.get(&key) { return Ok((key, v.clone())); }
    }
    let srcs = lib_sources(p, id).await?;
    let fs = src_filters(p, &srcs, fkind, fvalue).await?;
    let st = srcs.into_iter().zip(fs).map(|(src, filter)| SrcState { done: filter.is_none(), src, filter, buf: VecDeque::new(), next: 0, total: 0 }).collect();
    let v = Arc::new(tokio::sync::Mutex::new(View { srcs: st, out: vec![], seen: HashMap::new(), dups: 0, partial: false, sort, ep }));
    let mut g = p.mx.views.lock().unwrap();
    if g.0 != ep { return Err("stale".into()); }
    if g.1.len() >= 8 { g.1.clear(); }
    Ok((key.clone(), g.1.entry(key).or_insert(v).clone()))
}

async fn fill(p: &Arc<Plex>, v: &mut View, want: usize) -> Result<(), String> {
    let want = want.min(LIB_CAP);
    while v.out.len() < want {
        // Refill every source whose buffer ran dry, so the k-way pick below is correct.
        let need: Vec<usize> = (0..v.srcs.len()).filter(|&i| v.srcs[i].buf.is_empty() && !v.srcs[i].done).collect();
        if !need.is_empty() {
            let reqs = need.iter().map(|&i| { let x = &v.srcs[i]; let api = Api::SectionAll { id: x.src.sec, start: x.next, size: browse::PAGE, sort: v.sort, filter: x.filter.clone().unwrap_or_default() }; let mid = x.src.s.machine_id.clone(); async move { fetch_on(p, &mid, &api).await } });
            let res = futures::future::join_all(reqs).await;
            if p.slots.epoch() != v.ep { return Err("stale".into()); }
            let img = p.images.fork();
            for (&i, r) in need.iter().zip(res) {
                let x = &mut v.srcs[i];
                match r {
                    Ok(val) => {
                        let rows = rows_of(metas(&val), x.src.rank, &x.src.s, &img, p, v.ep);
                        let n = val.get("Metadata").and_then(Value::as_array).map_or(0, |a| a.len()) as u32;
                        x.total = val.get("totalSize").and_then(Value::as_u64).map(|t| t as u32).unwrap_or(x.next + n);
                        x.next += n;
                        x.done = n == 0 || x.next >= x.total;
                        x.buf.extend(rows);
                    }
                    Err(_) => { x.done = true; v.partial = true; }
                }
            }
            if !p.images.commit(img) { return Err("stale".into()); }
        }
        let best = (0..v.srcs.len()).filter(|&i| !v.srcs[i].buf.is_empty()).min_by(|&a, &b| mg::lib_cmp(v.sort, &v.srcs[a].buf[0], &v.srcs[b].buf[0]));
        let Some(b) = best else { break };
        let r = v.srcs[b].buf.pop_front().unwrap();
        if let Some(at) = r.keys.iter().find_map(|k| v.seen.get(k).copied()) {
            // fu7c: a duplicate adds its server to the kept card's sources (cards already
            // returned to the UI keep what they had).
            let c = &mut v.out[at];
            let mut names: Vec<&str> = if c.sources.is_empty() { vec![c.server_hint.as_str()] } else { c.sources.iter().map(String::as_str).collect() };
            names.push(&r.server);
            c.sources = mg::sources_of(names.into_iter());
            v.dups += 1; continue;
        }
        let at = v.out.len();
        for k in &r.keys { v.seen.insert(k.clone(), at); }
        let mut it = r.item; it.server_hint = r.server;
        v.out.push(it);
    }
    Ok(())
}

pub async fn section_page(p: &Arc<Plex>, id: &str, start: u32, cursor: Option<&str>, sname: &str, fkind: &str, fvalue: &str) -> Result<browse::Page, String> {
    let sort = match sname { "added" => Sort::Added, "year" => Sort::Year, "rating" => Sort::Rating, _ => Sort::Title };
    let (key, view) = view_for(p, id, sort, sname, fkind, fvalue).await?;
    let start = match cursor {
        Some(c) => match p.slots.resolve(c) { Some(Target::Cursor { view, start }) if view == key => start, _ => return Err("invalid cursor".into()) },
        None => start,
    } as usize;
    if start >= LIB_CAP { return Err("invalid cursor".into()); }
    let mut v = view.lock().await;
    let end = start + browse::PAGE as usize;
    fill(p, &mut v, end).await?;
    let items: Vec<browse::Item> = v.out.iter().skip(start).take(browse::PAGE as usize).cloned().collect();
    let exhausted = v.srcs.iter().all(|x| x.done && x.buf.is_empty());
    let total = if exhausted { v.out.len() as u32 } else { v.srcs.iter().map(|x| x.total).sum::<u32>().saturating_sub(v.dups).min(LIB_CAP as u32).max(v.out.len() as u32) };
    let next = start + items.len();
    let cursor = (next < total as usize).then(|| p.slots.mint_if(v.ep, Target::Cursor { view: key, start: next as u32 })).flatten();
    Ok(browse::Page { items, start: start as u32, total, cursor, partial: v.partial })
}

pub async fn letters(p: &Arc<Plex>, id: &str, fkind: &str, fvalue: &str) -> Result<Vec<browse::Letter>, String> {
    let srcs = lib_sources(p, id).await?;
    let fs = src_filters(p, &srcs, fkind, fvalue).await?;
    let futs = srcs.iter().zip(fs).filter_map(|(x, f)| f.map(|f| async move { fetch_on(p, &x.s.machine_id, &Api::FirstCharacter { id: x.sec, filter: f }).await.map(|v| browse::letters(&v)).unwrap_or_default() }));
    let mut acc: Vec<browse::Letter> = vec![];
    for ls in futures::future::join_all(futs).await { for l in ls { match acc.iter_mut().find(|a| a.key == l.key) { Some(a) => a.count = a.count.saturating_add(l.count), None => acc.push(l) } } }
    acc.sort_by(|a, b| (a.key != "#").cmp(&(b.key != "#")).then(a.key.cmp(&b.key)));
    Ok(acc)
}

pub async fn facets(p: &Arc<Plex>, id: &str, facet: Facet) -> Result<Vec<browse::FacetValue>, String> {
    let srcs = lib_sources(p, id).await?;
    let futs = srcs.iter().map(|x| async move { fetch_on(p, &x.s.machine_id, &Api::SectionFacet { id: x.sec, facet }).await.map(|v| browse::facets(&v)).unwrap_or_default() });
    let mut acc: Vec<browse::FacetValue> = vec![];
    for fs in futures::future::join_all(futs).await { for mut f in fs {
        if facet == Facet::Genre { f.key = f.title.clone(); }
        if !acc.iter().any(|a| a.title.eq_ignore_ascii_case(&f.title)) && acc.len() < 500 { acc.push(f); }
    } }
    Ok(acc)
}

pub async fn section_hubs(p: &Arc<Plex>, id: &str) -> Result<Vec<browse::Hub>, String> {
    let srcs = lib_sources(p, id).await?;
    let ep = p.slots.epoch();
    let img = p.images.fork();
    let futs = srcs.iter().map(|x| async move { fetch_on(p, &x.s.machine_id, &Api::SectionHubs(x.sec)).await.ok() });
    let res = futures::future::join_all(futs).await;
    let per = srcs.iter().zip(res).filter_map(|(x, v)| v.map(|v| raw_hubs(&v).into_iter().map(|(t, i, items)| (t, i, rows_of(items.into_iter(), x.rank, &x.s, &img, p, ep))).collect())).collect();
    let out = mg::merge_hubs(per, 24);
    if p.slots.epoch() != ep || !p.images.commit(img) { return Err("stale".into()); }
    Ok(out)
}

pub async fn collections(p: &Arc<Plex>, id: &str) -> Result<Vec<browse::Item>, String> {
    let srcs = lib_sources(p, id).await?;
    let ep = p.slots.epoch();
    let mut out = vec![];
    for x in srcs { if let Ok(v) = fetch_on(p, &x.s.machine_id, &Api::SectionCollections(x.sec)).await { out.extend(sealed_items(p, &v, &x.s.machine_id, ep)?); } }
    Ok(out)
}

#[cfg(test)]
mod t {
    use super::*;
    use crate::plex::{fixture::{FixtureTransport, FIX_ACCOUNT_TOKEN}, secrets::MemStore};
    use secrecy::SecretString;

    async fn three(tag: &str, ft: FixtureTransport) -> (Arc<Plex>, PathBuf) {
        let dir = std::env::temp_dir().join(format!("plexuw-mx-{tag}-{}", std::process::id()));
        let store: Arc<dyn SecretStore> = Arc::new(MemStore::default());
        let e = Arc::new(Egress::new(Arc::new(FixtureTransport { second_online: true, ..ft }), store, "cid".into()));
        api::store_account_token(&e, &SecretString::from(FIX_ACCOUNT_TOKEN.to_string())).unwrap();
        let p = Arc::new(Plex {
            egress: e.clone(), servers: Mutex::new(vec![]), manual: Mutex::new(None), gen: AtomicU64::new(0),
            manual_ask: Mutex::new(None), trust: Mutex::new(api::Trust::default()), trust_path: dir.join("t.json"), ai_migrate_failed: false,
            source: Mutex::new(Box::new(MockSource { reason: "first-run" })),
            prefs: Mutex::new(Prefs::default()), prefs_path: dir.join("s.json"),
            images: Images::default(), hls: HlsMap::default(), conn_gen: AtomicU64::new(0), cache_dir: dir.join("imgcache"),
            slots: Default::default(), sticky: Default::default(), conns: Default::default(), mx: Default::default(),
        });
        p.set_servers(api::load_resources(&e).await.unwrap());
        connect(&p, "fixturemachine0001").await.unwrap();
        (p, dir)
    }
    fn opaque(id: &str) -> bool { id.len() == 24 && id.bytes().all(|b| b.is_ascii_hexdigit()) }
    fn leak_free(js: &str) {
        for bad in ["fixturemachine", "srv1", "srv2", "srv4", "X-Plex-Token", "plex.direct", "198-51-100", "192-0-2", "plex.example.com", "/library/"] { assert!(!js.contains(bad), "leak {bad}"); }
    }

    /// Merged Home: one card per GUID; progress from the most recently watched copy
    /// (BLACKBOX's, +60 s), card from the best owned copy (MoxBox 4K); merged libraries.
    #[tokio::test]
    async fn home_merges_dedupes_recent_wins() {
        let (p, dir) = three("home", FixtureTransport::default()).await;
        let h = home(&p).await.unwrap();
        assert!(!h.pending && h.answered == 3 && h.servers == 3);
        let js = serde_json::to_string(&h).unwrap();
        leak_free(&js);
        let movies = h.sections.iter().find(|s| s.title == "Movies").expect("merged Movies");
        assert_eq!(movies.servers, 3);
        assert!(h.sections.iter().any(|s| s.title == "TV Shows"));
        assert!(h.sections.iter().all(|s| opaque(&s.id)));
        // i = 6: in CW on all three servers (i%5==1), owned on MoxBox (4K) + BLACKBOX.
        let all: Vec<&browse::Item> = h.continue_watching.iter().chain(h.on_deck.iter()).collect();
        let six: Vec<_> = h.continue_watching.iter().filter(|i| i.title == all.iter().find(|x| { matches!(p.slots.resolve(&x.id), Some(Target::Item { rk: 1006, .. })) }).map(|x| x.title.clone()).unwrap_or_default()).collect();
        assert_eq!(six.len(), 1, "deduped by GUID");
        let Some(Target::Item { mid, rk }) = p.slots.resolve(&six[0].id) else { panic!() };
        assert_eq!((mid.as_str(), rk), ("fixturemachine0001", 1006), "card = best owned copy");
        let mox = browse::item_list(&fetch_on(&p, "fixturemachine0001", &Api::Metadata(1006)).await.unwrap(), "m", &p.images.fork())[0].view_offset_ms.unwrap();
        assert_eq!(six[0].view_offset_ms, Some(mox + 60_000), "most recent copy's progress wins");
        for it in &h.continue_watching { assert!(opaque(&it.id)); }
        let ids: HashSet<_> = h.continue_watching.iter().map(|i| i.id.clone()).collect();
        assert_eq!(ids.len(), h.continue_watching.len());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Merged library: sorted in Rust across servers, duplicates collapse to the owned
    /// copy, opaque cursor pages, totals stay within the caps.
    #[tokio::test]
    async fn library_merge_sort_page_cursor() {
        let (p, dir) = three("lib", FixtureTransport::default()).await;
        let h = home(&p).await.unwrap();
        let lib = h.sections.iter().find(|s| s.title == "Movies").unwrap().id.clone();
        let mut seen = HashSet::new();
        let mut titles = vec![];
        let mut pg = section_page(&p, &lib, 0, None, "title", "", "").await.unwrap();
        loop {
            for it in &pg.items { assert!(seen.insert(it.title.clone()), "dup {}", it.title); titles.push(it.title.to_lowercase()); }
            let Some(c) = pg.cursor.clone() else { break };
            assert!(opaque(&c));
            pg = section_page(&p, &lib, 0, Some(&c), "title", "", "").await.unwrap();
        }
        assert_eq!(pg.total as usize, titles.len());
        let mox = fetch_on(&p, "fixturemachine0001", &Api::SectionAll { id: 1, start: 0, size: 1, sort: Sort::Title, filter: Default::default() }).await.unwrap();
        assert_eq!(titles.len() as u64, mox["totalSize"].as_u64().unwrap(), "every server holds the same titles: merged == one copy each");
        assert!(!pg.partial);
        // Bad / foreign cursors are refused.
        assert!(section_page(&p, &lib, 0, Some("00112233445566778899aabb"), "title", "", "").await.is_err());
        let c0 = section_page(&p, &lib, 0, None, "title", "", "").await.unwrap().cursor.unwrap();
        assert!(section_page(&p, &lib, 0, Some(&c0), "added", "", "").await.is_err(), "cursor bound to its view");
        // Genre filter by title maps to each server's own key.
        let gs = facets(&p, &lib, Facet::Genre).await.unwrap();
        assert!(gs.iter().any(|g| g.key == "Western") && gs.iter().any(|g| g.key == "Sci-Fi"));
        let w = section_page(&p, &lib, 0, None, "title", "genre", "Western").await.unwrap();
        assert!(w.total > 0);
        assert!(section_page(&p, &lib, 0, None, "title", "genre", "").await.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Partial results: Slowpoke answers after the 1.5 s soft deadline; Home returns
    /// without it (pending), the late reply lands in the cache and fires a fill event.
    #[tokio::test]
    async fn partial_then_late_fill() {
        let (p, dir) = three("late", FixtureTransport { slow_ms: 2500, ..Default::default() }).await;
        let hits = Arc::new(AtomicU64::new(0));
        let h2 = hits.clone();
        *p.mx.notify.lock().unwrap() = Some(Arc::new(move || { h2.fetch_add(1, Ordering::SeqCst); }));
        let t = Instant::now();
        let h = home(&p).await.unwrap();
        assert!(t.elapsed() < Duration::from_millis(2300), "{:?}", t.elapsed());
        assert!(h.pending && h.answered == 2);
        tokio::time::sleep(Duration::from_millis(1600)).await;
        assert!(hits.load(Ordering::SeqCst) >= 1 && p.mx.fills.load(Ordering::SeqCst) >= 1);
        let h = home(&p).await.unwrap();
        assert!(!h.pending && h.answered == 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Hard deadline: a server slower than 5 s counts as answered-with-nothing.
    #[tokio::test]
    async fn info_semaphore_wait_inside_deadline() {
        let (p, dir) = three("sem", FixtureTransport::default()).await;
        // Hold every permit: a call that only timed the request itself would block forever.
        let held: Vec<_> = (0..MAX_INFLIGHT).map(|_| p.mx.sem.clone().try_acquire_owned().unwrap()).collect();
        let t = Instant::now();
        let r = fetch_on(&p, "fixturemachine0001", &Api::Sections).await;
        assert_eq!(r.unwrap_err(), "timeout");
        assert!(t.elapsed() < HARD + Duration::from_millis(500), "{:?}", t.elapsed());
        drop(held);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn should1_episodes_without_guid_dedupe_and_sources() {
        let (p, dir) = three("eps", FixtureTransport::default()).await;
        let h = home(&p).await.unwrap();
        for list in [&h.on_deck, &h.continue_watching] {
            let k: Vec<_> = list.iter().filter(|x| x.kind == "episode").map(|x| (x.grandparent_title.clone(), x.parent_index, x.index)).collect();
            let mut u = k.clone(); u.sort(); u.dedup();
            assert_eq!(k.len(), u.len(), "dup episode {k:?}");
        }
        // Cards name their servers only when the title is on more than one.
        let all: Vec<_> = h.hubs.iter().flat_map(|x| x.items.iter()).chain(h.continue_watching.iter()).collect();
        assert!(all.iter().all(|x| x.sources.is_empty() || x.sources.len() > 1));
        assert!(all.iter().any(|x| x.sources.len() > 1), "fixture has multi-server titles");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn hard_deadline() {
        let (p, dir) = three("hard", FixtureTransport { slow_ms: 6000, ..Default::default() }).await;
        assert!(home(&p).await.unwrap().pending);
        tokio::time::sleep(Duration::from_millis(4000)).await;
        let h = home(&p).await.unwrap();
        assert!(!h.pending && h.answered == 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// LOW-12: a refresh/sign-out mid-load drops the in-flight results (no ids minted,
    /// no images registered); a late reply from the old generation is discarded.
    #[tokio::test]
    async fn stale_generation_dropped() {
        let (p, dir) = three("stale", FixtureTransport { slow_ms: 2500, ..Default::default() }).await;
        let p2 = p.clone();
        let job = tokio::spawn(async move { home(&p2).await });
        tokio::time::sleep(Duration::from_millis(300)).await;
        let servers = p.servers.lock().unwrap().clone();
        p.set_servers(servers);
        let (ids, imgs) = (p.slots.len(), p.images.len());
        assert_eq!(job.await.unwrap().unwrap_err(), "stale");
        tokio::time::sleep(Duration::from_millis(2600)).await;
        assert!(p.mx.dropped.load(Ordering::SeqCst) >= 1, "late old-generation reply dropped");
        assert_eq!((p.slots.len(), p.images.len()), (ids, imgs), "nothing minted/registered");
        // title page too
        let id = p.slots.mint(Target::Item { mid: "fixturemachine0002".into(), rk: 1003 });
        let p3 = p.clone();
        let job = tokio::spawn(async move { browse_item_inner(&p3, &id).await });
        tokio::time::sleep(Duration::from_millis(300)).await;
        p.slots.rotate(); p.images.rotate();
        assert!(job.await.unwrap().is_err());
        assert_eq!(p.images.len(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A 401 from one server marks only that server offline.
    #[tokio::test]
    async fn unauthorized_marks_only_that_server() {
        let (p, dir) = three("401", FixtureTransport { blackbox_401: true, ..Default::default() }).await;
        let h = home(&p).await.unwrap();
        assert!(!h.pending);
        let on: Vec<(String, bool)> = p.servers.lock().unwrap().iter().map(|s| (s.name.clone(), s.online)).collect();
        assert!(on.iter().all(|(n, o)| (n == "BLACKBOX") != *o), "{on:?}");
        assert_eq!(ranked(&p).len(), 2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// LOW-13: image ids are keyed; after rotation old ids fail and new ids differ.
    #[test]
    fn low13_image_ids_rotate() {
        let im = Images::default();
        let a = im.register("m", "/library/metadata/1/thumb/2").unwrap();
        assert_eq!(a.len(), 32);
        assert_ne!(a, browse::hex16("m\n/library/metadata/1/thumb/2"));
        im.rotate();
        assert!(im.get(&a).is_none());
        let b = im.register("m", "/library/metadata/1/thumb/2").unwrap();
        assert_ne!(a, b);
        let f = im.fork();
        f.register("m", "/library/metadata/2/thumb/2").unwrap();
        im.rotate();
        assert!(!im.commit(f), "a fork from an old epoch never commits");
    }

    /// LOW-14 + INFO: a title opened on the SHARED server takes card metadata from the
    /// best-ranked owned copy (MoxBox 4K beats BLACKBOX 1080p); slow versions are pending.
    #[tokio::test]
    async fn low14_best_owned_metadata_and_pending_versions() {
        let (p, dir) = three("l14", FixtureTransport::default()).await;
        let id = p.slots.mint(Target::Item { mid: "fixturemachine0002".into(), rk: 1003 });
        let it = browse_item_inner(&p, &id).await.unwrap();
        assert!(!it.versions_pending);
        let (m, _) = p.images.get(it.thumb.as_ref().unwrap()).unwrap();
        assert_eq!(m, "fixturemachine0001");
        let dv = it.default_version.clone().unwrap();
        assert_eq!(it.versions[0].id, dv);
        assert!(it.versions[0].owned && it.versions[0].server == "MoxBox");
        assert!(opaque(&it.id));
        leak_free(&serde_json::to_string(&it).unwrap());
        let (p, dir2) = three("info", FixtureTransport { slow_ms: 2500, ..Default::default() }).await;
        let t = Instant::now();
        let it = browse_item_inner(&p, &p.slots.mint(Target::Item { mid: "fixturemachine0001".into(), rk: 1003 })).await.unwrap();
        assert!(t.elapsed() < Duration::from_millis(2300) && it.versions_pending);
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&dir2);
    }

    /// Slowpoke misses the 1.5 s soft deadline (pending + fill). The next item read,
    /// which the title page does on `plex-merge-fill`, lists every server and clears pending.
    #[tokio::test]
    async fn late_item_versions_clear_on_refill() {
        let (p, dir) = three("verlate", FixtureTransport { slow_ms: 2500, ..Default::default() }).await;
        let id = p.slots.mint(Target::Item { mid: "fixturemachine0001".into(), rk: 1003 });
        let it = browse_item_inner(&p, &id).await.unwrap();
        assert!(it.versions_pending, "soft deadline leaves the slow server pending");
        assert!(it.versions.iter().any(|v| v.server == "MoxBox"));
        tokio::time::sleep(Duration::from_millis(1800)).await;
        assert!(p.mx.fills.load(Ordering::SeqCst) >= 1, "late server emits plex-merge-fill");
        let it = browse_item_inner(&p, &id).await.unwrap();
        assert!(!it.versions_pending, "cached late replies clear pending");
        let names: Vec<&str> = it.versions.iter().map(|v| v.server.as_str()).collect();
        assert!(names.contains(&"MoxBox") && names.contains(&"Slowpoke") && names.contains(&"BLACKBOX"), "{names:?}");
        assert!(it.versions.iter().any(|v| v.owned) && it.versions.iter().any(|v| !v.owned));
        assert!(it.versions.iter().all(|v| opaque(&v.id)));
        leak_free(&serde_json::to_string(&it).unwrap());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Guid search with no Media array still lists every server after a metadata read.
    #[tokio::test]
    async fn slim_guid_hit_hydrates_media_and_lists_every_server() {
        let (p, dir) = three("verslim", FixtureTransport { guid_slim: true, ..Default::default() }).await;
        let id = p.slots.mint(Target::Item { mid: "fixturemachine0001".into(), rk: 1003 });
        let it = browse_item_inner(&p, &id).await.unwrap();
        assert!(!it.versions_pending);
        let names: Vec<&str> = it.versions.iter().map(|v| v.server.as_str()).collect();
        assert!(names.contains(&"MoxBox") && names.contains(&"Slowpoke") && names.contains(&"BLACKBOX"), "{names:?}");
        assert!(it.versions.iter().any(|v| v.label == "4K" || v.label == "1080p"), "{names:?}");
        assert!(it.versions.iter().any(|v| v.owned) && it.versions.iter().any(|v| !v.owned));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The old 5 s cap cached a slow guid scan as an empty answer. 7 s must still arrive.
    #[tokio::test]
    async fn version_scan_waits_past_five_seconds() {
        let (p, dir) = three("verslow", FixtureTransport { slow_ms: 7000, ..Default::default() }).await;
        let id = p.slots.mint(Target::Item { mid: "fixturemachine0001".into(), rk: 1003 });
        let it = browse_item_inner(&p, &id).await.unwrap();
        assert!(it.versions_pending, "soft deadline still paints the copies already in hand");
        tokio::time::sleep(Duration::from_millis(6500)).await;
        let it = browse_item_inner(&p, &id).await.unwrap();
        assert!(!it.versions_pending);
        let names: Vec<&str> = it.versions.iter().map(|v| v.server.as_str()).collect();
        assert!(names.contains(&"MoxBox") && names.contains(&"Slowpoke") && names.contains(&"BLACKBOX"), "{names:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A failed guid scan is not "no copy". The first miss stays pending; the second settles.
    #[tokio::test]
    async fn version_scan_failure_retries_once_then_settles() {
        let (p, dir) = three("verfail", FixtureTransport { guid_fail: true, ..Default::default() }).await;
        let id = p.slots.mint(Target::Item { mid: "fixturemachine0001".into(), rk: 1003 });
        let it = browse_item_inner(&p, &id).await.unwrap();
        assert!(it.versions_pending, "first miss is not an empty answer");
        assert!(it.versions.iter().all(|v| v.server == "MoxBox"));
        let it = browse_item_inner(&p, &id).await.unwrap();
        assert!(!it.versions_pending, "second miss settles");
        assert!(it.versions.iter().all(|v| v.server == "MoxBox"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}

// ---- fu7e: person page and Related row (merged, deduped, opaque ids only).

/// Person page across servers. A tagKey person (the same key on every server) fans out
/// to every online server; a numeric tag id is only meaningful on its own server.
pub async fn person(p: &Arc<Plex>, id: &str) -> Result<browse::PersonView, String> {
    let (mid, key) = match p.slots.resolve(id) { Some(Target::Person { mid, key }) => (mid, key), _ => return Err("not found".into()) };
    if browse::person_key(&key, "").as_deref() != Some(key.as_str()) && browse::person_key("", &key).as_deref() != Some(key.as_str()) { return Err("not found".into()); }
    let all = ranked(p);
    let mut srv: Vec<Server> = if browse::person_key_global(&key) { all } else { all.into_iter().filter(|s| s.machine_id == mid).collect() };
    // the credit's own server first: its photo/bio wins
    srv.sort_by_key(|s| s.machine_id != mid);
    if srv.is_empty() { return Err("unreachable".into()); }
    let (k1, k2) = (format!("person\0{key}"), format!("pmedia\0{key}"));
    let (d, m) = tokio::join!(gather(p, &k1, Api::Person(key.clone()), &srv), gather(p, &k2, Api::PersonMedia(key.clone()), &srv));
    let (d, m) = (d?, m?);
    if d.ep != m.ep { return Err("stale".into()); }
    let ep = m.ep;
    let img = p.images.fork();
    let mut view = browse::PersonView { pending: d.pending || m.pending, ..Default::default() };
    for (_, s, v) in &d.got {
        if let Some((name, thumb, bio, born, place)) = browse::person_detail(v, &s.machine_id, &img) {
            if view.name.is_empty() { view.name = name; }
            if view.thumb.is_none() { view.thumb = thumb; }
            if view.bio.is_empty() { view.bio = bio; }
            if view.born.is_empty() { view.born = born; }
            if view.birthplace.is_empty() { view.birthplace = place; }
        }
    }
    let mut rows = vec![];
    for (rank, s, v) in &m.got { rows.extend(rows_of(metas(v), *rank, s, &img, p, ep)); }
    view.sources = mg::sources_of(m.got.iter().filter(|(_, _, v)| metas(v).next().is_some()).map(|(_, s, _)| s.name.as_str()));
    view.items = mg::filmography(rows);
    if view.name.is_empty() && view.items.is_empty() { return Err("not found".into()); }
    if p.slots.epoch() != ep || !p.images.commit(img) { return Err("stale".into()); }
    Ok(view)
}

/// Related row for an item: `/related` hubs from this server's copy and every other
/// server's copy of the same plex GUID, merged and deduped, the title itself excluded.
pub async fn related(p: &Arc<Plex>, id: &str) -> Result<Vec<browse::Item>, String> {
    let ep = p.slots.epoch();
    let (mid, rk) = item_target(p, id)?;
    let v = fetch_on(p, &mid, &Api::Metadata(rk)).await?;
    let raw = v.get("Metadata").and_then(|m| m.get(0)).cloned().unwrap_or_default();
    let kind = raw.get("type").and_then(Value::as_str).unwrap_or("");
    if !["movie", "show"].contains(&kind) { return Ok(vec![]); }
    let guid_s = raw.get("guid").and_then(Value::as_str).unwrap_or("");
    let ext: Vec<&str> = raw.get("Guid").and_then(Value::as_array).map(|a| a.iter().take(8).filter_map(|g| g.get("id").and_then(Value::as_str)).collect()).unwrap_or_default();
    let self_keys = mg::dedupe_keys(kind, guid_s, &ext);
    let mut copies: Vec<(usize, Server, u64)> = vec![];
    let all = ranked(p);
    let own = all.iter().position(|s| s.machine_id == mid);
    let own_s = own.map(|i| all[i].clone()).unwrap_or(Server { machine_id: mid.clone(), name: String::new(), owned: true, online: true, conns: vec![] });
    copies.push((own.unwrap_or(0), own_s, rk));
    if let Some(guid) = mg::queryable_guid_of(&raw) {
        let others: Vec<Server> = all.iter().filter(|s| s.machine_id != mid).cloned().collect();
        let type_id = browse::plex_type(kind);
        let g = gather(p, &format!("guid\0{type_id}\0{guid}"), Api::ByGuid { guid: guid.clone(), type_id }, &others).await?;
        for (_, s, mc) in g.got {
            let hit = metas(&mc).take(4).find(|x| browse::guid_matches(x, &guid)).and_then(browse::rating_key_value);
            if let Some(hrk) = hit { let rank = all.iter().position(|x| x.machine_id == s.machine_id).unwrap_or(99); copies.push((rank, s, hrk)); }
        }
    }
    let mut self_ids = vec![];
    for (_, s, r) in &copies { if let Some(i) = p.slots.mint_if(ep, Target::Item { mid: s.machine_id.clone(), rk: *r }) { self_ids.push(i); } }
    let mut set = tokio::task::JoinSet::new();
    for (rank, s, r) in copies.clone() {
        let p2 = p.clone();
        set.spawn(async move { (rank, s.clone(), fetch_on(&p2, &s.machine_id, &Api::Related(r)).await.ok()) });
    }
    let mut got = vec![];
    while let Some(Ok(x)) = set.join_next().await { if let (rank, s, Some(v)) = x { got.push((rank, s, v)); } }
    got.sort_by_key(|(rank, _, _)| *rank);
    let img = p.images.fork();
    let per: Vec<Vec<Row>> = got.iter().map(|(rank, s, v)| raw_hubs(v).into_iter().flat_map(|(_, _, items)| rows_of(items.into_iter(), *rank, s, &img, p, ep)).collect()).collect();
    let out = mg::related(per, &self_ids, &self_keys, 24);
    if p.slots.epoch() != ep || !p.images.commit(img) { return Err("stale".into()); }
    Ok(out)
}
