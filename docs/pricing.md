# Positioning and pricing (draft)

Notes from November 2026. Nothing here is built yet; it's the plan for when the
hosted version takes payments.

## Where SiteLens stands

Umami, Plausible and GA4 count visits. SiteLens sits on top of a counter and
answers what they don't:

- **What changed, and why?** The Story and Timeline line traffic up against
  deploys, releases and posts.
- **What should I do next?** To-dos come from the data, and the Timeline shows
  whether each change helped.
- **Is AI recommending me?** Answer checks across ChatGPT, Claude, Gemini and
  Perplexity, plus AI bots in the server logs.

Pitch: *the analyst on top of your analytics*, not a better Umami.

Idea worth doing: add **Umami as a data source** next to GA4, so privacy-minded
Umami users become SiteLens users instead of competitors. "Works with whatever
tracker you already have."

## Charge by sites, not pageviews

Umami and Plausible charge by events or pageviews because storing traffic is
their cost. SiteLens doesn't store anyone's traffic, so that metric doesn't fit.

The real cost is AI calls. The app's own estimate is about $0.05–0.20 per
question for Claude and $0.01–0.05 per OpenRouter assistant. 11 questions on
4 engines, checked weekly, is roughly **$8–12 a month** (estimate, not
measured). Managed AI checks can't be unlimited; that's where the paywall goes.

## Tiers

Monthly subscription, yearly at about two months free.

| | **Free** | **Pro, ~$19/mo** ($190/yr) | **Team, ~$59/mo** |
|---|---|---|---|
| Sites | 1 | 10 | 30+ |
| Story, Timeline, to-dos, GA4 + Search Console | ✓ | ✓ | ✓ |
| History | 90 days | Full | Full |
| Bing, content cycles, journeys and funnels | – | ✓ | ✓ |
| Alerts | In the app | + Slack / Discord / email | ✓ |
| MCP and Claude analysis | – | ✓ | ✓ |
| AI answer checks, own key | ✓ unlimited | ✓ unlimited | ✓ unlimited |
| AI answer checks run by us | – | ~10 questions, monthly | ~30 questions, weekly |
| Teammates and client reports | – | – | ✓ |

Why these prices:

- **Pro sits beside the analytics tools:** Umami Pro is about $20/month,
  Plausible starts at $9–19.
- **AI checks alone cost more elsewhere:** AI-visibility trackers start around
  $29/month (Otterly) and $95/month (Peec). Headline: analytics plus AI search
  tracking for less than an AI tracker alone.
- **Team is for agencies:** one person, many client sites, the buyer most
  likely to pay well.

## Guardrails

- **The first site's Story is always free.** It's the hook. Charge for more
  sites, longer history and alerts that reach you outside the app.
- **Hard monthly AI budget per account,** in credits. When it runs out, checks
  pause until next month. No silent overage billing.
- **Bring-your-own-key is the safety valve.** The app already takes an
  Anthropic or OpenRouter key; heavy users pay their own AI costs.
- **Soft limits** for sites and history: a banner, not a locked dashboard
  (Plausible locks only after two months over).
- **Local desktop app free (or one-time purchase); subscription only for
  hosted,** where the costs are: servers, scheduled syncs, managed AI.

## Before setting final prices

Log what each hosted account actually spends on AI for a month. Whether Pro is
$19 or $29 depends on that.

## Sources (checked November 2026)

- [Umami Cloud pricing 2026](https://canivibecodeit.com/umami-cloud)
- [Umami pricing compared (Softwr)](https://www.softwr.com/pricing/umami)
- [Plausible pricing 2026 (Seline)](https://seline.com/blog/plausible-analytics-pricing)
- [Plausible pricing breakdown (replastats)](https://replastats.com/plausible-pricing/)
- [AI visibility tool pricing, October 2026 (RankScope)](https://rankscope.ai/blog/ai-visibility-tool-pricing)
- [AI visibility tools pricing (Heuriso)](https://heuriso.com/en/blog/ai-visibility-tools-pricing)
- [Affordable AI search visibility tools (Bloomiro)](https://bloomiro.com/blog/best-affordable-ai-search-visibility-tools)
