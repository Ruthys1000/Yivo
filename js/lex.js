/* Lexicon built from all the app's data: powers the offline spelling checker and the dictionary. */
(function () {
  const Y = window.Y;
  const D = Y.data;
  const L = (Y.lex = { exact: new Set(), bare: new Map(), entries: [], byForm: new Map(), bad: new Map() });

  const GART = { 'דער': 'm', 'די': 'f', 'דאָס': 'n' };
  const artOf = (w) => {
    const first = w.split(' ')[0];
    for (const a in GART) if (Y.canon(a) === Y.canon(first)) return GART[a];
    return null;
  };

  /* Register a correct form (possibly several words). entry = dictionary entry index it belongs to. */
  const addForm = (form, entry) => {
    for (const w of form.split(/\s+/)) {
      const c = Y.canon(w);
      if (!c) continue;
      L.exact.add(c);
      const b = Y.bare(w);
      if (!L.bare.has(b)) L.bare.set(b, new Set());
      L.bare.get(b).add(c);
      if (entry !== undefined) {
        if (!L.byForm.has(b)) L.byForm.set(b, new Set());
        L.byForm.get(b).add(entry);
      }
    }
  };
  const addEntry = (e) => {
    L.entries.push(e);
    const idx = L.entries.length - 1;
    addForm(e.head, idx);
    return idx;
  };

  for (const w of D.common) addForm(w);

  for (const n of D.nouns) {
    const pl = D.plurals.find((p) => p.sg === n.w && (n.he.includes(p.he) || p.he.includes(n.he)));
    const dim = D.dims.find((d) => d.base === n.w);
    const idx = addEntry({ kind: 'noun', head: n.w, he: n.he, g: n.g, alt: n.alt, irr: n.irr, pl: pl ? pl.pl : null, dim: dim ? dim.dim : null });
    if (pl) addForm(pl.pl, idx);
    if (dim) addForm(dim.dim, idx);
  }
  for (const p of D.plurals) { addForm(p.sg); addForm(p.pl); }
  for (const d of D.dims) { addForm(d.base); addForm(d.dim); }

  for (const v of D.verbs) {
    const idx = addEntry({ kind: 'verb', head: v.inf, he: v.he, aux: v.aux, part: v.part, stem: v.stem });
    addForm(v.part, idx);
    if (v.stem) {
      const f = Y.present(v.stem, v.inf);
      for (const k of ['ikh', 'du', 'er']) addForm(f[k], idx);
    }
  }

  for (const a of D.adjs) {
    const comp = D.comps.find((c) => c.base === a.w);
    const idx = addEntry({ kind: 'adj', head: a.w, he: a.he, comp: comp ? comp.comp : null });
    for (const e of ['er', 'e', 'n']) addForm(Y.adj(a.w, e), idx);
  }
  for (const c of D.comps) {
    if (!D.adjs.some((a) => a.w === c.base)) {
      const idx = addEntry({ kind: 'adj', head: c.base, he: c.he, comp: c.comp });
      for (const e of ['er', 'e', 'n']) addForm(Y.adj(c.base, e), idx);
    }
    addForm(c.comp);
  }

  for (const deck of D.decks) {
    for (const w of deck.words) {
      const g = artOf(w.y);
      const head = g ? w.y.split(' ').slice(1).join(' ') : w.y;
      const known = g && L.entries.some((e) => e.kind === 'noun' && Y.canon(e.head) === Y.canon(head));
      if (known) { addForm(w.y); continue; }
      addEntry(g ? { kind: 'noun', head, he: w.he, g, note: w.note, deck: deck.title } : { kind: 'word', head: w.y, he: w.he, note: w.note, deck: deck.title });
    }
  }

  for (const s of D.spell) {
    addForm(s.good);
    L.bad.set(Y.bare(s.bad), s);
  }
  // Yiddish inside lesson texts and exercises (correct answers and sentences only)
  for (const u of D.units) {
    const skipText = u.group === 'A'; // orthography lessons quote non-standard spellings on purpose
    if (!skipText) for (const m of u.text.match(/\{[^}]*\}/g) || []) addForm(m.replace(/[{}*←=+\/,.;:!?()]/g, ' '));
    for (const e of u.ex) {
      if (e[0] === 'm') addForm((e[1].split(' // ')[0].replace('___', e[2].split('|')[0])).replace(/[.,;:!?()←—–]/g, ' '));
      else if (e[0] === 'b') addForm(e[2].split(' / ')[0].replace(/[.,;:!?]/g, ' '));
      else addForm((e[1] + ' ' + e[2].split(' / ')[0]).replace(/[.,;:!?]/g, ' '));
    }
  }
  for (const p of D.proverbs) addForm(p.full.replace(/[.,;:!?–]/g, ' '));
  for (const t of D.texts || []) addForm(t.body.replace(/\|[^\]]*\]/g, ' ').replace(/[\[\].,;:!?–\n]/g, ' '));

  /* ---------- spelling checker ---------- */

  const RULES = [
    [/וואו/g, 'ווו', 'וו + וּ'],
    [/([עאיו])ה(?=.)/g, '$1', 'בלי ה שותקת'],
    [/([^וי])\1/g, '$1', 'בלי אות כפולה'],
    [/(.)יע(?=.)/g, '$1י', 'i נכתב י, לא יע'],
    [/יג(?=$|ע$|ער$|ן$|ע[רן]$)/g, 'יק', 'הסיומת ־יק'],
    [/ליך/g, 'לעך', 'הסיומת ־לעך'],
    [/^בע(?=..)/, 'בא', 'הקידומת באַ־'],
    [/^פער(?=..)/, 'פאר', 'הקידומת פֿאַר־'],
    [/^ענט(?=..)/, 'אנט', 'הקידומת אַנט־'],
    [/^ער(?=...)/, 'דער', 'הקידומת דער־'],
    [/([^מנ])ען$/, '$1ן', 'הסיומת ־ן'],
  ];
  const toFinal = (w) => w.replace(/[כמנפצ]$/, (c) => ({ 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' }[c]));

  const fromBare = (b) => (L.bare.has(b) ? [...L.bare.get(b)].map(Y.disp) : null);

  /* Check a single word. Returns { st: 'ok' | 'fix' | 'hint' | 'unk', sugg: [], why: '' } */
  L.check = (word) => {
    const c = Y.canon(word);
    if (!c || /^[ְ-ׇ־׳]+$/.test(c)) return { st: 'ok' };
    if (L.exact.has(c)) return { st: 'ok' };
    if (c.includes('־')) {
      const parts = c.split('־').filter(Boolean).map((p) => L.check(p));
      if (parts.every((p) => p.st === 'ok')) return { st: 'ok' };
    }
    if (c.includes('׳')) {
      // contractions such as כ׳וועל, ס׳וועט: judge the part after the apostrophe
      const rest = c.slice(c.indexOf('׳') + 1);
      if (c.indexOf('׳') <= 2 && rest && L.check(rest).st === 'ok') return { st: 'ok' };
    }
    const b = Y.bare(word);
    if (b === 'א') return { st: 'fix', sugg: ['אַ'], why: 'התווית הסתמית: אַ' };
    const hasMarks = c !== b;
    let cands = fromBare(b);
    if (cands) return { st: 'fix', sugg: cands, why: hasMarks ? 'הסימנים שונים בתקן' : 'חסרים סימנים' };
    const bad = L.bad.get(b);
    if (bad) return { st: 'fix', sugg: [Y.disp(bad.good)], why: D.spellRules[bad.tag] || '' };

    // try the rewriting rules, one at a time and then all together
    const tries = [];
    let all = b;
    const used = [];
    for (const [re, rep, why] of RULES) {
      const one = toFinal(b.replace(re, rep));
      if (one !== b) tries.push([one, why]);
      const next = all.replace(re, rep);
      if (next !== all) { all = next; used.push(why); }
    }
    all = toFinal(all);
    if (all !== b) tries.push([all, used.join(', ')]);
    for (const [t, why] of tries) {
      cands = fromBare(t);
      if (cands) return { st: 'fix', sugg: cands, why };
      const bd = L.bad.get(t);
      if (bd) return { st: 'fix', sugg: [Y.disp(bd.good)], why };
    }

    // no dictionary match: point at suspicious patterns only
    const hints = [];
    if (/יג(ע|ער|ן)?$/.test(b)) hints.push('הסיומת בתקן היא ־יק');
    if (/ליך/.test(b)) hints.push('הסיומת בתקן היא ־לעך');
    if (/[עאיו]ה[^ ]/.test(b) && /[עו]/.test(b.replace(/[עאיו]ה/, ''))) hints.push('ייתכן ה שותקת');
    if (/([^וי])\1/.test(b)) hints.push('אין אות כפולה בתוך מילה');
    if (/[^מנגקלעיו]ען$/.test(b)) hints.push('כנראה ־ן ולא ־ען');
    const d = word.normalize('NFD');
    const yiddishLooking = /ע|וו|יי|וי/.test(b);
    if (yiddishLooking && /פ(?![ּֿ])/.test(d)) hints.push('פּ או פֿ?');
    if (yiddishLooking && /.א(?![ַָ])/.test(d)) hints.push('אַ או אָ?');
    else if (yiddishLooking && /^א(?![ַָוי])/.test(d)) hints.push('אַ או אָ?');
    if (hints.length) return { st: 'hint', sugg: [], why: hints.join(' · ') };
    return { st: 'unk' };
  };

  const WORD = /([֐-׿יִ-ﭏ'’]+)/;
  /* Split text into tokens: [{ text, word: bool, res }] */
  L.analyze = (text) =>
    text.split(WORD).filter((t) => t !== '').map((t) => {
      const isWord = WORD.test(t) && /[א-תװ-ײיִ-ﭏ]/.test(t);
      return isWord ? { text: t, word: true, res: L.check(t) } : { text: t, word: false };
    });

  /* ---------- dictionary ---------- */

  L.search = (q) => {
    const raw = q.trim();
    if (!raw) return [];
    const b = Y.bare(raw);
    const words = b.split(' ');
    const key = words.length > 1 && artOf(raw) ? words.slice(1).join(' ') : b;
    const scored = new Map();
    const bump = (i, s) => scored.set(i, Math.max(scored.get(i) || 0, s));
    if (L.byForm.has(key)) for (const i of L.byForm.get(key)) bump(i, Y.bare(L.entries[i].head) === key ? 100 : 80);
    L.entries.forEach((e, i) => {
      const hb = Y.bare(e.head);
      if (hb === key) bump(i, 100);
      else if (key.length >= 2 && hb.startsWith(key)) bump(i, 60);
      else if (key.length >= 3 && hb.includes(key)) bump(i, 40);
      const hes = e.he.split(/[,;]\s*/);
      if (hes.some((h) => h === raw)) bump(i, 90);
      else if (raw.length >= 2 && e.he.includes(raw)) bump(i, 50);
    });
    return [...scored.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 24).map(([i]) => L.entries[i]);
  };
})();
