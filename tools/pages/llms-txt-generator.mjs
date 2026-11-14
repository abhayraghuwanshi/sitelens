export default {
  name: 'llms.txt Generator',
  title: 'llms.txt Generator: Create an llms.txt File for AI Assistants (Free) | Kauzl',
  description: 'Create an llms.txt file in the format from llmstxt.org: a short Markdown map of your site that helps ChatGPT, Claude and AI coding tools find your most important pages and docs.',
  blurb: 'A Markdown map of your site that helps AI assistants find your key pages.',
  related: ['ai-robots-txt-generator', 'ai-crawler-log-analyzer', 'schema-generator'],
  h1: 'llms.txt generator',
  intro: 'An <code>llms.txt</code> file gives AI assistants a short, clean map of your site: what you do and which pages matter. Fill in the form and download the file.',
  script: 'llms-txt.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <h2>About your site</h2>
    <label class="field"><span>Name</span><input type="text" name="name" placeholder="Acme Analytics"></label>
    <label class="field"><span>One-sentence summary</span><input type="text" name="summary" placeholder="Acme is privacy-friendly analytics for small online stores."></label>
    <label class="field"><span>More detail <small class="muted">optional</small></span><textarea name="details" rows="3" style="font-family:var(--font);font-size:15px" placeholder="Who it's for, key facts, pricing model, what makes it different."></textarea></label>
    <h3>Sections and links</h3>
    <p class="hint" style="margin-top:-4px">One link per line: <code>URL | Title | short note</code>. Title and note are optional.</p>
    <div id="sections"></div>
    <button class="btn" type="button" id="add">+ Add section</button>
  </form>
  <div class="panel sticky">
    <h2>llms.txt</h2>
    <pre class="out" id="out"></pre>
    <div class="btns"><button class="btn primary" type="button" data-copy="#out">Copy</button><button class="btn" type="button" id="dl">Download llms.txt</button></div>
    <p class="hint">Upload to <code>https://yoursite.com/llms.txt</code>.</p>
  </div>
</div>`,
  content: `
<h2>What is llms.txt?</h2>
<p><code>llms.txt</code> is a proposed standard (from <a href="https://llmstxt.org" rel="nofollow">llmstxt.org</a>) for a Markdown file at the root of your site. Where <code>robots.txt</code> says what crawlers may read and <code>sitemap.xml</code> lists every URL, <code>llms.txt</code> is a short, human-written summary of what matters, in a format language models read easily.</p>
<h3>The format</h3>
<ul>
<li>An <code># H1</code> with the site or project name (the only required part).</li>
<li>A <code>&gt; blockquote</code> with a one-line summary.</li>
<li>Optional paragraphs with more detail.</li>
<li><code>## H2</code> sections, each a list of <code>- [Title](url): note</code> links.</li>
<li>A section named <code>## Optional</code> for links an assistant can skip when short on space.</li>
</ul>
<h2>Does llms.txt help with AI search?</h2>
<p>Honestly: it’s early. AI coding tools and doc assistants (Cursor, Claude Code, Mintlify and others) use it today, mainly for developer docs. The big AI search crawlers haven’t said they rank with it. It takes ten minutes, costs nothing and can’t hurt, but your robots.txt, page content and <a href="../schema-generator/">structured data</a> matter more for being cited.</p>`,
  faq: [
    ['Where does llms.txt go?', 'At the root of your domain, like robots.txt: <code>https://example.com/llms.txt</code>. Serve it as plain text or Markdown.'],
    ['What is llms-full.txt?', 'An optional companion file containing the full text of your key pages or docs in one Markdown file, so a model can read everything at once.'],
    ['Which pages should I list?', 'The ones you’d want an assistant to read before answering about you: product overview, pricing, docs and getting started, comparisons, and your best guides.'],
  ],
};
