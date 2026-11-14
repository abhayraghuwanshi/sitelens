export default {
  name: 'UTM Builder',
  title: 'Free UTM Builder: Campaign URL Generator for GA4 | Kauzl',
  description: 'Build UTM-tagged campaign links for Google Analytics 4 in seconds. Presets for Reddit, newsletters, X, LinkedIn and Google Ads, bulk links, GA4 channel checks and a tracking-link cleaner.',
  blurb: 'Tag campaign links for GA4, in bulk, with naming checks so your reports stay clean.',
  related: ['did-it-work', 'ab-test-calculator', 'open-graph-preview'],
  h1: 'UTM Builder',
  intro: 'Tag any link with <code>utm_source</code>, <code>utm_medium</code> and <code>utm_campaign</code> so Google Analytics shows exactly which post, email or ad sent each visitor.',
  script: 'utm-builder.js',
  tool: `
<div class="tool">
  <form class="panel" id="f">
    <h2>Your link</h2>
    <label class="field"><span>Page URL</span><input type="url" name="url" placeholder="https://example.com/pricing" autocomplete="url"></label>
    <div class="check" style="flex-wrap:wrap;gap:6px;margin-bottom:12px"><span class="muted" style="font-size:13px">Presets:</span><span class="btns" id="presets"></span></div>
    <div class="row">
      <label class="field"><span>Source <small class="muted">required</small></span><input type="text" name="source" placeholder="newsletter, reddit, google" list="sources"></label>
      <label class="field"><span>Medium <small class="muted">required</small></span><input type="text" name="medium" placeholder="email, social, cpc" list="mediums"></label>
    </div>
    <label class="field"><span>Campaign</span><input type="text" name="campaign" placeholder="spring-sale"></label>
    <div class="row">
      <label class="field"><span>Content <small class="muted">optional</small></span><input type="text" name="content" placeholder="hero-button"><small>Tells apart two links in the same post.</small></label>
      <label class="field"><span>Term <small class="muted">optional</small></span><input type="text" name="term" placeholder="running shoes"><small>Paid keyword.</small></label>
    </div>
    <label class="field"><span>Campaign ID <small class="muted">optional</small></span><input type="text" name="id" placeholder="abc123"></label>
    <label class="check"><input type="checkbox" name="lowercase" checked> Lowercase everything (GA4 treats “Email” and “email” as two sources)</label>
    <label class="check"><input type="checkbox" name="dashes" checked> Replace spaces with dashes</label>
    <datalist id="sources"><option>google</option><option>newsletter</option><option>reddit</option><option>twitter</option><option>linkedin</option><option>facebook</option><option>producthunt</option><option>hackernews</option><option>youtube</option><option>partner</option></datalist>
    <datalist id="mediums"><option>email</option><option>social</option><option>paid-social</option><option>cpc</option><option>referral</option><option>affiliate</option><option>display</option><option>video</option><option>sms</option><option>push</option></datalist>
  </form>
  <div class="panel sticky">
    <h2>Tagged link</h2>
    <div id="empty"></div><pre class="out" id="out" aria-live="polite"></pre>
    <div class="btns"><button class="btn primary" type="button" data-copy="#out">Copy link</button><button class="btn" type="button" id="reset">Clear</button></div>
    <div id="warn"></div>
    <h3>Bulk: one link per source</h3>
    <p class="hint" style="margin-top:0">Same page and campaign, a link for every place you'll post it. Format: <code>source, medium</code> per line.</p>
    <textarea id="bulkIn" rows="4" placeholder="reddit, social&#10;newsletter, email&#10;linkedin, social"></textarea>
    <pre class="out" id="bulkOut" style="margin-top:10px" hidden></pre>
    <div class="btns" id="bulkBtns" hidden><button class="btn" type="button" data-copy="#bulkOut">Copy all</button><button class="btn" type="button" id="csv">Download CSV</button></div>
  </div>
</div>
<div class="tool single">
  <div class="panel">
    <h2>Check or clean a tracked link</h2>
    <p class="hint" style="margin-top:-6px">Paste any link to read its UTM tags, or get a clean copy without utm_*, fbclid, gclid and other click IDs.</p>
    <label class="field"><span>Link</span><input type="url" id="inspect" placeholder="https://example.com/?utm_source=x&fbclid=..."></label>
    <div id="inspectOut"></div>
  </div>
</div>`,
  content: `
<h2>What is a UTM link?</h2>
<p>A UTM link is a normal URL with a few extra query parameters on the end. When someone clicks it, Google Analytics reads those parameters and files the visit under the source, medium and campaign you chose, instead of lumping it into “direct” or “referral”.</p>
<h3>The five UTM parameters</h3>
<ul>
<li><code>utm_source</code>: where the click came from, such as <code>newsletter</code>, <code>reddit</code> or <code>google</code>.</li>
<li><code>utm_medium</code>: the kind of channel, such as <code>email</code>, <code>social</code> or <code>cpc</code>. GA4 uses this to put the visit in a default channel group.</li>
<li><code>utm_campaign</code>: the push or promotion, such as <code>spring-sale</code> or <code>v2-launch</code>.</li>
<li><code>utm_content</code>: which link or creative, when one post has several.</li>
<li><code>utm_term</code>: the paid keyword, mostly for search ads.</li>
</ul>
<h2>UTM naming rules that keep reports clean</h2>
<p>Most messy GA4 reports come from inconsistent tags, not missing ones. Pick a convention and stick to it:</p>
<ul>
<li><strong>Lowercase only.</strong> GA4 is case-sensitive, so <code>Newsletter</code> and <code>newsletter</code> become two rows.</li>
<li><strong>Dashes, not spaces.</strong> Spaces turn into <code>%20</code> and get mistyped.</li>
<li><strong>Use mediums GA4 recognises.</strong> <code>email</code>, <code>social</code>, <code>cpc</code>, <code>referral</code>, <code>affiliate</code> and <code>display</code> land in the right channel. Made-up mediums like <code>newsletter</code> end up in “Unassigned”. The builder warns you when that happens.</li>
<li><strong>Never tag internal links.</strong> A UTM link on your own site starts a new session and wipes out the real source.</li>
</ul>
<h2>After you share the link</h2>
<p>Tagged links tell you where visitors came from. They don’t tell you whether the campaign moved anything that matters: sign-ups, installs, revenue. Compare the days before and after with the <a href="../did-it-work/">Did it work? checker</a>, or let Kauzl line up every campaign against your goals automatically.</p>`,
  faq: [
    ['Do UTM parameters hurt SEO?', 'No. Google ignores UTM parameters for ranking, but add a canonical tag to your pages so tagged URLs don’t get indexed as duplicates. Only use UTM links in places you control, like emails, social posts and ads, never in internal links.'],
    ['Which UTM parameters are required?', 'GA4 needs <code>utm_source</code> to attribute the visit; <code>utm_medium</code> and <code>utm_campaign</code> are strongly recommended. Without a medium GA4 can’t assign a channel group.'],
    ['Where do I see UTM data in GA4?', 'Open Reports → Acquisition → Traffic acquisition and change the dimension to “Session source / medium” or “Session campaign”.'],
    ['Is my data sent anywhere?', 'No. The links are built in your browser. Nothing you type is sent to a server.'],
    ['Why does my campaign show as “(not set)” or “Unassigned”?', 'Usually the medium isn’t one GA4 recognises, the tags have mixed case, or a redirect dropped the query string. Test the final URL in a private window and check Realtime in GA4.'],
  ],
};
