// Chart annotations: dated markers drawn on every trend chart. They come from
// pluggable sources merged at read time:
//  - notes: written by hand, or by Claude (author 'claude', with a longer
//    body), stored in studio.json `annotations`;
//  - github: releases from .data/github.db (published, non-draft);
//  - cws: Web Store version changes seen in the daily listing snapshots;
//  - anything else via registerSource(name, fn) (e.g. Vercel deploys).
//
// Annotation: { id, date: 'YYYY-MM-DD', label, kind, source, url?, scope?, body?, author?, via?, model?, createdAt? }
//   kind: 'release' | 'extension' | 'deploy' | 'note' | 'claude' | 'alert'
//   scope: 'site:<id>' | 'repo:<owner/name>' | 'ext:<id>'; no scope = global.

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { ValidationError } from './store.mjs';

export const ANNOTATION_KINDS = ['release', 'extension', 'deploy', 'note', 'claude', 'alert', 'mention', 'post'];
export const NOTE_AUTHORS = ['you', 'claude'];
const BODY_MAX = 4000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SCOPE = /^(site|repo|ext):[\w.\-/]{1,120}$/;

export function createAnnotations({ store, githubDbPath = () => null, extensions = null, log = console }) {
  const sources = new Map();

  function registerSource(name, fn) {
    sources.set(name, fn);
  }

  registerSource('notes', async () => ((await store.get()).annotations || []).map((n) => ({ ...n, kind: n.author === 'claude' ? 'claude' : 'note', source: 'notes' })));
  registerSource('github', async ({ from, to }) => githubReleases(githubDbPath(), { from, to }));
  registerSource('cws', async () => extensionVersions(extensions ? await extensions.list() : (await store.get()).extensions || []));

  async function list({ from = '', to = '', scopes = null, author = '' } = {}) {
    if (author) {
      const notes = ((await store.get()).annotations || []).filter((n) => (n.author || 'you') === author)
        .map((n) => ({ ...n, kind: n.author === 'claude' ? 'claude' : 'note', source: 'notes' }));
      return filterAnnotations(notes, { from, to, scopes });
    }
    const results = await Promise.all([...sources].map(async ([name, fn]) => {
      try {
        return (await fn({ from, to, scopes })) || [];
      } catch (err) {
        // One broken source (no github.db, an expired token…) never blanks the rest.
        log.warn?.(`  Annotation source ${name} failed: ${err.message}`);
        return [];
      }
    }));
    return filterAnnotations(results.flat(), { from, to, scopes });
  }

  async function addNote(input = {}) {
    const date = String(input.date || '').trim();
    const label = String(input.label || '').trim().slice(0, 140);
    const scope = String(input.scope || '').trim();
    const author = String(input.author || 'you');
    const body = String(input.body || '').trim();
    if (!NOTE_AUTHORS.includes(author)) throw new ValidationError(`Author must be one of: ${NOTE_AUTHORS.join(', ')}.`);
    if (body.length > BODY_MAX) throw new ValidationError(`Keep the write-up under ${BODY_MAX} characters.`);
    if (!DATE.test(date) || Number.isNaN(Date.parse(date))) throw new ValidationError('Pick a date (YYYY-MM-DD).');
    if (!label) throw new ValidationError('Write a short note.');
    if (scope && !SCOPE.test(scope)) throw new ValidationError('Scope must look like site:<id>, repo:<owner/name> or ext:<id>.');
    const note = {
      id: `note-${randomUUID().slice(0, 8)}`, date, label, kind: author === 'claude' ? 'claude' : 'note', source: 'notes',
      ...(scope ? { scope } : {}),
      ...(author === 'claude' ? { author, body, via: input.via === 'app' ? 'app' : 'mcp', createdAt: new Date().toISOString(), ...(input.model ? { model: String(input.model).slice(0, 60) } : {}) } : body ? { body } : {}),
    };
    await store.update((s) => {
      s.annotations = [...(s.annotations || []), note];
    });
    return note;
  }

  // `author` limits which notes may go, so Claude can only delete its own.
  async function removeNote(id, { author = '' } = {}) {
    let found = false;
    await store.update((s) => {
      const before = (s.annotations || []).length;
      s.annotations = (s.annotations || []).filter((n) => n.id !== id || (author && (n.author || 'you') !== author));
      found = s.annotations.length < before;
    });
    if (!found) throw new ValidationError('Only notes can be deleted, and that one no longer exists.');
  }

  return { list, registerSource, addNote, removeNote };
}

// Keeps annotations inside [from, to] whose scope is one of `scopes` (globals
// always pass). No scopes = everything. Sorted by date, then label.
export function filterAnnotations(items, { from = '', to = '', scopes = null } = {}) {
  const wanted = scopes?.length ? new Set(scopes) : null;
  const seen = new Set();
  return items
    .filter((a) => a && DATE.test(a.date) && a.label)
    .filter((a) => (!from || a.date >= from) && (!to || a.date <= to))
    .filter((a) => !wanted || !a.scope || wanted.has(a.scope))
    .filter((a) => (seen.has(a.id) ? false : seen.add(a.id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

export function githubReleases(path, { from = '', to = '' } = {}) {
  if (!path || !existsSync(path)) return [];
  const db = new DatabaseSync(path, { readOnly: true, timeout: 3000 });
  try {
    const rows = db.prepare(`
      SELECT r.name AS repo, rel.id, rel.tag_name, rel.name, substr(rel.published_at, 1, 10) AS date, rel.prerelease
      FROM releases rel JOIN repos r ON r.id = rel.repo_id
      WHERE rel.draft = 0 AND rel.published_at IS NOT NULL AND r.hidden = 0
        AND substr(rel.published_at, 1, 10) BETWEEN ? AND ?
    `).all(from || '0000-00-00', to || '9999-99-99');
    return rows.map((r) => ({
      id: `gh-${r.repo}-${r.id}`,
      date: r.date,
      label: `${r.repo.split('/').pop()} ${r.tag_name}${r.prerelease ? ' (pre-release)' : ''}`,
      kind: 'release',
      source: 'github',
      url: `https://github.com/${r.repo}/releases/tag/${encodeURIComponent(r.tag_name)}`,
      scope: `repo:${r.repo}`,
    }));
  } finally {
    db.close();
  }
}

// A version change is the first snapshot day showing a new version; the first
// snapshot is a baseline, not a release.
export function extensionVersions(list) {
  const out = [];
  for (const ext of list) {
    let prev = null;
    for (const point of ext.history || []) {
      if (!point.version) continue;
      if (prev && point.version !== prev) {
        out.push({
          id: `cws-${ext.id}-${point.version}`,
          date: point.date,
          label: `${ext.label || ext.title || 'Extension'} v${point.version}`,
          kind: 'extension',
          source: 'cws',
          url: `https://chromewebstore.google.com/detail/${ext.id}`,
          scope: `ext:${ext.id}`,
        });
      }
      prev = point.version;
    }
  }
  return out;
}

export function annotationRoutes({ annotations }) {
  return [
    ['GET', /^\/api\/annotations$/, async ({ query }) => {
      const scopes = (query.get('scope') || '').split(',').map((s) => s.trim()).filter(Boolean);
      return { annotations: await annotations.list({ from: query.get('from') || '', to: query.get('to') || '', scopes: scopes.length ? scopes : null, author: query.get('author') || '' }) };
    }],
    ['POST', /^\/api\/annotations$/, async ({ body }) => annotations.addNote(body)],
    ['DELETE', /^\/api\/annotations\/([\w-]+)$/, async ({ match, query }) => {
      await annotations.removeNote(match[1], { author: query?.get('author') || '' });
      return { ok: true };
    }],
  ];
}
