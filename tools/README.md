# Kauzl free tools

Ten free, browser-only tools that bring search traffic to Kauzl. They have no backend,
no sign-up and no tracking beyond what you add. Every page links back to Kauzl.

| Tool | Path | Search intent it targets |
|---|---|---|
| UTM Builder (+ bulk, link cleaner) | `/tools/utm-builder/` | utm builder, campaign url builder, ga4 utm |
| Did It Work? launch impact checker | `/tools/did-it-work/` | before after analysis, did my change work |
| A/B test significance calculator | `/tools/ab-test-calculator/` | ab test calculator, statistical significance calculator |
| A/B sample size calculator | `/tools/sample-size-calculator/` | ab test sample size, test duration calculator |
| AI robots.txt generator | `/tools/ai-robots-txt-generator/` | block gptbot, robots.txt ai crawlers |
| AI crawler log analyzer | `/tools/ai-crawler-log-analyzer/` | gptbot in logs, ai bot traffic |
| llms.txt generator | `/tools/llms-txt-generator/` | llms.txt generator |
| SERP snippet preview | `/tools/serp-preview/` | serp preview, title tag length checker |
| Open Graph preview + meta tags | `/tools/open-graph-preview/` | og preview, twitter card validator, meta tag generator |
| Schema markup generator | `/tools/schema-generator/` | schema generator, json-ld generator, faq schema |

## Build and preview

```sh
npm run tools:build      # writes tools/dist/tools/
npm run tools:dev        # build + serve at http://localhost:3000/tools/
```

`SITE` (default `https://kauzl.com`), `BASE` (default `/tools`) and `APP_URL`
(where "Try Kauzl" points) set canonical URLs, the sitemap and links.

Code layout: `pages/*.mjs` holds each page's copy, FAQ and form; `assets/*.js` the
browser code; `assets/lib/` the logic shared with `test/free-tools.test.js`.

## Deploy

```sh
npm run tools:deploy     # build + deploy to the Vercel project kauzl-tools
```

The tools live on Vercel (https://kauzl-tools.vercel.app/tools/) and appear at
**https://kauzl.com/tools/** because the Fly app (`server/hosted.mjs`) forwards
`/tools/*` there, set by `TOOLS_ORIGIN` in `fly.toml`. So a tools change needs
only `npm run tools:deploy`, no `fly deploy`; kauzl.com caches pages for 5
minutes and assets for an hour. The Fly app also serves `/robots.txt` with the
tools sitemap. Submit `https://kauzl.com/tools/sitemap.xml` in Search Console
and Bing Webmaster Tools.

## Usage analytics

Every public page (tools, guides, the home page) loads the Google tag from
`tools/site.config.json` (`GTM-…` or `G-…`) via `assets/ga.js`, and
`assets/site.js` pushes these events to the dataLayer. Nothing a visitor types
is ever sent.

| Event | When | Parameters |
|---|---|---|
| `tool_start` | First interaction with a tool | `tool` |
| `tool_result` | The tool produced something (once per distinct result) | `tool`, `detail` |
| `tool_copy`, `tool_download` | Copy / download pressed | `tool`, `detail` |
| `tool_example`, `tool_option` | Example loaded; preset, view or type picked | `tool`, `detail` |
| `cta_click` | Link to Kauzl, the demo, sign-in, a tool or a guide | `location`, `detail` (path) |
| `guide_read` | 75% of a guide scrolled into view | `guide` |

To send them to GA4 from Tag Manager: create Data Layer Variables `tool`,
`guide`, `detail` and `location`; a Custom Event trigger with event name
`^(tool_|cta_|guide_)` (regex); and a **GA4 Event** tag with event name
`{{Event}}`, those four as parameters, fired by that trigger. Then register
`tool`, `guide`, `detail` and `location` as event-scoped custom dimensions in GA4.

## Getting the traffic

Free tools rank slowly on their own. To get them going:

- List each one on tool directories and launch sites (Product Hunt "free tools",
  There's An AI For That for the AI-crawler tools, SaaSHub, AlternativeTo).
- Answer real questions with them: r/GoogleAnalytics, r/SEO, r/bigseo,
  r/webdev, Indie Hackers, Hacker News ("Show HN: block AI training, keep AI search").
- Link them from Kauzl's own app (the UTM builder from Campaigns, Did it work? from the
  Timeline) and from blog posts.
- Watch which ones get impressions in Search Console after 4–6 weeks; build more
  around the winners.
