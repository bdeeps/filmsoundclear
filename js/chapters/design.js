// Chapter 3: sound design. Building big sounds from layers, and the Doppler pass-by.
//  - Layering: designers stack a low layer (weight, felt in the chest), a mid layer (character and
//    texture) and a high layer (bite, what cuts through a loud mix). Here all three are synthesised in
//    js/sound.js; a real designer might use a lion, a walrus and a squeaky door recorded at close range.
//  - Pitch shifting by playback rate: playing a sound r times faster raises every frequency by r and
//    shortens it by 1/r (like speeding up tape). One semitone is a factor of 2^(1/12).
//  - Doppler effect for a moving source and a still listener: f' = f · c / (c − v·cosθ), θ between the
//    source's velocity and the line to the listener. Head-on the ratio is c/(c − v), going away c/(c + v).
//    The pass-by sound is computed with exact retarded time (see passby() in js/sound.js). c = 343 m/s.
//  - Burtt's lightsaber (a projector's idle hum plus TV interference) and Chewbacca (bear, walrus and other
//    animals) are classic examples of layered, recorded sounds (Ben Burtt interviews; Wikipedia).
import { THREE, M, box, clamp } from '../kit.js';
import {
  board, panelBg, title, text, COL, HEX, fitNarrow, reelBoards, inReel, sphere,
  makePerson, roarLayer, passby, spectrum, drawWave, drawSpectrum, freqAxis, player, reversed, C_SOUND, SR,
} from '../sound.js';

const LAYERS = {
  low: { name: 'Low rumble', col: COL.low, hex: HEX.low, what: 'Weight you feel in your chest: filtered noise and a 40 Hz wobble.' },
  mid: { name: 'Mid growl', col: COL.mid, hex: HEX.mid, what: 'The character: a rough, throaty buzz through an “aw” vowel shape.' },
  high: { name: 'High screech', col: COL.high, hex: HEX.high, what: 'The bite that cuts through a loud mix: a wavering whistle and hiss.' },
};
const DEFAULTS = { fx: 'roar', low: true, mid: true, high: true, solo: 'all', pitch: 0, rev: false, v: 120 };
const SCALE = 4 / 15, SLOW = 10, D = 15;           // 3D units per metre (15 m → 4 units), slow motion factor
const on = (s, k) => (s.solo === 'all' ? s[k] : s.solo === k);

export default {
  id: 'design',
  short: 'Sound design',
  title: 'Designing big sounds',
  subtitle: 'Build a monster’s roar from three layers, bend its pitch, and fly a spaceship past your ears.',
  view: { pos: [0.4, 2.3, 8.4], target: [0.3, 1.8, 0] },
  learn: `<p>Dragons, spaceships and giant robots do not exist, so nobody can record them. A <b>sound designer</b> builds their sounds from pieces. The secret is <b>layering</b>: a <b>low</b> layer for weight, a <b>mid</b> layer for character, and a <b>high</b> layer for bite. Each alone sounds like nothing much. Stacked, they become a beast.</p>
    <p>Designers bend sounds too. Play a sound faster and its pitch rises, like a speeded-up recording: <b>12 semitones</b> up is twice as fast and an octave higher. Slow a small animal down and it becomes huge. Play a sound <b>backwards</b> and a crash becomes an eerie swell. The pieces come from <b>sound libraries</b> of thousands of ready-made clips, or are <b>recorded fresh</b> for the film. Walter Murch was first credited as <b>sound designer</b> on Apocalypse Now (1979), and Ben Burtt made Star Wars’ lightsaber from a projector’s hum and a TV’s buzz.</p>
    <p>Movement needs physics. When a ship rushes towards you, each wave crest leaves from a little closer, so the crests arrive <b>squashed together</b>: higher pitch. As it flies away they are <b>stretched</b>: lower pitch. That drop is the <b>Doppler effect</b> (more in WaveClear). Want to build tones from scratch? That is SynthClear.</p>
    <p class="tip"><b>Try it:</b> press Play, then solo each layer to hear how little each is alone. Pitch it down 7 semitones and reverse it. Then switch to the spaceship and change its speed.</p>`,
  terms: [
    { t: 'Sound designer', d: 'The person who creates a film’s sound world, especially sounds that cannot be recorded.' },
    { t: 'Layering', d: 'Stacking several sounds so they play as one bigger, richer sound.' },
    { t: 'Solo and mute', d: 'Hear one layer alone (solo) or switch one off (mute).' },
    { t: 'Semitone', d: 'The smallest step on a piano. 12 semitones make an octave, twice the frequency.' },
    { t: 'Sound library', d: 'A catalogue of recorded sound effects that designers can reuse.' },
    { t: 'Doppler effect', d: 'A moving source sounds higher coming towards you and lower going away.' },
    { t: 'Frequency', d: 'How many vibrations a second, in hertz (Hz). More means higher pitch.' },
  ],
  defaults: DEFAULTS,
  controls: [
    { key: 'fx', type: 'seg', label: 'Effect', options: [{ v: 'roar', label: 'Creature roar' }, { v: 'ship', label: 'Spaceship pass-by' }] },
    { key: 'play', type: 'buttons', label: 'Listen', items: [{ label: 'Play', act: (s, inst) => inst.play?.() }] },
    { key: 'low', type: 'toggle', label: 'Low rumble layer' },
    { key: 'mid', type: 'toggle', label: 'Mid growl layer' },
    { key: 'high', type: 'toggle', label: 'High screech layer' },
    { key: 'solo', type: 'seg', label: 'Solo', options: [{ v: 'all', label: 'All' }, { v: 'low', label: 'Low' }, { v: 'mid', label: 'Mid' }, { v: 'high', label: 'High' }] },
    { key: 'pitch', type: 'range', label: 'Pitch shift', min: -12, max: 12, step: 1, ends: ['octave down', 'octave up'], fmt: (v) => `${v > 0 ? '+' : ''}${v} semitones (×${(2 ** (v / 12)).toFixed(2)})` },
    { key: 'rev', type: 'toggle', label: 'Play it backwards' },
    { key: 'v', type: 'range', label: 'Spaceship speed', min: 20, max: 250, step: 5, ends: ['20 m/s', '250 m/s'], fmt: (v) => `${v} m/s (${Math.round(v * 3.6)} km/h)` },
  ],
  quiz: [
    { q: 'Why build a monster roar from several layers?', options: ['Films are not allowed to use one sound', 'Each layer adds a different part: weight, character and bite', 'It makes the file smaller', 'Microphones only record one pitch'], answer: 1, why: 'Low, mid and high layers fill different parts of the spectrum and together sound huge.' },
    { q: 'A sound is played twice as fast. What happens?', options: ['Pitch drops an octave', 'Pitch rises an octave and it lasts half as long', 'Nothing changes', 'It plays backwards'], answer: 1, why: 'Every frequency doubles (an octave, 12 semitones) and the sound takes half the time.' },
    { q: 'A ship flies past you. Its engine sounds…', options: ['higher coming, lower going', 'lower coming, higher going', 'the same all the time', 'silent until it passes'], answer: 0, why: 'Waves bunch up ahead of a moving source and stretch out behind it: the Doppler effect.' },
  ],
  reel: [
    { ms: 5200, caption: 'A monster roar is built from layers: a low rumble, a mid growl and a high screech.', set: { fx: 'roar', low: true, mid: true, high: true, solo: 'all', pitch: 0, rev: false }, act: (s, inst) => inst.play?.(true), anim: { pitch: [0, -5] }, spin: 0, view: { pos: [0.4, 2.4, 7.0], target: [0.3, 1.7, 0] } },
    { ms: 5400, caption: 'As a ship races past, its waves bunch up ahead and stretch out behind: the Doppler effect.', set: { fx: 'ship', v: 150, pitch: 0 }, act: (s, inst) => inst.play?.(true), spin: 0, view: { pos: [0.5, 7.5, 5.5], target: [0, 0.8, -1.2] } },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---------------------------------------------------------------- a generic horned creature (nobody's character)
    const beast = new THREE.Group(); beast.position.set(-2.6, 1.1, 0.4); root.add(beast);
    const skin = M.matte(0x3f6e4a, { roughness: 0.7 }), belly = M.matte(0x9fb07a);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.2, 16), skin); neck.position.set(-0.25, -0.55, 0); neck.rotation.z = 0.35; beast.add(neck);
    const skull = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 8, 16), skin); skull.rotation.z = Math.PI / 2 - 0.1; skull.position.set(0.25, 0.1, 0); beast.add(skull);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.6, 16), skin); snout.rotation.z = -Math.PI / 2; snout.position.set(0.85, 0.08, 0); beast.add(snout);
    const jaw = new THREE.Group(); jaw.position.set(0.2, -0.12, 0); beast.add(jaw);
    const jawM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.34), belly); jawM.position.x = 0.55; jaw.add(jawM);
    const mouthIn = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.28), M.glow(0xff5a3c)); mouthIn.position.set(0.55, 0.07, 0); jaw.add(mouthIn);
    for (let i = 0; i < 5; i++) for (const z of [-0.12, 0.12]) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), M.matte(0xf4f1ea)); tooth.position.set(0.5 + i * 0.1, -0.08, z); tooth.rotation.x = Math.PI; beast.add(tooth); }
    for (const z of [-0.2, 0.2]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 10), M.matte(0xd9c9a8)); horn.position.set(0.0, 0.5, z); horn.rotation.z = 0.9; beast.add(horn); const eye = sphere(0.05, M.glow(0xffd166), 12); eye.position.set(0.55, 0.25, z * 0.9); beast.add(eye); }
    beast.scale.setScalar(0.9);
    // ---------------------------------------------------------------- layers, drawn as tracks peeling apart in depth
    const snd = {}, layerOf = (k) => (snd[k] ||= roarLayer(k, 2.4, 21));
    const specs = {}, specOf = (k) => (specs[k] ||= spectrum(layerOf(k)));
    let playT = -1, rate = 1, st = { ...DEFAULTS };
    const revCache = {}, srcOf = (k) => (st.rev ? (revCache[k] ||= reversed(layerOf(k))) : layerOf(k));
    const tracks = Object.entries(LAYERS).map(([k, l], i) => {
      const b = board(root, 3.4, 0.62, 900, 164, (g, w, h) => {
        const lit = on(st, k);
        g.clearRect(0, 0, w, h); g.fillStyle = lit ? 'rgba(10,12,18,.9)' : 'rgba(10,12,18,.55)'; g.fillRect(0, 0, w, h);
        g.fillStyle = l.col; g.fillRect(0, 0, 8, h);
        text(g, l.name.toUpperCase(), 22, 30, { font: 'bold 22px sans-serif', col: lit ? l.col : 'rgba(255,255,255,.3)' });
        text(g, lit ? (st.solo === k ? 'SOLO' : 'ON') : 'MUTED', w - 20, 30, { font: 'bold 20px sans-serif', col: lit ? '#e8eef8' : COL.bad, align: 'right' });
        const a = srcOf(k);
        drawWave(g, a, 22, 42, (w - 44) / rate > w - 44 ? w - 44 : (w - 44) / rate, h - 50, l.col, { alpha: lit ? 1 : 0.25 });
        if (playT >= 0) { const x = 22 + (playT / (2.4 / rate)) * ((w - 44) / Math.max(1, rate)); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 40); g.lineTo(x, h - 4); g.stroke(); }
      }, [2.0, 3.35 - i * 0.74, -0.25 * i]);
      return { k, b };
    });
    const specB = board(root, 3.4, 1.35, 900, 360, (g, w, h) => {
      panelBg(g, w, h);
      title(g, 'Spectrum: each layer fills its own band', `pitch ×${rate.toFixed(2)}${st.rev ? ', reversed' : ''}`);
      for (const k of Object.keys(LAYERS)) if (on(st, k)) drawSpectrum(g, specOf(k), 22, 80, w - 44, 230, LAYERS[k].col, { lo: -110, hi: -35, shift: rate });
      freqAxis(g, 22, 312, w - 44);
      text(g, 'low pitch', 22, h - 12, { font: '15px sans-serif', col: COL.soft }); text(g, 'high pitch', w - 22, h - 12, { font: '15px sans-serif', col: COL.soft, align: 'right' });
    }, [2.0, 0.8, 0.25]);
    // ---------------------------------------------------------------- the Doppler pass-by
    const shipGrp = new THREE.Group(); root.add(shipGrp);
    const listener = makePerson({ shirt: 0x7fa7ff, pants: 0x2b3242 }); listener.position.set(0, 0, 1.6); listener.rotation.y = Math.PI; shipGrp.add(listener);
    const ship = new THREE.Group(); shipGrp.add(ship);
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.1, 8, 16), M.metal(0xb9bec8)); hull.rotation.z = Math.PI / 2; ship.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 16), M.metal(0xb9bec8)); nose.rotation.z = -Math.PI / 2; nose.position.x = 0.9; ship.add(nose);
    const wing = box(0.7, 0.04, 1.8, M.matte(0x3a3f4b)); wing.position.x = -0.1; ship.add(wing);
    const fin = box(0.4, 0.5, 0.04, M.matte(0x3a3f4b)); fin.position.set(-0.55, 0.28, 0); ship.add(fin);
    const cockpit = sphere(0.14, M.glass({ color: 0x8ef0ff })); cockpit.position.set(0.45, 0.16, 0); ship.add(cockpit);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 12), M.glow(0xffb547)); flame.rotation.z = Math.PI / 2; flame.position.x = -1.0; ship.add(flame);
    const shipY = 1.6, lane = 1.6 - D * SCALE;     // the lane is D metres from the listener
    const path = box(16, 0.01, 0.04, M.glow(0x3a3f4b)); path.position.set(0, 0.01, lane); shipGrp.add(path);
    const rings = Array.from({ length: 40 }, () => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 64), M.glow(0x8ef0ff, { transparent: true, opacity: 0.45, depthWrite: false })); r.rotation.x = Math.PI / 2; r.visible = false; shipGrp.add(r); return { r, t0: -99, x: 0 }; });
    let emitAcc = 0, ringIdx = 0, shipT = 0;
    const pbCache = {}, pbOf = (v) => (pbCache[v] ||= passby(v, D, 4));
    const dopB = board(root, 3.2, 1.6, 900, 450, (g, w, h) => {
      panelBg(g, w, h);
      const v = st.v, up = C_SOUND / (C_SOUND - v), dn = C_SOUND / (C_SOUND + v);
      title(g, 'Pitch you hear as the ship passes', `${v} m/s: ×${up.toFixed(2)} coming, ×${dn.toFixed(2)} going`);
      const a = pbOf(Math.round(v / 5) * 5), R = a.ratio, x0 = 70, y0 = 90, pw = w - 100, ph = 250;
      const Y = (r) => y0 + ph - ((Math.log2(r) + 1) / 2) * ph;
      g.strokeStyle = 'rgba(255,255,255,.12)'; for (const r of [0.5, 0.71, 1, 1.41, 2]) { g.beginPath(); g.moveTo(x0, Y(r)); g.lineTo(x0 + pw, Y(r)); g.stroke(); text(g, '×' + r, 18, Y(r) + 5, { font: '14px sans-serif', col: COL.soft }); }
      g.strokeStyle = COL.high; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i < R.length; i++) { const x = x0 + (i / (R.length - 1)) * pw, y = Y(R[i] || 1); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      const k = clamp(shipT, 0, 1); g.fillStyle = '#fff'; g.beginPath(); g.arc(x0 + k * pw, Y(R[Math.floor(k * (R.length - 1))] || 1), 7, 0, Math.PI * 2); g.fill();
      drawWave(g, a, x0, y0 + ph + 14, pw, 70, 'rgba(255,255,255,.55)');
      text(g, `drop of ${(12 * Math.log2(up / dn)).toFixed(1)} semitones as it passes`, 22, h - 14, { font: 'bold 20px sans-serif', col: COL.hot });
    }, [2.4, 3.0, -2.6]);
    dopB.mesh.rotation.set(-0.35, -0.3, 0);
    const L = {
      beast: stage.label('A creature nobody can record', [-2.4, 0.1, 0.6], root),
      listener: stage.label('You', [0, 2.0, 1.6], root),
      ship: stage.label('Spaceship', [0, 2.3, lane], root),
      waves: stage.label('Wave crests, shown 10× slower', [-3, 0.3, lane], root),
    };

    let key0 = '', pbHandle = null, wasPlaying = false, lastFx = '';
    const inst = {
      play(silent = false) {
        playT = 0; shipT = 0; rings.forEach((r) => { r.t0 = -99; r.r.visible = false; });
        if (silent) return;
        player.stopAll();
        rate = 2 ** (st.pitch / 12);
        if (st.fx === 'roar') for (const k of Object.keys(LAYERS)) { if (on(st, k)) player.play(srcOf(k), { gain: 0.6, rate }); }
        else pbHandle = player.play(st.rev ? reversed(pbOf(Math.round(st.v / 5) * 5)) : pbOf(Math.round(st.v / 5) * 5), { gain: 0.8, rate });
      },
      update(dt, s, time) {
        dt = Math.max(0, dt); st = s; player.sync(); rate = 2 ** (s.pitch / 12);
        const roar = s.fx === 'roar';
        if (s.fx !== lastFx) { if (lastFx && !inReel()) stage.setView(...(roar ? [[0.4, 2.3, 8.4], [0.3, 1.8, 0]] : [[0.3, 6.6, 6.6], [0.2, 0.9, -1.0]]), 1); lastFx = s.fx; }
        const narrow = fitNarrow(stage, [L.waves, L.beast], -0.1);
        reelBoards([[specB, [0.9, 0.5, 0.3], 1.0], [dopB, [0, 4.4, -1.0], 1.15]]);
        beast.visible = roar; tracks.forEach((t) => { t.b.mesh.visible = roar; }); specB.mesh.visible = roar;
        shipGrp.visible = !roar; dopB.mesh.visible = !roar;
        L.beast.visible = roar && !narrow; L.listener.visible = L.ship.visible = !roar; L.waves.visible = !roar && !narrow;
        if (roar) {
          // jaw follows the loudness of the sum of the active layers at the playhead
          let e = 0.08;
          if (playT >= 0) {
            playT += dt; const dur = 2.4 / rate;
            if (playT > dur + 0.4) playT = -1;
            else { const u = clamp(playT / dur, 0, 1), i = Math.floor(u * (layerOf('mid').length - 1)); let a = 0; for (const k of Object.keys(LAYERS)) if (on(s, k)) { const arr = srcOf(k), j = i; for (let q = -200; q < 200; q += 20) a = Math.max(a, Math.abs(arr[clamp(j + q, 0, arr.length - 1)] || 0)); } e = Math.max(e, a); }
          }
          jaw.rotation.z = -0.7 * clamp(e, 0, 1);
          beast.rotation.z = 0.08 * e; beast.position.y = 1.1 + 0.03 * Math.sin(time * 1.3);
          mouthIn.material.color.setHex(e > 0.3 ? 0xffb547 : 0xff5a3c);
          const kk = `${s.low}${s.mid}${s.high}${s.solo}${s.pitch}${s.rev}`;
          if (kk !== key0 || playT >= 0 || wasPlaying) { tracks.forEach((t) => t.b.redraw()); }
          if (kk !== key0) { key0 = kk; specB.redraw(); }
          wasPlaying = playT >= 0;
        } else {
          // ship flies along the lane in slow motion; crests leave its position and spread at the (scaled) speed of sound
          const vis = s.v * SCALE / SLOW, cvis = C_SOUND * SCALE / SLOW, span = 14;
          if (playT >= 0) { shipT += (dt * s.v) / SLOW / (span / SCALE); if (shipT > 1.15) { playT = -1; } }
          else shipT = (shipT + (dt * s.v) / SLOW / (span / SCALE)) % 1.15;
          const x = -span / 2 + shipT * span;
          ship.position.set(x, shipY, lane); flame.scale.y = 0.8 + 0.3 * Math.sin(time * 40);
          emitAcc += dt;
          if (emitAcc > 0.09) { emitAcc = 0; const r = rings[ringIdx++ % rings.length]; r.t0 = time; r.x = x; }
          rings.forEach((r) => { const age = time - r.t0; const R = age * cvis; r.r.visible = age >= 0 && R < 9; if (r.r.visible) { r.r.position.set(r.x, shipY, lane); r.r.scale.setScalar(Math.max(0.01, R)); r.r.material.opacity = 0.45 * (1 - R / 9); } });
          L.ship.position.set(x, shipY + 0.7, lane);
          dopB.redraw();
          void vis;
        }
      },
      readout(s) {
        const r = 2 ** (s.pitch / 12);
        if (s.fx === 'roar') {
          const act = Object.keys(LAYERS).filter((k) => on(s, k));
          return `<div class="big">Creature roar</div>
            <div class="row"><span>Layers playing</span><b>${act.length ? act.join(', ') : 'none'}</b></div>
            <div class="row"><span>Pitch shift</span><b>${s.pitch > 0 ? '+' : ''}${s.pitch} st = ×${r.toFixed(2)}</b></div>
            <div class="row"><span>Length</span><b>${(2.4 / r).toFixed(2)} s${s.rev ? ', backwards' : ''}</b></div>
            ${s.solo !== 'all' ? `<small>${LAYERS[s.solo].what}</small>` : ''}`;
        }
        const up = C_SOUND / (C_SOUND - s.v), dn = C_SOUND / (C_SOUND + s.v);
        return `<div class="big">Spaceship pass-by</div>
          <div class="row"><span>Speed</span><b>${s.v} m/s (${Math.round(s.v * 3.6)} km/h)</b></div>
          <div class="row"><span>Coming towards you</span><b>×${up.toFixed(2)} pitch</b></div>
          <div class="row"><span>Going away</span><b>×${dn.toFixed(2)} pitch</b></div>
          <div class="row"><span>Drop as it passes</span><b>${(12 * Math.log2(up / dn)).toFixed(1)} semitones</b></div>`;
      },
      dispose() { player.stopAll(); },
    };
    return inst;
  },
};
