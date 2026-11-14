import { useState } from 'preact/hooks';
import { api } from '../api.js';
import { usePersistent } from '../hooks.js';
import { Card, ErrorState, WarehouseMeta, humanBytes } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';

const EXAMPLES = [
  {
    label: 'Events per day',
    sql: `SELECT event_date, event_name, COUNT(*) AS events
FROM {{events}}
WHERE {{range}}
GROUP BY 1, 2
ORDER BY 1, 3 DESC`,
  },
  {
    label: 'Landing → converted',
    sql: `SELECT pages[SAFE_OFFSET(0)] AS landing,
  COUNT(*) AS sessions,
  COUNTIF(EXISTS (SELECT 1 FROM UNNEST(seq) WHERE k = 'event:purchase')) AS purchases
FROM {{sessions}}
GROUP BY landing
ORDER BY sessions DESC
LIMIT 25`,
  },
  {
    label: 'Session depth',
    sql: `SELECT ARRAY_LENGTH(pages) AS pages_viewed, COUNT(*) AS sessions
FROM {{sessions}}
GROUP BY 1
ORDER BY 1`,
  },
];

export function Explore({ site, range }) {
  const [sql, setSql] = usePersistent(`sql:${site.id}`, EXAMPLES[0].sql);
  const [state, setState] = useState({ running: false, result: null, error: null, estimate: null });

  if (site.demo) {
    return (
      <ErrorState error={{ kind: 'needs-warehouse', message: 'The SQL console runs against BigQuery. Connect any GA4 export — Google’s public sample dataset works — to query raw events here.' }} />
    );
  }

  async function estimate() {
    setState((s) => ({ ...s, estimate: null, error: null }));
    try {
      const est = await api.post(`/sites/${site.id}/warehouse/estimate`, { range, sql });
      setState((s) => ({ ...s, estimate: est }));
    } catch (error) {
      setState((s) => ({ ...s, error }));
    }
  }

  async function run(confirmBytes = 0) {
    setState((s) => ({ ...s, running: true, error: null }));
    try {
      const result = await api.post(`/sites/${site.id}/warehouse/sql`, { range, sql, confirmBytes });
      setState({ running: false, result, error: null, estimate: null });
    } catch (error) {
      setState((s) => ({ ...s, running: false, error }));
    }
  }

  const { result, error } = state;
  return (
    <>
      <Card title="Query the export" sub="Read-only · dry-run checked · scan cap enforced"
        actions={
          <div class="row">
            <button class="btn" type="button" onClick={estimate}>Estimate cost</button>
            <button class="btn primary" type="button" disabled={state.running} onClick={() => run()}>
              <Icon name="play" size={13} /> {state.running ? 'Running…' : 'Run'}
            </button>
          </div>
        }>
        <div class="stack">
          <div class="row">
            {EXAMPLES.map((e) => (
              <button key={e.label} class="btn ghost" type="button" onClick={() => setSql(e.sql)}>{e.label}</button>
            ))}
          </div>
          <textarea class="sql-editor" spellcheck={false} aria-label="SQL" value={sql} onInput={(e) => setSql(e.currentTarget.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run(); }} rows={10} />
          <p class="note">
            <code>{'{{events}}'}</code> is the <code>events_*</code> table and <code>{'{{range}}'}</code> limits it to the selected days (daily tables, or streaming <code>intraday_</code> tables where no daily table exists),
            and <code>{'{{sessions}}'}</code> is the session model the other views use (<code>pages</code>, <code>seq</code>, <code>first_touch_date</code>…). ⌘/Ctrl+Enter runs.
          </p>
          {state.estimate && (
            <p class="note">
              Dry run: <b>{humanBytes(state.estimate.bytes)}</b> ({state.estimate.statementType}) ≈ ${((state.estimate.bytes / 1e12) * 6.25).toFixed(4)} on-demand · cap {humanBytes(state.estimate.cap)}
            </p>
          )}
        </div>
      </Card>

      {error && (
        <div class="stack">
          <ErrorState error={error} />
          {error.kind === 'over-cap' && error.bytes > 0 && (
            <div class="row">
              <button class="btn" type="button" onClick={() => run(error.bytes)}>Run anyway — scan {humanBytes(error.bytes)} once</button>
            </div>
          )}
        </div>
      )}

      {result && (
        <Card title="Result" sub={`${result.rows.length} rows${result.truncated ? ' (truncated)' : ''}`} flush
          actions={<button class="btn ghost" type="button" onClick={() => downloadCsv(result)}><Icon name="download" size={13} /> CSV</button>}>
          <div class="table-wrap result-scroll">
            <table class="data">
              <thead><tr>{result.columns.map((c) => <th key={c.name} class={isNum(c) ? 'num' : ''}>{c.name}</th>)}</tr></thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {result.columns.map((c) => <td key={c.name} class={isNum(c) ? 'num' : 'mono'}>{display(row[c.name])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 16px 10px' }}><WarehouseMeta data={result} /></div>
        </Card>
      )}
    </>
  );
}

function isNum(c) {
  return ['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(c.type) && c.mode !== 'REPEATED';
}

function display(v) {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function downloadCsv(result) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [result.columns.map((c) => esc(c.name)).join(','), ...result.rows.map((r) => result.columns.map((c) => esc(r[c.name])).join(','))];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'kauzl-query.csv' });
  a.click();
  URL.revokeObjectURL(url);
}
