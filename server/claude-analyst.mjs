// "Analyze with Claude": Claude reads a site's numbers through the same tools
// the MCP server gives local agents, then saves one comment (a Claude note) on
// the day its main finding is about. Runs on the Anthropic key saved for AI
// search checks (Settings → Claude, or ANTHROPIC_API_KEY).
//
// The tools call this server's own JSON API over HTTP, exactly as the MCP
// server does, so there is one implementation of every read.

import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, createMcp } from './mcp.mjs';
import { aiKeyError } from './ai-search.mjs';
import { EngineError } from './engines.mjs';

export const ANALYST_MODEL = 'claude-opus-5-5';
const MAX_TURNS = 12;
const RESULT_CHARS = 60_000; // one tool result; a 500-row query can be large
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// list_comments stays in: Claude checks what it already said before repeating it.
const READ_TOOLS = TOOLS.filter((t) => !t.write);

const SAVE_TOOL = {
  name: 'save_comment',
  description: 'Save your analysis as a comment in SiteLens Studio. Call it exactly once, when you are done. It appears as a Claude marker on the day you give, on every trend chart and in the Calendar.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      date: { type: 'string', description: 'The day the main finding is about (YYYY-MM-DD), inside the range you were given.' },
      title: { type: 'string', description: 'One line under 140 characters that states the finding, with its key number.' },
      body: { type: 'string', description: 'The analysis in plain text, under 1,500 characters. Short paragraphs; lines starting with "- " show as bullets.' },
    },
    required: ['date', 'title', 'body'],
  },
};

const SYSTEM = `You are the analyst inside SiteLens Studio, a local analytics dashboard. The owner asked you to look at one of their sites and leave a comment in the app.

Use the tools to read the data. Start from daily_metrics for the range, use events to find what happened (releases, deploys, posts, mentions, notes), and day_story or breakdown to explain the days that moved. Call list_comments first so you don't repeat an earlier comment. Use schema and query only when the other tools can't answer.

Write for the site's owner:
- Lead with what changed and why, with the numbers (sessions, % vs the usual weekday, the sources or pages behind it).
- Tie changes to dated events only when the dates line up; say when a cause is a guess.
- If the data is thin or missing, say what is missing instead of guessing.
- End with one concrete thing worth doing next, when the data supports one.

When you are done, call save_comment once. Don't write the analysis as a normal reply; it is only kept through save_comment.`;

function toolDefs() {
  return [
    ...READ_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
    SAVE_TOOL,
  ];
}

function task({ site, from, to, date, question, today }) {
  const where = `Site: ${site.label} (id "${site.id}", ${site.host || 'no host'}${site.demo ? ', the built-in demo site with generated data' : ''}). Pass site "${site.id}" to the tools.`;
  const when = date
    ? `Look at ${date}: how it compared with a typical day and why. Use the two weeks before it for context. Save the comment on ${date}.`
    : `Look at ${from} to ${to}: the overall trend, the days that stood out, and why.`;
  return [where, when, question ? `The owner's question: ${question}` : '', `Today is ${today}.`].filter(Boolean).join('\n');
}

const truncate = (text) => (text.length > RESULT_CHARS ? `${text.slice(0, RESULT_CHARS)}\n…(cut at ${RESULT_CHARS} characters; ask for fewer rows)` : text);

export function createAnalyst({ store, annotations, baseUrl, env = process.env, fetchImpl = fetch, now = Date.now, createClient = (apiKey) => new Anthropic({ apiKey }) }) {
  const mcp = createMcp({ baseUrl, dataDir: store.dir, fetchImpl });
  const running = new Set(); // site ids with an analysis in flight

  async function keyInfo() {
    const saved = (await store.get()).sources?.anthropicKey || '';
    return { key: saved || env.ANTHROPIC_API_KEY || '', source: saved ? 'settings' : env.ANTHROPIC_API_KEY ? 'env' : '' };
  }

  async function status() {
    const { source } = await keyInfo();
    return { source, model: ANALYST_MODEL, running: [...running] };
  }

  async function analyze(site, input = {}) {
    const date = String(input.date || '');
    const from = String(input.from || '');
    const to = String(input.to || '');
    const question = String(input.question || '').trim().slice(0, 500);
    if (date ? !DATE.test(date) : !(DATE.test(from) && DATE.test(to) && from <= to)) {
      throw new EngineError('Pass a day (date) or a range (from, to) as YYYY-MM-DD.', { kind: 'validation' });
    }
    const { key } = await keyInfo();
    if (!key) throw new EngineError('Add an Anthropic API key first.', { status: 400, kind: 'ai-key', hint: 'Settings → Integrations → Claude.' });
    if (running.has(site.id)) throw new EngineError('Claude is already analyzing this site. Wait for it to finish.', { status: 409, kind: 'busy' });

    running.add(site.id);
    try {
      return await run(createClient(key), site, { date, from, to, question });
    } catch (err) {
      throw aiKeyError(err);
    } finally {
      running.delete(site.id);
    }
  }

  async function run(client, site, args) {
    const today = new Date(now()).toISOString().slice(0, 10);
    const tools = toolDefs();
    const messages = [{ role: 'user', content: task({ site, ...args, today }) }];
    const usage = { input: 0, output: 0, cacheRead: 0 };
    let model = ANALYST_MODEL;
    let nudged = false;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await client.beta.messages.create({
        model: ANALYST_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        // Each turn resends the whole conversation; cache it.
        cache_control: { type: 'ephemeral' },
        system: SYSTEM,
        tools,
        messages,
      });
      usage.input += res.usage?.input_tokens || 0;
      usage.output += res.usage?.output_tokens || 0;
      usage.cacheRead += res.usage?.cache_read_input_tokens || 0;
      model = res.model || model;
      if (res.stop_reason === 'refusal') throw new EngineError('Claude declined to analyze this.', { kind: 'ai-refusal' });
      if (res.stop_reason === 'max_tokens') throw new EngineError('Claude’s answer ran too long. Try a shorter range.', { kind: 'ai' });
      messages.push({ role: 'assistant', content: res.content });

      const calls = res.content.filter((b) => b.type === 'tool_use');
      if (!calls.length) {
        // Finished in plain text without saving: ask once, then keep the text.
        const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (!nudged) {
          nudged = true;
          messages.push({ role: 'user', content: 'Save your analysis now with save_comment.' });
          continue;
        }
        if (!text) throw new EngineError('Claude finished without an analysis. Try again.', { kind: 'ai' });
        return finish(site, args, { date: args.date || args.to, title: text.split('\n')[0].slice(0, 140), body: text }, { model, usage, turns: turn + 1 });
      }

      const save = calls.find((c) => c.name === 'save_comment');
      if (save) return finish(site, args, save.input, { model, usage, turns: turn + 1 });

      // All results go back in one user message, in call order.
      const results = await Promise.all(calls.map(async (c) => {
        const out = await mcp.callTool(c.name, c.input || {});
        return { type: 'tool_result', tool_use_id: c.id, content: truncate(out.content.map((x) => x.text).join('\n')), ...(out.isError ? { is_error: true } : {}) };
      }));
      messages.push({ role: 'user', content: results });
    }
    throw new EngineError(`Claude didn’t finish within ${MAX_TURNS} steps. Try a shorter range or a narrower question.`, { kind: 'ai' });
  }

  async function finish(site, args, input, meta) {
    const lo = args.date || args.from;
    const hi = args.date || args.to;
    const day = DATE.test(input.date) && input.date >= addDays(lo, -14) && input.date <= hi ? input.date : hi;
    const comment = await annotations.addNote({
      date: day,
      label: String(input.title || 'Claude’s analysis').slice(0, 140),
      body: String(input.body || '').slice(0, 4000),
      author: 'claude',
      via: 'app',
      model: meta.model,
      scope: `site:${site.id}`,
    });
    return { comment: { ...comment, kind: 'claude', source: 'notes' }, usage: meta.usage, turns: meta.turns };
  }

  return { analyze, status };
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function analystRoutes({ analyst, siteOr404 }) {
  return [
    ['GET', /^\/api\/claude\/status$/, async () => analyst.status()],
    ['POST', /^\/api\/sites\/([\w-]+)\/claude\/analyze$/, async ({ match, body }) => analyst.analyze(await siteOr404(match[1]), body || {})],
  ];
}
