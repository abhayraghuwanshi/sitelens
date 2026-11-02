// Product journey: one status per stage of a product's life, in the order
// things break: domain & hosting → deploys → speed → traffic → outcome.
// Each stage is graded from data Studio already syncs (plus keyless domain,
// DNS and TLS checks added here), and the grades roll up into a one-line
// summary. `day()` explains a single chart day: what shipped, who wrote about
// it and which referrers moved.

import { connect } from 'node:tls';
import { resolve4, resolve6, resolveCname } from 'node:dns/promises';
import { runReport } from '../shared/sitelens/ga4.js';
import { hostFilter } from '../shared/sitelens/reports.js';
import { baseDomain } from '../shared/sitelens/site.js';
import { historyRange, SourceError } from './github.mjs';
import { createCache } from './cache.mjs';
import { REGISTRARS, HOSTING } from './products.mjs';

const DAY = 86_400_000;
const TTL = 10 * 60_000;
const DOMAIN_TTL = 6 * 60 * 60_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const STAGES = [
  { key: 'domain', label: 'Domain & hosting' },
  { key: 'deploy', label: 'Deploys' },
  { key: 'speed', label: 'Speed' },
  { key: 'traffic', label: 'Traffic' },
  { key: 'outcome', label: 'Outcome' },
];
const RANK = { bad: 3, warn: 2, good: 1, idle: 0, off: 0 };

// Plain-language names for the vitals Studio grades.
export const METRIC_NAMES = { lcp: 'Page load', inp: 'Responsiveness', cls: 'Layout stability', tbt: 'Main-thread blocking' };

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date, n) => isoDay(Date.parse(`${date}T00:00:00Z`) + n * DAY);
const sum = (list) => list.reduce((a, b) => a + (b || 0), 0);
const daysUntil = (ms, now) => Math.floor((ms - now) / DAY);
const shortDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function pctChange(value, previous) {
  if (!Number.isFinite(value) || !Number.isFinite(previous) || previous <= 0) return null;
  return (value - previous) / previous;
}

export function formatPct(p) {
  if (p === null) return '';
  const r = Math.round(p * 100);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}%`;
}

const formatMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

// GA4 sessionSource values grouped into the names people use.
const FAMILIES = [
  [/(^|\.)reddit\.com$|^reddit$/, 'Reddit'],
  [/news\.ycombinator\.com|^hn$|hackernews/, 'Hacker News'],
  [/producthunt/, 'Product Hunt'],
  [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, 'X'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/(^|\.)facebook\.com$/, 'Facebook'],
  [/(^|\.)youtube\.com$/, 'YouTube'],
  [/(^|\.)github\.com$/, 'GitHub'],
  [/chatgpt|openai/, 'ChatGPT'],
  [/perplexity/, 'Perplexity'],
  [/^google$|(^|\.)google\./, 'Google'],
  [/^bing$|(^|\.)bing\.com$/, 'Bing'],
  [/duckduckgo/, 'DuckDuckGo'],
  [/chromewebstore|chrome\.google\.com/, 'Chrome Web Store'],
  [/^\(direct\)$/, 'Direct'],
];

export function sourceFamily(source) {
  const s = String(source || '').toLowerCase().trim();
  if (!s || s === '(not set)') return 'Unknown';
  for (const [re, label] of FAMILIES) if (re.test(s)) return label;
  return baseDomain(s) || s;
}

// Rows of { source, sessions } → families with their change. Sorted by gain.
export function referrerShifts(current, previous, { scale = 1 } = {}) {
  const group = (rows) => {
    const out = new Map();
    for (const r of rows) {
      const f = sourceFamily(r.source);
      out.set(f, (out.get(f) || 0) + (Number(r.sessions) || 0));
    }
    return out;
  };
  const cur = group(current);
  const prev = group(previous);
  return [...new Set([...cur.keys(), ...prev.keys()])]
    .map((label) => {
      const value = cur.get(label) || 0;
      const before = (prev.get(label) || 0) * scale;
      return { label, value, previous: Math.round(before * 10) / 10, gain: value - before };
    })
    .sort((a, b) => b.gain - a.gain || b.value - a.value);
}

// ---------- Stage 1: domain, DNS, TLS ----------

export function parseRdap(json) {
  const expiry = (json.events || []).find((e) => e.eventAction === 'expiration')?.eventDate;
  const registrar = (json.entities || []).find((e) => (e.roles || []).includes('registrar'));
  const fn = registrar?.vcardArray?.[1]?.find((f) => f[0] === 'fn')?.[3] || '';
  return {
    expires: expiry ? Date.parse(expiry) : null,
    registrar: fn,
    nameservers: (json.nameservers || []).map((n) => String(n.ldhName || '').toLowerCase()).filter(Boolean),
    status: json.status || [],
  };
}

// Where DNS is served from tells you who hosts the zone.
export function dnsHost(nameservers = []) {
  const ns = nameservers.join(' ');
  if (/dns-parking\.com|hostinger/.test(ns)) return 'Hostinger';
  if (/cloudflare\.com/.test(ns)) return 'Cloudflare';
  if (/googledomains\.com|google\.com/.test(ns)) return 'Google Cloud DNS';
  if (/awsdns/.test(ns)) return 'AWS Route 53';
  if (/vercel-dns\.com/.test(ns)) return 'Vercel';
  if (/domaincontrol\.com/.test(ns)) return 'GoDaddy';
  if (/registrar-servers\.com/.test(ns)) return 'Namecheap';
  if (/nsone\.net/.test(ns)) return 'NS1';
  return '';
}

export function tlsCert(host, { timeoutMs = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: timeoutMs }, () => {
      const cert = socket.getPeerCertificate();
      const out = {
        validTo: cert?.valid_to ? Date.parse(cert.valid_to) : null,
        issuer: cert?.issuer?.O || cert?.issuer?.CN || '',
        trusted: socket.authorized,
        error: socket.authorized ? '' : String(socket.authorizationError || ''),
      };
      socket.end();
      resolve(out);
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('TLS handshake timed out'));
    });
    socket.on('error', reject);
  });
}

export async function dnsLookup(host) {
  const [a, aaaa, cname] = await Promise.allSettled([resolve4(host), resolve6(host), resolveCname(host)]);
  const value = (r) => (r.status === 'fulfilled' ? r.value : []);
  return { a: value(a), aaaa: value(aaaa), cname: value(cname) };
}

// Grades what domainInfo() found. Google/Let's Encrypt renew 30 days out, so a
// cert under 21 days means renewal is failing.
export function gradeDomain(info, now = Date.now()) {
  const items = [];
  const push = (status, label, text) => items.push({ status, label, text });
  if (info.rdap?.expires) {
    const d = daysUntil(info.rdap.expires, now);
    push(d < 14 ? 'bad' : d < 45 ? 'warn' : 'good', 'Domain', d < 0 ? 'expired' : `expires in ${d}d${info.rdap.registrar ? ` · ${info.rdap.registrar}` : ''}`);
  } else {
    push('idle', 'Domain', info.rdapError ? `expiry unknown (${info.rdapError})` : 'expiry not published by the registry');
  }
  const resolves = info.dns && (info.dns.a.length || info.dns.aaaa.length || info.dns.cname.length);
  if (info.dnsError || !resolves) push('bad', 'DNS', info.dnsError || 'no A, AAAA or CNAME record');
  else {
    const count = info.dns.a.length + info.dns.aaaa.length;
    const where = count ? `${count} address${count === 1 ? '' : 'es'}` : `CNAME → ${info.dns.cname[0]}`;
    push('good', 'DNS', `${where}${info.dnsHost ? ` · ${info.dnsHost}` : ''}`);
  }
  if (info.tls?.validTo) {
    const d = daysUntil(info.tls.validTo, now);
    if (!info.tls.trusted) push('bad', 'SSL', `not trusted (${info.tls.error || 'unknown issuer'})`);
    else push(d < 7 ? 'bad' : d < 21 ? 'warn' : 'good', 'SSL', d < 0 ? 'expired' : `valid ${d}d more${info.tls.issuer ? ` · ${info.tls.issuer}` : ''}`);
  } else {
    push('bad', 'SSL', info.tlsError || 'no certificate');
  }
  const status = worst(items.map((i) => i.status));
  const problem = items.find((i) => i.status === status && status !== 'good');
  return {
    status,
    headline: problem ? `${problem.label} ${problem.text}` : 'Domain, DNS and SSL are fine',
    items,
  };
}

export function worst(statuses) {
  return statuses.reduce((w, s) => (RANK[s] > RANK[w] ? s : w), 'idle') || 'idle';
}

// ---------- Stage 2-5 graders (pure, for tests) ----------

// Ships in range, and whether 5xx errors jumped since the latest deploy.
export function gradeDeploys({ ships = [], dates = [], requests = null, errors = null }) {
  if (!ships.length) return { status: 'idle', headline: `Nothing shipped in ${dates.length}d`, items: [], ships };
  const last = ships.at(-1);
  const items = [{ status: 'good', label: 'Last ship', text: `${last.label} · ${shortDate(last.date)}` }];
  let status = 'good';
  let headline = `${ships.length} ship${ships.length === 1 ? '' : 's'} · last ${shortDate(last.date)}`;
  const deploy = [...ships].reverse().find((s) => s.kind === 'deploy');
  if (deploy && requests && errors) {
    const split = dates.indexOf(deploy.date);
    if (split > 0) {
      const rate = (a, b) => {
        const req = sum(requests.slice(a, b));
        return req ? sum(errors.slice(a, b)) / req : null;
      };
      const before = rate(0, split);
      const after = rate(split, dates.length);
      const afterErrors = sum(errors.slice(split));
      if (after !== null) {
        items.push({ status: 'good', label: 'Server errors', text: `${(after * 100).toFixed(2)}% since ${shortDate(deploy.date)}${before !== null ? ` (was ${(before * 100).toFixed(2)}%)` : ''}` });
        if (afterErrors >= 5 && after > 0.01 && after > (before || 0) * 2) {
          status = 'warn';
          items.at(-1).status = 'warn';
          headline = `Server errors up since the deploy on ${shortDate(deploy.date)}`;
        }
      }
    }
  }
  return { status, headline, items, ships, lastDeploy: deploy?.date || null };
}

// Mobile lab runs before vs after a deploy date; slower by 20% and 300 ms = a regression.
export function speedRegression(psiHistory = [], deployDate) {
  if (!deployDate) return null;
  const at = Date.parse(`${deployDate}T00:00:00Z`);
  const runs = psiHistory.filter((r) => r.strategy === 'mobile' && Number.isFinite(r.lcp));
  const median = (list) => {
    if (!list.length) return null;
    const s = [...list].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const before = median(runs.filter((r) => r.at < at).slice(-5).map((r) => r.lcp));
  const after = median(runs.filter((r) => r.at >= at).map((r) => r.lcp));
  if (before === null || after === null) return null;
  return after > before * 1.2 && after - before >= 300 ? { before, after } : null;
}

export function gradeSpeed(site, { regression = null, deployDate = null } = {}) {
  if (!site) return { status: 'off', headline: 'No uptime or speed data yet', items: [] };
  const items = [];
  const up = site.uptime;
  if (up?.last) {
    const pct = up.week?.pct;
    const status = !up.last.ok ? 'bad' : pct !== null && pct < 0.98 ? 'bad' : pct !== null && pct < 0.995 ? 'warn' : 'good';
    items.push({ status, label: 'Uptime', text: !up.last.ok ? `down now (${up.last.error || up.last.status})` : `${pct === null ? '—' : (pct * 100).toFixed(pct === 1 ? 0 : 2)}% this week` });
  }
  for (const key of ['lcp', 'inp', 'cls']) {
    const v = site.vitals?.[key];
    if (!v) continue;
    const name = METRIC_NAMES[v.metric || key];
    const value = key === 'cls' ? Number(v.value).toFixed(2) : formatMs(v.value);
    const grade = v.rating === 'good' ? 'Good' : v.rating === 'poor' ? 'Poor' : 'Needs work';
    items.push({ status: v.rating === 'good' ? 'good' : v.rating === 'poor' ? 'bad' : 'warn', label: name, text: `${grade} · ${value}${v.source === 'lab' ? ' (lab)' : ''}` });
  }
  if (regression) {
    items.push({ status: 'warn', label: 'Since deploy', text: `page load ${formatMs(regression.before)} → ${formatMs(regression.after)}` });
  }
  if (!items.length) return { status: 'off', headline: 'No uptime or speed data yet', items };
  const status = worst(items.map((i) => i.status));
  const problem = items.find((i) => i.status === status && status !== 'good');
  let headline = 'Fast and up';
  if (regression && status === 'warn' && problem?.label === 'Since deploy') headline = `Page load got slower after the deploy on ${shortDate(deployDate)}`;
  else if (problem) headline = `${problem.label}: ${problem.text.toLowerCase()}`;
  return { status, headline, items };
}

export function gradeTraffic({ sessions = null, gainers = [], mentions = [], days }) {
  if (!sessions) return { status: 'off', headline: 'No site traffic connected', items: [] };
  const change = pctChange(sessions.value, sessions.previous);
  const status = change !== null && change <= -0.5 ? 'bad' : change !== null && change <= -0.25 ? 'warn' : 'good';
  const items = [{ status, label: 'Sessions', text: `${sessions.value.toLocaleString('en-US')}${change !== null ? ` (${formatPct(change)} vs previous ${days}d)` : ''}` }];
  // Direct and unknown traffic say nothing about *why*, so the cause is the top named referrer.
  const top = gainers.find((g) => g.gain > 0 && g.label !== 'Unknown' && g.label !== 'Direct');
  if (top) items.push({ status: 'good', label: 'Biggest gain', text: `${top.label} +${Math.round(top.gain)} sessions` });
  const best = [...mentions].sort((a, b) => b.points - a.points)[0];
  if (best) items.push({ status: 'good', label: 'Mentions', text: `${mentions.length} · top: “${best.title}”`, url: best.permalink });
  let headline = change === null ? `${sessions.value.toLocaleString('en-US')} sessions` : `Traffic ${formatPct(change)}`;
  const growth = sessions.value - sessions.previous;
  if (top && change !== null && growth > 0) headline += top.gain >= growth / 2 ? `, mostly from ${top.label}` : `, led by ${top.label}`;
  if (best && top?.label === { reddit: 'Reddit', hn: 'Hacker News', ph: 'Product Hunt' }[best.source]) headline += ` (“${best.title.length > 60 ? `${best.title.slice(0, 57)}…` : best.title}”)`;
  return { status, headline, items, change, top: top || null };
}

export function gradeOutcome(kpis = []) {
  const by = Object.fromEntries(kpis.map((k) => [k.key, k]));
  const items = [];
  for (const key of ['installs', 'storeUsers', 'downloads', 'stars']) {
    const k = by[key];
    if (!k || k.value === null || k.value === undefined) continue;
    const change = k.previous !== undefined ? pctChange(k.value, k.previous) : null;
    const status = change !== null && change <= -0.3 ? 'warn' : 'good';
    items.push({ status, label: k.label, text: `${Number(k.value).toLocaleString('en-US')}${change !== null ? ` (${formatPct(change)})` : k.meta ? ` · ${k.meta}` : ''}` });
  }
  if (!items.length) return { status: 'off', headline: 'No installs, downloads or users tracked', items };
  const status = worst(items.map((i) => i.status));
  const lead = items.find((i) => i.status === status) || items[0];
  return { status, headline: `${lead.label} ${lead.text}`, items };
}

// "Cooldesk, last 7 days: traffic +18%, mostly Reddit. Page load got slower…"
export function summarize(label, days, stages) {
  const by = Object.fromEntries(stages.map((s) => [s.key, s]));
  const sentences = [];
  const traffic = by.traffic;
  if (traffic && traffic.status !== 'off') sentences.push(`${label}, last ${days} days: ${traffic.headline.charAt(0).toLowerCase()}${traffic.headline.slice(1)}.`);
  else sentences.push(`${label}, last ${days} days.`);
  const problems = stages.filter((s) => s.key !== 'traffic' && (s.status === 'bad' || s.status === 'warn'))
    .sort((a, b) => RANK[b.status] - RANK[a.status]);
  for (const p of problems) sentences.push(`${p.headline}.`);
  if (traffic?.status === 'bad' || traffic?.status === 'warn') problems.push(traffic);
  const fine = stages.filter((s) => s.status === 'good' && s.key !== 'traffic').map((s) => s.label.toLowerCase());
  if (!problems.length) sentences.push('Nothing needs attention.');
  else if (fine.length) sentences.push(`${fine.join(', ').replace(/, ([^,]*)$/, ' and $1')} ${fine.length === 1 ? 'is' : 'are'} fine.`.replace(/^./, (c) => c.toUpperCase()));
  return { text: sentences.join(' '), status: worst(stages.map((s) => s.status)) };
}

// Bing Webmaster clicks as a traffic-stage line.
export function bingItem(b, days) {
  const change = b.previous === null ? null : pctChange(b.clicks, b.previous);
  return { status: 'good', label: 'Bing search', text: `${b.clicks.toLocaleString('en-US')} clicks · ${b.impressions.toLocaleString('en-US')} impressions${change !== null ? ` (${formatPct(change)} vs previous ${days}d)` : ''}` };
}

// Bing crawl errors this period vs the one before; a doubling (10+) needs a look.
export function crawlItem(b) {
  if (!b || b.crawlErrors === null || b.crawlErrors === undefined) return null;
  const up = b.crawlErrors >= 10 && b.crawlErrors > (b.crawlErrorsBefore || 0) * 2;
  return { status: up ? 'warn' : 'good', label: 'Bing crawl errors', text: `${b.crawlErrors}${b.crawlErrorsBefore ? ` (was ${b.crawlErrorsBefore})` : ''}` };
}

// Several domains grade as one stage; items are prefixed with the domain when there's more than one.
export function gradeDomains(infos, domains, now = Date.now()) {
  const graded = infos.map((info, i) => {
    const g = gradeDomain(info, now);
    const chosen = domains[i]?.registrar;
    const registrar = REGISTRARS[chosen] || null;
    return { ...g, name: info.host, renewUrl: registrar?.dashboard || '', registrar: registrar?.label || info.rdap?.registrar || '' };
  });
  if (graded.length === 1) return { ...graded[0], domains: graded };
  const status = worst(graded.map((g) => g.status));
  const problem = graded.find((g) => g.status === status && status !== 'good');
  return {
    status,
    headline: problem ? `${problem.name}: ${problem.headline.charAt(0).toLowerCase()}${problem.headline.slice(1)}` : `${graded.length} domains, DNS and SSL are fine`,
    items: graded.flatMap((g) => g.items.map((it) => ({ ...it, label: `${g.name} · ${it.label}` }))),
    domains: graded,
  };
}

// Says where the product is hosted and whether Studio can see its deploys.
export function hostingContext(deploy, hosting, feedLinked) {
  if (!hosting?.provider) return deploy;
  const h = HOSTING[hosting.provider];
  const items = [{ status: 'idle', label: 'Hosting', text: `${h.label}${hosting.note ? ` · ${hosting.note}` : ''}` }, ...deploy.items];
  if (h.feed && hosting.provider === 'firebase' && !feedLinked) {
    return { ...deploy, items, status: deploy.status === 'idle' ? 'off' : deploy.status, headline: deploy.ships.length ? deploy.headline : 'Firebase backend not linked yet' };
  }
  if (!h.feed && !deploy.ships.length) {
    return { ...deploy, items, headline: `${h.label}: no deploy feed. Add a note when you ship` };
  }
  return { ...deploy, items };
}

// ---------- the service ----------

export function createJourney({ store, products, vitals, firebase, mentions, annotations, auth, bing = null, fetchImpl = fetch, now = Date.now, checks = {} }) {
  const cache = createCache();
  const lookups = {
    // IANA's bootstrap file names each TLD's RDAP server (rdap.org's redirector 403s Node).
    rdap: checks.rdap || (async (domain) => {
      const bootstrap = await cache.wrap('rdap:bootstrap', DAY, false, async () => {
        const res = await fetchImpl('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(`IANA bootstrap HTTP ${res.status}`);
        return (await res.json()).services || [];
      });
      const tld = domain.split('.').pop();
      const base = bootstrap.find(([tlds]) => tlds.includes(tld))?.[1]?.[0];
      if (!base) throw new Error(`.${tld} has no public RDAP server`);
      const res = await fetchImpl(`${base.replace(/\/?$/, '/')}domain/${encodeURIComponent(domain)}`, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(res.status === 404 ? 'registry has no RDAP record' : `RDAP HTTP ${res.status}`);
      return parseRdap(await res.json());
    }),
    tls: checks.tls || tlsCert,
    dns: checks.dns || dnsLookup,
  };

  async function domainInfo(host, fresh = false) {
    return cache.wrap(`domain:${host}`, DOMAIN_TTL, fresh, async () => {
      const domain = baseDomain(host) || host;
      const [rdap, tls, dns] = await Promise.allSettled([lookups.rdap(domain), lookups.tls(host), lookups.dns(host)]);
      const info = {
        host,
        domain,
        checkedAt: now(),
        rdap: rdap.status === 'fulfilled' ? rdap.value : null,
        rdapError: rdap.status === 'rejected' ? rdap.reason.message : '',
        tls: tls.status === 'fulfilled' ? tls.value : null,
        tlsError: tls.status === 'rejected' ? tls.reason.message : '',
        dns: dns.status === 'fulfilled' ? dns.value : null,
        dnsError: dns.status === 'rejected' ? dns.reason.message : '',
      };
      info.dnsHost = dnsHost(info.rdap?.nameservers);
      return info;
    });
  }

  async function context(id) {
    const product = (await products.list()).find((p) => p.id === id);
    if (!product) throw new SourceError('Unknown product.', { kind: 'notfound' });
    const site = product.siteId ? (await store.sites()).find((s) => s.id === product.siteId) || null : null;
    const scopes = [
      ...(site ? [`site:${site.id}`] : []),
      ...product.repos.map((r) => `repo:${r}`),
      ...product.extensionIds.map((e) => `ext:${e}`),
    ];
    return { product, site, scopes };
  }

  async function sourceRows(site, start, end) {
    const report = await runReport({
      token: await auth.token(),
      propertyId: site.propertyId,
      body: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: hostFilter(site.host, { includeSubdomains: site.includeSubdomains }),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 50,
      },
    });
    return report.rows.map((r) => ({ source: r.sessionSource, sessions: Number(r.sessions) || 0 }));
  }

  const safely = async (fn) => {
    try {
      return { value: await fn() };
    } catch (err) {
      return { error: err.message, kind: err.kind || '' };
    }
  };

  async function build(id, rangeKey) {
    const { product, site, scopes } = await context(id);
    const range = historyRange(rangeKey, now());
    const live = site && !site.demo;
    // The product's own domains; a product set up before domains existed falls back to its site's host.
    const domainNames = product.domains?.length ? product.domains : live && site.host ? [{ name: site.host.toLowerCase() }] : [];
    const [view, notes, vitalSummary, fb, mentionList, domain, refs, bingStats] = await Promise.all([
      safely(() => products.get(id, rangeKey)),
      safely(() => annotations.list({ from: range.start, to: range.end, scopes })),
      safely(() => vitals.summary()),
      // Not linked to Firebase is a normal state, not an error.
      live ? safely(() => firebase.overview(site.id, rangeKey).catch((err) => { if (err.kind === 'needs-firebase') return null; throw err; })) : {},
      safely(() => mentions.between(Date.parse(`${range.start}T00:00:00Z`), Date.parse(`${range.end}T00:00:00Z`) + DAY, scopes)),
      domainNames.length ? safely(() => Promise.all(domainNames.map((d) => domainInfo(d.name)))) : {},
      live && site.propertyId ? safely(async () => {
        const prevEnd = addDays(range.start, -1);
        const [cur, prev] = await Promise.all([sourceRows(site, range.start, range.end), sourceRows(site, addDays(prevEnd, -(range.days - 1)), prevEnd)]);
        return referrerShifts(cur, prev);
      }) : {},
      live && bing ? safely(() => bing.summary(site, rangeKey)) : {},
    ]);

    const stages = [];
    const errors = {};
    const note = (key, r) => {
      if (r.error) errors[key] = r.error;
    };
    [['product', view], ['annotations', notes], ['vitals', vitalSummary], ['firebase', fb], ['mentions', mentionList], ['domain', domain], ['referrers', refs], ['bing', bingStats]].forEach(([k, r]) => note(k, r));

    // 1. Domain
    if (domain.value) stages.push({ key: 'domain', ...gradeDomains(domain.value, domainNames, now()) });
    else stages.push({ key: 'domain', status: 'off', headline: site?.demo ? 'Sample site: no domain to check' : site ? 'Couldn’t check the domain' : 'No site linked', items: [] });

    // 2. Deploys
    const ships = (notes.value || []).filter((a) => a.kind === 'deploy' || a.kind === 'release' || a.kind === 'extension');
    const fbo = fb.value;
    const deploy = gradeDeploys({ ships, dates: range.dates, requests: fbo?.series.requests || null, errors: fbo?.series.errors5xx || null });
    const deployStage = { key: 'deploy', ...hostingContext(deploy, product.hosting, Boolean(fbo)) };
    const crawl = crawlItem(bingStats.value);
    if (crawl) {
      deployStage.items = [...deployStage.items, crawl];
      if (crawl.status === 'warn' && RANK[deployStage.status] < RANK.warn) {
        deployStage.status = 'warn';
        deployStage.headline = `Bing crawl errors up: ${crawl.text}`;
      }
    }
    stages.push(deployStage);

    // 3. Speed
    const vs = vitalSummary.value?.sites.find((s) => s.id === site?.id);
    let regression = null;
    if (live && deploy.lastDeploy) {
      const detail = await safely(() => vitals.detail(site, '30d'));
      regression = speedRegression(detail.value?.psiHistory, deploy.lastDeploy);
    }
    stages.push({ key: 'speed', ...gradeSpeed(vs, { regression, deployDate: deploy.lastDeploy }) });

    // 4. Traffic
    const kpis = view.value?.kpis || [];
    const sessions = kpis.find((k) => k.key === 'sessions');
    const traffic = gradeTraffic({ sessions, gainers: refs.value || [], mentions: mentionList.value || [], days: range.days });
    if (bingStats.value) traffic.items.push(bingItem(bingStats.value, range.days));
    stages.push({ key: 'traffic', ...traffic, referrers: (refs.value || []).slice(0, 8) });

    // 5. Outcome
    stages.push({ key: 'outcome', ...gradeOutcome(kpis) });

    for (const s of stages) s.label = STAGES.find((x) => x.key === s.key).label;
    return {
      product,
      range,
      site: site ? { id: site.id, host: site.host, demo: Boolean(site.demo) } : null,
      summary: summarize(product.label, range.days, stages),
      stages,
      errors,
    };
  }

  // Everything known about one day, compared with the 7 days before it.
  async function day(id, date) {
    if (!DATE.test(date)) throw new SourceError('Pick a day (YYYY-MM-DD).', { kind: 'validation' });
    const { product, site, scopes } = await context(id);
    const from = addDays(date, -1);
    const start = Date.parse(`${date}T00:00:00Z`);
    const [notes, mentionList, refs] = await Promise.all([
      safely(() => annotations.list({ from, to: date, scopes })),
      safely(() => mentions.between(start - DAY, start + DAY, scopes)),
      site && !site.demo && site.propertyId ? safely(async () => {
        const [cur, prev] = await Promise.all([sourceRows(site, date, date), sourceRows(site, addDays(date, -7), addDays(date, -1))]);
        return { shifts: referrerShifts(cur, prev, { scale: 1 / 7 }), sessions: sum(cur.map((r) => r.sessions)), typical: Math.round(sum(prev.map((r) => r.sessions)) / 7) };
      }) : {},
    ]);
    return {
      product: { id: product.id, label: product.label },
      date,
      annotations: notes.value || [],
      mentions: (mentionList.value || []).sort((a, b) => b.points - a.points).slice(0, 10),
      sessions: refs.value ? { value: refs.value.sessions, typical: refs.value.typical } : null,
      referrers: refs.value?.shifts.filter((r) => r.value > 0 || r.previous >= 0.5).slice(0, 8) || [],
      errors: Object.fromEntries([['referrers', refs], ['mentions', mentionList], ['annotations', notes]].filter(([, r]) => r.error).map(([k, r]) => [k, r.error])),
    };
  }

  return {
    domainInfo,
    day,
    clear(id) {
      cache.clear(`journey:${id}:`);
    },
    async get(id, rangeKey, { fresh = false } = {}) {
      const key = `journey:${id}:${rangeKey}:${historyRange(rangeKey, now()).end}`;
      if (fresh) cache.clear(`domain:`);
      const data = await cache.wrap(key, TTL, fresh, () => build(id, rangeKey));
      if (Object.keys(data.errors).length) cache.clear(key);
      return data;
    },
  };
}

export function journeyRoutes({ journey }) {
  return [
    ['GET', /^\/api\/journey\/([\w-]+)$/, async ({ match, query }) => journey.get(match[1], query.get('range') || '28d', { fresh: query.has('fresh') })],
    ['GET', /^\/api\/journey\/([\w-]+)\/day\/(\d{4}-\d{2}-\d{2})$/, async ({ match }) => journey.day(match[1], match[2])],
  ];
}
