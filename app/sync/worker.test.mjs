import assert from 'node:assert/strict';
import worker from './worker.mjs';

function fakeKV() {
  const m = new Map();
  return {
    async get(k, type) {
      const v = m.get(k);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k, v) { m.set(k, v); },
    _m: m,
  };
}

const B = 'https://sync.example.workers.dev';
const id = (n) => (String.fromCharCode(65 + n)).repeat(43);
const call = (env, method, path, body, extra = {}) =>
  worker.fetch(
    new Request(B + path, { method, body: body === undefined ? undefined : JSON.stringify(body), ...extra }),
    env
  );
const json = async (r) => r.json();

let pass = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('ok  ', name); }
  catch (e) { console.log('FAIL', name, '\n    ', e.message); process.exitCode = 1; }
}

await t('root page responds with plain text', async () => {
  const r = await call({ ANY: fakeKV() }, 'GET', '/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Lodestone sync is running/);
});

await t('health ok when any KV is attached, whatever its name', async () => {
  const r = await call({ whatever_name: fakeKV() }, 'GET', '/health');
  assert.deepEqual(await json(r), { ok: true, app: 'lodestone-sync', v: 1 });
});

await t('health reports storage-not-attached with no KV', async () => {
  const r = await call({}, 'GET', '/health');
  assert.equal((await json(r)).problem, 'storage-not-attached');
});

await t('CORS preflight', async () => {
  const r = await call({ K: fakeKV() }, 'OPTIONS', '/v/' + id(0));
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});

await t('bad vault id is 404', async () => {
  const r = await call({ K: fakeKV() }, 'GET', '/v/short');
  assert.equal(r.status, 404);
});

await t('empty vault is 404 empty', async () => {
  const r = await call({ K: fakeKV() }, 'GET', '/v/' + id(0));
  assert.equal(r.status, 404);
  assert.equal((await json(r)).problem, 'empty');
});

await t('first write, read back, then update', async () => {
  const env = { K: fakeKV() };
  let r = await call(env, 'PUT', '/v/' + id(0), { baseVersion: 0, data: 'AAA' });
  assert.deepEqual(await json(r), { ok: true, version: 1 });
  r = await call(env, 'GET', '/v/' + id(0));
  assert.deepEqual(await json(r), { ok: true, version: 1, data: 'AAA' });
  r = await call(env, 'PUT', '/v/' + id(0), { baseVersion: 1, data: 'BBB' });
  assert.deepEqual(await json(r), { ok: true, version: 2 });
});

await t('stale write returns 409 with the current data', async () => {
  const env = { K: fakeKV() };
  await call(env, 'PUT', '/v/' + id(0), { baseVersion: 0, data: 'AAA' });
  await call(env, 'PUT', '/v/' + id(0), { baseVersion: 1, data: 'BBB' });
  const r = await call(env, 'PUT', '/v/' + id(0), { baseVersion: 1, data: 'CCC' });
  assert.equal(r.status, 409);
  const j = await json(r);
  assert.equal(j.problem, 'version-mismatch');
  assert.equal(j.version, 2);
  assert.equal(j.data, 'BBB');
});

await t('creating over an existing id at version 0 is rejected as mismatch', async () => {
  const env = { K: fakeKV() };
  await call(env, 'PUT', '/v/' + id(0), { baseVersion: 0, data: 'AAA' });
  const r = await call(env, 'PUT', '/v/' + id(0), { baseVersion: 0, data: 'ZZZ' });
  assert.equal(r.status, 409);
});

await t('vault limit stops strangers at 5 vaults', async () => {
  const env = { K: fakeKV() };
  for (let i = 0; i < 5; i++) {
    const r = await call(env, 'PUT', '/v/' + id(i), { baseVersion: 0, data: 'x' });
    assert.equal(r.status, 200);
  }
  const r = await call(env, 'PUT', '/v/' + id(5), { baseVersion: 0, data: 'x' });
  assert.equal(r.status, 403);
  assert.equal((await json(r)).problem, 'vault-limit');
  // existing vaults still update
  const u = await call(env, 'PUT', '/v/' + id(2), { baseVersion: 1, data: 'y' });
  assert.equal(u.status, 200);
});

await t('malformed bodies are 400', async () => {
  const env = { K: fakeKV() };
  for (const body of [{}, { data: 5, baseVersion: 0 }, { data: 'x', baseVersion: -1 }, { data: 'x', baseVersion: 1.5 }]) {
    const r = await call(env, 'PUT', '/v/' + id(0), body);
    assert.equal(r.status, 400);
  }
  const r = await worker.fetch(new Request(B + '/v/' + id(0), { method: 'PUT', body: 'not json' }), env);
  assert.equal(r.status, 400);
});

await t('oversize is 413', async () => {
  const env = { K: fakeKV() };
  const big = 'a'.repeat(10 * 1024 * 1024 + 10);
  const r = await call(env, 'PUT', '/v/' + id(0), { baseVersion: 0, data: big });
  assert.equal(r.status, 413);
});

await t('unknown method is 405', async () => {
  const r = await call({ K: fakeKV() }, 'DELETE', '/v/' + id(0));
  assert.equal(r.status, 405);
});

await t('no KV attached gives 503 on vault routes', async () => {
  const r = await call({}, 'GET', '/v/' + id(0));
  assert.equal(r.status, 503);
});

console.log(pass + ' passed');
