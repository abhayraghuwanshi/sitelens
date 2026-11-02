// Product setup: the provider choices behind each journey stage, and saving a
// product together with the hosting links its deploy feed needs. Firebase and
// Vercel links stay keyed by site (that's how their syncs store history), so a
// product's hosting choice is written through to them on save.

import { REGISTRARS, HOSTING } from './products.mjs';
import { ValidationError } from './store.mjs';

// RDAP registrar names → REGISTRARS keys.
export function registrarKey(name = '') {
  const n = String(name).toLowerCase();
  if (/hostinger/.test(n)) return 'hostinger';
  if (/cloudflare/.test(n)) return 'cloudflare';
  if (/godaddy|wild west/.test(n)) return 'godaddy';
  if (/namecheap/.test(n)) return 'namecheap';
  if (/porkbun/.test(n)) return 'porkbun';
  if (/squarespace|google/.test(n)) return 'squarespace';
  return n ? 'other' : '';
}

// Best guess at who serves a host from its DNS answers. A guess, shown as one.
export function guessHosting(dns) {
  if (!dns) return '';
  const cname = (dns.cname || []).join(' ');
  const a = dns.a || [];
  if (/vercel-dns\.com|vercel\.app/.test(cname) || a.includes('76.76.21.21')) return 'vercel';
  if (/netlify/.test(cname) || a.includes('75.2.60.5')) return 'netlify';
  if (/github\.io/.test(cname) || a.some((ip) => /^185\.199\.1(08|09|10|11)\.153$/.test(ip))) return 'github-pages';
  if (/pages\.dev/.test(cname)) return 'cloudflare-pages';
  if (/web\.app|firebaseapp\.com|hosted\.app/.test(cname) || a.some((ip) => /^35\.219\.200\.|^199\.36\.158\.100$/.test(ip))) return 'firebase';
  return '';
}

export function createProductSetup({ products, store, firebase, vercel, journey, mentions, outcomes = null }) {
  async function options() {
    const base = await products.options();
    const [fb, vc, mention] = await Promise.all([
      firebase.status().catch(() => ({ links: [] })),
      vercel.status().catch(() => ({ tokenSource: '' })),
      mentions.overview({ rangeKey: '7d' }).then((o) => o.sources).catch(() => ({})),
    ]);
    let vercelProjects = [];
    let vercelError = '';
    let vercelMatches = {};
    if (vc.tokenSource) {
      try {
        vercelProjects = (await vercel.projects()).map((p) => ({ id: p.id, name: p.name, domains: p.domains || [] }));
        vercelMatches = await vercel.matches(await store.sites());
      } catch (err) {
        vercelError = err.message;
      }
    }
    return {
      ...base,
      registrars: Object.entries(REGISTRARS).map(([key, r]) => ({ key, ...r })),
      hosting: Object.entries(HOSTING).map(([key, h]) => ({ key, ...h })),
      firebase: { links: fb.links.map((l) => ({ siteId: l.siteId, project: l.project, service: l.service, location: l.location })) },
      vercel: {
        connected: Boolean(vc.tokenSource),
        error: vercelError,
        projects: vercelProjects,
        matches: Object.fromEntries(Object.entries(vercelMatches).map(([siteId, m]) => [siteId, m.projectId || ''])),
      },
      community: {
        hn: { ready: true },
        reddit: { ready: Boolean(mention.reddit?.ready) },
        ph: { ready: Boolean(mention.ph?.ready) },
      },
    };
  }

  // What a domain says about itself: registrar, DNS host, likely hosting, SSL.
  async function detect(host, { fresh = false } = {}) {
    const name = String(host || '').trim().toLowerCase();
    if (!/^[a-z0-9.-]{4,253}$/.test(name)) throw new ValidationError('Type a domain like example.com.');
    const info = await journey.domainInfo(name, fresh);
    return {
      name,
      registrar: registrarKey(info.rdap?.registrar),
      registrarName: info.rdap?.registrar || '',
      expires: info.rdap?.expires || null,
      dnsHost: info.dnsHost,
      hosting: guessHosting(info.dns),
      resolves: Boolean(info.dns && (info.dns.a.length || info.dns.aaaa.length || info.dns.cname.length)),
      ssl: info.tls ? { validTo: info.tls.validTo, issuer: info.tls.issuer, trusted: info.tls.trusted } : null,
      errors: { rdap: info.rdapError, dns: info.dnsError, tls: info.tlsError },
    };
  }

  // Saves the product, then points the site's Firebase/Vercel link at the chosen backend.
  async function save(input) {
    const product = await products.save(input);
    const h = product.hosting;
    const linked = [];
    if (h?.provider === 'firebase' && h.firebase && product.siteId) {
      const current = (await firebase.status()).links.find((l) => l.siteId === product.siteId);
      if (!current || current.project !== h.firebase.project || current.service !== h.firebase.service) {
        await firebase.setLink(product.siteId, h.firebase);
        linked.push('firebase');
      }
    }
    if (h?.provider === 'vercel' && h.vercel && product.siteId) {
      await vercel.setMatch(product.siteId, h.vercel.projectId);
      linked.push('vercel');
    }
    journey.clear?.(product.id);
    outcomes?.clear(product.id);
    return { ...product, linked };
  }

  return { options, detect, save };
}

export function productSetupRoutes({ setup }) {
  return [
    ['GET', /^\/api\/products\/setup$/, async () => setup.options()],
    ['GET', /^\/api\/products\/detect$/, async ({ query }) => setup.detect(query.get('host'), { fresh: query.has('fresh') })],
    ['POST', /^\/api\/products\/setup$/, async ({ body }) => setup.save(body)],
  ];
}
