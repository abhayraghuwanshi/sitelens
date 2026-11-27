import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEAT, CHANGE_TONE, changeTone, mix, amountFill, peakFill, shareFill, changeFill, amountLegendStops, changeLegendStops } from '../web/src/next/heatmap.js';

// The previous inline `fill()` formulas, kept here so the refactor is proven
// to emit byte-identical CSS for valid inputs.
const oldAmount = (v, max, color = 'var(--accent)') => (v ? `background:color-mix(in srgb, ${color} ${Math.round(6 + (v / max) * 64)}%, var(--surface))` : '');
const oldPeak = (value, peak, color) => (value > 0 ? `background:color-mix(in srgb, ${color} ${Math.round(6 + value / peak * 64)}%, var(--surface))` : '');
const oldShare = (share, color) => `background:color-mix(in srgb, ${color} ${Math.round(Math.min(share * 130, 72))}%, var(--surface))`;
const oldChange = (c) => {
  const a = Math.min(Math.abs(c), 0.6);
  return a < 0.05 ? '' : `background:color-mix(in srgb, var(${c > 0 ? '--good-ink' : '--critical-ink'}) ${Math.round(8 + (a / 0.6) * 34)}%, var(--surface))`;
};

test('mix clamps percentage to [0,100] and keeps tokens', () => {
  assert.equal(mix('var(--accent)', 6), 'background:color-mix(in srgb, var(--accent) 6%, var(--surface))');
  assert.equal(mix('var(--accent)', -5), 'background:color-mix(in srgb, var(--accent) 0%, var(--surface))');
  assert.equal(mix('var(--accent)', 999), 'background:color-mix(in srgb, var(--accent) 100%, var(--surface))');
  assert.equal(mix('var(--accent)', 50, 'var(--surface-2)', 'oklab'), 'background:color-mix(in oklab, var(--accent) 50%, var(--surface-2))');
});

test('amountFill matches the previous daily-totals mapping; empty on <=0 / non-finite', () => {
  for (const max of [1, 3, 100, 1000]) for (const v of [0.1, 1, 3, 7, 42, 100].filter((v) => v <= max)) assert.equal(amountFill(v, max), oldAmount(v, max));
  assert.equal(amountFill(0, 10), '');
  assert.equal(amountFill(-3, 10), '', 'negative is empty');
  assert.equal(amountFill(NaN, 10), '');
  assert.equal(amountFill(5, 0), '');
  assert.equal(amountFill(5, Infinity), '');
  // max day hits the cap, smallest positive hits the floor
  assert.equal(amountFill(10, 10), `background:color-mix(in srgb, var(--accent) ${HEAT.AMOUNT_MAX}%, var(--surface))`);
  assert.equal(amountFill(0.01, 10), `background:color-mix(in srgb, var(--accent) ${HEAT.AMOUNT_MIN}%, var(--surface))`);
});

test('peakFill matches connected-metric scaling to the item peak', () => {
  for (const peak of [1, 5, 12]) for (const v of [1, 2, 5, 9].filter((v) => v <= peak)) assert.equal(peakFill(v, peak, 'var(--series-3)'), oldPeak(v, peak, 'var(--series-3)'));
  assert.equal(peakFill(0, 5, 'var(--series-3)'), '');
  assert.equal(peakFill(NaN, 5, 'var(--series-3)'), '');
  assert.equal(peakFill(3, 0, 'var(--series-3)'), '');
});

test('shareFill caps share fill; empty on no share', () => {
  for (const s of [0.001, 0.02, 0.1, 0.4, 0.9]) assert.equal(shareFill(s, 'var(--series-2)'), oldShare(s, 'var(--series-2)'));
  assert.equal(shareFill(0, 'var(--series-2)'), '');
  assert.equal(shareFill(NaN, 'var(--series-2)'), '');
  // cap
  assert.equal(shareFill(0.9, 'var(--series-2)'), `background:color-mix(in srgb, var(--series-2) ${HEAT.SHARE_CAP}%, var(--surface))`);
});

test('changeFill is symmetric, clamps ±0.6, no fill under the label cut-off, rejects non-finite', () => {
  // Above the cut-off the strengths are unchanged from the old inline formula.
  for (const c of [-1, -0.6, -0.2, -0.15, 0.15, 0.2, 0.6, 1, 0.333]) assert.equal(changeFill(c), oldChange(c), `c=${c}`);
  assert.equal(changeFill(0), '');
  for (const c of [0.04, -0.04, 0.06, -0.06, 0.1, -0.1, CHANGE_TONE.FLAT - 1e-9]) assert.equal(changeFill(c), '', `c=${c}`);
  assert.equal(changeFill(NaN), '');
  assert.equal(changeFill(Infinity), '');
  // symmetric strengths
  const up = changeFill(0.3);
  const down = changeFill(-0.3);
  assert.match(up, /var\(--good-ink\)/);
  assert.match(down, /var\(--critical-ink\)/);
  assert.equal(up.match(/ (\d+)%,/)[1], down.match(/ (\d+)%,/)[1], 'same strength both directions');
  // clamp
  assert.equal(changeFill(5), changeFill(0.6));
  assert.equal(changeFill(-5), changeFill(-0.6));
});

test('a day is coloured up/down exactly when its label is green/red', () => {
  for (let i = -100; i <= 100; i++) {
    const c = i / 100;
    const t = changeTone(c);
    const fill = changeFill(c);
    if (t === 'flat') assert.equal(fill, '', `c=${c} label is flat, so no fill`);
    else assert.match(fill, t.startsWith('up') ? /--good-ink/ : /--critical-ink/, `c=${c}`);
  }
});

test('legend stops are generated from the same constants as fill', () => {
  assert.deepEqual(amountLegendStops(), [10, 38, 70]);
  assert.deepEqual(changeLegendStops(), [42, 17]);
  // the strongest and weakest change swatches are what the fill actually paints
  assert.equal(mix(HEAT.UP_COLOR, changeLegendStops()[0]), changeFill(HEAT.CHANGE_CLAMP));
  assert.equal(mix(HEAT.DOWN_COLOR, changeLegendStops()[1]), changeFill(-CHANGE_TONE.FLAT));
  // swatches built from mix() match painted tokens
  assert.equal(mix(HEAT.AMOUNT_COLOR, amountLegendStops()[0]), 'background:color-mix(in srgb, var(--accent) 10%, var(--surface))');
  assert.equal(mix(HEAT.DOWN_COLOR, changeLegendStops()[0]), 'background:color-mix(in srgb, var(--critical-ink) 42%, var(--surface))');
  assert.equal(mix(HEAT.UP_COLOR, changeLegendStops()[1]), 'background:color-mix(in srgb, var(--good-ink) 17%, var(--surface))');
});

test('changeTone: one symmetric scale; +0/flat-under-15%=flat, ±40%=strong, none for no-data, minVolume', async () => {
  const { changeTone, toneClass, CHANGE_TONE } = await import('../web/src/next/heatmap.js');
  assert.equal(changeTone(0), 'flat', '+0% is flat, not good');
  assert.equal(changeTone(null), 'none');
  assert.equal(changeTone(NaN), 'none');
  assert.equal(changeTone(Infinity), 'none');
  assert.equal(changeTone(0.04), 'flat');
  assert.equal(changeTone(-0.04), 'flat');
  assert.equal(changeTone(CHANGE_TONE.FLAT), 'up');
  assert.equal(changeTone(-CHANGE_TONE.FLAT), 'down');
  assert.equal(changeTone(0.39), 'up');
  assert.equal(changeTone(-0.39), 'down');
  assert.equal(changeTone(CHANGE_TONE.STRONG), 'up2');
  assert.equal(changeTone(-CHANGE_TONE.STRONG), 'down2');
  // symmetry
  assert.equal(changeTone(0.5).replace('up', 'X'), changeTone(-0.5).replace('down', 'X'));
  // low volume can't read as strong
  assert.equal(changeTone(0.9, { volume: 1 }), 'flat');
  assert.equal(changeTone(0.9, { volume: 100 }), 'up2');
  // mapping to app ink classes
  assert.equal(toneClass('up'), 'good');
  assert.equal(toneClass('up2'), 'good');
  assert.equal(toneClass('down'), 'bad');
  assert.equal(toneClass('down2'), 'bad');
  assert.equal(toneClass('flat'), 'muted');
  assert.equal(toneClass('none'), 'muted');
});
