// To-dos from a check (Diagnose, or a check on a page's timeline): one for the whole run, or one per
// problem. Each is tied to the page (subject + link), so it shows on that page's timeline and Now, and
// keyed by `from`, so adding the same one twice hands back the one already there.

const hash = (text) => {
  let h = 5381;
  for (const c of String(text)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
};
const linkOf = (site, path) => `#/site/${site.id}/pages?article=${encodeURIComponent(path)}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// A problem worth a to-do: anything not marked fine.
export const isProblem = (f) => f && f.sev !== 'ok' && f.text;

const RUN_TITLE = {
  content: (n) => `Fix ${plural(n, 'content problem')}`,
  speed: () => 'Make it load faster on phones',
  index: () => 'Get it shown in Google and Bing',
  bots: () => 'Fix what search and AI crawlers get',
};

// tool: content | speed | index | bots; headline: the run's result; findings: [{ sev, text, note }].
export function runTodo({ site, path, tool, headline, findings = [], date = '' }) {
  const problems = findings.filter(isProblem);
  const title = (RUN_TITLE[tool] || (() => `Fix: ${headline}`))(problems.length);
  const detail = [
    `${headline}${date ? ` (checked ${date})` : ''}.`,
    ...problems.map((f) => `- ${f.text}`),
  ].join('\n').slice(0, 1990);
  return { title, detail, from: `check:${tool}:${path}`.slice(0, 300), link: linkOf(site, path), subject: { kind: 'page', key: path } };
}

// One problem as its own to-do. A missing search term reads as the thing to do.
export function findingTodo({ site, path, tool, finding }) {
  const m = /^“([^”]+)”.*never say (.+)\.$/.exec(finding.text);
  const title = m ? `Work “${m[1]}” into the title or a heading` : finding.text.replace(/[;:—].*$/, '').replace(/\.$/, '').slice(0, 190);
  return { title, detail: `${finding.text}${finding.note ? ` (${finding.note})` : ''}`, from: `check:${tool}:${path}:${hash(finding.text)}`.slice(0, 300), link: linkOf(site, path), subject: { kind: 'page', key: path } };
}
