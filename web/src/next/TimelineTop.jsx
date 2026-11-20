import { useState } from 'preact/hooks';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Icon } from '../components/icons.jsx';
import { CommentBody } from '../components/ClaudeComments.jsx';

// The top of a site's Timeline, its home: Ask Claude, what's waiting on you, and
// setup that stops part of the story being told. (They were the Story's top,
// before the Timeline replaced the Story.)
const DAY = 86_400_000;
const addD = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const short = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Ask Claude: a question about this site, answered on the page by the analyst
// (the same tools the MCP server gives Claude Code). The answer is also kept as a
// Claude note on the day it's about, so it shows on the Timeline.
const ASKS = ['Why did visits change in this period?', 'Which page should I improve next?', 'Is traffic from AI tools worth it?'];

export function Ask({ site, span }) {
  const status = useAsync(() => api.get('/claude/status').catch(() => null), []);
  const [q, setQ] = useState('');
  const [state, setState] = useState(null); // { q, busy } | { q, answer } | { q, error }
  const hasKey = Boolean(status.data?.source);
  const today = new Date().toISOString().slice(0, 10);
  const from = span?.from || addD(today, -28);
  const to = span?.to || addD(today, -1);

  async function ask(question) {
    const text = question.trim();
    if (!text || state?.busy) return;
    setState({ q: text, busy: true });
    try {
      const out = await api.post(`/sites/${site.id}/claude/analyze`, { from, to, question: text });
      setState({ q: text, answer: out.comment });
      setQ('');
    } catch (err) {
      setState({ q: text, error: err.hint ? `${err.message} ${err.hint}` : err.message });
    }
  }

  return (
    <section class="card card-plain nx-ask" aria-label="Ask Claude">
      <form class="nx-askin" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <Icon name="chat" size={16} />
        <label class="sr-only" for="nx-ask-q">Ask Claude about {site.label}</label>
        <input id="nx-ask-q" type="text" maxLength={500} value={q} disabled={!hasKey || state?.busy}
          placeholder={`Ask anything about ${site.label}…`} onInput={(e) => setQ(e.currentTarget.value)} />
        {hasKey && q.trim() && <button type="submit" class="btn primary" disabled={state?.busy}>Ask</button>}
        {state && !state.busy && <button type="button" class="nx-link" onClick={() => setState(null)}>Clear</button>}
      </form>
      {!status.data ? null : !hasKey ? (
        <p class="muted small m-0">Claude answers here using the Anthropic key saved for AI answer checks. <a href="#/account?i=anthropic">Add a key</a></p>
      ) : state?.busy ? (
        <p class="nx-ask-answer"><b>{state.q}</b><span class="muted"> Claude is reading your numbers. This usually takes 20–60 seconds.</span></p>
      ) : state?.error ? (
        <p class="nx-ask-answer"><b>{state.q}</b> <span class="bad">{state.error}</span></p>
      ) : state?.answer ? (
        <div class="nx-ask-answer">
          <b>{state.answer.label}</b>
          {state.answer.body && <CommentBody text={state.answer.body} />}
          <a class="muted small" href={`#/site/${site.id}/timeline?month=${state.answer.date.slice(0, 7)}&day=${state.answer.date}`}>Kept as a Claude note on {short(state.answer.date)} →</a>
        </div>
      ) : (
        <div class="nx-chips">
          {ASKS.map((x) => <button key={x} type="button" class="nx-chip" onClick={() => ask(x)}>{x}</button>)}
        </div>
      )}
    </section>
  );
}

// One line for everything waiting on you here: alerts, to-dos and goals behind.
export function Waiting({ site, waiting }) {
  if (!waiting) return null;
  const n = waiting.alerts + waiting.todos + waiting.goals;
  if (!n) return null;
  const parts = [
    waiting.alerts && `${waiting.alerts} alert${waiting.alerts === 1 ? '' : 's'}`,
    waiting.todos && `${waiting.todos} to-do${waiting.todos === 1 ? '' : 's'}`,
    waiting.goals && `${waiting.goals} goal${waiting.goals === 1 ? '' : 's'} behind`,
  ].filter(Boolean);
  return (
    <a class="nx-needs" href={`#/site/${site.id}/inbox`}>
      <Icon name="inbox" size={16} />
      <span><b>{n} waiting on you</b> · {parts.join(', ')}</span>
      <span class="nx-needs-go">Inbox →</span>
    </a>
  );
}

// Setup that stops a part of the story from being told (not an alert, so not in the Inbox).
export function SetupNote({ site }) {
  const ai = useAsync(() => api.get(`/ai-search/sites/${site.id}/checks`).catch(() => null), [site.id]);
  if (!ai.data || ai.data.lastRun || !ai.data.prompts?.length) return null;
  return (
    <a class="nx-callout" href={`#/site/${site.id}/search?tab=ai`}>
      <Icon name="triangle" size={14} />
      <span><b>AI answer checks have never run.</b> {ai.data.prompts.length} questions are set up{ai.data.keySource ? '' : ' but no Anthropic key is set'}, so Kauzl can’t say whether assistants name you.</span>
    </a>
  );
}
