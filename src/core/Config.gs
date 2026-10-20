/**
 * Constants and defaults. No Apps Script services are called in this file.
 * Everything here is read at call time by other files, so file load order
 * does not matter.
 */

const TABS = {
  CHECKINS: 'Check-ins',
  SPIKES: 'Spikes',
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
  FORM_SPIKE_ID: 'FORM_SPIKE_ID',
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
  interest: 'Interest and enjoyment',
  talk: 'Talkativeness and social drive',
  confidence: 'Confidence',
  focus: 'Concentration',
  irritability: 'Irritability',
  anxiety: 'Anxiety or restlessness',
  hopeless: 'Hopelessness',
  guilt: 'Guilt or worthlessness',
  impulse: 'Spending or risk urges',
  death: 'Thoughts of death or not being here',
  appetite: 'Appetite',
  substances: 'Caffeine and alcohol',
  signs: 'Signs I noticed',
  s_kind: 'Kind of spike',
  s_what: 'What happened, one line',
  s_intensity: 'Intensity',
  s_event: "How I'd rate the trigger itself",
  s_fact: 'Can I name a specific fact that accounts for the size of this',
  s_frame: 'What the thought is saying',
  s_replay: 'Replay imagery',
  s_debt: 'Debt, payment or deserve framing present',
  s_hopeless: 'Sense that this will not change',
  s_urge: 'Urge attached to it'
};

/** Answer strings the Logic compares against. */
const VAL = {
  YES: 'Yes',
  NO: 'No',
  RACING: 'Racing',
  SLOWED: 'Slowed',
  SPEEDS: ['Slowed', 'Normal', 'Racing'],
  APPETITES: ['Low', 'Normal', 'High'],
  SUBSTANCES: ['More caffeine than usual', 'Alcohol', 'Neither'],
  LEVELS: ['None', 'Some', 'A lot'],
  LEVELS_UPDOWN: ['Low', 'Usual', 'High'],
  TALK: ['Less', 'Usual', 'More'],
  CONFIDENCE: ['Low', 'Usual', 'Unusually high'],
  FOCUS: ['Hard to focus', 'Usual'],
  DEATH: ['None', 'Passing', 'Persistent'],
  SPIKE_KINDS: ['Guilt', 'Despair or hopelessness', 'Irritability or anger', 'Agitation or anxiety', 'Surge of energy or ideas', 'Urge to spend or take a risk', 'Something else'],
  FACT_YES: 'Yes',
  FACT_NO: 'No',
  FACT_NONE: "Can't find one",
  FRAME_VERDICT: 'A verdict about me',
  FRAME_ACCOUNT: 'An account of what happened',
  FRAME_NONE: 'No thought attached',
  NEXT_SUBMIT: 'Submit',
  NEXT_DETAIL: 'Add detail'
};

/** Check-in fields whose answers are kept per day and usable by the "Check-in answer" detector. */
const ANSWER_KEYS = ['speed', 'interest', 'talk', 'confidence', 'focus', 'irritability', 'anxiety', 'hopeless', 'guilt', 'impulse', 'death', 'appetite'];

const TIERS = ['Early', 'Middle', 'Late'];

/** How a sign in the Config tab is detected. Order here is the dropdown order. */
const DETECTORS = {
  CHECKLIST: 'Checklist tick',
  ANSWER: 'Check-in answer',
  SPIKE_KIND: 'Spike form: kind',
  SPIKE_REPLAY: 'Spike form: replay',
  SPIKE_VERDICT: 'Spike form: verdict',
  SPIKE_DEBT: 'Spike form: debt framing',
  SPIKE_HOPELESS: 'Spike form: will not change',
  SPIKE_URGE: 'Spike form: urge',
  KEYWORD: 'Keyword in notes',
  A_SLEEP: 'Auto: sleep drift',
  A_OVERSLEEP: 'Auto: oversleeping',
  A_SLEEPENERGY: 'Auto: less sleep, more energy',
  A_RACING: 'Auto: racing thoughts',
  A_SLOWED: 'Auto: slowed thoughts',
  A_MED: 'Auto: missed medication',
  A_MOOD_UP: 'Auto: mood above baseline',
  A_MOOD_DOWN: 'Auto: mood below baseline',
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
  { key: 'sleepDriftHours', label: 'Sleep drift, hours from baseline', value: 1 },
  { key: 'sleepDriftNights', label: 'Sleep drift, nights in a row', value: 3 },
  { key: 'energyHigh', label: 'Energy counted as high, from', value: 4 },
  { key: 'moodShift', label: 'Mood shift, points from baseline', value: 1 },
  { key: 'moodShiftDays', label: 'Mood shift, days in a row', value: 3 },
  { key: 'racingDays', label: 'Racing or slowed thoughts, days out of 3', value: 2 },
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
  // Early
  ['Early', 'Sleep drifting below baseline', DETECTORS.A_SLEEP, '', 'Example'],
  ['Early', 'Needing less sleep, with more energy', DETECTORS.A_SLEEPENERGY, '', 'Example'],
  ['Early', 'Oversleeping', DETECTORS.A_OVERSLEEP, '', 'Example'],
  ['Early', 'Losing interest in things', DETECTORS.ANSWER, 'Interest and enjoyment: Low', 'Example'],
  ['Early', 'More irritable than usual', DETECTORS.ANSWER, 'Irritability: Some, A lot', 'Example'],
  ['Early', 'More talkative or social than usual', DETECTORS.ANSWER, 'Talkativeness and social drive: More', 'Example'],
  ['Early', 'Vivid replays', DETECTORS.CHECKLIST, '', 'Example'],
  ['Early', 'Vivid replays', DETECTORS.SPIKE_REPLAY, '', 'Example'],
  ['Early', 'Cancelled planned rest or social time', DETECTORS.CHECKLIST, '', 'Example'],
  ['Early', 'Pulling away from people', DETECTORS.CHECKLIST, '', 'Example'],
  // Middle
  ['Middle', 'Mood below baseline', DETECTORS.A_MOOD_DOWN, '', 'Example'],
  ['Middle', 'Mood above baseline', DETECTORS.A_MOOD_UP, '', 'Example'],
  ['Middle', 'Racing thoughts', DETECTORS.A_RACING, '', 'Example'],
  ['Middle', 'Slowed thoughts', DETECTORS.A_SLOWED, '', 'Example'],
  ['Middle', 'Hopelessness', DETECTORS.ANSWER, 'Hopelessness: Some, A lot', 'Example'],
  ['Middle', 'Hopelessness', DETECTORS.SPIKE_KIND, 'Despair or hopelessness', 'Example'],
  ['Middle', 'Hopelessness', DETECTORS.SPIKE_HOPELESS, '', 'Example'],
  ['Middle', 'Verdict language about myself', DETECTORS.SPIKE_VERDICT, '', 'Example'],
  ['Middle', 'Verdict language about myself', DETECTORS.KEYWORD, 'worthless, burden', 'Example. Keyword scan is off by default.'],
  ['Middle', 'Spending or risk urges', DETECTORS.ANSWER, 'Spending or risk urges: Some, A lot', 'Example'],
  ['Middle', 'Taking on more than usual', DETECTORS.CHECKLIST, '', 'Example'],
  // Late
  ['Late', 'Debt, payment or deserve language', DETECTORS.SPIKE_DEBT, '', 'Example'],
  ['Late', 'Debt, payment or deserve language', DETECTORS.KEYWORD, 'owe, deserve, make up for', 'Example. Keyword scan is off by default.'],
  ['Late', 'Thoughts of death or not being here', DETECTORS.ANSWER, 'Thoughts of death or not being here: Passing, Persistent', 'Example'],
  ['Late', 'Urge attached to a spike', DETECTORS.SPIKE_URGE, '', 'Example'],
  ['Late', 'Unusually high confidence or certainty', DETECTORS.ANSWER, 'Confidence: Unusually high', 'Example']
];
