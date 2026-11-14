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
    const du = bareLast === 'ס' ? s + 'ט' : s + 'סט';
    const er = bareLast === 'ט' ? stem : s + 'ט';
    return { ikh: stem, du, er, mir: inf, ir: er, zey: inf };
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
