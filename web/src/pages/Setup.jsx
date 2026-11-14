import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

// One site's setup, in one place: what it's connected to, and what Studio
// measures for it. Each part of the second comes from one of three places,
// shown on its row: the .sitelens.yml in the site's repo (changed by pull
// request, so it moves with the code), Studio's own settings, or Studio's
// guesses until either is set. See server/site-config.mjs.
const SECTIONS = {
  goals: { label: 'Goals', why: 'What counts as a result. Pay off measures these, and the ones marked alert are watched.' },
  funnels: { label: 'Funnels', why: 'The steps to a result. Engage → Funnels opens the first one.' },
  search: { label: 'Search & AI answers', why: 'Your brand, competitors and topics. They group search queries, check AI answers and find mentions.' },
  alerts: { label: 'Alert thresholds', why: 'How big a swing in traffic or search clicks raises an alert.' },
};

const FROM = {
  file: { chip: 'good', text: 'In repo file' },
  studio: { chip: '', text: 'Set in Kauzl' },
  auto: { chip: '', text: 'Kauzl’s guess' },
};

export function Setup({ site, connections = true }) {
  const [fresh, setFresh] = useState(0);
  const data = useAsync(() => api.get(`/sites/${site.id}/setup${qs({ fresh: fresh ? 1 : undefined })}`), [site.id, fresh]);
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={160} /><Loading height={320} /></>;
  const { file, target, sections } = data.data;

  return (
    <>
      {connections && <Connections site={site} target={target} />}
      <Card title="What Kauzl measures" sub="Goals, funnels, search and alerts"
        actions={!site.demo && <button class="btn ghost" type="button" disabled={data.loading} onClick={() => setFresh(fresh + 1)}><Icon name="refresh" size={13} /> Reload</button>}>
        <div class="stack gap-10">
          <p class="note m-0"><FileLine site={site} file={file} target={target} /></p>
          {file.errors?.length > 0 && <Messages list={['The file has errors, so none of it applies until they’re fixed:', ...file.errors]} tone="bad" />}
          {file.warnings?.length > 0 && <Messages list={file.warnings} />}
          {sections.map((s) => <Section key={s.key} site={site} section={s} target={target} onSaved={() => setFresh(fresh + 1)} />)}
        </div>
      </Card>
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

function FileLine({ site, file, target }) {
  if (site.demo) return 'The demo site reads a built-in file, so nothing here can be changed.';
  if (file.found) return <>Parts marked <b>In repo file</b> come from <SourceLink source={file.source} /> and change by pull request. The rest is set here.</>;
  return target.type === 'repo'
    ? <>All set here in Kauzl. Any part can move into <code>{target.repo}</code> as <code>{target.path}</code>, so it changes with the code.</>
    : 'All set here in Kauzl.';
}

function Section({ site, section, target, onSaved }) {
  const meta = SECTIONS[section.key];
  const from = FROM[section.from];
  const [editing, setEditing] = useState(null); // the YAML being edited, once loaded
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const inFile = section.from === 'file';
  const toRepo = target.type === 'repo';

  async function startFile() {
    setMsg(null);
    if (section.draft) return setEditing(section.draft);
    setBusy(true);
    try {
      const draft = await api.get(`/sites/${site.id}/config/draft${qs({ keys: section.key })}`);
      setEditing(draft.yaml || `${section.key}:\n`);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      const out = await api.post(`/sites/${site.id}/config/section`, { key: section.key, yaml: editing });
      setEditing(null);
      if (out.saved === 'pr') {
        setMsg({ ok: true, text: <>Opened <a href={out.url} target="_blank" rel="noreferrer">pull request #{out.number}</a> on {out.repo}. It applies once it’s merged.</> });
      } else {
        setMsg({ ok: true, text: 'Saved and applied.' });
        onSaved();
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="suggestion">
      <div class="suggestion-head wrap">
        <div style={{ minWidth: 0 }}>
          <b>{meta.label}</b> <span class={`chip ${from.chip}`}>{from.text}</span>
          <div class="muted small">{meta.why}</div>
        </div>
        {!site.demo && editing === null && (
          <div class="row gap-6">
            {inFile
              ? <button class="btn" type="button" onClick={() => setEditing(section.yaml)}>Edit</button>
              : <>
                {section.edit && <a class="btn" href={section.edit}>Edit</a>}
                <button class="btn ghost" type="button" disabled={busy} onClick={startFile}
                  title={toRepo ? `Add it to ${target.repo}/${target.path}` : 'Keep it in a file on this computer'}>
                  {busy ? 'Loading…' : toRepo ? 'Move to repo' : 'Keep in a file'}
                </button>
              </>}
          </div>
        )}
      </div>
      {section.items.length > 0 && editing === null && (
        <ul class="small" style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-2)' }}>
          {section.items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      )}
      {editing !== null && (
        <div class="stack gap-8">
          <p class="note m-0">
            {inFile ? 'The rest of the file stays as it is.' : 'A start from what Kauzl uses today. Once it’s in the file, the file wins over Kauzl’s settings.'}
            {' '}Format: <code>docs/sitelens-yml.md</code>.
          </p>
          <textarea rows={Math.min(24, Math.max(5, editing.split('\n').length + 1))} spellcheck={false} value={editing}
            onInput={(e) => setEditing(e.currentTarget.value)} aria-label={`${meta.label} in .sitelens.yml`} />
          <div class="row gap-8">
            <button class="btn primary" type="button" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : toRepo ? 'Open pull request' : 'Save'}
            </button>
            <button class="btn ghost" type="button" disabled={busy} onClick={() => { setEditing(null); setMsg(null); }}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <p class={`small m-0 ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
    </div>
  );
}

function SourceLink({ source }) {
  const text = source.type === 'repo' ? `${source.repo}/${source.path}` : source.type === 'demo' ? 'the built-in demo file' : source.path;
  return source.url ? <a href={source.url} target="_blank" rel="noreferrer"><code>{text}</code></a> : <code>{text}</code>;
}

function Messages({ list, tone = '' }) {
  return (
    <ul class="note" style={{ margin: 0, paddingLeft: '18px', color: tone === 'bad' ? 'var(--critical-ink)' : undefined }}>
      {list.map((m) => <li key={m}>{m}</li>)}
    </ul>
  );
}
