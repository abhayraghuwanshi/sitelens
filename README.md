# SiteLens Studio

The full-width companion to the [SiteLens extension](../site-analytics-extension). The extension shows aggregated GA4 numbers for the page you are looking at. Studio adds what only the **GA4 BigQuery export** can answer: real session paths, funnels with any steps, weekly retention cohorts, breakdowns by any event parameter, a session explorer and a guarded SQL console. It does this across all your sites at once.

It runs locally (`127.0.0.1`), stores everything in `.data/`, and talks directly to Google. There is no SiteLens server.

![SiteLens Studio trailer](docs/trailer.gif)

<sub>A one-minute tour, using sample figures from the built-in demo site. The interactive version is [`docs/trailer.html`](docs/trailer.html): open it in a browser for play/pause and scene controls. To re-render the GIF after editing it, run `npm run trailer` (needs Chrome and ffmpeg).</sub>

## Quick start

```bash
npm install
npm start            # builds the web app and serves http://127.0.0.1:4318
# or, while developing:
npm run dev          # API on :4318 (auto-restart) + Vite on http://127.0.0.1:5173
```

The built-in **Demo site** works immediately. API views use the extension's sample data, and warehouse views run on a generated 120-day world of about 14k sessions with GA4-style events and parameters.

## Two engines, one UI

| Mode | Views | Source |
| --- | --- | --- |
| **API** | Overview, Pages, Search | GA4 Data API + Search Console, through the extension's own report layer (`shared/sitelens`, synced with `npm run sync`) |
| **Warehouse** | Paths, Funnels, Retention, Events, Sessions, SQL console | GA4 BigQuery export (`analytics_<property>.events_*`) |

Each site can have either mode or both. Views a site can't use are marked with a lock and explain what to connect.

### What the warehouse adds over the GA4 API

- **Paths:** a Sankey diagram of the real page sequence per session (`ga_session_id`), with reloads collapsed. Click a page to re-root the flow, and get exact per-page exit rates. The extension can only guess journeys from `pageReferrer`.
- **Funnels:** 2–8 steps, each a page or *any* event, strictly ordered within a session, with the average time between steps. No alpha `runFunnelReport`.
- **Retention:** weekly new-user cohorts from `user_first_touch_timestamp`. A cohort only counts toward weeks that have actually elapsed.
- **Events:** a catalog, daily trend, every parameter key, and a value breakdown, for parameters that were never registered as custom dimensions.
- **Sessions:** the newest sessions matching a visited page or a fired event, with the full journey.
- **SQL console:** `{{events}}`, `{{sessions}}`, `{{start}}` and `{{end}}` placeholders. It allows SELECT only, dry-runs before running, exports CSV, and refuses queries over the scan cap unless you approve that exact size.

All warehouse analyses are built on one session model (`server/sql.mjs`):

```
user_id, session_id, session_date, first_touch_date, started_at, ended_at,
device, country, source, medium,
pages ARRAY<STRING>,                       -- page paths, reloads collapsed
seq   ARRAY<STRUCT<k STRING, ts INT64>>    -- 'page:/pricing' | 'event:sign_up'
```

### Cost controls

- Every query is **dry-run first**. Anything over the site's scan cap (default 5 GB) is refused before it runs, and the real job carries `maximumBytesBilled`.
- Date-sharded tables are pruned with constant `_TABLE_SUFFIX` bounds. User input (paths, event names, parameter keys) always travels as **named query parameters**, and identifiers are validated.
- Results are cached for an hour in memory (BigQuery also caches identical queries for free).
- **Sessions rollup** (Settings → edit site → *Build & use rollup*): materializes a partitioned, clustered `sitelens_<id>.sessions` table in your billing project. Paths, funnels, retention and sessions then read that table instead of scanning raw events. To keep it fresh, re-run it or schedule the same SQL as a BigQuery scheduled query.

## Calendar

**Calendar** (under Workspace) shows a month with one cell per day. Each cell has the day's sessions (or search clicks) compared with a typical same weekday, which is the median of the same weekday over the previous 4 weeks. Days 15%+ or 40%+ off are tinted green or red. Dots mark that day's events (releases, deploys, posts, mentions, notes), plus a bell for alerts and ★ for GitHub stars gained. The last column sums each week.

Click a day to read its story:

- **Headline:** how the day compared with a typical one for that weekday.
- **Why:** which sources and landing pages gained or lost against their usual share. Only the three biggest-moving sites get this breakdown, since it costs two GA4 reports per site.
- **Context:** search clicks and top queries, what happened that day and the day before, GitHub stars, extension users and the alerts that fired.

Search Console days that haven't reported yet (it lags 2–3 days) show as pending, not as zero. Pick one site to narrow the events, repos and extensions to its product.

### Local history (`.data/calendar.db`)

GA4 and Search Console numbers are kept locally, so the calendar loads from disk and works offline:

- **Totals:** sessions, users, views, clicks and impressions per site per day. The first sync pulls about 14 months in one report per source. After that, only days that can still change are re-fetched: the last 3 for GA4 and the last 5 for Search Console. This runs every 6 hours, and when a view needs fresher data than 30 minutes.
- **Breakdowns:** sessions by source and by landing page, and clicks by query, keeping the top 100 rows per day. A day is fetched the first time it's needed and kept after that. The background sync adds the past week each time, so history builds up going forward.
- **Site changes:** changing a site's GA4 property, host, subdomain setting or Search Console property clears its stored rows, so data from two setups never mixes. Deleting a site removes them.
- **Offline:** if Google can't be reached, views are served from what's stored.

`GET /api/calendar/status` shows what's stored; `POST /api/calendar/sync` runs a sync now. The calendar's reload button forces a delta for the month you're viewing.

## MCP server for local agents

`server/mcp.mjs` gives Claude Code, Claude Desktop or any other MCP client read-only access to Studio's data over stdio, with no extra dependencies:

```bash
claude mcp add sitelens -- node /path/to/sitelens-studio/server/mcp.mjs
```

Inside this repo you don't need to add anything: `.mcp.json` registers it as `sitelens-dev`, reading the repo's `.data/`. Claude Code asks once to approve it. To point an agent at the desktop app instead, copy the command from Settings → Integrations → Claude Code & Claude Desktop.

| Tool | What it returns |
| --- | --- |
| `list_sites` | Sites, hosts and connected sources |
| `daily_metrics` | Per-day sessions, users, views and clicks, with the same-weekday baseline (up to 500 days) |
| `breakdown` | Sessions by source or landing page, or clicks by query, vs the previous window |
| `day_story` | The calendar's story for one day |
| `events` | Releases, deploys, posts, mentions, notes and alerts in a range |
| `schema` / `query` | Tables of, and one read-only `SELECT` against, any local database: `calendar`, `github`, `posts`, `mentions`, `bing`, `vitals`, `firebase`, `ai-search` |

The analytics tools call the running Studio, so start it first (`npm start` or the desktop app). `schema` and `query` read `.data/*.db` directly, through read-only connections, and work without it. `studio.json`, which holds tokens and settings, is never exposed. Set `STUDIO_URL` if Studio runs on another port, and `STUDIO_DATA_DIR` for the desktop app's data folder.


## Search demand

**Search demand** (in each site's Search section) groups the site's Search Console queries into buckets you define with regular expressions, for example **Brand** `cool[\s-]*desk|coldesk` and **Category** `raycast`. The first matching group wins, and queries that match nothing go to **Other**.

- **Per group:** impressions, clicks and average position, with the change from the previous period and a daily chart.
- **New, rising and falling queries,** from 5 impressions up.
- **Hidden queries:** Search Console leaves out rare queries for privacy, so the page shows how much of the site total the groups can't see.
- **Group editor:** previews how many queries each pattern catches before you save.

**Google Trends** has no generally available API; its official API has been invite-only alpha since 2025. So this page only links out to Trends, pre-filled with each group's top query. Small brand names usually show "not enough data" in Trends; category terms work.

## GitHub and Chrome Web Store

Two non-GA sources sit next to your sites in the sidebar.

**GitHub** uses its own token and its own database. It doesn't depend on any other project.

- Save a token in Settings → GitHub, or set `GITHUB_TOKEN` in `.env`. Use a fine-grained token with **Administration: read** and **Metadata: read**, or a classic token with `repo`. GitHub's traffic API needs push access, so repos the token can't push to are skipped.
- Studio syncs every hour while it runs, and when you click **Sync now**, into `.data/github.db`.
- That file uses the same schema as [ghstats](https://github.com/vladkens/ghstats). GitHub only serves the last 14 days of traffic, so you can **import an old ghstats database once** to keep older history. Nothing links to that file afterwards.
- The overview shows stars (and stars gained), views, clones, release downloads and forks across all repos, plus a sortable repo table with sparklines.
- Each repo adds referrers, popular content, releases, and downloads by platform. The platform is guessed from asset file names.
- Stars and forks are running totals saved once a day. Views and clones are daily counts.
- Daily downloads are the differences between daily snapshots of each repo's release total.

**Chrome extensions.** The Web Store has no stats API, so Studio builds its own history.

- **Listing snapshots:** while the server runs, Studio reads the public listing (users, rating, rating count, version) once a day. Use **Check now** to read it on demand.
- **Dashboard CSV import:** for exact installs, uninstalls or weekly users, download the CSV from Developer Dashboard → Stats and import it. Any CSV with a date column plus numeric columns works. Re-importing an overlapping export updates those days instead of duplicating them.
- **Store-listing analytics (GA4):** when Google Analytics is turned on in the developer dashboard, Chrome Web Store creates a GA4 property named after the extension ID, in a "Chrome Web Store developer properties" account. Studio finds that property automatically.
  - It shows listing views, visitors, **installs**, the visit → install rate, and installs by traffic source and by country.
  - It counts only installs made from the listing page.
- **The Chrome Web Store API has no stats.** v1.1 and v2 only upload, publish and read publishing status. Studio doesn't use it.
- History is stored in `.data/studio.json`.

## Connecting Google

**Option A: sign in (recommended).** Create an OAuth client in Google Cloud (type *Web application*, redirect URI `http://127.0.0.1:4318/auth/callback`), then:

```bash
GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… npm start
```

Studio asks for read-only Analytics and Search Console access plus BigQuery (query jobs need the full `bigquery` scope). It stores a refresh token in `.data/studio.json` (mode 600), so you stay signed in.

**Option B: paste an access token**, the same way the extension works. Get it from the [OAuth Playground](https://developers.google.com/oauthplayground/) with these scopes:

```
https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/bigquery
```

The token lasts about an hour.

### Adding a site

Settings → **Add site**. With Google connected, the form lists your GA4 properties, web streams, Search Console properties and BigQuery projects.

- **Billing project:** runs and pays for queries. The first 1 TB scanned each month is free.
- **Data project / dataset:** where the export lives (`analytics_<property id>`).
- **Stream ID:** filters a multi-site property down to this site.
- **Fixed end date:** for static datasets.

**Try it without your own export:** click **Use Google's public GA4 sample**. It fills in `bigquery-public-data.ga4_obfuscated_sample_ecommerce` (Nov 2020 – Jan 2021, end date fixed). You only need a billing project.

### Verifying the SQL

```bash
BQ_TOKEN=ya29.… BQ_PROJECT=my-gcp-project npm run check-sql
```

This dry-runs every query builder against the public sample. Dry runs are free. It prints the scan size of each query, or the exact BigQuery error.

## Security model

- The server binds to `127.0.0.1` and rejects any non-loopback `Host` header, which blocks DNS rebinding.
- Every non-GET API call needs an `X-Studio: 1` header, which a cross-site form cannot send. OAuth uses a one-time `state` value.
- Tokens never reach the browser. `/api/state` returns only the account email, its scopes and the expiry time.
- The SQL console runs SELECT statements only (checked through the dry run's `statementType`). The rollup only allows `CREATE_TABLE_AS_SELECT`.

## Layout

```
server/
  index.mjs          HTTP routes, guards, static hosting
  engines.mjs        API engine (shared/sitelens) + warehouse engine (BigQuery | demo)
  sql.mjs            GA4-export SQL builders (pure)
  bigquery.mjs       REST client: dry run, params, nested-row decoding, caps
  demo-warehouse.mjs deterministic event-level demo data mirroring sql.mjs
  auth.mjs           OAuth + pasted tokens
  store.mjs          .data/studio.json, site validation
  github-sync.mjs    GitHub token → REST API → .data/github.db (hourly), one-time ghstats import
  github.mjs         GitHub stats reader over that database (node:sqlite, read-only)
  cws.mjs            Web Store listing parser, daily snapshots, dashboard CSV import
  cws-ga.mjs         store-listing GA4 property: auto-detect, installs, conversion, sources
  search-demand.mjs  Search Console queries → user-defined groups over time, movers, Trends links
shared/sitelens/     synced from the extension (ga4, gsc, reports, insights, format, demo, site)
web/src/             Preact app (pages/, charts/ with hand-rolled SVG line + Sankey)
scripts/             dev runner, sync, check-sql, screenshot
test/                node:test — SQL builders, demo warehouse, server (BigQuery faked)
```

## Known limits

- Source/medium in warehouse views is first-touch (`traffic_source`), because every export has it. Session-scoped attribution columns only exist in exports from mid-2023 onward.
- Warehouse ranges end yesterday. The daily export lands the next day, and the intraday tables aren't used yet.
- The Paths Sankey keeps the top 16 transitions per step and folds the rest into "(other pages)". Exit rates come from a separate, exact query.
- The demo world is regenerated per process, deterministically.
