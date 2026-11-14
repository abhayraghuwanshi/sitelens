export default {
  name: 'Schema Markup Generator',
  title: 'Schema Markup Generator: Free JSON-LD for FAQ, Article, Product & More | Kauzl',
  description: 'Generate JSON-LD structured data for Article, FAQ, Product, SoftwareApplication, Organization and Breadcrumb. Copy it into your page to qualify for rich results and help AI search understand your content.',
  blurb: 'JSON-LD for Article, FAQ, Product, Software and more, ready to paste.',
  related: ['serp-preview', 'llms-txt-generator', 'open-graph-preview'],
  h1: 'Schema markup generator (JSON-LD)',
  intro: 'Structured data tells Google and AI assistants exactly what a page is: an article, a product with a price, a list of questions. Pick a type, fill in the fields and paste the result into your page.',
  script: 'schema.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <label class="field"><span>Schema type</span><select id="type"></select><small id="typeNote"></small></label>
    <div id="fields"></div>
  </form>
  <div class="panel sticky">
    <h2>JSON-LD</h2>
    <pre class="out" id="out"></pre>
    <div class="btns"><button class="btn primary" type="button" data-copy="#out">Copy</button>
    <a class="btn" href="https://search.google.com/test/rich-results" target="_blank" rel="noopener nofollow">Test in Google ↗</a></div>
    <p class="hint">Paste into the page’s <code>&lt;head&gt;</code> or anywhere in <code>&lt;body&gt;</code>.</p>
  </div>
</div>`,
  content: `
<h2>What schema markup does</h2>
<p>Schema.org markup is a small block of JSON that describes your page in a format machines can’t misread. Google uses it for rich results such as review stars, prices, breadcrumbs and article dates. AI assistants and AI search engines use it to pull accurate facts, like your price or who wrote an article.</p>
<h2>Which type to use</h2>
<ul>
<li><strong>Article / BlogPosting</strong> for blog posts, guides and news. Adds author and date.</li>
<li><strong>FAQPage</strong> for a list of questions and answers that are visible on the page.</li>
<li><strong>Product</strong> for things you sell, with price, availability and reviews.</li>
<li><strong>SoftwareApplication</strong> for apps and SaaS products: category, OS, price and rating.</li>
<li><strong>Organization</strong> on your home page: name, logo and social profiles, which feed Google’s knowledge panel.</li>
<li><strong>BreadcrumbList</strong> to show the page’s position in your site instead of a raw URL.</li>
</ul>
<h2>Rules Google enforces</h2>
<ul>
<li>Only mark up content that’s <strong>visible on the page</strong>. Hidden FAQ or fake reviews can get a manual penalty.</li>
<li>Ratings must come from real customers, not your own scores.</li>
<li>Rich results aren’t guaranteed: valid markup makes a page eligible; Google decides when to show it.</li>
</ul>`,
  faq: [
    ['JSON-LD, Microdata or RDFa?', 'JSON-LD. Google recommends it, and it’s one block you can add without touching the page’s HTML.'],
    ['Does schema improve rankings?', 'Not directly, but rich results take more space and usually get more clicks, and structured facts help AI answers describe you correctly.'],
    ['Can I have more than one type on a page?', 'Yes. Add one script block per type, for example Article plus BreadcrumbList.'],
    ['Do FAQ rich results still show?', 'Google shows FAQ rich results mainly for well-known government and health sites now. The markup is still valid and still helps machines read your Q&A.'],
  ],
};
