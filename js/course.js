/* Course track: which lessons are open and which units, words and texts belong to them.
   The data lives in data/course.js; the screens are in app.js. */
(function () {
  const Y = window.Y;
  const D = Y.data;
  const C = (Y.course = {
    /* 'course' (default) shows only what the course has taught so far; 'full' is the whole app. */
    mode: () => (Y.store.settings().track === 'full' ? 'full' : 'course'),
    set: (m) => Y.store.setSetting('track', m === 'full' ? 'full' : 'course'),
    lessons: () => (D.course && D.course.lessons) || [],
    unitIds: () => {
      const seen = new Set();
      const out = [];
      for (const l of C.lessons()) for (const id of l.units) if (!seen.has(id)) { seen.add(id); out.push(id); }
      return out;
    },
    /* the units that the course track works on, in lesson order */
    units: () => C.unitIds().map((id) => D.units.find((u) => u.id === id)).filter(Boolean),
    decks: () => D.decks.filter((d) => d.course),
    texts: (n) => D.texts.filter((t) => t.course === n),
    current: () => C.lessons()[C.lessons().length - 1] || null,
  });
})();
