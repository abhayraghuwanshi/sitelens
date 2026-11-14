import { $, $$, esc, download, trackResult } from './site.js';

const form = $('#f');
const box = $('#sections');

function addSection(title = '', links = '') {
  const el = document.createElement('div');
  el.className = 'repeat';
  el.innerHTML = `<button type="button" class="btn small remove" aria-label="Remove section">✕</button>
    <label class="field"><span>Section title</span><input type="text" data-k="title" value="${esc(title)}" placeholder="Docs"></label>
    <label class="field"><span>Links</span><textarea data-k="links" rows="4" placeholder="https://example.com/docs/start | Getting started | Install and first report">${esc(links)}</textarea></label>`;
  el.querySelector('.remove').onclick = () => { el.remove(); render(); };
  box.append(el);
}

function linkLine(raw) {
  const [url, title, note] = raw.split('|').map((s) => s.trim());
  if (!url) return '';
  const name = title || url.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '').split('/').pop().replace(/[-_]/g, ' ') || url;
  return `- [${name}](${url})${note ? `: ${note}` : ''}`;
}

function render() {
  const name = form.elements.name.value.trim() || 'Your site';
  const parts = [`# ${name}`];
  if (form.elements.summary.value.trim()) parts.push(`> ${form.elements.summary.value.trim()}`);
  if (form.elements.details.value.trim()) parts.push(form.elements.details.value.trim());
  for (const s of $$('.repeat', box)) {
    const title = $('[data-k=title]', s).value.trim();
    const links = $('[data-k=links]', s).value.split('\n').map(linkLine).filter(Boolean);
    if (title || links.length) parts.push(`## ${title || 'Links'}\n\n${links.join('\n')}`.trim());
  }
  $('#out').textContent = `${parts.join('\n\n')}\n`;
}

addSection('Docs', '');
addSection('Product', '');
addSection('Optional', '');
$('#add').onclick = () => { addSection(); render(); };
form.addEventListener('input', () => { render(); trackResult('llms_built'); });
render();
$('#dl').onclick = () => download('llms.txt', $('#out').textContent, 'text/markdown');
