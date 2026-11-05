// Synthesizes the trailer's soundtrack, so there is no third-party audio to license.
// A minor pad (Am–F–C–G) under the title cards, then arpeggio, bass and a soft
// kick for the product tour, a whoosh into every scene cut, and a final chord.
//
// Usage: node scripts/trailer-music.mjs out.wav <totalSeconds> [cue,cue,...]

import { writeFile } from 'node:fs/promises';

const RATE = 44100;
const BEAT = 60 / 96;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// Two bars per chord, as MIDI notes (root, third, fifth).
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];

// Deterministic noise, so every render sounds the same.
function noise(seed = 1) {
  let s = seed;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 31) - 1;
}

/**
 * @param {{ total: number, cues?: number[] }} opts total length and scene-start times, in seconds.
 *   cues[2] starts the beat (first product scene), the second-to-last cue drops the drums,
 *   the last cue lands the final chord.
 */
export function score({ total, cues = [] }) {
  const n = Math.ceil(total * RATE);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const add = (i, v, pan = 0) => {
    if (i < 0 || i >= n) return;
    L[i] += v * (1 - pan) * 0.5 * 2 ** 0.5;
    R[i] += v * (1 + pan) * 0.5 * 2 ** 0.5;
  };
  const beatStart = cues[2] ?? 9;
  const why = cues.at(-2) ?? total - 16;
  const finale = cues.at(-1) ?? total - 6;
  const chordAt = (t) => CHORDS[Math.floor(Math.max(0, t) / (BEAT * 8)) % CHORDS.length];

  // Pad: detuned harmonic stacks, crossfading between chords.
  const barLen = BEAT * 8;
  for (let c = 0; c * barLen < finale; c++) {
    const t0 = c * barLen;
    const t1 = Math.min((c + 1) * barLen, finale);
    const chord = CHORDS[c % CHORDS.length];
    for (const [k, note] of chord.entries()) {
      for (const detune of [-0.0016, 0.0016]) {
        const f = midi(note) * (1 + detune);
        const pan = detune < 0 ? -0.35 + k * 0.1 : 0.35 - k * 0.1;
        for (let i = Math.floor((t0 - 0.4) * RATE); i < (t1 + 0.8) * RATE; i++) {
          const t = i / RATE;
          const env = Math.min(1, (t - t0 + 0.4) / 0.9) * Math.min(1, (t1 + 0.8 - t) / 0.9);
          if (env <= 0) continue;
          const swell = t < beatStart ? 0.55 + 0.45 * (t / beatStart) : t >= why ? 1.15 : 1;
          let v = 0;
          for (let h = 1; h <= 5; h++) v += Math.sin(2 * Math.PI * f * h * t) / h ** 1.6;
          add(i, v * env * swell * 0.018, pan);
        }
      }
    }
  }

  // Arpeggio: plucked eighths with a stereo delay, from the beat until the finale.
  const arp = { L: new Float32Array(n), R: new Float32Array(n) };
  for (let t0 = beatStart, step = 0; t0 < finale; t0 += BEAT / 2, step++) {
    const chord = chordAt(t0);
    const pattern = [0, 1, 2, 1, 0, 2, 1, 2];
    const f = midi(chord[pattern[step % 8]] + 12 + (step % 16 >= 12 ? 12 : 0));
    const accent = step % 4 === 0 ? 1 : 0.7;
    const start = Math.floor(t0 * RATE);
    for (let j = 0; j < RATE * 0.5; j++) {
      const t = j / RATE;
      const env = Math.exp(-t * 9) * Math.min(1, t * 400);
      const v = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * env * accent * 0.05;
      if (start + j < n) {
        arp.L[start + j] += v * (step % 2 ? 0.7 : 1);
        arp.R[start + j] += v * (step % 2 ? 1 : 0.7);
      }
    }
  }
  const delay = Math.floor(BEAT * 0.75 * RATE);
  for (let i = delay; i < n; i++) {
    arp.L[i] += arp.R[i - delay] * 0.35;
    arp.R[i] += arp.L[i - delay] * 0.35;
  }
  for (let i = 0; i < n; i++) {
    L[i] += arp.L[i];
    R[i] += arp.R[i];
  }

  // Bass, kick and hats on the beat; drums thin out for the "why" section.
  const rnd = noise(7);
  for (let t0 = beatStart, beat = 0; t0 < finale; t0 += BEAT, beat++) {
    const start = Math.floor(t0 * RATE);
    const root = midi(chordAt(t0)[0] - 24);
    const drums = t0 < why ? 1 : beat % 2 === 0 ? 0.6 : 0;
    for (let j = 0; j < RATE * BEAT; j++) {
      const t = j / RATE;
      const bass = (Math.sin(2 * Math.PI * root * t) + 0.25 * Math.sin(4 * Math.PI * root * t)) * Math.exp(-t * 2.2) * Math.min(1, t * 200) * 0.11;
      const kick = Math.sin(2 * Math.PI * (45 * t + (75 / 18) * (1 - Math.exp(-t * 18)))) * Math.exp(-t * 9) * 0.22 * drums;
      add(start + j, bass + kick);
    }
    const hat = start + Math.floor((BEAT / 2) * RATE);
    let prev = 0;
    for (let j = 0; j < RATE * 0.06; j++) {
      const x = rnd();
      add(hat + j, (x - prev) * Math.exp(-(j / RATE) * 70) * 0.03 * drums, 0.25);
      prev = x;
    }
  }

  // Whoosh into each scene cut: noise that brightens and swells, then stops on the cut.
  for (const cue of cues.slice(1)) {
    const len = 0.7;
    const start = Math.floor((cue - len) * RATE);
    let lp = 0;
    for (let j = 0; j < len * RATE; j++) {
      const p = j / (len * RATE);
      lp += (rnd() - lp) * (0.008 + p * 0.09);
      const v = lp * p ** 2 * 0.22;
      add(start + j, v, -0.4 + p * 0.8);
    }
  }

  // Low boom under the logo reveal, and the final chord with a long tail.
  const boom = (t0, gain) => {
    const start = Math.floor(t0 * RATE);
    for (let j = 0; j < RATE * 2.5; j++) {
      const t = j / RATE;
      add(start + j, Math.sin(2 * Math.PI * (38 * t + 3 * (1 - Math.exp(-t * 6)))) * Math.exp(-t * 1.6) * gain);
    }
  };
  if (cues[1]) boom(cues[1], 0.3);
  boom(finale, 0.32);
  for (const [k, note] of [45, 57, 60, 64, 69, 76].entries()) {
    const f = midi(note);
    for (let i = Math.floor(finale * RATE); i < n; i++) {
      const t = i / RATE - finale;
      const env = Math.min(1, t * 30) * Math.exp(-t * 0.45);
      let v = 0;
      for (let h = 1; h <= 4; h++) v += Math.sin(2 * Math.PI * f * h * t) / h ** 1.8;
      add(i, v * env * 0.03, (k % 2 ? 1 : -1) * 0.3);
    }
  }

  // Master: soft clip, fades, normalize to about -1 dBFS.
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const fade = Math.min(1, t / 0.4) * Math.min(1, (total - t) / 2.5);
    L[i] = Math.tanh(L[i] * 1.2) * fade;
    R[i] = Math.tanh(R[i] * 1.2) * fade;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const gain = peak ? 0.89 / peak : 1;
  return wav(L, R, gain);
}

function wav(L, R, gain) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
  }
  return buf;
}

if (process.argv[1] === import.meta.filename) {
  const [out = 'trailer.wav', total = '70', cues = ''] = process.argv.slice(2);
  await writeFile(out, score({ total: Number(total), cues: cues ? cues.split(',').map(Number) : [] }));
  console.log(`Saved ${out}`);
}
