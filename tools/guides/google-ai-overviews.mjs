// Targets: "ai overview" (~1,300/week on Bing US, up ~50% in 4 weeks, Nov 2026),
// "google ai overview", "how to appear in ai overviews". The how-to-get-cited
// page; google-ai-mode covers the traffic side. Link, don't repeat.
export default {
  order: 3.26,
  kicker: 'AI search',
  short: 'Get cited in AI Overviews',
  title: 'Google AI Overviews: How to Get Cited | Kauzl',
  h1: 'Google AI Overviews: how to get your site cited',
  description: 'How Google picks the links in AI Overviews, what makes a page quotable, how to check if you’re cited, and how to opt a page out.',
  blurb: 'How AI Overviews choose sources, how to write a page they quote, and how to check.',
  lead: 'AI Overviews are the AI-written summary Google shows above some search results, with links to the pages it used. Getting one of those links comes down to ranking for the question and having a passage clear enough to quote.',
  published: '2026-11-28',
  tools: ['schema-generator', 'serp-preview', 'llms-txt-generator'],
  inShort: [
    'An <strong>AI Overview</strong> is a short Gemini-written answer at the top of Google results, with links to its sources beside or under it.',
    'There’s no form to apply and no special markup. A page must be <strong>indexed and allowed to show a snippet</strong>; Google then picks sources it judges helpful.',
    'Cited pages usually <strong>already rank</strong> for the question or a close variant, and have a <strong>self-contained answer</strong> right under a matching heading.',
    'Check by searching your target questions in a private window, and in Search Console by watching <strong>impressions rise while clicks stay flat</strong>.',
    'To keep a page out, use <code>nosnippet</code>, <code>data-nosnippet</code> on a passage, or a tight <code>max-snippet</code>. That also removes normal snippets.',
  ],
  body: `
<h2>How AI Overviews choose their sources</h2>
<p>For searches where Google thinks a summary helps, it writes one with its Gemini models from pages in its index, then links the pages that support it. Google’s guidance is that there are no extra requirements: the same signals that make a page rank and show a snippet make it eligible.</p>
<p>In practice, the pages linked in an AI Overview tend to share three things:</p>
<ul>
<li><strong>They rank for the question,</strong> or for one of the related searches Google runs behind it. A page on page five is rarely used.</li>
<li><strong>They hold a passage that answers it directly,</strong> one or two sentences that make sense lifted out on their own.</li>
<li><strong>They add something,</strong> such as a number, a step, a comparison or a caveat that the summary needs and other pages don’t have.</li>
</ul>

<h2>How to write a page AI Overviews quote</h2>
<ol class="steps-list">
<li><strong>Use the question as a heading.</strong> “How long does GA4 keep data?” beats “Data retention settings”.</li>
<li><strong>Answer in the first sentence under it.</strong> Start with the subject (“GA4 keeps event data for two months by default”), not “It” or “This”, so the sentence works alone.</li>
<li><strong>Then explain.</strong> Steps as a numbered list, comparisons as a table. Both are easy to quote and easy to check.</li>
<li><strong>Add an FAQ for the follow-ups,</strong> with FAQPage structured data. The <a href="/tools/schema-generator/">schema generator</a> writes it.</li>
<li><strong>Show dates and keep facts current.</strong> A visible “updated” date, and correct numbers, matter when Google compares sources.</li>
<li><strong>Check the snippet.</strong> Your title and description are still what people see under the link; preview them with the <a href="/tools/serp-preview/">SERP preview</a>.</li>
</ol>

<h2>How to check if you’re cited</h2>
<ul>
<li><strong>Search it yourself.</strong> Open a private window, search the five or ten questions your customers ask, and note which pages are linked in the Overview. Repeat monthly: AI answers change more often than rankings.</li>
<li><strong>Search Console.</strong> Clicks and impressions from AI Overviews are counted in the Performance report’s Web totals. A question query whose impressions jump while clicks stay flat is often one where you appear in the Overview.</li>
<li><strong>GA4.</strong> Clicks from an Overview arrive as <code>google / organic</code>, so look at landing pages: a guide gaining Google visits after a rewrite is a good sign.</li>
</ul>
<p>For the clicks side, including Google’s conversational AI Mode, read <a href="/guides/google-ai-mode/">what AI Mode means for your traffic</a>.</p>

<h2>How to keep a page out of AI Overviews</h2>
<p>Some pages, such as paid content or answers you want people to click for, are better left out. Google’s snippet controls apply to AI features:</p>
<ul>
<li><code>&lt;meta name="robots" content="nosnippet"&gt;</code> keeps the whole page out of snippets and AI answers.</li>
<li><code>data-nosnippet</code> on an element keeps just that passage out.</li>
<li><code>max-snippet:50</code> (or another number) limits how much text can be shown.</li>
</ul>
<p>These also shrink your normal search snippet, which can lower clicks, so use them on purpose. Blocking Google-Extended in robots.txt does not remove you from AI Overviews; it covers training of Gemini models, not Search.</p>
`,
  goal: [
    'Know how Google picks the pages linked in AI Overviews.',
    'Write an answer-first section that an AI Overview can quote.',
    'Check whether your pages are cited, and opt a page out if needed.',
  ],
  steps: [
    { text: 'List five questions your customers search, and check each in a private window.' },
    { text: 'Rewrite one page: the question as a heading, the answer in its first sentence.', href: '/guides/what-is-aeo/' },
    { text: 'Add FAQPage structured data for the follow-up questions.', href: '/tools/schema-generator/' },
  ],
  check: [
    { q: 'What does a page need to be eligible for AI Overviews?', options: ['Indexed and allowed a snippet', 'A special AI Overview tag', 'An llms.txt file', 'Google-Extended allowed'], answer: 0, why: 'Google says AI Overviews have no extra requirements beyond being indexed and eligible for a snippet.' },
    { q: 'Which keeps one passage out of AI Overviews?', options: ['data-nosnippet on it', 'Blocking Google-Extended', 'A noindex on another page', 'Removing the FAQ'], answer: 0, why: 'data-nosnippet hides that element from snippets and AI answers; Google-Extended is about Gemini training.' },
  ],
  faq: [
    ['What are Google AI Overviews?', 'Google AI Overviews are short AI-written answers shown at the top of some Google search results, generated by Gemini models, with links to the web pages used as sources.'],
    ['How do I get my website in AI Overviews?', 'A website gets into AI Overviews by ranking for the question and having a clear, self-contained answer under a matching heading. Google says no special markup is needed, only that the page is indexed and allowed a snippet.'],
    ['Do AI Overviews reduce clicks?', 'AI Overviews can reduce clicks on simple questions, because the answer is on the results page. Pages linked as sources still get visits, and searches needing detail or tools are less affected.'],
    ['Can I stop Google using my page in AI Overviews?', 'Google respects nosnippet, data-nosnippet and max-snippet for AI Overviews. Blocking Google-Extended in robots.txt does not remove pages from AI Overviews; it covers Gemini model training.'],
    ['How do I track AI Overview traffic?', 'AI Overview clicks are counted in Search Console’s Web search totals and arrive in GA4 as google / organic. Neither shows them separately, so watch question queries where impressions rise and clicks stay flat.'],
  ],
};
