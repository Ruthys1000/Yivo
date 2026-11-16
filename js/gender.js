/* Gender drawers: learning the gender of nouns in three stages —
   rules that always hold, tendencies with their exceptions, and the words with no sign at all in groups of six.
   Every word is sorted into one of three fixed, coloured drawers, then recalled from the drawer, then typed. */
(function () {
  const Y = window.Y;
  const S = Y.store;
  const G = Y.gen;
  const D = Y.data;
  const esc = Y.esc;
  Y.views = Y.views || {};

  const GS = ['m', 'f', 'n'];
  const GN = { m: 'זכר', f: 'נקבה', n: 'סתמי' };
  const art = (g) => Y.ART.nom[g];
  const PASS = 0.8;

  /* Stages 1 and 2: a step is one or two rules, practised on the nouns they explain. */
  const RULES = [
    { id: 'r1', stage: 1, title: 'סיומות וצורת הקטנה', kinds: ['suf', 'dim'], lines: [
      ['f', 'הסיומות {־ונג, ־קייט, ־הייט, ־שאַפֿט} ← תמיד {די}.'],
      ['n', 'צורת הקטנה ({־ל, ־עלע}) ← תמיד {דאָס}, גם כשמדובר באדם.'],
    ] },
    { id: 'r2', stage: 1, title: 'אנשים ועונות השנה', kinds: ['male', 'female', 'season'], lines: [
      ['m', 'שם של זכר ← {דער}.'],
      ['f', 'שם של נקבה ← {די}.'],
      ['m', 'עונות השנה ← {דער}.'],
    ] },
    { id: 'r3', stage: 1, title: 'שם פועל, ומילים ב־גע־', kinds: ['inf', 'ge'], lines: [
      ['n', 'שם פועל שמשמש כשם עצם ← {דאָס}.'],
      ['n', 'הרבה שמות עצם שמתחילים ב־{גע־} הם {דאָס}. זו נטייה חזקה, לא חוק.'],
    ] },
    { id: 't1', stage: 2, title: 'לשון־קודש: הנטייה', kinds: ['heb-h', 'heb-ut', 'heb-m'], lines: [
      ['f', 'מסתיימת ב־{ה} ← לרוב {די}.'],
      ['n', 'מופשטת ומסתיימת ב־{ות} ← לרוב {דאָס}.'],
      ['m', 'כל השאר ← לרוב {דער}.'],
    ], note: 'אין כלל ש"מילה עברית היא {דאָס}". וגם המין בעברית לא קובע: הולכים לפי הסיומת.' },
    { id: 't2', stage: 2, title: 'לשון־קודש: היוצאות מן הנטייה', kinds: ['heb-x'], lines: [], note: 'אלה המילים שבהן הנטייה מטעה. הן מעטות, ולכן שווה לזכור אותן אחת־אחת. בסבב הן מעורבבות עם מילים שכן הולכות לפי הנטייה.', mix: ['heb-h', 'heb-m'] },
    { id: 't3', stage: 2, title: 'מילה שמסתיימת ב־ע', kinds: ['e'], lines: [
      ['f', 'מילה שמסתיימת ב־{ע} היא לרוב {די}.'],
    ], note: 'יוצאים מזה שמות של זכרים ({דער טאַטע, דער זיידע}), שהולכים לפי הכלל של אנשים.' },
  ];

  const byKind = {};
  for (const n of D.nouns) { const k = G.genderInfo(n).kind; (byKind[k] = byKind[k] || []).push(n); }
  const ofKinds = (kinds) => kinds.flatMap((k) => byKind[k] || []);

  /* Stage 3: the nouns with no sign, six at a time, two of each gender while they last. */
  const GROUPS = (() => {
    const pool = { m: [], f: [], n: [] };
    for (const n of byKind.none || []) pool[n.g].push(n);
    const out = [];
    while (pool.m.length + pool.f.length + pool.n.length) {
      const g = [];
      for (let round = 0; round < 6 && g.length < 6; round++) {
        for (const k of GS) if (g.length < 6 && pool[k].length && (round < 2 || !GS.some((x) => x !== k && pool[x].length > pool[k].length))) g.push(pool[k].shift());
      }
      if (!g.length) break;
      out.push({ id: 'g' + (out.length + 1), words: g });
    }
    return out;
  })();

  const tr = (id) => S.track('gd:' + id);
  const passed = (id) => { const t = tr(id); return !!t && t.b >= PASS; };
  const sitting = () => D.nouns.filter((n) => { const s = S.srs(G.nounKey(n)); return s && s.b >= 3; }).length;

  const card = (n) => `<div class="gw g-${n.g}"><b class="yi">${esc(G.phraseOf(n))}</b><small>${esc(n.he)}${n.alt ? ` · מקובל גם <span class="yi">${esc(art(n.alt))}</span>` : ''}</small></div>`;
  const drawersOf = (words) => `<div class="drawers static">${GS.map((g) => `<div class="drawer g-${g}"><b class="yi">${art(g)}</b><span class="in yi">${words.filter((n) => n.g === g).map((n) => esc(n.w)).join(' · ') || '&nbsp;'}</span></div>`).join('')}</div>`;

  /* ---------- the sorting game ---------- */

  function sortGame(words, o) {
    let queue = Y.shuffle(words.slice());
    const total = queue.length;
    const placed = { m: [], f: [], n: [] };
    const seen = new Set();
    const first = [];
    let timer = null;
    let locked = false;
    Y.ui.cleanup = () => clearTimeout(timer);

    const draw = (fb) => {
      const cur = queue[0];
      const done = total - queue.length;
      Y.ui.render(`<div class="run-head"><a class="x" href="${o.back}" aria-label="סגירה">×</a>
          <div class="bar"><i style="width:${(done / total) * 100}%"></i></div><span class="cnt">${done}/${total}</span></div>
        ${o.note ? `<div class="run-note">${o.note}</div>` : ''}
        ${cur ? `<div class="sort-card"><div class="q-hint">לאיזו מגירה?</div><div class="sort-word yi">${esc(cur.w)}</div><div class="sort-he">${esc(cur.he)}</div></div>` : ''}
        <div class="drawers">${GS.map((g) => `<button class="drawer g-${g}" data-g="${g}"><b class="yi">${art(g)}</b><span class="in yi">${placed[g].map((n) => esc(n.w)).join(' · ') || '&nbsp;'}</span></button>`).join('')}</div>
        <div id="sfb">${fb || ''}</div>`);
      locked = !!fb;
      const app = document.getElementById('app');
      app.querySelectorAll('.drawer').forEach((b) => b.addEventListener('click', () => choose(b.dataset.g)));
      const nx = app.querySelector('#snext');
      if (nx) nx.addEventListener('click', next);
    };

    const next = () => {
      clearTimeout(timer);
      if (!queue.length) return o.then(first);
      draw();
    };

    const choose = (g) => {
      if (locked || !queue.length) return;
      const cur = queue[0];
      const ok = g === cur.g || g === cur.alt;
      const key = G.nounKey(cur);
      if (!seen.has(key)) {
        seen.add(key);
        S.answer(G.genderOf(cur), ok);
        first.push({ n: cur, ok });
      }
      const info = G.genderInfo(cur);
      const why = info.kind === 'none' ? '' : `<p><small>${Y.inline(info.text)}</small></p>`;
      if (ok) {
        queue.shift();
        placed[g].push(cur);
        draw(`<div class="fb ok"><p class="ans g-${g}">${esc(G.phraseOf(g === cur.g ? cur : Object.assign({}, cur, { g })))}</p>${cur.alt ? `<p><small>מקובל גם ${esc(art(g === cur.g ? cur.alt : cur.g))}.</small></p>` : ''}${why}
          <div class="row"><button class="btn small" id="snext">${queue.length ? 'הבא' : 'הלאה'}</button></div></div>`);
        timer = setTimeout(next, why ? 2600 : 1400);
      } else {
        // it comes back after two other words
        queue.splice(Math.min(3, queue.length), 0, queue.shift());
        draw(`<div class="fb no"><h4>לא במגירה הזאת</h4><p class="ans g-${cur.g}">${esc(G.phraseOf(cur))}</p><p>${GN[cur.g]}.${cur.alt ? ` מקובל גם ${esc(art(cur.alt))}.` : ''} אמרי את הצירוף בקול פעם אחת.</p>${why}
          <div class="row"><button class="btn small" id="snext">הבא</button></div></div>`);
      }
    };
    draw();
  }

  /* ---------- recall from the drawer ---------- */

  function drawerRecall(words, o) {
    const gs = Y.shuffle(GS.filter((g) => words.some((n) => n.g === g)));
    let k = 0;
    const step = () => {
      if (k >= gs.length) return o.then();
      const g = gs[k];
      const list = Y.shuffle(words.slice());
      const picked = new Set();
      Y.ui.render(`<div class="run-head"><a class="x" href="${o.back}" aria-label="סגירה">×</a>
          <div class="bar"><i style="width:${(k / gs.length) * 100}%"></i></div><span class="cnt">${k + 1}/${gs.length}</span></div>
        ${o.note ? `<div class="run-note">${o.note}</div>` : ''}
        <div class="q-hint">מהזיכרון, בלי להציץ:</div>
        <h2 style="margin:4px 0 14px">מה יש במגירה של <span class="yi g-${g}">${art(g)}</span>?</h2>
        <div class="pick">${list.map((n, i) => `<button class="tok" data-i="${i}">${esc(n.w)}</button>`).join('')}</div>
        <div class="row" style="margin-top:18px"><button class="btn" id="chk">בדיקה</button></div><div id="sfb"></div>`);
      const app = document.getElementById('app');
      const btns = [...app.querySelectorAll('.pick .tok')];
      btns.forEach((b, i) => b.addEventListener('click', () => { if (picked.has(i)) picked.delete(i); else picked.add(i); b.classList.toggle('sel'); }));
      app.querySelector('#chk').addEventListener('click', (e) => {
        let good = 0;
        btns.forEach((b, i) => {
          const belongs = list[i].g === g || list[i].alt === g;
          b.disabled = true;
          b.classList.remove('sel');
          if (belongs) b.classList.add('g-' + g, 'inside');
          if (belongs === picked.has(i)) good++; else b.classList.add('miss');
        });
        e.target.remove();
        app.querySelector('#sfb').innerHTML = Y.disp(`<div class="fb ${good === list.length ? 'ok' : 'no'}"><h4>${good === list.length ? 'בדיוק' : 'המגירה הנכונה מסומנת בצבע'}</h4>
          <p class="ans g-${g}">${list.filter((n) => n.g === g || n.alt === g).map((n) => esc(`${art(g)} ${n.w}`)).join(' · ')}</p>
          <div class="row"><button class="btn small" id="snext">${k + 1 >= gs.length ? 'הלאה' : 'המגירה הבאה'}</button></div></div>`);
        app.querySelector('#snext').addEventListener('click', () => { k++; step(); });
      });
    };
    step();
  }

  const typedItems = (words) => Y.shuffle(words.slice()).map((n) => ({
    t: 't', q: '___', he: `הקלידי תווית ומילה: ${n.he} (${n.w})`, unit: 'b1', key: 'gt:' + n.w, gkey: G.nounKey(n),
    a: [`${art(n.g)} ${n.w}`].concat(n.alt ? [`${art(n.alt)} ${n.w}`] : []),
    ex: `{${G.phraseOf(n)}} — ${GN[n.g]}.`,
  }));

  const ratio = (log) => (log.length ? log.filter((l) => l.ok).length / log.length : 0);

  const result = (title, lines, links) => Y.ui.render(`<div class="card stack"><div><h2>${title}</h2>${lines.map((l) => `<p class="lead" style="margin:6px 0 0">${l}</p>`).join('')}</div>
    <div class="row">${links.map(([href, label, ghost]) => `<a class="btn${ghost ? ' ghost' : ''}" href="${href}">${label}</a>`).join('')}</div></div>`);

  /* ---------- views ---------- */

  const viewIndex = () => {
    const stub = G.stubborn();
    const cur = RULES.find((r) => !passed(r.id)) || GROUPS.find((g) => !passed(g.id));
    const tile = (id, href, small, title, sub) => `<a class="tile${cur && cur.id === id ? ' next' : ''}" href="${href}"><span class="num">${passed(id) ? '✓' : tr(id) ? Math.round(tr(id).b * 100) + '%' : ''}</span>${small ? `<small>${small}</small>` : ''}<b>${title}</b><small>${sub}</small></a>`;
    const ruleTile = (r) => tile(r.id, '#/gender/' + r.id, cur && cur.id === r.id ? 'כאן ממשיכים' : '', Y.inline(r.title), `${ofKinds(r.kinds).length} מילים`);
    const doneG = GROUPS.filter((g) => passed(g.id)).length;
    Y.ui.render(`<h1>המין: <span class="yi">דער · די · דאָס</span></h1>
      <p class="lead">שלוש מגירות קבועות, כל אחת בצבע שלה. קודם המילים שיש להן חוק, אחר כך הנטיות, ורק בסוף המילים שפשוט זוכרים, שש בכל פעם.</p>
      ${drawersOf([])}
      <p><small>${sitting()} מתוך ${D.nouns.length} שמות העצם כבר נזכרו לאורך זמן (ענית עליהם נכון כמה פעמים, במרווחים של ימים).</small></p>
      ${stub.length ? `<a class="tile next" href="#/gender/stubborn" style="margin-top:8px"><span class="num">${stub.length}</span><b>המילים העקשניות שלי</b><small class="yi">${stub.slice(0, 8).map((n) => esc(n.w)).join(' · ')}${stub.length > 8 ? ' …' : ''}</small></a>` : ''}

      <div class="group-head"><h2>שלב 1 · חוקים</h2><small>כאן לא זוכרים מילים אלא חוק. מי שיודעת את החוק יודעת את המין גם של מילה חדשה.</small></div>
      <div class="grid" style="margin-top:10px">${RULES.filter((r) => r.stage === 1).map(ruleTile).join('')}</div>

      <div class="group-head"><h2>שלב 2 · נטיות</h2><small>נכון ברוב המקרים. קודם הנטייה, ואז בנפרד המעטות שיוצאות ממנה.</small></div>
      <div class="grid" style="margin-top:10px">${RULES.filter((r) => r.stage === 2).map(ruleTile).join('')}</div>

      <div class="group-head"><h2>שלב 3 · מילים בלי סימן</h2><small>${(byKind.none || []).length} מילים ב־${GROUPS.length} קבוצות של שש. עברת ${doneG}. קבוצה אחת ביום מספיקה; יותר מזה מתערבב.</small></div>
      <div class="grid" style="margin-top:10px">${GROUPS.map((g, i) => tile(g.id, '#/gender/' + g.id, cur && cur.id === g.id ? 'כאן ממשיכים' : '', 'קבוצה ' + (i + 1), `<span class="yi">${g.words.map((n) => `<span class="g-${n.g}">${esc(n.w)}</span>`).join(' · ')}</span>`)).join('')}</div>

      <p style="margin-top:24px"><small>אחרי שהמין של מילה יושב, <a href="#/track">המסלול בצעדים</a> מוסיף עליו תואר, <span class="yi">דעם</span> ומילות יחס.</small></p>`);
  };

  const viewRule = (r) => {
    const own = ofKinds(r.kinds);
    const earlier = RULES.slice(0, RULES.indexOf(r)).flatMap((x) => ofKinds(x.kinds));
    const start = () => {
      const mixIn = r.mix ? Y.shuffle(ofKinds(r.mix)).slice(0, 7) : Y.shuffle(earlier).slice(0, 3);
      const words = Y.shuffle(own.slice()).slice(0, 10).concat(mixIn);
      sortGame(words, { back: '#/gender/' + r.id, note: Y.inline(r.title), then: (first) => {
        const x = ratio(first);
        S.setTrack('gd:' + r.id, x);
        const nx = RULES[RULES.indexOf(r) + 1];
        result(x >= PASS ? 'החוק הזה עבר' : 'עוד לא 80%', [
          `${first.filter((l) => l.ok).length} מתוך ${first.length} בניסיון ראשון.`,
          x >= PASS ? 'כדי שיישב לאורך זמן, המילים האלה יחזרו בסשן היומי.' : 'כדאי לקרוא שוב את החוק ולעשות סבב נוסף לפני שממשיכים.',
        ], x >= PASS
          ? [[nx ? '#/gender/' + nx.id : '#/gender/' + GROUPS[0].id, nx ? 'הבא: ' + Y.inline(nx.title) : 'לשלב 3'], ['#/gender', 'כל השלבים', true]]
          : [['#/gender/' + r.id, 'לחוק ולסבב נוסף'], ['#/gender', 'כל השלבים', true]]);
      } });
    };
    Y.ui.render(`<a class="crumb" href="#/gender">→ המין</a>
      <h1>${Y.inline(r.title)}</h1>
      ${r.lines.map(([g, t]) => `<div class="rule-line g-${g}"><span class="rl">${Y.inline(t)}</span></div>`).join('')}
      ${r.note ? `<p class="lead">${Y.inline(r.note)}</p>` : ''}
      <div class="row" style="margin:18px 0"><button class="btn" id="go">למיין למגירות</button></div>
      <h3>המילים</h3>
      <div class="gwords">${own.map(card).join('')}</div>`);
    document.getElementById('go').addEventListener('click', start);
  };

  const viewGroup = (g) => {
    const idx = GROUPS.indexOf(g);
    const back = '#/gender/' + g.id;
    const start = () => sortGame(g.words, { back, note: 'חלק 1 מתוך 3 · מיון', then: (first) => {
      drawerRecall(g.words, { back, note: 'חלק 2 מתוך 3 · מה יש בכל מגירה', then: () => {
        Y.ui.runSession(typedItems(g.words), { back, noRule: true, note: 'חלק 3 מתוך 3 · כתיבה עם התווית', then: (log) => {
          const x = Math.min(ratio(first), ratio(log));
          S.setTrack('gd:' + g.id, x);
          const nx = GROUPS[idx + 1];
          result(x >= PASS ? 'הקבוצה הזאת עברה' : 'עוד לא 80%', [
            `מיון: ${first.filter((l) => l.ok).length} מתוך ${first.length} בניסיון ראשון. כתיבה: ${log.filter((l) => l.ok).length} מתוך ${log.length}.`,
            x >= PASS ? 'שש המילים יחזרו בסשן היומי במרווחים הולכים וגדלים. מחר אפשר לעבור לקבוצה הבאה.' : 'קראי שוב את שש המילים בקול, ועשי סבב נוסף היום או מחר. לא מוסיפים מילים חדשות לפני שאלה יושבות.',
          ], x >= PASS && nx
            ? [['#/gender', 'סיימתי להיום'], ['#/gender/' + nx.id, 'לקבוצה הבאה', true]]
            : [[back, 'סבב נוסף'], ['#/gender', 'כל השלבים', true]]);
        } });
      } });
    } });
    Y.ui.render(`<a class="crumb" href="#/gender">→ המין</a>
      <h1>קבוצה ${idx + 1}</h1>
      <p class="lead">למילים האלה אין סימן, אז לא לומדים אותן לבד אלא כצירוף. קראי כל צירוף בקול פעם אחת, ואז התחילי.</p>
      <div class="gwords">${g.words.map(card).join('')}</div>
      ${drawersOf(g.words)}
      <div class="row" style="margin-top:18px"><button class="btn" id="go">להתחיל · מיון, מגירות, כתיבה</button></div>`);
    document.getElementById('go').addEventListener('click', start);
  };

  const viewStubborn = () => {
    const stub = G.stubborn();
    if (!stub.length) return result('אין כרגע מילים עקשניות', ['מילה נכנסת לרשימה אחרי שתי טעויות במין שלה, ויוצאת אחרי שלוש תשובות נכונות ברצף.'], [['#/gender', 'חזרה']]);
    const words = Y.shuffle(stub).slice(0, 8);
    const start = () => sortGame(words, { back: '#/gender/stubborn', note: 'המילים העקשניות', then: (first) => {
      Y.ui.runSession(typedItems(words), { back: '#/gender', noRule: true, note: 'המילים העקשניות · כתיבה עם התווית', then: (log) => {
        const left = G.stubborn().length;
        result('סבב עקשניות הסתיים', [
          `מיון: ${first.filter((l) => l.ok).length} מתוך ${first.length}. כתיבה: ${log.filter((l) => l.ok).length} מתוך ${log.length}.`,
          left ? `נשארו ${left} ברשימה. מילה יוצאת אחרי שלוש תשובות נכונות ברצף.` : 'הרשימה התרוקנה.',
        ], [['#/gender', 'סיימתי'], ...(left ? [['#/gender/stubborn', 'סבב נוסף', true]] : [])]);
      } });
    } });
    Y.ui.render(`<a class="crumb" href="#/gender">→ המין</a>
      <h1>המילים העקשניות שלי</h1>
      <p class="lead">מילים שטעית במין שלהן לפחות פעמיים. ${stub.length > 8 ? `יש ${stub.length}; בכל סבב שמונה מהן.` : ''} קראי כל צירוף בקול, ואז התחילי.</p>
      <div class="gwords">${words.map(card).join('')}</div>
      <div class="row" style="margin-top:18px"><button class="btn" id="go">להתחיל</button></div>`);
    document.getElementById('go').addEventListener('click', start);
  };

  Y.views.gender = (a) => {
    if (a === 'stubborn') return viewStubborn();
    const r = RULES.find((x) => x.id === a);
    if (r) return viewRule(r);
    const g = GROUPS.find((x) => x.id === a);
    return g ? viewGroup(g) : viewIndex();
  };
})();
