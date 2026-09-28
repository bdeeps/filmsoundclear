// Chapter 2: Foley. Performing everyday sounds in sync with the picture.
//  - Named after Jack Foley (1891–1967), who performed sound effects live to picture at Universal from
//    Show Boat (1929) on. Foley stages have "pits" of different floor surfaces and shelves of props.
//  - Walking cadence: adults walk at about 100–120 steps a minute (Tudor-Locke et al., 2011, IJBNPA 8:79),
//    so the film here steps every 0.5 s (120 steps/min).
//  - Sync: at 24 fps one frame is 41.7 ms. The ITU-R BT.1359-1 detectability limits (sound 45 ms early,
//    125 ms late) are used to judge your taps; Foley editors still slide sounds to the exact frame.
//  - Every sound is synthesised in js/sound.js from a physical recipe: a footstep is a heel strike then a
//    toe strike about 70 ms later; gravel is dozens of tiny stone clicks; wood is a knock that rings at a
//    few board resonances; celery is a few sharp cracks then tearing fibres; coconut shells ring hollow.
import { THREE, M, box, clamp } from '../kit.js';
import {
  board, panelBg, title, text, rrect, COL, fitNarrow, reelBoards, pressSeg, rng, sphere,
  makePerson, makeShotgun, stick, footstep, prop, PROPS, spectrum, drawWave, drawSpectrum, freqAxis, player, FRAME_MS,
} from '../sound.js';

const SURF = {
  gravel: { name: 'Gravel', x: -1.9, what: 'Crunchy: dozens of little stones click against each other under each step.' },
  wood: { name: 'Wood', x: 0, what: 'Hollow and ringing: the boards resonate at a few low pitches after each knock.' },
  concrete: { name: 'Concrete', x: 1.9, what: 'Hard and short: a sharp click with almost no ring, plus a little grit.' },
};
const STEP = 0.5, LEAD = 1.0, NSTEPS = 8, LOOP = LEAD + NSTEPS * STEP + 1.0;   // seconds
const contacts = Array.from({ length: NSTEPS }, (_, k) => LEAD + k * STEP);
const DEFAULTS = { surface: 'wood', auto: true };

export default {
  id: 'foley',
  short: 'Foley',
  title: 'Foley: sounds made by hand',
  subtitle: 'Walk in the pits, snap celery for bones, and try to perform footsteps in sync.',
  view: { pos: [0.9, 2.5, 7.9], target: [0.8, 1.55, -0.4] },
  learn: `<p>Most of the small sounds in a film were <b>not recorded on set</b>. The boom mic was pointed at the actors’ mouths, so footsteps, rustling clothes and the clink of a cup are faint or missing. They are added later by <b>Foley artists</b>, who watch the film on a big screen and <b>perform the sounds live, in sync</b> with the picture.</p>
    <p>The craft is named after <b>Jack Foley</b>, who did this at Universal Studios from 1929. A Foley stage has <b>pits</b> of gravel, wood, concrete and more, and shelves of odd props. The trick is that the real thing often sounds wrong on film. A snapped stick of <b>celery</b> makes a better breaking bone than a bone. <b>Coconut shells</b> knocked together make hooves. A fist into a <b>cabbage</b> is a punch, and a twisted <b>leather jacket</b> gives creaks of tension.</p>
    <p>A Foley team records one layer at a time: <b>footsteps</b> for each character, then a <b>cloth</b> pass for every movement, then the <b>props</b>. Each is placed to the exact frame. At 24 frames a second that is 41.7 milliseconds, and viewers notice when a step lands more than about <b>45 ms early or 125 ms late</b>.</p>
    <p class="tip"><b>Try it:</b> click a pit or a prop to hear it and see its waveform and spectrum. Then press “Start the sync game” and hit “Step!” (or the space bar) each time a foot lands on the screen.</p>`,
  terms: [
    { t: 'Foley', d: 'Everyday sounds performed live in time with the picture, after filming.' },
    { t: 'Foley artist', d: 'A performer who makes those sounds with their feet, hands and props.' },
    { t: 'Pit', d: 'A patch of floor on a Foley stage filled with one surface, like gravel or wood.' },
    { t: 'Cloth pass', d: 'A Foley recording of just the rustle of clothes for every movement in a scene.' },
    { t: 'Waveform', d: 'A graph of the sound’s pressure over time: spikes are sudden hits.' },
    { t: 'Spectrum', d: 'How much of each pitch (frequency) a sound contains, from low to high.' },
    { t: 'Sync', d: 'Sound and picture happening at the same moment.' },
  ],
  defaults: DEFAULTS,
  controls: [
    { key: 'surface', type: 'seg', label: 'Surface (or click a pit)', options: Object.entries(SURF).map(([v, m]) => ({ v, label: m.name })) },
    { key: 'props', type: 'buttons', label: 'Props (or click one on the table)', items: Object.entries(PROPS).map(([k, p]) => ({ label: p.name, act: (s, inst) => inst.useProp?.(k) })) },
    { key: 'game', type: 'buttons', label: 'Perform in sync', items: [
      { label: 'Start the sync game', act: (s, inst) => inst.startGame?.() },
      { label: 'Step!', act: (s, inst) => inst.tap?.() },
    ] },
    { key: 'auto', type: 'toggle', label: 'Let the Foley artist perform', hint: 'Footsteps play on every step of the film loop.' },
  ],
  quiz: [
    { q: 'Why are footsteps usually added after filming?', options: ['Actors walk silently', 'The boom mic points at the voices, so steps are faint, and Foley gives clean control', 'Cameras cannot see feet', 'It is the law'], answer: 1, why: 'Production sound focuses on dialogue. Foley recorded later is clean and can be shaped for each moment.' },
    { q: 'What does a Foley artist often use to make the sound of breaking bones?', options: ['A real bone', 'A stick of celery', 'A balloon', 'A drum'], answer: 1, why: 'Snapped celery gives a crisp crack and tearing fibres that sound like bone on screen.' },
    { q: 'At 24 fps, a footstep that is 2 frames late is late by about…', options: ['2 ms', '83 ms', '240 ms', '2 s'], answer: 1, why: 'One frame is 1/24 s ≈ 41.7 ms, so two frames ≈ 83 ms, still under the ~125 ms most people notice.' },
  ],
  reel: [
    { ms: 5000, caption: 'Foley artists perform footsteps in pits of gravel, wood and concrete, in time with the picture.', set: { surface: 'gravel', auto: true }, act: (s, inst) => inst.reset?.(), spin: 0.2, view: { pos: [-1.4, 2.6, 4.2], target: [-1.2, 0.9, 0] } },
    { ms: 5000, caption: 'A snapped stick of celery becomes a breaking bone. Coconut shells become hooves.', set: { surface: 'wood', auto: false }, act: (s, inst) => inst.useProp?.('celery', true), spin: 0, view: { pos: [3.6, 2.2, 3.4], target: [2.8, 1.0, 0.6] } },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---------------------------------------------------------------- the stage floor and the pits
    const floor = box(8.2, 0.12, 4.4, M.matte(0x3a3530)); floor.position.set(0.4, 0.06, 0); root.add(floor);
    const pits = {}, R = rng(4);
    for (const [k, p] of Object.entries(SURF)) {
      const g = new THREE.Group(); g.position.set(p.x, 0, 0.5); root.add(g);
      const rim = M.matte(0x5b4633);
      for (const [x, z, w, d] of [[0, -0.62, 1.34, 0.1], [0, 0.62, 1.34, 0.1], [-0.62, 0, 0.1, 1.34], [0.62, 0, 0.1, 1.34]]) { const b = box(w, 0.16, d, rim); b.position.set(x, 0.08, z); g.add(b); }
      let fill;
      if (k === 'gravel') {
        fill = new THREE.Group();
        const base = box(1.14, 0.1, 1.14, M.matte(0x6d6660)); base.position.y = 0.06; fill.add(base);
        const n = 700, sw = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.028, 0), M.matte(0x9a938a), n), o = new THREE.Object3D(), c = new THREE.Color();
        for (let i = 0; i < n; i++) { o.position.set((R() - 0.5) * 1.1, 0.12 + R() * 0.03, (R() - 0.5) * 1.1); o.rotation.set(R() * 3, R() * 3, 0); o.scale.setScalar(0.6 + R() * 0.9); o.updateMatrix(); sw.setMatrixAt(i, o.matrix); sw.setColorAt(i, c.setHSL(0.08, 0.08, 0.35 + R() * 0.3)); }
        sw.castShadow = true; fill.add(sw);
      } else if (k === 'wood') {
        fill = new THREE.Group();
        for (let i = 0; i < 6; i++) { const pl = box(1.14, 0.08, 0.18, M.matte(i % 2 ? 0x9a6a3e : 0x8a5c34, { roughness: 0.6 })); pl.position.set(0, 0.1, -0.475 + i * 0.19); fill.add(pl); }
      } else {
        fill = box(1.14, 0.12, 1.14, M.matte(0x8f9296, { roughness: 0.95 })); fill.position.y = 0.08;
      }
      g.add(fill);
      g.traverse((o) => { o.userData.surface = k; });
      pits[k] = g;
    }
    // ---------------------------------------------------------------- screen at the back, showing the film
    const scrW = 3.4, scrH = 1.9;
    let film = { t: 0, taps: [], game: false, count: '' };
    const screen = board(root, scrW, scrH, 960, 536, (g, w, h) => {
      g.fillStyle = '#0b0d12'; g.fillRect(0, 0, w, h);
      // a street scene drawn flat: a wall, a pavement line and a generic walking figure
      g.fillStyle = '#9fc5e8'; g.fillRect(0, 0, w, h * 0.72); g.fillStyle = '#8d8f94'; g.fillRect(0, h * 0.72, w, h * 0.28);
      g.fillStyle = '#5b7fa6'; for (let i = 0; i < 6; i++) g.fillRect(20 + i * 160, 90 + (i % 3) * 30, 130, h * 0.72 - 90 - (i % 3) * 30);
      const t = film.t, walkT = clamp((t - LEAD + STEP) / (NSTEPS * STEP), 0, 1.2);
      const cx = 300 + walkT * 540, ground = h * 0.8;
      const ph = ((t - LEAD) / STEP) * Math.PI;           // one step per half cycle; contact when sin(ph) = 0
      const sw = t > LEAD - STEP && t < LEAD + NSTEPS * STEP ? Math.sin(ph) : 0;
      g.strokeStyle = '#1b1d22'; g.lineWidth = 22; g.lineCap = 'round';
      const hip = [cx, ground - 150], leg = 150;
      const foot = (a) => [hip[0] + Math.sin(a) * leg * 0.55, hip[1] + Math.cos(a) * leg];
      const A = [foot(0.45 * sw), foot(-0.45 * sw)];
      for (const f of A) { g.beginPath(); g.moveTo(...hip); g.lineTo(...f); g.stroke(); }
      g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(hip[0] + 6, hip[1] - 120); g.stroke();
      g.beginPath(); g.moveTo(hip[0] + 6, hip[1] - 100); g.lineTo(hip[0] + 6 - 40 * sw, hip[1] - 30); g.moveTo(hip[0] + 6, hip[1] - 100); g.lineTo(hip[0] + 6 + 40 * sw, hip[1] - 30); g.stroke();
      g.fillStyle = '#1b1d22'; g.beginPath(); g.arc(hip[0] + 8, hip[1] - 150, 30, 0, Math.PI * 2); g.fill();
      // flash when a foot lands
      for (const c of contacts) if (t >= c && t < c + 0.09) { g.fillStyle = 'rgba(255,209,102,.9)'; g.beginPath(); g.ellipse(Math.min(A[0][0], A[1][0]) + 8, ground + 4, 46, 10, 0, 0, Math.PI * 2); g.fill(); }
      text(g, `TC 01:00:${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 24)).padStart(2, '0')}`, 20, 34, { font: 'bold 22px monospace', col: '#1b1d22' });
      if (film.count) text(g, film.count, w / 2, h / 2 - 40, { font: 'bold 120px sans-serif', col: '#b3261e', align: 'center' });
      if (film.game) text(g, 'Hit STEP as each foot lands', w - 20, 34, { font: 'bold 24px sans-serif', col: '#b3261e', align: 'right' });
    }, [0.3, 2.65, -1.9]);
    const scrFrame = box(scrW + 0.12, scrH + 0.12, 0.06, M.matte(0x111216)); scrFrame.position.set(0.3, 2.65, -1.95); root.add(scrFrame);
    // ---------------------------------------------------------------- props table
    const table = new THREE.Group(); table.position.set(3.25, 0, 0.9); root.add(table);
    const top = box(1.2, 0.05, 0.8, M.matte(0x6b4a2e)); top.position.y = 0.85; table.add(top);
    for (const x of [-0.55, 0.55]) for (const z of [-0.35, 0.35]) { const l = box(0.05, 0.85, 0.05, M.matte(0x4a3320)); l.position.set(x, 0.425, z); table.add(l); }
    const propObj = {};
    const celery = new THREE.Group(); for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.45, 10), M.matte(0x9ccc65)); st.rotation.z = Math.PI / 2; st.position.set(0, 0, (i - 1) * 0.04); celery.add(st); } const leaf = sphere(0.05, M.matte(0x6aa84f)); leaf.position.x = 0.25; celery.add(leaf); celery.position.set(-0.35, 0.9, -0.2); table.add(celery); propObj.celery = celery;
    const coco = new THREE.Group(); for (const x of [0, 0.16]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.matte(0x6b4226, { side: THREE.DoubleSide })); h.position.x = x; coco.add(h); } coco.position.set(0.2, 0.875, -0.2); table.add(coco); propObj.coconut = coco;
    const cab = sphere(0.13, M.matte(0x7cb342)); cab.scale.set(1, 0.9, 1); cab.position.set(-0.3, 1.0, 0.18); table.add(cab); propObj.cabbage = cab;
    const towel = box(0.3, 0.03, 0.22, M.matte(0x5c7cfa)); towel.position.set(0.3, 0.885, 0.2); table.add(towel); propObj.cloth = towel;
    // leather jacket on a stand next to the table
    const jacket = new THREE.Group(); jacket.position.set(4.2, 0, -0.3); root.add(jacket);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), M.metal(0x3a3f4b)); post.position.y = 0.85; jacket.add(post);
    const jb = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 6, 12), M.matte(0x2b1d16, { roughness: 0.4 })); jb.scale.set(1.3, 1, 0.6); jb.position.y = 1.25; jacket.add(jb);
    for (const x of [-0.26, 0.26]) { const sl = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.45, 4, 8), M.matte(0x2b1d16, { roughness: 0.4 })); sl.position.set(x, 1.2, 0); sl.rotation.z = x > 0 ? 0.15 : -0.15; jacket.add(sl); }
    propObj.leather = jacket;
    Object.entries(propObj).forEach(([k, o]) => o.traverse((c) => { c.userData.prop = k; }));
    // ---------------------------------------------------------------- the Foley artist and the mic
    const artist = makePerson({ shirt: 0x5ce1a9, pants: 0x2b3242, skin: 0xb88a67 }); root.add(artist);
    const standMat = M.metal(0x3a3f4b);
    const micStand = new THREE.Group(); root.add(micStand);
    const mPole = stick(0.015, standMat); const mArm = stick(0.012, standMat); micStand.add(mPole, mArm);
    const mic = makeShotgun(0.22, false); micStand.add(mic);
    const L = {
      screen: stage.label('The film, on a big screen', [1.6, 1.55, -1.9], root),
      artist: stage.label('Foley artist', [0, 2.0, 0.5], root),
      mic: stage.label('Mic', [0, 1.0, 1.4], root),
      props: stage.label('Props', [3.25, 1.35, 0.9], root),
      ...Object.fromEntries(Object.entries(SURF).map(([k, p]) => [k, stage.label(p.name + ' pit', [p.x, 0.3, 1.35], root)])),
    };

    // ---------------------------------------------------------------- sounds and the analysis board
    const steps = {}; const stepOf = (k, i) => ((steps[k] ||= [0, 1, 2, 3].map((j) => footstep(k, 11 + j * 7)))[i % 4]);
    const propSnd = {}; const propOf = (k) => (propSnd[k] ||= prop(k, 5));
    let last = { name: 'Wood footstep', what: SURF.wood.what, a: stepOf('wood', 0) }, lastSp = spectrum(last.a);
    const setLast = (name, what, a) => { last = { name, what, a }; lastSp = spectrum(a); anaB.redraw(); };
    let results = [];
    const anaB = board(root, 2.3, 2.3, 700, 700, (g, w, h) => {
      panelBg(g, w, h);
      title(g, last.name, last.what.length > 62 ? last.what.slice(0, 60) + '…' : last.what);
      text(g, 'WAVEFORM', 22, 100, { font: 'bold 15px sans-serif', col: COL.soft });
      drawWave(g, last.a, 22, 110, w - 44, 150, COL.foley);
      text(g, `${(last.a.length / 32000).toFixed(2)} s`, w - 22, 100, { font: '15px sans-serif', col: COL.soft, align: 'right' });
      text(g, 'SPECTRUM (low → high pitch)', 22, 300, { font: 'bold 15px sans-serif', col: COL.soft });
      drawSpectrum(g, lastSp, 22, 310, w - 44, 140, COL.hot, { lo: -110, hi: -30 });
      freqAxis(g, 22, 450, w - 44);
      // sync game timeline
      text(g, 'SYNC GAME: footfalls (ticks) and your taps (dots)', 22, 510, { font: 'bold 15px sans-serif', col: COL.soft });
      const x0 = 30, x1 = w - 30, X = (t) => x0 + ((t - LEAD + 0.3) / (NSTEPS * STEP + 0.3)) * (x1 - x0), yM = 570;
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(x0, yM); g.lineTo(x1, yM); g.stroke();
      g.strokeStyle = '#f2efe8'; g.lineWidth = 3; for (const c of contacts) { g.beginPath(); g.moveTo(X(c), yM - 22); g.lineTo(X(c), yM + 22); g.stroke(); }
      for (const r of results) { const ok = r.off >= -45 && r.off <= 125, tight = Math.abs(r.off) <= FRAME_MS; g.fillStyle = tight ? COL.good : ok ? COL.hot : COL.bad; g.beginPath(); g.arc(X(r.t), yM + (r.off < 0 ? -10 : 10), 8, 0, Math.PI * 2); g.fill(); }
      const st = stats();
      text(g, st.n ? `${st.n} taps · average ${st.mean > 0 ? '+' : ''}${st.mean.toFixed(0)} ms · ${st.tight} within one frame` : 'Press “Start the sync game”, then tap Step! on each footfall.', 22, 630, { font: 'bold 19px sans-serif', col: st.n ? '#e8eef8' : COL.soft });
      if (st.n) text(g, st.verdict[0], 22, 664, { font: 'bold 19px sans-serif', col: st.verdict[1] });
    }, [4.0, 2.45, -1.2]);
    anaB.mesh.rotation.y = -0.5;
    function stats() {
      const n = results.length; if (!n) return { n };
      const mean = results.reduce((a, r) => a + r.off, 0) / n, tight = results.filter((r) => Math.abs(r.off) <= FRAME_MS).length;
      const bad = results.filter((r) => r.off < -45 || r.off > 125).length;
      const verdict = bad === 0 ? ['In sync: nobody would notice.', COL.good] : bad <= 2 ? ['Mostly in sync: an editor would nudge a few.', COL.hot] : ['Out of sync: the steps would look wrong.', COL.bad];
      return { n, mean, tight, bad, verdict };
    }

    // ---------------------------------------------------------------- state
    let t = 0, gameOn = false, stepIdx = 0, propAct = null, lastContact = -1, s0 = DEFAULTS, key0 = '';
    const onKey = (e) => { if (e.code === 'Space' && gameOn && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName)) { e.preventDefault(); inst.tap(); } };
    window.addEventListener('keydown', onKey);
    const pitPos = (k) => new THREE.Vector3(SURF[k].x, 0.14, 0.5);

    const inst = {
      reset() { t = 0; lastContact = -1; },
      startGame() { gameOn = true; t = 0; results = []; lastContact = -1; anaB.redraw(); },
      tap() {
        const k = s0.surface, a = stepOf(k, stepIdx++);
        player.play(a, { gain: 0.8 });
        stepFlash = 0.25;
        if (gameOn) {
          let best = null; for (const c of contacts) if (!best || Math.abs(t - c) < Math.abs(t - best)) best = c;
          if (Math.abs(t - best) < STEP / 2) results.push({ t: best, off: (t - best) * 1000 });
        }
        setLast(`${SURF[k].name} footstep`, SURF[k].what, a);
      },
      useProp(k, silent = false) {
        propAct = { k, t: 0 };
        const a = propOf(k); if (!silent) player.play(a, { gain: 0.8 });
        setLast(`${PROPS[k].name} → ${PROPS[k].plays}`, PROPS[k].how, a);
      },
      update(dt, s) {
        dt = Math.max(0, dt); s0 = s; player.sync();
        const narrow = fitNarrow(stage, [L.mic, L.props, L.gravel, L.wood, L.concrete, L.screen], -0.12);
        reelBoards([[anaB, [0.3, 4.55, -1.0], 1.1], [screen, [0.3, 2.65, -1.9], 1.0]]);
        t += dt;
        if (t > LOOP) { t -= LOOP; lastContact = -1; if (gameOn) { gameOn = false; anaB.redraw(); } }
        // count-in for the game
        film.game = gameOn; film.count = gameOn && t < LEAD ? String(Math.ceil((LEAD - t) / (LEAD / 3))) : '';
        film.t = t; film.taps = results; screen.redraw();
        // automatic performance: the artist steps on every footfall
        for (let i = 0; i < contacts.length; i++) if (t >= contacts[i] && lastContact < i) {
          lastContact = i;
          if (s.auto && !gameOn) { const a = stepOf(s.surface, i); player.play(a, { gain: 0.7 }); stepFlash = 0.25; if (i === 0) setLast(`${SURF[s.surface].name} footstep`, SURF[s.surface].what, a); }
        }
        // artist: in the pit stepping, or at the table using a prop
        if (propAct) propAct.t += dt;
        const atTable = propAct && propAct.t < 2.2;
        if (!atTable) propAct = null;
        const target = atTable ? new THREE.Vector3(3.25, 0.12, 0.2) : pitPos(s.surface);
        artist.position.lerp(target, 1 - Math.exp(-6 * dt));
        artist.rotation.y = atTable ? Math.PI : 0.25;
        const walking = s.auto && !gameOn && t > LEAD - 0.2 && t < LEAD + NSTEPS * STEP;
        const ph = ((t - LEAD) / STEP) * Math.PI;
        if (atTable) {
          const k = propAct.k, u = propAct.t;
          const snap = k === 'celery' ? Math.max(0, Math.sin(u * 3)) : k === 'coconut' ? Math.abs(Math.sin(u * 8)) : k === 'cabbage' ? Math.max(0, Math.sin(u * 4)) : 0.5 + 0.3 * Math.sin(u * 6);
          artist.pose({ arm: 1.1 + 0.3 * snap, armR: 1.1 + 0.3 * snap, open: k === 'celery' ? 0.3 - 0.25 * snap : 0.1 });
          if (k === 'celery') celery.rotation.z = -0.4 * snap;
        } else {
          const sw = walking || stepFlash > 0 ? 0.35 * Math.sin(walking ? ph : stepFlash * 12) : 0;
          artist.pose({ stride: sw, arm: -sw * 0.8, armR: sw * 0.8 });
          celery.rotation.z = 0;
        }
        stepFlash = Math.max(0, stepFlash - dt);
        L.artist.position.set(artist.position.x, 2.0, artist.position.z);
        // mic stand points at the artist's feet (or the table)
        const aim = atTable ? new THREE.Vector3(3.25, 0.95, 0.75) : new THREE.Vector3(artist.position.x, 0.2, 0.55);
        const base = new THREE.Vector3(aim.x + (atTable ? -0.8 : 0.75), 0, aim.z + 0.9);
        mPole.between([base.x, 0, base.z], [base.x, 1.1, base.z]);
        const head = new THREE.Vector3(base.x, 1.1, base.z).lerp(aim, 0.45);
        mArm.between([base.x, 1.1, base.z], head.toArray());
        mic.position.copy(head); mic.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), aim.clone().sub(head).normalize());
        L.mic.position.set(head.x, head.y + 0.2, head.z);
        for (const [k, p] of Object.entries(pits)) p.children.forEach((c) => { if (c.material?.emissive) c.material.emissive.setHex(k === s.surface ? 0x332200 : 0x000000); });
        Object.entries(SURF).forEach(([k]) => L[k].element.classList.toggle('hot', k === s.surface));
        const kk = `${s.surface}|${results.length}|${gameOn}`; if (kk !== key0) { key0 = kk; anaB.redraw(); }
      },
      readout(s) {
        const st = stats();
        const head = propAct ? `${PROPS[propAct.k].name}` : `${SURF[s.surface].name} pit`;
        const sub = propAct ? `Plays: ${PROPS[propAct.k].plays}. ${PROPS[propAct.k].how}` : SURF[s.surface].what;
        return `<div class="big">${head}</div>
          <div class="row"><span>Film steps every</span><b>${STEP * 1000} ms (120 a minute)</b></div>
          <div class="row"><span>One frame at 24 fps</span><b>41.7 ms</b></div>
          ${st.n ? `<div class="row"><span>Your taps</span><b>${st.n} · average ${st.mean > 0 ? '+' : ''}${st.mean.toFixed(0)} ms</b></div><div class="row"><span>Within one frame</span><b>${st.tight} of ${st.n}</b></div><div class="${st.bad ? 'no' : 'ok'}">${st.verdict[0]}</div>` : gameOn ? '<div class="ok">Game on: tap Step! as each foot lands.</div>' : ''}`;
      },
      pick(o) {
        const k = o.userData.surface, p = o.userData.prop;
        if (k) { pressSeg(k); if (gameOn) inst.tap(); else { const a = stepOf(k, stepIdx++); player.play(a, { gain: 0.8 }); stepFlash = 0.25; setLast(`${SURF[k].name} footstep`, SURF[k].what, a); } }
        else if (p) inst.useProp(p);
      },
      dispose() { window.removeEventListener('keydown', onKey); player.stopAll(); },
    };
    let stepFlash = 0;
    stage.pickables = [...Object.values(pits), ...Object.values(propObj)];
    return inst;
  },
};
