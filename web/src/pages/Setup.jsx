import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { ConfigFile } from '../next/ConfigFile.jsx';

// One site's setup: what it's connected to, and its .sitelens.yml (next/ConfigFile.jsx).
// See server/site-config.mjs.
export function Setup({ site, connections = true }) {
  const data = useAsync(() => (connections ? api.get(`/sites/${site.id}/setup`) : null), [site.id, connections]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  return (
    <>
      {connections && (data.data ? <Connections site={site} target={data.data.target} /> : <Loading height={160} />)}
      <ConfigFile site={site} />
    </>
  );
}

// Data sources, each with what it unlocks. Changing them stays in Settings,
// since they hold credentials.
function Connections({ site, target }) {
  const rows = site.demo
    ? [{ label: 'Everything', on: true, value: 'Built-in sample data' }]
    : [
      { label: 'Google Analytics', on: Boolean(site.propertyId), value: site.propertyId ? `Property ${site.propertyId}` : 'Needed for Overview, Pages and Arrive' },
      { label: 'Search Console', on: Boolean(site.searchSite), value: site.searchSite || 'Needed for Get found → Google and Demand' },
      { label: 'BigQuery export', on: Boolean(site.bq), value: site.bq ? `${site.bq.dataProject}.${site.bq.dataset}` : 'Unlocks Paths, Funnels, Retention, Events and Sessions' },
      { label: 'Code', on: target.type === 'repo', value: target.repo || 'No repo linked, so config is kept on this computer' },
    ];
  return (
    <Card title="Connections" sub="Where this site’s numbers come from"
      actions={!site.demo && <a class="btn ghost" href={`#/settings?tab=sites&edit=${site.id}`}>Edit connections</a>}>
      <ul class="checks">
        {rows.map((r) => (
          <li key={r.label} class={r.on ? 'ok' : ''}>
            <b>{r.label}</b> <span class={r.on ? '' : 'muted'}>· {r.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Where the file is kept: a GitHub file can be copied into Kauzl (changes then apply at once,
// no pull requests), and Kauzl's copy can be dropped to go back to the repo's.
export function FileHome({ site, file, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const local = file.source?.type === 'local';
  if (!file.found) return null;
  async function run() {
    if (local && !confirm('Delete Kauzl’s copy of the file? The repo’s .sitelens.yml applies again if there is one; otherwise Kauzl’s own settings do.')) return;
    setBusy(true);
    setMsg(null);
    try {
      if (local) await api.post(`/sites/${site.id}/config/local/remove`, {});
      else {
        const current = await api.get(`/sites/${site.id}/config`);
        await api.post(`/sites/${site.id}/config/local`, { yaml: current.text });
      }
      onSaved();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="row gap-8">
      <button class="btn" type="button" disabled={busy} onClick={run}>{local ? 'Use the repo’s file instead' : 'Keep it in Kauzl'}</button>
      <span class="muted small">{local ? 'Deletes Kauzl’s copy; the repo isn’t changed.' : 'Copies the file into Kauzl, so changes apply right away without pull requests.'}</span>
      {msg && <span class="small text-bad">{msg}</span>}
    </div>
  );
}

// Read the file from a GitHub link instead of the default branch: paste the
// link from the file's page on GitHub, on any branch (a deploy branch, say).
export function FileLink({ site, file, onSaved }) {
  const [link, setLink] = useState(file.link || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  async function save(next) {
    setBusy(true);
    setMsg(null);
    try {
      const out = await api.post(`/sites/${site.id}/config/link`, { link: next });
      setLink(next);
      setMsg(!next ? { ok: true, text: 'Back to the repo’s default branch.' } : out.found ? { ok: true, text: 'Read the linked file.' } : { ok: false, text: out.notes?.[0] || 'Couldn’t read that file.' });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div class="stack gap-6">
      {/* A row, not a form: this sits inside the site's Edit form, and Enter here must not save the site. */}
      <div class="row">
        <input type="url" style={{ flex: '1', minWidth: '240px', maxWidth: '560px' }} placeholder="https://github.com/you/repo/blob/branch/.sitelens.yml"
          value={link} onInput={(e) => setLink(e.currentTarget.value)} aria-label="Link to the .sitelens.yml on GitHub"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (link.trim() && link.trim() !== file.link) save(link.trim()); } }} />
        <button class="btn primary" type="button" disabled={busy || !link.trim() || link.trim() === file.link} onClick={() => save(link.trim())}>Use this file</button>
        {file.link && <button class="btn ghost" type="button" disabled={busy} onClick={() => save('')}>Use the default branch</button>}
      </div>
      <p class="note m-0">{file.link
        ? 'Reading the file at this link. Changes made here open a pull request into its branch.'
        : 'Kauzl reads the file from the default branch of the site’s repo. To use another branch, paste the file’s link from GitHub.'}</p>
      {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
    </div>
  );
}

export function SourceLink({ source }) {
  const text = source.type === 'repo' ? `${source.repo}/${source.path}${source.ref ? ` (${source.ref})` : ''}` : source.type === 'demo' ? 'the built-in demo file' : source.path;
  return source.url ? <a href={source.url} target="_blank" rel="noreferrer"><code>{text}</code></a> : <code>{text}</code>;
}

function Messages({ list, tone = '' }) {
  return (
    <ul class="note" style={{ margin: 0, paddingLeft: '18px', color: tone === 'bad' ? 'var(--critical-ink)' : undefined }}>
      {list.map((m) => <li key={m}>{m}</li>)}
    </ul>
  );
}
