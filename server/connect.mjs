// "Connect Bing", "Connect Vercel" and "Connect GitHub": OAuth instead of pasting a key.
//  - Bing Webmaster: authorization code → access token (1 h) + refresh token,
//    scope webmaster.read. bing.mjs refreshes the access token as it expires.
//  - Vercel: an Integration's install flow → a long-lived token for the
//    account or team it was installed on.
//  - GitHub: a GitHub App, so access covers only the repos the user picks,
//    with the app's permissions. Sign-in gives a user token (8 h, refreshed
//    from a 6-month refresh token); with no installation yet, the callback
//    sends the user on to install it, and the install comes back here too.
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
  github: {
    label: 'GitHub',
    env: ['GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET', 'GITHUB_APP_SLUG'],
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
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
    if (name === 'github') {
      return `${PROVIDERS.github.authUrl}?${new URLSearchParams({ client_id: env.GITHUB_APP_CLIENT_ID, redirect_uri: redirectUri('github'), state })}`;
    }
    if (name === 'bing') {
      return `${PROVIDERS.bing.authUrl}?${new URLSearchParams({ response_type: 'code', client_id: env.BING_CLIENT_ID, redirect_uri: redirectUri('bing'), scope: 'webmaster.read', state })}`;
    }
    return `https://vercel.com/integrations/${encodeURIComponent(env.VERCEL_INTEGRATION_SLUG)}/new?${new URLSearchParams({ state })}`;
  }

  async function exchange(name, params) {
    const res = await fetchImpl(PROVIDERS[name].tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
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
    // Vercel and a GitHub install only hand back the state when they started here.
    if (state || name === 'bing') {
      if (!pending || pending.provider !== name || pending.expires < now()) throw new EngineError('That link expired or was not started here. Try again.');
    }
    const code = query.get('code');
    if (!code) throw new EngineError(`${PROVIDERS[name].label} sent no code back. Try again.`);
    if (name === 'github') {
      const t = await exchange('github', { client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, code, redirect_uri: redirectUri('github') });
      await store.update((s) => {
        s.sources = { ...(s.sources || {}), githubOAuth: githubTokens(t, now) };
        delete s.sources.githubToken;
      });
      // Signed in, but the app isn't installed on any account yet: install it
      // (choosing repos), and GitHub sends the user back here once more.
      const res = await fetchImpl('https://api.github.com/user/installations', {
        headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(20_000),
      });
      const installs = res.ok ? await res.json() : null;
      if (installs && !installs.total_count) {
        const next = randomBytes(18).toString('base64url');
        states.set(next, { provider: 'github', expires: now() + 15 * 60_000 });
        return { next: `https://github.com/apps/${encodeURIComponent(env.GITHUB_APP_SLUG)}/installations/new?${new URLSearchParams({ state: next })}` };
      }
      return {};
    }
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

// GitHub's token answer, kept as Studio stores it. An app with token expiry
// turned off sends no expires_in: such a token never needs refreshing.
function githubTokens(t, now, previous = {}) {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token || previous.refreshToken || '',
    expiresAt: t.expires_in ? now() + Number(t.expires_in) * 1000 : 0,
  };
}

// A usable GitHub user token: the stored one, refreshed when it's about to expire.
export async function githubAccessToken({ store, env = process.env, fetchImpl = fetch, now = Date.now }) {
  const o = (await store.get()).sources?.githubOAuth;
  if (!o?.accessToken) return '';
  if (!o.expiresAt || o.expiresAt - 5 * 60_000 > now()) return o.accessToken;
  const res = await fetchImpl(PROVIDERS.github.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: env.GITHUB_APP_CLIENT_ID || '', client_secret: env.GITHUB_APP_CLIENT_SECRET || '', refresh_token: o.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20_000),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok || !t.access_token) throw new EngineError('GitHub needs connecting again.', { status: 409, kind: 'needs-github', hint: 'Settings → Integrations → GitHub → Connect GitHub.' });
  await store.update((s) => {
    s.sources.githubOAuth = githubTokens(t, now, o);
  });
  return t.access_token;
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
