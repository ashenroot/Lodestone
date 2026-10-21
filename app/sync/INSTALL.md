# Sync setup (Cloudflare dashboard path)

Draft copy for the in-app wizard. One screen per step, a Done button on each, a way back at every point. Cloudflare's labels below come from its KV guide and should be checked by one real run-through before release, since the dashboard changes over time.

## Opening screen

> Sync keeps your entries the same on your phone and computer.
> It takes about ten minutes, once. You can skip it. Lodestone works on this device without it.
>
> [Set up sync]  [Not now]

## Steps

Each step shows a single instruction, a button that opens the right page in a new tab, and a Done button.

**1. Make a Cloudflare account**
Cloudflare hosts a small private store for you. The free plan is enough.
[Open Cloudflare sign-up]  [I already have one]

**2. Create a Worker**
In Cloudflare, open Workers & Pages, choose Create application, then Start with Hello World. Name it `lodestone-sync` and press Deploy.
If Cloudflare asks you to pick a workers.dev name, anything works.

**3. Create the storage**
In the left menu choose Workers KV, then Create instance. Name it `lodestone` and press Create.

**4. Attach the storage**
Open your `lodestone-sync` Worker. Choose Bindings, then Add binding, then KV namespace. Type any name, pick `lodestone`, and save.

**5. Paste the code**
[Copy code]
Back in the Worker, choose Edit Code. Select everything, paste, and press Deploy.

**6. Paste the address**
Copy your Worker's address from Cloudflare. It ends in `workers.dev`. Paste it here.
[address field]  [Test it]

## What the test does

1. `GET /health`. Reads `ok`.
2. Creates this device's vault: `PUT /v/<id>` with the first encrypted copy of the data, then reads it back.
3. Shows one of the messages below.

| Result | Message |
|---|---|
| Works | Connected. Your entries are now backed up and will sync. |
| No answer, or not our endpoint | That address didn't answer. Check you copied all of it, including the part after `https://`. |
| `storage-not-attached` | The store isn't attached yet. Go back to step 4. |
| `vault-limit` | This store already holds five other journals. Create a new Worker and use its address. |
| Wrong page (HTML, not JSON) | That looks like a different page. Use the address of your Worker, ending in `workers.dev`. |

## Adding another device

On the first device: Settings, Add a device. It shows a QR code and a short code containing the address and the encryption key. On the second device: Set up sync, Join, scan. No Cloudflare login on the second device.

## Encryption

Chosen on the first device, before sync is switched on. The passphrase and recovery code are set up in the app, separately from the Cloudflare steps. The Worker only ever holds ciphertext.

## If it breaks later

- Each device keeps its own full copy. Deleting the Worker loses nothing on the devices.
- To reconnect, run steps 1 to 6 again (or 2 to 6) and paste the new address. The app re-uploads from the device.
- The wizard keeps a "Sync problems" page with the same messages as the test.

## Limits worth knowing (Cloudflare free plan, from its KV docs)

- 1,000 writes a day and 100,000 reads a day. The app batches changes and syncs at most once a minute.
- One write per second to the same key.
- Changes can take up to about a minute to appear in other regions. The app merges by record ID and re-sends anything missing, so a late change shows up at the next sync.

## Still to verify with a real account

- The exact labels and menu order in steps 2 to 5.
- Whether a new account has to choose a workers.dev name first.
- Whether the KV namespace can be created from inside the binding dialog, which would remove step 3.
- That a pasted Worker with no `wrangler` file deploys and the binding is visible to it under any name.
