// Chapter 6: hearing the result. The cinema sound chain, the perforated screen, and phones vs theatres.
//  - Digital Cinema Package (DCP): the film is delivered as files; the audio is uncompressed PCM, 24-bit,
//    48 kHz (or 96 kHz), up to 16 channels (SMPTE ST 429-2 / DCI specification). Dolby Atmos travels in
//    the same package as an extra track and is rendered live by the cinema's processor.
//  - The cinema processor decodes the tracks, applies the room's EQ (including the "X-curve" high-frequency
//    roll-off of SMPTE ST 202) and sends each channel to power amplifiers and then the speakers.
//  - Calibration: −20 dBFS pink noise plays at 85 dBC per screen channel (SMPTE RP 200), so full scale is
//    105 dB SPL per channel; the LFE channel gets +10 dB of extra headroom.
//  - Perforated screens: a standard cinema screen has holes about 1.2 mm across, roughly 57,000 per m²,
//    about 4–7% of its area (Harkness Screens perforation data). Light still reflects from the other ~95%,
//    and sound from the left, centre and right speakers behind it passes through the holes. The small
//    loss at high frequencies is corrected by the room EQ.
//  - Delay to a seat = distance / 343 m/s. A seat 30 m from the screen hears the screen 87 ms after the
//    picture arrives, still inside the ITU-R BT.1359-1 125 ms "sound late" threshold.
//  - Playback devices (rough low-frequency limits, typical measurements, not specs): cinema subwoofers reach
//    about 20 Hz; flat-TV speakers about 80–150 Hz; laptop speakers about 150–300 Hz; phone speakers about
//    300–500 Hz; sealed earbuds reach 20 Hz. Mixers often make a separate "near-field" or home mix with
//    less dynamic range for small speakers.
import { THREE, M, box, clamp } from '../kit.js';
import {
  board, panelBg, title, text, rrect, COL, fitNarrow, reelBoards, inReel, sphere, stick, pressSeg,
  makeSpeaker, roarLayer, musicPad, whooshHit, mixInto, silence, spectrum, drawSpectrum, freqAxis, player, C_SOUND, FRAME_MS,
} from '../sound.js';

const STEPS = {
  dcp: { name: 'DCP server', what: 'The film arrives as a Digital Cinema Package: picture files plus up to 16 channels of uncompressed 24-bit, 48 kHz audio, and an Atmos track.' },
  proc: { name: 'Cinema processor', what: 'Decodes the tracks, renders Atmos objects to this room’s speakers, and applies the room’s EQ and delays.' },
  amp: { name: 'Amplifiers', what: 'Racks of power amplifiers turn line-level signals into the tens to hundreds of watts that move speaker cones.' },
  spk: { name: 'Speakers', what: 'Left, centre and right stand behind the screen; subwoofers carry the .1; surrounds line the walls and ceiling.' },
  screen: { name: 'Perforated screen', what: 'Tiny holes, about 1.2 mm across and roughly 57,000 per m², let the sound through while the rest of the screen reflects the picture.' },
};
const DEVICES = {
  cinema: { name: 'Cinema', lo: 20, hi: 16000, note: 'Subwoofers reach 20 Hz; screen channels are gently rolled off above about 2 kHz by the room EQ (the X-curve).' },
  tv: { name: 'TV speakers', lo: 120, hi: 16000, note: 'Thin TVs have small drivers: the deepest bass is missing, so explosions lose their weight.' },
  laptop: { name: 'Laptop', lo: 250, hi: 16000, note: 'Laptop speakers start around 150–300 Hz. Voices are clear, rumbles vanish.' },
  phone: { name: 'Phone speaker', lo: 450, hi: 14000, note: 'A phone speaker is smaller than a coin. Little comes out below about 300–500 Hz.' },
  buds: { name: 'Earbuds', lo: 20, hi: 16000, note: 'Sealed in the ear, tiny drivers can reach deep bass again, but the room and your body don’t feel it.' },
};
const DEFAULTS = { step: 'spk', row: 8, device: 'cinema', xray: true };
const ROWS = 12, rowZ = (r) => -2.6 + (r - 1) * 0.95, rowY = (r) => 0.22 * (r - 1);
const SPK_C = [0, 2.6, -7.6];
export function seat(row) {
  const z = rowZ(row), y = rowY(row) + 1.15;
  const d = Math.hypot(SPK_C[1] - y, SPK_C[2] - z);
  return { d, ms: (d / C_SOUND) * 1000, y, z };
}

export default {
  id: 'theatre',
  short: 'In the cinema',
  title: 'Hearing it in the cinema',
  subtitle: 'Follow the sound from the digital package to your seat, and see why the screen is full of holes.',
  view: { pos: [-6.5, 13.0, 21.0], target: [0.4, 2.6, -1.6] },
  learn: `<p>A finished film reaches the cinema as a <b>Digital Cinema Package</b> (DCP): a set of files. Its sound is up to <b>16 channels</b> of uncompressed audio, 48,000 samples a second, plus an Atmos track. A <b>cinema processor</b> decodes it, places the Atmos objects on this room’s speakers, and corrects for the room. <b>Amplifiers</b> then drive the <b>speakers</b>. The room is calibrated so a test tone plays at a standard level, and full volume can reach about <b>105 decibels</b> per speaker.</p>
    <p>Where do the front speakers go? <b>Behind the screen</b>, so voices come from the actors’ mouths. The screen is <b>perforated</b>: tens of thousands of holes about <b>1.2 mm</b> wide per square metre, only around 5% of its area. The rest still reflects the picture, and the sound passes through the holes. From your seat they are too small to see.</p>
    <p>Sound is slow. At <b>343 metres a second</b>, it takes about 3 ms to cross each metre, so the back row hears the screen later than the front. Big halls stay under the 125 ms that viewers notice. At home the same film plays on <b>TV, laptop or phone speakers</b> that cannot make deep bass, so mixers often make a gentler <b>home mix</b>. How your ears catch it all is in EarClear.</p>
    <p class="tip"><b>Try it:</b> step through the chain and follow the pulses. Slide your seat from the front row to the back and watch the delay. Switch to a phone speaker and play the test sound: the rumble disappears.</p>`,
  terms: [
    { t: 'DCP', d: 'Digital Cinema Package: the set of files a cinema plays, with picture, sound and subtitles.' },
    { t: 'Cinema processor', d: 'The box that decodes the soundtrack and adapts it to one room’s speakers.' },
    { t: 'Amplifier', d: 'A device that boosts a weak signal enough to drive a loudspeaker.' },
    { t: 'Perforated screen', d: 'A cinema screen with tiny holes so sound from speakers behind it can pass through.' },
    { t: 'Subwoofer', d: 'A big speaker for the deepest sounds, fed by the LFE channel.' },
    { t: 'Calibration', d: 'Setting a room so a standard test signal plays at a standard loudness.' },
    { t: 'Home mix', d: 'A version of the mix with less range between quiet and loud, for small speakers.' },
  ],
  defaults: DEFAULTS,
  controls: [
    { key: 'step', type: 'seg', label: 'Follow the signal (or tap a part)', options: Object.entries(STEPS).map(([v, m]) => ({ v, label: m.name })) },
    { key: 'row', type: 'range', label: 'Your seat', min: 1, max: ROWS, step: 1, ends: ['front row', 'back row'], fmt: (v) => `row ${v}: ${seat(v).d.toFixed(1)} m from the centre speaker` },
    { key: 'xray', type: 'toggle', label: 'See through the screen' },
    { key: 'device', type: 'seg', label: 'Play it on', options: Object.entries(DEVICES).map(([v, m]) => ({ v, label: m.name })) },
    { key: 'go', type: 'buttons', label: 'Listen and look', items: [
      { label: 'Play the test sound', act: (s, inst) => inst.play?.() },
      { label: 'Look at the screen up close', act: (s, inst) => inst.closeUp?.() },
    ] },
  ],
  quiz: [
    { q: 'Why is a cinema screen full of tiny holes?', options: ['To keep it cool', 'So sound from speakers behind it can pass through', 'To make the picture brighter', 'To let the projector see'], answer: 1, why: 'The left, centre and right speakers sit behind the screen, so voices seem to come from the actors. The holes let the sound through.' },
    { q: 'You sit 30 m from the screen. The sound reaches you about…', options: ['at the same instant as the picture', '87 ms after the picture', '3 s late', 'before the picture'], answer: 1, why: 'Sound travels about 343 m a second: 30 / 343 ≈ 0.087 s. Light takes a tenth of a microsecond.' },
    { q: 'Why does a big explosion sound weak on a phone?', options: ['Phones are muted during films', 'Tiny phone speakers cannot make the deep bass that gives it weight', 'The film is shorter on phones', 'Phones play in slow motion'], answer: 1, why: 'A coin-sized speaker produces little below a few hundred hertz, where most of the rumble lives.' },
  ],
  reel: [
    { ms: 5200, caption: 'In the cinema, speakers stand behind the screen, and sound passes through thousands of tiny holes.', set: { step: 'screen', xray: true, row: 10, device: 'cinema' }, spin: 0, view: { pos: [4.2, 3.2, -1.0], target: [0, 2.8, -7.2] } },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---------------------------------------------------------------- the auditorium
    const W = 12.4, Dp = 18.4, H = 7.5, zBack = 9.2, zFront = -8.2;
    const floor = box(W, 0.1, Dp, M.matte(0x2a1f28)); floor.position.set(0, -0.05, (zBack + zFront) / 2); root.add(floor);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, Dp)), new THREE.LineBasicMaterial({ color: 0x5a6378, transparent: true, opacity: 0.5 })); edges.position.set(0, H / 2, (zBack + zFront) / 2); root.add(edges);
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(Dp, H), M.ghost(0x6a4a5a, 0.18)); leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-W / 2, H / 2, (zBack + zFront) / 2); root.add(leftWall);
    // stepped rows of seats
    const seatN = ROWS * 14, seats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), M.matte(0x8a2433), seatN), backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), M.matte(0x8a2433), seatN), o = new THREE.Object3D();
    let si = 0;
    for (let r = 1; r <= ROWS; r++) {
      const step = box(W - 0.4, 0.22, 0.95, M.matte(0x33262f)); step.position.set(0, rowY(r) - 0.11 + 0.001, rowZ(r)); if (r > 1) root.add(step);
      for (let c = 0; c < 14; c++) { const x = -3.9 + c * 0.6; o.position.set(x, rowY(r) + 0.23, rowZ(r)); o.updateMatrix(); seats.setMatrixAt(si, o.matrix); o.position.set(x, rowY(r) + 0.6, rowZ(r) + 0.28); o.updateMatrix(); backs.setMatrixAt(si++, o.matrix); }
    }
    seats.castShadow = backs.castShadow = true; root.add(seats, backs);
    const you = new THREE.Group(); root.add(you);
    const youSeat = box(0.52, 0.47, 0.52, M.glow(0xffd166)); youSeat.position.y = 0.23; you.add(youSeat);
    const head = sphere(0.14, M.matte(0xd9c3a5)); head.position.set(0, 1.15, 0.05); you.add(head);
    const bodyY = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.35, 6, 12), M.matte(0x3b6fd8)); bodyY.position.set(0, 0.75, 0.08); you.add(bodyY);
    // ---------------------------------------------------------------- screen wall: speakers behind a perforated screen
    const holes = document.createElement('canvas'); holes.width = holes.height = 32; const hg = holes.getContext('2d');
    hg.fillStyle = '#f2f0ea'; hg.fillRect(0, 0, 32, 32); hg.fillStyle = '#20232a'; for (const [x, y] of [[8, 8], [24, 24]]) { hg.beginPath(); hg.arc(x, y, 3.2, 0, Math.PI * 2); hg.fill(); }
    const holeTex = new THREE.CanvasTexture(holes); holeTex.wrapS = holeTex.wrapT = THREE.RepeatWrapping; holeTex.repeat.set(9 * 14, 3.9 * 14); holeTex.colorSpace = THREE.SRGBColorSpace;
    const screenMat = new THREE.MeshStandardMaterial({ map: holeTex, transparent: true, opacity: 1, roughness: 0.9, emissive: 0x202226, side: THREE.DoubleSide });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.9), screenMat); scr.position.set(0, 3.25, -7.2); root.add(scr);
    const spk = {};
    for (const [id, x] of [['L', -3.3], ['C', 0], ['R', 3.3]]) { const s = makeSpeaker(1.0, 1.7, 0.8); s.position.set(x, SPK_C[1], -7.7); root.add(s); spk[id] = s; }
    for (const x of [-1.4, 1.4]) { const s = makeSpeaker(1.1, 0.9, 0.9, 0x16181d); s.position.set(x, 0.45, -7.7); root.add(s); spk['sub' + x] = s; }
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) { const s = makeSpeaker(0.4, 0.6, 0.3); s.position.set(side * 6.0, 4.6, -3 + k * 3); s.rotation.y = -side * Math.PI / 2; root.add(s); spk[`s${side}${k}`] = s; }
    for (let k = 0; k < 3; k++) for (const x of [-2.5, 2.5]) { const s = makeSpeaker(0.35, 0.5, 0.3); s.position.set(x, H - 0.3, -4 + k * 4.5); s.rotation.x = Math.PI / 2; root.add(s); spk[`t${x}${k}`] = s; }
    // ---------------------------------------------------------------- the projection booth with the chain
    const booth = new THREE.Group(); booth.position.set(0, 4.6, zBack + 1.2); root.add(booth);
    const bm = M.matte(0x22252c);
    const bFloor = box(6, 0.12, 2.2, bm); bFloor.position.y = 0.06; booth.add(bFloor);
    const bBack = box(6, 2.6, 0.1, M.ghost(0x8ea0c0, 0.2)); bBack.position.set(0, 1.3, 1.05); booth.add(bBack);
    const bLeft = box(0.1, 2.6, 2.2, bm); bLeft.position.set(3, 1.3, 0); booth.add(bLeft);
    const bFront = box(6, 2.6, 0.08, M.ghost(0x8ea0c0, 0.25)); bFront.position.set(0, 1.3, -1.08); booth.add(bFront);
    const bRoof = box(6, 0.08, 2.2, M.ghost(0x8ea0c0, 0.15)); bRoof.position.y = 2.6; booth.add(bRoof);
    const port = box(1.2, 0.5, 0.05, M.glow(0x8ec5ff)); port.position.set(0.1, 1.4, -1.1); booth.add(port);
    const parts = {};
    const mk = (id, w, h, d, x, col) => { const g = new THREE.Group(); const b = box(w, h, d, M.matte(col)); b.position.y = h / 2; g.add(b); for (let i = 0; i < Math.floor(h / 0.18); i++) { const led = box(w * 0.7, 0.03, 0.01, M.glow(0x5ce1a9)); led.position.set(0, 0.1 + i * 0.18, d / 2 + 0.006); g.add(led); } g.position.set(x, 0.12, 0.3); booth.add(g); g.traverse((q) => { q.userData.step = id; }); parts[id] = g; return g; };
    mk('dcp', 0.6, 1.2, 0.6, -2.2, 0x2f343f); mk('proc', 0.6, 0.7, 0.6, -1.3, 0x3a3f4b); mk('amp', 0.8, 1.8, 0.6, 1.6, 0x1b1d22);
    const projector = box(0.9, 0.6, 1.1, M.matte(0x3a3f4b)); projector.position.set(0.1, 1.4, -0.3); booth.add(projector);
    const lensP = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 16), M.glow(0x8ec5ff)); lensP.rotation.x = Math.PI / 2; lensP.position.set(0.1, 1.4, -0.9); booth.add(lensP);
    // cable run from the booth over the ceiling to the screen speakers, with signal pulses
    const pathPts = [[1.6, 6.5, zBack + 1.2], [1.0, H - 0.2, zBack - 0.2], [1.0, H - 0.2, -7.9], [0, SPK_C[1] + 1.2, -7.9], [0, SPK_C[1] + 0.8, -7.7]].map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pathPts);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.03, 6), M.matte(0x16181d)); root.add(cable);
    const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 10, 8), M.glow(0xffb547), 14); pulses.frustumCulled = false; root.add(pulses);
    [...Object.values(parts), scr, ...Object.values(spk)].forEach((q) => q.traverse((c) => { if (!c.userData.step) c.userData.step = q === scr ? 'screen' : Object.values(spk).includes(q) ? 'spk' : c.userData.step; }));
    // sound rings spreading from the centre speaker towards your seat
    const rings = Array.from({ length: 6 }, () => { const r = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.ghost(0x8ef0ff, 0.06)); r.rotation.x = Math.PI / 2; r.position.set(0, SPK_C[1], -7.6); root.add(r); return r; });
    // ---------------------------------------------------------------- boards
    let st = { ...DEFAULTS };
    const demo = silence(3.2); mixInto(demo, roarLayer('low', 2.4, 21), 0.1, 0.9); mixInto(demo, roarLayer('mid', 2.4, 21), 0.1, 0.5); mixInto(demo, whooshHit(1.6, 51), 1.4, 0.9); mixInto(demo, musicPad(3.2), 0, 0.25);
    const demoSp = spectrum(demo);
    const chainB = board(root, 3.8, 2.6, 800, 548, (g, w, h) => {
      panelBg(g, w, h);
      const sd = seat(st.row);
      title(g, 'From the file to your ears', `row ${st.row}: sound arrives ${sd.ms.toFixed(0)} ms after the picture`);
      const ids = Object.keys(STEPS), bw = (w - 60) / ids.length;
      ids.forEach((id, i) => {
        const on = id === st.step, x = 22 + i * bw;
        g.fillStyle = on ? 'rgba(255,209,102,.95)' : 'rgba(255,255,255,.08)'; rrect(g, x, 88, bw - 14, 70, 12); g.fill();
        text(g, STEPS[id].name.replace('Cinema ', ''), x + (bw - 14) / 2, 130, { font: 'bold 17px sans-serif', col: on ? '#111' : '#e8eef8', align: 'center' });
        if (i < ids.length - 1) text(g, '→', x + bw - 9, 130, { font: 'bold 20px sans-serif', col: COL.soft, align: 'center' });
      });
      // the step's description, wrapped
      const words = STEPS[st.step].what.split(' '); let line = '', y = 200; g.font = '20px sans-serif';
      for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w - 44) { text(g, line, 22, y, { font: '20px sans-serif', col: '#e8eef8' }); line = wd; y += 28; } else line = t; }
      text(g, line, 22, y, { font: '20px sans-serif', col: '#e8eef8' });
      // delay by row
      const x0 = 40, pw = w - 80, y0 = 330, ph = 150, maxMs = 130;
      text(g, 'Delay from the centre speaker, by row', 22, y0 - 12, { font: 'bold 16px sans-serif', col: COL.soft });
      g.fillStyle = 'rgba(255,90,138,.18)'; g.fillRect(x0, y0, pw, ph * (1 - 125 / maxMs));
      text(g, '125 ms: viewers notice late sound', x0 + 8, y0 + 18, { font: '14px sans-serif', col: COL.bad });
      for (let r = 1; r <= ROWS; r++) { const m = seat(r).ms, bh = (m / maxMs) * ph, x = x0 + ((r - 1) / ROWS) * pw; g.fillStyle = r === st.row ? COL.hot : 'rgba(142,240,255,.55)'; g.fillRect(x + 4, y0 + ph - bh, pw / ROWS - 8, bh); }
      const big = (30 / C_SOUND) * 1000; g.strokeStyle = COL.soft; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(x0, y0 + ph - (big / maxMs) * ph); g.lineTo(x0 + pw, y0 + ph - (big / maxMs) * ph); g.stroke(); g.setLineDash([]);
      text(g, `a seat 30 m back: ${big.toFixed(0)} ms`, x0 + pw - 8, y0 + ph - (big / maxMs) * ph - 6, { font: '14px sans-serif', col: COL.soft, align: 'right' });
      text(g, 'front', x0, y0 + ph + 22, { font: '14px sans-serif', col: COL.soft }); text(g, 'back row', x0 + pw, y0 + ph + 22, { font: '14px sans-serif', col: COL.soft, align: 'right' });
    }, [9.2, 6.6, 1.0]);
    chainB.mesh.rotation.set(-0.3, -0.35, 0); chainB.mesh.scale.setScalar(1.45);
    const devB = board(root, 3.8, 2.2, 800, 464, (g, w, h) => {
      panelBg(g, w, h);
      const d = DEVICES[st.device];
      title(g, `Playing on: ${d.name}`, d.lo > 100 ? `below about ${d.lo} Hz, almost nothing comes out` : 'the full range, down to the deepest rumble');
      const x0 = 22, pw = w - 44, f0 = 20, f1 = 16000, fx = (f) => x0 + (Math.log(f / f0) / Math.log(f1 / f0)) * pw;
      drawSpectrum(g, demoSp, x0, 90, pw, 200, COL.soft, { f0, f1, lo: -110, hi: -30 });
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x0, 90, fx(d.lo) - x0, 200);
      g.strokeStyle = COL.hot; g.lineWidth = 3; g.beginPath(); g.moveTo(fx(d.lo), 90); g.lineTo(fx(d.lo), 290); g.stroke();
      text(g, 'lost', (x0 + fx(d.lo)) / 2, 190, { font: 'bold 20px sans-serif', col: COL.bad, align: 'center' });
      freqAxis(g, x0, 292, pw, f0, f1);
      Object.entries(DEVICES).forEach(([k, v], i) => { const y = 336 + i * 22, on = k === st.device; g.fillStyle = on ? COL.hot : 'rgba(142,240,255,.35)'; g.fillRect(fx(v.lo), y - 12, fx(v.hi) - fx(v.lo), 14); text(g, v.name, fx(v.lo) - 8, y, { font: `${on ? 'bold ' : ''}14px sans-serif`, col: on ? COL.hot : COL.soft, align: 'right' }); });
    }, [8.6, 1.2, 4.4]);
    devB.mesh.rotation.set(-0.3, -0.35, 0); devB.mesh.scale.setScalar(1.45);
    const L = {
      screen: stage.label('Perforated screen', [3.2, 5.5, -7.2], root),
      spk: stage.label('Speakers behind the screen', [-3.3, 1.2, -7.4], root),
      booth: stage.label('Projection booth: server, processor, amps', [0, 7.9, zBack + 1.2], root),
      you: stage.label('You', [0, 0, 0], root, 'hot'),
      surr: stage.label('Surround and ceiling speakers', [-6, 5.4, 0], root),
    };

    let t = 0, key0 = '', pk = 0;
    const inst = {
      play() { const d = DEVICES[st.device]; player.stopAll(); player.play(demo, { gain: 0.8, hpHz: d.lo > 30 ? d.lo : 0, lpHz: d.hi < 16000 ? d.hi : 0 }); },
      closeUp() { st.xray = false; stage.setView([1.2, 3.4, -6.35], [0.9, 3.3, -7.2], 1.2); },
      update(dt, s) {
        dt = Math.max(0, dt); st = s; t += dt; player.sync();
        const narrow = fitNarrow(stage, [L.booth, L.surr, L.spk], -0.1);
        reelBoards([[chainB, [0, 7.4, -7.0], 1.2], [devB, [0, 7.4, -7.0], 0.0001]]);
        screenMat.opacity = s.xray ? 0.35 : 1; screenMat.depthWrite = !s.xray;
        // you, in your seat
        const sd = seat(s.row);
        you.position.set(0.3, rowY(s.row), rowZ(s.row)); L.you.position.set(0.3, rowY(s.row) + 1.6, rowZ(s.row));
        // pulses along the cable, and highlights along the chain
        const order = Object.keys(STEPS), k = order.indexOf(s.step);
        for (let i = 0; i < 14; i++) { const u = ((t * 0.35 + i / 14) % 1); pulses.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...curve.getPoint(u).toArray())); }
        pulses.instanceMatrix.needsUpdate = true;
        for (const [id, g] of Object.entries(parts)) g.children[0].material.emissive?.setHex(id === s.step ? 0x5a4000 : 0x000000);
        const spkOn = s.step === 'spk' || s.step === 'screen';
        for (const o of Object.values(spk)) { o.glow.material.opacity = spkOn ? 0.35 + 0.25 * Math.sin(t * 8) : 0.05; o.glow.material.color.setHex(0xffb547); }
        L.screen.element.classList.toggle('hot', s.step === 'screen'); L.spk.element.classList.toggle('hot', s.step === 'spk');
        // spreading wavefronts from the centre speaker (shown 100× slower than real sound)
        rings.forEach((r, i) => { const u = ((t * 0.25 + i / rings.length) % 1), R = 0.5 + u * (sd.d + 1); r.scale.setScalar(R); r.material.opacity = 0.07 * (1 - u); });
        const kk = `${s.step}|${s.row}|${s.device}`; if (kk !== key0) { key0 = kk; chainB.redraw(); devB.redraw(); }
        void pk; void narrow;
      },
      readout(s) {
        const sd = seat(s.row), d = DEVICES[s.device];
        return `<div class="big">${STEPS[s.step].name}</div>
          <div class="row"><span>Your seat</span><b>row ${s.row}, ${sd.d.toFixed(1)} m from the centre speaker</b></div>
          <div class="row"><span>Sound arrives after the picture</span><b>${sd.ms.toFixed(0)} ms (${(sd.ms / FRAME_MS).toFixed(1)} frames)</b></div>
          <div class="row"><span>Playing on</span><b>${d.name}${d.lo > 100 ? `, nothing below ~${d.lo} Hz` : ''}</b></div>
          <div class="ok">Under the 125 ms that viewers notice.</div>`;
      },
      pick(o) { const id = o.userData.step; if (id) pressSeg(id); },
      dispose() { player.stopAll(); },
    };
    stage.pickables = [...Object.values(parts), scr, ...Object.values(spk)];
    return inst;
  },
};
