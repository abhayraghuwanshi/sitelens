import { $, esc, live, values, rememberInHash, trackResult } from './site.js';

const form = $('#f');
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return 'example.com'; } };
const safeImg = (u) => (/^https?:\/\//i.test(u) ? u : '');
// Safe inside url('...') in a style attribute.
const cssUrl = (u) => esc(u.replace(/['"()\\\s]/g, (c) => encodeURIComponent(c)));

function card(v, { big = true, label = true } = {}) {
  const img = safeImg(v.image);
  return `<div class="card-prev">
    ${big ? `<div class="img" style="${img ? `background-image:url('${cssUrl(img)}')` : ''}">${img ? '' : 'No image'}</div>` : ''}
    <div class="body">${label ? `<div class="dom">${esc(host(v.url))}</div>` : ''}<div class="ti">${esc(v.title || 'Your title')}</div><div class="de">${esc(v.desc || 'Your description')}</div></div></div>`;
}

let lastImg = '';
function checkImage(src) {
  if (src === lastImg) return;
  lastImg = src;
  const info = $('#imgInfo');
  if (!src) { info.textContent = '1200 × 630 px, PNG or JPG, under 5 MB.'; return; }
  const im = new Image();
  im.onload = () => {
    if (src !== lastImg) return;
    const ratio = im.naturalWidth / im.naturalHeight;
    const ok = im.naturalWidth >= 1200 && Math.abs(ratio - 1.91) < 0.1;
    info.innerHTML = `${im.naturalWidth} × ${im.naturalHeight} px ${ok ? '✓ good size' : `· <span style="color:var(--bad)">aim for 1200 × 630 (1.91:1)</span>`}`;
  };
  im.onerror = () => { if (src === lastImg) info.innerHTML = '<span style="color:var(--bad)">Couldn’t load that image. Check the URL is public.</span>'; };
  im.src = src;
}

function render(e) {
  if (e) trackResult('tags_built');
  const v = values(form);
  $('#pX').innerHTML = v.card === 'summary'
    ? `<div class="card-prev" style="display:flex">${safeImg(v.image) ? `<div class="img" style="width:120px;aspect-ratio:1;flex:none;background-image:url('${cssUrl(v.image)}')"></div>` : ''}${card(v, { big: false })}</div>`
    : card(v);
  $('#pLi').innerHTML = card(v);
  $('#pSl').innerHTML = `<div class="slack-prev"><div class="sn">${esc(v.site || host(v.url))}</div><div class="ti">${esc(v.title || 'Your title')}</div><div>${esc(v.desc || 'Your description')}</div>${safeImg(v.image) ? `<img src="${esc(v.image)}" alt="">` : ''}</div>`;
  checkImage(safeImg(v.image));
  const a = (s) => esc(String(s).trim());
  const handle = v.handle.trim() ? `@${v.handle.trim().replace(/^@/, '')}` : '';
  const tags = [
    `<title>${a(v.title)}</title>`,
    v.desc && `<meta name="description" content="${a(v.desc)}">`,
    v.url && `<link rel="canonical" href="${a(v.url)}">`,
    '\n<!-- Open Graph -->',
    `<meta property="og:type" content="${a(v.type)}">`,
    v.site && `<meta property="og:site_name" content="${a(v.site)}">`,
    `<meta property="og:title" content="${a(v.title)}">`,
    v.desc && `<meta property="og:description" content="${a(v.desc)}">`,
    v.url && `<meta property="og:url" content="${a(v.url)}">`,
    v.image && `<meta property="og:image" content="${a(v.image)}">`,
    v.image && v.card === 'summary_large_image' && '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">',
    v.image && v.alt && `<meta property="og:image:alt" content="${a(v.alt)}">`,
    '\n<!-- X / Twitter -->',
    `<meta name="twitter:card" content="${a(v.card)}">`,
    handle && `<meta name="twitter:site" content="${a(handle)}">`,
    `<meta name="twitter:title" content="${a(v.title)}">`,
    v.desc && `<meta name="twitter:description" content="${a(v.desc)}">`,
    v.image && `<meta name="twitter:image" content="${a(v.image)}">`,
    v.image && v.alt && `<meta name="twitter:image:alt" content="${a(v.alt)}">`,
  ];
  $('#out').textContent = tags.filter(Boolean).join('\n');
}

rememberInHash(form);
live(form, render);
