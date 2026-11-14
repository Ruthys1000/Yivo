/* Exercise generators. Each returns an item:
   { t:'m'|'t'|'o', q, he, opts, a, ex, unit, key, srs } */
(function () {
  const Y = window.Y;
  const D = Y.data;
  const G = (Y.gen = {});

  const GNAME = { m: 'זכר', f: 'נקבה', n: 'סתמי' };
  const CNAME = { nom: 'נומינטיב (נושא)', acc: 'אקוזטיב (מושא ישיר)', dat: 'דאַטיוו' };
  const ARTS = ['דער', 'די', 'דאָס'];

  /* Pick an item, preferring ones that are due / unseen according to the SRS. */
  const pickSrs = (list, keyOf) => {
    const today = Y.store.today();
    const due = [];
    const fresh = [];
    for (const x of list) {
      const s = Y.store.srs(keyOf(x));
      if (!s) fresh.push(x);
      else if (s.d <= today) due.push(x);
    }
    if (due.length && Math.random() < 0.7) return Y.pick(due);
    if (fresh.length) return Y.pick(fresh);
    if (due.length) return Y.pick(due);
    return Y.pick(list);
  };

  const nounKey = (n) => 'g:' + n.g + ':' + n.w;

  /* Mass and very abstract nouns sound odd with a random adjective, so they stay out of adjective drills. */
  const NOADJ = new Set(`וואַסער ברויט פֿלייש גאָלד זילבער אײַזן האָלץ גראָז געלט בלוט מילך פּוטער קאַווע צוקער ווײַן קעז רעגן שניי לופֿט ערד פּאַפּיר
געזונט עסן וויסן מאָל רחמנות גלות שלאָף שׂכל כּוח אמת שלום כּבֿוד מזל גליק לעבן צוקונפֿט מוזיק ליטעראַטור וויסנשאַפֿט פֿרייד ליבע
שבת סוף אָנהייב טעם חשבון סדר אופֿן מצבֿ רעכט נאָמען ווינט הימל ים`.split(/\s+/).map((w) => Y.canon(w)));


  G.gender = (mode) => {
    const n = pickSrs(D.nouns, nounKey);
    // a third of the time, show the gender through the adjective ending instead of the article
    if (mode !== 'plain' && Math.random() < 0.35 && !n.irr && !NOADJ.has(Y.canon(n.w))) {
      const pool = D.adjs.filter((a) => a.c.includes(n.c) && !/^[אע]/.test(a.w));
      if (pool.length) {
        const adj = Y.pick(pool).w;
        const forms = [Y.adj(adj, 'er'), Y.adj(adj, 'e'), adj];
        const a = forms[{ m: 0, f: 1, n: 2 }[n.g]];
        return {
          t: 'm', q: `אַ ___ ${n.w}`, he: n.he, opts: forms, a, fixed: true,
          ex: `{${Y.ART.nom[n.g]} ${n.w}} — ${GNAME[n.g]}, ולכן {אַ ${a} ${n.w}}.`, key: nounKey(n), srs: nounKey(n),
        };
      }
    }
    return {
      t: 'm', q: '___ ' + n.w, he: n.he, opts: ARTS, a: Y.ART.nom[n.g], fixed: true,
      ex: `{${Y.ART.nom[n.g]} ${n.w}} — ${GNAME[n.g]}.`, key: nounKey(n), srs: nounKey(n),
    };
  };

  const FRAMES = {
    nom: { all: ['___ געפֿעלט מיר זייער.'], p: ['___ איז שוין דאָ.', '___ וווינט נישט ווײַט.'], o: ['___ איז שוין דאָ.'], a: [] },
    acc: { all: ['איך האָב ליב ___.'], p: ['זי זעט ___.', 'מיר קענען ___.'], o: ['זי זעט ___.'], a: ['מיר געדענקען ___.'] },
    dat: { all: ['מיר רעדן וועגן ___.'], p: ['ער גייט מיט ___.', 'זי העלפֿט ___.'], o: ['ער שטייט לעבן ___.'], a: ['זיי שרײַבן וועגן ___.'] },
  };
  const WHY = {
    nom: 'כאן זה הנושא',
    acc: 'כאן זה מושא ישיר',
    dat: 'אחרי מילת יחס (או פועל שדורש דאַטיוו)',
  };

  const caseItem = (cases, withAdj, def, adjFilter) => {
    const kase = Y.pick(cases);
    const n = Y.pick(D.nouns.filter((x) => !x.irr && !(withAdj && NOADJ.has(Y.canon(x.w)))));
    let adj = null;
    if (withAdj) {
      let pool = D.adjs.filter((a) => a.c.includes(n.c));
      if (adjFilter) pool = pool.filter(adjFilter);
      if (!pool.length) return caseItem(cases, withAdj, def, adjFilter);
      adj = Y.pick(pool).w;
    }
    const frame = Y.pick(FRAMES[kase].all.concat(FRAMES[kase][n.c]));
    const correct = Y.phrase(n.w, adj, kase, n.g, def);
    let cands = [];
    for (const k of ['nom', 'acc', 'dat']) cands.push(Y.phrase(n.w, adj, k, n.g, def));
    for (const g of ['m', 'f', 'n']) cands.push(Y.phrase(n.w, adj, kase, g, def));
    if (adj) {
      // mismatched article / ending, the typical slip
      const art = def ? Y.ART[kase][n.g] : correct.split(' ')[0];
      cands.push(art + ' ' + Y.adj(adj, 'e') + ' ' + n.w);
      cands.push(art + ' ' + Y.adj(adj, 'n') + ' ' + n.w);
    }
    cands = Y.uniq(cands).filter((c) => Y.canon(c) !== Y.canon(correct));
    const opts = [correct].concat(Y.shuffle(cands).slice(0, 3));
    const artNom = Y.ART.nom[n.g];
    return {
      t: 'm', q: frame, he: n.he, opts, a: correct, parts: { n, adj, kase, def },
      ex: `{${artNom} ${n.w}} — ${GNAME[n.g]}. ${WHY[kase]}: ${CNAME[kase]} ← {${correct}}.`,
      key: 'case:' + kase + ':' + n.w,
    };
  };

  G.art = (arg) => caseItem(arg.split(','), false, true);

  /* Production version of the case drills: type the whole phrase from its dictionary forms. */
  G.ctype = (arg) => {
    const def = arg === 'indef' ? false : arg === 'def' ? true : Math.random() < 0.65;
    const it = caseItem(['nom', 'acc', 'dat'], true, def);
    const { n, adj } = it.parts;
    return {
      t: 't', q: it.q, a: [it.a], ex: it.ex, key: 'ct:' + it.key,
      he: `הקלידי את הצירוף: ${Y.ART.nom[n.g]} ${n.w} + ${adj}${def ? '' : ' · לא מיודע (אַ)'} · ${n.he}`,
    };
  };
  G.case = (arg) => {
    if (arg === 'def') return caseItem(['nom', 'acc', 'dat'], true, true);
    if (arg === 'indef') return caseItem(['nom', 'acc', 'dat'], true, false);
    // nsp: adjectives whose -n ending is special, masculine/neuter contexts
    const special = (a) => /[ןםי]$/.test(a.w.replace(/[ְ-ׇ]/g, '')) || Y.canon(a.w) === Y.canon('נײַ');
    for (let i = 0; i < 40; i++) {
      const it = caseItem(['acc', 'dat'], true, Math.random() < 0.6, special);
      if (/(עם|ען)$/.test(it.a.split(' ')[1])) return it;
    }
    return caseItem(['acc', 'dat'], true, true, special);
  };

  const PERSONS = [
    ['איך', 'ikh'], ['דו', 'du'], ['ער', 'er'], ['זי', 'er'], ['מיר', 'mir'], ['איר', 'ir'], ['זיי', 'zey'],
  ];
  const HOBN = { ikh: 'האָב', du: 'האָסט', er: 'האָט', mir: 'האָבן', ir: 'האָט', zey: 'האָבן' };
  const ZAYN = { ikh: 'בין', du: 'ביסט', er: 'איז', mir: 'זײַנען', ir: 'זײַט', zey: 'זײַנען' };

  G.pres = () => {
    const v = Y.pick(D.verbs.filter((x) => x.stem));
    const [pron, p] = Y.pick(PERSONS);
    const f = Y.present(v.stem, v.inf);
    const correct = f[p];
    const cands = Y.uniq([f.ikh, f.du, f.er, f.mir]).filter((c) => Y.canon(c) !== Y.canon(correct));
    return {
      t: 'm', q: `${pron} ___. (${v.inf})`, he: v.he, opts: [correct].concat(cands), a: correct,
      ex: `{${v.inf}}: {איך ${f.ikh}, דו ${f.du}, ער ${f.er}, מיר ${f.mir}}.`, key: 'pres:' + v.inf,
    };
  };

  G.aux = () => {
    const v = pickSrs(D.verbs, (x) => 'aux:' + x.inf);
    const [pron, p] = Y.pick(PERSONS);
    const right = (v.aux === 'z' ? ZAYN : HOBN)[p];
    const wrong = (v.aux === 'z' ? HOBN : ZAYN)[p];
    return {
      t: 'm', q: `${pron} ___ ${v.part}.`, he: v.he, opts: [right, wrong], a: right,
      ex: v.aux === 'z'
        ? `{${v.inf}} נוטה עם {זײַן}: {${pron} ${right} ${v.part}}.`
        : `{${v.inf}} נוטה עם {האָבן}: {${pron} ${right} ${v.part}}.`,
      key: 'aux:' + v.inf, srs: 'aux:' + v.inf,
    };
  };

  G.part = () => {
    const v = pickSrs(D.verbs, (x) => 'part:' + x.inf);
    const aux = (v.aux === 'z' ? ZAYN : HOBN).ikh;
    return {
      t: 't', q: `איך ${aux} ___. (${v.inf})`, he: 'כתבי את הבינוני · ' + v.he, a: [v.part],
      ex: `{${v.inf}} ← {${v.part}}.`, key: 'part:' + v.inf, srs: 'part:' + v.inf,
    };
  };

  G.comp = () => {
    const c = pickSrs(D.comps, (x) => 'comp:' + x.base);
    return {
      t: 't', q: `${c.base} ← ___`, he: 'כתבי את דרגת היתרון · ' + c.he, a: [c.comp],
      ex: `{${c.base} ← ${c.comp}}.`, key: 'comp:' + c.base, srs: 'comp:' + c.base,
    };
  };

  G.plural = () => {
    const p = pickSrs(D.plurals, (x) => 'pl:' + x.sg);
    const cands = Y.uniq([Y.join(p.sg, 'ן'), Y.join(p.sg, 'ער'), Y.join(p.sg, 'ס'), Y.join(p.sg, 'עס'), p.sg])
      .filter((c) => Y.canon(c) !== Y.canon(p.pl));
    return {
      t: 'm', q: `איין ${p.sg}, אַ סך ___`, he: p.he, opts: [p.pl].concat(Y.shuffle(cands).slice(0, 3)), a: p.pl,
      ex: `{${p.sg} ← ${p.pl}}.`, key: 'pl:' + p.sg, srs: 'pl:' + p.sg,
    };
  };

  G.dim = () => {
    const d = pickSrs(D.dims, (x) => 'dim:' + x.base);
    const cands = Y.uniq([Y.join(d.base, 'ל'), Y.join(d.base, 'כל'), Y.join(d.base, 'דל'), Y.join(d.base, 'עלע')])
      .filter((c) => Y.canon(c) !== Y.canon(d.dim));
    return {
      t: 'm', q: `${d.base} ← דאָס ___`, he: d.he, opts: [d.dim].concat(Y.shuffle(cands).slice(0, 3)), a: d.dim,
      ex: `{${d.base} ← דאָס ${d.dim}}.`, key: 'dim:' + d.base, srs: 'dim:' + d.base,
    };
  };

  G.spell = (tag) => {
    const pool = tag ? D.spell.filter((s) => s.tag === tag) : D.spell;
    const s = pickSrs(pool, (x) => 'sp:' + x.good);
    const rule = D.spellRules[s.tag] || '';
    const key = 'sp:' + s.good;
    if (Math.random() < 0.4) {
      return {
        t: 't', q: s.bad, he: 'כתבי בכתיב ייִוואָ · ' + s.he, a: [s.good], strict: true, plainQ: true,
        ex: `{${s.good}}. ${rule}`, key, srs: key,
      };
    }
    const stripped = s.good.normalize('NFD').replace(/[ְ-ׇ]/g, '');
    const opts = Y.uniq([s.good, s.bad, stripped]);
    return {
      t: 'm', q: '___', he: 'איזה כתיב תקני? · ' + s.he, opts, a: s.good,
      ex: `{${s.good}}. ${rule}`, key, srs: key,
    };
  };

  /* Vocabulary: alternate direction by SRS box. */
  G.vocab = (deckId, word) => {
    const deck = D.decks.find((d) => d.id === deckId);
    const w = word || pickSrs(deck.words, (x) => 'v:' + x.y);
    const key = 'v:' + w.y;
    const st = Y.store.srs(key);
    const others = Y.shuffle(deck.words.filter((x) => x.y !== w.y && x.he !== w.he)).slice(0, 3);
    const toYiddish = deckId === 'loan' || (st && st.b % 2 === 1);
    const note = w.note ? ' ' + w.note : '';
    if (toYiddish) {
      return {
        t: 'm', q: '___', he: 'איך אומרים: ' + w.he + '?', opts: [w.y].concat(others.map((o) => o.y)), a: w.y,
        ex: `{${w.y}} = ${w.he}.${note}`, key, srs: key,
      };
    }
    return {
      t: 'm', q: w.y, plainQ: true, he: 'מה הפירוש?', opts: [w.he].concat(others.map((o) => o.he)), a: w.he, heOpts: true,
      ex: `{${w.y}} = ${w.he}.${note}`, key, srs: key,
    };
  };

  G.myword = (w) => ({
    t: 't', q: '___', he: 'כתבי ביידיש: ' + w.he, a: [w.y], ex: `{${w.y}} = ${w.he}.` + (w.note ? ' ' + w.note : ''),
    key: 'my:' + w.y, srs: 'my:' + w.y,
  });

  /* Past / future transformation: type the whole sentence. */
  const VEL = { ikh: 'וועל', du: 'וועסט', er: 'וועט', mir: 'וועלן', ir: 'וועט', zey: 'וועלן' };
  G.tense = () => {
    const v = Y.pick(D.verbs.filter((x) => x.stem));
    const [pron, p] = Y.pick(PERSONS);
    const f = Y.present(v.stem, v.inf);
    const past = Math.random() < 0.65;
    let a;
    if (past) {
      const aux = (v.aux === 'z' ? ZAYN : HOBN)[p];
      a = [`${pron} ${aux} ${v.part}`];
      if (v.aux === 'z' && (p === 'mir' || p === 'zey')) a.push(`${pron} זענען ${v.part}`);
      if (v.aux === 'z' && p === 'ir') a.push(`${pron} זענט ${v.part}`);
    } else a = [`${pron} ${VEL[p]} ${v.inf}`];
    return {
      t: 't', q: `${pron} ${f[p]}.`, plainQ: true, he: (past ? 'העבירי לזמן עבר' : 'העבירי לזמן עתיד') + ' · ' + v.he, a,
      ex: past
        ? `{${v.inf}} נוטה עם {${v.aux === 'z' ? 'זײַן' : 'האָבן'}}; הבינוני: {${v.part}}.`
        : `עתיד: {${VEL[p]}} + שם הפועל.`,
      key: 'tense:' + (past ? 'p:' : 'f:') + v.inf + ':' + p, unit: past ? 'd2' : 'd4',
    };
  };

  /* Proverb with a grammar blank. */
  G.proverb = () => {
    const pr = pickSrs(D.proverbs, (x) => 'pv:' + x.full);
    return {
      t: 'm', q: pr.q, he: pr.he, opts: pr.opts, a: pr.opts[0], ex: pr.note, key: 'pv:' + pr.full, srs: 'pv:' + pr.full,
    };
  };

  /* Error hunt: a sentence with one non-standard word; tap it. Built from the hand-written exercises. */
  let huntPool = null;
  G.hunt = () => {
    if (!huntPool) {
      huntPool = [];
      for (const u of D.units) {
        u.ex.forEach((t, i) => {
          if (t[0] !== 'm') return;
          const q = t[1].split(' // ')[0];
          if (/[()←]/.test(q) || /^איין /.test(q) || q.split(' ').length < 3) return;
          huntPool.push({ u: u.id, i, q, opts: t[2].split('|'), ex: t[3] || '' });
        });
      }
    }
    const h = Y.pick(huntPool);
    const wrong = Y.pick(h.opts.slice(1));
    const before = h.q.split('___')[0].trim();
    const start = before ? before.split(' ').length : 0;
    const tokens = h.q.replace('___', wrong).split(' ');
    const bad = wrong.split(' ').map((_, k) => start + k);
    const fix = h.q.replace('___', h.opts[0]);
    return {
      t: 'h', tokens, bad, fix, he: 'במשפט יש מקום אחד שאינו לפי התקן. הקישי עליו.',
      ex: `{${h.opts[0]}}, לא {${wrong}}. ${h.ex}`, unit: h.u, key: 'h:' + h.u + ':' + h.i,
    };
  };

  /* Run a generator spec such as "spell:n" or "case:def". */
  G.run = (spec, unit) => {
    const [name, arg] = spec.split(':');
    const it = G[name](arg);
    it.unit = unit || it.unit;
    return it;
  };

  /* Turn a hand-written exercise tuple into an item. */
  G.fromTuple = (tuple, unit, idx) => {
    const key = 'u:' + unit + ':' + idx;
    if (tuple[0] === 'm') {
      const [q, he] = tuple[1].split(' // ');
      const opts = tuple[2].split('|');
      return { t: 'm', q, he: he || '', opts, a: opts[0], ex: tuple[3] || '', unit, key };
    }
    if (tuple[0] === 'o') {
      const alts = tuple[2].split(' / ');
      return { t: 'o', lead: tuple[1], a: alts, he: tuple[3] || '', ex: tuple[4] || '', unit, key };
    }
    if (tuple[0] === 'b') {
      // build a sentence from a word bank that also holds wrong forms
      const alts = tuple[2].split(' / ');
      return { t: 'o', lead: '', a: alts, bank: tuple[3] ? tuple[3].split(' ') : [], he: tuple[1], ex: tuple[4] || '', unit, key };
    }
    return null;
  };

  /* Build a practice round for a unit: unsolved hand-written items first, then generated ones. */
  G.unitRound = (unit, size) => {
    const st = Y.store.unit(unit.id);
    const hand = unit.ex.map((t, i) => G.fromTuple(t, unit.id, i)).filter(Boolean);
    const unsolved = Y.shuffle(hand.filter((h) => !st.ok[h.key]));
    // once an item was recognised in multiple choice, it comes back as a typing task
    const strict = unit.group === 'A';
    const typed = (h) => (h.t === 'm' && h.a.split(' ').length <= 3 && /___/.test(h.q)
      ? { t: 't', q: h.q, he: h.he || 'הקלידי את החסר', a: [h.a], ex: h.ex, unit: h.unit, key: h.key, strict }
      : h);
    const solved = Y.shuffle(hand.filter((h) => st.ok[h.key] === 1)).map(typed)
      .concat(Y.shuffle(hand.filter((h) => st.ok[h.key] >= 2)).map(typed));
    const gens = unit.gen || [];
    const nGen = gens.length ? Math.min(Math.ceil(size * 0.45), size) : 0;
    const items = unsolved.concat(solved).slice(0, size - nGen);
    const seen = new Set();
    let guard = 0;
    while (items.length < size && gens.length && guard++ < 60) {
      const it = G.run(Y.pick(gens), unit.id);
      if (seen.has(it.key + it.q)) continue;
      seen.add(it.key + it.q);
      items.push(it);
    }
    while (items.length < size && items.length < hand.length) items.push(hand[items.length]);
    return Y.shuffle(items);
  };
})();
