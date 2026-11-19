# Kauzl UI redesign

A design for a simpler, story-first Kauzl that works the same on desktop and phone. It is a clickable prototype, not app code yet.

- **Prototype:** [`prototype.html`](prototype.html) (open it in a browser; the "Proposed" switch shows the new design, "Today" the current one). Published copy: https://claude.ai/artifact/M3gYrkQ6mmE1GK1H2CwDG4
- **New layout code it replaces:** `web/src/next/` (`NextApp.jsx`, `Story.jsx`, `Explore.jsx`…)

## Rules the design follows

- **Answer first.** Every screen opens with one or two sentences that say what happened and what matters, then the picture, then detail.
- **Each section has its own picture**, shaped by its data: Timeline is a calendar, Search a ranking ladder, Traffic a mix bar, Journeys step bars, Pages a 90-day line with change marks. Sections must not all look like paragraph-plus-table.
- **Few columns at the top level.** Full detail opens in a side drawer on desktop and a bottom sheet on phone, never below the list.
- **Plain over dense.** Named items and short lists beat stacked bars, heatmaps and cryptic badges. Page titles, not paths.
- **Forms get their own view.** Adding a metric or editing journey steps replaces the screen; it doesn't stack under a list.
- **Controls sit in the page header**, and stay few. Chip rows stay on one line on phones (they scroll sideways).
- **No coloured left-border rails** on cards or chips; use a light tint or a small dot.
- **Phones:** bottom tab bar (Story, Inbox, Pages, Search, More), equal-height header controls, sheets for detail.

## Navigation

- One **scope switcher** (a site, or All sites) replaces the site select and the global links.
- **Sidebar:** Story · Inbox · Timeline, then **Reports:** Pages · Search · Traffic · Journeys · Goals. Account sits at the bottom.
- **Live** is a link under the switcher ("3 on now").
- **⌘K** jumps anywhere or asks a question. SQL and raw events are behind "Raw data" in Journeys; Ask Claude replaces most SQL.
- Old URLs (`#/todos`, `#/alerts`, `#/site/<id>/<report>`) keep working and land in the right place.

## Screens

### Story
The site's week in sentences, the numbers that moved, who brought visitors, and what is waiting in the Inbox.

### Inbox
One list per site plus an All view, with tabs **All · Alerts · To-dos · Goals**.

- **To-dos are threads.** Clicking one opens a drawer with one line saying who did what ("Claude Code proposes a new title · today"), the change itself (old text struck through, new text in bold), one sentence of why, one of what to expect, and **Approve and open the PR / Try another**. History collapses to one line per entry.
- **Agents are named.** Reports come in through MCP `report_todo`; Kauzl records which client sent them (Claude Code, Claude Desktop, Cursor, ChatGPT) and the model if given.
- **Kauzl closes the loop.** It posts its own entries: when the change went live (commit, recrawl) and, on the check date, whether it worked.
- Index problems and failing custom sources also arrive here as alerts that open the fix.

### Timeline
A calendar of the site.

- Metrics on the days: visits, search clicks, AI visits, sign-ups, conversion, revenue. Colour by change vs a usual day, or by amount.
- Windows: Yesterday, 7 days, 28 days, Month, Year. A Calendar/Line switch.
- Lenses: landing pages, sources, searches, countries ("What's moving" as a plain list with small lines).
- Marks: deploys, content changes, posts, releases, mentions, alerts.
- A picked day opens in the side panel; on phone, a sheet.

### Charts (everywhere)
Hover reads a day, click opens it, drag sums a range. A Chart/Table switch shows the numbers.

### Pages
- **List:** one line per page: Page · This month · Search visits · In the top 3.
- **A page's view:** title and status, a two-sentence lede, a 90-day search chart with each change marked and the page goal, *Found for / Could be found for*, *What changed* (commits, title edits, content cycles), one *Next* step, and Details on demand.
- **How Google and Bing read it** (new): which version each engine has, words without vs after JavaScript, "See it as Googlebot" (outline, With/Without JavaScript, fetch as Googlebot / Bingbot / GPTBot, checks), and content versions with diffs.
- **An index problem** shows as a line under the lede ("Google picked a different address…  Fix →").
- **Content cycles:** a card on each page plus a Cycles board tab.
- **Health tab:** *Can search show it?* (Google and Bing bars, one row per problem page with each engine's status, a drawer with both canonicals, each engine's own words, why and the fix), *Speed on phones and computers* (Loads / Responds to taps / Stays still, a 0–5 s track per page with phone and computer dots), and *Dead ends* (missing pages people reached, with a one-click redirect).

### Search
Both / Google / Bing switch. A ranking ladder ("further left is better", arrows for the 4-week move, a dashed ring when the engines disagree), next moves, gaps nobody ranks for, and a list of searches where Google and Bing disagree.

### Traffic
A mix bar (on phone a thin bar plus a list), sources grouped by kind and collapsed, *What you put out* and *Who talked about you*, each under its own heading. A source opens its detail in the drawer.

### Journeys
One goal at a time. Step bars with "N stopped here · see where they went" between them (the gap opens where people went instead). *Who gets there* by source, device, browser or country, with a hover card of each step's count. Routes that bring the most or lose the most. Steps are set by pasting page links or naming events.

### Goals
- **Your numbers:** every custom metric as the same card (source tag, value, change, 28-day line, progress to target, where it comes from).
- **Add a metric** (its own view): pick a source, point at the number with a live "Kauzl reads now" preview, name and target, where it shows (Story tile, Timeline tile, Inbox alert). Saving writes `.sitelens.yml`.
- **Sources:** GitHub, Chrome Web Store, a GA4 event, Firebase, your database (D1), any URL (JSON path), **Build it in steps**, **Send it to Kauzl**, type it in.
- **Build it in steps** works like a Java stream: Get a URL → Get every page → Take the list → Keep only (filter) → Keep these fields (map) → Group by day → Turn each day into a number (reduce: count, sum, average…) → Running total / Smooth it. Each step shows what it hands on and can be peeked; the result must be one number per day and is drawn as a line. "Same steps as code" shows the chain.
- **Send it to Kauzl:** a link and key per metric; anything that can make a web request (cron, GitHub Action, Zapier/Make/n8n, your app) posts `{ value, day }`.
- **Page goals** and a link to Journeys sit below.

### Live
A dark "control room": a night map with visitor pins, the path people are on right now, a feed with wins and losses, and Countries / Pages / Sources / Devices.

### Account
- **Sites:** each site's `.sitelens.yml` state (read from where, when, warnings, or "no file yet · Set it up with Claude"). A site opens its setup page: what each part of the file sets and where it shows, the file with warnings on their lines, and what is set in Kauzl instead (property, repos, sharing, left-out visits).
- **Connections:** Google, Bing, GitHub, Vercel, Chrome Web Store, Firebase, with status and how many sites use each. A broken one shows a red banner ("Google needs you · Sign in again").
- **Your own sources:** every custom source (steps, D1, any URL, push link) with its last run, the number it feeds, and failures ("Discord said 401 · Fix the key").
- **Claude and other agents:** connected MCP clients, last used, Revoke, Connect an agent.
- **Keys** (last four characters, what uses each) and **Look** (device / light / dark).

Things the site file defines carry a small `.sitelens.yml` tag (Journeys steps, metric cards) that opens the site's setup page with that section highlighted.

## Backend work the design needs

| Area | What exists | What to add |
| --- | --- | --- |
| Custom metrics | `server/custom-metrics.mjs`: D1 connector and `.sitelens.yml metrics:`, values fetched live and cached in memory | `metrics.db` with `metrics` (definition, target, where it shows, origin yml/app), `metric_days` (one value per day, the line every screen draws) and `metric_runs` (failures, last good number). Connectors for GitHub, Chrome Web Store and Firebase that copy from their existing tables. New: any URL, steps interpreter (fixed operations only, no user code), push endpoint with a per-metric key. |
| To-dos | `server/todos.mjs`, MCP `report_todo` with free-text summary/changes/expected | Record the MCP client name and optional model. Structured fields: `old`, `new`, `file`, `pr`, `check_on`, stage (`proposed`/`changed`). Kauzl-authored entries for live/recrawl/check results, and a job that runs on `check_on`. |
| Indexing | `server/search-hub.mjs` inspects one URL on demand (coverage, Google and user canonicals, last crawl); Bing via `index_status` | A nightly job over sitemap pages (busiest first, within Google's daily inspection limit) that stores results, raises Inbox alerts and feeds Pages → Health. |
| How engines read a page | `server/articles.mjs` fetches raw HTML for titles | Fetch as Googlebot / Bingbot / GPTBot, render with headless Chrome (a separate worker or a hosted renderer, not the main Fly box), store `page_versions` (status, text, outline, tags, words raw vs rendered) only when the content changes, diff block by block, add a Timeline mark per new version and link it to the nearest commit. Line versions up with each engine's last crawl date to say which version it has. Only for verified sites. Google's own rendered HTML is not available through its API, so this is a close copy, not Google's exact view. |
| Site file | `server/site-config.mjs` reads `.sitelens.yml` | Expose where it was read from, the commit, warnings with line numbers, and a section-to-screen map for Account → Sites. Optional: edits made in the UI open a pull request. |

## Open decisions

- **Edits to `.sitelens.yml` from the UI:** open a pull request for you, or hand the change to Claude Code through MCP?
- **Custom scripts:** still deferred. Steps and push links cover most setups without running user code on the shared server.
- **Rendering service** for "See it as Googlebot": separate Fly machine or a hosted browser service.
