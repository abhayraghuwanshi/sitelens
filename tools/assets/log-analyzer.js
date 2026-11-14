import { $, esc, num, track, trackResult } from './site.js';
import { analyzeLogs, KIND_LABEL } from './lib/bots.js';
import { owlSays } from './lib/owl.js';

const EMPTY = owlSays('Drop a log file above. I’ll pick out the AI crawlers and show what they read. Your logs stay on your computer.');

function render(text) {
  const out = $('#out');
  if (!text.trim()) { out.innerHTML = EMPTY; return; }
  const r = analyzeLogs(text);
  // How many crawlers were found, bucketed; never anything from the log itself.
  trackResult(r.bots.length ? `${Math.min(r.bots.length, 10)} crawlers` : 'no_crawlers');
  if (!r.bots.length) {
    out.innerHTML = `<p>Read ${num(r.lines)} lines and found no known AI or search crawlers.</p><p class="hint">If that seems wrong, check the log includes the user-agent field.</p>`;
    return;
  }
  const ai = r.bots.filter((b) => b.bot.kind !== 'classic');
  const aiHits = ai.reduce((s, b) => s + b.hits, 0);
  out.innerHTML = `
    <div class="stats">
      <div class="stat"><b>${num(r.lines)}</b><span>log lines read</span></div>
      <div class="stat"><b>${num(aiHits)}</b><span>AI crawler requests</span></div>
      <div class="stat"><b>${num(ai.length)}</b><span>different AI crawlers</span></div>
      <div class="stat"><b>${num(r.matched - aiHits)}</b><span>search engine requests</span></div>
    </div>
    <div class="scroll-x"><table class="table">
      <thead><tr><th>Crawler</th><th>Type</th><th class="num">Requests</th><th class="num">Errors</th><th>Top pages</th></tr></thead>
      <tbody>${r.bots.map((b) => `<tr>
        <td><strong>${esc(b.bot.token)}</strong><br><span class="muted">${esc(b.bot.owner)}</span></td>
        <td><span class="pill ${b.bot.kind}">${KIND_LABEL[b.bot.kind]}</span></td>
        <td class="num">${num(b.hits)}</td>
        <td class="num">${b.errors ? `<span style="color:var(--bad)">${num(b.errors)}</span>` : '0'}</td>
        <td>${b.paths.slice(0, 5).map(([p, n]) => `<code>${esc(p)}</code> <span class="muted">${n}</span>`).join('<br>')}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

$('#file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  $('#out').innerHTML = '<p class="muted">Reading…</p>';
  track('tool_option', { detail: 'log_file' });
  render(await f.text());
});
let t;
$('#paste').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => render(e.target.value), 200); });
$('#example').onclick = () => {
  const ua = {
    gpt: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    oai: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
    cu: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
    pplx: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    g: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    human: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15',
  };
  const rows = [['gpt', '/blog/utm-guide', 200], ['gpt', '/pricing', 200], ['gpt', '/old-page', 404], ['oai', '/blog/utm-guide', 200], ['oai', '/docs/setup', 200],
    ['cu', '/pricing', 200], ['pplx', '/blog/utm-guide', 200], ['g', '/', 200], ['g', '/blog/utm-guide', 200], ['human', '/', 200], ['cu', '/docs/setup', 200]];
  $('#paste').value = rows.map(([k, p, s], i) => `203.0.113.${i} - - [14/Nov/2026:10:${String(i).padStart(2, '0')}:00 +0000] "GET ${p} HTTP/1.1" ${s} 2048 "-" "${ua[k]}"`).join('\n');
  render($('#paste').value);
};
render('');
