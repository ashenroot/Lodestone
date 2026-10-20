/**
 * Setup and menu. Run setup() once from the script editor. It is safe to
 * run again. It only creates what is missing.
 */

function onOpen() {
  const menu = SpreadsheetApp.getUi().createMenu('Journal')
    .addItem('Show form links', 'showFormLinks')
    .addItem('Refresh Daily and Pattern', 'refreshFromMenu')
    .addItem('Appointment summary...', 'appointmentSummary')
    .addSeparator()
    .addItem('Update forms from Config and field list', 'updateForms')
    .addItem('Run setup', 'setup');
  // Optional modules add their own items. The core works without them.
  if (typeof addDeviceMenu_ === 'function') addDeviceMenu_(menu);
  menu.addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from a Google Sheet (Extensions > Apps Script), then run setup again.');
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP.SHEET_ID, ss.getId());

  buildConfigTab_(ss);
  buildBaselineTab_(ss);
  const cfg = readConfig_(ss);
  const signNames = checklistSigns_(cfg.signs);

  let checkin = openFormOrNull_(props.getProperty(PROP.FORM_CHECKIN_ID));
  if (!checkin) {
    checkin = createCheckinForm_(signNames);
    props.setProperty(PROP.FORM_CHECKIN_ID, checkin.getId());
  }
  linkForm_(ss, checkin, TABS.CHECKINS);

  let guilt = openFormOrNull_(props.getProperty(PROP.FORM_GUILT_ID));
  if (!guilt) {
    guilt = createGuiltForm_();
    props.setProperty(PROP.FORM_GUILT_ID, guilt.getId());
  }
  linkForm_(ss, guilt, TABS.GUILT);

  installSubmitTrigger_(ss);
  refreshAll();
  orderTabs_(ss);
  removeDefaultSheet_(ss);
  showFormLinks();
}

function openFormOrNull_(id) {
  if (!id) return null;
  try { return FormApp.openById(id); } catch (err) { return null; }
}

/** The response tab a form writes to, or null. */
function findResponseSheet_(ss, form) {
  const id = form.getId();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const url = sheets[i].getFormUrl();
    if (!url) continue;
    try {
      if (FormApp.openByUrl(url).getId() === id) return sheets[i];
    } catch (err) { /* form not readable, skip */ }
  }
  return null;
}

/** Links a form to the spreadsheet and renames its response tab. Skips if already linked. */
function linkForm_(ss, form, tabName) {
  let sheet = findResponseSheet_(ss, form);
  if (!sheet) {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    for (let attempt = 0; attempt < 6 && !sheet; attempt++) {
      SpreadsheetApp.flush();
      Utilities.sleep(1000);
      sheet = findResponseSheet_(ss, form);
    }
  }
  if (!sheet) throw new Error('Linked the form but could not find its response tab. Check the spreadsheet for a tab named "Form Responses" and rename it to "' + tabName + '".');
  if (sheet.getName() !== tabName) {
    const clash = ss.getSheetByName(tabName);
    if (clash && clash.getSheetId() !== sheet.getSheetId()) {
      throw new Error('A tab named "' + tabName + '" already exists and is not this form\'s response tab. Rename or delete it, then run setup again.');
    }
    sheet.setName(tabName);
  }
}

function installSubmitTrigger_(ss) {
  const exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'handleFormSubmit'; });
  if (!exists) ScriptApp.newTrigger('handleFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
}

function showFormLinks() {
  const props = PropertiesService.getScriptProperties();
  const items = [
    ['Check-in', openFormOrNull_(props.getProperty(PROP.FORM_CHECKIN_ID))],
    ['Log a guilt spike', openFormOrNull_(props.getProperty(PROP.FORM_GUILT_ID))]
  ];
  let html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">';
  html += '<p>Bookmark the fill-in links. The edit links open the form editor.</p>';
  items.forEach(function (it) {
    if (!it[1]) { html += '<p>' + it[0] + ': not created. Run setup.</p>'; return; }
    html += '<p><b>' + it[0] + '</b><br>'
      + '<a href="' + it[1].getPublishedUrl() + '" target="_blank">Fill in</a> &nbsp; '
      + '<a href="' + it[1].getEditUrl() + '" target="_blank">Edit form</a></p>';
  });
  html += '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(240), 'Form links');
}
