/* Progress storage (localStorage) and spaced repetition. */
(function () {
  const Y = window.Y;
  const KEY = 'yivo.v1';
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90];

  const blank = () => ({ units: {}, srs: {}, days: {}, mywords: [], mistakes: [], diag: null, settings: { strict: false, apiKey: '', model: 'claude-opus-5-5' } });

  let S = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) S = Object.assign(blank(), JSON.parse(raw));
    S.settings = Object.assign(blank().settings, S.settings || {});
  } catch (e) { /* storage unavailable: run in memory */ }

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  };

  const dayNum = (d) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  const today = () => dayNum(new Date());

  const store = (Y.store = {
    today,
    get state() { return S; },
    save,
    settings: () => S.settings,
    setSetting(k, v) { S.settings[k] = v; save(); },

    unit(id) {
      if (!S.units[id]) S.units[id] = { hist: [], ok: {} };
      return S.units[id];
    },
    /* Mastery 0..1, or null if not started. */
    mastery(id) {
      const u = S.units[id];
      if (!u || !u.hist.length) return null;
      const sum = u.hist.reduce((a, b) => a + b, 0);
      // need at least 8 answers before the score counts fully
      return (sum / u.hist.length) * Math.min(1, u.hist.length / 8);
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
          if (correct) u.ok[item.key] = 1; else delete u.ok[item.key];
        }
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
          for (const f of ['t', 'q', 'he', 'opts', 'a', 'ex', 'unit', 'key', 'srs', 'lead', 'fixed', 'strict', 'plainQ', 'heOpts']) {
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

    setDiag(res) { S.diag = res; save(); },

    exportData() {
      const copy = JSON.parse(JSON.stringify(S));
      copy.settings.apiKey = '';
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
    reset() {
      const settings = S.settings;
      S = blank();
      S.settings = settings;
      save();
    },
  });
})();
