import { useState } from 'preact/hooks';
import { formatNumber, formatPercent } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, navigate } from '../hooks.js';
import { Card, Loading, ErrorState, WarehouseMeta, Segmented } from '../components/ui.jsx';
import { Sankey } from '../charts/Sankey.jsx';

const DEPTHS = [3, 4, 5, 6].map((d) => ({ key: String(d), label: `${d} steps` }));

export function Paths({ site, range, params }) {
  const startPath = params.get('start') || '';
  const [depth, setDepth] = useState('4');
  const [draft, setDraft] = useState(startPath);
  const data = useAsync((o) => api.get(`/sites/${site.id}/warehouse/paths${qs({ range, depth, start: startPath, top: 16, fresh: o?.fresh })}`),
    [site.id, range, depth, startPath]);

  const setStart = (path) => navigate(`/site/${site.id}/paths${path ? `?start=${encodeURIComponent(path)}` : ''}`);
  const d = data.data;
  const exits = d ? d.exits.filter((r) => r.views >= 20).sort((a, b) => b.exits / b.views - a.exits / a.views) : [];

  return (
    <>
      <div class="toolbar">
        <form class="row" style={{ flex: 'none' }} onSubmit={(e) => { e.preventDefault(); setStart(draft.trim()); }}>
          <label class="sr-only" for="start-path">Starting page</label>
          <input id="start-path" type="text" placeholder="Landing page, e.g. /pricing" value={draft} style={{ width: '300px' }}
            onInput={(e) => setDraft(e.currentTarget.value)} />
          <button class="btn" type="submit">Apply</button>
          {startPath && <button class="btn ghost" type="button" onClick={() => { setDraft(''); setStart(''); }}>Clear</button>}
        </form>
        <span class="grow" />
        <Segmented label="Depth" value={depth} options={DEPTHS} onChange={setDepth} />
      </div>

      {data.error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : !d ? (
        <Loading height={480} />
      ) : (
        <>
          <Card
            title={startPath ? `Sessions that landed on ${startPath}` : 'How sessions move through the site'}
            sub={`${formatNumber(d.total)} sessions · reloads collapsed · click a page to start from it`}
          >
            <Sankey edges={d.edges} total={d.total} height={500} onSelect={(p) => { setDraft(p); setStart(p); }} />
            <div style={{ marginTop: '10px' }}><WarehouseMeta data={d} /></div>
          </Card>
          <div class="grid cols-2">
            <Card title="Biggest exits" sub="Share of views that were the last page of the session" flush>
              <table class="data">
                <thead><tr><th>Page</th><th class="num">Page views</th><th class="num">Exit rate</th></tr></thead>
                <tbody>
                  {exits.slice(0, 10).map((r) => (
                    <tr key={r.page}>
                      <td class="cell-path"><code>{r.page}</code></td>
                      <td class="num">{formatNumber(r.views)}</td>
                      <td class="num">{formatPercent(r.exits / r.views, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Top transitions" flush>
              <table class="data">
                <thead><tr><th>From</th><th>To</th><th class="num">Sessions</th></tr></thead>
                <tbody>
                  {[...d.edges].filter((e) => e.to !== '(exit)').sort((a, b) => b.sessions - a.sessions).slice(0, 10).map((e, i) => (
                    <tr key={i}>
                      <td class="cell-path"><code>{e.from}</code> <span class="muted small">step {e.step + 1}</span></td>
                      <td class="cell-path"><code>{e.to}</code></td>
                      <td class="num">{formatNumber(e.sessions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
