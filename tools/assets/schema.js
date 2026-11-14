import { $, $$, esc, track, trackResult } from './site.js';

// Each type: fields [key, label, placeholder, kind?] and a build(values) -> object.
// kind: 'text' (default), 'area', 'list' (one per line), or a repeat spec.
const TYPES = {
  Article: {
    note: 'Blog posts, guides and news articles.',
    fields: [['kind', 'Article kind', '', ['BlogPosting', 'Article', 'NewsArticle', 'TechArticle']], ['headline', 'Headline', 'How to tag campaign links for GA4'], ['description', 'Description', 'A short summary.', 'area'],
      ['url', 'Page URL', 'https://example.com/blog/utm-guide'], ['image', 'Image URL', 'https://example.com/img/utm.png'], ['author', 'Author name', 'Jane Doe'], ['authorUrl', 'Author URL', 'https://example.com/about/jane'],
      ['publisher', 'Publisher name', 'Example'], ['logo', 'Publisher logo URL', 'https://example.com/logo.png'], ['published', 'Date published', '2026-11-14', 'date'], ['modified', 'Date modified', '', 'date']],
    build: (v) => ({
      '@type': v.kind || 'BlogPosting', headline: v.headline, description: v.description, url: v.url, mainEntityOfPage: v.url, image: v.image,
      author: v.author && { '@type': 'Person', name: v.author, url: v.authorUrl },
      publisher: v.publisher && { '@type': 'Organization', name: v.publisher, logo: v.logo && { '@type': 'ImageObject', url: v.logo } },
      datePublished: v.published, dateModified: v.modified || v.published,
    }),
  },
  FAQPage: {
    note: 'Questions and answers that are visible on the page.',
    repeat: { key: 'faq', label: 'Question', fields: [['q', 'Question', 'Is it free?'], ['a', 'Answer', 'Yes, the basic plan is free forever.', 'area']] },
    fields: [],
    build: (v) => ({ '@type': 'FAQPage', mainEntity: v.faq.filter((x) => x.q && x.a).map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) }),
  },
  Product: {
    note: 'Physical or digital products you sell.',
    fields: [['name', 'Product name', 'Trail Runner 2'], ['description', 'Description', '', 'area'], ['image', 'Image URL', 'https://example.com/shoe.jpg'], ['brand', 'Brand', 'Acme'], ['sku', 'SKU', 'TR2-42'],
      ['url', 'Product URL', 'https://example.com/trail-runner-2'], ['price', 'Price', '129.00'], ['currency', 'Currency', 'USD'],
      ['availability', 'Availability', '', ['InStock', 'OutOfStock', 'PreOrder', 'BackOrder']], ['rating', 'Average rating (1–5)', '4.6'], ['reviews', 'Number of reviews', '87']],
    build: (v) => ({
      '@type': 'Product', name: v.name, description: v.description, image: v.image, sku: v.sku, brand: v.brand && { '@type': 'Brand', name: v.brand },
      offers: v.price && { '@type': 'Offer', url: v.url, price: v.price, priceCurrency: v.currency || 'USD', availability: `https://schema.org/${v.availability || 'InStock'}` },
      aggregateRating: v.rating && v.reviews && { '@type': 'AggregateRating', ratingValue: v.rating, reviewCount: v.reviews },
    }),
  },
  SoftwareApplication: {
    note: 'Apps, SaaS products, browser extensions.',
    fields: [['name', 'App name', 'Acme Analytics'], ['description', 'Description', '', 'area'], ['url', 'Website', 'https://example.com'],
      ['category', 'Category', '', ['BusinessApplication', 'DeveloperApplication', 'ProductivityApplication', 'FinanceApplication', 'EducationalApplication', 'GameApplication', 'BrowserApplication', 'UtilitiesApplication']],
      ['os', 'Operating system', 'Web, macOS, Windows'], ['price', 'Price (0 for free)', '0'], ['currency', 'Currency', 'USD'], ['rating', 'Average rating (1–5)', ''], ['reviews', 'Number of ratings', '']],
    build: (v) => ({
      '@type': 'SoftwareApplication', name: v.name, description: v.description, url: v.url, applicationCategory: v.category, operatingSystem: v.os,
      offers: v.price !== '' && { '@type': 'Offer', price: v.price, priceCurrency: v.currency || 'USD' },
      aggregateRating: v.rating && v.reviews && { '@type': 'AggregateRating', ratingValue: v.rating, ratingCount: v.reviews },
    }),
  },
  Organization: {
    note: 'Your company, on the home page.',
    fields: [['name', 'Name', 'Acme Inc.'], ['url', 'Website', 'https://example.com'], ['logo', 'Logo URL', 'https://example.com/logo.png'], ['description', 'Description', '', 'area'],
      ['email', 'Contact email', ''], ['sameAs', 'Profiles (one URL per line)', 'https://x.com/acme\nhttps://www.linkedin.com/company/acme\nhttps://github.com/acme', 'list']],
    build: (v) => ({ '@type': 'Organization', name: v.name, url: v.url, logo: v.logo, description: v.description, email: v.email, sameAs: v.sameAs }),
  },
  BreadcrumbList: {
    note: 'The path from your home page to this page.',
    repeat: { key: 'crumbs', label: 'Level', fields: [['name', 'Name', 'Blog'], ['url', 'URL', 'https://example.com/blog/']] },
    fields: [],
    build: (v) => ({ '@type': 'BreadcrumbList', itemListElement: v.crumbs.filter((c) => c.name).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) }),
  },
};

const sel = $('#type'), box = $('#fields');
sel.innerHTML = Object.keys(TYPES).map((k) => `<option>${k}</option>`).join('');

function input([key, label, ph, kind]) {
  const id = `fld-${key}`;
  if (Array.isArray(kind)) return `<label class="field"><span>${label}</span><select data-key="${key}" id="${id}">${kind.map((o) => `<option>${o}</option>`).join('')}</select></label>`;
  if (kind === 'area' || kind === 'list') return `<label class="field"><span>${label}</span><textarea data-key="${key}" rows="3" style="font-family:var(--font);font-size:15px" placeholder="${esc(ph)}"></textarea></label>`;
  return `<label class="field"><span>${label}</span><input type="${kind === 'date' ? 'date' : 'text'}" data-key="${key}" placeholder="${esc(ph)}"></label>`;
}

function addRepeat(spec) {
  const el = document.createElement('div');
  el.className = 'repeat';
  el.innerHTML = `<button type="button" class="btn small remove" aria-label="Remove">✕</button>${spec.fields.map(input).join('')}`;
  el.querySelector('.remove').onclick = () => { el.remove(); render(); };
  $('#rep').append(el);
}

function setup() {
  const T = TYPES[sel.value];
  $('#typeNote').textContent = T.note;
  box.innerHTML = T.fields.map(input).join('') + (T.repeat ? `<div id="rep"></div><button type="button" class="btn" id="addRep">+ Add ${T.repeat.label.toLowerCase()}</button>` : '');
  if (T.repeat) {
    addRepeat(T.repeat); addRepeat(T.repeat);
    $('#addRep').onclick = () => { addRepeat(T.repeat); render(); };
  }
  render();
}

// Drop empty strings, empty arrays and objects that only have an @type.
function prune(x) {
  if (Array.isArray(x)) { const a = x.map(prune).filter((v) => v !== undefined); return a.length ? a : undefined; }
  if (x && typeof x === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(x)) { const p = prune(v); if (p !== undefined) o[k] = p; }
    return Object.keys(o).some((k) => k !== '@type') ? o : undefined;
  }
  return x === '' || x === false || x == null ? undefined : x;
}

function render() {
  const T = TYPES[sel.value];
  const v = {};
  for (const f of T.fields) {
    const el = $(`[data-key="${f[0]}"]`, box);
    v[f[0]] = f[3] === 'list' ? el.value.split('\n').map((s) => s.trim()).filter(Boolean) : el.value.trim();
  }
  if (T.repeat) {
    v[T.repeat.key] = $$('.repeat', box).map((r) => Object.fromEntries(T.repeat.fields.map(([k]) => [k, $(`[data-key="${k}"]`, r).value.trim()])));
  }
  const data = prune({ '@context': 'https://schema.org', ...T.build(v) }) || { '@context': 'https://schema.org', '@type': sel.value };
  if (!data['@type']) data['@type'] = sel.value;
  $('#out').textContent = `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n</script>`;
}

sel.addEventListener('change', () => { setup(); track('tool_option', { detail: `type:${sel.value}` }); });
box.addEventListener('input', () => { render(); trackResult(`schema:${sel.value}`); });
box.addEventListener('change', render);
setup();
