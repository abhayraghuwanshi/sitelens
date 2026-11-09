// "Connect Bing" and "Connect Vercel": OAuth instead of pasting a key.
//  - Bing Webmaster: authorization code → access token (1 h) + refresh token,
//    scope webmaster.read. bing.mjs refreshes the access token as it expires.
//  - Vercel: an Integration's install flow → a long-lived token for the
//    account or team it was installed on.
// Each needs the app owner to register a client once (see docs/hosting.md);
// until then the buttons stay hidden and pasting a key works as before.

import { randomBytes } from 'node:crypto';
import { EngineError } from './engines.mjs';

export const PROVIDERS = {
  bing: {
    label: 'Bing',
    env: ['BING_CLIENT_ID', 'BING_CLIENT_SECRET'],
    authUrl: 'https://www.bing.com/webmasters/OAuth/authorize',
    tokenUrl: 'https://www.bing.com/webmasters/oauth/token',
  },
  vercel: {
    label: 'Vercel',
    env: ['VERCEL_CLIENT_ID', 'VERCEL_CLIENT_SECRET', 'VERCEL_INTEGRATION_SLUG'],
    tokenUrl: 'https://api.vercel.com/v2/oauth/access_token',
  },
};

export function createConnect({ store, env = process.env, baseUrl, fetchImpl = fetch, now = Date.now }) {
  const states = new Map(); // state → { provider, expires }
  const redirectUri = (name) => `${baseUrl}/auth/${name}/callback`;

  function available(name) {
    return Boolean(PROVIDERS[name]?.env.every((k) => env[k]));
  }

  function startUrl(name) {
    if (!available(name)) throw new EngineError(`Connecting ${PROVIDERS[name].label} isn’t set up on this server. Paste a key instead.`, { status: 409 });
    const state = randomBytes(18).toString('base64url');
    states.set(state, { provider: name, expires: now() + 15 * 60_000 });
    if (name === 'bing') {
      return `${PROVIDERS.bing.authUrl}?${new URLSearchParams({ response_type: 'code', client_id: env.BING_CLIENT_ID, redirect_uri: redirectUri('bing'), scope: 'webmaster.read', state })}`;
    }
    return `https://vercel.com/integrations/${encodeURIComponent(env.VERCEL_INTEGRATION_SLUG)}/new?${new URLSearchParams({ state })}`;
  }

  async function exchange(name, params) {
    const res = await fetchImpl(PROVIDERS[name].tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.access_token) throw new EngineError(`${PROVIDERS[name].label} didn’t finish connecting (${payload.error_description || payload.error?.message || payload.error || res.status}). Try again.`, { status: 502 });
    return payload;
  }

  async function finish(name, query) {
    if (query.get('error')) throw new EngineError(`${PROVIDERS[name].label} sign-in was cancelled.`);
    const state = query.get('state');
    const pending = states.get(state);
    states.delete(state);
    // Vercel only hands back the state when the install started here; Bing always does.
    if (state || name === 'bing') {
      if (!pending || pending.provider !== name || pending.expires < now()) throw new EngineError('That link expired or was not started here. Try again.');
    }
    const code = query.get('code');
    if (!code) throw new EngineError(`${PROVIDERS[name].label} sent no code back. Try again.`);
    if (name === 'bing') {
      const t = await exchange('bing', { client_id: env.BING_CLIENT_ID, client_secret: env.BING_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirectUri('bing') });
      await store.update((s) => {
        s.sources = { ...(s.sources || {}), bingOAuth: { accessToken: t.access_token, refreshToken: t.refresh_token || '', expiresAt: now() + (Number(t.expires_in) || 3600) * 1000 } };
        delete s.sources.bingApiKey;
      });
      return;
    }
    const t = await exchange('vercel', { client_id: env.VERCEL_CLIENT_ID, client_secret: env.VERCEL_CLIENT_SECRET, code, redirect_uri: redirectUri('vercel') });
    await store.update((s) => {
      s.sources = { ...(s.sources || {}), vercelToken: t.access_token };
      s.vercel = { ...(s.vercel || {}), teamId: t.team_id || query.get('teamId') || '', via: 'oauth' };
    });
  }

  return { available, startUrl, finish };
}

// A fresh Bing access token from the stored refresh token.
export async function refreshBing({ store, env = process.env, fetchImpl = fetch, now = Date.now }) {
  const o = (await store.get()).sources?.bingOAuth;
  if (!o?.refreshToken) throw new EngineError('Bing needs connecting again.', { status: 409, kind: 'needs-bing', hint: 'Settings → Integrations → Bing → Connect Bing.' });
  const res = await fetchImpl(PROVIDERS.bing.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.BING_CLIENT_ID || '', client_secret: env.BING_CLIENT_SECRET || '', refresh_token: o.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20_000),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok || !t.access_token) throw new EngineError('Bing refused to refresh the connection.', { status: 409, kind: 'needs-bing', hint: 'Settings → Integrations → Bing → Connect Bing.' });
  await store.update((s) => {
    s.sources.bingOAuth = { accessToken: t.access_token, refreshToken: t.refresh_token || o.refreshToken, expiresAt: now() + (Number(t.expires_in) || 3600) * 1000 };
  });
  return t.access_token;
}
