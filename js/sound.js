// FilmSoundClear's shared parts.
//
// 1. A tiny sound lab. Every sound in this box is made here from maths, sample by sample: a generic
//    synthetic voice, room tone, footsteps on three surfaces, Foley props, creature and spaceship layers,
//    a helicopter, a music pad and ADR beeps. Nothing is recorded or copied, so there is no copyrighted
//    audio or music anywhere in the box. The same sample arrays drive both the speakers and the
//    waveform / spectrum boards, so the pictures are always the real signal, even when the sound is muted.
// 2. A small Web Audio player that only starts after a real click or key press, obeys the kit's mute
//    button, and never makes a sound while the Glassbox studio records a video.
// 3. Board, label and stage helpers (in the style of FilmClear) and generic 3D props built from
//    primitives: a mannequin, a shotgun mic with windshield, a boom pole, a speaker cabinet, a camera.
//
// Numbers used across chapters, with sources:
//  - Speed of sound in air at 20 °C: 343 m/s.
//  - Normal speech: about 62 dB SPL at 1 m (ANSI S3.5-1997, "normal" vocal effort 62.35 dB).
//  - Free-field inverse-square law: level falls 20·log10(d2/d1) dB, 6 dB per doubling of distance.
//  - Polar patterns (first-order): r(θ) = A + (1−A)·cosθ, with A = 1 (omni), 0.5 (cardioid),
//    0.37 (supercardioid). Directivity index (how much diffuse room noise is rejected): 0, 4.8 and 5.7 dB.
//    (Eargle, The Microphone Book, 2nd ed., ch. 5.) A shotgun behaves like a supercardioid at speech
//    frequencies and narrows further at high frequencies; this box uses the supercardioid shape.
import { THREE, M, box, beam, sphere, clamp } from './kit.js';
import { audio } from './ui.js';

export const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;
export const C_SOUND = 343;
export const SR = 32000;                 // sample rate of the generated sounds (Hz); plenty for a 16 kHz top
export const FRAME_MS = 1000 / 24;
export const dB = (x) => 20 * Math.log10(Math.max(1e-9, x));
export const undB = (d) => 10 ** (d / 20);
export const fmtDb = (v, d = 0) => (v > 0 ? '+' : '') + v.toFixed(d) + ' dB';

// ---------------------------------------------------------------- random numbers
// Deterministic, so every run (and every video frame) looks and sounds the same.
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- DSP building blocks
const N = (sec) => Math.max(1, Math.round(sec * SR));
function white(n, seed) { const r = rng(seed), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = r() * 2 - 1; return a; }
// Pink noise (−3 dB per octave), Paul Kellet's economy filter.
function pink(n, seed) {
  const w = white(n, seed), a = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const x = w[i]; b0 = 0.99765 * b0 + x * 0.099046; b1 = 0.963 * b1 + x * 0.2965164; b2 = 0.57 * b2 + x * 1.0526913; a[i] = (b0 + b1 + b2 + x * 0.1848) * 0.12; }
  return a;
}
// Brown noise (−6 dB per octave): leaky integrated white noise.
function brown(n, seed) { const w = white(n, seed), a = new Float32Array(n); let y = 0; for (let i = 0; i < n; i++) { y = 0.996 * y + w[i] * 0.06; a[i] = y; } return a; }
// One-pole low-pass, in place. fc in Hz (number or function of sample index).
function lp(x, fc) { let y = 0; const f = typeof fc === 'function' ? fc : () => fc; for (let i = 0; i < x.length; i++) { const k = 1 - Math.exp((-TAU * f(i)) / SR); y += k * (x[i] - y); x[i] = y; } return x; }
function hp(x, fc) { const k = 1 - Math.exp((-TAU * fc) / SR); let y = 0; for (let i = 0; i < x.length; i++) { y += k * (x[i] - y); x[i] = x[i] - y; } return x; }
// Two-pole resonator (band-pass) with centre f and bandwidth bw, both numbers or functions of i.
// Returns a new array. Gain is normalised so a sine at f comes out at roughly its input level.
function reson(x, f, bw, out = new Float32Array(x.length)) {
  const F = typeof f === 'function' ? f : () => f, B = typeof bw === 'function' ? bw : () => bw;
  let y1 = 0, y2 = 0, a1 = 0, a2 = 0, g = 0;
  for (let i = 0; i < x.length; i++) {
    if ((i & 31) === 0) { const r = Math.exp((-Math.PI * B(i)) / SR); a1 = 2 * r * Math.cos((TAU * F(i)) / SR); a2 = -r * r; g = 1 - r; }
    const y = g * x[i] + a1 * y1 + a2 * y2; y2 = y1; y1 = y; out[i] += y;
  }
  return out;
}
function add(dst, src, at = 0, gain = 1) { for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * gain; return dst; }
export function normalize(a, peak = 0.9) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m; return a; }
function fade(a, inS = 0.005, outS = 0.02) { const ni = N(inS), no = N(outS); for (let i = 0; i < ni && i < a.length; i++) a[i] *= i / ni; for (let i = 0; i < no && i < a.length; i++) a[a.length - 1 - i] *= i / no; return a; }
// A short burst of noise with an exponential decay (time constant tau seconds): the basis of every hit.
function burst(sec, tau, seed, amp = 1) { const n = N(sec), r = rng(seed), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = (r() * 2 - 1) * amp * Math.exp(-i / SR / tau); return a; }
function impulse(sec, at = 0) { const a = new Float32Array(N(sec)); a[N(at)] = 1; return a; }

// ---------------------------------------------------------------- the sounds
// Vowel formants F1, F2, F3 for an adult male voice (Peterson & Barney, JASA 1952).
const VOWELS = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [570, 840, 2410]];
// A generic synthetic voice: a glottal pulse train (Rosenberg pulse, differentiated for lip radiation)
// through three moving formant resonators, in syllables of about 4 to 5 per second, like real speech.
// It babbles; it says no real words, so it belongs to nobody.
export function voice(sec = 2.6, seed = 3, f0 = 125) {
  const n = N(sec), r = rng(seed), src = new Float32Array(n), env = new Float32Array(n), fm = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const syl = []; let t = 0.05;
  while (t < sec - 0.25) { const d = 0.14 + r() * 0.12; syl.push({ t, d, v: VOWELS[Math.floor(r() * 5)], cons: r() < 0.7, p: 0.9 + r() * 0.3 }); t += d + 0.04 + (r() < 0.15 ? 0.25 : 0.02); }
  let ph = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    let e = 0, v = VOWELS[0], p = 1;
    for (const s of syl) { if (tt >= s.t - 0.03 && tt < s.t + s.d + 0.05) { const k = (tt - s.t) / s.d; e = Math.max(e, Math.sin(Math.PI * clamp(k, 0, 1)) ** 0.6); v = s.v; p = s.p; } }
    env[i] = e;
    const f = f0 * p * (1 - 0.12 * (tt / sec)) * (1 + 0.02 * Math.sin(TAU * 5.3 * tt));
    ph += f / SR; if (ph >= 1) ph -= 1;
    const g = ph < 0.4 ? 0.5 * (1 - Math.cos((Math.PI * ph) / 0.4)) : ph < 0.56 ? Math.cos((Math.PI * (ph - 0.4)) / 0.32) : 0;
    src[i] = (g - last) * e; last = g;
    for (let k = 0; k < 3; k++) fm[k][i] = i ? fm[k][i - 1] + (v[k] - fm[k][i - 1]) * 0.004 : v[k];
  }
  // consonants: short hiss or click bursts at the start of some syllables
  const hiss = hp(white(n, seed + 9), 2500);
  for (const s of syl) if (s.cons) { const a = N(s.t - 0.03), b = N(s.t + 0.02); for (let i = a; i < b && i < n; i++) src[i] += hiss[i] * 0.06 * Math.sin((Math.PI * (i - a)) / (b - a)); }
  const out = new Float32Array(n);
  reson(src, (i) => fm[0][i], 80, out); reson(src, (i) => fm[1][i], 100, out); const o3 = reson(src, (i) => fm[2][i], 140); add(out, o3, 0, 0.5);
  hp(out, 90);
  out.env = env; out.syllables = syl;
  return fade(normalize(out, 0.8));
}

// Background noise of each kind. Levels are set later by the chapter; these are the shapes.
export function ambience(kind = 'room', sec = 3, seed = 5) {
  const n = N(sec), a = new Float32Array(n);
  if (kind === 'room' || kind === 'stage') {
    add(a, lp(pink(n, seed), 900), 0, 1);
    for (let i = 0; i < n; i++) { const t = i / SR; a[i] += 0.012 * Math.sin(TAU * 50 * t) + 0.006 * Math.sin(TAU * 100 * t) + 0.003 * Math.sin(TAU * 150 * t); } // mains hum: 50 Hz in India and Europe
  } else if (kind === 'street') {
    add(a, lp(brown(n, seed), 400), 0, 2.5);
    const hiss = lp(pink(n, seed + 1), 3000), r = rng(seed + 2);
    const cars = [0.4, 1.6, 2.4].map((c) => c + r() * 0.3);
    for (let i = 0; i < n; i++) { const t = i / SR; let e = 0.2; for (const c of cars) e += Math.exp(-(((t - c) / 0.45) ** 2)); a[i] += hiss[i] * 0.6 * e; }
    // a distant two-tone horn
    for (let i = N(1.1); i < N(1.45) && i < n; i++) { const t = i / SR; a[i] += 0.02 * (Math.sign(Math.sin(TAU * 410 * t)) + Math.sign(Math.sin(TAU * 520 * t))); }
  } else if (kind === 'generator') {
    // A diesel generator at 1,500 rpm: a four-stroke fires every other turn, so a 4-cylinder engine fires
    // at 1500/60 × 4 / 2 = 50 Hz, plus harmonics, rattle and fan noise.
    const r = rng(seed); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (50 * (1 + 0.004 * Math.sin(TAU * 0.7 * t))) / SR; let v = 0; for (let k = 1; k <= 8; k++) v += Math.sin(TAU * k * ph) / k ** 0.9; a[i] = v * 0.08 + (r() * 2 - 1) * 0.03 * (1 + Math.sin(TAU * ph)); }
    add(a, lp(pink(n, seed + 3), 2000), 0, 0.6);
  } else if (kind === 'birds') {
    add(a, lp(pink(n, seed), 600), 0, 0.4);
    const r = rng(seed + 4);
    for (let c = 0; c < sec * 3; c++) {
      const t0 = r() * (sec - 0.3), f0 = 2800 + r() * 1800, notes = 2 + Math.floor(r() * 3);
      for (let k = 0; k < notes; k++) { const s0 = N(t0 + k * 0.09), len = N(0.06); for (let i = 0; i < len && s0 + i < n; i++) { const u = i / len; a[s0 + i] += 0.05 * Math.sin(Math.PI * u) * Math.sin(TAU * (f0 + 900 * u * (k % 2 ? -1 : 1)) * (i / SR)); } }
    }
  } else if (kind === 'plane') {
    // a jet passing overhead: broadband roar that swells and fades
    const w = lp(brown(n, seed), 1500), h = lp(pink(n, seed + 1), 5000);
    for (let i = 0; i < n; i++) { const t = i / SR, e = 0.3 + Math.exp(-(((t - sec * 0.55) / (sec * 0.3)) ** 2)); a[i] = (w[i] * 3 + h[i] * 0.5) * e; }
  }
  return fade(normalize(a, 0.7), 0.05, 0.05);
}

// One footstep: a heel strike then a toe strike about 70 ms later, on the chosen surface.
export function footstep(surface = 'wood', seed = 1) {
  const sec = 0.4, n = N(sec), a = new Float32Array(n), r = rng(seed);
  const hits = [[0.005, 1], [0.07 + r() * 0.02, 0.6]];
  for (const [t0, amp] of hits) {
    const at = N(t0);
    if (surface === 'concrete') {
      add(a, hp(burst(0.05, 0.004, seed + at, amp), 900), at);
      const th = new Float32Array(N(0.08)); for (let i = 0; i < th.length; i++) th[i] = amp * 0.5 * Math.sin(TAU * 95 * (i / SR)) * Math.exp(-i / SR / 0.018); add(a, th, at);
      add(a, reson(burst(0.06, 0.02, seed + 3, 0.3 * amp), 3200, 1500), at + N(0.01));      // grit scuff
    } else if (surface === 'wood') {
      const ex = burst(0.02, 0.002, seed + at, amp);
      const knock = new Float32Array(N(0.25)); reson(ex, 190, 25, knock); reson(ex, 430, 45, knock); reson(ex, 980, 90, knock);
      add(a, knock, at, 3); add(a, hp(burst(0.015, 0.0015, seed + 7, amp * 0.6), 2000), at);
    } else { // gravel: dozens of little stones clicking against each other
      const grains = 45 + Math.floor(r() * 20);
      for (let g = 0; g < grains; g++) {
        const t = t0 + Math.abs(r() + r() - 1) * 0.16, f = 1800 + r() * 5000;
        const gr = reson(burst(0.012, 0.0012, seed * 97 + g, (0.3 + r()) * amp), f, f * 0.3);
        add(a, gr, N(t), 2.2);
      }
      add(a, lp(burst(0.12, 0.03, seed + 11, amp * 0.5), 500), at);
    }
  }
  return fade(normalize(a, 0.85), 0.001, 0.05);
}

// Foley props. Each one is a physical recipe: what vibrates, at what pitch, and how fast it dies away.
export function prop(kind, seed = 2) {
  const r = rng(seed);
  if (kind === 'celery') {       // a stick of celery snapped close to the mic: bones breaking
    const n = N(0.5), a = new Float32Array(n);
    for (let k = 0; k < 5; k++) add(a, reson(burst(0.04, 0.003, seed + k, 1), 2500 + r() * 3000, 700), N(0.01 + k * 0.004 + r() * 0.01), 4);   // cracks
    for (let g = 0; g < 70; g++) add(a, reson(burst(0.01, 0.001, seed * 13 + g, r()), 3000 + r() * 5000, 1500), N(0.02 + r() * r() * 0.18), 2);  // fibres tearing
    const body = new Float32Array(N(0.12)); for (let i = 0; i < body.length; i++) body[i] = 0.5 * Math.sin(TAU * 180 * (i / SR)) * Math.exp(-i / SR / 0.02); add(a, body, N(0.012));
    return fade(normalize(a, 0.85), 0.001, 0.05);
  }
  if (kind === 'coconut') {      // two coconut half-shells knocked on a board: hooves at a trot (clip-clop)
    const n = N(1.1), a = new Float32Array(n);
    for (const [t0, amp] of [[0.01, 1], [0.13, 0.7], [0.5, 0.95], [0.62, 0.65]]) {
      const ex = burst(0.01, 0.0008, seed + t0 * 1000, amp), shell = new Float32Array(N(0.2));
      reson(ex, 520 + r() * 60, 35, shell); reson(ex, 1250 + r() * 80, 70, shell); reson(ex, 2600, 200, shell);
      add(a, shell, N(t0), 5); add(a, hp(burst(0.01, 0.001, seed + 5, amp * 0.5), 3000), N(t0));
    }
    return fade(normalize(a, 0.85), 0.001, 0.05);
  }
  if (kind === 'cabbage') {      // a fist into a cabbage: the thump of a punch plus the crunch of leaves
    const n = N(0.55), a = new Float32Array(n); let ph = 0;
    for (let i = 0; i < N(0.25); i++) { const t = i / SR, f = 45 + 110 * Math.exp(-t / 0.03); ph += f / SR; a[i] += Math.sin(TAU * ph) * Math.exp(-t / 0.07); }
    for (let g = 0; g < 90; g++) add(a, reson(burst(0.015, 0.002, seed * 7 + g, r()), 600 + r() * 3500, 800), N(0.005 + r() * r() * 0.12), 1.2);
    add(a, reson(burst(0.2, 0.05, seed + 3, 0.6), 320, 120), N(0.02), 2);       // wet squelch
    return fade(normalize(a, 0.85), 0.001, 0.05);
  }
  if (kind === 'leather') {      // a leather jacket twisted: stick-slip creaks plus a rustle
    const n = N(1.2), ex = new Float32Array(n); let next = 0.08;
    while (next < 1.05) { const t = next, i = N(t); ex[i] = 0.6 + r() * 0.4; const rate = 40 + 90 * Math.sin((Math.PI * t) / 1.1) ** 2 + r() * 15; next += 1 / rate; }
    const a = new Float32Array(n); reson(ex, 900, 150, a); reson(ex, 2300, 300, a); reson(ex, 380, 80, a);
    const rust = reson(white(n, seed + 1), (i) => 1500 + 1500 * Math.sin(i / SR * 3), 1800);
    for (let i = 0; i < n; i++) a[i] = a[i] * 3 + rust[i] * 0.25 * Math.sin((Math.PI * i) / n);
    return fade(normalize(a, 0.85), 0.01, 0.1);
  }
  // cloth: a sleeve swishing past a body
  const n = N(0.7), w = white(n, seed), a = reson(w, (i) => 1200 + 2600 * (i / n), 2200);
  for (let i = 0; i < n; i++) { const u = i / n; a[i] *= Math.sin(Math.PI * u) ** 1.5 * (0.8 + 0.4 * Math.sin(TAU * 11 * u)); }
  for (let g = 0; g < 25; g++) add(a, hp(burst(0.004, 0.0006, seed + g, 0.3), 3000), N(0.1 + r() * 0.5));
  return fade(normalize(a, 0.75), 0.02, 0.05);
}
export const PROPS = {
  celery: { name: 'Celery snap', plays: 'Bones breaking', how: 'A stick of celery snapped right next to the microphone. The crisp crack and the tearing fibres sound like bone.' },
  coconut: { name: 'Coconut shells', plays: 'Horse hooves', how: 'Two coconut half-shells knocked on a board in a clip-clop rhythm. Their hollow ring sounds like hooves on a road.' },
  cabbage: { name: 'Cabbage punch', plays: 'A punch landing', how: 'A fist driven into a cabbage: a low thump and the crunch of leaves. Real punches are quiet, so films use this instead.' },
  leather: { name: 'Leather jacket', plays: 'Movement and tension', how: 'Twisting a leather jacket near the mic gives the creak of a hero tensing up or a saddle taking weight.' },
  cloth: { name: 'Cloth swish', plays: 'Every movement', how: 'Rubbing fabric in time with the actor. Foley artists call this the cloth or moves pass; a whole film gets one.' },
};

// Creature roar, built as three layers. Each layer on its own sounds nothing like a monster.
export function roarLayer(which, sec = 2.4, seed = 21) {
  const n = N(sec), a = new Float32Array(n), r = rng(seed);
  const env = (t, atk, rel) => clamp(t / atk, 0, 1) * clamp((sec - t) / rel, 0, 1);
  if (which === 'low') {            // rumble: low-passed brown noise plus a 40 Hz sub wobble
    const b = lp(lp(brown(n, seed), 160), 160);
    for (let i = 0; i < n; i++) { const t = i / SR; a[i] = (b[i] * 6 + 0.5 * Math.sin(TAU * (40 + 4 * Math.sin(TAU * 0.8 * t)) * t)) * env(t, 0.35, 0.8); }
  } else if (which === 'mid') {     // growl: a low voice-like buzz, rattled at 28 Hz (roughness), through an "aw" vowel
    const src = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, f = 80 + 35 * Math.sin((Math.PI * t) / sec) + 3 * (r() - 0.5); ph += f / SR; src[i] = ((ph % 1) * 2 - 1) * (0.55 + 0.45 * Math.sin(TAU * 28 * t)) * env(t, 0.2, 0.6); }
    const noi = white(n, seed + 1); for (let i = 0; i < n; i++) src[i] += noi[i] * 0.25 * env(i / SR, 0.2, 0.6);
    reson(src, 520, 160, a); reson(src, 950, 200, a); reson(src, 2400, 400, a);
  } else {                          // screech: a high whistle with vibrato, riding up then down, plus hiss
    const src = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, k = t / sec, f = (1000 + 900 * Math.sin(Math.PI * k) ** 2) * (1 + 0.03 * Math.sin(TAU * 7 * t)); ph += f / SR; src[i] = ((ph % 1) * 2 - 1) * env(t, 0.5, 0.9) * (0.6 + 0.4 * Math.sin(Math.PI * k)); }
    reson(src, (i) => 2600 + 1200 * Math.sin((Math.PI * i) / n), 900, a);
    const h = reson(white(n, seed + 2), 5200, 2500); for (let i = 0; i < n; i++) a[i] += h[i] * 0.2 * env(i / SR, 0.5, 0.9);
  }
  return fade(normalize(a, 0.8), 0.01, 0.1);
}

// A spaceship flying past a listener in a straight line, with the Doppler effect worked out exactly:
// the sound you hear at time t left the ship at an earlier time te, when the ship was |r(te)| away, so
// t − te = |r(te)| / c. Solving that for every sample and reading the engine's signal at te gives the
// pitch rise and fall and the level change for free. Ship: speed v (m/s) along x, closest distance D.
export function passby(v = 100, D = 15, sec = 4, seed = 31) {
  const n = N(sec), a = new Float32Array(n), tMid = sec / 2, table = lp(brown(N(sec + 2), seed), 900), hiss = lp(pink(N(sec + 2), seed + 1), 6000);
  const noiseAt = (arr, t) => { const x = (t + 1) * SR, i = Math.floor(x); return arr[clamp(i, 0, arr.length - 2)] * (1 - (x - i)) + arr[clamp(i + 1, 0, arr.length - 1)] * (x - i); };
  const ratio = new Float32Array(Math.ceil(sec * 50));
  for (let i = 0; i < n; i++) {
    const t = i / SR - tMid;
    let te = t; for (let k = 0; k < 8; k++) te = t - Math.hypot(v * te, D) / C_SOUND;
    const dist = Math.hypot(v * te, D), amp = D / dist;
    // engine: 70 Hz hum with harmonics, a 1.4 kHz turbine whine, and rumble
    let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(TAU * 70 * h * te) / h;
    s = s * 0.35 + 0.12 * Math.sin(TAU * 1400 * te) + noiseAt(table, te) * 3 + noiseAt(hiss, te) * 0.5;
    a[i] = s * amp;
    if (i % (SR / 50) === 0) { const x = v * te, cos = -x / dist; ratio[i / (SR / 50)] = C_SOUND / (C_SOUND - v * cos); }   // f'/f heard at this moment
  }
  const out = fade(normalize(a, 0.85), 0.05, 0.1); out.ratio = ratio;
  return out;
}

// A helicopter loop: blade slaps at the blade-passing rate plus a turbine whine and a tail-rotor buzz.
// A two-blade rotor at about 395 rpm (a light helicopter) passes a blade 2 × 395 / 60 ≈ 13 times a second.
export function helicopter(sec = 2, seed = 41) {
  const bp = 13.2, n = N(Math.round(sec * bp) / bp), a = new Float32Array(n), period = SR / bp;
  for (let k = 0; k * period < n; k++) { const at = Math.round(k * period); add(a, reson(burst(0.06, 0.012, seed + k, 1), 420, 300), at, 3); add(a, lp(burst(0.06, 0.02, seed + 50 + k, 0.6), 150), at); }
  for (let i = 0; i < n; i++) { const t = i / SR; a[i] += 0.05 * Math.sin(TAU * 3200 * t) + 0.08 * (((t * 88) % 1) * 2 - 1); }
  return normalize(a, 0.8);
}

// An original music cue (no one's tune): a slow A minor – F – C – G pad with a soft pulse.
export function musicPad(sec = 8) {
  const n = N(sec), a = new Float32Array(n);
  const chords = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]], hz = (m) => 440 * 2 ** ((m - 69) / 12), bar = sec / 4;
  for (let i = 0; i < n; i++) {
    const t = i / SR, c = chords[Math.min(3, Math.floor(t / bar))], u = (t % bar) / bar, e = Math.min(1, u * 6) * Math.min(1, (1 - u) * 8);
    let v = 0; for (const m of c) { const f = hz(m); v += Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t + 1) + 0.25 * Math.sin(TAU * f * 1.003 * t); }
    v += 0.8 * Math.sin(TAU * hz(c[0] - 12) * t) * (0.6 + 0.4 * Math.cos(TAU * 2 * t));   // bass pulse
    a[i] = v * e * 0.2;
  }
  return fade(normalize(a, 0.7), 0.2, 0.3);
}
// A whoosh and a heavy hit, for the effects stem.
export function whooshHit(sec = 1.6, seed = 51) {
  const n = N(sec), a = reson(white(n, seed), (i) => 400 + 3000 * (i / N(0.9)) ** 2, 1500);
  for (let i = 0; i < n; i++) { const t = i / SR; a[i] *= t < 0.9 ? (t / 0.9) ** 3 : 0; }
  let ph = 0; const at = N(0.9);
  for (let i = at; i < n; i++) { const t = (i - at) / SR, f = 40 + 90 * Math.exp(-t / 0.05); ph += f / SR; a[i] += 1.4 * Math.sin(TAU * ph) * Math.exp(-t / 0.25); }
  add(a, hp(burst(0.3, 0.04, seed + 2, 1), 1500), at, 0.8);
  return fade(normalize(a, 0.85), 0.01, 0.1);
}
// ADR cue: three 1 kHz beeps, evenly spaced; the line starts where a fourth beep would be.
export function beeps(gap = 1, sec = 3.2) {
  const n = N(sec), a = new Float32Array(n);
  for (let k = 0; k < 3; k++) { const at = N(0.1 + k * gap), len = N(0.08); for (let i = 0; i < len; i++) a[at + i] += 0.5 * Math.sin(TAU * 1000 * (i / SR)) * Math.min(1, i / 60, (len - i) / 60); }
  return a;
}
export function silence(sec) { return new Float32Array(N(sec)); }
export function mixInto(dst, src, atSec = 0, gain = 1) { return add(dst, src, N(atSec), gain); }
export function reversed(a) { const b = Float32Array.from(a).reverse(); return b; }

// ---------------------------------------------------------------- analysis (for the boards)
// In-place radix-2 FFT.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}
// Average magnitude spectrum (dB re full scale) of a sound, using Hann-windowed blocks of 2048 samples.
export function spectrum(a, size = 2048) {
  const out = new Float32Array(size / 2), re = new Float32Array(size), im = new Float32Array(size), w = new Float32Array(size);
  let ws = 0; for (let i = 0; i < size; i++) { w[i] = 0.5 - 0.5 * Math.cos((TAU * i) / (size - 1)); ws += w[i]; }
  let blocks = 0;
  for (let s = 0; s + size <= Math.max(a.length, size); s += size / 2) {
    for (let i = 0; i < size; i++) { re[i] = (a[s + i] || 0) * w[i]; im[i] = 0; }
    fft(re, im); for (let k = 0; k < size / 2; k++) out[k] += (re[k] ** 2 + im[k] ** 2); blocks++;
    if (blocks > 60) break;
  }
  for (let k = 0; k < size / 2; k++) out[k] = 10 * Math.log10(Math.max(1e-12, out[k] / blocks)) - dB(ws / 2);
  out.hz = SR / size;
  return out;
}
// Loudness in LUFS of a mono signal: BS.1770's −0.691 + 10·log10(mean square). This skips the K-weighting
// filter (a gentle high-shelf and bass cut), so it reads within a dB or two for ordinary programme.
export function lufs(a, from = 0, to = a.length) { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return -0.691 + 10 * Math.log10(Math.max(1e-12, s / Math.max(1, to - from))); }
export function rmsEnv(a, points = 200) { const out = new Float32Array(points), step = a.length / points; for (let p = 0; p < points; p++) { let s = 0; const i0 = Math.floor(p * step), i1 = Math.floor((p + 1) * step); for (let i = i0; i < i1; i++) s += a[i] * a[i]; out[p] = Math.sqrt(s / Math.max(1, i1 - i0)); } return out; }

// Draw a waveform (min/max per pixel column) into the box x, y, w, h. opts: from/to sample, gain.
export function drawWave(g, a, x, y, w, h, col, { gain = 1, from = 0, to = a.length, alpha = 1 } = {}) {
  const mid = y + h / 2, per = (to - from) / w;
  g.strokeStyle = col; g.globalAlpha = alpha; g.lineWidth = 1.2; g.beginPath();
  for (let px = 0; px < w; px++) {
    let lo = 0, hi = 0; const i0 = Math.floor(from + px * per), i1 = Math.min(a.length, Math.floor(from + (px + 1) * per));
    for (let i = Math.max(0, i0); i < i1; i += Math.max(1, Math.floor(per / 24))) { const v = a[i] * gain; if (v < lo) lo = v; if (v > hi) hi = v; }
    g.moveTo(x + px + 0.5, mid - clamp(hi, -1, 1) * h / 2); g.lineTo(x + px + 0.5, mid - clamp(lo, -1, 1) * h / 2 + 0.6);
  }
  g.stroke(); g.globalAlpha = 1;
}
// Draw a spectrum on a log-frequency axis from f0 to f1 Hz, dB from lo to hi. shift multiplies frequency.
export function drawSpectrum(g, sp, x, y, w, h, col, { f0 = 30, f1 = 16000, lo = -100, hi = -20, shift = 1, fill = true, gain = 0 } = {}) {
  const fx = (f) => x + (Math.log(f / f0) / Math.log(f1 / f0)) * w, yv = (d) => y + h - clamp((d - lo) / (hi - lo), 0, 1) * h;
  g.beginPath(); g.moveTo(x, y + h);
  for (let k = 1; k < sp.length; k++) { const f = k * sp.hz * shift; if (f < f0) continue; if (f > f1) break; g.lineTo(fx(f), yv(sp[k] + gain)); }
  g.lineTo(fx(Math.min(f1, sp.length * sp.hz * shift)), y + h); g.closePath();
  if (fill) { g.fillStyle = col + '44'; g.fill(); }
  g.strokeStyle = col; g.lineWidth = 1.6; g.stroke();
}
export function freqAxis(g, x, y, w, f0 = 30, f1 = 16000) {
  const fx = (f) => x + (Math.log(f / f0) / Math.log(f1 / f0)) * w;
  g.font = '14px sans-serif'; g.fillStyle = 'rgba(255,255,255,.5)'; g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1;
  for (const [f, s] of [[50, '50'], [100, '100'], [200, '200'], [500, '500'], [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k']]) if (f > f0 && f < f1) { g.beginPath(); g.moveTo(fx(f), y - 200); g.lineTo(fx(f), y); g.stroke(); g.fillText(s, fx(f) - 8, y + 16); }
  return fx;
}

// ---------------------------------------------------------------- the player
// Sound starts only after a real click or key press, respects the mute button, and never plays while
// the studio records a video (body.gb-reel or ?reel=1).
let ctx = null, master = null, wet = null, gestured = false;
const live = new Set(), cache = new WeakMap();
if (typeof window !== 'undefined') ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, () => { gestured = true; }, { capture: true, passive: true }));
export const recording = () => document.body.classList.contains('gb-reel') || /[?&]reel=1/.test(location.search);

function ready() {
  if (audio.muted || recording()) return null;
  if (!gestured && !navigator.userActivation?.hasBeenActive) return null;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!master) {
      master = ctx.createGain(); master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      // A small room reverb (decaying noise impulse response) for distant sounds.
      const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 1.2), ir = ctx.createBuffer(2, len, ctx.sampleRate), r = rng(77);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.exp((-6 * i) / len); }
      conv.buffer = ir; wet = ctx.createGain(); wet.gain.value = 0.35; wet.connect(conv).connect(master);
    }
    return ctx;
  } catch { return null; }
}
function bufferOf(a) {
  let b = cache.get(a);
  if (!b) { b = ctx.createBuffer(1, a.length, SR); b.copyToChannel(a, 0); cache.set(a, b); }
  return b;
}
export const player = {
  get ctx() { return ctx; },
  canPlay() { return !audio.muted && !recording(); },
  // Play a sample array. opts: gain, rate (playback speed, which shifts pitch), pan (−1…1), reverb (0…1),
  // at (seconds from now), loop, panner (a PannerNode to route through), gainNode (existing node to feed).
  play(a, { gain = 1, rate = 1, pan = 0, reverb = 0, at = 0, loop = false, panner = null, to = null, hpHz = 0, lpHz = 0 } = {}) {
    const ac = ready(); if (!ac || !a?.length) return null;
    try {
      const src = ac.createBufferSource(); src.buffer = bufferOf(a); src.playbackRate.value = rate; src.loop = loop;
      const g = ac.createGain(); g.gain.value = gain;
      // optional band limits (e.g. to imitate a small phone speaker): 12 dB/octave biquads
      let head = src;
      for (const [type, f] of [['highpass', hpHz], ['lowpass', lpHz]]) if (f > 0) { const bq = ac.createBiquadFilter(); bq.type = type; bq.frequency.value = f; head.connect(bq); head = bq; }
      head.connect(g);
      let out = g;
      if (panner) { g.connect(panner); out = null; }
      else if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); out = p; }
      const dest = to || master;
      if (out) { out.connect(dest); if (reverb > 0 && !to) { const s = ac.createGain(); s.gain.value = reverb; out.connect(s).connect(wet); } }
      const when = ac.currentTime + Math.max(0, at);
      src.start(when); const item = { src, g, t0: when }; live.add(item);
      src.onended = () => live.delete(item);
      return item;
    } catch { return null; }
  },
  node(kind = 'gain') { const ac = ready(); if (!ac) return null; if (kind === 'panner') { const p = ac.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.connect(master); return p; } const g = ac.createGain(); g.connect(master); return g; },
  now() { return ctx ? ctx.currentTime : 0; },
  stopAll() { live.forEach((it) => { try { it.src.stop(); } catch { /* already stopped */ } }); live.clear(); },
  // Keep the master in step with the mute button, so ringing sounds fall silent too.
  sync() { if (master && ctx) { const want = audio.muted || recording() ? 0 : 0.9; if (Math.abs(master.gain.value - want) > 0.01) master.gain.setTargetAtTime(want, ctx.currentTime, 0.02); if (want === 0 && live.size) this.stopAll(); } },
};

// ---------------------------------------------------------------- boards and stage helpers
export function panelBg(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.92)'; g.fillRect(0, 0, w, h); }
export function board(root, w, h, pxW, pxH, draw, pos) {
  const c = document.createElement('canvas'); c.width = pxW; c.height = pxH;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const redraw = () => { draw(g, pxW, pxH); tex.needsUpdate = true; };
  redraw();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  m.position.set(...pos); root.add(m);
  return { tex, redraw, canvas: c, mesh: m };
}
export function title(g, s, sub = '', y = 36) {
  g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText(s, 22, y);
  if (sub) { g.font = '18px sans-serif'; g.fillStyle = 'rgba(255,255,255,.62)'; g.fillText(sub, 22, y + 26); }
}
export function text(g, s, x, y, { font = '18px sans-serif', col = 'rgba(255,255,255,.8)', align = 'left' } = {}) { g.font = font; g.fillStyle = col; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left'; }
export function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export const COL = { voice: '#8ef0ff', noise: '#ff5a8a', music: '#c49bff', fx: '#ffb547', foley: '#5ce1a9', amb: '#7fa7ff', low: '#ff7a59', mid: '#ffd166', high: '#8ef0ff', soft: 'rgba(255,255,255,.55)', hot: '#ffd166', bad: '#ff5a8a', good: '#7be08c' };
export const HEX = { voice: 0x8ef0ff, noise: 0xff5a8a, music: 0xc49bff, fx: 0xffb547, foley: 0x5ce1a9, amb: 0x7fa7ff, low: 0xff7a59, mid: 0xffd166, high: 0x8ef0ff };

export const inReel = () => document.body.classList.contains('gb-reel');
// On a phone-width stage: hide minor labels and nudge the picture down, clear of the readout.
export function fitNarrow(stage, minor = [], y0 = -0.14) {
  const narrow = stage.host.clientWidth < 560;
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const y = narrow && !inReel() ? y0 : 0;
  if (!stage.shift || stage.shift[1] !== y) stage.setShift(0, y);
  return narrow;
}
// Boards sit beside the model on a wide screen; in the tall reel video they move to reelPos.
export function reelBoards(list) {
  const r = inReel();
  list.forEach(([b, pos, scale = 1, rotY = 0]) => {
    if (!b.home) b.home = { p: b.mesh.position.clone(), r: b.mesh.rotation.clone(), s: b.mesh.scale.x };
    if (r) { b.mesh.position.set(...pos); b.mesh.scale.setScalar(scale); b.mesh.rotation.set(0, rotY, 0); }
    else { b.mesh.position.copy(b.home.p); b.mesh.scale.setScalar(b.home.s); b.mesh.rotation.copy(b.home.r); }
  });
}
// Press the matching seg button in the panel, so a tap on the stage updates the control and readout.
export function pressSeg(value, label = null) {
  const segs = [...document.querySelectorAll('#panel .ctl-seg')].filter((el) => !label || el.querySelector('label')?.textContent === label);
  for (const el of segs) { const b = [...el.querySelectorAll('.seg button')].find((x) => x.dataset.v === String(value)); if (b) { b.click(); return true; } }
  return false;
}
export function pressButton(text) { const b = [...document.querySelectorAll('#panel .btnrow button')].find((x) => x.textContent === text); if (b) b.click(); return !!b; }

// A rod that can be re-aimed every frame: between([x,y,z], [x,y,z]).
export function stick(r, mat, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat); m.castShadow = true;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  m.between = (a, b) => { A.set(...a); B.set(...b); const L = A.distanceTo(B); m.visible = L > 1e-3; if (!m.visible) return; m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(Y, B.sub(A).normalize()); };
  return m;
}

// ---------------------------------------------------------------- 3D props (all generic, built here)
// A faceless mannequin, feet at the origin, facing +z. s = 1 is about 1.75 m tall; the mouth is at 1.60 m.
export function makePerson({ shirt = 0x3b6fd8, pants = 0x2b3242, skin = 0xd9c3a5, hair = 0x2a1d16, s = 1 } = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const cloth = M.matte(shirt), jeans = M.matte(pants), sk = M.matte(skin, { roughness: 0.6 });
  const hipY = 0.92 * s;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * s, 0.38 * s, 6, 14), cloth); torso.position.y = 0.3 * s; torso.scale.x = 1.25; torso.castShadow = true; body.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.05 * s, 0.1 * s, 10), sk); neck.position.y = 0.62 * s; body.add(neck);
  const head = sphere(0.11 * s, sk, 24); head.scale.set(0.95, 1.12, 0.95); head.position.y = 0.76 * s; body.add(head);
  if (hair !== null) { const hm = new THREE.Mesh(new THREE.SphereGeometry(0.118 * s, 20, 10, 0, TAU, 0, 1.35), M.matte(hair)); hm.position.copy(head.position); hm.position.y += 0.012 * s; hm.rotation.x = -0.45; body.add(hm); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018 * s, 10, 8), sk); nose.position.set(0, head.position.y - 0.005 * s, 0.1 * s); body.add(nose);
  const limb = (len, r, mat) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 10), mat); m.position.y = -len / 2; m.castShadow = true; p.add(m); return p; };
  const arms = [-1, 1].map((x) => { const a = limb(0.62 * s, 0.05 * s, cloth); a.position.set(x * 0.24 * s, 0.52 * s, 0); body.add(a); const hand = sphere(0.05 * s, sk, 12); hand.position.y = -0.62 * s; a.add(hand); a.hand = hand; return a; });
  const legs = [-1, 1].map((x) => { const l = limb(0.88 * s, 0.065 * s, jeans); l.position.set(x * 0.1 * s, hipY, 0); g.add(l); const shoe = box(0.1 * s, 0.07 * s, 0.22 * s, M.matte(0x1b1d22)); shoe.position.set(0, -0.88 * s, 0.05 * s); l.add(shoe); return l; });
  body.position.y = hipY;
  // arm / armR: forward swing (radians), open: sideways lift, lean forward, stride: leg swing
  g.pose = ({ arm = 0, armR = arm, open = 0, lean = 0, stride = 0, lift = 0, liftR = 0 } = {}) => {
    arms[0].rotation.set(-arm, 0, -open); arms[1].rotation.set(-armR, 0, open);
    body.rotation.x = lean;
    legs[0].rotation.x = -stride - lift; legs[1].rotation.x = stride - liftR;
  };
  g.arms = arms; g.legs = legs; g.body = body; g.head = head; g.torso = torso;
  g.mouth = () => new THREE.Vector3(0, 1.6 * s, 0.1 * s);
  return g;
}
// A shotgun microphone along +x (capsule end at +x), with an optional furry windshield ("dead cat").
export function makeShotgun(len = 0.25, fur = true) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, len, 16), M.metal(0x8a919c, { roughness: 0.35 })); body.rotation.z = Math.PI / 2; g.add(body);
  for (let i = 0; i < 6; i++) { const slot = box(0.012, 0.004, 0.02, M.matte(0x111216)); slot.position.set(len * 0.05 + i * len * 0.07, 0, 0); g.add(slot); }
  if (fur) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, len * 1.05, 6, 16), M.matte(0x9a9488, { roughness: 1 })); f.rotation.z = Math.PI / 2; g.add(f); g.fur = f; }
  return g;
}
// A cabinet speaker facing +z: a box with a woofer and a horn tweeter.
export function makeSpeaker(w = 0.5, h = 0.8, d = 0.4, color = 0x1b1e25) {
  const g = new THREE.Group();
  const cab = box(w, h, d, M.matte(color)); g.add(cab);
  const cone = new THREE.Mesh(new THREE.CircleGeometry(w * 0.36, 28), M.matte(0x2f333c)); cone.position.set(0, -h * 0.18, d / 2 + 0.002); g.add(cone);
  const dust = new THREE.Mesh(new THREE.CircleGeometry(w * 0.1, 20), M.matte(0x464b56)); dust.position.set(0, -h * 0.18, d / 2 + 0.004); g.add(dust);
  const horn = box(w * 0.6, h * 0.16, 0.02, M.matte(0x2f333c)); horn.position.set(0, h * 0.28, d / 2 + 0.01); g.add(horn);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(w * 0.38, 28), M.glow(0x8ef0ff, { transparent: true, opacity: 0 })); glow.position.set(0, -h * 0.18, d / 2 + 0.006); g.add(glow);
  g.glow = glow; g.cone = cone;
  return g;
}
// A cine camera with its lens along +z, about 45 cm long, on a tripod of height h.
export function makeCamera(h = 1.45) {
  const g = new THREE.Group(), dark = M.matte(0x2a2d34), steel = M.metal(0x3a3f4b);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; g.add(beam([Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35], [0, h - 0.1, 0], 0.014, steel)); }
  const head = box(0.14, 0.08, 0.14, M.matte(0x1b1d22)); head.position.y = h - 0.06; g.add(head);
  const bodyC = box(0.16, 0.2, 0.3, dark); bodyC.position.y = h + 0.1; g.add(bodyC);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.18, 24), M.matte(0x16181d)); lens.rotation.x = Math.PI / 2; lens.position.set(0, h + 0.1, 0.24); g.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), M.glass({ color: 0x9fd8ff })); glass.position.set(0, h + 0.1, 0.331); g.add(glass);
  const tally = sphere(0.012, M.glow(0xff3344), 10); tally.position.set(0.06, h + 0.21, 0.1); g.add(tally);
  g.lensY = h + 0.1; g.tally = tally;
  return g;
}
// A polar-pattern lobe: a sphere whose radius in each direction is |A + (1 − A)·cosθ| (θ from +x).
export function lobeGeometry(A = 0.37, R = 1) {
  const geo = new THREE.SphereGeometry(1, 48, 32), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const r = Math.abs(A + (1 - A) * v.x) * R; p.setXYZ(i, v.x * r, v.y * r, v.z * r); }
  geo.computeVertexNormals();
  return geo;
}
export const PATTERNS = {
  omni: { A: 1, DI: 0, name: 'omni' },
  cardioid: { A: 0.5, DI: 4.8, name: 'cardioid' },
  super: { A: 0.37, DI: 5.7, name: 'supercardioid / shotgun' },
};
export const patternGain = (A, theta) => Math.abs(A + (1 - A) * Math.cos(theta));

export { clamp, THREE, M, box, beam, sphere };
