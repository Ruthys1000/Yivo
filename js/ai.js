/* Optional Claude integration. The key is stored only in this browser and sent only to api.anthropic.com. */
(function () {
  const Y = window.Y;
  const AI = (Y.ai = {});

  AI.MODELS = [
    ['claude-opus-5-5', 'Claude Opus 5.5 (מומלץ)'],
    ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (זול יותר)'],
    ['claude-haiku-5-5', 'Claude Haiku 5.5 (הזול ביותר)'],
    ['claude-fable-5-2', 'Claude Fable 5.2 (החזק ביותר)'],
  ];

  AI.enabled = () => !!Y.store.settings().apiKey;

  const SYSTEM = `אתה מורה ליידיש תקנית לפי כללי ייִוואָ (YIVO): הכתיב של "תּקנות פֿון ייִדישן אויסלייג" והדקדוק התקני כפי שהוא מתואר אצל אוריאל ווײַנרײַך, יודל מאַרק ומרדכי שעכטער.

התלמידה דוברת יידיש חסידית מילדות ודוברת עברית. היא מדברת שוטף ואינטואיטיבית, אבל לא למדה את הכללים, והיא לומדת עכשיו בקורס מתקדם של ייִוואָ. הפערים האופייניים שלה מול התקן: מין דקדוקי (דער/די/דאָס), יחסות (דעם/דער אחרי מילות יחס), סיומות התואר, הכתיב התקני (ניקוד אַ/אָ, פּ/פֿ, ײַ, בלי ה שותקת, ־יק, ־לעך), פועל העזר בעבר, סדר המילים (הפועל במקום השני), "צי" בשאלה עקיפה, ומילים שאולות מעברית או מאנגלית.

כללים לתשובותיך:
- ההסברים בעברית, קצרים וענייניים.
- כל יידיש שאתה כותב היא בכתיב ייִוואָ מלא, כולל כל הסימנים: אַ אָ בֿ וּ יִ ײַ כּ פּ פֿ שׂ תּ.
- היידיש שלה מהבית היא ניב לגיטימי ולא "שגיאה". כשמשהו שונה מהתקן, אמור "בתקן כותבים/אומרים..." ולא "זה לא נכון".
- כשאתה מתקן, נקוב בכלל הדקדוקי שמאחורי התיקון.
- אם אינך בטוח במין של מילה או בצורה מסוימת, אמור זאת במפורש במקום לנחש.`;

  const friendly = (status, body) => {
    const msg = (body && body.error && body.error.message) || '';
    if (status === 401) return 'מפתח ה-API לא תקין. בדקי אותו בהגדרות.';
    if (status === 403) return 'למפתח אין הרשאה למודל הזה. נסי מודל אחר בהגדרות.';
    if (status === 404) return 'המודל שנבחר לא זמין לחשבון הזה. בחרי מודל אחר בהגדרות.';
    if (status === 429) return 'יותר מדי בקשות, או שנגמרה היתרה בחשבון. נסי שוב בעוד רגע.';
    if (status === 529 || status >= 500) return 'השירות של Anthropic עמוס כרגע. נסי שוב בעוד רגע.';
    return 'הבקשה נכשלה (' + status + ')' + (msg ? ': ' + msg : '');
  };

  /* Streamed Messages API call. Returns the full text. onText(fullTextSoFar) is optional. */
  AI.call = async ({ messages, maxTokens, onText, extraSystem }) => {
    const st = Y.store.settings();
    if (!st.apiKey) throw new Error('לא הוגדר מפתח API.');
    const model = st.model || 'claude-opus-5-5';
    const useFallback = model !== 'claude-haiku-5-5';

    const attempt = async (withExtras) => {
      const headers = {
        'content-type': 'application/json',
        'x-api-key': st.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      };
      const body = {
        model,
        max_tokens: maxTokens || 4000,
        system: SYSTEM + (extraSystem ? '\n\n' + extraSystem : ''),
        messages,
        stream: true,
      };
      if (withExtras) {
        body.output_config = { effort: 'medium' };
        if (useFallback) {
          // if a safety classifier declines a request, let the API retry it on a fallback model
          headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
          body.fallbacks = 'default';
        }
      }
      let res;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (e) {
        throw new Error('אין חיבור לשירות. בדקי את החיבור לאינטרנט.');
      }
      if (!res.ok) {
        let parsed = null;
        try { parsed = await res.json(); } catch (e) { /* not json */ }
        const err = new Error(friendly(res.status, parsed));
        err.status = res.status;
        throw err;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let text = '';
      let stop = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          let ev;
          try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
            text += ev.delta.text;
            if (onText) onText(text);
          } else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) {
            stop = ev.delta.stop_reason;
          } else if (ev.type === 'error') {
            throw new Error('השירות החזיר שגיאה באמצע התשובה. נסי שוב.');
          }
        }
      }
      if (stop === 'refusal') throw new Error('המודל סירב לענות על הבקשה הזאת.');
      if (stop === 'max_tokens') text += '\n\n(התשובה נקטעה כי הגיעה לאורך המרבי.)';
      return text;
    };

    try {
      return await attempt(true);
    } catch (e) {
      // older accounts or models may reject the optional parameters; retry once without them
      if (e.status === 400) return attempt(false);
      throw e;
    }
  };

  const parseJson = (text) => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('התשובה לא התקבלה בפורמט הצפוי. נסי שוב.');
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      throw new Error('התשובה לא התקבלה בפורמט הצפוי. נסי שוב.');
    }
  };

  /* Correct a piece of the student's own writing. */
  AI.check = async (text) => {
    const prompt = `הטקסט הבא נכתב ביידיש על ידי התלמידה. תקן אותו לפי התקן של ייִוואָ.

החזר אובייקט JSON בלבד, בלי טקסט לפניו או אחריו, במבנה הזה:
{
  "corrected": "הטקסט המלא המתוקן, בכתיב ייִוואָ",
  "errors": [
    {
      "orig": "המילה או הצירוף כפי שנכתבו",
      "fix": "הצורה התקנית",
      "topic": "אחד מ: gender, case, adjective, spelling, verb, syntax, vocab, other",
      "explain": "הסבר קצר בעברית: איזה כלל חל כאן"
    }
  ],
  "praise": "משפט אחד בעברית על מה שהיה טוב בטקסט"
}

אם יש כמה מקרים של אותו סוג בכתיב (למשל ניקוד חסר לאורך כל הטקסט), אחד אותם לפריט אחד עם דוגמאות, ואל תפרט כל מילה. סדר את הפריטים מהחשוב לפחות חשוב. אם אין מה לתקן, החזר רשימה ריקה.

הטקסט:
"""
${text}
"""`;
    const out = await AI.call({ messages: [{ role: 'user', content: prompt }], maxTokens: 6000 });
    const obj = parseJson(out);
    if (typeof obj.corrected !== 'string' || !Array.isArray(obj.errors)) throw new Error('התשובה לא התקבלה בפורמט הצפוי. נסי שוב.');
    return obj;
  };

  /* Generate extra exercises for a unit, in the same multiple-choice format. */
  AI.exercises = async (unit) => {
    const samples = unit.ex.filter((e) => e[0] === 'm').slice(0, 4)
      .map((e) => JSON.stringify({ q: e[1].split(' // ')[0], opts: e[2].split('|'), ex: e[3] }));
    const prompt = `כתוב 8 תרגילי השלמה חדשים ליחידה "${unit.title}" (${unit.sub}).

זה חומר היחידה:
"""
${unit.text}
"""

דוגמאות לתרגילים קיימים (אל תחזור עליהם):
${samples.join('\n')}

החזר אובייקט JSON בלבד, בלי טקסט לפניו או אחריו:
{"items":[{"q":"משפט ביידיש עם ___ במקום החסר","he":"רמז קצר בעברית, או מחרוזת ריקה","opts":["התשובה הנכונה","מסיח","מסיח"],"ex":"הסבר קצר בעברית"}]}

דרישות: התשובה הנכונה היא תמיד הראשונה ב-opts. בכל תרגיל רק תשובה אחת נכונה לפי התקן, והמסיחים הם הטעויות האופייניות לדוברת יידיש חסידית. המשפטים טבעיים, מגוונים, ובכתיב ייִוואָ מלא. השתמש רק במילים שאתה בטוח במין הדקדוקי שלהן.`;
    const out = await AI.call({ messages: [{ role: 'user', content: prompt }], maxTokens: 5000 });
    const obj = parseJson(out);
    if (!Array.isArray(obj.items)) throw new Error('התשובה לא התקבלה בפורמט הצפוי. נסי שוב.');
    return obj.items
      .filter((it) => it && typeof it.q === 'string' && it.q.includes('___') && Array.isArray(it.opts) && it.opts.length >= 2)
      .map((it, i) => ({
        t: 'm', q: it.q, he: it.he || '', opts: it.opts.map(String), a: String(it.opts[0]), ex: it.ex || '',
        unit: unit.id, key: 'ai:' + unit.id + ':' + Date.now() + ':' + i,
      }));
  };

  AI.chat = (history, onText) =>
    AI.call({
      messages: history,
      maxTokens: 4000,
      onText,
      extraSystem: 'זו שיחה חופשית עם התלמידה. ענה על שאלות דקדוק, כתיב ואוצר מילים, הסבר מילים שהיא שואלת עליהן (כולל מין, רבים ומשפט לדוגמה), ואם היא כותבת ביידיש, ענה ביידיש תקנית והוסף בסוף, בעברית, הערה קצרה על מה שכדאי לתקן בכתיבה שלה. אל תשתמש בכותרות Markdown או בטבלאות; כתוב בפסקאות קצרות.',
    });
})();
