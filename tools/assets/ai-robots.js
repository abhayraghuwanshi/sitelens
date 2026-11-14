import { $, $$, esc, live, values, download, rememberInHash, track, trackResult } from './site.js';
import { AI_BOTS, KIND_LABEL, buildRobots } from './lib/bots.js';

const form = $('#f');
$('#bots tbody').innerHTML = AI_BOTS.map((b) => `
  <tr><td><strong>${esc(b.token)}</strong><br><span class="muted">${esc(b.owner)}</span></td>
  <td><span class="pill ${b.kind}">${KIND_LABEL[b.kind]}</span><br><span class="hint" style="margin:2px 0 0">${esc(b.note)}</span></td>
  <td><input type="checkbox" name="bot:${esc(b.token)}" aria-label="Allow ${esc(b.token)}"></td></tr>`).join('');

function preset(p) {
  for (const b of AI_BOTS) form.elements[`bot:${b.token}`].checked = p === 'all' || (p === 'search' && b.kind !== 'training');
  for (const btn of $$('#presets button')) btn.setAttribute('aria-pressed', String(btn.dataset.p === p));
  render();
}
$('#presets').onclick = (e) => { const b = e.target.closest('button'); if (b) { preset(b.dataset.p); track('tool_option', { detail: `preset:${b.dataset.p}` }); trackResult('robots_built'); } };

function render(e) {
  if (e) trackResult('robots_built');
  const v = values(form);
  const policy = Object.fromEntries(AI_BOTS.map((b) => [b.token, v[`bot:${b.token}`] ? 'allow' : 'block']));
  $('#out').textContent = buildRobots({ policy, disallow: v.disallow.split('\n'), sitemaps: [v.sitemap] });
}

const hadHash = location.hash.length > 1;
rememberInHash(form);
if (!hadHash) preset('search');
form.addEventListener('change', () => $$('#presets button').forEach((b) => b.setAttribute('aria-pressed', 'false')));
live(form, render);
$('#dl').onclick = () => download('robots.txt', $('#out').textContent);
