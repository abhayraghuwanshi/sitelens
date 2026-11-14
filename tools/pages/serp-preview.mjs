export default {
  name: 'SERP Snippet Preview',
  title: 'SERP Preview Tool: Google Title & Meta Description Length Checker | Kauzl',
  description: 'See how your page will look in Google search results on desktop and mobile. Checks title and meta description length in pixels, not just characters, so nothing gets cut off.',
  blurb: 'See your Google result before you publish. Pixel-accurate title and description checks.',
  related: ['open-graph-preview', 'schema-generator', 'utm-builder'],
  h1: 'SERP snippet preview',
  intro: 'Write a title and meta description and see how Google shows them. Google cuts by pixel width, not character count, so this measures the real width.',
  script: 'serp.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <h2>Your page</h2>
    <label class="field"><span>Title tag</span><input type="text" name="title" value="Free UTM Builder: Campaign URL Generator for GA4"><small id="tMeta"></small><div class="meter" id="tBar"><i></i></div></label>
    <label class="field"><span>Meta description</span><textarea name="desc" rows="3" style="font-family:var(--font);font-size:15px">Build UTM-tagged links for Google Analytics 4 in seconds. Presets for Reddit, newsletters and ads, bulk links and naming checks that keep your reports clean.</textarea><small id="dMeta"></small><div class="meter" id="dBar"><i></i></div></label>
    <label class="field"><span>Page URL</span><input type="url" name="url" value="https://example.com/tools/utm-builder/"></label>
    <label class="field"><span>Site name</span><input type="text" name="site" value="Example"></label>
  </form>
  <div class="panel sticky">
    <div class="seg" id="view" role="group" aria-label="Device" style="margin-bottom:14px"><button type="button" data-v="desktop" aria-pressed="true">Desktop</button><button type="button" data-v="mobile" aria-pressed="false">Mobile</button></div>
    <div class="serp" id="serp"><div class="site"><span class="fav" id="fav"></span><div><span id="sn"></span><small id="crumb"></small></div></div><div class="t" id="st"></div><div class="d" id="sd"></div></div>
    <div id="tips"></div>
  </div>
</div>`,
  content: `
<h2>How long should a title tag be?</h2>
<p>Google shows about <strong>580–600 pixels</strong> of a title on desktop, which is roughly 50–60 characters. “W” is about three times as wide as “i”, so character counts are only a guide. Anything past the limit becomes “…”.</p>
<h2>How long should a meta description be?</h2>
<p>Around <strong>920 pixels</strong> on desktop (about 150–160 characters) and a little less on mobile. Google rewrites descriptions it doesn’t like, often using text from your page that matches the search, so write one that reads well on its own and contains the words people search for.</p>
<h2>Writing snippets that get clicks</h2>
<ul>
<li><strong>Front-load the keyword.</strong> People scan the first few words.</li>
<li><strong>Say what they get.</strong> “Free”, “in 2 minutes”, “with examples”, “2026”: whatever is true and matters.</li>
<li><strong>Brand at the end</strong>, after a separator like “|” or “–”, unless your brand is the reason to click.</li>
<li><strong>One page, one title.</strong> Duplicate titles across pages confuse Google about which to rank.</li>
</ul>
<p>After you change a title, give Google a few weeks and compare click-through rate in Search Console, or check the result with the <a href="../did-it-work/">Did it work? checker</a>.</p>`,
  faq: [
    ['Why does Google show a different title than mine?', 'Google rewrites titles that are too long, stuffed with keywords, or don’t match the page. Often it uses your H1 instead. A clear, accurate title under the pixel limit is rewritten less.'],
    ['Does the meta description affect rankings?', 'Not directly. It affects how many people click, and clicks are what you’re after.'],
    ['Is the preview exact?', 'It uses Google’s fonts and sizes and measures in pixels, so it’s close. Google changes its layout often and may add dates, ratings or sitelinks.'],
  ],
};
