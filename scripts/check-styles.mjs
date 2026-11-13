// Keeps Studio's styles on the design system (the SiteLens Studio Design
// System artifact): colours, font sizes and radii come from tokens, retired
// classes stay retired, every var(--x) exists, and inline spacing only shrinks.
//
//   npm run check-styles        lists problems, exits 1 if there are any
//
// test/styles.test.js runs the same check, so `npm test` fails on a regression.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'web/src');

// Classes the consolidation retired, with what replaced them.
export const RETIRED = {
  'nx-btn': '.btn', 'nx-tab': '.tabs a', 'nx-tabs': '.tabs', 'nx-field': 'label.field',
  'nx-dim': '.muted', 'nx-note': '.note', 'nx-card': 'card card-plain',
};

// Inline styles that set spacing with a literal (margin: '8px'…). Use the
// helpers (.m-0, .gap-8, .mt-4, .inset…) instead. Lower this as they go;
// never raise it.
export const MAX_INLINE_SPACING = 65;

// Files allowed raw colours: the logo is a drawing, not UI.
const COLOUR_OK = new Set(['components/Logo.jsx']);

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
const PX = /\d(?:\.\d+)?px\b/;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function stripComments(css) {
  // Keep line numbers: replace comments with the same number of newlines.
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}

// Rules for one stylesheet. Declarations of custom properties (--x: …) are
// where raw values belong, so they are skipped.
export function checkCss(text, file) {
  const out = [];
  const css = stripComments(text);
  const decl = /([a-z-]+)\s*:\s*([^;{}]+?)\s*(?=;|\})/g;
  for (const m of css.matchAll(decl)) {
    const [, prop, value] = m;
    if (prop.startsWith('--')) continue;
    const line = lineOf(css, m.index);
    const at = { file, line, text: `${prop}: ${value}`.trim() };
    if (COLOUR.test(value)) out.push({ ...at, rule: 'colour', fix: 'use a colour token: var(--text), var(--accent), var(--on-accent)…' });
    if (prop === 'font-size' && !/^(?:var\(--text-[a-z0-9]+\)|[\d.]+(?:em|%)|inherit|smaller|larger)$/.test(value.trim())) {
      out.push({ ...at, rule: 'font-size', fix: 'use var(--text-xs … --text-3xl), or em/% for relative sizes' });
    }
    if (/^border(?:-[a-z]+)*-radius$/.test(prop) && PX.test(value)) {
      out.push({ ...at, rule: 'radius', fix: 'use var(--radius-bar … --radius-pill), 0 or 50%' });
    }
  }
  out.push(...retiredIn(css, file, /\.([a-z][a-z0-9-]*)/g));
  return out;
}

// Rules for one component file: raw colours, font sizes and radii in inline
// styles, and retired class names.
export function checkJsx(text, file) {
  const out = [];
  const rules = [
    ['colour', COLOUR_OK.has(file) ? null : /['"`](?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^'"`]*)['"`]/g, 'use var(--…) colour tokens'],
    ['font-size', /fontSize:\s*['"`]?\d/g, "use 'var(--text-…)'"],
    ['radius', /borderRadius:\s*['"`][^'"`]*\dpx/g, "use 'var(--radius-…)', 0 or '50%'"],
  ];
  for (const [rule, re, fix] of rules) {
    if (!re) continue;
    for (const m of text.matchAll(re)) out.push({ file, line: lineOf(text, m.index), rule, text: m[0], fix });
  }
  out.push(...retiredIn(text, file, /(?<![\w-])(nx-[a-z0-9-]+)/g));
  return out;
}

function retiredIn(text, file, re) {
  const out = [];
  for (const m of text.matchAll(re)) {
    if (RETIRED[m[1]]) out.push({ file, line: lineOf(text, m.index), rule: 'retired', text: m[1], fix: `use ${RETIRED[m[1]]}` });
  }
  return out;
}

// var(--x) with no --x: anywhere. A name ending in "-" is a template prefix
// (`var(--series-${n})`), checked by its caller.
export function undefinedVars(files) {
  const all = files.map((f) => f.text).join('\n');
  const defined = new Set([
    ...[...all.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
    ...[...all.matchAll(/['"](--[a-z0-9-]+)['"]/g)].map((m) => m[1]),
  ]);
  const out = [];
  for (const f of files) {
    for (const m of f.text.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!defined.has(m[1]) && !m[1].endsWith('-')) {
        out.push({ file: f.file, line: lineOf(f.text, m.index), rule: 'undefined-var', text: m[1], fix: 'define it as a token, or use an existing one' });
      }
    }
  }
  return out;
}

export function inlineSpacingCount(files) {
  let n = 0;
  for (const f of files) {
    if (!f.file.endsWith('.jsx')) continue;
    for (const m of f.text.matchAll(/style=\{\{([^}]*)\}\}/g)) {
      if (/(?:margin|padding|gap)[A-Za-z]*:\s*['"`]?\d/.test(m[1])) n += 1;
    }
  }
  return n;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function loadFiles(src = SRC) {
  return walk(src)
    .filter((p) => /\.(css|jsx|js)$/.test(p))
    .map((p) => ({ file: relative(src, p), text: readFileSync(p, 'utf8') }));
}

export function checkStyles(files = loadFiles()) {
  const problems = [];
  for (const f of files) {
    if (f.file.endsWith('.css')) problems.push(...checkCss(f.text, f.file));
    else if (f.file.endsWith('.jsx')) problems.push(...checkJsx(f.text, f.file));
  }
  problems.push(...undefinedVars(files));
  const spacing = inlineSpacingCount(files);
  if (spacing > MAX_INLINE_SPACING) {
    problems.push({ file: '(all .jsx)', line: 0, rule: 'inline-spacing', text: `${spacing} inline spacing styles, limit ${MAX_INLINE_SPACING}`, fix: 'use .m-0, .gap-*, .mt-*/.mb-*, .inset, .pad-16' });
  }
  return { problems, spacing };
}

export function format(problems) {
  return problems.map((p) => `  ${p.file}:${p.line}  ${p.rule}  ${p.text}\n      → ${p.fix}`).join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { problems, spacing } = checkStyles();
  if (problems.length) {
    console.error(`\n${problems.length} style problem${problems.length === 1 ? '' : 's'}:\n\n${format(problems)}\n`);
    process.exit(1);
  }
  const room = MAX_INLINE_SPACING - spacing;
  console.log(`Styles follow the design system. Inline spacing: ${spacing} of ${MAX_INLINE_SPACING}${room > 0 ? ` (lower MAX_INLINE_SPACING to ${spacing})` : ''}.`);
}
