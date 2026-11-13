import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStyles, checkCss, checkJsx, undefinedVars, inlineSpacingCount, format, MAX_INLINE_SPACING } from '../scripts/check-styles.mjs';

test('the app follows the design system', () => {
  const { problems } = checkStyles();
  assert.equal(problems.length, 0, `\n${format(problems)}\nRun npm run check-styles for the list.`);
});

test('CSS: raw colours, font sizes and radii are caught; tokens and custom properties pass', () => {
  const css = `
    :root { --accent: #0f766e; --shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
    .ok { color: var(--accent); font-size: var(--text-sm); border-radius: var(--radius-md); }
    .rel { font-size: 0.9em; border-radius: 50%; }
    a:hover { color: var(--text); }
    @media (max-width: 640px) { .ok { padding: 8px; } }
    .bad1 { color: #fff; }
    .bad2 { box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); }
    .bad3 { font-size: 13px; }
    .bad4 { border-radius: 0 6px 6px 0; }
    /* .commented { color: #000; } */`;
  const found = checkCss(css, 'x.css').map((p) => `${p.rule}:${p.line}`);
  assert.deepEqual(found, ['colour:7', 'colour:8', 'font-size:9', 'radius:10']);
});

test('CSS and JSX: retired classes are caught', () => {
  assert.deepEqual(checkCss('.nx-btn { color: var(--text); } .nx-btnish { }', 'x.css').map((p) => p.text), ['nx-btn']);
  assert.deepEqual(checkJsx('<a class="nx-card nx-warn">', 'x.jsx').map((p) => p.text), ['nx-card']);
});

test('JSX: raw colours, font sizes and radii in inline styles are caught', () => {
  const jsx = `<i style={{ color: '#888', fontSize: '12px', borderRadius: '3px', background: 'var(--accent)' }} />
    <i style={{ borderRadius: '50%', fontSize: 'var(--text-sm)' }} />`;
  assert.deepEqual(checkJsx(jsx, 'x.jsx').map((p) => p.rule), ['colour', 'font-size', 'radius']);
  assert.equal(checkJsx(`fill="#fff" stop-color="#db562d"`, 'components/Logo.jsx').length, 0);
});

test('var(--x) must be defined somewhere; template prefixes pass', () => {
  const files = [
    { file: 'a.css', text: ':root { --mono: monospace; } .a { font-family: var(--mono); } .b { gap: var(--gap, 16px); }' },
    { file: 'b.jsx', text: "<i style={{ '--p-bg': '#fff', background: `var(--series-${n})`, color: 'var(--p-bg)' }} />" },
  ];
  assert.deepEqual(undefinedVars(files).map((p) => p.text), ['--gap']);
});

test('inline spacing is counted, and only goes down', () => {
  const files = [{ file: 'a.jsx', text: "<p style={{ margin: '8px 0' }} /><p style={{ width: '40%' }} /><p style={{ gap: 4 }} />" }];
  assert.equal(inlineSpacingCount(files), 2);
  assert.ok(MAX_INLINE_SPACING >= checkStyles().spacing);
});
