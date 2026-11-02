// Google credentials. Two ways in:
//  - OAuth (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET set): a real consent flow
//    with a refresh token, so sessions never expire mid-analysis.
//  - Pasted access token: the extension's model, ~1 hour lifetime.

import { randomBytes } from 'node:crypto';
import { cleanToken } from '../shared/sitelens/ga4.js';

export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  // Query jobs need the full BigQuery scope; .readonly cannot always create jobs.
  'https://www.googleapis.com/auth/bigquery',
  // Firebase App Hosting request logs and rollouts (read-only).
  'https://www.googleapis.com/auth/logging.read',
];

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.kind = 'auth';
  }
}

export function createAuth({ store, port, env = process.env, fetchImpl = fetch }) {
  const clientId = env.GOOGLE_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${port}/auth/callback`;
  const pendingStates = new Map();
  let refreshing = null;

  async function tokenInfo(accessToken) {
    const res = await fetchImpl(`${INFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) throw new AuthError('Google rejected the token. It may have expired or been copied incorrectly.');
    const info = await res.json();
    return {
      email: info.email || '',
      scopes: String(info.scope || '').split(/\s+/).filter(Boolean),
      expiresAt: Date.now() + (Number(info.expires_in) || 3000) * 1000,
    };
  }

  async function refresh(auth) {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: auth.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new AuthError(`Google refused to refresh the session (${payload.error || res.status}). Sign in again.`);
    await store.update((s) => {
      s.auth = {
        ...s.auth,
        accessToken: payload.access_token,
        expiresAt: Date.now() + (Number(payload.expires_in) || 3600) * 1000,
      };
    });
    return payload.access_token;
  }

  return {
    oauthAvailable: Boolean(clientId && clientSecret),

    async status() {
      const { auth } = await store.get();
      if (!auth) return { connected: false, oauthAvailable: this.oauthAvailable };
      return {
        connected: true,
        mode: auth.mode,
        email: auth.email || '',
        scopes: auth.scopes || [],
        expiresAt: auth.mode === 'oauth' ? null : auth.expiresAt,
        expired: auth.mode !== 'oauth' && auth.expiresAt < Date.now(),
        oauthAvailable: this.oauthAvailable,
      };
    },

    // Returns a usable access token or throws AuthError.
    async token() {
      const { auth } = await store.get();
      if (!auth) throw new AuthError('Connect a Google account in Settings first.');
      if (auth.mode === 'oauth') {
        if (auth.expiresAt - 60_000 > Date.now()) return auth.accessToken;
        refreshing ||= refresh(auth).finally(() => {
          refreshing = null;
        });
        return refreshing;
      }
      if (auth.expiresAt < Date.now()) {
        throw new AuthError('The pasted token has expired. Paste a fresh one in Settings.');
      }
      return auth.accessToken;
    },

    async usePastedToken(raw) {
      const accessToken = cleanToken(raw);
      if (!accessToken) throw new AuthError('Paste an access token (it starts with ya29.).');
      const info = await tokenInfo(accessToken);
      await store.update((s) => {
        s.auth = { mode: 'token', accessToken, ...info };
      });
      return info;
    },

    startUrl() {
      if (!this.oauthAvailable) throw new AuthError('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.');
      const state = randomBytes(18).toString('base64url');
      pendingStates.set(state, Date.now() + 10 * 60_000);
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      });
      return `${AUTH_URL}?${params}`;
    },

    async finish({ code, state }) {
      const expires = pendingStates.get(state);
      pendingStates.delete(state);
      if (!expires || expires < Date.now()) throw new AuthError('Sign-in link expired or was not started here. Try again.');
      const res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new AuthError(`Google sign-in failed (${payload.error || res.status}).`);
      const info = await tokenInfo(payload.access_token);
      const previous = (await store.get()).auth;
      await store.update((s) => {
        s.auth = {
          mode: 'oauth',
          accessToken: payload.access_token,
          // Google only returns a refresh token on first consent; keep the old one otherwise.
          refreshToken: payload.refresh_token || (previous?.mode === 'oauth' ? previous.refreshToken : ''),
          ...info,
        };
      });
    },

    async signOut() {
      await store.update((s) => {
        s.auth = null;
      });
    },
  };
}
