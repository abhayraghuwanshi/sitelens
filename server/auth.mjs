// Google credentials. Three ways in:
//  - OAuth (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET set): a real consent flow
//    with a refresh token, so sessions never expire mid-analysis.
//  - Service account key: the JSON key file of a Google service account, no
//    sign-in. Kauzl signs a JWT with it for a 1-hour token whenever it needs
//    one, so it never expires. The account's email must be added as a viewer
//    in GA4 and as a user in Search Console (and given BigQuery roles).
//  - Pasted access token: the extension's model, ~1 hour lifetime.

import { randomBytes, createSign, createPrivateKey } from 'node:crypto';
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
// What a service account asks for: the data scopes (openid/email are for people).
export const SERVICE_SCOPES = SCOPES.filter((s) => s.startsWith('https://'));

// The key file Google Cloud downloads (IAM → Service accounts → Keys → JSON).
// Its token_uri is ignored: tokens only ever come from Google's own endpoint.
export function parseServiceAccount(raw) {
  let key;
  try {
    key = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new AuthError('Paste the whole JSON key file, from { to }.');
  }
  if (!key || key.type !== 'service_account' || typeof key.client_email !== 'string' || typeof key.private_key !== 'string') {
    throw new AuthError('That isn’t a service account key. In Google Cloud: IAM → Service accounts → your account → Keys → Add key → JSON.');
  }
  try {
    createPrivateKey(key.private_key);
  } catch {
    throw new AuthError('The key’s private_key can’t be read. Paste the file exactly as downloaded.');
  }
  return { clientEmail: key.client_email.trim(), privateKey: key.private_key, projectId: String(key.project_id || '') };
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
export function serviceAssertion(sa, nowSec = Math.floor(Date.now() / 1000)) {
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ iss: sa.clientEmail, scope: SERVICE_SCOPES.join(' '), aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 })}`;
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(sa.privateKey).toString('base64url')}`;
}

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
    if (!res.ok) {
      const message = `Google refused to refresh the session (${payload.error || res.status}). Sign in again.`;
      // A refused refresh token won't recover by itself: remember it, so the app can ask for a new sign-in.
      if (res.status === 400 || res.status === 401) {
        await store.update((s) => {
          if (s.auth && s.auth.refreshToken === auth.refreshToken) s.auth = { ...s.auth, broken: { message, at: Date.now() } };
        });
      }
      throw new AuthError(message);
    }
    await store.update((s) => {
      const { broken, ...rest } = s.auth || {};
      s.auth = {
        ...rest,
        accessToken: payload.access_token,
        expiresAt: Date.now() + (Number(payload.expires_in) || 3600) * 1000,
      };
    });
    return payload.access_token;
  }

  async function mintService(sa) {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: serviceAssertion(sa) }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.access_token) {
      throw new AuthError(`Google refused the service account key (${payload.error_description || payload.error || res.status}). It may have been deleted or disabled.`);
    }
    return { accessToken: payload.access_token, expiresAt: Date.now() + (Number(payload.expires_in) || 3600) * 1000 };
  }

  async function refreshService(auth) {
    const fresh = await mintService(auth.serviceAccount);
    await store.update((s) => {
      if (s.auth?.mode === 'service') s.auth = { ...s.auth, ...fresh };
    });
    return fresh.accessToken;
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
        expiresAt: auth.mode === 'token' ? auth.expiresAt : null,
        expired: auth.mode === 'token' && auth.expiresAt < Date.now(),
        // Google refused the saved sign-in: it needs signing in again.
        ...(auth.broken ? { broken: auth.broken.message } : {}),
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
      if (auth.mode === 'service') {
        if (auth.accessToken && auth.expiresAt - 60_000 > Date.now()) return auth.accessToken;
        refreshing ||= refreshService(auth).finally(() => {
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

    // A service account key instead of signing in: checked with Google once, then kept.
    async useServiceAccount(raw) {
      const sa = parseServiceAccount(raw);
      const fresh = await mintService(sa);
      await store.update((s) => {
        s.auth = { mode: 'service', email: sa.clientEmail, scopes: SERVICE_SCOPES, serviceAccount: sa, ...fresh };
      });
      return { email: sa.clientEmail, scopes: SERVICE_SCOPES };
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
