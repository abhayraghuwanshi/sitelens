// Firebase App Hosting: server-side traffic for sites served from a Cloud Run
// backend (App Hosting runs every backend as a Cloud Run service named after it).
//
// Source: Cloud Logging's request log (logName run.googleapis.com/requests),
// read with the Google sign-in's logging.read scope. No App Hosting API: it only
// accepts the full cloud-platform scope, which can change the project.
//
// Every request lands in .data/firebase.db, synced every 30 minutes. Cloud
// Logging keeps 30 days, so the local copy is what gives longer history.
//  - IPs are never stored: a visitor is sha256(local salt + day + IP + UA), so
//    unique counts work per day and nothing links a person across days.
//  - User agents are classified into humans and bot families (AI crawlers, AI
//    assistants fetching for a user, search, SEO, social previews, monitors).
//  - A deploy is the first request served by a new Cloud Run revision.
//  - Cold starts come from Cloud Run's system log ("Starting new instance").
//
// The CDN in front of App Hosting answers cached files itself, so static assets
// are undercounted. HTML (no-cache) and /api/* reach Cloud Run, so page loads,
// bot visits, errors and endpoint hits are complete.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { EngineError } from './engines.mjs';
import { historyRange } from './github.mjs';

const LOGGING = 'https://logging.googleapis.com/v2/entries:list';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const BACKFILL = 30 * DAY;
const KEEP = 400 * DAY;
const MAX_PAGES = 60;
const PROJECT = /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/;
const SERVICE = /^[a-z][a-z0-9-]{0,62}$/;

export const BOT_KINDS = {
  'ai-crawler': 'AI crawler',
  'ai-assistant': 'AI assistant',
  search: 'Search engine',
  seo: 'SEO tool',
  social: 'Link preview',
  monitor: 'Monitor',
  automation: 'Other automated',
};

// [name, kind, pattern]. First match wins, so specific names come before
// families (ChatGPT-User before GPTBot, Google-Extended agents before Googlebot).
const BOTS = [
  ['ChatGPT-User', 'ai-assistant', /ChatGPT-User/i],
  ['OAI-SearchBot', 'ai-assistant', /OAI-SearchBot/i],
  ['GPTBot', 'ai-crawler', /GPTBot/i],
  ['Claude-User', 'ai-assistant', /Claude-User/i],
  ['Claude-SearchBot', 'ai-assistant', /Claude-SearchBot/i],
  ['ClaudeBot', 'ai-crawler', /ClaudeBot|anthropic-ai|Claude-Web/i],
  ['Perplexity-User', 'ai-assistant', /Perplexity-User/i],
  ['PerplexityBot', 'ai-crawler', /PerplexityBot/i],
  ['MistralAI-User', 'ai-assistant', /MistralAI-User/i],
  ['DuckAssistBot', 'ai-assistant', /DuckAssistBot/i],
  ['Google-NotebookLM', 'ai-assistant', /Google-NotebookLM/i],
  ['Meta AI', 'ai-crawler', /meta-externalagent|meta-externalfetcher|FacebookBot/i],
  ['Amazonbot', 'ai-crawler', /Amazonbot/i],
  ['Applebot', 'search', /Applebot/i],
  ['Bytespider', 'ai-crawler', /Bytespider/i],
  ['CCBot', 'ai-crawler', /CCBot/i],
  ['cohere-ai', 'ai-crawler', /cohere-ai|cohere-training/i],
  ['Diffbot', 'ai-crawler', /Diffbot/i],
  ['YouBot', 'ai-crawler', /YouBot/i],
  ['Timpibot', 'ai-crawler', /Timpibot/i],
  ['ImagesiftBot', 'ai-crawler', /ImagesiftBot/i],
  ['Google-InspectionTool', 'search', /Google-InspectionTool/i],
  ['Google AdsBot', 'search', /AdsBot-Google|Mediapartners-Google|Storebot-Google/i],
  ['GoogleOther', 'search', /GoogleOther/i],
  ['Googlebot', 'search', /Googlebot/i],
  ['Bingbot', 'search', /bingbot|BingPreview|msnbot/i],
  ['YandexBot', 'search', /Yandex/i],
  ['Baiduspider', 'search', /Baiduspider/i],
  ['DuckDuckBot', 'search', /DuckDuckBot|DuckDuckGo-Favicons/i],
  ['PetalBot', 'search', /PetalBot/i],
  ['SeznamBot', 'search', /SeznamBot/i],
  ['Qwantbot', 'search', /Qwant/i],
  ['Yahoo Slurp', 'search', /Slurp/i],
  ['Sogou', 'search', /Sogou/i],
  ['AhrefsBot', 'seo', /AhrefsBot|AhrefsSiteAudit/i],
  ['SemrushBot', 'seo', /SemrushBot|SiteAuditBot/i],
  ['MJ12bot', 'seo', /MJ12bot/i],
  ['DotBot', 'seo', /DotBot/i],
  ['DataForSeoBot', 'seo', /DataForSeoBot/i],
  ['BLEXBot', 'seo', /BLEXBot/i],
  ['Barkrowler', 'seo', /Barkrowler/i],
  ['serpstatbot', 'seo', /serpstatbot/i],
  ['Screaming Frog', 'seo', /Screaming Frog/i],
  ['rogerbot', 'seo', /rogerbot/i],
  ['facebookexternalhit', 'social', /facebookexternalhit|facebookcatalog/i],
  ['Twitterbot', 'social', /Twitterbot/i],
  ['LinkedInBot', 'social', /LinkedInBot/i],
  ['Slackbot', 'social', /Slackbot|Slack-ImgProxy/i],
  ['Discordbot', 'social', /Discordbot/i],
  ['TelegramBot', 'social', /TelegramBot/i],
  ['WhatsApp', 'social', /WhatsApp/i],
  ['Pinterest', 'social', /Pinterest/i],
  ['redditbot', 'social', /redditbot/i],
  ['Embedly', 'social', /Embedly/i],
  ['SiteLens uptime', 'monitor', /SiteLens-Studio-uptime/i],
  ['Lighthouse', 'monitor', /Chrome-Lighthouse|Google-PageSpeed|PTST\//i],
  ['UptimeRobot', 'monitor', /UptimeRobot/i],
  ['Pingdom', 'monitor', /Pingdom/i],
  ['StatusCake', 'monitor', /StatusCake/i],
  ['Google health check', 'monitor', /GoogleHC|kube-probe|GoogleStackdriverMonitoring/i],
];
const AUTOMATION = /bot\b|bot\/|crawl|spider|scrape|fetch|python-requests|python-urllib|aiohttp|httpx|curl\/|wget|Go-http-client|okhttp|axios|node-fetch|undici|HeadlessChrome|PhantomJS|scrapy|libwww|Java\/|Apache-HttpClient|zgrab|masscan|Nuclei|CensysInspect|Expanse|^$/i;

/* ---------- Pure helpers (unit-tested) ---------- */

export function classifyAgent(ua) {
  const agent = String(ua || '');
  for (const [name, kind, re] of BOTS) if (re.test(agent)) return { bot: name, kind };
  // Every real browser's agent starts with Mozilla/; anything else is a program
  // (an app's updater, a script), even when no bot pattern names it.
  if (AUTOMATION.test(agent) || !/^Mozilla\//.test(agent.trim())) return { bot: botName(agent), kind: 'automation' };
  return { bot: '', kind: 'human' };
}

// A readable name for an unlisted client: the first product token ("Go-http-client").
function botName(agent) {
  if (!agent.trim()) return '(no user agent)';
  const named = /([A-Za-z][\w.-]*(?:bot|crawler|spider|fetcher))/i.exec(agent)?.[1];
  return (named || agent.split(/[\s/;(]/)[0] || 'unknown').slice(0, 40);
}

const ASSET = /\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|wasm|json|webmanifest)$/i;
const FILE = /^\/(robots\.txt|sitemap[\w-]*\.xml|llms(-full)?\.txt|ads\.txt|security\.txt|\.well-known\/.*|rss\.xml|feed(\.xml)?|atom\.xml|humans\.txt)$/i;

// page: an HTML route · file: robots/sitemap/llms.txt and friends · api: /api/* · asset: everything static.
export function requestKind(path) {
  const p = String(path || '/');
  if (p.startsWith('/api/') || p === '/api') return 'api';
  if (FILE.test(p)) return 'file';
  if (ASSET.test(p) || p.startsWith('/assets/') || p.startsWith('/_next/')) return 'asset';
  return 'page';
}

export function parseLatency(value) {
  const m = /^([\d.]+)s$/.exec(String(value || ''));
  return m ? Math.round(Number(m[1]) * 10000) / 10 : null;
}

const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:?#].*$/, '').replace(/^www\./, '');
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// Cloud Run request log entry → stored row. Returns null for entries without a request.
export function parseRequestEntry(entry, { salt = '', siteHost = '' } = {}) {
  const r = entry?.httpRequest;
  if (!r) return null;
  const ts = Date.parse(entry.timestamp || entry.receiveTimestamp || '');
  if (!Number.isFinite(ts)) return null;
  let url;
  try {
    url = new URL(r.requestUrl || '/', 'http://unknown');
  } catch {
    url = new URL('http://unknown/');
  }
  const path = decodeSafe(url.pathname).slice(0, 300) || '/';
  const ua = String(r.userAgent || '');
  const { bot, kind } = classifyAgent(ua);
  const day = isoDay(ts);
  const refHost = bareHost(r.referer);
  return {
    insert_id: String(entry.insertId || `${ts}-${path}`),
    ts,
    day,
    host: bareHost(url.host === 'unknown' ? '' : url.host),
    revision: String(entry.resource?.labels?.revision_name || ''),
    method: String(r.requestMethod || 'GET').toUpperCase(),
    path,
    status: Number(r.status) || 0,
    latency_ms: parseLatency(r.latency),
    bytes: Number(r.responseSize) || 0,
    kind: requestKind(path),
    bot,
    bot_kind: kind,
    // Own-site referrers are navigation, not a source.
    referer_host: refHost && refHost !== bareHost(siteHost) ? refHost : '',
    visitor: r.remoteIp ? createHash('sha256').update(`${salt}|${day}|${r.remoteIp}|${ua}`).digest('hex').slice(0, 16) : '',
  };
}

function decodeSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

// Cloud Logging filter for one service's request log since `sinceIso`.
export function requestFilter({ project, service, sinceIso }) {
  return [
    `logName="projects/${project}/logs/run.googleapis.com%2Frequests"`,
    'resource.type="cloud_run_revision"',
    service ? `resource.labels.service_name="${service}"` : '',
    `timestamp>="${sinceIso}"`,
  ].filter(Boolean).join(' AND ');
}

export function coldStartFilter({ project, service, sinceIso }) {
  return [
    `logName="projects/${project}/logs/run.googleapis.com%2Fvarlog%2Fsystem"`,
    'resource.type="cloud_run_revision"',
    `resource.labels.service_name="${service}"`,
    'textPayload:"Starting new instance"',
    `timestamp>="${sinceIso}"`,
  ].join(' AND ');
}

/* ---------- Store ---------- */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS requests (
  site_id TEXT NOT NULL, insert_id TEXT NOT NULL, ts INTEGER NOT NULL, day TEXT NOT NULL,
  host TEXT, revision TEXT, method TEXT, path TEXT, status INTEGER, latency_ms REAL, bytes INTEGER,
  kind TEXT, bot TEXT, bot_kind TEXT, referer_host TEXT, visitor TEXT,
  PRIMARY KEY (site_id, insert_id)
);
CREATE INDEX IF NOT EXISTS requests_day ON requests (site_id, day);
CREATE TABLE IF NOT EXISTS cold_starts (site_id TEXT NOT NULL, insert_id TEXT NOT NULL, ts INTEGER NOT NULL, day TEXT NOT NULL, revision TEXT, PRIMARY KEY (site_id, insert_id));
CREATE TABLE IF NOT EXISTS revisions (site_id TEXT NOT NULL, revision TEXT NOT NULL, first_ts INTEGER NOT NULL, last_ts INTEGER NOT NULL, PRIMARY KEY (site_id, revision));
CREATE TABLE IF NOT EXISTS sync_state (site_id TEXT PRIMARY KEY, requests_ts INTEGER, cold_ts INTEGER, first_ts INTEGER, at INTEGER, error TEXT, link TEXT);
`;

export function createFirebase({ dbPath, store, getToken, bigquery = null, fetchImpl = fetch, now = Date.now, log = console }) {
  let db = null;
  let timers = [];
  let running = null;
  let lastAutoLink = 0;

  function open() {
    if (db) return db;
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA);
    return db;
  }

  async function config() {
    const s = await store.get();
    return { links: s.firebase?.links || {}, salt: s.firebase?.salt || '' };
  }

  async function salt() {
    const cfg = await config();
    if (cfg.salt) return cfg.salt;
    const value = randomBytes(16).toString('hex');
    await store.update((s) => {
      s.firebase = { ...(s.firebase || {}), salt: s.firebase?.salt || value };
    });
    return (await config()).salt;
  }

  async function listEntries({ project, filter, pageSize = 1000, pageToken, orderBy = 'timestamp asc' }) {
    const token = await getToken();
    let res;
    try {
      res = await fetchImpl(LOGGING, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceNames: [`projects/${project}`], filter, orderBy, pageSize, pageToken }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw new EngineError(`Couldn’t reach Cloud Logging: ${err.message}`, { status: 502, kind: 'firebase' });
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    const message = data.error?.message || `Cloud Logging returned ${res.status}.`;
    if (res.status === 401 || /insufficient.*scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(message + JSON.stringify(data.error?.details || ''))) {
      throw new EngineError('Studio can’t read Cloud logs with this Google sign-in yet.', {
        status: 401,
        kind: 'needs-logging-scope',
        hint: 'Settings → Google → Sign out, then sign in again and allow “View log data for your Google Cloud projects”.',
      });
    }
    if (res.status === 403) {
      throw new EngineError(`No access to logs in ${project}: ${message}`, {
        status: 403,
        kind: 'firebase-permission',
        hint: /has not been used|disabled/i.test(message)
          ? `Enable the Cloud Logging API: console.cloud.google.com/apis/library/logging.googleapis.com?project=${project}`
          : 'Your Google account needs the Logs Viewer role (roles/logging.viewer) on that project. Owners already have it.',
      });
    }
    if (res.status === 429) throw new EngineError('Cloud Logging rate limit hit; the next sync continues.', { status: 429, kind: 'firebase' });
    throw new EngineError(message, { status: 502, kind: 'firebase' });
  }

  // Services seen in a project's request log over the last 3 days, with the hosts they served.
  async function discover(project) {
    if (!PROJECT.test(project)) throw new EngineError('That isn’t a Google Cloud project ID.', { kind: 'validation' });
    const sinceIso = new Date(now() - 3 * DAY).toISOString();
    const services = new Map();
    let pageToken;
    for (let page = 0; page < 3; page++) {
      const data = await listEntries({ project, filter: requestFilter({ project, sinceIso }), orderBy: 'timestamp desc', pageToken });
      for (const e of data.entries || []) {
        const name = e.resource?.labels?.service_name;
        if (!name) continue;
        const svc = services.get(name) || { service: name, location: e.resource.labels.location || '', hosts: new Map(), requests: 0 };
        svc.requests++;
        try {
          const host = bareHost(new URL(e.httpRequest?.requestUrl || '').host);
          if (host) svc.hosts.set(host, (svc.hosts.get(host) || 0) + 1);
        } catch { /* relative URL */ }
        services.set(name, svc);
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return [...services.values()].map((s) => ({
      project,
      service: s.service,
      location: s.location,
      requests: s.requests,
      hosts: [...s.hosts].sort((a, b) => b[1] - a[1]).map(([h]) => h).slice(0, 5),
    }));
  }

  // Scans the signed-in account's projects for Cloud Run services serving each
  // unlinked site's host, and links the first match.
  async function autoLink() {
    const sites = (await store.sites()).filter((s) => !s.demo && s.host);
    const { links } = await config();
    const projects = new Set(Object.values(links).map((l) => l.project));
    if (bigquery) {
      for (const p of await bigquery.listProjects().catch(() => [])) if (p.id) projects.add(p.id);
    }
    for (const s of sites) for (const p of [s.bq?.dataProject, s.bq?.billingProject]) if (p) projects.add(p);
    const found = [];
    const errors = [];
    for (const project of projects) {
      try {
        found.push(...(await discover(project)));
      } catch (err) {
        if (err.kind === 'needs-logging-scope') throw err;
        errors.push({ project, error: err.message });
      }
    }
    const linked = [];
    await store.update((s) => {
      const next = { ...(s.firebase?.links || {}) };
      for (const site of sites) {
        if (next[site.id]) continue;
        const host = bareHost(site.host);
        const hit = found.find((f) => f.hosts.some((h) => h === host || (site.includeSubdomains && h.endsWith(`.${host}`))));
        if (hit) {
          next[site.id] = { project: hit.project, service: hit.service, location: hit.location };
          linked.push({ siteId: site.id, ...next[site.id] });
        }
      }
      s.firebase = { ...(s.firebase || {}), links: next };
    });
    if (linked.length) sync().catch(() => {});
    return { services: found, linked, errors, scanned: [...projects] };
  }

  async function setLink(siteId, link) {
    const id = String(siteId || '');
    if (!/^[\w-]{1,80}$/.test(id) || !(await store.site(id))) throw new EngineError('Unknown site.', { kind: 'validation' });
    if (link) {
      const project = String(link.project || '').trim();
      const service = String(link.service || '').trim();
      if (!PROJECT.test(project)) throw new EngineError('That isn’t a Google Cloud project ID.', { kind: 'validation' });
      if (!SERVICE.test(service)) throw new EngineError('A backend (Cloud Run service) name is lowercase letters, digits and dashes.', { kind: 'validation' });
      link = { project, service, location: String(link.location || '') };
    }
    await store.update((s) => {
      const next = { ...(s.firebase?.links || {}) };
      if (link) next[id] = link;
      else delete next[id];
      s.firebase = { ...(s.firebase || {}), links: next };
    });
    // A different backend means different history: start that site over.
    const d = open();
    const prev = d.prepare('SELECT link FROM sync_state WHERE site_id = ?').get(id)?.link;
    if (!link || prev !== JSON.stringify(link)) {
      for (const table of ['requests', 'cold_starts', 'revisions', 'sync_state']) d.prepare(`DELETE FROM ${table} WHERE site_id = ?`).run(id);
    }
    if (link) sync().catch(() => {});
    return { ok: true };
  }

  async function syncSite(site, link, saltValue) {
    const d = open();
    const state = d.prepare('SELECT * FROM sync_state WHERE site_id = ?').get(site.id) || {};
    const floor = now() - BACKFILL + HOUR;
    // Re-read 10 minutes of overlap: late-arriving entries; insert_id dedupes.
    const since = Math.max(floor, (state.requests_ts || 0) - 10 * MINUTE);
    const insert = d.prepare(`INSERT OR IGNORE INTO requests
      (site_id, insert_id, ts, day, host, revision, method, path, status, latency_ms, bytes, kind, bot, bot_kind, referer_host, visitor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const revision = d.prepare(`INSERT INTO revisions (site_id, revision, first_ts, last_ts) VALUES (?, ?, ?, ?)
      ON CONFLICT (site_id, revision) DO UPDATE SET first_ts = MIN(first_ts, excluded.first_ts), last_ts = MAX(last_ts, excluded.last_ts)`);
    let latest = state.requests_ts || 0;
    let first = state.first_ts || 0;
    let added = 0;
    let pageToken;
    let pages = 0;
    for (; pages < MAX_PAGES; pages++) {
      const data = await listEntries({ project: link.project, filter: requestFilter({ ...link, sinceIso: new Date(since).toISOString() }), pageToken });
      d.exec('BEGIN');
      try {
        for (const entry of data.entries || []) {
          const row = parseRequestEntry(entry, { salt: saltValue, siteHost: site.host });
          if (!row) continue;
          added += Number(insert.run(site.id, row.insert_id, row.ts, row.day, row.host, row.revision, row.method, row.path, row.status,
            row.latency_ms, row.bytes, row.kind, row.bot, row.bot_kind, row.referer_host, row.visitor).changes);
          if (row.revision) revision.run(site.id, row.revision, row.ts, row.ts);
          latest = Math.max(latest, row.ts);
          first = first ? Math.min(first, row.ts) : row.ts;
        }
        d.exec('COMMIT');
      } catch (err) {
        d.exec('ROLLBACK');
        throw err;
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    // Cold starts are a small log; one or two pages per sync.
    const coldSince = Math.max(floor, (state.cold_ts || 0) - 10 * MINUTE);
    let coldLatest = state.cold_ts || 0;
    const cold = d.prepare('INSERT OR IGNORE INTO cold_starts (site_id, insert_id, ts, day, revision) VALUES (?, ?, ?, ?, ?)');
    let coldToken;
    for (let page = 0; page < 5; page++) {
      const data = await listEntries({ project: link.project, filter: coldStartFilter({ ...link, sinceIso: new Date(coldSince).toISOString() }), pageToken: coldToken });
      for (const e of data.entries || []) {
        const ts = Date.parse(e.timestamp || '');
        if (!Number.isFinite(ts)) continue;
        cold.run(site.id, String(e.insertId || ts), ts, isoDay(ts), String(e.resource?.labels?.revision_name || ''));
        coldLatest = Math.max(coldLatest, ts);
      }
      coldToken = data.nextPageToken;
      if (!coldToken) break;
    }

    d.prepare(`INSERT INTO sync_state (site_id, requests_ts, cold_ts, first_ts, at, error, link) VALUES (?, ?, ?, ?, ?, '', ?)
      ON CONFLICT (site_id) DO UPDATE SET requests_ts = excluded.requests_ts, cold_ts = excluded.cold_ts,
        first_ts = COALESCE(sync_state.first_ts, excluded.first_ts), at = excluded.at, error = '', link = excluded.link`)
      .run(site.id, latest || null, coldLatest || null, first || null, now(), JSON.stringify(link));
    d.prepare('DELETE FROM requests WHERE site_id = ? AND ts < ?').run(site.id, now() - KEEP);
    d.prepare('DELETE FROM cold_starts WHERE site_id = ? AND ts < ?').run(site.id, now() - KEEP);
    return { siteId: site.id, added, more: Boolean(pageToken) };
  }

  async function sync() {
    running ||= (async () => {
      // Sites not linked yet get linked on their own when a backend serves
      // their host, so nobody has to press Find. At most every 6 hours.
      const sites = (await store.sites()).filter((s) => !s.demo && s.host);
      const before = (await config()).links;
      if (sites.some((s) => !before[s.id]) && now() - lastAutoLink > 6 * HOUR) {
        lastAutoLink = now();
        await autoLink().catch(() => {});
      }
      const { links } = await config();
      const results = [];
      if (!Object.keys(links).length) return results;
      const saltValue = await salt();
      for (const [siteId, link] of Object.entries(links)) {
        const site = await store.site(siteId);
        if (!site) continue;
        try {
          results.push(await syncSite(site, link, saltValue));
        } catch (err) {
          open().prepare(`INSERT INTO sync_state (site_id, at, error, link) VALUES (?, ?, ?, ?)
            ON CONFLICT (site_id) DO UPDATE SET at = excluded.at, error = excluded.error`).run(siteId, now(), err.message, JSON.stringify(link));
          results.push({ siteId, error: err.message, kind: err.kind, hint: err.hint });
        }
      }
      return results;
    })().finally(() => {
      running = null;
    });
    return running;
  }

  async function status() {
    const { links } = await config();
    const d = open();
    const sites = await store.sites();
    return {
      syncing: Boolean(running),
      links: Object.entries(links).map(([siteId, link]) => {
        const st = d.prepare('SELECT * FROM sync_state WHERE site_id = ?').get(siteId) || {};
        const site = sites.find((s) => s.id === siteId);
        return {
          siteId,
          label: site?.label || siteId,
          host: site?.host || '',
          ...link,
          lastSync: st.at || null,
          lastRequest: st.requests_ts || null,
          dataStart: st.first_ts || null,
          error: st.error || '',
          requests: d.prepare('SELECT COUNT(*) AS n FROM requests WHERE site_id = ?').get(siteId).n,
        };
      }),
      sites: sites.filter((s) => !s.demo).map((s) => ({ id: s.id, label: s.label, host: s.host })),
    };
  }

  async function overview(siteId, rangeKey = '28d') {
    const { links } = await config();
    const link = links[siteId];
    if (!link) {
      throw new EngineError('This site isn’t linked to a Firebase App Hosting backend.', {
        status: 409,
        kind: 'needs-firebase',
        hint: 'Settings → Firebase → Find my backends, or pick the project and backend by hand.',
      });
    }
    const d = open();
    const range = historyRange(rangeKey, now());
    const st = d.prepare('SELECT * FROM sync_state WHERE site_id = ?').get(siteId) || {};
    const args = [siteId, range.start, range.end];
    const inRange = 'site_id = ? AND day BETWEEN ? AND ?';
    const dataStart = st.first_ts ? isoDay(st.first_ts) : null;
    const blank = (d0) => !dataStart || d0 < dataStart;

    // Daily page + file loads (assets are mostly CDN-served, /api/* is shown on its own).
    const daily = d.prepare(`SELECT day,
        SUM(bot_kind = 'human') AS human,
        SUM(bot_kind IN ('ai-crawler', 'ai-assistant')) AS ai,
        SUM(bot_kind = 'search') AS search,
        SUM(bot_kind NOT IN ('human', 'ai-crawler', 'ai-assistant', 'search')) AS other,
        COUNT(DISTINCT CASE WHEN bot_kind = 'human' THEN visitor END) AS visitors
      FROM requests WHERE ${inRange} AND kind IN ('page', 'file') AND method IN ('GET', 'HEAD') GROUP BY day`).all(...args);
    const byDay = new Map(daily.map((r) => [r.day, r]));
    const seriesOf = (key) => range.dates.map((day) => (blank(day) ? null : Number(byDay.get(day)?.[key] || 0)));

    const all = d.prepare(`SELECT day, COUNT(*) AS n, SUM(status >= 500) AS e5, SUM(status = 404) AS e404 FROM requests WHERE ${inRange} GROUP BY day`).all(...args);
    const allByDay = new Map(all.map((r) => [r.day, r]));
    const coldByDay = new Map(d.prepare(`SELECT day, COUNT(*) AS n FROM cold_starts WHERE ${inRange} GROUP BY day`).all(...args).map((r) => [r.day, r.n]));

    const latencies = d.prepare(`SELECT latency_ms AS v FROM requests WHERE ${inRange} AND kind = 'page' AND bot_kind = 'human' AND latency_ms IS NOT NULL ORDER BY latency_ms`).all(...args).map((r) => r.v);

    const bots = d.prepare(`SELECT bot, bot_kind AS kind, COUNT(*) AS hits, COUNT(DISTINCT path) AS paths,
        SUM(kind IN ('page', 'file')) AS pages, MAX(ts) AS lastSeen,
        SUM(path = '/robots.txt') AS robots, SUM(status >= 400) AS errors
      FROM requests WHERE ${inRange} AND bot_kind != 'human' GROUP BY bot, bot_kind ORDER BY hits DESC LIMIT 40`).all(...args);

    const aiPaths = d.prepare(`SELECT path, COUNT(*) AS hits, GROUP_CONCAT(DISTINCT bot) AS bots FROM requests
      WHERE ${inRange} AND bot_kind IN ('ai-crawler', 'ai-assistant') AND kind IN ('page', 'file') GROUP BY path ORDER BY hits DESC LIMIT 15`).all(...args);
    const humanPaths = d.prepare(`SELECT path, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS visitors FROM requests
      WHERE ${inRange} AND bot_kind = 'human' AND kind = 'page' AND method = 'GET' AND status < 400 GROUP BY path ORDER BY hits DESC LIMIT 15`).all(...args);
    const referrers = d.prepare(`SELECT referer_host AS host, COUNT(*) AS hits FROM requests
      WHERE ${inRange} AND bot_kind = 'human' AND kind = 'page' AND referer_host != '' GROUP BY referer_host ORDER BY hits DESC LIMIT 12`).all(...args);
    const errors = d.prepare(`SELECT path, status, COUNT(*) AS hits, SUM(bot_kind = 'human') AS humans, MAX(ts) AS lastSeen FROM requests
      WHERE ${inRange} AND (status >= 500 OR (status = 404 AND kind != 'asset')) GROUP BY path, status ORDER BY (status >= 500) DESC, humans DESC, hits DESC LIMIT 20`).all(...args);
    const endpoints = d.prepare(`SELECT path, COUNT(*) AS hits, COUNT(DISTINCT visitor) AS clients, SUM(bot_kind = 'human') AS humans,
        SUM(status >= 400) AS errors, MAX(ts) AS lastSeen FROM requests
      WHERE ${inRange} AND kind = 'api' GROUP BY path ORDER BY hits DESC LIMIT 20`).all(...args);
    const endpointDaily = d.prepare(`SELECT day, path, COUNT(DISTINCT visitor) AS clients FROM requests
      WHERE ${inRange} AND kind = 'api' GROUP BY day, path`).all(...args);

    const totals = daily.reduce((t, r) => {
      t.human += r.human;
      t.ai += r.ai;
      t.search += r.search;
      t.other += r.other;
      t.visitorDays += r.visitors;
      return t;
    }, { human: 0, ai: 0, search: 0, other: 0, visitorDays: 0 });
    const requests = all.reduce((a, r) => a + r.n, 0);
    const e5 = all.reduce((a, r) => a + r.e5, 0);
    const loads = totals.human + totals.ai + totals.search + totals.other;

    return {
      range,
      link,
      dataStart,
      lastSync: st.at || null,
      lastRequest: st.requests_ts || null,
      syncError: st.error || '',
      totals: {
        ...totals,
        loads,
        requests,
        botShare: loads ? 1 - totals.human / loads : null,
        errors5xx: e5,
        errorRate: requests ? e5 / requests : null,
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        coldStarts: [...coldByDay.values()].reduce((a, n) => a + n, 0),
      },
      series: {
        human: seriesOf('human'),
        ai: seriesOf('ai'),
        search: seriesOf('search'),
        other: seriesOf('other'),
        visitors: seriesOf('visitors'),
        requests: range.dates.map((day) => (blank(day) ? null : allByDay.get(day)?.n || 0)),
        errors5xx: range.dates.map((day) => (blank(day) ? null : allByDay.get(day)?.e5 || 0)),
        coldStarts: range.dates.map((day) => (blank(day) ? null : coldByDay.get(day) || 0)),
      },
      bots: bots.map((b) => ({ ...b, label: BOT_KINDS[b.kind] || b.kind })),
      aiPaths: aiPaths.map((r) => ({ ...r, bots: String(r.bots || '').split(',').filter(Boolean) })),
      humanPaths,
      referrers,
      errors,
      endpoints: endpoints.map((e) => ({
        ...e,
        daily: range.dates.map((day) => (blank(day) ? null : endpointDaily.find((r) => r.day === day && r.path === e.path)?.clients || 0)),
      })),
      deploys: deploysFor(siteId, range.start, range.end),
    };
  }

  // A revision's first request = its deploy. The revision live when history
  // starts is a baseline, not a deploy.
  function deploysFor(siteId, from = '', to = '') {
    const d = open();
    const st = d.prepare('SELECT first_ts FROM sync_state WHERE site_id = ?').get(siteId);
    const rows = d.prepare('SELECT revision, first_ts, last_ts FROM revisions WHERE site_id = ? ORDER BY first_ts').all(siteId);
    return rows
      .filter((r) => !st?.first_ts || r.first_ts > st.first_ts + 5 * MINUTE)
      .map((r) => ({ revision: r.revision, date: isoDay(r.first_ts), firstSeen: r.first_ts, lastSeen: r.last_ts }))
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  }

  // Deploy markers for annotations.registerSource('firebase', …).
  async function annotations({ from = '', to = '', scopes = null } = {}) {
    const { links } = await config();
    const wanted = scopes?.length ? new Set(scopes) : null;
    return Object.entries(links)
      .filter(([siteId]) => !wanted || wanted.has(`site:${siteId}`))
      .flatMap(([siteId, link]) => deploysFor(siteId, from, to).map((r) => ({
        id: `firebase-${siteId}-${r.revision}`,
        date: r.date,
        label: `Deploy: ${r.revision.replace(`${link.service}-`, '')}`,
        kind: 'deploy',
        source: 'firebase',
        url: `https://console.firebase.google.com/project/${link.project}/apphosting`,
        scope: `site:${siteId}`,
      })));
  }

  // Small per-site summary for the Overview and Site health pages; null when not linked.
  async function summary(siteId, rangeKey = '28d') {
    if (!(await config()).links[siteId]) return null;
    const o = await overview(siteId, rangeKey);
    return {
      link: o.link,
      dataStart: o.dataStart,
      lastSync: o.lastSync,
      syncError: o.syncError,
      totals: o.totals,
      series: { human: o.series.human, ai: o.series.ai, search: o.series.search, other: o.series.other },
      dates: o.range.dates,
      bots: o.bots.filter((b) => b.kind === 'ai-crawler' || b.kind === 'ai-assistant').slice(0, 6),
    };
  }

  // AI bots only, for the AI search view: assistant fetches (a person asked an AI
  // and it read your page live) are split from crawlers (indexing/training).
  // null when the site isn't linked.
  async function aiActivity(siteId, rangeKey = '28d') {
    if (!(await config()).links[siteId]) return null;
    const d = open();
    const range = historyRange(rangeKey, now());
    const st = d.prepare('SELECT first_ts FROM sync_state WHERE site_id = ?').get(siteId) || {};
    const dataStart = st.first_ts ? isoDay(st.first_ts) : null;
    const args = [siteId, range.start, range.end];
    const where = "site_id = ? AND day BETWEEN ? AND ? AND bot_kind IN ('ai-crawler', 'ai-assistant')";
    const daily = d.prepare(`SELECT day, SUM(bot_kind = 'ai-assistant') AS assistant, SUM(bot_kind = 'ai-crawler') AS crawler
      FROM requests WHERE ${where} AND kind IN ('page', 'file') GROUP BY day`).all(...args);
    const byDay = new Map(daily.map((r) => [r.day, r]));
    const seriesOf = (key) => range.dates.map((day) => (!dataStart || day < dataStart ? null : Number(byDay.get(day)?.[key] || 0)));
    const bots = d.prepare(`SELECT bot, bot_kind AS kind, COUNT(*) AS hits, SUM(kind IN ('page', 'file')) AS pages,
        COUNT(DISTINCT path) AS paths, SUM(path = '/robots.txt') AS robots, SUM(status >= 400) AS errors, MAX(ts) AS lastSeen
      FROM requests WHERE ${where} GROUP BY bot, bot_kind ORDER BY hits DESC`).all(...args);
    const paths = d.prepare(`SELECT path, SUM(bot_kind = 'ai-assistant') AS assistant, SUM(bot_kind = 'ai-crawler') AS crawler,
        GROUP_CONCAT(DISTINCT bot) AS bots FROM requests
      WHERE ${where} AND kind IN ('page', 'file') GROUP BY path ORDER BY assistant DESC, crawler DESC LIMIT 20`).all(...args);
    return {
      dates: range.dates,
      dataStart,
      series: { assistant: seriesOf('assistant'), crawler: seriesOf('crawler') },
      totals: daily.reduce((t, r) => ({ assistant: t.assistant + r.assistant, crawler: t.crawler + r.crawler }), { assistant: 0, crawler: 0 }),
      bots: bots.map((b) => ({ ...b, label: BOT_KINDS[b.kind] || b.kind })),
      paths: paths.map((r) => ({ ...r, bots: String(r.bots || '').split(',').filter(Boolean) })),
    };
  }

  return {
    get dbPath() {
      return dbPath;
    },
    sync,
    status,
    discover,
    autoLink,
    setLink,
    overview,
    summary,
    aiActivity,
    annotations,
    start() {
      if (timers.length) return;
      const safe = () => sync().catch((err) => log.error('[firebase]', err.message));
      timers.push(setTimeout(safe, 20_000));
      timers.push(setInterval(safe, 30 * MINUTE));
      for (const timer of timers) timer.unref?.();
    },
    stop() {
      timers.forEach((timer) => clearInterval(timer));
      timers = [];
      db?.close();
      db = null;
    },
  };
}

export function firebaseRoutes({ firebase }) {
  return [
    ['GET', /^\/api\/firebase\/status$/, async () => firebase.status()],
    ['POST', /^\/api\/firebase\/sync$/, async () => ({ results: await firebase.sync() })],
    ['POST', /^\/api\/firebase\/auto-link$/, async () => firebase.autoLink()],
    ['GET', /^\/api\/firebase\/discover$/, async ({ query }) => ({ services: await firebase.discover(query.get('project') || '') })],
    ['POST', /^\/api\/firebase\/link$/, async ({ body }) => firebase.setLink(body.siteId, body.link || null)],
    ['GET', /^\/api\/firebase\/sites\/([\w-]+)$/, async ({ match, query }) => firebase.overview(match[1], query.get('range') || '28d')],
    ['GET', /^\/api\/firebase\/sites\/([\w-]+)\/summary$/, async ({ match, query }) => ({ summary: await firebase.summary(match[1], query.get('range') || '28d') })],
  ];
}
