// Timeline heatmap coloring — one source of truth for every scale, shared by
// `Timeline.fill` (what paints a day) and `ScaleKey` (the legend), so the
// legend can never drift from what's actually rendered.
//
// Semantic roles (see docs): `--accent` = magnitude; `--good-ink`/`--critical-ink`
// = symmetric diverging up/down; `--surface` = empty; never raw colors, never
// `--good`/`--critical` for direction ink, never `--up`/`--down`.
//
// Fills keep the previous inline `fill()` strengths, clamp percentages to
// [0,100] and return '' instead of `NaN` CSS for non-finite input. The one
// deliberate change: a day only gets an up/down fill once its change is big
// enough for its label to turn green or red (`CHANGE_TONE.FLAT`), so the
// colour and the "+12%" beside it always agree. No app imports.

export const HEAT = {
  SURFACE: 'var(--surface)',
  AMOUNT_COLOR: 'var(--accent)', // sequential magnitude
  UP_COLOR: 'var(--good-ink)', // diverging up
  DOWN_COLOR: 'var(--critical-ink)', // diverging down
  AMOUNT_MIN: 6, // smallest non-zero magnitude
  AMOUNT_MAX: 70, // strongest magnitude
  CHANGE_MIN: 8, // smallest visible change
  CHANGE_MAX: 42, // strongest change
  CHANGE_CLAMP: 0.6, // clamp |c| at ±60%
  SHARE_MULT: 130, // share → percent
  SHARE_CAP: 72, // cap share fill
  SPACE: 'srgb', // color-mix space (oklab to revisit after visual check)
};

// Unified change scale, shared by every day fill and every "up/down" label.
// One threshold set, symmetric:
//   `none` no usual / non-finite · `flat` no movement (incl +0%) or low volume
//   `up`/`down` ≥ FLAT · `up2`/`down2` ≥ STRONG.
export const CHANGE_TONE = { FLAT: 0.15, STRONG: 0.4, MIN_VOLUME: 5 };

const clampPct = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** `background: color-mix(in <space>, <color> N%, <base>)`, percentage clamped. */
export function mix(color, percent, base = HEAT.SURFACE, space = HEAT.SPACE) {
  return `background:color-mix(in ${space}, ${color} ${clampPct(percent)}%, ${base})`;
}

const amountPct = (ratio) => HEAT.AMOUNT_MIN + ratio * (HEAT.AMOUNT_MAX - HEAT.AMOUNT_MIN);
const changePct = (a) => HEAT.CHANGE_MIN + (Math.min(a, HEAT.CHANGE_CLAMP) / HEAT.CHANGE_CLAMP) * (HEAT.CHANGE_MAX - HEAT.CHANGE_MIN);

/** Sequential magnitude: `AMOUNT_MIN→AMOUNT_MAX` by value/max; empty when value<=0 or non-finite. */
export function amountFill(value, max, color = HEAT.AMOUNT_COLOR) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return '';
  return mix(color, amountPct(value / max));
}

/** One item's daily value scaled to its own peak (connected metrics / jobs / …). */
export const peakFill = (value, peak, color) => amountFill(value, peak, color);

/** Focused breakdown item by share of day; `SHARE_MULT` then `mix` caps at 100, visual cap `SHARE_CAP`. */
export function shareFill(share, color) {
  if (!Number.isFinite(share) || share <= 0) return '';
  return mix(color, Math.min(share * HEAT.SHARE_MULT, HEAT.SHARE_CAP));
}

/** Symmetric diverging change `c = value/usual - 1`; no fill under ±CHANGE_TONE.FLAT (same cut-off as labels), clamp ±CHANGE_CLAMP. */
export function changeFill(c) {
  if (!Number.isFinite(c)) return '';
  const a = Math.abs(c);
  if (a < CHANGE_TONE.FLAT) return '';
  return mix(c > 0 ? HEAT.UP_COLOR : HEAT.DOWN_COLOR, changePct(a));
}
export function changeTone(c, { volume, minVolume = CHANGE_TONE.MIN_VOLUME } = {}) {
  if (c === null || c === undefined || !Number.isFinite(c)) return 'none';
  if (c === 0) return 'flat';
  if (volume != null && Number.isFinite(volume) && volume < minVolume) return 'flat';
  const a = Math.abs(c);
  if (a >= CHANGE_TONE.STRONG) return c > 0 ? 'up2' : 'down2';
  if (a >= CHANGE_TONE.FLAT) return c > 0 ? 'up' : 'down';
  return 'flat';
}
/** changeTone → the app's existing semantic ink classes. */
export const toneClass = (t) => (t === 'up' || t === 'up2' ? 'good' : t === 'down' || t === 'down2' ? 'bad' : 'muted');

/** Legend swatches, computed from the SAME constants as `fill`. */
// Amount: a quiet day (1/16 of the peak), a middle day and the peak → [10, 38, 70].
export const amountLegendStops = () => [1 / 16, 1 / 2, 1].map((r) => Math.round(amountPct(r)));
// Change: strongest (at the clamp) then weakest painted (at the label cut-off) → [42, 17].
export const changeLegendStops = () => [HEAT.CHANGE_CLAMP, CHANGE_TONE.FLAT].map((a) => Math.round(changePct(a)));
