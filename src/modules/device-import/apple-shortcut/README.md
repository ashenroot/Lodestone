# Apple Health to the journal (iPhone Shortcut)

Status: draft. These steps were written without an iPhone to test on. The Shortcuts app changes between iOS versions, so action names and layouts may differ a little. The stages below are built so a mismatch shows up early and in one place. If something does not match, the table at the end covers the common causes, and anything else is worth reporting as an issue in the repo.

Optional. The journal works without this. If you are having a rough day, leave it for later.

## What you need first

- Part 1 of `../README.md` finished: you have the **web app URL** (ends in `/exec`) and the **token**, and the Device tab exists.
- An iPhone with the Shortcuts app (it comes with iOS) and Apple Health. An Apple Watch is what feeds sleep and exercise data into Health. Without a watch, steps still come from the phone.
- About 20 minutes.

## Getting the token onto the phone

The token is 64 characters. Typing it is error-prone. Better ways:
- **Universal Clipboard.** If your Mac and iPhone use the same Apple ID and are close together, copy the token on the computer and paste it on the phone.
- **iCloud Notes.** Paste the token into a new note on the computer, open Notes on the phone, copy it from there, then delete the note on both.

Do not send the token by email or text message.

## How this is built

Three stages. Each ends at a checkpoint, and you can stop at any of them.

1. Send made-up numbers, to prove the phone can reach your Sheet.
2. Swap the made-up numbers for real ones from Health.
3. Make it run by itself each morning.

## Stage 1. Send test numbers

1. Open the **Shortcuts** app. On the **Shortcuts** tab, tap **+** (top right). Tap the name at the top and call it `Journal device import`.
2. Tap **Add Action**, search for **Current Date**, and tap it.
3. Tap **Add Action** again, search for **Format Date**, and tap it. Tap the date format and choose **Custom**, then type `yyyy-MM-dd`. This produces a date like 2026-10-21.
4. Tap **Add Action**, search for **Get Contents of URL**, and tap it.
5. Tap the **URL** field and paste the web app URL (ending in `/exec`).
6. Tap **Show More** on that action. Set **Method** to **POST**. Set **Request Body** to **JSON**.
7. Tap **Add new field** and add these, one at a time. For each, choose the type shown, then type the name and the value.

| Type | Name | Value |
|---|---|---|
| Text | `token` | paste the token |
| Text | `source` | `Test` |
| Text | `date` | tap the field, choose the **Formatted Date** variable from step 3 |
| Number | `sleep_hours` | `7` |
| Text | `bedtime` | `23:30` |
| Text | `wake` | `06:30` |

8. Tap **Add Action**, search for **Show Result**, and tap it. This displays the reply.
9. Tap the play button (bottom right) to run it. The first run may ask permission to contact the web address. Tap **Allow**.

**What you should see:** the result pops up as `{"ok":true,"refreshed":true}`. In the Sheet, the Device tab has a new row with today's date and source `Test`, and Daily shows a sleep value from the device.

### Checkpoint A

The phone can reach your Sheet. You can stop here. If the reply was an error, check the table at the end before going on.

## Stage 2. Use real numbers from Health

This stage is the one most likely to need trial and error, because Shortcuts and Health options vary by iOS version. Go one number at a time. After each one, run the Shortcut and look at the Device tab.

The simplest path is steps and exercise first, then sleep. If sleep turns out awkward, keep typing hours slept on the check-in form and send only steps and exercise. That still works.

Add these actions before **Get Contents of URL**. After each group, you will replace the matching test value in the request body with the new result.

### Steps for yesterday

1. **Find Health Samples**. Add filters: **Type** is **Steps**, **Start Date** is **Yesterday**.
2. **Calculate Statistics** on the result, operation **Sum**.
3. In the request body, add a **Number** field named `steps` and set its value to that result.
4. In the request body, add a **Text** field named `activity_date`. For its value, use a **Current Date** adjusted by minus 1 day and formatted `yyyy-MM-dd` (add **Adjust Date**, then **Format Date**, the same way as in Stage 1).

Run it. The Device tab should show yesterday's date with a step count.

### Exercise minutes for yesterday

1. **Find Health Samples**: **Type** is **Exercise Minutes** (or **Apple Exercise Time**), **Start Date** is **Yesterday**.
2. **Calculate Statistics**, **Sum**.
3. Add a **Number** field named `exercise_minutes` with that result.

If **Exercise Minutes** is not in the type list on your iOS version, leave this one out. Delete the field from the body.

### Sleep from last night

1. **Find Health Samples**: **Type** is **Sleep**, **End Date** is within the last 18 hours. If there is a filter for sleep stage or value, keep **Core**, **Deep**, **REM** and plain **Asleep**, and leave out **Awake** and **In Bed**.
2. **Calculate Statistics** on the duration, operation **Sum**. If the result is in seconds, divide by 3600 with a **Calculate** action. This is `sleep_hours`.
3. For bedtime and wake time, sort the same samples by **Start Date**. The first sample's start time, formatted `HH:mm`, is `bedtime`. The last sample's end time, formatted `HH:mm`, is `wake`.
4. Replace the three test sleep fields in the body with these results, and change `source` from `Test` to `Apple Health`.

Run it. Compare the number in the Device tab against what the Health app shows for last night. They should be close. If sleep hours are almost double what you expect, the filter is counting In Bed time as well as asleep time, or both watch and phone samples.

### Checkpoint B

Real numbers arrive in the Device tab. You can stop here and run the Shortcut by hand each morning.

## Stage 3. Make it run by itself

1. In Shortcuts, open the **Automation** tab, tap **+**, and choose **Time of Day**.
2. Pick a time after you normally wake up, such as 9:00, set **Repeat** to **Daily**, and tap **Next**.
3. Choose **Run Shortcut**, then pick `Journal device import`.
4. Turn off **Ask Before Running**, and confirm. Notifications on completion can stay off.

If the phone is locked at that time, the automation may wait until you unlock it. If a morning is missed, run the Shortcut by hand. Posting the same day twice overwrites it with the same numbers, so nothing doubles.

### Checkpoint C

Tomorrow morning, a new row appears on its own. If one does not, run the Shortcut by hand once and check the table below.

## If it fails

| What you see | Likely cause and fix |
|---|---|
| Reply says `unauthorized` | The token was typed or pasted wrong, or it was rotated. Paste it again from **Journal > Show device import details**. |
| Reply says `import is off` | The Config setting **Device import** is Off. Run **Journal > Enable device import** again. |
| Reply says `bad date` | The date is not in `yyyy-MM-dd` form, or it is more than 30 days back or more than a day ahead. Check the Format Date step. |
| Reply says `bad payload`, `bad sleep_hours`, `bad steps` or similar | The named field has the wrong type or is out of range, such as text where a number belongs. Check the table in Stage 1. |
| Reply says `nothing to write` | The body had a token but no data fields. Add at least one field. |
| No reply, a web page, or a sign-in screen | The address is the `/dev` one, or the deployment was not set to **Anyone**. Use the address ending in `/exec` from the Deploy dialog. |
| Shortcuts says it could not connect | Check the phone's internet connection, then run it again. |
| Nothing new appears in the Device tab | Confirm the reply said `{"ok":true}`. Check the date: sleep goes to the date you woke up, activity to the activity date. |
| Sleep hours look doubled | The filter includes In Bed, or counts overlapping watch and phone samples. |
| A Health type is missing | Your iOS version does not offer it. Remove that field from the request body. |
| Reply says `rate limit` | More than 120 posts in an hour, usually from testing in a loop. Wait an hour. |

## Security

The token sits inside the Shortcut. Treat the Shortcut like a password: do not share it, do not export it, and do not post a screenshot of it. If the phone is lost or the Shortcut leaks, choose **Journal > Rotate device token** in the Sheet, then paste the new token into the Shortcut.
