// Lodestone sync endpoint.
// Holds one encrypted blob per vault. It never sees readable data: the app
// encrypts before sending. Paste this whole file into a Cloudflare Worker and
// attach one KV namespace (any variable name).

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per vault
const MAX_VAULTS = 5; // stops strangers from filling the free write quota
const ID_RE = /^[A-Za-z0-9_-]{43}$/; // 256-bit random id, base64url

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function send(body, status = 200, type = 'application/json') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { ...CORS, 'Content-Type': type, 'Cache-Control': 'no-store' },
  });
}

// Use whichever KV namespace is attached, whatever it was named.
function findKV(env) {
  for (const k of Object.keys(env || {})) {
    const v = env[k];
    if (v && typeof v.get === 'function' && typeof v.put === 'function') return v;
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/') {
      return send(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
          '<title>Lodestone sync</title><body style="font:16px system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem">' +
          '<p>Lodestone sync is running.</p><p>Return to the app and paste this page\'s address.</p>',
        200,
        'text/html; charset=utf-8'
      );
    }

    const kv = findKV(env);

    if (url.pathname === '/health') {
      if (!kv) return send({ ok: false, problem: 'storage-not-attached' }, 200);
      return send({ ok: true, app: 'lodestone-sync', v: 1 });
    }

    const m = url.pathname.match(/^\/v\/([^/]+)$/);
    if (!m || !ID_RE.test(m[1])) return send({ ok: false, problem: 'not-found' }, 404);
    if (!kv) return send({ ok: false, problem: 'storage-not-attached' }, 503);
    const id = m[1];
    const key = 'vault:' + id;

    if (method === 'GET') {
      const cur = await kv.get(key, 'json');
      if (!cur) return send({ ok: false, problem: 'empty' }, 404);
      return send({ ok: true, version: cur.v, data: cur.d });
    }

    if (method === 'PUT') {
      const len = Number(request.headers.get('content-length') || 0);
      if (len > MAX_BYTES) return send({ ok: false, problem: 'too-large' }, 413);
      let body;
      try {
        const text = await request.text();
        if (text.length > MAX_BYTES) return send({ ok: false, problem: 'too-large' }, 413);
        body = JSON.parse(text);
      } catch (e) {
        return send({ ok: false, problem: 'bad-request' }, 400);
      }
      if (typeof body.data !== 'string' || !Number.isInteger(body.baseVersion) || body.baseVersion < 0) {
        return send({ ok: false, problem: 'bad-request' }, 400);
      }

      const cur = await kv.get(key, 'json');
      const curVersion = cur ? cur.v : 0;
      if (body.baseVersion !== curVersion) {
        // The caller merges and retries. Best effort: KV can lag between locations.
        return send({ ok: false, problem: 'version-mismatch', version: curVersion, data: cur ? cur.d : null }, 409);
      }

      if (!cur) {
        const list = (await kv.get('meta:vaults', 'json')) || [];
        if (!list.includes(id)) {
          if (list.length >= MAX_VAULTS) return send({ ok: false, problem: 'vault-limit' }, 403);
          list.push(id);
          await kv.put('meta:vaults', JSON.stringify(list));
        }
      }

      const next = curVersion + 1;
      await kv.put(key, JSON.stringify({ v: next, d: body.data }));
      return send({ ok: true, version: next });
    }

    return send({ ok: false, problem: 'method' }, 405);
  },
};
