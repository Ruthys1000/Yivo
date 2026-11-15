/* Gender track: six nouns at a time, and one new thing per step —
   gender, then the adjective, then accusative, dative and the possessive. */
(function () {
  const Y = window.Y;
  const S = Y.store;
  const esc = Y.esc;
  Y.views = Y.views || {};

  /* word | gender | hebrew | adjective | hebrew phrase | plural */
  const SETS = [
    ['s1', 'קבוצה 1', `טיש|m|שולחן|גרויס|השולחן הגדול|טישן
טאָג|m|יום|שיין|היום היפה|טעג
שטאָט|f|עיר|גרויס|העיר הגדולה|שטעט
האַנט|f|יד|קליין|היד הקטנה|הענט
הויז|n|בית|אַלט|הבית הישן|הײַזער
בוך|n|ספר|גוט|הספר הטוב|ביכער`],
    ['s2', 'קבוצה 2', `קאָפּ|m|ראש|קלוג|הראש החכם|קעפּ
וועג|m|דרך|שווער|הדרך הקשה|וועגן
גאַס|f|רחוב|שיין|הרחוב היפה|גאַסן
וועלט|f|עולם|גרויס|העולם הגדול|וועלטן
קינד|n|ילד|קליין|הילד הקטן|קינדער
לאַנד|n|ארץ|רײַך|הארץ העשירה|לענדער`],
    ['s3', 'קבוצה 3', `בוים|m|עץ|גרין|העץ הירוק|ביימער
שטיין|m|אבן|שווער|האבן הכבדה|שטיינער
טיר|f|דלת|ווײַס|הדלת הלבנה|טירן
נאַכט|f|לילה|וואַרעם|הלילה החם|נעכט
וואָרט|n|מילה|וויכטיק|המילה החשובה|ווערטער
ליד|n|שיר|שיין|השיר היפה|לידער`],
    ['s4', 'קבוצה 4', `פֿוס|m|רגל|שטאַרק|הרגל החזקה|פֿיס
הונט|m|כלב|שוואַרץ|הכלב השחור|הינט
צונג|f|לשון|רויט|הלשון האדומה|צינגער
זאַך|f|דבר|טײַער|הדבר היקר|זאַכן
אויג|n|עין|בלוי|העין הכחולה|אויגן
יאָר|n|שנה|גוט|השנה הטובה|יאָרן`],
  ].map(([id, title, raw]) => ({
    id, title,
    words: raw.split('\n').map((l) => { const [w, g, he, adj, heP, pl] = l.split('|'); return { w, g, he, adj, heP, pl }; }),
  }));

  const STEPS = [
    { id: 'a', unit: 'b1', title: 'המין של כל מילה', rule: 'קודם בוחרים תווית, ואז מקלידים אותה מהזיכרון.' },
    { id: 'b', unit: 'c3', title: 'מוסיפים תואר', rule: '{דער} ← {־ער} · {די} ← {־ע} · {דאָס} ← {־ע}' },
    { id: 'c', unit: 'c1', title: 'מושא ישיר', rule: 'רק זכר משתנה: {דער} ← {דעם}. {די} ו־{דאָס} נשארות כמו שהן.' },
    { id: 'd', unit: 'c2', title: 'אחרי מילת יחס', rule: '{דער} ← {דעם} · {דאָס} ← {דעם} · {די} ← {דער}' },
    { id: 'e', unit: 'c6', title: '{מײַן} או {מײַנע}', rule: 'לפני יחיד תמיד {מײַן}, בכל מין. לפני רבים {מײַנע}.' },
  ];
  const PASS = 0.8;
  const GN = { m: 'זכר', f: 'נקבה', n: 'סתמי' };
  const END = { m: 'er', f: 'e', n: 'e' };
  const ART4 = ['דער', 'דעם', 'די', 'דאָס'];
  const art = (w, k) => Y.ART[k || 'nom'][w.g];
  const phrase = (w) => `${art(w)} ${Y.adj(w.adj, END[w.g])} ${w.w}`;

  /* All items of one step for one word: a recognition item, then a production item. */
  const build = {
    a: (w) => [
      { t: 'm', q: '___ ' + w.w, he: w.he, opts: ['דער', 'די', 'דאָס'], a: art(w), fixed: true, srs: 'g:' + w.g + ':' + w.w,
        ex: `{${art(w)} ${w.w}} — ${GN[w.g]}. כדי שזה יישב, אמרי בקול: {${phrase(w)}}.` },
      { t: 't', q: '___', he: `כתבי ביידיש, עם התווית: ה${w.he}`, a: [`${art(w)} ${w.w}`],
        ex: `{${art(w)} ${w.w}} — ${GN[w.g]}.` },
    ],
    b: (w) => {
      const forms = [Y.adj(w.adj, 'er'), Y.adj(w.adj, 'e'), Y.adj(w.adj, 'n')];
      const why = `{${art(w)}} ← התואר מקבל {־${w.g === 'm' ? 'ער' : 'ע'}}: {${phrase(w)}}.`;
      return [
        { t: 'm', q: `${art(w)} ___ ${w.w}`, he: `${w.heP} · התואר: ${w.adj}`, opts: forms, a: Y.adj(w.adj, END[w.g]), fixed: true, ex: why },
        { t: 't', q: '___', he: `כתבי ביידיש: ${w.heP} (${w.w} + ${w.adj})`, a: [phrase(w)], ex: `{${art(w)} ${w.w}} — ${GN[w.g]}. ${why}` },
      ];
    },
    c: (w) => {
      const frame = Y.pick(['איך זע', 'זי האָט ליב']);
      const why = w.g === 'm'
        ? `{דער ${w.w}} — זכר. כמושא ישיר {דער} ← {דעם}.`
        : `{${art(w)} ${w.w}} — ${GN[w.g]}. במושא ישיר רק זכר משתנה, ולכן נשאר {${art(w)}}.`;
      return [
        { t: 'm', q: `${frame} ___ ${w.w}.`, he: w.he, opts: ART4, a: art(w, 'acc'), fixed: true, ex: why },
        { t: 't', q: `${frame} ___.`, he: `הקלידי תווית ומילה: ה${w.he} (${w.w})`, a: [`${art(w, 'acc')} ${w.w}`], ex: why },
      ];
    },
    d: (w) => {
      const frame = Y.pick(['מיר רעדן וועגן', 'איך טראַכט וועגן']);
      const why = `{${art(w)} ${w.w}} — ${GN[w.g]}. אחרי מילת יחס {${art(w)}} ← {${art(w, 'dat')}}.`
        + (w.g === 'f' ? ' שימי לב: {דער} כאן אינו זכר, זו נקבה אחרי מילת יחס.' : '');
      return [
        { t: 'm', q: `${frame} ___ ${w.w}.`, he: `${w.he} · אחרי מילת יחס`, opts: ART4, a: art(w, 'dat'), fixed: true, ex: why },
        { t: 't', q: `${frame} ___.`, he: `הקלידי תווית ומילה: ה${w.he} (${w.w})`, a: [`${art(w, 'dat')} ${w.w}`], ex: why },
      ];
    },
    e: (w) => {
      const p = Y.pick(['מײַן', 'מײַן', 'דײַן', 'אונדזער']);
      const opts = [p, Y.join(p, 'ע'), Y.join(p, 'ער')];
      return [
        { t: 'm', q: `דאָס איז ___ ${w.w}.`, he: `${w.he} · יחיד או רבים?`, opts, a: p, fixed: true,
          ex: `{${w.w}} הוא יחיד (וגם הפועל {איז} ביחיד) ← {${p}}, בלי סיומת. המין של המילה לא משנה כאן.` },
        { t: 'm', q: `דאָס זײַנען ___ ${w.pl}.`, he: `${w.he} · יחיד או רבים?`, opts, a: Y.join(p, 'ע'), fixed: true,
          ex: `{${w.pl}} הוא רבים של {${w.w}} (וגם הפועל {זײַנען} ברבים) ← {${Y.join(p, 'ע')}}.` },
      ];
    },
  };

  /* A round: all recognition items first, then all production items, each half shuffled. */
  const round = (set, step) => {
    const first = [];
    const second = [];
    for (const w of set.words) {
      const [x, y] = build[step.id](w);
      for (const [it, k, list] of [[x, 1, first], [y, 2, second]]) {
        it.unit = step.unit;
        it.key = `tr:${step.id}${k}:${w.w}`;
        list.push(it);
      }
    }
    if (step.id === 'e') return Y.shuffle(first.concat(second));
    return Y.shuffle(first).concat(Y.shuffle(second));
  };

  const passed = (set, step) => { const t = S.track(set.id + ':' + step.id); return !!t && t.b >= PASS; };
  const nextStep = (set) => STEPS.find((st) => !passed(set, st));
  const doneCount = (set) => STEPS.filter((st) => passed(set, st)).length;

  const wordCards = (set) => `<div class="gwords">${set.words.map((w) => `
      <div class="gw g-${w.g}"><b class="yi">${esc(phrase(w))}</b><small>${esc(w.heP)} · רבים: <span class="yi">${esc(w.pl)}</span></small></div>`).join('')}</div>`;

  const viewIndex = () => {
    const cur = SETS.find((s) => nextStep(s)) || SETS[SETS.length - 1];
    const anyDone = SETS.some((s) => doneCount(s) > 0);
    Y.ui.render(`<h1><span class="yi">דער · די · דאָס</span> מההתחלה</h1>
      <p class="lead">שש מילים בכל פעם, ודבר חדש אחד בכל צעד. קודם רק המין; רק כשהוא יושב מוסיפים תואר, אחר כך {דעם}, ובסוף {מײַן}. אותן שש מילים מלוות את כל הצעדים, כך שתמיד יש על מה להישען.</p>
      <div class="note tip"><b>הצבעים</b><span class="yi g-m">דער</span> תמיד כחול, <span class="yi g-f">די</span> תמיד סגול, <span class="yi g-n">דאָס</span> תמיד זהוב. כך בכל התרגילים באתר.</div>
      <div class="grid" style="margin-top:16px">
        ${SETS.map((s) => `<a class="tile${s === cur ? ' next' : ''}" href="#/track/${s.id}"><span class="num">${doneCount(s)}/${STEPS.length}</span><b>${esc(s.title)}</b>
          <small class="yi">${s.words.map((w) => `<span class="g-${w.g}">${esc(w.w)}</span>`).join(' · ')}</small></a>`).join('')}
        ${anyDone ? '<a class="tile" href="#/track/mix"><b>חזרה מעורבת</b><small>שאלות מכל הצעדים שכבר עברת</small></a>' : ''}
      </div>
      <p><small>צעד נחשב "עבר" כשעונים נכון על 80% לפחות בסבב אחד. אין נעילה: אפשר לחזור לכל צעד או לדלג.</small></p>`
      .replace(/\{([^}<]*)\}/g, '<span class="yi">$1</span>'));
  };

  const viewSet = (set) => {
    const nx = nextStep(set);
    Y.ui.render(`<p><a href="#/track">← כל הקבוצות</a></p>
      <h1>${esc(set.title)}</h1>
      <p class="lead">קראי את שש המילים בקול, כל אחת עם התווית והתואר שלה. אחר כך התחילי בצעד המסומן.</p>
      ${wordCards(set)}
      <div class="steps">
        ${STEPS.map((st, k) => {
          const t = S.track(set.id + ':' + st.id);
          const ok = passed(set, st);
          return `<a class="tile step${st === nx ? ' next' : ''}" href="#/track/${set.id}/${st.id}">
            <span class="num">${ok ? '✓' : t ? Math.round(t.b * 100) + '%' : ''}</span>
            <small>צעד ${k + 1}${st === nx ? ' · כאן ממשיכים' : ''}</small><b>${Y.inline(st.title)}</b><small>${Y.inline(st.rule)}</small></a>`;
        }).join('')}
      </div>
      ${nx ? '' : '<div class="note tip"><b>הקבוצה הזאת יושבת</b>אפשר לעבור לקבוצה הבאה, ולחזור לכאן דרך "חזרה מעורבת".</div>'}`);
  };

  const run = (set, step) => {
    Y.ui.runSession(round(set, step), {
      back: '#/track/' + set.id, again: `#/track/${set.id}/${step.id}`,
      onDone: (log) => S.setTrack(set.id + ':' + step.id, log.filter((l) => l.ok).length / log.length),
      summary: (log) => {
        const ok = log.filter((l) => l.ok).length / log.length >= PASS;
        const nx = nextStep(set);
        return ok
          ? `<p>הצעד הזה עבר. ${nx ? `הצעד הבא: <a href="#/track/${set.id}/${nx.id}">${Y.inline(nx.title)}</a>.` : 'כל הצעדים בקבוצה הזאת עברו.'}</p>`
          : '<p>עוד לא 80%. כדאי לקרוא שוב את שש המילים בקול ולעשות סבב נוסף, לפני שמוסיפים דבר חדש.</p>';
      },
    });
  };

  const runMix = () => {
    const items = [];
    for (const s of SETS) for (const st of STEPS) if (passed(s, st)) items.push(...round(s, st));
    Y.ui.runSession(Y.shuffle(items).slice(0, 12), { back: '#/track', again: '#/track/mix' });
  };

  Y.views.track = (a, b) => {
    if (a === 'mix') return runMix();
    const set = SETS.find((s) => s.id === a);
    if (!set) return viewIndex();
    const step = STEPS.find((st) => st.id === b);
    return step ? run(set, step) : viewSet(set);
  };
})();
