/**
 * Form definitions. Edit the two field lists to change what the forms ask,
 * then run Journal > Update forms. Fields missing from an existing form are
 * appended at the end. Existing fields are never edited or removed.
 *
 * Titles come from HEADERS in Config.gs, so the response columns match what
 * the Logic reads. A new field is captured in the raw response tab
 * automatically. Showing it on Daily or Pattern needs a change in Logic.gs.
 *
 * Field types: scale, choice, checkbox, text, paragraph, page.
 * A choice may route: goTo 'submit' ends the form, goTo '<page id>' jumps to that page.
 */

function checkinFields_(signNames) {
  const fields = [
    { id: 'mood', type: 'scale', title: HEADERS.mood, min: 1, max: 5, low: 'Low', high: 'High', help: '1 low, 3 level, 5 high', required: true },
    { id: 'sleep', type: 'text', title: HEADERS.sleep, number: [0, 24], help: 'Decimals are fine.', required: true },
    { id: 'med', type: 'choice', title: HEADERS.med, choices: [{ label: VAL.YES }, { label: VAL.NO }], required: true },
    { id: 'note', type: 'paragraph', title: HEADERS.note, required: false },
    { id: 'share', type: 'checkbox', title: HEADERS.share, choices: [{ label: VAL.YES }], help: 'Left blank counts as no.', required: false },
    {
      id: 'next', type: 'choice', title: HEADERS.next, required: true,
      choices: [{ label: VAL.NEXT_SUBMIT, goTo: 'submit' }, { label: VAL.NEXT_DETAIL, goTo: 'detail' }]
    },
    { id: 'detail', type: 'page', title: 'Detail', help: 'Everything on this page is optional. Skip any of it.' },
    { id: 'energy', type: 'scale', title: HEADERS.energy, min: 1, max: 5, low: 'Low', high: 'High', help: '1 low, 3 usual, 5 high', required: false },
    { id: 'speed', type: 'choice', title: HEADERS.speed, choices: VAL.SPEEDS.map(function (l) { return { label: l }; }), required: false },
    { id: 'appetite', type: 'choice', title: HEADERS.appetite, choices: VAL.APPETITES.map(function (l) { return { label: l }; }), required: false },
    { id: 'substances', type: 'checkbox', title: HEADERS.substances, choices: VAL.SUBSTANCES.map(function (l) { return { label: l }; }), required: false }
  ];
  if (signNames && signNames.length) {
    fields.push({
      id: 'signs', type: 'checkbox', title: HEADERS.signs, help: 'The list comes from the Config tab.',
      choices: signNames.map(function (l) { return { label: l }; }), required: false
    });
  }
  return fields;
}

function guiltFields_() {
  const yn = [{ label: VAL.YES }, { label: VAL.NO }];
  return [
    { id: 'g_what', type: 'text', title: HEADERS.g_what, required: true },
    { id: 'g_fact', type: 'choice', title: HEADERS.g_fact, choices: [{ label: VAL.FACT_YES }, { label: VAL.FACT_NO }, { label: VAL.FACT_NONE }], required: true },
    { id: 'g_kind', type: 'choice', title: HEADERS.g_kind, choices: [{ label: VAL.KIND_VERDICT }, { label: VAL.KIND_ACCOUNT }], required: true },
    { id: 'g_intensity', type: 'scale', title: HEADERS.g_intensity, min: 0, max: 10, low: 'None', high: 'As strong as it gets', required: true },
    { id: 'g_event', type: 'scale', title: HEADERS.g_event, min: 0, max: 10, low: 'Trivial', high: 'Severe', help: 'Rate the event, not the feeling.', required: true },
    { id: 'g_replay', type: 'choice', title: HEADERS.g_replay, choices: yn, required: true },
    { id: 'g_debt', type: 'choice', title: HEADERS.g_debt, choices: yn, required: true },
    { id: 'g_urge', type: 'choice', title: HEADERS.g_urge, choices: yn, required: true }
  ];
}

function applyFormSettings_(form, description) {
  form.setDescription(description);
  form.setConfirmationMessage('Saved.');
  form.setAllowResponseEdits(false);
  form.setPublishingSummary(false);
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(false);
  form.setCollectEmail(false);
}

/** Adds the given field definitions to the end of a form. */
function addFields_(form, defs) {
  const pages = {};
  const routed = [];
  defs.forEach(function (f) {
    if (f.type === 'page') {
      const pb = form.addPageBreakItem().setTitle(f.title);
      if (f.help) pb.setHelpText(f.help);
      pages[f.id] = pb;
      return;
    }
    let item;
    switch (f.type) {
      case 'scale':
        item = form.addScaleItem().setBounds(f.min, f.max).setLabels(f.low || '', f.high || '');
        break;
      case 'choice': item = form.addMultipleChoiceItem(); break;
      case 'checkbox': item = form.addCheckboxItem(); break;
      case 'paragraph': item = form.addParagraphTextItem(); break;
      case 'text':
        item = form.addTextItem();
        if (f.number) {
          item.setValidation(FormApp.createTextValidation()
            .setHelpText('Enter a number from ' + f.number[0] + ' to ' + f.number[1] + '.')
            .requireNumberBetween(f.number[0], f.number[1])
            .build());
        }
        break;
      default: throw new Error('Unknown field type: ' + f.type);
    }
    item.setTitle(f.title);
    if (f.help) item.setHelpText(f.help);
    item.setRequired(!!f.required);
    if (f.type === 'choice' || f.type === 'checkbox') {
      const hasRoute = f.choices.some(function (c) { return c.goTo; });
      if (hasRoute) routed.push({ item: item, f: f });
      else item.setChoiceValues(f.choices.map(function (c) { return c.label; }));
    }
  });
  // Routed choices are set last so the page they point to already exists.
  routed.forEach(function (r) {
    r.item.setChoices(r.f.choices.map(function (c) {
      if (c.goTo === 'submit') return r.item.createChoice(c.label, FormApp.PageNavigationType.SUBMIT);
      if (c.goTo && pages[c.goTo]) return r.item.createChoice(c.label, pages[c.goTo]);
      return r.item.createChoice(c.label);
    }));
  });
}

function createCheckinForm_(signNames) {
  const form = FormApp.create('Check-in');
  applyFormSettings_(form, 'Mood, sleep, medication. The detail page is optional.');
  addFields_(form, checkinFields_(signNames));
  return form;
}

function createGuiltForm_() {
  const form = FormApp.create('Log a guilt spike');
  applyFormSettings_(form, 'Use when it happens. Not a daily form.');
  addFields_(form, guiltFields_());
  return form;
}

function formTitles_(form) {
  const t = {};
  form.getItems().forEach(function (it) { t[it.getTitle()] = it; });
  return t;
}

/**
 * Appends fields the form does not have yet and syncs the signs checklist
 * with the Config tab. Run from Journal > Update forms.
 * Returns a short report string.
 */
function updateForms() {
  const ss = getSS_();
  const props = PropertiesService.getScriptProperties();
  const cfg = readConfig_(ss);
  const signNames = checklistSigns_(cfg.signs);
  const report = [];

  const ciId = props.getProperty(PROP.FORM_CHECKIN_ID);
  if (ciId) {
    const form = FormApp.openById(ciId);
    const have = formTitles_(form);
    const missing = checkinFields_(signNames).filter(function (f) { return f.type !== 'page' && f.id !== 'signs' && !have[f.title]; });
    if (missing.length) addFields_(form, missing);
    report.push('Check-in form: ' + missing.length + ' field(s) added.');
    report.push(syncSignsChecklist_(form, signNames));
  }
  const gId = props.getProperty(PROP.FORM_GUILT_ID);
  if (gId) {
    const form = FormApp.openById(gId);
    const have = formTitles_(form);
    const missing = guiltFields_().filter(function (f) { return !have[f.title]; });
    if (missing.length) addFields_(form, missing);
    report.push('Guilt form: ' + missing.length + ' field(s) added.');
  }
  const text = report.join('\n');
  try { SpreadsheetApp.getUi().alert('Update forms', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* no UI */ }
  return text;
}

/** Sets the "Signs I noticed" checkbox choices from the Config tab. */
function syncSignsChecklist_(form, signNames) {
  const have = formTitles_(form);
  const item = have[HEADERS.signs];
  if (!signNames.length) {
    return item ? 'Signs checklist: Config has no "Checklist tick" signs. The form item was left as it is.' : 'Signs checklist: none configured.';
  }
  if (item) {
    item.asCheckboxItem().setChoiceValues(signNames);
    return 'Signs checklist: updated to ' + signNames.length + ' item(s).';
  }
  addFields_(form, [{
    id: 'signs', type: 'checkbox', title: HEADERS.signs, help: 'The list comes from the Config tab.',
    choices: signNames.map(function (l) { return { label: l }; }), required: false
  }]);
  return 'Signs checklist: added with ' + signNames.length + ' item(s).';
}

/** Unique sign names that use the checklist, in Config order. */
function checklistSigns_(signs) {
  const seen = {};
  const out = [];
  signs.forEach(function (s) {
    if (s.detector === DETECTORS.CHECKLIST && !seen[s.sign]) { seen[s.sign] = true; out.push(s.sign); }
  });
  return out;
}
