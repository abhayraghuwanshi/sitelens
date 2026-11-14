import { useEffect, useState } from 'preact/hooks';
import { formatNumber, formatPercent } from '@shared/format.js';
import { api, qs } from '../api.js';
import { useAsync, withParam } from '../hooks.js';
import { Card, KpiStrip, Loading, ErrorState, Empty } from '../components/ui.jsx';

// Reddit cycles (server/reddit-cycles.mjs): Claude researches where the site's
// readers are on Reddit and drafts posts, you post them yourself with a tagged
// link, and each post is measured in Reddit (upvotes, comments, removals) and
// GA4 (visits, stayed, acted). The next round's research starts from that.
// Views are URL-driven: ?kind=reddit, plus &post=<id> for one draft or &view=plan.
const VERDICTS = {
  worked: { label: 'Worked', tone: 'good' },
  some: { label: 'Some traction', tone: 'warn' },
  running: { label: 'Still running', tone: 'idle' },
  flopped: { label: 'Flopped', tone: 'bad' },
  removed: { label: 'Removed', tone: 'bad' },
};
const CALLS = {
  keep: { label: 'Keep posting', tone: 'good', title: 'At least one post here worked' },
  retry: { label: 'Try another angle', tone: 'warn', title: 'Some traction, nothing that clearly worked yet' },
  drop: { label: 'Drop it', tone: 'bad', title: 'Every settled post here flopped or was removed' },
  wait: { label: 'Too early', tone: 'idle', title: 'Its posts are under two days old' },
};
const num = (v) => (v ? formatNumber(v) : <span class="muted">0</span>);
const shortDate = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const go = (key, value) => { location.hash = withParam(key, value); };
const back = () => { location.hash = withParam('view', '', withParam('post', '')); };

export function RedditCycles({ site, params }) {
  const [fresh, setFresh] = useState(false);
  const data = useAsync(() => api.get(`/sites/${site.id}/reddit-cycles${qs({ fresh: fresh ? '1' : '' })}`), [site.id, fresh]);
  const d = data.data;
  // While Claude researches, check every few seconds until the plan lands.
  useEffect(() => {
    if (!d?.research) return undefined;
    const t = setInterval(() => data.reload(), 5000);
    return () => clearInterval(t);
  }, [Boolean(d?.research)]);

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!d) return <Loading height={360} />;
  const open = params?.get('post');
  if (open) {
    const item = d.items.find((x) => x.id === open);
    return item ? <PostView site={site} item={item} demo={d.demo} onSaved={data.reload} /> : <Empty title="That draft is gone">It was removed from this site’s Reddit cycles. <a href="#" onClick={(e) => { e.preventDefault(); back(); }}>Back to the list</a></Empty>;
  }
  if (params?.get('view') === 'plan') return <PlanView site={site} d={d} onStarted={() => { back(); data.reload(); }} />;
  if (!d.rounds.length && !d.research) return <Start site={site} d={d} />;
  return <Board site={site} d={d} onCheck={() => (fresh ? data.reload() : setFresh(true))} />;
}

function Needs({ d }) {
  const notes = [];
  if (d.needs.ai) notes.push(<>Add an Anthropic API key in <a href="#/settings?i=anthropic">Settings → Claude</a>: Claude does the research.</>);
  if (d.needs.reddit) notes.push(<>Connect a Reddit app in <a href="#/settings?i=mentions">Settings → Mentions</a>: research reads subreddits and their rules, and monitoring reads each post’s upvotes.</>);
  if (d.needs.ga4) notes.push(<>No GA4 property is linked, so visits and “acted” stay at 0.</>);
  return notes.length ? <div class="stack gap-4 mt-12">{notes.map((n, i) => <p key={i} class="note m-0">{n}</p>)}</div> : null;
}

function Start({ site, d }) {
  return (
    <Card title="Bring readers from Reddit, in rounds" sub="Research, post, measure, repeat">
      <ol class="cycle-steps">
        <li><b>Research.</b> Claude reads your pages and what people search for, finds the subreddits where those readers are, reads their rules and what they upvote, and drafts posts aimed at each one.</li>
        <li><b>Post.</b> You post each draft yourself, with its own tagged link so GA4 counts exactly what it brought. Kauzl never posts for you: each community’s rules need a human read.</li>
        <li><b>Measure.</b> Upvotes, comments and removals from Reddit; visits, readers who stayed and readers who acted from GA4. After two days each post gets a verdict, and each subreddit a call: keep posting, try another angle, or drop it.</li>
        <li><b>Next round.</b> The next research starts from what worked.</li>
      </ol>
      <Needs d={d} />
      <div class="row mt-12 gap-8">
        <button class="btn primary" type="button" disabled={d.needs.ai || d.needs.reddit || d.demo} onClick={() => go('view', 'plan')}>Plan the first round</button>
      </div>
    </Card>
  );
}

function PlanView({ site, d, onStarted }) {
  const [focus, setFocus] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const n = (d.rounds.at(-1)?.n || 0) + 1;
  const start = async () => {
    setBusy(true);
    setMsg('');
    try {
      await api.post(`/sites/${site.id}/reddit-cycles/research`, { focus });
      onStarted();
    } catch (err) {
      setMsg(err.hint ? `${err.message} ${err.hint}` : err.message);
      setBusy(false);
    }
  };
  return (
    <div class="stack gap-12">
      <div class="meta-line items-center">
        <a class="btn ghost" href="#" onClick={(e) => { e.preventDefault(); back(); }}>← Reddit cycle</a>
        <span class="muted small">Plan round {n}</span>
      </div>
      <Card title={`Research round ${n} with Claude`} sub="Takes a few minutes and uses API credits">
        <p class="m-0">{n === 1 ? 'Claude reads the site, finds the subreddits where its readers are, and drafts 3 to 6 posts.' : `Claude starts from what rounds 1 to ${n - 1} brought (${formatNumber(d.totals.posts)} posts, ${formatNumber(d.totals.visits)} visits, ${formatNumber(d.totals.acted)} who acted), keeps what worked and drops what didn’t.`}</p>
        <label class="field mt-12">
          <span class="field-label">Focus <small>optional</small></span>
          <textarea rows="3" value={focus} maxLength={500} placeholder="e.g. the new Windows release, or founders who just launched" onInput={(e) => setFocus(e.currentTarget.value)} />
        </label>
        <Needs d={d} />
        <div class="row mt-12 gap-8">
          <button class="btn primary" type="button" disabled={busy || d.needs.ai || d.needs.reddit || d.demo} onClick={start}>Start research</button>
          <button class="btn ghost" type="button" onClick={back}>Cancel</button>
        </div>
        {msg && <p class="note">{msg}</p>}
      </Card>
    </div>
  );
}

function Board({ site, d, onCheck }) {
  const t = d.totals;
  const round = d.rounds.at(-1);
  const posted = d.items.filter((x) => x.status === 'posted');
  const ideas = d.items.filter((x) => x.status === 'idea');
  const skipped = d.items.filter((x) => x.status === 'skipped');
  const errors = Object.entries(d.errors || {});
  return (
    <>
      <div class="meta-line items-center">
        <span>{round ? `Round ${round.n}, planned ${shortDate(round.createdAt)}` : 'First round'}</span>
        <span class="spacer" />
        <button class="btn ghost" type="button" disabled={!posted.length || d.demo} onClick={onCheck} title="Read every post’s upvotes and comments from Reddit, and match drafts you posted from your account">Check Reddit now</button>
        <button class="btn" type="button" disabled={Boolean(d.research) || d.demo} onClick={() => go('view', 'plan')}>Plan round {(round?.n || 0) + 1}</button>
      </div>
      {d.demo && <p class="note m-0">A sample Reddit cycle: open one of your own sites to run a real one.</p>}
      {d.research && <p class="note m-0">Claude is researching round {(round?.n || 0) + 1}: {d.research.note.toLowerCase()} ({formatNumber(d.research.steps)} steps so far). The plan appears here when it’s done.</p>}
      {d.failed && <p class="note m-0">The last research didn’t finish: {d.failed.message} {d.failed.hint}</p>}
      {errors.map(([k, v]) => <p key={k} class="note m-0">{k === 'ga4' ? 'GA4' : 'Reddit'}: {v}</p>)}
      <Needs d={{ needs: { ...d.needs, ai: false } }} />

      <KpiStrip items={[
        { label: 'Posted', value: formatNumber(t.posts), meta: `${formatNumber(t.ideas)} draft${t.ideas === 1 ? '' : 's'} waiting` },
        { label: 'Upvotes', value: formatNumber(t.score), meta: `${formatNumber(t.comments)} comments` },
        { label: 'Visits', value: formatNumber(t.visits), meta: t.visits ? `${formatPercent(t.engaged / t.visits, 0)} stayed` : 'from the tagged links', help: 'GA4 sessions whose campaign is one of these posts’ tagged links.' },
        { label: 'Acted', value: formatNumber(t.acted), meta: d.goals.length ? d.goals.map((g) => g.replace(/_/g, ' ')).join(', ') : 'no goal event found', help: 'Users from these posts who fired one of the site’s goal events.' },
      ]} />

      {round && (
        <Card title={`Round ${round.n} strategy`} sub={`Researched by Claude on ${shortDate(round.createdAt)}`}>
          <p class="m-0 todo-detail">{round.summary}</p>
          {round.subreddits.length > 0 && (
            <ul class="mt-12 m-0">
              {round.subreddits.map((s) => <li key={s.name}><a href={`https://www.reddit.com/r/${s.name}/`} target="_blank" rel="noreferrer">r/{s.name}</a>: {s.why} <span class="small muted">Rules: {s.rules}</span></li>)}
            </ul>
          )}
        </Card>
      )}

      {ideas.length > 0 && <PostTable title="Ready to post" sub="Open one to copy it and post it on Reddit" items={ideas} />}
      {posted.length > 0 && <PostTable title="Posted" sub="Each post’s Reddit numbers and the visits its link brought" items={[...posted].reverse()} measured />}
      {d.subreddits.length > 0 && <Subreddits rows={d.subreddits} />}
      {skipped.length > 0 && <PostTable title="Skipped" sub="Claude won’t propose these again" items={skipped} />}
    </>
  );
}

function PostTable({ title, sub, items, measured = false }) {
  return (
    <Card title={title} sub={sub} flush>
      <div class="table-wrap">
        <table class="data review">
          <thead>
            <tr>
              <th>Post</th>
              <th>Subreddit</th>
              {measured ? <>
                <th class="num">Upvotes</th><th class="num">Comments</th><th class="num">Visits</th><th class="num">Stayed</th><th class="num">Acted</th><th>Verdict</th>
              </> : <><th>Angle</th><th>Round</th></>}
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td class="cell-path"><a class="review-page" href={`#${withParam('post', x.id)}`}>{x.title}</a></td>
                <td>r/{x.subreddit}</td>
                {measured ? <>
                  <td class="num">{x.score === null ? <span class="muted">—</span> : num(x.score)}</td>
                  <td class="num">{x.comments === null ? <span class="muted">—</span> : num(x.comments)}</td>
                  <td class="num">{num(x.visits)}</td>
                  <td class="num">{x.visits ? formatPercent(x.engaged / x.visits, 0) : '—'}</td>
                  <td class="num">{num(x.acted)}</td>
                  <td><span class={`rv-tag ${VERDICTS[x.verdict]?.tone || ''}`} title={x.why}>{VERDICTS[x.verdict]?.label || x.verdict}</span></td>
                </> : <><td class="small">{x.angle}</td><td class="small muted">#{x.round}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Subreddits({ rows }) {
  return (
    <Card title="By subreddit" sub="Where to keep posting, across every round" flush>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Subreddit</th><th class="num">Posts</th><th class="num">Upvotes</th><th class="num">Visits</th><th class="num">Acted</th><th>Call</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.subreddit}>
                <td><a href={`https://www.reddit.com/r/${s.subreddit}/`} target="_blank" rel="noreferrer">r/{s.subreddit}</a></td>
                <td class="num">{formatNumber(s.posts)}</td>
                <td class="num">{num(s.score)}</td>
                <td class="num">{num(s.visits)}</td>
                <td class="num">{num(s.acted)}</td>
                <td><span class={`rv-tag ${CALLS[s.call].tone}`} title={CALLS[s.call].title}>{CALLS[s.call].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Copy({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <button class="btn ghost" type="button" onClick={async () => {
      await navigator.clipboard?.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    }}>{done ? 'Copied' : label}</button>
  );
}

// One draft as its own view: copy it, open Reddit's submit page, then paste the post's URL back.
function PostView({ site, item: x, demo, onSaved }) {
  const [title, setTitle] = useState(x.title);
  const [body, setBody] = useState(x.body);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (path, payload, after) => {
    setBusy(true);
    setMsg('');
    try {
      await api.post(`/sites/${site.id}/reddit-cycles/${path}`, { id: x.id, ...payload });
      onSaved();
      after?.();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };
  const changed = title !== x.title || body !== x.body;
  const submit = `https://www.reddit.com/r/${x.subreddit}/submit?${new URLSearchParams({ title, selftext: 'true', text: body })}`;
  return (
    <div class="stack gap-12">
      <div class="meta-line items-center">
        <a class="btn ghost" href="#" onClick={(e) => { e.preventDefault(); back(); }}>← Reddit cycle</a>
        <span class="muted small">Round {x.round} · r/{x.subreddit}{x.angle ? ` · ${x.angle}` : ''}</span>
      </div>

      {x.status === 'posted' && (
        <Card title={<><span class={`rv-tag ${VERDICTS[x.verdict]?.tone || ''}`}>{VERDICTS[x.verdict]?.label}</span> on r/{x.subreddit}</>} sub={x.postedAt ? `Posted ${shortDate(x.postedAt)}` : ''}
          actions={<a class="btn ghost" href={x.permalink} target="_blank" rel="noreferrer">Open on Reddit</a>}>
          <KpiStrip items={[
            { label: 'Upvotes', value: x.score === null ? '—' : formatNumber(x.score), meta: x.ratio ? `${formatPercent(x.ratio, 0)} upvoted` : '' },
            { label: 'Comments', value: x.comments === null ? '—' : formatNumber(x.comments) },
            { label: 'Visits', value: formatNumber(x.visits), meta: x.visits ? `${formatPercent(x.engaged / x.visits, 0)} stayed` : 'from its link' },
            { label: 'Acted', value: formatNumber(x.acted) },
          ]} />
          <p class="mb-0">{x.why}</p>
        </Card>
      )}

      <Card title={x.status === 'posted' ? 'What was posted' : 'The draft'} sub={x.why && x.status !== 'posted' ? x.why : ''}>
        {x.status === 'posted' ? (
          <>
            <h3 class="m-0">{x.title}</h3>
            <p class="post-text mt-8">{x.body}</p>
          </>
        ) : (
          <>
            <label class="field">
              <span class="field-label">Title</span>
              <input type="text" value={title} maxLength={300} onInput={(e) => setTitle(e.currentTarget.value)} />
            </label>
            <label class="field mt-12">
              <span class="field-label">Text</span>
              <textarea rows="12" value={body} onInput={(e) => setBody(e.currentTarget.value)} />
            </label>
          </>
        )}
        <dl class="small mt-12 mb-0">
          <dt class="muted">Link</dt>
          <dd class="m-0"><code class="break-any">{x.link || x.page}</code></dd>
          <dt class="muted mt-8">Where the link goes</dt>
          <dd class="m-0">{x.linkAdvice || 'Wherever the rules allow.'}</dd>
          {x.flair && <><dt class="muted mt-8">Flair</dt><dd class="m-0">{x.flair}</dd></>}
        </dl>
        {x.status !== 'posted' && (
          <div class="row wrap mt-12 gap-8">
            {changed && <button class="btn" type="button" disabled={busy || demo} onClick={() => run('draft', { title, body })}>Save changes</button>}
            <Copy text={title} label="Copy title" />
            <Copy text={body} label="Copy text" />
            {x.link && <Copy text={x.link} label="Copy link" />}
            <a class="btn primary" href={submit} target="_blank" rel="noreferrer">Post on r/{x.subreddit}</a>
          </div>
        )}
      </Card>

      {x.status === 'idea' && (
        <Card title="Posted it?" sub="Paste the post’s URL so Kauzl can follow it. Posts from your Reddit account in My posts are found on their own.">
          <div class="row wrap gap-8 items-center">
            <input type="url" value={url} placeholder="https://www.reddit.com/r/…/comments/…" aria-label="Reddit post URL" onInput={(e) => setUrl(e.currentTarget.value)} />
            <button class="btn primary" type="button" disabled={busy || demo || !url.trim()} onClick={() => run('posted', { url })}>Mark posted</button>
            <span class="spacer" />
            <button class="btn ghost" type="button" disabled={busy || demo} onClick={() => run('status', { status: 'skipped' }, back)}>Skip this one</button>
          </div>
        </Card>
      )}
      {x.status === 'skipped' && (
        <div class="row gap-8"><button class="btn" type="button" disabled={busy || demo} onClick={() => run('status', { status: 'idea' })}>Bring it back</button></div>
      )}
      {x.status === 'posted' && (
        <div class="row gap-8"><button class="btn ghost" type="button" disabled={busy || demo} onClick={() => run('status', { status: 'idea' })} title="Unlink the Reddit post, e.g. if you pasted the wrong URL">Not posted after all</button></div>
      )}
      {msg && <p class="note">{msg}</p>}
    </div>
  );
}
