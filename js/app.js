/* UI: router, views, exercise runner. */
(function () {
  const Y = window.Y;
  const D = Y.data;
  const S = Y.store;
  const G = Y.gen;
  const $app = document.getElementById('app');
  const esc = Y.esc;
  const ARTS = ['דער', 'די', 'דאָס'];

  const render = (html) => {
    $app.innerHTML = Y.disp(html);
    window.scrollTo(0, 0);
  };
  const unitById = (id) => D.units.find((u) => u.id === id);
  const pct = (x) => Math.round(x * 100);

  const badge = (id) => {
    const m = S.mastery(id);
    const diag = S.state.diag;
    if (m === null) {
      if (diag && diag[id] === 0) return '<span class="badge weak">לחזק</span>';
      return '<span class="badge">חדש</span>';
    }
    const cls = m >= 0.85 ? 'done' : m >= 0.5 ? 'mid' : 'weak';
    return `<span class="badge ${cls}">${pct(m)}%</span>`;
  };

  /* Which unit a free-standing drill counts towards. */
  const SPELL_UNIT = { n: 'a1', pf: 'a2', vv: 'a2', ay: 'a3', yi: 'a3', h: 'a4', dbl: 'a4', ie: 'a4', ig: 'a4', likh: 'a4', pre: 'a4', en: 'a4', sep: 'a5', heb: 'a6' };
  const DRILLS = [
    { id: 'gender', title: '{דער, די, דאָס}', sub: 'המין של כל שם עצם, בחזרה מרווחת', spec: ['gender'], unit: 'b1', n: 15 },
    { id: 'art', title: 'התווית הנכונה', sub: '{דער, דעם, די, דאָס} לפי התפקיד במשפט', spec: ['art:nom,acc,dat'], unit: 'c2', n: 12 },
    { id: 'adj', title: 'תווית + תואר', sub: '{דער גוטער, דעם גוטן, די גוטע}', spec: ['case:def'], unit: 'c3', n: 12 },
    { id: 'indef', title: 'תואר אחרי {אַ}', sub: '{אַ גוטער, אַ גוטע, אַ גוט}', spec: ['case:indef', 'case:nsp'], unit: 'c4', n: 12 },
    { id: 'spell', title: 'כתיב תקני', sub: 'מהכתיב המוכר אל כתיב ייִוואָ', spec: ['spell'], unit: null, n: 15 },
    { id: 'aux', title: '{האָבן} או {זײַן}', sub: 'פועל העזר בזמן עבר', spec: ['aux'], unit: 'd2', n: 15 },
    { id: 'part', title: 'הבינוני', sub: 'כתיבת צורות העבר: {געשריבן, געמאַכט}', spec: ['part'], unit: 'd3', n: 10 },
    { id: 'pres', title: 'נטיית ההווה', sub: '{שרײַב, שרײַבסט, שרײַבט}', spec: ['pres'], unit: 'd1', n: 12 },
    { id: 'plural', title: 'רבים', sub: '{טיש ← טישן, בוך ← ביכער}', spec: ['plural'], unit: 'b3', n: 12 },
    { id: 'dim', title: 'הקטנה', sub: '{הויז ← הײַזל}', spec: ['dim'], unit: 'b4', n: 10 },
    { id: 'comp', title: 'דרגת היתרון', sub: '{גרויס ← גרעסער}', spec: ['comp'], unit: 'c7', n: 10 },
    { id: 'tense', title: 'מהווה לעבר ולעתיד', sub: '{איך גיי ← איך בין געגאַנגען}', spec: ['tense'], unit: null, n: 10 },
  ];
  const GAMES = [
    { id: 'hunt', title: 'מצאי את הטעות', sub: 'משפט עם מקום אחד שאינו לפי התקן. כמו הגהה.', spec: ['hunt'], unit: null, n: 10 },
    { id: 'prov', title: 'פתגמים', sub: 'השלימי את הפתגם, ולמדי אותו על הדרך', spec: ['proverb'], unit: null, n: 10 },
  ];


  const genItems = (specs, n, unit) => {
    const items = [];
    const seen = new Set();
    let guard = 0;
    while (items.length < n && guard++ < n * 8) {
      const spec = Y.pick(specs);
      const it = G.run(spec, unit);
      const sig = it.key + '|' + it.q;
      if (seen.has(sig)) continue;
      seen.add(sig);
      if (!it.unit && it.key.startsWith('sp:')) {
        const s = D.spell.find((x) => 'sp:' + x.good === it.key);
        if (s) it.unit = SPELL_UNIT[s.tag];
      }
      items.push(it);
    }
    return items;
  };

  /* ================= exercise runner ================= */

  const KEYS = ['אַ', 'אָ', 'פּ', 'פֿ', 'ײַ', 'יִ', 'וּ', 'בֿ', 'כּ', 'שׂ', 'תּ', '־', '׳'].map((k) => Y.disp(k.normalize('NFD')));

  let enterHandler = null;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && enterHandler && !e.shiftKey && !(e.target && e.target.tagName === 'TEXTAREA')) {
      e.preventDefault();
      enterHandler();
    }
  });

  function runSession(items, o) {
    let i = 0;
    const log = [];

    const head = () => `
      <div class="run-head">
        <a class="x" href="${o.back}" aria-label="סגירה">×</a>
        <div class="bar"><i style="width:${(i / items.length) * 100}%"></i></div>
        <span class="cnt">${Math.min(i + 1, items.length)}/${items.length}</span>
      </div>`;

    const qHtml = (it, filled, ok) => {
      if (it.q === '___' || !it.q) return '';
      const inner = filled ? `<span class="blank${ok ? ' ok' : ''}">${esc(filled)}</span>` : '<span class="blank">&nbsp;</span>';
      return `<div class="q-text">${esc(it.q).replace('___', inner)}</div>`;
    };

    const feedback = (it, ok, shown, extra) => {
      S.answer(it, ok);
      log.push({ it, ok });
      const u = it.unit && !o.unitId ? unitById(it.unit) : null;
      const box = document.createElement('div');
      box.className = 'fb ' + (ok ? 'ok' : 'no');
      box.innerHTML = Y.disp(`
        <h4>${ok ? 'נכון' : 'התשובה לפי התקן'}</h4>
        ${extra ? `<p>${extra}</p>` : ''}
        ${ok && !extra ? '' : `<p class="ans">${esc(shown)}</p>`}
        ${it.ex ? `<p>${Y.inline(it.ex)}</p>` : ''}
        <div class="row">
          <button class="btn" id="next">${i + 1 >= items.length ? 'סיום' : 'הבא'}</button>
          ${!ok && u ? `<a class="btn ghost small" href="#/unit/${u.id}">ליחידה: ${Y.inline(u.title)}</a>` : ''}
        </div>`);
      $app.appendChild(box);
      const go = () => { enterHandler = null; i++; step(); };
      box.querySelector('#next').addEventListener('click', go);
      setTimeout(() => { enterHandler = go; }, 150);
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const showChoice = (it) => {
      let opts = Y.uniq(it.opts.map(String));
      if (opts.every((x) => ARTS.some((a) => Y.canon(a) === Y.canon(x)))) {
        opts = ARTS.filter((a) => opts.some((x) => Y.canon(a) === Y.canon(x)));
      } else if (!it.fixed) opts = Y.shuffle(opts);
      const three = opts.length === 3 && opts.every((x) => x.length <= 9);
      render(`${head()}
        <div class="q-hint">${esc(it.he || 'השלימי את החסר')}</div>
        ${it.plainQ ? `<div class="q-text">${esc(it.q)}</div>` : qHtml(it)}
        <div class="opts${three ? ' three' : ''}">
          ${opts.map((x, k) => `<button class="opt${it.heOpts ? ' he' : ''}" data-k="${k}">${esc(x)}</button>`).join('')}
        </div>`);
      const btns = [...$app.querySelectorAll('.opt')];
      btns.forEach((b, k) => b.addEventListener('click', () => {
        const chosen = opts[k];
        const ok = Y.canon(chosen) === Y.canon(it.a);
        btns.forEach((x, j) => {
          x.disabled = true;
          if (Y.canon(opts[j]) === Y.canon(it.a)) x.classList.add('right');
          else if (j === k) x.classList.add('wrong');
          else x.classList.add('dim');
        });
        const qt = $app.querySelector('.q-text');
        if (qt && !it.plainQ) qt.outerHTML = Y.disp(qHtml(it, it.a, true));
        feedback(it, ok, it.a);
      }));
    };

    const showType = (it) => {
      render(`${head()}
        <div class="q-hint">${esc(it.he || 'כתבי את התשובה')}</div>
        ${it.plainQ ? `<div class="q-text">${esc(it.q)}</div>` : qHtml(it)}
        <input class="type-in" id="ans" type="text" lang="yi" dir="rtl" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="התשובה שלך">
        <div class="keys" aria-label="אותיות מיוחדות">${KEYS.map((k) => `<button type="button" data-ch="${k}">${k}</button>`).join('')}</div>
        <button class="btn" id="check">בדיקה</button>`);
      const inp = $app.querySelector('#ans');
      inp.focus();
      $app.querySelectorAll('.keys button').forEach((b) => b.addEventListener('click', () => {
        const ch = b.dataset.ch;
        const s = inp.selectionStart ?? inp.value.length;
        const e = inp.selectionEnd ?? inp.value.length;
        // a diacritic key pressed right after its base letter replaces that letter
        let before = inp.value.slice(0, s);
        const base = ch.normalize('NFD')[0];
        if (ch.length > 1 && before.endsWith(base) && Y.canon(ch) !== Y.canon('ײַ')) before = before.slice(0, -1);
        inp.value = before + ch + inp.value.slice(e);
        const pos = (before + ch).length;
        inp.focus();
        inp.setSelectionRange(pos, pos);
      }));
      const check = () => {
        const val = inp.value.trim();
        if (!val) { inp.focus(); return; }
        enterHandler = null;
        const exact = it.a.some((a) => Y.canon(a) === Y.canon(val));
        const loose = it.a.some((a) => Y.bare(a) === Y.bare(val));
        const strict = it.strict || S.settings().strict;
        const ok = exact || (loose && !strict);
        let extra = '';
        if (!exact && loose) extra = ok ? 'נכון, אבל שימי לב לסימנים (אַ, אָ, פּ, פֿ, ײַ...).' : 'כמעט: האותיות נכונות, חסרים או שגויים הסימנים.';
        inp.disabled = true;
        $app.querySelector('#check').remove();
        $app.querySelector('.keys').remove();
        inp.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)';
        feedback(it, ok, it.a[0], extra);
      };
      $app.querySelector('#check').addEventListener('click', check);
      enterHandler = check;
    };

    const showOrder = (it) => {
      const target = it.a[0].split(' ');
      let pool = Y.shuffle(target.map((w, k) => ({ w, k })));
      if (pool.map((p) => p.w).join(' ') === target.join(' ') && pool.length > 1) pool.reverse();
      let line = [];
      const draw = () => {
        render(`${head()}
          <div class="q-hint">סדרי את המילים למשפט: ${esc(it.he)}</div>
          <div class="order-line"><span class="lead-w">${esc(it.lead)}</span>
            ${line.map((p) => `<button class="tok" data-line="${p.k}">${esc(p.w)}</button>`).join('')}</div>
          <div class="pool">${pool.map((p) => `<button class="tok" data-pool="${p.k}">${esc(p.w)}</button>`).join('')}</div>
          <button class="btn" id="check" ${pool.length ? 'disabled' : ''}>בדיקה</button>`);
        $app.querySelectorAll('[data-pool]').forEach((b) => b.addEventListener('click', () => {
          const k = +b.dataset.pool;
          line.push(pool.find((p) => p.k === k));
          pool = pool.filter((p) => p.k !== k);
          draw();
        }));
        $app.querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => {
          const k = +b.dataset.line;
          pool.push(line.find((p) => p.k === k));
          line = line.filter((p) => p.k !== k);
          draw();
        }));
        const chk = $app.querySelector('#check');
        const check = () => {
          if (pool.length) return;
          enterHandler = null;
          const got = line.map((p) => p.w).join(' ');
          const ok = it.a.some((a) => Y.canon(a) === Y.canon(got));
          $app.querySelectorAll('.tok').forEach((t) => { t.disabled = true; });
          chk.remove();
          feedback(it, ok, it.lead + ' ' + it.a[0]);
        };
        chk.addEventListener('click', check);
        enterHandler = pool.length ? null : check;
      };
      draw();
    };

    const showHunt = (it) => {
      render(`${head()}
        <div class="q-hint">${esc(it.he)}</div>
        <div class="hunt">${it.tokens.map((w, k) => `<button class="tok" data-k="${k}">${esc(w)}</button>`).join(' ')}</div>`);
      const btns = [...$app.querySelectorAll('.hunt .tok')];
      btns.forEach((b, k) => b.addEventListener('click', () => {
        const ok = it.bad.includes(k);
        btns.forEach((x, j) => {
          x.disabled = true;
          if (it.bad.includes(j)) x.classList.add('target');
          else if (j === k) x.classList.add('miss');
        });
        feedback(it, ok, it.fix, ok ? 'מצאת. הנוסח התקני:' : 'המקום הבעייתי מסומן. הנוסח התקני:');
      }));
    };

    const finish = () => {
      enterHandler = null;
      const right = log.filter((l) => l.ok).length;
      const wrong = log.filter((l) => !l.ok);
      if (o.onDone) o.onDone(log);
      const showAns = (it) => (it.t === 'h' ? it.fix : it.t === 'o' ? it.lead + ' ' + it.a[0] : it.t === 't' ? it.a[0] : (it.q && it.q !== '___' && !it.plainQ ? it.q.replace('___', it.a) : it.a));
      render(`
        <div class="card stack">
          <div><div class="result-num">${right}/${log.length}</div>
          <p class="lead">${right === log.length ? 'הכול נכון. יישר כּוח!' : right / log.length >= 0.7 ? 'יפה. הטעויות נשמרו לחזרה.' : 'זה בדיוק החומר שכדאי לחזור עליו. הטעויות נשמרו.'}</p></div>
          ${o.summary ? o.summary(log) : ''}
          <div class="row">
            ${o.again ? `<a class="btn" href="${o.again}" id="again">סבב נוסף</a>` : ''}
            <a class="btn ghost" href="${o.back}">חזרה</a>
          </div>
        </div>
        ${wrong.length ? `<h3>לחזרה</h3><ul class="miss">${wrong.map((l) => `<li><span class="yi">${esc(showAns(l.it))}</span>${l.it.ex ? `<br><small>${Y.inline(l.it.ex)}</small>` : ''}</li>`).join('')}</ul>` : ''}`);
      const again = $app.querySelector('#again');
      if (again) again.addEventListener('click', (e) => { e.preventDefault(); route(true); });
    };

    const step = () => {
      enterHandler = null;
      if (i >= items.length) return finish();
      const it = items[i];
      if (it.t === 't') showType(it);
      else if (it.t === 'h') showHunt(it);
      else if (it.t === 'o') showOrder(it);
      else showChoice(it);
    };

    if (!items.length) {
      render(`<div class="card"><p>אין כרגע פריטים לתרגול כאן.</p><a class="btn ghost" href="${o.back}">חזרה</a></div>`);
      return;
    }
    step();
  }

  /* ================= views ================= */

  const nextUnit = () => {
    const diag = S.state.diag;
    const started = D.units.find((u) => { const m = S.mastery(u.id); return m !== null && m < 0.85; });
    if (started) return started;
    if (diag) {
      const weak = D.units.find((u) => diag[u.id] === 0 && S.mastery(u.id) === null);
      if (weak) return weak;
    }
    return D.units.find((u) => S.mastery(u.id) === null) || D.units[0];
  };

  const allVocabKeys = () => D.decks.flatMap((d) => d.words.map((w) => w.y));

  function viewHome() {
    const nu = nextUnit();
    const dueWords = S.dueCount('v:', allVocabKeys());
    const mist = S.state.mistakes.length;
    const hasProgress = Object.keys(S.state.units).length > 0;
    const pv = D.proverbs[S.today() % D.proverbs.length];
    const groups = D.groups.map((g) => {
      const us = D.units.filter((u) => u.group === g.id);
      const avg = us.reduce((a, u) => a + (S.mastery(u.id) || 0), 0) / us.length;
      return `<div class="prog-row"><div><div class="lbl">${esc(g.title)}</div><div class="bar"><i style="width:${pct(avg)}%"></i></div></div><div class="pct">${pct(avg)}%</div></div>`;
    }).join('');

    render(`<div class="stack">
      <div>
        <h1><span class="yi">שלום־עליכם!</span></h1>
        <p class="lead">את כבר מדברת יידיש. כאן לומדים את הכללים שמאחוריה, לפי התקן של ייִוואָ.</p>
      </div>

      ${!S.state.diag && !hasProgress ? `
      <div class="card hero stack">
        <div><h2>נתחיל במבחן אבחון קצר</h2>
        <p class="lead">${D.units.length} שאלות, אחת מכל נושא, כעשר דקות. בסופו תדעי אילו כללים כבר יושבים אצלך מהבית ואילו כדאי ללמוד קודם.</p></div>
        <div class="row"><a class="btn" href="#/diag">להתחיל</a></div>
      </div>` : `
      <div class="card hero stack">
        <div><small>היחידה הבאה</small><h2>${Y.inline(nu.title)}</h2><p class="lead">${Y.inline(nu.sub)}</p></div>
        <div class="row"><a class="btn" href="#/unit/${nu.id}">להמשיך</a></div>
      </div>`}

      <div class="card">
        <div class="stats">
          <div class="stat"><b>${S.streak()}</b><span>ימים ברצף</span></div>
          <div class="stat"><b>${S.todayCount()}<small style="font-size:.9rem;font-weight:600">/${S.GOAL}</small></b><span>היעד היומי</span></div>
          <div class="stat"><b>${D.units.filter((u) => (S.mastery(u.id) || 0) >= 0.85).length}/${D.units.length}</b><span>יחידות הושלמו</span></div>
        </div>
        <div class="bar" style="margin-top:14px" title="היעד היומי"><i style="width:${Math.min(100, (S.todayCount() / S.GOAL) * 100)}%"></i></div>
      </div>

      <div class="grid">
        <a class="tile" href="#/daily"><b>תרגול יומי</b><small>12 שאלות מעורבות: טעויות, מילים, נושאים חלשים</small></a>
        <a class="tile" href="#/drill/gender"><b><span class="yi">דער, די, דאָס</span></b><small>המין הדקדוקי, מילה אחרי מילה</small></a>
        <a class="tile" href="#/words"><span class="num">${dueWords || ''}</span><b>מילים</b><small>${dueWords ? 'מילים מחכות לחזרה' : 'אוצר מילים תקני וספרותי'}</small></a>
        <a class="tile" href="#/mistakes"><span class="num">${mist || ''}</span><b>הטעויות שלי</b><small>${mist ? 'חזרה על מה שלא ידעת' : 'אין כרגע טעויות פתוחות'}</small></a>
      </div>

      <div class="card proverb">
        <small>פתגם היום</small>
        <div class="yi pv">${esc(pv.full)}</div>
        <div>${esc(pv.he)}</div>
        <small>${Y.inline(pv.note)}</small>
      </div>

      <div class="grid">
        <a class="tile" href="#/check"><b>בודק כתיב</b><small>הדביקי טקסט וראי מה שונה מכתיב ייִוואָ</small></a>
        <a class="tile" href="#/blitz"><span class="num">${S.best('blitz') || ''}</span><b>בליץ</b><small>60 שניות של <span class="yi">דער, די, דאָס</span></small></a>
      </div>

      <div class="card"><h2 style="margin-bottom:12px">התקדמות</h2>${groups}
        <div class="map" aria-label="מפת היחידות">${D.units.map((u) => {
          const m = S.mastery(u.id);
          const lvl = m === null ? (S.state.diag && S.state.diag[u.id] === 0 ? 'w' : '0') : m >= 0.85 ? '3' : m >= 0.5 ? '2' : '1';
          return `<a class="cell l${lvl}" href="#/unit/${u.id}" title="${esc(u.title)}${m === null ? '' : ' · ' + pct(m) + '%'}"><span>${u.id.toUpperCase()}</span></a>`;
        }).join('')}</div>
        <p class="legend"><i class="cell l0"></i>חדש <i class="cell lw"></i>לחזק <i class="cell l1"></i>התחלתי <i class="cell l2"></i>בדרך <i class="cell l3"></i>יושב</p>
        ${S.state.diag || hasProgress ? '<p style="margin-bottom:0"><a href="#/diag">מבחן אבחון מחדש</a></p>' : ''}</div>
    </div>`);
  }

  function viewLearn() {
    render(`<h1>מסלול הלימוד</h1>
      <p class="lead">${D.units.length} יחידות. בכל אחת הסבר קצר, השוואה ליידיש מהבית, ותרגול. אפשר ללמוד לפי הסדר או לקפוץ לנושא שעלה בשיעור.</p>
      ${D.groups.map((g) => `
        <div class="group-head"><h2>${esc(g.title)}</h2><small>${esc(g.blurb)}</small></div>
        <ul class="units">${D.units.filter((u) => u.group === g.id).map((u) => `
          <li><a href="#/unit/${u.id}"><span class="t"><b>${Y.inline(u.title)}</b><small>${Y.inline(u.sub)}</small></span>${badge(u.id)}</a></li>`).join('')}
        </ul>`).join('')}`);
  }

  function viewUnit(id) {
    const u = unitById(id);
    if (!u) return viewLearn();
    const idx = D.units.indexOf(u);
    const prev = D.units[idx - 1];
    const next = D.units[idx + 1];
    const g = D.groups.find((x) => x.id === u.group);
    render(`<a class="crumb" href="#/learn">→ ${esc(g.title)}</a>
      <div class="row" style="justify-content:space-between"><h1>${Y.inline(u.title)}</h1>${badge(u.id)}</div>
      <p class="lead">${Y.inline(u.sub)}</p>
      <div class="row" style="margin:16px 0"><a class="btn" href="#/unit/${u.id}/go">תרגול</a></div>
      <div class="lesson">${Y.fmt(u.text)}</div>
      <div class="row" style="margin-top:24px">
        <a class="btn" href="#/unit/${u.id}/go">תרגול · 10 שאלות</a>
        ${Y.ai.enabled() ? `<button class="btn ghost" id="aiex">תרגילים חדשים מהמורה</button>` : ''}
      </div>
      <div id="aimsg"></div>
      <div class="row" style="margin-top:28px;justify-content:space-between">
        ${prev ? `<a href="#/unit/${prev.id}">→ ${Y.inline(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a href="#/unit/${next.id}">${Y.inline(next.title)} ←</a>` : '<span></span>'}
      </div>`);
    const b = $app.querySelector('#aiex');
    if (b) b.addEventListener('click', async () => {
      const box = $app.querySelector('#aimsg');
      b.disabled = true;
      box.innerHTML = '<p><span class="spin"></span> המורה כותבת תרגילים חדשים, זה לוקח כחצי דקה...</p>';
      try {
        const items = await Y.ai.exercises(u);
        if (!items.length) throw new Error('לא התקבלו תרגילים. נסי שוב.');
        if (location.hash !== '#/unit/' + u.id) return;
        runSession(items, { back: '#/unit/' + u.id, unitId: u.id });
      } catch (e) {
        box.innerHTML = `<p class="alert">${esc(e.message)}</p>`;
        b.disabled = false;
      }
    });
  }

  function viewUnitGo(id) {
    const u = unitById(id);
    if (!u) return viewLearn();
    runSession(G.unitRound(u, 10), { back: '#/unit/' + id, again: '#/unit/' + id + '/go', unitId: id });
  }

  function viewPractice() {
    const mist = S.state.mistakes.length;
    render(`<h1>תרגול</h1>
      <p class="lead">תרגילים שנוצרים מחדש בכל פעם, כך שאפשר לחזור עליהם כמה שרוצים.</p>
      <div class="grid" style="margin-top:16px">
        <a class="tile" href="#/daily"><b>תרגול יומי</b><small>12 שאלות מעורבות לפי מה שאת צריכה</small></a>
        <a class="tile" href="#/mistakes"><span class="num">${mist || ''}</span><b>הטעויות שלי</b><small>חזרה על שאלות שטעית בהן</small></a>
      </div>
      <h3>משחקים</h3>
      <div class="grid">
        <a class="tile" href="#/blitz"><span class="num">${S.best('blitz') || ''}</span><b>בליץ <span class="yi">דער · די · דאָס</span></b><small>60 שניות, כמה שיותר מילים</small></a>
        ${GAMES.map((d) => `<a class="tile" href="#/drill/${d.id}"><b>${Y.inline(d.title)}</b><small>${Y.inline(d.sub)}</small></a>`).join('')}
      </div>
      <h3>תרגילי שינון</h3>
      <div class="grid">
        ${DRILLS.map((d) => `<a class="tile" href="#/drill/${d.id}"><b>${Y.inline(d.title)}</b><small>${Y.inline(d.sub)}</small></a>`).join('')}
      </div>`);
  }

  function viewDrill(id) {
    const d = DRILLS.concat(GAMES).find((x) => x.id === id);
    if (!d) return viewPractice();
    runSession(genItems(d.spec, d.n, d.unit), { back: '#/practice', again: '#/drill/' + id });
  }

  function dailyItems() {
    const items = S.state.mistakes.slice(0, 3).map((m) => Object.assign({}, m));
    // vocabulary: due words first, then new ones from the loanword deck
    const t = S.today();
    const due = [];
    for (const d of D.decks) for (const w of d.words) {
      const s = S.srs('v:' + w.y);
      if (s && s.d <= t) due.push([d.id, w]);
    }
    for (const [did, w] of Y.shuffle(due).slice(0, 3)) items.push(G.vocab(did, w));
    if (due.length < 3) for (let k = due.length; k < 3; k++) items.push(G.vocab(Y.pick(D.decks).id));
    items.push(...genItems(['gender'], 2, 'b1'));
    items.push(...genItems(['hunt'], 1), ...genItems(['proverb'], 1));
    // weakest started units, otherwise the next one in the course
    const started = D.units.filter((u) => S.mastery(u.id) !== null).sort((a, b) => S.mastery(a.id) - S.mastery(b.id)).slice(0, 2);
    const pool = started.length ? started : [nextUnit()];
    for (const u of pool) items.push(...G.unitRound(u, started.length > 1 ? 2 : 4));
    const seen = new Set();
    return Y.shuffle(items.filter((it) => { const k = it.key + '|' + it.q; if (seen.has(k)) return false; seen.add(k); return true; })).slice(0, 12);
  }

  function viewDiag() {
    const items = [];
    for (const u of D.units) {
      const hand = u.ex.map((t, i) => G.fromTuple(t, u.id, i)).filter((x) => x && x.t === 'm');
      if (hand.length) items.push(Y.pick(hand));
    }
    runSession(items, {
      back: '#/home',
      unitId: 'diag',
      onDone(log) {
        const res = {};
        for (const l of log) res[l.it.unit] = l.ok ? 1 : 0;
        S.setDiag(res);
      },
      summary(log) {
        const weak = log.filter((l) => !l.ok).map((l) => unitById(l.it.unit));
        if (!weak.length) return '<p>כל הנושאים יושבים אצלך היטב. אפשר לעבור על היחידות לפי הסדר כדי להכיר את הכללים בשמם.</p>';
        return `<div><h3 style="margin-top:0">כדאי להתחיל כאן</h3><ul class="units">${weak.map((u) => `<li><a href="#/unit/${u.id}"><span class="t"><b>${Y.inline(u.title)}</b><small>${Y.inline(u.sub)}</small></span></a></li>`).join('')}</ul>
          <p><small>שאלה אחת לנושא היא רק אינדיקציה. היחידות האלה מסומנות "לחזק" במסלול הלימוד.</small></p></div>`;
      },
    });
  }

  /* ---------- words ---------- */

  const wordDot = (key) => {
    const s = S.srs(key);
    return `<span class="dot${s ? (s.b >= 3 ? ' k' : ' s') : ''}" title="${s ? (s.b >= 3 ? 'יודעת' : 'בלמידה') : 'חדשה'}"></span>`;
  };

  function viewWords() {
    const my = S.state.mywords;
    render(`<h1>מילים</h1>
      <p class="lead">אוצר מילים תקני וספרותי בחזרה מרווחת: מילה שידעת חוזרת אחרי כמה ימים, מילה שלא ידעת חוזרת מייד.</p>
      <div class="grid" style="margin-top:16px">
        ${D.decks.map((d) => {
          const keys = d.words.map((w) => w.y);
          const due = S.dueCount('v:', keys);
          const known = S.knownCount('v:', keys);
          return `<a class="tile" href="#/deck/${d.id}"><span class="num">${due || ''}</span><b>${esc(d.title)}</b><small>${known}/${keys.length} ידועות${due ? ' · ' + due + ' לחזרה' : ''}</small></a>`;
        }).join('')}
      </div>

      <h3>המילים שלי</h3>
      <div class="card stack">
        <p style="margin:0"><small>מילה חדשה מהשיעור או מספר? הוסיפי אותה כאן והיא תיכנס לתרגול.</small></p>
        <form id="addw" class="stack">
          <div class="form-grid">
            <label class="field"><span>ביידיש</span><input class="yi-in" name="y" lang="yi" dir="rtl" required autocomplete="off"></label>
            <label class="field"><span>פירוש</span><input name="he" required autocomplete="off"></label>
          </div>
          <label class="field"><span>הערה (מין, רבים, משפט לדוגמה)</span><input name="note" autocomplete="off"></label>
          <div class="row"><button class="btn small">הוספה</button>
          ${my.length ? `<a class="btn ghost small" href="#/mywords">תרגול (${my.length})</a>` : ''}</div>
        </form>
        ${my.length ? `<ul class="wlist">${my.map((w) => `<li><span class="yi">${esc(w.y)}</span><span>${esc(w.he)}</span><button class="btn ghost small" data-del="${esc(w.y)}" aria-label="מחיקה">×</button>${w.note ? `<small>${esc(w.note)}</small>` : ''}</li>`).join('')}</ul>` : ''}
      </div>`);
    $app.querySelector('#addw').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const y = String(f.get('y')).trim();
      const he = String(f.get('he')).trim();
      if (!y || !he) return;
      S.addWord({ y, he, note: String(f.get('note')).trim() });
      viewWords();
    });
    $app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { S.removeWord(b.dataset.del); viewWords(); }));
  }

  function viewDeck(id) {
    const d = D.decks.find((x) => x.id === id);
    if (!d) return viewWords();
    render(`<a class="crumb" href="#/words">→ מילים</a>
      <h1>${esc(d.title)}</h1><p class="lead">${esc(d.blurb)}</p>
      <div class="row" style="margin:16px 0"><a class="btn" href="#/deck/${d.id}/go">תרגול · 12 מילים</a></div>
      <div class="card"><ul class="wlist">${d.words.map((w) => `<li><span class="yi">${esc(w.y)}</span><span>${esc(w.he)}</span>${wordDot('v:' + w.y)}${w.note ? `<small>${Y.inline(w.note)}</small>` : ''}</li>`).join('')}</ul></div>`);
  }

  function viewDeckGo(id) {
    const d = D.decks.find((x) => x.id === id);
    if (!d) return viewWords();
    const items = [];
    const seen = new Set();
    let guard = 0;
    while (items.length < Math.min(12, d.words.length) && guard++ < 100) {
      const it = G.vocab(id);
      if (seen.has(it.key)) continue;
      seen.add(it.key);
      items.push(it);
    }
    runSession(items, { back: '#/deck/' + id, again: '#/deck/' + id + '/go' });
  }

  /* ---------- AI ---------- */

  let chatHistory = [];
  const TOPIC = {
    gender: ['מין דקדוקי', 'b1'], case: ['יחסה', 'c2'], adjective: ['סיומת תואר', 'c3'], spelling: ['כתיב', 'a4'],
    verb: ['פועל', 'd2'], syntax: ['תחביר', 'e1'], vocab: ['אוצר מילים', null], other: ['אחר', null],
  };

  function viewAi(tab) {
    if (!Y.ai.enabled()) {
      render(`<h1>המורה</h1>
        <div class="card stack">
          <p>כאן אפשר לחבר את Claude, מודל הבינה המלאכותית של Anthropic, בתור מורה פרטית:</p>
          <ul>
            <li><b>בדיקת כתיבה</b>: כותבים פסקה ביידיש ומקבלים תיקון לפי התקן, עם הכלל שמאחורי כל תיקון.</li>
            <li><b>שאלות</b>: על מילה, על כלל, או על ההבדל בין מה שאומרים בבית למה שכותבים בתקן.</li>
            <li><b>תרגילים חדשים</b> לכל יחידה במסלול.</li>
          </ul>
          <p>כל שאר הכלי עובד בלי זה. החיבור דורש מפתח API אישי בתשלום לפי שימוש; בדיקת פסקה עולה בדרך כלל סנטים בודדים.</p>
          <div class="row"><a class="btn" href="#/settings">הגדרת מפתח</a></div>
        </div>`);
      return;
    }
    const tabs = `<div class="tabs"><a href="#/ai" class="${tab === 'check' ? 'on' : ''}">בדיקת כתיבה</a><a href="#/ai/chat" class="${tab === 'chat' ? 'on' : ''}">שאלות ושיחה</a></div>`;
    if (tab === 'check') {
      render(`<a class="crumb" href="#/tools">→ כלים</a><h1>המורה</h1>${tabs}
        <p class="lead">כתבי כמה משפטים ביידיש, בכתיב שנוח לך. התיקון יראה מה שונה מהתקן ולמה.</p>
        <textarea class="big" id="txt" lang="yi" dir="rtl" placeholder="שרײַב דאָ..." style="margin-top:12px"></textarea>
        <div class="keys">${KEYS.map((k) => `<button type="button" data-ch="${k}">${k}</button>`).join('')}</div>
        <div class="row"><button class="btn" id="go">בדיקה</button></div>
        <div id="out" style="margin-top:18px"></div>`);
      const txt = $app.querySelector('#txt');
      if (Y.ui.aiDraft) { txt.value = Y.ui.aiDraft; Y.ui.aiDraft = ''; }
      $app.querySelectorAll('.keys button').forEach((b) => b.addEventListener('click', () => {
        const s = txt.selectionStart; const e = txt.selectionEnd;
        txt.value = txt.value.slice(0, s) + b.dataset.ch + txt.value.slice(e);
        txt.focus(); txt.setSelectionRange(s + b.dataset.ch.length, s + b.dataset.ch.length);
      }));
      const go = $app.querySelector('#go');
      go.addEventListener('click', async () => {
        const text = txt.value.trim();
        const out = $app.querySelector('#out');
        if (!text) { txt.focus(); return; }
        go.disabled = true;
        out.innerHTML = '<p><span class="spin"></span> בודקת...</p>';
        try {
          const r = await Y.ai.check(text);
          out.innerHTML = Y.disp(`
            <div class="card stack">
              <div><small>הנוסח התקני</small><div class="corrected">${esc(r.corrected)}</div></div>
              ${r.praise ? `<p>${esc(r.praise)}</p>` : ''}
            </div>
            ${r.errors.length ? `<h3>${r.errors.length} הערות</h3>` + r.errors.map((e) => {
              const tp = TOPIC[e.topic] || TOPIC.other;
              return `<div class="err"><div class="pair"><s>${esc(e.orig || '')}</s> ← <b>${esc(e.fix || '')}</b></div>
                <div>${esc(e.explain || '')}</div>
                <small>${tp[0]}${tp[1] ? ` · <a href="#/unit/${tp[1]}">ליחידה</a>` : ''}</small></div>`;
            }).join('') : '<p>אין מה לתקן. הטקסט תקני.</p>'}`);
        } catch (e) {
          out.innerHTML = `<p class="alert">${esc(e.message)}</p>`;
        }
        go.disabled = false;
      });
      return;
    }
    const draw = (pending) => {
      render(`<h1>המורה</h1>${tabs}
        <div class="chat" id="chat">
          ${chatHistory.length ? '' : '<p class="lead">שאלי כל דבר: "מה המין של וואָלקן?", "מתי כותבים ־ען?", "איך אומרים בתקן לנסוע באוטובוס?". אפשר גם לכתוב ביידיש ולנהל שיחה.</p>'}
          ${chatHistory.map((m) => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}">${esc(m.content)}</div>`).join('')}
          ${pending ? '<div class="msg ai" id="pend"><span class="spin"></span></div>' : ''}
        </div>
        <form class="chat-form" id="cf">
          <textarea id="ci" rows="1" placeholder="השאלה שלך..." ${pending ? 'disabled' : ''}></textarea>
          <button class="btn" ${pending ? 'disabled' : ''}>שליחה</button>
        </form>
        ${chatHistory.length ? '<p><a href="#" id="clr">שיחה חדשה</a></p>' : ''}`);
      window.scrollTo(0, document.body.scrollHeight);
      const form = $app.querySelector('#cf');
      const ci = $app.querySelector('#ci');
      if (!pending) ci.focus();
      const send = async () => {
        const q = ci.value.trim();
        if (!q) return;
        chatHistory.push({ role: 'user', content: q });
        draw(true);
        try {
          const full = await Y.ai.chat(chatHistory, (t) => {
            const p = document.getElementById('pend');
            if (p) p.textContent = Y.disp(t);
          });
          chatHistory.push({ role: 'assistant', content: full });
          if (location.hash === '#/ai/chat') draw(false);
        } catch (e) {
          chatHistory.pop();
          if (location.hash !== '#/ai/chat') return;
          draw(false);
          $app.querySelector('#ci').value = q;
          $app.querySelector('#chat').insertAdjacentHTML('beforeend', `<p class="alert">${esc(e.message)}</p>`);
        }
      };
      form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
      ci.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      const clr = $app.querySelector('#clr');
      if (clr) clr.addEventListener('click', (e) => { e.preventDefault(); chatHistory = []; draw(false); });
    };
    draw(false);
  }

  /* ---------- reference ---------- */

  const REF = `## התווית המיודעת
|! | זכר | נקבה | סתמי | רבים |
| נאָמינאַטיוו | {דער} | {די} | {דאָס} | {די} |
| אַקוזאַטיוו | {דעם} | {די} | {דאָס} | {די} |
| דאַטיוו | {דעם} | {דער} | {דעם} | {די} |

## תואר אחרי תווית מיודעת
|! | זכר | נקבה | סתמי | רבים |
| נאָמינאַטיוו | {דער גוטער} | {די גוטע} | {דאָס גוטע} | {די גוטע} |
| אַקוזאַטיוו | {דעם גוטן} | {די גוטע} | {דאָס גוטע} | {די גוטע} |
| דאַטיוו | {דעם גוטן} | {דער גוטער} | {דעם גוטן} | {די גוטע} |

## תואר אחרי אַ, קיין, מײַן
|! | זכר | נקבה | סתמי |
| נאָמינאַטיוו | {אַ גוטער} | {אַ גוטע} | {אַ גוט} |
| אַקוזאַטיוו | {אַ גוטן} | {אַ גוטע} | {אַ גוט} |
| דאַטיוו | {אַ גוטן} | {אַ גוטער} | {אַ גוטן} |

הסיומת {־ן}: אחרי {נ} ← {־עם} ({שיינעם}); אחרי {מ} או תנועה מוטעמת ← {־ען} ({וואַרעמען, בלויען}); {נײַ ← נײַעם}.

## כינויי הגוף
|! נאָמינאַטיוו | אַקוזאַטיוו | דאַטיוו | שייכות |
| {איך} | {מיך} | {מיר} | {מײַן} |
| {דו} | {דיך} | {דיר} | {דײַן} |
| {ער} | {אים} | {אים} | {זײַן} |
| {זי} | {זי} | {איר} | {איר} |
| {עס} | {עס} | {אים} | {זײַן} |
| {מיר} | {אונדז} | {אונדז} | {אונדזער} |
| {איר} | {אײַך} | {אײַך} | {אײַער} |
| {זיי} | {זיי} | {זיי} | {זייער} |

## מילת יחס + דעם
| {אינעם} | {אויפֿן} | {מיטן} | {פֿונעם} |
| {צום} | {בײַם} | {פֿאַרן} | {נאָכן} |
| {אונטערן} | {איבערן} | {הינטערן} | {דורכן} |

## פועלי העזר
|! | {זײַן} | {האָבן} | עתיד | תנאי | הרגל |
| {איך} | {בין} | {האָב} | {וועל} | {וואָלט} | {פֿלעג} |
| {דו} | {ביסט} | {האָסט} | {וועסט} | {וואָלטסט} | {פֿלעגסט} |
| {ער} | {איז} | {האָט} | {וועט} | {וואָלט} | {פֿלעגט} |
| {מיר} | {זײַנען} | {האָבן} | {וועלן} | {וואָלטן} | {פֿלעגן} |
| {איר} | {זײַט} | {האָט} | {וועט} | {וואָלט} | {פֿלעגט} |
| {זיי} | {זײַנען} | {האָבן} | {וועלן} | {וואָלטן} | {פֿלעגן} |

עתיד והרגל + שם הפועל; תנאי + בינוני.

## פעלים שנוטים בעבר עם זײַן
{גיין, קומען, פֿאָרן, לויפֿן, פֿליִען, שפּרינגען, שווימען, פֿאַלן, זײַן, בלײַבן, שטיין, זיצן, ליגן, שלאָפֿן, ווערן, וואַקסן, שטאַרבן, געשען, געפֿעלן}, וכל פועל שבנוי מהם עם קידומת.

## האל"ף־בי"ת של ייִוואָ
| {אַ} a | {אָ} o | {א} שותקת | {ב} b | {בֿ} v |
| {ו} u | {וּ} u ליד וו | {וו} v | {וי} oy | {זש} zh |
| {י} i, y | {יִ} i נפרד | {יי} ey | {ײַ} ay | {טש} tsh |
| {כּ} k | {כ ך} kh | {פּ} p | {פֿ ף} f | {ע} e |
| {שׂ} s | {תּ} t | {ת} s | {ח} kh | {ש} sh |`;

  function viewRef() {
    render(`<a class="crumb" href="#/tools">→ כלים</a><h1>טבלאות</h1><p class="lead">כל הטבלאות במקום אחד, לעיון מהיר בזמן כתיבה.</p><div class="lesson">${Y.fmt(REF)}</div>`);
  }

  /* ---------- settings ---------- */

  function viewSettings(msg) {
    const st = S.settings();
    render(`<h1>הגדרות</h1>
      ${msg ? `<p class="note tip">${esc(msg)}</p>` : ''}
      <h3>תרגול</h3>
      <div class="card">
        <label class="row" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="strict" ${st.strict ? 'checked' : ''} style="margin-top:7px;width:18px;height:18px">
        <span><b>כתיב מדויק בכל תרגילי ההקלדה</b><br><small>כשהאפשרות כבויה, תשובה נכונה בלי הסימנים (אַ, אָ, פּ, פֿ) נחשבת נכונה עם הערה. בתרגילי הכתיב הסימנים נדרשים תמיד.</small></span></label>
      </div>

      <h3>המורה (Claude)</h3>
      <div class="card stack">
        <p style="margin:0"><small>אופציונלי. יוצרים מפתח ב-<a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> (נדרש חשבון עם אמצעי תשלום). המפתח נשמר רק בדפדפן הזה ונשלח רק ל-Anthropic. אל תזיני מפתח במחשב ציבורי.</small></p>
        <label class="field"><span>מפתח API</span><input id="key" type="password" dir="ltr" autocomplete="off" placeholder="sk-ant-..." value="${esc(st.apiKey)}"></label>
        <label class="field"><span>מודל</span><select id="model">${Y.ai.MODELS.map(([id, name]) => `<option value="${id}" ${st.model === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
        <div class="row"><button class="btn small" id="savekey">שמירה</button>${st.apiKey ? '<button class="btn ghost small" id="delkey">מחיקת המפתח</button>' : ''}</div>
      </div>

      <h3>ההתקדמות שלי</h3>
      <div class="card stack">
        <p style="margin:0"><small>ההתקדמות נשמרת בדפדפן של המכשיר הזה. כדי להעביר אותה למכשיר אחר או לגבות אותה, ייצאי קובץ וייבאי אותו שם.</small></p>
        <div class="row">
          <button class="btn ghost small" id="exp">ייצוא לקובץ</button>
          <label class="btn ghost small" style="cursor:pointer">ייבוא מקובץ<input type="file" id="imp" accept="application/json,.json" hidden></label>
          <button class="btn ghost small" id="reset">איפוס ההתקדמות</button>
        </div>
      </div>`);
    $app.querySelector('#strict').addEventListener('change', (e) => S.setSetting('strict', e.target.checked));
    $app.querySelector('#savekey').addEventListener('click', () => {
      S.setSetting('apiKey', $app.querySelector('#key').value.trim());
      S.setSetting('model', $app.querySelector('#model').value);
      viewSettings('נשמר.');
    });
    const dk = $app.querySelector('#delkey');
    if (dk) dk.addEventListener('click', () => { S.setSetting('apiKey', ''); viewSettings('המפתח נמחק מהדפדפן.'); });
    $app.querySelector('#exp').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([S.exportData()], { type: 'application/json' }));
      a.download = 'yiddish-progress.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $app.querySelector('#imp').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { S.importData(await f.text()); viewSettings('ההתקדמות יובאה.'); }
      catch (err) { viewSettings('הקובץ לא תקין, שום דבר לא השתנה.'); }
    });
    $app.querySelector('#reset').addEventListener('click', () => {
      if (confirm('למחוק את כל ההתקדמות, המילים שהוספת והטעויות השמורות? אי אפשר לבטל.')) { S.reset(); viewSettings('ההתקדמות אופסה.'); }
    });
  }

  /* ================= router ================= */

  Y.ui = { render, runSession, KEYS, aiDraft: '', cleanup: null };

  function route() {
    enterHandler = null;
    if (Y.ui.cleanup) { Y.ui.cleanup(); Y.ui.cleanup = null; }
    const parts = (location.hash || '#/home').replace(/^#\//, '').split('/');
    const [a, b, c] = parts;
    document.querySelectorAll('#nav a').forEach((n) => {
      const on = n.dataset.r === a || (n.dataset.r === 'learn' && (a === 'unit' || a === 'diag')) ||
        (n.dataset.r === 'practice' && ['drill', 'daily', 'mistakes', 'blitz'].includes(a)) ||
        (n.dataset.r === 'tools' && ['check', 'dict', 'lab', 'ai', 'ref'].includes(a)) ||
        (n.dataset.r === 'words' && ['deck', 'mywords'].includes(a));
      n.classList.toggle('on', on);
      if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
    });
    if (a === 'learn') return viewLearn();
    if (a === 'unit') return c === 'go' ? viewUnitGo(b) : viewUnit(b);
    if (a === 'practice') return viewPractice();
    if (a === 'drill') return viewDrill(b);
    if (a === 'daily') return runSession(dailyItems(), { back: '#/home', again: '#/daily' });
    if (a === 'mistakes') return runSession(S.state.mistakes.slice(0, 15).map((m) => Object.assign({}, m)), { back: '#/practice', again: '#/mistakes' });
    if (a === 'diag') return viewDiag();
    if (a === 'words') return viewWords();
    if (a === 'deck') return c === 'go' ? viewDeckGo(b) : viewDeck(b);
    if (a === 'mywords') return runSession(Y.shuffle(S.state.mywords).slice(0, 12).map((w) => G.myword(w)), { back: '#/words', again: '#/mywords' });
    if (a === 'ai') return viewAi(b === 'chat' ? 'chat' : 'check');
    if (a === 'ref') return viewRef();
    if (a === 'tools') return Y.views.tools();
    if (a === 'check') return Y.views.check();
    if (a === 'dict') return Y.views.dict();
    if (a === 'lab') return Y.views.lab(b);
    if (a === 'blitz') return Y.views.blitz();
    if (a === 'settings') return viewSettings();
    return viewHome();
  }

  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
