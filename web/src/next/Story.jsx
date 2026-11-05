import { useState } from 'preact/hooks';
import { api, qs } from '../api.js';
import { useAsync, usePersistent } from '../hooks.js';
import { Segmented, Loading, ErrorState } from '../components/ui.jsx';
import { LineChart } from '../charts/LineChart.jsx';
import { Icon } from '../components/icons.jsx';
import { Page } from './Page.jsx';
import { LeftOutLine } from './LeaveOut.jsx';
import { useJourneys } from './Journeys.jsx';

// One site's period as a story: what's failing, what happened, who brought the
// visits, where they landed, and what to do next. Each part is one sentence and
// a short list; "Explore" opens the full report behind it.
const RANGES = [{ key: 'today', label: 'Today' }, { key: '7d', label: '7 days' }, { key: '28d', label: '28 days' }, { key: '90d', label: '90 days' }];
const fmt = (v) => Math.round(v || 0).toLocaleString('en-US');
const short = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const today = () => new Date().toISOString().slice(0, 10);
const KIND_ICON = { deploy: 'rocket', release: 'github', post: 'megaphone', extension: 'puzzle', mention: 'chat', note: 'star', claude: 'sparkles' };

export function Story({ site, params }) {
  const [saved, setSaved] = usePersistent('storyRange', '28d');
  const wanted = params.get('range') || saved;
  const range = RANGES.some((r) => r.key === wanted) ? wanted : '28d';
  const pick = (key) => {
    setSaved(key);
    location.hash = `/site/${site.id}?range=${key}`;
  };

  const isToday = range === 'today';
  const story = useAsync(() => (isToday ? null : api.get(`/sites/${site.id}/story${qs({ range })}`)), [site.id, range]);
  const r = story.data?.range;
  const span = r ? { site: site.id, from: r.from, to: r.to } : null;
  const metrics = useAsync(() => (span ? api.get(`/calendar/metrics${qs(span)}`) : null), [span?.from, span?.to, site.id]);
  const sources = useAsync(() => (span ? api.get(`/calendar/breakdown${qs({ ...span, by: 'source', limit: 6 })}`) : null), [span?.from, span?.to, site.id]);
  const pages = useAsync(() => (span ? api.get(`/calendar/breakdown${qs({ ...span, by: 'page', limit: 5 })}`) : null), [span?.from, span?.to, site.id]);
  const marks = useAsync(() => (span ? api.get(`/annotations${qs({ from: span.from, to: span.to, scope: `site:${site.id}` })}`) : null), [span?.from, span?.to, site.id]);

  return (
    <Page title={site.label}
      sub={isToday ? 'Today so far, against a usual day like it' : r ? `${short(r.from)} – ${short(r.to)}, against the ${range.replace('d', '')} days before · whole days only` : site.host}
      actions={<Segmented label="Period" value={range} options={RANGES} onChange={pick} />}>
      <NeedsYou site={site} />
      {!isToday && <LeftOutLine site={site} range={range} />}
      {isToday ? <><Today site={site} /><NextSteps site={site} /></> : story.error ? <ErrorState error={story.error} onRetry={story.reload} /> : !story.data ? <Loading height={260} /> : (
        <>
          <Traffic site={site} story={story.data} metrics={metrics.data} marks={marks.data?.annotations || []} />
          <Sources site={site} rows={sources.data?.rows} changes={story.data.changes} range={range} />
          {site.modes?.warehouse ? <HowTheyCome site={site} range={range} /> : <Landing site={site} rows={pages.data?.rows} range={range} />}
          {site.modes?.warehouse && <Leavers site={site} range={range} />}
          <Results site={site} range={range} />
          <NextSteps site={site} />
        </>
      )}
    </Page>
  );
}

// Today so far, from GA4's real-time and today reports. Today isn't over, so it
// is set against a usual same weekday's whole day, not against yesterday.
function Today({ site }) {
  const dash = useAsync(() => api.get(`/sites/${site.id}/dashboard?range=today`), [site.id]);
  const live = useAsync(() => api.get(`/sites/${site.id}/live`).catch(() => null), [site.id]);
  const to = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const from = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const past = useAsync(() => api.get(`/calendar/metrics${qs({ site: site.id, from, to })}`).catch(() => null), [site.id, to]);
  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />;
  if (!dash.data) return <section class="nx-card"><Loading height={240} /></section>;

  const rep = dash.data.reports;
  const now = rep.overview.current;
  const day = rep.trend[0]?.date || '';
  const weekday = (day ? new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}T12:00:00Z`) : new Date()).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const same = (past.data?.days || []).filter((d) => d.weekday === weekday && Number.isFinite(d.sessions));
  const usual = same.length ? Math.round(same.reduce((n, d) => n + d.sessions, 0) / same.length) : null;
  // Hours are in the property's time zone; the last one reported is "now".
  const trend = rep.trend;
  const left = 23 - (trend.at(-1)?.hour ?? 23);
  const countries = rep.countries.slice(0, 3).filter((c) => c.sessions > 0);
  const headline = usual === null
    ? `${fmt(now.sessions)} visits so far today.`
    : `${fmt(now.sessions)} visits so far today${left > 0 ? `, with ${left} hour${left === 1 ? '' : 's'} to go` : ''}. A usual ${weekday} has ${fmt(usual)} by the end of the day.`;

  return (
    <section class="nx-card" aria-label="Today">
      <SectionHead n="1" title="Today so far" more={{ href: `#/site/${site.id}/pages?range=today`, label: 'Today’s pages' }} />
      <p class="nx-headline">{headline}</p>
      <p class="nx-lede">
        {Math.round((now.engagementRate || 0) * 100)}% engaged.
        {countries.length > 0 && ` Most came from ${countries.map((c) => `${c.country} (${fmt(c.sessions)})`).join(', ')}.`}
        {live.data && ` On the site right now: ${fmt(live.data.total)}${live.data.top?.[0] ? `, reading “${live.data.top[0].title}”` : ''}.`}
      </p>
      {trend.length > 1 && (
        <LineChart height={160} labels={trend.map((t) => t.label)} series={[{ label: 'Visits', values: trend.map((t) => t.sessions) }]} />
      )}
      <div class="nx-cols">
        <div>
          <div class="nx-label-sm">How they came</div>
          <ul class="nx-rows">
            {rep.channels.slice(0, 5).map((c) => (
              <li key={c.channel}><a href={`#/site/${site.id}/pages?range=today`}><span class="nx-path">{c.channel}</span><span class="nx-num">{fmt(c.sessions)}</span><span class="nx-dim small">{Math.round(c.engagementRate * 100)}% engaged</span></a></li>
            ))}
          </ul>
        </div>
        <div>
          <div class="nx-label-sm">Where they landed</div>
          <ul class="nx-rows">
            {rep.entryPages.slice(0, 5).map((p) => (
              <li key={p.path}><a href={`#/site/${site.id}/pages?range=today`}><span class="nx-path">{capital(pageName(p.path))}</span><span class="nx-num">{fmt(p.sessions)}</span><span class="nx-dim small">{Math.round(p.engagementRate * 100)}% engaged</span></a></li>
            ))}
          </ul>
        </div>
      </div>
      <p class="nx-note">Search Console reports 2–3 days late, so today’s searches aren’t in yet. Downloads and the reasons people leave fill in tomorrow.</p>
    </section>
  );
}

// Shown only while something is wrong: this site's unread alerts, and setup that
// stops a part of the story from being told.
function NeedsYou({ site }) {
  const alerts = useAsync(() => api.get('/alerts?limit=100'), []);
  const ai = useAsync(() => api.get(`/ai-search/sites/${site.id}/checks`).catch(() => null), [site.id]);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const items = (alerts.data?.alerts || [])
    .filter((a) => !a.read && a.at >= weekAgo && a.subject?.type === 'site' && a.subject.id === site.id)
    .slice(0, 4)
    .map((a) => ({ key: a.id, title: a.title, detail: a.detail, href: a.link }));
  if (ai.data && !ai.data.lastRun && ai.data.prompts?.length) {
    items.push({ key: 'ai', title: 'AI answer checks have never run.', detail: `${ai.data.prompts.length} questions are set up${ai.data.keySource ? '' : ' but no Anthropic key is set'}, so Studio can’t say whether assistants name you.`, href: `#/site/${site.id}/ai` });
  }
  if (!items.length) return null;
  return (
    <section class="nx-card nx-warn" aria-label="Needs you">
      <h2 class="nx-h2"><Icon name="triangle" size={16} /> {items.length === 1 ? '1 thing needs you' : `${items.length} things need you`}</h2>
      <ul class="nx-list">
        {items.map((i) => (
          <li key={i.key}><a href={i.href}><b>{i.title}</b> <span class="nx-dim">{i.detail}</span></a></li>
        ))}
      </ul>
    </section>
  );
}

function Traffic({ site, story, metrics, marks }) {
  const days = metrics?.days || [];
  const traffic = story.metric === 'sessions';
  return (
    <section class="nx-card" aria-label="Traffic">
      <SectionHead n="1" title="What happened" more={{ href: `#/site/${site.id}/timeline`, label: 'Timeline' }} />
      <p class={`nx-headline tone-${story.tone}`}>{story.headline}</p>
      {days.length > 1 && (
        <LineChart height={200}
          labels={days.map((d) => short(d.date))} dates={days.map((d) => d.date)}
          series={traffic
            ? [{ label: 'Visits', values: days.map((d) => d.sessions ?? NaN) }, { label: 'A usual day', values: days.map((d) => d.baseline ?? NaN) }]
            : [{ label: 'Search clicks', values: days.map((d) => d.clicks ?? NaN) }]}
          annotations={marks}
          onSelect={(i) => { location.hash = `/site/${site.id}/timeline?month=${days[i].date.slice(0, 7)}&day=${days[i].date}`; }} />
      )}
      <div class="nx-cols">
        <div>
          <div class="nx-label-sm">What moved it</div>
          {story.changes.length ? (
            <ul class="nx-list">
              {story.changes.map((c) => (
                <li key={c.kind + c.key}>
                  <a href={`#/site/${site.id}/${c.kind === 'query' ? 'search' : 'pages'}`}>{c.text}</a>
                  {c.cause && <Cause e={c.cause} lead="Around then" />}
                </li>
              ))}
            </ul>
          ) : <p class="nx-dim">No single source or page moved much.</p>}
        </div>
        <div>
          <div class="nx-label-sm">Days that stood out</div>
          {story.days.length ? (
            <ul class="nx-list">
              {story.days.map((d) => (
                <li key={d.date}>
                  <a href={`#/site/${site.id}/timeline?month=${d.date.slice(0, 7)}&day=${d.date}`}>{d.text}</a>
                  {d.events.map((e) => <Cause key={e.label + e.date} e={e} lead={e.date === d.date ? 'Same day' : 'Day before'} />)}
                  {!d.events.length && <span class="nx-cause nx-dim">Nothing you shipped around then.</span>}
                </li>
              ))}
            </ul>
          ) : <p class="nx-dim">Every day was close to a usual one for its weekday.</p>}
        </div>
      </div>
    </section>
  );
}

function Cause({ e, lead }) {
  const label = <><Icon name={KIND_ICON[e.kind] || 'star'} size={12} /> {lead}: {e.label}</>;
  return e.url
    ? <a class="nx-cause" href={e.url} target="_blank" rel="noreferrer">{label}</a>
    : <span class="nx-cause">{label}</span>;
}

function Sources({ site, rows, changes, range }) {
  if (!rows) return <section class="nx-card"><Loading height={160} /></section>;
  const max = Math.max(1, ...rows.map((r) => r.value || 0));
  const lead = changes.find((c) => c.kind === 'source');
  return (
    <section class="nx-card" aria-label="Who brings it">
      <SectionHead n="2" title="Who brings the visits" more={{ href: `#/site/${site.id}/pages?range=${range}`, label: 'All sources' }} />
      {lead && <p class="nx-lede">{lead.text}</p>}
      <div class="nx-table" role="table" aria-label="Visits by source">
        <div class="nx-tr nx-th" role="row"><span role="columnheader">Source</span><span role="columnheader">Visits</span><span role="columnheader">Change</span><span role="columnheader" aria-hidden="true" /></div>
        {rows.map((r) => (
          <div class="nx-tr" role="row" key={r.key}>
            <span role="cell"><b>{r.key}</b></span>
            <span role="cell" class="nx-num">{fmt(r.value)}</span>
            <span role="cell"><Change value={r.value} previous={r.previous} /></span>
            <span role="cell" class="nx-bar" aria-hidden="true"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <p class="nx-note">“Direct” is every visit without a referrer: typed links, app links and likely bots.</p>
    </section>
  );
}

function Landing({ site, rows, range }) {
  const search = useAsync(() => (site.modes?.search ? api.get(`/sites/${site.id}/search${qs({ range: '28d' })}`).catch(() => null) : null), [site.id]);
  if (!rows) return <section class="nx-card"><Loading height={160} /></section>;
  const top = search.data?.opportunities?.[0];
  return (
    <section class="nx-card" aria-label="Where they land">
      <SectionHead n="3" title="Where they land" more={{ href: `#/site/${site.id}/pages?range=${range}`, label: 'All pages' }} />
      <ul class="nx-rows">
        {rows.map((r) => (
          <li key={r.key}>
            <a href={`#/site/${site.id}/pages?range=${range}`}>
              <span class="nx-path">{capital(pageName(r.key))}</span>
              <span class="nx-num">{fmt(r.value)}</span>
              <Change value={r.value} previous={r.previous} />
            </a>
          </li>
        ))}
      </ul>
      {top && (
        <a class="nx-callout" href={`#/site/${site.id}/search`}>
          <Icon name="search" size={14} />
          <span>“{top.query}” is shown {fmt(top.impressions)} times at position {top.position.toFixed(1)}, but {(top.ctr * 100).toFixed(1)}% click. Last 28 days, from Search Console.</span>
        </a>
      )}
    </section>
  );
}

// The top journeys: where visits came from × where they landed × how many
// converted, with the biggest search opportunity under them.
function HowTheyCome({ site, range }) {
  const j = useJourneys(site, range);
  const search = useAsync(() => (site.modes?.search ? api.get(`/sites/${site.id}/search${qs({ range: '28d' })}`).catch(() => null) : null), [site.id]);
  if (j.config.data && !j.outcome) return null;
  if (j.data.error) return <section class="nx-card"><ErrorState error={j.data.error} onRetry={j.data.reload} /></section>;
  if (!j.data.data) return <section class="nx-card"><Loading height={180} /></section>;
  const top = j.journeys.filter((x) => x.name !== 'Your own site').slice(0, 4);
  const best = j.journeys.find((x) => x.converted);
  const opp = search.data?.opportunities?.[0];
  return (
    <section class="nx-card" aria-label="How they come">
      <SectionHead n="3" title="How they come" more={{ href: `#/site/${site.id}/journeys?range=${range}`, label: `All ${j.journeys.length} journeys` }} />
      {best && <p class="nx-lede">The strongest way in is {best.name} → {pageTitle(best.landing).replace(/^The/, 'the')}: {fmt(best.converted)} of its {fmt(best.sessions)} visits reached “{j.outcome.label}”.</p>}
      <ul class="nx-jlinks">
        {top.map((x) => (
          <li key={x.key}>
            <a href={`#/site/${site.id}/journeys?range=${range}&open=${encodeURIComponent(x.key)}`}>
              <span class="nx-jwho">
                <b>{x.name} <span class="nx-dim">→</span> {pageTitle(x.landing)}</b>
                <span class="nx-dim small">{x.landing === '/' ? site.host : x.landing}</span>
              </span>
              <span class="nx-stat"><b>{fmt(x.sessions)}</b><span class="nx-dim small">visits</span></span>
              <span class="nx-stat"><b class={x.converted ? 'good' : ''}>{fmt(x.converted)}</b><span class="nx-dim small">{x.sessions ? `${Math.round((x.converted / x.sessions) * 100)}% ` : ''}{j.outcome.label.toLowerCase()}</span></span>
              <Icon name="chevron" size={14} />
            </a>
          </li>
        ))}
      </ul>
      {opp && (
        <a class="nx-callout" href={`#/site/${site.id}/search`}>
          <Icon name="search" size={14} />
          <span>“{opp.query}” is shown {fmt(opp.impressions)} times at position {opp.position.toFixed(1)}, but {(opp.ctr * 100).toFixed(1)}% click. Last 28 days, from Search Console.</span>
        </a>
      )}
    </section>
  );
}

// Who reached the site's goal steps and left without the outcome, by device and
// system (BigQuery). The steps and outcome are the site's own goals from Setup.
const GROUP_COLOR = { 'Phones and tablets': 'var(--series-muted)', Chromebooks: 'var(--series-5)', Mac: 'var(--series-4)', Windows: 'var(--series-1)', Linux: 'var(--series-7)', Other: 'var(--border-strong)' };

function Leavers({ site, range }) {
  const config = useAsync(() => api.get(`/sites/${site.id}/config`).catch(() => null), [site.id]);
  const goals = config.data?.config?.goals || [];
  const outcome = goals.find((g) => g.source === 'event' && g.role === 'outcome');
  const steps = goals.filter((g) => g.source === 'event' && g.role === 'step');
  const ready = Boolean(outcome && steps.length);
  const data = useAsync(() => (ready ? api.get(`/sites/${site.id}/warehouse/leavers${qs({ range, steps: steps.map((g) => g.match).join(','), outcome: outcome.match })}`) : null),
    [site.id, range, ready && outcome.match, steps.map((g) => g.match).join()]);
  if (!config.data || !ready) return null;
  if (data.error) return <section class="nx-card"><ErrorState error={data.error} onRetry={data.reload} /></section>;
  if (!data.data) return <section class="nx-card"><Loading height={180} /></section>;

  const groups = data.data.groups;
  const left = groups.reduce((n, g) => n + g.left, 0);
  const converted = groups.reduce((n, g) => n + g.converted, 0);
  if (!left) return null;
  const desktop = config.data.config.kind === 'desktop';
  const cannot = desktop ? groups.filter((g) => g.group === 'Phones and tablets' || g.group === 'Chromebooks') : [];
  const cannotN = cannot.reduce((n, g) => n + g.left, 0);
  const biggest = groups.find((g) => !cannot.includes(g));
  // The step most leavers fired is "reaching"; the others are what they did next.
  const reach = steps.map((g) => ({ g, n: groups.reduce((t, x) => t + (x.steps[g.match] || 0), 0) })).sort((a, b) => b.n - a.n);
  const after = reach.slice(1).map((r) => r.g);
  const r = data.data.range;
  const since = r.firstDay && r.firstDay > r.start ? ` Since ${short(`${r.firstDay.slice(0, 4)}-${r.firstDay.slice(4, 6)}-${r.firstDay.slice(6)}`)}, when the BigQuery export starts.` : '';

  const reason = (g) => {
    const bits = [];
    if (desktop && g.group === 'Phones and tablets') bits.push('A desktop app can’t be installed here.');
    else if (desktop && g.group === 'Chromebooks') bits.push('A Chromebook can’t run a desktop app.');
    if (g.quick) bits.push(`${fmt(g.quick)} left within 10 seconds.`);
    for (const s of after) bits.push(`${fmt(g.steps[s.match] || 0)} ${s.label.charAt(0).toLowerCase() + s.label.slice(1)}.`);
    return bits.join(' ');
  };

  return (
    <section class="nx-card" aria-label="Why they don’t convert">
      <SectionHead n="4" title="Why they leave without converting" more={{ href: `#/site/${site.id}/sessions?range=${range}`, label: 'Sessions' }} />
      <p class="nx-lede">
        {fmt(left)} visits reached “{reach[0].g.label}” and left without “{outcome.label}”; {fmt(converted)} went on to it.
        {cannotN > 0 && ` ${fmt(cannotN)} were on phones, tablets or Chromebooks, where the app doesn’t run.`}
        {biggest && ` The biggest group that could have is ${biggest.group}: ${fmt(biggest.left)}, and ${fmt(biggest.quick)} of them left within 10 seconds.`}
      </p>
      <div class="nx-stack" role="img" aria-label={groups.map((g) => `${g.group} ${g.left}`).join(', ')}>
        {groups.map((g) => <span key={g.group} style={{ flex: `${g.left} 1 0`, background: GROUP_COLOR[g.group] }} />)}
      </div>
      <ul class="nx-leavers">
        {groups.map((g) => (
          <li key={g.group}>
            <span class="nx-swatch" style={{ background: GROUP_COLOR[g.group] }} aria-hidden="true" />
            <b class="nx-num">{fmt(g.left)}</b>
            <b>{g.group}</b>
            <span class="nx-dim">{reason(g)}</span>
          </li>
        ))}
      </ul>
      <p class="nx-note">From the site’s goals in Setup: “{reach[0].g.label}” counts as reaching, “{outcome.label}” as the outcome.{since}</p>
    </section>
  );
}

// What the visits led to: the site's outcome goals (Outcomes) and, after the
// download, the product's own usage from custom metrics. Without those it says
// what to connect instead of guessing.
const SOURCE_NOTE = {
  downloads: 'Release files downloaded from GitHub: files, not people.',
  installs: 'From the Chrome Web Store.',
  event: 'On the site, from GA4.',
};

function Results({ site, range }) {
  const products = useAsync(() => api.get('/products').catch(() => null), []);
  const product = products.data?.products?.find((p) => p.siteId === site.id);
  const out = useAsync(() => (product ? api.get(`/outcomes/${product.id}${qs({ range })}`).catch(() => null) : null), [product?.id, range]);
  const metrics = useAsync(() => api.get(`/sites/${site.id}/metrics${qs({ range })}`).catch(() => ({ metrics: [] })), [site.id, range]);
  if (!products.data || (product && !out.data && out.loading)) return <section class="nx-card"><Loading height={160} /></section>;
  const goals = (out.data?.goals?.list || []).filter((g) => g.role === 'outcome');
  const usage = metrics.data?.metrics || [];
  if (!goals.length && !usage.length) return null;
  const dated = goals.filter((g) => g.previous !== null && g.previous !== undefined);
  const lead = dated[0];

  return (
    <section class="nx-card" aria-label="What it led to">
      <SectionHead n="5" title="What it led to" more={product ? { href: `#/outcomes/${product.id}?range=${range}`, label: 'Outcomes' } : null} />
      {lead && (
        <p class="nx-lede">{dated.map((g) => `${fmt(g.count)} ${g.label.charAt(0).toLowerCase() + g.label.slice(1)} (${changeWords(g.count, g.previous)})`).join(', ')}.</p>
      )}
      <ul class="nx-rows nx-results">
        {goals.map((g) => (
          <li key={g.id}>
            <a href={product ? `#/outcomes/${product.id}?range=${range}` : '#/'}>
              <span class="nx-path"><b>{g.label}</b><span class="nx-dim small"> · {SOURCE_NOTE[g.source] || ''}</span></span>
              <span class="nx-num">{fmt(g.count)}</span>
              {g.previous === null || g.previous === undefined ? <span class="nx-dim small">no history</span> : <Change value={g.count} previous={g.previous} />}
            </a>
          </li>
        ))}
      </ul>
      <div class="nx-label-sm" style={{ marginTop: '6px' }}>Who keeps using it</div>
      {usage.length ? (
        <ul class="nx-rows nx-results">
          {usage.map((m) => (
            <li key={m.id}>
              <a href="#/account?tab=metrics">
                <span class="nx-path"><b>{m.label}</b>{m.error && <span class="bad small"> · {m.error.message}</span>}</span>
                <span class="nx-num">{m.error ? '–' : fmt(m.total)}</span>
                {m.error ? <span /> : <Change value={m.total} previous={m.previous} />}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <a class="nx-callout" href="#/account?tab=metrics">
          <Icon name="database" size={14} />
          <span>A download isn’t a user. Connect the app’s own numbers (launches, weekly active users, uninstalls, from a database such as Cloudflare D1) as custom metrics, and this shows who stays.</span>
        </a>
      )}
    </section>
  );
}

const changeWords = (value, previous) => (!previous ? 'none before' : previous * 4 < value ? `from ${fmt(previous)}` : `${value >= previous ? 'up' : 'down'} ${Math.abs(Math.round((value / previous - 1) * 100))}%`);

// Search Console's opportunities as actions. "Start" writes a note on the
// Timeline, so the day you acted sits on every chart from then on.
function NextSteps({ site }) {
  const search = useAsync(() => (site.modes?.search ? api.get(`/sites/${site.id}/search${qs({ range: '28d' })}`).catch(() => null) : null), [site.id]);
  const notes = useAsync(() => api.get(`/annotations${qs({ scope: `site:${site.id}`, author: 'you' })}`).catch(() => ({ annotations: [] })), [site.id]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const ops = byPage(search.data);
  if (!ops.length) return null;
  const started = new Map((notes.data?.annotations || []).filter((n) => n.label.startsWith('Started: ')).map((n) => [n.label.slice(9), n]));

  const title = (o) => o.type === 'low-ctr' && o.queries.length === 1
    ? `Win more clicks on “${o.queries[0].query}”`
    : `Rewrite the title and description of ${pageName(o.path)}`;
  const why = (o) => `${o.queries.map((q) => `“${q.query}”`).join(', ')}: shown ${fmt(o.impressions)} times at position ${o.position.toFixed(1)}; ${(o.ctr * 100).toFixed(1)}% click.`;
  const start = async (o) => {
    setBusy(o.path);
    setError('');
    try {
      await api.post('/annotations', { date: today(), label: `Started: ${title(o)}`.slice(0, 140), scope: `site:${site.id}`, body: why(o) });
      notes.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section class="nx-card nx-next" aria-label="What to do next">
      <SectionHead title="What to do next" more={{ href: `#/site/${site.id}/search`, label: 'All searches' }} />
      <p class="nx-dim">Ranked by the clicks each could win. Start one and it goes on the Timeline, so you can see whether it worked.</p>
      <div class="nx-actions">
        {ops.map((o, i) => {
          const done = started.get(title(o).slice(0, 131));
          return (
            <div class={`nx-action${done ? ' started' : ''}`} key={o.path}>
              <span class="nx-label-sm">{i + 1} · Get found</span>
              <b>{title(o)}</b>
              <span class="nx-dim">{why(o)}</span>
              <dl class="nx-kv"><dt>Worth</dt><dd class="good">about +{fmt(o.potential)} clicks a month</dd></dl>
              <div class="nx-action-row">
                <a class="nx-btn primary" href={`#/site/${site.id}/search`}>See the searches</a>
                {done
                  ? <a class="nx-btn done" href={`#/site/${site.id}/timeline?month=${done.date.slice(0, 7)}&day=${done.date}`}>✓ Started {short(done.date)}</a>
                  : <button type="button" class="nx-btn" disabled={busy === o.path} onClick={() => start(o)}>{busy === o.path ? 'Starting…' : 'Start'}</button>}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p class="nx-error" role="alert">{error}</p>}
    </section>
  );
}

// Search Console's opportunities, one per landing page: several searches that
// reach the same page are fixed by the same title and description.
function byPage(data) {
  if (!data?.opportunities?.length) return [];
  const pageOf = new Map();
  for (const qp of data.queryPages || []) if (!pageOf.has(qp.query) || pageOf.get(qp.query).impressions < qp.impressions) pageOf.set(qp.query, qp);
  const groups = new Map();
  for (const o of data.opportunities) {
    const path = pageOf.get(o.query)?.path || '';
    const g = groups.get(path) || { path, type: o.type, queries: [], impressions: 0, clicks: 0, weighted: 0, potential: 0 };
    g.queries.push(o);
    g.impressions += o.impressions;
    g.clicks += o.clicks;
    g.weighted += o.position * o.impressions;
    g.potential += o.potential || 0;
    if (o.type !== 'low-ctr') g.type = o.type;
    groups.set(path, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, position: g.weighted / Math.max(1, g.impressions), ctr: g.clicks / Math.max(1, g.impressions) }))
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 3);
}

// A path as a reader would name it: "/blog/best-dock-apps-windows" → "Best dock apps windows".
const pageTitle = (path) => {
  if (path === '/') return 'The home page';
  if (!path || path === '(not set)') return 'No page recorded';
  const slug = path.replace(/\/$/, '').split('/').pop().replace(/[-_]+/g, ' ').trim();
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : path;
};
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const pageName = (path) => (path === '/' ? 'the home page' : !path || path === '(not set)' ? 'no page recorded' : path);

// A change against the period before. From almost nothing, the starting
// number says more than a percentage does ("from 1", not "up 12200%").
function Change({ value, previous }) {
  if (!previous) return value ? <span class="good small">new</span> : <span class="nx-dim">–</span>;
  if (previous * 4 < value) return <span class="good small">from {fmt(previous)}</span>;
  const p = Math.round((value / previous - 1) * 100);
  if (!p) return <span class="nx-dim small">same</span>;
  return <span class={`${p > 0 ? 'good' : 'bad'} small`}>{p > 0 ? '↑' : '↓'} {Math.abs(p)}%</span>;
}

function SectionHead({ n, title, more }) {
  return (
    <div class="nx-section-head">
      <h2 class="nx-h2">{n && <span class="nx-step" aria-hidden="true">{n}</span>}{title}</h2>
      {more && <a class="nx-more" href={more.href}>{more.label} <Icon name="chevron" size={12} /></a>}
    </div>
  );
}
