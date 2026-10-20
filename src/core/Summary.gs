/**
 * Appointment summary: builds a Google Doc from the last N weeks.
 * Includes: coverage, measure table, check-in answers, signs logged, stacking days,
 * spike ratings, and notes marked "include in appointment summary".
 * Left out on purpose: the one-line text of spikes and any note not
 * marked for sharing.
 */

function appointmentSummary() {
  const ui = SpreadsheetApp.getUi();
  const cfg = readConfig_(getSS_());
  const answer = ui.prompt('Appointment summary', 'Weeks to include. Blank uses ' + cfg.settings.summaryWeeks + '.', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  const typed = Math.round(Number(answer.getResponseText()));
  const weeks = typed > 0 && typed <= 104 ? typed : cfg.settings.summaryWeeks;
  const data = loadAll_();
  const url = buildSummaryDoc_(data, weeks);
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px"><p>Created. It is private to your account until you share it.</p>'
    + '<p><a href="' + url + '" target="_blank">Open the summary</a></p></div>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(360).setHeight(150), 'Appointment summary');
}

function fmt1_(v) {
  if (v === null || v === undefined) return '';
  return String(Math.round(v * 10) / 10);
}

function tableOf_(body, header, rows) {
  const t = body.appendTable([header].concat(rows));
  for (let c = 0; c < header.length; c++) t.getCell(0, c).editAsText().setBold(true);
  return t;
}

function buildSummaryDoc_(data, weeks) {
  const end = data.today;
  const start = addDays(end, -(weeks * 7 - 1));
  const rows = data.daily.rows.filter(function (r) { return r.date >= start && r.date <= end; });
  const last14Start = addDays(end, -13);

  const doc = DocumentApp.create('Appointment summary ' + end);
  const body = doc.getBody();
  body.appendParagraph('Appointment summary').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(labelDate(start) + ' to ' + labelDate(end) + ', ' + weeks + ' weeks. Source: personal tracking sheet. Values are self-reported unless marked device.');

  // Coverage
  const withEntry = rows.filter(function (r) { return r.entries > 0; }).length;
  const missedMed = rows.filter(function (r) { return r.med === VAL.NO; }).length;
  body.appendParagraph('Coverage').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Entries on ' + withEntry + ' of ' + rows.length + ' days. Medication marked not taken on ' + missedMed + ' day(s).');

  // Measures
  body.appendParagraph('Measures').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  const measures = [
    ['Mood, 1 to 5', 'mood'],
    ['Sleep, hours, self-report', 'sleepSelf'],
    ['Sleep, hours, device', 'sleepDev'],
    ['Energy, 1 to 5', 'energy'],
    ['Steps, device', 'steps'],
    ['Exercise, minutes, device', 'exercise']
  ];
  const mRows = [];
  measures.forEach(function (m) {
    const all = statsFor(rows, m[1], start, end);
    if (!all.n) return;
    const recent = statsFor(rows, m[1], last14Start, end);
    mRows.push([m[0], String(all.n), fmt1_(all.mean), fmt1_(all.min), fmt1_(all.max), fmt1_(recent.mean)]);
  });
  if (mRows.length) tableOf_(body, ['Measure', 'Days with data', 'Mean', 'Min', 'Max', 'Last 14 days mean'], mRows);
  else body.appendParagraph('No measures logged in this range.');

  // Signs
  body.appendParagraph('Signs logged').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  const tally = signTally(rows, start, end);
  if (tally.length) {
    tableOf_(body, ['Tier', 'Sign', 'Days', 'First', 'Last'], tally.map(function (e) {
      return [e.tier, e.sign, String(e.days), labelDate(e.first), labelDate(e.last)];
    }));
  } else {
    body.appendParagraph('None logged.');
  }
  const multi = rows.filter(function (r) {
    return TIERS.filter(function (t) { return r.tierCounts[t] > 0; }).length >= 2;
  });
  body.appendParagraph('Days with signs in two or more tiers: ' + multi.length
    + (multi.length ? ' (' + multi.slice(-20).map(function (r) { return labelDate(r.date); }).join(', ') + ')' : '') + '.');

  // Symptom answers
  body.appendParagraph('Check-in answers, days per answer').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  const fc = answerCounts(data.daily.rows, start, end);
  const fcRows = fc.filter(function (f) { return f.total > 0; }).map(function (f) {
    return [f.field, f.answers.map(function (a) { return a.value + ' ' + a.days; }).join(', '), String(f.total)];
  });
  if (fcRows.length) tableOf_(body, ['Question', 'Days per answer', 'Days answered'], fcRows);
  else body.appendParagraph('No detail pages filled in.');

  // Spikes
  body.appendParagraph('Spikes').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  const spikes = spikeList(data.spikes.filter(function (g) { return g.date >= start && g.date <= end; }), 200).reverse();
  if (spikes.length) {
    tableOf_(body, ['Date', 'Kind', 'Intensity', 'Trigger', 'Gap', 'Fact named', 'Replay', 'Debt', 'Will not change', 'Urge'], spikes.map(function (g) {
      return [labelDate(g.date), g.kind, fmt1_(g.feeling), fmt1_(g.event), fmt1_(g.gap), g.fact, g.replay, g.debt, g.hopeless, g.urge];
    }));
    body.appendParagraph('Intensity and trigger are rated 0 to 10. Gap is intensity minus trigger.');
  } else {
    body.appendParagraph('None logged.');
  }

  // Shared notes
  body.appendParagraph('Notes marked for the appointment').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  const notes = data.checkins.filter(function (c) { return c.share && c.note && c.date >= start && c.date <= end; })
    .sort(function (a, b) { return a.ts - b.ts; });
  if (notes.length) {
    notes.forEach(function (c) { body.appendParagraph(labelDate(c.date) + ': ' + c.note); });
  } else {
    body.appendParagraph('None.');
  }

  body.appendParagraph('Baselines are rolling ' + data.cfg.settings.baselineDays + '-day means. Generated '
    + Utilities.formatDate(new Date(), data.tz, 'MMM d, yyyy HH:mm') + '.').editAsText().setItalic(true);
  const url = doc.getUrl();
  doc.saveAndClose();
  return url;
}
