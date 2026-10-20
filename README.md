# Lodestone

A private mood and early-warning journal built for Bipolar Disorder. It uses a Google Form, a Google Sheet
and Apps Script. You fill in a short check-in each day. The sheet draws your own
pattern against your own rolling baseline and holds your warning signs in a list you write. Includes a reporting engine to provide outputs to medical providers.

This is a tracking and pattern tool. It is not a diagnostic or clinical product.

## What you get

**Forms**
- **Check-in.** Page 1 takes about 20 seconds: mood (1 to 5), hours slept, medication taken, an optional note. Page 2 is optional and covers both poles: energy, thought speed, interest, talkativeness, confidence, concentration, irritability, anxiety or restlessness, hopelessness, guilt or worthlessness, spending or risk urges, thoughts of death, appetite, caffeine and alcohol, and a checklist of your own signs.
- **Log a spike.** A separate on-demand form, never a daily field. Pick the kind (guilt, despair, irritability or anger, agitation or anxiety, a surge of energy or ideas, an urge to spend or take a risk, other), one line on what happened, intensity against trigger rating (0 to 10 each), and a few optional yes/no questions.

**Sheet tabs**
| Tab | What it holds |
|---|---|
| Check-ins, Spikes | Raw form responses. The script never edits them. |
| Daily | One row per calendar date, built by the script. Missed days stay blank. |
| Device | Optional. Sleep, bedtime, wake, steps and exercise from a phone or watch. |
| Pattern | Charts against your 14-day baseline and a 90-day median, signs by tier, spikes with the intensity-minus-trigger gap. |
| Config | Your signs in three tiers, a response step per tier, and settings. |
| Baseline | Text you wrote while clear-headed, pinned for reading. |

**Reports.** **Journal > Report...** builds something to hand a clinician: a Google Doc with embedded charts, a PDF, or a zip of CSV files. The same dialog exports your raw data. See Reports and Exporting your data below.

**Device import (optional).** Sleep duration, bedtime and wake time, steps and exercise minutes from an iPhone and Apple Watch land in a Device tab each morning, so you do not type them. They feed Daily, the Pattern charts, device-based sleep and bedtime drift signs, and the reports. Phone and watch data goes only to your own Sheet. See Device import below.

No streaks. No reminders. Missed days are blank. The charts show the pattern and make no claims about it.

## Quick start

Use a personal Google account, not a work account. Work accounts often block the
permissions this needs. Plan on about 15 minutes.

**1. Get the code.** Open `dist/Lodestone.gs` and `dist/appsscript.json` in this repo and copy the text of each (the Raw view has a copy button). Both files are needed.

**2. Create the Sheet.** Go to [sheets.new](https://sheets.new) and name it. Under **File > Settings**, set the time zone to yours. The script uses it to decide which day an entry belongs to.

**3. Open Apps Script.** In the Sheet, choose **Extensions > Apps Script**.

**4. Paste the manifest.** Apps Script hides `appsscript.json` by default.
1. Click the gear icon (**Project Settings**) in the left sidebar.
2. Tick **Show "appsscript.json" manifest file in editor**.
3. Go back to the editor (the `<>` icon). `appsscript.json` now appears in the file list.
4. Open it and replace everything with the text of `dist/appsscript.json`.
5. Change `"timeZone": "Etc/UTC"` to your zone, for example `"America/New_York"`. Use a region name, not `EST`, so daylight saving is handled. Save.

Leave the `oauthScopes` block in place. Without it the permission prompts do not cover forms and documents.

**5. Paste the code.** Open `Code.gs`, select everything, and replace it with the text of `dist/Lodestone.gs`. Save. A complete paste is about 1,600 lines and starts with `// Lodestone core`. If yours is shorter, the paste was cut off.

**6. Run `setup`.** This is the step people miss.
- Either use the Sheet: reload it, wait a few seconds for the **Journal** menu, and choose **Journal > Run setup**.
- Or use the editor: open the function dropdown next to **Debug**, pick `setup`, and click **Run**.

The **Run** button runs whichever function the dropdown shows. It defaults to the first one alphabetically, which is not `setup`. If nothing seems to happen, open **Executions** in the left sidebar and check the function name on the latest row.

**7. Approve the permissions.** Google says the app is unverified. It is your own script. Choose **Advanced**, then **Go to (project name)**, then **Allow**. The prompts are explained below.

**8. Wait.** Setup creates two forms, links them, builds the tabs and draws Pattern. It takes up to a minute or two. **Executions** shows `Running` until it finishes.

**9. Save the fill-in links.** A **Form links** dialog opens. Bookmark the **Fill in** link for the Check-in form on the device you use it on. The **Edit form** links open the form editor, so skip those.

**10. Check one entry.** Submit a check-in, including the optional detail page. In the Sheet, run **Journal > Refresh Daily and Pattern**. Daily should have a row for today and Pattern should show charts and panels. Baselines need 14 days of history, so the baseline lines stay empty for the first two weeks.

**11. Make Config yours.** Open the Config tab. The signs are examples across both poles. Keep the ones that fit, delete the rest and add your own. Then run **Journal > Update forms from Config and field list** so the check-in's signs checklist matches.

Optional: add `dist/DeviceImport.gs` as a second file for the phone and watch import (see Device import below), and run `setup` once more afterwards so its menu items appear.

`setup` is safe to run again. It only creates what is missing.

### With clasp instead

```
npm install -g @google/clasp
clasp login
clasp create --type sheets --title "Lodestone" --rootDir src
npm run test
clasp push
```

Copy `.clasp.json.example` to `.clasp.json` if you prefer to set the script ID by hand. Set `timeZone` in `src/appsscript.json` before pushing. Then open the sheet, reload, and run `setup` from the **Journal** menu or the editor. `.clasp.json` is git-ignored.

## Permission prompts

Google will say the app is unverified. It is your own script, so choose **Advanced**, then **Go to (project name)**. The scopes, and what each is used for:

| Permission | Used for |
|---|---|
| See, edit, create and delete your spreadsheets | Reading form responses, writing Daily, Pattern and Config. The scope covers your whole account. The script only touches this one sheet. |
| See, create and edit your forms | Creating the two forms and syncing the signs checklist. |
| See, create and edit your documents | Reports (the Doc and PDF). |
| Display and run third-party web content in prompts and sidebars | The Journal menu and its dialogs. |
| Allow this application to run when you are not present | The trigger that refreshes Daily and Pattern after each form submission. |

## If setup or refresh fails

Open **Executions** in the Apps Script editor. Click a row to see its log and error text.

| Symptom | Cause and fix |
|---|---|
| Form links say "not created. Run setup." | `setup` never ran. The editor's Run button ran another function. Use **Journal > Run setup**, or pick `setup` in the dropdown. |
| `setup` fails at `installSubmitTrigger_` with "Unexpected error while getting the method or property create" | Google refused to create the refresh trigger. The forms and tabs are already made. The current code retries and, if it still fails, finishes setup and shows manual steps. By hand: in the editor open **Triggers** (clock icon), **Add Trigger**, function `handleFormSubmit`, event source **From spreadsheet**, event type **On form submit**, Save. Then run setup again. |
| Refresh fails with "The chart option is no longer supported" | Fixed in the current code. Update `Code.gs` from `dist/Lodestone.gs`. Options Sheets rejects are now skipped and logged as warnings. |
| Pattern looks half-built after an error | Run **Journal > Refresh Daily and Pattern**. It clears and rebuilds the tab. |
| No **Journal** menu | Reload the Sheet and wait a few seconds. If it is still missing, check that `Code.gs` holds the full file and that it saved. |
| Permission prompt never appears or the run hangs | Look for a blocked pop-up or a second Google window waiting for approval. |
| Times land on the wrong day | The Sheet time zone (**File > Settings**) or the manifest `timeZone` is wrong. Set both, then refresh. |
| Daily or Pattern did not update after a submission | The trigger is missing. Check **Triggers** for `handleFormSubmit`, or use **Journal > Refresh Daily and Pattern**. |

If a change to a form's questions does not show on Daily, remember that response columns are matched by question title. See Changing the forms.

## Privacy and sharing

- Everything lives in your Google account. Nothing is sent anywhere else. The optional device import sends data from your phone to your own script.
- Google Forms in a personal account do not require sign-in by default. Anyone who has the fill-in link can submit a response. Only you, and anyone you give edit access to, can read responses. Keep the link to yourself.
- To require a Google sign-in on the forms, open each form, go to **Settings > Responses**, and turn on **Collect email addresses** with verification. The setup script does not set this.
- The sheet, the forms and any report Doc are private by default. Do not share the sheet. If you share a report with a clinician, share that Doc, PDF or CSV zip only.
- A report contains what the dialog's checkboxes include, plus notes you marked for sharing. Read it before sending.
- **No entry data goes in a repo.** `.gitignore` blocks CSV and spreadsheet files. If you fork this project, keep it that way.

## Daily use

Fill in the check-in once a day. The Daily date is the date you submit, with one exception: entries before the rollover hour in Config (04:00 by default) count toward the previous day. If you submit twice in a day, the later value for each field wins, and a blank field never erases an earlier answer. The raw tab keeps both submissions.

Daily and Pattern refresh after each form submission. **Journal > Refresh Daily and Pattern** does it by hand, for example after you change a Config setting.

## Config

- **Signs.** One row per way of detecting a sign. Pick the Tier and the Detected by method. A sign detected more than one way has several rows with the same name. It counts once per day.
  - *Checklist tick* puts the sign on page 2 of the check-in form. After you edit the list, run **Journal > Update forms**.
  - *Check-in answer* matches an answer to any detail question. Detail column: `Question: value, value`, for example `Irritability: Some, A lot`. The question is the form's question title.
  - *Spike form: kind* matches the kind of spike logged that day. Detail column: one or more kinds, comma separated, for example `Despair or hopelessness`.
  - *Spike form: replay, verdict, debt framing, will not change, urge* read the matching answer on the spike form.
  - *Keyword in notes* matches whole words from the Detail column (comma separated) in check-in notes and spike one-liners. It runs only when **Keyword scan of notes** is On.
  - *Auto* signs use the thresholds in Settings: sleep drift (short), oversleeping, less sleep with more energy, racing thoughts, slowed thoughts, missed medication, mood above baseline, mood below baseline, bedtime drift.
- The example signs cover both directions: elevated, depressive and mixed. Keep the ones that fit you, delete the rest, and add your own. A sign you do not track costs nothing.
- **Response steps.** Blank by design. Write them with your clinician. The sheet holds them and does not act on them.
- **Settings.** Baseline window, thresholds, stacking window, day rollover, summary length, Pattern window. Edit the value column. Do not rename the labels.
- The example rows are examples. Replace them. Do not insert rows above the tables.

A tier is counted once per distinct sign per day. The Pattern tab shows days with a sign in each tier and days with signs in two or more tiers over the stacking window.

## Baselines

A day's baseline is the mean of the 14 days before it. It needs 14 days of history and at least half of those days filled, so it starts on day 15. The 90-day median needs 30 days of history. Both are drawn behind your data so you can see whether the 14-day line has drifted along with you.

Sleep for baselines and the sleep-drift sign is your self-reported hours when present and the device's when not.

## Reports

**Journal > Report...** opens a dialog.

- **For:** a preset of what to include. *Psychiatrist or prescriber* and *Therapist or counselor* include everything. *Primary care or other clinician* includes coverage, measures and charts only. *Custom* starts from coverage and measures. A preset only fills in the checkboxes. Change any of them before you run.
- **Period:** the last N weeks (blank uses the Config setting), or a date range, which overrides weeks.
- **Include:** coverage, measures, charts, warning signs logged, check-in answers (days per answer), spikes, and notes marked for sharing. A separate box controls the answer to the question on thoughts of death. It is on for the first two presets and off otherwise.
- **Format:**
  - *Google Doc:* tables plus charts for mood, sleep, energy, signs per day, and steps and exercise when device data exists. The Doc is created in your Drive and stays private until you share it.
  - *PDF:* the same Doc as a PDF download. A copy of the Doc is also kept in Drive.
  - *CSV files in a zip:* `daily.csv`, `check-ins.csv`, `spikes.csv`, `signs.csv` and an `about.txt` describing the range and what was left out. The zip is a browser download and is not saved to Drive.

What stays out, always: check-in notes that were not marked "Include this note in the appointment summary" and the one-line text of spikes. For CSV there is an extra box to include all free text. Use it for your own records, not for a clinician. Text that starts with `=`, `+`, `-` or `@` is prefixed in CSV so a spreadsheet does not run it as a formula.

**Appointment summary (quick)** makes a Doc for the prescriber preset using the weeks in Config.

Reports are generated from Daily and the raw tabs. Nothing in them is written back.

## Changing the forms

The field lists are at the top of `src/core/Forms.gs`. Add a field there and run **Journal > Update forms**. Missing fields are appended to the end of the form. Existing fields are not changed or removed, so rename or reorder in the form editor. The raw response tab captures a new field automatically. To show it on Daily or Pattern, extend `Logic.gs` and `Refresh.gs`.

Question titles are the column headers. Do not rename a question in the form editor without updating `HEADERS` in `Config.gs`.

## What the fields are based on

The check-in and spike questions follow the symptom lists for manic, hypomanic and depressive episodes in DSM-5 and the prodrome literature. Signs differ a lot between people and between episodes, so the form asks about both directions and the tiers are yours to define. See `docs/symptom-basis.md`.

## Exporting your data

There are three ways to get data out, depending on who it is for.

**For a clinician: Journal > Report...** See Reports above. Pick the audience, the period and the format. The Doc and PDF carry tables and charts. The CSV zip carries the numbers. Notes that were not marked for sharing and the one-line text of spikes stay out by default, and the thoughts-of-death answer has its own switch.

**For your own records: the CSV zip with free text on.** In **Journal > Report...**, choose *CSV files in a zip* and tick *Include free text*. The zip holds:

| File | Contents |
|---|---|
| `daily.csv` | One row per calendar date, the same columns as the Daily tab. Days with no entry are blank, not zero. |
| `check-ins.csv` | One row per form submission, with every answer. |
| `spikes.csv` | One row per spike logged, with the gap between intensity and trigger rating. |
| `signs.csv` | Days each warning sign was active in the range. |
| `about.txt` | The range, when it was generated, and what was left out. |

Use the longest range you want, up to two years per export. Dates are `YYYY-MM-DD` and timestamps are ISO format, so the files sort and import cleanly into other tools.

**Single tab, by hand.** Open a tab and choose **File > Download > Comma-separated values (.csv)**. That exports the current tab as it is, including free text and the thoughts-of-death answer. Check-ins, Spikes, Device and Daily each export separately. Pattern and Config are not meant for export.

**Handling exports.**
- The zip and PDF are downloads to your device. They are not saved to Drive. The Doc is saved to your Drive and stays private until you share it.
- A clinician export contains health information. Send it through whatever channel the provider uses for records, not an ordinary email attachment if a portal is available.
- Keep exports out of any repo. `.gitignore` blocks `*.csv`, `*.tsv`, `*.xlsx` and `exports/`, and the zip should stay out too. Delete downloaded files you no longer need.
- Backups are your own responsibility. The data lives in the Sheet, and a periodic full export (free text on) is a copy that does not depend on Google.

## Device import (optional module)

The journal works without it. It saves typing, and it gives the baselines and sign detection numbers that do not depend on remembering to log them.

**What it brings in**

| Data | Where it comes from | Where it shows up |
|---|---|---|
| Hours slept | Apple Watch or iPhone, via Apple Health | Daily, Pattern sleep chart, sleep drift and oversleeping signs, reports |
| Bedtime and wake time | Same | Pattern bedtime chart, the bedtime drift sign |
| Steps | iPhone or Apple Watch | Daily, Pattern, reports |
| Exercise minutes | Apple Watch | Daily, Pattern, reports |

Your own typed hours slept always win over the device's number for the same day. Once the module is on, the "Hours slept" question on the check-in becomes optional.

**How it works.** An iPhone Shortcut reads yesterday's numbers from Apple Health each morning and sends them to a web address that belongs to your own Google account. The numbers are written to a Device tab in your Sheet. There is no other server, and nothing else from Health is sent.

**Sources.** The Shortcut guide covers Apple Health. Anything that can send a small JSON message works as well, such as an Android automation or a script for another tracker. Rows can also be typed into the Device tab by hand.

**Security.** The web address works without a Google sign-in, but accepts nothing without a secret token, and it can only add numbers to the Device tab. It cannot read your Sheet. Keep the address and token private.

**Setup.** About 20 to 30 minutes, in stages you can stop between. Written for someone doing it for the first time.
- `src/modules/device-import/README.md`: turning it on and publishing the web address (computer).
- `src/modules/device-import/apple-shortcut/README.md`: the iPhone Shortcut, starting with a test using made-up numbers.
- `src/modules/device-import/payload.md`: the message format, for other sources.

The Apple Health Shortcut steps are a draft written without an iPhone to test on. Expect to adjust a step or two, and report what differs.

## Layout of this repo

```
src/appsscript.json
src/core/                    Config, Logic (pure), ReportModel (pure), Forms, Sheet, Refresh, Setup, Report
src/modules/device-import/   optional module, payload contract, Apple Shortcut steps
test/logic.test.js           Node tests for the pure logic
tools/bundle.sh              builds single-file copies into dist/
dist/                        single-file copies for pasting into the editor
```

Run the tests with `npm test`. Rebuild `dist/` with `npm run bundle`. The tests cover the logic: day rollover, baselines, sign rules, stacking, payload validation, report options and redaction, CSV output.

## Limits

- The Apps Script parts (forms, tabs, charts, the Doc, the web app) were written without a Google runtime to run them against. The logic is tested. The glue is not. Expect to fix small things on the first run and report what you see.
- Report charts, the PDF export and the download dialog have not run against Google yet. If the PDF fails, the dialog says so and the Doc is still there (File > Download > PDF).
- Pattern charts are rebuilt on each refresh. Manual edits to those charts are overwritten.
- Daily and Pattern are written by the script. Formulas typed into them are overwritten.
- Reminders are not implemented.
- No license has been chosen yet. Add one before publishing the repo.
