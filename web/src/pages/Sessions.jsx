import { useState } from 'preact/hooks';
import { formatDuration } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, WarehouseMeta, PathChain } from '../components/ui.jsx';

export function Sessions({ site, range, params }) {
  const [path, setPath] = useState(params.get('path') || '');
  const [converted, setConverted] = useState('');
  const [query, setQuery] = useState({ path: params.get('path') || '', converted: '' });
  const data = useAsync((o) => api.get(`/sites/${site.id}/warehouse/sessions${qs({ range, ...query, limit: 100, fresh: o?.fresh })}`), [site.id, range, query.path, query.converted]);

  return (
    <>
      <form class="toolbar" onSubmit={(e) => { e.preventDefault(); setQuery({ path: path.trim(), converted: converted.trim() }); }}>
        <label class="sr-only" for="s-path">Visited page</label>
        <input id="s-path" type="text" style={{ width: '240px' }} placeholder="Visited page, e.g. /pricing" value={path} onInput={(e) => setPath(e.currentTarget.value)} />
        <label class="sr-only" for="s-conv">Fired event</label>
        <input id="s-conv" type="text" style={{ width: '240px' }} placeholder="Fired event, e.g. sign_up" value={converted} onInput={(e) => setConverted(e.currentTarget.value)} />
        <button class="btn" type="submit">Filter</button>
        <span class="grow" />
        <span class="note">Most recent 100 matching sessions. User IDs are GA4’s pseudonymous device IDs.</span>
      </form>
      {data.error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : !data.data ? (
        <Loading height={480} />
      ) : (
        <Card title="Sessions" sub={`${data.data.sessions.length} shown`} flush>
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr><th>Started</th><th>Journey</th><th class="num">Duration</th><th>Source</th><th>Device</th><th>Country</th></tr>
              </thead>
              <tbody>
                {data.data.sessions.map((s) => (
                  <tr key={`${s.user}:${s.sessionId}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(s.startedAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      <div class="muted small mono" title={s.user}>{s.user.slice(0, 10)}…</div>
                    </td>
                    <td>
                      <PathChain pages={s.pages} />
                      <div class="small muted" style={{ marginTop: '3px' }}>
                        {s.pageCount} pages · {s.eventCount} events
                        {s.conversions > 0 && <span class="chip good" style={{ marginLeft: '6px' }}>{query.converted} ×{s.conversions}</span>}
                      </div>
                    </td>
                    <td class="num">{formatDuration(s.durationSec)}</td>
                    <td class="small">{s.source} <span class="muted">/ {s.medium}</span></td>
                    <td class="small">{s.device}</td>
                    <td class="small">{s.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.data.sessions.length && <p class="muted" style={{ padding: '8px 16px' }}>No sessions match.</p>}
          </div>
          <div style={{ padding: '8px 16px 10px' }}><WarehouseMeta data={data.data} /></div>
        </Card>
      )}
      <p class="note">Source/medium is the user’s first-touch acquisition (<code>traffic_source</code>), which every GA4 export has; per-session attribution columns only exist in exports from mid-2023 on.</p>
    </>
  );
}
