// A page's timeline: everything that happened to one page, as dated events, ending in "Now".
// This module is where the page flow's rules live (docs/redesign/prototype.html shows the design;
// the plan doc's "Events on a page's timeline" lists the kinds). The UI only draws what it returns.
//
// The loop is Notice → Explain → Act → Check, and every event is one step of it:
//   change   you (or an agent) changed the page: a commit, a title, an edit made in Kauzl. Carries a diff.
//   spike    visits jumped well above usual. Posted by Kauzl.
//   check    a Diagnose run (content, speed, index, bots, AI answers). Posted only when it says something new.
//   mark     a dated note from the calendar that names this page (a post, a deploy, a mention…).
//   todo     a to-do about this page moved a stage.
//
// The rules (each one is tested in test/page-events.test.js):
//   1. A title says what's new, never who did it ("Speed test: 4.4 s", not "You ran a speed test").
//      Who did it is `who`; the UI shows it as the sender.
//   2. One event per thing per day: same track + kind + day keeps the first.
//   3. A check whose `key` equals the previous check on the same track becomes
//      "<Tool>: no change" · "Still <key>, as on <date>", tone muted, quiet: true (the UI folds quiet events).
//   4. Every event carries one attachment, its proof: the 4-week series around the day (marked), up to
//      3 number cells, up to 4 findings, and for a change, the diff.
//   5. "Now" is the page's open to-do, with its stage (open → proposed → changed → live → checked),
//      the events that led to it, and the proposal as a diff (was → to) in the same shape as a change.
//
// Event: { id, date, who, kind, track, title, detail, tone, quiet, key?, attachment }
// Attachment: { title, cells: [{ label, value, note, tone }], findings: [{ sev, text, note }], diff?, series? }
// Diff: { where, src, url?, prose?, additions, deletions, lines: [[op, text]] }  op: '-', '+', ' ', '…'

const DAY = 86_400_000;
export const TRACKS = ['goals', 'search', 'content', 'speed', 'index', 'ai', 'visitors', 'work'];
export const STAGES = ['open', 'proposed', 'changed', 'live', 'checked'];
const CHECK_NAMES = { content: 'Content check', speed: 'Speed test', index: 'Index status', bots: 'As Googlebot and GPTBot', ai: 'AI answers' };
const CHECK_TRACK = { content: 'content', speed: 'speed', index: 'index', bots: 'index', ai: 'ai' };
const LIVE_DAYS = 21; // how long a done to-do is "live · checking" before it's judged

export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const lines = (n) => `${fmt(n)} line${n === 1 ? '' : 's'}`;
const dayLabel = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

// GitHub's unified patch for one file → diff lines, keeping the changed lines and one line of context
// around them, and collapsing the rest into '…' rows. Long patches are cut at `max` lines.
export function parsePatch(patch, { max = 14 } = {}) {
  const raw = String(patch || '').split('\n').filter((l) => !l.startsWith('\\ No newline'));
  const rows = [];
  for (const l of raw) {
    if (l.startsWith('@@')) { rows.push(['@', '']); continue; }
    const op = l[0] === '+' ? '+' : l[0] === '-' ? '-' : ' ';
    rows.push([op, l.slice(1)]);
  }
  const near = (i) => [i - 1, i, i + 1].some((j) => rows[j] && (rows[j][0] === '+' || rows[j][0] === '-'));
  const out = [];
  let skipped = 0;
  rows.forEach(([op, t], i) => {
    if (op === '@' || (op === ' ' && !near(i))) { if (op === ' ') skipped++; return; }
    if (skipped && out.length) out.push(['…', `${skipped} unchanged line${skipped > 1 ? 's' : ''}`]);
    skipped = 0;
    out.push([op, t]);
  });
  const added = rows.filter((r) => r[0] === '+').length, removed = rows.filter((r) => r[0] === '-').length;
  if (out.length > max) {
    const cut = out.length - max + 1;
    out.length = max - 1;
    out.push(['…', `${cut} more line${cut > 1 ? 's' : ''}`]);
  }
  return { lines: out, additions: added, deletions: removed };
}

// The 4-week window an attachment charts: ends 10 days after the event, or today if that's sooner.
export function seriesWindow(series, date, today, metric = 'visits') {
  const end = addDays(date, 10) < today ? addDays(date, 10) : today;
  const from = addDays(end, -27);
  const by = new Map((series || []).map((r) => [r.date, r]));
  const days = [];
  for (let d = from; d <= end; d = addDays(d, 1)) days.push(by.get(d)?.[metric] ?? 0);
  return { from, to: end, metric, mark: date, days };
}

// Visits in the n days after a day against the n days before it. null if there aren't enough days yet.
export function effectOf(series, date, today, { metric = 'visits', days = 14 } = {}) {
  const after = Math.min(days, Math.floor((Date.parse(today) - Date.parse(date)) / DAY));
  if (after < 3) return null;
  const by = new Map((series || []).map((r) => [r.date, r[metric] || 0]));
  const sum = (start, n) => Array.from({ length: n }, (_, i) => by.get(addDays(start, i)) || 0).reduce((a, b) => a + b, 0);
  const before = sum(addDays(date, -after), after), now = sum(addDays(date, 1), after);
  if (before + now < 10) return null;
  return { days: after, before, after: now, change: before ? (now - before) / before : null };
}

const effectCell = (e, metric) => {
  if (!e) return { label: 'After the change', value: 'Too soon', note: 'needs 3 days', tone: 'muted' };
  const pct = e.change == null ? null : Math.round(e.change * 100);
  return {
    label: `${e.days} days after`, value: pct == null ? fmt(e.after) : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`,
    note: `${fmt(e.after)} ${metric} against ${fmt(e.before)} before`, tone: pct == null ? '' : pct >= 10 ? 'up' : pct <= -10 ? 'down' : 'muted',
  };
};

/* --- producers: one per kind; each turns raw data into events --- */

export function changeEvents({ commits = [], edits = [], series, today }) {
  const fromCommits = commits.filter((c) => c.date).map((c) => {
    const d = parsePatch(c.patch);
    const e = effectOf(series, c.date, today);
    return {
      badge: c.status === 'added' ? 'New' : `+${c.additions ?? d.additions} −${c.deletions ?? d.deletions}`,
      id: `change:${c.sha.slice(0, 7)}`, date: c.date, who: /\[bot\]|claude|cursor/i.test(c.author) ? 'agent' : 'you', kind: 'change', track: 'work',
      title: c.status === 'added' ? 'Published' : c.message || 'Changed the page',
      detail: c.status === 'added' ? `${lines(c.additions ?? d.additions)} in ${c.file.split('/').pop()} · ${c.message}` : `${lines(c.additions ?? d.additions)} added, ${c.deletions ?? d.deletions} removed in ${c.file.split('/').pop()}`,
      tone: e && e.change != null ? (e.change >= 0.1 ? 'up' : e.change <= -0.1 ? 'down' : '') : '',
      attachment: {
        title: 'The change',
        diff: { where: c.file, src: `commit ${c.sha.slice(0, 7)}`, url: c.url, additions: c.additions ?? d.additions, deletions: c.deletions ?? d.deletions, lines: d.lines },
        cells: [effectCell(e, 'visits')], findings: [],
        series: seriesWindow(series, c.date, today),
      },
    };
  });
  const fromEdits = edits.filter((u) => u.date).map((u, i) => {
    const e = effectOf(series, u.date, today);
    const diff = u.before != null || u.after != null
      ? { where: u.field || 'The page', src: 'edited in Kauzl', prose: true, additions: u.after ? 1 : 0, deletions: u.before ? 1 : 0, lines: [...(u.before ? [['-', u.before]] : []), ...(u.after ? [['+', u.after]] : [])] }
      : null;
    return {
      badge: 'Edit', id: `edit:${u.date}:${i}`, date: u.date, who: 'you', kind: 'change', track: 'work',
      title: u.label || 'Edited in Kauzl', detail: u.after ? `Now: “${u.after}”` : '', tone: '',
      attachment: { title: 'The change', diff, cells: [effectCell(e, 'visits')], findings: [], series: seriesWindow(series, u.date, today) },
    };
  });
  return [...fromCommits, ...fromEdits];
}

// A day with at least 2.5× the median of the 14 days before it, and at least 10 visits.
export function spikeEvents({ series = [], today, factor = 2.5, min = 10 }) {
  const out = [];
  series.forEach((r, i) => {
    if (i < 7) return;
    const usual = median(series.slice(Math.max(0, i - 14), i).map((x) => x.visits || 0));
    if ((r.visits || 0) < min || r.visits < usual * factor) return;
    const x = usual ? r.visits / usual : null;
    const prev = out.at(-1);
    if (prev && Date.parse(r.date) - Date.parse(prev.lastDate) <= 2 * DAY) {
      // A run of busy days is one event: the first day's, with the run counted in it.
      prev.lastDate = r.date;
      prev.run += 1;
      prev.detail = `${prev.firstDetail} Still above usual for ${prev.run} days, to ${dayLabel(r.date)}.`;
      return;
    }
    out.push({ lastDate: r.date, run: 1, firstDetail: `${fmt(r.visits)} visits; usually ${fmt(usual)}.`, badge: x ? `${x.toFixed(1)}×` : `${fmt(r.visits)}`, size: x ? Math.min(1, (x - 2) / 6) : 0.5,
      id: `spike:${r.date}`, date: r.date, who: 'kauzl', kind: 'spike', track: 'visitors',
      title: x ? `Visits spiked to ${x.toFixed(1)}× usual` : `${fmt(r.visits)} visits, from almost none`,
      detail: `${fmt(r.visits)} visits; usually ${fmt(usual)}.`, tone: 'up',
      attachment: {
        title: 'Visits that day',
        cells: [{ label: 'Visits', value: fmt(r.visits), note: `usually ${fmt(usual)}`, tone: 'up' }, ...(r.signups != null ? [{ label: 'Signed up', value: fmt(r.signups), note: '', tone: '' }] : [])],
        findings: (r.sources || []).slice(0, 4).map((s) => ({ sev: '', text: `${s.name} · ${fmt(s.visits)}`, note: 'visits' })),
        series: seriesWindow(series, r.date, today),
      },
    });
  });
  return out.map(({ lastDate, run, firstDetail, ...e }) => e);
}

// A check's result in a word or two, for the row's badge.
function checkBadge(c) {
  const k = String(c.key ?? '');
  if (c.tool === 'index') return /^Shown \/ Shown$/.test(k) ? 'Shown' : k.split(' / ')[0] || 'Checked';
  if (c.tool === 'bots') return /couldn|HTTP|stay away/i.test(k) ? 'Blocked' : (k.split(' / ')[0] || '').replace(' words', ' w');
  const n = /^(\d+) problems?$/.exec(k);
  if (n) return `${n[1]} ${n[1] === '1' ? 'issue' : 'issues'}`;
  return k.length <= 12 ? k : (c.headline || '').split(/[·:]/)[0].trim().slice(0, 12);
}

// Diagnose runs. check: { date, tool, by: 'you' | 'nightly', key, headline, cells, findings }
// `key` is what decides "no change": the run's main reading as a short string ("4.4 s", "2 problems").
export function checkEvents({ checks = [], series, today }) {
  // Run twice on one day: the later run is the day's answer (rule 2 keeps one per day).
  const latest = new Map();
  for (const c of checks) latest.set(`${c.tool}|${c.date}`, c);
  return [...latest.values()].map((c, i) => ({
    id: `check:${c.tool}:${c.date}:${i}`, date: c.date, who: c.by === 'you' ? 'you' : 'kauzl', kind: 'check', track: CHECK_TRACK[c.tool] || 'content',
    tool: c.tool, key: c.key ?? null, badge: checkBadge(c),
    title: `${CHECK_NAMES[c.tool] || c.tool}: ${c.headline || c.key || 'done'}`,
    detail: c.detail || (c.by === 'you' ? 'You ran it.' : 'Found in the nightly run.'), tone: c.tone || '',
    attachment: { title: `${CHECK_NAMES[c.tool] || c.tool} result`, cells: (c.cells || []).slice(0, 3), findings: (c.findings || []).slice(0, 12), series: c.tool === 'speed' ? null : seriesWindow(series, c.date, today) },
  }));
}

// "Page trial: /x" → "Page trial started"; "Posted /x on Reddit" stays as written.
const markTitle = (label, path) => {
  const m = /^([^:]{1,30}):\s*(.*)$/.exec(String(label || ''));
  if (!m) return String(label || '') || 'Note';
  const rest = m[2].trim();
  if (!rest || rest === path || rest.replace(/\/$/, '') === path) return /trial/i.test(m[1]) ? `${m[1]} started` : m[1];
  return rest;
};
// When Google and Bing last read the page, from their own answers (search-hub.indexStatus):
// Google's last crawl with whether it's indexed, Bing's first sighting and last crawl. A crawl
// after one of your changes says the engine now has the new version.
// index: { google: { indexed, coverage, lastCrawled, link }, bing: { known, discovered, lastCrawled } }
export function crawlEvents({ index, changes = [], from = '', today, series }) {
  if (!index) return [];
  const g = index.google || {}, b = index.bing || {};
  const since = (d) => {
    const c = changes.filter((x) => x.date < d).sort((x, y) => y.date.localeCompare(x.date))[0];
    return c ? { c, first: !changes.some((x) => x.date > c.date && x.date < d) } : null;
  };
  const sinceLine = (d, who) => {
    const s = since(d);
    return s ? `The first crawl since your ${dayLabel(s.c.date)} change: ${who} now has the new version.` : '';
  };
  const out = [];
  // Kauzl asked the engine (URL inspection / URL info) at `at`: the event says so, and when.
  const asked = (at, who) => (at ? { by: 'kauzl', at, engine: who } : null);
  const askedCell = (at) => (at ? [{ label: 'Asked by Kauzl', value: new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }), note: 'UTC · it rechecks every few hours', tone: '' }] : []);
  const ev = (id, date, who, title, detail, tone, cells, findings, badge, at) => out.push({
    id, date, who, kind: 'crawl', track: 'index', title, detail, tone, badge, via: asked(at, who),
    attachment: { title: `What ${who === 'google' ? 'Google' : 'Bing'} said`, cells: [...cells, ...askedCell(at)].slice(0, 3), findings, series: null },
  });
  if (g.lastCrawled && !g.note) {
    const shown = g.indexed;
    ev(`crawl:google:${g.lastCrawled}`, g.lastCrawled, 'google', `Google crawled it: ${shown ? 'indexed' : String(g.coverage || 'not indexed').toLowerCase()}`,
      sinceLine(g.lastCrawled, 'Google') || (shown ? 'It can show in Google’s results.' : 'It isn’t in Google’s results.'), shown ? 'up' : 'down',
      [{ label: 'Google', value: shown ? 'Indexed' : 'Not indexed', note: g.coverage || '', tone: shown ? 'up' : 'down' }, { label: 'Crawled', value: dayLabel(g.lastCrawled), note: 'last time Google read it', tone: '' }],
      g.link ? [{ sev: '', text: 'Google’s full answer, in Search Console', note: g.link }] : [], shown ? 'Indexed' : 'Not indexed', g.at);
  }
  if (b.known && b.discovered && !b.note) ev(`crawl:bing-found:${b.discovered}`, b.discovered, 'bing', 'Bing found it', 'Bing knows the page exists; it shows in Bing once crawled.', '', [{ label: 'Found', value: dayLabel(b.discovered), note: '', tone: '' }], [], 'Found', b.at);
  if (b.known && b.lastCrawled && !b.note && b.lastCrawled !== b.discovered) {
    ev(`crawl:bing:${b.lastCrawled}`, b.lastCrawled, 'bing', 'Bing crawled it', sinceLine(b.lastCrawled, 'Bing') || 'It can show in Bing’s results.', 'up',
      [{ label: 'Bing', value: 'Crawled', note: b.httpStatus ? `HTTP ${b.httpStatus}` : '', tone: 'up' }, { label: 'Crawled', value: dayLabel(b.lastCrawled), note: 'last time Bing read it', tone: '' }], [], 'Crawled', b.at);
  }
  return out.filter((e) => (!from || e.date >= from) && e.date <= today);
}

// Calendar notes that name the page (by path or by its source file).
export function markEvents({ marks = [], path, file = '', series, today }) {
  const names = (t) => path !== '/' && (String(t || '').includes(path) || (file && String(t || '').includes(file)));
  return marks.filter((m) => m.date && (names(m.label) || names(m.url))).map((m) => (/^Article update: /.test(m.label || '') ? {
    // An edit made in Kauzl's article editor: a change, not a note.
    badge: 'Edit', id: `mark:${m.id || m.date}`, date: m.date, who: 'you', kind: 'change', track: 'work', title: 'Edited in Kauzl', detail: m.body ? String(m.body).split('\n')[0].slice(0, 200) : '', tone: '',
    attachment: { title: 'The change', cells: [effectCell(effectOf(series, m.date, today), 'visits')], findings: [], series: seriesWindow(series, m.date, today) },
  } : {
    badge: /trial/i.test(m.label || '') ? 'Trial' : 'Note', id: `mark:${m.id || m.date}`, date: m.date, who: m.kind === 'claude' ? 'claude' : m.source === 'github' ? 'you' : m.author === 'claude' ? 'claude' : 'you',
    kind: 'mark', track: m.kind === 'post' || m.kind === 'mention' ? 'visitors' : 'work',
    title: markTitle(m.label, path), detail: m.body ? String(m.body).split('\n')[0].slice(0, 200) : '', tone: '',
    attachment: { title: 'The note', cells: [], findings: m.url ? [{ sev: '', text: m.url, note: 'link' }] : [], series: seriesWindow(series, m.date, today) },
  }));
}

// A to-do's stage, from what's recorded on it.
export function stageOf(t, today) {
  if (t.status === 'done') {
    const done = new Date(t.doneAt || t.createdAt).toISOString().slice(0, 10);
    return addDays(done, LIVE_DAYS) <= today ? 'checked' : 'live';
  }
  const entries = t.entries || [];
  if (entries.some((e) => e.changes && /merged|published|pushed|deployed/i.test(e.changes))) return 'changed';
  if (entries.some((e) => e.changes)) return 'proposed';
  return 'open';
}

// On the page's own timeline, a to-do title needn't name the page: "Fix X (/blog/x)" → "Fix X".
const bare = (title, path) => (path ? String(title).replace(` (${path})`, '').replace(new RegExp(`\\s*[:·—-]?\\s*${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '') : String(title)) || String(title);

export function todoEvents({ todos = [], path = '', today }) {
  return todos.flatMap((t) => {
    const title = bare(t.title, path);
    const made = new Date(t.createdAt).toISOString().slice(0, 10);
    const out = [{ badge: 'To-do', id: `todo:${t.id}:open`, date: made, who: t.from ? 'kauzl' : 'you', kind: 'todo', track: 'work', todo: t.id, title: `To-do: ${title}`, detail: t.detail ? String(t.detail).split('\n')[0].slice(0, 200) : '', tone: '', attachment: { title: 'The to-do', cells: [], findings: [], series: null } }];
    for (const e of t.entries || []) {
      if (!e.changes) continue;
      const d = new Date(e.at).toISOString().slice(0, 10);
      out.push({ badge: 'Proposed', id: `todo:${t.id}:${e.id}`, date: d, who: e.author === 'claude' ? 'agent' : 'you', kind: 'todo', track: 'work', todo: t.id,
        title: `Proposed: ${String(e.changes).split('\n')[0].slice(0, 140)}`, detail: e.expected ? `Expected: ${String(e.expected).split('\n')[0].slice(0, 160)}` : '', tone: '',
        attachment: { title: 'The proposal', cells: [], findings: [...(e.summary ? [{ sev: '', text: String(e.summary).slice(0, 200), note: 'found' }] : []), ...(e.expected ? [{ sev: '', text: String(e.expected).slice(0, 200), note: 'expected' }] : [])], series: null } });
    }
    if (t.status === 'done' && t.doneAt) {
      const d = new Date(t.doneAt).toISOString().slice(0, 10);
      out.push({ badge: 'Done', id: `todo:${t.id}:done`, date: d, who: 'you', kind: 'todo', track: 'work', todo: t.id, title: `Done: ${title}`, detail: `Kauzl checks it on ${dayLabel(addDays(d, LIVE_DAYS))}.`, tone: 'up', attachment: { title: 'The to-do', cells: [], findings: [], series: null } });
    }
    return out;
  });
}

/* --- the rules applied to all events --- */

// Rule 2: one event per thing per day.
export function onePerDay(events) {
  const seen = new Set();
  return events.filter((e) => {
    const k = `${e.track}|${e.kind}|${e.date}|${e.kind === 'change' || e.kind === 'todo' ? e.id : e.tool || ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Rule 3: a check that repeats the last one on its track says so, and folds.
export function foldRepeats(events) {
  const last = new Map();
  return [...events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => {
    if (e.kind !== 'check' || e.key == null) return e;
    // The same check only: two checks can share a track (index status and the bot fetch both sit under Index).
    const k = `${e.track}|${e.tool || ''}`;
    const prev = last.get(k);
    last.set(k, e);
    if (!prev) return e;
    if (String(prev.key) !== String(e.key)) return { ...e, detail: `Was ${prev.key} on ${dayLabel(prev.date)}. ${e.detail || ''}`.trim(), changed: true };
    const name = CHECK_NAMES[e.tool] || e.tool;
    return { ...e, title: `${name}: no change`, detail: `Still ${e.key}, as on ${dayLabel(prev.date)}.`, tone: 'muted', quiet: true, badge: 'Same' };
  });
}

// Rule 5: Now. The page's open to-do (or the most recent live one), with the events that led to it.
export function nowOf({ todos = [], events, path = '', today }) {
  const open = todos.filter((t) => t.status === 'open');
  const t = open[0] || todos.find((x) => stageOf(x, today) === 'live');
  if (!t) return null;
  const stage = stageOf(t, today);
  const made = new Date(t.createdAt).toISOString().slice(0, 10);
  // What led to it: the non-quiet, non-to-do events in the 3 weeks before it was made, most recent first.
  const because = events.filter((e) => !e.quiet && e.kind !== 'todo' && e.date <= made && e.date >= addDays(made, -21)).slice(-3).reverse().map((e) => e.id);
  const proposal = [...(t.entries || [])].reverse().find((e) => e.changes);
  // A proposal's was → to is text (a title, a lead…); a goal to-do's baseline holds numbers, which aren't a diff.
  const text = (v) => (typeof v === 'string' && v.trim() ? v : null);
  const was = text(t.baseline?.was), to = text(t.baseline?.to);
  return {
    todo: t.id, title: bare(t.title, path), detail: t.detail || '', stage, stages: STAGES, because,
    diff: was != null || to != null ? { where: t.baseline?.where || 'The page', src: stage === 'proposed' ? 'proposed · needs your OK' : 'Kauzl suggests', prose: true, additions: to ? 1 : 0, deletions: was ? 1 : 0, lines: [...(was ? [['-', was]] : []), ...(to ? [['+', to]] : [])] } : null,
    proposal: proposal ? { by: proposal.author === 'claude' ? 'agent' : 'you', changes: proposal.changes, expected: proposal.expected || '' } : null,
    more: open.slice(1, 6).map((x) => ({ todo: x.id, title: bare(x.title, path) })),
  };
}

// Everything above, in order. Inputs are plain data so this stays pure and testable.
export function buildTimeline({ path, file = '', today, from = '', series = [], commits = [], edits = [], checks = [], marks = [], todos = [], index = null }) {
  const changes = changeEvents({ commits, edits, series, today });
  const all = [
    ...changes,
    ...crawlEvents({ index, changes, from, today, series }),
    ...spikeEvents({ series, today }),
    ...checkEvents({ checks, series, today }),
    ...markEvents({ marks, path, file, series, today }),
    ...todoEvents({ todos, path, today }),
  ];
  const events = foldRepeats(onePerDay(all.sort((a, b) => a.date.localeCompare(b.date))));
  const counts = Object.fromEntries(TRACKS.map((k) => [k, events.filter((e) => e.track === k && !e.quiet).length]));
  return { path, today, events, quiet: events.filter((e) => e.quiet).length, tracks: counts, now: nowOf({ todos, events, path, today }) };
}

// Is this to-do about this page? Compares the exact page, never a substring: the home
// page "/" is inside every link, so a loose match put every to-do on it.
export function todoIsFor(t, path) {
  if (t.subject?.kind === 'page') return t.subject.key === path;
  const from = String(t.from || '').split(':');
  if (from.length >= 2 && from[1].startsWith('/')) return from[1] === path;
  const m = /[?&](?:article|path)=([^&#]+)/.exec(String(t.link || ''));
  if (m) {
    try { return decodeURIComponent(m[1]) === path; } catch { return false; }
  }
  return path !== '/' && String(t.title || '').endsWith(`(${path})`);
}

/* --- gathering: real data in, timeline out --- */

// sources: { series(site, path, from, to), commits(site, path, since), edits(site, path), marks(site, from, to),
//            todos(site, path), checks(site, path, since) }. Each may fail on its own; the timeline says which did.
export function createPageEvents({ sources, today = () => new Date().toLocaleDateString('en-CA') }) {
  async function timeline(site, path, { days = 90 } = {}) {
    const to = today(), from = addDays(to, -(days - 1));
    const names = ['series', 'commits', 'edits', 'marks', 'todos', 'checks', 'index'];
    const calls = {
      series: () => sources.series?.(site, path, from, to), commits: () => sources.commits?.(site, path, from), edits: () => sources.edits?.(site, path),
      marks: () => sources.marks?.(site, from, to), todos: () => sources.todos?.(site, path), checks: () => sources.checks?.(site, path, from),
      index: () => sources.index?.(site, path),
    };
    const got = await Promise.allSettled(names.map((n) => Promise.resolve().then(calls[n])));
    const data = {}, notes = {};
    got.forEach((r, i) => {
      const n = names[i];
      if (r.status === 'fulfilled') data[n] = r.value?.[n] ?? r.value ?? [];
      else { data[n] = []; notes[n] = r.reason?.message || String(r.reason); }
      if (r.status === 'fulfilled' && r.value?.note) notes[n] = r.value.note;
    });
    // An engine that didn't answer leaves its crawl out: say so rather than show nothing.
    for (const [k, name] of [['google', 'Google'], ['bing', 'Bing']]) {
      const n = data.index?.[k]?.note;
      if (n && !/sample site|Pick a Search Console|isn’t in your Bing/i.test(n)) notes[k] = `${name} didn’t answer this time (${n.replace(/\.$/, '')}), so its last crawl isn’t shown. It’s asked again on the next load.`;
    }
    const file = data.commits?.[0]?.file || '';
    const out = buildTimeline({ path, file, today: to, from, ...data, index: Array.isArray(data.index) ? null : data.index, edits: (data.edits || []).filter((u) => u.date >= from), marks: data.marks || [] });
    return { ...out, from, notes };
  }
  return { timeline };
}

export function pageEventRoutes({ pageEvents, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/page-timeline$/, async ({ match, query }) => pageEvents.timeline(await siteOr404(match[1]), query.get('path') || '/', { days: Math.min(180, Math.max(28, Number(query.get('days')) || 90)) })],
  ];
}
