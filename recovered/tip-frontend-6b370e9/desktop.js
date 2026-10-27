(() => {
  // node_modules/@tauri-apps/api/external/tslib/tslib.es6.js
  function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state == "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  }
  function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state == "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  }

  // node_modules/@tauri-apps/api/core.js
  var _Channel_instances, _Channel_onmessage, _Channel_nextMessageIndex, _Channel_pendingMessages, _Channel_messageEndIndex, _Channel_deliver, _Resource_rid, SERIALIZE_TO_IPC_FN = "__TAURI_TO_IPC_KEY__";
  function transformCallback(callback, once = !1) {
    return window.__TAURI_INTERNALS__.transformCallback(callback, once);
  }
  var Channel = class {
    constructor(onmessage) {
      _Channel_instances.add(this), _Channel_onmessage.set(this, void 0), _Channel_nextMessageIndex.set(this, 0), _Channel_pendingMessages.set(this, []), _Channel_messageEndIndex.set(this, void 0), __classPrivateFieldSet(this, _Channel_onmessage, onmessage || (() => {
      }), "f"), this.id = transformCallback((rawMessage) => {
        let index = rawMessage.index;
        if ("end" in rawMessage) {
          index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") ? this.cleanupCallback() : __classPrivateFieldSet(this, _Channel_messageEndIndex, index, "f");
          return;
        }
        let message = rawMessage.message;
        if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
          for (__classPrivateFieldGet(this, _Channel_instances, "m", _Channel_deliver).call(this, message), __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f"); __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") in __classPrivateFieldGet(this, _Channel_pendingMessages, "f"); ) {
            let message2 = __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
            __classPrivateFieldGet(this, _Channel_instances, "m", _Channel_deliver).call(this, message2), delete __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")], __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
          }
          __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") === __classPrivateFieldGet(this, _Channel_messageEndIndex, "f") && this.cleanupCallback();
        } else
          __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[index] = message;
      });
    }
    cleanupCallback() {
      window.__TAURI_INTERNALS__.unregisterCallback(this.id);
    }
    /**
     * The handler called for every message sent by the Rust side of this channel.
     *
     * Assigning a new handler replaces the previous one; messages that arrived
     * before a handler was set are not replayed, so set it (or pass it to the
     * constructor) before sending the channel to the backend.
     */
    set onmessage(handler) {
      __classPrivateFieldSet(this, _Channel_onmessage, handler, "f");
    }
    get onmessage() {
      return __classPrivateFieldGet(this, _Channel_onmessage, "f");
    }
    [(_Channel_onmessage = /* @__PURE__ */ new WeakMap(), _Channel_nextMessageIndex = /* @__PURE__ */ new WeakMap(), _Channel_pendingMessages = /* @__PURE__ */ new WeakMap(), _Channel_messageEndIndex = /* @__PURE__ */ new WeakMap(), _Channel_instances = /* @__PURE__ */ new WeakSet(), _Channel_deliver = function(message) {
      try {
        __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }, SERIALIZE_TO_IPC_FN)]() {
      return `__CHANNEL__:${this.id}`;
    }
    toJSON() {
      return this[SERIALIZE_TO_IPC_FN]();
    }
  };
  async function invoke(cmd, args = {}, options) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
  }
  var Resource = class {
    get rid() {
      return __classPrivateFieldGet(this, _Resource_rid, "f");
    }
    constructor(rid) {
      _Resource_rid.set(this, void 0), __classPrivateFieldSet(this, _Resource_rid, rid, "f");
    }
    /**
     * Destroys and cleans up this resource from memory.
     * **You should not call any method on this object anymore and should drop any reference to it.**
     *
     * @remarks Uses the `core:resources:allow-close` permission, which is part of
     * the `core:resources:default` permission set enabled by default.
     */
    async close() {
      return invoke("plugin:resources|close", {
        rid: this.rid
      });
    }
    async [(_Resource_rid = /* @__PURE__ */ new WeakMap(), Symbol.asyncDispose)]() {
      await this.close();
    }
  };

  // node_modules/@tauri-apps/api/event.js
  var TauriEvent;
  (function(TauriEvent2) {
    TauriEvent2.WINDOW_RESIZED = "tauri://resize", TauriEvent2.WINDOW_MOVED = "tauri://move", TauriEvent2.WINDOW_CLOSE_REQUESTED = "tauri://close-requested", TauriEvent2.WINDOW_DESTROYED = "tauri://destroyed", TauriEvent2.WINDOW_FOCUS = "tauri://focus", TauriEvent2.WINDOW_BLUR = "tauri://blur", TauriEvent2.WINDOW_SCALE_FACTOR_CHANGED = "tauri://scale-change", TauriEvent2.WINDOW_THEME_CHANGED = "tauri://theme-changed", TauriEvent2.WINDOW_CREATED = "tauri://window-created", TauriEvent2.WINDOW_SUSPENDED = "tauri://suspended", TauriEvent2.WINDOW_RESUMED = "tauri://resumed", TauriEvent2.WEBVIEW_CREATED = "tauri://webview-created", TauriEvent2.DRAG_ENTER = "tauri://drag-enter", TauriEvent2.DRAG_OVER = "tauri://drag-over", TauriEvent2.DRAG_DROP = "tauri://drag-drop", TauriEvent2.DRAG_LEAVE = "tauri://drag-leave";
  })(TauriEvent || (TauriEvent = {}));
  async function _unlisten(event, eventId) {
    window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(event, eventId), await invoke("plugin:event|unlisten", {
      event,
      eventId
    });
  }
  async function listen(event, handler, options) {
    var _a;
    let target = typeof options?.target == "string" ? { kind: "AnyLabel", label: options.target } : (_a = options?.target) !== null && _a !== void 0 ? _a : { kind: "Any" };
    return invoke("plugin:event|listen", {
      event,
      target,
      handler: transformCallback(handler)
    }).then((eventId) => async () => _unlisten(event, eventId));
  }

  // shim/px-icons.js
  var NS = "http://www.w3.org/2000/svg", c = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`, SET = {
    mark: ["M3 8.6Q3 7 4.6 7.2Q12 8.1 19.4 7.2Q21 7 21 8.6v6.8q0 1.6-1.6 1.6H4.6Q3 17 3 15.4z", "", "M16.2 15.2h2.9v-2.9z"],
    home: ["M4 10.8 12 4.5l8 6.3V18.6q0 1.4-1.4 1.4H5.4Q4 20 4 18.6z", "M10 20v-4.6q0-.9.9-.9h2.2q.9 0 .9.9V20"],
    search: [c(10.5, 10.5, 6.25), "M15.2 15.2 20 20"],
    ask: ["M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z", "M18 14.5v5M15.5 17h5"],
    film: ["M5.5 3.5h13q1.5 0 1.5 1.5v14q0 1.5-1.5 1.5h-13Q4 20.5 4 19V5q0-1.5 1.5-1.5zM8 3.5v17M16 3.5v17M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4", "M10.5 9.5h3v5h-3z"],
    tv: ["M4.6 5h14.8Q21 5 21 6.6v9.8q0 1.6-1.6 1.6H4.6Q3 18 3 16.4V6.6Q3 5 4.6 5zM8.5 21h7", "M12 18v3", "M15.6 15.4h3v-3z"],
    music: ["M9 17.5V6.2l10-2.2v11.3" + c(6.75, 17.5, 2.25) + c(16.75, 15.3, 2.25), "M9 9.4l10-2.2"],
    playlist: ["M4 6h12M4 11h12M4 16h7", "M14 17.5h6M17 14.5v6"],
    photo: ["M4.6 5h14.8Q21 5 21 6.6v10.8q0 1.6-1.6 1.6H4.6Q3 19 3 17.4V6.6Q3 5 4.6 5zM3.5 16.5l5-5 4 4 2.5-2.5 5 5", c(15.5, 9, 1.5)],
    folder: ["M3.5 7.2q0-1.7 1.7-1.7h3.9l2 2h7.7q1.7 0 1.7 1.7v8.1q0 1.7-1.7 1.7H5.2q-1.7 0-1.7-1.7z", "M3.5 10h17"],
    gear: [c(12, 12, 6.2) + "M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1", c(12, 12, 2.4)],
    server: ["M5.5 4h13Q20 4 20 5.5v4Q20 11 18.5 11h-13Q4 11 4 9.5v-4Q4 4 5.5 4zM5.5 13h13q1.5 0 1.5 1.5v4q0 1.5-1.5 1.5h-13Q4 20 4 18.5v-4Q4 13 5.5 13zM11 7.5h5.5M11 16.5h5.5", "M7.5 7.5h.01M7.5 16.5h.01"],
    profile: [c(12, 8.8, 3.6) + "M4.8 20q1.4-5 7.2-5t7.2 5"],
    sidebar: ["M5 4h14q2 0 2 2v12q0 2-2 2H5q-2 0-2-2V6q0-2 2-2zM9.5 4v16", "M5.5 8h1.5M5.5 11h1.5"],
    chev: ["M7 10l5 5 5-5"],
    mic: ["M9 6.5a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V20", "M9.5 20.5h5"],
    back: ["M14.5 6 8.5 12l6 6"],
    collapse: ["M5 4h14q2 0 2 2v12q0 2-2 2H5q-2 0-2-2V6q0-2 2-2zM9 4v16", "M16 9l-3 3 3 3"]
  }, PX_ICONS = Object.keys(SET);
  function pxIcon(name, cls) {
    let d = SET[name] || SET.folder, v = document.createElementNS(NS, "svg");
    v.setAttribute("viewBox", "0 0 24 24"), v.setAttribute("aria-hidden", "true"), v.setAttribute("focusable", "false"), v.setAttribute("class", "pxi" + (cls ? " " + cls : "")), v.dataset.icon = name;
    let p = (dd, kind) => {
      if (!dd) return;
      let e = document.createElementNS(NS, "path");
      e.setAttribute("d", dd), e.setAttribute("class", kind), v.appendChild(e);
    };
    return p(d[0], "pxis"), p(d[1], "pxia"), p(d[2], "pxif"), v;
  }

  // shim/px-landing.js
  var MIN = { continue: 1, watchlist: 1, byw: 6, top10: 6, new: 4, genre: 8, collection: 3, gems: 6 }, ORDER = ["continue", "watchlist", "byw", "top10", "new", "genre", "collection", "gems"], PRIO = { continue: 1, watchlist: 2, byw: 3, top10: 4, new: 5, genre: 6, collection: 6, gems: 7 }, rating = (x) => x && (x.audienceRating ?? x.rating) || 0, plays = (x) => x && (x.viewCount || (x.watched ? 1 : 0)) || 0, keyOf = (x) => x ? String(x.id || "") : "", tkey = (x) => x ? (x.title || "").toLowerCase() + "|" + (x.year || "") : "", frac = (x) => x && x.durationMs ? (x.viewOffsetMs || 0) / x.durationMs : 0, shareN = (a, b) => (a || []).filter((v) => (b || []).includes(v)).length;
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++)
      h ^= s.charCodeAt(i), h = Math.imul(h, 16777619);
    return h >>> 0;
  }
  var dayIndex = (now, tzOffsetMin = 0) => Math.floor((now - tzOffsetMin * 60) / 86400);
  function isCold(items) {
    return items.filter((x) => plays(x) > 0).length < 10;
  }
  function plays60(items, now) {
    return items.filter((x) => plays(x) > 0 && x.lastViewedAt && x.lastViewedAt >= now - 60 * 86400);
  }
  function topGenres(items, now, cold) {
    let c2 = /* @__PURE__ */ new Map(), src = cold ? items : plays60(items, now);
    return (src.length ? src : items).forEach((x) => (x.genres || []).forEach((g) => c2.set(g, (c2.get(g) || 0) + 1))), [...c2.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map((e) => e[0]);
  }
  function pickHero(items, watchlist, now, day = dayIndex(now)) {
    let recent = (x) => x.lastViewedAt && x.lastViewedAt >= now - 7776e3, ok = (x) => x && x.art && !x.watched && !recent(x) && !(frac(x) > 0.05), byT = new Map(items.map((x) => [tkey(x), x])), wl = (watchlist || []).filter((x) => !x.kind || x.kind === "movie").map((x) => byT.get(tkey(x)) || x).filter(ok), g = topGenres(items, now, !1)[0], pool = [
      wl,
      g ? items.filter((x) => ok(x) && (x.genres || []).includes(g)).sort((a, b) => rating(b) - rating(a)).slice(0, 30) : [],
      items.filter(ok).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 30)
    ].find((p) => p.length);
    return pool ? pool[hashStr("hero" + day) % pool.length] : null;
  }
  function candidates(items, cw, wl, now, cold) {
    let unw = items.filter((x) => !x.watched && !(frac(x) > 0.05)), out = [], cont = (cw || []).concat(items).filter((x) => frac(x) >= 0.05 && frac(x) <= 0.95);
    out.push({ key: "continue", kind: "continue", title: "Continue Watching", items: cont.slice().sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0)) });
    let byT = new Map(items.map((x) => [tkey(x), x]));
    out.push({
      key: "watchlist",
      kind: "watchlist",
      title: "Watchlist",
      see: "#px/watchlist",
      items: (wl || []).filter((x) => !x.kind || x.kind === "movie").map((x) => byT.get(tkey(x)) || x).filter((x) => !x.watched).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    }), cold || items.filter((x) => x.watched && (x.userRating == null || x.userRating > 6) && x.lastViewedAt).sort((a, b) => b.lastViewedAt - a.lastViewedAt).slice(0, 2).forEach((s, i) => {
      let sc = (x) => shareN(x.genres, s.genres) + 2 * shareN(x.collections, s.collections) + 2 * shareN(x.directors, s.directors) + (shareN((x.cast || []).map((c2) => c2.name), (s.cast || []).map((c2) => c2.name)) >= 2 ? 2 : 0), l = unw.filter((x) => keyOf(x) !== keyOf(s)).map((x) => [x, sc(x)]).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1] || rating(b[0]) - rating(a[0])).map((e) => e[0]);
      out.push({ key: "byw" + i, kind: "byw", title: "Because You Watched " + (s.title || ""), items: l, seed: s });
    });
    let p30 = items.filter((x) => plays(x) > 0 && x.lastViewedAt && x.lastViewedAt >= now - 30 * 86400).sort((a, b) => plays(b) - plays(a) || b.lastViewedAt - a.lastViewedAt).slice(0, 10);
    out.push({ key: "top10", kind: "top10", title: "Top 10 on Your Servers", items: p30, rank: !0 }), out.push({ key: "new", kind: "new", title: "New Arrivals", items: unw.filter((x) => x.addedAt && x.addedAt >= now - 30 * 86400).sort((a, b) => b.addedAt - a.addedAt) }), topGenres(items, now, cold).slice(0, 8).forEach((g) => out.push({
      key: "genre:" + g,
      kind: "genre",
      title: g,
      genre: g,
      items: unw.filter((x) => (x.genres || []).includes(g)).sort((a, b) => rating(b) - rating(a) || (b.addedAt || 0) - (a.addedAt || 0))
    }));
    let cols = /* @__PURE__ */ new Map();
    return items.forEach((x) => (x.collections || []).forEach((c2) => {
      cols.has(c2) || cols.set(c2, []), cols.get(c2).push(x);
    })), [...cols.entries()].filter((e) => e[1].length >= 2).map(([c2, l]) => [c2, l, Math.max(...l.map((x) => Math.max(x.lastViewedAt || 0, x.addedAt || 0)))]).sort((a, b) => b[2] - a[2] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).forEach(([c2, l]) => out.push({ key: "col:" + c2, kind: "collection", title: c2, items: l.slice().sort((a, b) => (a.year || 0) - (b.year || 0)) })), out.push({ key: "gems", kind: "gems", title: "Unwatched Gems", items: unw.filter((x) => rating(x) >= 7.5 && x.addedAt && x.addedAt < now - 90 * 86400).sort((a, b) => rating(b) - rating(a)) }), out;
  }
  function rowScore(r, p60, now) {
    let g = /* @__PURE__ */ new Map();
    r.items.forEach((x) => (x.genres || []).forEach((v) => g.set(v, (g.get(v) || 0) + 1)));
    let sig = r.kind === "genre" ? [r.genre] : [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]), m = p60.filter((x) => (x.genres || []).some((v) => sig.includes(v)) || r.kind === "collection" && (x.collections || []).includes(r.title)).length, fresh = r.items.length ? r.items.filter((x) => x.addedAt && x.addedAt >= now - 30 * 86400).length / r.items.length : 0;
    return m + fresh * 2;
  }
  function buildLanding({ items = [], continueWatching = [], watchlist = [], now = Math.floor(Date.now() / 1e3), day } = {}) {
    items = items.filter((x) => x && x.kind === "movie");
    let cw = (continueWatching || []).filter((x) => x && x.kind === "movie"), cold = isCold(items), hero = pickHero(items, watchlist, now, day ?? dayIndex(now)), used = /* @__PURE__ */ new Set(), usedT = /* @__PURE__ */ new Set(), take = (x) => {
      used.add(keyOf(x)), usedT.add(tkey(x));
    };
    hero && take(hero);
    let byPrio = candidates(items, cw, watchlist, now, cold).map((r, i) => [r, i]).sort((a, b) => PRIO[a[0].kind] - PRIO[b[0].kind] || a[1] - b[1]).map((e) => e[0]), kept = [];
    for (let r of byPrio) {
      let seen2 = /* @__PURE__ */ new Set(), l = [];
      for (let x of r.items) {
        let k = keyOf(x), t = tkey(x);
        if (!(used.has(k) || usedT.has(t) || seen2.has(k)) && (seen2.add(k), l.push(x), l.length >= 20))
          break;
      }
      l.length < MIN[r.kind] || (l.forEach(take), kept.push(Object.assign({}, r, { items: l, count: r.items.length })));
    }
    let pinned = ["continue", "watchlist"].map((k) => kept.find((r) => r.key === k)).filter(Boolean), rest = kept.filter((r) => !pinned.includes(r)), genres = rest.filter((r) => r.kind === "genre").slice(0, 4);
    rest = rest.filter((r) => r.kind !== "genre" || genres.includes(r));
    let personal = pinned.length + rest.filter((r) => r.kind !== "genre").length;
    for (; personal > 8; ) {
      let i = rest.findIndex((r) => r.kind === "gems"), j = i >= 0 ? i : rest.map((r) => r.kind !== "genre").lastIndexOf(!0);
      rest.splice(j, 1), personal--;
    }
    let fixed = (r) => ORDER.indexOf(r.kind) * 100 + kept.indexOf(r);
    if (cold) rest.sort((a, b) => fixed(a) - fixed(b));
    else {
      let p60 = plays60(items, now), s = new Map(rest.map((r) => [r, rowScore(r, p60, now)]));
      rest.sort((a, b) => s.get(b) - s.get(a) || fixed(a) - fixed(b));
    }
    return { hero, rows: [...pinned, ...rest], cold, at: now };
  }
  function stableLanding(cached, fresh, now) {
    if (!cached || !cached.at || now - cached.at >= 21600 || now < cached.at) return fresh;
    let byId = /* @__PURE__ */ new Map();
    return [fresh.hero, ...fresh.rows.flatMap((r) => r.items)].forEach((x) => x && byId.set(keyOf(x), x)), cached.rows.forEach((r) => r.items.forEach((x) => {
      byId.has(keyOf(x)) || byId.set(keyOf(x), x);
    })), cached.hero && byId.set(keyOf(cached.hero), cached.hero), { hero: cached.hero, cold: cached.cold, at: cached.at, rows: cached.rows.map((r) => Object.assign({}, r, { items: r.items.map((x) => byId.get(keyOf(x)) || x) })) };
  }
  var TV_MIN = { nextup: 1, watchlist: 1, newep: 2, byw: 6, top10: 6, new: 4, genre: 8, collection: 3, finish: 4 }, TV_ORDER = ["nextup", "watchlist", "newep", "byw", "top10", "new", "genre", "collection", "finish"], TV_PRIO = { nextup: 1, watchlist: 2, newep: 3, byw: 4, top10: 5, new: 6, genre: 7, collection: 7, finish: 8 }, showOf = (x) => x ? String((x.kind === "episode" || x.kind === "season") && (x.grandparentId || x.parentId) || x.id) : "", leaf = (s) => s.leafCount || 0, seen = (s) => s.viewedLeafCount || 0, inProgress = (s) => seen(s) > 0 && seen(s) < leaf(s);
  function newEpisodeCounts(episodes, now) {
    let m = /* @__PURE__ */ new Map();
    return (episodes || []).forEach((e) => {
      if (!e || e.kind !== "episode" || e.watched || !e.addedAt || e.addedAt < now - 14 * 86400) return;
      let k = showOf(e);
      m.set(k, (m.get(k) || 0) + 1);
    }), m;
  }
  function pickTvHero(shows, watchlist, newN, now, day = dayIndex(now)) {
    let ok = (s) => s && s.art, byT = new Map(shows.map((x) => [tkey(x), x])), byId = new Map(shows.map((x) => [keyOf(x), x])), wl = (watchlist || []).filter((x) => x.kind === "show").map((x) => byId.get(keyOf(x)) || byT.get(tkey(x)) || x).filter((s) => ok(s) && newN.get(keyOf(s))), prog = shows.filter((s) => ok(s) && inProgress(s) && newN.get(keyOf(s))).sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0)), fresh = shows.filter((s) => ok(s) && seen(s) === 0).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 30), pool = [wl, prog, fresh].find((p) => p.length);
    if (!pool) return null;
    let h = pool === fresh ? pool[hashStr("tvhero" + day) % pool.length] : pool[0];
    return Object.assign({}, h, { heroCta: seen(h) > 0 ? "Play Next Episode" : "Play S1E1", heroNew: newN.get(keyOf(h)) || 0 });
  }
  function tvCandidates(shows, onDeck, wl, newN, now, cold) {
    let out = [], byT = new Map(shows.map((x) => [tkey(x), x])), byId = new Map(shows.map((x) => [keyOf(x), x])), recentShow = (id) => {
      let s = byId.get(id);
      return !s || !s.lastViewedAt || s.lastViewedAt >= now - 60 * 86400;
    }, nu = (onDeck || []).filter((e) => e && e.kind === "episode" && recentShow(showOf(e))).map((e) => Object.assign({}, e, { isNew: !!(e.addedAt && e.addedAt >= now - 14 * 86400) })).sort((a, b) => b.isNew - a.isNew || (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
    out.push({ key: "nextup", kind: "nextup", title: "Next Up", items: nu, wide: !0 }), out.push({
      key: "watchlist",
      kind: "watchlist",
      title: "Watchlist",
      see: "#px/watchlist",
      items: (wl || []).filter((x) => x.kind === "show").map((x) => byId.get(keyOf(x)) || byT.get(tkey(x)) || x).sort((a, b) => ((newN.get(keyOf(b)) || 0) > 0) - ((newN.get(keyOf(a)) || 0) > 0) || (b.addedAt || 0) - (a.addedAt || 0))
    }), out.push({
      key: "newep",
      kind: "newep",
      title: "New Episodes",
      items: shows.filter((s) => seen(s) > 0 && newN.get(keyOf(s))).map((s) => Object.assign({}, s, { label: newN.get(keyOf(s)) + (newN.get(keyOf(s)) === 1 ? " new episode" : " new episodes") })).sort((a, b) => newN.get(keyOf(b)) - newN.get(keyOf(a)))
    });
    let unstarted = shows.filter((s) => seen(s) === 0);
    cold || shows.filter((s) => seen(s) >= 3 && s.lastViewedAt).sort((a, b) => b.lastViewedAt - a.lastViewedAt).slice(0, 2).forEach((s, i) => {
      let sc = (x) => shareN(x.genres, s.genres) + 2 * shareN(x.collections, s.collections) + (shareN((x.cast || []).map((c2) => c2.name), (s.cast || []).map((c2) => c2.name)) >= 2 ? 2 : 0);
      out.push({
        key: "byw" + i,
        kind: "byw",
        title: "Because You Watched " + (s.title || ""),
        seed: s,
        items: unstarted.map((x) => [x, sc(x)]).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1] || rating(b[0]) - rating(a[0])).map((e) => e[0])
      });
    }), out.push({
      key: "top10",
      kind: "top10",
      title: "Top 10 on Your Servers",
      rank: !0,
      items: shows.filter((s) => plays(s) > 0 && s.lastViewedAt && s.lastViewedAt >= now - 30 * 86400).sort((a, b) => plays(b) - plays(a) || b.lastViewedAt - a.lastViewedAt).slice(0, 10)
    }), out.push({ key: "new", kind: "new", title: "New Arrivals", items: shows.filter((s) => s.addedAt && s.addedAt >= now - 30 * 86400).sort((a, b) => b.addedAt - a.addedAt) }), topGenres(shows, now, cold).slice(0, 8).forEach((g) => out.push({
      key: "genre:" + g,
      kind: "genre",
      title: g,
      genre: g,
      items: unstarted.filter((x) => (x.genres || []).includes(g)).sort((a, b) => rating(b) - rating(a) || (b.addedAt || 0) - (a.addedAt || 0))
    }));
    let cols = /* @__PURE__ */ new Map();
    return shows.forEach((x) => (x.collections || []).forEach((c2) => {
      cols.has(c2) || cols.set(c2, []), cols.get(c2).push(x);
    })), [...cols.entries()].filter((e) => e[1].length >= 2).sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1)).slice(0, 3).forEach(([c2, l]) => out.push({ key: "col:" + c2, kind: "collection", title: c2, items: l })), out.push({
      key: "finish",
      kind: "finish",
      title: "Finish What You Started",
      items: shows.filter((s) => inProgress(s) && s.lastViewedAt && s.lastViewedAt < now - 60 * 86400).sort((a, b) => seen(b) / leaf(b) - seen(a) / leaf(a))
    }), out;
  }
  function buildTvLanding({ shows = [], onDeck = [], episodes = [], watchlist = [], now = Math.floor(Date.now() / 1e3), day } = {}) {
    shows = shows.filter((x) => x && x.kind === "show");
    let cold = isCold(shows), newN = newEpisodeCounts(episodes, now), hero = pickTvHero(shows, watchlist, newN, now, day ?? dayIndex(now)), used = /* @__PURE__ */ new Set();
    hero && used.add(keyOf(hero));
    let byPrio = tvCandidates(shows, onDeck, watchlist, newN, now, cold).map((r, i) => [r, i]).sort((a, b) => TV_PRIO[a[0].kind] - TV_PRIO[b[0].kind] || a[1] - b[1]).map((e) => e[0]), kept = [];
    for (let r of byPrio) {
      let seenR = /* @__PURE__ */ new Set(), l = [];
      for (let x of r.items) {
        let k = showOf(x);
        if (!(used.has(k) || seenR.has(k)) && (seenR.add(k), l.push(x), l.length >= 20))
          break;
      }
      l.length < TV_MIN[r.kind] || (l.forEach((x) => used.add(showOf(x))), kept.push(Object.assign({}, r, { items: l, count: r.items.length })));
    }
    let pinned = ["nextup", "watchlist"].map((k) => kept.find((r) => r.key === k)).filter(Boolean), rest = kept.filter((r) => !pinned.includes(r)), genres = rest.filter((r) => r.kind === "genre").slice(0, 4);
    rest = rest.filter((r) => r.kind !== "genre" || genres.includes(r));
    let personal = pinned.length + rest.filter((r) => r.kind !== "genre").length;
    for (; personal > 8; ) {
      let i = rest.findIndex((r) => r.kind === "finish"), j = i >= 0 ? i : rest.map((r) => r.kind !== "genre").lastIndexOf(!0);
      rest.splice(j, 1), personal--;
    }
    let fixed = (r) => TV_ORDER.indexOf(r.kind) * 100 + kept.indexOf(r);
    if (cold) rest.sort((a, b) => fixed(a) - fixed(b));
    else {
      let p60 = plays60(shows, now), s = new Map(rest.map((r) => [r, rowScore(r, p60, now)]));
      rest.sort((a, b) => s.get(b) - s.get(a) || fixed(a) - fixed(b));
    }
    return { hero, rows: [...pinned, ...rest], cold, at: now, kind: "tv" };
  }

  // shim/px-media.js
  function themeKey(it) {
    return it ? it.kind === "episode" ? "show:" + (it.grandparentId || it.id) : it.kind === "season" ? "show:" + (it.parentId || it.id) : it.kind === "show" ? "show:" + it.id : "item:" + it.id : "";
  }
  var THEME = { startDelay: 600, fadeIn: 1500, fadeOut: 800 };
  function makeThemePlayer(env) {
    let a = null, key = "", target = 0.3, muted = !1, enabled = !0, startT = 0, fadeT = 0, done = /* @__PURE__ */ new Set(), st = env.setTimeout || setTimeout, ct = env.clearTimeout || clearTimeout, now = env.now || (() => Date.now());
    function ramp(from, to, ms, end) {
      ct(fadeT);
      let t0 = now(), step = () => {
        if (!a) return;
        let k = Math.min(1, (now() - t0) / ms);
        a.volume = Math.max(0, Math.min(1, from + (to - from) * k)), k < 1 ? fadeT = st(step, 40) : end && end();
      };
      step();
    }
    let api = {
      get key() {
        return key;
      },
      get playing() {
        return !!a && !a.paused;
      },
      get muted() {
        return muted;
      },
      configure(p) {
        p && (typeof p.themeMusic == "boolean" && (enabled = p.themeMusic, enabled || api.stop()), typeof p.themeVolume == "number" && (target = Math.max(0, Math.min(1, p.themeVolume / 100)), a && !muted && (a.volume = target)));
      },
      /** Called once a detail page has settled. Same show → keeps playing. */
      enter(it) {
        let k = themeKey(it);
        if (k && k === key) return "kept";
        if (api.stop(), !enabled || !it || !it.theme) return "none";
        if (done.has(k)) return "played";
        if (env.otherPlaying && env.otherPlaying()) return "busy";
        key = k;
        let src = env.url(it.theme);
        return src ? (startT = st(() => {
          if (key !== k) return;
          a = env.makeAudio(), a.loop = !1, a.preload = "auto", a.volume = 0, a.src = src, a.onended = () => {
            done.add(k), api.stop(!0);
          };
          let p = a.play && a.play();
          p && p.catch && p.catch(() => {
            env.onBlocked && env.onBlocked();
          }), ramp(0, muted ? 0 : target, THEME.fadeIn);
        }, THEME.startDelay), "scheduled") : (key = "", "none");
      },
      /** Leaving the page, Play, trailer, minimize/blur, or end of track. */
      stop(ended) {
        ct(startT);
        let cur = a, k = key;
        if (key = "", a = null, !cur) return;
        if (ended) {
          try {
            cur.pause();
          } catch {
          }
          return;
        }
        let v0 = cur.volume, t0 = now(), step = () => {
          let q = Math.min(1, (now() - t0) / THEME.fadeOut);
          if (cur.volume = Math.max(0, v0 * (1 - q)), q < 1) st(step, 40);
          else
            try {
              cur.pause(), cur.removeAttribute && cur.removeAttribute("src");
            } catch {
            }
        };
        step();
      },
      setMuted(m) {
        muted = !!m, a && ramp(a.volume, muted ? 0 : target, 200);
      },
      resume() {
        if (a && a.paused && a.play) {
          let p = a.play();
          p && p.catch && p.catch(() => {
          });
        }
      }
    };
    return api;
  }
  function makePrefetch(env) {
    let conc = Math.max(2, Math.min(4, env.concurrency || 3)), cap = env.cap || 120, st = env.setTimeout || setTimeout, now = env.now || (() => Date.now()), q = [], seen2 = /* @__PURE__ */ new Set(), active = 0, started = 0, pausedUntil = 0, on = !1, gen = 0;
    function pump() {
      if (!on) return;
      let w = pausedUntil - now();
      if (w > 0) {
        st(pump, w);
        return;
      }
      for (; active < conc && q.length && started < cap; ) {
        let u = q.shift();
        active++, started++;
        let g = gen;
        Promise.resolve().then(() => env.load(u)).catch(() => {
        }).then(() => {
          g === gen && (active--, pump());
        });
      }
    }
    return {
      add(urls) {
        for (let u of urls) u && !seen2.has(u) && (seen2.add(u), q.push(u));
        pump();
      },
      start() {
        on = !0, pump();
      },
      pause(ms = 800) {
        pausedUntil = Math.max(pausedUntil, now() + ms);
      },
      reset() {
        gen++, q = [], seen2 = /* @__PURE__ */ new Set(), active = 0, started = 0, on = !1;
      },
      get stats() {
        return { queued: q.length, active, started, cap, conc };
      }
    };
  }

  // shim/plex-browse.js
  var WIN = /Windows/.test(navigator.userAgent), ORIGIN = WIN ? "http://plexuw.localhost" : "plexuw://localhost", HEX = /^[0-9a-f]{32}$/, ID = /^[0-9a-f]{24}$/;
  function themeUrl(id) {
    return id && HEX.test(id) ? `${ORIGIN}/theme/${id}` : null;
  }
  var LAND_MAX = 3e3;
  function img(id, w, h) {
    if (!id || !HEX.test(id)) return null;
    let d = Math.min(3, window.devicePixelRatio || 1), q = (n) => Math.max(16, Math.min(4096, Math.ceil(n * d / 40) * 40));
    return `${ORIGIN}/img/${id}/${q(w)}x${q(h)}`;
  }
  function missingLibraryText(loadErr, why) {
    return loadErr === void 0 ? "That library isn\u2019t on this server." : "Couldn\u2019t load your libraries. " + (why ? why(loadErr) : "Something went wrong. Try again.");
  }
  var LOADWHAT = { home: "Home", item: "this title", sec: "this library", search: "search results", person: "this person" };
  function loadErrorText(kind, err, why) {
    return "Couldn\u2019t load " + (LOADWHAT[kind] || "this page") + ". " + (why ? why(err) : "Something went wrong. Try again.");
  }
  function appendGrid({ grid, total, pageSize = 100, chunk = 24, fetchPage, tile, placeholder, onError }) {
    let tiles = [], pages = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Set(), g = {
      tiles,
      pages,
      get total() {
        return total;
      },
      // grow to at least n slots (placeholders) without touching existing nodes
      ensure(n) {
        for (n = Math.min(total, n); tiles.length < n; ) {
          let ph = placeholder(tiles.length);
          tiles.push(ph), grid.appendChild(ph);
        }
      },
      // fetch every page overlapping [a, b) once
      want(a, b) {
        for (let p = Math.floor(Math.max(0, a) / pageSize); p * pageSize < Math.min(total, b); p++) g.load(p).catch((e) => onError && onError(e));
      },
      load(p) {
        return pages.has(p) || pending.has(p) ? Promise.resolve() : (pending.add(p), Promise.resolve(fetchPage(p * pageSize)).then((items) => {
          pending.delete(p), items && (pages.set(p, items), g.fill(p));
        }, (e) => {
          throw pending.delete(p), e;
        }));
      },
      // fu7i SHOULD-4: progressive fill. The first `chunk` tiles swap in at once (first viewport);
      // the rest follow in chunks of `chunk` per animation frame, so posters appear row by row,
      // not all at once. Synchronous when rAF is unavailable (node tests).
      fill(p) {
        let items = pages.get(p) || [], raf = typeof requestAnimationFrame == "function" ? requestAnimationFrame : null, put = (a, b) => {
          for (let k = a; k < b; k++) {
            let i = p * pageSize + k, old = tiles[i];
            if (!old || !old.isPlaceholder) continue;
            let t = tile(items[k], i);
            old.replaceWith(t), tiles[i] = t;
          }
        }, step = (a) => {
          let b = Math.min(items.length, a + chunk);
          put(a, b), b < items.length && (raf ? raf(() => step(b)) : step(b));
        };
        step(0);
      }
    };
    return g;
  }
  var MUSIC = /* @__PURE__ */ new Set(["artist", "album", "track"]);
  function coverArt(it) {
    if (!it) return null;
    let k = it.kind, pick = (...c2) => c2.find((x) => typeof x == "string" && x) || null, id = k === "episode" ? pick(it.grandparentThumb, it.parentThumb) : k === "track" ? pick(it.parentThumb, it.grandparentThumb, it.thumb) : pick(it.thumb);
    return id ? { id, square: MUSIC.has(k) } : null;
  }
  function backArt(it) {
    if (!it) return null;
    let pick = (...c2) => c2.find((x) => typeof x == "string" && x) || null;
    return it.kind === "episode" ? pick(it.grandparentArt, it.art, it.thumb) : it.kind === "track" ? pick(it.art, it.grandparentArt, it.parentThumb, it.thumb) : pick(it.art, it.thumb);
  }
  function playlistArt(title) {
    let h = 2166136261;
    for (let ch of String(title || ""))
      h ^= ch.codePointAt(0), h = Math.imul(h, 16777619) >>> 0;
    let a = h % 360, b = (a + 40 + (h >>> 9) % 80) % 360;
    return { hue: a, bg: `linear-gradient(135deg,hsl(${a} 55% 34%),hsl(${b} 60% 18%))` };
  }
  function tileArt(it) {
    if (!it) return null;
    let pick = (...c2) => c2.find((x) => typeof x == "string" && x) || null;
    return it.kind === "episode" ? pick(it.grandparentThumb, it.parentThumb, it.thumb) : it.kind === "track" ? pick(it.parentThumb, it.thumb) : pick(it.thumb, it.art);
  }
  var PREFETCH_MARGIN = "150% 150%", LOWRES = [24, 36];
  function detailArt(it) {
    if (!it) return { poster: null, still: null };
    let s = (x) => typeof x == "string" && x ? x : null;
    return it.kind === "episode" ? { poster: s(it.grandparentThumb) || s(it.parentThumb), still: s(it.thumb) } : { poster: s(it.thumb), still: null };
  }
  function upNextMode(it) {
    let k = it && it.kind;
    return k === "episode" || k === "show" ? { mode: "episodes", button: "Episode", aria: "Episode: upcoming episodes", heading: "Upcoming episodes" } : k === "movie" ? { mode: "watchlist", button: "Watchlist", aria: "Watchlist", heading: "Up Next", buttonOnly: !0 } : k === "season" ? { mode: "season", button: "Chapters & Up Next", aria: "Chapters & Up Next", heading: "Up Next" } : { mode: "inprogress", button: "Chapters & Up Next", aria: "Chapters & Up Next", heading: "Up Next" };
  }
  function hasNewEp(it) {
    return !!it && it.kind === "show" && (it.leafCount || 0) > (it.viewedLeafCount || 0) && (it.viewedLeafCount || 0) > 0;
  }
  function watchlistView(list, filter = "all", sort = "added") {
    let f = (list || []).filter((x) => filter === "movies" ? x.kind === "movie" : filter === "tv" ? x.kind === "show" : !0), rel = (x) => String(x.released || x.year || ""), cmp = sort === "title" ? (a, b) => String(a.title).localeCompare(String(b.title), void 0, { sensitivity: "base" }) : sort === "release" ? (a, b) => rel(b).localeCompare(rel(a)) || String(a.title).localeCompare(String(b.title)) : (a, b) => (b.addedAt || 0) - (a.addedAt || 0);
    return f.slice().sort(cmp);
  }
  function initTint(name) {
    let h = 0;
    for (let c2 of String(name || "")) h = h * 31 + c2.codePointAt(0) >>> 0;
    return `hsl(${h % 360} 32% 30%)`;
  }
  function wlBadgeCount(list) {
    return (list || []).filter(hasNewEp).length;
  }
  function watchlistHome(list) {
    return (list || []).slice().sort((a, b) => hasNewEp(b) - hasNewEp(a) || (b.addedAt || 0) - (a.addedAt || 0));
  }
  function watchlistBtnState(store, it) {
    if (!store) return { label: "Watchlist \xB7 coming soon", on: !1, disabled: !0, aria: "Watchlist is coming soon" };
    let on = store.has(it);
    return { label: on ? "On Watchlist \u2713" : "Add to Watchlist", on, disabled: !1, aria: on ? "On Watchlist. Click to remove" : "Add to Watchlist" };
  }
  function availChoice(store, it) {
    let names = Array.isArray(it && it.available) ? it.available.filter((x) => typeof x == "string" && x) : [], key = it && typeof it.availKey == "string" && /^[0-9a-f]{24}$/.test(it.availKey) ? "pxAvail:" + it.availKey : null, v = null;
    try {
      v = key && store ? store.getItem(key) : null;
    } catch {
    }
    return { names, key, selected: names.includes(v) ? v : names[0] || null, selectable: names.length >= 2 && !!key };
  }
  function clearAvail(store) {
    if (!store) return 0;
    let ks = [];
    try {
      for (let i = 0; i < store.length; i++) {
        let k = store.key(i);
        k && k.startsWith("pxAvail:") && ks.push(k);
      }
      ks.forEach((k) => store.removeItem(k));
    } catch {
    }
    return ks.length;
  }
  function splitFilmography(items) {
    let g = { movies: [], tv: [], other: [] };
    return (items || []).forEach((x) => {
      x && (x.kind === "movie" ? g.movies : ["show", "season", "episode"].includes(x.kind) ? g.tv : g.other).push(x);
    }), g;
  }
  function buildPersonBioBlock(doc, bio) {
    let wrap = doc.createElement("div");
    wrap.className = "pxbiowrap";
    let b = doc.createElement("p");
    b.className = "pxsum pxbio clamp", b.textContent = String(bio ?? ""), wrap.appendChild(b);
    let m = doc.createElement("button");
    return m.className = "pxlink pxbiomore", m.type = "button", m.textContent = "More", m.onclick = () => {
      let c2 = b.classList.toggle("clamp");
      m.textContent = c2 ? "More" : "Less";
    }, wrap.appendChild(m), wrap;
  }
  function personBio(pv) {
    let born = pv && /^\d{4}-\d{2}-\d{2}$/.test(pv.born || "") ? (/* @__PURE__ */ new Date(pv.born + "T12:00:00")).toLocaleDateString(void 0, { year: "numeric", month: "long", day: "numeric" }) : "", facts = [born ? "Born " + born : "", pv && pv.birthplace || ""].filter(Boolean).join(" \xB7 "), raw = pv && (typeof pv.bio == "string" && pv.bio || typeof pv.summary == "string" && pv.summary || typeof pv.tagline == "string" && pv.tagline || typeof pv.about == "string" && pv.about) || "", bio = String(raw).trim();
    return { facts, bio, empty: !bio, emptyText: "No biography available." };
  }
  function modalController({ doc, keyTarget, overlay, dialog, closeBtn, scroller, focusables, setHash, onClose, closeMs = 0 }) {
    let open = !1, trigger = null, saved = 0, ct = 0, cms = () => typeof closeMs == "function" ? closeMs() : closeMs, m = {
      get isOpen() {
        return open;
      },
      open(t) {
        open || (trigger = t || doc.activeElement || null, saved = scroller.scrollTop), clearTimeout(ct), overlay.classList && overlay.classList.remove("pxout"), open = !0, overlay.hidden = !1, doc.body.classList.add("pxmodal"), scroller.classList.add("pxlock"), scroller.scrollTop = saved, closeBtn.focus({ preventScroll: !0 });
      },
      close(restore = !0) {
        if (!open) return;
        open = !1;
        let d = cms();
        d > 0 && overlay.classList ? (overlay.classList.add("pxout"), clearTimeout(ct), ct = setTimeout(() => {
          open || (overlay.hidden = !0, overlay.classList.remove("pxout"));
        }, d)) : overlay.hidden = !0, doc.body.classList.remove("pxmodal"), scroller.classList.remove("pxlock"), scroller.scrollTop = saved;
        let t = trigger;
        trigger = null, onClose && onClose(), restore && t && t.focus && t.focus({ preventScroll: !0 });
      },
      navigate(href) {
        m.close(!1), setHash(href);
      }
    };
    return overlay.addEventListener("mousedown", (e) => {
      e.target === overlay && (e.preventDefault(), m.close());
    }), closeBtn.addEventListener("click", () => m.close()), dialog.addEventListener("click", (e) => {
      let a = e.target && e.target.closest && e.target.closest('a[href^="#px/"]');
      a && (e.preventDefault(), m.navigate(a.getAttribute("href")));
    }), keyTarget.addEventListener("keydown", (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault(), e.stopImmediatePropagation && e.stopImmediatePropagation(), m.close();
        return;
      }
      if (e.key !== "Tab") return;
      let f = focusables(), a = doc.activeElement, i = f.indexOf(a);
      if (!f.length) {
        e.preventDefault();
        return;
      }
      (e.shiftKey ? i <= 0 : i === -1 || i === f.length - 1) && (e.preventDefault(), f[e.shiftKey ? f.length - 1 : 0].focus());
    }, !0), m;
  }
  function scrollMemory({ scroller, hist, max = 60 }) {
    let mem = /* @__PURE__ */ new Map(), cur = null, curI = -1, topI = -1, seq = Date.now() % 1e9;
    return {
      get index() {
        return curI;
      },
      get key() {
        return cur;
      },
      // fu7g: Forward only when there is forward history (a new page truncates it, like the browser).
      get canForward() {
        return curI < topI;
      },
      save() {
        cur != null && mem.set(cur, scroller.scrollTop);
      },
      // Call at the start of each route. Returns the saved scroll for this entry (Back/Forward) or null (new entry).
      enter() {
        let st = hist.state;
        for ((!st || typeof st.pxk != "number") && (st = Object.assign({}, st || {}, { pxk: ++seq, pxi: curI + 1 }), hist.replaceState(st, ""), topI = st.pxi), cur = st.pxk, curI = typeof st.pxi == "number" ? st.pxi : 0, curI > topI && (topI = curI); mem.size > max; ) mem.delete(mem.keys().next().value);
        return mem.has(cur) ? mem.get(cur) : null;
      }
    };
  }
  function pageCache(max = 6) {
    let m = /* @__PURE__ */ new Map();
    return {
      get size() {
        return m.size;
      },
      has(k, hash) {
        let e = m.get(k);
        return !!e && (hash == null || e.hash === hash);
      },
      put(k, e) {
        if (!(k == null || !e))
          for (m.delete(k), m.set(k, e); m.size > max; ) m.delete(m.keys().next().value);
      },
      take(k) {
        let e = m.get(k);
        return m.delete(k), e || null;
      },
      clear() {
        m.clear();
      }
    };
  }
  function searchSnapshot(state, snap) {
    let q = snap && typeof snap.q == "string" ? snap.q.slice(0, 200) : "", out = Object.assign({}, state || {});
    return delete out.pxs, q.trim() && (out.pxs = { q, t: String(snap.t || "all"), sel: Math.max(0, snap.sel | 0), sc: Math.max(0, Math.round(+snap.sc || 0)) }), out;
  }
  function searchToRestore(state, back) {
    let p = state && state.pxs;
    return back != null && p && typeof p.q == "string" && p.q.trim() ? p : null;
  }
  function navInput(e) {
    return e ? e.type === "keydown" ? !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey ? null : e.key === "ArrowLeft" ? "back" : e.key === "ArrowRight" ? "fwd" : null : e.type === "mouseup" || e.type === "mousedown" || e.type === "auxclick" ? e.button === 3 ? "back" : e.button === 4 ? "fwd" : null : null : null;
  }
  function pageSwap({ doc, scroller, view, host, fadeMs = 120, onRetire = null }) {
    let ghost = null, t = 0, drop = (g) => {
      if (g && (g.parentNode && g.parentNode.removeChild(g), onRetire && g.pxInfo)) {
        let inner = g.querySelector(".pxghosti"), nodes = [...g.childNodes].filter((n) => n !== inner).concat(inner ? [...inner.childNodes] : []);
        g.pxInfo = null, onRetire(info0(g), nodes);
      }
    }, info0 = (g) => g.pxInfoKeep;
    return {
      get active() {
        return !!ghost;
      },
      begin(info) {
        if (ghost) {
          view.textContent = "";
          return;
        }
        if (!view.firstChild || view.hidden) return;
        let r = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0, left: 0, width: 0, height: 0 }, g = doc.createElement("div");
        g.className = "pxghost", g.setAttribute("aria-hidden", "true"), Object.assign(g.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
        let vr = view.getBoundingClientRect ? view.getBoundingClientRect() : { top: r.top - scroller.scrollTop, left: r.left, width: r.width }, gt = Math.max(r.top, vr.top + scroller.scrollTop);
        g.style.top = gt + "px", g.style.height = Math.max(0, r.top + r.height - gt) + "px";
        let inner = doc.createElement("div");
        inner.className = "pxghosti", inner.style.transform = "translateY(" + (vr.top - gt) + "px)", inner.style.marginLeft = vr.left - r.left + "px", vr.width && (inner.style.width = vr.width + "px");
        let cs = doc.defaultView && doc.defaultView.getComputedStyle ? doc.defaultView.getComputedStyle(view) : null;
        for (cs && (inner.style.padding = cs.padding); view.firstChild; ) {
          let c2 = view.firstChild;
          if (c2.classList && c2.classList.contains("pxbackdrop")) {
            view.removeChild(c2);
            continue;
          }
          inner.appendChild(c2);
        }
        g.appendChild(inner), (host || doc.body).appendChild(g), ghost = g, info && (g.pxInfo = !0, g.pxInfoKeep = info), clearTimeout(t), t = setTimeout(() => this.end(), 8e3);
      },
      // fu7m: hide ghost as soon as the new route has painted something (skeleton or content).
      end() {
        clearTimeout(t);
        let g = ghost;
        ghost = null, g && (g.classList.add("out"), setTimeout(() => drop(g), fadeMs + 40));
      }
    };
  }
  function mountPlexBrowse(invoke2, hooks = {}) {
    let WL = hooks && hooks.watchlist || null, el = (t, c2, txt) => {
      let e = document.createElement(t);
      return c2 && (e.className = c2), txt != null && (e.textContent = String(txt)), e;
    }, NS2 = "http://www.w3.org/2000/svg", icon = (n) => {
      let v = document.createElementNS(NS2, "svg");
      v.setAttribute("class", "ic");
      let u = document.createElementNS(NS2, "use");
      return u.setAttribute("href", "assets/icons.svg#" + n), v.appendChild(u), v;
    }, main = document.getElementById("main");
    if (!main) return null;
    let view = el("div", "pxv");
    view.id = "pxView", view.hidden = !0;
    let top = main.querySelector(".topbar");
    top ? top.after(view) : main.prepend(view);
    let pmo = el("div", "pxpm");
    pmo.hidden = !0;
    let pmd = el("div", "pxpmd");
    pmd.setAttribute("role", "dialog"), pmd.setAttribute("aria-modal", "true"), pmd.setAttribute("aria-labelledby", "pxpmTitle"), pmd.tabIndex = -1, pmo.appendChild(pmd);
    let pmx = el("button", "pxpmx", "\u2715");
    pmx.type = "button", pmx.setAttribute("aria-label", "Close"), pmd.appendChild(pmx);
    let pmb = el("div", "pxpmb");
    pmd.appendChild(pmb), document.body.appendChild(pmo);
    let pmGen = 0, pm = modalController({
      doc: document,
      keyTarget: window,
      overlay: pmo,
      dialog: pmd,
      closeBtn: pmx,
      scroller: main,
      focusables: () => [...pmd.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null || x === pmx),
      setHash: (h) => {
        location.hash = h;
      },
      onClose: () => {
        pmGen++;
      },
      closeMs: () => matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160
    }), nav = el("nav", "pxnav");
    nav.id = "pxNav", nav.hidden = !0;
    let side = document.getElementById("nav");
    side && side.before(nav), WL && WL.subscribe(() => renderNav());
    let on = !1, sections = [], gen = 0, genMax = 0, doneG = -1, curHash = "", server = "", srvN = 0, onScroll = null, srcGen = 0, pc = pageCache(6), sm = scrollMemory({ scroller: main, hist: history }), swap = pageSwap({ doc: document, scroller: main, view, host: main, onRetire: (inf, nodes) => {
      inf && inf.done && on && pc.put(inf.key, Object.assign({}, inf, { nodes }));
    } }), bk = el("div", "pxbk");
    bk.hidden = !0;
    let mkb = (cls, lbl, d) => {
      let b = el("button", "pxbkb " + cls);
      return b.type = "button", b.setAttribute("aria-label", lbl), b.title = lbl, b.appendChild(pxIcon("chev")), b.onclick = () => d === "back" ? history.back() : history.forward(), bk.appendChild(b), b;
    }, bkb = mkb("back", "Back (Alt+Left)", "back"), fwb = mkb("fwd", "Forward (Alt+Right)", "fwd");
    top ? top.prepend(bk) : (bk.classList.add("pxfloat"), fwb.hidden = !0, bkb.replaceChildren(pxIcon("back")), document.body.appendChild(bk));
    let bkPos = () => {
      if (top) return;
      let r = main.getBoundingClientRect();
      bk.style.left = Math.round(r.left + 16) + "px";
    };
    addEventListener("resize", () => requestAnimationFrame(bkPos)), new MutationObserver(() => {
      requestAnimationFrame(bkPos), setTimeout(bkPos, 260);
    }).observe(document.body, { attributes: !0, attributeFilter: ["class"] });
    let bkOn = (h) => {
      bk.classList.toggle("on", !isRoot(h) && sm.index > 0), bkPos();
    }, isRoot = (h) => /^#px\/(home|watchlist|search|sec\/[^/]+)?$/.test(h), navGo = (d) => !on || !location.hash.startsWith("#px/") ? !1 : (d === "back" ? sm.index > 0 && history.back() : sm.canForward && history.forward(), !0);
    for (let t of ["mousedown", "auxclick"]) addEventListener(t, (e) => {
      on && navInput(e) && e.preventDefault();
    }, !0);
    addEventListener("mouseup", (e) => {
      let d = navInput(e);
      d && navGo(d) && e.preventDefault();
    }, !0);
    let go = (h) => {
      location.hash = h;
    }, left = (it) => it.viewOffsetMs && it.durationMs && it.viewOffsetMs < it.durationMs ? ms(it.durationMs - it.viewOffsetMs) + " left" : "";
    function backdrop(it) {
      let u = img(backArt(it), 1920, 1080);
      if (!u) return null;
      let b = el("div", "pxbackdrop"), i = el("img");
      return i.alt = "", i.src = u, i.onerror = () => b.remove(), b.appendChild(i), b;
    }
    let colIo = null, colFlip = 0, colKey = "", heroFadeIo = null;
    function clearCollage() {
      if (colIo) {
        try {
          colIo.disconnect();
        } catch {
        }
        colIo = null;
      }
      if (heroFadeIo) {
        try {
          heroFadeIo.disconnect();
        } catch {
        }
        heroFadeIo = null;
      }
      colKey = "", document.querySelectorAll("#pxcollage,#pxbdstack").forEach((n) => n.remove()), document.querySelectorAll(".pxbackdrop").forEach((b) => {
        b.style.opacity = "", b.classList.remove("pxbdstack");
      });
    }
    function ensureCollage() {
      let host = document.getElementById("pxcollage");
      return host || (host = el("div", "pxcollage hero-first"), host.id = "pxcollage", host.setAttribute("aria-hidden", "true"), host.appendChild(el("div", "pxcol a")), host.appendChild(el("div", "pxcol b")), (main.parentNode || document.body).insertBefore(host, main), host);
    }
    function paintCollage(urls, soft) {
      let key = (urls || []).join("|") + (soft ? "|s" : "");
      if (!urls || !urls.length || key === colKey) return;
      colKey = key;
      let host = ensureCollage();
      host.classList.toggle("hero-first", !!soft);
      let layers = host.querySelectorAll(".pxcol");
      if (layers.length < 2) return;
      let next = layers[colFlip ^= 1], prev = layers[colFlip ^ 1];
      for (next.textContent = "", urls.slice(0, 9).forEach((u) => {
        let i = el("i");
        i.style.backgroundImage = "url(" + JSON.stringify(u) + ")", next.appendChild(i);
      }); next.children.length && next.children.length < 3; ) next.appendChild(next.children[0].cloneNode(!0));
      requestAnimationFrame(() => {
        next.classList.add("on"), prev.classList.remove("on");
      });
    }
    function ensureHeroStack(pickIt, nextIt) {
      let stack = document.getElementById("pxbdstack");
      if (!stack) {
        stack = el("div", "pxbackdrop pxbdstack"), stack.id = "pxbdstack", stack.setAttribute("aria-hidden", "true");
        let a = el("div", "pxbdlayer a on"), b = el("div", "pxbdlayer b");
        stack.appendChild(a), stack.appendChild(b), (main.parentNode || document.body).insertBefore(stack, main);
      }
      let setLayer = (layer, it) => {
        layer.textContent = "";
        let u = it ? img(backArt(it), 1920, 1080) : null;
        if (u) {
          let i = el("img");
          i.alt = "", i.src = u, i.onerror = () => i.remove(), layer.appendChild(i);
        }
      }, layers = stack.querySelectorAll(".pxbdlayer");
      return setLayer(layers[0], pickIt), setLayer(layers[1], nextIt || pickIt), layers[0].classList.add("on"), layers[1].classList.remove("on"), view.querySelectorAll(".pxbackdrop:not(.pxbdstack)").forEach((n) => n.remove()), document.querySelectorAll("#pxView .pxbackdrop.pxbdstack").forEach((n) => n.remove()), stack;
    }
    function bindHomeHero(g0, pickIt, nextIt) {
      if (clearCollage(), !pickIt) return;
      let layers = ensureHeroStack(pickIt, nextIt).querySelectorAll(".pxbdlayer"), strips = [...view.querySelectorAll(".pxstrip")], cw = strips.find((s) => /continue watching/i.test((s.querySelector(".pxstt") || {}).textContent || "")) || strips[0], nextStrip = strips.find((s) => /next up/i.test((s.querySelector(".pxstt") || {}).textContent || "")) || strips[1], artOf = (sec) => sec ? [...sec.querySelectorAll(".pxcard .poster img")].map((i) => i.currentSrc || i.src).filter(Boolean).slice(0, 9) : [], tick = () => {
        if (g0 !== gen) return;
        let mr = main.getBoundingClientRect(), hero = view.querySelector(".pxhomehero"), cwRect = cw ? cw.getBoundingClientRect() : null;
        if (!(cwRect ? cwRect.bottom < mr.top + 48 : main.scrollTop > (hero ? 280 : 160))) {
          layers[0].classList.add("on"), layers[1].classList.remove("on");
          let host = document.getElementById("pxcollage");
          host && host.querySelectorAll(".pxcol").forEach((c2) => c2.classList.remove("on")), colKey = "";
          return;
        }
        layers[0].classList.remove("on"), layers[1].classList.add("on");
        let urls = artOf(nextStrip) || artOf(strips.find((s) => s !== cw)) || artOf(cw) || [];
        urls.length && paintCollage(urls, !1);
      };
      if (typeof IntersectionObserver < "u") {
        heroFadeIo = new IntersectionObserver(() => tick(), { root: main, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }), cw && heroFadeIo.observe(cw), nextStrip && heroFadeIo.observe(nextStrip);
        let hero = view.querySelector(".pxhomehero");
        hero && heroFadeIo.observe(hero);
      }
      let prev = onScroll;
      onScroll = (r) => {
        prev && prev(r), tick();
      }, afterPaint(tick);
    }
    function bindCollage(g0) {
      clearCollage();
      let strips = [...view.querySelectorAll(".pxstrip")];
      if (!strips.length) return;
      let score = (sec) => {
        let r = sec.getBoundingClientRect(), mr = main.getBoundingClientRect(), top2 = Math.max(r.top, mr.top), bot = Math.min(r.bottom, mr.bottom);
        return Math.max(0, bot - top2);
      }, artOf = (sec) => [...sec.querySelectorAll(".pxcard .poster img")].map((i) => i.currentSrc || i.src).filter(Boolean).slice(0, 9), tick = () => {
        if (g0 !== gen) return;
        let best = null, bestS = 0;
        strips.forEach((s) => {
          let n = score(s);
          n > bestS && (bestS = n, best = s);
        });
        let urls = best && artOf(best) || strips.map(artOf).find((a) => a.length) || [];
        urls.length && paintCollage(urls, !1);
      };
      typeof IntersectionObserver < "u" && (colIo = new IntersectionObserver(() => tick(), { root: main, threshold: [0, 0.15, 0.35, 0.55, 0.75] }), strips.forEach((s) => colIo.observe(s)));
      let prev = onScroll;
      onScroll = (r) => {
        prev && prev(r), tick();
      }, afterPaint(tick);
    }
    function heroFacts(it, extra) {
      let f = el("div", "pxfacts pxhf");
      [it.year, it.durationMs ? ms(it.durationMs) : "", it.contentRating, ...extra || []].filter(Boolean).forEach((x) => f.appendChild(el("span", null, String(x))));
      let l = left(it);
      return l && f.appendChild(el("span", "pxleft", l)), f;
    }
    let ms = (n) => {
      let m = Math.round((n || 0) / 6e4);
      return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
    }, tc = (n) => {
      let s = Math.floor((n || 0) / 1e3), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
      return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
    }, SECIC = { movie: "film", show: "tv", artist: "music", photo: "photo", playlist: "playlist" };
    async function musicPage(g) {
      history.replaceState(history.state, "", "#px/home"), await home(g);
    }
    let theme = makeThemePlayer({
      makeAudio: () => {
        let a = new Audio();
        return a.dataset.pxtheme = "1", a;
      },
      url: themeUrl,
      otherPlaying: () => [...document.querySelectorAll("video,audio")].some((m) => !m.paused && !(m.dataset && m.dataset.pxtheme)) || !!(navigator.mediaSession && navigator.mediaSession.playbackState === "playing"),
      onBlocked: () => addEventListener("pointerdown", () => theme.resume(), { once: !0, capture: !0 })
    });
    invoke2("prefs_get").then((p) => theme.configure(p)).catch(() => {
    }), addEventListener("pxprefs", (e) => theme.configure(e.detail)), addEventListener("blur", () => theme.stop()), document.addEventListener("visibilitychange", () => {
      document.hidden && theme.stop();
    });
    let pf = makePrefetch({ concurrency: 3, cap: 160, load: (u) => new Promise((r) => {
      let i = new Image();
      i.decoding = "async", i.onload = i.onerror = () => r(), i.src = u;
    }) });
    for (let t of ["wheel", "pointerdown", "keydown", "touchstart"]) addEventListener(t, () => pf.pause(800), { passive: !0, capture: !0 });
    let afterPaint = (fn) => requestAnimationFrame(() => (window.requestIdleCallback || ((f) => setTimeout(f, 120)))(fn, { timeout: 1500 }));
    addEventListener("resize", () => {
      on && view.querySelectorAll(".pxstrip").forEach(syncArrows);
    }, { passive: !0 });
    let sideBox = (() => {
      let sb = side && side.closest(".sidebar");
      if (!sb) return null;
      let b = el("div", "pxsideart");
      return b.setAttribute("aria-hidden", "true"), sb.prepend(b), b;
    })(), sideCur = "";
    function sideArt(it) {
      if (!sideBox) return;
      let u = it ? img(backArt(it), 96, 54) : null;
      if (u === sideCur || (sideCur = u || "", sideBox.querySelectorAll("img").forEach((o) => {
        o.classList.remove("in"), setTimeout(() => o.remove(), 240);
      }), !u)) return;
      let i = el("img");
      i.alt = "", i.decoding = "async", i.onload = () => requestAnimationFrame(() => i.classList.add("in")), i.src = u, sideBox.appendChild(i);
    }
    let brandEl = document.querySelector(".sidebar .brand"), tbFade = () => {
      let v = String(Math.min(1, main.scrollTop / 80) * 0.85);
      top && top.style.setProperty("--pxtb", v), brandEl && brandEl.style.setProperty("--pxtb", v);
    }, tbh0 = 0;
    function tbH() {
      if (!top || main.scrollTop > 0) return;
      let mt = Math.round(main.getBoundingClientRect().top), h = Math.round(top.getBoundingClientRect().bottom) - mt;
      h > 0 && h !== tbh0 && (tbh0 = h, document.body.style.setProperty("--tbh", h + "px"), document.body.style.setProperty("--tbt", Math.max(0, mt) + "px"));
    }
    addEventListener("resize", () => requestAnimationFrame(tbH));
    let swapFull = (i) => {
      let src = i.dataset.src;
      if (!src) return;
      delete i.dataset.src;
      let f = new Image();
      f.decoding = "async", f.src = src, (f.decode ? f.decode() : Promise.resolve()).then(() => {
        i.src = src, i.classList.remove("pxlo");
      }, () => {
        i.src = src, i.classList.remove("pxlo");
      });
    }, pio = typeof IntersectionObserver == "function" ? new IntersectionObserver((es) => es.forEach((e) => {
      e.isIntersecting && (pio.unobserve(e.target), swapFull(e.target));
    }), { rootMargin: PREFETCH_MARGIN }) : null;
    function prefetchSrc(i, src, first, lo) {
      if (first || !pio) {
        i.src = src;
        return;
      }
      i.loading = "eager", i.dataset.src = src, lo && (i.classList.add("pxlo"), i.src = lo), pio.observe(i);
    }
    function poster(it, wide, first) {
      let a = el("a", "card pxcard" + (wide ? " wide" : ""));
      a.href = "#px/item/" + it.id, a.dataset.kind = it.kind;
      let music = it.kind === "artist" || it.kind === "album", sq = music ? 300 : 200, p = el("div", "poster"), src = img(wide ? it.kind === "episode" ? it.thumb || it.art : it.art || it.thumb : tileArt(it), wide ? 320 : sq, wide ? 180 : 300), lowSrc = !wide && !first ? img(tileArt(it), LOWRES[0], music ? LOWRES[0] : LOWRES[1]) : null, ph = () => {
        p.appendChild(el("span", "pxph", ((it.title || "?").match(/[\p{L}\p{N}]/u) || ["?"])[0].toUpperCase()));
      };
      if (it.kind === "playlist") {
        let gen2 = () => {
          if (p.querySelector(".pxplart")) return;
          let g = playlistArt(it.title), d = el("div", "pxplart");
          d.style.background = g.bg, d.appendChild(pxIcon("playlist")), d.appendChild(el("b", null, it.title || "Playlist")), it.leafCount && d.appendChild(el("span", null, it.leafCount + " items")), p.appendChild(d);
        };
        if (!src)
          gen2();
        else {
          let i = el("img");
          i.alt = "", i.loading = "lazy", i.decoding = "async", i.className = "pxfade", i.onload = () => i.classList.add("in"), i.onerror = () => {
            i.remove(), gen2();
          }, i.src = src, p.appendChild(i);
        }
        a.appendChild(p);
        let m2 = el("div", "meta");
        return m2.appendChild(el("div", "t", it.title || "Playlist")), a.appendChild(m2), a;
      }
      if (src) {
        let i = el("img");
        i.alt = "", i.loading = first ? "eager" : "lazy", first && (i.fetchPriority = "high"), i.decoding = "async", i.className = "pxfade", i.onload = () => {
          i.classList.add("in"), p.classList.add("ld");
        }, prefetchSrc(i, src, first, lowSrc), i.onerror = () => {
          i.remove(), ph();
        }, p.appendChild(i), i.complete && i.naturalWidth && (i.classList.add("in"), p.classList.add("ld"));
      } else
        p.classList.add("ld"), ph();
      if (it.viewOffsetMs && it.durationMs) {
        let b = el("div", "pxprog"), f = el("i");
        f.style.width = Math.min(100, it.viewOffsetMs / it.durationMs * 100).toFixed(1) + "%", b.appendChild(f), p.appendChild(b);
      }
      it.watched && !music && p.appendChild(el("span", "pxwatched", "\u2713")), a.appendChild(p);
      let m = el("div", "meta");
      m.appendChild(el("div", "t", it.kind === "episode" && it.grandparentTitle || it.title || "Untitled"));
      let sub = it.kind === "episode" ? `S${it.parentIndex ?? "?"} \xB7 E${it.index ?? "?"} \xB7 ${it.title}` : it.kind === "season" ? `${it.leafCount ?? 0} episodes` : it.kind === "album" ? it.parentTitle : it.year ?? "";
      m.appendChild(el("div", "muted small", sub));
      let srcs = Array.isArray(it.sources) ? it.sources.filter((x) => typeof x == "string").slice(0, 4) : [];
      if (srcs.length > 1) {
        let sv = el("div", "pxsrc small", srcs.join(" \xB7 "));
        sv.title = "On " + srcs.join(", "), m.appendChild(sv);
      }
      return a.appendChild(m), a;
    }
    let realItem = (it) => !!(it && it.id && (it.kind === "artist" || it.kind === "album" || it.kind === "playlist" || tileArt(it) || it.thumb || it.art));
    function row(title, list, wide, cls) {
      if (list = (list || []).filter(realItem), !list.length) return null;
      let kind = cls && /\bpxcw\b/.test(cls) ? "continue" : "", sec = strip({ key: "row-" + (String(title || "").toLowerCase().replace(/\W+/g, "-") || kind || "hub"), title: title || "", items: list, wide: !!wide, kind, count: list.length });
      if (cls && !kind) {
        let sc = sec.querySelector(".pxsts");
        sc && sc.classList.add(...cls.split(/\s+/).filter(Boolean));
      }
      return sec;
    }
    function wlTile(x) {
      let a = poster(x, !1);
      a.classList.add("pxwl");
      let p = a.querySelector(".poster");
      return p.appendChild(el("span", "pxwltag", x.kind === "show" ? "TV" : "Movie")), hasNewEp(x) && p.appendChild(el("span", "pxnewep", "New ep")), a;
    }
    function wlRow() {
      if (!WL) return null;
      let l = watchlistHome(WL.list()).slice(0, 30);
      if (!l.length) return null;
      let sec = strip({ key: "watchlist", title: "Watchlist", see: "#px/watchlist", items: l, kind: "continue", count: l.length }), sc = sec.querySelector(".pxsts");
      return sc && (sc.textContent = "", l.forEach((x) => sc.appendChild(wlTile(x)))), sec;
    }
    function watchlistPage(g) {
      if (mark("watchlist"), view.textContent = "", view.appendChild(el("h1", "pxh", "Watchlist")), !WL) {
        view.appendChild(el("p", "muted pxwlempty", "Watchlist is coming soon."));
        return;
      }
      let st = (() => {
        try {
          return JSON.parse(sessionStorage.getItem("pxWlUi") || "{}");
        } catch {
          return {};
        }
      })(), filter = ["all", "movies", "tv"].includes(st.f) ? st.f : "all", sort = ["added", "title", "release"].includes(st.s) ? st.s : "added", bar = el("div", "pxwlbar"), chips = el("div", "pxchips");
      chips.setAttribute("role", "radiogroup"), chips.setAttribute("aria-label", "Show");
      let sel = el("select", "pxsort");
      sel.setAttribute("aria-label", "Sort by"), [["added", "Date added"], ["title", "Title"], ["release", "Release"]].forEach(([v, t]) => {
        let o = el("option", null, t);
        o.value = v, sel.appendChild(o);
      }), sel.value = sort;
      let grid = el("div", "pxwlgrid");
      bar.appendChild(chips), bar.appendChild(sel), view.appendChild(bar), view.appendChild(grid);
      let draw = () => {
        if (g !== gen) return;
        try {
          sessionStorage.setItem("pxWlUi", JSON.stringify({ f: filter, s: sort }));
        } catch {
        }
        chips.textContent = "", [["all", "All"], ["movies", "Movies"], ["tv", "TV"]].forEach(([v, t]) => {
          let c2 = el("button", "fchip" + (v === filter ? " on" : ""), t);
          c2.type = "button", c2.setAttribute("role", "radio"), c2.setAttribute("aria-checked", String(v === filter)), c2.onclick = () => {
            filter = v, draw();
          }, chips.appendChild(c2);
        }), grid.textContent = "";
        let all = WL.list(), l = watchlistView(all, filter, sort);
        if (!l.length) {
          let e = el("div", "pxwlempty");
          e.appendChild(el("p", null, all.length ? "Nothing here for this filter." : "Your Watchlist is empty.")), e.appendChild(el("p", "muted small", all.length ? "Try All, or another filter." : "Use \u201CAdd to Watchlist\u201D on any movie or show page.")), grid.appendChild(e);
          return;
        }
        l.forEach((x) => grid.appendChild(wlTile(x)));
      };
      sel.onchange = () => {
        sort = sel.value, draw();
      }, draw();
    }
    function status(msg) {
      view.textContent = "", view.appendChild(el("p", "muted pxstatus", msg));
    }
    function loading(target) {
      let w = el("div", "pxload");
      w.setAttribute("role", "status"), w.setAttribute("aria-label", "Loading"), w.setAttribute("aria-busy", "true");
      for (let c2 of ["a", "b", "c"]) w.appendChild(el("i", "pxsk " + c2));
      return (target || view).appendChild(w), w;
    }
    function fail(e, kind) {
      status(loadErrorText(kind, e, hooks.why));
    }
    function navLink(label, hash, r, ic) {
      let a = el("a");
      return a.href = hash, a.dataset.r = r, a.dataset.label = label, a.setAttribute("aria-label", label), a.removeAttribute("title"), a.appendChild(pxIcon(ic)), a.appendChild(el("span", null, label)), a;
    }
    let conn = "", navState = "ok", homeP = null, homeSg = -1;
    function browseHomeShared(sg) {
      if (homeP && homeSg === sg) return homeP;
      homeSg = sg, navState = "loading", renderNav();
      let take = (v) => (sg !== srcGen || (sections = v.sections || [], navState = "ok", renderNav()), v), once = () => invoke2("browse_home").then(take);
      return homeP = once().catch(async (e) => {
        if (sg !== srcGen || (await new Promise((r) => setTimeout(r, 350)), sg !== srcGen)) throw e;
        try {
          return await once();
        } catch (e2) {
          throw sg === srcGen && (navState = "fail", renderNav()), e2;
        }
      }).finally(() => {
        homeSg === sg && (homeP = null, homeSg = -1);
      }), homeP;
    }
    function loadSections() {
      browseHomeShared(srcGen).catch(() => {
      });
    }
    function renderNav() {
      nav.textContent = "";
      let sl = navLink("Search", "#px/search", "search", "search");
      sl.setAttribute("aria-keyshortcuts", "Control+K"), sl.onclick = (e) => {
        e.preventDefault(), pkOpen();
      }, nav.appendChild(sl);
      let voice = () => {
        let v = document.getElementById("voiceBtn");
        v && v.click();
      };
      {
        let mr = navLink("Ask Librarian", "#px/voice", "voice", "mic");
        mr.classList.add("pxmicrow"), mr.onclick = (e) => {
          e.preventDefault(), voice();
        }, nav.appendChild(mr);
      }
      nav.appendChild(navLink("Home", "#px/home", "home", "home"));
      {
        let w = navLink("Watchlist", "#px/watchlist", "watchlist", "playlist"), n = WL ? wlBadgeCount(WL.list()) : 0;
        if (n > 0) {
          let c2 = el("span", "pxcount", String(n > 99 ? "99+" : n));
          c2.setAttribute("aria-hidden", "true"), w.appendChild(c2), w.setAttribute("aria-label", "Watchlist, " + n + (n === 1 ? " show" : " shows") + " with new episodes");
        }
        nav.appendChild(w);
      }
      if (nav.appendChild(el("div", "navh muted small", "Libraries")), sections.filter((s) => s.kind !== "artist").forEach((s) => nav.appendChild(navLink(s.title, "#px/sec/" + s.id, "sec/" + s.id, SECIC[s.kind] || "folder"))), navState === "loading" && !sections.length) {
        let m = el("div", "pxnavmsg pxload");
        m.setAttribute("role", "status"), m.setAttribute("aria-label", "Loading libraries"), m.appendChild(el("i", "pxsk a")), m.appendChild(el("i", "pxsk b")), nav.appendChild(m);
      }
      if (navState === "fail" && !sections.length) {
        let r = el("button", "pxnavmsg pxlink", "Libraries didn\u2019t load \xB7 Retry");
        r.type = "button", r.onclick = loadSections, nav.appendChild(r);
      }
      mark(cur);
    }
    let cur = "home";
    function mark(r) {
      cur = r, nav.querySelectorAll("a").forEach((a) => {
        let y = r === a.dataset.r || r.startsWith(a.dataset.r + "/");
        a.classList.toggle("on", y), y ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
      });
    }
    async function home(g) {
      mark("home"), view.textContent = "", loading(), swap.end();
      let sg = srcGen, v = await browseHomeShared(sg);
      if (g !== gen || sg !== srcGen || (await Promise.resolve(), g !== gen || sg !== srcGen)) return;
      renderNav(), mark("home"), view.textContent = "";
      let hi = (v.continueWatching || [])[0] || (v.onDeck || [])[0], notHi = (x) => !(hi && x && x.id === hi.id), cwRest = (v.continueWatching || []).filter(notHi), odRest = (v.onDeck || []).filter(notHi);
      if (sideArt(hi || null), hi) {
        let hw = el("div", "pxhomehero"), h = el("div", "pxhtext");
        h.appendChild(el("div", "pxhkick", "Pick up where you left off"));
        let cv = coverArt(hi), cu = cv && img(cv.id, cv.square ? 300 : 240, cv.square ? 300 : 360);
        if (cu) {
          let c2 = el("a", "pxcase" + (cv.square ? " sq" : ""));
          c2.href = "#px/item/" + hi.id, c2.setAttribute("aria-hidden", "true"), c2.tabIndex = -1;
          let ci = el("img");
          ci.alt = "", ci.decoding = "async", ci.src = cu, ci.onerror = () => {
            c2.remove(), hw.classList.remove("hascase");
          }, c2.appendChild(ci), c2.appendChild(el("i", "pxcasesp")), hw.appendChild(c2), hw.classList.add("hascase");
        }
        let t = el("a", "pxhtitle", hi.kind === "episode" && hi.grandparentTitle ? hi.grandparentTitle : hi.title);
        t.href = "#px/item/" + hi.id, h.appendChild(t), hi.kind === "episode" ? h.appendChild(el("div", "muted pxhep", `S${hi.parentIndex ?? "?"} \xB7 E${hi.index ?? "?"} \xB7 ${hi.title}`)) : hi.kind === "track" && h.appendChild(el("div", "muted pxhep", [hi.grandparentTitle, hi.parentTitle].filter(Boolean).join(" \xB7 "))), h.appendChild(heroFacts(hi)), hi.genres && hi.genres.length && h.appendChild(el("div", "muted", hi.genres.join(", "))), hi.summary && h.appendChild(el("p", "pxsum", hi.summary)), hw.appendChild(h), view.appendChild(hw);
      } else view.appendChild(el("h1", "pxh", "Home"));
      if ((v.servers || 0) > 0 && (srvN = v.servers | 0), (v.servers || 0) > 1) {
        let n = v.answered || v.servers;
        view.appendChild(el("p", "muted small pxmsrv", "Browsing " + n + " of " + v.servers + " servers"));
      }
      let dup = (h) => /continue|ondeck|on deck|next up/i.test((h.ident || "") + " " + (h.title || ""));
      [row("Continue Watching", cwRest, !1, "pxcw"), row("Next Up", odRest, !1, "pxcw"), wlRow(), ...v.hubs.filter((h) => !dup(h)).map((h) => row(h.title, h.items))].forEach((x) => x && view.appendChild(x)), view.querySelector(".pxrow") || view.appendChild(el("p", "muted", "Nothing here yet."));
      let upNext = odRest[0] || cwRest[0] || null;
      afterPaint(() => {
        g === gen && (view.querySelectorAll(".pxstrip").forEach(syncArrows), hi ? bindHomeHero(g, hi, upNext) : bindCollage(g));
      });
    }
    let TABS = [["all", "All"], ["collections", "Collections"], ["genres", "Genres"], ["studios", "Studios"]], FK = /^(genre|year|studio)$/;
    async function section(id, tab, fk, fv, g) {
      if (!ID.test(id)) return status("Not found");
      tab = TABS.some((t) => t[0] === tab) ? tab : "all", FK.test(fk || "") || (fk = "", fv = "");
      let loadErr;
      if (!sections.length) {
        let sg = srcGen;
        try {
          await browseHomeShared(sg);
        } catch (e) {
          loadErr = e;
        }
        if (g !== gen) return;
      }
      let s = sections.find((x) => String(x.id) === id);
      if (mark("sec/" + id), !s) return status(missingLibraryText(loadErr, hooks.why));
      view.textContent = "";
      let hd = el("div", "pxhead");
      hd.appendChild(el("h1", "pxh", s.title));
      let count = el("span", "muted small");
      hd.appendChild(count), view.appendChild(hd);
      let tabs = el("div", "pxtabs");
      tabs.setAttribute("role", "tablist"), TABS.filter((t) => !(s && s.kind === "artist" && (t[0] === "collections" || t[0] === "studios"))).forEach(([k, n]) => {
        let a = el("a", "pxtab" + (k === tab ? " on" : ""), n);
        a.href = `#px/sec/${id}/${k}`, a.setAttribute("role", "tab"), a.setAttribute("aria-selected", String(k === tab)), tabs.appendChild(a);
      }), view.appendChild(tabs), sideArt(null);
      let landingOn = (s.kind === "movie" || s.kind === "show") && tab === "all" && !fk;
      if (landingOn) {
        let jl = el("a", "pxlink pxjump", "Jump to library \u203A");
        jl.href = "#pxlib", jl.onclick = (e) => {
          e.preventDefault();
          let b = document.getElementById("pxlib");
          b && (main.scrollTop += b.getBoundingClientRect().top - main.getBoundingClientRect().top - 64);
        }, hd.appendChild(jl);
        let le = await movieLanding(id, g, s.kind === "show");
        if (g !== gen) return;
        le && view.appendChild(le);
      }
      if (tab === "collections") {
        let w2 = loading(), cs = await invoke2("browse_collections", { id });
        if (g !== gen) return;
        w2.remove();
        let gr = el("div", "grid pxgrid");
        cs.forEach((c2) => gr.appendChild(poster(c2))), view.appendChild(cs.length ? gr : el("p", "muted", "No collections.")), count.textContent = `${cs.length} collections`;
        return;
      }
      if (tab === "genres" || tab === "studios") {
        let kind = tab === "genres" ? "genre" : "studio", w2 = loading(), fs = await invoke2("browse_facet", { id, facet: kind });
        if (g !== gen) return;
        w2.remove();
        let tl = el("div", "pxtiles");
        count.textContent = `${fs.length} ${tab}`, fs.forEach((f, i) => {
          let v = kind === "genre" ? f.key : f.title;
          if (!v) return;
          let a = el("a", "pxtile t" + i % 6);
          a.href = `#px/sec/${id}/all/${kind}/${encodeURIComponent(v)}`, a.appendChild(icon(kind === "genre" ? "genre" : "studio")), a.appendChild(el("b", null, f.title)), tl.appendChild(a);
        }), view.appendChild(fs.length ? tl : el("p", "muted", "Nothing to show."));
        return;
      }
      let sort = sessionStorage.getItem("pxSort") || "title", bar = el("div", "pxfilters"), sel = (cls, label, opts, val, fn) => {
        let x = el("select", "pxsort " + cls);
        return x.setAttribute("aria-label", label), opts.forEach(([k, n]) => {
          let o = el("option", null, n);
          o.value = k, x.appendChild(o);
        }), x.value = val, x.onchange = () => fn(x.value), bar.appendChild(x), x;
      };
      sel("", "Sort", [["title", "Title"], ["added", "Recently added"], ["year", "Year"], ["rating", "Rating"]], sort, (v) => {
        sessionStorage.setItem("pxSort", v), route();
      });
      let fsel = (kind, label) => {
        let x = sel("pxf", label, [["", label]], fk === kind ? fv : "", (v) => go(v ? `#px/sec/${id}/all/${kind}/${encodeURIComponent(v)}` : `#px/sec/${id}/all`));
        invoke2("browse_facet", { id, facet: kind }).then((fs) => {
          g === gen && (fs.forEach((f) => {
            let v = kind === "genre" ? f.key : f.title;
            if (!v) return;
            let o = el("option", null, f.title);
            o.value = v, x.appendChild(o);
          }), x.value = fk === kind ? fv : "");
        }).catch(() => {
        });
      };
      if (fsel("genre", "Genre"), fsel("year", "Year"), fsel("studio", "Studio"), fk) {
        let c2 = el("a", "pxfchip");
        c2.href = `#px/sec/${id}/all`, c2.title = "Clear filter", c2.appendChild(el("span", "muted", fk[0].toUpperCase() + fk.slice(1) + ": "));
        let nm = el("b", null, fv);
        c2.appendChild(nm), c2.appendChild(el("span", null, " \u2715")), bar.appendChild(c2), fk === "genre" && invoke2("browse_facet", { id, facet: "genre" }).then((fs) => {
          let f = fs.find((x) => x.key === fv);
          f && g === gen && (nm.textContent = f.title);
        }).catch(() => {
        });
      }
      if (landingOn) {
        bar.id = "pxlib", bar.classList.add("pxsticky");
        let lc = el("span", "muted small pxlcount");
        bar.prepend(lc), count.addEventListener("pxcount", () => {
          lc.textContent = count.textContent;
        });
      }
      view.appendChild(bar);
      let wrap = el("div", "pxgridwrap");
      view.appendChild(wrap);
      let grid = el("div", "grid pxgrid pxvgrid");
      wrap.appendChild(grid);
      let letterBar = el("div", "pxaz");
      letterBar.setAttribute("aria-label", "Jump to letter");
      let args = (start) => ({ id, start, cursor: null, sort, fkind: fk || null, fvalue: fk ? fv : null }), w = loading(wrap), p0 = await invoke2("browse_section", args(0));
      if (g !== gen) return;
      w.remove();
      let total = p0.total;
      if (count.textContent = `${total} items`, count.dispatchEvent(new Event("pxcount")), !total) {
        let em = el("div", "pxempty");
        if (fk) {
          em.appendChild(el("h2", null, "Nothing matches this filter"));
          let a = el("a", "pxchip", "Clear filter");
          a.href = `#px/sec/${id}/all`, em.appendChild(a);
        } else
          em.appendChild(el("h2", null, "This library is empty")), em.appendChild(el("p", "muted", "Add media to this library on your Plex server and it will show up here."));
        grid.appendChild(em);
        return;
      }
      let ag = appendGrid({
        grid,
        total,
        fetchPage: (start) => start === 0 ? p0.items : Promise.resolve(hooks.pageDelay && hooks.pageDelay()).then((d) => d && new Promise((r) => setTimeout(r, d))).then(() => invoke2("browse_section", args(start))).then((p) => g === gen ? p.items : null),
        tile: (it, i) => poster(it, !1, i < 24),
        onError: (e) => {
          g === gen && !ag.pages.size && fail(e);
        },
        placeholder: () => {
          let ph = el("div", "card pxcard pxph");
          return ph.isPlaceholder = !0, ph.setAttribute("aria-hidden", "true"), ph.appendChild(el("div", "poster")), ph.appendChild(el("div", "meta")), ph;
        }
      }), cols = 1, rowH = 300;
      function measure() {
        cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
        let c2 = grid.querySelector(".card");
        c2 && (rowH = c2.getBoundingClientRect().height + (parseFloat(getComputedStyle(grid).rowGap) || 0));
      }
      function check() {
        if (!grid.isConnected) return;
        let mr = main.getBoundingClientRect(), gr = grid.getBoundingClientRect();
        ag.tiles.length < total && gr.bottom - mr.bottom < mr.height * 1.5 && ag.ensure(ag.tiles.length + 100);
        let r0 = Math.max(0, Math.floor((mr.top - gr.top) / rowH) - 2), r1 = Math.ceil((mr.bottom - gr.top) / rowH) + 4;
        ag.want(r0 * cols, Math.min(ag.tiles.length, r1 * cols));
      }
      let raf = 0;
      onScroll = (r) => {
        r && measure(), raf || (raf = requestAnimationFrame(() => {
          raf = 0, check();
        }));
      }, ag.ensure(100), await ag.load(0), measure(), check(), sort === "title" && total > 12 && invoke2("browse_letters", { id, fkind: fk || null, fvalue: fk ? fv : null }).then((ls) => {
        if (g !== gen) return;
        let off = 0, at = {};
        ls.forEach((l) => {
          l.key in at || (at[l.key] = off), off += l.count;
        }), ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].forEach((k) => {
          let bt = el("button", "pxazb", k);
          bt.type = "button", bt.disabled = !(k in at), bt.onclick = () => {
            let i = Math.min(total - 1, at[k]);
            ag.ensure(i + cols * 8), ag.want(i - cols * 2, i + cols * 8);
            let t = ag.tiles[i];
            t && (main.scrollTop += t.getBoundingClientRect().top - main.getBoundingClientRect().top - 8);
          }, letterBar.appendChild(bt);
        }), wrap.appendChild(letterBar), wrap.classList.add("hasaz"), measure(), check();
      }).catch(() => {
      });
    }
    let LAND = /* @__PURE__ */ new Map();
    async function movieLanding(id, g, tv) {
      let ck = server + "\0" + id, now = Math.floor(Date.now() / 1e3), L = LAND.get(ck);
      if (!L || now - L.at >= 21600) {
        let w = loading();
        try {
          let args = (start) => ({ id, start, cursor: null, sort: "added", fkind: null, fvalue: null }), p0 = await invoke2("browse_section", args(0)), step = p0.items.length || 100, n = Math.min(p0.total, LAND_MAX), all = p0.items.slice(), starts = [];
          for (let st = step; st < n; st += step) starts.push(st);
          for (let i = 0; i < starts.length; i += 4) {
            let ps = await Promise.all(starts.slice(i, i + 4).map((st) => invoke2("browse_section", args(st)).then((p) => p.items).catch(() => [])));
            if (g !== gen) return null;
            ps.forEach((l) => {
              all = all.concat(l);
            });
          }
          let [hv, gf] = await Promise.all([invoke2("browse_home").catch(() => ({})), invoke2("browse_facet", { id, facet: "genre" }).catch(() => [])]), fresh = tv ? buildTvLanding({ shows: all, onDeck: (hv.onDeck || []).concat(hv.continueWatching || []), episodes: (hv.hubs || []).flatMap((h) => h.items || []).concat(hv.onDeck || []), watchlist: WL ? WL.list() : [], now }) : buildLanding({ items: all, continueWatching: hv.continueWatching || [], watchlist: WL ? WL.list() : [], now }), gk = new Map((gf || []).map((f) => [f.title, f.key]));
          fresh.rows.forEach((r) => {
            r.kind === "genre" && gk.get(r.genre) && (r.see = `#px/sec/${id}/all/genre/${encodeURIComponent(gk.get(r.genre))}`);
          }), L = stableLanding(L && now - L.at < 21600 ? L : null, fresh, now), LAND.set(ck, L);
        } catch {
          return w.remove(), null;
        }
        if (w.remove(), g !== gen) return null;
      }
      return renderLanding(L, g);
    }
    function renderLanding(L, g) {
      let box = el("div", "pxland");
      if (L.hero) {
        let bd = backdrop(L.hero);
        bd && view.appendChild(bd), sideArt(L.hero), box.appendChild(landHero(L.hero));
      }
      let later = [];
      return L.rows.forEach((r) => {
        let sx = strip(r);
        box.appendChild(sx), r.items.slice(8).forEach((it) => {
          let u = img(tileArt(it), 200, 300);
          u && later.push(u);
        });
      }), box.addEventListener("keydown", landKeys), afterPaint(() => {
        g === gen && (pf.add(later), pf.start(), box.querySelectorAll(".pxstrip").forEach(syncArrows));
      }), box;
    }
    function landHero(h) {
      let w = el("div", "pxlhero"), t = el("div", "pxhtext"), a = el("a", "pxhtitle", h.title);
      a.href = "#px/item/" + h.id, t.appendChild(a), t.appendChild(heroFacts(h, (h.genres || []).slice(0, 2))), h.heroNew && t.appendChild(el("span", "pxhnew", h.heroNew + (h.heroNew === 1 ? " new episode" : " new episodes"))), h.summary && t.appendChild(el("p", "pxsum pxclamp", h.summary));
      let acts = el("div", "pxacts"), pb = el("a", "px-btn primary pxplay");
      return pb.href = "#px/item/" + h.id, pb.appendChild(icon("play")), pb.appendChild(el("span", null, h.heroCta || "Play")), pb.title = "Open the title", acts.appendChild(pb), acts.appendChild(watchBtn(h)), t.appendChild(acts), w.appendChild(t), w;
    }
    function syncArrows(sec) {
      fitPage(sec);
      let sc = sec.querySelector(".pxsts");
      if (!sc) return;
      let kids = sc.children, sum = 0, gap = parseFloat(getComputedStyle(sc).columnGap || getComputedStyle(sc).gap) || 0;
      for (let i = 0; i < kids.length; i++) sum += kids[i].getBoundingClientRect().width;
      kids.length > 1 && (sum += gap * (kids.length - 1));
      let cs = getComputedStyle(sc);
      sum += (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      let extent = Math.max(sc.scrollWidth, sum), fits = extent <= sc.clientWidth + 2;
      sec.classList.toggle("fits", fits), sec.classList.toggle("atl", sc.scrollLeft <= 2), sec.classList.toggle("atr", sc.scrollLeft + sc.clientWidth >= extent - 2);
    }
    function cardUnit(sc) {
      let card = sc.querySelector(".pxcard, .card"), gap = parseFloat(getComputedStyle(sc).columnGap || getComputedStyle(sc).gap) || 0, w = card ? card.getBoundingClientRect().width : 0;
      return { unit: w > 0 ? w + gap : 0, gap, w };
    }
    function pageStep(sc) {
      let { unit, gap } = cardUnit(sc);
      return unit <= 0 ? Math.max(120, sc.clientWidth * 0.85) : (Math.max(1, +sc.dataset.pageN || 0) || Math.max(1, Math.floor((sc.clientWidth + gap) / unit))) * unit;
    }
    function fitPage(sec) {
      let sc = sec.querySelector(".pxsts");
      if (!sc) return;
      let wrap = sec.querySelector(".pxstw"), { unit, gap } = cardUnit(sc);
      if (unit <= 0 || !wrap) {
        sc.style.maxWidth = "", sc.style.width = "", delete sc.dataset.pageN, delete sc.dataset.pageFit;
        return;
      }
      let cs = getComputedStyle(sc), pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0), hostW = sec.clientWidth || wrap.parentElement && wrap.parentElement.clientWidth || wrap.clientWidth, avail = Math.max(0, hostW - 48 - 48 - 8), innerMax = Math.max(0, avail - pad), n = Math.max(1, Math.floor((innerMax + gap) / unit)), pageW = n * unit - gap + pad;
      sc.dataset.pageN = String(n), sc.dataset.pageFit = String(Math.round(pageW));
      let next = Math.round(pageW) + "px";
      if (sc.style.width === next && sc.style.maxWidth === next) return;
      sc.style.maxWidth = next, sc.style.width = next;
      let max = Math.max(0, sc.scrollWidth - sc.clientWidth), sl = sc.scrollLeft;
      unit > 0 && (sl = Math.round(sl / unit) * unit), Math.abs(sc.scrollLeft - sl) > 0.5 && (sc.scrollLeft = Math.max(0, Math.min(max, sl)));
    }
    function stripScroll(sc, dir) {
      let { unit } = cardUnit(sc), step = pageStep(sc), max = Math.max(0, sc.scrollWidth - sc.clientWidth), target = sc.scrollLeft + dir * step;
      unit > 0 && (target = Math.round(target / unit) * unit), target = Math.max(0, Math.min(max, target)), sc.scrollTo({ left: target, behavior: "smooth" });
    }
    function strip(r) {
      let sec = el("section", "pxstrip");
      if (sec.dataset.row = r.key, r.title) {
        let h = el("h2", "pxsth");
        if (h.appendChild(el("span", "pxstt", r.title)), h.appendChild(el("span", "pxstc", " \xB7 " + (r.count ?? r.items.length))), r.see) {
          let a = el("a", "pxsee", "See all \u203A");
          a.href = r.see, h.appendChild(el("span", "pxstc", " \xB7 ")), h.appendChild(a);
        }
        sec.appendChild(h);
      }
      let wrap = el("div", "pxstw"), sc = el("div", "row pxrow pxsts" + (r.kind === "continue" ? " pxcw" : "") + (r.wide ? " pxwd" : ""));
      r.items.forEach((it, i) => {
        let c2 = poster(it, !!r.wide, i < 8);
        if (it.isNew) {
          let pp = c2.querySelector(".poster");
          pp && pp.appendChild(el("span", "pxnewtag", "New"));
        }
        it.label && c2.appendChild(el("span", "pxtlabel", it.label)), r.rank && (c2.classList.add("pxranked"), c2.querySelector(".poster").appendChild(el("span", "pxrank", String(i + 1)))), sc.appendChild(c2);
      });
      let arr = (d) => {
        let b = el("button", "pxarr " + d);
        return b.type = "button", b.tabIndex = -1, b.setAttribute("aria-label", (d === "l" ? "Scroll left in " : "Scroll right in ") + (r.title || "row")), b.appendChild(pxIcon("chev")), b.onclick = (e) => {
          e.preventDefault(), e.stopPropagation(), stripScroll(sc, d === "l" ? -1 : 1);
        }, b;
      };
      return wrap.appendChild(arr("l")), wrap.appendChild(sc), wrap.appendChild(arr("r")), sec.appendChild(wrap), sc.addEventListener("scroll", () => syncArrows(sec), { passive: !0 }), typeof ResizeObserver < "u" && new ResizeObserver(() => syncArrows(sec)).observe(sc), sec;
    }
    function landKeys(e) {
      if (e.altKey || e.ctrlKey || e.metaKey || !/^Arrow/.test(e.key)) return;
      let c2 = e.target.closest && e.target.closest(".pxstrip .pxcard");
      if (!c2) return;
      let sec = c2.closest(".pxstrip"), cards = [...sec.querySelectorAll(".pxsts>.pxcard")], i = cards.indexOf(c2), t = null;
      if (e.key === "ArrowLeft") t = cards[i - 1];
      else if (e.key === "ArrowRight") t = cards[i + 1];
      else {
        let all = [...view.querySelectorAll(".pxstrip")], k = all.indexOf(sec) + (e.key === "ArrowDown" ? 1 : -1);
        if (all[k]) {
          let cs = [...all[k].querySelectorAll(".pxsts>.pxcard")];
          t = cs[Math.min(i, cs.length - 1)];
        } else k >= all.length && (t = view.querySelector(".pxvgrid .pxcard:not(.pxph)"));
      }
      t && (e.preventDefault(), t.focus({ preventScroll: !0 }), t.scrollIntoView({ block: "nearest", inline: "nearest" }));
    }
    function phead(title, shell) {
      let h = el("div", "ptabs");
      h.appendChild(el("b", null, title));
      let x = el("button", "pxclose", "\u2715");
      return x.type = "button", x.setAttribute("aria-label", "Close " + title), x.onclick = () => {
        shell.classList.remove("ropen"), sessionStorage.setItem("pxR", "0"), shell.dispatchEvent(new Event("pxsync"));
      }, h.appendChild(x), h;
    }
    let fmtRes = (r) => r ? /^\d+$/.test(r) ? r + "p" : r.toUpperCase() : "", fmtSize = (b) => b == null ? "" : b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : Math.round(b / 1e6) + " MB";
    function fileLine(it) {
      let m = (it.media || [])[0];
      if (!m || (it.versions || []).length > 1) return null;
      let ch = m.audioChannels ? m.audioChannels === 6 ? "5.1" : m.audioChannels === 8 ? "7.1" : m.audioChannels + " ch" : "", t = [(m.container || "").toUpperCase(), [(m.videoCodec || "").toUpperCase(), fmtRes(m.videoResolution)].filter(Boolean).join(" "), [(m.audioCodec || "").toUpperCase(), ch].filter(Boolean).join(" "), m.bitrateKbps ? (m.bitrateKbps / 1e3).toFixed(1) + " Mbps" : "", fmtSize(m.sizeBytes)].filter(Boolean).join(" \xB7 ");
      return t ? el("p", "muted small pxfile", "File \xB7 " + t) : null;
    }
    function versionsList(it) {
      let multi = new Set((it.versions || []).map((v) => v.server)).size > 1, w = el("div", "pxvers");
      return w.setAttribute("role", "list"), (it.versions || []).forEach((v) => {
        let b = el("button", "pxver" + (v.current ? " cur" : ""));
        b.type = "button", b.setAttribute("role", "listitem"), b.appendChild(el("b", null, v.label || "Unknown")), b.appendChild(el("span", "muted small", [v.hdr ? "HDR" : "", (v.codec || "").toUpperCase(), v.bitrateKbps ? (v.bitrateKbps / 1e3).toFixed(1) + " Mbps" : ""].filter(Boolean).join(" \xB7 "))), multi && b.appendChild(el("span", "pxbadge" + (v.owned ? "" : " sh"), v.server + (v.owned ? "" : " \xB7 shared"))), v.picked && b.appendChild(el("span", "pxbadge pk", "Preferred")), b.title = v.current ? "This copy" : "Prefer this copy", b.onclick = () => invoke2("version_pick", { id: v.id }).then(() => {
          w.querySelectorAll(".pxbadge.pk").forEach((x) => x.remove());
          let t = el("span", "pxbadge pk", "Preferred");
          b.appendChild(t);
        }).catch(() => {
        }), w.appendChild(b);
      }), w;
    }
    function watchBtn(it) {
      let b = el("button", "pxrb lab pxwatch");
      b.type = "button";
      let lab = el("span", "pxrbl");
      b.appendChild(pxIcon("playlist")), b.appendChild(lab);
      let sync = () => {
        let st = watchlistBtnState(WL, it);
        lab.textContent = st.label, b.classList.toggle("on", st.on), b.setAttribute("aria-label", st.aria), b.title = st.aria, b.setAttribute("aria-pressed", String(st.on)), st.disabled && b.setAttribute("aria-disabled", "true");
      };
      return b.onclick = (e) => {
        e.preventDefault(), WL && (WL.toggle(it), sync());
      }, sync(), b;
    }
    function availNames(it) {
      let out = [], add = (n) => {
        typeof n == "string" && n && !out.includes(n) && out.push(n);
      };
      return (Array.isArray(it && it.available) ? it.available : []).forEach(add), (Array.isArray(it && it.sources) ? it.sources : []).forEach(add), (it && it.versions || []).forEach((v) => add(v && v.server)), out.slice(0, 8);
    }
    function versionForServer(it, name) {
      let vs = (it.versions || []).filter((v) => v && v.server === name);
      return vs.find((v) => v.picked) || vs.find((v) => v.owned) || vs.find((v) => v.current) || vs[0] || null;
    }
    function versionFileText(v) {
      return v ? [v.label || "", v.hdr ? "HDR" : "", (v.codec || "").toUpperCase(), v.bitrateKbps ? (v.bitrateKbps / 1e3).toFixed(1) + " Mbps" : "", v.owned ? "" : "shared"].filter(Boolean).join(" \xB7 ") : "";
    }
    function watchChoices(it) {
      let vs = Array.isArray(it && it.versions) ? it.versions.filter((v) => v && (v.server || v.label)) : [];
      return vs.length ? vs.slice(0, 12).map((v, i) => ({
        id: String(v.id || "v" + i),
        server: v.server || "Server",
        versionId: v.id || null,
        label: [v.server || "Server", v.label || versionFileText(v) || "Version"].filter(Boolean).join(" \xB7 "),
        file: versionFileText(v),
        picked: !!v.picked
      })) : availNames(it).map((n) => ({ id: n, server: n, versionId: null, label: n, file: "", picked: !1 }));
    }
    function selectedWatch(it) {
      let choices = watchChoices(it);
      if (!choices.length) return { choices, pick: null };
      let names = availNames(it), c2 = availChoice(window.localStorage, Object.assign({}, it, { available: names.length ? names : choices.map((x) => x.server) })), pick = choices.find((x) => x.picked) || choices.find((x) => x.server === c2.selected) || choices[0];
      try {
        let raw = sessionStorage.getItem("pxWatch:" + (it.id || ""));
        if (raw) {
          let hit = choices.find((x) => x.id === raw);
          hit && (pick = hit);
        }
      } catch {
      }
      return { choices, pick, avail: c2 };
    }
    function rememberWatch(it, choice) {
      if (!choice) return;
      try {
        sessionStorage.setItem("pxWatch:" + (it.id || ""), choice.id);
      } catch {
      }
      let names = availNames(it), c2 = availChoice(window.localStorage, Object.assign({}, it, { available: names }));
      try {
        c2.key && choice.server && localStorage.setItem(c2.key, choice.server);
      } catch {
      }
      choice.versionId && invoke2("version_pick", { id: choice.versionId }).catch(() => {
      });
    }
    function startTitlePlay(it, choice) {
      let { pick } = selectedWatch(it), ch = choice || pick;
      ch && rememberWatch(it, ch);
      let server2 = ch && ch.server || availNames(it)[0] || "library", file = ch && ch.file || "";
      try {
        sessionStorage.setItem("pxPlayCtx", JSON.stringify({
          title: it.title || "Title",
          year: it.year || "",
          server: server2,
          file,
          kind: it.kind || "",
          plexId: it.id || "",
          versionId: ch && ch.versionId || it.defaultVersion || null,
          returnHash: location.hash || "#px/home",
          servers: watchChoices(it).map((c2) => ({ id: c2.id, server: c2.server, label: c2.label, file: c2.file || "", versionId: c2.versionId || null }))
        }));
      } catch {
      }
      location.hash = "#player/0";
    }
    function attachPlayServerMenu(it, playBtn) {
      let { choices, pick } = selectedWatch(it);
      if (choices.length < 2) return !1;
      let slot = el("div", "pxsrvpick"), menu = el("div", "pxsrvmenu");
      return menu.hidden = !0, menu.appendChild(el("div", "mh", "Watch from")), choices.forEach((ch) => {
        let b = el("button", null, "Play from " + ch.label);
        b.type = "button", pick && ch.id === pick.id && b.classList.add("on"), b.onclick = (e) => {
          e.stopPropagation(), menu.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)), menu.hidden = !0, startTitlePlay(it, ch);
        }, menu.appendChild(b);
      }), playBtn.disabled = !1, playBtn.dataset.pxplay = "1", playBtn.title = "Play \xB7 choose server or version", playBtn.setAttribute("aria-label", "Play \xB7 choose server or version"), playBtn.onclick = (e) => {
        if (e.preventDefault(), e.stopPropagation(), !menu.hidden) {
          menu.hidden = !0, startTitlePlay(it);
          return;
        }
        menu.hidden = !1;
      }, playBtn.replaceWith(slot), slot.appendChild(playBtn), slot.appendChild(menu), document.addEventListener("click", (e) => {
        slot.contains(e.target) || (menu.hidden = !0);
      }), !0;
    }
    function sidePanel(it, shell, g0) {
      let p = el("aside", "pxpanel right");
      p.setAttribute("aria-label", "Chapters and Up Next");
      let g = el("div", "pxpin");
      p.appendChild(g);
      let um = upNextMode(it);
      if (g.appendChild(phead(um.button, shell)), it.chapters.length && (g.appendChild(el("h4", null, "Chapters")), it.chapters.forEach((c2, i) => {
        let r = el("div", "chrow");
        r.appendChild(el("b", "pxtc", tc(c2.startMs))), r.appendChild(el("span", null, c2.title || "Chapter " + (i + 1))), g.appendChild(r);
      })), it.markers.length) {
        let m = el("p", "muted small");
        m.textContent = it.markers.map((x) => `${x.kind === "credits" ? "Credits" : "Intro"} ${tc(x.startMs)}\u2013${tc(x.endMs)}`).join(" \xB7 "), g.appendChild(m);
      }
      g.appendChild(el("h4", null, um.heading));
      let up = el("div", "pxuplist");
      g.appendChild(up);
      let w = loading(up), add = (list) => {
        if (w.remove(), !list.length) {
          up.appendChild(el("p", "muted small", "Nothing queued."));
          return;
        }
        list.slice(0, 12).forEach((x) => {
          let a = el("a", "up");
          a.href = "#px/item/" + x.id;
          let pp = el("div", "poster"), src = img(x.thumb || x.art, 224, 126);
          if (src) {
            let i = el("img");
            i.alt = "", i.loading = "lazy", i.src = src, i.onerror = () => i.remove(), pp.appendChild(i);
          }
          a.appendChild(pp);
          let t = el("div");
          t.appendChild(el("b", null, x.kind === "episode" ? `E${x.index ?? "?"} \xB7 ${x.title}` : x.title)), t.appendChild(el("div", "muted small", x.kind === "episode" ? x.grandparentTitle || "" : x.year ?? "")), a.appendChild(t), up.appendChild(a);
        });
      };
      return setTimeout(() => {
        if (gen !== g0) {
          w.remove();
          return;
        }
        (it.kind === "episode" && ID.test(it.parentId || "") ? invoke2("browse_children", { id: it.parentId }).then((k) => k.filter((x) => (x.index ?? 0) > (it.index ?? 0))) : it.kind === "season" ? invoke2("browse_children", { id: it.id }).then((k) => k.filter((x) => !x.watched)) : invoke2("browse_home").then((v) => v.onDeck.filter((x) => x.id !== it.id))).then((l) => {
          gen === g0 && add(l);
        }).catch(() => {
          gen === g0 && add([]);
        });
      }, 0), p;
    }
    async function item(id, g) {
      if (!ID.test(id)) return status("Not found");
      view.textContent = "", loading(), swap.end();
      let it = await invoke2("browse_item", { id });
      if (g !== gen || (await Promise.resolve(), g !== gen)) return;
      let sec = sections.find((s) => s.kind === { movie: "movie", show: "show", season: "show", episode: "show", artist: "artist", album: "artist", track: "artist" }[it.kind]);
      mark(sec ? "sec/" + sec.id : "item"), view.textContent = "";
      let shell = el("div", "pxshell");
      sessionStorage.getItem("pxR") === "1" && shell.classList.add("ropen");
      let mid = el("div", "pxcenter");
      shell.appendChild(mid), shell.appendChild(sidePanel(it, shell, g));
      let d = el("div", "pxdet"), bd = backdrop(it);
      bd && view.appendChild(bd), sideArt(it);
      let body = el("div", "pxdbody");
      d.appendChild(body);
      let art = detailArt(it), ps = img(art.poster, 260, 390);
      if (ps) {
        let p = el("img", "pxposter pxfade");
        p.alt = "", p.decoding = "async", p.onload = () => p.classList.add("in"), p.src = ps, p.onerror = () => p.remove(), body.appendChild(p);
      }
      let tx = el("div", "pxdtext");
      if (body.appendChild(tx), it.kind === "episode" || it.kind === "season") {
        let ctx = el("div", "pxctx"), sh = el("a", "pxup", it.kind === "episode" ? it.grandparentTitle : it.parentTitle);
        if (sh.href = "#px/item/" + (it.kind === "episode" ? it.grandparentId : it.parentId), ctx.appendChild(sh), it.kind === "episode") {
          ctx.appendChild(el("span", "muted", " \u203A "));
          let se = el("a", "pxup", "Season " + (it.parentIndex ?? "?"));
          se.href = "#px/item/" + it.parentId, ctx.appendChild(se), ctx.appendChild(el("span", "muted", " \xB7 Episode " + (it.index ?? "?")));
        }
        tx.appendChild(ctx);
      }
      tx.appendChild(el("h1", "pxh", it.title));
      let su = img(art.still, 480, 270);
      if (su) {
        let sb = el("div", "pxstill"), si = el("img", "pxfade");
        si.alt = "", si.decoding = "async", si.onload = () => si.classList.add("in"), si.src = su, si.onerror = () => sb.remove(), sb.appendChild(si), tx.appendChild(sb);
      }
      let aired = it.aired ? (/* @__PURE__ */ new Date(it.aired + "T12:00:00")).toLocaleDateString(void 0, { year: "numeric", month: "short", day: "numeric" }) : "", facts = [it.kind === "episode" && aired ? "Aired " + aired : it.year, it.contentRating, it.durationMs ? ms(it.durationMs) : "", it.criticRating != null ? "Critics " + it.criticRating.toFixed(1) : "", it.audienceRating != null ? "Audience \u2605 " + it.audienceRating.toFixed(1) : it.criticRating == null && it.rating != null ? "\u2605 " + it.rating.toFixed(1) : "", it.studio].filter(Boolean), fl = el("div", "muted pxfacts", facts.join(" \xB7 ")), lf = left(it);
      lf && fl.appendChild(el("span", "pxleft", lf));
      let rz = it.media && it.media[0] && fmtRes(it.media[0].videoResolution);
      if (rz && fl.appendChild(el("span", "pxres", rz)), tx.appendChild(fl), it.tagline && tx.appendChild(el("p", "pxtag", it.tagline)), it.genres.length) {
        let gl = el("div", "pxgenres");
        it.genres.forEach((x) => gl.appendChild(el("span", "pxgenre", x))), tx.appendChild(gl);
      }
      it.summary && tx.appendChild(el("p", "pxsum", it.summary));
      let cr = el("dl", "pxcredits"), crow = (k, v, more) => {
        if (!v) return;
        cr.appendChild(el("dt", "muted", k));
        let dd = el("dd", null, v);
        if (more) {
          let a = el("button", "pxlink", more);
          a.type = "button", a.onclick = () => {
            let h = d.querySelector(".pxheads");
            h && h.scrollIntoView({ block: "start", behavior: "smooth" });
          }, dd.appendChild(document.createTextNode(" ")), dd.appendChild(a);
        }
        cr.appendChild(dd);
      }, main2 = it.cast.filter((c2) => !/^guest/i.test(c2.role)), guests = it.cast.filter((c2) => /^guest/i.test(c2.role));
      crow("Starring", main2.slice(0, 4).map((c2) => c2.name).join(", "), it.cast.length ? "Full cast" : ""), crow("Guest stars", guests.slice(0, 4).map((c2) => c2.name).join(", ")), crow(it.directors.length > 1 ? "Directors" : "Director", it.directors.join(", ")), crow(it.writers.length > 1 ? "Writers" : "Writer", it.writers.join(", ")), cr.childNodes.length && tx.appendChild(cr), ((it.versions || []).length > 1 || it.versionsPending) && (tx.appendChild(el("h4", "pxvh", "Versions")), (it.versions || []).length > 1 && tx.appendChild(versionsList(it)), it.versionsPending && tx.appendChild(el("span", "muted small", "Checking other servers\u2026")));
      let fln = fileLine(it);
      fln && tx.appendChild(fln);
      let makeFeat = () => {
        let feat = el("div", "pxfeat"), fb = el("button", "pxrb lab");
        fb.type = "button", fb.setAttribute("aria-haspopup", "menu"), fb.setAttribute("aria-expanded", "false"), fb.title = "Features", fb.setAttribute("aria-label", "Features \xB7 watch together, audio, subtitles"), fb.appendChild(el("span", "pxglyph", "\u22EF")), fb.appendChild(el("span", "pxrbl", "More"));
        let fm = el("div", "pxfeatmenu");
        fm.hidden = !0, fm.setAttribute("role", "menu"), fm.appendChild(el("div", "mh", "Watch together"));
        let wt = el("button", null, "Start watch together");
        return wt.type = "button", wt.onclick = () => {
          fm.hidden = !0, fb.setAttribute("aria-expanded", "false");
          try {
            dispatchEvent(new CustomEvent("pxtost", { detail: "Watch together \xB7 invite link arrives with playback" }));
          } catch {
          }
        }, fm.appendChild(wt), fm.appendChild(el("div", "mh", "Audio")), [["en-eac3", "English \xB7 E-AC3 5.1", !0], ["en-aac", "English \xB7 AAC stereo", !1], ["es-ac3", "Spanish \xB7 AC3 5.1", !1]].forEach(([id2, lab, on2]) => {
          let b = el("button", on2 ? "on" : null, lab);
          b.type = "button", b.dataset.audio = id2, b.onclick = () => {
            fm.querySelectorAll("[data-audio]").forEach((x) => x.classList.toggle("on", x === b)), fm.hidden = !0, fb.setAttribute("aria-expanded", "false");
          }, fm.appendChild(b);
        }), fm.appendChild(el("div", "mh", "Subtitles")), [["off", "Off", !0], ["en-srt", "English (SRT)", !1], ["en-pgs", "English (PGS)", !1]].forEach(([id2, lab, on2]) => {
          let b = el("button", on2 ? "on" : null, lab);
          b.type = "button", b.dataset.cc = id2, b.onclick = () => {
            fm.querySelectorAll("[data-cc]").forEach((x) => x.classList.toggle("on", x === b)), fm.hidden = !0, fb.setAttribute("aria-expanded", "false");
          }, fm.appendChild(b);
        }), fb.onclick = (e) => {
          e.stopPropagation();
          let open = fm.hidden;
          fm.hidden = !open, fb.setAttribute("aria-expanded", String(open));
        }, document.addEventListener("click", (e) => {
          feat.contains(e.target) || (fm.hidden = !0, fb.setAttribute("aria-expanded", "false"));
        }), feat.appendChild(fb), feat.appendChild(fm), feat;
      }, ra = el("div", "pxround"), rb = (ic, lab, fn, off) => {
        let b = el("button", "pxrb");
        return b.type = "button", b.title = lab, b.setAttribute("aria-label", lab), b.appendChild(ic.length === 1 ? el("span", "pxglyph", ic) : icon(ic)), b.appendChild(el("span", "pxrbl", lab)), b.classList.add("lab"), off ? (b.disabled = !0, b.title = lab + " \xB7 arrives in M3") : b.onclick = fn, ra.appendChild(b), b;
      };
      if (["show", "season", "artist"].includes(it.kind)) {
        let um = upNextMode(it);
        if (!um.buttonOnly) {
          let pb = el("button", "pxrb lab pxpbtn");
          pb.type = "button", pb.appendChild(icon("list")), pb.appendChild(el("span", "pxrbl", um.button)), pb.setAttribute("aria-label", um.aria), pb.title = um.aria, pb.dataset.mode = um.mode;
          let sync = () => {
            let o = shell.classList.contains("ropen");
            pb.classList.toggle("on", o), pb.setAttribute("aria-pressed", String(o));
          };
          pb.onclick = () => {
            let o = !shell.classList.contains("ropen");
            shell.classList.toggle("ropen", o), sessionStorage.setItem("pxR", o ? "1" : "0"), sync();
          }, sync(), shell.addEventListener("pxsync", sync), ra.appendChild(pb);
        }
        if ((um.buttonOnly || it.kind === "show") && ra.appendChild(watchBtn(it)), ra.appendChild(makeFeat()), it.theme) {
          let mb = el("button", "pxrb lab pxmute");
          mb.type = "button";
          let syncM = () => {
            let m = theme.muted;
            mb.textContent = m ? "\u{1F507}" : "\u{1F50A}", mb.setAttribute("aria-pressed", String(m)), mb.title = m ? "Unmute theme music" : "Mute theme music", mb.setAttribute("aria-label", mb.title);
          };
          mb.onclick = () => {
            theme.setMuted(!theme.muted), syncM();
          }, syncM(), ra.appendChild(mb);
        }
        tx.appendChild(ra);
      } else {
        let { choices, pick } = selectedWatch(it), multi = choices.length >= 2, lab = multi ? "Play \xB7 choose server" : "Play from " + (pick && pick.server || "library"), playBtn = rb("play", lab, () => startTitlePlay(it), !1);
        if (playBtn.dataset.pxplay = "1", multi && attachPlayServerMenu(it, playBtn), rb("rew", "Play from start", () => startTitlePlay(it), !1), rb("\u2713", it.watched ? "Mark unwatched" : "Mark watched", null, !0), upNextMode(it).buttonOnly && ra.appendChild(watchBtn(it)), ra.appendChild(makeFeat()), it.theme) {
          let mb = el("button", "pxrb lab pxmute");
          mb.type = "button";
          let syncM = () => {
            let m = theme.muted;
            mb.textContent = m ? "\u{1F507}" : "\u{1F50A}", mb.setAttribute("aria-pressed", String(m)), mb.title = m ? "Unmute theme music" : "Mute theme music", mb.setAttribute("aria-label", mb.title);
          };
          mb.onclick = () => {
            theme.setMuted(!theme.muted), syncM();
          }, syncM(), ra.appendChild(mb);
        }
        let ready = pick ? "Ready \xB7 play from " + pick.server + (pick.file ? " \xB7 " + pick.file : "") : "Ready to play";
        tx.appendChild(ra), tx.appendChild(el("p", "muted small pxnote", ready));
      }
      if (it.cast.length) {
        let cs = el("section", "pxheads");
        cs.appendChild(el("h2", "pxrowh", it.kind === "episode" ? "Cast & guest stars" : "Credits"));
        let r = el("div", "pxheadrow");
        it.cast.slice(0, 20).forEach((x) => {
          let p = el("button", "pxcred");
          p.type = "button", p.title = x.name, p.onclick = () => ID.test(x.id || "") ? openPerson(p, x.id, it) : openPersonLocal(p, x, it);
          let av = el("i", null, x.name.split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2));
          av.style.background = initTint(x.name);
          let ps2 = img(x.thumb, 240, 240);
          if (ps2) {
            let pi = el("img");
            pi.alt = "", pi.loading = "lazy", pi.src = ps2, pi.onerror = () => pi.remove(), av.appendChild(pi);
          }
          p.appendChild(av), p.appendChild(el("b", null, x.name)), p.appendChild(el("span", "muted small", x.role)), r.appendChild(p);
        }), cs.appendChild(r), d.appendChild(cs);
      }
      if (mid.appendChild(d), view.appendChild(shell), await Promise.resolve(), g !== gen) return;
      afterPaint(() => {
        g === gen && theme.enter(it);
      }), it.kind === "episode" && ID.test(it.parentId || "") && invoke2("browse_children", { id: it.parentId }).then((k) => {
        if (g !== gen) return;
        let nv = el("div", "pxacts pxepnav"), lnk = (x, lab) => {
          let a = el("a", "px-btn", lab + (x ? " \xB7 E" + (x.index ?? "?") + " " + x.title : ""));
          x ? a.href = "#px/item/" + x.id : a.classList.add("off"), nv.appendChild(a);
        };
        lnk(k.find((x) => x.index === (it.index ?? 0) - 1), "\u2039 Previous"), lnk(k.find((x) => x.index === (it.index ?? 0) + 1), "Next \u203A"), tx.appendChild(nv);
      }).catch(() => {
      });
      let relBox = ["movie", "show"].includes(it.kind) ? el("section", "pxrelated") : null;
      if (relBox && (mid.appendChild(relBox), invoke2("browse_related", { id }).then((list) => {
        if (g !== gen) return;
        let r = row("Related", list);
        r ? (relBox.appendChild(r), afterPaint(() => {
          g === gen && relBox.querySelectorAll(".pxstrip").forEach(syncArrows);
        })) : relBox.remove();
      }).catch(() => relBox.remove())), ["show", "season", "artist", "album"].includes(it.kind)) {
        let kids = await invoke2("browse_children", { id });
        if (g !== gen) return;
        let label = { show: "Seasons", season: "Episodes", artist: "Albums", album: "Tracks" }[it.kind], r = row(label, kids, it.kind === "season");
        r && (relBox ? mid.insertBefore(r, relBox) : mid.appendChild(r));
      }
    }
    async function person(id, g) {
      if (!ID.test(id)) return status("Not found");
      view.textContent = "", loading(), swap.end();
      let pv = await invoke2("browse_person", { id });
      if (g !== gen) return;
      mark("person"), view.textContent = "";
      let pb = backdrop((pv.items || []).find((x) => x.art || x.thumb));
      pb && view.appendChild(pb), personInto(view, pv);
    }
    function pmBackdrop(it) {
      pmd.querySelectorAll(":scope>.pxbackdrop").forEach((n) => n.remove());
      let b = it && backdrop(it);
      b && pmd.insertBefore(b, pmd.firstChild);
    }
    function personSkeleton(t) {
      let w = loading(t);
      w.classList.add("pxpsk");
      let r = el("div", "pxpskrow");
      for (let i = 0; i < 6; i++) r.appendChild(el("i", "pxsk pxskp"));
      return w.appendChild(r), w;
    }
    async function openPerson(trigger, id, it) {
      if (!ID.test(id)) return;
      let my = ++pmGen;
      pmb.textContent = "", pmBackdrop(it), personSkeleton(pmb), pm.open(trigger);
      try {
        let pv = await invoke2("browse_person", { id });
        if (my !== pmGen || !pm.isOpen) return;
        pmb.textContent = "", personInto(pmb, pv);
      } catch (e) {
        my === pmGen && (pmb.textContent = "", pmb.appendChild(el("p", "muted pxstatus", loadErrorText("person", e, hooks.why))));
      }
    }
    function openPersonLocal(trigger, x, it) {
      ++pmGen, pmb.textContent = "", pmBackdrop(it), personInto(pmb, { name: x.name, thumb: x.thumb, bio: x.role ? "As " + x.role : "", items: [], noFilm: !0 }), pm.open(trigger);
    }
    function personInto(view2, pv) {
      let hd = el("div", "pxperson"), av = el("i", "pxpav", (pv.name || "?").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2));
      av.style.background = initTint(pv.name);
      let u = img(pv.thumb, 220, 220);
      if (u) {
        let pi = el("img");
        pi.alt = "", pi.src = u, pi.onerror = () => pi.remove(), av.appendChild(pi);
      }
      hd.appendChild(av);
      let tx = el("div", "pxptext"), h1 = el("h1", "pxh", pv.name || "Unknown");
      view2 === pmb && (h1.id = "pxpmTitle"), tx.appendChild(h1);
      let pb = personBio(pv);
      pb.facts && tx.appendChild(el("div", "muted pxfacts pxborn", pb.facts)), pb.empty ? pv.noFilm ? pv.bio && tx.appendChild(el("p", "muted pxsum", pv.bio)) : tx.appendChild(el("p", "muted small pxbioempty", pb.emptyText)) : tx.appendChild(buildPersonBioBlock(document, pb.bio));
      let srcs = (pv.sources || []).filter((x) => typeof x == "string").slice(0, 6);
      if (srcs.length > 1 && tx.appendChild(el("div", "pxsrc small", "On " + srcs.join(" \xB7 "))), hd.appendChild(tx), view2.appendChild(hd), !pv.items.length) {
        view2.appendChild(el("h2", "row-title", "Filmography")), view2.appendChild(el("p", "muted", pv.noFilm ? "This server has no person page for them." : "No titles with this person in your libraries."));
        return;
      }
      let fg = splitFilmography(pv.items);
      [["Movies", fg.movies], ["TV Shows", fg.tv], ["Other", fg.other]].forEach(([t, l]) => {
        if (!l.length) return;
        let sec = el("section", "pxfilm");
        sec.dataset.group = t, sec.appendChild(el("h2", "row-title", `${t} \xB7 ${l.length}`));
        let gr = el("div", "grid pxgrid");
        l.forEach((x) => gr.appendChild(poster(x))), sec.appendChild(gr), view2.appendChild(sec);
      });
    }
    let pk = el("div", "pxso");
    pk.id = "pxPalette", pk.hidden = !0, pk.setAttribute("role", "dialog"), pk.setAttribute("aria-modal", "true"), pk.setAttribute("aria-label", "Search your library");
    let pkc = el("div", "pxsocard");
    pk.appendChild(pkc);
    let phd = el("div", "pxsohd");
    phd.appendChild(pxIcon("search")), pkc.appendChild(phd);
    let pin = el("input", "pxsoin");
    pin.type = "search", pin.placeholder = "Search movies, shows, episodes, music and people", pin.maxLength = 100, pin.setAttribute("aria-label", "Search your library"), pin.setAttribute("role", "combobox"), pin.setAttribute("aria-controls", "pxsoOut"), pin.setAttribute("aria-expanded", "true"), pin.autocomplete = "off", phd.appendChild(pin);
    let pesc = el("button", "pxsoesc", "Esc");
    pesc.type = "button", pesc.title = "Close search", pesc.onclick = () => pkDismiss(), phd.appendChild(pesc);
    let pfl = el("div", "pxsofl");
    pfl.setAttribute("role", "tablist"), pfl.setAttribute("aria-label", "Result type"), pkc.appendChild(pfl);
    let pout = el("div", "pxsoout");
    pout.id = "pxsoOut", pout.setAttribute("role", "listbox"), pkc.appendChild(pout);
    let pft = el("div", "pxsoft muted small");
    [["\u2191\u2193", "move"], ["Enter", "open"], ["Tab", "type"], ["Esc", "close"]].forEach(([k, t]) => {
      let s = el("span");
      s.appendChild(el("kbd", null, k)), s.appendChild(document.createTextNode(" " + t)), pft.appendChild(s);
    }), pkc.appendChild(pft), document.body.appendChild(pk);
    let KINDIC = { movie: "film", show: "tv", season: "tv", episode: "tv", artist: "music", album: "music", track: "music", person: "profile", photo: "photo", playlist: "playlist" }, pkt, pkg = 0, pksel = 0, pkHubs = [], pkType = "all", pkItems = () => [...pout.querySelectorAll("a.pxsor")], pkMark = () => pkItems().forEach((a, i) => {
      let y = i === pksel;
      a.classList.toggle("on", y), a.setAttribute("aria-selected", String(y)), y && (pin.setAttribute("aria-activedescendant", a.id), a.scrollIntoView({ block: "nearest" }));
    });
    function pkHint(t, sub) {
      let w = el("div", "pxsoempty");
      w.appendChild(pxIcon("search")), w.appendChild(el("b", null, t)), sub && w.appendChild(el("span", "muted small", sub)), pout.appendChild(w);
    }
    function pkRender() {
      pout.textContent = "", pfl.textContent = "", pksel = 0, pin.removeAttribute("aria-activedescendant");
      let hubs = pkHubs.filter((h) => h.items && h.items.length);
      if (!hubs.length) return;
      pkType !== "all" && !hubs.some((h) => h.title === pkType) && (pkType = "all"), [["all", "All", hubs.reduce((n2, h) => n2 + h.items.length, 0)], ...hubs.map((h) => [h.title, h.title, h.items.length])].forEach(([k, t, n2]) => {
        let b = el("button", "pxsotab" + (k === pkType ? " on" : ""));
        b.type = "button", b.setAttribute("role", "tab"), b.setAttribute("aria-selected", String(k === pkType)), b.tabIndex = -1, b.appendChild(el("span", null, t)), b.appendChild(el("i", null, n2)), b.onclick = () => {
          pkType = k, pkRender(), pin.focus();
        }, pfl.appendChild(b);
      });
      let n = 0;
      hubs.filter((h) => pkType === "all" || h.title === pkType).forEach((h) => {
        let g = el("section", "pxsogrp");
        g.appendChild(el("h4", null, h.title)), h.items.slice(0, pkType === "all" ? 6 : 40).forEach((x) => {
          let a = el("a", "pxsor");
          a.id = "pxsor" + n++, a.setAttribute("role", "option"), x.kind === "person" && ID.test(x.id || "") ? (a.href = "#px/person/" + x.id, a.onclick = (e) => {
            e.preventDefault();
            let k = pkItems().indexOf(a);
            k >= 0 && (pksel = k), pkSave(), pkClose(), openPerson(a, x.id, null);
          }) : (a.href = "#px/item/" + x.id, a.onclick = () => {
            let k = pkItems().indexOf(a);
            k >= 0 && (pksel = k), pkSave(), pkClose();
          });
          let th = el("span", "pxsoth" + (x.kind === "episode" ? " wide" : "") + (x.kind === "person" ? " round" : "")), u = img(x.thumb, x.kind === "episode" ? 96 : 48, x.kind === "episode" ? 54 : 72);
          if (u) {
            let i = el("img");
            i.alt = "", i.loading = "lazy", i.src = u, i.onerror = () => i.remove(), th.appendChild(i);
          } else th.appendChild(pxIcon(KINDIC[x.kind] || "folder"));
          a.appendChild(th);
          let tx = el("span", "pxsotx");
          tx.appendChild(el("b", null, x.kind === "episode" && x.grandparentTitle ? x.grandparentTitle : x.title)), tx.appendChild(el("span", "muted small", (x.kind === "episode" ? [`S${x.parentIndex ?? "?"} \xB7 E${x.index ?? "?"}`, x.title] : [x.year]).filter(Boolean).join(" \xB7 "))), a.appendChild(tx), a.appendChild(el("span", "pxsok", x.kind || "")), a.onmousemove = () => {
            let i = pkItems().indexOf(a);
            i !== pksel && (pksel = i, pkMark());
          }, g.appendChild(a);
        }), pout.appendChild(g);
      }), pkMark();
    }
    function pkSave() {
      try {
        history.replaceState(searchSnapshot(history.state, { q: pin.value, t: pkType, sel: pksel, sc: pout.scrollTop }), "");
      } catch {
      }
    }
    function pkDismiss() {
      pkClose();
      try {
        history.state && history.state.pxs && history.replaceState(searchSnapshot(history.state, null), "");
      } catch {
      }
    }
    async function pkRun() {
      let my = ++pkg, v = pin.value.trim();
      if (pkHubs = [], !v) {
        pout.textContent = "", pfl.textContent = "";
        let where = srvN > 1 ? "across your servers" : "on " + (server || "your server");
        pkHint("Search your library", "Titles, people and episodes " + where + ".");
        return;
      }
      pk.classList.add("busy");
      try {
        let hubs = await invoke2("browse_search", { query: v });
        if (my !== pkg) return;
        pkHubs = hubs || [], pkRender(), pout.children.length || pkHint("No results for \u201C" + v + "\u201D", "Try a shorter title or a person\u2019s name.");
      } catch (e) {
        my === pkg && (pout.textContent = "", pfl.textContent = "", pkHint("Search failed", hooks.why ? hooks.why(e) : "Something went wrong. Try again."));
      } finally {
        my === pkg && pk.classList.remove("busy");
      }
    }
    let pkAt = 0, pkFocus = null;
    function pkOpen(q, rs) {
      pkAt = Date.now(), pk.hidden && (pkFocus = document.activeElement), pk.hidden = !1, document.body.classList.add("pxsoopen"), pkType = rs ? rs.t : "all", pin.value = typeof q == "string" ? q : "";
      let run = pkRun();
      setTimeout(() => {
        pin.focus(), rs || pin.select();
      }, 0), rs && run.then(() => {
        let n = pkItems();
        n.length && (pksel = Math.min(rs.sel, n.length - 1), pkMark()), pout.scrollTop = rs.sc;
      });
    }
    function pkClose() {
      pk.hidden || (pk.hidden = !0, document.body.classList.remove("pxsoopen"), pkFocus && pkFocus.focus && document.contains(pkFocus) && pkFocus.focus(), pkFocus = null);
    }
    pin.oninput = () => {
      clearTimeout(pkt), pkt = setTimeout(pkRun, 180);
    }, pk.addEventListener("mousedown", (e) => {
      e.target === pk && pkDismiss();
    }), pk.addEventListener("keydown", (e) => {
      let n = pkItems();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (e.preventDefault(), !n.length) return;
        pksel = (pksel + (e.key === "ArrowDown" ? 1 : -1) + n.length) % n.length, pkMark();
      } else if (e.key === "Enter" && n[pksel])
        e.preventDefault(), pkSave(), n[pksel].click();
      else if (e.key === "Tab") {
        e.preventDefault();
        let t = [...pfl.children];
        if (!t.length) return;
        let i = t.findIndex((b) => b.classList.contains("on"));
        t[(i + (e.shiftKey ? -1 : 1) + t.length) % t.length].click();
      }
    }), addEventListener("keydown", (e) => {
      if (!on) return;
      let nd = navInput(e);
      if (nd && !pm.isOpen && pk.hidden && navGo(nd)) {
        e.preventDefault(), e.stopImmediatePropagation();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
        e.preventDefault(), e.stopImmediatePropagation(), pk.hidden ? pkOpen() : Date.now() - pkAt > 400 && pkDismiss();
      else if (e.key === "Escape" && !pk.hidden)
        e.preventDefault(), e.stopImmediatePropagation(), pkDismiss();
      else if (e.key === "Escape") {
        let sh = document.querySelector(".pxshell.ropen");
        sh && (e.preventDefault(), e.stopImmediatePropagation(), sh.classList.remove("ropen"), sessionStorage.setItem("pxR", "0"), sh.dispatchEvent(new Event("pxsync")));
      }
    }, !0), addEventListener("keydown", (e) => {
      if (!on || e.defaultPrevented || pm.isOpen || !pk.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
      let t = e.target, ed = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""));
      [...document.querySelectorAll('[aria-modal="true"], .pxpmenu')].some((x) => !x.hidden && x.getClientRects().length && getComputedStyle(x).visibility !== "hidden") || (e.key === "Escape" || e.key === "BrowserBack" || e.key === "GoBack" || e.key === "Backspace" && !ed) && navGo("back") && e.preventDefault();
    }), addEventListener("click", (e) => {
      on && e.target.closest && e.target.closest("#askBtn") && (e.preventDefault(), e.stopImmediatePropagation(), pkOpen());
    }, !0), main.addEventListener("scroll", () => {
      swap.active || sm.save(), onScroll && onScroll(), tbFade();
    }, { passive: !0 }), addEventListener("resize", () => {
      onScroll && on && onScroll(!0);
    });
    async function route() {
      if (!on) return;
      let h = location.hash || "#home";
      if (h === "#home" || h === "#") {
        go("#px/home");
        return;
      }
      let isPx = h.startsWith("#px/");
      if (document.body.classList.toggle("pxroute", isPx), view.hidden = !isPx, !isPx) {
        theme.stop(), bk.hidden = !0, swap.end(), mark(h === "#settings" ? "settings" : "");
        return;
      }
      let leaveHash = curHash, leaveOnScroll = onScroll, leaveDone = doneG === gen && !swap.active, leaveG = gen, leaveMark = cur, g = gen = ++genMax;
      curHash = h, onScroll = null, /^#px\/home/.test(h) || clearCollage(), pm.close(!1), sm.save();
      let oldInfo = { key: sm.key, hash: leaveHash, g: leaveG, onScroll: leaveOnScroll, mark: leaveMark, done: leaveDone }, back = sm.enter(), srs = searchToRestore(history.state, back);
      bk.hidden = !1, bkOn(h), bkb.disabled = sm.index <= 0, fwb.disabled = !sm.canForward;
      let reload = oldInfo.key === sm.key;
      if (reload && pc.take(sm.key), back != null && !reload && pc.has(sm.key, h)) {
        let c2 = pc.take(sm.key);
        if (swap.end(), oldInfo.done) {
          let nodes = [...view.childNodes];
          nodes.forEach((n) => n.remove()), pc.put(oldInfo.key, Object.assign({}, oldInfo, { nodes }));
        } else view.textContent = "";
        c2.nodes.forEach((n) => view.appendChild(n)), gen = c2.g, doneG = gen, onScroll = c2.onScroll, curHash = h, c2.mark && mark(c2.mark), restoreScroll(back, gen), srs && pkOpen(srs.q, srs);
        return;
      }
      /^#px\/item\//.test(h) || theme.stop(), pf.reset();
      let [, kind, ...rest] = h.split("/"), part = rest.map((x) => {
        try {
          return decodeURIComponent(x);
        } catch {
          return "";
        }
      });
      if (/^#px\/person\//.test(oldInfo.hash || "") && (kind === "home" || kind === "sec" || kind === "watchlist" || kind === "music") ? view.textContent = "" : swap.begin(reload ? null : oldInfo), main.scrollTop = 0, await Promise.resolve(), g === gen) {
        if (hooks.navDelay) {
          let d = hooks.navDelay();
          if (d && await new Promise((r) => setTimeout(r, d)), g !== gen) return;
        }
        try {
          kind === "home" ? await home(g) : kind === "sec" ? await section(part[0], part[1], part[2], part.slice(3).join("/"), g) : kind === "item" ? await item(part[0], g) : kind === "person" ? await person(part[0], g) : kind === "watchlist" ? watchlistPage(g) : kind === "music" ? await musicPage(g) : kind === "search" ? (pkOpen(part.join("/")), history.replaceState(history.state, "", "#px/home"), await home(g)) : status("Not found");
        } catch (e) {
          g === gen && fail(e, kind);
        }
        g === gen && (doneG = g, swap.end(), back != null && restoreScroll(back, g), srs && pkOpen(srs.q, srs));
      }
    }
    function restoreScroll(y, g, n = 0) {
      main.scrollTop = y, onScroll && onScroll(!0), Math.abs(main.scrollTop - y) > 2 && n < 20 && g === gen && setTimeout(() => restoreScroll(y, g, n + 1), 50);
    }
    addEventListener("hashchange", route), nav.addEventListener("click", (e) => {
      let a = e.target && e.target.closest && e.target.closest('a[href^="#px/"]');
      if (!a || !on) return;
      let href = a.getAttribute("href") || "";
      !href || href === "#px/search" || href === "#px/voice" || href !== location.hash && (gen = ++genMax);
    }, !0);
    let fillT = 0;
    hooks.listen && hooks.listen("plex-merge-fill", () => {
      clearTimeout(fillT), fillT = setTimeout(() => {
        if (!on) return;
        let h = location.hash || "";
        if (!/^#px\/(home|item\/)/.test(h)) return;
        let y = main.scrollTop;
        route().then(() => {
          main.scrollTop = y;
        });
      }, 400);
    });
    function openPersonByName(trigger, name) {
      openPersonLocal(trigger || document.activeElement, { name: String(name || "Unknown"), thumb: "", role: "" }, null);
    }
    return {
      openPersonByName,
      // Called with each source change: Plex → browse views; demo → app.js views.
      setSource(s) {
        let was = on, prev = server;
        srcGen++, homeP = null, homeSg = -1, pc.clear(), on = s && s.kind === "plex", server = on ? String(s.server || "") : "", conn = on ? String(s.connection || "") : "", document.body.classList.toggle("plexmode", on), document.body.classList.toggle("pxsb2", on), nav.hidden = !on, on && requestAnimationFrame(tbH), on ? !was || prev !== server || s.reload ? (sections = [], loadSections(), was && location.hash !== "#px/home" ? go("#px/home") : route()) : renderNav() : (pkClose(), view.hidden = !0, view.textContent = "", nav.textContent = "", document.body.classList.remove("pxroute"), location.hash.startsWith("#px/") && go("#home"));
      }
    };
  }

  // shim/desktop.js
  var SB_MS = 180, TAURI = window.__TAURI_INTERNALS__ ? { core: { invoke }, event: { listen } } : null;
  (function() {
    let T = TAURI;
    if (!T || !T.core) return;
    let invoke2 = T.core.invoke, body = document.body;
    body.classList.add("desktop");
    let sp = document.createElement("div");
    sp.id = "dtSplash", sp.innerHTML = '<img src="brand/plexuw-lockup-dark.svg" alt="PlexUW">', body.appendChild(sp), setTimeout(() => {
      sp.classList.add("out"), setTimeout(() => sp.remove(), 450);
    }, new URLSearchParams(location.search).get("splash") === "hold" ? 1e9 : 1100);
    let ic = { min: '<svg viewBox="0 0 14 14"><path d="M2 7h10"/></svg>', max: '<svg viewBox="0 0 14 14"><rect x="2.5" y="2.5" width="9" height="9"/></svg>', close: '<svg viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8"/></svg>' }, tb = document.createElement("div");
    tb.id = "dtTitle", tb.innerHTML = `<div class="mark" data-tauri-drag-region title="PlexUW"></div><div class="drag" data-tauri-drag-region></div><button class="wb" id="dtMin" title="Minimize">${ic.min}</button><button class="wb" id="dtMax" title="Maximize">${ic.max}</button><button class="wb close" id="dtClose" title="Close">${ic.close}</button>`, body.prepend(tb);
    let W = { min: () => invoke2("win_minimize"), max: () => invoke2("win_toggle_maximize"), close: () => invoke2("win_close"), fs: () => invoke2("win_toggle_fullscreen").then(syncFs) };
    function syncFs(v) {
      typeof v == "boolean" ? body.classList.toggle("fs", v) : invoke2("win_is_fullscreen").then((f) => body.classList.toggle("fs", !!f));
    }
    $("#dtMin").onclick = W.min, $("#dtMax").onclick = W.max, $("#dtClose").onclick = W.close;
    let ptb = document.querySelector("#player .tr");
    ptb && ptb.querySelectorAll("button.tb").forEach((b) => {
      b.title === "Minimize" && (b.onclick = W.min), b.title === "Maximize" && (b.onclick = W.max);
    });
    let bF = document.getElementById("bF");
    bF && (bF.onclick = W.fs), addEventListener("keydown", (e) => {
      e.key === "F11" && (e.preventDefault(), e.stopImmediatePropagation(), W.fs());
    }, !0);
    let pl = document.getElementById("player"), upd = () => body.classList.toggle("inplayer", !!pl && !pl.hidden);
    pl && new MutationObserver(upd).observe(pl, { attributes: !0, attributeFilter: ["hidden"] }), upd(), addEventListener("resize", () => {
      syncFs(), requestAnimationFrame(() => dispatchEvent(new Event("pxrelayout")));
    }), syncFs();
    function media(k) {
      let v = typeof vid < "u" ? vid : null, inP = pl && !pl.hidden;
      k === "MediaPlayPause" ? inP && document.getElementById("play").click() : k === "MediaStop" ? inP && (v && v.pause(), location.hash = "#home") : k === "MediaNextTrack" ? inP && typeof nextEp == "function" && nextEp() && (location.hash = "#player/" + nextEp().id) : k === "MediaPreviousTrack" && inP && v && (v.currentTime > 3 ? v.currentTime = 0 : history.back()), window.__lastMediaKey = k;
    }
    if (window.__plexuwMedia = media, addEventListener("keydown", (e) => {
      /^Media(PlayPause|NextTrack|PreviousTrack|Stop)$/.test(e.key) && (e.preventDefault(), media(e.key));
    }, !0), T.event && T.event.listen("media-key", (ev) => media(ev.payload)), "mediaSession" in navigator) {
      let ms = navigator.mediaSession;
      [["play", "MediaPlayPause"], ["pause", "MediaPlayPause"], ["nexttrack", "MediaNextTrack"], ["previoustrack", "MediaPreviousTrack"], ["stop", "MediaStop"]].forEach(([a, k]) => {
        try {
          ms.setActionHandler(a, () => media(k));
        } catch {
        }
      });
    }
    function $(s) {
      return document.querySelector(s);
    }
  })();
  (function() {
    let T = TAURI;
    if (!T || !T.core) return;
    let invoke2 = T.core.invoke, listen2 = T.event && T.event.listen, el = (tag, cls, text) => {
      let e = document.createElement(tag);
      return cls && (e.className = cls), text != null && (e.textContent = text), e;
    }, btn = (text, cls, fn) => {
      let b = el("button", "px-btn" + (cls ? " " + cls : ""), text);
      return b.type = "button", b.onclick = fn, b;
    }, foot = document.querySelector(".side-foot"), badge = el("button", "px-badge");
    badge.type = "button";
    let cur = null;
    badge.onclick = () => cur && cur.kind === "plex" ? connected(cur) : open(), foot && (foot.textContent = "", foot.appendChild(badge));
    let KIND = { local: "Local", remote: "Remote", manual: "Remote (manual)", relay: "Relay" };
    {
      let tb = document.querySelector("#main>.topbar");
      if (tb) {
        let hold = el("div", "pxhold");
        hold.id = "pxHold", hold.hidden = !0, ["voiceBtn", "activeChips"].forEach((i) => {
          let n = document.getElementById(i);
          n && hold.appendChild(n);
        }), document.body.appendChild(hold), tb.remove();
      }
    }
    let PB = mountPlexBrowse(invoke2, { connect: (s) => connect(s), why: (e) => why(e), profileName: "Scott", profile: () => openAccount(), listen: listen2, watchlist: null });
    document.addEventListener("click", (e) => {
      if (!PB || !PB.openPersonByName) return;
      let a = e.target && e.target.closest && e.target.closest('a.person[href^="#lib/person/"],a[href^="#px/person/"]');
      if (!a) return;
      let href = a.getAttribute("href") || "";
      if (href.startsWith("#lib/person/")) {
        e.preventDefault(), e.stopPropagation();
        let name = "";
        try {
          name = decodeURIComponent(href.slice(12));
        } catch {
          name = href.slice(13);
        }
        PB.openPersonByName(a, name || "Unknown");
      }
    }, !0), window.__pxOpenPerson = (el2, name) => {
      PB && PB.openPersonByName && PB.openPersonByName(el2, name);
    }, (function() {
      let fitDemo = (sec) => {
        let sc = sec.querySelector(".pxsts");
        if (!sc) return;
        let wrap = sec.querySelector(".pxstw");
        if (!wrap) return;
        let card2 = sc.querySelector(".card,.pxcard"), gap = parseFloat(getComputedStyle(sc).columnGap || getComputedStyle(sc).gap) || 0, w = card2 ? card2.getBoundingClientRect().width : 0, unit = w > 0 ? w + gap : 0;
        if (unit <= 0) {
          sc.style.maxWidth = "", sc.style.width = "", delete sc.dataset.pageN;
          return;
        }
        let cs = getComputedStyle(sc), pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0), hostW = sec.clientWidth || wrap.parentElement && wrap.parentElement.clientWidth || wrap.clientWidth, avail = Math.max(0, hostW - 48 - 48 - 8), innerMax = Math.max(0, avail - pad), n = Math.max(1, Math.floor((innerMax + gap) / unit)), pageW = Math.round(n * unit - gap + pad);
        sc.dataset.pageN = String(n);
        let next = pageW + "px";
        if (sc.style.width === next && sc.style.maxWidth === next) return;
        sc.style.maxWidth = next, sc.style.width = next;
        let max = Math.max(0, sc.scrollWidth - sc.clientWidth), sl = Math.round(sc.scrollLeft / unit) * unit;
        Math.abs(sc.scrollLeft - sl) > 0.5 && (sc.scrollLeft = Math.max(0, Math.min(max, sl)));
      }, sync = (sec) => {
        fitDemo(sec);
        let sc = sec.querySelector(".pxsts");
        if (!sc) return;
        let kids = sc.children, sum = 0, gap = parseFloat(getComputedStyle(sc).columnGap || getComputedStyle(sc).gap) || 0;
        for (let i = 0; i < kids.length; i++) sum += kids[i].getBoundingClientRect().width;
        kids.length > 1 && (sum += gap * (kids.length - 1));
        let cs = getComputedStyle(sc);
        sum += (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        let extent = Math.max(sc.scrollWidth, sum), fits = extent <= sc.clientWidth + 2;
        sec.classList.toggle("fits", fits), sec.classList.toggle("atl", sc.scrollLeft <= 2), sec.classList.toggle("atr", sc.scrollLeft + sc.clientWidth >= extent - 2);
      }, wrapRow = (sc) => {
        if (!sc || sc.closest(".pxstw") || sc.classList.contains("pxsts") || !sc.children.length) return;
        let title = sc.previousElementSibling && sc.previousElementSibling.matches("h2.row-title,h2.pxsth") ? sc.previousElementSibling : null, sec = el("section", "pxstrip pxdemo");
        sec.dataset.pxdemo = "1";
        let wrap = el("div", "pxstw"), label = (title && title.textContent || "row").replace(/\s+/g, " ").trim(), page = (dir) => {
          let card2 = sc.querySelector(".card,.pxcard"), gap = parseFloat(getComputedStyle(sc).columnGap || getComputedStyle(sc).gap) || 0, uw = card2 ? card2.getBoundingClientRect().width + gap : Math.max(120, sc.clientWidth * 0.85), n = Math.max(1, +sc.dataset.pageN || Math.floor((sc.clientWidth + gap) / uw)), t = sc.scrollLeft + dir * n * uw, max = Math.max(0, sc.scrollWidth - sc.clientWidth);
          uw > 0 && (t = Math.round(t / uw) * uw), sc.scrollTo({ left: Math.max(0, Math.min(max, t)), behavior: "smooth" });
        }, arr = (d) => {
          let b = el("button", "pxarr " + d);
          return b.type = "button", b.tabIndex = -1, b.setAttribute("aria-label", (d === "l" ? "Scroll left in " : "Scroll right in ") + label), b.appendChild(pxIcon("chev")), b.onclick = (e) => {
            e.preventDefault(), page(d === "l" ? -1 : 1);
          }, b;
        };
        sc.classList.add("pxsts"), title ? (title.replaceWith(sec), sec.appendChild(title)) : sc.replaceWith(sec), wrap.appendChild(arr("l")), wrap.appendChild(sc), wrap.appendChild(arr("r")), sec.appendChild(wrap), sc.addEventListener("scroll", () => sync(sec), { passive: !0 }), typeof ResizeObserver < "u" && new ResizeObserver(() => sync(sec)).observe(sc), requestAnimationFrame(() => sync(sec));
      }, go = () => {
        if (document.body.classList.contains("plexmode")) return;
        let fu7tE1 = "fu7t E1";
        document.querySelectorAll("#homeView .row.hero, #homeView .row:not(.hero), #foryou, #detView .row.hero, #tvView .row.hero, #main .row.hero").forEach((sc) => {
          wrapRow(sc), sc && sc.id === "foryou" && sc.closest(".pxstw") && (sc.closest(".pxstrip").dataset.fu7t = fu7tE1);
        }), document.querySelectorAll(".pxstrip.pxdemo").forEach(sync);
      };
      go(), addEventListener("hashchange", () => setTimeout(go, 0)), addEventListener("resize", () => document.querySelectorAll(".pxstrip.pxdemo").forEach(sync), { passive: !0 }), addEventListener("pxrelayout", () => document.querySelectorAll(".pxstrip.pxdemo").forEach(sync));
      let mainEl = document.getElementById("main");
      mainEl && new MutationObserver(() => go()).observe(mainEl, { childList: !0, subtree: !0 }), new MutationObserver(() => {
        document.body.classList.contains("plexmode") || setTimeout(go, 0);
      }).observe(document.body, { attributes: !0, attributeFilter: ["class"] });
    })();
    {
      let sw = (sel, n) => {
        let h = document.querySelector(sel);
        if (!h) return;
        let o = h.querySelector("svg");
        o ? o.replaceWith(pxIcon(n)) : h.prepend(pxIcon(n));
      };
      sw(".brand .logo", "mark"), sw("#navToggle", "mark"), sw("#askBtn", "ask");
      let ab = document.getElementById("askBtn");
      if (ab) {
        let t = ab.querySelector("span");
        t && (t.textContent = "Ask your library"), ab.setAttribute("aria-label", "Ask your library (Ctrl+K)"), ab.setAttribute("aria-keyshortcuts", "Control+K"), ab.title = "Search or ask your library";
      }
      let pr = document.querySelector(".profile .av");
      pr && pr.setAttribute("aria-hidden", "true");
    }
    let IMG_ORIGIN = location.protocol === "http:" || location.protocol === "https:" ? "http://plexuw.localhost" : "plexuw://localhost", PLACE_NAME = "Scott", PLACE_LETTER = "S", PLACE_SUB = "profile and settings";
    function resetAccountProfile() {
      let av = document.querySelector(".profile .av"), pn = document.querySelector(".profile .pn");
      if (av) {
        for (; av.firstChild; ) av.removeChild(av.firstChild);
        av.textContent = PLACE_LETTER, av.style.backgroundImage = "";
      }
      if (pn) {
        for (; pn.firstChild; ) pn.removeChild(pn.firstChild);
        pn.appendChild(document.createTextNode(PLACE_NAME));
        let s = document.createElement("small");
        s.className = "muted", s.textContent = PLACE_SUB, pn.appendChild(s);
      }
    }
    function applyAccountProfile(p) {
      if (!p || typeof p.name != "string" || !p.name.trim()) {
        resetAccountProfile();
        return;
      }
      let name = p.name.trim(), av = document.querySelector(".profile .av"), pn = document.querySelector(".profile .pn");
      if (pn) {
        for (; pn.firstChild; ) pn.removeChild(pn.firstChild);
        pn.appendChild(document.createTextNode(name));
        let s = document.createElement("small");
        s.className = "muted", s.textContent = PLACE_SUB, pn.appendChild(s);
      }
      if (av) {
        for (; av.firstChild; ) av.removeChild(av.firstChild);
        av.style.backgroundImage = "";
        let letter = (name[0] || "?").toUpperCase(), th = p.thumb;
        if (typeof th == "string" && /^[0-9a-f]{32}$/.test(th)) {
          let i = document.createElement("img");
          i.alt = "", i.decoding = "async", i.src = IMG_ORIGIN + "/img/" + th + "/64x64", i.onerror = () => {
            i.parentNode && i.remove(), av.textContent = letter;
          }, av.appendChild(i);
        } else
          av.textContent = letter;
      }
    }
    listen2 && listen2("plex-profile", (ev) => applyAccountProfile(ev && ev.payload)), invoke2("source_get").then((st) => {
      if (st && st.signedIn) return invoke2("profile_get").then((p) => {
        p && applyAccountProfile(p);
      }).catch(() => {
      });
    }).catch(() => {
    });
    {
      let nav = document.getElementById("nav"), DI = (r) => r === "#home" ? "home" : r === "#settings" ? "gear" : /^#lib\/collections\//.test(r) ? "folder" : /^#lib\//.test(r) ? "film" : /^#tv\//.test(r) ? "tv" : /^#music\/playlist/.test(r) ? "playlist" : /^#music\//.test(r) ? "music" : "", fix = () => {
        nav && nav.querySelectorAll("a[data-r]").forEach((a) => {
          let n = DI(a.dataset.r), o = a.querySelector("svg");
          if (!(!n || !o || o.classList.contains("pxi")) && (o.replaceWith(pxIcon(n)), /collections\/|playlist\//.test(a.dataset.r))) {
            let t = (a.querySelector("span") || a).textContent.trim();
            a.dataset.ini = (t.match(/[A-Za-z0-9]/) || [""])[0].toUpperCase(), a.classList.add("pxini");
          }
        });
      };
      fix(), nav && new MutationObserver(fix).observe(nav, { childList: !0 });
      let tg = document.getElementById("navToggle"), lab = () => {
        if (!tg) return;
        let c2 = document.body.classList.contains("navc") || matchMedia("(max-width:1599px)").matches && !document.body.classList.contains("navo"), t = (c2 ? "Expand" : "Collapse") + " sidebar";
        tg.title !== t && (tg.title = t, tg.setAttribute("aria-label", t), tg.setAttribute("aria-expanded", String(!c2)));
      };
      lab(), new MutationObserver(lab).observe(document.body, { attributes: !0, attributeFilter: ["class"] }), addEventListener("resize", lab), tg && tg.addEventListener("click", () => setTimeout(lab, 0));
    }
    {
      let railC = () => document.body.classList.contains("navc") || matchMedia("(max-width:1599px)").matches && !document.body.classList.contains("navo"), sb = document.querySelector(".sidebar"), mn = document.getElementById("main"), lg = document.querySelector(".brand .logo"), tg = document.getElementById("navToggle");
      if (tg) {
        let o = tg.querySelector("svg");
        o && o.replaceWith(pxIcon("collapse"));
      }
      if (lg) {
        lg.setAttribute("role", "button"), lg.tabIndex = 0, lg.dataset.tip = "Expand sidebar";
        let go = () => {
          tg && tg.click();
        };
        lg.addEventListener("click", go), lg.addEventListener("keydown", (e) => {
          (e.key === "Enter" || e.key === " ") && (e.preventDefault(), go());
        });
      }
      let syncLogo = () => {
        if (!lg) return;
        let c2 = railC();
        lg.removeAttribute("title"), lg.tabIndex = 0, c2 ? (lg.dataset.tip = "Expand sidebar", lg.setAttribute("aria-label", "Expand sidebar"), lg.setAttribute("aria-expanded", "false")) : (delete lg.dataset.tip, lg.setAttribute("aria-label", "Collapse sidebar"), lg.setAttribute("aria-expanded", "true"));
      };
      {
        let br = document.querySelector(".sidebar .brand");
        br && [...br.childNodes].forEach((n) => {
          if (n.nodeType === 3 && n.textContent.trim()) {
            let t = document.createElement("span");
            t.className = "pxbt", t.textContent = n.textContent.trim(), n.replaceWith(t);
          }
        });
      }
      let sbAnimT = 0, ml0 = 0, s20 = document.body.classList.contains("pxsb2"), w0 = sb ? sb.getBoundingClientRect().width : 0, c0 = document.body.classList.contains("navc");
      syncLogo(), sb && new MutationObserver(() => {
        let c2 = document.body.classList.contains("navc"), s2 = document.body.classList.contains("pxsb2");
        if (requestAnimationFrame(syncLogo), s2 !== s20) {
          s20 = s2, c0 = c2, ml0 = document.body.classList.contains("navc") || innerWidth < 1600 && !document.body.classList.contains("navo") ? 64 : 240;
          return;
        }
        if (c2 === c0) return;
        if (c0 = c2, document.body.classList.contains("pxsb2")) {
          if (!mn) return;
          let ml1 = (() => {
            let b = document.body.classList;
            return b.contains("navc") || innerWidth < 1600 && !b.contains("navo") ? 64 : 240;
          })(), dd = ml0 - ml1;
          if (ml0 = ml1, !dd || matchMedia("(prefers-reduced-motion: reduce)").matches || !mn.animate) return;
          mn.animate([{ transform: `translateX(${dd}px)` }, { transform: "none" }], { duration: SB_MS, easing: "cubic-bezier(.2,.8,.2,1)" });
          return;
        }
        let w1 = sb.getBoundingClientRect().width, d = w0 - w1;
        if (w0 = w1, !d || matchMedia("(prefers-reduced-motion: reduce)").matches || !sb.animate) return;
        let o = { duration: SB_MS, easing: "ease-out" };
        sb.classList.add("pxanim");
        let fin = [];
        mn && fin.push(mn.animate([{ transform: `translateX(${d}px)` }, { transform: "none" }], o).finished), c2 || fin.push(sb.animate([{ clipPath: `inset(0 ${-d}px 0 0)` }, { clipPath: "inset(0 0 0 0)" }], o).finished), [...sb.children].forEach((k) => fin.push(k.animate([{ opacity: 0, transform: `translateX(${c2 ? 12 : -12}px)` }, { opacity: 1, transform: "none" }], o).finished)), Promise.allSettled(fin).then(() => sb.classList.remove("pxanim"));
      }).observe(document.body, { attributes: !0, attributeFilter: ["class"] }), addEventListener("resize", () => {
        syncLogo(), sb && (w0 = sb.getBoundingClientRect().width), document.body.classList.contains("pxsb2") && (ml0 = document.body.classList.contains("navc") || innerWidth < 1600 && !document.body.classList.contains("navo") ? 64 : 240);
      });
    }
    {
      let tg = document.getElementById("navToggle"), narrow = () => matchMedia("(max-width:1599px)").matches, scrim = null, shut = () => {
        document.body.classList.remove("navo"), scrim && scrim.remove(), scrim = null;
      };
      tg && tg.addEventListener("click", (e) => {
        if (narrow()) {
          if (e.preventDefault(), e.stopImmediatePropagation(), document.body.classList.contains("navo")) return shut();
          document.body.classList.add("navo"), scrim = el("div", "pxnavscrim"), scrim.onclick = shut, document.body.appendChild(scrim);
        }
      }, !0), addEventListener("keydown", (e) => {
        e.key === "Escape" && document.body.classList.contains("navo") && (e.stopImmediatePropagation(), shut());
      }, !0), addEventListener("hashchange", shut), addEventListener("resize", () => {
        narrow() || shut();
      });
    }
    {
      let ck = el("div", "pxclock");
      ck.setAttribute("aria-hidden", "true"), document.body.appendChild(ck);
      let ckOn = () => localStorage.getItem("pxShowClock") !== "0";
      document.body.classList.toggle("pxnoclock", !ckOn());
      let tick = () => {
        ck.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      };
      tick(), setInterval(tick, 15e3);
    }
    function showSource(s) {
      cur = s, PB && PB.setSource(s), badge.textContent = "", badge.classList.toggle("demo", s.kind === "demo"), s.kind === "demo" ? (badge.appendChild(el("span", "px-dot")), badge.appendChild(el("b", null, "Demo data")), badge.appendChild(el("span", "px-sub", s.reason === "offline" ? "Server unreachable" : "Connect to Plex"))) : (badge.appendChild(el("span", "px-dot on")), badge.appendChild(el("b", null, s.server)), badge.appendChild(el("span", "px-chip " + s.connection, KIND[s.connection] || s.connection)));
    }
    let ov = el("div");
    ov.id = "pxOverlay", ov.hidden = !0;
    let card = el("div", "px-card");
    ov.appendChild(card), document.body.appendChild(ov);
    let pinUp = !1;
    ov.addEventListener("click", (e) => {
      e.target === ov && !pinUp && close();
    }), addEventListener("keydown", (e) => {
      e.key === "Escape" && !ov.hidden && (e.stopImmediatePropagation(), pinUp ? pinCancel() : close());
    }, !0);
    let pinTimer = null;
    function pinCancel() {
      pinUp = !1, clearInterval(pinTimer), invoke2("auth_cancel"), welcome();
    }
    function close() {
      pinUp = !1, ov.hidden = !0, clearInterval(pinTimer), invoke2("auth_cancel");
    }
    function screen(title, sub) {
      return clearInterval(pinTimer), pinUp = !1, card.textContent = "", ov.hidden = !1, card.appendChild(el("h2", null, title)), sub && card.appendChild(el("p", "px-sub", sub)), card;
    }
    async function open() {
      let st = await invoke2("source_get");
      return st.keychain === "unavailable" ? keychain() : st.signedIn ? auto() : welcome(st);
    }
    async function auto() {
      let list;
      try {
        list = await invoke2("servers_list");
      } catch (e) {
        return error(why(e));
      }
      let best = list.find((s) => s.owned && s.online) || list.find((s) => s.online) || list[0];
      if (!best) {
        let c2 = screen("No servers on this account", "Add a server by address in Settings \u2192 Account & server."), row = el("div", "px-row");
        row.appendChild(btn("Open settings", "primary", () => {
          close(), openAccount();
        })), row.appendChild(btn("Close", "", close)), c2.appendChild(row);
        return;
      }
      connect(best, null, !0);
    }
    function welcome() {
      let c2 = screen("Connect to Plex", "Sign in with your Plex account to browse your own libraries. Your token is kept in the system keychain and never shown here."), row = el("div", "px-row");
      row.appendChild(btn("Sign in with Plex", "primary", () => start())), row.appendChild(btn("Keep using demo data", "", async () => {
        showSource(await invoke2("use_demo")), close();
      })), c2.appendChild(row);
    }
    async function start() {
      let p;
      try {
        p = await invoke2("auth_start", { strong: !1 });
      } catch (e) {
        return error(why(e));
      }
      let c2 = screen("Sign in to Plex", p.browserOpened ? "We opened plex.tv in your browser. Approve PlexUW there, or on any device go to plex.tv/link and enter this code:" : "On any device, go to plex.tv/link and enter this code:");
      c2.appendChild(el("div", "px-code", p.code)), c2.appendChild(el("p", "px-link", "plex.tv/link"));
      let t = el("p", "px-sub px-timer");
      c2.appendChild(t);
      let left = p.expiresIn, tick = () => {
        if (left <= 0) {
          expired();
          return;
        }
        t.textContent = "Waiting for approval \xB7 code expires in " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0"), left--;
      };
      tick(), pinTimer = setInterval(tick, 1e3), pinUp = !0;
      let row = el("div", "px-row");
      row.appendChild(btn("Cancel", "", pinCancel)), c2.appendChild(row);
    }
    function expired() {
      let c2 = screen("That code expired", "Codes are short-lived for safety."), row = el("div", "px-row");
      row.appendChild(btn("Get a new code", "primary", () => start())), row.appendChild(btn("Cancel", "", close)), c2.appendChild(row);
    }
    function keychain() {
      let linux = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent), c2 = screen("Couldn\u2019t save your sign-in", linux ? "PlexUW couldn\u2019t save your sign-in securely. Your system has no keyring service running (for example GNOME Keyring or KWallet). Install or unlock one, then try again." : "PlexUW couldn\u2019t save your sign-in securely because the system credential store didn\u2019t respond. Try again.");
      c2.appendChild(el("p", "px-sub", "Nothing was saved to disk."));
      let row = el("div", "px-row");
      row.appendChild(btn("Retry", "primary", () => open())), row.appendChild(btn("Use demo data", "", async () => {
        showSource(await invoke2("use_demo")), close();
      })), c2.appendChild(row);
    }
    let WHY = {
      unreachable: "None of this server\u2019s addresses answered. Check that the server is on and reachable.",
      timeout: "The server took too long to answer (over 5 seconds per address).",
      tls: "The server\u2019s secure connection could not be verified, so nothing was sent.",
      "not-on-account": "That server isn\u2019t on your Plex account.",
      "signed-out": "You\u2019re signed out of Plex. Sign in again.",
      blocked: "The connection was blocked: the address redirected or returned a page that isn\u2019t a Plex server (for example a login or challenge page).",
      keychain: "The system keychain reported an error.",
      "keychain-unavailable": "No system keychain is available.",
      "keychain-toolong": "The system keychain refused the sign-in data because it is too large.",
      "keychain-timeout": "The system keychain didn\u2019t respond in time.",
      "keychain-stale": "Sign-in was cancelled because you signed out while it was saving.",
      "keychain-missing": "Saved sign-in data in the system keychain is incomplete. Sign in again.",
      "signout-incomplete": "Some saved sign-in data could not be removed from the system keychain. Try signing out again.",
      "bad-address": "Enter an https address like plex.example.com."
    }, why = (e) => WHY[String(e)] || "Something went wrong. Try again.";
    function error(msg) {
      let c2 = screen("Something went wrong", msg), row = el("div", "px-row");
      row.appendChild(btn("Try again", "primary", () => open())), row.appendChild(btn("Close", "", close)), c2.appendChild(row);
    }
    async function servers() {
      let c2 = screen("Your servers", "All online servers stay in your library at once. Pick one to prefer for Play \u2014 the others keep merging.");
      try {
        await invoke2("servers_warm");
      } catch {
      }
      let list;
      try {
        list = await invoke2("servers_list");
      } catch (e) {
        return error(why(e));
      }
      let online = list.filter((s) => s.online).length, reachable = list.filter((s) => s.reachable).length;
      online > 1 && c2.appendChild(el("p", "px-sub", "Browsing " + online + " online servers together (like other Plex players)" + (reachable ? "; " + reachable + " reachable now." : ".")));
      let ul = el("div", "px-list");
      list.forEach((s) => {
        let it = el("button", "px-srv");
        it.type = "button", it.appendChild(el("span", "px-dot" + (s.online ? " on" : "")));
        let n = el("span", "px-name", s.name);
        it.appendChild(n), it.appendChild(el("span", "px-tag", s.owned ? "Owned" : "Shared")), it.appendChild(el("span", "px-tag", s.online ? "Online" : "Offline")), s.reachable ? it.appendChild(el("span", "px-tag", "Reachable")) : s.online && it.appendChild(el("span", "px-tag", "In library")), it.onclick = () => connect(s), ul.appendChild(it);
      }), list.length || ul.appendChild(el("p", "px-sub", "No servers on this account.")), c2.appendChild(ul);
      let prefs = await invoke2("prefs_get"), man = el("div", "px-manual");
      man.appendChild(el("label", null, "Or connect by address"));
      let inp = el("input");
      inp.value = prefs.manualHost || "", inp.placeholder = "https://plex.example.com", inp.spellcheck = !1, man.appendChild(inp);
      let msg = el("p", "px-sub");
      man.appendChild(btn("Check", "", async () => {
        msg.textContent = "Checking\u2026";
        try {
          let r = await invoke2("manual_probe", { host: inp.value }), go = () => {
            msg.textContent = "Found " + (r.name || "your server") + ".";
            let s = list.find((x) => x.id === r.id);
            s && connect(s);
          };
          if (!r.needsConfirm) {
            go();
            return;
          }
          for (; ask.firstChild; ) ask.removeChild(ask.firstChild);
          ask.appendChild(el("p", "px-sub", r.host + " answers as " + (r.name || "your server") + " but is not one of its addresses on your Plex account. Send your server token to " + r.host + "?")), ask.appendChild(btn("Allow", "primary", async () => {
            ask.textContent = "", await invoke2("manual_confirm", { allow: !0 }) && go();
          })), ask.appendChild(btn("Don't allow", "", async () => {
            ask.textContent = "", await invoke2("manual_confirm", { allow: !1 }), msg.textContent = "Not connected. Your token was not sent.";
          })), msg.textContent = "";
        } catch (e) {
          msg.textContent = why(e);
        }
      }));
      let ask = el("div", "px-row px-ask");
      man.appendChild(ask), c2.appendChild(man), c2.appendChild(msg);
      let row = el("div", "px-row");
      row.appendChild(btn("Sign out", "", async () => {
        try {
          showSource(await invoke2("sign_out")), clearAvail(localStorage), resetAccountProfile(), welcome();
        } catch (e) {
          error(why(e));
        }
      })), row.appendChild(btn("Close", "", close)), c2.appendChild(row);
    }
    async function connect(s, hold, quiet) {
      let c2 = screen("Connecting to " + s.name, "Trying every address at once: local and your saved address first, then remote, then relay."), pr = el("p", "px-sub px-progress"), sp = el("span", "pxspin");
      sp.setAttribute("aria-hidden", "true"), pr.appendChild(sp);
      let pt = el("span", null, "Connecting\u2026 0 s");
      pr.appendChild(pt), pr.setAttribute("role", "status"), c2.appendChild(pr);
      let secs = 0;
      pinTimer = setInterval(() => {
        secs++, pt.textContent = "Connecting\u2026 " + secs + " s" + (secs >= 4 ? " (relay can take a few more seconds)" : "");
      }, 1e3);
      let cancelled = !1, row = el("div", "px-row");
      row.appendChild(btn("Cancel", "", async () => {
        cancelled = !0, clearInterval(pinTimer);
        try {
          showSource(await invoke2("server_connect_cancel"));
        } catch {
        }
        close();
      })), c2.appendChild(row);
      try {
        if (hold && await hold, cancelled) return;
        let v = await invoke2("server_connect", { id: s.id });
        if (cancelled) return;
        clearInterval(pinTimer), showSource(v);
        try {
          invoke2("servers_warm").catch(() => {
          });
        } catch {
        }
        quiet && v.connection !== "relay" ? close() : connected(v);
      } catch (e) {
        if (cancelled || String(e) === "cancelled") return;
        clearInterval(pinTimer), showSource({ kind: "demo", reason: "offline" }), error(why(e));
      }
    }
    function connected(v) {
      let c2 = screen("Connected \xB7 " + v.server, null), chip = el("p", null);
      if (chip.appendChild(el("span", "px-chip " + v.connection, KIND[v.connection] || v.connection)), c2.appendChild(chip), v.connection === "relay") {
        let d = el("details", "px-why");
        d.appendChild(el("summary", null, "Why relay?")), d.appendChild(el("p", "px-sub", "PlexUW couldn\u2019t reach your server directly, so traffic goes through Plex\u2019s relay. Relay is slower and limited to roughly 2 Mbps (approximate; Plex sets the limit). Enabling remote access on the server, or adding its address under \u201CConnect by address\u201D, avoids it.")), c2.appendChild(d);
      }
      c2.appendChild(el("p", "px-sub", "Preferred for Play: " + v.server + ". Every other online server stays in your library \u2014 titles list Versions / Watch from across all of them."));
      let row = el("div", "px-row");
      row.appendChild(btn("Done", "primary", close)), row.appendChild(btn("Account settings", "", () => {
        close(), openAccount();
      })), c2.appendChild(row);
    }
    listen2 && (listen2("plex-auth", (ev) => {
      let s = ev.payload.state;
      s === "signed-in" ? auto() : s === "expired" ? expired() : s === "keychain-unavailable" ? keychain() : s === "error" && error(ev.payload.message ? why(ev.payload.message) : "Sign-in failed.");
    }), listen2("plex-source", (ev) => showSource(ev.payload))), invoke2("source_get").then((st) => showSource(st.source));
    let QP = [["original", "Original (no conversion)"], ["20mbps-1080p", "20 Mbps 1080p"], ["12mbps-1080p", "12 Mbps 1080p"], ["8mbps-1080p", "8 Mbps 1080p"], ["4mbps-720p", "4 Mbps 720p"], ["2mbps-720p", "2 Mbps 720p"], ["1.5mbps-480p", "1.5 Mbps 480p"], ["0.7mbps-328p", "0.7 Mbps 328p"]], setView = document.getElementById("setView");
    async function buildSettings() {
      if (!setView) return;
      let pr = await invoke2("prefs_get"), save = async (patch) => {
        pr = await invoke2("prefs_set", { patch }), fill(), dispatchEvent(new CustomEvent("pxprefs", { detail: pr }));
      }, sec = (id, title, sub) => {
        let s = el("section", "setcard");
        s.id = id;
        let h = el("h3", null, title);
        return sub && (h.appendChild(document.createTextNode(" ")), h.appendChild(el("span", "muted small", sub))), s.appendChild(h), s;
      }, row = (label, ctl) => {
        let r = el("div", "frow"), l = el("label", null, label);
        return l.htmlFor = ctl.id, r.appendChild(l), r.appendChild(ctl), r;
      }, sel = (id, opts, key) => {
        let x = el("select");
        return x.id = id, opts.forEach(([v, t]) => {
          let o = el("option", null, t);
          o.value = v, x.appendChild(o);
        }), x.onchange = () => save({ [key]: x.value }), x;
      }, tog = (id, label, hint, key) => {
        let l = el("label", "switch"), i = el("input");
        i.type = "checkbox", i.id = id, i.onchange = () => save({ [key]: i.checked }), l.appendChild(i);
        let sp = el("span", null, label + " ");
        return sp.appendChild(el("i", "muted small", hint)), l.appendChild(sp), l;
      }, s0 = sec("pxAccount", "Account & server"), acct = el("div", "pxacct");
      s0.appendChild(acct);
      let fillAcct = async () => {
        acct.textContent = "";
        let st;
        try {
          st = await invoke2("source_get");
        } catch {
          return;
        }
        let s = st.source || {}, r = el("div", "px-row");
        if (s.kind === "plex") {
          let p = el("p", null);
          p.appendChild(el("span", "px-dot on")), p.appendChild(el("b", null, " Prefer \xB7 " + s.server + " ")), p.appendChild(el("span", "px-chip " + s.connection, KIND[s.connection] || s.connection)), acct.appendChild(p);
        } else acct.appendChild(el("p", "muted", st.signedIn ? "Signed in \xB7 no server connected" : "Not signed in \xB7 showing demo data"));
        if (st.signedIn) {
          try {
            let online = (await invoke2("servers_list")).filter((x) => x.online);
            if (online.length) {
              acct.appendChild(el("p", "muted small", "Browsing " + online.length + " online server" + (online.length === 1 ? "" : "s") + " at once"));
              let ul = el("ul", "pxacctsrv");
              online.forEach((x) => {
                let li = el("li", null, x.name + (x.owned ? "" : " \xB7 shared") + (s.kind === "plex" && s.server === x.name ? " \xB7 preferred" : ""));
                ul.appendChild(li);
              }), acct.appendChild(ul);
            }
          } catch {
          }
          r.appendChild(btn("Manage servers", "primary", servers)), r.appendChild(btn("Sign out", "", async () => {
            try {
              showSource(await invoke2("sign_out")), clearAvail(localStorage), resetAccountProfile(), fillAcct();
            } catch (e) {
              error(why(e));
            }
          }));
        } else r.appendChild(btn("Sign in with Plex", "primary", () => start()));
        acct.appendChild(r);
      };
      fillAcct(), addEventListener("hashchange", () => {
        location.hash === "#settings" && fillAcct();
      });
      let s1 = sec("pxServer", "Server & streaming", "quality presets like the Plex app; limits come from your Plex dashboard"), ql = sel("pxQLocal", QP, "localQuality"), qr = sel("pxQRemote", QP, "remoteQuality"), qy = sel("pxQRelay", QP, "relayQuality");
      s1.appendChild(row("Local quality", ql)), s1.appendChild(row("Remote quality", qr)), s1.appendChild(row("Relay quality", qy));
      let mh = el("input");
      mh.id = "pxManual", mh.spellcheck = !1, mh.placeholder = "https://plex.example.com", mh.onchange = () => save({ manualHost: mh.value.trim() }), s1.appendChild(row("Server address (optional)", mh)), s1.appendChild(el("p", "note small", "Used when automatic discovery can\u2019t reach your server. Checked without your sign-in first; https only."));
      let s2 = sec("pxSkip", "Skip intro, recap & credits"), sm = sel("pxSkipMode", [["prompt", "Show a Skip prompt"], ["skip-automatically", "Skip automatically"]], null);
      sm.onchange = () => save({ skipIntro: sm.value, skipRecap: sm.value, skipCredits: sm.value }), s2.appendChild(row("When a marker starts", sm));
      let ss = el("input");
      ss.id = "pxSkipSecs", ss.type = "range", ss.min = "10", ss.max = "20", ss.step = "1";
      let sv = el("span", "muted small");
      ss.oninput = () => {
        sv.textContent = ss.value + " s";
      }, ss.onchange = () => save({ skipPromptSeconds: Number(ss.value) });
      let sw = el("div", "trow");
      sw.appendChild(ss), sw.appendChild(sv);
      let sr = row("Prompt stays visible", sw);
      sr.querySelector("label").htmlFor = "pxSkipSecs", s2.appendChild(sr);
      let sA = sec("pxAppearance", "Appearance");
      {
        let l = el("label", "switch"), i = el("input");
        i.type = "checkbox", i.id = "pxShowClock", i.checked = localStorage.getItem("pxShowClock") !== "0", i.onchange = () => {
          localStorage.setItem("pxShowClock", i.checked ? "1" : "0"), document.body.classList.toggle("pxnoclock", !i.checked);
        }, l.appendChild(i);
        let sp = el("span", null, "Show clock ");
        sp.appendChild(el("i", "muted small", "top-right corner \xB7 hidden during playback \xB7 default on")), l.appendChild(sp), sA.appendChild(l);
      }
      let s3 = sec("pxWindow", "Window"), cq = el("p", "note small", "Closing the window quits PlexUW."), tt = tog("pxTray", "Minimize to tray", "off by default \xB7 closing hides PlexUW to the tray instead of quitting", "minimizeToTray"), tp = tog("pxPip", "Picture-in-picture", "off by default \xB7 lets the player pop out into a small window", "pictureInPicture");
      s3.appendChild(cq), s3.appendChild(tt), s3.appendChild(tp), s3.appendChild(el("p", "note small", "Saved now; tray and picture-in-picture behaviour arrive in a later milestone."));
      let s4 = sec("pxPlayback", "Playback");
      s4.appendChild(tog("pxTheme", "Play theme music on detail pages", "fades in on a title page, never loops, never on Home or library pages", "themeMusic"));
      let tv = el("input");
      tv.id = "pxThemeVol", tv.type = "range", tv.min = "0", tv.max = "100", tv.step = "5";
      let tvl = el("span", "muted small");
      tv.oninput = () => {
        tvl.textContent = tv.value + "%";
      }, tv.onchange = () => save({ themeVolume: Number(tv.value) });
      let tw = el("div", "trow");
      tw.appendChild(tv), tw.appendChild(tvl), s4.appendChild(row("Theme music volume", tw));
      let s5 = sec("pxStorage", "Storage", "posters and art are cached on this computer"), CS = [[256, "256 MB"], [512, "512 MB"], [1024, "1 GB"], [2048, "2 GB"], [5120, "5 GB"], [10240, "10 GB"]], cz = el("select");
      cz.id = "pxCacheMax", CS.forEach(([v, t]) => {
        let o = el("option", null, t);
        o.value = String(v), cz.appendChild(o);
      }), cz.onchange = () => save({ cacheMaxMb: Number(cz.value) }).then(cinfo), s5.appendChild(row("Image cache size", cz));
      let cu = el("p", "note small pxcacheuse");
      s5.appendChild(cu);
      let cinfo = async () => {
        try {
          let c2 = await invoke2("cache_info"), mb = c2.bytes / 1048576;
          cu.textContent = "Using " + (mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB") + " \xB7 " + c2.files + " files";
        } catch {
          cu.textContent = "";
        }
      };
      s5.appendChild(tog("pxClearOnSignOut", "Clear cache on sign-out", "when on, Sign out also deletes posters, art and theme audio cached on this computer", "clearCacheOnSignOut"));
      let cr = el("div", "px-row");
      cr.appendChild(btn("Clear cache", "", async () => {
        try {
          await invoke2("cache_clear");
        } catch {
        }
        cinfo();
      })), s5.appendChild(cr), cinfo(), addEventListener("hashchange", () => {
        location.hash === "#settings" && cinfo();
      });
      function fill() {
        ql.value = pr.localQuality, qr.value = pr.remoteQuality, qy.value = pr.relayQuality, document.activeElement !== mh && (mh.value = pr.manualHost || ""), sm.value = pr.skipIntro, ss.value = String(pr.skipPromptSeconds), sv.textContent = pr.skipPromptSeconds + " s", ss.disabled = pr.skipIntro !== "prompt", document.getElementById("pxTray").checked = !!pr.minimizeToTray, document.getElementById("pxPip").checked = !!pr.pictureInPicture, document.getElementById("pxTheme").checked = pr.themeMusic !== !1;
        let cos = document.getElementById("pxClearOnSignOut");
        cos && (cos.checked = pr.clearCacheOnSignOut !== !1), tv.value = String(pr.themeVolume ?? 30), tvl.textContent = tv.value + "%", tv.disabled = pr.themeMusic === !1, cz.value = String(pr.cacheMaxMb ?? 1024), cq.textContent = pr.minimizeToTray ? "Closing the window hides PlexUW to the tray." : "Closing the window quits PlexUW.";
      }
      let h2 = setView.querySelector(".row-title"), after = h2 ? h2.nextSibling : null, sB = sec("pxAbout", "About");
      {
        let ab = el("p", "small pxabout", "PlexUW");
        ab.id = "pxAboutInfo", sB.appendChild(ab), invoke2("build_info").then((b) => {
          ab.textContent = "";
          let ln = (k, v) => {
            let d = el("div", null, k + " "), c2 = el("code", null, v);
            d.appendChild(c2), ab.appendChild(d);
          };
          ln("Version", b.version), ln("Build", b.sha), ln("Frontend", b.dist.slice(0, 16)), ab.title = "Frontend SHA-256 " + b.dist;
        }).catch(() => {
        });
      }
      [s0, s1, s4, sA, s2, s3, s5, sB].forEach((x) => setView.insertBefore(x, after)), fill();
    }
    buildSettings(), (function() {
      let vid2 = document.getElementById("vid");
      if (!vid2) return;
      let lastKey = "", sample = "assets/sample.mp4", stop = () => {
        try {
          invoke2("playback_stop");
        } catch {
        }
        lastKey = "";
      }, run = async () => {
        if (!location.hash.startsWith("#player")) {
          lastKey && (stop(), vid2.getAttribute("src") && !String(vid2.getAttribute("src")).includes("sample.mp4") && (vid2.removeAttribute("src"), vid2.load()));
          return;
        }
        let px = null;
        try {
          px = JSON.parse(sessionStorage.getItem("pxPlayCtx") || "null");
        } catch {
          px = null;
        }
        if (!px || !px.plexId) {
          lastKey && stop();
          return;
        }
        let key = String(px.plexId) + "|" + String(px.versionId || "");
        if (key !== lastKey) {
          lastKey = key;
          try {
            let r = await invoke2("play_start", { id: px.plexId, versionId: px.versionId || null }), mid = r && (r.id || r.mediaId);
            if (!mid || !/^[0-9a-f]{32}$/.test(mid)) throw new Error("bad media id");
            vid2.src = IMG_ORIGIN + "/media/" + mid, vid2.play().catch(() => {
            });
          } catch (e) {
            console.warn("play_start", e), lastKey = "";
          }
        }
      };
      addEventListener("hashchange", () => {
        run();
      });
      let back = document.getElementById("backBtn") || document.querySelector("#player [data-back],#player .back");
      run();
    })(), (function() {
      let k = document.getElementById("aiKey"), pv = document.getElementById("aiProv"), cl = document.getElementById("aiClear"), stt = document.getElementById("aiStatus");
      if (!k || !pv) return;
      let provs = ["xai", "openai", "openrouter", "self"], warn = (t) => {
        stt.textContent = t;
      };
      invoke2("ai_migration_failed").then((f) => {
        f && warn("A saved AI key could not be moved to the system keychain. Please enter it again.");
      }).catch(() => {
      }), provs.forEach((p) => {
        let ls = "plexuw.ai.key:" + p, v = localStorage.getItem(ls);
        if (v) {
          if (new TextEncoder().encode(v).length > 512) {
            localStorage.removeItem(ls), warn("A saved AI key was invalid and has been removed. Please enter it again.");
            return;
          }
          invoke2("ai_key_set", { provider: p, key: v }).then(() => localStorage.removeItem(ls)).catch(() => warn("A saved AI key could not be moved to the system keychain. It stays in local app storage and will be retried next start."));
        }
      });
      let show = async () => {
        k.value = "";
        let has = await invoke2("ai_key_has", { provider: pv.value });
        k.placeholder = has ? "Saved in the system keychain \xB7 type to replace" : "Paste your key (saved in the system keychain)";
      }, tmr = null;
      k.oninput = () => {
        clearTimeout(tmr), tmr = setTimeout(async () => {
          let v = k.value;
          try {
            await invoke2("ai_key_set", { provider: pv.value, key: v }), k.value = "", stt.textContent = v ? "Saved to keychain" : "", show();
          } catch (e) {
            stt.textContent = String(e) === "keychain-unavailable" ? "Keychain unavailable; key not saved" : "Key not saved";
          }
        }, 700);
      }, cl.onclick = async () => {
        await invoke2("ai_key_set", { provider: pv.value, key: "" }).catch(() => {
        }), stt.textContent = "Key cleared", show();
      }, pv.addEventListener("change", show), show();
      let note = document.querySelector("#aiProvider .note");
      note && (note.textContent = "Mock: the key is kept in the OS keychain (Credential Manager / Keychain / Secret Service), never in localStorage, never logged, put in a URL or sent anywhere. Test connection returns a mock result without any network request.");
    })();
    {
      let tm = /* @__PURE__ */ new WeakMap();
      document.addEventListener("scroll", (e) => {
        let t = e.target === document ? document.documentElement : e.target;
        t instanceof Element && (t.classList.add("px-scrolling"), clearTimeout(tm.get(t)), tm.set(t, setTimeout(() => t.classList.remove("px-scrolling"), 900)));
      }, { capture: !0, passive: !0 });
    }
    function openAccount() {
      location.hash = "#settings", setTimeout(() => document.getElementById("pxAccount")?.scrollIntoView({ block: "start" }), 250);
    }
    function openSettings() {
      location.hash = "#settings";
    }
    let prof = document.querySelector(".profile");
    document.querySelectorAll("#nav a.navset,#pxSettings").forEach((e) => e.remove());
    {
      let nv = document.getElementById("nav");
      nv && new MutationObserver(() => nv.querySelectorAll("a.navset").forEach((e) => e.remove())).observe(nv, { childList: !0 });
    }
    document.getElementById("pxProfileHover")?.remove(), window.__pxProfileMenu = { open() {
    }, close() {
    } }, prof && (prof.setAttribute("role", "button"), prof.tabIndex = 0, prof.removeAttribute("title"), prof.removeAttribute("aria-haspopup"), prof.removeAttribute("aria-controls"), prof.removeAttribute("aria-expanded"), prof.dataset.label = "profile and settings", prof.setAttribute("aria-label", "profile and settings"), prof.style.cursor = "pointer", prof.addEventListener("click", (e) => {
      e.stopPropagation(), openSettings();
    }), prof.addEventListener("keydown", (e) => {
      (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openSettings());
    }));
  })();
})();
