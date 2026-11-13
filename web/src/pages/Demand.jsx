import { useMemo, useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal, formatDate } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, Loading, ErrorState, Segmented, Delta } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';

const OTHER = 'Other';
// Fixed categorical order: a group keeps its color as long as its position does.
const colorFor = (index, name) => (name === OTHER ? 'var(--series-muted)' : `var(--series-${(index % 8) + 1})`);

const METRICS = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'position', label: 'Avg. position' },
];
const MOVERS = [
  { key: 'newQueries', label: 'New' },
  { key: 'rising', label: 'Rising' },
  { key: 'falling', label: 'Falling' },
];
const TRENDS_DATE = { today: 'now 7-d', week: 'now 7-d', '7d': 'now 7-d', '28d': 'today 1-m', '90d': 'today 3-m' };

export function Demand({ site, range }) {
  const [version, setVersion] = useState(0);
  const data = useAsync((o) => api.get(`/sites/${site.id}/search-demand${qs({ range, fresh: o?.fresh })}`), [site.id, range, version]);
  const [metric, setMetric] = useState('impressions');
  const [movers, setMovers] = useState('newQueries');

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={110} /><Loading height={300} /></>;

  const d = data.data;
  const colors = Object.fromEntries(d.groups.map((g, i) => [g.name, colorFor(i, g.name)]));
  const labels = d.dates.map((x) => formatDate(x.replaceAll('-', '')));
  const visible = d.groups.filter((g) => g.impressions > 0 || g.name !== OTHER);
  const series = visible.map((g) => ({
    label: g.name,
    color: colors[g.name],
    values: g.daily[metric].map((v) => (v === null ? NaN : v)),
  }));
  const fmt = metric === 'position' ? (v) => formatDecimal(v, 1) : (v, axis) => formatNumber(v, { compact: axis });

  return (
    <>
      <div class="kpis">
        {d.groups.map((g) => (
          <div class="kpi" key={g.name} title={g.pattern ? `Matches /${g.pattern}/i` : 'Queries no group matched'}>
            <div class="label"><i style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors[g.name], display: 'inline-block' }} /> {g.name}</div>
            <div class="value">{formatNumber(g.impressions)}</div>
            <div class="meta">
              <Delta current={g.impressions} previous={g.previous.impressions} />
              <span>impressions · {formatPercent(g.share, 0)} of total</span>
            </div>
            <div class="meta">
              {formatNumber(g.clicks)} clicks · pos {g.position === null ? '—' : formatDecimal(g.position, 1)} · {g.queries} queries
            </div>
          </div>
        ))}
      </div>
      <p class="note">
        Search Console, {d.range.startLabel} – {d.range.endLabel} (about {d.range.lagDays} days behind), compared with the {d.range.days} days before.
        {d.anonymized > 0 && ` ${formatPercent(d.anonymized / d.siteImpressions, 0)} of impressions came from rare queries Google hides for privacy, so groups add up to less than the site total.`}
      </p>

      <Card title="Search demand by group" sub={metric === 'position' ? 'Lower is better — 1 is the top result' : 'Per day'}
        actions={<Segmented label="Metric" value={metric} options={METRICS} onChange={setMetric} />}>
        <LineChart labels={labels} series={series} format={fmt} height={260} />
      </Card>

      <div class="grid cols-2-1" style={{ alignItems: 'start' }}>
        <Card title="Moving queries" sub="Compared with the previous period · 5+ impressions"
          actions={<Segmented label="Movers" value={movers} options={MOVERS} onChange={setMovers} />} flush>
          <MoversTable rows={d[movers]} colors={colors} kind={movers} />
        </Card>
        <div class="stack">
          {d.groupsFrom === 'file'
            ? <FileGroups site={site} groups={d.groups.filter((g) => g.name !== OTHER)} colors={colors} />
            : <GroupEditor site={site} groups={d.groups.filter((g) => g.name !== OTHER)} queries={d.queries} isDefault={d.defaultGroups}
              colors={colors} onSaved={() => setVersion((v) => v + 1)} />}
          <TrendsCard groups={d.groups} queries={d.queries} range={range} />
        </div>
      </div>
    </>
  );
}

function MoversTable({ rows, colors, kind }) {
  if (!rows.length) {
    return <p class="muted small inset">{{ newQueries: 'No new queries with 5+ impressions this period.', rising: 'Nothing rose by 5+ impressions.', falling: 'Nothing fell by 5+ impressions.' }[kind]}</p>;
  }
  return (
    <div class="table-wrap result-scroll">
      <table class="data">
        <thead><tr><th>Query</th><th>Group</th><th class="num">Impr.</th><th class="num">Before</th><th class="num">Change</th><th class="num">Pos.</th></tr></thead>
        <tbody>
          {rows.map((q) => (
            <tr key={q.query}>
              <td class="cell-path">{q.query}</td>
              <td class="small nowrap">
                <i style={{ width: '8px', height: '8px', borderRadius: '2px', background: colors[q.group], display: 'inline-block', marginRight: '6px' }} />{q.group}
              </td>
              <td class="num">{formatNumber(q.impressions)}</td>
              <td class="num">{q.prevImpressions ? formatNumber(q.prevImpressions) : <span class="muted">new</span>}</td>
              <td class="num"><span class={`delta ${q.change > 0 ? 'up' : 'down'}`}>{q.change > 0 ? '+' : ''}{formatNumber(q.change)}</span></td>
              <td class="num">{q.position === null ? '—' : formatDecimal(q.position, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Groups declared in the site's .sitelens.yml (search: brand, competitors, topics).
function FileGroups({ site, groups, colors }) {
  return (
    <Card title="Query groups" sub="From the site’s repo file">
      <div class="stack gap-8">
        {groups.map((g) => (
          <div key={g.name} class="row" style={{ flexWrap: 'nowrap', alignItems: 'baseline' }}>
            <i style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors[g.name], flex: 'none' }} />
            <b class="small" style={{ flex: 'none' }}>{g.name}</b>
            <code class="small" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{g.pattern}</code>
          </div>
        ))}
        <p class="note m-0">
          First matching group wins. They’re made from your brand, topics and competitors.{' '}
          <a href={`#/site/${site.id}/setup`}>Change them in the site’s settings</a>
        </p>
      </div>
    </Card>
  );
}

function GroupEditor({ site, groups, queries, isDefault, colors, onSaved }) {
  const [draft, setDraft] = useState(() => groups.map(({ name, pattern }) => ({ name, pattern })));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Live preview: how many of this period's queries each draft pattern would catch (first match wins).
  const preview = useMemo(() => {
    const compiled = draft.map((g) => {
      try {
        return g.pattern ? new RegExp(g.pattern, 'i') : null;
      } catch {
        return 'invalid';
      }
    });
    const counts = draft.map(() => ({ queries: 0, impressions: 0, example: '' }));
    for (const q of queries) {
      const i = compiled.findIndex((re) => re && re !== 'invalid' && re.test(q.query));
      if (i >= 0) {
        counts[i].queries += 1;
        counts[i].impressions += q.impressions;
        counts[i].example ||= q.query;
      }
    }
    return { compiled, counts };
  }, [draft, queries]);

  const update = (i, patch) => setDraft(draft.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/sites/${site.id}/search-groups`, { groups: draft.filter((g) => g.name.trim() || g.pattern.trim()) });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Query groups" sub={isDefault ? 'Suggested from the hostname — edit and save' : 'First matching group wins'}
      actions={<button class="btn primary" type="button" disabled={saving || site.demo} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>}>
      <div class="stack gap-10">
        {draft.map((g, i) => {
          const c = preview.counts[i];
          const invalid = preview.compiled[i] === 'invalid';
          return (
            <div key={i} class="stack gap-4">
              <div class="row" style={{ flexWrap: 'nowrap' }}>
                <i style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors[g.name] || `var(--series-${(i % 8) + 1})`, flex: 'none' }} />
                <input type="text" value={g.name} placeholder="Name" style={{ width: '110px' }} aria-label={`Group ${i + 1} name`} onInput={(e) => update(i, { name: e.currentTarget.value })} />
                <input type="text" value={g.pattern} placeholder="regex, e.g. raycast|alfred" class="mono" style={{ flex: '1', minWidth: '0' }}
                  aria-label={`Group ${i + 1} pattern`} aria-invalid={invalid} onInput={(e) => update(i, { pattern: e.currentTarget.value })} />
                <button class="btn ghost icon-btn" type="button" aria-label={`Remove group ${i + 1}`} onClick={() => setDraft(draft.filter((_, k) => k !== i))}><Icon name="x" size={14} /></button>
              </div>
              <div class="small" style={{ paddingLeft: '18px', color: invalid ? 'var(--critical-ink)' : 'var(--text-3)' }}>
                {invalid ? 'Not a valid regular expression' : g.pattern ? `${c.queries} queries · ${formatNumber(c.impressions)} impressions${c.example ? ` · e.g. “${c.example}”` : ''}` : 'Add a pattern'}
              </div>
            </div>
          );
        })}
        <div class="row">
          <button class="btn" type="button" disabled={draft.length >= 8} onClick={() => setDraft([...draft, { name: draft.length ? 'Category' : 'Brand', pattern: '' }])}>
            <Icon name="plus" size={13} /> Add group
          </button>
        </div>
        <p class="note m-0">
          Patterns are case-insensitive regular expressions matched against each search query. Typical setup: <b>Brand</b> for your name and its typos,
          <b> Category</b> for what people search when they don’t know you yet (e.g. <code>raycast.*alternative</code>), <b>Competitors</b> for rival names.
          {site.demo && ' Saving is off for the demo site.'}
        </p>
        {error && <ErrorState error={error} />}
      </div>
    </Card>
  );
}

// Google Trends has no generally available API; open it pre-filled with each group's top query instead.
function TrendsCard({ groups, queries, range }) {
  const terms = groups
    .filter((g) => g.name !== OTHER)
    .map((g) => queries.filter((q) => q.group === g.name).sort((a, b) => b.impressions - a.impressions)[0]?.query)
    .filter(Boolean)
    .slice(0, 5);
  const date = TRENDS_DATE[range] || 'today 3-m';
  const url = (list) => `https://trends.google.com/trends/explore?${new URLSearchParams({ date, q: list.join(',') })}`;
  return (
    <Card title="Google Trends" sub="Market-wide interest, not just your site">
      <div class="stack gap-8">
        {terms.length ? (
          <>
            <a class="btn self-start" href={url(terms)} target="_blank" rel="noreferrer">
              <Icon name="external" size={13} /> Compare top queries in Trends
            </a>
            <div class="row small">
              {terms.map((t) => <a key={t} class="chip" href={url([t])} target="_blank" rel="noreferrer">{t} ↗</a>)}
            </div>
          </>
        ) : <p class="muted small">Define a group with matching queries to get Trends links.</p>}
        <p class="note m-0">
          Trends only charts terms with real search volume — a small brand name usually shows “not enough data”, while category terms work well.
          Google’s Trends API is still invite-only alpha; if you get access, it can feed this chart directly.
        </p>
      </div>
    </Card>
  );
}
