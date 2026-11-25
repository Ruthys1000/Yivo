/* Text helpers: Yiddish normalisation, declension, mini-markup */
(function () {
  const Y = (window.Y = window.Y || {});

  const MED = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פֿ', 'ץ': 'צ' };

  /* Canonical form for comparing answers: decomposed marks, no ligatures, unified punctuation. */
  Y.canon = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/װ/g, 'וו')
      .replace(/ױ/g, 'וי')
      .replace(/ײ/g, 'יי')
      .replace(/['’`׳]/g, '׳')
      .replace(/[-–־]/g, '־')
      .replace(/[.,!?;:…"״“”]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  /* Same, but without any diacritics (lenient comparison). */
  Y.bare = (s) => Y.canon(s).replace(/[ְ-ׇ]/g, '');

  /* Display form: pasekh tsvey yudn as one ligature so the pasekh sits in the middle. */
  Y.disp = (s) => String(s).replace(/ייַ/g, 'ײַ');

  Y.esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Turn a word-final letter into its medial form before adding a suffix. */
  Y.unfinal = (w) => {
    const last = w.slice(-1);
    return MED[last] ? w.slice(0, -1) + MED[last] : w;
  };
  Y.join = (stem, suf) => Y.unfinal(stem) + suf;

  const stripMarks = (s) => s.replace(/[ְ-ׇ]/g, '');

  /* Adjective inflection. end: 'er' | 'e' | 'n' | '0' */
  Y.adj = (stem, end) => {
    if (end === '0') return stem;
    if (end === 'er') return Y.join(stem, 'ער');
    if (end === 'e') return Y.join(stem, 'ע');
    // the -n ending and its variants
    if (Y.canon(stem) === Y.canon('נײַ')) return 'נײַעם';
    const plain = stripMarks(Y.canon(stem));
    const last = plain.slice(-1);
    if (last === 'ן' || last === 'נ') return Y.join(stem, 'עם');
    if (last === 'ם' || last === 'מ') return Y.join(stem, 'ען');
    if (last === 'י' || last === 'ו' || last === 'א' || last === 'ע') return stem + 'ען';
    return Y.join(stem, 'ן');
  };

  Y.ART = {
    nom: { m: 'דער', f: 'די', n: 'דאָס' },
    acc: { m: 'דעם', f: 'די', n: 'דאָס' },
    dat: { m: 'דעם', f: 'דער', n: 'דעם' },
  };
  const END_DEF = {
    nom: { m: 'er', f: 'e', n: 'e' },
    acc: { m: 'n', f: 'e', n: 'e' },
    dat: { m: 'n', f: 'er', n: 'n' },
  };
  const END_INDEF = {
    nom: { m: 'er', f: 'e', n: '0' },
    acc: { m: 'n', f: 'e', n: '0' },
    dat: { m: 'n', f: 'er', n: 'n' },
  };
  Y.END_DEF = END_DEF;
  Y.END_INDEF = END_INDEF;

  const startsWithVowel = (w) => /^[אע]/.test(w);

  /* Build a noun phrase. g = gender used for the forms (may be deliberately wrong for distractors). */
  Y.phrase = (noun, adj, kase, g, def) => {
    if (!adj) return (def ? Y.ART[kase][g] : 'אַ') + ' ' + noun;
    const end = (def ? END_DEF : END_INDEF)[kase][g];
    const a = Y.adj(adj, end);
    const art = def ? Y.ART[kase][g] : startsWithVowel(a) ? 'אַן' : 'אַ';
    return art + ' ' + a + ' ' + noun;
  };

  /* Present tense. stem = 1st person singular form, inf = infinitive. */
  Y.present = (stem, inf) => {
    const s = Y.unfinal(stem);
    const bareLast = stripMarks(Y.canon(stem)).slice(-1);
    const du = /[סזצץ]/.test(bareLast) ? s + 'ט' : s + 'סט';
    const er = bareLast === 'ט' ? stem : s + 'ט';
    // plural = stem + ־ן; a stem that ends in a vowel takes ־ען even where the infinitive is contracted (גיין ← מיר גייען, זען ← מיר זעען)
    const pl = /(יי|ע)$/.test(stripMarks(Y.canon(stem))) ? stem + 'ען' : inf;
    return { ikh: stem, du, er, mir: pl, ir: er, zey: pl };
  };

  /* When a typed answer has the right letters but different marks, say exactly which and why. */
  const MARK_RULES = [
    [/^ו/, 'ו עם נקודה ({וּ}) נכתבת רק כשה־u צמוד ל־{וו} או בא לפני {י}: {וווּ, געוווּסט, פּרוּוון}. בכל מקום אחר u הוא {ו} רגילה: {צו, און, קומען}.'],
    [/^א/, '{אַ} = a, {אָ} = o. {א} בלי סימן היא רק אל"ף שותקת בתחילת מילה, לפני {ו} או {י}.'],
    [/^פ/, '{פּ} = p, {פֿ} = f. אין {פ} בלי סימן, חוץ מ־{ף} סופית.'],
    [/^י/, '{ײַ} = ay, {יי} = ey. {יִ} בא רק כשה־i עומד ליד תנועה אחרת או ליד {י} עיצורית: {ייִדיש, רויִק}.'],
    [/^[בכתש]/, 'במילים ממקור עברי: {בֿ} = v, {כּ} = k, {תּ} = t, {שׂ} = s. בלי סימן: {ב} = b, {כ} = kh, {ת} = s, {ש} = sh.'],
  ];
  Y.markDiff = (given, correct) => {
    const units = (s) => {
      const out = [];
      for (const ch of Y.canon(s)) {
        if (/[\u05B0-\u05C7]/.test(ch) && out.length) out[out.length - 1] += ch;
        else out.push(ch);
      }
      return out;
    };
    const g = units(given);
    const c = units(correct);
    if (g.length !== c.length) return [];
    const seen = new Set();
    const msgs = [];
    for (let i = 0; i < g.length; i++) {
      if (g[i] === c[i] || g[i][0] !== c[i][0]) continue;
      const rule = MARK_RULES.find(([re]) => re.test(c[i]));
      const key = g[i] + '>' + c[i];
      if (seen.has(key)) continue;
      seen.add(key);
      const show = (x) => (x === 'י\u05B7' ? 'ײַ' : x);
      const typed = c[i] === 'י\u05B7' && g[i] === 'י' ? 'יי' : show(g[i]);
      msgs.push(`כתבת {${typed}}, בתקן כאן {${show(c[i])}}. ${rule ? rule[1] : ''}`);
    }
    return msgs.slice(0, 3);
  };

  Y.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  Y.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  Y.uniq = (arr) => {
    const seen = new Set();
    return arr.filter((x) => {
      const k = Y.canon(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  /* Inline markup: {yiddish}, **bold** */
  Y.inline = (s) =>
    Y.esc(s)
      .replace(/\{([^}]*)\}/g, '<span class="yi">$1</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  /* Block markup for lesson texts.
     "## " heading, "- " list item, "! " tip, "~ " dialect note, "| a | b |" table row ("|! " = header row) */
  Y.fmt = (text) => {
    const lines = text.split('\n');
    let html = '';
    let list = false;
    let table = false;
    const close = () => {
      if (list) { html += '</ul>'; list = false; }
      if (table) { html += '</tbody></table></div>'; table = false; }
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { close(); continue; }
      if (line.startsWith('|')) {
        if (list) close();
        const head = line.startsWith('|!');
        const cells = line.replace(/^\|!?/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        if (!table) { html += '<div class="tablewrap"><table><tbody>'; table = true; }
        html += '<tr>' + cells.map((c) => (head ? '<th>' : '<td>') + Y.inline(c) + (head ? '</th>' : '</td>')).join('') + '</tr>';
        continue;
      }
      if (line.startsWith('- ')) {
        if (table) close();
        if (!list) { html += '<ul>'; list = true; }
        html += '<li>' + Y.inline(line.slice(2)) + '</li>';
        continue;
      }
      close();
      if (line.startsWith('## ')) html += '<h3>' + Y.inline(line.slice(3)) + '</h3>';
      else if (line.startsWith('! ')) html += '<div class="note tip"><b>טיפ</b>' + Y.inline(line.slice(2)) + '</div>';
      else if (line.startsWith('~ ')) html += '<div class="note dial"><b>מהבית ← ייִוואָ</b>' + Y.inline(line.slice(2)) + '</div>';
      else html += '<p>' + Y.inline(line) + '</p>';
    }
    close();
    return html;
  };
})();
