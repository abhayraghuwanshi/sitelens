// Targets: "llms.txt" (~23/week on Bing US, Nov 2026), "llm.txt" (~79 total in
// the same window), "what is llms.txt", "llms.txt example". Pairs with the
// /tools/llms-txt-generator/ tool. Be honest: no major AI search engine has said
// it uses the file to pick what to cite.
export default {
  order: 3.35,
  kicker: 'AI search',
  short: 'What is llms.txt?',
  title: 'What Is llms.txt? Do You Need One? | Kauzl',
  h1: 'What is llms.txt, and does your site need one?',
  description: 'llms.txt is a Markdown file that gives AI tools a short map of your site. What goes in it, an example, who reads it, and whether it’s worth adding.',
  blurb: 'What llms.txt is, an example file, who actually reads it, and when it’s worth ten minutes.',
  lead: 'llms.txt is a plain Markdown file at the root of a website, at <code>/llms.txt</code>, that gives AI tools a short summary of the site and links to its most useful pages. It’s cheap to add, but it isn’t a ranking switch for AI search.',
  published: '2026-11-28',
  tools: ['llms-txt-generator', 'ai-robots-txt-generator', 'schema-generator'],
  inShort: [
    '<strong>llms.txt</strong> is a proposed standard, published in 2024 by Jeremy Howard of Answer.AI: a Markdown file at <code>/llms.txt</code> describing a site for language models.',
    'It has a <strong>title</strong>, a one-line <strong>summary</strong>, and <strong>sections of links</strong> to the pages that matter, each with a short note.',
    'Coding assistants and documentation tools use it most, to load a product’s docs quickly. Some sites add <code>llms-full.txt</code> with the full text.',
    'No major AI search engine has said it uses llms.txt to <strong>decide what to cite</strong>. Treat it as a helpful map, not a ranking factor.',
    'It takes ten minutes with the <a href="/tools/llms-txt-generator/">llms.txt generator</a>, and does no harm.',
  ],
  body: `
<h2>What llms.txt is for</h2>
<p>Web pages are built for people: menus, cookie banners, scripts, footers. A language model reading a site wastes most of its limited context on that. llms.txt is a short, clean summary written for machines: what the site is, and which pages to read for what.</p>
<p>The idea is closer to a table of contents than to <code>robots.txt</code>. robots.txt tells crawlers what they may fetch. llms.txt tells an AI tool what is worth fetching, and doesn’t block anything.</p>

<h2>What goes in the file: an example</h2>
<p>The format is plain Markdown in a fixed order: an H1 with the site or product name, a blockquote with a one-line summary, optional notes, then H2 sections of links.</p>
<pre><code># Kauzl

&gt; Kauzl puts a website's traffic, searches and releases on one calendar, so you can see what changed and why.

Kauzl reads Google Analytics, Search Console, Bing and GitHub.

## Guides
- [Track ChatGPT traffic in GA4](https://kauzl.com/guides/track-chatgpt-traffic-google-analytics/): where AI visits show up and a regex for an AI channel
- [What is AEO?](https://kauzl.com/guides/what-is-aeo/): answer engine optimization explained

## Tools
- [UTM builder](https://kauzl.com/tools/utm-builder/): build campaign links

## Optional
- [Course](https://kauzl.com/guides/): every lesson in order</code></pre>
<p>Keep each note to one line saying what the page answers. Put the pages you most want read first. The <em>Optional</em> section is, by the proposal’s convention, the part a tool can skip when it’s short on space.</p>

<h2>Who actually reads llms.txt</h2>
<ul>
<li><strong>Coding assistants and agents.</strong> Developers point Cursor, Claude Code and similar tools at a library’s llms.txt or llms-full.txt to load its docs in one go. This is where the file is used most.</li>
<li><strong>Documentation platforms.</strong> Several docs hosts generate llms.txt automatically for every docs site.</li>
<li><strong>AI search engines.</strong> ChatGPT search, Perplexity, Claude, Copilot and Google’s AI features find pages through their own crawlers and search indexes. None has said it uses llms.txt to choose sources, as of this writing.</li>
</ul>
<p>So adding llms.txt won’t, on its own, get you cited. What does is covered in <a href="/guides/generative-engine-optimization/">how to get recommended by AI assistants</a>.</p>

<h2>Should you add one?</h2>
<p>Add one if you have docs, an API or a developer product: assistants really do use it, and it saves your users time. For other sites it’s a small, harmless extra; spend the time on answer-first pages and on letting AI search bots crawl you first (<a href="/guides/ai-crawlers-robots-txt/">which AI crawlers to allow</a>).</p>
<p>If you add one, keep it current: a file listing pages that moved is worse than none. Generate it from your sitemap at build time, as kauzl.com does with <a href="https://kauzl.com/llms.txt">its own llms.txt</a>, so it can’t go stale.</p>
`,
  goal: [
    'Know what llms.txt is and how it differs from robots.txt.',
    'Write an llms.txt with a summary and the pages that matter.',
    'Decide whether llms.txt is worth adding to your site.',
  ],
  steps: [
    { text: 'List the ten pages that best explain your site, each with a one-line note.' },
    { text: 'Generate the file with the llms.txt generator and save it at /llms.txt.', href: '/tools/llms-txt-generator/' },
    { text: 'Check robots.txt lets AI search bots crawl the pages it links to.', href: '/tools/ai-robots-txt-generator/' },
  ],
  check: [
    { q: 'Does llms.txt block AI crawlers?', options: ['No, it only points to pages', 'Yes, like robots.txt', 'Only GPTBot', 'Only training bots'], answer: 0, why: 'llms.txt is a map of useful pages. Blocking is done in robots.txt.' },
    { q: 'Who uses llms.txt most today?', options: ['Coding assistants loading docs', 'Google ranking', 'Bing indexing', 'Ad networks'], answer: 0, why: 'Developers point coding tools at a library’s llms.txt to load its docs; search engines haven’t said they use it.' },
  ],
  faq: [
    ['What is llms.txt?', 'llms.txt is a Markdown file at the root of a website that summarises the site for AI tools and links to its most useful pages, each with a short note. It was proposed by Jeremy Howard of Answer.AI in 2024.'],
    ['Does llms.txt help SEO or AI search rankings?', 'llms.txt is not a known ranking factor. No major search or AI search engine has said it uses the file to choose what to show or cite, as of this writing; crawling, indexing and content quality still decide that.'],
    ['What is the difference between llms.txt and robots.txt?', 'robots.txt tells crawlers which URLs they may fetch. llms.txt does not allow or block anything; it points AI tools to the pages worth reading and says what each one covers.'],
    ['What is llms-full.txt?', 'llms-full.txt is an optional companion file that contains the full text of a site’s key pages in one Markdown document, so an AI tool can read everything without fetching each page.'],
    ['Where do I put llms.txt?', 'An llms.txt file goes at the root of the domain, for example https://example.com/llms.txt, served as plain text, the same way robots.txt is.'],
  ],
};
