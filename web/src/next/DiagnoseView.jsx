import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loading, ErrorState } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Page } from './Page.jsx';
import { Attachment, Eyebrow } from './PageTimeline.jsx';
import { AddTodo } from '../components/Todos.jsx';
import { runTodo, findingTodo, isProblem } from './checkTodo.js';

// Diagnose (docs/redesign/prototype.html → Diagnose): pick a page, run a check
// on it. Each run is kept and posted on that page's timeline (server/diagnose.mjs
// → page-events), so the result also shows up where the page's story is told.
//   the page picker · the result of the run you just made · one row per check
//   (what it looks at, this page's last reading, Run) · this page's recent runs
const fmtD = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const ICON = { content: 'pages', speed: 'bolt', index: 'search', bots: 'eye' };
const NAME = { content: 'Content check', speed: 'Speed test', index: 'Index status', bots: 'As Googlebot and GPTBot' };

export function DiagnoseView({ site, params }) {
  const pages = useAsync(() => api.get(`/sites/${site.id}/page-review${qs({ range: '90d' })}`).catch(() => null), [site.id]);
  const list = [...(pages.data?.rows || [])].sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, 40);
  const path = params.get('path') || list[0]?.path || '';
  const ov = useAsync(() => (path ? api.get(`/sites/${site.id}/diagnose${qs({ path })}`) : null), [site.id, path]);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(null);

  const pick = (p) => {
    setResult(null);
    setFailed(null);
    location.hash = `/site/${site.id}/diagnose?path=${encodeURIComponent(p)}`;
  };
  const run = async (tool) => {
    setBusy(tool);
    setFailed(null);
    try {
      const r = await api.post(`/sites/${site.id}/diagnose/run`, { path, tool });
      if (r.failed) setFailed(r);
      else setResult(r);
      ov.reload();
    } catch (err) {
      setFailed({ tool, findings: [{ text: err.message }] });
    } finally {
      setBusy('');
    }
  };
  const timeline = `#/site/${site.id}/pages?article=${encodeURIComponent(path)}`;

  return (
    <Page title="Diagnose" sub={`Run a check on a page. Each run is posted on that page’s timeline · ${site.label}`}>
      {site.demo && <p class="nx-note-line"><Icon name="triangle" size={14} /><span>The sample site can’t be checked. Open one of your own sites.</span></p>}
      <div class="dg-pick">
        <label class="dg-pl" for="dg-page">Page</label>
        {pages.data || !pages.loading ? (
          <select id="dg-page" class="dg-sel" value={path} onChange={(e) => pick(e.currentTarget.value)}>
            {path && !list.some((r) => r.path === path) && <option value={path}>{path}</option>}
            {list.map((r) => <option key={r.path} value={r.path}>{r.path}{r.visits ? ` · ${r.visits.toLocaleString('en-US')} visits` : ''}</option>)}
          </select>
        ) : <span class="muted small">Reading the site’s pages…</span>}
        {path && <a class="todo-link" href={timeline}>Open its timeline →</a>}
      </div>

      {result && (
        <div class="pt-card dg-res" aria-live="polite">
          <div class="pt-hd"><span class="pt-av you">A</span><span class="pt-from"><b>You</b><small>to {result.path} · just now</small></span></div>
          <Eyebrow label={NAME[result.tool]} tone={result.tone} />
          <h3 class="pt-title">{result.headline.replace(/^./, (c) => c.toUpperCase())}</h3>
          <Attachment a={{ title: `${NAME[result.tool]} result`, cells: result.cells, findings: result.findings }} date={result.date} site={site}
            todoOf={(result.findings || []).filter(isProblem).length > 1 ? (f) => (isProblem(f) ? findingTodo({ site, path: result.path, tool: result.tool, finding: f }) : null) : null} />
          <div class="nx-btns">
            {(result.findings || []).some(isProblem) && <AddTodo site={site} class="btn primary" label="To-do" todo={runTodo({ site, path: result.path, tool: result.tool, headline: result.headline, findings: result.findings, date: fmtD(result.date) })} />}
            <a class="btn" href={timeline}>See it on the page’s timeline</a><button type="button" class="btn ghost" onClick={() => setResult(null)}>Close</button></div>
        </div>
      )}
      {failed && <p class="nx-note-line warn" role="alert"><Icon name="triangle" size={14} /><span><b>{NAME[failed.tool] || 'The check'} couldn’t run.</b> {failed.findings?.[0]?.text}</span></p>}

      {!path ? <p class="muted">No pages yet: Kauzl lists a site’s pages from its sitemap, its repo and GA4.</p>
        : ov.error ? <ErrorState error={ov.error} onRetry={ov.reload} />
        : !ov.data ? <Loading height={240} />
        : (
          <>
            <section class="card card-plain dg-list" aria-label="Checks">
              {ov.data.tools.map((t) => (
                <div key={t.key} class="dg-row">
                  <span class="dg-ic"><Icon name={ICON[t.key] || 'search'} size={16} /></span>
                  <span class="dg-nm"><b>{t.name}</b><small>{t.desc}</small></span>
                  <span class="dg-v">
                    {t.last ? <><i class={`pt-dot ${t.last.tone || 'muted'}`} /><span><b>{t.last.headline}</b><small>{t.last.by === 'nightly' ? 'Nightly run' : 'You ran it'} · {fmtD(t.last.date)}</small></span></> : <span class="muted small">Not run on this page yet</span>}
                  </span>
                  <button type="button" class="btn dg-run" disabled={Boolean(busy) || site.demo} onClick={() => run(t.key)} aria-busy={busy === t.key}>
                    <Icon name="play" size={12} /> {busy === t.key ? 'Running…' : 'Run'}
                  </button>
                </div>
              ))}
            </section>

            {ov.data.runs.length > 0 && (
              <section aria-label="Recent runs on this page" class="dg-recent">
                <h2 class="nx-label-sm">Recent runs on {path}</h2>
                <ol class="dg-runs">
                  {ov.data.runs.map((r) => (
                    <li key={r.id}><span class="muted">{fmtD(r.date)}</span><i class={`pt-dot ${r.tone || 'muted'}`} /><span><b>{NAME[r.tool]}:</b> {r.headline}</span></li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
    </Page>
  );
}
