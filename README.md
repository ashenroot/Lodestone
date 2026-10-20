# Lodestone

A private mood and early-warning journal built from a Google Form, a Google Sheet
and Apps Script. You fill in a short check-in each day. The sheet draws your own
pattern against your own rolling baseline and holds your warning signs in a list you write.

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

**Appointment summary.** A menu item builds a Google Doc from the last N weeks: measures, days per answer on the check-in detail questions, signs logged, days with signs in more than one tier, spike ratings, and any notes you marked for sharing. The one-line text of spikes and unmarked notes are left out.

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

**5. Paste the code.** Open `Code.gs`, select everything, and replace it with the text of `dist/Lodestone.gs`. Save. Checking the file ends up with about 1,600 lines and starts with `// Lodestone core` catches a truncated paste.

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
| See, create and edit your documents | The appointment summary. |
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
- The sheet, the forms and the summary Doc are private by default. Do not share the sheet. If you share a summary Doc with a clinician, share that Doc only.
- A clinician-facing Doc contains whatever you marked as shareable. Read it before sending.
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

## Appointment summary

**Journal > Appointment summary...** asks for a number of weeks (blank uses the Config value) and creates a Doc in your Drive.

## Changing the forms

The field lists are at the top of `src/core/Forms.gs`. Add a field there and run **Journal > Update forms**. Missing fields are appended to the end of the form. Existing fields are not changed or removed, so rename or reorder in the form editor. The raw response tab captures a new field automatically. To show it on Daily or Pattern, extend `Logic.gs` and `Refresh.gs`.

Question titles are the column headers. Do not rename a question in the form editor without updating `HEADERS` in `Config.gs`.

## What the fields are based on

The check-in and spike questions follow the symptom lists for manic, hypomanic and depressive episodes in DSM-5 and the prodrome literature. Signs differ a lot between people and between episodes, so the form asks about both directions and the tiers are yours to define. See `docs/symptom-basis.md`.

## Exporting your data

Open a tab and choose **File > Download > Comma-separated values (.csv)**. That exports the current tab. Export Check-ins, Spikes, Device and Daily separately. Keep the files out of any repo.

## Device import (optional module)

Sleep, bedtime, wake, steps and exercise from a phone or watch. See `src/modules/device-import/README.md`. It adds a web endpoint that accepts a secret token, so read its security section before enabling it.

## Layout of this repo

```
src/appsscript.json
src/core/                    Config, Logic (pure), Forms, Sheet, Refresh, Setup, Summary
src/modules/device-import/   optional module, payload contract, Apple Shortcut steps
test/logic.test.js           Node tests for the pure logic
tools/bundle.sh              builds single-file copies into dist/
dist/                        single-file copies for pasting into the editor
```

Run the tests with `npm test`. Rebuild `dist/` with `npm run bundle`. The tests cover the logic: day rollover, baselines, sign rules, stacking, payload validation.

## Limits

- The Apps Script parts (forms, tabs, charts, the Doc, the web app) were written without a Google runtime to run them against. The logic is tested. The glue is not. Expect to fix small things on the first run and report what you see.
- Pattern charts are rebuilt on each refresh. Manual edits to those charts are overwritten.
- Daily and Pattern are written by the script. Formulas typed into them are overwritten.
- Reminders are not implemented.
- No license has been chosen yet. Add one before publishing the repo.
