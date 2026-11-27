import { useMemo } from 'preact/hooks';

// Live's night map: a dotted world with a pin per country people are in.
// Google's live data names the city but gives no coordinates, so each pin sits
// at its country's middle and is labelled with that country's busiest city.

// Rough continent outlines (longitude, latitude), only to lay down the dots.
const LAND = [
  [[-168, 65], [-140, 70], [-95, 72], [-75, 62], [-60, 52], [-66, 45], [-75, 35], [-81, 25], [-97, 26], [-105, 22], [-97, 16], [-83, 9], [-78, 8], [-90, 15], [-105, 20], [-117, 32], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]],
  [[-55, 60], [-45, 60], [-20, 70], [-20, 80], [-60, 82], [-70, 77]],
  [[-80, 10], [-62, 11], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-73, -50], [-72, -30], [-70, -18], [-81, -5]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [5, 58], [10, 63], [20, 70], [30, 70], [40, 66], [45, 55], [40, 45], [28, 41], [26, 38], [20, 40], [15, 38], [12, 44], [8, 44], [3, 42], [-5, 36]],
  [[-6, 50], [2, 51], [0, 54], [-3, 58], [-6, 56]],
  [[-17, 21], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 11], [40, -5], [40, -15], [35, -25], [28, -34], [18, -35], [12, -18], [9, -2], [5, 5], [-8, 5], [-15, 10]],
  [[35, 30], [43, 12], [52, 15], [58, 22], [57, 25], [50, 30], [40, 32]],
  [[40, 45], [45, 55], [40, 66], [60, 70], [80, 73], [110, 77], [140, 73], [180, 68], [170, 60], [155, 58], [140, 52], [130, 42], [122, 40], [120, 30], [110, 20], [105, 10], [100, 13], [98, 8], [92, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [50, 30], [45, 40]],
  [[130, 31], [140, 35], [142, 40], [141, 45], [138, 38]],
  [[95, 5], [105, -6], [115, -8], [125, -9], [140, -5], [130, -2], [118, 2], [108, 2]],
  [[113, -22], [122, -17], [131, -12], [137, -12], [142, -11], [146, -19], [153, -26], [151, -34], [145, -39], [138, -35], [131, -31], [115, -34]],
  [[166, -46], [174, -41], [178, -38], [173, -35], [170, -45]],
];

// Middle of each country (longitude, latitude), by ISO code, as GA4's countryId gives it.
export const CENTRE = {
  US: [-98, 39], CA: [-106, 56], MX: [-102, 23], BR: [-52, -10], AR: [-64, -34], CL: [-71, -33], CO: [-74, 4], PE: [-76, -10], VE: [-66, 7], EC: [-78, -1.5], UY: [-56, -33], PY: [-58, -23], BO: [-64, -17],
  CR: [-84, 10], PA: [-80, 9], GT: [-90, 15], DO: [-70, 19], PR: [-66, 18], CU: [-79, 22], JM: [-77, 18],
  GB: [-2, 54], IE: [-8, 53], FR: [2.5, 46.5], DE: [10.5, 51], NL: [5.3, 52.2], BE: [4.5, 50.6], LU: [6.1, 49.8], CH: [8.2, 46.8], AT: [14.5, 47.5], ES: [-3.7, 40.3], PT: [-8, 39.6], IT: [12.5, 42.8],
  DK: [10, 56], NO: [9, 61], SE: [15, 62], FI: [26, 64], IS: [-19, 65], PL: [19.5, 52], CZ: [15.5, 49.8], SK: [19.5, 48.7], HU: [19.5, 47.2], RO: [25, 45.9], BG: [25.5, 42.7], GR: [22, 39.2],
  HR: [16, 45.2], SI: [14.8, 46.1], RS: [20.9, 44], BA: [17.8, 44.2], AL: [20, 41], MK: [21.7, 41.6], EE: [25.5, 58.7], LV: [24.9, 56.9], LT: [23.9, 55.3], UA: [31, 49], BY: [28, 53.7], MD: [28.5, 47],
  RU: [60, 58], TR: [35, 39], CY: [33, 35], GE: [43.5, 42.2], AM: [45, 40.1], AZ: [47.7, 40.3], KZ: [67, 48], UZ: [64, 41.4],
  IL: [35, 31.4], PS: [35.2, 31.9], JO: [36.5, 31], LB: [35.9, 33.9], SY: [38.5, 35], IQ: [43.7, 33], IR: [53.7, 32.4], SA: [45, 24], AE: [54, 24], QA: [51.2, 25.3], KW: [47.6, 29.3], BH: [50.6, 26], OM: [57, 21.5], YE: [48, 15.5],
  EG: [30, 26.8], MA: [-6.8, 31.8], DZ: [2.6, 28], TN: [9.5, 34], LY: [17, 27], NG: [8.7, 9.1], GH: [-1, 7.9], CI: [-5.5, 7.5], SN: [-14.5, 14.5], KE: [37.9, 0.2], ET: [39.5, 9.1], TZ: [34.9, -6.4], UG: [32.3, 1.4], RW: [29.9, -2], ZA: [24, -29], ZW: [29.2, -19], ZM: [27.8, -13.1], MZ: [35.5, -18.7], AO: [17.9, -11.2], CM: [12.4, 7.4], CD: [23.7, -2.9], MG: [46.9, -18.8],
  IN: [79, 22], PK: [69.3, 30.4], BD: [90.4, 23.7], LK: [80.7, 7.9], NP: [84.1, 28.4], CN: [104, 35], HK: [114.2, 22.3], TW: [121, 23.7], JP: [138, 36.2], KR: [127.8, 36.5], MN: [103.8, 46.9],
  TH: [101, 15.9], VN: [106, 16], MY: [102, 4.2], SG: [103.8, 1.35], ID: [113.9, -0.8], PH: [122, 12.9], MM: [96, 21.9], KH: [104.9, 12.6], LA: [102.5, 19.9],
  AU: [134, -25.3], NZ: [172, -41.3],
};

export const W = 360;
export const H = 150;
export const lonX = (lon) => ((lon + 170) / 360) * W;
export const latY = (lat) => ((78 - lat) / 136) * H;

const inPoly = (x, y, poly) => {
  let o = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) o = !o;
  }
  return o;
};

let DOTS = null;
export function landDots() {
  if (DOTS) return DOTS;
  DOTS = [];
  for (let lat = 76; lat >= -56; lat -= 3.4) {
    for (let lon = -168; lon <= 188; lon += 3.4) {
      if (LAND.some((p) => inPoly(lon > 180 ? lon - 360 : lon, lat, p))) DOTS.push([lonX(lon), latY(lat)]);
    }
  }
  return DOTS;
}

// Zoom to where the pins are when they sit in one region (two or more
// countries; a single pin stays on the whole world). Pins: { x, y }.
export function fitView(pins, phone = false) {
  let vb = [0, 0, W, H];
  if (pins.length > 1) {
    const xs = pins.map((p) => p.x);
    const ys = pins.map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    if (phone || spanX < W * 0.45) {
      const w = Math.min(W, Math.max(spanX + 90, phone ? 160 : 220));
      const h = (w * H) / W;
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      vb = [Math.max(0, Math.min(W - w, cx - w / 2)), Math.max(0, Math.min(H - h, cy - h / 2)), w, h];
    }
  }
  return vb;
}

// feed: the live visitor groups ({ ago, code, country, city, users }).
export function LiveMap({ feed, phone = false, picked = '', onPick }) {
  const { pins, vb, labels } = useMemo(() => {
    const byCountry = new Map();
    for (const r of feed) {
      if (!CENTRE[r.code]) continue;
      const c = byCountry.get(r.code) || { code: r.code, country: r.country, users: 0, fresh: false, cities: new Map() };
      c.users += r.users;
      c.fresh ||= r.ago < 5;
      if (r.city) c.cities.set(r.city, (c.cities.get(r.city) || 0) + r.users);
      byCountry.set(r.code, c);
    }
    const pins = [...byCountry.values()].map((c) => {
      const [lon, lat] = CENTRE[c.code];
      const top = [...c.cities.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      // One city names the pin; several fall back to the country.
      return { ...c, x: lonX(lon), y: latY(lat), name: c.cities.size === 1 ? top : c.country };
    });
    const vb = fitView(pins, phone);
    // Name the places with someone on now, skipping a name that would sit on another.
    const placed = [];
    const labels = [];
    for (const p of [...pins].filter((x) => x.fresh).sort((a, b) => b.users - a.users)) {
      const lx = ((p.x - vb[0]) / vb[2]) * 100;
      const ly = ((p.y - vb[1]) / vb[3]) * 100;
      if (placed.length >= (phone ? 3 : 6) || placed.some(([px, py]) => Math.abs(px - lx) < (phone ? 26 : 12) && Math.abs(py - ly) < 9)) continue;
      placed.push([lx, ly]);
      labels.push({ ...p, lx, ly });
    }
    return { pins, vb, labels };
  }, [feed, phone]);
  const k = vb[2] / W;
  const missing = feed.filter((r) => !CENTRE[r.code]).reduce((n, r) => n + r.users, 0);
  return (
    <div class="lv-map">
      <svg viewBox={vb.map((v) => v.toFixed(1)).join(' ')} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={pins.length ? `Map: people in ${pins.map((p) => p.country).join(', ')}` : 'Map: nobody in the last 30 minutes'}>
        <g class="lv-land">{landDots().map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(0.85 * Math.max(0.6, k)).toFixed(2)} />)}</g>
        {pins.map((p) => (
          <g key={p.code} class={`lv-pin${p.fresh ? ' fresh' : ''}${onPick ? ' pick' : ''}${picked === p.code ? ' on' : ''}${picked && picked !== p.code ? ' dim' : ''}`}
            transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${k.toFixed(3)})`}
            onClick={onPick ? () => onPick(picked === p.code ? '' : p.code) : undefined}>
            {onPick && <circle class="lv-pin-hit" r="22" />}
            {picked === p.code && <circle class="lv-pin-sel" r="6" />}
            <title>{`${p.country}: ${p.users} in the last 30 minutes${p.cities.size ? ` (${[...p.cities.keys()].slice(0, 4).join(', ')})` : ''}`}</title>
            {p.fresh && <circle class="ring" r="3" />}
            <circle class="core" r={Math.min(6, 1.6 + p.users * 0.5).toFixed(1)} />
          </g>
        ))}
      </svg>
      {labels.map((p) => (
        <span key={p.code} class={`lv-pinlab${p.lx > 72 ? ' flip' : ''}`} style={{ left: `${p.lx.toFixed(1)}%`, top: `${p.ly.toFixed(1)}%` }}>
          {p.name}{p.users > 1 ? ` · ${p.users}` : ''}
        </span>
      ))}
      {missing > 0 && <span class="lv-map-note">{missing} more without a known place</span>}
    </div>
  );
}
