/* Optional sync between devices, with no server of our own:
   the progress is kept as a private gist in the learner's own GitHub account.
   The token lives only in this browser and is sent only to api.github.com. */
(function () {
  const Y = window.Y;
  const S = Y.store;
  const KEY = 'yivo.sync';
  const FILE = 'yiddish-kehalokhe-progress.json';
  const API = 'https://api.github.com';
  const Sync = (Y.sync = { status: 'off', error: '' });

  let cfg = { token: '', gistId: '', last: 0 };
  try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } };

  Sync.enabled = () => !!cfg.token;
  Sync.last = () => cfg.last;

  const call = async (path, opts) => {
    let res;
    try {
      res = await fetch(API + path, Object.assign({}, opts, {
        headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      }));
    } catch (e) {
      throw new Error('אין חיבור לאינטרנט.');
    }
    if (res.status === 401) throw new Error('הקוד (token) לא תקין או שפג תוקפו.');
    if (res.status === 403 || res.status === 404) throw new Error('לקוד אין הרשאת Gists, או שהקובץ נמחק.');
    if (!res.ok) throw new Error('GitHub החזיר שגיאה (' + res.status + ').');
    return res.json();
  };

  const findGist = async () => {
    const list = await call('/gists?per_page=100');
    const hit = list.find((g) => g.files && g.files[FILE]);
    return hit ? hit.id : '';
  };

  const readRemote = async () => {
    const g = await call('/gists/' + cfg.gistId);
    const f = g.files && g.files[FILE];
    if (!f) return null;
    let text = f.content;
    if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url)).text();
    try { return JSON.parse(text); } catch (e) { return null; }
  };

  const body = () => JSON.stringify({ files: { [FILE]: { content: JSON.stringify(S.syncable()) } } });

  /* Pull, merge with what is on this device, push the result. Returns true if local data changed. */
  let busy = null;
  Sync.now = () => {
    if (!cfg.token) return Promise.resolve(false);
    if (busy) return busy;
    Sync.status = 'working';
    busy = (async () => {
      try {
        if (!cfg.gistId) cfg.gistId = await findGist();
        let changed = false;
        if (cfg.gistId) {
          const remote = await readRemote();
          if (remote) changed = S.merge(remote);
          await call('/gists/' + cfg.gistId, { method: 'PATCH', body: body() });
        } else {
          const g = await call('/gists', {
            method: 'POST',
            body: JSON.stringify({ description: 'ייִדיש כּהלכה: התקדמות', public: false, files: { [FILE]: { content: JSON.stringify(S.syncable()) } } }),
          });
          cfg.gistId = g.id;
        }
        cfg.last = Date.now();
        saveCfg();
        dirty = false;
        Sync.status = 'ok';
        Sync.error = '';
        return changed;
      } catch (e) {
        Sync.status = 'error';
        Sync.error = e.message;
        throw e;
      } finally {
        busy = null;
      }
    })();
    return busy;
  };

  Sync.connect = async (token) => {
    cfg = { token: token.trim(), gistId: '', last: 0 };
    try {
      const changed = await Sync.now();
      saveCfg();
      return changed;
    } catch (e) {
      cfg = { token: '', gistId: '', last: 0 };
      saveCfg();
      Sync.status = 'off';
      throw e;
    }
  };
  Sync.disconnect = () => { cfg = { token: '', gistId: '', last: 0 }; saveCfg(); Sync.status = 'off'; };

  /* Push quietly a little after the last answer, and when the tab is hidden. */
  let dirty = false;
  let timer = null;
  S.onChange = () => {
    if (!cfg.token) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => { Sync.now().catch(() => {}); }, 25000);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty && cfg.token && cfg.gistId) {
      dirty = false;
      fetch(API + '/gists/' + cfg.gistId, {
        method: 'PATCH', keepalive: true, body: body(),
        headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  });

  /* Daily reminder without a server: a repeating calendar event the phone itself will announce. */
  Sync.reminderFile = (time) => {
    const [h, m] = time.split(':');
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const day = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    const url = location.href.split('#')[0] + '#/daily';
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yiddish-kehalokhe//HE', 'BEGIN:VEVENT',
      'UID:yiddish-daily-' + Date.now() + '@yiddish-kehalokhe',
      'DTSTAMP:' + day + 'T000000Z',
      'DTSTART:' + day + 'T' + pad(h) + pad(m) + '00',
      'DURATION:PT15M', 'RRULE:FREQ=DAILY',
      'SUMMARY:ייִדיש: הסשן של היום',
      'DESCRIPTION:רבע שעה של תרגול. ' + url,
      'URL:' + url,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:ייִדיש: הסשן של היום', 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
  };
})();
