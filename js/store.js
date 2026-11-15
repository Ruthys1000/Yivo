/* Progress storage (localStorage) and spaced repetition. */
(function () {
  const Y = window.Y;
  const KEY = 'yivo.v1';
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90];

  const blank = () => ({ units: {}, srs: {}, days: {}, mywords: [], mistakes: [], diag: null, best: {}, personal: [], lastExport: 0, read: {}, flags: [], track: {}, settings: { strict: false, apiKey: '', model: 'claude-opus-5-5' } });

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
      return { score: acc * [0.55, 0.75, 0.9, 1][days] * fade, acc, days, stale: idle > 21 };
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
          for (const f of ['t', 'q', 'he', 'opts', 'a', 'ex', 'unit', 'key', 'srs', 'lead', 'fixed', 'strict', 'plainQ', 'heOpts', 'tokens', 'bad', 'fix', 'bank']) {
            if (item[f] !== undefined) snap[f] = item[f];
          }
          S.mistakes.unshift(snap);
          if (S.mistakes.length > 80) S.mistakes.pop();
        }
      }
      save();
    },

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
        S.units[id] = Object.assign({}, pick, { okDays: days, ok: Object.assign({}, (pick === a ? b : a || {}).ok, pick.ok) });
      }
      const uniq = (list, key) => { const seen = new Set(); return list.filter((x) => { const k = x[key]; if (seen.has(k)) return false; seen.add(k); return true; }); };
      S.mywords = uniq([...(S.mywords || []), ...(r.mywords || [])], 'y');
      S.personal = uniq([...(S.personal || []), ...(r.personal || [])], 'key').slice(0, 80);
      S.flags = uniq([...(S.flags || []), ...(r.flags || [])].map((f) => Object.assign({ id: f.q + '|' + f.correct }, f)), 'id');
      if (newer) S.mistakes = r.mistakes || [];
      S.diag = r.diag || S.diag ? (newer ? Object.assign({}, S.diag, r.diag) : Object.assign({}, r.diag, S.diag)) : null;
      S.read = Object.assign({}, r.read, S.read);
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
