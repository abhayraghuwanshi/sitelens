import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../server/auth.mjs';

function memoryStore(state) {
  return {
    async get() { return state; },
    async update(fn) { fn(state); return state; },
  };
}
const env = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
const oauth = () => ({ auth: { mode: 'oauth', email: 'a@b.c', refreshToken: 'r1', accessToken: 'old', expiresAt: 0, scopes: [] } });

test('a refused refresh marks the sign-in broken; the next good refresh clears it', async () => {
  const state = oauth();
  let ok = false;
  const fetchImpl = async () => (ok
    ? new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 }), { status: 200 })
    : new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
  const auth = createAuth({ store: memoryStore(state), port: 1, env, fetchImpl });
  await assert.rejects(auth.token(), /invalid_grant/);
  assert.match((await auth.status()).broken, /Sign in again/);
  ok = true;
  assert.equal(await auth.token(), 'new');
  assert.equal((await auth.status()).broken, undefined);
});

test('a network failure does not mark the sign-in broken', async () => {
  const state = oauth();
  const auth = createAuth({ store: memoryStore(state), port: 1, env, fetchImpl: async () => new Response('{}', { status: 503 }) });
  await assert.rejects(auth.token());
  assert.equal((await auth.status()).broken, undefined);
});
