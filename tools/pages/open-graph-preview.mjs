export default {
  name: 'Open Graph Preview & Meta Tag Generator',
  title: 'Open Graph Preview & Meta Tag Generator: X, LinkedIn, Slack, Facebook | Kauzl',
  description: 'Preview how your link looks when shared on X, LinkedIn, Facebook, Slack and Discord, and generate the Open Graph and Twitter Card meta tags to paste into your page.',
  blurb: 'See your link card on X, LinkedIn and Slack, and copy the meta tags.',
  related: ['serp-preview', 'utm-builder', 'schema-generator'],
  h1: 'Open Graph preview and meta tag generator',
  intro: 'A good link card gets more clicks when your post is shared. Fill in your page details, check the previews, and copy the tags into your page’s <code>&lt;head&gt;</code>.',
  script: 'og.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <h2>Your page</h2>
    <label class="field"><span>Title</span><input type="text" name="title" placeholder="The 10-minute guide to UTM links"><small>Keep it under about 60 characters.</small></label>
    <label class="field"><span>Description</span><textarea name="desc" rows="3" style="font-family:var(--font);font-size:15px" placeholder="One or two sentences about the page."></textarea></label>
    <label class="field"><span>Page URL</span><input type="url" name="url" placeholder="https://example.com/blog/utm-guide"></label>
    <label class="field"><span>Image URL</span><input type="url" name="image" placeholder="https://example.com/og/utm-guide.png"><small id="imgInfo">1200 × 630 px, PNG or JPG, under 5 MB.</small></label>
    <label class="field"><span>Image alt text</span><input type="text" name="alt" placeholder="Describe the image"></label>
    <div class="row">
      <label class="field"><span>Site name</span><input type="text" name="site" placeholder="Example"></label>
      <label class="field"><span>X handle</span><input type="text" name="handle" placeholder="@example"></label>
    </div>
    <div class="row">
      <label class="field"><span>Type</span><select name="type"><option>website</option><option>article</option><option>product</option></select></label>
      <label class="field"><span>X card</span><select name="card"><option value="summary_large_image">Large image</option><option value="summary">Small image</option></select></label>
    </div>
  </form>
  <div class="panel sticky">
    <div class="preview"><div class="label">X / Twitter</div><div id="pX"></div></div>
    <div class="preview"><div class="label">LinkedIn · Facebook</div><div id="pLi"></div></div>
    <div class="preview"><div class="label">Slack · Discord</div><div id="pSl"></div></div>
  </div>
</div>
<div class="tool single"><div class="panel"><h2>Meta tags</h2><pre class="out" id="out"></pre><button class="btn primary" type="button" data-copy="#out">Copy tags</button></div></div>`,
  content: `
<h2>What is Open Graph?</h2>
<p>Open Graph is a set of <code>&lt;meta property="og:…"&gt;</code> tags that tell LinkedIn, Facebook, Slack, Discord, iMessage, WhatsApp and most chat apps what title, description and image to show when someone shares your link. X reads its own <code>twitter:</code> tags and falls back to Open Graph.</p>
<h2>The tags that matter</h2>
<ul>
<li><code>og:title</code>, <code>og:description</code>, <code>og:image</code>, <code>og:url</code>: the card itself.</li>
<li><code>twitter:card</code> set to <code>summary_large_image</code> for a full-width image on X.</li>
<li><code>og:image:alt</code> for screen readers.</li>
</ul>
<h2>Image size</h2>
<p>Use <strong>1200 × 630 px</strong> (1.91:1). That works on X, LinkedIn, Facebook and Slack. Keep text in the middle 80%: some apps crop the edges or show a square. Use an absolute <code>https://</code> URL, never a relative path.</p>
<h2>My card still shows the old image</h2>
<p>Platforms cache cards. Refresh them with the <a href="https://www.linkedin.com/post-inspector/" rel="nofollow">LinkedIn Post Inspector</a> and the <a href="https://developers.facebook.com/tools/debug/" rel="nofollow">Facebook Sharing Debugger</a>. X refreshes on its own within about a week, faster if you add a query string like <code>?v=2</code>.</p>
<p>Sharing a link in a campaign? Tag it first with the <a href="../utm-builder/">UTM builder</a> so you can see which post the visits came from.</p>`,
  faq: [
    ['Do Open Graph tags help SEO?', 'Not as a ranking factor. They make shared links look better, which brings more clicks from social and chat, and those visitors can link to you.'],
    ['Why isn’t my image showing?', 'Common causes: a relative image URL, an image behind a login or blocked by robots.txt, an image over 5 MB, or a cached old version. Check the URL opens in a private window.'],
    ['Do I need both og: and twitter: tags?', 'X falls back to og:title, og:description and og:image, so you only strictly need <code>twitter:card</code>. Adding the rest does no harm.'],
  ],
};
