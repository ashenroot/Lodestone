/**
 * Constants and defaults. No Apps Script services are called in this file.
 * Everything here is read at call time by other files, so file load order
 * does not matter.
 */

const TABS = {
  CHECKINS: 'Check-ins',
  GUILT: 'Guilt',
  DAILY: 'Daily',
  DEVICE: 'Device',
  PATTERN: 'Pattern',
  CONFIG: 'Config',
  BASELINE: 'Baseline',
  CHART: '_chart'
};

const PROP = {
  SHEET_ID: 'SHEET_ID',
  FORM_CHECKIN_ID: 'FORM_CHECKIN_ID',
  FORM_GUILT_ID: 'FORM_GUILT_ID',
  DEVICE_TOKEN: 'DEVICE_TOKEN'
};

/**
 * Form question titles. These are also the column headers in the response
 * tabs, so the Logic reads columns by these exact strings.
 * Change a title here and run "Update forms", and old responses keep the
 * old header. Rename with care.
 */
const HEADERS = {
  timestamp: 'Timestamp',
  mood: 'Mood',
  sleep: 'Hours slept last night',
  med: 'Medication taken',
  note: 'Note',
  share: 'Include this note in the appointment summary',
  next: 'After this',
  energy: 'Energy',
  speed: 'Thought speed',
  appetite: 'Appetite',
  substances: 'Caffeine and alcohol',
  signs: 'Signs I noticed',
  g_what: 'What happened, one line',
  g_fact: 'Can I name a specific, proportionate fact for this feeling',
  g_kind: 'What the feeling is saying',
  g_intensity: 'Intensity of the feeling',
  g_event: "How I'd rate the event itself",
  g_replay: 'Replay imagery',
  g_debt: 'Debt, payment or deserve framing present',
  g_urge: 'Urge attached to it'
};

/** Answer strings the Logic compares against. */
const VAL = {
  YES: 'Yes',
  NO: 'No',
  RACING: 'Racing',
  SPEEDS: ['Slowed', 'Normal', 'Racing'],
  APPETITES: ['Low', 'Normal', 'High'],
  SUBSTANCES: ['More caffeine than usual', 'Alcohol', 'Neither'],
  FACT_YES: 'Yes',
  FACT_NO: 'No',
  FACT_NONE: "Can't find one",
  KIND_VERDICT: 'A verdict about me',
  KIND_ACCOUNT: 'An account of what happened',
  NEXT_SUBMIT: 'Submit',
  NEXT_DETAIL: 'Add detail'
};

const TIERS = ['Early', 'Middle', 'Late'];

/** How a sign in the Config tab is detected. Order here is the dropdown order. */
const DETECTORS = {
  CHECKLIST: 'Checklist tick',
  G_REPLAY: 'Guilt form: replay',
  G_VERDICT: 'Guilt form: verdict',
  G_DEBT: 'Guilt form: debt framing',
  G_URGE: 'Guilt form: urge',
  KEYWORD: 'Keyword in notes',
  A_SLEEP: 'Auto: sleep drift',
  A_RACING: 'Auto: racing thoughts',
  A_MED: 'Auto: missed medication',
  A_MOOD: 'Auto: mood shift',
  A_BED: 'Auto: bedtime drift'
};

/** Device tab headers (written by the optional device-import module). */
const DEVICE_HEADERS = {
  date: 'Date',
  source: 'Source',
  sleep: 'Sleep, hours',
  bed: 'Bedtime',
  wake: 'Wake',
  steps: 'Steps',
  exercise: 'Exercise, minutes',
  received: 'Received'
};

/**
 * Config tab layout. Do not insert rows above these tables. The script reads
 * fixed ranges.
 *   Signs:          A:E, rows signsFirstRow .. signsFirstRow + signsRows - 1
 *   Response steps: A:B, three rows (Early, Middle, Late)
 *   Settings:       B:C (label, value)
 */
const CFG_LAYOUT = {
  signsLabelRow: 4,
  signsHeaderRow: 5,
  signsFirstRow: 6,
  signsRows: 30,
  stepsLabelRow: 38,
  stepsHeaderRow: 39,
  stepsFirstRow: 40,
  settingsLabelRow: 45,
  settingsHeaderRow: 46,
  settingsFirstRow: 47
};

/** Settings. value is the default; label is what the tab shows and the script matches. */
const SETTINGS = [
  { key: 'baselineDays', label: 'Baseline window, days', value: 14 },
  { key: 'longDays', label: 'Long reference, days', value: 90 },
  { key: 'sleepDriftHours', label: 'Sleep drift, hours below baseline', value: 1 },
  { key: 'sleepDriftNights', label: 'Sleep drift, nights in a row', value: 3 },
  { key: 'moodShift', label: 'Mood shift, points from baseline', value: 1 },
  { key: 'moodShiftDays', label: 'Mood shift, days in a row', value: 3 },
  { key: 'racingDays', label: 'Racing thoughts, days out of 3', value: 2 },
  { key: 'bedtimeDriftHours', label: 'Bedtime drift, hours later than baseline', value: 1 },
  { key: 'bedtimeDriftNights', label: 'Bedtime drift, nights in a row', value: 3 },
  { key: 'stackDays', label: 'Stacking window, days', value: 7 },
  { key: 'rollover', label: 'Day rolls over at', value: '04:00' },
  { key: 'summaryWeeks', label: 'Appointment summary, weeks', value: 8 },
  { key: 'patternDays', label: 'Pattern window, days', value: 42 },
  { key: 'keywordScan', label: 'Keyword scan of notes', value: 'Off' },
  { key: 'deviceImport', label: 'Device import', value: 'Off' }
];

/**
 * Example signs. Replace them. The Note column marks them as examples.
 * Keywords are generic placeholders. Put your own in the Detail column.
 */
const SEED_SIGNS = [
  ['Early', 'Sleep drifting from baseline', DETECTORS.A_SLEEP, '', 'Example'],
  ['Early', 'Vivid replays', DETECTORS.CHECKLIST, '', 'Example'],
  ['Early', 'Vivid replays', DETECTORS.G_REPLAY, '', 'Example'],
  ['Early', 'Cancelled planned rest or social time', DETECTORS.CHECKLIST, '', 'Example'],
  ['Middle', 'Verdict language about myself', DETECTORS.CHECKLIST, '', 'Example'],
  ['Middle', 'Verdict language about myself', DETECTORS.G_VERDICT, '', 'Example'],
  ['Middle', 'Verdict language about myself', DETECTORS.KEYWORD, 'worthless, burden', 'Example. Keyword scan is off by default.'],
  ['Middle', 'Racing thoughts', DETECTORS.A_RACING, '', 'Example'],
  ['Late', 'Debt, payment or deserve language', DETECTORS.CHECKLIST, '', 'Example'],
  ['Late', 'Debt, payment or deserve language', DETECTORS.G_DEBT, '', 'Example'],
  ['Late', 'Debt, payment or deserve language', DETECTORS.KEYWORD, 'owe, deserve, make up for', 'Example. Keyword scan is off by default.'],
  ['Late', 'Urge attached to a guilt spike', DETECTORS.G_URGE, '', 'Example']
];
