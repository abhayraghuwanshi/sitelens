import { useEffect, useMemo, useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatDecimal } from '@shared/format.js';
import { metaValue, setMetaValue } from '../../../shared/article-md.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Segmented } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import { Markdown } from '../components/Markdown.jsx';

// One article: its search queries and what they suggest on the right, the
// source on the left. Edits (by hand or Claude's) ship as a pull request.
const FIELDS = [
  { key: 'title', label: 'Title', ideal: [30, 60] },
  { key: 'description', label: 'Meta description', ideal: [120, 155] },
];

const WHERE = {
  frontmatter: 'front matter',
  heading: 'the # heading',
  lede: 'the first paragraph',
};

export function ArticleEditor({ site, range, path, onClose }) {
  const d = useAsync(() => api.get(`/sites/${site.id}/articles/detail${qs({ path, range })}`), [site.id, path, range]);
  const [md, setMd] = useState('');
  const [fileMeta, setFileMeta] = useState({ title: '', description: '' });
  const [mode, setMode] = useState('edit');
  const [ai, setAi] = useState({ busy: false, data: null, error: null });
  const [applied, setApplied] = useState({});
  const [pub, setPub] = useState({ busy: false, result: null, error: null, message: '' });

  const data = d.data;
  const original = data?.source?.markdown || '';
  useEffect(() => {
    if (!data) return;
    setMd(original);
    setFileMeta({ title: data.meta?.title.value || data.live.title || '', description: data.meta?.description.value || data.live.description || '' });
    setApplied({});
    setPub((p) => ({ ...p, result: null, error: null }));
  }, [data]);

  const fieldValue = (key) => {
    const m = data?.meta?.[key];
    const inMd = m && WHERE[m.where];
    return inMd ? metaValue(md, key, m.where) : fileMeta[key];
  };
  const setField = (key, value) => {
    const m = data?.meta?.[key];
    if (m && WHERE[m.where]) setMd((cur) => setMetaValue(cur, key, m.where, value));
    else setFileMeta((f) => ({ ...f, [key]: value }));
  };

  const metaFiles = FIELDS
    .map((f) => ({ field: f.key, m: data?.meta?.[f.key] }))
    .filter(({ field, m }) => m?.where === 'file' && fileMeta[field] !== m.value)
    .map(({ field, m }) => ({ field, file: m.file, old: m.value, next: fileMeta[field] }));
  const copyOnly = FIELDS.filter((f) => data?.meta?.[f.key] && !data.meta[f.key].where && fileMeta[f.key] !== data.meta[f.key].value);
  const changedLines = useMemo(() => diffLines(original, md).filter((l) => l.op !== '=').length, [original, md]);
  const dirty = changedLines > 0 || metaFiles.length > 0;

  async function askClaude() {
    setAi({ busy: true, data: null, error: null });
    setApplied({});
    try {
      const r = await api.post(`/sites/${site.id}/articles/suggest`, { path, markdown: md, title: fieldValue('title'), description: fieldValue('description') });
      setAi({ busy: false, data: r, error: null });
    } catch (error) {
      setAi({ busy: false, data: null, error });
    }
  }

  async function publish() {
    setPub((p) => ({ ...p, busy: true, error: null }));
    try {
      const notes = ai.data?.summary ? `**Why (Claude's read of the Search Console data):** ${ai.data.summary}` : '';
      const result = await api.post(`/sites/${site.id}/articles/publish`, {
        path, markdown: md, baseSha: data.source.sha, metaFiles, message: pub.message, notes,
      });
      setPub((p) => ({ ...p, busy: false, result }));
    } catch (error) {
      setPub((p) => ({ ...p, busy: false, error }));
    }
  }

  if (d.error) return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!data) return <><Loading height={60} /><Loading height={420} /></>;

  const a = data.article;
  const s = data.search;
  const editable = Boolean(data.source);

  return (
    <>
      <div class="meta-line" style={{ alignItems: 'center' }}>
        <button class="btn ghost" type="button" onClick={onClose}>← All articles</button>
        <span class="mono">{a.path}</span>
        <a href={a.url || `https://${site.host}${a.path}`} target="_blank" rel="noreferrer"><Icon name="external" size={12} /> Live page</a>
        {data.source && <a href={data.source.href} target="_blank" rel="noreferrer"><Icon name="github" size={12} /> {data.source.file}</a>}
        <a href={`#/site/${site.id}/pages${qs({ path: a.path, range })}`}><Icon name="chart" size={12} /> Traffic</a>
      </div>
      {Object.entries(data.notes).filter(([, v]) => v).map(([k, v]) => <p class="note" key={k} style={{ margin: 0 }}>{v}</p>)}

      {s && (
        <KpiStrip items={[
          { label: 'Google clicks', value: formatNumber(s.totals.clicks), raw: s.totals.clicks, previous: s.previous.clicks },
          { label: 'Impressions', value: formatNumber(s.totals.impressions), raw: s.totals.impressions, previous: s.previous.impressions },
          { label: 'CTR', value: formatPercent(s.totals.ctr), raw: s.totals.ctr, previous: s.previous.ctr },
          { label: 'Avg. position', value: s.totals.position ? formatDecimal(s.totals.position) : '—', raw: s.totals.position, previous: s.previous.position, invert: true },
        ]} />
      )}

      <History data={data} />

      <div class="article-editor">
        <div class="article-editor-main">
          <Card title="Search result" sub="What people see in Google before they click">
            {FIELDS.map((f) => {
              const m = data.meta?.[f.key];
              const value = fieldValue(f.key) ?? '';
              const shown = m?.cut ? value.slice(0, m.cut) : value;
              const [lo, hi] = f.ideal;
              const tone = !shown ? 'bad' : shown.length < lo || shown.length > hi + 10 ? 'warn' : 'ok';
              return (
                <label class="field" key={f.key}>
                  <span class="field-label">
                    {f.label}
                    <span class={`count ${tone}`}>{shown.length}{m?.cut ? ` of ${value.length} (site cuts at ${m.cut})` : ''} · aim {lo}–{hi}</span>
                  </span>
                  <textarea rows={f.key === 'title' ? 1 : 3} value={value}
                    onInput={(e) => setField(f.key, e.currentTarget.value)} />
                  <span class="small muted">
                    {!m ? 'Read from the live page.'
                      : WHERE[m.where] ? `Set by ${WHERE[m.where]} of the article — editing here edits the markdown.`
                      : m.where === 'file' ? <>Set in <span class="mono">{m.file}</span> — published as an exact replacement there.</>
                      : 'Couldn’t find where this is set in the repo — copy it into your code by hand.'}
                  </span>
                </label>
              );
            })}
            <SerpPreview host={site.host} path={a.path} title={fieldValue('title')} description={(() => { const v = fieldValue('description') || ''; const c = data.meta?.description?.cut; return c ? v.slice(0, c) : v; })()} />
          </Card>

          {editable && (
            <Card title="Article" sub={data.source.file}
              actions={<Segmented label="View" value={mode} onChange={setMode} options={[{ key: 'edit', label: 'Edit' }, { key: 'preview', label: 'Preview' }, { key: 'diff', label: `Changes${changedLines ? ` (${changedLines})` : ''}` }]} />}
              flush>
              {mode === 'edit' && <textarea class="md-editor" spellcheck value={md} onInput={(e) => setMd(e.currentTarget.value)} aria-label="Article markdown" />}
              {mode === 'preview' && <Markdown text={md} base={a.url || `https://${site.host}${a.path}`} />}
              {mode === 'diff' && <Diff a={original} b={md} />}
            </Card>
          )}

          {editable && (
            <Card title="Publish" sub={`Opens a pull request on ${data.source.repo} against ${data.source.branch}`}>
              <div class="publish-row">
                <input type="text" placeholder={`Search update: ${a.title || a.path}`} value={pub.message} onInput={(e) => setPub((p) => ({ ...p, message: e.currentTarget.value }))} aria-label="Pull request title" />
                <button class="btn primary" type="button" disabled={!dirty || pub.busy} onClick={publish}>
                  <Icon name="github" size={13} /> {pub.busy ? 'Opening…' : 'Open pull request'}
                </button>
                <button class="btn ghost" type="button" disabled={!dirty || pub.busy} onClick={() => { setMd(original); setFileMeta({ title: data.meta?.title.value || '', description: data.meta?.description.value || '' }); setApplied({}); }}>Discard</button>
              </div>
              <p class="small muted" style={{ margin: '8px 0 0' }}>
                {dirty ? `${changedLines ? `${changedLines} changed line${changedLines === 1 ? '' : 's'} in the article` : ''}${changedLines && metaFiles.length ? ' · ' : ''}${metaFiles.map((m) => `${m.field} in ${m.file}`).join(', ')}` : 'No changes yet.'}
                {copyOnly.length ? ` · ${copyOnly.map((f) => f.label.toLowerCase()).join(' and ')} won’t be included (copy it by hand)` : ''}
              </p>
              {pub.result && (
                <p class="note" style={{ margin: '8px 0 0', color: 'var(--good-ink)' }}>
                  Pull request <a href={pub.result.url} target="_blank" rel="noreferrer">#{pub.result.number}</a> is open ({pub.result.files.join(', ')}). Merge it to deploy; the change is marked on your charts from today.
                  {pub.result.skipped.length ? ` Skipped: ${pub.result.skipped.join(', ')}.` : ''}
                </p>
              )}
              {pub.error && <ErrorLine error={pub.error} />}
            </Card>
          )}
        </div>

        <div class="article-editor-side">
          <Card title="Suggest with Claude" sub="Reads the article and its real search queries">
            <button class="btn primary" type="button" disabled={ai.busy || !editable} onClick={askClaude}>
              <Icon name="sparkles" size={13} /> {ai.busy ? 'Claude is reading…' : ai.data ? 'Suggest again' : 'Suggest changes'}
            </button>
            {ai.busy && <p class="small muted">This takes up to a minute.</p>}
            {ai.error && <ErrorLine error={ai.error} />}
            {ai.data && <Suggestions s={ai.data} md={md} setMd={setMd} applied={applied} setApplied={setApplied} setField={setField} fieldValue={fieldValue} />}
          </Card>

          {data.checks.length > 0 && (
            <Card title="Checks">
              <ul class="checks">
                {data.checks.map((c, i) => <li key={i} class={c.level}>{c.text}</li>)}
              </ul>
            </Card>
          )}

          {data.opportunities.length > 0 && (
            <Card title="Closest wins" sub="Queries where a better result could earn more clicks">
              <ul class="checks">
                {data.opportunities.map((o) => (
                  <li key={o.query} class="warn">
                    <b>{o.query}</b> — {o.type === 'striking' ? `position ${formatDecimal(o.position)}, ${formatNumber(o.impressions)} impressions` : `top ${Math.round(o.position)} but ${formatPercent(o.ctr)} CTR`}; about {formatNumber(o.potential)} more clicks if it reached the top 3.
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {s && <Queries queries={s.queries} md={md} />}
        </div>
      </div>
    </>
  );
}

function ErrorLine({ error }) {
  return <p class="note" style={{ margin: '8px 0 0', color: 'var(--critical-ink)' }}>{error.message}{error.hint ? ` ${error.hint}` : ''}</p>;
}

function History({ data }) {
  if (!data.updates?.length) return null;
  const c = data.compare;
  const last = data.updates[0];
  const per = (t, days) => (t ? t / days : 0);
  return (
    <p class="note" style={{ margin: 0 }}>
      <b>Last updated here {last.date}</b>{last.body ? <> · <a href={last.body.split('\n')[0]} target="_blank" rel="noreferrer">pull request</a></> : ''}
      {c?.pending && ' · search numbers for the change arrive after about 3 days.'}
      {c && !c.pending && ` · ${c.days} days before vs after: ${formatDecimal(per(c.before.clicks, c.days))} → ${formatDecimal(per(c.after.clicks, c.days))} clicks/day, ${formatNumber(Math.round(per(c.before.impressions, c.days)))} → ${formatNumber(Math.round(per(c.after.impressions, c.days)))} impressions/day, position ${formatDecimal(c.before.position)} → ${formatDecimal(c.after.position)}.`}
    </p>
  );
}

function SerpPreview({ host, path, title, description }) {
  return (
    <div class="serp" aria-label="Google result preview">
      <div class="serp-url">{host}{path.replace(/\//g, ' › ').replace(/^ › /, ' › ')}</div>
      <div class="serp-title">{(title || '').length > 60 ? `${title.slice(0, 58)}…` : title || 'Untitled'}</div>
      <div class="serp-desc">{(description || '').length > 158 ? `${description.slice(0, 155)}…` : description}</div>
    </div>
  );
}

function Suggestions({ s, md, setMd, applied, setApplied, setField, fieldValue }) {
  const mark = (key) => setApplied((a) => ({ ...a, [key]: true }));
  return (
    <div class="suggestions">
      <p class="small" style={{ margin: '12px 0' }}>{s.summary}</p>
      {['title', 'description'].map((f) => s[f]?.value && s[f].value !== fieldValue(f) && (
        <div class="suggestion" key={f}>
          <div class="suggestion-head"><b>{f === 'title' ? 'Title' : 'Description'}</b>
            <button class="btn" type="button" disabled={applied[f]} onClick={() => { setField(f, s[f].value); mark(f); }}>{applied[f] ? 'Applied' : 'Apply'}</button>
          </div>
          <div class="ins">{s[f].value}</div>
          <div class="small muted">{s[f].why}</div>
        </div>
      ))}
      {s.edits.map((e, i) => {
        const key = `e${i}`;
        const present = md.split(e.find).length === 2;
        return (
          <div class="suggestion" key={key}>
            <div class="suggestion-head">
              {e.query ? <span class="chip accent">{e.query}</span> : <b>Edit</b>}
              <button class="btn" type="button" disabled={applied[key] || !present} title={present ? '' : 'The text this replaces has changed'}
                onClick={() => { setMd((cur) => cur.replace(e.find, () => e.replace)); mark(key); }}>{applied[key] ? 'Applied' : 'Apply'}</button>
            </div>
            <div class="del">{e.find}</div>
            <div class="ins">{e.replace}</div>
            <div class="small muted">{e.why}</div>
          </div>
        );
      })}
      {s.sections.map((sec, i) => {
        const key = `s${i}`;
        return (
          <div class="suggestion" key={key}>
            <div class="suggestion-head">
              {sec.query ? <span class="chip accent">{sec.query}</span> : <b>New section</b>}
              <button class="btn" type="button" disabled={applied[key]} onClick={() => { setMd((cur) => insertSection(cur, sec.after, sec.markdown)); mark(key); }}>{applied[key] ? 'Added' : 'Add'}</button>
            </div>
            <div class="ins pre">{sec.markdown}</div>
            <div class="small muted">{sec.why} {sec.after ? `Goes after “${sec.after}”.` : 'Goes at the end.'}</div>
          </div>
        );
      })}
      {s.dropped > 0 && <p class="small muted">{s.dropped} more suggestion{s.dropped === 1 ? '' : 's'} didn’t match the article text exactly and were left out.</p>}
      <p class="small muted">Review every change: Claude only sees the article and Search Console, so check facts before you publish.</p>
    </div>
  );
}

// After the named heading's section (before the next heading of the same or higher level).
function insertSection(md, after, section) {
  const lines = md.split('\n');
  const at = after ? lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s+/, '').trim() === after) : -1;
  if (at < 0) return `${md.replace(/\s*$/, '')}\n\n${section.trim()}\n`;
  const level = lines[at].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    const m = /^(#{1,6})\s/.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  while (end > at + 1 && !lines[end - 1].trim()) end--;
  return [...lines.slice(0, end), '', section.trim(), '', ...lines.slice(end).filter((l, i) => i > 0 || l.trim())].join('\n');
}

function Queries({ queries, md }) {
  const [sort, setSort] = useState('impressions');
  const text = md.toLowerCase();
  const rows = [...queries].sort((a, b) => (sort === 'position' ? a.position - b.position : b[sort] - a[sort]));
  const used = (q) => q.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).every((w) => text.includes(w.replace(/s$/, '')));
  return (
    <Card title="Search queries" sub={`${formatNumber(queries.length)} queries · ✓ = every word appears in the article`}
      actions={<Segmented label="Sort" value={sort} onChange={setSort} options={[{ key: 'impressions', label: 'Impr.' }, { key: 'clicks', label: 'Clicks' }, { key: 'position', label: 'Pos.' }]} />} flush>
      <div class="table-wrap" style={{ maxHeight: '420px' }}>
        <table class="data">
          <thead><tr><th>Query</th><th class="num">Clicks</th><th class="num">Impr.</th><th class="num">CTR</th><th class="num">Pos.</th></tr></thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.query}>
                <td>{md && (used(q) ? <span class="ok-mark" title="Every word is in the article">✓ </span> : <span class="muted" title="Some words never appear in the article">· </span>)}{q.query}</td>
                <td class="num">{formatNumber(q.clicks)}</td>
                <td class="num">{formatNumber(q.impressions)}</td>
                <td class="num">{formatPercent(q.ctr)}</td>
                <td class="num">{formatDecimal(q.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Line diff (LCS); articles are a few hundred lines at most.
export function diffLines(a, b) {
  const x = String(a).split('\n');
  const y = String(b).split('\n');
  if (a === b) return x.map((t) => ({ op: '=', t }));
  const n = x.length;
  const m = y.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ op: '=', t: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: '-', t: x[i++] });
    else out.push({ op: '+', t: y[j++] });
  }
  while (i < n) out.push({ op: '-', t: x[i++] });
  while (j < m) out.push({ op: '+', t: y[j++] });
  return out;
}

function Diff({ a, b }) {
  const lines = diffLines(a, b);
  if (!lines.some((l) => l.op !== '=')) return <p class="small muted" style={{ padding: '16px' }}>No changes yet.</p>;
  // Changed lines with two lines of context; long unchanged runs collapse.
  const keep = lines.map((l, i) => lines.slice(Math.max(0, i - 2), i + 3).some((x) => x.op !== '='));
  return (
    <div class="diff">
      {lines.map((l, i) => (keep[i]
        ? <div key={i} class={`diff-line ${l.op === '+' ? 'add' : l.op === '-' ? 'rm' : ''}`}><span class="diff-op">{l.op === '=' ? ' ' : l.op}</span>{l.t || ' '}</div>
        : keep[i - 1] ? <div key={i} class="diff-gap">⋯</div> : null))}
    </div>
  );
}
