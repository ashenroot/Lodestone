// Run: node test/logic.test.js
// Loads the .gs files into a sandbox with no Apps Script services.
// All data below is synthetic.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..', 'src');
const files = [
  'core/Config.gs',
  'core/Logic.gs',
  'modules/device-import/DeviceImport.gs'
];
const ctx = vm.createContext({ console: console });
files.forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
const get = function (name) { return vm.runInContext(name, ctx); };

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (err) { console.log('FAIL ' + name + '\n     ' + err.message); process.exitCode = 1; }
}

const addDays = get('addDays');
const daysBetween = get('daysBetween');
const dateKey = get('dateKey');
const clockHours = get('clockHours');
const normalizeSettings = get('normalizeSettings');
const rollingMean = get('rollingMean');
const rollingMedian = get('rollingMedian');
const keywordHit = get('keywordHit');
const buildDaily = get('buildDaily');
const stackingSummary = get('stackingSummary');
const signTally = get('signTally');
const statsFor = get('statsFor');
const validateDevicePayload = get('validateDevicePayload');
const labelDate = get('labelDate');
const DETECTORS = get('DETECTORS');
const VAL = get('VAL');

const S = normalizeSettings({});
const utcFmt = function (d) { return d.toISOString().slice(0, 10); };

// ---------- dates ----------

test('addDays crosses month and year', function () {
  assert.strictEqual(addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(addDays('2026-03-01', -1), '2026-02-28');
  assert.strictEqual(daysBetween('2026-10-01', '2026-10-20'), 19);
});

test('dateKey: before the rollover hour counts toward the previous day', function () {
  // 02:30 UTC with a 4 h rollover is still the day before.
  assert.strictEqual(dateKey(new Date('2026-10-20T02:30:00Z'), 4, utcFmt), '2026-10-19');
  assert.strictEqual(dateKey(new Date('2026-10-20T04:00:00Z'), 4, utcFmt), '2026-10-20');
  assert.strictEqual(dateKey(new Date('2026-10-20T09:15:00Z'), 4, utcFmt), '2026-10-20');
});

test('labelDate', function () { assert.strictEqual(labelDate('2026-10-05'), 'Oct 5'); });

test('clockHours puts after-midnight times after late evening', function () {
  assert.strictEqual(clockHours('23:30'), 23.5);
  assert.strictEqual(clockHours('01:00'), 25);
  assert.strictEqual(clockHours('06:30'), 30.5);
  assert.strictEqual(clockHours('25:00'), null);
  assert.strictEqual(clockHours(''), null);
});

// ---------- settings ----------

test('normalizeSettings applies defaults and rejects junk', function () {
  assert.strictEqual(S.baselineDays, 14);
  assert.strictEqual(S.rolloverHours, 4);
  assert.strictEqual(S.keywordScanOn, false);
  const s2 = normalizeSettings({ baselineDays: 'abc', sleepDriftHours: '1.5', keywordScan: 'On', rollover: '03:30' });
  assert.strictEqual(s2.baselineDays, 14);
  assert.strictEqual(s2.sleepDriftHours, 1.5);
  assert.strictEqual(s2.keywordScanOn, true);
  assert.strictEqual(s2.rolloverHours, 3.5);
});

// ---------- baselines ----------

test('rollingMean needs a full window of history', function () {
  const a = []; for (let i = 0; i < 20; i++) a.push(3);
  assert.strictEqual(rollingMean(a, 13, 14), null);
  assert.strictEqual(rollingMean(a, 14, 14), 3);
});

test('rollingMean skips gaps and needs half the window', function () {
  const a = []; for (let i = 0; i < 20; i++) a.push(i % 2 ? null : 4);
  assert.strictEqual(rollingMean(a, 15, 14), 4);
  const b = []; for (let i = 0; i < 20; i++) b.push(i < 3 ? 5 : null);
  assert.strictEqual(rollingMean(b, 16, 14), null);
});

test('rollingMedian needs 30 days of history', function () {
  const a = []; for (let i = 0; i < 40; i++) a.push(i);
  assert.strictEqual(rollingMedian(a, 29, 90), null);
  assert.strictEqual(typeof rollingMedian(a, 35, 90), 'number');
});

// ---------- buildDaily ----------

const HEADERS = get('HEADERS');
const ANSWER_KEYS = get('ANSWER_KEYS');
const answerCounts = get('answerCounts');
const answerHit = get('answerHit');
const kindHit = get('kindHit');
const spikeList = get('spikeList');

/** Test helper. Categorical answers (speed, irritability, ...) can be passed as plain keys. */
function checkin(date, hour, extra) {
  const e = Object.assign({}, extra || {});
  const answers = {};
  ANSWER_KEYS.forEach(function (k) {
    if (e[k] !== undefined) { answers[HEADERS[k]] = e[k]; delete e[k]; }
  });
  return Object.assign({
    ts: new Date(date + 'T' + (hour < 10 ? '0' + hour : hour) + ':00:00Z'), date: date,
    mood: '', sleep: '', med: '', energy: '', answers: answers, subst: '', signsText: '', note: '', share: false
  }, e);
}

function spike(date, extra) {
  return Object.assign({ ts: new Date(date + 'T12:00:00Z'), date: date, kind: 'Guilt', what: 'x', intensity: 5, event: 3,
    fact: '', frame: '', replay: '', debt: '', hopeless: '', urge: '' }, extra || {});
}

test('missed days are blank rows, not zeros', function () {
  const r = buildDaily({
    checkins: [checkin('2026-10-01', 9, { mood: 3 }), checkin('2026-10-04', 9, { mood: 4 })],
    signs: []
  }, S, '2026-10-04').rows;
  assert.strictEqual(r.length, 4);
  assert.strictEqual(r[1].mood, null);
  assert.strictEqual(r[1].entries, 0);
  assert.strictEqual(r[3].mood, 4);
});

test('two entries in a day: latest non-empty value per field wins', function () {
  const r = buildDaily({
    checkins: [
      checkin('2026-10-01', 8, { mood: 3, energy: 4, sleep: 7 }),
      checkin('2026-10-01', 14, { mood: 2 })
    ], signs: []
  }, S, '2026-10-01').rows[0];
  assert.strictEqual(r.mood, 2);
  assert.strictEqual(r.energy, 4);
  assert.strictEqual(r.sleepSelf, 7);
  assert.strictEqual(r.entries, 2);
});

test('rows run through today with trailing blanks', function () {
  const r = buildDaily({ checkins: [checkin('2026-10-01', 9, { mood: 3 })], signs: [] }, S, '2026-10-03').rows;
  assert.strictEqual(r.length, 3);
  assert.strictEqual(r[2].entries, 0);
});

test('empty input gives no rows', function () {
  assert.strictEqual(buildDaily({}, S, '2026-10-03').rows.length, 0);
});

function series(startDate, n, fn) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(checkin(addDays(startDate, i), 9, fn(i)));
  return out;
}

test('baseline starts after 14 days and equals the mean of the prior days', function () {
  const rows = buildDaily({
    checkins: series('2026-09-01', 20, function () { return { mood: 3 }; }), signs: []
  }, S, '2026-09-20').rows;
  assert.strictEqual(rows[13].base.mood, null);
  assert.strictEqual(rows[14].base.mood, 3);
});

test('sleep drift fires after N nights below baseline, not before', function () {
  const signs = [{ tier: 'Early', sign: 'Sleep drift', detector: DETECTORS.A_SLEEP, detail: '' }];
  const rows = buildDaily({
    checkins: series('2026-09-01', 20, function (i) { return { sleep: i < 16 ? 7.5 : 6 }; }), signs: signs
  }, S, '2026-09-20').rows;
  // Days 16, 17, 18, 19 (0-based) are 6 h against a ~7.5 baseline. Fires on the third, index 18.
  assert.strictEqual(rows[16].tierCounts.Early, 0);
  assert.strictEqual(rows[17].tierCounts.Early, 0);
  assert.strictEqual(rows[18].tierCounts.Early, 1);
  assert.strictEqual(rows[19].tierCounts.Early, 1);
});

test('a missing night breaks the sleep drift run', function () {
  const signs = [{ tier: 'Early', sign: 'Sleep drift', detector: DETECTORS.A_SLEEP, detail: '' }];
  const checkins = series('2026-09-01', 20, function (i) { return { sleep: i < 16 ? 7.5 : 6 }; });
  checkins.splice(17, 1); // remove index 17
  const rows = buildDaily({ checkins: checkins, signs: signs }, S, '2026-09-20').rows;
  assert.strictEqual(rows[18].tierCounts.Early, 0);
});

test('device sleep fills in when self-report is missing', function () {
  const rows = buildDaily({
    checkins: [checkin('2026-10-01', 9, { mood: 3 })],
    device: [{ date: '2026-10-01', sleep: '6.4', bed: '00:52', wake: '06:41', steps: '', exercise: '' }],
    signs: []
  }, S, '2026-10-01').rows;
  assert.strictEqual(rows[0].sleepSelf, null);
  assert.strictEqual(rows[0].sleepDev, 6.4);
  assert.strictEqual(rows[0].sleepPrimary, 6.4);
  assert.ok(Math.abs(rows[0].bedClock - 24.8667) < 0.01);
});

test('racing thoughts: needs the day itself plus 2 of 3', function () {
  const signs = [{ tier: 'Middle', sign: 'Racing', detector: DETECTORS.A_RACING, detail: '' }];
  const rows = buildDaily({
    checkins: [
      checkin('2026-10-01', 9, { speed: 'Racing' }),
      checkin('2026-10-02', 9, { speed: 'Normal' }),
      checkin('2026-10-03', 9, { speed: 'Racing' })
    ], signs: signs
  }, S, '2026-10-03').rows;
  assert.strictEqual(rows[0].tierCounts.Middle, 0);
  assert.strictEqual(rows[1].tierCounts.Middle, 0);
  assert.strictEqual(rows[2].tierCounts.Middle, 1);
});

test('missed medication fires on a No', function () {
  const signs = [{ tier: 'Early', sign: 'Missed dose', detector: DETECTORS.A_MED, detail: '' }];
  const rows = buildDaily({
    checkins: [checkin('2026-10-01', 9, { med: 'Yes' }), checkin('2026-10-02', 9, { med: 'No' })], signs: signs
  }, S, '2026-10-02').rows;
  assert.strictEqual(rows[0].tierCounts.Early, 0);
  assert.strictEqual(rows[1].tierCounts.Early, 1);
});

test('checklist tick matches sign names that contain commas', function () {
  const signs = [
    { tier: 'Late', sign: 'Debt, payment or deserve language', detector: DETECTORS.CHECKLIST, detail: '' },
    { tier: 'Early', sign: 'Vivid replays', detector: DETECTORS.CHECKLIST, detail: '' }
  ];
  const rows = buildDaily({
    checkins: [checkin('2026-10-01', 9, { signsText: 'Vivid replays, Debt, payment or deserve language' }),
               checkin('2026-10-02', 9, { signsText: 'Vivid replays' })],
    signs: signs
  }, S, '2026-10-02').rows;
  assert.strictEqual(rows[0].tierCounts.Late, 1);
  assert.strictEqual(rows[0].tierCounts.Early, 1);
  assert.strictEqual(rows[1].tierCounts.Late, 0);
});

test('a sign with two detectors counts once', function () {
  const signs = [
    { tier: 'Early', sign: 'Vivid replays', detector: DETECTORS.CHECKLIST, detail: '' },
    { tier: 'Early', sign: 'Vivid replays', detector: DETECTORS.SPIKE_REPLAY, detail: '' }
  ];
  const rows = buildDaily({
    checkins: [checkin('2026-10-01', 9, { signsText: 'Vivid replays' })],
    spikes: [spike('2026-10-01', { replay: 'Yes' })],
    signs: signs
  }, S, '2026-10-01').rows;
  assert.strictEqual(rows[0].tierCounts.Early, 1);
});

test('spike form flags drive their signs', function () {
  const signs = [
    { tier: 'Middle', sign: 'Verdict', detector: DETECTORS.SPIKE_VERDICT, detail: '' },
    { tier: 'Late', sign: 'Debt', detector: DETECTORS.SPIKE_DEBT, detail: '' },
    { tier: 'Late', sign: 'Urge', detector: DETECTORS.SPIKE_URGE, detail: '' }
  ];
  const rows = buildDaily({
    spikes: [spike('2026-10-01', { frame: VAL.FRAME_VERDICT, debt: 'Yes', urge: 'No' })],
    signs: signs
  }, S, '2026-10-01').rows;
  assert.strictEqual(rows[0].tierCounts.Middle, 1);
  assert.strictEqual(rows[0].tierCounts.Late, 1); // debt yes, urge no
});

test('keyword scan is off by default and whole-word when on', function () {
  const signs = [{ tier: 'Middle', sign: 'Verdict language', detector: DETECTORS.KEYWORD, detail: 'burden, worthless' }];
  const input = { checkins: [checkin('2026-10-01', 9, { note: 'felt like a Burden today' }), checkin('2026-10-02', 9, { note: 'burdensome paperwork' })], signs: signs };
  assert.strictEqual(buildDaily(input, S, '2026-10-02').rows[0].tierCounts.Middle, 0);
  const on = normalizeSettings({ keywordScan: 'On' });
  const rows = buildDaily(input, on, '2026-10-02').rows;
  assert.strictEqual(rows[0].tierCounts.Middle, 1);
  assert.strictEqual(rows[1].tierCounts.Middle, 0);
  assert.strictEqual(keywordHit('pay back', 'I need to pay back this'), true);
  assert.strictEqual(keywordHit('pay', 'payment due'), false);
});

test('keyword scan reads the spike one-liner too', function () {
  const signs = [{ tier: 'Late', sign: 'Debt language', detector: DETECTORS.KEYWORD, detail: 'owe' }];
  const on = normalizeSettings({ keywordScan: 'On' });
  const rows = buildDaily({
    spikes: [spike('2026-10-01', { what: 'I owe them' })],
    signs: signs
  }, on, '2026-10-01').rows;
  assert.strictEqual(rows[0].tierCounts.Late, 1);
});

test('bedtime drift fires after N later nights', function () {
  const signs = [{ tier: 'Early', sign: 'Bedtime drift', detector: DETECTORS.A_BED, detail: '' }];
  const device = [];
  for (let i = 0; i < 20; i++) device.push({ date: addDays('2026-09-01', i), sleep: '', bed: i < 16 ? '23:30' : '01:00', wake: '', steps: '', exercise: '' });
  const rows = buildDaily({ device: device, signs: signs }, S, '2026-09-20').rows;
  assert.strictEqual(rows[17].tierCounts.Early, 0);
  assert.strictEqual(rows[18].tierCounts.Early, 1);
});

test('mood shift is detected separately above and below baseline', function () {
  const signs = [
    { tier: 'Middle', sign: 'Up', detector: DETECTORS.A_MOOD_UP, detail: '' },
    { tier: 'Middle', sign: 'Down', detector: DETECTORS.A_MOOD_DOWN, detail: '' }
  ];
  const up = buildDaily({
    checkins: series('2026-09-01', 20, function (i) { return { mood: i < 16 ? 3 : 5 }; }), signs: signs
  }, S, '2026-09-20').rows;
  assert.strictEqual(up[17].activeSigns.length, 0);
  assert.strictEqual(JSON.stringify(up[18].activeSigns.map(function (a) { return a.sign; })), JSON.stringify(['Up']));
  const down = buildDaily({
    checkins: series('2026-09-01', 20, function (i) { return { mood: i < 16 ? 3 : 1 }; }), signs: signs
  }, S, '2026-09-20').rows;
  assert.strictEqual(JSON.stringify(down[18].activeSigns.map(function (a) { return a.sign; })), JSON.stringify(['Down']));
});

test('less sleep with high energy, and oversleeping, are different signs', function () {
  const signs = [
    { tier: 'Early', sign: 'Wired', detector: DETECTORS.A_SLEEPENERGY, detail: '' },
    { tier: 'Early', sign: 'Over', detector: DETECTORS.A_OVERSLEEP, detail: '' },
    { tier: 'Early', sign: 'Short', detector: DETECTORS.A_SLEEP, detail: '' }
  ];
  const short = buildDaily({
    checkins: series('2026-09-01', 20, function (i) { return { mood: 3, sleep: i < 16 ? 8 : 5, energy: i < 16 ? 3 : 5 }; }), signs: signs
  }, S, '2026-09-20').rows;
  assert.strictEqual(JSON.stringify(short[18].activeSigns.map(function (a) { return a.sign; }).sort()), JSON.stringify(['Short', 'Wired']));
  const tiredShort = buildDaily({
    checkins: series('2026-09-01', 20, function (i) { return { mood: 3, sleep: i < 16 ? 8 : 5, energy: 2 }; }), signs: signs
  }, S, '2026-09-20').rows;
  assert.strictEqual(JSON.stringify(tiredShort[18].activeSigns.map(function (a) { return a.sign; })), JSON.stringify(['Short']));
  const long = buildDaily({
    checkins: series('2026-09-01', 20, function (i) { return { mood: 3, sleep: i < 16 ? 8 : 10.5, energy: 2 }; }), signs: signs
  }, S, '2026-09-20').rows;
  assert.strictEqual(JSON.stringify(long[18].activeSigns.map(function (a) { return a.sign; })), JSON.stringify(['Over']));
});

test('slowed thoughts follow the same two-of-three rule as racing', function () {
  const signs = [{ tier: 'Middle', sign: 'Slowed', detector: DETECTORS.A_SLOWED, detail: '' }];
  const rows = buildDaily({
    checkins: [checkin('2026-10-01', 9, { speed: 'Slowed' }), checkin('2026-10-02', 9, { speed: 'Normal' }), checkin('2026-10-03', 9, { speed: 'Slowed' })],
    signs: signs
  }, S, '2026-10-03').rows;
  assert.strictEqual(rows[2].tierCounts.Middle, 1);
  assert.strictEqual(rows[1].tierCounts.Middle, 0);
});

test('check-in answer detector matches field and value, case-insensitively', function () {
  const signs = [{ tier: 'Middle', sign: 'Hopelessness', detector: DETECTORS.ANSWER, detail: 'hopelessness: Some, A lot' }];
  const rows = buildDaily({
    checkins: [checkin('2026-10-01', 9, { hopeless: 'A lot' }), checkin('2026-10-02', 9, { hopeless: 'None' }), checkin('2026-10-03', 9, { irritability: 'A lot' })],
    signs: signs
  }, S, '2026-10-03').rows;
  assert.strictEqual(JSON.stringify(rows.map(function (r) { return r.tierCounts.Middle; })), JSON.stringify([1, 0, 0]));
  assert.strictEqual(answerHit('no colon here', { Hopelessness: 'Some' }), false);
});

test('a blank later answer does not erase an earlier one the same day', function () {
  const signs = [{ tier: 'Middle', sign: 'Irritable', detector: DETECTORS.ANSWER, detail: 'Irritability: A lot' }];
  const rows = buildDaily({
    checkins: [checkin('2026-10-01', 8, { irritability: 'A lot' }), checkin('2026-10-01', 18, {})],
    signs: signs
  }, S, '2026-10-01').rows;
  assert.strictEqual(rows[0].tierCounts.Middle, 1);
});

test('spike kind detector matches any listed kind logged that day', function () {
  const signs = [{ tier: 'Middle', sign: 'Despair', detector: DETECTORS.SPIKE_KIND, detail: 'Despair or hopelessness, Something else' }];
  const rows = buildDaily({
    spikes: [spike('2026-10-01', { kind: 'Despair or hopelessness' }), spike('2026-10-02', { kind: 'Guilt' })],
    signs: signs
  }, S, '2026-10-02').rows;
  assert.strictEqual(JSON.stringify(rows.map(function (r) { return r.tierCounts.Middle; })), JSON.stringify([1, 0]));
  assert.strictEqual(kindHit('guilt', ['Guilt']), true);
});

test('spike hopelessness flag drives its sign', function () {
  const signs = [{ tier: 'Middle', sign: 'Will not change', detector: DETECTORS.SPIKE_HOPELESS, detail: '' }];
  const rows = buildDaily({ spikes: [spike('2026-10-01', { hopeless: 'Yes' })], signs: signs }, S, '2026-10-01').rows;
  assert.strictEqual(rows[0].tierCounts.Middle, 1);
});

test('answerCounts tallies days per answer in range', function () {
  const rows = buildDaily({
    checkins: [checkin('2026-10-01', 9, { irritability: 'Some' }), checkin('2026-10-02', 9, { irritability: 'A lot' }), checkin('2026-10-03', 9, { irritability: 'Some' })],
    signs: []
  }, S, '2026-10-03').rows;
  const irr = answerCounts(rows, '2026-10-01', '2026-10-03').filter(function (f) { return f.field === 'Irritability'; })[0];
  assert.strictEqual(irr.total, 3);
  assert.deepStrictEqual(JSON.stringify(irr.answers), JSON.stringify([{ value: 'Some', days: 2 }, { value: 'A lot', days: 1 }]));
});

// ---------- summaries ----------

test('stackingSummary counts tiers and multi-tier days over the window', function () {
  const rows = [
    { tierCounts: { Early: 1, Middle: 0, Late: 0 } },
    { tierCounts: { Early: 1, Middle: 1, Late: 0 } },
    { tierCounts: { Early: 0, Middle: 1, Late: 1 } },
    { tierCounts: { Early: 0, Middle: 0, Late: 0 } }
  ];
  const s = stackingSummary(rows, 3);
  assert.deepStrictEqual([s.days, s.Early, s.Middle, s.Late, s.multi], [3, 1, 2, 1, 2]);
});

test('spikeList sorts newest first and computes the gap', function () {
  const list = spikeList([
    { ts: new Date('2026-10-01T10:00:00Z'), date: '2026-10-01', intensity: 5, event: 4, fact: 'Yes' },
    { ts: new Date('2026-10-03T10:00:00Z'), date: '2026-10-03', intensity: 8, event: 3, fact: 'No' }
  ], 8);
  assert.strictEqual(list[0].date, '2026-10-03');
  assert.strictEqual(list[0].gap, 5);
  assert.strictEqual(list[1].gap, 1);
});

test('statsFor and signTally respect the date range', function () {
  const rows = buildDaily({
    checkins: series('2026-10-01', 5, function (i) { return { mood: i + 1, signsText: i >= 3 ? 'Vivid replays' : '' }; }),
    signs: [{ tier: 'Early', sign: 'Vivid replays', detector: DETECTORS.CHECKLIST, detail: '' }]
  }, S, '2026-10-05').rows;
  const st = statsFor(rows, 'mood', '2026-10-02', '2026-10-04');
  assert.deepStrictEqual([st.n, st.mean, st.min, st.max], [3, 3, 2, 4]);
  const tally = signTally(rows, '2026-10-01', '2026-10-05');
  assert.strictEqual(tally.length, 1);
  assert.strictEqual(tally[0].days, 2);
  assert.strictEqual(tally[0].first, '2026-10-04');
});

// ---------- device payload ----------

test('device payload: valid sleep and activity payload', function () {
  const v = validateDevicePayload({ token: 'x', date: '2026-10-20', sleep_hours: 6.4, bedtime: '0:52', wake: '06:41', activity_date: '2026-10-19', steps: 4120.4, exercise_minutes: 12 }, '2026-10-20');
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.rows.length, 2);
  assert.strictEqual(JSON.stringify(v.rows[0].fields), JSON.stringify({ sleep: 6.4, bed: '00:52', wake: '06:41' }));
  assert.strictEqual(JSON.stringify(v.rows[1].fields), JSON.stringify({ steps: 4120, exercise: 12 }));
  assert.strictEqual(v.rows[1].date, '2026-10-19');
});

test('device payload: rejects bad values', function () {
  const today = '2026-10-20';
  assert.strictEqual(validateDevicePayload({ date: '2026-10-20', sleep_hours: 30 }, today).ok, false);
  assert.strictEqual(validateDevicePayload({ date: '2026-10-20', bedtime: '25:00' }, today).ok, false);
  assert.strictEqual(validateDevicePayload({ sleep_hours: 6 }, today).ok, false);
  assert.strictEqual(validateDevicePayload({ date: '2026-08-01', sleep_hours: 6 }, today).ok, false);
  assert.strictEqual(validateDevicePayload({ date: '2026-10-25', sleep_hours: 6 }, today).ok, false);
  assert.strictEqual(validateDevicePayload({ steps: 4000 }, today).ok, false);
  assert.strictEqual(validateDevicePayload({ activity_date: today, steps: -5 }, today).ok, false);
  assert.strictEqual(validateDevicePayload({ token: 'x' }, today).ok, false);
  assert.strictEqual(validateDevicePayload(null, today).ok, false);
});

test('device payload: partial payloads are fine', function () {
  const v = validateDevicePayload({ date: '2026-10-20', wake: '06:41' }, '2026-10-20');
  assert.strictEqual(v.ok, true);
  assert.strictEqual(JSON.stringify(v.rows[0].fields), JSON.stringify({ wake: '06:41' }));
  assert.strictEqual(v.source, 'Device');
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some failed' : ''));
