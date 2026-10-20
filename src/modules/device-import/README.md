# Device import

Optional. It brings sleep and activity numbers from a phone or watch into the journal, so you do not have to type them. The journal works fully without it. Skip it on a rough day. Nothing in the core depends on it.

Allow 20 to 30 minutes for the whole thing, in two parts. Part 1 is on a computer, in the Sheet. Part 2 is on the phone: see `apple-shortcut/README.md`. Each part ends at a checkpoint. You can stop at any checkpoint and come back later. Nothing is left half-installed in a way that breaks the journal.

## What it does

Each morning the phone sends a small set of numbers to your own Google Sheet:

| Sent | Example |
|---|---|
| Hours slept last night | 6.4 |
| Bedtime and wake time | 00:52 and 06:41 |
| Steps yesterday | 4,120 |
| Exercise minutes yesterday | 12 |

Nothing else leaves the phone. No heart rate, location, workouts list or anything else from Health. The numbers go to a Google Apps Script web address that belongs to your own account and are written to a `Device` tab in your Sheet. There is no other server.

What changes in the journal once it is on:
- A **Device** tab fills in, one row per date.
- **Daily** gets device columns for sleep, bedtime, wake, steps and exercise.
- **Pattern** draws charts for steps, exercise, device sleep, and bedtime and wake time.
- Sleep drift and oversleeping signs, and the bedtime drift sign, can run from device sleep when you did not type your own hours.
- **Reports** can include device charts and measures.
- The "Hours slept" question on the check-in form becomes optional. If you answer it, your own answer wins over the device's.

## Before you start

You need:
- The journal already set up and working (the main README, Quick start, finished).
- A computer with the Sheet open.
- An iPhone, if you are using the Apple Health Shortcut. Other sources are listed at the end.

## Part 1. Turn it on (computer)

### Step 1. Add the module code

1. In the Sheet, choose **Extensions > Apps Script**.
2. In the left sidebar, next to **Files**, click the **+** and choose **Script**.
3. Name it `DeviceImport` and press Enter. (Apps Script adds `.gs`.)
4. Open `dist/DeviceImport.gs` in this repo, copy all of it, and paste it into the new file, replacing anything already there.
5. Click the save icon, or press Ctrl+S (Cmd+S on a Mac).

You should see: two files in the list, `Code` and `DeviceImport`.

### Step 2. Turn the module on

1. Go back to the Sheet tab and reload the page. Wait a few seconds.
2. Open the **Journal** menu. Near the bottom you should now see **Enable device import**, **Show device import details** and **Rotate device token**.
3. Click **Enable device import**.
4. If Google asks for permission, choose **Advanced**, then **Go to (project name)**, then **Allow**.

You should see: a dialog titled **Device import** showing a token (a long string of letters and numbers) and the words "not deployed yet". A **Device** tab appears in the Sheet.

If the menu items are missing, the code did not paste or save, or the Sheet needs another reload.

### Step 3. Publish the web address

This is the step people find least familiar. It makes a web address that your phone can send numbers to.

1. In the Apps Script editor, click the blue **Deploy** button at the top right, then **New deployment**.
2. Next to **Select type**, click the gear icon and choose **Web app**.
3. Leave the description empty or type `Device import`.
4. Set **Execute as** to **Me**.
5. Set **Who has access** to **Anyone**.
6. Click **Deploy**.
7. If asked, click **Authorize access**, pick your account, choose **Advanced**, then **Go to (project name)**, then **Allow**.
8. A box shows a **Web app URL**. Click **Copy** and paste it somewhere safe for now, for example a note on your computer. It ends in `/exec`.

"Anyone" sounds alarming. It means the address works without a Google sign-in, because a phone Shortcut cannot sign in. The address accepts nothing without the secret token from Step 2, and the only thing it can do is add numbers to the Device tab. It cannot read your Sheet. Keep the address and the token private, and do not post them together anywhere.

Some work or school Google accounts block "Anyone". A personal account does not.

### Step 4. Get the token and the address in one place

1. In the Sheet, choose **Journal > Show device import details**.
2. The dialog shows the **Web app URL** and the **token**. Check that the URL ends in `/exec`. If it says "not deployed yet" or ends in `/dev`, use the URL you copied in Step 3 instead. The `/dev` address needs a Google sign-in and will not work from the phone.

You will need both on the phone.

### Checkpoint 1

You have a Device tab, a token, and a web address ending in `/exec`. You can stop here. Come back when you are ready for the phone side.

Optional: test the address from a computer before touching the phone, with the `curl` command in `payload.md`. A reply of `{"ok":true}` means a row was written to the Device tab. If you would rather not use a terminal, skip this. The phone test in the Shortcut guide does the same job.

## Part 2. The phone

Go to `apple-shortcut/README.md`. It builds the Shortcut in stages, starting with a test that sends made-up numbers, so a problem with the connection is separate from a problem with Apple Health.

## Changing or fixing things later

- **Changed the script?** Re-publish: **Deploy > Manage deployments**, click the pencil, set **Version** to **New version**, then **Deploy**. The address stays the same.
- **Token leaked, or phone lost?** **Journal > Rotate device token**, then paste the new token into the Shortcut. The old one stops working at once.
- **Want it off?** Set **Device import** to Off on the Config tab, or in the Apps Script editor go to **Deploy > Manage deployments** and archive the deployment. The Device tab and its history stay.
- **Remove it completely?** Archive the deployment, then delete the `DeviceImport` file in Apps Script.

## Security, plainly

- Anyone who has the web address can send a request. The script rejects every request without the token, and a request can only add or update rows in the Device tab. It never returns any data from your Sheet.
- The token is a 64-character random string stored in the script's own settings. It is not in the Sheet and not in this repo.
- The token has to be on the phone. Treat the Shortcut like a password. Do not share it or export it.
- Do not commit the address or the token to any repo.
- A request limit of 120 an hour caps the damage if the address leaks.

## Other sources

Anything that can send the JSON in `payload.md` to the web address works: an Android automation app, a script for a Fitbit or Oura export, or a scheduled job. You can also type rows into the Device tab by hand. Keep the header row, use `YYYY-MM-DD` for dates and `HH:MM` for times.
