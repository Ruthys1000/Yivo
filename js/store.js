/* Progress storage (localStorage) and spaced repetition. */
(function () {
  const Y = window.Y;
  const KEY = 'yivo.v1';
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90];

  const blank = () => ({ units: {}, srs: {}, days: {}, mywords: [], mistakes: [], diag: null, best: {}, personal: [], lastExport: 0, read: {}, flags: [], track: {}, acc: {}, snap: {}, gerr: {}, gcheck: {}, settings: { strict: false, track: 'course', apiKey: '', model: 'claude-opus-5-5' } });

  let S = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) S = Object.assign(blank(), JSON.parse(raw));
    S.settings = Object.assign(blank().settings, S.settings || {});
  } catch (e) { /* storage unavailable: run in memory */ }

  const save = () => {
    S.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    if (store && store.onChange) store.onChange();
  };

  const dayNum = (d) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  const today = () => dayNum(new Date());

  let store = null;
  store = (Y.store = {
    onChange: null,
    today,
    get state() { return S; },
    save,
    settings: () => S.settings,
    setSetting(k, v) { S.settings[k] = v; save(); },

    unit(id) {
      if (!S.units[id]) S.units[id] = { hist: [], ok: {} };
      const u = S.units[id];
      if (!u.okDays) u.okDays = [];
      return u;
    },
    /* Mastery 0..1, or null if not started.
       A unit only counts as mastered after good sessions on three different days,
       and the score fades when the unit has not been practised for weeks. */
    mastery(id) {
      const info = store.masteryInfo(id);
      return info ? info.score : null;
    },
    masteryInfo(id) {
      const u = S.units[id];
      if (!u || !u.hist.length) return null;
      const sum = u.hist.reduce((a, b) => a + b, 0);
      const acc = (sum / u.hist.length) * Math.min(1, u.hist.length / 8);
      const days = Math.min(3, (u.okDays || []).length);
      const idle = u.last ? today() - u.last : 0;
      const fade = idle > 45 ? 0.7 : idle > 21 ? 0.85 : 1;
      return { score: acc * [0.55, 0.75, 0.9, 1][days] * fade, acc, days, fade, stale: idle > 21 };
    },

    srs: (key) => S.srs[key] || null,
    dueCount(prefix, keys) {
      const t = today();
      let n = 0;
      for (const k of keys) { const s = S.srs[prefix + k]; if (s && s.d <= t) n++; }
      return n;
    },
    seenCount(prefix, keys) {
      let n = 0;
      for (const k of keys) if (S.srs[prefix + k]) n++;
      return n;
    },
    knownCount(prefix, keys) {
      let n = 0;
      for (const k of keys) { const s = S.srs[prefix + k]; if (s && s.b >= 3) n++; }
      return n;
    },

    /* Record an answer for an exercise item. */
    answer(item, correct) {
      const t = today();
      S.days[t] = (S.days[t] || 0) + 1;
      if (item.unit) {
        const u = store.unit(item.unit);
        u.hist.push(correct ? 1 : 0);
        if (u.hist.length > 24) u.hist.shift();
        if (item.key && item.key.startsWith('u:')) {
          // level 1 = recognised it (multiple choice), level 2 = produced it (typed or built)
          if (correct) u.ok[item.key] = item.t === 'm' ? Math.max(1, u.ok[item.key] || 0) : 2;
          else delete u.ok[item.key];
        }
        // a "good day": at least six answers in this unit today, 80% of them right
        if (!u.d || u.d.day !== t) u.d = { day: t, n: 0, c: 0 };
        u.d.n++;
        if (correct) u.d.c++;
        const good = u.d.n >= 6 && u.d.c / u.d.n >= 0.8;
        u.okDays = (u.okDays || []).filter((x) => x !== t);
        if (good) u.okDays.push(t);
        if (u.okDays.length > 6) u.okDays.shift();
        u.last = t;
      }
      if (item.srs) {
        const s = S.srs[item.srs] || { b: 0, d: t };
        s.b = correct ? Math.min(s.b + 1, INTERVALS.length - 1) : 0;
        // a first-time correct answer on a brand-new item jumps ahead: she probably knew it already
        if (correct && !S.srs[item.srs]) s.b = 2;
        s.d = t + INTERVALS[s.b];
        S.srs[item.srs] = s;
      }
      const mk = item.key;
      if (mk) {
        S.mistakes = S.mistakes.filter((m) => m.key !== mk);
        if (!correct) {
          const snap = {};
          for (const f of ['t', 'q', 'he', 'opts', 'a', 'ex', 'unit', 'key', 'srs', 'lead', 'fixed', 'strict', 'plainQ', 'heOpts', 'also', 'tokens', 'bad', 'fix', 'bank']) {
            if (item[f] !== undefined) snap[f] = item[f];
          }
          S.mistakes.unshift(snap);
          if (S.mistakes.length > 80) S.mistakes.pop();
        }
      }
      // gender of a noun: count misses, so the words that keep going wrong can be drilled on their own
      const gk = item.gkey || (item.srs && item.srs.startsWith('g:') ? item.srs : null);
      if (gk) {
        if (!S.gerr) S.gerr = {};
        const e = S.gerr[gk] || { m: 0, r: 0 };
        if (correct) e.r++; else { e.m++; e.r = 0; }
        if (e.m) S.gerr[gk] = e;
      }
      // first-attempt accuracy per day: [answers, right, produced (typed or built), produced right]
      if (!S.acc) S.acc = {};
      const ac = S.acc[t] || [0, 0, 0, 0];
      ac[0]++;
      if (correct) ac[1]++;
      if (item.t === 't' || item.t === 'o') { ac[2]++; if (correct) ac[3]++; }
      S.acc[t] = ac;
      // one snapshot a day of where she stands, so progress can be compared over time
      if (!S.snap || S.snapV !== 2) { S.snap = {}; S.snapV = 2; }
      const st = store.standing();
      S.snap[t] = [Math.round(st.pts * 100) / 100, st.sitting, st.known];
      for (const k in S.snap) if (+k < t - 400) delete S.snap[k];
      for (const k in S.acc) if (+k < t - 400) delete S.acc[k];
      save();
    },

    /* Where she stands right now, from durable mastery only (never from the number of answers).
       Level points are stricter than the unit percentage: most of a unit's point comes from good practice
       on different days, so answering well once in many units does not add up to a high level. */
    LEVEL_W: [0.15, 0.4, 0.7, 1],
    standing() {
      const units = (Y.data && Y.data.units) || [];
      let pts = 0;
      let sitting = 0;
      const byDays = [0, 0, 0, 0];
      for (const u of units) {
        const i = store.masteryInfo(u.id);
        if (!i) continue;
        pts += i.acc * store.LEVEL_W[i.days] * i.fade;
        byDays[i.days]++;
        if (i.score >= 0.85) sitting++;
      }
      let known = 0;
      for (const k in S.srs) if (S.srs[k].b >= 3) known++;
      const total = units.length || 1;
      const frac = pts / total;
      const level = Math.min(10, Math.floor(frac * 10) + 1);
      const toNext = level >= 10 ? 0 : (level / 10) * total - pts;
      const inLevel = level >= 10 ? 1 : frac * 10 - (level - 1);
      return { pts, total, sitting, known, level, toNext, inLevel, byDays };
    },
    /* The latest snapshot from at least `days` days ago; failing that, the earliest one from before today. */
    snapBefore(days) {
      const t = today();
      const keys = Object.keys((S.snapV === 2 && S.snap) || {}).map(Number).sort((a, b) => a - b);
      const old = keys.filter((k) => k <= t - days);
      const k = old.length ? old[old.length - 1] : keys.find((x) => x < t);
      return k === undefined ? null : { day: k, ago: t - k, pts: S.snap[k][0], sitting: S.snap[k][1], known: S.snap[k][2] };
    },
    /* First-attempt accuracy over a window of days ending `end` days ago. */
    accWindow(end, len) {
      const t = today();
      const sum = [0, 0, 0, 0];
      let days = 0;
      for (let d = t - end - len + 1; d <= t - end; d++) {
        const a = (S.acc || {})[d];
        if (!a) continue;
        days++;
        for (let i = 0; i < 4; i++) sum[i] += a[i];
      }
      return { n: sum[0], acc: sum[0] ? sum[1] / sum[0] : null, pn: sum[2], pacc: sum[2] ? sum[3] / sum[2] : null, days };
    },

    /* Stubborn: missed at least twice, and not yet answered right three times in a row since. */
    isStubborn(gk) { const e = (S.gerr || {})[gk]; return !!e && e.m >= 2 && e.r < 3; },

    streak() {
      let t = today();
      if (!S.days[t]) t--;
      let n = 0;
      while (S.days[t]) { n++; t--; }
      return n;
    },
    todayCount: () => S.days[today()] || 0,

    addWord(w) { S.mywords.unshift(w); save(); },
    removeWord(y) { S.mywords = S.mywords.filter((w) => w.y !== y); delete S.srs['my:' + y]; save(); },

    setDiag(res) { S.diag = Object.assign({}, S.diag || {}, res); save(); },
    /* Personal exercises, built from the learner's own corrected writing. */
    addPersonal(item) {
      if (!S.personal) S.personal = [];
      if (S.personal.some((p) => p.key === item.key)) return false;
      S.personal.unshift(item);
      if (S.personal.length > 80) S.personal.pop();
      save();
      return true;
    },
    addFlag(f) {
      if (!S.flags) S.flags = [];
      if (S.flags.some((x) => x.q === f.q && x.correct === f.correct)) return false;
      S.flags.unshift(f);
      if (S.flags.length > 100) S.flags.pop();
      save();
      return true;
    },
    removeFlag(i) { S.flags.splice(i, 1); save(); },
    /* Gender track: best score, number of rounds and last day for one step of one word set. */
    track: (key) => (S.track && S.track[key]) || null,
    setTrack(key, ratio) {
      if (!S.track) S.track = {};
      const a = S.track[key] || { b: 0, n: 0, d: 0 };
      S.track[key] = { b: Math.max(a.b, ratio), n: a.n + 1, d: today() };
      save();
    },
    markRead(id) { if (!S.read) S.read = {}; S.read[id] = 1; save(); },
    removePersonal(key) { S.personal = (S.personal || []).filter((p) => p.key !== key); save(); },
    best: (k) => (S.best && S.best[k]) || 0,
    setBest(k, v) { if (!S.best) S.best = {}; if (v > (S.best[k] || 0)) { S.best[k] = v; save(); return true; } return false; },
    GOAL: 20,

    exportData() {
      const copy = JSON.parse(JSON.stringify(S));
      copy.settings.apiKey = '';
      S.lastExport = today();
      save();
      return JSON.stringify(copy, null, 1);
    },
    importData(text) {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object' || !obj.units || !obj.srs) throw new Error('bad file');
      const key = S.settings.apiKey;
      S = Object.assign(blank(), obj);
      S.settings = Object.assign(blank().settings, obj.settings || {});
      S.settings.apiKey = key;
      save();
    },
    /* Everything worth syncing: progress only, never keys or settings. */
    syncable() {
      const copy = JSON.parse(JSON.stringify(S));
      delete copy.settings;
      return copy;
    },
    /* Merge progress from another device into this one. Returns true if anything here changed. */
    merge(r) {
      if (!r || typeof r !== 'object' || !r.units || !r.srs) return false;
      const before = JSON.stringify(store.syncable());
      const newer = (r.updatedAt || 0) > (S.updatedAt || 0);
      for (const d in r.days || {}) S.days[d] = Math.max(S.days[d] || 0, r.days[d]);
      for (const k in r.srs) {
        const a = S.srs[k];
        const b = r.srs[k];
        if (!a || b.d > a.d || (b.d === a.d && newer)) S.srs[k] = b;
      }
      for (const id in r.units) {
        const a = S.units[id];
        const b = r.units[id];
        const pick = !a || (b.last || 0) > (a.last || 0) || ((b.last || 0) === (a.last || 0) && (b.hist || []).length > (a.hist || []).length) ? b : a;
        const days = [...new Set([...((a && a.okDays) || []), ...(b.okDays || [])])].sort((x, y) => x - y).slice(-6);
        S.units[id] = Object.assign({}, pick, { step: Math.max((a && a.step) || 0, b.step || 0), okDays: days, ok: Object.assign({}, (pick === a ? b : a || {}).ok, pick.ok) });
      }
      const uniq = (list, key) => { const seen = new Set(); return list.filter((x) => { const k = x[key]; if (seen.has(k)) return false; seen.add(k); return true; }); };
      S.mywords = uniq([...(S.mywords || []), ...(r.mywords || [])], 'y');
      S.personal = uniq([...(S.personal || []), ...(r.personal || [])], 'key').slice(0, 80);
      S.flags = uniq([...(S.flags || []), ...(r.flags || [])].map((f) => Object.assign({ id: f.q + '|' + f.correct }, f)), 'id');
      if (newer) S.mistakes = r.mistakes || [];
      S.diag = r.diag || S.diag ? (newer ? Object.assign({}, S.diag, r.diag) : Object.assign({}, r.diag, S.diag)) : null;
      S.read = Object.assign({}, r.read, S.read);
      if (!S.gerr) S.gerr = {};
      for (const k in r.gerr || {}) { const a = S.gerr[k]; const b = r.gerr[k]; if (!a || b.m > a.m || (b.m === a.m && newer)) S.gerr[k] = b; }
      if (!S.gcheck) S.gcheck = {};
      for (const d in r.gcheck || {}) S.gcheck[d] = Math.max(S.gcheck[d] || 0, r.gcheck[d]);
      if (!S.acc) S.acc = {};
      for (const d in r.acc || {}) { const a = S.acc[d]; const b = r.acc[d]; S.acc[d] = a ? a.map((x, i) => Math.max(x, b[i] || 0)) : b; }
      if (r.snapV === 2) { if (S.snapV !== 2) { S.snap = {}; S.snapV = 2; } S.snap = newer ? Object.assign({}, S.snap, r.snap) : Object.assign({}, r.snap, S.snap); }
      for (const k in r.best || {}) S.best[k] = Math.max(S.best[k] || 0, r.best[k]);
      S.lastExport = Math.max(S.lastExport || 0, r.lastExport || 0);
      if (!S.track) S.track = {};
      for (const k in r.track || {}) {
        const a = S.track[k];
        const b = r.track[k];
        S.track[k] = a ? { b: Math.max(a.b, b.b), n: Math.max(a.n, b.n), d: Math.max(a.d, b.d) } : b;
      }
      const changed = JSON.stringify(store.syncable()) !== before;
      if (changed) { const t = Math.max(S.updatedAt || 0, r.updatedAt || 0); save(); S.updatedAt = t; }
      return changed;
    },
    reset() {
      const settings = S.settings;
      S = blank();
      S.settings = settings;
      save();
    },
  });
})();
