import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProduct } from '../server/products.mjs';
import { registrarKey, guessHosting, createProductSetup } from '../server/product-setup.mjs';
import { gradeDomains, hostingContext, gradeDeploys } from '../server/journey.mjs';
import { deriveTerms } from '../server/mentions.mjs';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const DAY = 86_400_000;

test('normalizeProduct: domains, hosting and keywords per stage', () => {
  const p = normalizeProduct({
    label: 'Infraplan',
    domains: ['https://InfraPlan.cloud/path', { name: 'infraplan.cloud' }, { name: 'docs.infraplan.cloud', registrar: 'hostinger' }],
    hosting: { provider: 'hostinger', note: 'Business plan' },
    keywords: ['Infra Plan', 'infra plan'],
  });
  assert.deepEqual(p.domains, [{ name: 'infraplan.cloud' }, { name: 'docs.infraplan.cloud', registrar: 'hostinger' }]);
  assert.deepEqual(p.hosting, { provider: 'hostinger', note: 'Business plan' });
  assert.deepEqual(p.keywords, ['infra plan']);
  // A domain alone is enough to make a product.
  assert.equal(normalizeProduct({ label: 'X', domains: ['x-site.com'] }).id, 'x');
  assert.throws(() => normalizeProduct({ label: 'X', domains: ['not a domain'] }), /isn’t a domain/);
  assert.throws(() => normalizeProduct({ label: 'X', domains: ['a.com'], hosting: { provider: 'heroku2' } }), /Unknown hosting/);
  assert.throws(() => normalizeProduct({ label: 'X', domains: ['a.com'], hosting: { provider: 'firebase', firebase: { project: 'my-proj-1', service: 'web' } } }), /analytics site/);
  assert.throws(() => normalizeProduct({ label: 'X', domains: ['a.com'], keywords: ['abc'] }), /4–60/);
  // Old products (no new fields) keep their exact shape.
  assert.deepEqual(normalizeProduct({ label: 'Y', siteId: 's1' }), { id: 'y', label: 'Y', siteId: 's1', repos: [], extensionIds: [] });
});

test('registrarKey and guessHosting read RDAP names and DNS answers', () => {
  assert.equal(registrarKey('HOSTINGER operations, UAB'), 'hostinger');
  assert.equal(registrarKey('GoDaddy.com, LLC'), 'godaddy');
  assert.equal(registrarKey('Some Registrar Ltd'), 'other');
  assert.equal(registrarKey(''), '');
  assert.equal(guessHosting({ a: ['76.76.21.21'], cname: [] }), 'vercel');
  assert.equal(guessHosting({ a: [], cname: ['cool.netlify.app'] }), 'netlify');
  assert.equal(guessHosting({ a: ['185.199.110.153'], cname: [] }), 'github-pages');
  assert.equal(guessHosting({ a: ['35.219.200.52'], cname: [] }), 'firebase');
  assert.equal(guessHosting({ a: ['1.2.3.4'], cname: [] }), '');
});

test('gradeDomains: worst domain wins and items name the domain', () => {
  const ok = { host: 'a.com', rdap: { expires: NOW + 300 * DAY }, tls: { validTo: NOW + 60 * DAY, trusted: true }, dns: { a: ['1.1.1.1'], aaaa: [], cname: [] } };
  const soon = { ...ok, host: 'b.cloud', rdap: { expires: NOW + 20 * DAY } };
  const g = gradeDomains([ok, soon], [{ name: 'a.com' }, { name: 'b.cloud', registrar: 'hostinger' }], NOW);
  assert.equal(g.status, 'warn');
  assert.equal(g.headline, 'b.cloud: domain expires in 20d');
  assert.ok(g.items.some((i) => i.label === 'b.cloud · Domain'));
  assert.equal(g.domains[1].renewUrl, 'https://hpanel.hostinger.com/domains');
  assert.equal(gradeDomains([ok], [{ name: 'a.com' }], NOW).headline, 'Domain, DNS and SSL are fine');
});

test('hostingContext explains hosts without a deploy feed', () => {
  const quiet = gradeDeploys({ ships: [], dates: ['2026-10-30'] });
  const h = hostingContext(quiet, { provider: 'hostinger', note: 'Business plan' }, false);
  assert.equal(h.headline, 'Hostinger: no deploy feed. Add a note when you ship');
  assert.equal(h.items[0].text, 'Hostinger · Business plan');
  assert.equal(hostingContext(quiet, { provider: 'firebase' }, false).headline, 'Firebase backend not linked yet');
  assert.equal(hostingContext(quiet, null, false), quiet);
});

test('deriveTerms searches product keywords under the product scopes', () => {
  const terms = deriveTerms({ products: [{ label: 'Cooldesk', siteId: 's1', repos: [], extensionIds: [], keywords: ['cool desk'] }] });
  assert.deepEqual(terms.find((t) => t.term === 'cool desk').scopes, ['site:s1']);
});

test('setup.save writes the hosting choice through to Firebase and Vercel links', async () => {
  const calls = [];
  let saved;
  const setup = createProductSetup({
    products: { save: async (input) => (saved = normalizeProduct(input)) },
    store: {},
    firebase: { status: async () => ({ links: [{ siteId: 's1', project: 'old-proj-1', service: 'web' }] }), setLink: async (...a) => calls.push(['firebase', ...a]) },
    vercel: { setMatch: async (...a) => calls.push(['vercel', ...a]) },
    journey: { clear: () => {} },
    mentions: {},
  });
  const out = await setup.save({ label: 'App', siteId: 's1', hosting: { provider: 'firebase', firebase: { project: 'new-proj-1', service: 'web' } } });
  assert.deepEqual(out.linked, ['firebase']);
  assert.deepEqual(calls[0], ['firebase', 's1', { project: 'new-proj-1', service: 'web', location: '' }]);
  // Same backend again: no relink (relinking wipes the site's log history).
  calls.length = 0;
  const again = createProductSetup({
    products: { save: async (input) => normalizeProduct(input) },
    store: {},
    firebase: { status: async () => ({ links: [{ siteId: 's1', project: 'new-proj-1', service: 'web' }] }), setLink: async (...a) => calls.push(a) },
    vercel: {}, journey: {}, mentions: {},
  });
  assert.deepEqual((await again.save({ label: 'App', siteId: 's1', hosting: { provider: 'firebase', firebase: { project: 'new-proj-1', service: 'web' } } })).linked, []);
  assert.equal(calls.length, 0);
  await setup.save({ label: 'App', siteId: 's1', hosting: { provider: 'vercel', vercel: { projectId: 'prj_abc123' } } });
  assert.deepEqual(calls.at(-1), ['vercel', 's1', 'prj_abc123']);
  assert.ok(saved);
});
