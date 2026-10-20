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

function opts_(labels) { return labels.map(function (l) { return { label: l }; }); }

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
    { id: 'speed', type: 'choice', title: HEADERS.speed, choices: opts_(VAL.SPEEDS), required: false },
    { id: 'interest', type: 'choice', title: HEADERS.interest, choices: opts_(VAL.LEVELS_UPDOWN), required: false },
    { id: 'talk', type: 'choice', title: HEADERS.talk, choices: opts_(VAL.TALK), required: false },
    { id: 'confidence', type: 'choice', title: HEADERS.confidence, choices: opts_(VAL.CONFIDENCE), required: false },
    { id: 'focus', type: 'choice', title: HEADERS.focus, choices: opts_(VAL.FOCUS), required: false },
    { id: 'irritability', type: 'choice', title: HEADERS.irritability, choices: opts_(VAL.LEVELS), required: false },
    { id: 'anxiety', type: 'choice', title: HEADERS.anxiety, choices: opts_(VAL.LEVELS), required: false },
    { id: 'hopeless', type: 'choice', title: HEADERS.hopeless, choices: opts_(VAL.LEVELS), required: false },
    { id: 'guilt', type: 'choice', title: HEADERS.guilt, choices: opts_(VAL.LEVELS), required: false },
    { id: 'impulse', type: 'choice', title: HEADERS.impulse, choices: opts_(VAL.LEVELS), required: false },
    { id: 'death', type: 'choice', title: HEADERS.death, choices: opts_(VAL.DEATH), required: false },
    { id: 'appetite', type: 'choice', title: HEADERS.appetite, choices: opts_(VAL.APPETITES), required: false },
    { id: 'substances', type: 'checkbox', title: HEADERS.substances, choices: opts_(VAL.SUBSTANCES), required: false }
  ];
  if (signNames && signNames.length) {
    fields.push({
      id: 'signs', type: 'checkbox', title: HEADERS.signs, help: 'The list comes from the Config tab.',
      choices: signNames.map(function (l) { return { label: l }; }), required: false
    });
  }
  return fields;
}

function spikeFields_() {
  const yn = opts_([VAL.YES, VAL.NO]);
  return [
    { id: 's_kind', type: 'choice', title: HEADERS.s_kind, choices: opts_(VAL.SPIKE_KINDS), required: true },
    { id: 's_what', type: 'text', title: HEADERS.s_what, required: true },
    { id: 's_intensity', type: 'scale', title: HEADERS.s_intensity, min: 0, max: 10, low: 'None', high: 'As strong as it gets', required: true },
    { id: 's_event', type: 'scale', title: HEADERS.s_event, min: 0, max: 10, low: 'None or trivial', high: 'Severe', help: 'Rate the trigger, not the feeling. 0 if there is none.', required: true },
    { id: 's_fact', type: 'choice', title: HEADERS.s_fact, choices: opts_([VAL.FACT_YES, VAL.FACT_NO, VAL.FACT_NONE]), required: false },
    { id: 's_frame', type: 'choice', title: HEADERS.s_frame, choices: opts_([VAL.FRAME_VERDICT, VAL.FRAME_ACCOUNT, VAL.FRAME_NONE]), required: false },
    { id: 's_replay', type: 'choice', title: HEADERS.s_replay, choices: yn, required: false },
    { id: 's_debt', type: 'choice', title: HEADERS.s_debt, choices: yn, required: false },
    { id: 's_hopeless', type: 'choice', title: HEADERS.s_hopeless, choices: yn, required: false },
    { id: 's_urge', type: 'choice', title: HEADERS.s_urge, choices: yn, required: false }
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

function createSpikeForm_() {
  const form = FormApp.create('Log a spike');
  applyFormSettings_(form, 'Use when it happens. Not a daily form.');
  addFields_(form, spikeFields_());
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
  const gId = props.getProperty(PROP.FORM_SPIKE_ID);
  if (gId) {
    const form = FormApp.openById(gId);
    const have = formTitles_(form);
    const missing = spikeFields_().filter(function (f) { return !have[f.title]; });
    if (missing.length) addFields_(form, missing);
    report.push('Spike form: ' + missing.length + ' field(s) added.');
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
