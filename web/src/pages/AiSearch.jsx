import { useEffect, useState } from 'preact/hooks';
import { formatNumber, formatPercent, formatRelative } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Segmented, Empty } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { dayLabel } from './GitHub.jsx';

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-muted)'];
const nan = (v) => (v === null ? NaN : v);

// AI search visibility: referrals from AI assistants, AI bots reading the site, and answer checks.
export function AiSearch({ site, range }) {
  const data = useAsync((o) => api.get(`/ai-search/sites/${site.id}${qs({ range, fresh: o?.fresh })}`), [site.id, range]);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <><Loading height={92} /><Loading height={300} /></>;

  const { referrals: r, referralsError, crawlers: c, answers, dates } = data.data;
  const score = answers.score;
  return (
    <>
      <KpiStrip items={[
        r
          ? { label: 'AI referral sessions', value: formatNumber(r.sessions), raw: r.sessions, previous: r.previous, help: 'Sessions that arrived from ChatGPT, Perplexity, Claude, Gemini, Copilot and other assistants (GA4).' }
          : { label: 'AI referral sessions', value: '—', meta: 'Needs GA4' },
        { label: 'Share of all sessions', value: r?.share === null || !r ? '—' : formatPercent(r.share), meta: r ? `of ${formatNumber(r.site.sessions)}` : '' },
        { label: 'AI engagement rate', value: r?.engagementRate == null ? '—' : formatPercent(r.engagementRate, 0), meta: r?.site.engagementRate != null ? `site ${formatPercent(r.site.engagementRate, 0)}` : '' },
        { label: 'Key events from AI', value: r ? formatNumber(r.keyEvents) : '—', meta: r?.site.keyEvents ? `${formatPercent(r.keyEvents / r.site.keyEvents, 0)} of all` : '' },
        c
          ? { label: 'AI assistant fetches', value: formatNumber(c.totals.assistant), meta: `${formatNumber(c.totals.crawler)} crawler hits`, help: 'An assistant fetched a page live to answer someone (ChatGPT-User, Perplexity-User, Claude-User…). From the server logs.' }
          : { label: 'AI assistant fetches', value: '—', meta: 'Needs Firebase logs' },
        score
          ? { label: 'Named in AI answers', value: `${score.mentioned}/${score.asked}`, meta: `cited ${score.cited}/${score.asked}`, help: 'Latest answer check per question.' }
          : { label: 'Named in AI answers', value: '—', meta: 'No checks yet' },
      ]} />
      {site.demo && <p class="note">Sample data. Connect your own site to see real AI referrals, bots and answer checks.</p>}

      <Referrals r={r} error={referralsError} dates={dates} onRefresh={() => data.reload({ fresh: true })} busy={data.loading} />
      <Crawlers c={c} site={site} />
      <AnswerChecks site={site} initial={answers} onDone={() => data.reload()} />
    </>
  );
}

function Referrals({ r, error, dates, onRefresh, busy }) {
  const [view, setView] = useState('assistant');
  if (error) {
    return (
      <Card title="AI referral sessions">
        <p class="small" style={{ margin: 0, color: 'var(--critical-ink)' }}>{error.message}</p>
        {error.hint && <p class="note">{error.hint}</p>}
      </Card>
    );
  }
  if (!r) {
    return <Card title="AI referral sessions"><p class="muted small">Link a GA4 property to this site in Settings → Sites to see sessions from AI assistants.</p></Card>;
  }
  const labels = dates.map(dayLabel);
  const top = r.assistants.slice(0, 5);
  const rest = r.assistants.slice(5);
  const series = view === 'share'
    ? [{ label: 'AI share of sessions', values: r.daily.map((v, i) => (r.siteDaily[i] ? (v / r.siteDaily[i]) * 100 : NaN)) }]
    : [
      ...top.map((a, i) => ({ label: a.assistant, values: a.daily, color: SERIES[i] })),
      ...(rest.length ? [{ label: 'Other', values: dates.map((_, i) => rest.reduce((n, a) => n + a.daily[i], 0)), color: SERIES[5] }] : []),
    ];
  return (
    <>
      <Card title="AI referral sessions" sub="People who clicked through from an AI answer"
        actions={<>
          <Segmented label="Chart" value={view} onChange={setView} options={[{ key: 'assistant', label: 'By assistant' }, { key: 'share', label: 'Share %' }]} />
          <button class="btn ghost" type="button" onClick={onRefresh} disabled={busy} title="Refresh from GA4"><Icon name="refresh" size={12} /></button>
        </>}>
        {r.sessions ? (
          <LineChart labels={labels} series={series} height={220} area={view === 'share'}
            format={view === 'share' ? (v) => `${formatNumber(v, { compact: true })}%` : (v, axis) => formatNumber(v, { compact: axis })} />
        ) : <p class="muted small">No sessions from AI assistants in this range yet.</p>}
        <p class="note" style={{ marginBottom: 0 }}>Google AI Overviews clicks count as Google organic in GA4 and Search Console, so they can’t be split out.</p>
      </Card>

      <div class="grid cols-2">
        <Card title="By assistant" flush>
          {r.assistants.length ? (
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Assistant</th><th class="num">Sessions</th><th class="num">Engaged</th><th class="num">Key events</th></tr></thead>
                <tbody>
                  {r.assistants.map((a) => (
                    <tr key={a.assistant}>
                      <td title={a.sources.join(', ')}>{a.assistant}</td>
                      <td class="num">{formatNumber(a.sessions)}</td>
                      <td class="num">{a.engagementRate === null ? '—' : formatPercent(a.engagementRate, 0)}</td>
                      <td class="num">{formatNumber(a.keyEvents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p class="muted small" style={{ padding: '8px 16px' }}>Nothing yet.</p>}
        </Card>
        <Card title="Landing pages from AI" flush>
          {r.landing.length ? (
            <div class="table-wrap">
              <table class="data">
                <thead><tr><th>Page</th><th>Sent by</th><th class="num">Sessions</th><th class="num">Engaged</th></tr></thead>
                <tbody>
                  {r.landing.slice(0, 12).map((p) => (
                    <tr key={p.path}>
                      <td class="cell-path"><code title={p.path}>{p.path}</code></td>
                      <td class="small muted">{p.assistants.slice(0, 2).join(', ')}</td>
                      <td class="num">{formatNumber(p.sessions)}</td>
                      <td class="num">{p.engagementRate === null ? '—' : formatPercent(p.engagementRate, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p class="muted small" style={{ padding: '8px 16px' }}>Nothing yet.</p>}
        </Card>
      </div>
    </>
  );
}

function Crawlers({ c, site }) {
  if (!c) {
    if (site.demo) return null;
    return (
      <Card title="AI bots on your server">
        <p class="muted small" style={{ margin: 0 }}>
          GA4 can’t see bots. Link this site’s hosting logs to see which AI assistants and crawlers read your pages:{' '}
          <a href="#/settings?i=firebase">Firebase App Hosting</a>.
        </p>
      </Card>
    );
  }
  const labels = c.dates.map(dayLabel);
  return (
    <div class="grid cols-2-1">
      <Card title="AI bots on your server" sub={c.dataStart ? `Server logs since ${c.dataStart}` : 'Server logs'}>
        <LineChart labels={labels} height={200} format={(v, axis) => formatNumber(v, { compact: axis })} series={[
          { label: 'Assistant fetches', values: c.series.assistant.map(nan), color: SERIES[0] },
          { label: 'Crawler hits', values: c.series.crawler.map(nan), color: SERIES[5] },
        ]} />
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Bot</th><th>Kind</th><th class="num">Hits</th><th class="num">Paths</th><th class="num">Errors</th><th class="num">Last seen</th></tr></thead>
            <tbody>
              {c.bots.slice(0, 12).map((b) => (
                <tr key={b.bot}>
                  <td>{b.bot}</td>
                  <td><span class={`chip${b.kind === 'ai-assistant' ? ' accent' : ''}`}>{b.kind === 'ai-assistant' ? 'Answering a user' : 'Crawler'}</span></td>
                  <td class="num">{formatNumber(b.hits)}</td>
                  <td class="num">{formatNumber(b.paths)}</td>
                  <td class="num" style={b.errors ? { color: 'var(--critical-ink)' } : undefined}>{formatNumber(b.errors)}</td>
                  <td class="num small muted">{b.lastSeen ? formatRelative(b.lastSeen) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!c.bots.length && <p class="muted small">No AI bots in this range.</p>}
      </Card>
      <Card title="Pages AI reads" sub="Assistant fetches · crawler hits" flush>
        {c.paths.length ? (
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Page</th><th class="num">Fetches</th><th class="num">Crawls</th></tr></thead>
              <tbody>
                {c.paths.slice(0, 15).map((p) => (
                  <tr key={p.path}>
                    <td class="cell-path"><code title={`${p.path}\n${p.bots.join(', ')}`}>{p.path}</code></td>
                    <td class="num">{formatNumber(p.assistant)}</td>
                    <td class="num">{formatNumber(p.crawler)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p class="muted small" style={{ padding: '8px 16px' }}>No pages read by AI bots in this range.</p>}
      </Card>
    </div>
  );
}

function AnswerChecks({ site, initial, onDone }) {
  const [a, setA] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState('');
  useEffect(() => setA(initial), [initial]);

  // Poll while a run is going; refresh the whole view when it ends.
  useEffect(() => {
    if (!a.running) return undefined;
    const timer = setInterval(async () => {
      const next = await api.get(`/ai-search/sites/${site.id}/checks`).catch(() => null);
      if (!next) return;
      setA(next);
      if (!next.running) {
        clearInterval(timer);
        onDone();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [Boolean(a.running), site.id]);

  async function run() {
    setMsg(null);
    try {
      const r = await api.post(`/ai-search/sites/${site.id}/run`, {});
      setA({ ...a, running: r.running });
    } catch (err) {
      setMsg({ ok: false, text: `${err.message}${err.hint ? ` ${err.hint}` : ''}` });
    }
  }

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post(`/ai-search/sites/${site.id}/prompts`, { prompts: draft.split('\n') });
      setEditing(false);
      setA(await api.get(`/ai-search/sites/${site.id}/checks`));
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  const noKey = !a.keySource && !a.sample;
  const actions = site.demo ? null : (
    <>
      <button class="btn ghost" type="button" onClick={() => { setDraft(a.prompts.join('\n')); setEditing(!editing); }}>{editing ? 'Cancel' : 'Edit questions'}</button>
      <button class="btn primary" type="button" onClick={run} disabled={Boolean(a.running) || noKey}>
        <Icon name="sparkles" size={12} /> {a.running ? `Asking… ${a.running.done}/${a.running.total}` : 'Run checks'}
      </button>
    </>
  );

  return (
    <Card title="Answer checks" sub={a.sample ? 'Sample results' : a.lastRun ? `Asked Claude with web search · last run ${formatRelative(a.lastRun)}` : 'Ask an AI your customers’ questions and see if it names you'} actions={actions}>
      {noKey && (
        <Empty title="Add an Anthropic API key to run answer checks">
          Claude answers each question with live web search; Studio records whether the answer names {a.terms[0] || 'your product'}, cites your site, and who else it cites.
          <div style={{ marginTop: '10px' }}><a class="btn primary" href="#/settings?i=anthropic">Open Claude settings</a></div>
        </Empty>
      )}
      {editing && (
        <form class="stack" onSubmit={save} style={{ gap: '8px', marginBottom: '12px' }}>
          <textarea rows={Math.max(4, a.prompts.length + 1)} value={draft} onInput={(e) => setDraft(e.currentTarget.value)} aria-label="Questions, one per line" />
          <div class="row">
            <button class="btn primary" type="submit">Save questions</button>
            <span class="small muted">One per line, up to 12. Ask what a customer would ask, without naming you, to measure discovery.</span>
          </div>
        </form>
      )}
      {msg && <p class="small" style={{ color: msg.ok ? 'var(--good-ink)' : 'var(--critical-ink)' }}>{msg.text}</p>}

      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Question</th><th>Named</th><th>Cited</th><th>Also cited</th><th class="num">Hit rate</th><th>History</th></tr></thead>
          <tbody>
            {a.results.map((q) => {
              const l = q.latest;
              const others = l && !l.error ? l.domains.filter((d) => !d.own).slice(0, 3) : [];
              return [
                <tr key={q.prompt} onClick={() => l?.answer && setOpen(open === q.prompt ? '' : q.prompt)} style={l?.answer ? { cursor: 'pointer' } : undefined}>
                  <td>{q.prompt}</td>
                  {!l ? <td colSpan={3} class="small muted">Not asked yet</td>
                    : l.error ? <td colSpan={3} class="small" style={{ color: 'var(--critical-ink)' }}>{l.error}</td>
                      : <>
                        <td><Mark on={l.mentioned} /></td>
                        <td>{l.cited ? <span class="chip good">#{l.rank}</span> : l.inResults ? <span class="chip" title="Found in search results but not cited">seen</span> : <Mark on={false} />}</td>
                        <td class="small muted">{others.map((d) => d.domain).join(', ') || '—'}</td>
                      </>}
                  <td class="num">{q.mentionRate === null ? '—' : formatPercent(q.mentionRate, 0)}</td>
                  <td><History items={q.history} /></td>
                </tr>,
                open === q.prompt && l?.answer && (
                  <tr key={`${q.prompt}:answer`}>
                    <td colSpan={6}>
                      <div class="small" style={{ whiteSpace: 'pre-wrap', maxHeight: '320px', overflow: 'auto', color: 'var(--text-2)' }}>{l.answer}</div>
                      {l.domains.length > 0 && <div class="row" style={{ marginTop: '8px', gap: '4px', flexWrap: 'wrap' }}>
                        {l.domains.map((d) => <span key={d.domain} class={`chip${d.own ? ' accent' : ''}`}>{d.domain} · {d.citations}</span>)}
                      </div>}
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p class="note" style={{ marginBottom: 0 }}>
        Each check asks {a.model || 'Claude'} with web search, as a neutral assistant that doesn’t know whose site it is. “Named” matches {a.terms.slice(0, 4).map((t) => `“${t}”`).join(', ')}.
        Answers vary run to run, so the hit rate across runs matters more than one result. A run costs roughly $0.05–0.20 per question in API credits.
        {!site.demo && <> <WeeklyToggle on={a.weekly} onChange={(weekly) => api.post('/ai-search/settings', { weekly }).then(() => setA({ ...a, weekly }))} /></>}
      </p>
    </Card>
  );
}

function WeeklyToggle({ on, onChange }) {
  return (
    <label class="small" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.currentTarget.checked)} /> Re-run weekly
    </label>
  );
}

function Mark({ on }) {
  return on
    ? <span class="chip good" aria-label="yes">Yes</span>
    : <span class="small muted" aria-label="no">No</span>;
}

function History({ items }) {
  if (!items.length) return <span class="small muted">—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: '3px' }} aria-label={`${items.filter((h) => h.mentioned).length} of ${items.length} runs named you`}>
      {items.map((h) => (
        <span key={h.ts} title={`${new Date(h.ts).toLocaleDateString()}: ${h.cited ? `cited #${h.rank}` : h.mentioned ? 'named' : 'not named'}`}
          style={{ width: '8px', height: '8px', borderRadius: '50%', background: h.cited ? 'var(--good)' : h.mentioned ? 'var(--series-1)' : 'var(--border)' }} />
      ))}
    </span>
  );
}
