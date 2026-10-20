/**
 * Reporting engine, pure part. No Apps Script services are used here, so this
 * file runs under Node for tests. Report.gs renders what this file builds.
 *
 * A report is: a date range, a set of sections, and a few privacy switches.
 * An audience is only a preset for those. The dialog fills the switches from
 * the preset and the user can change any of them before running.
 */

const REPORT_SECTIONS = [
  { key: 'coverage', label: 'Coverage' },
  { key: 'measures', label: 'Measures' },
  { key: 'charts', label: 'Charts' },
  { key: 'signs', label: 'Warning signs logged' },
  { key: 'answers', label: 'Check-in answers' },
  { key: 'spikes', label: 'Spikes' },
  { key: 'notes', label: 'Notes marked for sharing' }
];

const REPORT_AUDIENCES = [
  {
    key: 'mental', label: 'Mental health provider (psychiatrist, therapist, counselor)', death: true,
    sections: { coverage: true, measures: true, charts: true, signs: true, answers: true, spikes: true, notes: true }
  },
  {
    key: 'primary', label: 'Primary care or other clinician', death: false,
    sections: { coverage: true, measures: true, charts: true, signs: false, answers: false, spikes: false, notes: false }
  },
  {
    key: 'custom', label: 'Custom', death: false,
    sections: { coverage: true, measures: true, charts: false, signs: false, answers: false, spikes: false, notes: false }
  }
];

/** Chart titles (from chartSpecs_) used in reports. Bedtime and wake is left out. Its clock axis does not read well as an image. */
const REPORT_CHART_TITLES = [
  'Mood, 1 to 5', 'Sleep, hours', 'Energy, 1 to 5', 'Signs logged per day, by tier',
  'Steps (device)', 'Exercise, minutes (device)'
];

function audienceByKey(key) {
  for (let i = 0; i < REPORT_AUDIENCES.length; i++) { if (REPORT_AUDIENCES[i].key === key) return REPORT_AUDIENCES[i]; }
  return REPORT_AUDIENCES[0];
}

/**
 * raw: values from the dialog. S: normalized settings. today: 'YYYY-MM-DD'.
 * A custom date range wins over weeks. The range is clamped to today and to two years.
 */
function normalizeReportOpts(raw, S, today) {
  raw = raw || {};
  const aud = audienceByKey(raw.audience);
  const sections = {};
  REPORT_SECTIONS.forEach(function (s) {
    sections[s.key] = raw.sections && raw.sections[s.key] !== undefined ? !!raw.sections[s.key] : !!aud.sections[s.key];
  });
  let end = today;
  let start = null;
  const okDate = function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(parseISO_(d)); };
  if (okDate(raw.from) && okDate(raw.to) && raw.from <= raw.to) {
    start = raw.from;
    end = raw.to > today ? today : raw.to;
    if (start > end) start = end;
  } else {
    let weeks = Math.round(Number(raw.weeks));
    if (!(weeks > 0)) weeks = Math.round(Number(S && S.summaryWeeks)) || 8;
    if (weeks > 104) weeks = 104;
    start = addDays(end, -(weeks * 7 - 1));
  }
  if (daysBetween(start, end) > 730) start = addDays(end, -730);
  const fmt = String(raw.format || 'doc');
  return {
    audience: aud.key,
    audienceLabel: aud.label,
    start: start,
    end: end,
    days: daysBetween(start, end) + 1,
    sections: sections,
    includeDeath: raw.includeDeath !== undefined ? !!raw.includeDeath : !!aud.death,
    includeText: !!raw.includeText,
    format: fmt === 'pdf' || fmt === 'csv' ? fmt : 'doc'
  };
}

/** Plain-language lines about what was left out, for the report footer. */
function reportRedactions(opts) {
  const out = [];
  if (opts.sections.notes) out.push('Only notes marked for sharing are included.');
  else out.push('Notes are not included.');
  if (opts.sections.spikes) out.push('The one-line text of spikes is not included.');
  if (opts.sections.answers && !opts.includeDeath) out.push('The answer to the question on thoughts of death is not included.');
  return out;
}

/**
 * data: { rows: daily rows, spikes, checkins, baselineDays }.
 * Returns the content of each enabled section. Sections that are off are null.
 */
function buildReportModel(data, opts) {
  const rows = data.rows.filter(function (r) { return r.date >= opts.start && r.date <= opts.end; });
  const recentStart = addDays(opts.end, -13);
  const model = { opts: opts, rows: rows, coverage: null, measures: null, signs: null, answers: null, spikes: null, notes: null, charts: null };

  if (opts.sections.coverage) {
    model.coverage = {
      days: rows.length,
      withEntry: rows.filter(function (r) { return r.entries > 0; }).length,
      missedMed: rows.filter(function (r) { return r.med === VAL.NO; }).length
    };
  }

  if (opts.sections.measures) {
    const defs = [
      ['Mood, 1 to 5', 'mood'], ['Sleep, hours, self-report', 'sleepSelf'], ['Sleep, hours, device', 'sleepDev'],
      ['Energy, 1 to 5', 'energy'], ['Steps, device', 'steps'], ['Exercise, minutes, device', 'exercise']
    ];
    model.measures = [];
    defs.forEach(function (m) {
      const all = statsFor(rows, m[1], opts.start, opts.end);
      if (!all.n) return;
      const recent = statsFor(rows, m[1], recentStart, opts.end);
      model.measures.push({ label: m[0], n: all.n, mean: all.mean, min: all.min, max: all.max, recentMean: recent.mean });
    });
  }

  if (opts.sections.signs) {
    model.signs = {
      tally: signTally(rows, opts.start, opts.end),
      multiDays: rows.filter(function (r) {
        return TIERS.filter(function (t) { return r.tierCounts[t] > 0; }).length >= 2;
      }).map(function (r) { return r.date; })
    };
  }

  if (opts.sections.answers) {
    model.answers = answerCounts(data.rows, opts.start, opts.end).filter(function (f) {
      if (f.total === 0) return false;
      if (!opts.includeDeath && f.field === HEADERS.death) return false;
      return true;
    });
  }

  if (opts.sections.spikes) {
    model.spikes = spikeList(data.spikes.filter(function (g) { return g.date >= opts.start && g.date <= opts.end; }), 500).reverse();
  }

  if (opts.sections.notes) {
    model.notes = data.checkins.filter(function (c) { return c.share && c.note && c.date >= opts.start && c.date <= opts.end; })
      .sort(function (a, b) { return a.ts - b.ts; })
      .map(function (c) { return { date: c.date, text: c.note }; });
  }

  if (opts.sections.charts) model.charts = REPORT_CHART_TITLES.slice();
  return model;
}

// ---------- CSV ----------

/**
 * One CSV cell. Text starting with = + - @ or a tab is prefixed with an
 * apostrophe so a spreadsheet does not run it as a formula. Numbers pass through.
 */
function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  let s = typeof v === 'number' ? String(v) : String(v);
  if (typeof v !== 'number' && /^[=+\-@\t]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(header, rows) {
  const lines = [header.map(csvCell).join(',')];
  rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
  return lines.join('\r\n') + '\r\n';
}

/** Daily rows in range, using the same columns as the Daily tab. */
function dailyCsv(rows, opts) {
  const cols = dailyCols_().filter(function (c) { return opts.includeDeath || c.label !== HEADERS.death; });
  const inRange = rows.filter(function (r) { return r.date >= opts.start && r.date <= opts.end; });
  return toCsv(cols.map(function (c) { return c.label; }), inRange.map(function (r) {
    return cols.map(function (c) { return c.get(r); });
  }));
}

/** Raw check-ins in range. A note is included when it was marked for sharing, or when includeText is on. */
function checkinsCsv(checkins, opts) {
  const answerKeys = ANSWER_KEYS.filter(function (k) { return opts.includeDeath || k !== 'death'; });
  const header = ['Date', 'Submitted', 'Mood', 'Hours slept', 'Medication taken', 'Energy']
    .concat(answerKeys.map(function (k) { return HEADERS[k]; }))
    .concat(['Caffeine and alcohol', 'Signs I noticed', 'Note']);
  const inRange = checkins.filter(function (c) { return c.date >= opts.start && c.date <= opts.end; })
    .sort(function (a, b) { return a.ts - b.ts; });
  return toCsv(header, inRange.map(function (c) {
    const showNote = c.share || opts.includeText;
    return [c.date, c.ts, c.mood, c.sleep, c.med, c.energy]
      .concat(answerKeys.map(function (k) { return (c.answers || {})[HEADERS[k]] || ''; }))
      .concat([c.subst, c.signsText, showNote ? c.note : '']);
  }));
}

/** Spikes in range. The one-line text is included only when includeText is on. */
function spikesCsv(spikes, opts) {
  const header = ['Date', 'Submitted', 'Kind', 'Intensity', 'Trigger rating', 'Gap', 'Fact named', 'What the thought is saying',
    'Replay', 'Debt framing', 'Will not change', 'Urge', 'What happened'];
  const inRange = spikes.filter(function (g) { return g.date >= opts.start && g.date <= opts.end; })
    .sort(function (a, b) { return a.ts - b.ts; });
  return toCsv(header, inRange.map(function (g) {
    const f = num_(g.intensity), e = num_(g.event);
    return [g.date, g.ts, g.kind, g.intensity, g.event, f !== null && e !== null ? f - e : '', g.fact, g.frame,
      g.replay, g.debt, g.hopeless, g.urge, opts.includeText ? g.what : ''];
  }));
}

function signsCsv(rows, opts) {
  return toCsv(['Tier', 'Sign', 'Days', 'First', 'Last'], signTally(rows, opts.start, opts.end).map(function (e) {
    return [e.tier, e.sign, e.days, e.first, e.last];
  }));
}

/** A plain text note that goes in the CSV bundle. */
function csvAboutText(opts, generated) {
  const lines = [
    'Lodestone export',
    'Range: ' + opts.start + ' to ' + opts.end + ' (' + opts.days + ' days)',
    'Generated: ' + generated,
    '',
    'daily.csv      One row per calendar date. Days with no entry are blank, not zero. Baselines are rolling means of earlier days.',
    'check-ins.csv  One row per form submission.',
    'spikes.csv     One row per spike logged.',
    'signs.csv      Days each warning sign was active in the range.',
    '',
    'Values are self-reported unless a column says device.',
    opts.includeText ? 'Free text is included.' : 'Free text is not included, except check-in notes marked for sharing.'
  ];
  if (!opts.includeDeath) lines.push('The answer to the question on thoughts of death is not included.');
  return lines.join('\r\n') + '\r\n';
}
