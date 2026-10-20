# Device import module

Optional. Receives daily sleep and activity numbers from a phone or script and
writes them to a `Device` tab. The core works without it. To remove the module,
delete `DeviceImport.gs` from the Apps Script project.

## What it adds

- A `Device` tab: one row per date, with sleep hours, bedtime, wake, steps and exercise minutes.
- A web app endpoint that accepts a JSON POST with a secret token.
- Menu items: Enable device import, Show device import details, Rotate device token.
- On enable, the "hours slept" field on the check-in form becomes optional.
- Pattern charts for exercise, steps, device sleep, and bedtime and wake time fill in from this tab.

## Enable it

1. Copy `DeviceImport.gs` into the same Apps Script project as the core files.
2. Reload the sheet. A **Journal** menu section for device import appears.
3. Run **Journal > Enable device import**. It creates the tab, generates a token,
   and turns on the Config setting.
4. Deploy the web app. In the script editor choose **Deploy > New deployment**,
   type **Web app**, Execute as **Me**, Who has access **Anyone**. Authorize when asked.
5. Copy the web app URL and the token from **Journal > Show device import details**.
6. Test with the `curl` command in `payload.md`. Then set up a sender, for
   example `apple-shortcut/README.md`.

Re-deploy (Deploy > Manage deployments > edit > new version) after changing the script.

## Security, plainly

- "Anyone" access means the URL needs no Google sign-in. Anyone who has the URL
  can send a request. The endpoint rejects every request without the token and
  only writes to the Device tab. It never returns sheet data.
- The token is a 64-character random string kept in Script Properties. It
  never appears in the sheet or the repo.
- Rotate it any time from the menu. Undeploy the web app to switch the import off completely.
- Some Google Workspace admins block "Anyone" deployments. A personal Google
  account does not have that restriction.
- Do not commit the web app URL together with the token anywhere public.

## Other sources

Anything that can POST the JSON in `payload.md` works: an Android automation, a
Fitbit or Oura export script, a cron job. Or paste rows into the Device tab by
hand. Keep the headers and use `YYYY-MM-DD` for dates and `HH:MM` for times.
