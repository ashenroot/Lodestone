/**
 * Optional module: device import.
 *
 * Receives daily sleep and activity numbers from a phone or any other source
 * and writes them to the Device tab. The core works without this file.
 * Delete the file and the menu item and endpoint are gone.
 *
 * Payload contract: see payload.md in this folder.
 * Security: a web app deployed as "anyone with the link" that accepts a
 * secret token in the request body. It only writes. It never reads back.
 */

const DEVICE_RATE_LIMIT_ = 120; // posts per hour, approximate

/**
 * Pure. Checks a parsed payload and returns { ok, error, source, rows }.
 * rows: [{ date, fields: { sleep, bed, wake } }, { date, fields: { steps, exercise } }]
 * todayStr is 'YYYY-MM-DD'. Dates must be within 30 days back and 1 day ahead.
 */
function validateDevicePayload(p, todayStr) {
  if (!p || typeof p !== 'object') return { ok: false, error: 'bad payload' };

  function validDate(s) {
    if (typeof s !== 'string' || isNaN(parseISO_(s))) return false;
    const diff = daysBetween(todayStr, s);
    return diff >= -30 && diff <= 1;
  }
  function validTime(s) {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s));
    return m ? pad2_(+m[1]) + ':' + m[2] : null;
  }
  function inRange(v, lo, hi) {
    const n = Number(v);
    return v !== null && v !== '' && isFinite(n) && n >= lo && n <= hi ? n : null;
  }
  const has = function (k) { return p[k] !== undefined && p[k] !== null && p[k] !== ''; };

  const source = typeof p.source === 'string' && p.source.trim() ? p.source.trim().slice(0, 40) : 'Device';
  const rows = [];

  const sleepKeys = ['sleep_hours', 'bedtime', 'wake'].filter(has);
  if (sleepKeys.length) {
    if (!validDate(p.date)) return { ok: false, error: 'bad date' };
    const f = {};
    if (has('sleep_hours')) {
      const v = inRange(p.sleep_hours, 0, 24);
      if (v === null) return { ok: false, error: 'bad sleep_hours' };
      f.sleep = Math.round(v * 100) / 100;
    }
    if (has('bedtime')) {
      const t = validTime(p.bedtime);
      if (!t) return { ok: false, error: 'bad bedtime' };
      f.bed = t;
    }
    if (has('wake')) {
      const t = validTime(p.wake);
      if (!t) return { ok: false, error: 'bad wake' };
      f.wake = t;
    }
    rows.push({ date: p.date, fields: f });
  }

  const actKeys = ['steps', 'exercise_minutes'].filter(has);
  if (actKeys.length) {
    if (!validDate(p.activity_date)) return { ok: false, error: 'bad activity_date' };
    const f = {};
    if (has('steps')) {
      const v = inRange(p.steps, 0, 200000);
      if (v === null) return { ok: false, error: 'bad steps' };
      f.steps = Math.round(v);
    }
    if (has('exercise_minutes')) {
      const v = inRange(p.exercise_minutes, 0, 1440);
      if (v === null) return { ok: false, error: 'bad exercise_minutes' };
      f.exercise = Math.round(v);
    }
    rows.push({ date: p.activity_date, fields: f });
  }

  if (!rows.length) return { ok: false, error: 'nothing to write' };
  return { ok: true, source: source, rows: rows };
}

function safeEqual_(a, b) {
  a = String(a === undefined || a === null ? '' : a);
  b = String(b === undefined || b === null ? '' : b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function deviceJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Web app entry point. Receives the payload. */
function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty(PROP.DEVICE_TOKEN);
    let p;
    try { p = JSON.parse(e.postData.contents); } catch (err) { return deviceJson_({ ok: false, error: 'bad payload' }); }
    if (!token || !p || !safeEqual_(p.token, token)) return deviceJson_({ ok: false, error: 'unauthorized' });

    const cache = CacheService.getScriptCache();
    const count = Number(cache.get('device_rate') || 0);
    if (count >= DEVICE_RATE_LIMIT_) return deviceJson_({ ok: false, error: 'rate limit' });
    cache.put('device_rate', String(count + 1), 3600);

    const ss = getSS_();
    const tz = ss.getSpreadsheetTimeZone();
    const cfg = readConfig_(ss);
    if (!cfg.settings.deviceImportOn) return deviceJson_({ ok: false, error: 'import is off' });
    const fmt = function (d) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); };
    const today = dateKey(new Date(), cfg.settings.rolloverHours, fmt);

    const v = validateDevicePayload(p, today);
    if (!v.ok) return deviceJson_({ ok: false, error: v.error });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sh = ensureDeviceTab_(ss);
      v.rows.forEach(function (r) { upsertDeviceRow_(sh, tz, r.date, r.fields, v.source); });
    } finally {
      lock.releaseLock();
    }
    let refreshed = true;
    try { refreshAll(); } catch (err) { refreshed = false; }
    return deviceJson_({ ok: true, refreshed: refreshed });
  } catch (err) {
    return deviceJson_({ ok: false, error: 'server error' });
  }
}

/** A plain visit returns nothing. */
function doGet() {
  return ContentService.createTextOutput('');
}

function ensureDeviceTab_(ss) {
  let sh = ss.getSheetByName(TABS.DEVICE);
  if (sh) return sh;
  const H = DEVICE_HEADERS;
  const labels = [H.date, H.source, H.sleep, H.bed, H.wake, H.steps, H.exercise, H.received];
  sh = ss.insertSheet(TABS.DEVICE);
  sh.getRange(1, 1, 1, labels.length).setValues([labels]);
  styleHeader_(sh.getRange(1, 1, 1, labels.length));
  sh.setFrozenRows(1);
  // Text format for Date, Bedtime, Wake, Received so values like 01:06 stay text.
  [1, 4, 5, 8].forEach(function (c) { sh.getRange(2, c, 2000, 1).setNumberFormat('@'); });
  sh.setColumnWidths(1, labels.length, 120);
  return sh;
}

/** Writes only the fields given. Existing values for other fields are kept. */
function upsertDeviceRow_(sh, tz, date, fields, source) {
  const H = DEVICE_HEADERS;
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
  const col = function (k) { return header.indexOf(H[k]) + 1; };
  const last = sh.getLastRow();
  let row = 0;
  if (last >= 2) {
    const dates = sh.getRange(2, col('date'), last - 1, 1).getDisplayValues();
    for (let i = 0; i < dates.length; i++) {
      if (String(dates[i][0]).trim() === date) { row = i + 2; break; }
    }
  }
  if (!row) {
    row = last + 1;
    sh.getRange(row, col('date')).setNumberFormat('@').setValue(date);
  }
  Object.keys(fields).forEach(function (k) {
    const c = col(k);
    if (c < 1) return;
    const cellRange = sh.getRange(row, c);
    if (k === 'bed' || k === 'wake') cellRange.setNumberFormat('@');
    cellRange.setValue(fields[k]);
  });
  sh.getRange(row, col('source')).setValue(source);
  sh.getRange(row, col('received')).setNumberFormat('@').setValue(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'));
}

function newDeviceToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function addDeviceMenu_(menu) {
  menu.addSeparator()
    .addItem('Enable device import', 'enableDeviceImport')
    .addItem('Show device import details', 'showDeviceImportInfo')
    .addItem('Rotate device token', 'rotateDeviceToken');
}

function enableDeviceImport() {
  const ss = getSS_();
  const props = PropertiesService.getScriptProperties();
  ensureDeviceTab_(ss);
  if (!props.getProperty(PROP.DEVICE_TOKEN)) props.setProperty(PROP.DEVICE_TOKEN, newDeviceToken_());
  setSetting_(ss, 'deviceImport', 'On');

  // The device supplies sleep, so the check-in sleep field becomes optional.
  const form = openFormOrNull_(props.getProperty(PROP.FORM_CHECKIN_ID));
  if (form) {
    const item = formTitles_(form)[HEADERS.sleep];
    if (item) item.asTextItem().setRequired(false);
  }
  orderTabs_(ss);
  refreshAll();
  showDeviceImportInfo();
}

function showDeviceImportInfo() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(PROP.DEVICE_TOKEN);
  if (!token) {
    SpreadsheetApp.getUi().alert('Device import', 'Not enabled. Use Journal > Enable device import first.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (err) { url = ''; }
  const html = '<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5">'
    + '<p><b>1. Deploy the web app.</b> In the script editor: Deploy &gt; New deployment &gt; type Web app. '
    + 'Execute as: Me. Who has access: Anyone. Deploy, authorize, then copy the Web app URL. '
    + 'Anyone with that URL can send data, but nothing is accepted without the token below.</p>'
    + '<p>Web app URL, if already deployed:<br><code style="word-break:break-all">' + (url || 'not deployed yet') + '</code></p>'
    + '<p><b>2. Token.</b> Keep it private. Do not commit it to a repo.<br><code style="word-break:break-all">' + token + '</code></p>'
    + '<p><b>3. Test from a terminal.</b><br><code style="word-break:break-all">curl -L -X POST -H "Content-Type: application/json" '
    + '-d \'{"token":"TOKEN","date":"YYYY-MM-DD","sleep_hours":7.1,"bedtime":"23:30","wake":"06:40"}\' WEB_APP_URL</code></p>'
    + '<p>A reply of {"ok":true} means a row was written to the Device tab.</p></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(420), 'Device import');
}

function rotateDeviceToken() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert('Rotate device token', 'The old token stops working. Update it in your phone Shortcut afterwards.', ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperty(PROP.DEVICE_TOKEN, newDeviceToken_());
  showDeviceImportInfo();
}
