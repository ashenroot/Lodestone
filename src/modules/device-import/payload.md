# Device import payload

Any source can feed the Device tab by sending this JSON in an HTTP POST to the
web app URL. An Apple Shortcut is one example. A script, an Android automation
or a manual `curl` work the same way.

```json
{
  "token": "<secret from Journal > Show device import details>",
  "source": "Apple Health",
  "date": "2026-10-20",
  "sleep_hours": 6.4,
  "bedtime": "00:52",
  "wake": "06:41",
  "activity_date": "2026-10-19",
  "steps": 4120,
  "exercise_minutes": 12
}
```

## Fields

| Field | Type | Rule |
|---|---|---|
| `token` | string | Required. Must match the stored token. |
| `source` | string | Optional. Up to 40 characters. Default `Device`. |
| `date` | `YYYY-MM-DD` | Required when any sleep field is sent. The day you woke up. |
| `sleep_hours` | number | 0 to 24. Total time asleep. |
| `bedtime` | `HH:MM` | 24-hour clock. Start of sleep. A time after midnight is fine. |
| `wake` | `HH:MM` | 24-hour clock. End of sleep. |
| `activity_date` | `YYYY-MM-DD` | Required when any activity field is sent. The day the activity happened. |
| `steps` | integer | 0 to 200000. |
| `exercise_minutes` | integer | 0 to 1440. |

Every data field is optional. Send what you have.

## Behaviour

- One row per date. Sending a date again overwrites the fields you send and keeps the others.
- Sleep fields write to the row for `date`. Activity fields write to the row for `activity_date`. A morning post usually carries today's sleep and yesterday's activity.
- Dates must fall between 30 days back and 1 day ahead of today (in the sheet's time zone, with the day rollover applied).
- The reply is JSON. `{"ok":true}` on success, `{"ok":false,"error":"..."}` otherwise. Errors are short on purpose.
- At most 120 posts an hour.

## Sending from a terminal

```
curl -L -X POST -H "Content-Type: application/json" \
  -d '{"token":"TOKEN","date":"2026-10-20","sleep_hours":7.1,"bedtime":"23:30","wake":"06:40"}' \
  WEB_APP_URL
```

`-L` is needed. Apps Script answers a POST with a redirect, and the client has to follow it.

A reply of `{"ok":true,"refreshed":true}` means the row was written. Possible errors: `unauthorized` (wrong token), `import is off` (Config setting), `bad date`, `bad activity_date`, `bad payload`, `bad sleep_hours`, `bad bedtime`, `bad wake`, `bad steps`, `bad exercise_minutes` (the named field is wrong), `nothing to write`, `rate limit`, `server error`.
