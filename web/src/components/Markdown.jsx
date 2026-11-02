// Markdown preview for article sources, built as elements (never innerHTML), so
// whatever is in a repo file can't run in the app. Covers what blog posts use:
// headings, paragraphs, lists, tables, quotes, code, rules, images, links and
// bold/italic/code inline. Relative links and images resolve against the site.

const INLINE = /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|<?(https?:\/\/[^\s<>)]+)>?)/;

function safeUrl(url, base) {
  try {
    const u = new URL(url, base);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

function Inline({ text, base }) {
  const out = [];
  let rest = String(text);
  let key = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) { out.push(rest); break; }
    if (m.index) out.push(rest.slice(0, m.index));
    const k = key++;
    if (m[2] !== undefined || m[3]) {
      const src = safeUrl(m[3], base);
      out.push(src ? <img key={k} src={src} alt={m[2]} loading="lazy" /> : `[image: ${m[2]}]`);
    } else if (m[4]) {
      const href = safeUrl(m[5], base);
      out.push(href ? <a key={k} href={href} target="_blank" rel="noreferrer"><Inline text={m[4]} base={base} /></a> : m[4]);
    } else if (m[6]) out.push(<code key={k}>{m[6]}</code>);
    else if (m[7] || m[8]) out.push(<strong key={k}><Inline text={m[7] || m[8]} base={base} /></strong>);
    else if (m[9] || m[10]) out.push(<em key={k}><Inline text={m[9] || m[10]} base={base} /></em>);
    else if (m[11]) out.push(<a key={k} href={m[11]} target="_blank" rel="noreferrer">{m[11]}</a>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function parseMarkdown(md) {
  const lines = String(md || '').replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^\s*(```|~~~)\s*(\S*)/.exec(line);
    if (fence) {
      const body = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
      blocks.push({ type: 'code', text: body.join('\n'), lang: fence[2] });
      i++;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ type: 'h', level: h[1].length, text: h[2].replace(/\s+#+\s*$/, '') }); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (c.endsWith(':') ? (c.startsWith(':') ? 'center' : 'right') : 'left'));
      const rows = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]));
      blocks.push({ type: 'table', head, align, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) body.push(lines[i].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', blocks: parseMarkdown(body.join('\n')) });
      continue;
    }
    const li = LIST.exec(line);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items = [];
      for (; i < lines.length; i++) {
        const m = LIST.exec(lines[i]);
        if (m && /\d/.test(m[2]) === ordered) items.push(m[3]);
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) items[items.length - 1] += ` ${lines[i].trim()}`;
        else break;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*(```|~~~)|\s*>)/.test(lines[i]) && !LIST.exec(lines[i]) && !lines[i].trim().startsWith('|'); i++) para.push(lines[i].trim());
    if (!para.length) { para.push(lines[i].trim()); i++; }
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

function Blocks({ blocks, base }) {
  return blocks.map((b, i) => {
    if (b.type === 'h') { const H = `h${b.level}`; return <H key={i}><Inline text={b.text} base={base} /></H>; }
    if (b.type === 'p') return <p key={i}><Inline text={b.text} base={base} /></p>;
    if (b.type === 'hr') return <hr key={i} />;
    if (b.type === 'code') return <pre key={i}><code>{b.text}</code></pre>;
    if (b.type === 'quote') return <blockquote key={i}><Blocks blocks={b.blocks} base={base} /></blockquote>;
    if (b.type === 'ul' || b.type === 'ol') { const L = b.type; return <L key={i}>{b.items.map((t, j) => <li key={j}><Inline text={t} base={base} /></li>)}</L>; }
    if (b.type === 'table') {
      return (
        <div class="table-wrap" key={i}>
          <table>
            <thead><tr>{b.head.map((c, j) => <th key={j} style={{ textAlign: b.align[j] }}><Inline text={c} base={base} /></th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{b.head.map((_, k) => <td key={k} style={{ textAlign: b.align[k] }}><Inline text={r[k] || ''} base={base} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    return null;
  });
}

// base: the article's live URL, for relative links and images.
export function Markdown({ text, base }) {
  return <div class="md-preview"><Blocks blocks={parseMarkdown(text)} base={base} /></div>;
}
