/**
 * Reporting engine, Apps Script part. Journal > Report... opens a dialog.
 * The content and privacy rules are in ReportModel.gs (pure, tested).
 * This file renders: a Google Doc with embedded charts, a PDF of that Doc,
 * or a zip of CSV files. Files are handed to the browser as a download. They
 * are not written to Drive, except the Doc, which Drive holds in your account.
 */

function fmt1_(v) {
  if (v === null || v === undefined) return '';
  return String(Math.round(v * 10) / 10);
}

function tableOf_(body, header, rows) {
  const t = body.appendTable([header].concat(rows));
  for (let c = 0; c < header.length; c++) t.getCell(0, c).editAsText().setBold(true);
  return t;
}

// ---------- entry points ----------

/** Journal > Report... */
function reportDialog() {
  const cfg = readConfig_(getSS_());
  const boot = {
    weeks: cfg.settings.summaryWeeks,
    audiences: REPORT_AUDIENCES,
    sections: REPORT_SECTIONS
  };
  const html = HtmlService.createHtmlOutput(reportDialogHtml_(boot)).setWidth(480).setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'Report');
}

/** Journal > Appointment summary (quick). A Doc for the mental health provider preset, using the Config weeks. */
function appointmentSummary() {
  const ui = SpreadsheetApp.getUi();
  const res = runReport({ audience: 'mental', format: 'doc' });
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px"><p>Created. It is private to your account until you share it.</p>'
    + '<p><a href="' + res.url + '" target="_blank">Open the report</a></p></div>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(360).setHeight(150), 'Appointment summary');
}

/**
 * Called by the dialog. raw: { audience, weeks, from, to, sections:{}, includeDeath, includeText, format }.
 * Returns { kind:'doc', url } or { kind:'file', name, mime, base64, url? }.
 */
function runReport(raw) {
  const data = loadAll_();
  const opts = normalizeReportOpts(raw, data.cfg.settings, data.today);
  const generated = Utilities.formatDate(new Date(), data.tz, 'MMM d, yyyy HH:mm');
  const model = buildReportModel({ rows: data.daily.rows, spikes: data.spikes, checkins: data.checkins, steps: data.cfg.steps }, opts);

  if (opts.format === 'csv') {
    const blobs = [
      Utilities.newBlob(dailyCsv(data.daily.rows, opts), 'text/csv', 'daily.csv'),
      Utilities.newBlob(checkinsCsv(data.checkins, opts), 'text/csv', 'check-ins.csv'),
      Utilities.newBlob(spikesCsv(data.spikes, opts), 'text/csv', 'spikes.csv'),
      Utilities.newBlob(signsCsv(model.rows, opts), 'text/csv', 'signs.csv'),
      Utilities.newBlob(csvAboutText(opts, generated), 'text/plain', 'about.txt')
    ];
    const name = 'lodestone-export-' + opts.start + '-to-' + opts.end + '.zip';
    const zip = Utilities.zip(blobs, name);
    return { kind: 'file', name: name, mime: 'application/zip', base64: Utilities.base64Encode(zip.getBytes()) };
  }

  const built = renderReportDoc_(data, model, generated);
  if (opts.format === 'pdf') {
    try {
      const pdf = DocumentApp.openById(built.id).getAs('application/pdf');
      return {
        kind: 'file', name: 'lodestone-report-' + opts.start + '-to-' + opts.end + '.pdf', mime: 'application/pdf',
        base64: Utilities.base64Encode(pdf.getBytes()), url: built.url
      };
    } catch (err) {
      console.error('PDF export failed: ' + err);
      return { kind: 'doc', url: built.url, note: 'PDF export failed here. Open the Doc and use File > Download > PDF.' };
    }
  }
  return { kind: 'doc', url: built.url };
}

// ---------- Doc ----------

function renderReportDoc_(data, model, generated) {
  const opts = model.opts;
  const doc = DocumentApp.create('Report ' + opts.start + ' to ' + opts.end);
  const body = doc.getBody();
  const H2 = DocumentApp.ParagraphHeading.HEADING2;

  body.appendParagraph('Mood and early-warning report').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(labelDate(opts.start) + ' to ' + labelDate(opts.end) + ', ' + opts.days
    + ' days. Source: personal tracking sheet. Values are self-reported unless marked device.');
  if (opts.intro) body.appendParagraph(opts.intro);

  if (model.current) {
    body.appendParagraph('Right now').setHeading(H2);
    const c = model.current;
    body.appendParagraph('Last 7 days, ' + labelDate(c.from) + ' to ' + labelDate(c.to) + ', against the average of the 14 days before.');
    if (c.measures.length) {
      tableOf_(body, ['Measure', 'Last 7 days mean', 'Baseline'], c.measures.map(function (m) {
        return [m.label, fmt1_(m.recent.mean), m.baseline === null ? 'not yet available' : fmt1_(m.baseline)];
      }));
    }
    if (c.signs.length) {
      tableOf_(body, ['Tier', 'Warning sign', 'Days in the last 7'], c.signs.map(function (e) {
        return [e.tier, e.sign, String(e.days)];
      }));
    } else {
      body.appendParagraph('No warning signs active in the last 7 days.');
    }
    body.appendParagraph('Days with a sign in each tier: early ' + c.stack.Early + ', middle ' + c.stack.Middle + ', late ' + c.stack.Late
      + '. Days with signs in two or more tiers: ' + c.stack.multi + '.');
  }

  if (model.plan) {
    body.appendParagraph('Response steps').setHeading(H2);
    const written = model.plan.filter(function (p) { return p.step; });
    if (written.length) {
      tableOf_(body, ['When', 'What we agreed'], written.map(function (p) { return [p.tier + ' signs', p.step]; }));
    } else {
      body.appendParagraph('No response steps have been written yet.');
    }
  }

  if (model.coverage) {
    body.appendParagraph('Coverage').setHeading(H2);
    body.appendParagraph('Entries on ' + model.coverage.withEntry + ' of ' + model.coverage.days
      + ' days. Medication marked not taken on ' + model.coverage.missedMed + ' day(s).');
  }

  if (model.measures) {
    body.appendParagraph('Measures').setHeading(H2);
    if (model.measures.length) {
      tableOf_(body, ['Measure', 'Days with data', 'Mean', 'Min', 'Max', 'Last 14 days mean'], model.measures.map(function (m) {
        return [m.label, String(m.n), fmt1_(m.mean), fmt1_(m.min), fmt1_(m.max), fmt1_(m.recentMean)];
      }));
    } else {
      body.appendParagraph('No measures logged in this range.');
    }
  }

  if (model.charts) {
    body.appendParagraph('Charts').setHeading(H2);
    const specs = chartSpecs_(model.rows);
    let drawn = 0;
    model.charts.forEach(function (title) {
      const spec = specs.filter(function (s) { return s.title === title; })[0];
      if (!spec || !specHasData_(spec, model.rows)) return;
      try {
        const blob = chartBlob_(spec, model.rows);
        const img = body.appendImage(blob);
        img.setWidth(520).setHeight(195);
        drawn++;
      } catch (err) {
        console.warn('Chart skipped in report: ' + title + ': ' + err);
      }
    });
    if (!drawn) body.appendParagraph('No chart data in this range.');
    else body.appendParagraph('Lines are the daily entry (and device value where shown) with the rolling baseline. Gaps are days with no entry.').editAsText().setItalic(true);
  }

  if (model.signs) {
    body.appendParagraph('Warning signs logged').setHeading(H2);
    if (model.signs.tally.length) {
      tableOf_(body, ['Tier', 'Sign', 'Days', 'First', 'Last'], model.signs.tally.map(function (e) {
        return [e.tier, e.sign, String(e.days), labelDate(e.first), labelDate(e.last)];
      }));
    } else {
      body.appendParagraph('None logged.');
    }
    const md = model.signs.multiDays;
    body.appendParagraph('Days with signs in two or more tiers: ' + md.length
      + (md.length ? ' (' + md.slice(-20).map(labelDate).join(', ') + ')' : '') + '.');
  }

  if (model.answers) {
    body.appendParagraph('Check-in answers, days per answer').setHeading(H2);
    if (model.answers.length) {
      tableOf_(body, ['Question', 'Days per answer', 'Days answered'], model.answers.map(function (f) {
        return [f.field, f.answers.map(function (a) { return a.value + ' ' + a.days; }).join(', '), String(f.total)];
      }));
    } else {
      body.appendParagraph('No detail pages filled in.');
    }
  }

  if (model.spikes) {
    body.appendParagraph('Spikes').setHeading(H2);
    if (model.spikes.length) {
      tableOf_(body, ['Date', 'Kind', 'Intensity', 'Trigger', 'Gap', 'Fact named', 'Replay', 'Debt', 'Will not change', 'Urge'], model.spikes.map(function (g) {
        return [labelDate(g.date), g.kind, fmt1_(g.feeling), fmt1_(g.event), fmt1_(g.gap), g.fact, g.replay, g.debt, g.hopeless, g.urge];
      }));
      body.appendParagraph('Intensity and trigger are rated 0 to 10. Gap is intensity minus trigger.');
    } else {
      body.appendParagraph('None logged.');
    }
  }

  if (model.notes) {
    body.appendParagraph('Notes marked for sharing').setHeading(H2);
    if (model.notes.length) model.notes.forEach(function (n) { body.appendParagraph(labelDate(n.date) + ': ' + n.text); });
    else body.appendParagraph('None.');
  }

  body.appendParagraph(reportRedactions(opts).join(' ') + ' Baselines are rolling ' + data.cfg.settings.baselineDays
    + '-day means. Generated ' + generated + '. Tracking tool, not a diagnostic.').editAsText().setItalic(true);

  const id = doc.getId();
  const url = doc.getUrl();
  doc.saveAndClose();
  return { id: id, url: url };
}

function specHasData_(spec, rows) {
  return rows.some(function (r) {
    return spec.pick(r).some(function (v) { return v !== '' && v !== null && v !== undefined && v !== 0; });
  });
}

/** Renders one chart spec as a PNG using the Charts service (no sheet needed). */
function chartBlob_(spec, rows) {
  const dt = Charts.newDataTable();
  spec.headers.forEach(function (h, i) { dt.addColumn(i === 0 ? Charts.ColumnType.STRING : Charts.ColumnType.NUMBER, h); });
  rows.forEach(function (r) {
    dt.addRow([labelDate(r.date)].concat(spec.pick(r).map(function (v) { return v === '' ? null : v; })));
  });
  const builder = spec.type === 'columns' ? Charts.newColumnChart().setStacked() : Charts.newLineChart();
  builder.setDataTable(dt.build())
    .setTitle(spec.title)
    .setDimensions(640, 240)
    .setLegendPosition(Charts.Position.BOTTOM)
    .setColors(spec.series.map(function (s) { return s.color || '#1F6F8B'; }));
  if (spec.vMin !== undefined && spec.vMax !== undefined && spec.type !== 'columns') builder.setRange(spec.vMin, spec.vMax);
  return builder.build().getAs('image/png');
}

// ---------- dialog ----------

function reportDialogHtml_(boot) {
  const data = JSON.stringify(boot).replace(/</g, '\\u003c');
  return '<!doctype html><html><head><base target="_top"><style>'
    + 'body{font-family:Arial,sans-serif;font-size:14px;color:#1B1F23;margin:16px;line-height:1.4}'
    + 'h3{margin:16px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#565F68}'
    + 'label{display:block;margin:3px 0}select,input[type=number],input[type=date]{font-size:14px;padding:4px}'
    + 'button{font-size:14px;padding:8px 16px;margin-top:16px}.muted{color:#565F68;font-size:12px}'
    + '#out{margin-top:14px}.row{display:flex;gap:12px;align-items:center}</style></head><body>'
    + '<h3>For</h3><select id="aud"></select>'
    + '<h3>Period</h3><div class="row"><label>Last <input id="weeks" type="number" min="1" max="104" style="width:60px"> weeks</label></div>'
    + '<div class="muted" style="margin-top:6px">Or a date range (overrides weeks)</div>'
    + '<div class="row"><input id="from" type="date"> to <input id="to" type="date"></div>'
    + '<h3>Include</h3><div id="secs"></div>'
    + '<label><input type="checkbox" id="death"> Answer to the question on thoughts of death</label>'
    + '<h3>Format</h3>'
    + '<label><input type="radio" name="fmt" value="doc" checked> Google Doc</label>'
    + '<label><input type="radio" name="fmt" value="pdf"> PDF</label>'
    + '<label><input type="radio" name="fmt" value="csv"> CSV files in a zip</label>'
    + '<label id="textrow" style="display:none"><input type="checkbox" id="text"> Include free text (all notes and spike one-liners)</label>'
    + '<button id="go">Create report</button><div id="out"></div>'
    + '<script>var B=' + data + ';'
    + 'var $=function(i){return document.getElementById(i)};'
    + 'B.audiences.forEach(function(a){var o=document.createElement("option");o.value=a.key;o.textContent=a.label;$("aud").appendChild(o)});'
    + 'B.sections.forEach(function(s){var l=document.createElement("label");l.innerHTML="<input type=checkbox data-k=\\""+s.key+"\\"> "+s.label;$("secs").appendChild(l)});'
    + '$("weeks").value=B.weeks;'
    + 'function preset(){var a=B.audiences.filter(function(x){return x.key===$("aud").value})[0];'
    + 'document.querySelectorAll("#secs input").forEach(function(c){c.checked=!!a.sections[c.getAttribute("data-k")]});$("death").checked=!!a.death;$("weeks").value=a.weeks||B.weeks}'
    + 'preset();$("aud").onchange=preset;'
    + 'function fmt(){return document.querySelector("input[name=fmt]:checked").value}'
    + 'document.querySelectorAll("input[name=fmt]").forEach(function(r){r.onchange=function(){$("textrow").style.display=fmt()==="csv"?"block":"none"}});'
    + 'function fail(e){$("go").disabled=false;$("out").textContent="Failed: "+(e&&e.message?e.message:e)}'
    + 'function done(r){$("go").disabled=false;var o=$("out");o.innerHTML="";'
    + 'if(r.kind==="doc"){var p=document.createElement("p");p.innerHTML="Created. It is private to your account until you share it. <a target=_blank href=\\""+r.url+"\\">Open the report</a>";o.appendChild(p);if(r.note){var n=document.createElement("p");n.textContent=r.note;o.appendChild(n)}return}'
    + 'var bin=atob(r.base64),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);'
    + 'var url=URL.createObjectURL(new Blob([u],{type:r.mime}));var a=document.createElement("a");a.href=url;a.download=r.name;a.textContent="Download "+r.name;o.appendChild(a);'
    + 'if(r.url){var d=document.createElement("p");d.className="muted";d.innerHTML="A copy was also created as a Google Doc: <a target=_blank href=\\""+r.url+"\\">open</a>.";o.appendChild(d)}'
    + 'a.click()}'
    + '$("go").onclick=function(){var s={};document.querySelectorAll("#secs input").forEach(function(c){s[c.getAttribute("data-k")]=c.checked});'
    + 'var raw={audience:$("aud").value,weeks:$("weeks").value,from:$("from").value,to:$("to").value,sections:s,includeDeath:$("death").checked,includeText:$("text").checked,format:fmt()};'
    + '$("go").disabled=true;$("out").textContent="Working. This can take up to a minute.";'
    + 'google.script.run.withSuccessHandler(done).withFailureHandler(fail).runReport(raw)};'
    + '</script></body></html>';
}
