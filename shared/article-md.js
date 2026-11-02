// Reading and rewriting the parts of an article's markdown that search
// results show: front matter fields, the first # heading (a title when the
// site uses it as one) and the lede (the first paragraph, often the meta
// description). Shared by the server (detection, publishing) and the editor
// (the title/description fields write straight into the markdown).

export function splitFrontMatter(md) {
  const text = String(md ?? '');
  const m = /^(﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?)/.exec(text);
  return m ? { head: m[1], body: text.slice(m[1].length) } : { head: '', body: text };
}

export function frontMatterValue(md, key) {
  const { head } = splitFrontMatter(md);
  const m = new RegExp(`^${key}\\s*:\\s*(.*)$`, 'mi').exec(head);
  if (!m) return undefined;
  const raw = m[1].trim();
  if (/^".*"$/.test(raw)) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return raw.replace(/^(['"])(.*)\1$/, '$2');
}

// Sets `key: value` in existing front matter (adds the line when missing).
export function setFrontMatter(md, key, value) {
  const { head, body } = splitFrontMatter(md);
  if (!head) return md;
  const line = `${key}: ${JSON.stringify(value)}`;
  const re = new RegExp(`^${key}\\s*:.*$`, 'mi');
  const next = re.test(head) ? head.replace(re, () => line) : head.replace(/\r?\n---\r?\n?$/, (end) => `\n${line}${end}`);
  return next + body;
}

// "# Title", or an emptied "# " so clearing the title field doesn't lose the heading.
const H1 = /^#(?:[ \t]+(.*)|)$/m;

// Only leading space is dropped: the editor reads this back on every keystroke,
// so trimming the end would eat the space just typed.
export function firstHeading(md) {
  return (H1.exec(splitFrontMatter(md).body)?.[1] || '').replace(/\r$/, '');
}

export function setFirstHeading(md, text) {
  const { head, body } = splitFrontMatter(md);
  return H1.test(body) ? head + body.replace(H1, () => `# ${text}`) : md;
}

export function headings(md) {
  return [...splitFrontMatter(md).body.matchAll(/^(#{1,3})[ \t]+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].trim() }));
}

// The first plain-text line after the first heading (or the front matter).
function ledeLine(body) {
  const lines = body.split('\n');
  const h = lines.findIndex((l) => /^#[ \t]/.test(l));
  for (let i = h + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^(#|\||[-*+] |>|!\[|<|```|Tags:)/.test(t)) return -1;
    return i;
  }
  return -1;
}

export function lede(md) {
  const { body } = splitFrontMatter(md);
  const i = ledeLine(body);
  return i < 0 ? '' : body.split('\n')[i].replace(/^\s+/, '').replace(/\r$/, '');
}

export function setLede(md, text) {
  const { head, body } = splitFrontMatter(md);
  const i = ledeLine(body);
  if (i < 0) return md;
  const lines = body.split('\n');
  lines[i] = text;
  return head + lines.join('\n');
}

// Loose equality for text that went through HTML (entities, curly quotes, spacing).
export function sameText(a, b) {
  const n = (s) => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
  return n(a) === n(b);
}

export function startsLike(long, short, min = 40) {
  const n = (s) => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
  const a = n(long);
  const b = n(short).replace(/(…|\.\.\.)$/, '');
  return b.length >= Math.min(min, a.length) && a.startsWith(b.slice(0, Math.max(min, Math.min(b.length, 120))));
}

// The editable value of a meta field, wherever it lives in the markdown.
export function metaValue(md, field, where) {
  if (where === 'frontmatter') return frontMatterValue(md, field) ?? '';
  if (where === 'heading') return firstHeading(md);
  if (where === 'lede') return lede(md);
  return null;
}

export function setMetaValue(md, field, where, value) {
  if (where === 'frontmatter') return setFrontMatter(md, field, value);
  if (where === 'heading') return setFirstHeading(md, value);
  if (where === 'lede') return setLede(md, value);
  return md;
}
