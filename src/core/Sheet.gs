/**
 * Spreadsheet helpers and the static tabs (Config, Baseline).
 * Pattern and Daily are written by Refresh.gs.
 */

/** The journal spreadsheet. Uses the stored ID so triggers and web apps find it too. */
function getSS_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP.SHEET_ID);
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function styleHeader_(range) {
  range.setFontWeight('bold').setBackground('#F1F3F5').setFontColor('#1B1F23');
}

function styleTable_(range) {
  range.setBorder(true, true, true, true, true, true, '#D5D9DD', SpreadsheetApp.BorderStyle.SOLID);
}

/** Config tab. Written once. Existing cells are never overwritten, only missing settings are added. */
function buildConfigTab_(ss) {
  let sh = ss.getSheetByName(TABS.CONFIG);
  const fresh = !sh;
  if (!sh) sh = ss.insertSheet(TABS.CONFIG);
  const L = CFG_LAYOUT;

  sh.getRange('A1').setValue('Config').setFontSize(18).setFontWeight('bold');
  sh.getRange('A2').setValue('The warning signature and the response steps live here. The rows below are examples. Replace them with your own. Response steps are blank on purpose.');
  sh.getRange('A3').setValue('Do not insert rows above the tables. Add signs in the empty rows of the Signs table.');
  sh.getRange('A2:A3').setFontColor('#565F68');

  sh.getRange(L.signsLabelRow, 1).setValue('Signs').setFontWeight('bold').setFontSize(12);
  sh.getRange(L.signsHeaderRow, 1, 1, 5).setValues([['Tier', 'Sign', 'Detected by', 'Detail', 'Note']]);
  styleHeader_(sh.getRange(L.signsHeaderRow, 1, 1, 5));
  styleTable_(sh.getRange(L.signsHeaderRow, 1, L.signsRows + 1, 5));

  sh.getRange(L.stepsLabelRow, 1).setValue('Response steps').setFontWeight('bold').setFontSize(12);
  sh.getRange(L.stepsHeaderRow, 1, 1, 2).setValues([['Tier', 'Step']]);
  styleHeader_(sh.getRange(L.stepsHeaderRow, 1, 1, 2));
  sh.getRange(L.stepsFirstRow, 1, 3, 1).setValues([['Early'], ['Middle'], ['Late']]);
  styleTable_(sh.getRange(L.stepsHeaderRow, 1, 4, 2));
  sh.getRange(L.stepsFirstRow, 2, 3, 1).setWrap(true);
  sh.getRange(L.stepsFirstRow + 3, 1).setValue('Left blank. Write these with your clinician.').setFontColor('#565F68');

  sh.getRange(L.settingsLabelRow, 2).setValue('Settings').setFontWeight('bold').setFontSize(12);
  sh.getRange(L.settingsHeaderRow, 2, 1, 2).setValues([['Setting', 'Value']]);
  styleHeader_(sh.getRange(L.settingsHeaderRow, 2, 1, 2));

  if (fresh) {
    sh.getRange(L.signsFirstRow, 1, SEED_SIGNS.length, 5).setValues(SEED_SIGNS);
  }
  ensureSettings_(sh);
  styleTable_(sh.getRange(L.settingsHeaderRow, 2, SETTINGS.length + 1, 2));

  const tierRule = SpreadsheetApp.newDataValidation().requireValueInList(TIERS, true).setAllowInvalid(false).build();
  sh.getRange(L.signsFirstRow, 1, L.signsRows, 1).setDataValidation(tierRule);
  const detectorRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(DETECTORS).map(function (k) { return DETECTORS[k]; }), true)
    .setAllowInvalid(false).build();
  sh.getRange(L.signsFirstRow, 3, L.signsRows, 1).setDataValidation(detectorRule);

  const onOff = SpreadsheetApp.newDataValidation().requireValueInList(['On', 'Off'], true).setAllowInvalid(false).build();
  SETTINGS.forEach(function (s, i) {
    if (s.key === 'keywordScan') sh.getRange(L.settingsFirstRow + i, 3).setDataValidation(onOff);
  });

  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 340);
  sh.setColumnWidth(3, 200);
  sh.setColumnWidth(4, 260);
  sh.setColumnWidth(5, 260);
  sh.setHiddenGridlines(true);
  return sh;
}

/** Adds any setting whose label is not in the Settings table yet. */
function ensureSettings_(sh) {
  const L = CFG_LAYOUT;
  const span = SETTINGS.length + 20;
  // Text format first, so a value like 04:00 is stored as text and not converted to a time.
  sh.getRange(L.settingsFirstRow, 3, span, 1).setNumberFormat('@');
  const labels = sh.getRange(L.settingsFirstRow, 2, span, 1).getValues().map(function (r) { return String(r[0]).trim(); });
  SETTINGS.forEach(function (s) {
    if (labels.indexOf(s.label) !== -1) return;
    const slot = labels.indexOf('');
    if (slot === -1) return;
    labels[slot] = s.label;
    sh.getRange(L.settingsFirstRow + slot, 2, 1, 2).setValues([[s.label, String(s.value)]]);
  });
}

/** Writes one setting value by key. Returns false if the label is not found. */
function setSetting_(ss, key, value) {
  const sh = ss.getSheetByName(TABS.CONFIG);
  if (!sh) return false;
  const def = SETTINGS.filter(function (s) { return s.key === key; })[0];
  if (!def) return false;
  const L = CFG_LAYOUT;
  const labels = sh.getRange(L.settingsFirstRow, 2, SETTINGS.length + 20, 1).getValues();
  for (let i = 0; i < labels.length; i++) {
    if (String(labels[i][0]).trim() === def.label) {
      sh.getRange(L.settingsFirstRow + i, 3).setNumberFormat('@').setValue(String(value));
      return true;
    }
  }
  return false;
}

/** Baseline tab: pinned text written while clear-headed. Never overwritten once the tab exists. */
function buildBaselineTab_(ss) {
  if (ss.getSheetByName(TABS.BASELINE)) return ss.getSheetByName(TABS.BASELINE);
  const sh = ss.insertSheet(TABS.BASELINE);
  sh.getRange('A1').setValue('Baseline').setFontSize(18).setFontWeight('bold');
  sh.getRange('A2').setValue('Written when clear-headed. Pinned here to read.').setFontColor('#565F68');
  sh.getRange('A4').setValue('Written on [date]').setFontColor('#565F68');
  sh.getRange('A5').setValue('[Paste your text here.]').setFontSize(14).setWrap(true).setVerticalAlignment('top');
  sh.setColumnWidth(1, 760);
  sh.setRowHeight(5, 320);
  sh.setHiddenGridlines(true);
  return sh;
}

/** Puts the tabs in a fixed order. Missing tabs are skipped. */
function orderTabs_(ss) {
  const order = [TABS.CHECKINS, TABS.GUILT, TABS.DAILY, TABS.DEVICE, TABS.PATTERN, TABS.CONFIG, TABS.BASELINE, TABS.CHART];
  let pos = 1;
  order.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(pos);
    pos++;
  });
  const pattern = ss.getSheetByName(TABS.PATTERN);
  if (pattern) ss.setActiveSheet(pattern);
}

/** Removes the default empty "Sheet1" if other tabs exist. */
function removeDefaultSheet_(ss) {
  const sh = ss.getSheetByName('Sheet1');
  if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0 && sh.getLastColumn() === 0) ss.deleteSheet(sh);
}
