import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { createAuth, parseServiceAccount, SERVICE_SCOPES } from '../server/auth.mjs';

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

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const keyFile = JSON.stringify({ type: 'service_account', project_id: 'p1', client_email: 'kauzl@p1.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://evil.example/token' });

test('a service account key connects Google with no sign-in, and its token renews itself', async () => {
  const state = { auth: null };
  const calls = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    calls.push(String(url));
    const body = new URLSearchParams(String(init.body));
    assert.equal(body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [h, p, sig] = body.get('assertion').split('.');
    assert.ok(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, 'base64url')), 'signed with the key');
    const claims = JSON.parse(Buffer.from(p, 'base64url'));
    assert.equal(claims.iss, 'kauzl@p1.iam.gserviceaccount.com');
    assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
    assert.equal(claims.scope, SERVICE_SCOPES.join(' '));
    return Response.json({ access_token: `sa${++n}`, expires_in: 3600 });
  };
  const auth = createAuth({ store: memoryStore(state), port: 1, env: {}, fetchImpl });
  assert.equal((await auth.useServiceAccount(keyFile)).email, 'kauzl@p1.iam.gserviceaccount.com');
  const status = await auth.status();
  assert.equal(status.mode, 'service');
  assert.equal(status.expiresAt, null);
  assert.equal(status.expired, false);
  assert.ok(!JSON.stringify(status).includes('PRIVATE KEY'), 'status never carries the key');
  assert.equal(await auth.token(), 'sa1');
  state.auth.expiresAt = Date.now() - 1; // an hour later
  assert.equal(await auth.token(), 'sa2');
  // Tokens come only from Google, never from the key file's token_uri.
  assert.ok(calls.every((u) => u === 'https://oauth2.googleapis.com/token'));
});

test('a bad service account key is refused before anything is saved', async () => {
  assert.throws(() => parseServiceAccount('not json'), /whole JSON/);
  assert.throws(() => parseServiceAccount('{"type":"authorized_user"}'), /isn’t a service account/);
  assert.throws(() => parseServiceAccount(JSON.stringify({ type: 'service_account', client_email: 'a@b', private_key: 'nope' })), /can’t be read/);
  const state = { auth: null };
  const auth = createAuth({ store: memoryStore(state), port: 1, env: {}, fetchImpl: async () => Response.json({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }, { status: 400 }) });
  await assert.rejects(auth.useServiceAccount(keyFile), /Invalid JWT Signature/);
  assert.equal(state.auth, null);
});
