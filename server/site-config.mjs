// Site config as code: a `.sitelens.yml` in the site's repo declares what Studio
// measures (goals and when they should alert, funnels, alert thresholds), so an
// agent reading the site's code can set Studio up, and the setup changes in the
// same pull request as the tracking calls it describes. Connections and
// credentials (GA4 property, BigQuery, tokens, webhooks) stay in Settings: they
// belong to whoever runs Studio, not to the site, and never go in a repo.
//
// Where Studio looks, first match wins:
//   1. .data/config/<host>.yml          a local override, for sites without a repo
//   2. <repo>/.sitelens/<host>.yml      in any of the site's repos (one repo, many sites)
//   3. <repo>/.sitelens.yml             in any of the site's repos
// The demo site reads server/demo-sitelens.yml.
// A file that doesn't parse or validate is reported and not applied at all, so
// half a config never mixes with Studio's guesses. The spec is docs/sitelens-yml.md.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { normalizeGoals, GOAL_SOURCES } from './products.mjs';
import { ValidationError } from './store.mjs';
import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';
import { CONNECTORS, SUMMARIES, checkSelect } from './custom-metrics.mjs';

const API = 'https://api.github.com';
const DEMO_FILE = fileURLToPath(new URL('./demo-sitelens.yml', import.meta.url));
const TTL = 10 * 60_000;
const MAX_FUNNELS = 10;
const MAX_METRICS = 12;
const EVENT_RE = /^[A-Za-z][\w]{0,39}$/;

// What kind of thing the site is. It tells an agent (and a reader) which goals
// make sense; see docs/sitelens-yml.md for what each kind usually measures.
export const KINDS = {
  saas: 'Sign-ups, trials and paid plans',
  ecommerce: 'Product views, carts and purchases',
  extension: 'A site that sends visitors to a browser extension listing',
  desktop: 'A site that sends visitors to download an app',
  mobile: 'A site that sends visitors to an app store',
  content: 'A blog, newsletter or media site: subscribers and reading',
  docs: 'Documentation: finding answers and getting started',
  website: 'Anything else: a landing page, portfolio or company site',
};

// Studio's alert rules a site may tune; the rest aren't per site.
const SITE_RULES = { traffic: 'GA4 sessions & users', search: 'Search Console clicks' };
export const GOAL_ALERT_DEFAULTS = Object.freeze({ when: 'drop', pct: 0.5, min: 5 });

const TOP_KEYS = ['version', 'site', 'kind', 'goals', 'funnels', 'alerts', 'search', 'metrics'];
const GOAL_KEYS = ['label', 'event', 'page', 'source', 'role', 'value', 'alert'];

/* ---------- parsing (pure) ---------- */

const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const cleanHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '');

// 30, "30%" and 0.3 all mean 30%: people write percents, rules store fractions.
function percent(value, path) {
  const n = Number(String(value).trim().replace(/%$/, ''));
  if (!Number.isFinite(n) || n <= 0) throw new ValidationError(`${path} must be a percentage like 30 or 30%.`);
  return n < 1 && !String(value).includes('%') ? n : n / 100;
}

function count(value, path) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${path} must be a number of 0 or more.`);
  return n;
}

function unknownKeys(obj, allowed, path, warnings) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) warnings.push(`${path}${key}: not a setting Studio knows, so it’s ignored. Expected one of ${allowed.join(', ')}.`);
  }
}

// `alert: true` uses the defaults; a map tunes them; false/absent means no alert.
function goalAlert(input, path, warnings) {
  if (input === undefined || input === null || input === false || input === 'off') return null;
  if (input === true || input === 'on') return { ...GOAL_ALERT_DEFAULTS };
  if (!isMap(input)) throw new ValidationError(`${path} must be true, false, or settings like { when: drop, pct: 50 }.`);
  unknownKeys(input, ['when', 'pct', 'min'], `${path}.`, warnings);
  const when = input.when ?? GOAL_ALERT_DEFAULTS.when;
  if (!['drop', 'spike', 'both'].includes(when)) throw new ValidationError(`${path}.when must be drop, spike or both.`);
  return {
    when,
    pct: input.pct === undefined ? GOAL_ALERT_DEFAULTS.pct : percent(input.pct, `${path}.pct`),
    min: input.min === undefined ? GOAL_ALERT_DEFAULTS.min : count(input.min, `${path}.min`),
  };
}

function parseGoal(g, i, warnings) {
  const path = `goals[${i}]`;
  if (!isMap(g)) throw new ValidationError(`${path} must be a goal like { event: sign_up }.`);
  unknownKeys(g, GOAL_KEYS, `${path}.`, warnings);
  const given = ['event', 'page', 'source'].filter((k) => g[k] !== undefined);
  if (given.length !== 1) throw new ValidationError(`${path} needs exactly one of event, page or source.`);
  if (g.role !== undefined && !['outcome', 'step'].includes(g.role)) throw new ValidationError(`${path}.role must be outcome or step.`);
  let source = given[0];
  let match = String(g[source]).trim();
  if (source === 'source') {
    if (!GOAL_SOURCES[match] || GOAL_SOURCES[match].site) throw new ValidationError(`${path}.source must be installs, downloads or stars (use event: or page: for the site’s own goals).`);
    source = match;
    match = '';
  }
  if (g.value !== undefined && !(Number(g.value) > 0)) throw new ValidationError(`${path}.value must be a positive number.`);
  let goal;
  try {
    [goal] = normalizeGoals([{ source, match, label: g.label, role: g.role || 'outcome', value: g.value }]);
  } catch (err) {
    throw err instanceof ValidationError ? new ValidationError(`${path}: ${err.message}`) : err;
  }
  const alert = goalAlert(g.alert, `${path}.alert`, warnings);
  if (alert && !GOAL_SOURCES[goal.source].site) throw new ValidationError(`${path}.alert: alerts work on event and page goals; installs, downloads and stars have their own rules in Settings → Alerts.`);
  return alert ? { ...goal, alert } : goal;
}

// "page:/pricing", "event:sign_up", { page: /pricing } or { event: sign_up }.
function parseStep(step, path) {
  let kind;
  let value;
  if (typeof step === 'string') {
    const m = /^(page|event)\s*:\s*(.+)$/.exec(step.trim());
    if (!m) throw new ValidationError(`${path} must look like page:/pricing or event:sign_up.`);
    [, kind, value] = m;
  } else if (isMap(step) && Object.keys(step).length === 1 && (step.page !== undefined || step.event !== undefined)) {
    kind = step.page !== undefined ? 'page' : 'event';
    value = String(step[kind]);
  } else {
    throw new ValidationError(`${path} must be page:/path or event:name.`);
  }
  value = value.trim();
  if (kind === 'event' && !EVENT_RE.test(value)) throw new ValidationError(`${path}: “${value}” isn’t a GA4 event name.`);
  if (kind === 'page') {
    value = value.replace(/^https?:\/\/[^/]+/, '');
    if (!value.startsWith('/') || value.length > 200) throw new ValidationError(`${path}: “${value}” isn’t a page path like /pricing.`);
  }
  return { kind, value };
}

function parseFunnel(f, i, warnings) {
  const path = `funnels[${i}]`;
  if (!isMap(f)) throw new ValidationError(`${path} must be a funnel like { name: Sign-up, steps: [page:/, event:sign_up] }.`);
  unknownKeys(f, ['name', 'steps'], `${path}.`, warnings);
  const name = String(f.name || '').trim().slice(0, 60);
  if (!name) throw new ValidationError(`${path} needs a name.`);
  if (!Array.isArray(f.steps) || f.steps.length < 2 || f.steps.length > 8) throw new ValidationError(`${path} (${name}) needs 2–8 steps.`);
  return { name, steps: f.steps.map((s, k) => parseStep(s, `${path}.steps[${k}]`)) };
}

function parseAlerts(input, warnings) {
  if (!isMap(input)) throw new ValidationError('alerts must be a map like { traffic: { pct: 30 } }.');
  unknownKeys(input, Object.keys(SITE_RULES), 'alerts.', warnings);
  const out = {};
  for (const key of Object.keys(SITE_RULES)) {
    const rule = input[key];
    if (rule === undefined || rule === null) continue;
    if (rule === false || rule === 'off') {
      out[key] = { enabled: false };
      continue;
    }
    if (!isMap(rule)) throw new ValidationError(`alerts.${key} must be off, or settings like { pct: 30, min: 20 }.`);
    unknownKeys(rule, ['pct', 'min', 'z'], `alerts.${key}.`, warnings);
    out[key] = {
      enabled: true,
      ...(rule.pct !== undefined ? { pct: percent(rule.pct, `alerts.${key}.pct`) } : {}),
      ...(rule.min !== undefined ? { minVolume: count(rule.min, `alerts.${key}.min`) } : {}),
      ...(rule.z !== undefined ? { z: count(rule.z, `alerts.${key}.z`) } : {}),
    };
  }
  return out;
}

// Custom metrics: daily numbers from the site's own database, charted next to
// GA4. The source's ids live here (they aren't secrets); its token stays in
// Settings or .env. Each connector's fields go under its type, like
// `d1: { account: …, database: … }`.
function parseMetric(m, i, warnings) {
  const path = `metrics[${i}]`;
  if (!isMap(m)) throw new ValidationError(`${path} must be a metric like { label: Daily pings, d1: { account, database }, sql: SELECT … }.`);
  const types = Object.keys(CONNECTORS).filter((t) => m[t] !== undefined);
  unknownKeys(m, ['label', 'unit', 'summary', 'sql', ...Object.keys(CONNECTORS)], `${path}.`, warnings);
  const label = String(m.label ?? '').trim().slice(0, 80);
  if (!label) throw new ValidationError(`${path} needs a label.`);
  if (types.length !== 1) throw new ValidationError(`${path} (${label}) needs exactly one source: ${Object.keys(CONNECTORS).join(', ')}.`);
  const type = types[0];
  const connector = CONNECTORS[type];
  const given = m[type];
  if (!isMap(given)) throw new ValidationError(`${path}.${type} must be a map like { ${connector.fields.map((f) => f.yaml).join(', ')} }.`);
  unknownKeys(given, connector.fields.map((f) => f.yaml), `${path}.${type}.`, warnings);
  const source = { type };
  for (const f of connector.fields) {
    const value = String(given[f.yaml] ?? '').trim().toLowerCase();
    if (!f.pattern.test(value)) throw new ValidationError(`${path}.${type}.${f.yaml}: ${f.hint}`);
    source[f.key] = value;
  }
  if (m.summary !== undefined && !SUMMARIES.includes(m.summary)) throw new ValidationError(`${path}.summary must be ${SUMMARIES.join(', ')}.`);
  let sql;
  try {
    sql = checkSelect(String(m.sql ?? '').trim().slice(0, 8000));
  } catch (err) {
    throw new ValidationError(`${path}.sql: ${err.message}`);
  }
  return { label, unit: String(m.unit ?? '').trim().slice(0, 24), summary: m.summary || 'sum', source, sql };
}

// What the site wants to be found for. One block feeds Demand's query groups,
// the AI search answer checks (questions, and which names count as "us") and
// the Mentions terms, so none of them has to be set up by hand.
export const SEARCH_LIMITS = Object.freeze({ terms: 10, topics: 10, targets: 20, questions: 12, groups: 8 });

function termList(input, path, { min = 2 } = {}) {
  if (input === undefined || input === null) return [];
  const list = Array.isArray(input) ? input : [input];
  if (list.length > SEARCH_LIMITS.terms) throw new ValidationError(`${path}: up to ${SEARCH_LIMITS.terms} names.`);
  const out = [];
  list.forEach((raw, i) => {
    const t = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (t.length < min || t.length > 60) throw new ValidationError(`${path}[${i}] must be ${min}–60 characters.`);
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  });
  return out;
}

function questionList(input, path) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new ValidationError(`${path} must be a list of questions.`);
  return input.map((raw, i) => {
    const q = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (q.length < 8 || q.length > 300) throw new ValidationError(`${path}[${i}] must be a question of 8–300 characters.`);
    return q;
  });
}

function regex(pattern, path) {
  const p = String(pattern ?? '').trim();
  if (!p || p.length > 300) throw new ValidationError(`${path} must be a pattern of 1–300 characters.`);
  try {
    new RegExp(p, 'i');
  } catch (err) {
    throw new ValidationError(`${path}: not a valid pattern (${err.message}).`);
  }
  return p;
}

function parseTopic(t, i, warnings) {
  const path = `search.topics[${i}]`;
  if (!isMap(t)) throw new ValidationError(`${path} must be a topic like { name: Funnels, match: funnel }.`);
  unknownKeys(t, ['name', 'page', 'match', 'targets', 'ask_ai'], `${path}.`, warnings);
  const name = String(t.name || '').trim().slice(0, 40);
  if (!name) throw new ValidationError(`${path} needs a name.`);
  if (name.toLowerCase() === 'other') throw new ValidationError(`${path}: “Other” is where Demand puts queries no group matched; pick another name.`);
  const topic = { name };
  if (t.page !== undefined) topic.page = parseStep({ page: t.page }, `${path}.page`).value;
  if (t.match !== undefined) topic.match = regex(t.match, `${path}.match`);
  if (t.targets !== undefined) {
    if (!Array.isArray(t.targets) || t.targets.length > SEARCH_LIMITS.targets) throw new ValidationError(`${path}.targets must be a list of up to ${SEARCH_LIMITS.targets} search queries.`);
    topic.targets = [...new Set(t.targets.map((q) => String(q ?? '').trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
  }
  const ask = questionList(t.ask_ai, `${path}.ask_ai`);
  if (ask.length) topic.ask_ai = ask;
  if (!topic.match && !topic.targets?.length && !ask.length) throw new ValidationError(`${path} (${name}) needs match, targets or ask_ai.`);
  return topic;
}

function parseSearch(input, warnings) {
  if (!isMap(input)) throw new ValidationError('search must be a map like { brand: [acme], topics: [...] }.');
  unknownKeys(input, ['brand', 'competitors', 'topics', 'ask_ai'], 'search.', warnings);
  const out = { brand: termList(input.brand, 'search.brand'), competitors: termList(input.competitors, 'search.competitors'), topics: [] };
  if (input.topics !== undefined) {
    if (!Array.isArray(input.topics) || input.topics.length > SEARCH_LIMITS.topics) throw new ValidationError(`search.topics must be a list of up to ${SEARCH_LIMITS.topics} topics.`);
    input.topics.forEach((t, i) => {
      const topic = parseTopic(t, i, warnings);
      if (out.topics.some((x) => x.name.toLowerCase() === topic.name.toLowerCase())) throw new ValidationError(`search.topics[${i}]: another topic is already called “${topic.name}”.`);
      const taken = { brand: out.brand.length, competitors: out.competitors.length }[topic.name.toLowerCase()];
      if (taken) throw new ValidationError(`search.topics[${i}]: “${topic.name}” is the group search.${topic.name.toLowerCase()} makes; pick another name.`);
      out.topics.push(topic);
    });
  }
  const ask = questionList(input.ask_ai, 'search.ask_ai');
  if (ask.length) out.ask_ai = ask;
  if (aiQuestions(out).length > SEARCH_LIMITS.questions) throw new ValidationError(`Up to ${SEARCH_LIMITS.questions} ask_ai questions in all; each one is a paid Claude call per check.`);
  const groups = searchGroups(out, { all: true });
  if (groups.length > SEARCH_LIMITS.groups) warnings.push(`search: Demand shows ${SEARCH_LIMITS.groups} groups, so ${groups.slice(SEARCH_LIMITS.groups).map((g) => g.name).join(', ')} won’t get a line there.`);
  return out;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole words only ("arc" isn't in "search"), and "site lens" also matches
// "sitelens" and "site-lens".
const termsPattern = (terms) => `(?<![a-z0-9])(?:${terms.map((t) => escapeRegex(t.toLowerCase()).split(/\s+/).join('[\\s-]*')).join('|')})(?![a-z0-9])`;

// Demand's query groups, first match wins: Brand, so "acme funnels" counts as
// brand; then each topic (its match, or its target queries), so "raycast
// alternative" lands in the topic written for it; then Competitors for the
// rival names no topic claimed.
export function searchGroups(search, { all = false } = {}) {
  if (!search) return [];
  const groups = [];
  if (search.brand?.length) groups.push({ name: 'Brand', pattern: termsPattern(search.brand) });
  for (const t of search.topics || []) {
    const pattern = t.match || (t.targets?.length ? termsPattern(t.targets) : '');
    if (pattern) groups.push({ name: t.name, pattern });
  }
  if (search.competitors?.length) groups.push({ name: 'Competitors', pattern: termsPattern(search.competitors) });
  return all ? groups : groups.slice(0, SEARCH_LIMITS.groups);
}

// The answer-check questions, each with the topic (and page) it's about.
export function aiQuestions(search) {
  if (!search) return [];
  const out = [];
  const add = (prompt, topic) => {
    if (!out.some((q) => q.prompt.toLowerCase() === prompt.toLowerCase())) out.push(topic ? { prompt, topic: topic.name, ...(topic.page ? { page: topic.page } : {}) } : { prompt });
  };
  for (const t of search.topics || []) for (const q of t.ask_ai || []) add(q, t);
  for (const q of search.ask_ai || []) add(q, null);
  return out;
}

// → { config, errors, warnings }. `config` is null whenever there are errors.
export function parseSiteConfig(text, { host = '' } = {}) {
  const errors = [];
  const warnings = [];
  const doc = YAML.parseDocument(String(text ?? ''), { uniqueKeys: true });
  if (doc.errors.length) {
    // "Map keys must be unique at line 4, column 3:" plus a code excerpt; keep the first line.
    for (const e of doc.errors.slice(0, 5)) errors.push(e.message.split('\n')[0].replace(/:$/, '.'));
    return { config: null, errors, warnings };
  }
  const raw = doc.toJS();
  if (!isMap(raw)) return { config: null, errors: ['The file must be a YAML map, starting with version: 1.'], warnings };
  unknownKeys(raw, TOP_KEYS, '', warnings);

  const config = { version: 1 };
  const attempt = (fn) => {
    try {
      fn();
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      errors.push(err.message);
    }
  };
  attempt(() => {
    if (raw.version !== undefined && Number(raw.version) !== 1) throw new ValidationError(`version ${raw.version} isn’t supported; this Studio reads version: 1.`);
  });
  attempt(() => {
    if (raw.site === undefined) return;
    config.site = cleanHost(raw.site);
    if (host && config.site !== cleanHost(host)) throw new ValidationError(`This file is for ${config.site}, not ${cleanHost(host)}.`);
  });
  attempt(() => {
    if (raw.kind === undefined) return;
    if (!KINDS[raw.kind]) throw new ValidationError(`kind must be one of ${Object.keys(KINDS).join(', ')}.`);
    config.kind = raw.kind;
  });
  if (raw.goals !== undefined) {
    if (!Array.isArray(raw.goals)) errors.push('goals must be a list.');
    else if (raw.goals.length > 12) errors.push('Up to 12 goals.');
    else {
      config.goals = [];
      raw.goals.forEach((g, i) => attempt(() => {
        const goal = parseGoal(g, i, warnings);
        if (config.goals.some((x) => x.id === goal.id)) throw new ValidationError(`goals[${i}] (${goal.label}) is listed twice.`);
        config.goals.push(goal);
      }));
    }
  }
  if (raw.funnels !== undefined) {
    if (!Array.isArray(raw.funnels)) errors.push('funnels must be a list.');
    else if (raw.funnels.length > MAX_FUNNELS) errors.push(`Up to ${MAX_FUNNELS} funnels.`);
    else {
      config.funnels = [];
      raw.funnels.forEach((f, i) => attempt(() => {
        const funnel = parseFunnel(f, i, warnings);
        if (config.funnels.some((x) => x.name.toLowerCase() === funnel.name.toLowerCase())) throw new ValidationError(`funnels[${i}]: another funnel is already called “${funnel.name}”.`);
        config.funnels.push(funnel);
      }));
    }
  }
  if (raw.alerts !== undefined) attempt(() => {
    config.alerts = parseAlerts(raw.alerts, warnings);
  });
  if (raw.search !== undefined) attempt(() => {
    config.search = parseSearch(raw.search, warnings);
  });
  if (raw.metrics !== undefined) {
    if (!Array.isArray(raw.metrics)) errors.push('metrics must be a list.');
    else if (raw.metrics.length > MAX_METRICS) errors.push(`Up to ${MAX_METRICS} metrics.`);
    else {
      config.metrics = [];
      raw.metrics.forEach((m, i) => attempt(() => {
        const metric = parseMetric(m, i, warnings);
        if (config.metrics.some((x) => x.label.toLowerCase() === metric.label.toLowerCase())) throw new ValidationError(`metrics[${i}]: another metric is already called “${metric.label}”.`);
        config.metrics.push(metric);
      }));
    }
  }
  return errors.length ? { config: null, errors, warnings } : { config, errors, warnings };
}

// Event names a config relies on that the site didn't send in the checked window:
// usually a renamed tracking call, or a goal nobody has reached yet.
export function unseenEvents(config, fired) {
  if (!config || !fired) return [];
  const names = new Set([
    ...(config.goals || []).filter((g) => g.source === 'event').map((g) => g.match),
    ...(config.funnels || []).flatMap((f) => f.steps.filter((s) => s.kind === 'event').map((s) => s.value)),
  ]);
  return [...names].filter((n) => !fired.has(n)).sort();
}

/* ---------- writing a draft (pure) ---------- */

const stepText = (s) => `${s.kind}:${s.value}`;

function goalYaml(g) {
  const out = {};
  if (g.source === 'event') out.event = g.match;
  else if (g.source === 'page') out.page = g.match;
  else out.source = g.source;
  if (g.label && g.label !== g.match && g.label !== GOAL_SOURCES[g.source]?.label) out.label = g.label;
  out.role = g.role === 'step' ? 'step' : 'outcome';
  if (g.value) out.value = g.value;
  if (g.alert) {
    const a = g.alert;
    const same = a.when === GOAL_ALERT_DEFAULTS.when && a.pct === GOAL_ALERT_DEFAULTS.pct && a.min === GOAL_ALERT_DEFAULTS.min;
    out.alert = same ? true : { when: a.when, pct: Math.round(a.pct * 100), min: a.min };
  }
  return out;
}

function searchYaml(search) {
  const out = {};
  if (search.brand?.length) out.brand = search.brand;
  if (search.competitors?.length) out.competitors = search.competitors;
  if (search.topics?.length) out.topics = search.topics;
  if (search.ask_ai?.length) out.ask_ai = search.ask_ai;
  return Object.keys(out).length ? out : null;
}

// A starting file from what Studio already knows: goals set in Settings (or its
// guesses), suggested funnels, default alerts on site outcomes, and the query
// groups, AI questions and brand names set up by hand.
export function draftYaml({ host, kind = '', goals = [], funnels = [], guessed = false, search = null }) {
  const withAlerts = goals.map((g) => (g.role === 'outcome' && GOAL_SOURCES[g.source]?.site && !g.alert ? { ...g, alert: { ...GOAL_ALERT_DEFAULTS } } : g));
  const doc = new YAML.Document({
    version: 1,
    site: host,
    ...(kind ? { kind } : {}),
    ...(withAlerts.length ? { goals: withAlerts.map(goalYaml) } : {}),
    ...(funnels.length ? { funnels: funnels.map((f) => ({ name: f.name, steps: f.steps.map(stepText) })) } : {}),
    ...(search && searchYaml(search) ? { search: searchYaml(search) } : {}),
  });
  // Short lists and maps on one line: `steps: [page:/, event:sign_up]`.
  for (const f of doc.get('funnels')?.items || []) f.get('steps', true).flow = true;
  for (const g of doc.get('goals')?.items || []) {
    const alert = g.get('alert', true);
    if (YAML.isMap(alert)) alert.flow = true;
  }
  for (const key of ['brand', 'competitors']) {
    const list = doc.getIn(['search', key], true);
    if (list) list.flow = true;
  }
  for (const t of doc.getIn(['search', 'topics'])?.items || []) {
    const targets = t.get('targets', true);
    if (targets) targets.flow = true;
  }
  const head = [
    `# What SiteLens Studio measures for ${host}. Spec: docs/sitelens-yml.md in sitelens-studio.`,
    guessed ? '# Studio guessed these from the event names the site sends: check them against the code.' : '# Taken from the goals and funnels set up in Studio.',
  ];
  if (!kind) head.push(`# Set kind to one of: ${Object.keys(KINDS).join(', ')}.`);
  return `${head.join('\n')}\n${doc.toString({ lineWidth: 0 })}`;
}

/* ---------- one page's part of a file (pure) ---------- */

// The part of a file one page reads, with its comments: keys like 'goals' or
// 'search.brand' (one level down). No keys means the whole file. '' when the
// file sets none of them or doesn't parse.
export function sliceYaml(text, keys = []) {
  const doc = YAML.parseDocument(String(text ?? ''), { uniqueKeys: true });
  if (doc.errors.length || !YAML.isMap(doc.contents)) return '';
  if (!keys.length) return String(text).trimEnd();
  const want = new Map(); // top key → Set of sub keys, or null for all of it
  for (const k of keys) {
    const [top, sub] = k.split('.');
    if (!sub) want.set(top, null);
    else if (want.get(top) !== null) want.set(top, new Set([...(want.get(top) || []), sub]));
  }
  doc.contents.items = doc.contents.items.filter((pair) => {
    const key = String(pair.key?.value ?? pair.key);
    if (!want.has(key)) return false;
    const subs = want.get(key);
    if (!subs) return true;
    if (!YAML.isMap(pair.value)) return false;
    pair.value.items = pair.value.items.filter((p) => subs.has(String(p.key?.value ?? p.key)));
    return pair.value.items.length > 0;
  });
  doc.commentBefore = null;
  doc.comment = null;
  return doc.contents.items.length ? doc.toString({ lineWidth: 0 }).trimEnd() : '';
}

/* ---------- one section, swapped in (pure) ---------- */

// The top-level parts of a file that Setup edits one at a time.
export const SECTIONS = ['goals', 'funnels', 'search', 'alerts'];

const TOP_KEY_RE = /^([A-Za-z_][\w-]*)\s*:(\s|$)/;

// The lines [start, end) of one top-level section in a block-style file: its
// key, everything under it, and the comment lines right above the key. Blank
// lines and the next key's comments stay outside. null when it isn't there.
function sectionSpan(lines, key) {
  const tops = lines.map((l, i) => (TOP_KEY_RE.test(l) ? i : -1)).filter((i) => i >= 0);
  const at = tops.find((i) => TOP_KEY_RE.exec(lines[i])[1] === key);
  if (at === undefined) return null;
  let start = at;
  while (start > 0 && lines[start - 1].startsWith('#')) start--;
  let end = tops.find((i) => i > at) ?? lines.length;
  while (end > at + 1 && lines[end - 1].startsWith('#')) end--;
  while (end > at + 1 && !lines[end - 1].trim()) end--;
  return { start, end };
}

function blockFile(text) {
  const doc = YAML.parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length || !YAML.isMap(doc.contents) || doc.contents.flow) {
    throw new ValidationError('The file doesn’t parse as a YAML map, so one part of it can’t be swapped. Fix it in the repo first.');
  }
  return text.split('\n');
}

// One section exactly as the file writes it, with its comments; '' when unset.
export function sectionText(text, key) {
  try {
    const lines = blockFile(String(text ?? ''));
    const span = sectionSpan(lines, key);
    return span ? lines.slice(span.start, span.end).join('\n') : '';
  } catch {
    return '';
  }
}

// The file with one section replaced by `sectionYaml` (just that key, with any
// comments above it). Only that section's lines change, so the pull request
// shows just the edit. An empty section removes the key; no file starts one
// for `host`.
export function replaceSection(text, key, sectionYaml, { host = '' } = {}) {
  if (!SECTIONS.includes(key)) throw new ValidationError(`Only ${SECTIONS.join(', ')} can be changed here.`);
  const lines = blockFile(String(text ?? '').trim() ? String(text) : `version: 1\nsite: ${host}\n`);
  const next = String(sectionYaml ?? '').replace(/\s+$/, '').replace(/^\s*\n/, '');
  const part = YAML.parseDocument(next, { uniqueKeys: true });
  if (part.errors.length) throw new ValidationError(part.errors[0].message.split('\n')[0].replace(/:$/, '.'));
  const keys = YAML.isMap(part.contents) && !part.contents.flow ? part.contents.items.map((p) => String(p.key?.value ?? p.key)) : part.contents === null ? [] : null;
  if (!keys || keys.length > 1 || keys.some((k) => k !== key)) throw new ValidationError(`Write only the ${key}: part here, starting with “${key}:”.`);
  const span = sectionSpan(lines, key);
  const add = keys.length ? next.split('\n') : [];
  if (span) {
    // Removing a section also takes one blank line after it, so no gap doubles up.
    const end = !add.length && span.end < lines.length && !lines[span.end].trim() ? span.end + 1 : span.end;
    lines.splice(span.start, end - span.start, ...add);
  } else if (add.length) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push('', ...add, '');
  }
  return lines.join('\n');
}

/* ---------- loading ---------- */

// The `site:` a file names, or '' when it names none or doesn't parse (the full
// parse reports that).
function declaredHost(text) {
  try {
    const raw = YAML.parse(text, { logLevel: 'silent' });
    return isMap(raw) && raw.site ? cleanHost(raw.site) : '';
  } catch {
    return '';
  }
}

export function createSiteConfig({ dir, repos = async () => [], getToken = async () => '', cacheDb = null, fetchImpl = fetch, now = Date.now }) {
  // Keyed `<site id>:<host>`. Kept on disk and shown stale while GitHub is asked
  // again, so pages that only need the config don't wait on it.
  const cache = createCache({ db: cacheDb, name: 'site-config', staleFor: cacheDb ? 7 * 86_400_000 : 0, now });
  const lastGood = new Map(); // site id → { host, value }

  async function readLocal(host) {
    for (const ext of ['yml', 'yaml']) {
      const path = join(dir, `${host}.${ext}`);
      try {
        return { text: await readFile(path, 'utf8'), source: { type: 'local', path } };
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    return null;
  }

  async function readRepoFile(repo, path, token) {
    const res = await fetchImpl(`${API}/repos/${repo}/contents/${path}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub ${res.status} reading ${repo}/${path}`);
    const body = await res.json();
    if (Array.isArray(body) || body.type !== 'file') return null;
    return {
      text: Buffer.from(body.content || '', body.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8'),
      source: { type: 'repo', repo, path, sha: body.sha, url: body.html_url },
    };
  }

  async function load(site) {
    const host = cleanHost(site.host);
    const notes = [];
    let failed = false; // a read failed, so "no file" may not be true
    let found = await readLocal(host);
    if (!found && site.demo) found = { text: await readFile(DEMO_FILE, 'utf8'), source: { type: 'demo', path: 'server/demo-sitelens.yml' } };
    if (!found && !site.demo) {
      const token = await getToken();
      const names = token ? await repos(site).catch((err) => {
        failed = true;
        notes.push(`Couldn’t list the site’s repos: ${err.message}`);
        return [];
      }) : [];
      if (!token) notes.push('Add a GitHub token in Settings → GitHub so Studio can read .sitelens.yml from the site’s repo.');
      else if (!names.length) notes.push('No repo is linked to this site, so there’s no .sitelens.yml to read. Pick its repo in Settings → Products, or put the file in .data/config/.');
      search: for (const repo of names) {
        for (const path of [`.sitelens/${host}.yml`, '.sitelens.yml']) {
          let hit;
          try {
            hit = await readRepoFile(repo, path, token);
          } catch (err) {
            failed = true;
            notes.push(err.message);
            continue;
          }
          if (!hit) continue;
          // A shared repo's root file may describe another of its sites.
          if (path === '.sitelens.yml') {
            const declared = declaredHost(hit.text);
            if (declared && declared !== host) {
              notes.push(`${repo}/.sitelens.yml is for ${declared}; add .sitelens/${host}.yml there for this site.`);
              continue;
            }
          }
          found = hit;
          break search;
        }
      }
      // Say where it looked: a file that's only in a local checkout isn't on GitHub yet.
      if (!found && names.length && !failed) notes.push(`Looked for .sitelens/${host}.yml and .sitelens.yml on the default branch of ${names.join(', ')}; none there. A file that isn’t pushed yet can’t be read.`);
    }
    if (!found) return { found: false, failed, source: null, config: null, errors: [], warnings: [], notes, checkedAt: now() };
    return { found: true, source: found.source, text: found.text, notes, checkedAt: now() };
  }

  // The cache keeps the file's text, and each read parses it: a parse cached on
  // disk would outlive a deploy that teaches Studio a new key.
  const parsed = (value, host) => (value.found ? { ...value, ...parseSiteConfig(value.text, { host }) } : value);

  async function get(site, { fresh = false } = {}) {
    const host = cleanHost(site.host);
    const value = await cache.wrap(`${site.id}:${host}`, TTL, fresh, async () => {
      let value;
      try {
        value = await load(site);
      } catch (err) {
        value = { found: false, failed: true, source: null, config: null, errors: [], warnings: [], notes: [`Couldn’t read the config: ${err.message}`], checkedAt: now() };
      }
      // Keep using the last good file when GitHub or the disk hiccups, so goals
      // and their alerts don't fall back to guesses during an outage.
      const hit = lastGood.get(site.id);
      if (value.failed && !value.found && hit?.host === host) {
        value = { ...hit.value, notes: [...hit.value.notes.filter((n) => !n.startsWith('Couldn’t re-read')), `Couldn’t re-read it, so the last good copy is used: ${value.notes.join(' ')}`] };
      }
      return value;
    }).then((v) => parsed(v, host));
    if (value.config) lastGood.set(site.id, { host, value });
    return value;
  }

  // The applied config, or null: never throws, so callers can fall back quietly.
  async function applied(site) {
    if (!site) return null;
    try {
      return (await get(site)).config;
    } catch {
      return null;
    }
  }

  async function gh(method, path, token, body) {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return res.json();
    const detail = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 404) {
      throw new EngineError(`GitHub refused to ${path.endsWith('/pulls') ? 'open the pull request' : 'write to the repo'} (${res.status}).`, {
        status: 409, kind: 'github-write', hint: 'The GitHub token in Settings → GitHub needs Contents and Pull requests set to “Read and write” for this repo.',
      });
    }
    if (res.status === 409) throw new EngineError('The file changed on GitHub since Studio read it. Reload and make the change again.', { status: 409, kind: 'conflict' });
    throw new EngineError(`GitHub ${res.status}: ${detail.message || 'request failed'}`, { status: 502, kind: 'github' });
  }

  // Where a change to this site's config goes: the file it already has, or a
  // new one in its first repo, or a local file when it has no repo to write to.
  async function target(site, current) {
    if (current?.source?.type === 'local') return { type: 'local', path: current.source.path };
    if (current?.source?.type === 'repo') return { type: 'repo', repo: current.source.repo, path: current.source.path, sha: current.source.sha, url: current.source.url };
    const host = cleanHost(site.host);
    const token = await getToken();
    const names = token ? await repos(site).catch(() => []) : [];
    if (!names.length) return { type: 'local', path: join(dir, `${host}.yml`), create: true };
    // A root .sitelens.yml there describes another site, so this one gets its own.
    const taken = current?.notes?.some((n) => n.startsWith(`${names[0]}/.sitelens.yml is for`));
    return { type: 'repo', repo: names[0], path: taken ? `.sitelens/${host}.yml` : '.sitelens.yml', sha: null, create: true };
  }

  async function openPr(site, to, text, key) {
    const token = await getToken();
    if (!token) throw new ValidationError('Add a GitHub token in Settings → GitHub first.');
    const base = (await gh('GET', `/repos/${to.repo}`, token)).default_branch;
    const head = await gh('GET', `/repos/${to.repo}/git/ref/heads/${encodeURIComponent(base)}`, token);
    const stamp = new Date(now()).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
    const branch = `sitelens/config-${key}-${stamp}`;
    await gh('POST', `/repos/${to.repo}/git/refs`, token, { ref: `refs/heads/${branch}`, sha: head.object.sha });
    const title = `${to.create ? 'Add' : 'Update'} ${key} in ${to.path}`;
    await gh('PUT', `/repos/${to.repo}/contents/${to.path.split('/').map(encodeURIComponent).join('/')}`, token, {
      message: title, content: Buffer.from(text, 'utf8').toString('base64'), branch, ...(to.sha ? { sha: to.sha } : {}),
    });
    const pr = await gh('POST', `/repos/${to.repo}/pulls`, token, {
      title, head: branch, base,
      body: [
        `What SiteLens Studio measures for ${cleanHost(site.host)}: this changes the \`${key}\` part of \`${to.path}\`. Studio applies it once it's on ${base}.`,
        'Spec: docs/sitelens-yml.md in sitelens-studio.',
        '_Opened from SiteLens Studio → Setup._',
      ].join('\n\n'),
    });
    return { url: pr.html_url, number: pr.number, branch };
  }

  return {
    get,
    applied,
    target,
    // Replace one section of the site's file: in place for a local file, as a
    // pull request for one in a repo. The whole file must still validate.
    async saveSection(site, key, sectionYaml) {
      if (site.demo) throw new ValidationError('The demo site’s config can’t be changed.');
      const host = cleanHost(site.host);
      const current = await get(site, { fresh: true });
      const to = await target(site, current);
      const text = replaceSection(current.found ? current.text : '', key, sectionYaml, { host });
      const { config, errors } = parseSiteConfig(text, { host });
      if (!config) throw new ValidationError(errors.join(' '));
      if (to.type === 'local') {
        await mkdir(dir, { recursive: true });
        await writeFile(to.path, text.endsWith('\n') ? text : `${text}\n`);
        cache.clear(`${site.id}:`);
        return { saved: 'local', path: to.path };
      }
      return { saved: 'pr', repo: to.repo, path: to.path, ...(await openPr(site, to, text, key)) };
    },
    async saveLocal(site, text) {
      const host = cleanHost(site.host);
      const { config, errors } = parseSiteConfig(text, { host });
      if (!config) throw new ValidationError(errors.join(' '));
      await mkdir(dir, { recursive: true });
      const path = join(dir, `${host}.yml`);
      await writeFile(path, text.endsWith('\n') ? text : `${text}\n`);
      cache.clear(`${site.id}:`);
      return get(site);
    },
    forget(siteId) {
      cache.clear(`${siteId}:`);
      lastGood.delete(siteId);
    },
  };
}

/* ---------- routes ---------- */

// `firedEvents(site)` → Set of event names sent in the last 28 days, or null when unknown.
// One line per thing a section declares, for Setup.
export function describeSection(key, value) {
  const pct = (r) => (r.enabled === false ? 'off' : r.pct !== undefined ? `±${Math.round(r.pct * 100)}%` : 'on');
  if (key === 'goals') return value.map((g) => `${g.label}${g.role === 'step' ? ' (step)' : ''}${g.alert ? ' · alerts' : ''}`);
  if (key === 'funnels') return value.map((f) => `${f.name} · ${f.steps.length} steps`);
  if (key === 'alerts') return Object.entries(value).map(([k, r]) => `${{ traffic: 'Sessions & users', search: 'Search clicks' }[k] || k}: ${pct(r)}`);
  const questions = aiQuestions(value).length;
  return [
    value.brand?.length && `Brand: ${value.brand.join(', ')}`,
    value.competitors?.length && `Competitors: ${value.competitors.join(', ')}`,
    ...(value.topics || []).map((t) => `Topic: ${t.name}${t.page ? ` → ${t.page}` : ''}`),
    questions && `${questions} AI question${questions === 1 ? '' : 's'}`,
  ].filter(Boolean);
}

// `draftInputs(site)` → { goals, funnels, guessed } for a starting file.
// `studioSetup(site)` → per section, what Studio uses when the file doesn't set
// it: { from: 'studio' | 'auto', items, edit } (edit: where it's changed in Studio).
export function siteConfigRoutes({ siteConfig, siteOr404, firedEvents, draftInputs, studioSetup = async () => ({}), onChange = () => {} }) {
  const withUnseen = async (site, result) => {
    if (!result.config) return result;
    const fired = await firedEvents(site).catch(() => null);
    const unseen = unseenEvents(result.config, fired);
    return {
      ...result,
      eventsChecked: Boolean(fired),
      warnings: [...result.warnings, ...(unseen.length ? [`Not sent by the site in the last 28 days: ${unseen.join(', ')}. Check the names against the tracking calls.`] : [])],
    };
  };
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/config$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      const result = await siteConfig.get(site, { fresh: query.has('fresh') });
      if (query.has('fresh')) onChange(site);
      return query.has('check') ? withUnseen(site, result) : result;
    }],
    // Validate a file without saving it: what an agent calls before committing one.
    ['POST', /^\/api\/sites\/([\w-]+)\/config\/check$/, async ({ match, body }) => {
      const site = await siteOr404(match[1]);
      return withUnseen(site, parseSiteConfig(body.yaml, { host: site.host }));
    }],
    // One site's Setup: for each section, whether it comes from the file, from
    // Studio's own settings or from Studio's guesses, and where a change goes.
    ['GET', /^\/api\/sites\/([\w-]+)\/setup$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      const current = await withUnseen(site, await siteConfig.get(site, { fresh: query.has('fresh') }));
      if (query.has('fresh')) onChange(site);
      const fromFile = current.config || {};
      const studio = await studioSetup(site);
      const sections = SECTIONS.map((key) => (fromFile[key] !== undefined
        ? { key, from: 'file', items: describeSection(key, fromFile[key]), yaml: sectionText(current.text, key) }
        : { key, from: 'auto', items: [], ...studio[key] }));
      const to = site.demo ? { type: 'demo' } : await siteConfig.target(site, current);
      return {
        file: { found: current.found, source: current.source, applied: Boolean(current.config), errors: current.errors, warnings: current.warnings, notes: current.notes },
        target: { type: to.type, repo: to.repo || '', path: to.path || '', create: Boolean(to.create) },
        sections,
      };
    }],
    // A starting file, or with ?keys= just those sections of it.
    ['GET', /^\/api\/sites\/([\w-]+)\/config\/draft$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      const current = await siteConfig.get(site);
      const inputs = await draftInputs(site);
      const yaml = draftYaml({ host: cleanHost(site.host), kind: current.config?.kind || '', ...inputs });
      const keys = String(query.get('keys') || '').split(',').filter((k) => SECTIONS.includes(k));
      return { yaml: keys.length ? sliceYaml(yaml, keys).replace(/^\s*\n/, '') : yaml, guessed: inputs.guessed };
    }],
    // Change one section: saved in place for a local file, a pull request for the repo's.
    ['POST', /^\/api\/sites\/([\w-]+)\/config\/section$/, async ({ match, body }) => {
      const site = await siteOr404(match[1]);
      const result = await siteConfig.saveSection(site, String(body.key || ''), String(body.yaml ?? ''));
      if (result.saved === 'local') onChange(site);
      return result;
    }],
    ['POST', /^\/api\/sites\/([\w-]+)\/config\/local$/, async ({ match, body }) => {
      const site = await siteOr404(match[1]);
      if (site.demo) throw new ValidationError('The demo site’s config can’t be changed.');
      const result = await siteConfig.saveLocal(site, String(body.yaml || ''));
      onChange(site);
      return result;
    }],
  ];
}
