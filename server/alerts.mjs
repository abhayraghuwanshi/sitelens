// Alerts & daily digest: compares each source's latest day with its trailing
// window, keeps a deduped feed in studio.json, and delivers new alerts (and a
// once-a-day digest) to the in-app feed, a macOS notification and an optional
// Slack/Discord-compatible webhook.
//
// Local sources (GitHub db, Web Store snapshots) are checked every hour; GA4 and
// Search Console are checked once a day after `digestHour`, to stay well inside
// the Data API quota.

import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { runReport } from '../shared/sitelens/ga4.js';
import { hostFilter } from '../shared/sitelens/reports.js';
import { ValidationError } from './store.mjs';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const MAX_ALERTS = 300;
const MAX_DIGESTS = 14;

export const DEFAULT_RULES = Object.freeze({
  traffic: { enabled: true, pct: 0.5, minVolume: 20, z: 2 },
  search: { enabled: true, pct: 0.5, minVolume: 10, z: 2 },
  installs: { enabled: true, pct: 1, minVolume: 3, z: 2 },
  extUsers: { enabled: true, pct: 0.05, minDrop: 3 },
  rating: { enabled: true, minDrop: 0.1 },
  stars: { enabled: true, minGain: 3, multiple: 3 },
  issues: { enabled: true, minNew: 1 },
  mentions: { enabled: true, minPoints: 0 },
  // Thresholds live on each goal in the site's .sitelens.yml.
  goals: { enabled: true },
});

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  digestHour: 9,
  desktop: true,
  webhookUrl: '',
  includeDemo: false,
  rules: DEFAULT_RULES,
});

export const RULE_LABELS = {
  traffic: 'GA4 sessions & users',
  search: 'Search Console clicks',
  installs: 'Web Store listing installs',
  extUsers: 'Extension users drop',
  rating: 'Extension rating drop',
  stars: 'GitHub stars spike',
  issues: 'New GitHub issues',
  mentions: 'New mentions (HN, Reddit, Product Hunt)',
  goals: 'Goals marked alert: in .sitelens.yml',
};

/* ---------- Pure helpers (unit-tested) ---------- */

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// Latest value vs its trailing window. Fires when the change against the last
// 7 days' average passes `pct`, the bigger side has at least `minVolume`, and
// (when the 28-day window varies at all) the z-score passes `z`.
export function detectAnomaly(value, history, rule) {
  const window28 = history.slice(-28);
  const window7 = history.slice(-7);
  if (window7.length < 3) return null;
  const avg7 = mean(window7);
  const avg28 = mean(window28);
  const sd = stdev(window28);
  if (Math.max(value, avg7) < rule.minVolume) return null;
  const change = avg7 ? (value - avg7) / avg7 : value > 0 ? Infinity : 0;
  if (Math.abs(change) < rule.pct) return null;
  const z = sd ? (value - avg28) / sd : null;
  if (z !== null && Math.abs(z) < rule.z) return null;
  return { direction: value > avg7 ? 'up' : 'down', value, avg7, avg28, change, z };
}

// Drop of the latest point against the best of the previous `lookback` points.
export function detectDrop(latest, previous, { pct = 0, minDrop = 0 }) {
  const values = previous.filter((v) => typeof v === 'number');
  if (typeof latest !== 'number' || !values.length) return null;
  const peak = Math.max(...values);
  const drop = peak - latest;
  if (drop < minDrop || drop <= 0) return null;
  if (pct && peak > 0 && drop / peak < pct) return null;
  return { peak, latest, drop, change: peak ? -drop / peak : 0 };
}

// Stars gained since yesterday vs the average daily gain over the window.
export function detectStarSpike(series, rule) {
  if (series.length < 2) return null;
  const gains = series.slice(1).map((v, i) => Math.max(0, v - series[i]));
  const gain = gains.at(-1);
  const avg = mean(gains.slice(0, -1).slice(-28));
  if (gain < rule.minGain || gain < rule.multiple * avg) return null;
  return { gain, avg, total: series.at(-1) };
}

// Daily series with gaps filled; GA4 omits zero rows.
export function denseSeries(rows, dates, field) {
  const byDate = new Map(rows.map((r) => [normDate(r.date), Number(r[field]) || 0]));
  return dates.map((d) => byDate.get(d) || 0);
}

export function normDate(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 8);
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '';
}

export function localDay(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The `count` local days ending `endOffset` days before `ms` (oldest first).
export function lastDays(ms, count, endOffset = 1) {
  return Array.from({ length: count }, (_, i) => localDay(ms - (endOffset + count - 1 - i) * DAY));
}

export function normalizeSettings(input = {}) {
  const base = { ...DEFAULT_SETTINGS, ...input };
  const hour = Math.round(Number(base.digestHour));
  const webhookUrl = String(base.webhookUrl || '').trim();
  if (webhookUrl && !/^https:\/\/[^\s/]+\/\S*$/.test(webhookUrl)) throw new ValidationError('The webhook URL must start with https://.');
  const rules = {};
  for (const [key, defaults] of Object.entries(DEFAULT_RULES)) {
    const given = input.rules?.[key] || {};
    rules[key] = {};
    for (const [field, value] of Object.entries(defaults)) {
      if (field === 'enabled') rules[key].enabled = given.enabled === undefined ? value : Boolean(given.enabled);
      else rules[key][field] = Number.isFinite(Number(given[field])) && given[field] !== '' && given[field] !== null ? Math.max(0, Number(given[field])) : value;
    }
  }
  return {
    enabled: Boolean(base.enabled),
    digestHour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : DEFAULT_SETTINGS.digestHour,
    desktop: Boolean(base.desktop),
    webhookUrl,
    includeDemo: Boolean(base.includeDemo),
    rules,
  };
}

// Adds only alerts whose key hasn't fired before; newest first, capped.
export function mergeAlerts(existing, candidates, cap = MAX_ALERTS) {
  const seen = new Set(existing.map((a) => a.key));
  const fresh = [];
  for (const c of candidates) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    fresh.push(c);
  }
  return { fresh, all: [...fresh, ...existing].slice(0, cap) };
}

const pct = (v) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%` : 'new');
const num = (v) => (Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }));

export function digestText(digest) {
  const lines = [`SiteLens digest · ${digest.day}`];
  for (const s of digest.sites) {
    if (s.error) lines.push(`• ${s.label}: ${s.error}`);
    else lines.push(`• ${s.label}: ${num(s.sessions)} sessions (${pct(s.sessionsChange)} vs 7d), ${num(s.users)} users${s.clicks !== undefined ? `, ${num(s.clicks)} search clicks (${s.clicksDay})` : ''}`);
  }
  for (const e of digest.extensions) {
    lines.push(`• ${e.label}: ${e.users === null ? '—' : num(e.users)} users${e.rating ? `, ${e.rating}★` : ''}${e.installs !== undefined ? `, ${num(e.installs)} listing installs` : ''}`);
  }
  if (digest.mentions) lines.push(`• Mentions: ${num(digest.mentions.count)} new${digest.mentions.top ? ` (top: ${digest.mentions.top})` : ''}`);
  if (digest.github) lines.push(`• GitHub: +${num(digest.github.stars)} stars, ${num(digest.github.views)} repo views${digest.github.top ? ` (top: ${digest.github.top})` : ''}`);
  lines.push(digest.alerts.length ? `${digest.alerts.length} alert${digest.alerts.length === 1 ? '' : 's'}: ${digest.alerts.map((a) => a.title).join('; ')}` : 'No alerts.');
  return lines.join('\n');
}

/* ---------- Desktop notifications ---------- */

// What a desktop notification says, in macOS's three parts: the title names
// what it's about, the subtitle what happened, the body the detail. Several
// items go one per line, never run together on one.
const clip = (text, n) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);
const dayName = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function alertNotice(fresh) {
  if (fresh.length === 1) {
    const [a] = fresh;
    const label = a.subject?.label || '';
    // "New Tab by Cooldesk: users down 3 (-6%)" → title the label, subtitle the rest.
    const what = label && a.title.startsWith(`${label}: `) ? a.title.slice(label.length + 2) : a.title;
    return { title: label && what !== a.title ? label : 'SiteLens alert', subtitle: clip(what, 90), body: a.detail || '' };
  }
  const lines = fresh.slice(0, 3).map((a) => `• ${clip(a.title, 70)}`);
  if (fresh.length > 3) lines.push(`and ${fresh.length - 3} more in Alerts`);
  return { title: 'SiteLens', subtitle: `${fresh.length} new alerts`, body: lines.join('\n') };
}

export function digestNotice(digest) {
  const lines = [];
  for (const s of digest.sites) {
    if (s.error) lines.push(`${s.label}: couldn’t read`);
    else lines.push(`${s.label}: ${num(s.sessions)} visits${Number.isFinite(s.sessionsChange) ? ` (${pct(s.sessionsChange)})` : ''}`);
  }
  for (const e of digest.extensions) if (e.users !== null) lines.push(`${e.label}: ${num(e.users)} users`);
  const shown = lines.slice(0, 3);
  if (lines.length > 3) shown.push(`and ${lines.length - 3} more`);
  const alerts = digest.alerts.length;
  return {
    title: 'SiteLens daily digest',
    subtitle: `${dayName(digest.day)}${alerts ? ` · ${alerts} alert${alerts === 1 ? '' : 's'}` : ''}`,
    body: shown.join('\n') || 'No traffic to report.',
  };
}

/* ---------- Delivery ---------- */

// argv keeps the text out of the AppleScript source, so nothing needs escaping.
// macOS shows the title and subtitle on one line each and about two lines of body.
export function desktopNotify(title, body, { subtitle = '', exec = execFile, platform = process.platform } = {}) {
  if (platform !== 'darwin') return Promise.resolve({ ok: false, error: 'Desktop notifications need macOS.' });
  const script = 'on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv) subtitle (item 3 of argv)\nend run';
  return new Promise((resolve) => {
    exec('osascript', ['-e', script, String(title).slice(0, 120), String(body).slice(0, 400), String(subtitle).slice(0, 120)], { timeout: 10_000 }, (err) =>
      resolve(err ? { ok: false, error: err.message } : { ok: true }));
  });
}

// `text` for Slack, `content` for Discord; each ignores the other's field.
export async function postWebhook(url, text, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text.slice(0, 1900), username: 'SiteLens Studio' }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `Webhook answered ${res.status}.` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ---------- The service ---------- */

export function createAlerts({
  store,
  engines,
  github,
  extensions,
  auth,
  listingProperty = null,
  mentions = null,
  siteConfig = null,
  fetchImpl = fetch,
  now = () => Date.now(),
  notify = null,
  report = runReport,
  log = console,
}) {
  const deliver = notify || {
    desktop: (title, body, opts) => desktopNotify(title, body, opts),
    webhook: (url, text) => postWebhook(url, text, fetchImpl),
  };
  let running = null;

  async function settings() {
    return normalizeSettings((await store.get()).alertSettings || {});
  }

  /* --- checks; each returns { alerts, digest } for one source --- */

  // Daily users reaching each goal, one GA4 report for the events and one per page.
  async function goalSeries(site, goals, dates) {
    const token = await auth.token();
    const host = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
    const ask = async (dimensions, filter) => (await report({
      token,
      propertyId: site.propertyId,
      body: {
        dateRanges: [{ startDate: dates[0], endDate: dates.at(-1) }],
        dimensions,
        metrics: [{ name: 'totalUsers' }],
        dimensionFilter: { andGroup: { expressions: [host, filter] } },
        limit: 5000,
      },
    })).rows || [];
    const names = goals.filter((g) => g.source === 'event').map((g) => g.match);
    const byEvent = names.length ? await ask([{ name: 'date' }, { name: 'eventName' }], { filter: { fieldName: 'eventName', inListFilter: { values: names } } }) : [];
    return Promise.all(goals.map(async (g) => denseSeries(
      g.source === 'event'
        ? byEvent.filter((r) => r.eventName === g.match)
        : await ask([{ name: 'date' }], { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: g.match } } }),
      dates,
      'totalUsers',
    )));
  }

  async function checkGoals(site, goals, dates, day, t) {
    const product = ((await store.get()).products || []).find((p) => p.siteId === site.id);
    const series = await goalSeries(site, goals, dates);
    const alerts = [];
    goals.forEach((g, i) => {
      const { when, pct: threshold, min } = g.alert;
      const hit = detectAnomaly(series[i].at(-1), series[i].slice(0, -1), { pct: threshold, minVolume: min, z: 0 });
      if (!hit || (when === 'drop' && hit.direction !== 'down') || (when === 'spike' && hit.direction !== 'up')) return;
      alerts.push(alert(t, {
        key: `goal:${site.id}:${g.id}:${day}`, rule: 'goals', direction: hit.direction,
        subject: { type: 'site', id: site.id, label: site.label },
        link: product ? `#/outcomes/${product.id}` : `#/site/${site.id}/overview`,
        title: `${site.label}: ${g.label} ${hit.direction === 'up' ? 'jumped' : 'dropped'} ${pct(hit.change)}`,
        detail: `${num(hit.value)} users reached it on ${day} vs ${num(Math.round(hit.avg7 * 10) / 10)}/day over the previous 7 days. Watched because .sitelens.yml marks it alert.`,
        value: hit.value, baseline: hit.avg7, change: hit.change,
      }));
    });
    return alerts;
  }

  async function checkSites(cfg, t, day) {
    const out = { alerts: [], digest: [], errors: [] };
    const sites = (await store.sites()).filter((s) => cfg.includeDemo || !s.demo);
    const dates = lastDays(t, 29);
    for (const site of sites) {
      const row = { id: site.id, label: site.label };
      // The site's .sitelens.yml can tune or switch off its traffic and search rules.
      const own = await siteConfig?.applied(site);
      const rules = {
        traffic: { ...cfg.rules.traffic, ...own?.alerts?.traffic },
        search: { ...cfg.rules.search, ...own?.alerts?.search },
      };
      try {
        if (site.demo || site.propertyId) {
          const [p] = await engines.portfolio([site], '90d');
          if (p.error) throw new Error(p.error);
          const sessions = denseSeries(p.trend || [], dates, 'sessions');
          const users = denseSeries(p.trend || [], dates, 'activeUsers');
          Object.assign(row, { sessions: sessions.at(-1), users: users.at(-1), sessionsChange: change(sessions) });
          if (rules.traffic.enabled) {
            for (const [metric, series] of [['sessions', sessions], ['users', users]]) {
              const hit = detectAnomaly(series.at(-1), series.slice(0, -1), rules.traffic);
              if (hit) out.alerts.push(alert(t, {
                key: `traffic:${site.id}:${metric}:${day}`, rule: 'traffic', direction: hit.direction,
                subject: { type: 'site', id: site.id, label: site.label }, link: `#/site/${site.id}/overview`,
                title: `${site.label}: ${metric} ${hit.direction === 'up' ? 'spiked' : 'dropped'} ${pct(hit.change)}`,
                detail: `${num(hit.value)} ${metric} on ${day} vs ${num(Math.round(hit.avg7))}/day over the previous 7 days${hit.z === null ? '' : ` (z ${hit.z.toFixed(1)})`}.`,
                value: hit.value, baseline: hit.avg7, change: hit.change,
              }));
            }
          }
        }
        if (site.searchSite) {
          const search = await engines.search(site, '28d');
          // Search Console lags 2–3 days: judge its latest complete day.
          const trend = (search.trend || []).filter((r) => normDate(r.date) < localDay(t));
          const clicks = trend.map((r) => Number(r.clicks) || 0);
          const lastDate = normDate(trend.at(-1)?.date);
          if (lastDate) Object.assign(row, { clicks: clicks.at(-1), clicksDay: lastDate });
          const hit = rules.search.enabled && clicks.length ? detectAnomaly(clicks.at(-1), clicks.slice(0, -1), rules.search) : null;
          if (hit) out.alerts.push(alert(t, {
            key: `search:${site.id}:clicks:${lastDate}`, rule: 'search', direction: hit.direction,
            subject: { type: 'site', id: site.id, label: site.label }, link: `#/site/${site.id}/search`,
            title: `${site.label}: search clicks ${hit.direction === 'up' ? 'up' : 'down'} ${pct(hit.change)}`,
            detail: `${num(hit.value)} clicks on ${lastDate} vs ${num(Math.round(hit.avg7))}/day over the previous 7 days.`,
            value: hit.value, baseline: hit.avg7, change: hit.change,
          }));
        }
      } catch (err) {
        row.error = err.message;
        out.errors.push(`${site.label}: ${err.message}`);
      }
      const watched = (own?.goals || []).filter((g) => g.alert);
      if (cfg.rules.goals.enabled && watched.length && !site.demo && site.propertyId) {
        try {
          out.alerts.push(...await checkGoals(site, watched, dates, day, t));
        } catch (err) {
          out.errors.push(`${site.label} goals: ${err.message}`);
        }
      }
      if (row.error || row.sessions !== undefined || row.clicks !== undefined) out.digest.push(row);
    }
    return out;
  }

  async function checkExtensions(cfg, t, { daily }) {
    const out = { alerts: [], digest: [], errors: [] };
    for (const ext of await extensions.list()) {
      const label = ext.title || ext.label || ext.id;
      const history = ext.history || [];
      const latest = history.at(-1);
      const row = { id: ext.id, label, users: latest?.users ?? null, rating: latest?.rating ?? null };
      const subject = { type: 'extension', id: ext.id, label };
      if (latest && cfg.rules.extUsers.enabled) {
        const hit = detectDrop(latest.users, history.slice(-8, -1).map((p) => p.users), cfg.rules.extUsers);
        if (hit) out.alerts.push(alert(t, {
          key: `extUsers:${ext.id}:${latest.date}`, rule: 'extUsers', direction: 'down', subject, link: '#/extensions',
          title: `${label}: users down ${hit.drop} (${pct(hit.change)})`,
          detail: `${num(hit.latest)} users on the listing, down from ${num(hit.peak)} in the past week.`,
          value: hit.latest, baseline: hit.peak, change: hit.change,
        }));
      }
      const prevRating = history.slice(0, -1).reverse().find((p) => typeof p.rating === 'number')?.rating;
      if (latest && cfg.rules.rating.enabled && typeof latest.rating === 'number' && typeof prevRating === 'number' && prevRating - latest.rating >= cfg.rules.rating.minDrop) {
        out.alerts.push(alert(t, {
          key: `rating:${ext.id}:${latest.date}`, rule: 'rating', direction: 'down', subject, link: '#/extensions',
          title: `${label}: rating fell to ${latest.rating}★`,
          detail: `Was ${prevRating}★${latest.ratings ? `; ${latest.ratings} ratings now` : ''}. A new low review is the usual cause.`,
          value: latest.rating, baseline: prevRating, change: (latest.rating - prevRating) / prevRating,
        }));
      }
      if (daily && listingProperty && cfg.rules.installs.enabled) {
        try {
          const dates = lastDays(t, 29);
          const propertyId = await listingProperty(ext.id);
          const res = await report({
            token: await auth.token(),
            propertyId,
            body: {
              dateRanges: [{ startDate: dates[0], endDate: dates.at(-1) }],
              dimensions: [{ name: 'date' }],
              metrics: [{ name: 'eventCount' }],
              dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'install' } } },
              limit: 100,
            },
          });
          const installs = denseSeries(res.rows || [], dates, 'eventCount');
          row.installs = installs.at(-1);
          const hit = detectAnomaly(installs.at(-1), installs.slice(0, -1), cfg.rules.installs);
          if (hit) out.alerts.push(alert(t, {
            key: `installs:${ext.id}:${dates.at(-1)}`, rule: 'installs', direction: hit.direction, subject, link: '#/extensions',
            title: `${label}: listing installs ${hit.direction === 'up' ? 'spiked' : 'dropped'} ${pct(hit.change)}`,
            detail: `${num(hit.value)} installs from the listing on ${dates.at(-1)} vs ${hit.avg7.toFixed(1)}/day over the previous 7 days.`,
            value: hit.value, baseline: hit.avg7, change: hit.change,
          }));
        } catch (err) {
          // Extensions without a listing property simply have no install alerts.
          if (err.kind !== 'needs-listing-ga') out.errors.push(`${label} installs: ${err.message}`);
        }
      }
      out.digest.push(row);
    }
    return out;
  }

  function checkGitHub(cfg, t, state) {
    const out = { alerts: [], digest: null, errors: [], issues: { ...(state.issues || {}) } };
    if (!github?.hasDb?.()) return out;
    let rows;
    const db = new DatabaseSync(github.dbPath, { readOnly: true });
    try {
      const since = new Date(t - 120 * DAY).toISOString().slice(0, 10);
      rows = db.prepare(`SELECT r.name, s.date, s.stars, s.issues, s.views_count AS views FROM repo_stats s
        JOIN repos r ON r.id = s.repo_id WHERE r.hidden = 0 AND r.archived = 0 AND s.date >= ? ORDER BY s.date`).all(since);
    } finally {
      db.close();
    }
    const today = new Date(t).toISOString().slice(0, 10);
    const yesterday = new Date(t - DAY).toISOString().slice(0, 10);
    const days = Array.from({ length: 30 }, (_, i) => new Date(t - (29 - i) * DAY).toISOString().slice(0, 10));
    const byRepo = new Map();
    for (const r of rows) {
      if (!byRepo.has(r.name)) byRepo.set(r.name, []);
      byRepo.get(r.name).push(r);
    }
    const digest = { stars: 0, views: 0, top: '' };
    let topViews = 0;
    for (const [name, list] of byRepo) {
      // ghstats stores 0 for "not recorded"; carry the last known value forward.
      const byDay = new Map(list.map((r) => [r.date.slice(0, 10), r]));
      let stars = 0;
      let issues = 0;
      for (const r of list) {
        if (r.date.slice(0, 10) >= days[0]) break;
        if (r.stars) stars = r.stars;
        if (r.issues) issues = r.issues;
      }
      const starSeries = days.map((d) => {
        const r = byDay.get(d);
        if (r?.stars) stars = r.stars;
        if (r?.issues) issues = r.issues;
        return stars;
      });
      // A repo first seen today has no baseline yet, so it adds nothing.
      const gained = starSeries.at(-2) ? Math.max(0, starSeries.at(-1) - starSeries.at(-2)) : 0;
      digest.stars += gained;
      const views = Number(byDay.get(yesterday)?.views) || 0;
      digest.views += views;
      if (views > topViews) [topViews, digest.top] = [views, name];
      if (cfg.rules.stars.enabled && starSeries.at(-1) > 0) {
        const hit = detectStarSpike(starSeries.filter((v, i) => v > 0 || i === starSeries.length - 1), cfg.rules.stars);
        if (hit) out.alerts.push(alert(t, {
          key: `stars:${name}:${today}`, rule: 'stars', direction: 'up',
          subject: { type: 'repo', id: name, label: name }, link: `#/github?repo=${encodeURIComponent(name)}`,
          title: `${name}: +${hit.gain} stars today`,
          detail: `Now ${num(hit.total)} stars; the usual pace is ${hit.avg.toFixed(1)}/day. Check referrers for where they came from.`,
          value: hit.gain, baseline: hit.avg, change: hit.avg ? (hit.gain - hit.avg) / hit.avg : Infinity,
        }));
      }
      const seen = out.issues[name];
      if (cfg.rules.issues.enabled && typeof seen === 'number' && issues - seen >= Math.max(1, cfg.rules.issues.minNew)) {
        out.alerts.push(alert(t, {
          key: `issues:${name}:${issues}:${today}`, rule: 'issues', direction: 'up',
          subject: { type: 'repo', id: name, label: name }, link: `https://github.com/${name}/issues`,
          title: `${name}: ${issues - seen} new open issue${issues - seen === 1 ? '' : 's'}`,
          detail: `${issues} open issues and pull requests now, ${seen} at the last check.`,
          value: issues, baseline: seen, change: seen ? (issues - seen) / seen : Infinity,
        }));
      }
      if (issues) out.issues[name] = issues;
    }
    out.digest = byRepo.size ? digest : null;
    return out;
  }

  // New HN/Reddit/Product Hunt mentions since the last run (first seen, not backfill).
  async function checkMentions(cfg, t, state) {
    const out = { alerts: [], digest: null, errors: [] };
    if (!mentions) return out;
    const since = state.lastRun?.at || t - HOUR;
    const rule = cfg.rules.mentions;
    if (rule.enabled) {
      for (const m of mentions.newSince(since)) {
        if (m.kind !== 'comment' && m.points < rule.minPoints) continue;
        const where = { hn: 'Hacker News', reddit: m.community || 'Reddit', ph: 'Product Hunt' }[m.source];
        out.alerts.push(alert(t, {
          key: `mention:${m.id}`, rule: 'mentions', direction: 'up',
          subject: { type: 'mention', id: m.term, label: m.term }, link: m.permalink,
          title: `Mentioned on ${where}: ${m.title}`,
          detail: `${m.kind === 'comment' ? 'A comment' : `${m.points} points, ${m.comments} comments`}${m.author ? ` · by ${m.author}` : ''} · matched “${m.term}”.`,
          value: m.points, baseline: 0, change: Infinity,
        }));
      }
    }
    const recent = mentions.newSince(t - DAY);
    if (recent.length) {
      const top = [...recent].sort((a, b) => b.points - a.points)[0];
      out.digest = { count: recent.length, top: top.title, link: top.permalink };
    }
    return out;
  }

  /* --- orchestration --- */

  async function run({ daily = false, digest = false, deliverNew = true } = {}) {
    if (running) return running;
    running = (async () => {
      const t = now();
      const cfg = await settings();
      const state = (await store.get()).alertState || {};
      const day = localDay(t - DAY);
      const errors = [];
      const candidates = [];
      const capture = async (name, fn) => {
        try {
          const r = await fn();
          candidates.push(...r.alerts);
          errors.push(...r.errors);
          return r;
        } catch (err) {
          errors.push(`${name}: ${err.message}`);
          return null;
        }
      };

      const gh = await capture('GitHub', () => checkGitHub(cfg, t, state));
      const ext = await capture('Extensions', () => checkExtensions(cfg, t, { daily }));
      const talk = await capture('Mentions', () => checkMentions(cfg, t, state));
      const sites = daily ? await capture('Sites', () => checkSites(cfg, t, day)) : null;

      let fresh = [];
      let built = null;
      await store.update((s) => {
        const merged = mergeAlerts(s.alerts || [], candidates);
        fresh = merged.fresh;
        s.alerts = merged.all;
        s.alertState = {
          ...(s.alertState || {}),
          issues: gh?.issues || s.alertState?.issues || {},
          lastRun: { at: t, daily, fired: fresh.length, errors },
          ...(daily ? { lastDaily: localDay(t) } : {}),
        };
        if (digest) {
          const since = t - DAY;
          built = {
            day,
            at: t,
            sites: sites?.digest || [],
            extensions: ext?.digest || [],
            github: gh?.digest || null,
            mentions: talk?.digest || null,
            alerts: s.alerts.filter((a) => a.at >= since).map(({ id, title, rule, direction, link }) => ({ id, title, rule, direction, link })),
            errors,
          };
          built.text = digestText(built);
          s.alertDigests = [built, ...(s.alertDigests || []).filter((d) => d.day !== day)].slice(0, MAX_DIGESTS);
          s.alertState.lastDigest = localDay(t);
        }
      });

      const delivery = deliverNew && cfg.enabled ? await send(cfg, fresh, built) : {};
      return { at: t, daily, fired: fresh, errors, digest: built, delivery };
    })();
    try {
      return await running;
    } finally {
      running = null;
    }
  }

  async function send(cfg, fresh, digest) {
    const result = {};
    const parts = [];
    if (fresh.length) {
      const n = alertNotice(fresh);
      if (cfg.desktop) result.desktop = await deliver.desktop(n.title, n.body, { subtitle: n.subtitle });
      parts.push(fresh.map((a) => `⚠️ ${a.title} — ${a.detail}`).join('\n'));
    }
    if (digest) {
      const n = digestNotice(digest);
      if (cfg.desktop) result.digestDesktop = await deliver.desktop(n.title, n.body, { subtitle: n.subtitle });
      parts.push(digest.text);
    }
    if (cfg.webhookUrl && parts.length) result.webhook = await deliver.webhook(cfg.webhookUrl, parts.join('\n\n'));
    return result;
  }

  // Hourly: local sources; once a day after digestHour: GA4/GSC + the digest.
  async function tick() {
    const cfg = await settings();
    if (!cfg.enabled) return null;
    const t = now();
    const state = (await store.get()).alertState || {};
    const due = new Date(t).getHours() >= cfg.digestHour && state.lastDaily !== localDay(t);
    return run({ daily: due, digest: due });
  }

  return {
    run,
    tick,
    settings,
    async saveSettings(input) {
      const cfg = normalizeSettings(input);
      await store.update((s) => {
        s.alertSettings = cfg;
      });
      return cfg;
    },
    async feed({ limit = 200 } = {}) {
      const s = await store.get();
      const alerts = (s.alerts || []).slice(0, limit);
      return {
        alerts,
        unread: (s.alerts || []).filter((a) => !a.read).length,
        digest: s.alertDigests?.[0] || null,
        digests: (s.alertDigests || []).map(({ day, at }) => ({ day, at })),
        lastRun: s.alertState?.lastRun || null,
        settings: normalizeSettings(s.alertSettings || {}),
        labels: RULE_LABELS,
      };
    },
    async unread() {
      return ((await store.get()).alerts || []).filter((a) => !a.read).length;
    },
    async markRead({ ids = null, all = false } = {}) {
      const set = new Set(ids || []);
      let changed = 0;
      await store.update((s) => {
        for (const a of s.alerts || []) {
          if (!a.read && (all || set.has(a.id))) {
            a.read = true;
            changed++;
          }
        }
      });
      return { changed };
    },
    async test() {
      const cfg = await settings();
      const text = 'Test notification from SiteLens Studio — alerts will arrive like this.';
      return {
        desktop: cfg.desktop ? await deliver.desktop('SiteLens Studio', 'Alerts arrive like this: what it’s about, what happened, then the detail.', { subtitle: 'Test notification' }) : { ok: false, error: 'Desktop notifications are off.' },
        webhook: cfg.webhookUrl ? await deliver.webhook(cfg.webhookUrl, text) : { ok: false, error: 'No webhook URL set.' },
      };
    },
    start() {
      const go = () => this.tick().catch((err) => log.warn?.(`  Alerts: ${err.message}`));
      const first = setTimeout(go, 30_000);
      const timer = setInterval(go, HOUR);
      first.unref();
      timer.unref();
      return () => {
        clearTimeout(first);
        clearInterval(timer);
      };
    },
  };
}

function change(series) {
  const avg = mean(series.slice(-8, -1));
  return avg ? (series.at(-1) - avg) / avg : null;
}

function alert(t, fields) {
  return { id: `${t.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at: t, read: false, ...fields };
}

export function alertRoutes(alerts) {
  return [
    ['GET', /^\/api\/alerts$/, async ({ query }) => alerts.feed({ limit: Number(query.get('limit')) || 200 })],
    ['GET', /^\/api\/alerts\/unread$/, async () => ({ unread: await alerts.unread() })],
    ['POST', /^\/api\/alerts\/read$/, async ({ body }) => alerts.markRead({ ids: Array.isArray(body.ids) ? body.ids.map(String) : null, all: Boolean(body.all) })],
    ['GET', /^\/api\/alerts\/settings$/, async () => alerts.settings()],
    ['POST', /^\/api\/alerts\/settings$/, async ({ body }) => alerts.saveSettings(body)],
    ['POST', /^\/api\/alerts\/run$/, async ({ body }) => alerts.run({ daily: body.daily !== false, digest: Boolean(body.digest) })],
    ['POST', /^\/api\/alerts\/test$/, async () => alerts.test()],
  ];
}
