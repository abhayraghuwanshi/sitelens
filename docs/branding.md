# Branding and domain

Notes from 13–14 November 2026. **The name is Kauzl** (kauzl.com), said KAW-zuhl,
like "causal"; *Kauz* is German for a small owl. Magpie (below) was dropped
because github.com/yetone/magpie and r/magpie already use the word. The
full naming research is in `reports/Analytics product brand names.md`.

User-facing text, the logo and the favicon now say Kauzl. Internal names stay
as they were so nothing breaks: `.sitelens.yml`, the `sitelens` MCP server
key, storage keys, the BigQuery `sitelens_*` datasets, branch prefixes, the
desktop app's identifier `com.sitelens.studio` (its data folder) and the
hosted app on Fly (`sitelens-studio`, sitelens.kazekit.com).

## The pick: Magpie

- **Name:** Magpie
- **Domain:** magpiehq.io
- **Why:** one memorable word with a built-in mascot, like Umami or PostHog.
  A magpie collects things from everywhere, the way the product pulls from
  GA4, Search Console, GitHub, Reddit and AI answers.
- **Why not "SiteLens":** it sounds generic and other products may use it,
  which makes it hard to own in search results.

## Domains

Checked with `whois` on 13 November 2026. Recheck before buying.

| Domain | Status |
|---|---|
| **magpiehq.io** | Available: register first |
| magpie.com / .io | Taken |
| magpiehq.com | Taken |
| getmagpie, usemagpie, trymagpie, magpieapp (.com, .io) | Taken |
| **didthatwork.com** | Available: a home for the free tools (UTM builder, AI crawler checker, "does ChatGPT recommend you?") |

`.app` lookups came back "taken" for every name, even made-up ones, so the
check was probably misreading the registry. Confirm .app on a registrar
(Porkbun, Namecheap).

## Similar names

- **Magpie E-commerce Intelligence**: a Southeast Asian SaaS that tracks
  prices and market share for online stores. Not web analytics, but a data
  product in a related field, which matters for trademarks.
- **magpieanalytics.com**: registered; what's on it is unclear.
- **yetone/magpie** (github.com/yetone/magpie): an AI coding-agent tool
  ("every agent's model, one place"), published 13 November 2026 by a
  developer with popular open-source projects. Same audience as ours
  (developers using AI agents), so it could own "magpie" in dev search
  results.
- r/magpie on Reddit is about the bird.
- No website-analytics product called Magpie turned up.

## Before committing

1. Register **magpiehq.io** (and didthatwork.com if wanted).
2. Claim the social handles, such as @magpiehq on X, GitHub and Bluesky.
3. Search trademarks for "Magpie" in software and online-services
   categories, in the US (USPTO) and anywhere else you'll sell. Given the
   e-commerce company above, a quick opinion from a trademark lawyer is worth
   it.

## Rename plan (when ready)

Start with what people see: the home page (`server/home.mjs`), page titles,
the sign-in page and the logo text. Leave internal names (storage keys like
`studio:*`, file names, the `.sitelens.yml` config file) alone, or rename
them with a migration, so nothing breaks for existing users.

## Other names considered

| Name | Note | Free domain |
|---|---|---|
| Shiptale | "The tale of what you shipped"; no search competition | shiptale.io |
| Telltail | Play on "telltale", with a tail for a mascot | telltail.io |
| Plotpie | Playful, like Umami | plotpie.io |
| Upshot | Means "the result"; plain name taken everywhere | upshotly.io |
| Did That Work? | Names the question the product answers; r/didthatwork fits | didthatwork.com, .io |
| Aftermark | The mark a change leaves after it ships. A registry check found .com/.io/.app/.dev all taken (the quick whois said .io was free; it was wrong) | aftermarkhq.com |
| Jackdaw | Collector bird like the magpie, but crowded on GitHub and npm | none checked as free |

Taken on .com, .io and .app: Upshot, Plotline, Telltale, Tidemark, Lookout,
Afterglow, Bellwether, Wakeline, SignalFox, ShipLens, Trailmark.
