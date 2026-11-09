# Hosting SiteLens Studio on Fly.io

The hosted version is invite-only and serves `https://sitelens.kazekit.com`. The gateway, `server/hosted.mjs`, signs people in and gives each user their own copy of the app with its own data folder. The desktop app and `npm start` are unchanged.

## How it keeps users apart

- **Sign-in.** Users sign in with Google. The same consent connects their GA4, Search Console and BigQuery, so the app needs no second Google step. The email must be in `ALLOWED_EMAILS`. Removing someone from the list locks them out on their next request.
- **Sessions.** A random 256-bit ID goes in an `HttpOnly; Secure; SameSite=Lax` cookie, `__Host-sitelens`. The server stores only its SHA-256, in `/data/gateway.db`.
- **One folder per user.** Each user's app reads and writes only `/data/users/<id>/`. The user ID comes from the session, never from the request.
- **Sealed credentials.** Each user's `studio.json` holds their Google refresh token and API keys, and is sealed with AES-256-GCM. The key is derived from `MASTER_KEY` and the user ID. A copy of the volume without `MASTER_KEY` is unreadable.
- **No server keys for users.** A user's app only sees `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the environment. It never falls back to the server's Anthropic, OpenRouter, GitHub or other keys.
- **No internal fetches.** Every outgoing fetch is refused if the address is private, loopback, link-local or on Fly's internal network. This holds for redirects and DNS answers too.
- **Browser protections.** Requests must use our domain as the Host. Writes must come from our own Origin and also carry the app's `X-Studio` header. Every response gets HSTS, CSP, `X-Frame-Options: DENY` and `nosniff`. Sign-in is limited to 20 attempts per IP every 10 minutes.
- **Desktop-only routes are off.** MCP setup and desktop notifications don't run in hosted mode.

`test/hosted.test.js` checks all of this. That includes calling every GET route with fake secrets saved and checking that none of them comes back.

## One-time setup

1. **Google OAuth client.** In Google Cloud Console, go to APIs & Services → Credentials → Create OAuth client ID → *Web application*.
   - Authorized redirect URIs:
     - `https://sitelens.kazekit.com/login/callback` (signing in to Studio)
     - `https://sitelens.kazekit.com/auth/callback` (connecting GA4 and Search Console inside the app)
   - On the OAuth consent screen, keep **Publishing status: Testing** and add every invited email as a **test user** (up to 100). In Testing mode the sensitive scopes need no Google verification. Refresh tokens expire after 7 days in Testing mode, so users reconnect Google weekly until the app is verified.
   - Enable the Google Analytics Admin, Google Analytics Data, Search Console, BigQuery and Cloud Logging APIs on the project.

2. **Fly app and volume.**
   ```sh
   fly apps create sitelens-studio
   fly volumes create sitelens_data --region sin --size 3 --app sitelens-studio
   ```

3. **Secrets.** These are never kept in the repo or the image.
   ```sh
   fly secrets set --app sitelens-studio \
     MASTER_KEY="$(openssl rand -base64 32)" \
     GOOGLE_CLIENT_ID="…" \
     GOOGLE_CLIENT_SECRET="…" \
     ALLOWED_EMAILS="you@example.com,friend@example.com"
   ```
   **Save `MASTER_KEY` in your password manager.** Without it, every user's saved settings and tokens are gone for good. Fly can't show it back to you.

4. **Deploy:** `fly deploy`

5. **Domain.** Run `fly certs add sitelens.kazekit.com`. Then in Cloudflare DNS for kazekit.com, add a `CNAME` record from `sitelens` to `sitelens-studio.fly.dev` with **Proxy status: DNS only** (grey cloud), so Fly can issue the certificate. Check it with `fly certs check sitelens.kazekit.com`.

## Optional: Connect Bing and Connect Vercel buttons

Users can paste a Bing API key or a Vercel token without any of this. Registering these two OAuth apps once swaps the paste box for a **Connect** button.

**Bing.** In [Bing Webmaster Tools](https://www.bing.com/webmasters), go to Settings → API Access → **OAuth Client**.
- Name: `SiteLens Studio`
- Redirect URI: `https://sitelens.kazekit.com/auth/bing/callback`

Copy the client ID and secret, then run:
```sh
fly secrets set --app sitelens-studio BING_CLIENT_ID="…" BING_CLIENT_SECRET="…"
```

**Vercel.** Go to [Integrations Console](https://vercel.com/dashboard/integrations/console) → **Create**.
- Name `SiteLens Studio`, URL slug `sitelens-studio`
- Redirect URL: `https://sitelens.kazekit.com/auth/vercel/callback`
- Scopes: read-only **Projects**, **Deployments**, **User** and **Team**

Copy the client ID (`oac_…`) and secret, then run:
```sh
fly secrets set --app sitelens-studio VERCEL_CLIENT_ID="oac_…" VERCEL_CLIENT_SECRET="…" VERCEL_INTEGRATION_SLUG="sitelens-studio"
```

## Day to day

- **Invite someone.** Add them as a test user in Google Cloud, then run `fly secrets set ALLOWED_EMAILS="…,new@example.com"`. Setting a secret restarts the app, which takes a few seconds.
- **Remove someone.** Take their email out of `ALLOWED_EMAILS`. Their data stays in `/data/users/<id>/` until you delete it.
- **Logs:** `fly logs`.
- **Backups.** Fly snapshots the volume daily and keeps 14 days (`fly volumes snapshots list`). Snapshots are useless without `MASTER_KEY`.
- **Stay on one machine.** SQLite lives on the volume, so never scale past one machine (`fly scale count 1`).
