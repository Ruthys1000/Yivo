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
    const info = S.masteryInfo(id);
    return `<span class="badge ${cls}" title="ימי תרגול טובים: ${info.days} מתוך 3">${pct(m)}%${info.stale ? ' ↻' : ''}</span>`;
  };

  /* Which unit a free-standing drill counts towards. */
  const SPELL_UNIT = { n: 'a1', pf: 'a2', vv: 'a2', ay: 'a3', yi: 'a3', h: 'a4', dbl: 'a4', ie: 'a4', ig: 'a4', likh: 'a4', pre: 'a4', en: 'a4', sep: 'a5', heb: 'a6' };
  const DRILLS = [
    { id: 'gender', title: '{דער, די, דאָס}', sub: 'המין של כל שם עצם, בחזרה מרווחת', spec: ['gender'], unit: 'b1', n: 15 },
    { id: 'art', title: 'התווית הנכונה', sub: '{דער, דעם, די, דאָס} לפי התפקיד במשפט', spec: ['art:nom,acc,dat'], unit: 'c2', n: 12 },
    { id: 'adj', title: 'תווית + תואר', sub: '{דער גוטער, דעם גוטן, די גוטע}', spec: ['case:def'], unit: 'c3', n: 12 },
    { id: 'ctype', title: 'צירוף בהקלדה', sub: 'מקבלים {דער טיש + גוט} וכותבים את הצירוף הנכון', spec: ['ctype'], unit: 'c3', n: 10 },
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

  /* The closing screen of a round: score, what to do next, and the missed items. */
  function showResult(log, o) {
    const right = log.filter((l) => l.ok).length;
    const wrong = log.filter((l) => !l.ok);
    if (o.onDone) o.onDone(log);
    const showAns = (it) => (it.t === 'h' ? it.fix : it.t === 'o' ? (it.lead ? it.lead + ' ' : '') + it.a[0] : it.t === 't' ? it.a[0] : (it.q && it.q !== '___' && !it.plainQ ? it.q.replace('___', it.a) : it.a));
    render(`
      <div class="card stack">
        ${o.daily ? `<div><h2>סיימת את הסשן של היום</h2><small>${S.streak()} ימים ברצף · ${S.todayCount()} תשובות היום${o.wrote ? ' · כתבת ' + o.wrote + ' מילים משלך' : ''}</small></div>` : ''}
        <div><div class="result-num">${right}/${log.length}</div>
        <p class="lead">${right === log.length ? 'הכול נכון. יישר כּוח!' : right / log.length >= 0.7 ? 'יפה. הטעויות נשמרו לחזרה.' : 'זה בדיוק החומר שכדאי לחזור עליו. הטעויות נשמרו.'}</p></div>
        ${o.summary ? o.summary(log) : ''}
        <div class="row">
          ${o.daily ? `<a class="btn" href="${o.back}">סיימתי להיום</a>` : ''}
          ${o.again ? `<a class="btn${o.daily ? ' ghost' : ''}" href="${o.again}" id="again">${o.daily ? 'עוד סשן' : 'סבב נוסף'}</a>` : ''}
          ${o.daily ? '' : `<a class="btn ghost" href="${o.back}">חזרה</a>`}
        </div>
      </div>
      ${wrong.length ? `<h3>לחזרה</h3><ul class="miss">${wrong.map((l) => `<li><span class="yi">${esc(showAns(l.it))}</span>${l.it.ex ? `<br><small>${Y.inline(l.it.ex)}</small>` : ''}</li>`).join('')}</ul>` : ''}`);
    const again = $app.querySelector('#again');
    if (again) again.addEventListener('click', (e) => { e.preventDefault(); route(true); });
  }

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
      </div>${o.note ? `<div class="run-note">${o.note}</div>` : ''}${items[i] && items[i].retry ? '<div class="again-tag">שוב · טעית בה קודם, עכשיו מהזיכרון</div>' : ''}`;

    /* "Show the rule": the unit's explanation, available while answering. */
    let ruleOpen = false;
    const attachRule = (it) => {
      const u = it.unit && !o.noRule ? unitById(it.unit) : null;
      if (!u) return;
      const d = document.createElement('details');
      d.className = 'rule';
      d.open = ruleOpen;
      d.innerHTML = Y.disp(`<summary>הצג את הכלל · ${Y.inline(u.title)}</summary><div class="lesson">${Y.fmt(o.ruleText || u.text)}</div>`);
      d.addEventListener('toggle', () => { ruleOpen = d.open; });
      $app.appendChild(d);
    };

    const qHtml = (it, filled, ok) => {
      if (it.q === '___' || !it.q) return '';
      const inner = filled ? `<span class="blank${ok ? ' ok' : ''}">${esc(filled)}</span>` : '<span class="blank">&nbsp;</span>';
      return `<div class="q-text">${esc(it.q).replace('___', inner)}</div>`;
    };

    const describe = (it) => (it.t === 'h' ? 'מצאי את הטעות: ' + it.tokens.join(' ')
      : it.t === 'o' ? 'בניית משפט: ' + it.he
      : (it.he ? it.he + ' · ' : '') + (it.q || ''));

    const feedback = (it, ok, shown, extra, given) => {
      // a repeated question is practice only: progress and the score keep the first attempt
      if (!it.retry && !o.noRecord) {
        S.answer(it, ok);
        log.push({ it, ok });
        // a missed question comes back once, a few questions later, to be answered from memory
        if (!ok && !o.noRetry) items.splice(Math.min(i + 4, items.length), 0, Object.assign({}, it, { retry: true }));
      }
      // after a typed mistake the standard form is typed out before moving on
      const retype = !ok && it.t === 't' && !o.noRetry;
      const u = it.unit && !o.unitId ? unitById(it.unit) : null;
      const ctx = { q: describe(it), given: given || '', correct: shown, ex: (it.ex || '').replace(/[{}]/g, ''), unit: u ? u.title.replace(/[{}]/g, '') : '' };
      const box = document.createElement('div');
      box.className = 'fb ' + (ok ? 'ok' : 'no');
      // before the explanation: no verdict and no reasons yet, only what the standard has
      if (o.pre) {
        log.push({ it, ok });
        box.className = 'fb pre';
        box.innerHTML = Y.disp(`<h4>${ok ? 'כך גם בתקן' : 'בתקן'}</h4><p class="ans">${esc(shown)}</p>
          <p><small>${ok ? 'מייד נראה למה.' : 'זו לא טעות שלך: כך מדברים בבית. מייד נראה מה הכלל בתקן.'}</small></p>
          <div class="row"><button class="btn" id="next">${i + 1 >= items.length ? 'להסבר' : 'הבא'}</button></div>`);
        $app.appendChild(box);
        const goPre = () => { enterHandler = null; i++; step(); };
        box.querySelector('#next').addEventListener('click', goPre);
        setTimeout(() => { enterHandler = goPre; }, 150);
        box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      box.innerHTML = Y.disp(`
        <h4>${ok ? 'נכון' : 'התשובה לפי התקן'}</h4>
        ${extra ? `<p>${extra}</p>` : ''}
        ${ok && !extra ? '' : `<p class="ans">${esc(shown)}</p>`}
        ${it.ex ? `<p>${Y.inline(it.ex)}</p>` : ''}
        ${retype ? `<label class="field retype"><span>הקלידי את הצורה התקנית כדי להמשיך</span>
          <input class="type-in" id="re" type="text" lang="yi" dir="rtl" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></label>${keysHtml()}` : ''}
        <div class="row">
          <button class="btn" id="next"${retype ? ' disabled' : ''}>${i + 1 >= items.length ? (o.then ? 'הלאה' : 'סיום') : 'הבא'}</button>
          ${retype ? '<button class="linkbtn" id="skipre">להמשיך בלי להקליד</button>' : ''}
          ${!ok && u ? `<a class="btn ghost small" href="#/unit/${u.id}">ליחידה: ${Y.inline(u.title)}</a>` : ''}
        </div>
        <div class="row helprow">
          <button class="linkbtn" id="why">לא הבנתי, הסבר נוסף</button>
          <button class="linkbtn" id="flag">לשאול את המורה</button>
        </div>
        <div id="whybox"></div>`);
      $app.appendChild(box);
      const go = () => { enterHandler = null; i++; step(); };
      const nextBtn = box.querySelector('#next');
      nextBtn.addEventListener('click', go);
      if (retype) {
        const re = box.querySelector('#re');
        const skip = box.querySelector('#skipre');
        // where the marks are the point (spelling items, or the exact-spelling setting), they are required here too
        const exactRe = it.strict || S.settings().strict;
        const match = () => [shown].concat(Array.isArray(it.a) ? it.a : []).some((a) => (exactRe ? Y.canon(a) === Y.canon(re.value.trim()) : Y.bare(a) === Y.bare(re.value.trim())));
        bindKeys(box.querySelector('.keys'), re);
        re.addEventListener('input', () => {
          const m = match();
          nextBtn.disabled = !m;
          re.style.borderColor = m ? 'var(--ok)' : '';
          if (m) { skip.hidden = true; box.querySelector('.keys').hidden = true; }
        });
        skip.addEventListener('click', () => { nextBtn.disabled = false; skip.hidden = true; nextBtn.focus(); });
        setTimeout(() => { enterHandler = () => { if (!nextBtn.disabled) go(); }; re.focus({ preventScroll: true }); }, 150);
      } else setTimeout(() => { enterHandler = go; }, 150);
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      box.querySelector('#flag').addEventListener('click', (e) => {
        S.addFlag({ q: ctx.q, given: ctx.given, correct: ctx.correct, ex: ctx.ex, unit: ctx.unit, day: S.today() });
        e.target.textContent = 'נשמר ב"שאלות למורה" (בכלים)';
        e.target.disabled = true;
      });

      const whybox = box.querySelector('#whybox');
      box.querySelector('#why').addEventListener('click', (e) => {
        e.target.remove();
        enterHandler = null;
        if (!Y.ai.enabled()) {
          whybox.innerHTML = `<div class="whycard"><p>אפשר לשאול כל צ'אט AI (למשל claude.ai) בלי להגדיר כלום: הכפתור מעתיק שאלה מוכנה עם התרגיל, התשובה שלך והתשובה התקנית.</p>
            <label class="field"><span>מה לא ברור לך? (לא חובה)</span><textarea id="ask" rows="2" placeholder="למשל: חשבתי שלפני מילה מלשון־קודש בא דאָס"></textarea></label>
            <div class="row"><button class="btn small" id="cp">העתקת השאלה</button><a class="btn ghost small" href="https://claude.ai/new" target="_blank" rel="noopener">לפתוח את claude.ai</a></div>
            <p><small>כדי לקבל את ההסבר כאן, בתוך הכלי, מגדירים מפתח ב<a href="#/settings">הגדרות</a>.</small></p></div>`;
          whybox.querySelector('#cp').addEventListener('click', async (ev) => {
            const text = Y.ai.explainPrompt(Object.assign({}, ctx, { ask: whybox.querySelector('#ask').value.trim() }));
            try { await navigator.clipboard.writeText(text); ev.target.textContent = 'הועתק. הדביקי בצ\'אט'; }
            catch (err) { ev.target.textContent = 'ההעתקה נחסמה בדפדפן הזה'; }
          });
          return;
        }
        const hist = [];
        whybox.innerHTML = `<div class="whycard"><div id="thread"></div>
          <label class="field"><span id="asklbl">מה לא ברור לך? (לא חובה)</span><textarea id="ask" rows="2" placeholder="למשל: חשבתי שלפני מילה מלשון־קודש בא דאָס"></textarea></label>
          <div class="row"><button class="btn small" id="send">להסביר לי</button></div></div>`;
        const thread = whybox.querySelector('#thread');
        const askEl = whybox.querySelector('#ask');
        const send = whybox.querySelector('#send');
        let first = true;
        send.addEventListener('click', async () => {
          const ask = askEl.value.trim();
          if (!first && !ask) { askEl.focus(); return; }
          send.disabled = true;
          if (!first) { hist.push({ role: 'user', content: ask }); thread.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(ask)}</div>`); }
          const out = document.createElement('div');
          out.className = 'msg ai';
          out.innerHTML = '<span class="spin"></span>';
          thread.appendChild(out);
          try {
            const c2 = first ? Object.assign({}, ctx, { ask }) : (ctx.asked || ctx);
            if (first) ctx.asked = c2;
            const full = await Y.ai.explain(c2, hist, (t) => { out.textContent = Y.disp(t); });
            out.textContent = Y.disp(full);
            hist.push({ role: 'assistant', content: full });
            first = false;
            askEl.value = '';
            whybox.querySelector('#asklbl').textContent = 'שאלת המשך';
            send.textContent = 'לשאול';
          } catch (err) {
            out.className = 'alert';
            out.textContent = err.message;
            if (!first) hist.pop();
          }
          send.disabled = false;
        });
      });
    };

    /* the three articles always carry the same colour, so each word gets tied to one */
    const gcls = (x) => { const k = ARTS.findIndex((a) => Y.canon(a) === Y.canon(x)); return k < 0 ? '' : ' g-' + 'mfn'[k]; };
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
          ${opts.map((x, k) => `<button class="opt${it.heOpts ? ' he' : ''}${gcls(x)}" data-k="${k}">${esc(x)}</button>`).join('')}
        </div>`);
      attachRule(it);
      const btns = [...$app.querySelectorAll('.opt')];
      btns.forEach((b, k) => b.addEventListener('click', () => {
        const chosen = opts[k];
        const right = (x) => Y.canon(x) === Y.canon(it.a) || (it.also || []).some((a) => Y.canon(a) === Y.canon(x));
        const ok = right(chosen);
        btns.forEach((x, j) => {
          x.disabled = true;
          if (right(opts[j])) x.classList.add('right');
          else if (j === k) x.classList.add(o.pre ? 'dim' : 'wrong');
          else x.classList.add('dim');
        });
        const qt = $app.querySelector('.q-text');
        const shown = ok ? chosen : it.a;
        if (qt && !it.plainQ) qt.outerHTML = Y.disp(qHtml(it, shown, true));
        feedback(it, ok, it.also ? [it.a].concat(it.also).join(' / ') : it.a, '', chosen);
      }));
    };

    /* The row of special letters; a diacritic key pressed right after its base letter replaces that letter. */
    const keysHtml = () => `<div class="keys" aria-label="אותיות מיוחדות">${KEYS.map((k) => `<button type="button" data-ch="${k}">${k}</button>`).join('')}</div>`;
    const bindKeys = (box, inp) => box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const ch = b.dataset.ch;
      const s = inp.selectionStart ?? inp.value.length;
      const e = inp.selectionEnd ?? inp.value.length;
      let before = inp.value.slice(0, s);
      const base = ch.normalize('NFD')[0];
      if (ch.length > 1 && before.endsWith(base) && Y.canon(ch) !== Y.canon('ײַ')) before = before.slice(0, -1);
      inp.value = before + ch + inp.value.slice(e);
      const pos = (before + ch).length;
      inp.focus();
      inp.setSelectionRange(pos, pos);
      inp.dispatchEvent(new Event('input'));
    }));

    const showType = (it) => {
      render(`${head()}
        <div class="q-hint">${esc(it.he || 'כתבי את התשובה')}</div>
        ${it.plainQ ? `<div class="q-text">${esc(it.q)}</div>` : qHtml(it)}
        <input class="type-in" id="ans" type="text" lang="yi" dir="rtl" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="התשובה שלך">
        <div class="sugg" id="sugg" aria-live="polite"></div>
        ${keysHtml()}
        <button class="btn" id="check">בדיקה</button>`);
      attachRule(it);
      const inp = $app.querySelector('#ans');
      inp.focus();
      // outside spelling tasks, offer the fully marked form of the word being typed
      const strictItem = it.strict || S.settings().strict;
      const sugg = $app.querySelector('#sugg');
      const suggest = () => {
        if (strictItem || !sugg) return;
        const m = inp.value.match(/(\S+)$/);
        const w = m ? m[1] : '';
        const set = w.length >= 2 ? Y.lex.bare.get(Y.bare(w)) : null;
        const cands = set ? [...set].filter((c) => c !== Y.canon(w)).slice(0, 3) : [];
        sugg.innerHTML = cands.map((c) => `<button type="button" class="chip yi">${esc(Y.disp(c))}</button>`).join('');
        sugg.querySelectorAll('.chip').forEach((b, k) => b.addEventListener('click', () => {
          inp.value = inp.value.slice(0, inp.value.length - w.length) + Y.disp(cands[k]);
          sugg.innerHTML = '';
          inp.focus();
        }));
      };
      inp.addEventListener('input', suggest);
      bindKeys($app.querySelector('.keys'), inp);
      const check = () => {
        const val = inp.value.trim();
        if (!val) { inp.focus(); return; }
        enterHandler = null;
        const exact = it.a.some((a) => Y.canon(a) === Y.canon(val));
        const loose = it.a.some((a) => Y.bare(a) === Y.bare(val));
        const strict = it.strict || S.settings().strict;
        const ok = exact || (loose && !strict);
        let extra = '';
        if (!exact && loose) {
          const target = it.a.find((a) => Y.bare(a) === Y.bare(val));
          const diff = Y.markDiff(val, target).map((m) => Y.inline(m)).join('<br>');
          extra = (ok ? 'נכון, עם הבדל בסימנים.' : 'האותיות נכונות, ההבדל הוא בסימנים.') + (diff ? '<br>' + diff : '');
        }
        inp.disabled = true;
        $app.querySelector('#check').remove();
        $app.querySelector('.keys').remove();
        if (sugg) sugg.remove();
        inp.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)';
        feedback(it, ok, it.a[0], extra, val);
      };
      $app.querySelector('#check').addEventListener('click', check);
      enterHandler = check;
    };

    const showOrder = (it) => {
      const target = it.a[0].split(' ');
      const bank = it.bank || [];
      const words = target.concat(bank);
      let pool = Y.shuffle(words.map((w, k) => ({ w, k })));
      if (pool.map((p) => p.w).join(' ') === words.join(' ') && pool.length > 1) pool.reverse();
      let line = [];
      const ready = () => (bank.length ? line.length > 0 : !pool.length);
      const full = (it.lead ? it.lead + ' ' : '') + it.a[0];
      const draw = () => {
        render(`${head()}
          <div class="q-hint">${bank.length ? 'בני את המשפט ביידיש. יש בבנק גם מילים מיותרות.' : 'סדרי את המילים למשפט:'}</div>
          <div class="q-he">${esc(it.he)}</div>
          <div class="order-line">${it.lead ? `<span class="lead-w">${esc(it.lead)}</span>` : ''}
            ${line.map((p) => `<button class="tok" data-line="${p.k}">${esc(p.w)}</button>`).join('')}</div>
          <div class="pool">${pool.map((p) => `<button class="tok" data-pool="${p.k}">${esc(p.w)}</button>`).join('')}</div>
          <button class="btn" id="check" ${ready() ? '' : 'disabled'}>בדיקה</button>`);
        attachRule(it);
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
          if (!ready()) return;
          enterHandler = null;
          const got = line.map((p) => p.w).join(' ');
          const ok = it.a.some((a) => Y.canon(a) === Y.canon(got));
          $app.querySelectorAll('.tok').forEach((t) => { t.disabled = true; });
          chk.remove();
          feedback(it, ok, full, '', got);
        };
        chk.addEventListener('click', check);
        enterHandler = ready() ? check : null;
      };
      draw();
    };

    const showHunt = (it) => {
      render(`${head()}
        <div class="q-hint">${esc(it.he)}</div>
        <div class="hunt">${it.tokens.map((w, k) => `<button class="tok" data-k="${k}">${esc(w)}</button>`).join(' ')}</div>`);
      attachRule(it);
      const btns = [...$app.querySelectorAll('.hunt .tok')];
      btns.forEach((b, k) => b.addEventListener('click', () => {
        const ok = it.bad.includes(k);
        btns.forEach((x, j) => {
          x.disabled = true;
          if (it.bad.includes(j)) x.classList.add('target');
          else if (j === k) x.classList.add('miss');
        });
        feedback(it, ok, it.fix, ok ? 'מצאת. הנוסח התקני:' : 'המקום הבעייתי מסומן. הנוסח התקני:', 'הקשתי על: ' + it.tokens[k]);
      }));
    };

    const finish = () => {
      enterHandler = null;
      if (o.then) return o.then(log);
      showResult(log, o);
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
    const hasProgress = Object.keys(S.state.units).length > 0;
    const pv = D.proverbs[S.today() % D.proverbs.length];
    const done = S.todayCount() >= S.GOAL;
    const due = dueTotal();
    const mist = S.state.mistakes.length;
    const fresh = !S.state.diag && !hasProgress;
    const backupOld = hasProgress && S.today() - (S.state.lastExport || 0) > 30 && Object.keys(S.state.srs).length > 60;
    const lv = S.standing();
    const was = S.snapBefore(7);
    const dp = was ? lv.pts - was.pts : 0;
    const trend = !was ? 'ההשוואה לעבר תופיע אחרי כמה ימי תרגול'
      : Math.abs(dp) < 0.05 ? `בלי שינוי מאז לפני ${was.ago} ימים`
      : `${dp > 0 ? 'עלייה' : 'ירידה'} של ${Math.abs(dp).toFixed(1)} נק׳ מאז לפני ${was.ago} ימים`;

    render(`<div class="stack">
      <div>
        <h1><span class="yi">שלום־עליכם!</span></h1>
        <p class="lead">${fresh ? 'את כבר מדברת יידיש. כאן לומדים את הכללים שמאחוריה, לפי התקן של ייִוואָ.' : done ? 'סיימת את היעד של היום.' : 'מה עושים היום?'}</p>
      </div>

      ${fresh ? `
      <div class="card hero stack">
        <div><h2>נתחיל באבחון קצר</h2>
        <p class="lead">שתי שאלות לכל נושא, אחת מהן בהקלדה. אפשר לעשות פרק אחד בכל פעם. בסוף תדעי אילו כללים כבר יושבים אצלך מהבית ואילו כדאי ללמוד קודם.</p></div>
        <div class="row"><a class="btn" href="#/diag">לאבחון</a><a class="btn ghost" href="#/unit/${nu.id}" style="background:transparent;color:inherit;border-color:currentColor">לדלג ולהתחיל ללמוד</a></div>
      </div>` : `
      <div class="card hero stack">
        <div><small>${done ? 'היעד היומי הושג' : 'כרבע שעה'}</small><h2>${done ? 'רוצה עוד סשן?' : 'הסשן של היום'}</h2>
        <p class="lead">${[due ? due + ' חזרות' : '', mist ? Math.min(mist, 3) + ' טעויות לתיקון' : '', 'תרגול של ' + nu.title.replace(/[{}]/g, ''), 'משפט משלך'].filter(Boolean).join(' · ')}</p></div>
        <div class="row"><a class="btn" href="#/daily">${done ? 'עוד סשן' : 'להתחיל'}</a></div>
      </div>

      <p class="alt-links">או ישר אל: <a href="#/unit/${nu.id}">הנושא הבא · ${Y.inline(nu.title)}</a><a href="#/gender">המין: <span class="yi">דער · די · דאָס</span></a><a href="#/practice">תרגול חופשי</a></p>`}

      <a class="card levelcard" href="#/progress">
        <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b>דרגה ${lv.level} <small>מתוך 10</small></b><small>${lv.level >= 10 ? 'הדרגה הגבוהה ביותר' : pct(lv.inLevel) + '% בדרך לדרגה ' + (lv.level + 1)}</small></div>
        <div class="bar" style="margin-top:8px"><i style="width:${pct(lv.inLevel)}%"></i></div>
        <small class="more">${trend} · ההתקדמות שלי ←</small>
      </a>

      <div class="card">
        <div class="stats">
          <div class="stat"><b>${S.streak()}</b><span>ימים ברצף</span></div>
          <div class="stat"><b>${S.todayCount()}<small style="font-size:.9rem;font-weight:600">/${S.GOAL}</small></b><span>היעד היומי</span></div>
          <div class="stat"><b>${D.units.filter((u) => (S.mastery(u.id) || 0) >= 0.85).length}/${D.units.length}</b><span>יחידות יושבות</span></div>
        </div>
        <div class="bar" style="margin-top:14px" title="היעד היומי"><i style="width:${Math.min(100, (S.todayCount() / S.GOAL) * 100)}%"></i></div>
      </div>

      <div class="card proverb">
        <small>פתגם היום</small>
        <div class="yi pv">${esc(pv.full)}</div>
        <div>${esc(pv.he)}</div>
        <small>${Y.inline(pv.note)}</small>
      </div>

      ${backupOld && !Y.sync.enabled() ? '<p class="note tip"><b>גיבוי</b>ההתקדמות נשמרת רק בדפדפן הזה. עבר יותר מחודש מאז הגיבוי האחרון. אפשר <a href="#/settings">להפעיל סנכרון או לייצא קובץ</a>.</p>' : ''}
    </div>`);
  }

  /* All spaced-repetition items that are due today. */
  function dueTotal() {
    const t = S.today();
    let n = 0;
    for (const k in S.state.srs) if (S.state.srs[k].d <= t) n++;
    return n;
  }

  function viewLearn() {
    render(`<h1>מסלול הלימוד</h1>
      <p class="lead">${D.units.length} יחידות. בכל אחת הסבר קצר, השוואה ליידיש מהבית, ותרגול. אפשר ללמוד לפי הסדר או לקפוץ לנושא שעלה בשיעור.</p>
      ${D.groups.map((g) => `
        <div class="group-head"><h2>${esc(g.title)}</h2><small>${esc(g.blurb)}</small></div>
        <ul class="units">${D.units.filter((u) => u.group === g.id).map((u) => `
          <li><a href="#/unit/${u.id}"><span class="t"><b>${Y.inline(u.title)}</b><small>${Y.inline(u.sub)}</small></span>${badge(u.id)}</a></li>`).join('')}
        </ul>`).join('')}
      <div class="group-head"><h2>קריאה</h2><small>טקסטים קצרים עם פירוש בהקשה על מילה, וניתוח דקדוקי של הצירופים.</small></div>
      <ul class="units">${D.texts.map((t) => `
        <li><a href="#/read/${t.id}"><span class="t"><b><span class="yi">${esc(t.title)}</span></b><small>${esc(t.he)} · ${esc(t.level)}</small></span>${S.state.read && S.state.read[t.id] ? '<span class="badge done">נקרא</span>' : '<span class="badge">חדש</span>'}</a></li>`).join('')}
      </ul>`);
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
      ${(() => { const mi = S.masteryInfo(u.id); return mi ? `<p><small>דיוק ${pct(mi.acc)}% · ימי תרגול טובים: ${mi.days} מתוך 3${mi.stale ? ' · לא תורגל זמן רב, כדאי לחזור' : ''}</small></p>` : ''; })()}
      ${(() => {
        const n = (D.steps[u.id] || []).length;
        const at = (S.state.units[u.id] || {}).step || 0;
        const started = !!S.masteryInfo(u.id);
        if (!n) return `<div class="row" style="margin:16px 0"><a class="btn" href="#/unit/${u.id}/go">תרגול</a></div><div class="lesson">${Y.fmt(u.text)}</div>`;
        return `<div class="card stack" style="margin:16px 0">
          <div><b>${at >= n ? 'עברת על כל הצעדים' : at ? `צעד ${at + 1} מתוך ${n}` : `${n} צעדים קצרים`}</b><br>
          <small>${at >= n ? 'עכשיו תרגול מעורב, עד שהיחידה יושבת. אפשר גם לעבור שוב על הצעדים.' : 'קודם כמה שאלות בלי הסבר, ואז דבר אחד בכל פעם: כלל קצר ומייד תרגול שלו.'}</small></div>
          <div class="row">${at >= n
            ? `<a class="btn" href="#/unit/${u.id}/go">תרגול מעורב · 10 שאלות</a><a class="btn ghost" href="#/unit/${u.id}/steps">שוב בצעדים</a>`
            : `<a class="btn" href="#/unit/${u.id}/steps">${at ? 'להמשיך בצעדים' : 'ללמוד בצעדים'}</a><a class="btn ghost" href="#/unit/${u.id}/go">ישר לתרגול</a>`}</div>
        </div>
        <details class="fold"${at >= n || started ? ' open' : ''}><summary>כל ההסבר בדף אחד</summary><div class="lesson">${Y.fmt(u.text)}</div></details>`;
      })()}
      <div class="row" style="margin-top:24px">
        ${D.steps[u.id] ? '' : `<a class="btn" href="#/unit/${u.id}/go">תרגול · 10 שאלות</a>`}
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

  /* A unit in small steps: a few questions before any explanation, then one piece of the rule at a time, each followed by its own practice. */
  function viewUnitSteps(id) {
    const u = unitById(id);
    const steps = u && D.steps[id];
    if (!steps) return viewUnit(id);
    const blocks = u.text.split(/\n\s*\n/);
    const back = '#/unit/' + id;
    const here = '#/unit/' + id + '/steps';
    const alive = () => location.hash === here;
    const n = steps.length;
    const textOf = (k) => steps[k][0].map((b) => blocks[b]).join('\n\n');
    const dots = (k) => `<div class="step-dots" aria-label="צעד ${k + 1} מתוך ${n}">${steps.map((_, j) => `<i class="${j < k ? 'done' : j === k ? 'on' : ''}"></i>`).join('')}</div>`;

    const done = () => {
      const next = D.units[D.units.indexOf(u) + 1];
      render(`<div class="card stack">
        <div><h2>עברת על כל הצעדים</h2><p class="lead">${Y.inline(u.title)}. עכשיו הכללים מעורבבים יחד: כך בודקים שהם יושבים, ולא רק שזכרת את ההסבר האחרון.</p></div>
        <div class="row"><a class="btn" href="${back}/go">תרגול מעורב · 10 שאלות</a><a class="btn ghost" href="#/home">סיימתי להיום</a></div>
        ${next ? `<p style="margin:0"><small>הנושא הבא: <a href="#/unit/${next.id}">${Y.inline(next.title)}</a></small></p>` : ''}
      </div>`);
    };

    const show = (k) => {
      if (!alive()) return;
      if (k >= n) return done();
      const items = G.stepItems(u, steps[k][1], 5);
      const advance = () => { S.unit(id).step = Math.max(S.unit(id).step || 0, k + 1); S.save(); show(k + 1); };
      render(`<a class="crumb" href="${back}">→ ${Y.inline(u.title)}</a>
        ${dots(k)}
        <div class="lesson step-text">${Y.fmt(textOf(k))}</div>
        <div class="row" style="margin-top:20px"><button class="btn" id="go">${items.length ? `לתרגל את זה · ${items.length === 1 ? 'שאלה אחת' : items.length + ' שאלות'}` : k + 1 >= n ? 'סיום' : 'הבנתי, הלאה'}</button></div>`);
      const go = () => {
        enterHandler = null;
        if (!items.length) return advance();
        runSession(items, { back, unitId: id, ruleText: textOf(k), note: `צעד ${k + 1} מתוך ${n}`, then: () => { if (alive()) advance(); } });
      };
      $app.querySelector('#go').addEventListener('click', go);
      enterHandler = go;
    };

    const at = S.unit(id).step || 0;
    if (at > 0 && at < n) return show(at);
    // from the start: ask first, explain afterwards
    const pre = steps.map((st) => st[1].map((i) => G.fromTuple(u.ex[i], id, i)).find((x) => x && x.t === 'm')).filter(Boolean).slice(0, 3);
    if (at >= n) { S.unit(id).step = 0; S.save(); }
    if (!pre.length) return show(0);
    render(`<a class="crumb" href="${back}">→ ${Y.inline(u.title)}</a>
      <div class="card stack">
        <div><h2>לפני ההסבר: איך היית אומרת?</h2>
        <p class="lead">${pre.length} שאלות קצרות. עני כמו שיוצא לך, בלי לחשוב על כללים. זה לא נספר בציון ולא נשמר כטעות; זה רק מראה איפה היידיש מהבית והתקן נפרדים.</p></div>
        <div class="row"><button class="btn" id="go">להתחיל</button><button class="btn ghost" id="skip">לדלג להסבר</button></div>
      </div>`);
    const start = () => {
      enterHandler = null;
      runSession(pre, { back, unitId: id, noRule: true, noRetry: true, noRecord: true, pre: true, note: 'לפני ההסבר', then: (log) => {
        if (!alive()) return;
        const same = log.filter((l) => l.ok).length;
        render(`<div class="card stack">
          <div><h2>${same === log.length ? 'בכולן ענית כמו בתקן' : same ? `ב־${same} מתוך ${log.length} ענית כמו בתקן` : 'כאן הבית והתקן נפרדים'}</h2>
          <p class="lead">${same === log.length ? 'האוזן שלך כבר שם. עכשיו נראה את הכלל שמאחורי זה, כדי שתוכלי לסמוך עליו גם במילים חדשות.' : 'עכשיו ההסבר, דבר אחד בכל פעם. השאלות האלה יחזרו מייד אחרי הכלל שלהן.'}</p></div>
          <div class="row"><button class="btn" id="go">להסבר</button></div></div>`);
        const g = () => { enterHandler = null; show(0); };
        $app.querySelector('#go').addEventListener('click', g);
        enterHandler = g;
      } });
    };
    $app.querySelector('#go').addEventListener('click', start);
    $app.querySelector('#skip').addEventListener('click', () => { enterHandler = null; show(0); });
    enterHandler = start;
  }

  function viewUnitGo(id) {
    const u = unitById(id);
    if (!u) return viewLearn();
    runSession(G.unitRound(u, 10), { back: '#/unit/' + id, again: '#/unit/' + id + '/go', unitId: id });
  }

  function viewPractice() {
    const mist = S.state.mistakes.length;
    const tile = (d) => `<a class="tile" href="#/drill/${d.id}"><b>${Y.inline(d.title)}</b><small>${Y.inline(d.sub)}</small></a>`;
    render(`<h1>תרגול</h1>
      <div class="card hero stack" style="margin-top:12px">
        <div><h2>הסשן של היום</h2><p class="lead">חזרות, טעויות והנושא הבא, בסדר שמתאים לך. אם לא בטוחה מה לתרגל, זה המקום.</p></div>
        <div class="row"><a class="btn" href="#/daily">להתחיל</a></div>
      </div>
      <div class="grid" style="margin-top:12px">
        <a class="tile" href="#/gender"><span class="num">${G.stubborn().length || ''}</span><b>המין: <span class="yi">דער · די · דאָס</span></b><small>חוקים, נטיות, ומילים בלי סימן שש בכל פעם. מיון לשלוש מגירות.</small></a>
        <a class="tile" href="#/track"><b>מהמין אל התואר והיחסות</b><small>מסלול בצעדים: תואר, <span class="yi">דעם</span>, מילות יחס</small></a>
        <a class="tile" href="#/mistakes"><span class="num">${mist || ''}</span><b>הטעויות שלי</b><small>חזרה על שאלות שטעית בהן</small></a>
        <a class="tile" href="#/personal"><span class="num">${(S.state.personal || []).length || ''}</span><b>התרגילים שלי</b><small>${(S.state.personal || []).length ? 'נבנו מתיקונים בטקסטים שכתבת' : 'ייבנו מתיקונים בבודק הכתיב ואצל המורה'}</small></a>
      </div>
      <details class="fold"><summary>משחקים <small>${GAMES.length + 1}</small></summary>
      <div class="grid">
        <a class="tile" href="#/blitz"><span class="num">${S.best('blitz') || ''}</span><b>בליץ <span class="yi">דער · די · דאָס</span></b><small>60 שניות, כמה שיותר מילים</small></a>
        ${GAMES.map(tile).join('')}
      </div></details>
      <details class="fold"><summary>תרגילי שינון לפי נושא <small>${DRILLS.length}</small></summary>
      <div class="grid">
        ${DRILLS.map(tile).join('')}
      </div></details>`);
  }

  function viewDrill(id) {
    const d = DRILLS.concat(GAMES).find((x) => x.id === id);
    if (!d) return viewPractice();
    runSession(genItems(d.spec, d.n, d.unit), { back: '#/practice', again: '#/drill/' + id });
  }

  /* Today's session, in a fixed order: warm up with reviews, one new thing with its short explanation,
     mixed practice ending on a proverb, and a sentence or two of her own writing. */
  const WRITE_PROMPTS = ['מה עשית היום?', 'מה את רואה עכשיו מהחלון או בחדר?', 'ספרי על מישהו מהמשפחה.', 'מה תעשי מחר?', 'מה אכלת היום, ואיפה?', 'ספרי על מקום שאת אוהבת.', 'מה קרה השבוע שכדאי לזכור?'];

  function viewDaily() {
    const here = '#/daily';
    const alive = () => location.hash === here;
    const t = S.today();
    const all = [];
    const dedupe = (items) => { const seen = new Set(); return items.filter((it) => { const k = it.key + '|' + (it.q || it.he); if (seen.has(k)) return false; seen.add(k); return true; }); };

    // 1. warm-up: what is due and what went wrong last time
    const warm = S.state.mistakes.slice(0, 3).map((m) => Object.assign({}, m));
    warm.push(...Y.shuffle((S.state.personal || []).filter((p) => { const st = S.srs(p.srs || p.key); return !st || st.d <= t; })).slice(0, 2).map((p) => Object.assign({}, p)));
    const due = [];
    for (const d of D.decks) for (const w of d.words) { const s = S.srs('v:' + w.y); if (s && s.d <= t) due.push([d.id, w]); }
    for (const [did, w] of Y.shuffle(due).slice(0, 3)) warm.push(G.vocab(did, w));
    if (!due.length) warm.push(G.vocab(Y.pick(D.decks).id));
    // gender: the words she keeps missing come first; otherwise one noun that is due
    const stub = Y.shuffle(G.stubborn()).slice(0, 2);
    if (stub.length) warm.push(...stub.map((n) => G.genderOf(n)));
    else warm.push(...genItems(['gender'], 1, 'b1'));

    // 2. the new thing: the next step of the next unit, if it still has steps to go
    const nu = nextUnit();
    const steps = D.steps[nu.id];
    const at = (S.state.units[nu.id] || {}).step || 0;
    const hasNew = !!steps && at < steps.length;

    // 3. mixed: units that faded or are still weak, a proofreading item, and a proverb to end on
    const weak = D.units.filter((u) => S.mastery(u.id) !== null && S.mastery(u.id) < 0.85 && !(hasNew && u.id === nu.id))
      .sort((a, b) => S.mastery(a.id) - S.mastery(b.id)).slice(0, 2);
    const mixed = [];
    for (const u of weak) mixed.push(...G.unitRound(u, 2));
    if (!hasNew) mixed.push(...G.unitRound(nu, 4));
    mixed.push(...genItems(['hunt'], 1));
    const last = genItems(['proverb'], 1);

    const parts = hasNew ? 3 : 2;
    const note = (k, name) => `חלק ${k} מתוך ${parts} · ${name}`;
    const opts = (extra) => Object.assign({ back: '#/home' }, extra);
    const keep = (next) => (log) => { all.push(...log); if (alive()) next(); };

    const result = (wrote) => showResult(all, { back: '#/home', again: here, daily: true, wrote });

    const write = () => {
      const topic = WRITE_PROMPTS[t % WRITE_PROMPTS.length];
      Y.views.check({
        head: `<div class="run-note">ולסיום · כתיבה משלך</div>
          <h2 style="margin-top:0">משפט או שניים ביידיש</h2>
          <p class="lead">${esc(topic)} ${hasNew || weak.length ? `אם מתאים, נסי לשלב את מה שתרגלת היום: ${Y.inline((hasNew ? nu : weak[0]).title)}.` : ''}</p>
          <p><small>כותבים כמו שיוצא. הכתיב נבדק תוך כדי, ומילה שתתקני תחזור כתרגיל אישי.</small></p>`,
        foot: '<div class="row" style="margin-top:20px"><button class="btn" id="wdone">סיימתי</button><button class="btn ghost" id="wskip">לדלג היום</button></div>',
      });
      const txt = $app.querySelector('#txt');
      $app.querySelector('#wdone').addEventListener('click', () => result((txt.value.trim().match(/\S+/g) || []).length));
      $app.querySelector('#wskip').addEventListener('click', () => result(0));
    };

    const runMixed = () => runSession(dedupe(Y.shuffle(mixed)).concat(last), opts({ note: note(parts, 'תרגול מעורב'), then: keep(write) }));

    const runNew = () => {
      const st = steps[at];
      const blocks = nu.text.split(/\n\s*\n/);
      const text = st[0].map((b) => blocks[b]).join('\n\n');
      const items = G.stepItems(nu, st[1], 4);
      const advance = () => { S.unit(nu.id).step = Math.max(S.unit(nu.id).step || 0, at + 1); S.save(); runMixed(); };
      const explain = () => {
        if (!alive()) return;
        render(`<div class="run-note">${note(2, 'הדבר החדש של היום')}</div>
          <h2 style="margin-top:0">${Y.inline(nu.title)}</h2>
          <p><small>צעד ${at + 1} מתוך ${steps.length} ביחידה</small></p>
          <div class="lesson step-text">${Y.fmt(text)}</div>
          <div class="row" style="margin-top:20px"><button class="btn" id="go">${items.length ? 'לתרגל את זה' : 'הבנתי, הלאה'}</button></div>`);
        const go = () => {
          enterHandler = null;
          if (!items.length) return advance();
          runSession(items, opts({ unitId: nu.id, ruleText: text, note: note(2, 'הדבר החדש של היום'), then: (log) => { all.push(...log); if (alive()) advance(); } }));
        };
        $app.querySelector('#go').addEventListener('click', go);
        enterHandler = go;
      };
      // ask first, explain afterwards
      const first = st[1].map((i) => G.fromTuple(nu.ex[i], nu.id, i)).find((x) => x && x.t === 'm');
      if (!first) return explain();
      runSession([first], opts({ unitId: nu.id, noRule: true, noRetry: true, noRecord: true, pre: true, note: note(2, 'לפני ההסבר: איך היית אומרת?'), then: explain }));
    };

    runSession(dedupe(Y.shuffle(warm)), opts({ note: note(1, 'חימום: חזרות'), then: keep(hasNew ? runNew : runMixed) }));
  }

  /* Placement: two questions per unit (one multiple choice, one typed); a unit passes only with both right. */
  function viewDiag(groupId) {
    if (!groupId) {
      const diag = S.state.diag || {};
      render(`<a class="crumb" href="#/home">→ בית</a>
        <h1>אבחון</h1>
        <p class="lead">שתי שאלות לכל נושא: אחת בבחירה ואחת בהקלדה, כדי שניחוש לא יספיק. נושא נחשב "יושב" רק אם שתיהן נכונות. אפשר לעשות פרק אחד בכל פעם.</p>
        <ul class="units" style="margin-top:16px">${D.groups.map((g) => {
          const us = D.units.filter((u) => u.group === g.id);
          const doneN = us.filter((u) => diag[u.id] !== undefined).length;
          const weak = us.filter((u) => diag[u.id] === 0).length;
          return `<li><a href="#/diag/${g.id}"><span class="t"><b>${esc(g.title)}</b><small>${us.length * 2} שאלות${doneN ? ` · נבדק: ${weak} מתוך ${us.length} לחיזוק` : ''}</small></span>${doneN ? '<span class="badge done">נבדק</span>' : '<span class="badge">חדש</span>'}</a></li>`;
        }).join('')}
          <li><a href="#/diag/all"><span class="t"><b>הכול ברצף</b><small>${D.units.length * 2} שאלות, כרבע שעה</small></span></a></li>
        </ul>`);
      return;
    }
    const units = groupId === 'all' ? D.units : D.units.filter((u) => u.group === groupId);
    if (!units.length) return viewDiag();
    const items = [];
    for (const u of units) {
      const hand = Y.shuffle(u.ex.map((t, i) => G.fromTuple(t, u.id, i)).filter((x) => x && x.t === 'm'));
      if (!hand.length) continue;
      items.push(hand[0]);
      const second = hand.find((h, k) => k > 0 && h.a.split(' ').length <= 2 && !ARTS.some((a) => Y.canon(a) === Y.canon(h.a))) || hand[1];
      if (second) {
        items.push(second.a.split(' ').length <= 2
          ? { t: 't', q: second.q, he: second.he || 'הקלידי את החסר', a: [second.a], ex: second.ex, unit: u.id, key: second.key, strict: u.group === 'A' }
          : second);
      }
    }
    runSession(items, {
      back: '#/diag',
      noRule: true,
      noRetry: true,
      unitId: 'diag',
      onDone(log) {
        const res = {};
        for (const l of log) res[l.it.unit] = (res[l.it.unit] === undefined ? 1 : res[l.it.unit]) && l.ok ? 1 : 0;
        S.setDiag(res);
      },
      summary(log) {
        const bad = new Set(log.filter((l) => !l.ok).map((l) => l.it.unit));
        const weak = units.filter((u) => bad.has(u.id));
        if (!weak.length) return '<p>כל הנושאים בפרק הזה יושבים אצלך היטב.</p>';
        return `<div><h3 style="margin-top:0">כדאי להתחיל כאן</h3><ul class="units">${weak.map((u) => `<li><a href="#/unit/${u.id}"><span class="t"><b>${Y.inline(u.title)}</b><small>${Y.inline(u.sub)}</small></span></a></li>`).join('')}</ul>
          <p><small>היחידות האלה מסומנות "לחזק" במסלול הלימוד ובמפה.</small></p></div>`;
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
            }).join('') : '<p>אין מה לתקן. הטקסט תקני.</p>'}
            ${r.errors.length ? '<div class="row" style="margin-top:14px"><button class="btn ghost" id="mk">להפוך את התיקונים לתרגילים שלי</button></div>' : ''}`);
          const mk = out.querySelector('#mk');
          if (mk) mk.addEventListener('click', () => {
            let n = 0;
            r.errors.forEach((e) => {
              if (!e.fix || !e.orig || !e.sentence || !String(e.sentence).includes(e.fix) || Y.canon(e.fix) === Y.canon(e.orig)) return;
              const tp = TOPIC[e.topic] || TOPIC.other;
              const key = 'p:' + Y.canon(e.sentence) + ':' + Y.canon(e.fix);
              if (S.addPersonal({ t: 'm', q: String(e.sentence).replace(e.fix, '___'), he: 'מהטקסט שלך', opts: [e.fix, e.orig], a: e.fix, ex: e.explain || '', unit: tp[1] || undefined, key, srs: key })) n++;
            });
            mk.disabled = true;
            mk.textContent = n ? n + ' תרגילים נוספו ל"התרגילים שלי"' : 'אין תיקונים שאפשר להפוך לתרגיל';
          });
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

  /* ---------- my progress: an honest level and a comparison with the past ---------- */

  function viewProgress() {
    const lv = S.standing();
    const groups = D.groups.map((g) => {
      const us = D.units.filter((u) => u.group === g.id);
      const avg = us.reduce((a, u) => a + (S.mastery(u.id) || 0), 0) / us.length;
      const cells = us.map((u, k) => {
        const m = S.mastery(u.id);
        const lvl = m === null ? (S.state.diag && S.state.diag[u.id] === 0 ? 'w' : '0') : m >= 0.85 ? '3' : m >= 0.5 ? '2' : '1';
        const name = u.title.replace(/[{}]/g, '');
        return `<a class="cell l${lvl}" href="#/unit/${u.id}" title="${esc(name)}${m === null ? '' : ' · ' + pct(m) + '%'}" aria-label="${esc(name)}"><span>${k + 1}</span></a>`;
      }).join('');
      return `<div class="prog-row"><div><div class="lbl">${esc(g.title)}</div><div class="bar"><i style="width:${pct(avg)}%"></i></div></div><div class="pct">${pct(avg)}%</div></div>
        <div class="map">${cells}</div>`;
    }).join('');
    const week = S.snapBefore(7);
    const month = S.snapBefore(28);
    const fmtD = (x, digits) => (Math.abs(x) < (digits ? 0.05 : 0.5) ? '<span class="d0">בלי שינוי</span>' : `<span class="${x > 0 ? 'dup' : 'ddn'}">${x > 0 ? '+' : '−'}${digits ? Math.abs(x).toFixed(1) : Math.abs(Math.round(x))}</span>`);
    const cmpRow = (label, now, digits, w, m) => `<tr><th>${label}</th><td><b>${digits ? now.toFixed(1) : now}</b></td><td>${w === null ? '·' : fmtD(now - w, digits)}</td><td>${m === null ? '·' : fmtD(now - m, digits)}</td></tr>`;
    const sameSnap = week && month && week.day === month.day;
    const a1 = S.accWindow(0, 7);
    const a0 = S.accWindow(7, 7);
    const accLine = (label, cur, prev, n) => `<div class="prog-row"><div><div class="lbl">${label} <small>${n} תשובות</small></div><div class="bar"><i style="width:${cur === null ? 0 : pct(cur)}%"></i></div></div><div class="pct">${cur === null ? '·' : pct(cur) + '%'}</div></div>
      <p class="cmpnote"><small>${cur === null ? 'אין עדיין תשובות בשבוע הזה.' : prev === null ? 'אין עדיין שבוע קודם להשוות אליו.' : `בשבעת הימים שלפני כן: ${pct(prev)}%.`}</small></p>`;
    // the single step that would move the level most
    const started = D.units.filter((u) => S.masteryInfo(u.id));
    const almost = started.filter((u) => { const i = S.masteryInfo(u.id); return i.days < 3 && i.acc >= 0.8; }).sort((x, y) => S.masteryInfo(y.id).days - S.masteryInfo(x.id).days)[0];
    const weakest = started.filter((u) => S.masteryInfo(u.id).acc < 0.8).sort((x, y) => S.masteryInfo(x.id).acc - S.masteryInfo(y.id).acc)[0];
    const stale = started.find((u) => S.masteryInfo(u.id).stale);
    const nu = nextUnit();
    const tip = almost ? `יום תרגול טוב נוסף ב<a href="#/unit/${almost.id}">${Y.inline(almost.title)}</a>: הדיוק שלך שם כבר טוב, ${3 - S.masteryInfo(almost.id).days === 1 ? 'וחסר יום טוב אחד' : 'וחסרים ' + (3 - S.masteryInfo(almost.id).days) + ' ימים טובים'} (שש תשובות ביום, 80% נכונות).`
      : stale ? `חזרה על <a href="#/unit/${stale.id}">${Y.inline(stale.title)}</a>: לא תרגלת אותה יותר משלושה שבועות, והציון שלה דועך.`
      : weakest ? `<a href="#/unit/${weakest.id}">${Y.inline(weakest.title)}</a>: הדיוק שלך שם ${pct(S.masteryInfo(weakest.id).acc)}%, וזה מה שמעכב אותה.`
      : `להתחיל את <a href="#/unit/${nu.id}">${Y.inline(nu.title)}</a>.`;
    const t = S.today();
    const cal = Array.from({ length: 28 }, (_, i) => { const d = t - 27 + i; const n = S.state.days[d] || 0; return `<i class="${n >= S.GOAL ? 'full' : n ? 'some' : ''}" title="${n} תשובות"></i>`; }).join('');
    const active = Array.from({ length: 28 }, (_, i) => S.state.days[t - i] || 0).filter(Boolean).length;

    render(`<a class="crumb" href="#/home">→ בית</a>
      <h1>ההתקדמות שלי</h1>
      <div class="card stack" style="margin-top:12px">
        <div><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><h2 style="margin:0">דרגה ${lv.level} <small style="font-weight:600">מתוך 10</small></h2><small>${lv.pts.toFixed(1)} מתוך ${lv.total} נקודות</small></div>
        <div class="bar" style="margin-top:10px"><i style="width:${pct(lv.inLevel)}%"></i></div>
        <p style="margin:8px 0 0"><small>${lv.level >= 10 ? 'הגעת לדרגה הגבוהה ביותר.' : `עוד ${lv.toNext.toFixed(1)} נקודות לדרגה ${lv.level + 1}.`}</small></p></div>
        <p style="margin:0"><b>מה יקדם אותך הכי מהר</b><br>${tip}</p>
        <details class="how"><summary>איך הדרגה מחושבת</summary>
          <p><small>כל אחת מ-${lv.total} היחידות שווה עד נקודה אחת. רוב הנקודה תלוי בימים: יחידה שתרגלת טוב ביום אחד שווה עד 0.4, ביומיים שונים עד 0.7, ורק אחרי שלושה ימים טובים נקודה מלאה. יחידה שענית בה נכון אבל עוד אין בה יום תרגול טוב (שש תשובות, 80% נכונות) שווה לכל היותר 0.15. כל זה מוכפל בדיוק שלך ב-24 התשובות האחרונות ביחידה. כל דרגה היא עשירית מסך הנקודות.</small></p>
          <p><small>אצלך כרגע: ${lv.byDays[3]} יחידות עם שלושה ימים טובים, ${lv.byDays[2]} עם יומיים, ${lv.byDays[1]} עם יום אחד, ו-${lv.byDays[0]} שהתחלת בלי יום טוב עדיין.</small></p>
          <p><small>הדרגה לא עולה מכמות תשובות, מרצף ימים או מזמן באתר, ושאלה שחוזרת אחרי טעות לא נספרת. היא גם יכולה לרדת: יחידה שלא תורגלה שלושה שבועות מאבדת חלק מהציון.</small></p>
          <p><small>זו דרגה פנימית של הכלי הזה, לפי החומר שיש בו. היא לא מקבילה לרמות רשמיות של ידיעת שפה.</small></p>
        </details>
      </div>

      <h3>היום לעומת קודם</h3>
      <div class="card">
        ${week ? `<div class="tablewrap"><table class="cmp"><tbody>
          <tr><th></th><th>היום</th><th>מאז לפני ${week.ago} ימים</th><th>${month && !sameSnap ? `מאז לפני ${month.ago} ימים` : ''}</th></tr>
          ${cmpRow('נקודות שליטה', lv.pts, true, week.pts, month && !sameSnap ? month.pts : null)}
          ${cmpRow('יחידות יושבות', lv.sitting, false, week.sitting, month && !sameSnap ? month.sitting : null)}
          ${cmpRow('מילים שנזכרו לאורך זמן', lv.known, false, week.known, month && !sameSnap ? month.known : null)}
        </tbody></table></div>` : `<p style="margin:0"><small>עדיין אין למה להשוות. הכלי התחיל לשמור תמונת מצב יומית רק עכשיו, ולכן ההשוואה תופיע מהיום השני של התרגול ותהיה משמעותית אחרי שבוע. כרגע: ${lv.pts.toFixed(1)} נקודות, ${lv.sitting} יחידות יושבות, ${lv.known} מילים שנזכרו לאורך זמן.</small></p>`}
        <p style="margin:10px 0 0"><small>"מילה שנזכרה לאורך זמן" היא מילה או מין של שם עצם שענית עליהם נכון כמה פעמים במרווחים של ימים.</small></p>
      </div>

      <h3>דיוק בניסיון ראשון · שבעת הימים האחרונים</h3>
      <div class="card">
        ${accLine('כל התרגילים', a1.acc, a0.acc, a1.n)}
        <div style="height:12px"></div>
        ${accLine('הקלדה ובניית משפט', a1.pacc, a0.pacc, a1.pn)}
        <p style="margin:10px 0 0"><small>השורה השנייה היא המדד הקרוב ביותר לכתיבה אמיתית. שימי לב שהדיוק יכול לרדת דווקא כשמתקדמים, כי החומר החדש קשה יותר; לכן הדרגה נשענת על שליטה ביחידות ולא על המספר הזה.</small></p>
      </div>

      <h3>ימי תרגול · ארבעת השבועות האחרונים</h3>
      <div class="card">
        <div class="cal">${cal}</div>
        <p style="margin:10px 0 0"><small>${active} מתוך 28 ימים. מלא = הגעת ליעד היומי (${S.GOAL} תשובות), בהיר = תרגלת פחות מזה.</small></p>
      </div>

      <h3>לפי פרקים</h3>
      <div class="card">${groups}
        <p class="legend"><i class="cell l0"></i>חדש <i class="cell lw"></i>לחזק <i class="cell l1"></i>התחלתי <i class="cell l2"></i>בדרך <i class="cell l3"></i>יושב</p>
        <p style="margin:12px 0 0"><small>כל ריבוע הוא יחידה, לפי הסדר בפרק. יחידה "יושבת" אחרי תרגול טוב בשלושה ימים שונים.</small></p>
        <p style="margin:8px 0 0"><a href="#/diag">אבחון</a></p>
      </div>`);
  }

  /* ---------- questions for the teacher ---------- */

  function viewFlags() {
    render(`<a class="crumb" href="#/tools">→ כלים</a><h1>שאלות למורה</h1>
      <div class="card stack">
        ${(S.state.flags || []).length ? `
        <p style="margin:0"><small>תרגילים שסימנת ב"לשאול את המורה". אפשר להעתיק את כולם ולשלוח.</small></p>
        <ul class="miss" style="margin:0">${S.state.flags.map((f, k) => `<li><span class="yi">${esc(f.q)}</span><br><small>התשובה בכלי: <span class="yi">${esc(f.correct)}</span>${f.given ? ' · עניתי: <span class="yi">' + esc(f.given) + '</span>' : ''}</small> <button class="linkbtn" data-unflag="${k}">הסרה</button></li>`).join('')}</ul>
        <div class="row"><button class="btn ghost small" id="cpflags">העתקת כל השאלות</button></div>` : '<p style="margin:0"><small>אחרי כל תרגיל יש כפתור "לשאול את המורה". מה שתסמני שם ייאסף כאן, כדי שתוכלי לברר אותו בשיעור.</small></p>'}
      </div>

      <h3>בדיקת התוכן</h3>
      <div class="card stack">
        <p style="margin:0"><small>כל היידיש שבכלי בדף אחד, מסודר להדפסה או לשליחה: שמות העצם לפי מין, הפעלים, הכתיב, המילים, הטקסטים והתרגילים. מיועד למורה שתעבור על התוכן.</small></p>
        <div class="row"><a class="btn ghost small" href="#/review">דף לבדיקת מורה</a></div>
      </div>`);
    $app.querySelectorAll('[data-unflag]').forEach((b) => b.addEventListener('click', () => { S.removeFlag(+b.dataset.unflag); viewFlags(); }));
    const cpf = $app.querySelector('#cpflags');
    if (cpf) cpf.addEventListener('click', async () => {
      const text = 'שאלות על תרגילים מהכלי "ייִדיש כּהלכה":\n\n' + S.state.flags.map((f, k) => `${k + 1}. ${f.q}\n   התשובה בכלי: ${f.correct}${f.given ? '\n   אני עניתי: ' + f.given : ''}${f.ex ? '\n   ההסבר בכלי: ' + f.ex : ''}`).join('\n\n');
      try { await navigator.clipboard.writeText(text); cpf.textContent = 'הועתק'; } catch (e) { cpf.textContent = 'ההעתקה נחסמה'; }
    });
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

      <h3>סנכרון בין מכשירים</h3>
      <div class="card stack">
        ${Y.sync.enabled() ? `
        <p style="margin:0"><b style="color:var(--ok)">הסנכרון פעיל.</b> <small>${Y.sync.last() ? 'סונכרן לאחרונה: ' + new Date(Y.sync.last()).toLocaleString('he-IL') : ''}${Y.sync.status === 'error' ? ' · ' + esc(Y.sync.error) : ''}</small></p>
        <p style="margin:0"><small>ההתקדמות נשמרת כקובץ פרטי (Gist) בחשבון ה-GitHub שלך ומתעדכנת לבד. במכשיר נוסף: להזין שם את אותו קוד.</small></p>
        <div class="row"><button class="btn small" id="syncnow">לסנכרן עכשיו</button><button class="btn ghost small" id="syncoff">לנתק את המכשיר הזה</button></div>` : `
        <p style="margin:0"><small>בלי שרת ובלי הרשמה: ההתקדמות נשמרת כקובץ פרטי בחשבון ה-GitHub שלך, וכל מכשיר שתזיני בו את אותו קוד יסתנכרן איתו.</small></p>
        <ol style="margin:0;padding-inline-start:1.2em;font-size:.92rem;line-height:1.8">
          <li>לפתוח את <a href="https://github.com/settings/tokens/new?scopes=gist&description=Yiddish%20sync" target="_blank" rel="noopener">יצירת קוד ב-GitHub</a> (הקישור כבר מסמן רק את ההרשאה <b dir="ltr">gist</b>).</li>
          <li>ב-Expiration לבחור <b dir="ltr">No expiration</b>, וללחוץ <b dir="ltr">Generate token</b>.</li>
          <li>להעתיק את הקוד שמתחיל ב-<span dir="ltr">ghp_</span> ולהדביק כאן.</li>
        </ol>
        <label class="field"><span>קוד סנכרון (GitHub token)</span><input id="synctok" type="password" dir="ltr" autocomplete="off" placeholder="ghp_..."></label>
        <div class="row"><button class="btn small" id="syncon">חיבור</button></div>
        <p style="margin:0"><small>הקוד נשמר רק בדפדפן הזה ונשלח רק ל-GitHub. ההרשאה שלו מוגבלת לקובצי Gist, בלי גישה למאגרים שלך.</small></p>`}
        <div id="syncmsg"></div>
      </div>

      <h3>תזכורת יומית</h3>
      <div class="card stack">
        <p style="margin:0"><small>אירוע יומי חוזר ביומן של הטלפון, עם התראה וקישור ישיר לסשן של היום. פותחים את הקובץ שיורד ומאשרים את ההוספה ליומן.</small></p>
        <div class="row"><label class="field" style="width:130px"><span>שעה</span><input id="remtime" type="time" value="20:00"></label>
        <button class="btn ghost small" id="rem" style="align-self:flex-end">הוספה ליומן</button></div>
      </div>

      <h3>ההתקדמות שלי</h3>
      <div class="card stack">
        <p style="margin:0"><small>ההתקדמות נשמרת בדפדפן של המכשיר הזה. אפשר גם לגבות אותה ידנית לקובץ.</small></p>
        <div class="row">
          <button class="btn ghost small" id="exp">ייצוא לקובץ</button>
          <label class="btn ghost small" style="cursor:pointer">ייבוא מקובץ<input type="file" id="imp" accept="application/json,.json" hidden></label>
          <button class="btn ghost small" id="reset">איפוס ההתקדמות</button>
        </div>
      </div>`);
    $app.querySelector('#strict').addEventListener('change', (e) => S.setSetting('strict', e.target.checked));
    const smsg = (t, bad) => { $app.querySelector('#syncmsg').innerHTML = t ? `<p class="${bad ? 'alert' : ''}" style="margin:0">${t}</p>` : ''; };
    const son = $app.querySelector('#syncon');
    if (son) son.addEventListener('click', async () => {
      const tok = $app.querySelector('#synctok').value.trim();
      if (!tok) return;
      son.disabled = true;
      smsg('<span class="spin"></span> מתחבר...');
      try { await Y.sync.connect(tok); viewSettings('הסנכרון פעיל. ההתקדמות מהמכשירים מוזגה.'); }
      catch (e) { smsg(esc(e.message), true); son.disabled = false; }
    });
    const snow = $app.querySelector('#syncnow');
    if (snow) snow.addEventListener('click', async () => {
      snow.disabled = true;
      smsg('<span class="spin"></span> מסנכרן...');
      try { await Y.sync.now(); viewSettings('סונכרן.'); }
      catch (e) { smsg(esc(e.message), true); snow.disabled = false; }
    });
    const soff = $app.querySelector('#syncoff');
    if (soff) soff.addEventListener('click', () => { Y.sync.disconnect(); viewSettings('המכשיר נותק מהסנכרון. ההתקדמות נשארה כאן ובחשבון.'); });
    $app.querySelector('#rem').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([Y.sync.reminderFile($app.querySelector('#remtime').value || '20:00')], { type: 'text/calendar' }));
      a.download = 'yiddish-reminder.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
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

  Y.ui = { render, runSession, KEYS, aiDraft: '', cleanup: null, unitById };

  function route() {
    enterHandler = null;
    if (Y.ui.cleanup) { Y.ui.cleanup(); Y.ui.cleanup = null; }
    const parts = (location.hash || '#/home').replace(/^#\//, '').split('/');
    const [a, b, c] = parts;
    document.querySelectorAll('#nav a').forEach((n) => {
      const on = n.dataset.r === a || (n.dataset.r === 'home' && a === 'progress') || (n.dataset.r === 'learn' && ['unit', 'diag', 'read'].includes(a)) ||
        (n.dataset.r === 'practice' && ['drill', 'daily', 'mistakes', 'blitz', 'personal', 'track', 'gender'].includes(a)) ||
        (n.dataset.r === 'tools' && ['check', 'dict', 'lab', 'ai', 'ref', 'flags', 'review'].includes(a)) ||
        (n.dataset.r === 'words' && ['deck', 'mywords'].includes(a));
      n.classList.toggle('on', on);
      if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
    });
    if (a === 'learn') return viewLearn();
    if (a === 'unit') return c === 'go' ? viewUnitGo(b) : c === 'steps' ? viewUnitSteps(b) : viewUnit(b);
    if (a === 'practice') return viewPractice();
    if (a === 'track') return Y.views.track(b, c);
    if (a === 'gender') return Y.views.gender(b);
    if (a === 'drill') return viewDrill(b);
    if (a === 'daily') return viewDaily();
    if (a === 'personal') return runSession(Y.shuffle((S.state.personal || []).slice()).slice(0, 12).map((x) => Object.assign({}, x)), { back: '#/practice', again: '#/personal' });
    if (a === 'read') return Y.views.read(b);
    if (a === 'review') return Y.views.review();
    if (a === 'mistakes') return runSession(S.state.mistakes.slice(0, 15).map((m) => Object.assign({}, m)), { back: '#/practice', again: '#/mistakes' });
    if (a === 'diag') return viewDiag(b);
    if (a === 'words') return viewWords();
    if (a === 'deck') return c === 'go' ? viewDeckGo(b) : viewDeck(b);
    if (a === 'mywords') return runSession(Y.shuffle(S.state.mywords).slice(0, 12).map((w) => G.myword(w)), { back: '#/words', again: '#/mywords' });
    if (a === 'ai') return viewAi(b === 'chat' ? 'chat' : 'check');
    if (a === 'ref') return viewRef();
    if (a === 'flags') return viewFlags();
    if (a === 'progress') return viewProgress();
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

  // sync on start and whenever the app comes back to the foreground; refresh the screen if other devices added progress
  const pull = () => {
    if (!Y.sync.enabled()) return;
    Y.sync.now().then((changed) => {
      const a = (location.hash || '#/home').replace(/^#\//, '').split('/')[0];
      if (changed && ['home', '', 'learn', 'practice', 'words'].includes(a)) route();
    }).catch(() => {});
  };
  pull();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
