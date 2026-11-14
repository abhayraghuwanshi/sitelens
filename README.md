# Kauzl

The full-width companion to the [SiteLens extension](../site-analytics-extension). The extension shows aggregated GA4 numbers for the page you are looking at. Kauzl (formerly SiteLens Studio) adds what only the **GA4 BigQuery export** can answer: real session paths, funnels with any steps, weekly retention cohorts, breakdowns by any event parameter, a session explorer and a guarded SQL console. It does this across all your sites at once.

It runs locally (`127.0.0.1`), stores everything in `.data/`, and talks directly to Google. There is no Kauzl server.

![Kauzl trailer](docs/trailer.gif)

<sub>A one-minute tour, using sample figures from the built-in demo site. The interactive version is [`docs/trailer.html`](docs/trailer.html): open it in a browser for play/pause and scene controls. To re-render the GIF after editing it, run `npm run trailer` (needs Chrome and ffmpeg). [`docs/trailer.mp4`](docs/trailer.mp4) is a 1080p version with sound, recorded from the real app on the demo site: `npm run trailer:video` rebuilds it from `scripts/trailer-video/film.html`, with a soundtrack synthesized by `scripts/trailer-music.mjs`.</sub>

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
| **Warehouse** | Paths, Funnels, Retention, Events, Sessions, SQL console (all under **Explore** in the sidebar) | GA4 BigQuery export (`analytics_<property>.events_*`) |

Each site can have either mode or both. Views a site can't use are marked with a lock and explain what to connect.

### What the warehouse adds over the GA4 API

- **Paths:** a Sankey diagram of the real page sequence per session (`ga_session_id`), with reloads collapsed. Click a page to re-root the flow, and get exact per-page exit rates. The extension can only guess journeys from `pageReferrer`.
- **Funnels:** 2–8 steps, each a page or *any* event, strictly ordered within a session, with the average time between steps. No alpha `runFunnelReport`. Studio suggests funnels on its own: it finds outcome events (downloads, sign-ups, CTA clicks), keeps the steps that really come before them in that order, and, with a GitHub token, reads the tracking calls in the repo whose homepage is your site to group and name them. The best suggestion is used until you edit the steps.
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

## Site config as code (`.sitelens.yml`)

What Studio measures for a site lives in a `.sitelens.yml` in the site's own repo: its goals (and which ones alert when they drop), its funnels, per-site alert thresholds, and what it wants to be found for: brand and competitor names, search topics and the questions AI search asks assistants. Those set up Demand's query groups, the AI answer checks and Mentions. Connections and keys stay in Settings. To have Claude set a site up, open its repo in Claude Code with the MCP server connected and run `/mcp__sitelens__setup_site`. Claude reads the tracking code and the site's real search queries, writes the file and validates it with `check_site_config`. Each site's **Setup** page (in the sidebar) shows goals, funnels, search and alerts, each marked as coming from the repo file, from Studio's own settings or from Studio's guesses. Editing a part that's in the file opens a pull request that changes only that part. Any other part can be moved into the repo the same way, and sites without a repo keep the file in `.data/config/`. The format is in [`docs/sitelens-yml.md`](docs/sitelens-yml.md).

## What happened

Each site's **Overview** opens with the period told as a story (`GET /api/sites/<id>/story?range=7d|28d|90d`, built in `server/story.mjs`):

- **Headline:** visits against the same number of days before (search clicks for a site without GA4), counting whole days only.
- **What moved it:** the sources, landing pages and search queries that changed the most, in plain words. When something you shipped matches one of them, such as a Reddit post next to more visits from Reddit, it shows as "Around then". That's a hint, not proof.
- **Days that stood out:** days far off a usual same weekday, with what shipped that day or the day before. Each one opens in the Calendar.

It reads the Calendar's local history, so it needs no extra Google calls once that has synced. Below it, the journey map leads to the five stage pages. Each stage page has a card per source, a chart with what shipped marked on it, and links to the full views.

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

`server/mcp.mjs` gives Claude Code, Claude Desktop or any other MCP client read access to Studio's data over stdio, with no extra dependencies. The only thing it can change is Claude's own comments (see [Claude comments](#claude-comments)):

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
| `custom_metrics` | A site's custom metrics: daily values, top dimensions, and totals vs the previous period |
| `schema` / `query` | Tables of, and one read-only `SELECT` against, any local database: `calendar`, `github`, `posts`, `mentions`, `bing`, `vitals`, `firebase`, `ai-search` |
| `add_comment` / `list_comments` / `delete_comment` | Leave a dated comment written by Claude, list Claude's comments, or delete one of them. Notes you wrote can't be deleted |

The analytics tools call the running Studio, so start it first (`npm start` or the desktop app). `schema` and `query` read `.data/*.db` directly, through read-only connections, and work without it. `studio.json`, which holds tokens and settings, is never exposed. Set `STUDIO_URL` if Studio runs on another port, and `STUDIO_DATA_DIR` for the desktop app's data folder.


## Claude comments

Claude can read a site's numbers and leave its analysis in the app as a **comment**: a dated note marked as written by Claude. Comments appear as orange markers on every trend chart, in the Calendar, and in the **Claude** card on Overview and on each Calendar day, where the full write-up is shown. There are two ways to get one:

- **From Claude Code or Claude Desktop** (no API cost beyond your plan): ask something like "look at last month for cool-desk.com and leave a comment on the biggest change". The MCP server's `add_comment` tool saves it.
- **In the app:** **Analyze with Claude** on Overview (for the selected range) or **Analyze this day** in the Calendar, with an optional question. Studio runs Claude Opus 5.5 over the same read tools the MCP server has, then saves one comment on the day the main finding is about. It uses the Anthropic API key from Settings → Claude (or `ANTHROPIC_API_KEY`). A run usually takes 20–60 seconds and costs roughly $0.10–0.40.

Comments are stored with your notes in `.data/studio.json`. Delete one with the × on its card or chart chip.

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

## Custom metrics

Daily numbers from your own stores, such as daily pings, signups or revenue, charted on the site's Overview next to GA4. They also work for sites with no GA4 property.

- Add one in Settings → Integrations → Custom metrics. Pick the site, the source and a query, use **Test** to preview it, then save.
- Every source answers with rows of one shape: `day`, `value`, and an optional `dimension` (the five largest get their own lines). New kinds of storage are new connectors in `server/custom-metrics.mjs`. Nothing else needs to change.
- **Cloudflare D1** is the first connector. It uses the D1 REST API with a token that has **Account → D1 → Read**, saved in Settings or as `CLOUDFLARE_API_TOKEN` in `.env`.
- Queries are a single `SELECT`. `{{start}}` / `{{end}}` are bound as `YYYY-MM-DD` dates (the end is exclusive), and `{{start_ms}}` / `{{end_ms}}` and `_s` as epoch timestamps. Studio asks for the range plus the period before it, so the change vs the previous period costs no extra query.
- The headline number is the sum of the days, the daily average, or the latest day (for running totals). Results are cached for 15 minutes.

```sql
SELECT date(created_at) AS day, count(DISTINCT install_id) AS value, version AS dimension
FROM pings
WHERE created_at >= {{start}} AND created_at < {{end}}
GROUP BY 1, 3
```

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
