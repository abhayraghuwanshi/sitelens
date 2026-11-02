# SiteLens Studio

The full-width companion to the SiteLens extension. It runs locally on
`127.0.0.1:4318`, keeps everything in `.data/`, and talks to Google directly.
There is no SiteLens server.

It has two engines behind one UI:

- **API** (Overview, Pages, Search): GA4 Data API and Search Console, through
  the extension's report layer in `shared/sitelens/` (refresh it with
  `npm run sync`).
- **Warehouse** (Paths, Funnels, Retention, Events, Sessions, SQL console):
  the GA4 BigQuery export. Every analysis is built on one session model in
  `server/sql.mjs`. Every query is dry-run first and refused over the site's
  scan cap.

Other sources sit in the sidebar: GitHub, Chrome Web Store, Bing, Vercel,
Firebase, mentions, posts, alerts and the Calendar, which keeps local
history in `.data/calendar.db`.

## Running it

```bash
npm install
npm run dev          # API :4318 (auto-restart) + Vite http://127.0.0.1:5173
npm start            # build + serve http://127.0.0.1:4318
npm test
npm run desktop:dev  # Tauri desktop app
```

The built-in **Demo site** works without any Google setup. For real sites,
copy `.env.example` to `.env` and add a Google OAuth client.

## Where to look

| Path | What |
| --- | --- |
| `server/index.mjs` | HTTP API and routing |
| `server/sql.mjs`, `server/bigquery.mjs` | Warehouse SQL and BigQuery guardrails |
| `server/calendar*.mjs` | Calendar stories and local history |
| `server/mcp.mjs` | Read-only MCP server for Claude Code and other agents |
| `web/src/pages/` | One file per view |
| `shared/sitelens/` | Report layer shared with the extension (don't edit here; sync it) |
| `src-tauri/` | Desktop shell |
| `docs/trailer.html`, `scripts/record-trailer.mjs` | Trailer and its GIF renderer |
