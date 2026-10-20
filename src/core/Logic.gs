/**
 * Pure logic. No Apps Script services are used here, so this file runs
 * under Node for tests (see test/logic.test.js). Dates are 'YYYY-MM-DD'
 * strings. The sheet layer converts timestamps to date strings before
 * calling anything in this file.
 */

const MONTHS_ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2_(n) { return n < 10 ? '0' + n : String(n); }

function parseISO_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function fmtISO_(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}

function addDays(s, n) { return fmtISO_(parseISO_(s) + n * 86400000); }

function daysBetween(a, b) { return Math.round((parseISO_(b) - parseISO_(a)) / 86400000); }

function labelDate(s) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(s));
  return m ? MONTHS_[+m[1] - 1] + ' ' + (+m[2]) : String(s);
}

/**
 * Date a timestamp counts toward. Entries before the rollover hour count
 * toward the previous day. fmt(Date) -> 'YYYY-MM-DD' is supplied by the caller
 * so the time zone is handled outside this file.
 */
function dateKey(ts, rolloverHours, fmt) {
  return fmt(new Date(ts.getTime() - rolloverHours * 3600000));
}

function num_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/** 'HH:MM' -> clock hours, with after-midnight times as 24+ so late bedtimes sort after early ones. */
function clockHours(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm === null || hhmm === undefined ? '' : hhmm).trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  let v = h + mi / 60;
  if (h < 12) v += 24;
  return v;
}

function parseHour_(s) {
  const m = /^(\d{1,2})(?::(\d{2}))?/.exec(String(s).trim());
  if (!m) return 4;
  const v = +m[1] + (m[2] ? +m[2] / 60 : 0);
  return v >= 0 && v <= 12 ? v : 4;
}

/** raw: { key: stringValue } as read from the Config tab. Returns typed settings with defaults. */
function normalizeSettings(raw) {
  const out = {};
  SETTINGS.forEach(function (s) {
    let v = raw && raw[s.key] !== undefined && raw[s.key] !== '' ? raw[s.key] : s.value;
    if (typeof s.value === 'number') {
      v = Number(v);
      if (!isFinite(v) || v <= 0) v = s.value;
    }
    out[s.key] = v;
  });
  out.rolloverHours = parseHour_(out.rollover);
  out.keywordScanOn = String(out.keywordScan).toLowerCase() === 'on';
  out.deviceImportOn = String(out.deviceImport).toLowerCase() === 'on';
  return out;
}

/** Mean of the `win` days before index i. Needs `win` days of history and at least half of them filled. */
function rollingMean(arr, i, win) {
  if (i < win) return null;
  let sum = 0, count = 0;
  for (let k = i - win; k < i; k++) {
    if (arr[k] !== null && arr[k] !== undefined) { sum += arr[k]; count++; }
  }
  return count >= Math.ceil(win / 2) ? sum / count : null;
}

/** Median of up to `win` days before index i. Needs 30 days of history and at least 15 values. */
function rollingMedian(arr, i, win) {
  const minHistory = 30;
  if (i < minHistory) return null;
  const vals = [];
  for (let k = Math.max(0, i - win); k < i; k++) {
    if (arr[k] !== null && arr[k] !== undefined) vals.push(arr[k]);
  }
  if (vals.length < Math.ceil(minHistory / 2)) return null;
  vals.sort(function (a, b) { return a - b; });
  const m = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
}

function escapeRegex_(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Whole-word, case-insensitive match of any comma-separated keyword. */
function keywordHit(detail, blob) {
  const words = String(detail || '').split(',').map(function (w) { return w.trim(); }).filter(Boolean);
  for (let k = 0; k < words.length; k++) {
    const re = new RegExp('(^|[^a-z0-9])' + escapeRegex_(words[k]) + '($|[^a-z0-9])', 'i');
    if (re.test(blob)) return true;
  }
  return false;
}

/**
 * "Field: value1, value2" matches when the day's answer to that field equals
 * any listed value (case-insensitive). The field name is a form question title.
 */
function answerHit(detail, fields) {
  const text = String(detail || '');
  const cut = text.indexOf(':');
  if (cut < 0) return false;
  const field = text.slice(0, cut).trim().toLowerCase();
  const wanted = text.slice(cut + 1).split(',').map(function (v) { return v.trim().toLowerCase(); }).filter(Boolean);
  const keys = Object.keys(fields || {});
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === field && wanted.indexOf(String(fields[keys[i]]).toLowerCase()) !== -1) return true;
  }
  return false;
}

/** True when any listed kind (comma separated, case-insensitive) matches a spike kind logged that day. */
function kindHit(detail, kinds) {
  const wanted = String(detail || '').split(',').map(function (v) { return v.trim().toLowerCase(); }).filter(Boolean);
  return (kinds || []).some(function (k) { return wanted.indexOf(String(k).toLowerCase()) !== -1; });
}

/**
 * input: {
 *   checkins: [{ts:Date, date, mood, sleep, med, energy, answers:{<title>: value}, subst, signsText, note, share}],
 *   spikes:   [{ts:Date, date, what, kind, intensity, event, fact, frame, replay, debt, hopeless, urge}],
 *   device:   [{date, sleep, bed, wake, steps, exercise}],
 *   signs:    [{tier, sign, detector, detail}]
 * }
 * S: normalized settings. todayStr: last day to include (blank days up to today).
 * Returns { rows, start, end }. One row per calendar date. Days with no
 * entry stay blank.
 */
function buildDaily(input, S, todayStr) {
  const checkins = (input.checkins || []).slice().sort(function (a, b) { return a.ts - b.ts; });
  const spikes = input.spikes || [];
  const device = input.device || [];
  const signRows = input.signs || [];

  const byDate = {};
  function slot(d) { return byDate[d] || (byDate[d] = { entries: [], spikes: [], device: {} }); }
  checkins.forEach(function (c) { slot(c.date).entries.push(c); });
  spikes.forEach(function (g) { slot(g.date).spikes.push(g); });
  device.forEach(function (r) {
    const s = slot(r.date);
    ['sleep', 'bed', 'wake', 'steps', 'exercise'].forEach(function (k) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') s.device[k] = r[k];
    });
  });

  const dates = Object.keys(byDate).filter(function (d) { return !isNaN(parseISO_(d)); }).sort();
  if (!dates.length) return { rows: [], start: null, end: null };
  const start = dates[0];
  let end = dates[dates.length - 1];
  if (todayStr && todayStr > end) end = todayStr;
  const n = Math.min(daysBetween(start, end) + 1, 3660);

  const ser = { mood: [], sleep: [], energy: [], steps: [], exercise: [], bed: [] };
  const rows = [];

  for (let i = 0; i < n; i++) {
    const d = addDays(start, i);
    const s = byDate[d] || { entries: [], spikes: [], device: {} };
    const r = {
      date: d, entries: s.entries.length,
      mood: null, sleepSelf: null, med: '', energy: null, subst: '', fields: {}
    };
    const texts = [];
    let checklistText = '';
    s.entries.forEach(function (e) {
      const mood = num_(e.mood); if (mood !== null) r.mood = mood;
      const sl = num_(e.sleep); if (sl !== null) r.sleepSelf = sl;
      if (e.med) r.med = e.med;
      const en = num_(e.energy); if (en !== null) r.energy = en;
      Object.keys(e.answers || {}).forEach(function (title) {
        if (e.answers[title]) r.fields[title] = e.answers[title];
      });
      if (e.subst) r.subst = e.subst;
      if (e.signsText) checklistText += ' | ' + e.signsText;
      if (e.note) texts.push(e.note);
    });
    s.spikes.forEach(function (g) { if (g.what) texts.push(g.what); });

    const dv = s.device;
    r.sleepDev = num_(dv.sleep);
    r.bedText = dv.bed ? String(dv.bed) : '';
    r.wakeText = dv.wake ? String(dv.wake) : '';
    r.bedClock = clockHours(r.bedText);
    r.wakeClock = clockHours(r.wakeText);
    r.steps = num_(dv.steps);
    r.exercise = num_(dv.exercise);
    r.sleepPrimary = r.sleepSelf !== null ? r.sleepSelf : r.sleepDev;

    r._checklistText = checklistText;
    r._blob = texts.join(' \n ').toLowerCase();
    r.speed = r.fields[HEADERS.speed] || '';
    r.appetite = r.fields[HEADERS.appetite] || '';
    r._s = {
      kinds: s.spikes.map(function (g) { return g.kind; }),
      replay: s.spikes.some(function (g) { return g.replay === VAL.YES; }),
      verdict: s.spikes.some(function (g) { return g.frame === VAL.FRAME_VERDICT; }),
      debt: s.spikes.some(function (g) { return g.debt === VAL.YES; }),
      hopeless: s.spikes.some(function (g) { return g.hopeless === VAL.YES; }),
      urge: s.spikes.some(function (g) { return g.urge === VAL.YES; })
    };

    ser.mood.push(r.mood);
    ser.sleep.push(r.sleepPrimary);
    ser.energy.push(r.energy);
    ser.steps.push(r.steps);
    ser.exercise.push(r.exercise);
    ser.bed.push(r.bedClock);
    rows.push(r);
  }

  // Baselines: each day against the days before it.
  const keys = ['mood', 'sleep', 'energy', 'steps', 'exercise', 'bed'];
  rows.forEach(function (r, i) {
    r.base = {};
    r.ref = {};
    keys.forEach(function (k) {
      r.base[k] = rollingMean(ser[k], i, S.baselineDays);
      r.ref[k] = k === 'bed' ? null : rollingMedian(ser[k], i, S.longDays);
    });
  });

  function consecutive(i, count, test) {
    const c = Math.max(1, Math.round(count));
    if (i - c + 1 < 0) return false;
    for (let k = 0; k < c; k++) { if (!test(i - k)) return false; }
    return true;
  }
  const EPS = 1e-9;

  rows.forEach(function (r, i) {
    const auto = {};
    auto.sleep = consecutive(i, S.sleepDriftNights, function (j) {
      const v = ser.sleep[j], b = rows[j].base.sleep;
      return v !== null && b !== null && v <= b - S.sleepDriftHours + EPS;
    });
    auto.moodUp = consecutive(i, S.moodShiftDays, function (j) {
      const v = ser.mood[j], b = rows[j].base.mood;
      return v !== null && b !== null && v - b >= S.moodShift - EPS;
    });
    auto.moodDown = consecutive(i, S.moodShiftDays, function (j) {
      const v = ser.mood[j], b = rows[j].base.mood;
      return v !== null && b !== null && b - v >= S.moodShift - EPS;
    });
    auto.oversleep = consecutive(i, S.sleepDriftNights, function (j) {
      const v = ser.sleep[j], b = rows[j].base.sleep;
      return v !== null && b !== null && v >= b + S.sleepDriftHours - EPS;
    });
    auto.sleepEnergy = consecutive(i, S.sleepDriftNights, function (j) {
      const v = ser.sleep[j], b = rows[j].base.sleep, en = ser.energy[j];
      return v !== null && b !== null && en !== null && v <= b - S.sleepDriftHours + EPS && en >= S.energyHigh - EPS;
    });
    auto.bed = consecutive(i, S.bedtimeDriftNights, function (j) {
      const v = ser.bed[j], b = rows[j].base.bed;
      return v !== null && b !== null && v - b >= S.bedtimeDriftHours - EPS;
    });
    function speedRun(label) {
      let count = 0;
      for (let k = Math.max(0, i - 2); k <= i; k++) { if (rows[k].speed === label) count++; }
      return r.speed === label && count >= Math.round(S.racingDays);
    }
    auto.racing = speedRun(VAL.RACING);
    auto.slowed = speedRun(VAL.SLOWED);
    auto.med = r.med === VAL.NO;

    const active = { Early: {}, Middle: {}, Late: {} };
    signRows.forEach(function (row) {
      if (!active[row.tier] || !row.sign) return;
      let hit = false;
      switch (row.detector) {
        case DETECTORS.CHECKLIST: hit = r._checklistText.indexOf(row.sign) !== -1; break;
        case DETECTORS.ANSWER: hit = answerHit(row.detail, r.fields); break;
        case DETECTORS.SPIKE_KIND: hit = kindHit(row.detail, r._s.kinds); break;
        case DETECTORS.SPIKE_REPLAY: hit = r._s.replay; break;
        case DETECTORS.SPIKE_VERDICT: hit = r._s.verdict; break;
        case DETECTORS.SPIKE_DEBT: hit = r._s.debt; break;
        case DETECTORS.SPIKE_HOPELESS: hit = r._s.hopeless; break;
        case DETECTORS.SPIKE_URGE: hit = r._s.urge; break;
        case DETECTORS.KEYWORD: hit = !!S.keywordScanOn && keywordHit(row.detail, r._blob); break;
        case DETECTORS.A_SLEEP: hit = auto.sleep; break;
        case DETECTORS.A_RACING: hit = auto.racing; break;
        case DETECTORS.A_MED: hit = auto.med; break;
        case DETECTORS.A_SLOWED: hit = auto.slowed; break;
        case DETECTORS.A_OVERSLEEP: hit = auto.oversleep; break;
        case DETECTORS.A_SLEEPENERGY: hit = auto.sleepEnergy; break;
        case DETECTORS.A_MOOD_UP: hit = auto.moodUp; break;
        case DETECTORS.A_MOOD_DOWN: hit = auto.moodDown; break;
        case DETECTORS.A_BED: hit = auto.bed; break;
      }
      if (hit) active[row.tier][row.sign] = true;
    });
    r.tierCounts = {};
    r.activeSigns = [];
    const parts = [];
    TIERS.forEach(function (t) {
      const names = Object.keys(active[t]);
      r.tierCounts[t] = names.length;
      names.forEach(function (nm) { r.activeSigns.push({ tier: t, sign: nm }); });
      if (names.length) parts.push(t + ': ' + names.join('; '));
    });
    r.signsText = parts.join(' | ');
  });

  return { rows: rows, start: start, end: end };
}

/** Counts over the last `windowDays` rows. multi = days with signs in two or more tiers. */
function stackingSummary(rows, windowDays) {
  const last = rows.slice(-Math.max(1, Math.round(windowDays)));
  const out = { days: last.length, Early: 0, Middle: 0, Late: 0, multi: 0 };
  last.forEach(function (r) {
    let tiersHit = 0;
    TIERS.forEach(function (t) {
      if (r.tierCounts[t] > 0) { out[t]++; tiersHit++; }
    });
    if (tiersHit >= 2) out.multi++;
  });
  return out;
}

/** Newest first. gap = intensity minus trigger rating, both 0 to 10. */
function spikeList(spikes, limit) {
  return spikes.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, limit || 8).map(function (g) {
    const f = num_(g.intensity), e = num_(g.event);
    return {
      date: g.date, kind: g.kind, feeling: f, event: e,
      gap: f !== null && e !== null ? f - e : null,
      fact: g.fact, replay: g.replay, debt: g.debt, hopeless: g.hopeless, urge: g.urge
    };
  });
}

/**
 * Days per answer for each categorical check-in question in a date range.
 * Returns [{field, total, answers:[{value, days}]}] in ANSWER_KEYS order.
 */
function answerCounts(rows, startDate, endDate) {
  return ANSWER_KEYS.map(function (k) {
    const title = HEADERS[k];
    const tally = {};
    let total = 0;
    rows.forEach(function (r) {
      if (r.date < startDate || r.date > endDate) return;
      const v = r.fields && r.fields[title];
      if (!v) return;
      tally[v] = (tally[v] || 0) + 1;
      total++;
    });
    const answers = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })
      .map(function (v) { return { value: v, days: tally[v] }; });
    return { field: title, total: total, answers: answers };
  });
}

/** Days with data, mean, min, max of a row field between two dates inclusive. */
function statsFor(rows, field, startDate, endDate) {
  let n = 0, sum = 0, min = null, max = null;
  rows.forEach(function (r) {
    if (r.date < startDate || r.date > endDate) return;
    const v = r[field];
    if (v === null || v === undefined || v === '') return;
    n++; sum += v;
    if (min === null || v < min) min = v;
    if (max === null || v > max) max = v;
  });
  return { n: n, mean: n ? sum / n : null, min: min, max: max };
}

/** How many days each sign was active in a date range, with first and last day. */
function signTally(rows, startDate, endDate) {
  const map = {};
  rows.forEach(function (r) {
    if (r.date < startDate || r.date > endDate) return;
    r.activeSigns.forEach(function (a) {
      const key = a.tier + '\u0000' + a.sign;
      const e = map[key] || (map[key] = { tier: a.tier, sign: a.sign, days: 0, first: r.date, last: r.date });
      e.days++;
      e.last = r.date;
    });
  });
  return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
    return TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || b.days - a.days;
  });
}
