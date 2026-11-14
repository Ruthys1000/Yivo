/* Tools: offline spelling checker, dictionary, case lab, blitz game. */
(function () {
  const Y = window.Y;
  const D = Y.data;
  const S = Y.store;
  const L = Y.lex;
  const V = (Y.views = {});
  const esc = Y.esc;
  const GNAME = { m: 'זכר', f: 'נקבה', n: 'סתמי' };
  const CASES = [['nom', 'נאָמינאַטיוו', '___ איז דאָ.'], ['acc', 'אַקוזאַטיוו', 'איך זע ___.'], ['dat', 'דאַטיוו', 'איך רעד וועגן ___.']];

  /* ---------- tools index ---------- */
  V.tools = () => {
    Y.ui.render(`<h1>כלים</h1>
      <p class="lead">כלי עזר לזמן כתיבה ושיעורי בית.</p>
      <div class="grid" style="margin-top:16px">
        <a class="tile" href="#/check"><b>בודק כתיב</b><small>מדביקים טקסט ומקבלים מייד מה שונה מכתיב ייִוואָ. עובד בלי אינטרנט.</small></a>
        <a class="tile" href="#/dict"><b>מילון ונטיות</b><small>מין, רבים, נטיית פועל ותואר לכל מילה במאגר.</small></a>
        <a class="tile" href="#/lab"><b>מעבדת יחסות</b><small>בוחרים שם עצם ותואר ורואים איך הצירוף משתנה.</small></a>
        <a class="tile" href="#/ref"><b>טבלאות</b><small>כל טבלאות הדקדוק במקום אחד.</small></a>
        <a class="tile" href="#/ai"><b>המורה</b><small>${Y.ai.enabled() ? 'בדיקת דקדוק מלאה, שאלות ושיחה עם Claude.' : 'חיבור אופציונלי ל-Claude לבדיקת דקדוק ולשאלות.'}</small></a>
      </div>`);
  };

  /* ---------- spelling checker ---------- */
  let draft = '';
  V.check = () => {
    Y.ui.render(`<a class="crumb" href="#/tools">→ כלים</a>
      <h1>בודק כתיב</h1>
      <p class="lead">כתבי או הדביקי טקסט ביידיש, בכל כתיב. הבודק מסמן מה שונה מכתיב ייִוואָ ומציע את הצורה התקנית.</p>
      <textarea class="big" id="txt" lang="yi" dir="rtl" placeholder="למשל: איך האב נישט קיין צייט היינט, ווייל איך דארף ארבעטן" style="margin-top:12px"></textarea>
      <div class="keys">${Y.ui.KEYS.map((k) => `<button type="button" data-ch="${k}">${k}</button>`).join('')}</div>
      <div id="out"></div>`);
    const $ = (q) => document.querySelector(q);
    const txt = $('#txt');
    txt.value = draft;
    document.querySelectorAll('.keys button').forEach((b) => b.addEventListener('click', () => {
      const s = txt.selectionStart; const e = txt.selectionEnd;
      txt.value = txt.value.slice(0, s) + b.dataset.ch + txt.value.slice(e);
      txt.focus(); txt.setSelectionRange(s + b.dataset.ch.length, s + b.dataset.ch.length);
      run();
    }));

    const replace = (pairs) => {
      const map = new Map(pairs);
      txt.value = L.analyze(txt.value).map((t) => (t.word && map.has(t.text) ? map.get(t.text) : t.text)).join('');
      run();
    };

    function run() {
      draft = txt.value;
      const out = $('#out');
      if (!draft.trim()) { out.innerHTML = ''; return; }
      const toks = L.analyze(draft);
      const words = toks.filter((t) => t.word);
      const fixes = new Map();
      const hints = new Map();
      for (const t of words) {
        if (t.res.st === 'fix') fixes.set(t.text, t.res);
        else if (t.res.st === 'hint') hints.set(t.text, t.res);
      }
      const unknown = words.filter((t) => t.res.st === 'unk').length;
      const single = [...fixes.entries()].filter(([, r]) => r.sugg.length === 1);
      const html = toks.map((t) => {
        if (!t.word) return esc(t.text).replace(/\n/g, '<br>');
        if (t.res.st === 'fix') return `<mark class="w-fix" title="${esc(t.res.why)}">${esc(t.text)}</mark>`;
        if (t.res.st === 'hint') return `<mark class="w-hint" title="${esc(t.res.why)}">${esc(t.text)}</mark>`;
        return esc(t.text);
      }).join('');
      out.innerHTML = Y.disp(`
        <div class="card stack" style="margin-top:14px">
          <div class="row" style="justify-content:space-between">
            <small>${words.length} מילים · <b>${fixes.size}</b> לתיקון · ${hints.size} לבדיקה${unknown ? ` · ${unknown} לא במאגר` : ''}</small>
            <span class="row">
              ${single.length > 1 ? '<button class="btn small" id="all">לתקן הכול</button>' : ''}
              <button class="btn ghost small" id="copy">העתקה</button>
            </span>
          </div>
          <div class="checked">${html}</div>
          ${!fixes.size && !hints.size ? `<p style="margin:0;color:var(--ok)"><b>לא נמצא מה לתקן בכתיב.</b></p>` : ''}
        </div>
        ${fixes.size ? `<h3>לתיקון</h3><div class="card fixlist">${[...fixes.entries()].map(([w, r], i) => `
          <div class="fixrow"><span class="yi old">${esc(w)}</span><span>←</span>
            <span class="row">${r.sugg.map((sg, j) => `<button class="btn ghost small yi" data-fix="${i}:${j}">${esc(sg)}</button>`).join('')}</span>
            <small>${esc(r.why)}${r.sugg.length > 1 ? ' · יש כמה אפשרויות, בחרי לפי המשמעות' : ''}</small></div>`).join('')}</div>` : ''}
        ${hints.size ? `<h3>לבדיקה</h3><div class="card fixlist">${[...hints.entries()].map(([w, r]) => `
          <div class="fixrow"><span class="yi old">${esc(w)}</span><span></span><span></span><small>${esc(r.why)}</small></div>`).join('')}
          <p style="margin:10px 0 0"><small>המילים האלה לא במאגר, אז אין הצעה מדויקת, רק סימן שכדאי לבדוק. מילים ממקור עברי נכתבות כבמקור.</small></p></div>` : ''}
        <div class="row" style="margin-top:16px">
          ${Y.ai.enabled() ? '<button class="btn ghost" id="toai">בדיקת דקדוק מלאה אצל המורה</button>' : ''}
        </div>
        <p><small>הבודק בודק כתיב בלבד, מילה אחרי מילה, מול מאגר של כ-${Math.round(L.exact.size / 100) * 100} צורות. הוא לא בודק מין, יחסות או סדר מילים, ומילה שאינה במאגר נשארת בלי סימון.</small></p>`);
      const fixArr = [...fixes.entries()];
      out.querySelectorAll('[data-fix]').forEach((b) => b.addEventListener('click', () => {
        const [i, j] = b.dataset.fix.split(':').map(Number);
        replace([[fixArr[i][0], fixArr[i][1].sugg[j]]]);
      }));
      const all = out.querySelector('#all');
      if (all) all.addEventListener('click', () => replace(single.map(([w, r]) => [w, r.sugg[0]])));
      out.querySelector('#copy').addEventListener('click', async (e) => {
        try { await navigator.clipboard.writeText(txt.value); e.target.textContent = 'הועתק'; }
        catch (err) { txt.select(); }
      });
      const toai = out.querySelector('#toai');
      if (toai) toai.addEventListener('click', () => { Y.ui.aiDraft = txt.value; location.hash = '#/ai'; });
    }
    let timer = null;
    txt.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 200); });
    run();
  };

  /* ---------- dictionary ---------- */
  const ending = (form, stem) => {
    const base = Y.unfinal(stem);
    return form.startsWith(base) && form.length > base.length ? esc(base) + '<b class="end">' + esc(form.slice(base.length)) + '</b>' : esc(form);
  };

  const card = (e) => {
    const rows = [];
    let head = e.head;
    let tag = '';
    if (e.kind === 'noun') {
      head = Y.ART.nom[e.g] + ' ' + e.head;
      tag = 'שם עצם · ' + GNAME[e.g];
      if (e.pl) rows.push(['רבים', `<span class="yi">די ${esc(e.pl)}</span>`]);
      if (e.dim) rows.push(['הקטנה', `<span class="yi">דאָס ${esc(e.dim)}</span>`]);
      if (e.irr) rows.push(['נטייה', 'שם שנוטה בעצמו, ראי <a href="#/unit/c6">שייכות ושמות נוטים</a>']);
      else if (!e.head.includes(' ')) {
        rows.push(['יחסות', CASES.map(([k]) => `<span class="yi">${esc(Y.phrase(e.head, 'גוט', k, e.g, true))}</span>`).join(' · ') +
          ` · <a href="#/lab/${encodeURIComponent(e.head)}">במעבדה</a>`]);
      }
    } else if (e.kind === 'verb') {
      tag = 'פועל';
      rows.push(['עבר', `<span class="yi">איך ${e.aux === 'z' ? 'בין' : 'האָב'} ${esc(e.part)}</span> · נוטה עם <span class="yi">${e.aux === 'z' ? 'זײַן' : 'האָבן'}</span>`]);
      if (e.stem) {
        const f = Y.present(e.stem, e.head);
        rows.push(['הווה', `<span class="yi">איך ${esc(f.ikh)}, דו ${esc(f.du)}, ער ${esc(f.er)}, מיר ${esc(f.mir)}</span>`]);
      }
      rows.push(['עתיד', `<span class="yi">איך וועל ${esc(e.head)}</span>`]);
    } else if (e.kind === 'adj') {
      tag = 'שם תואר';
      rows.push(['סיומות', ['er', 'e', 'n'].map((x) => `<span class="yi">${ending(Y.adj(e.head, x), e.head)}</span>`).join(' · ')]);
      if (e.comp) rows.push(['יתרון', `<span class="yi">${esc(e.comp)}</span>`]);
    } else tag = e.deck || '';
    if (e.note) rows.push(['הערה', Y.inline(e.note)]);
    return `<div class="card dcard">
      <div class="row" style="justify-content:space-between;align-items:baseline"><span class="yi dhead">${esc(head)}</span><small>${esc(tag)}</small></div>
      <div>${esc(e.he)}</div>
      ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
    </div>`;
  };

  let dictQ = '';
  V.dict = () => {
    Y.ui.render(`<a class="crumb" href="#/tools">→ כלים</a>
      <h1>מילון ונטיות</h1>
      <p class="lead">חיפוש ביידיש (בכל כתיב, גם צורה נטויה) או בעברית.</p>
      <label class="field" style="margin-top:12px"><span>מילה</span><input class="yi-in" id="dq" dir="rtl" autocomplete="off" placeholder="טיש · געשריבן · להבין"></label>
      <div id="dres" class="stack" style="margin-top:16px"></div>`);
    const inp = document.querySelector('#dq');
    const res = document.querySelector('#dres');
    const run = () => {
      dictQ = inp.value;
      if (!dictQ.trim()) {
        res.innerHTML = Y.disp(`<p><small>במאגר ${L.entries.length} ערכים: שמות עצם עם המין שלהם, פעלים עם פועל העזר והבינוני, תארים ואוצר המילים של הכלי. זה מאגר לימודי, לא מילון מלא; למילון מקיף השתמשי במילון של הקורס.</small></p>`);
        return;
      }
      const found = L.search(dictQ);
      res.innerHTML = Y.disp(found.length ? found.map(card).join('') : `<p>לא נמצא במאגר. ${Y.ai.enabled() ? '<a href="#/ai/chat">אפשר לשאול את המורה</a>.' : ''}</p>`);
    };
    inp.value = dictQ;
    inp.addEventListener('input', run);
    inp.focus();
    run();
  };

  /* ---------- case lab ---------- */
  const lab = { noun: null, adj: 'גוט', def: true };
  V.lab = (param) => {
    const nouns = D.nouns.filter((n) => !n.irr);
    if (param) {
      const hit = nouns.find((n) => Y.canon(n.w) === Y.canon(decodeURIComponent(param)));
      if (hit) lab.noun = hit;
    }
    if (!lab.noun) lab.noun = nouns.find((n) => n.w === 'טיש') || nouns[0];
    const draw = () => {
      const n = lab.noun;
      const entry = L.entries.find((e) => e.kind === 'noun' && e.head === n.w && e.g === n.g);
      const phraseHtml = (k) => {
        if (!lab.adj) return `<b class="art">${esc(lab.def ? Y.ART[k][n.g] : 'אַ')}</b> ${esc(n.w)}`;
        const end = (lab.def ? Y.END_DEF : Y.END_INDEF)[k][n.g];
        const form = Y.adj(lab.adj, end);
        const art = lab.def ? Y.ART[k][n.g] : /^[אע]/.test(form) ? 'אַן' : 'אַ';
        return `<b class="art">${esc(art)}</b> ${end === '0' ? esc(form) + '<b class="end">∅</b>' : ending(form, lab.adj)} ${esc(n.w)}`;
      };
      const opt = (g) => nouns.filter((x) => x.g === g).map((x) => `<option value="${esc(x.g + ':' + x.w)}" ${x === n ? 'selected' : ''}>${esc(x.w)} · ${esc(x.he)}</option>`).join('');
      Y.ui.render(`<a class="crumb" href="#/tools">→ כלים</a>
        <h1>מעבדת יחסות</h1>
        <p class="lead">בחרי שם עצם ותואר וראי איך התווית והסיומת משתנות בשלוש היחסות.</p>
        <div class="card stack" style="margin-top:14px">
          <div class="form-grid">
            <label class="field"><span>שם עצם</span><select id="ln" class="yi-in">
              <optgroup label="דער · זכר">${opt('m')}</optgroup><optgroup label="די · נקבה">${opt('f')}</optgroup><optgroup label="דאָס · סתמי">${opt('n')}</optgroup></select></label>
            <label class="field"><span>תואר</span><select id="la" class="yi-in"><option value="">בלי תואר</option>
              ${D.adjs.map((a) => `<option value="${esc(a.w)}" ${a.w === lab.adj ? 'selected' : ''}>${esc(a.w)} · ${esc(a.he)}</option>`).join('')}</select></label>
          </div>
          <div class="row">
            <div class="seg" role="group" aria-label="יידוע">
              <button data-def="1" class="${lab.def ? 'on' : ''}">מיודע (<span class="yi">דער</span>)</button>
              <button data-def="0" class="${lab.def ? '' : 'on'}">לא מיודע (<span class="yi">אַ</span>)</button>
            </div>
            <button class="btn ghost small" id="rnd">מילה אקראית</button>
          </div>
        </div>
        <p style="margin:18px 0 6px"><span class="yi" style="font-size:1.3rem">${esc(Y.ART.nom[n.g] + ' ' + n.w)}</span> · ${esc(n.he)} · <b>${GNAME[n.g]}</b></p>
        <div class="tablewrap"><table class="labt"><tbody>
          ${CASES.map(([k, name, frame]) => `<tr><th><span class="yi">${name}</span></th><td class="yi">${esc(frame).replace('___', `<span class="ph">${phraseHtml(k)}</span>`)}</td></tr>`).join('')}
          ${entry && entry.pl ? `<tr><th>רבים</th><td class="yi"><span class="ph"><b class="art">${lab.def ? 'די' : ''}</b> ${lab.adj ? ending(Y.adj(lab.adj, 'e'), lab.adj) : ''} ${esc(entry.pl)}</span> <small>בכל היחסות</small></td></tr>` : ''}
        </tbody></table></div>
        <div class="note tip"><b>מה לראות כאן</b>${Y.inline(
          n.g === 'm' ? 'זכר: התווית משתנה כבר באקוזטיב. {דער ← דעם}, והתואר מקבל {־ן}.'
          : n.g === 'f' ? 'נקבה: נומינטיב ואקוזטיב זהים ({די}, {־ע}). רק בדאַטיוו: {דער}, {־ער}.'
          : lab.def ? 'סתמי מיודע: {דאָס ... ־ע} בנומינטיב ובאקוזטיב; בדאַטיוו {דעם ... ־ן}.'
          : 'סתמי לא מיודע: התואר בלי סיומת (∅) בנומינטיב ובאקוזטיב; בדאַטיוו הסיומת {־ן} חוזרת.')}
          ${lab.def && n.g !== 'f' ? ' ' + Y.inline('ועם מילת יחס {דעם} מתמזג: {מיטן, אויפֿן, פֿונעם, צום, בײַם}.') : ''}</div>
        <div class="row"><a class="btn ghost small" href="#/drill/${lab.def ? 'adj' : 'indef'}">לתרגל את זה</a></div>`);
      document.querySelector('#ln').addEventListener('change', (e) => {
        const [g, w] = e.target.value.split(':');
        lab.noun = nouns.find((x) => x.g === g && x.w === w);
        draw();
      });
      document.querySelector('#la').addEventListener('change', (e) => { lab.adj = e.target.value || null; draw(); });
      document.querySelectorAll('[data-def]').forEach((b) => b.addEventListener('click', () => { lab.def = b.dataset.def === '1'; draw(); }));
      document.querySelector('#rnd').addEventListener('click', () => {
        lab.noun = Y.pick(nouns);
        const fit = D.adjs.filter((a) => a.c.includes(lab.noun.c));
        if (lab.adj !== null) lab.adj = Y.pick(fit).w;
        draw();
      });
    };
    draw();
  };

  /* ---------- blitz ---------- */
  V.blitz = () => {
    const ARTS = ['דער', 'די', 'דאָס'];
    const start = () => {
      Y.ui.render(`<a class="crumb" href="#/practice">→ תרגול</a>
        <div class="card stack" style="text-align:center">
          <h1>בליץ <span class="yi">דער · די · דאָס</span></h1>
          <p class="lead">60 שניות. כמה שמות עצם תספיקי למיין נכון?</p>
          <div><div class="result-num">${S.best('blitz')}</div><small>השיא שלך</small></div>
          <div class="row" style="justify-content:center"><button class="btn" id="go">התחילי</button></div>
        </div>`);
      document.querySelector('#go').addEventListener('click', play);
    };
    const play = () => {
      let left = 60;
      let score = 0;
      let total = 0;
      const misses = [];
      let cur = null;
      let lock = false;
      Y.ui.render(`<div class="run-head"><a class="x" href="#/practice" aria-label="סגירה">×</a>
          <div class="bar"><i id="tb" style="width:100%"></i></div><span class="cnt" id="tl">60</span></div>
        <div class="blitz">
          <div class="q-hint" id="bhe">&nbsp;</div>
          <div class="bword yi" id="bw"></div>
          <div class="opts three">${ARTS.map((a) => `<button class="opt" data-a="${a}">${a}</button>`).join('')}</div>
          <p style="text-align:center"><b id="bs" class="result-num" style="font-size:2rem">0</b></p>
        </div>`);
      const $ = (q) => document.querySelector(q);
      const btns = [...document.querySelectorAll('.blitz .opt')];
      const next = () => {
        cur = Y.gen.gender();
        $('#bw').textContent = Y.disp(cur.q.replace('___ ', ''));
        $('#bhe').textContent = cur.he;
        btns.forEach((b) => { b.className = 'opt'; });
        lock = false;
      };
      const end = () => {
        clearInterval(timer);
        Y.ui.cleanup = null;
        const rec = S.setBest('blitz', score);
        Y.ui.render(`<div class="card stack" style="text-align:center">
            <div><div class="result-num">${score}</div><p class="lead">נכונות מתוך ${total}${rec ? ' · שיא חדש!' : ` · השיא: ${S.best('blitz')}`}</p></div>
            <div class="row" style="justify-content:center"><button class="btn" id="again">עוד סיבוב</button><a class="btn ghost" href="#/practice">חזרה</a></div>
          </div>
          ${misses.length ? `<h3>לחזרה</h3><ul class="miss">${misses.map((m) => `<li><span class="yi">${esc(m.a + ' ' + m.q.replace('___ ', ''))}</span> <small>${esc(m.he)}</small></li>`).join('')}</ul>` : ''}`);
        document.querySelector('#again').addEventListener('click', play);
      };
      const timer = setInterval(() => {
        left--;
        const tb = $('#tb');
        if (!tb) { clearInterval(timer); return; }
        tb.style.width = (left / 60) * 100 + '%';
        $('#tl').textContent = left;
        if (left <= 0) end();
      }, 1000);
      Y.ui.cleanup = () => clearInterval(timer);
      btns.forEach((b) => b.addEventListener('click', () => {
        if (lock || left <= 0) return;
        lock = true;
        const ok = Y.canon(b.dataset.a) === Y.canon(cur.a);
        total++;
        cur.unit = 'b1';
        S.answer(cur, ok);
        if (ok) { score++; b.classList.add('right'); $('#bs').textContent = score; }
        else {
          b.classList.add('wrong');
          btns.find((x) => Y.canon(x.dataset.a) === Y.canon(cur.a)).classList.add('right');
          misses.push(cur);
        }
        setTimeout(() => { if (left > 0 && document.querySelector('.blitz')) next(); }, ok ? 180 : 900);
      }));
      next();
    };
    start();
  };
})();
