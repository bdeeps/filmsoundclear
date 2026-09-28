// Chapter 4: dialogue and ADR (automated dialogue replacement), and dubbing.
//  - The ADR loop: the scene plays on a screen in a loop; the actor hears three beeps (often a second
//    apart) and a visual "streamer" line wipes across the picture; the line starts where a fourth beep would
//    be. The actor watches their own lips and matches them, take after take.
//  - Lip sync tolerance: ITU-R BT.1359-1 (1998): viewers start to detect an error at about 45 ms with
//    sound early or 125 ms with sound late; it becomes unacceptable beyond about 90 ms early or 185 ms late.
//    Sound early feels worse because in nature light always arrives before sound.
//  - Dubbing: films are re-voiced in other languages. India dubs heavily between its own languages and
//    from Hollywood: Telugu and Tamil films such as Baahubali (2015, 2017) and RRR (2022) played across
//    India in Hindi, Tamil, Telugu, Malayalam and Kannada versions. Dubbing writers match lip shapes,
//    such as the closed lips of p, b and m sounds.
import { THREE, M, box, clamp } from '../kit.js';
import {
  board, panelBg, title, text, rrect, COL, fitNarrow, reelBoards, sphere, stick,
  makePerson, makeShotgun, voice, ambience, beeps, drawWave, rmsEnv, player, FRAME_MS,
} from '../sound.js';

const REASONS = {
  noise: { name: 'Noisy location', what: 'A plane flew over during the best take. The acting was perfect, but the words are buried in noise.' },
  perf: { name: 'Better performance', what: 'The director wants a line angrier, softer or clearer. The actor re-performs it to the same lip movements.' },
  line: { name: 'Changed line', what: 'A line is rewritten after filming, often while the speaker faces away, so the new words cannot clash with the lips.' },
  dub: { name: 'Dub to another language', what: 'A new actor voices the whole film in another language. Writers choose words whose lip shapes fit the picture.' },
};
const BEEP_GAP = 1, LINE_AT = 4, LOOP = 7.2, SEC = 2.2;
const DEFAULTS = { reason: 'noise', off: 60, take: 'adr' };
function verdict(ms) {
  if (ms >= -45 && ms <= 125) return ['Looks in sync to almost everyone.', COL.good, 'ok'];
  if (ms >= -90 && ms <= 185) return ['Some viewers will notice, but it is acceptable.', COL.hot, 'ok'];
  return [ms < 0 ? 'Out of sync: you hear words before the lips move.' : 'Out of sync: the lips move before you hear the words.', COL.bad, 'no'];
}

export default {
  id: 'adr',
  short: 'Dialogue & ADR',
  title: 'Re-recording the dialogue: ADR',
  subtitle: 'Loop a scene, count the beeps, and find out how far lips and words can drift apart.',
  view: { pos: [1.6, 2.4, 6.2], target: [1.1, 1.65, -0.9] },
  learn: `<p>Sometimes the words recorded on set cannot be used. A plane flew over, a generator hummed, or the director wants the line said differently. Then the actor goes into a quiet booth for <b>ADR</b>, <b>automated dialogue replacement</b>, also called looping or dubbing.</p>
    <p>The scene plays on a screen in a <b>loop</b>. The actor hears <b>three beeps</b>, evenly spaced, while a line called a <b>streamer</b> wipes across the picture. On the silent fourth beat they speak, watching their own lips and matching them. Good ADR artists can hit a line within a frame or two.</p>
    <p>How close is close enough? Broadcast tests found most people notice when sound is about <b>45 ms early</b> or <b>125 ms late</b>. We forgive late sound more, because in real life light always reaches us before sound. The clapperboard in FilmClear exists for the same reason.</p>
    <p>The biggest ADR job is <b>dubbing</b> a whole film into another language. India is a giant of dubbing: Telugu and Tamil films like <b>Baahubali</b> and <b>RRR</b> were released in Hindi, Tamil, Telugu, Malayalam and Kannada, and Hollywood films arrive in Hindi, Tamil and Telugu. Dubbing writers hunt for words that fit the lips: when the actor’s lips close, the new line needs a <b>p, b or m</b> there too.</p>
    <p class="tip"><b>Try it:</b> press “Run the loop” and listen for the beeps. Slide the sync offset until the orange sound bumps sit on the blue lip bumps. Push it past 125 ms late, then 45 ms early, and watch the verdict.</p>`,
  terms: [
    { t: 'ADR', d: 'Automated dialogue replacement: re-recording lines in a studio, in sync with the picture.' },
    { t: 'Loop', d: 'A short section of the film played over and over while the actor records.' },
    { t: 'Streamer', d: 'A line that wipes across the picture to count the actor in to the line.' },
    { t: 'Lip sync', d: 'Words heard at the same moment the lips form them.' },
    { t: 'Dubbing', d: 'Replacing the dialogue with a new performance, often in another language.' },
    { t: 'Bilabial', d: 'A sound made by closing both lips: p, b or m.' },
  ],
  defaults: DEFAULTS,
  controls: [
    { key: 'reason', type: 'seg', label: 'Why re-record?', options: Object.entries(REASONS).map(([v, r]) => ({ v, label: r.name })) },
    { key: 'run', type: 'buttons', label: 'The loop', items: [{ label: 'Run the loop', act: (s, inst) => inst.run?.() }, { label: 'Snap to sync', act: (s) => { s.off = 0; } }] },
    { key: 'take', type: 'seg', label: 'Hear', options: [{ v: 'prod', label: 'Take from the set' }, { v: 'adr', label: 'ADR take' }] },
    { key: 'off', type: 'range', label: 'Sync offset of the new take', min: -250, max: 250, step: 5, ends: ['sound early', 'sound late'], fmt: (v) => `${v > 0 ? '+' : ''}${v} ms (${(v / FRAME_MS).toFixed(1)} frames)` },
  ],
  quiz: [
    { q: 'Why might a perfect acting take still need ADR?', options: ['The camera was out of focus', 'Noise, like a plane overhead, buried the words', 'The actor blinked', 'It was filmed in colour'], answer: 1, why: 'The picture is kept, and the words are re-recorded clean in a quiet booth.' },
    { q: 'Which sync error do viewers notice sooner?', options: ['Sound 60 ms early', 'Sound 60 ms late', 'Both the same', 'Neither: nobody notices under 1 s'], answer: 0, why: 'We notice sound about 45 ms early, but tolerate up to about 125 ms late, because light beats sound in real life.' },
    { q: 'What do the three beeps in an ADR loop tell the actor?', options: ['The scene is over', 'When to start: the line begins on the silent fourth beat', 'To speak louder', 'To look at the camera'], answer: 1, why: 'They count the actor in, so the first word lands exactly on the lips.' },
  ],
  reel: [
    { ms: 5600, caption: 'In ADR, actors re-voice their lines to the picture: three beeps, then speak on the fourth.', set: { reason: 'noise', off: 200, take: 'adr' }, act: (s, inst) => inst.run?.(true), anim: { off: [200, 0] }, spin: 0, view: { pos: [2.6, 2.2, 4.2], target: [0.1, 1.7, -0.9] } },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---------------------------------------------------------------- the booth: walls with acoustic foam, a window to the control room
    const floor = box(5, 0.06, 4.4, M.matte(0x2f2a33)); floor.position.set(0.3, 0.03, -0.4); root.add(floor);
    const foam = M.matte(0x3a3f4b, { roughness: 1 });
    const back = box(5.4, 3, 0.1, foam); back.position.set(0.5, 1.5, -2.6); root.add(back);
    const side = box(0.1, 3, 4.4, foam); side.position.set(-2.2, 1.5, -0.4); root.add(side);
    const wedges = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.12, 4), M.matte(0x2e323c, { roughness: 1 }), 220), o = new THREE.Object3D();
    let wi = 0;
    for (let y = 0.2; y < 2.9 && wi < 220; y += 0.25) for (let z = -2.4; z < 1.7 && wi < 220; z += 0.25) { o.position.set(-2.13, y, z); o.rotation.set(0, 0, -Math.PI / 2); o.updateMatrix(); wedges.setMatrixAt(wi++, o.matrix); }
    wedges.count = wi; root.add(wedges);
    const win = box(0.04, 0.9, 1.4, M.glass({ color: 0xbfe4ff })); win.position.set(-2.12, 1.6, 0.6); root.add(win);
    // ---------------------------------------------------------------- actor at the mic, facing the screen
    const actor = makePerson({ shirt: 0xc49bff, pants: 0x2b3242, skin: 0xc79a73 }); actor.position.set(-0.3, 0.06, 0.7); actor.rotation.y = Math.PI - 0.12; root.add(actor);
    const phones = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 8, 24, Math.PI), M.matte(0x16181d)); phones.position.set(0, 0.8, 0); phones.rotation.y = Math.PI / 2; actor.body.add(phones);
    for (const x of [-0.12, 0.12]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), M.matte(0x16181d)); cup.rotation.z = Math.PI / 2; cup.position.set(x, 0.76, 0); actor.body.add(cup); }
    const stand = stick(0.015, M.metal(0x3a3f4b)); stand.between([-0.25, 0.06, 0.05], [-0.25, 1.62, 0.05]); root.add(stand);
    const mic = new THREE.Group(); mic.position.set(-0.27, 1.62, 0.25); root.add(mic);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.2, 20), M.metal(0xb9bec8)); body.rotation.x = Math.PI / 2 - 0.3; mic.add(body);
    const grille = sphere(0.04, M.metal(0x8a919c)); grille.position.set(0, 0.03, 0.09); mic.add(grille);
    const pop = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24), M.ghost(0x111216, 0.55)); pop.position.set(0, 0.04, 0.22); mic.add(pop);
    const popRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 6, 24), M.matte(0x111216)); popRing.position.copy(pop.position); mic.add(popRing);
    // ---------------------------------------------------------------- the screen: the loop, the streamer and the beeps
    const V = voice(SEC, 8, 150), env = rmsEnv(V, 220), plane = ambience('plane', SEC + 1, 9), cue = beeps(BEEP_GAP, 3.4);
    const eMax = Math.max(...env), envAt = (u) => (u < 0 || u >= SEC ? 0 : env[Math.floor((u / SEC) * (env.length - 1))] / eMax);
    let t = 0, st = { ...DEFAULTS };
    const screen = board(root, 3.0, 1.7, 900, 510, (g, w, h) => {
      g.fillStyle = '#20252f'; g.fillRect(0, 0, w, h);
      // a generic face in a medium close-up
      g.fillStyle = '#6a4e3a'; g.beginPath(); g.ellipse(w / 2, h * 0.55, 150, 190, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a1d16'; g.beginPath(); g.ellipse(w / 2, h * 0.28, 160, 90, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1d22'; for (const x of [-55, 55]) { g.beginPath(); g.ellipse(w / 2 + x, h * 0.5, 16, 10, 0, 0, Math.PI * 2); g.fill(); }
      const open = clamp(envAt(t - LINE_AT), 0, 1);
      g.fillStyle = '#3a0f14'; g.beginPath(); g.ellipse(w / 2, h * 0.72, 50, 6 + open * 34, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#9b5a4a'; g.lineWidth = 6; g.stroke();
      // streamer: a vertical line wiping from left to right, reaching the right edge as the line starts
      const k = (t - (LINE_AT - 3 * BEEP_GAP)) / (3 * BEEP_GAP);
      if (k >= 0 && k <= 1) { g.fillStyle = 'rgba(120,255,160,.85)'; g.fillRect(k * (w - 14), 0, 14, h); }
      if (t >= LINE_AT && t < LINE_AT + 0.1) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(w / 2, h / 2, 60, 0, Math.PI * 2); g.fill(); }  // the punch
      for (let b = 0; b < 3; b++) { const tb = LINE_AT - (3 - b) * BEEP_GAP, lit = t >= tb && t < tb + 0.15; g.fillStyle = lit ? '#ffd166' : 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(w - 150 + b * 50, 40, 16, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(w - 150 + 150, 40, 16, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.4)'; g.stroke();
      text(g, `LOOP 14 · TAKE 3 · ${REASONS[st.reason].name.toUpperCase()}`, 20, 44, { font: 'bold 22px monospace', col: 'rgba(255,255,255,.75)' });
    }, [0.9, 1.75, -2.45]);
    // ---------------------------------------------------------------- the sync board: lips from the picture against the new sound
    const syncB = board(root, 2.4, 1.6, 760, 506, (g, w, h) => {
      panelBg(g, w, h);
      const ms = st.off, [msg, col] = verdict(ms);
      title(g, 'Lips (picture) against words (sound)', `${ms > 0 ? '+' : ''}${ms} ms = ${(ms / FRAME_MS).toFixed(1)} frames at 24 fps`);
      const x0 = 30, pw = w - 60, t0 = -0.4, t1 = SEC + 0.4, X = (u) => x0 + ((u - t0) / (t1 - t0)) * pw;
      // tolerance band around the zero line, drawn at the first syllable
      const lanes = [[150, 'LIPS ON SCREEN', '#7fa7ff', 0], [290, 'NEW TAKE', COL.fx, ms / 1000]];
      for (const [y, lab, c, shift] of lanes) {
        text(g, lab, x0, y - 62, { font: 'bold 15px sans-serif', col: c });
        g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath();
        for (let i = 0; i <= 300; i++) { const u = t0 + (i / 300) * (t1 - t0), v = clamp(envAt(u - shift), 0, 1.2); i ? g.lineTo(X(u), y - v * 50) : g.moveTo(X(u), y - v * 50); }
        g.stroke();
      }
      g.fillStyle = 'rgba(123,224,140,.14)'; g.fillRect(X(-0.045), 80, X(0.125) - X(-0.045), 230);
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(X(0), 80); g.lineTo(X(0), 310); g.stroke(); g.setLineDash([]);
      text(g, 'green band: −45 to +125 ms', X(-0.045), 330, { font: '15px sans-serif', col: COL.soft });
      // a meter of the offset
      const mx = (v) => x0 + ((v + 250) / 500) * pw, my = 390;
      g.fillStyle = 'rgba(255,90,138,.25)'; g.fillRect(x0, my, pw, 20);
      g.fillStyle = 'rgba(255,209,102,.35)'; g.fillRect(mx(-90), my, mx(185) - mx(-90), 20);
      g.fillStyle = 'rgba(123,224,140,.5)'; g.fillRect(mx(-45), my, mx(125) - mx(-45), 20);
      g.fillStyle = '#fff'; g.fillRect(mx(clamp(ms, -250, 250)) - 3, my - 8, 6, 36);
      for (const v of [-250, -125, 0, 125, 250]) text(g, (v > 0 ? '+' : '') + v, mx(v), my + 46, { font: '14px sans-serif', col: COL.soft, align: 'center' });
      text(g, msg, 22, h - 22, { font: 'bold 21px sans-serif', col });
    }, [3.0, 1.75, -0.9]);
    syncB.mesh.rotation.y = -0.55;
    const L = {
      screen: stage.label('The scene, looping', [0.9, 0.75, -2.45], root),
      actor: stage.label('Actor in the ADR booth', [-0.3, 2.0, 0.7], root),
      mic: stage.label('Studio mic and pop filter', [-0.3, 1.3, 0.3], root),
      win: stage.label('Window to the mixer', [-2.1, 2.2, 0.6], root),
    };

    let runAt = -1, key0 = '';
    const inst = {
      run(silent = false) {
        t = 0; runAt = 0;
        if (silent) return;
        player.stopAll();
        player.play(cue, { gain: 0.35, at: LINE_AT - 3 * BEEP_GAP - 0.1 });
        if (st.take === 'prod') { player.play(V, { gain: 0.45, at: LINE_AT, reverb: 0.3 }); player.play(plane, { gain: 0.8, at: LINE_AT - 0.5 }); }
        else player.play(V, { gain: 0.6, at: LINE_AT + st.off / 1000 });
      },
      update(dt, s) {
        dt = Math.max(0, dt); st = s; player.sync();
        const narrow = fitNarrow(stage, [L.mic, L.win], -0.12);
        reelBoards([[syncB, [0.5, 3.75, -1.6], 1.05]]);
        t += dt; if (t > LOOP) t -= LOOP;
        screen.redraw();
        // the actor speaks the new take: head nods with the sound envelope (shifted by the offset)
        const e = clamp(envAt(t - LINE_AT - s.off / 1000), 0, 1);
        actor.pose({ arm: 0.2 + 0.3 * e, armR: 0.15, open: 0.1 });
        actor.head.rotation.x = -0.05 * e;
        const kk = `${s.off}|${s.reason}`; if (kk !== key0) { key0 = kk; syncB.redraw(); }
        void narrow;
      },
      readout(s) {
        const [msg, , cls] = verdict(s.off), r = REASONS[s.reason];
        return `<div class="big">${r.name}</div>
          <div class="row"><span>Sync offset</span><b>${s.off > 0 ? '+' : ''}${s.off} ms</b></div>
          <div class="row"><span>In frames (24 fps)</span><b>${(s.off / FRAME_MS).toFixed(1)}</b></div>
          <div class="row"><span>Noticed beyond</span><b>45 ms early · 125 ms late</b></div>
          <div class="${cls}">${msg}</div>`;
      },
      dispose() { player.stopAll(); },
    };
    return inst;
  },
};
