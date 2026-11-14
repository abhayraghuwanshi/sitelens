// Statistics for the free tools: A/B significance, sample size and the
// before/after "did it work?" test. Plain ES module, no dependencies, so the
// browser pages and the Node tests share it.

// Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf, error < 1.5e-7).
export function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// Inverse standard normal CDF (Acklam's rational approximation).
export function normInv(p) {
  if (p <= 0 || p >= 1) throw new RangeError('p must be between 0 and 1');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normInv(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function logGamma(x) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const v of g) ser += v / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// Regularized incomplete beta I_x(a, b), continued fraction (Numerical Recipes).
function betaInc(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (x, a, b) => {
    let c = 1, d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
      d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 3e-12) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? front * cf(x, a, b) / a : 1 - front * cf(1 - x, b, a) / b;
}

// Two-sided p-value for Student's t with df degrees of freedom.
export function tTwoSided(t, df) {
  return betaInc(df / (df + t * t), df / 2, 0.5);
}

// Two-proportion z-test. Returns rates, relative lift, two-sided p-value, a
// confidence interval on the absolute difference and the chance B beats A.
export function abTest({ visitorsA, conversionsA, visitorsB, conversionsB, confidence = 0.95 }) {
  const nA = Number(visitorsA), xA = Number(conversionsA), nB = Number(visitorsB), xB = Number(conversionsB);
  if (!(nA > 0 && nB > 0) || xA < 0 || xB < 0 || xA > nA || xB > nB) return { error: 'Conversions must be between 0 and the number of visitors.' };
  const pA = xA / nA, pB = xB / nB;
  const pooled = (xA + xB) / (nA + nB);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  const z = sePooled > 0 ? (pB - pA) / sePooled : 0;
  const pValue = sePooled > 0 ? 2 * (1 - normCdf(Math.abs(z))) : 1;
  const se = Math.sqrt(pA * (1 - pA) / nA + pB * (1 - pB) / nB);
  const zc = normInv(1 - (1 - confidence) / 2);
  const diff = pB - pA;
  return {
    rateA: pA, rateB: pB, diff,
    lift: pA > 0 ? diff / pA : null,
    z, pValue,
    significant: pValue < 1 - confidence,
    ci: [diff - zc * se, diff + zc * se],
    chanceBBeatsA: se > 0 ? normCdf(diff / se) : 0.5,
  };
}

// Visitors needed per variant to detect a relative lift `mde` on a baseline
// conversion rate, two-sided, at the given significance and power.
export function sampleSize({ baseline, mde, confidence = 0.95, power = 0.8 }) {
  const p1 = Number(baseline), p2 = p1 * (1 + Number(mde));
  if (!(p1 > 0 && p1 < 1) || !(p2 > 0 && p2 < 1) || p1 === p2) return { error: 'Baseline and lift must give two different rates between 0% and 100%.' };
  const za = normInv(1 - (1 - confidence) / 2), zb = normInv(power);
  const pBar = (p1 + p2) / 2;
  const n = (za * Math.sqrt(2 * pBar * (1 - pBar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2;
  return { perVariant: Math.ceil(n), target: p2 };
}

// Pull numbers out of pasted text. Accepts one number per line, a comma or
// space separated list, or rows copied from a spreadsheet (date<TAB>value):
// a row with a date or with tab/semicolon cells contributes its last number.
const DATE = /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b|\b[A-Z][a-z]{2,8}\.? \d{1,2},? \d{4}\b/g;
export function parseSeries(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const hasDate = DATE.test(line);
    DATE.lastIndex = 0;
    if (hasDate || /[\t;]/.test(line)) {
      const cells = line.replace(DATE, ' ').split(/[\t;]/).map((c) => c.replace(/[,\s%]/g, '')).filter((c) => /^-?\d+(?:\.\d+)?$/.test(c));
      if (!cells.length && hasDate) {
        const nums = line.replace(DATE, ' ').match(/-?\d+(?:\.\d+)?/g);
        if (nums) out.push(Number(nums[nums.length - 1]));
      } else if (cells.length) out.push(Number(cells[cells.length - 1]));
      continue;
    }
    for (const tok of line.split(/[\s,]+/)) {
      const c = tok.replace(/%$/, '');
      if (/^-?\d+(?:\.\d+)?$/.test(c)) out.push(Number(c));
    }
  }
  return out;
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const variance = (xs, m = mean(xs)) => xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);

// Did a daily metric change after a launch? Welch's t-test on daily values,
// which copes with the day-to-day noise that a plain count test ignores.
export function beforeAfter(before, after) {
  if (before.length < 3 || after.length < 3) return { error: 'Add at least 3 days on each side (7 or more is much better).' };
  const mB = mean(before), mA = mean(after);
  const vB = variance(before, mB), vA = variance(after, mA);
  const seSq = vB / before.length + vA / after.length;
  const change = mB !== 0 ? (mA - mB) / Math.abs(mB) : null;
  let t = 0, df = before.length + after.length - 2, pValue = 1, method = 'welch';
  // Equal whole weeks on both sides: day i before and day i after fall on
  // the same weekday, so compare them in pairs. That removes the weekend
  // dip from the noise, which otherwise hides real changes.
  const paired = before.length === after.length && before.length % 7 === 0;
  const diffs = paired ? after.map((a, i) => a - before[i]) : null;
  const vD = paired ? variance(diffs) : 0;
  if (paired && vD > 0) {
    method = 'paired';
    df = diffs.length - 1;
    t = mean(diffs) / Math.sqrt(vD / diffs.length);
    pValue = tTwoSided(t, df);
  } else if (seSq > 0) {
    t = (mA - mB) / Math.sqrt(seSq);
    df = seSq ** 2 / ((vB / before.length) ** 2 / (before.length - 1) + (vA / after.length) ** 2 / (after.length - 1));
    pValue = tTwoSided(t, df);
  } else if (mA !== mB) {
    pValue = 0;
  }
  const warnings = [];
  if (before.length < 7 || after.length < 7) warnings.push('Fewer than 7 days on a side: weekday swings can look like a change.');
  if (before.length % 7 !== 0 || after.length % 7 !== 0) warnings.push('Use whole weeks on each side (7, 14, 28 days) so weekends are counted fairly.');
  let verdict;
  if (pValue < 0.05) verdict = mA > mB ? 'up' : 'down';
  else if (pValue < 0.2) verdict = 'maybe';
  else verdict = 'none';
  return { meanBefore: mB, meanAfter: mA, change, t, df, pValue, verdict, warnings, method };
}
