/**
 * Reads the raw tabs, runs the Logic, writes Daily and Pattern.
 * Raw tabs (Check-ins, Guilt, Device) are never modified here.
 */

function refreshAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another refresh is running. Try again in a moment.');
  try {
    const data = loadAll_();
    writeDaily_(data);
    writePattern_(data);
    return data;
  } finally {
    lock.releaseLock();
  }
}

function refreshFromMenu() {
  refreshAll();
  getSS_().toast('Daily and Pattern refreshed.', 'Journal', 4);
}

/** Runs on every form submission. */
function handleFormSubmit() {
  try { refreshAll(); } catch (err) { console.error(String(err)); }
}

// ---------- reading ----------

function readTable_(sheet, display) {
  if (!sheet || sheet.getLastRow() < 2) return { idx: {}, rows: [] };
  const range = sheet.getDataRange();
  const values = display ? range.getDisplayValues() : range.getValues();
  const idx = {};
  values[0].forEach(function (h, i) { idx[String(h).trim()] = i; });
  return { idx: idx, rows: values.slice(1) };
}

function cell_(t, row, header) {
  const i = t.idx[header];
  return i === undefined ? '' : row[i];
}

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

function readCheckins_(ss, rolloverHours, fmt) {
  const t = readTable_(ss.getSheetByName(TABS.CHECKINS), false);
  const out = [];
  t.rows.forEach(function (row) {
    const ts = cell_(t, row, HEADERS.timestamp);
    if (!(ts instanceof Date)) return;
    out.push({
      ts: ts,
      date: dateKey(ts, rolloverHours, fmt),
      mood: cell_(t, row, HEADERS.mood),
      sleep: cell_(t, row, HEADERS.sleep),
      med: str_(cell_(t, row, HEADERS.med)),
      energy: cell_(t, row, HEADERS.energy),
      speed: str_(cell_(t, row, HEADERS.speed)),
      appetite: str_(cell_(t, row, HEADERS.appetite)),
      subst: str_(cell_(t, row, HEADERS.substances)),
      signsText: str_(cell_(t, row, HEADERS.signs)),
      note: str_(cell_(t, row, HEADERS.note)),
      share: str_(cell_(t, row, HEADERS.share)) === VAL.YES
    });
  });
  return out;
}

function readGuilt_(ss, rolloverHours, fmt) {
  const t = readTable_(ss.getSheetByName(TABS.GUILT), false);
  const out = [];
  t.rows.forEach(function (row) {
    const ts = cell_(t, row, HEADERS.timestamp);
    if (!(ts instanceof Date)) return;
    out.push({
      ts: ts,
      date: dateKey(ts, rolloverHours, fmt),
      what: str_(cell_(t, row, HEADERS.g_what)),
      fact: str_(cell_(t, row, HEADERS.g_fact)),
      kind: str_(cell_(t, row, HEADERS.g_kind)),
      intensity: cell_(t, row, HEADERS.g_intensity),
      event: cell_(t, row, HEADERS.g_event),
      replay: str_(cell_(t, row, HEADERS.g_replay)),
      debt: str_(cell_(t, row, HEADERS.g_debt)),
      urge: str_(cell_(t, row, HEADERS.g_urge))
    });
  });
  return out;
}

function readDevice_(ss) {
  const sh = ss.getSheetByName(TABS.DEVICE);
  if (!sh) return [];
  const t = readTable_(sh, true);
  const H = DEVICE_HEADERS;
  const out = [];
  t.rows.forEach(function (row) {
    const date = str_(cell_(t, row, H.date));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    out.push({
      date: date,
      sleep: str_(cell_(t, row, H.sleep)),
      bed: str_(cell_(t, row, H.bed)),
      wake: str_(cell_(t, row, H.wake)),
      steps: str_(cell_(t, row, H.steps)),
      exercise: str_(cell_(t, row, H.exercise))
    });
  });
  return out;
}

function capTier_(v) {
  const s = str_(v).toLowerCase();
  for (let i = 0; i < TIERS.length; i++) { if (TIERS[i].toLowerCase() === s) return TIERS[i]; }
  return '';
}

function readConfig_(ss) {
  const out = { settings: normalizeSettings({}), signs: [], steps: {} };
  const sh = ss.getSheetByName(TABS.CONFIG);
  if (!sh) return out;
  const L = CFG_LAYOUT;
  sh.getRange(L.signsFirstRow, 1, L.signsRows, 5).getDisplayValues().forEach(function (r) {
    const tier = capTier_(r[0]);
    const sign = str_(r[1]);
    const detector = str_(r[2]);
    if (tier && sign && detector) out.signs.push({ tier: tier, sign: sign, detector: detector, detail: str_(r[3]) });
  });
  sh.getRange(L.stepsFirstRow, 1, 3, 2).getDisplayValues().forEach(function (r) { out.steps[str_(r[0])] = str_(r[1]); });
  const last = Math.max(sh.getLastRow(), L.settingsFirstRow);
  const raw = {};
  sh.getRange(L.settingsFirstRow, 2, last - L.settingsFirstRow + 1, 2).getDisplayValues().forEach(function (r) {
    const label = str_(r[0]);
    SETTINGS.forEach(function (s) { if (s.label === label) raw[s.key] = str_(r[1]); });
  });
  out.settings = normalizeSettings(raw);
  return out;
}

function loadAll_() {
  const ss = getSS_();
  const tz = ss.getSpreadsheetTimeZone();
  const cfg = readConfig_(ss);
  const fmt = function (d) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); };
  const rh = cfg.settings.rolloverHours;
  const checkins = readCheckins_(ss, rh, fmt);
  const guilt = readGuilt_(ss, rh, fmt);
  const device = readDevice_(ss);
  const today = dateKey(new Date(), rh, fmt);
  const daily = buildDaily({ checkins: checkins, guilt: guilt, device: device, signs: cfg.signs }, cfg.settings, today);
  return { ss: ss, tz: tz, cfg: cfg, checkins: checkins, guilt: guilt, device: device, today: today, daily: daily };
}

// ---------- Daily tab ----------

function dailyCols_() {
  const dash = function (v) { return v === null || v === undefined ? '' : v; };
  return [
    { label: 'Date', get: function (r) { return r.date; }, text: true },
    { label: 'Entries', get: function (r) { return r.entries || ''; } },
    { label: 'Mood', get: function (r) { return dash(r.mood); } },
    { label: 'Sleep, self-report', get: function (r) { return dash(r.sleepSelf); } },
    { label: 'Medication taken', get: function (r) { return r.med; } },
    { label: 'Energy', get: function (r) { return dash(r.energy); } },
    { label: 'Thought speed', get: function (r) { return r.speed; } },
    { label: 'Appetite', get: function (r) { return r.appetite; } },
    { label: 'Caffeine and alcohol', get: function (r) { return r.subst; } },
    { label: 'Sleep, device', get: function (r) { return dash(r.sleepDev); } },
    { label: 'Bedtime', get: function (r) { return r.bedText; }, text: true },
    { label: 'Wake', get: function (r) { return r.wakeText; }, text: true },
    { label: 'Steps', get: function (r) { return dash(r.steps); } },
    { label: 'Exercise, minutes', get: function (r) { return dash(r.exercise); } },
    { label: 'Mood, 14-day baseline', get: function (r) { return round_(r.base.mood, 2); } },
    { label: 'Sleep, 14-day baseline', get: function (r) { return round_(r.base.sleep, 2); } },
    { label: 'Energy, 14-day baseline', get: function (r) { return round_(r.base.energy, 2); } },
    { label: 'Steps, 14-day baseline', get: function (r) { return round_(r.base.steps, 0); } },
    { label: 'Exercise, 14-day baseline', get: function (r) { return round_(r.base.exercise, 1); } },
    { label: 'Bedtime, 14-day baseline (clock hours)', get: function (r) { return round_(r.base.bed, 2); } },
    { label: 'Mood, 90-day median', get: function (r) { return round_(r.ref.mood, 2); } },
    { label: 'Sleep, 90-day median', get: function (r) { return round_(r.ref.sleep, 2); } },
    { label: 'Energy, 90-day median', get: function (r) { return round_(r.ref.energy, 2); } },
    { label: 'Steps, 90-day median', get: function (r) { return round_(r.ref.steps, 0); } },
    { label: 'Exercise, 90-day median', get: function (r) { return round_(r.ref.exercise, 1); } },
    { label: 'Early signs', get: function (r) { return r.tierCounts.Early; } },
    { label: 'Middle signs', get: function (r) { return r.tierCounts.Middle; } },
    { label: 'Late signs', get: function (r) { return r.tierCounts.Late; } },
    { label: 'Signs active', get: function (r) { return r.signsText; } }
  ];
}

function round_(v, places) {
  if (v === null || v === undefined) return '';
  const f = Math.pow(10, places);
  return Math.round(v * f) / f;
}

function writeDaily_(data) {
  const sh = getOrCreateSheet_(data.ss, TABS.DAILY);
  sh.clear();
  const cols = dailyCols_();
  sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c.label; })]);
  styleHeader_(sh.getRange(1, 1, 1, cols.length));
  sh.setFrozenRows(1);
  const rows = data.daily.rows;
  if (rows.length) {
    cols.forEach(function (c, i) { if (c.text) sh.getRange(2, i + 1, rows.length, 1).setNumberFormat('@'); });
    sh.getRange(2, 1, rows.length, cols.length).setValues(rows.map(function (r) {
      return cols.map(function (c) { return c.get(r); });
    }));
  }
  sh.setColumnWidth(1, 90);
  sh.setColumnWidths(2, cols.length - 2, 110);
  sh.setColumnWidth(cols.length, 420);
}

// ---------- Pattern tab ----------

const CHART_COLORS_ = {
  entry: '#2F5D8A',
  watch: '#A44B12',
  base: '#565F68',
  ref: '#848E98',
  early: '#6F93B8',
  middle: '#4A7099',
  late: '#1F3F63'
};

function chartSpecs_(rows) {
  const C = CHART_COLORS_;
  const entry = { color: C.entry, lineWidth: 2, pointSize: 3 };
  const watch = { color: C.watch, lineWidth: 2, pointSize: 3 };
  const base = { color: C.base, lineWidth: 1.5, lineDashStyle: [5, 4], pointSize: 0 };
  const ref = { color: C.ref, lineWidth: 1, pointSize: 0 };
  const v = function (x) { return x === null || x === undefined ? '' : x; };
  const clockTicks = [22, 24, 26, 28, 30, 32].map(function (h) {
    return { v: h, f: pad2_(h % 24) + ':00' };
  });
  return [
    {
      title: 'Mood, 1 to 5', type: 'line', headers: ['Date', 'Entry', '14-day baseline', '90-day median'],
      pick: function (r) { return [v(r.mood), v(r.base.mood), v(r.ref.mood)]; },
      series: [entry, base, ref], vMin: 1, vMax: 5
    },
    {
      title: 'Exercise, minutes (device)', type: 'line', headers: ['Date', 'Entry', '14-day baseline', '90-day median'],
      pick: function (r) { return [v(r.exercise), v(r.base.exercise), v(r.ref.exercise)]; },
      series: [entry, base, ref], vMin: 0
    },
    {
      title: 'Sleep, hours', type: 'line', headers: ['Date', 'Self-report', 'Device', '14-day baseline', '90-day median'],
      pick: function (r) { return [v(r.sleepSelf), v(r.sleepDev), v(r.base.sleep), v(r.ref.sleep)]; },
      series: [entry, watch, base, ref], vMin: 3, vMax: 11
    },
    {
      title: 'Energy, 1 to 5', type: 'line', headers: ['Date', 'Entry', '14-day baseline', '90-day median'],
      pick: function (r) { return [v(r.energy), v(r.base.energy), v(r.ref.energy)]; },
      series: [entry, base, ref], vMin: 1, vMax: 5
    },
    {
      title: 'Steps (device)', type: 'line', headers: ['Date', 'Entry', '14-day baseline', '90-day median'],
      pick: function (r) { return [v(r.steps), v(r.base.steps), v(r.ref.steps)]; },
      series: [entry, base, ref], vMin: 0
    },
    {
      title: 'Bedtime and wake time (device)', type: 'line', headers: ['Date', 'Bedtime', 'Wake'],
      pick: function (r) { return [v(r.bedClock), v(r.wakeClock)]; },
      series: [entry, entry], vMin: 21, vMax: 33, ticks: clockTicks
    },
    {
      title: 'Signs logged per day, by tier', type: 'columns', headers: ['Date', 'Early', 'Middle', 'Late'],
      pick: function (r) { return [r.tierCounts.Early, r.tierCounts.Middle, r.tierCounts.Late]; },
      series: [{ color: C.early }, { color: C.middle }, { color: C.late }], vMin: 0
    }
  ];
}

function writePattern_(data) {
  const ss = data.ss;
  const S = data.cfg.settings;
  const sh = getOrCreateSheet_(ss, TABS.PATTERN);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clear();
  sh.setHiddenGridlines(true);

  const rowsAll = data.daily.rows;
  const rows = rowsAll.slice(-Math.max(7, Math.round(S.patternDays)));

  sh.getRange('A1').setValue('Pattern').setFontSize(18).setFontWeight('bold');
  sh.getRange('A2').setValue('Last ' + rows.length + ' days. Days with no entry are gaps. Solid: entry. Dashed: 14-day baseline. Thin grey: 90-day median. Baselines start after 14 days of history.')
    .setFontColor('#565F68');
  sh.getRange('A3').setValue('Refreshed ' + Utilities.formatDate(new Date(), data.tz, 'MMM d, HH:mm')).setFontColor('#565F68');

  sh.setColumnWidths(1, 9, 100);
  sh.setColumnWidth(10, 30);
  sh.setColumnWidth(11, 90);
  sh.setColumnWidths(12, 3, 70);
  sh.setColumnWidth(15, 150);

  if (rows.length) writeCharts_(ss, sh, rows);
  writePatternPanels_(sh, data, rowsAll);
}

function writeCharts_(ss, sh, rows) {
  const store = getOrCreateSheet_(ss, TABS.CHART);
  store.clear();
  const specs = chartSpecs_(rows);
  let col = 1;
  let anchorRow = 5;
  specs.forEach(function (spec) {
    const width = spec.headers.length;
    const table = [spec.headers].concat(rows.map(function (r) { return [labelDate(r.date)].concat(spec.pick(r)); }));
    const rng = store.getRange(1, col, table.length, width);
    rng.setValues(table);

    const builder = sh.newChart()
      .setChartType(spec.type === 'columns' ? Charts.ChartType.COLUMN : Charts.ChartType.LINE)
      .addRange(rng)
      .setNumHeaders(1)
      .setPosition(anchorRow, 1, 0, 0)
      .setOption('title', spec.title)
      .setOption('titleTextStyle', { fontSize: 14, bold: true, color: '#1B1F23' })
      .setOption('width', 780)
      .setOption('height', 240)
      .setOption('backgroundColor', '#FFFFFF')
      .setOption('legend', { position: 'bottom' })
      .setOption('chartArea', { left: 56, right: 16, top: 40, bottom: 64 })
      .setOption('hAxis', { showTextEvery: 7, slantedText: false })
      .setOption('interpolateNulls', false)
      .setOption('series', spec.series);
    const vAxis = {};
    if (spec.vMin !== undefined) vAxis.viewWindow = { min: spec.vMin };
    if (spec.vMax !== undefined) vAxis.viewWindow = { min: spec.vMin, max: spec.vMax };
    if (spec.ticks) vAxis.ticks = spec.ticks;
    builder.setOption('vAxis', vAxis);
    if (spec.type === 'columns') builder.setOption('isStacked', true);
    sh.insertChart(builder.build());

    col += width + 1;
    anchorRow += 13;
  });
  store.hideSheet();
}

function writePatternPanels_(sh, data, rowsAll) {
  const S = data.cfg.settings;
  const c0 = 11; // column K

  // Guilt spikes
  sh.getRange(5, c0).setValue('Guilt spikes').setFontWeight('bold').setFontSize(12);
  sh.getRange(6, c0).setValue('Gap is feeling minus event, both 0 to 10.').setFontColor('#565F68');
  sh.getRange(7, c0, 1, 5).setValues([['Date', 'Feeling', 'Event', 'Gap', 'Fact named']]);
  styleHeader_(sh.getRange(7, c0, 1, 5));
  const list = guiltList(data.guilt, 8);
  if (list.length) {
    sh.getRange(8, c0, list.length, 5).setValues(list.map(function (g) {
      return [labelDate(g.date), g.feeling === null ? '' : g.feeling, g.event === null ? '' : g.event, g.gap === null ? '' : g.gap, g.fact];
    }));
  }
  styleTable_(sh.getRange(7, c0, Math.max(1, list.length) + 1, 5));

  // Stacking
  const stack = stackingSummary(rowsAll, S.stackDays);
  sh.getRange(18, c0).setValue('Last ' + stack.days + ' days').setFontWeight('bold').setFontSize(12);
  sh.getRange(19, c0).setValue('Stacking window is set in Config.').setFontColor('#565F68');
  const stackRows = [
    ['Days with an early sign', stack.Early],
    ['Days with a middle sign', stack.Middle],
    ['Days with a late sign', stack.Late],
    ['Days with signs in two or more tiers', stack.multi]
  ];
  sh.getRange(20, c0, 4, 1).setValues(stackRows.map(function (r) { return [r[0]]; }));
  sh.getRange(20, c0 + 4, 4, 1).setValues(stackRows.map(function (r) { return [r[1]]; }));
  styleTable_(sh.getRange(20, c0, 4, 5));

  // Coverage
  const shown = rowsAll.slice(-Math.max(7, Math.round(S.patternDays)));
  const filled = shown.filter(function (r) { return r.entries > 0; }).length;
  sh.getRange(26, c0).setValue('Coverage').setFontWeight('bold').setFontSize(12);
  sh.getRange(27, c0).setValue(filled + ' of ' + shown.length + ' days have an entry.');
}
