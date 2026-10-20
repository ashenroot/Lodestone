# Apple Health to the Device tab (iPhone Shortcut)

Status: draft. These steps were written without an iPhone to test on. Action
names and options differ a little between iOS versions. Build it, run it by
hand, and fix the steps below where they differ.

The Shortcut reads last night's sleep and yesterday's steps and exercise from
Apple Health and posts them to the web app. See `../payload.md` for the fields.

## Before you start

1. In the sheet, run **Journal > Enable device import**.
2. Deploy the web app and copy its URL and the token (`../README.md`).
3. Test the endpoint from a terminal first. If the `curl` test in `../payload.md`
   returns `{"ok":true}`, the phone side is the only thing left to debug.
4. In Health, confirm your watch is writing sleep data. In Shortcuts, add a
   **Find Health Samples** action and check the type list includes the ones
   below. If a type is missing, drop that field from the payload.

## Build the Shortcut

Create a new Shortcut. Add these actions in order.

**Sleep**

1. **Find Health Samples**: type Sleep, filter End Date is in the last 18 hours,
   and Value is one of the asleep stages (Core, Deep, REM, or plain Asleep).
   Leave out Awake and In Bed.
2. **Calculate Statistics** on the samples' Duration, operation Sum. Convert
   the result to hours (divide by 3600 if it is in seconds). This is `sleep_hours`.
3. From the same samples, **Sort** by Start Date ascending. The first item's
   Start Date, formatted as `HH:mm`, is `bedtime`. The last item's End Date,
   formatted as `HH:mm`, is `wake`.

**Activity for yesterday**

4. **Find Health Samples**: type Steps, filter Start Date is yesterday.
   **Calculate Statistics**, Sum. This is `steps`.
5. **Find Health Samples**: type Exercise Minutes (named Apple Exercise Time in
   some versions), Start Date is yesterday. **Calculate Statistics**, Sum. This
   is `exercise_minutes`.

**Dates**

6. **Current Date**, formatted `yyyy-MM-dd`. This is `date`.
7. **Adjust Date** by minus 1 day, formatted `yyyy-MM-dd`. This is `activity_date`.

**Send**

8. **Dictionary** with these keys: `token`, `source` (text `Apple Health`),
   `date`, `sleep_hours`, `bedtime`, `wake`, `activity_date`, `steps`,
   `exercise_minutes`. Numbers go in as Number items, the rest as Text.
9. **Get Contents of URL**: URL is the web app URL, Method POST, Request Body
   JSON, with the dictionary from step 8. Leave redirects on (the default).
10. Optional: **Show Result** while testing, to see `{"ok":true}`.

## Run it every morning

In Shortcuts, Automation tab, new Personal Automation, trigger Time of Day
(a time after you normally wake, such as 09:00) or the Wake Up alarm trigger.
Set it to Run Immediately so it does not ask each time. Notifications on
completion can stay off.

## If it fails

| Symptom | Likely cause |
|---|---|
| Reply is `unauthorized` | Token typed wrong, or rotated since. |
| Reply is `import is off` | Config setting Device import is Off. Re-run Enable device import. |
| Reply is `bad date` | Date outside the allowed window, or not `yyyy-MM-dd`. |
| No reply, or an HTML page | The URL is the editor or test URL, not the `/exec` deployment URL. |
| Sleep hours look doubled | The sleep filter included In Bed or counted overlapping watch and phone samples. |
| Shortcut cannot find a Health type | Your iOS version does not expose it. Remove that field. |

## Security

The token sits in the Shortcut on your phone. Treat the Shortcut like a
password: do not share it, and do not export it to a repo. If the phone is
lost or the Shortcut leaks, use **Journal > Rotate device token** and edit the
Shortcut.
