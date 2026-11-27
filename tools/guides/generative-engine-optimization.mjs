// Targets: "generative engine optimization" (~30/week on Bing, steady),
// "answer engine optimization", "what is geo", "how to get recommended by
// chatgpt", "ai visibility" (people also search "peec ai"). The numbers in
// "What we saw" come from Kauzl's own answer checks on three small sites we run
// (ai-search.db, Claude with web search, 2026-11-07 to 2026-11-20); keep them
// anonymous and update them, with `updated`, when there's a bigger sample.
// Claims about Kauzl: answer checks ask Claude, ChatGPT, Gemini and Perplexity
// (Grok optional) with the user's own Anthropic or OpenRouter key, up to 12
// questions from .sitelens.yml `ask_ai`, optional weekly re-check.
export default {
  order: 3.2,
  kicker: 'AI search',
  short: 'Get recommended by AI',
  title: 'GEO: How to Get Recommended by ChatGPT and Claude | Kauzl',
  h1: 'Generative engine optimization: how to get recommended by ChatGPT, Claude and Perplexity',
  description: 'Generative engine optimization (GEO) in practice: why AI assistants skip small products, what gets you named, and how to check it each week.',
  blurb: 'Why AI assistants skip small products, what actually gets you named, and how to measure it.',
  lead: 'Generative engine optimization (GEO) means making your product the one ChatGPT, Claude, Perplexity and Gemini name when someone asks for a recommendation. Most of it is done on pages the assistant reads while it answers, not on your own home page. We make Kauzl, which runs these checks. The numbers below come from our own sites.',
  published: '2026-11-22',
  tools: ['llms-txt-generator', 'ai-robots-txt-generator', 'schema-generator'],
  inShort: [
    'AI assistants with web search <strong>recommend what the pages they find recommend</strong>. To be named, you need to be on those pages: comparisons, “best X” lists, Reddit threads, directories.',
    'Being <strong>cited is not being recommended</strong>. In our checks, a site’s comparison page was used as a source three times more often than the product itself was named.',
    'Assistants <strong>discount lists where the author ranks itself first</strong>. Honest comparisons and mentions on other people’s sites count for more.',
    'Write pages that answer the exact question a buyer asks, in their words, with the answer in the first lines. Keep them dated and current.',
    'Measure it the way buyers see it: <strong>ask the assistants your customers’ questions every week</strong> and record who they name.',
  ],
  body: `
<h2>How an AI assistant picks what to recommend</h2>
<p>When someone asks ChatGPT, Claude or Perplexity “what’s the best tool for X?”, the assistant usually runs a few web searches, reads the top results, and summarises what those pages agree on. A small product that isn’t in the model’s memory gets named only if the pages it reads name it.</p>
<p>That changes what “optimising” means. Ranking your own product page for “best X” is hard and, as you’ll see below, often not enough. The pages that win are the ones the assistant finds and trusts for that question:</p>
<ul>
<li><strong>Comparison and “best X” articles</strong>, on your site and especially on other people’s.</li>
<li><strong>Directories and review sites</strong> such as AlternativeTo, G2, Product Hunt and SourceForge, which assistants cite all the time for “alternative to” questions.</li>
<li><strong>Reddit, Hacker News and forum threads</strong> where real people say what they use.</li>
<li><strong>Your own docs and guides</strong>, when they answer the question more directly than anyone else.</li>
</ul>
<p>Some questions don’t trigger a search at all. “How do I add a browser source in OBS?” is answered from memory, so no website gets the credit. Spend your effort on questions where people are choosing a product.</p>

<h2>What we saw when we asked</h2>
<p>We ask Claude, with web search on, the questions customers would ask for three small products we run: a desktop launcher, a stream overlay tool and a cloud planning tool. Over 22 answers (November 2026), this is what came back:</p>
<table>
<thead><tr><th>Product</th><th>Questions</th><th>Named in the answer</th><th>Site used as a source</th></tr></thead>
<tbody>
<tr><td>Desktop launcher</td><td>11</td><td>1</td><td>4</td></tr>
<tr><td>Stream overlay tool</td><td>9</td><td>2</td><td>1</td></tr>
<tr><td>Cloud planning tool</td><td>2</td><td>0 (2 were other companies with the same name)</td><td>0</td></tr>
</tbody>
</table>
<p>Four things stood out:</p>
<ol class="steps-list">
<li><strong>Cited is not recommended.</strong> The launcher’s comparison posts were the first source in two answers about Windows docks and launchers. The assistant used them as research and then recommended other products, including ones the post ranked lower.</li>
<li><strong>An exact match wins.</strong> The one time the launcher was named first, the question described what it does almost word for word: an app that keeps tabs, apps and files together for each project. Broad questions like “best new tab extension” went to better-known names.</li>
<li><strong>Self-ranked lists get discounted.</strong> One answer said most “best new tab” lists come from companies ranking their own product first, so it favoured picks that showed up across several sources. Your own list helps when other sites agree with it.</li>
<li><strong>A shared name hides you.</strong> Asked about the cloud planning tool by name, the assistant described a Norwegian waterproofing product and several engineering firms with the same name. If your name is common, every page needs to say what the product is next to the name.</li>
</ol>
<p>That’s a small sample from one assistant, but it fits what others report: assistants repeat the consensus of the pages they read, and a product page that only talks about itself rarely makes it into the answer.</p>

<h2>Seven things that get you named</h2>
<ol class="steps-list">
<li><strong>Write the page for the buyer’s exact question.</strong> “Raycast alternative for Windows” and “free macOS-style dock for Windows” are different pages. Put the question in the title and the h1, and the answer in the first two sentences.</li>
<li><strong>Write honest comparisons.</strong> Say who wrote it (“we make X”), include rivals that really are better at something, and say when to pick them. A page that only flatters you is the kind assistants learn to skip.</li>
<li><strong>Get onto pages you don’t own.</strong> List the product on AlternativeTo and relevant directories, answer real Reddit and forum questions where it fits (and say it’s yours), and ask the authors of existing “best X” articles to look at it. Each one is a page an assistant may read.</li>
<li><strong>Say what the product is, everywhere.</strong> One plain sentence near the name: “Kauzl reads Google Analytics and Search Console and explains why traffic changed.” Use the same sentence on your site, directories and social profiles, so a model links the name to the category.</li>
<li><strong>Let AI search crawlers in.</strong> OAI-SearchBot, Claude-SearchBot, PerplexityBot and Bingbot must be able to fetch your pages. Blocking training bots is a separate choice. The <a href="/tools/ai-robots-txt-generator/">AI robots.txt generator</a> sets both.</li>
<li><strong>Make pages easy to quote.</strong> Short answer-first paragraphs, clear headings, tables for comparisons, a FAQ where each answer stands alone, and Article and FAQPage structured data (the <a href="/tools/schema-generator/">schema generator</a> writes it). An <a href="/tools/llms-txt-generator/">llms.txt</a> file lists your best pages for agents.</li>
<li><strong>Keep facts current and dated.</strong> Show a published and updated date. Assistants prefer fresh sources and keep repeating old prices and features for months, so don’t put prices on comparison pages. Link to your pricing page.</li>
</ol>
<p>Ranking in Bing matters more than people expect: Copilot is built on it, and ChatGPT’s search has drawn on Bing results too. Submit your sitemap to Bing Webmaster Tools as well as Search Console.</p>

<h2>How to measure it</h2>
<p>Referral visits from <code>chatgpt.com</code> or <code>perplexity.ai</code> show the answers that sent someone, not the answers where you were missing. See <a href="/guides/track-chatgpt-traffic-google-analytics/">how to track ChatGPT traffic in GA4</a> for that half. For the other half, ask the assistants directly:</p>
<ol class="steps-list">
<li><strong>Write 8–12 questions</strong> a customer who doesn’t know you would ask. “What is Example?” always names you, so it measures nothing. Ask “what’s a good tool for…” and “alternative to [rival]”.</li>
<li><strong>Ask each assistant with web search on</strong>, since that’s how most people use them now. Answers vary from run to run, so ask the same questions every week rather than reading one answer.</li>
<li><strong>Record three things per answer:</strong> were you named, was your site cited, and which other sites were cited. That last list is your outreach list: those are the pages to get onto.</li>
<li><strong>Change one thing, then compare</strong> the weeks before and after, as you would for any other change.</li>
</ol>

<h2>Tools for tracking AI recommendations</h2>
<p>You can do the above by hand in a spreadsheet. If you’d rather not, there are two kinds of tool (as of November 2026):</p>
<ul>
<li><strong>Dedicated AI visibility trackers</strong> such as Peec AI, Profound and Otterly.AI run large sets of prompts across assistants and report share of voice against competitors. They suit marketing teams tracking many prompts and brands.</li>
<li><strong>Kauzl</strong> runs answer checks next to your analytics. You list up to 12 questions in your site’s <code>.sitelens.yml</code>. Kauzl asks Claude, ChatGPT, Gemini and Perplexity with web search, using your own Anthropic or OpenRouter key, optionally every week. It records whether each answer names you, cites you and who else it cites. Next to that it shows the same week’s AI referral visits from GA4, search clicks, and what you shipped or posted, so you can see whether a new comparison page changed the answers. <a href="/tour/">Take the tour</a> to see it with sample data.</li>
</ul>
`,
  faq: [
    ['What is generative engine optimization?', 'Generative engine optimization (GEO) is the work of getting a product or page named and cited in answers from AI assistants such as ChatGPT, Claude, Perplexity and Gemini. It overlaps with SEO, since assistants read search results, but it also depends on mentions on other sites.'],
    ['Is GEO different from SEO?', 'GEO builds on SEO rather than replacing it. Assistants with web search read the pages that rank, so ranking still matters. GEO adds being named on comparisons, directories and forums, and writing pages an assistant can quote in one passage.'],
    ['Why doesn’t ChatGPT recommend my product?', 'ChatGPT names products that the pages it finds agree on. A small product usually isn’t in its memory, so if the top results for a question don’t mention it, it won’t be named, even when its own site ranks.'],
    ['How long does GEO take to work?', 'AI search results change as soon as the pages behind them change. A new comparison or directory listing can show up in answers within days of being indexed. Changes to a model’s built-in knowledge take months, until its next training run.'],
    ['How do I check if AI assistants mention my brand?', 'Ask ChatGPT, Claude, Perplexity and Gemini, with web search on, the questions your customers ask, and record whether each answer names or cites you. Repeat weekly, because answers vary. Kauzl and dedicated AI visibility trackers automate this.'],
  ],
  cta: { title: 'Want to know if AI assistants name you?', text: 'Kauzl asks ChatGPT, Claude, Gemini and Perplexity your customers’ questions each week and shows who they named, next to your GA4 and Search Console data.' },
};
