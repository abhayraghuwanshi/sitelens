# `.sitelens.yml`: what Studio measures for a site

A site's goals, the alerts on them, its funnels, its alert thresholds and what it
wants to be found for (in Google and in AI answers) live in a
`.sitelens.yml` file **in the site's own repo**, next to the tracking code they
describe. An agent can write it by reading that code, and it changes in the same
pull request as the events it names.

Connections and credentials (the GA4 property, Search Console, BigQuery, GitHub and
Vercel tokens, webhook URLs) stay in Studio's Settings. Never put them in this file.

## Setting a site up with Claude

1. Connect Studio's MCP server to Claude Code (Settings → Integrations → Claude Code).
2. Open the site's repo in Claude Code and run `/mcp__sitelens__setup_site`.
3. Claude reads the tracking calls, picks goals and funnels, validates the file with
   `check_site_config` and shows it to you. Commit it to the default branch.

Studio re-reads the file every 10 minutes, or right away with **Reload** in
the site's Setup page.

## Where Studio looks

The first match wins:

| Where | When to use it |
| --- | --- |
| `.data/config/<host>.yml` in Studio | A local override, for a site without a repo |
| `<repo>/.sitelens/<host>.yml` | One repo that serves several sites |
| `<repo>/.sitelens.yml` | The usual case |

"The site's repos" are the repos picked for the site's product, the repo its Vercel
project deploys from, and any of your repos whose homepage is the site. Studio
needs a GitHub token to read them.

**A file with an error is not applied at all.** Studio then uses the goals in
Settings, or its own guesses, and Settings → Sites shows the error. When GitHub
can't be reached, Studio keeps using the last good copy.

## Example

```yaml
version: 1
site: example.com
kind: saas

goals:
  # SignupForm.tsx: gtag('event', 'sign_up') after the account is created
  - { event: sign_up, label: Sign-ups, value: 20, alert: true }
  # ContactForm.tsx; few a day, so alert on any big swing from 2 a day
  - { event: generate_lead, label: Sales leads, value: 50, alert: { when: both, pct: 40, min: 2 } }
  - { event: plan_select, label: Picked a plan, role: step }
  - { page: /pricing, label: Saw pricing, role: step }

funnels:
  - name: Sign-up from pricing
    steps: [page:/pricing, event:plan_select, page:/signup, event:sign_up]

alerts:
  traffic: { pct: 40 }

search:
  brand: [example, example app]
  competitors: [plausible]
  topics:
    # /features/funnels; "ga4 funnel" queries show up in Search Console at position 14
    - name: Funnels
      page: /features/funnels
      match: funnel|conversion path
      targets: [ga4 funnel, ga4 funnel without alpha api]
      ask_ai:
        - How can I build a GA4 funnel without the alpha API?
  ask_ai:
    - Is there a local dashboard for GA4 and Search Console?
```

## Reference

### `version`, `site`, `kind`

- `version`: always `1`.
- `site`: the host, like `example.com`. It's optional in `.sitelens.yml`, but set it
  when one repo serves several sites. Studio skips a root `.sitelens.yml` that names
  another site.
- `kind`: what the site is for. It guides which goals make sense:

| kind | Usual outcomes | Usual steps |
| --- | --- | --- |
| `saas` | `sign_up`, `purchase` or a paid plan | pricing page, plan picked, sign-up started |
| `ecommerce` | `purchase` | product view, `add_to_cart`, `begin_checkout` |
| `extension` | `source: installs` (store installs) | "Add to Chrome" click |
| `desktop` | `file_download`, `source: downloads` (release downloads) | download page, download click |
| `mobile` | app store click | download page |
| `content` | newsletter `subscribe` | article read to the end, a second article |
| `docs` | getting-started completed, a copy of the code | search, key pages |
| `website` | contact or `generate_lead` | CTA click, contact page |

### `goals` (up to 12)

Each goal has exactly one of:

- `event: <name>`: a GA4 event the site sends. Counted as users who sent it.
- `page: /path`: users who viewed a page whose path starts with this.
- `source: installs | downloads | stars`: Chrome Web Store installs, GitHub release
  downloads, or new GitHub stars for the site's product.

Optional fields:

- `label`: the name shown in Studio.
- `role`: `outcome` (default) is a result the site exists for. `step` is progress
  towards one.
- `value`: what one outcome is worth, for the value total on Outcomes. A GA4 `value`
  sent with the event takes priority over it.
- `alert`: watch this goal every day. It only works on `event` and `page` goals.
  - `alert: true` alerts when yesterday is at least 50% below the average of the
    previous 7 days, and only when there were at least 5 users on one side.
  - `alert: { when: drop | spike | both, pct: 50, min: 5 }` tunes that.

What makes a good goal:

- **Outcomes are results, not clicks.** A finished sign-up is an outcome; clicking
  "Sign up" is a step.
- **Use one to three outcomes.** More than that blurs the headline.
- **Only use names the code really sends.** `check_site_config` warns about any event
  the site hasn't sent in 28 days.
- **Alert on outcomes, and set `min` from real volume.** A goal reached twice a day
  needs `min: 2` and a higher `pct`, or nothing will ever alert. One reached 500
  times a day can use `pct: 25`.

### `funnels` (up to 10)

- `name`: shown in Studio.
- `steps`: 2–8 steps, each `page:/path` (an exact path) or `event:name`. The steps
  must happen in order within one session.

The first funnel is the one Funnels opens with. Edits on the Funnels page are for
exploring and aren't saved while the file declares funnels. Funnels need the GA4
BigQuery export.

### `alerts`

These override Studio's alert rules for this site only:

- `traffic`: GA4 sessions and users.
- `search`: Search Console clicks.

Each one is `off`, or `{ pct, min, z }`: the change against the 7-day average, the
minimum daily volume, and the z-score against 28 days. Anything you leave out keeps
the value from Settings → Alerts. Where alerts are delivered (desktop, webhook) is
set in Settings.

Percentages can be written as `30`, `30%` or `0.3`.

### `search`

What the site wants to be found for. It sets up Demand, AI search and Mentions,
which otherwise use guesses from the hostname or what's saved by hand in Studio.
While the file sets them, those pages show them read-only.

- `brand`: up to 10 names for the product, with the spellings people use
  (`site lens` also matches `sitelens` and `site-lens`). It's the **Brand** group in
  Demand, the names that count as "named you" in AI answer checks, and terms
  Mentions watches for this site.
- `competitors`: up to 10 rival names. It's the **Competitors** group in Demand.
  Mentions doesn't watch them, because their mentions would show up on your charts.
- `topics` (up to 10): each thing the site wants to be found for.
  - `name`: shown in Studio. A topic can't be called `Other`, or `Brand` or
    `Competitors` when those lists are set.
  - `match`: a case-insensitive regex for the topic's queries. Without it, the
    topic's `targets` are its pattern.
  - `targets`: up to 20 queries the topic must win.
  - `page`: the page that should rank for them and be cited for its questions.
  - `ask_ai`: questions for the AI search answer checks.
  - A topic needs at least one of `match`, `targets` or `ask_ai`.
- `ask_ai`: questions that aren't about one topic.

Demand groups queries in this order, and the first match wins: Brand, then each
topic, then Competitors. So a topic written for "raycast alternative" gets those
queries even when Raycast is a competitor, and Competitors keeps the rival-name
queries no topic claimed. Brand and competitor names match whole words only. Demand
shows 8 groups at most.

There can be up to 12 `ask_ai` questions in all, because each one is a paid Claude
call per check. Ask what a customer who doesn't know the product would ask: "What is
Example?" always names you, so it measures nothing. The Anthropic key and the weekly
re-check stay in Settings.

`page` and `targets` aren't shown yet. They're for the upcoming topic view on the
Google page (wrong page ranking, missing pages, target queries that drop).

## Checking a file

- In Studio: the site's Setup page shows errors, warnings, and which events
  the file names that the site hasn't sent.
- From an agent: use the `check_site_config` MCP tool, or
  `POST /api/sites/<id>/config/check` with `{ "yaml": "…" }`.
- **Start one** in Settings, or the `draft_site_config` tool, writes a starting file
  from the goals in Settings (or Studio's guesses), suggested funnels, and the
  query groups and AI questions saved in Studio, so moving them into the file
  loses nothing.
