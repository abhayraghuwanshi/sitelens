import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSiteConfig, draftYaml, unseenEvents, createSiteConfig, siteConfigRoutes, GOAL_ALERT_DEFAULTS, searchGroups, aiQuestions, sliceYaml, replaceSection, sectionText, describeSection } from '../server/site-config.mjs';
import { readFile } from 'node:fs/promises';

const FULL = `
version: 1
site: https://www.shop.test/
kind: saas
goals:
  - { event: sign_up, label: Sign-ups, value: 5, alert: true }
  - { page: /pricing, role: step }
  - { source: installs }
  - { event: purchase, alert: { when: both, pct: 30%, min: 2 } }
funnels:
  - name: Sign-up
    steps: [page:/, page:/pricing, { event: sign_up }]
alerts:
  traffic: { pct: 0.3, min: 50 }
  search: off
`;

test('parseSiteConfig turns a full file into goals, funnels and alert rules', () => {
  const { config, errors, warnings } = parseSiteConfig(FULL, { host: 'shop.test' });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(config.site, 'shop.test');
  assert.equal(config.kind, 'saas');
  assert.deepEqual(config.goals.map((g) => [g.id, g.source, g.match, g.role]), [
    ['event-sign-up', 'event', 'sign_up', 'outcome'],
    ['page-pricing', 'page', '/pricing', 'step'],
    ['installs-installs', 'installs', undefined, 'outcome'],
    ['event-purchase', 'event', 'purchase', 'outcome'],
  ]);
  assert.equal(config.goals[0].label, 'Sign-ups');
  assert.equal(config.goals[0].value, 5);
  assert.deepEqual(config.goals[0].alert, GOAL_ALERT_DEFAULTS);
  assert.deepEqual(config.goals[3].alert, { when: 'both', pct: 0.3, min: 2 });
  assert.deepEqual(config.funnels, [{ name: 'Sign-up', steps: [{ kind: 'page', value: '/' }, { kind: 'page', value: '/pricing' }, { kind: 'event', value: 'sign_up' }] }]);
  assert.deepEqual(config.alerts, { traffic: { enabled: true, pct: 0.3, minVolume: 50 }, search: { enabled: false } });
});

test('parseSiteConfig reports every error with where it is, and applies nothing', () => {
  const { config, errors } = parseSiteConfig(`
kind: blog
goals:
  - { event: "bad name" }
  - { page: pricing }
  - { event: a, page: /b }
  - { source: stars, alert: true }
funnels: [{ name: x, steps: [page:/] }]
`);
  assert.equal(config, null);
  assert.deepEqual(errors, [
    'kind must be one of saas, ecommerce, extension, desktop, mobile, content, docs, website.',
    'goals[0]: “bad name” isn’t a GA4 event name.',
    'goals[1]: “pricing” isn’t a page path like /pricing.',
    'goals[2] needs exactly one of event, page or source.',
    'goals[3].alert: alerts work on event and page goals; installs, downloads and stars have their own rules in Settings → Alerts.',
    'funnels[0] (x) needs 2–8 steps.',
  ]);
});

test('parseSiteConfig: syntax errors, wrong site, duplicates and unknown keys', () => {
  assert.match(parseSiteConfig('goals: [1').errors[0], /line 1/);
  assert.deepEqual(parseSiteConfig('site: other.test', { host: 'shop.test' }).errors, ['This file is for other.test, not shop.test.']);
  assert.deepEqual(parseSiteConfig('').errors, ['The file must be a YAML map, starting with version: 1.']);
  assert.deepEqual(parseSiteConfig('version: 2').errors, ['version 2 isn’t supported; this Studio reads version: 1.']);
  assert.match(parseSiteConfig('goals: [{ event: a }, { event: a }]').errors[0], /goals\[1\] \(a\) is listed twice/);
  assert.match(parseSiteConfig('a: 1\na: 2').errors[0], /unique/);
  const { config, warnings } = parseSiteConfig('goal: []\ngoals: [{ event: a, alrt: true }]');
  assert.ok(config);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /^goal: not a setting/);
  assert.match(warnings[1], /^goals\[0\]\.alrt:/);
});

test('draftYaml writes a file that parses back to the same goals and funnels', () => {
  const { config } = parseSiteConfig(FULL, { host: 'shop.test' });
  const text = draftYaml({ host: 'shop.test', kind: 'saas', goals: config.goals, funnels: config.funnels });
  assert.match(text, /steps: \[ page:\/, page:\/pricing, event:sign_up \]/);
  assert.match(text, /alert: \{ when: both, pct: 30, min: 2 \}/);
  const back = parseSiteConfig(text, { host: 'shop.test' });
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.config.goals, config.goals);
  assert.deepEqual(back.config.funnels, config.funnels);
});

test('draftYaml adds default alerts to site outcomes only', () => {
  const text = draftYaml({ host: 'a.test', goals: [{ source: 'event', match: 'sign_up', role: 'outcome' }, { source: 'page', match: '/pricing', role: 'step' }, { source: 'installs', role: 'outcome' }], guessed: true });
  assert.match(text, /guessed/);
  const { config } = parseSiteConfig(text);
  assert.deepEqual(config.goals.map((g) => Boolean(g.alert)), [true, false, false]);
});

test('unseenEvents lists the goal and funnel events the site never sent', () => {
  const { config } = parseSiteConfig(FULL);
  assert.deepEqual(unseenEvents(config, new Set(['sign_up'])), ['purchase']);
  assert.deepEqual(unseenEvents(config, null), []);
});

/* ---------- loading ---------- */

function fakeGitHub(files) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const path = url.replace('https://api.github.com/repos/', '');
    const [owner, name, , ...rest] = path.split('/');
    const text = files[`${owner}/${name}:${rest.join('/')}`];
    if (text instanceof Error) return { ok: false, status: 500, json: async () => ({}) };
    if (text === undefined) return { ok: false, status: 404, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ type: 'file', encoding: 'base64', content: Buffer.from(text).toString('base64'), sha: 'abc', html_url: `https://github.com/${owner}/${name}/blob/main/${rest.join('/')}` }),
    };
  };
  return { calls, fetchImpl };
}

const site = { id: 's1', label: 'Shop', host: 'shop.test' };

test('loads .sitelens.yml from the site’s repo, preferring .sitelens/<host>.yml', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitelens-config-'));
  const gh = fakeGitHub({
    'me/mono:.sitelens.yml': 'site: other.test\ngoals: [{ event: x }]',
    'me/web:.sitelens/shop.test.yml': 'goals: [{ event: sign_up }]',
    'me/web:.sitelens.yml': 'goals: [{ event: not_this_one }]',
  });
  const cfg = createSiteConfig({ dir, repos: async () => ['me/mono', 'me/web'], getToken: async () => 't', fetchImpl: gh.fetchImpl });
  const got = await cfg.get(site);
  assert.equal(got.found, true);
  assert.deepEqual(got.source, { type: 'repo', repo: 'me/web', path: '.sitelens/shop.test.yml', sha: 'abc', url: 'https://github.com/me/web/blob/main/.sitelens/shop.test.yml' });
  assert.equal(got.config.goals[0].match, 'sign_up');
  assert.match(got.notes[0], /me\/mono\/\.sitelens\.yml is for other\.test/);

  // Cached until asked for fresh.
  const before = gh.calls.length;
  await cfg.get(site);
  assert.equal(gh.calls.length, before);
  await cfg.get(site, { fresh: true });
  assert.ok(gh.calls.length > before);
});

test('a local override wins over the repo, and the demo site reads its bundled file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitelens-config-'));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'shop.test.yml'), 'goals: [{ event: local_goal }]');
  const gh = fakeGitHub({ 'me/web:.sitelens.yml': 'goals: [{ event: repo_goal }]' });
  const cfg = createSiteConfig({ dir, repos: async () => ['me/web'], getToken: async () => 't', fetchImpl: gh.fetchImpl });
  const got = await cfg.get(site);
  assert.equal(got.source.type, 'local');
  assert.equal(got.config.goals[0].match, 'local_goal');
  assert.equal(gh.calls.length, 0);

  const demo = await cfg.get({ id: 'demo', demo: true, host: 'example.com' });
  assert.equal(demo.source.type, 'demo');
  assert.deepEqual(demo.errors, []);
  assert.ok(demo.config.funnels.length >= 2);
});

test('explains why there is no file, and keeps the last good one when GitHub fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitelens-config-'));
  const none = createSiteConfig({ dir, repos: async () => ['me/web'], getToken: async () => '' });
  const got = await none.get(site);
  assert.equal(got.found, false);
  assert.match(got.notes[0], /GitHub token/);

  const files = { 'me/web:.sitelens.yml': 'goals: [{ event: sign_up }]' };
  const gh = fakeGitHub(files);
  const cfg = createSiteConfig({ dir, repos: async () => ['me/web'], getToken: async () => 't', fetchImpl: gh.fetchImpl });
  assert.equal((await cfg.applied(site)).goals[0].match, 'sign_up');
  files['me/web:.sitelens.yml'] = new Error('down');
  files['me/web:.sitelens/shop.test.yml'] = new Error('down');
  const after = await cfg.get(site, { fresh: true });
  assert.equal(after.config.goals[0].match, 'sign_up');
  assert.match(after.notes.at(-1), /last good copy is used: GitHub 500/);

  // A real 404 means the file was removed: stop applying it.
  delete files['me/web:.sitelens.yml'];
  delete files['me/web:.sitelens/shop.test.yml'];
  const gone = await cfg.get(site, { fresh: true });
  assert.equal(gone.found, false);
  assert.equal(gone.config, null);
});

test('a file with errors is found but not applied', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitelens-config-'));
  await writeFile(join(dir, 'shop.test.yml'), 'goals: [{ event: "no spaces" }]');
  const cfg = createSiteConfig({ dir });
  const got = await cfg.get(site);
  assert.equal(got.found, true);
  assert.equal(got.config, null);
  assert.equal(await cfg.applied(site), null);
  assert.match(got.errors[0], /goals\[0\]/);
});

test('saveLocal validates, writes .data/config/<host>.yml and applies it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitelens-config-'));
  const cfg = createSiteConfig({ dir });
  await assert.rejects(cfg.saveLocal(site, 'goals: [{ page: nope }]'), /page path/);
  const got = await cfg.saveLocal(site, 'goals: [{ event: sign_up }]');
  assert.equal(got.source.path, join(dir, 'shop.test.yml'));
  assert.equal(got.config.goals[0].match, 'sign_up');
});

test('check route flags event names the site never sent', async () => {
  const cfg = createSiteConfig({ dir: await mkdtemp(join(tmpdir(), 'sitelens-config-')) });
  const routes = siteConfigRoutes({
    siteConfig: cfg,
    siteOr404: async () => site,
    firedEvents: async () => new Set(['sign_up']),
    draftInputs: async () => ({ goals: [], funnels: [], guessed: true }),
  });
  const check = routes.find(([method, re]) => method === 'POST' && re.test('/api/sites/s1/config/check'));
  const out = await check[2]({ match: ['', 's1'], body: { yaml: 'goals: [{ event: sign_up }, { event: sign_upp }]' } });
  assert.equal(out.eventsChecked, true);
  assert.match(out.warnings[0], /last 28 days: sign_upp\./);
});

/* ---------- search ---------- */

const SEARCH = `
search:
  brand: [site lens, SiteLens, sitelens]
  competitors: plausible
  topics:
    - name: Funnels
      page: /features/funnels
      match: funnel|conversion
      ask_ai: [How do I build a GA4 funnel without the alpha API?]
    - { name: Local, targets: [Local GA4 dashboard] }
  ask_ai: [Is there a local dashboard for GA4?]
`;

test('search: becomes Demand groups (brand first) and AI questions tied to their topic', () => {
  const { config, errors, warnings } = parseSiteConfig(SEARCH);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(config.search.brand, ['site lens', 'SiteLens']); // sitelens repeats SiteLens
  assert.deepEqual(config.search.topics[1], { name: 'Local', targets: ['local ga4 dashboard'] });
  const word = (p) => `(?<![a-z0-9])(?:${p})(?![a-z0-9])`;
  assert.deepEqual(searchGroups(config.search), [
    { name: 'Brand', pattern: word('site[\\s-]*lens|sitelens') },
    { name: 'Funnels', pattern: 'funnel|conversion' },
    { name: 'Local', pattern: word('local[\\s-]*ga4[\\s-]*dashboard') },
    { name: 'Competitors', pattern: word('plausible') },
  ]);
  const re = new RegExp(searchGroups(config.search)[0].pattern, 'i');
  assert.ok(['sitelens', 'site-lens pricing', 'Site Lens'].every((q) => re.test(q)));
  assert.ok(!re.test('mysitelens'));
  // Topics come before Competitors, so a topic written for "<rival> alternative" gets it.
  const rivals = parseSiteConfig('search: { competitors: [raycast, arc], topics: [{ name: Launchers, match: alternative }] }').config.search;
  const [topic, comp] = searchGroups(rivals).map((g) => new RegExp(g.pattern, 'i'));
  assert.ok(topic.test('raycast alternative') && comp.test('raycast pricing'));
  assert.ok(!comp.test('search console') && comp.test('arc browser'));
  assert.deepEqual(aiQuestions(config.search), [
    { prompt: 'How do I build a GA4 funnel without the alpha API?', topic: 'Funnels', page: '/features/funnels' },
    { prompt: 'Is there a local dashboard for GA4?' },
  ]);
  assert.deepEqual(searchGroups(undefined), []);
});

test('search: errors and limits', () => {
  const errs = (yaml) => parseSiteConfig(yaml).errors;
  assert.match(errs('search: { topics: [{ name: A, match: "(" }] }')[0], /topics\[0\]\.match: not a valid pattern/);
  assert.match(errs('search: { topics: [{ name: A }] }')[0], /needs match, targets or ask_ai/);
  assert.match(errs('search: { topics: [{ name: Other, match: x }] }')[0], /Other/);
  assert.match(errs('search: { brand: [x1], topics: [{ name: Brand, match: x }] }')[0], /search\.brand makes/);
  assert.deepEqual(errs('search: { topics: [{ name: Brand, match: x }] }'), []); // fine without a brand list
  assert.match(errs('search: { topics: [{ name: A, page: pricing, match: x }] }')[0], /page path/);
  assert.match(errs(`search: { ask_ai: [${Array.from({ length: 13 }, (_, i) => `"Question number ${i}?"`).join(', ')}] }`)[0], /Up to 12/);
  const many = parseSiteConfig(`search: { brand: [acme], topics: [${Array.from({ length: 8 }, (_, i) => `{ name: T${i}, match: t${i} }`).join(', ')}] }`);
  assert.match(many.warnings[0], /won’t get a line there/);
  assert.equal(searchGroups(many.config.search).length, 8);
});

test('draftYaml writes the search block so hand-made groups and questions move into the file', () => {
  const search = { brand: ['Acme'], competitors: [], topics: [{ name: 'Category', match: 'dashboard|new tab' }], ask_ai: ['What is a good new tab extension?'] };
  const text = draftYaml({ host: 'a.test', search });
  assert.match(text, /brand: \[ Acme \]/);
  const { config, errors } = parseSiteConfig(text);
  assert.deepEqual(errors, []);
  assert.deepEqual(config.search, { brand: ['Acme'], competitors: [], topics: [{ name: 'Category', match: 'dashboard|new tab' }], ask_ai: ['What is a good new tab extension?'] });
  assert.doesNotMatch(draftYaml({ host: 'a.test', search: { brand: [], competitors: [], topics: [], ask_ai: [] } }), /search:/);
});

test('the demo file declares search topics that fit the demo queries', async () => {
  const cfg = createSiteConfig({ dir: await mkdtemp(join(tmpdir(), 'sitelens-config-')) });
  const demo = await cfg.applied({ id: 'demo', demo: true, host: 'example.com' });
  assert.ok(searchGroups(demo.search).length >= 3);
  assert.ok(aiQuestions(demo.search).every((q) => !/example/i.test(q.prompt)));
});

test('sliceYaml keeps one page’s keys, with their comments', () => {
  const text = `# head
version: 1
goals:
  # from SignupForm.tsx
  - { event: sign_up }
alerts:
  traffic: { pct: 40 }
search:
  brand: [acme]
  competitors: [rival]
`;
  assert.equal(sliceYaml(text, ['goals']), 'goals:\n  # from SignupForm.tsx\n  - { event: sign_up }');
  assert.equal(sliceYaml(text, ['search.brand', 'alerts.traffic']), 'alerts:\n  traffic: { pct: 40 }\nsearch:\n  brand: [ acme ]');
  assert.equal(sliceYaml(text, ['alerts.search']), '');
  assert.equal(sliceYaml(text, ['search', 'search.brand']), 'search:\n  brand: [ acme ]\n  competitors: [ rival ]');
  assert.equal(sliceYaml(text), text.trimEnd());
  assert.equal(sliceYaml('goals: [1', ['goals']), '');
});

test('replaceSection swaps one part of the file and keeps the rest with its comments', () => {
  const text = `# head
version: 1
site: acme.test
goals:
  # from SignupForm.tsx
  - { event: sign_up }
alerts:
  traffic: { pct: 40 }
`;
  const next = replaceSection(text, 'goals', '# both forms\ngoals:\n  - { event: sign_up }\n  - { event: generate_lead }');
  assert.match(next, /^# head/);
  assert.match(next, /# both forms\ngoals:/);
  assert.match(next, /generate_lead/);
  assert.doesNotMatch(next, /SignupForm/);
  assert.match(next, /alerts:\n  traffic: \{ pct: 40 \}/);
  assert.deepEqual(parseSiteConfig(next).errors, []);

  // A new section goes at the end; an empty one removes the key.
  assert.match(replaceSection(text, 'funnels', 'funnels:\n  - { name: A, steps: [page:/, event:x] }'), /traffic: \{ pct: 40 \}\n\nfunnels:/);
  assert.doesNotMatch(replaceSection(text, 'alerts', ''), /alerts/);
  // No file yet: one is started for the host.
  assert.match(replaceSection('', 'goals', 'goals: [{ event: x }]', { host: 'acme.test' }), /^version: 1\nsite: acme.test\n\ngoals:/);

  assert.throws(() => replaceSection(text, 'site', 'site: x'), /can be changed here/);
  assert.throws(() => replaceSection(text, 'goals', 'alerts: {}'), /only the goals: part/);
  assert.throws(() => replaceSection(text, 'goals', 'goals: [1'), /./);
});

test('an edit changes only its own lines: spacing, flow lists and other sections stay as written', () => {
  const text = `# head
version: 1

# What we sell
goals:
  - { event: sign_up, label: Sign-ups }

# from FunnelPage.tsx
funnels:
  - name: A
    steps: [page:/, event:sign_up]

alerts:
  traffic: { pct: 40 }
`;
  assert.equal(sectionText(text, 'goals'), '# What we sell\ngoals:\n  - { event: sign_up, label: Sign-ups }');
  assert.equal(sectionText(text, 'search'), '');
  for (const key of ['goals', 'funnels', 'alerts']) assert.equal(replaceSection(text, key, sectionText(text, key)), text);
  const edited = replaceSection(text, 'goals', sectionText(text, 'goals').replace('Sign-ups', 'Accounts'));
  assert.equal(edited, text.replace('Sign-ups', 'Accounts'));
  assert.equal(replaceSection(text, 'funnels', ''), text.replace('# from FunnelPage.tsx\nfunnels:\n  - name: A\n    steps: [page:/, event:sign_up]\n\n', ''));
  assert.throws(() => replaceSection('{ goals: [] }', 'goals', 'goals: []'), /YAML map/);
});

test('describeSection gives Setup one line per declared thing', () => {
  const { config } = parseSiteConfig(FULL);
  assert.deepEqual(describeSection('goals', config.goals).slice(0, 2), ['Sign-ups · alerts', '/pricing (step)']);
  assert.deepEqual(describeSection('funnels', config.funnels), ['Sign-up · 3 steps']);
  assert.deepEqual(describeSection('alerts', config.alerts), ['Sessions & users: ±30%', 'Search clicks: off']);
  assert.deepEqual(describeSection('search', { brand: ['acme'], competitors: [], topics: [{ name: 'Funnels', page: '/funnels', ask_ai: ['q?'] }] }),
    ['Brand: acme', 'Topic: Funnels → /funnels', '1 AI question']);
});

// GitHub as the PR flow sees it: reads, a branch, a commit and a pull request.
function writableGitHub(files) {
  const calls = [];
  const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
  const fetchImpl = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const path = url.replace('https://api.github.com', '');
    calls.push({ method, path, body: opts.body ? JSON.parse(opts.body) : null });
    const contents = /^\/repos\/([^/]+\/[^/]+)\/contents\/(.+)$/.exec(path);
    if (method === 'GET' && contents) {
      const text = files[`${contents[1]}:${decodeURIComponent(contents[2])}`];
      if (text === undefined) return json({}, 404);
      return json({ type: 'file', encoding: 'base64', content: Buffer.from(text).toString('base64'), sha: 'abc', html_url: `https://github.com/${contents[1]}/blob/main/${contents[2]}` });
    }
    if (method === 'GET' && /^\/repos\/[^/]+\/[^/]+$/.test(path)) return json({ default_branch: 'main' });
    if (method === 'GET' && path.includes('/git/ref/heads/')) return json({ object: { sha: 'base-sha' } });
    if (method === 'POST' && path.endsWith('/git/refs')) return json({}, 201);
    if (method === 'PUT' && contents) return json({}, 201);
    if (method === 'POST' && path.endsWith('/pulls')) return json({ html_url: 'https://github.com/me/web/pull/7', number: 7 }, 201);
    return json({}, 404);
  };
  return { calls, fetchImpl };
}

test('saveSection opens a pull request on the repo file, changing only that section', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitelens-config-'));
  const gh = writableGitHub({ 'me/web:.sitelens.yml': 'version: 1\n# keep me\nalerts:\n  traffic: { pct: 40 }\n' });
  const cfg = createSiteConfig({ dir, repos: async () => ['me/web'], getToken: async () => 't', fetchImpl: gh.fetchImpl, now: () => Date.UTC(2026, 10, 5, 9) });
  const out = await cfg.saveSection(site, 'goals', 'goals: [{ event: sign_up }]');
  assert.deepEqual(out, { saved: 'pr', repo: 'me/web', path: '.sitelens.yml', url: 'https://github.com/me/web/pull/7', number: 7, branch: 'sitelens/config-goals-20261105-0900' });
  const put = gh.calls.find((c) => c.method === 'PUT');
  assert.equal(put.body.sha, 'abc');
  assert.equal(put.body.branch, 'sitelens/config-goals-20261105-0900');
  const written = Buffer.from(put.body.content, 'base64').toString('utf8');
  assert.match(written, /# keep me\nalerts:/);
  assert.match(written, /goals:/);

  // An invalid section is refused before anything is written.
  const before = gh.calls.length;
  await assert.rejects(cfg.saveSection(site, 'goals', 'goals: [{ page: nope }]'), /page path/);
  assert.ok(!gh.calls.slice(before).some((c) => c.method !== 'GET'));
});

test('saveSection starts a file in the site’s repo, or locally when it has none', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sitelens-config-'));
  const gh = writableGitHub({});
  const cfg = createSiteConfig({ dir, repos: async () => ['me/web'], getToken: async () => 't', fetchImpl: gh.fetchImpl });
  const out = await cfg.saveSection(site, 'alerts', 'alerts: { traffic: { pct: 30 } }');
  assert.equal(out.saved, 'pr');
  const put = gh.calls.find((c) => c.method === 'PUT');
  assert.equal(put.path, '/repos/me/web/contents/.sitelens.yml');
  assert.equal(put.body.sha, undefined);
  assert.match(Buffer.from(put.body.content, 'base64').toString('utf8'), /^version: 1\nsite: shop.test\n\nalerts:/);

  const local = createSiteConfig({ dir, repos: async () => [], getToken: async () => '' });
  const saved = await local.saveSection(site, 'alerts', 'alerts: { traffic: { pct: 30 } }');
  assert.deepEqual(saved, { saved: 'local', path: join(dir, 'shop.test.yml') });
  assert.match(await readFile(saved.path, 'utf8'), /traffic/);
  assert.equal((await local.applied(site)).alerts.traffic.pct, 0.3);
  await assert.rejects(local.saveSection({ ...site, demo: true }, 'alerts', ''), /demo/);
});

test('metrics: a D1 source and a read-only query, or an error saying what’s wrong', () => {
  const db = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';
  const ok = parseSiteConfig(`version: 1
metrics:
  - label: Active installs
    summary: average
    d1: &db { account: ${'A'.repeat(32)}, database: ${db} }
    sql: SELECT date AS day, count(*) AS value FROM pings WHERE date >= {{start}} GROUP BY 1
  - label: New installs
    d1: *db
    sql: SELECT date AS day, sum(first_run) AS value FROM pings GROUP BY 1
`);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.config.metrics.length, 2);
  assert.deepEqual(ok.config.metrics[1].source, { type: 'd1', accountId: 'a'.repeat(32), databaseId: db });
  assert.equal(ok.config.metrics[0].summary, 'average');
  assert.equal(ok.config.metrics[1].summary, 'sum');

  const bad = parseSiteConfig(`version: 1
metrics:
  - { label: A, d1: { account: nope, database: ${db} }, sql: SELECT 1 AS day, 1 AS value }
  - { label: B, d1: { account: ${'a'.repeat(32)}, database: ${db} }, sql: DELETE FROM pings }
  - { label: C, sql: SELECT 1 AS day, 1 AS value }
  - { label: D, summary: median, d1: { account: ${'a'.repeat(32)}, database: ${db} }, sql: SELECT 1 AS day, 1 AS value }
`);
  assert.equal(bad.config, null);
  assert.match(bad.errors[0], /metrics\[0\]\.d1\.account/);
  assert.match(bad.errors[1], /metrics\[1\]\.sql: Only SELECT/);
  assert.match(bad.errors[2], /metrics\[2\] \(C\) needs exactly one source/);
  assert.match(bad.errors[3], /metrics\[3\]\.summary/);
});
