# SEO and GEO rules

Every public page (the free tools, the guides and the home page) has to pass
these rules. They live in `tools/seo-rules.mjs`.

- `npm run tools:build` checks every page it writes, and fails with the page,
  the rule and the fix.
- `test/seo-rules.test.js` checks the home page, every guide's source and
  `robots.txt`.

**SEO** is what Google and Bing check, and what Bing Webmaster Tools and Search
Console flag. **GEO** (generative engine optimisation) is what gets a page found,
trusted and quoted by ChatGPT, Claude, Perplexity and Copilot.

## Every page

| Rule | Limit | Why |
|---|---|---|
| `title` | 15–60 characters, unique | Google cuts titles at about 600px (around 60 characters); Bing flags long ones. Put the search phrase first and `\| Kauzl` last. |
| `description` | 25–160 characters, unique | Bing Webmaster Tools flags anything outside 25–160. Write it for the person reading search results. |
| `h1` | exactly one | It's the page's topic, for search engines and screen readers. |
| `headings` | no skipped levels | Readers and AI parsers use the outline to pick passages. |
| `canonical` | the page's own `https://kauzl.com/…` URL | Otherwise one page under two URLs splits its ranking. |
| `noindex` | never on a public page | |
| `social` | `og:title`, `og:description`, `og:url` (= canonical), `og:image` (absolute https) + `og:image:alt`, `twitter:card` | Reddit, X, LinkedIn and Slack build the link preview from these. The image is `tools/assets/og.png` (1200×630). |
| `alt` | every `<img>` has alt (`alt=""` for decoration) | |
| `structured-data` | valid JSON-LD with `@context` and `@type`; an Article has headline (≤110), datePublished, dateModified, author, publisher; an FAQPage has 3+ questions | It's how search engines and AI assistants know what the page is. |

## Every guide (GEO)

| Rule | What | Why |
|---|---|---|
| `answer-first` | a `lead`, and 3–5 `inShort` bullets | AI assistants quote the direct answer near the top. |
| `faq` | 3+ questions, each ending in `?`, each answer ≤320 characters and starting with its subject (not "It…" or "This…") | Each answer gets quoted alone, so it has to make sense alone. They also become FAQPage data. |
| `structure` | 3+ `<h2>` sections | Assistants pick passages by heading. |
| `dates` | `published: 'YYYY-MM-DD'`, and `updated` on or after it | Assistants prefer, and show, fresh sources. When you change a guide's facts, set `updated`. |
| `disclosure` | a `Compare` guide's lead says "We make Kauzl" | Honest comparisons get trusted and cited; ones that hide who wrote them don't. |
| `no-prices` | no `$`, `€` or `£` amounts in a `Compare` guide | Prices change, and AI assistants keep repeating the old one for months. Link to the pricing page instead. |

## The whole site

| Rule | What |
|---|---|
| `unique` | No two pages share a title or a description. |
| `sitemap` | Every page is in `kauzl.com/sitemap.xml`. |
| `llms` | Every guide and tool is in `kauzl.com/llms.txt`, which the build writes. |
| `robots` | `robots.txt` doesn't block Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, PerplexityBot or Claude-SearchBot from the site, and it names the sitemap. Blocking AI *training* bots is fine. |

## Checks a build can't make

- **Claims about other products.** Check them on their own site before
  publishing, and say "as of" where a claim may change.
- **Claims about Kauzl.** Only describe what's built. For example, the MCP
  server uses a token, so it works in Claude Code, Claude Desktop and Cursor.
  Don't promise ChatGPT until there's OAuth.
- **After publishing:** submit `https://kauzl.com/sitemap.xml` in Search Console
  and Bing Webmaster Tools, and use "Request recrawl" for pages whose title or
  description changed.
