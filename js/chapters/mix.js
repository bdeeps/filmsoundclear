// Chapter 5: music and the mix. Stems on a console, ducking, loudness, and surround / Dolby Atmos.
//  - Stems: a film mix is kept as separate groups (dialogue, music, effects, Foley, ambience) so versions
//    can be made later, e.g. an "M&E" (music and effects) mix with no dialogue for dubbing.
//  - Ducking: the music is turned down automatically while someone speaks (side-chain), here by a set
//    number of dB with 0.25 s ramps.
//  - Loudness: ITU-R BS.1770 LUFS/LKFS. Targets: EBU R128 broadcast −23 LUFS integrated; Netflix −27 LKFS
//    ±2, measured only while dialogue plays ("dialogue-gated", Netflix Sound Mix Specifications);
//    music streaming services play at about −14 LUFS. Cinemas do not normalise loudness: the room is
//    calibrated so a −20 dBFS pink-noise test gives 85 dBC per screen channel (SMPTE RP 200), and the
//    mixers set levels by ear on a stage calibrated the same way. Loudness here is computed from the actual
//    samples of the mix (without the K-weighting filter, so within a dB or two).
//  - Surround: 5.1 = left, centre, right, left surround, right surround + LFE (a low-frequency effects
//    channel, the ".1", for 20–120 Hz). 7.1 splits the surrounds into sides and rears. Dolby Atmos (2012)
//    adds overhead speakers and "objects": up to 128 tracks and 64 speaker feeds, each object carrying its
//    3D position so the cinema's processor works out which speakers play it.
//  - Panning here: distance-based amplitude panning (DBAP), gains ∝ 1/(d² + r²) normalised to constant
//    power, a simple stand-in for a real Atmos renderer. Channel-based 5.1/7.1 has no height, so the
//    object's height is ignored there.
import { THREE, M, box, clamp } from '../kit.js';
import {
  board, panelBg, title, text, COL, HEX, fitNarrow, reelBoards, inReel, sphere, stick, rng,
  makePerson, makeSpeaker, voice, ambience, footstep, prop, musicPad, whooshHit, mixInto, silence,
  drawWave, lufs, player, undB, dB, SR, helicopter as heliSound,
} from '../sound.js';

const STEMS = {
  dia: { name: 'Dialogue', col: COL.voice, hex: HEX.voice, base: -24 },
  mus: { name: 'Music', col: COL.music, hex: HEX.music, base: -29 },
  fx: { name: 'Effects', col: COL.fx, hex: HEX.fx, base: -28 },
  fol: { name: 'Foley', col: COL.foley, hex: HEX.foley, base: -34 },
  amb: { name: 'Ambience', col: COL.amb, hex: HEX.amb, base: -37 },
};
const SEC = 8, LISTEN = new THREE.Vector3(0, 1.2, 1.2);
const DEFAULTS = { dia: 0, mus: 0, fx: 0, fol: 0, amb: 0, master: -3, duck: true, duckDb: 8, layout: 'atmos', hx: 2.4, hy: 3.0, hz: 1.0, fly: false };
// Speaker positions in the dubbing stage (metres). Screen wall at z = −4.
const SPK = {
  L: [-2.6, 2.2, -4.2], C: [0, 2.2, -4.2], R: [2.6, 2.2, -4.2],
  Ls: [-4, 2.3, 1.8], Rs: [4, 2.3, 1.8],
  Lss: [-4, 2.3, 0.4], Rss: [4, 2.3, 0.4], Lrs: [-2, 2.3, 4], Rrs: [2, 2.3, 4],
  Lsa: [-4, 2.3, -1.8], Rsa: [4, 2.3, -1.8], Lsb: [-4, 2.3, 2.8], Rsb: [4, 2.3, 2.8], Crs: [0, 2.3, 4],
  Ltf: [-1.8, 3.9, -2.2], Rtf: [1.8, 3.9, -2.2], Ltm: [-1.8, 3.9, 0.6], Rtm: [1.8, 3.9, 0.6], Ltr: [-1.8, 3.9, 3.2], Rtr: [1.8, 3.9, 3.2],
};
const LAYOUTS = {
  '5.1': ['L', 'C', 'R', 'Ls', 'Rs'],
  '7.1': ['L', 'C', 'R', 'Lss', 'Rss', 'Lrs', 'Rrs'],
  atmos: ['L', 'C', 'R', 'Lsa', 'Lss', 'Lsb', 'Rsa', 'Rss', 'Rsb', 'Lrs', 'Crs', 'Rrs', 'Ltf', 'Rtf', 'Ltm', 'Rtm', 'Ltr', 'Rtr'],
};
const LAYNAME = { '5.1': '5.1 surround', '7.1': '7.1 surround', atmos: 'Dolby Atmos' };

export function panGains(layout, p) {
  const ids = LAYOUTS[layout], height = layout === 'atmos';
  const q = [p[0], height ? p[1] : 2.25, p[2]];
  const w = ids.map((id) => { const s = SPK[id]; const d2 = (s[0] - q[0]) ** 2 + (height ? (s[1] - q[1]) ** 2 : 0) + (s[2] - q[2]) ** 2; return 1 / (d2 + 0.6); });
  const norm = Math.sqrt(w.reduce((a, v) => a + v * v, 0));
  return ids.map((id, i) => ({ id, g: w[i] / norm }));
}

export default {
  id: 'mix',
  short: 'Music & the mix',
  title: 'The final mix: stems, loudness and Atmos',
  subtitle: 'Ride five faders, duck the music under the words, and fly a helicopter around the room.',
  view: { pos: [1.2, 10.5, 8.3], target: [1.2, 0.6, 0.0] },
  learn: `<p>All the sound comes together on a <b>dubbing stage</b>: a small cinema with a huge mixing console in the middle. The mixers keep the sound in groups called <b>stems</b>: <b>dialogue</b>, <b>music</b>, <b>effects</b>, <b>Foley</b> and <b>ambience</b>. Keeping them apart lets them make a music-and-effects version with no words, ready for dubbing into other languages.</p>
    <p>The golden rule is that <b>you must hear the words</b>. When someone speaks, the music is turned down a few decibels and comes back up after: <b>ducking</b>. Loudness is measured in <b>LUFS</b>, a scale built to match how loud things feel. TV in Europe aims for <b>−23 LUFS</b>. Netflix aims for <b>−27</b>, measured only while people talk. Cinemas are different: the whole room is <b>calibrated</b> to a standard level, so a film plays as loud as the mixers heard it.</p>
    <p>Then the sound is placed in space. <b>5.1</b> means five speakers (left, centre, right and two surrounds) plus <b>.1</b>, a subwoofer channel for rumbles. <b>7.1</b> splits the surrounds into sides and rears. <b>Dolby Atmos</b>, first used for Brave in 2012, adds speakers in the <b>ceiling</b> and treats a sound as an <b>object</b> with a 3D position. The cinema’s processor decides which speakers play it. How speakers make sound at all is in MagnetismClear.</p>
    <p class="tip"><b>Try it:</b> press “Play the mix”, then switch ducking off and hear the words drown. Watch the loudness meter as you move the master fader. Then drag the helicopter around the room, lift it into the ceiling, and compare Atmos with 5.1.</p>`,
  terms: [
    { t: 'Stem', d: 'One group of sounds in a mix, such as all the dialogue or all the music.' },
    { t: 'Fader', d: 'A sliding control that sets how loud one channel or stem is.' },
    { t: 'Ducking', d: 'Turning the music down automatically while someone speaks.' },
    { t: 'LUFS', d: 'Loudness units relative to full scale: a measure of how loud a mix feels.' },
    { t: '5.1 and 7.1', d: 'Surround layouts: five or seven main speakers plus one subwoofer channel.' },
    { t: 'LFE', d: 'Low-frequency effects: the “.1” channel, for deep rumbles below about 120 Hz.' },
    { t: 'Dolby Atmos', d: 'A system with overhead speakers where sounds are objects with a position in 3D.' },
    { t: 'Dubbing stage', d: 'A cinema-like studio where a film’s final mix is made.' },
  ],
  defaults: DEFAULTS,
  controls: [
    { key: 'play', type: 'buttons', label: 'Listen', items: [{ label: 'Play the mix', act: (s, inst) => inst.playMix?.() }, { label: 'Helicopter on / off', act: (s, inst) => inst.heli?.() }] },
    ...Object.entries(STEMS).map(([k, st]) => ({ key: k, type: 'range', label: st.name, min: -30, max: 10, step: 1, fmt: (v) => (v > 0 ? '+' : '') + v + ' dB' })),
    { key: 'master', type: 'range', label: 'Master', min: -20, max: 6, step: 1, fmt: (v) => (v > 0 ? '+' : '') + v + ' dB' },
    { key: 'duck', type: 'toggle', label: 'Duck the music under dialogue' },
    { key: 'duckDb', type: 'range', label: 'Duck by', min: 0, max: 20, step: 1, fmt: (v) => v + ' dB' },
    { key: 'layout', type: 'seg', label: 'Speakers', options: [{ v: '5.1', label: '5.1' }, { v: '7.1', label: '7.1' }, { v: 'atmos', label: 'Atmos' }] },
    { key: 'hx', type: 'range', label: 'Helicopter: left – right (or drag it)', min: -3.8, max: 3.8, step: 0.05, fmt: (v) => v.toFixed(1) + ' m' },
    { key: 'hz', type: 'range', label: 'Helicopter: screen – back', min: -3.8, max: 3.8, step: 0.05, fmt: (v) => v.toFixed(1) + ' m' },
    { key: 'hy', type: 'range', label: 'Helicopter: height', min: 0.5, max: 3.9, step: 0.05, fmt: (v) => v.toFixed(1) + ' m' },
    { key: 'fly', type: 'toggle', label: 'Fly it in a circle' },
  ],
  quiz: [
    { q: 'Why is the music ducked under dialogue?', options: ['To save electricity', 'So the words can be heard clearly', 'Because music is copyrighted', 'To make the film shorter'], answer: 1, why: 'Dialogue carries the story. Dipping the music a few dB while people speak keeps every word clear.' },
    { q: 'What does the “.1” in 5.1 mean?', options: ['A spare speaker', 'A low-frequency effects channel for deep rumbles', 'One ceiling speaker', 'The volume knob'], answer: 1, why: 'The LFE channel feeds the subwoofers with sounds below about 120 Hz.' },
    { q: 'What makes Dolby Atmos different from 7.1?', options: ['It has no speakers', 'Sounds are objects with a 3D position, and there are ceiling speakers', 'It only works on phones', 'It plays in mono'], answer: 1, why: 'Each object carries its position; the cinema’s processor picks which speakers, including overhead ones, play it.' },
  ],
  reel: [
    { ms: 5200, caption: 'On the dubbing stage, five stems meet: dialogue, music, effects, Foley and ambience.', set: { layout: 'atmos', fly: false, hx: 2.6, hy: 3.4, hz: -2, duck: true, mus: 0 }, act: (s, inst) => inst.playMix?.(true), anim: { mus: [-12, 0] }, spin: 0, view: { pos: [0.2, 3.4, 5.4], target: [0, 1.4, -1.2] } },
    { ms: 5600, caption: 'Dolby Atmos treats a helicopter as an object and flies it anywhere, even overhead.', set: { layout: 'atmos', fly: false }, anim: { hx: [-3.2, 3.2], hz: [2.8, -2.6], hy: [1.4, 3.8] }, spin: 0.3, view: { pos: [6.5, 6.8, 7.5], target: [0, 1.8, -0.2] } },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---------------------------------------------------------------- the room: floor, ghost walls, screen
    const floor = box(8.4, 0.06, 8.4, M.matte(0x241f2a)); floor.position.set(0, 0.03, 0); root.add(floor);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(8.4, 4.2, 8.4)), new THREE.LineBasicMaterial({ color: 0x5a6378, transparent: true, opacity: 0.6 })); edges.position.y = 2.1; root.add(edges);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), M.ghost(0x8ea0c0, 0.04)); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 4.2; root.add(ceiling);
    // ---------------------------------------------------------------- speakers
    const spk = {};
    for (const [id, p] of Object.entries(SPK)) {
      const top = p[1] > 3.5, sc = top ? 0.7 : id.length === 1 ? 1.1 : 0.8;
      const s = makeSpeaker(0.5 * sc, 0.8 * sc, 0.4 * sc); s.position.set(...p);
      if (top) s.rotation.x = Math.PI / 2; else if (p[2] < -4) s.rotation.y = 0; else if (Math.abs(p[0]) > 3.9) s.rotation.y = p[0] < 0 ? Math.PI / 2 : -Math.PI / 2; else s.rotation.y = Math.PI;
      root.add(s); spk[id] = s;
    }
    const sub = makeSpeaker(0.9, 0.7, 0.7, 0x16181d); sub.position.set(1.3, 0.4, -4.1); root.add(sub);
    // the screen: a translucent panel in front of L, C and R, showing the mix board
    let st = { ...DEFAULTS }, stems = null, prog = null, meter = { gated: -30, whole: -30 }, playT = -1;
    const mixB = board(root, 5.6, 2.6, 1200, 557, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.78)'; g.fillRect(0, 0, w, h);
      title(g, 'The mix: five stems and a loudness meter', `master ${st.master > 0 ? '+' : ''}${st.master} dB · ducking ${st.duck ? st.duckDb + ' dB' : 'off'}`);
      if (!stems) return;
      const x0 = 150, pw = w - 400, lh = 82;
      Object.entries(STEMS).forEach(([k, m], i) => {
        const y = 78 + i * lh, gain = undB(st[k] + st.master);
        text(g, m.name, 22, y + lh / 2 + 6, { font: 'bold 20px sans-serif', col: m.col });
        g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x0, y + 4, pw, lh - 8);
        drawWave(g, stems[k].a, x0, y + 4, pw, lh - 8, m.col, { gain: gain * stems[k].g * 1.4 });
        if (k === 'mus' && st.duck) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); for (let px = 0; px <= pw; px += 3) { const v = duckEnv[Math.floor((px / pw) * (duckEnv.length - 1))]; const yy = y + 8 + (1 - v) * (lh - 16) * 0.6; px ? g.lineTo(x0 + px, yy) : g.moveTo(x0 + px, yy); } g.stroke(); }
      });
      if (playT >= 0) { const x = x0 + (playT / SEC) * pw; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 76); g.lineTo(x, 78 + 5 * lh); g.stroke(); }
      // loudness meter
      const mx = w - 210, my0 = 80, mh = 5 * lh - 10, Y = (L) => my0 + mh - ((clamp(L, -45, -5) + 45) / 40) * mh;
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(mx, my0, 50, mh);
      g.fillStyle = COL.voice; g.fillRect(mx + 4, Y(meter.gated), 20, my0 + mh - Y(meter.gated));
      g.fillStyle = COL.hot; g.fillRect(mx + 26, Y(meter.whole), 20, my0 + mh - Y(meter.whole));
      for (const [L, lab, c] of [[-14, 'music streaming −14', COL.soft], [-23, 'TV (EBU R128) −23', COL.soft], [-27, 'Netflix dialogue −27', COL.good]]) { g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(mx - 6, Y(L)); g.lineTo(mx + 56, Y(L)); g.stroke(); text(g, lab, mx + 62, Y(L) + 5, { font: '15px sans-serif', col: c }); }
      text(g, 'LUFS', mx, my0 - 8, { font: 'bold 15px sans-serif', col: COL.soft });
      text(g, `dialogue-gated ${meter.gated.toFixed(1)} · whole ${meter.whole.toFixed(1)} LUFS`, x0, h - 20, { font: 'bold 20px sans-serif', col: Math.abs(meter.gated + 27) <= 2 ? COL.good : COL.hot });
    }, [3.9, 3.2, 5.4]);
    mixB.mesh.rotation.set(-0.85, 0, 0); mixB.mesh.scale.setScalar(0.62);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.8), M.ghost(0xdfe8f5, 0.16)); scr.position.set(0, 2.3, -3.98); root.add(scr);
    // ---------------------------------------------------------------- the console with five faders and a master
    const desk = new THREE.Group(); desk.position.set(0, 0, 1.2); root.add(desk);
    const slab = box(3.0, 0.08, 1.0, M.matte(0x2a2d34)); slab.position.y = 0.95; slab.rotation.x = 0.18; desk.add(slab);
    const base = box(2.9, 0.9, 0.8, M.matte(0x1b1d22)); base.position.y = 0.45; desk.add(base);
    const faders = {}, meters = {};
    [...Object.keys(STEMS), 'master'].forEach((k, i) => {
      const x = -1.2 + i * 0.48, col = k === 'master' ? 0xffffff : STEMS[k].hex;
      const slot = box(0.03, 0.01, 0.6, M.matte(0x0c0d10)); slot.position.set(x, 1.0, 0.02); slot.rotation.x = 0.18; desk.add(slot);
      const cap = box(0.12, 0.05, 0.07, M.glow(col)); desk.add(cap); faders[k] = { cap, x };
      const mtr = box(0.04, 0.3, 0.02, M.glow(col)); mtr.position.set(x + 0.12, 1.2, -0.45); desk.add(mtr); meters[k] = mtr;
    });
    const mixer = makePerson({ shirt: 0x3d5a80, pants: 0x22252c }); mixer.position.set(0.3, 0, 2.3); mixer.rotation.y = Math.PI; mixer.pose({ arm: 1.0, armR: 0.9 }); root.add(mixer);
    // ---------------------------------------------------------------- the helicopter object
    const heli = new THREE.Group(); root.add(heli);
    const hb = sphere(0.28, M.plastic(0xff7a59)); hb.scale.set(1.3, 1, 1); heli.add(hb);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.8, 10), M.plastic(0xff7a59)); tail.rotation.z = Math.PI / 2; tail.position.x = -0.65; heli.add(tail);
    const skid = box(0.7, 0.03, 0.03, M.metal(0x3a3f4b)); for (const z of [-0.18, 0.18]) { const k = skid.clone(); k.position.set(0, -0.32, z); heli.add(k); }
    const rotor = new THREE.Group(); rotor.position.y = 0.33; heli.add(rotor);
    for (let i = 0; i < 2; i++) { const b = box(1.5, 0.015, 0.07, M.matte(0x1b1d22)); b.rotation.y = (i * Math.PI) / 2; rotor.add(b); }
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), M.ghost(0xffb547, 0.12)); heli.add(halo);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 24), M.ghost(0x000000, 0.4)); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.07; root.add(shadow);
    const drop = stick(0.006, M.ghost(0xffb547, 0.5)); root.add(drop);
    const rays = Array.from({ length: 3 }, () => { const r = stick(0.012, M.glow(0xffb547, { transparent: true, opacity: 0.7 })); root.add(r); return r; });
    heli.traverse((o) => { o.userData.heli = true; });
    const L = {
      screen: stage.label('Screen, with L, C, R speakers behind', [0, 0.9, -3.9], root),
      desk: stage.label('Mixing console', [0, 1.55, 1.2], root),
      heli: stage.label('Helicopter object', [0, 0, 0], root, 'hot'),
      sub: stage.label('Subwoofer (.1)', [1.3, 0.95, -4.0], root),
      top: stage.label('Ceiling speakers', [-1.8, 4.35, 3.2], root),
    };

    // ---------------------------------------------------------------- the stems (8 s each) and the programme
    const v1 = voice(2.4, 3, 125), v2 = voice(2.0, 12, 180);
    const dia = silence(SEC); mixInto(dia, v1, 0.6); mixInto(dia, v2, 4.6);
    const talk = [[0.6, 3.0], [4.6, 6.6]];
    const mus = musicPad(SEC);
    const fx = silence(SEC); mixInto(fx, whooshHit(1.6, 51), 2.8);
    const fol = silence(SEC); for (let k = 0; k < 10; k++) mixInto(fol, footstep('concrete', 30 + k), 0.2 + k * 0.5, 0.8); mixInto(fol, prop('cloth', 7), 3.6, 0.7);
    const amb = ambience('birds', SEC, 17);
    const raw = { dia, mus, fx, fol, amb };
    // calibrate each stem so it measures its "base" loudness at 0 dB on its fader
    stems = {};
    for (const [k, a] of Object.entries(raw)) {
      const gated = k === 'dia' ? talk.reduce((acc, [a0, a1]) => acc.concat(Array.from(a.subarray(Math.round(a0 * SR), Math.round(a1 * SR)))), []) : null;
      const now = gated ? lufs(Float32Array.from(gated)) : lufs(a);
      stems[k] = { a, g: undB(STEMS[k].base - now) };
    }
    const duckEnv = new Float32Array(400);
    const computeDuck = () => { for (let i = 0; i < duckEnv.length; i++) { const t = (i / duckEnv.length) * SEC; let d = 0; for (const [a, b] of talk) d = Math.max(d, clamp(Math.min((t - (a - 0.25)) / 0.25, ((b + 0.25) - t) / 0.25), 0, 1)); duckEnv[i] = st.duck ? undB(-st.duckDb * d) : 1; } };
    const duckAt = (t) => duckEnv[clamp(Math.floor((t / SEC) * duckEnv.length), 0, duckEnv.length - 1)];
    function computeProgram() {
      computeDuck();
      prog = new Float32Array(SEC * SR);
      for (const [k, s0] of Object.entries(stems)) {
        const g = undB(st[k] + st.master) * s0.g;
        for (let i = 0; i < prog.length; i++) prog[i] += s0.a[i] * g * (k === 'mus' ? duckAt(i / SR) : 1);
      }
      let sum = 0, n = 0; for (const [a, b] of talk) for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) { sum += prog[i] * prog[i]; n++; }
      meter = { gated: -0.691 + 10 * Math.log10(Math.max(1e-12, sum / n)), whole: lufs(prog) };
    }
    computeProgram();

    // ---------------------------------------------------------------- dragging the helicopter
    const el = stage.renderer.domElement, ray = new THREE.Raycaster(), v2d = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    let dragging = false;
    const toRay = (e) => { const b = el.getBoundingClientRect(); v2d.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(v2d, stage.camera); };
    const onDown = (e) => { toRay(e); if (ray.intersectObject(heli, true).length) { dragging = true; stage.controls.enabled = false; st.fly = false; } };
    const onMove = (e) => { if (!dragging) return; toRay(e); plane.constant = -st.hy; if (ray.ray.intersectPlane(plane, hit)) { st.hx = +clamp(hit.x, -3.8, 3.8).toFixed(2); st.hz = +clamp(hit.z, -3.8, 3.8).toFixed(2); } };
    const onUp = () => { if (dragging) { dragging = false; stage.controls.enabled = true; syncPanel(); } };
    // Nudge the panel's sliders so they show where the helicopter was dropped.
    const syncPanel = () => { for (const [lab, key] of [['Helicopter: left', 'hx'], ['Helicopter: screen', 'hz']]) { const c = [...document.querySelectorAll('#panel .ctl-range')].find((x) => x.querySelector('label')?.textContent.startsWith(lab)); const inp = c?.querySelector('input'); if (inp) { inp.value = st[key]; inp.dispatchEvent(new Event('input')); } } };
    el.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);

    let key0 = '', heliSrc = null, panner = null, mixT0 = -1, lastLayout = '';
    const inst = {
      playMix(silent = false) {
        playT = 0; mixT0 = player.now();
        if (silent) return;
        player.stopAll(); heliSrc = null;
        player.play(prog, { gain: 0.9 });
      },
      heli() {
        if (heliSrc) { try { heliSrc.src.stop(); } catch { /* stopped */ } heliSrc = null; return; }
        panner ||= player.node('panner');
        if (panner) heliSrc = player.play(helicopterLoop, { gain: 0.7, loop: true, panner });
      },
      update(dt, s, time) {
        dt = Math.max(0, dt); st = s; player.sync();
        const narrow = fitNarrow(stage, [L.sub, L.desk, L.top, L.screen], -0.1);
        reelBoards([[mixB, [0, 5.4, -1.5], 0.85]]);
        if (s.fly && !dragging) { const a = time * 0.6; s.hx = +(3 * Math.cos(a)).toFixed(2); s.hz = +(3 * Math.sin(a)).toFixed(2); }
        // helicopter
        heli.position.set(s.hx, s.hy, s.hz); rotor.rotation.y += dt * 25;
        heli.rotation.y = s.fly ? -time * 0.6 - Math.PI / 2 : 0;
        shadow.position.set(s.hx, 0.07, s.hz); drop.between([s.hx, 0.07, s.hz], [s.hx, s.hy - 0.3, s.hz]);
        L.heli.position.set(s.hx, s.hy + 0.65, s.hz);
        if (panner && player.ctx) { const p = heli.position.clone().sub(LISTEN); try { panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z; } catch { panner.setPosition(p.x, p.y, p.z); } }
        // speakers: which are in this layout, and how loud each plays the helicopter
        const ids = LAYOUTS[s.layout], gains = panGains(s.layout, [s.hx, s.hy, s.hz]);
        for (const [id, o] of Object.entries(spk)) o.visible = ids.includes(id);
        gains.forEach(({ id, g }) => { spk[id].glow.material.opacity = clamp(g * 1.1, 0, 1); spk[id].glow.material.color.setHex(0xffb547); spk[id].cone.scale.setScalar(1 + 0.06 * g * Math.sin(time * 80)); });
        const top3 = [...gains].sort((a, b) => b.g - a.g).slice(0, 3);
        rays.forEach((r, i) => { const t = top3[i]; r.visible = !!t && t.g > 0.2; if (r.visible) { r.between(heli.position.toArray(), SPK[t.id]); r.material.opacity = 0.25 + 0.6 * t.g; } });
        L.top.visible = s.layout === 'atmos' && !narrow;
        halo.material.opacity = 0.1 + 0.05 * Math.sin(time * 6);
        // console: fader caps slide with the settings, meters bounce with the playing mix
        const tNow = playT >= 0 ? playT : (time % SEC);
        if (playT >= 0) { playT += dt; if (playT > SEC) playT = -1; }
        for (const [k, f] of Object.entries(faders)) {
          const v = s[k], u = k === 'master' ? (v + 20) / 26 : (v + 30) / 40;
          f.cap.position.set(f.x, 1.0 + 0.04, 0.28 - u * 0.52);
          if (k !== 'master') { const a = stems[k].a, i = Math.floor(tNow * SR); let pk = 0; for (let j = 0; j < 800; j += 8) pk = Math.max(pk, Math.abs(a[i + j] || 0)); const lvl = clamp(pk * stems[k].g * undB(v + s.master) * 6 * (k === 'mus' ? duckAt(tNow) : 1), 0.03, 1); meters[k].scale.y = lvl; meters[k].position.y = 1.05 + 0.15 * lvl; }
        }
        const kk = `${Object.keys(STEMS).map((k) => s[k]).join(',')}|${s.master}|${s.duck}|${s.duckDb}`;
        if (kk !== key0) { key0 = kk; computeProgram(); mixB.redraw(); }
        else if (playT >= 0 || Math.floor(time * 4) !== lastRedraw) { lastRedraw = Math.floor(time * 4); if (playT >= 0) mixB.redraw(); }
        if (s.layout !== lastLayout) { lastLayout = s.layout; }
      },
      readout(s) {
        const gains = panGains(s.layout, [s.hx, s.hy, s.hz]).sort((a, b) => b.g - a.g).slice(0, 2);
        const ok = Math.abs(meter.gated + 27) <= 2;
        return `<div class="big">${LAYNAME[s.layout]}</div>
          <div class="row"><span>Dialogue-gated loudness</span><b>${meter.gated.toFixed(1)} LUFS</b></div>
          <div class="row"><span>Whole-mix loudness</span><b>${meter.whole.toFixed(1)} LUFS</b></div>
          <div class="row"><span>Helicopter loudest in</span><b>${gains.map((g) => `${g.id} ${Math.round(20 * Math.log10(g.g))} dB`).join(' · ')}</b></div>
          <div class="${ok ? 'ok' : 'no'}">${ok ? 'On target for streaming: −27 ± 2 LUFS of dialogue.' : meter.gated > -25 ? 'Too loud for the streaming target. Pull the master down.' : 'Too quiet for the streaming target. Push the master up.'}</div>
          ${s.layout !== 'atmos' && s.hy > 2.8 ? '<small>5.1 and 7.1 have no ceiling speakers, so the height is lost.</small>' : ''}`;
      },
      dispose() { el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); stage.controls.enabled = true; player.stopAll(); },
    };
    let lastRedraw = -1;
    const helicopterLoop = heliSound();
    return inst;
  },
};

