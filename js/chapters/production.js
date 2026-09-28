// Chapter 1: production sound. Recording the actors' voices on set.
//  - Speech: about 62 dB SPL at 1 m for a normal voice (ANSI S3.5-1997).
//  - Inverse-square law (free field): L(d) = L(1 m) − 20·log10(d). Indoors, reflections add a floor
//    beyond about 1–2 m (the critical distance), which the box shows as extra reverb, not extra level.
//  - Microphone patterns r(θ) = A + (1 − A)·cosθ (A = 1 omni, 0.5 cardioid, 0.37 supercardioid). A shotgun
//    acts like a supercardioid at speech frequencies. Diffuse noise pickup is lowered by the directivity
//    index: 0 / 4.8 / 5.7 dB (Eargle, The Microphone Book).
//  - Background noise (typical A-weighted levels, rough): a sound stage built to NC 20–25 is about 30 dBA,
//    a quiet room on location with a fridge or AC about 45 dBA, a busy street about 65 dBA, standing near
//    a diesel generator about 70 dBA (sound stage and noise-criteria guides; WHO/CPCB street levels).
//  - SNR rules of thumb used in the readout: 25 dB or more is clean dialogue, 15–25 dB is usable after
//    noise reduction, under 15 dB the line is a candidate for ADR. These are working rules, not standards.
//  - Frame geometry: the camera's lens sees a rectangle on the actor's plane. The boom must stay above the
//    top edge of that pyramid. Close-ups let the mic come close; wide shots push it far away.
import { THREE, M, box, clamp } from '../kit.js';
import {
  board, panelBg, title, text, rrect, COL, HEX, fitNarrow, reelBoards, stick, pressSeg,
  makePerson, makeShotgun, makeCamera, lobeGeometry, PATTERNS, patternGain, dB, undB, D2R,
  voice, ambience, drawWave, player, rmsEnv,
} from '../sound.js';

const MICS = {
  boom: { name: 'Boom (shotgun)', pat: 'super' },
  lav: { name: 'Lavalier', pat: 'omni' },
  cam: { name: 'Camera mic', pat: 'cardioid' },
};
// Shot sizes: frame top and height (m) on the actor's plane, and how far the camera stands.
const SHOTS = {
  cu: { name: 'Close-up', top: 1.9, h: 0.55, cam: 1.6 },
  ms: { name: 'Medium shot', top: 2.02, h: 1.15, cam: 2.6 },
  ws: { name: 'Wide shot', top: 2.75, h: 2.6, cam: 4.6 },
};
const NOISE = {
  stage: { name: 'Sound stage', db: 30 },
  room: { name: 'Room on location', db: 45 },
  street: { name: 'Busy street', db: 65 },
  gen: { name: 'Near a generator', db: 70 },
};
const DEFAULTS = { mic: 'boom', shot: 'ms', dist: 0.9, aim: 0, bg: 'room' };
const SPEECH_1M = 62, LAV_D = 0.24, ELEV = 55 * D2R;
const MOUTH = new THREE.Vector3(0, 1.6, 0.1);

// Everything the readout and boards need, from the settings.
export function model(s) {
  const shot = SHOTS[s.shot], mic = MICS[s.mic], pat = PATTERNS[mic.pat];
  const lensY = 1.5, lensZ = shot.cam - 0.35;
  const yTop = (z) => lensY + (shot.top - lensY) * (lensZ - z) / (lensZ - MOUTH.z + 0.1);
  const micAt = (d) => new THREE.Vector3(0, MOUTH.y + d * Math.sin(ELEV), MOUTH.z + d * Math.cos(ELEV));
  const inShot = (d) => { const p = micAt(d); return p.y - 0.05 < yTop(p.z); };
  let minD = 0.1; while (minD < 5 && inShot(minD)) minD += 0.01;
  let d, theta;
  if (s.mic === 'boom') { d = s.dist; theta = s.aim * D2R; }
  else if (s.mic === 'lav') { d = LAV_D; theta = 0; }
  else { d = shot.cam - 0.1; theta = 0; }
  const g = patternGain(pat.A, theta);
  const voiceDb = SPEECH_1M - 20 * Math.log10(d) + dB(g);
  const noiseDb = NOISE[s.bg].db - pat.DI;
  const snr = voiceDb - noiseDb;
  const inFrame = s.mic === 'boom' && inShot(d);
  return { shot, mic, pat, d, theta, g, voiceDb, noiseDb, snr, minD, inFrame, yTop, micAt, lensY, lensZ };
}
const verdict = (snr) => (snr >= 25 ? ['Clean dialogue.', COL.good] : snr >= 15 ? ['Usable after noise reduction.', COL.hot] : ['Too noisy: this line may need ADR.', COL.bad]);

export default {
  id: 'production',
  short: 'On set',
  title: 'Recording the voices on set',
  subtitle: 'Aim a boom mic, clip on a lavalier, and see why the mic hangs just out of frame.',
  view: { pos: [5.9, 2.4, 1.0], target: [0, 1.55, 0.0] },
  learn: `<p>On a film set the <b>production sound</b> team records the actors’ voices. The picture and sound go to separate machines, and FilmClear shows how the clapperboard lines them up again. Here we look at the microphones.</p>
    <p>The workhorse is a <b>shotgun mic</b> on a <b>boom</b> pole. A shotgun hears best straight ahead and ignores much of the sound from the sides: its <b>polar pattern</b> is a long lobe, drawn here in 3D. Aim it at the mouth. Aim it at the chest and the voice drops. Actors also wear a tiny <b>lavalier</b> (lav) mic hidden in their clothes, sending sound by radio. It is always close, but it can catch rustling cloth.</p>
    <p>Distance is everything. Sound spreads out as it travels, so its power falls with the <b>square</b> of the distance: <b>twice as far, a quarter of the power</b>, 6 dB quieter. The background noise stays the same, so the <b>signal-to-noise ratio</b> (SNR) drops. That is why the boom operator hangs the mic <b>as low as it can go without appearing in the shot</b>. A close-up lets the mic come close. A wide shot pushes it far away, which is when lavs earn their keep.</p>
    <p>Before a scene wraps, everyone freezes for 30 seconds so the recordist can capture <b>room tone</b>: the “silence” of that room. Editors use it to fill gaps so the background never drops out. Noise has always been the enemy: India’s first sound film, <b>Alam Ara</b> (1931), was shot between about 1 and 4 in the morning to dodge the trains running past the studio. How we hear it all is in EarClear, and what a sound wave is in WaveClear.</p>
    <p class="tip"><b>Try it:</b> slide the mic distance and watch the SNR. Switch to a wide shot and press “Go to the frame line”. Then aim the mic off the mouth, and try the busy street.</p>`,
  terms: [
    { t: 'Boom', d: 'A long pole that holds a microphone above the actors, just outside the frame.' },
    { t: 'Shotgun microphone', d: 'A long, narrow mic that hears mostly what it points at.' },
    { t: 'Polar pattern', d: 'A map of how sensitive a microphone is in each direction.' },
    { t: 'Lavalier', d: 'A tiny mic clipped to or hidden in an actor’s clothes, usually radio-linked.' },
    { t: 'Inverse-square law', d: 'Sound power falls with the square of distance: 6 dB less each time the distance doubles.' },
    { t: 'Signal-to-noise ratio', d: 'How much louder the voice is than the background, in decibels.' },
    { t: 'Room tone', d: 'A recording of the room’s own quiet, used to fill gaps in the edit.' },
    { t: 'Decibel (dB)', d: 'A ratio scale for loudness: +10 dB is ten times the power.' },
  ],
  defaults: DEFAULTS,
  controls: [
    { key: 'mic', type: 'seg', label: 'Microphone', options: Object.entries(MICS).map(([v, m]) => ({ v, label: m.name })) },
    { key: 'shot', type: 'seg', label: 'Shot size', options: Object.entries(SHOTS).map(([v, m]) => ({ v, label: m.name })) },
    { key: 'dist', type: 'range', label: 'Boom mic distance from the mouth', min: 0.2, max: 3, step: 0.01, ends: ['20 cm', '3 m'], fmt: (v) => `${v.toFixed(2)} m` },
    { key: 'aim', type: 'range', label: 'Aim off the mouth', min: 0, max: 90, step: 1, ends: ['on the mouth', '90° off'], fmt: (v) => `${v}° off axis` },
    { key: 'bg', type: 'seg', label: 'Background noise', options: Object.entries(NOISE).map(([v, n]) => ({ v, label: n.name })), fmt: (v) => `about ${NOISE[v].db} dBA` },
    { key: 'hear', type: 'buttons', label: 'Listen', items: [
      { label: 'Hear the take', act: (s, inst) => inst.listen?.(false) },
      { label: 'Hear room tone', act: (s, inst) => inst.listen?.(true) },
      { label: 'Go to the frame line', act: (s) => { s.mic = 'boom'; s.dist = Math.min(3, +(model(s).minD + 0.03).toFixed(2)); } },
    ] },
  ],
  quiz: [
    { q: 'The boom mic moves from 50 cm to 1 m from the actor. The voice at the mic gets…', options: ['twice as loud', 'about 6 dB quieter', 'exactly the same', '50 dB quieter'], answer: 1, why: 'Twice the distance spreads the sound over four times the area, a quarter of the power: 6 dB less.' },
    { q: 'Why does the boom operator hang the mic just above the frame line?', options: ['So the actors can see it', 'It is the closest the mic can get without being in the shot', 'Microphones only work upside down', 'To keep it cool'], answer: 1, why: 'Closer means a louder voice against the same noise. The frame edge is the limit.' },
    { q: 'What is room tone for?', options: ['Tuning the actors’ voices', 'Filling gaps in the edit with the room’s own background sound', 'Testing the lights', 'Measuring the room’s size'], answer: 1, why: 'Every room has its own quiet hum. Editors lay it under cuts so the background never drops out.' },
  ],
  reel: [
    { ms: 5200, caption: 'On set, a boom mic hangs just out of frame, as close to the mouth as the shot allows.', set: { mic: 'boom', shot: 'ms', bg: 'room', aim: 0, dist: 1.6 }, anim: { dist: [1.6, 0.58] }, spin: 0.25, view: { pos: [2.4, 2.4, 3.6], target: [0, 1.6, 0.4] } },
    { ms: 5200, caption: 'Double the distance and the voice drops 6 dB, but the street noise stays the same.', set: { mic: 'boom', shot: 'ws', bg: 'street', aim: 0, dist: 0.4 }, anim: { dist: [0.4, 2.6] }, spin: 0, view: { pos: [3.6, 3.0, 5.6], target: [0, 1.7, 0.6] } },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---------------------------------------------------------------- the set: a flat wall, a rug, a window
    const wall = box(0.08, 2.9, 4, M.matte(0x9c8a72)); wall.position.set(-1.6, 1.45, -0.6); root.add(wall);
    const win = box(0.03, 1.0, 1.2, M.glow(0x8ec5ff)); win.position.set(-1.55, 1.7, 0.6); root.add(win);
    const bar1 = box(0.05, 1.0, 0.05, M.matte(0x5b4633)); bar1.position.set(-1.53, 1.7, 0.6); root.add(bar1);
    const rug = box(3, 0.02, 2, M.matte(0x7a3b3b)); rug.position.set(0, 0.01, -0.1); root.add(rug);
    const actor = makePerson({ shirt: 0xe07a5f, pants: 0x3a3226 }); root.add(actor);
    // ---------------------------------------------------------------- camera and the frame pyramid
    const cam = makeCamera(1.4); cam.rotation.y = Math.PI; root.add(cam);
    const frameGeo = new THREE.BufferGeometry(); frameGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 3), 3));
    const frameLines = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8 })); root.add(frameLines);
    const frameFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.ghost(0xffd166, 0.06)); root.add(frameFill);
    const topPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.ghost(0xffd166, 0.1)); root.add(topPlane);
    // ---------------------------------------------------------------- boom operator, pole, mic, lobe
    const op = makePerson({ shirt: 0x5ce1a9, pants: 0x22252c, skin: 0xb88a67 }); op.position.set(-0.7, 0, -1.05); op.rotation.y = 0.6; op.pose({ arm: 2.3, armR: 2.0, open: 0.25 }); root.add(op);
    const pole = stick(0.02, M.metal(0x3a3f4b)); root.add(pole);
    const mic = makeShotgun(0.26, true); root.add(mic);
    const lobeMat = M.ghost(0x8ef0ff, 0.22), wireMat = new THREE.MeshBasicMaterial({ color: 0x8ef0ff, wireframe: true, transparent: true, opacity: 0.3 });
    const lobes = {};
    for (const [k, p] of Object.entries(PATTERNS)) { const geo = lobeGeometry(p.A, 1); const m = new THREE.Group(); m.add(new THREE.Mesh(geo, lobeMat), new THREE.Mesh(geo, wireMat)); lobes[k] = m; root.add(m); }
    const axisLine = stick(0.004, M.glow(0x8ef0ff)); root.add(axisLine);
    // lavalier on the chest with a wire to the transmitter pack on the belt
    const lav = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.012, 4, 8), M.matte(0x111216)); lav.position.set(0, 1.36, 0.17); root.add(lav);
    const pack = box(0.07, 0.1, 0.03, M.matte(0x16181d)); pack.position.set(0.12, 1.0, -0.17); root.add(pack);
    const lavWire = stick(0.003, M.matte(0x111216)); lavWire.between([0, 1.36, 0.16], [0.12, 1.02, -0.15]); root.add(lavWire);
    // the recordist's cart
    const cart = box(0.7, 0.8, 0.45, M.matte(0x2a2d34)); cart.position.set(-0.6, 0.4, 2.2); root.add(cart);
    const recBox = box(0.4, 0.12, 0.28, M.matte(0x3a3f4b)); recBox.position.set(-0.6, 0.86, 2.2); root.add(recBox);
    const meter = box(0.03, 0.1, 0.01, M.glow(0x7be08c)); meter.position.set(-0.4, 0.9, 2.35); root.add(meter);
    const recLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), M.glow(0xff3344)); recLed.position.set(-0.72, 0.94, 2.34); root.add(recLed);
    // noise makers: cars on a street behind the set, or a generator
    const cars = [0, 1].map((i) => { const c = new THREE.Group(); const b = box(1.6, 0.5, 0.7, M.plastic(i ? 0xffd166 : 0x3b6fd8)); b.position.y = 0.4; const t = box(0.9, 0.35, 0.65, M.plastic(0x222831)); t.position.set(-0.1, 0.8, 0); c.add(b, t); c.position.x = -3.4 - i * 0.9; c.rotation.y = Math.PI / 2; root.add(c); return c; });
    const road = box(2.4, 0.02, 12, M.matte(0x2a2d34)); road.position.set(-3.8, 0.01, 0); root.add(road);
    const gen = new THREE.Group(); const gb = box(1.1, 0.8, 0.7, M.plastic(0xffb547)); gb.position.y = 0.4; const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 10), M.metal(0x555b66)); ex.position.set(0.35, 0.95, 0); gen.add(gb, ex); gen.position.set(-3.0, 0, -2.2); root.add(gen);
    const noiseRings = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 48), M.glow(0xff5a8a, { transparent: true, opacity: 0.5 })); r.rotation.y = Math.PI / 2; root.add(r); return r; });

    const L = {
      actor: stage.label('Actor', [0, 0.75, 0.3], root),
      mic: stage.label('Boom mic', [0, 2.4, 0.5], root, 'hot'),
      op: stage.label('Boom operator', [-0.7, 0.4, -1.05], root),
      cam: stage.label('Camera', [0, 1.05, 2.6], root),
      frame: stage.label('Top of frame', [0.6, 2.0, 0], root),
      lav: stage.label('Lavalier', [0.35, 1.36, 0.2], root),
      rec: stage.label('Recorder', [-0.6, 0.5, 2.2], root),
      noise: stage.label('Noise', [0, 1.4, -3], root),
    };

    // ---------------------------------------------------------------- sounds (made once; the model draws them too)
    const V = voice(2.6, 3), noises = {}, rmsOf = (a) => Math.sqrt(a.reduce((x, v) => x + v * v, 0) / a.length);
    const noiseOf = (k) => (noises[k] ||= ambience(k === 'gen' ? 'generator' : k === 'stage' ? 'room' : k, 2.6, 5));
    const rmsV = rmsOf(V);
    let s0 = { ...DEFAULTS }, stageKey = DEFAULTS.bg, key0 = '', t = 0, st = model(DEFAULTS);

    // ---------------------------------------------------------------- boards
    const hearB = board(root, 2.4, 1.2, 880, 440, (g, w, h) => {
      panelBg(g, w, h);
      const [msg, col] = verdict(st.snr);
      title(g, 'What the microphone hears', `${st.mic.name} · voice ${st.voiceDb.toFixed(0)} dB, noise ${st.noiseDb.toFixed(0)} dB`);
      const N0 = noiseOf(stageKey), gn = (rmsV / rmsOf(N0)) * undB(-st.snr);
      const lane = (y, lab, c) => { text(g, lab, 22, y + 8, { font: 'bold 15px sans-serif', col: c }); };
      lane(98, 'VOICE', COL.voice); drawWave(g, V, 110, 78, w - 130, 50, COL.voice, { gain: 0.9 });
      lane(160, 'NOISE', COL.noise); drawWave(g, N0, 110, 140, w - 130, 50, COL.noise, { gain: Math.min(4, gn) * 0.9 });
      lane(250, 'MIX', '#e8eef8');
      const mix = new Float32Array(V.length); for (let i = 0; i < V.length; i++) mix[i] = V[i] + N0[i] * gn;
      drawWave(g, mix, 110, 205, w - 130, 90, '#e8eef8', { gain: 0.7 });
      // SNR bar
      const x0 = 22, y0 = 330, bw = w - 44;
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x0, y0, bw, 24);
      const zones = [[0, 15, COL.bad], [15, 25, COL.hot], [25, 50, COL.good]];
      for (const [a, b, c] of zones) { g.fillStyle = c + '33'; g.fillRect(x0 + (a / 50) * bw, y0, ((b - a) / 50) * bw, 24); }
      const v = clamp(st.snr, 0, 50); g.fillStyle = col; g.fillRect(x0 + (v / 50) * bw - 3, y0 - 6, 6, 36);
      for (const t of [0, 10, 20, 30, 40, 50]) text(g, t + ' dB', x0 + (t / 50) * bw - (t === 50 ? 40 : 0), y0 + 48, { font: '14px sans-serif', col: 'rgba(255,255,255,.5)' });
      text(g, `SNR ${st.snr.toFixed(0)} dB: ${msg}`, 22, 420, { font: 'bold 22px sans-serif', col });
      if (st.inFrame) { g.fillStyle = COL.bad; rrect(g, w - 250, 12, 230, 40, 10); g.fill(); text(g, 'BOOM IN SHOT!', w - 135, 40, { font: 'bold 22px sans-serif', col: '#111', align: 'center' }); }
    }, [-0.3, 2.9, -2.2]);
    hearB.mesh.rotation.y = 1.05;
    const distB = board(root, 2.0, 1.2, 740, 440, (g, w, h) => {
      panelBg(g, w, h);
      title(g, 'Level against distance', 'voice falls 6 dB per doubling; noise stays');
      const x0 = 70, y0 = 90, pw = w - 100, ph = 270, dMax = 3, lo = 20, hi = 90;
      const X = (d) => x0 + (d / dMax) * pw, Y = (L) => y0 + ph - ((clamp(L, lo, hi) - lo) / (hi - lo)) * ph;
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
      for (let L = lo; L <= hi; L += 10) { g.beginPath(); g.moveTo(x0, Y(L)); g.lineTo(x0 + pw, Y(L)); g.stroke(); text(g, String(L), 30, Y(L) + 5, { font: '14px sans-serif', col: 'rgba(255,255,255,.45)' }); }
      for (let d = 0; d <= 3; d += 0.5) text(g, d + ' m', X(d) - 10, y0 + ph + 22, { font: '14px sans-serif', col: 'rgba(255,255,255,.45)' });
      if (s0.mic === 'boom') { g.fillStyle = 'rgba(255,90,138,.14)'; g.fillRect(X(0), y0, X(st.minD) - X(0), ph); text(g, 'in shot', X(0) + 6, y0 + 18, { font: 'bold 15px sans-serif', col: COL.bad }); }
      g.strokeStyle = COL.voice; g.lineWidth = 3; g.beginPath();
      for (let i = 1; i <= 200; i++) { const d = (i / 200) * dMax, L = 62 - 20 * Math.log10(d) + dB(st.g); i === 1 ? g.moveTo(X(d), Y(L)) : g.lineTo(X(d), Y(L)); }
      g.stroke();
      g.strokeStyle = COL.noise; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(X(0), Y(st.noiseDb)); g.lineTo(X(dMax), Y(st.noiseDb)); g.stroke(); g.setLineDash([]);
      text(g, 'noise', X(dMax) - 50, Y(st.noiseDb) - 8, { font: 'bold 15px sans-serif', col: COL.noise });
      const d = Math.min(st.d, dMax), Lv = st.voiceDb;
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(X(d), Y(Lv)); g.lineTo(X(d), Y(st.noiseDb)); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(X(d), Y(Lv), 8, 0, Math.PI * 2); g.fill();
      text(g, `SNR ${st.snr.toFixed(0)} dB`, X(d) + 12, (Y(Lv) + Y(st.noiseDb)) / 2, { font: 'bold 18px sans-serif', col: '#fff' });
      text(g, 'dB SPL at the mic', 22, h - 20, { font: '15px sans-serif', col: 'rgba(255,255,255,.5)' });
    }, [-0.3, 1.5, -2.35]);
    distB.mesh.rotation.y = 1.05;

    const tmpQ = new THREE.Quaternion(), X1 = new THREE.Vector3(1, 0, 0);
    const placeLobe = (grp, pos, dir, R) => { grp.position.copy(pos); grp.quaternion.copy(tmpQ.setFromUnitVectors(X1, dir.clone().normalize())); grp.scale.setScalar(R); };

    const inst = {
      listen(roomOnly) {
        player.stopAll();
        const N0 = noiseOf(stageKey), gn = Math.min(4, (rmsV / rmsOf(N0)) * undB(-st.snr)) * 0.5;
        const rev = s0.mic === 'boom' ? clamp((st.d - 0.4) / 3, 0, 0.5) : s0.mic === 'cam' ? 0.5 : 0;
        if (roomOnly) player.play(N0, { gain: Math.max(gn, 0.15) * 1.5 });
        else { player.play(V, { gain: 0.5, reverb: rev }); player.play(N0, { gain: gn }); }
      },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt; s0 = s; stageKey = s.bg;
        player.sync();
        st = model(s);
        const narrow = fitNarrow(stage, [L.op, L.rec, L.lav, L.cam, L.actor], -0.16);
        reelBoards([[hearB, [0.1, 3.35, 0.2], 0.95], [distB, [0.1, 4.55, 0.2], 1.05]]);
        // camera and frame pyramid
        const shot = st.shot, zL = st.lensZ, yL = st.lensY;
        cam.position.set(0, 0, shot.cam); L.cam.position.z = shot.cam;
        const top = shot.top, bot = top - shot.h, hw = (shot.h * 1.85) / 2, z0 = 0.1;
        const pts = [[-hw, top], [hw, top], [hw, bot], [-hw, bot]];
        const pos = frameGeo.attributes.position.array; let k = 0;
        const put = (a, b) => { pos[k++] = a[0]; pos[k++] = a[1]; pos[k++] = a[2]; pos[k++] = b[0]; pos[k++] = b[1]; pos[k++] = b[2]; };
        for (let i = 0; i < 4; i++) { const [x, y] = pts[i], [x2, y2] = pts[(i + 1) % 4]; put([x, y, z0], [x2, y2, z0]); put([0, yL, zL], [x, y, z0]); }
        frameGeo.attributes.position.needsUpdate = true; frameGeo.computeBoundingSphere();
        frameFill.position.set(0, (top + bot) / 2, z0); frameFill.scale.set(hw * 2, shot.h, 1);
        // the top face of the pyramid: the plane the boom must stay above
        const midZ = (zL + z0) / 2, midY = (yL + top) / 2, len = Math.hypot(zL - z0, top - yL);
        topPlane.position.set(0, midY, midZ); topPlane.scale.set(hw * 1.2, len, 1); topPlane.rotation.set(Math.atan2(z0 - zL, top - yL), 0, 0);
        L.frame.position.set(0, st.yTop(zL * 0.55) + 0.05, zL * 0.55);
        // mic placement
        const showBoom = s.mic === 'boom';
        const mp = st.micAt(showBoom ? st.d : Math.min(3, s.dist));
        const toMouth = MOUTH.clone().sub(mp).normalize();
        const axis = toMouth.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), st.theta * (showBoom ? 1 : 0));
        mic.position.copy(mp); mic.quaternion.copy(tmpQ.setFromUnitVectors(X1, axis));
        const back = mp.clone().addScaledVector(axis, -0.16), hands = op.arms[1].hand.getWorldPosition(new THREE.Vector3()).lerp(op.arms[0].hand.getWorldPosition(new THREE.Vector3()), 0.5).sub(root.position);
        pole.between(hands.toArray(), back.toArray());
        L.mic.position.set(mp.x + 0.25, mp.y + 0.15, mp.z);
        // lobe on the active mic, sized so its front reaches the mouth
        Object.values(lobes).forEach((l) => { l.visible = false; });
        const lobe = lobes[st.mic.pat]; lobe.visible = true;
        if (s.mic === 'boom') { placeLobe(lobe, mp, axis, 0.55); axisLine.between(mp.toArray(), mp.clone().addScaledVector(axis, Math.max(0.2, st.d + 0.1)).toArray()); }
        else if (s.mic === 'lav') { placeLobe(lobe, lav.position, new THREE.Vector3(0, 1, 0), 0.22); axisLine.visible = false; }
        else { const cp = new THREE.Vector3(0, yL + 0.2, zL - 0.05); placeLobe(lobe, cp, new THREE.Vector3(0, 0, -1), 0.8); axisLine.between(cp.toArray(), [0, 1.6, 0.2]); }
        mic.fur.material.color.setHex(st.inFrame ? 0xff5a8a : 0x9a9488);
        lav.material.color.setHex(s.mic === 'lav' ? 0x8ef0ff : 0x111216);
        L.mic.element.textContent = st.inFrame ? 'Boom mic: in shot!' : 'Boom mic';
        L.mic.element.classList.toggle('hot', s.mic === 'boom');
        L.lav.element.classList.toggle('hot', s.mic === 'lav');
        L.cam.element.classList.toggle('hot', s.mic === 'cam');
        // the actor talks: small gestures in time with the voice envelope
        const e = V.env[Math.floor(((t % 2.6) / 2.6) * (V.env.length - 1))] || 0;
        actor.pose({ arm: 0.15 + 0.25 * e, armR: 0.1 + 0.15 * e, open: 0.08 });
        actor.head.position.y = 0.76 + 0.004 * e;
        meter.scale.y = 0.2 + 0.8 * e; meter.position.y = 0.9 + 0.05 * meter.scale.y;
        recLed.visible = Math.sin(t * 5) > -0.3;
        // noise sources
        const street = s.bg === 'street', gen1 = s.bg === 'gen';
        cars.forEach((c, i) => { c.visible = street; c.position.z = (((t * (7 + i * 3) + i * 6) % 14) - 7) * (i ? -1 : 1); c.rotation.y = i ? -Math.PI / 2 : Math.PI / 2; });
        road.visible = street; gen.visible = gen1; win.material.color.setHex(street ? 0xffe0a0 : 0x8ec5ff);
        const src = gen1 ? gen.position : street ? new THREE.Vector3(-3.6, 0.3, 0) : new THREE.Vector3(-1.5, 1.7, 0.6);
        noiseRings.forEach((r, i) => { const k2 = ((t * 0.6 + i / 3) % 1); r.visible = s.bg !== 'stage'; r.position.set(src.x, gen1 ? 0.6 : src.y, src.z); const R = 0.2 + k2 * (street || gen1 ? 3.0 : 1.0); r.scale.setScalar(R); r.material.opacity = 0.5 * (1 - k2); });
        L.noise.position.set(src.x, gen1 ? 1.2 : street ? 0.9 : 2.35, street || gen1 ? src.z : 1.0);
        L.noise.element.textContent = s.bg === 'stage' ? 'Quiet stage' : `${NOISE[s.bg].name}: ${NOISE[s.bg].db} dBA`;
        L.noise.visible = !narrow;
        const kk = `${s.mic}|${s.shot}|${s.dist.toFixed(2)}|${s.aim}|${s.bg}`;
        if (kk !== key0) { key0 = kk; hearB.redraw(); distB.redraw(); }
      },
      readout(s) {
        const m = model(s), [msg] = verdict(m.snr);
        return `<div class="big">${m.mic.name}</div>
          <div class="row"><span>Distance to mouth</span><b>${m.d.toFixed(2)} m</b></div>
          <div class="row"><span>Voice at the mic</span><b>${m.voiceDb.toFixed(0)} dB SPL</b></div>
          <div class="row"><span>Noise it picks up</span><b>${m.noiseDb.toFixed(0)} dB</b></div>
          <div class="row"><span>Signal-to-noise</span><b>${m.snr.toFixed(0)} dB</b></div>
          ${s.mic === 'boom' ? `<div class="row"><span>Closest out of frame</span><b>${m.minD.toFixed(2)} m</b></div>` : ''}
          ${m.inFrame ? '<div class="no">The mic is in the shot. Raise it!</div>' : m.snr >= 25 ? `<div class="ok">${msg}</div>` : `<div class="${m.snr >= 15 ? 'ok' : 'no'}">${msg}</div>`}`;
      },
      pick(o) {
        if (o === lav) pressSeg('lav');
      },
      dispose() { player.stopAll(); },
    };
    stage.pickables = [lav];
    return inst;
  },
};
