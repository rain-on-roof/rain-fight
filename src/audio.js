// All sound is synthesised: two music tracks, stingers, fight sounds, rain
// and thunder. Nothing is downloaded. The context starts on the first user
// gesture, as browsers require; a track asked for before then starts with it.
//
// Routing: sfx → sfxBus ─┐
//          music → musicBus ─┼→ master → compressor → out
//          reverb (rooftop) ─┘
// The music ducks under heavy hits, like a sidechain.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let reverb = null;
  let delay = null;
  let noise = null;
  let muted = false; // the player's mute button
  let hostMuted = false; // the portal's say: ads, tab switches
  let paused = false;
  let wanted = null;
  const music = { track: null, step: 0, next: 0, timer: 0, intensity: 0 };
  const MUSIC_LEVEL = 0.42;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted || hostMuted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    master.connect(comp).connect(ctx.destination);

    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_LEVEL;
    musicBus.connect(master);

    // A short, bright rooftop reverb from decaying noise.
    reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
    }
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    reverb.connect(wet).connect(master);

    // Dotted-eighth echo for cowbells and arps.
    delay = ctx.createDelay(1);
    const fb = ctx.createGain();
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 2600;
    fb.gain.value = 0.32;
    delay.connect(dl).connect(fb).connect(delay);
    const dWet = ctx.createGain();
    dWet.gain.value = 0.5;
    dl.connect(dWet).connect(musicBus);

    startRain();
    if (wanted) startTrack(wanted);
  }

  /* ---------- building blocks ---------- */

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }

  function send(node, { bus = sfxBus, rev = 0, echo = 0 } = {}) {
    node.connect(bus);
    if (rev) {
      const g = ctx.createGain();
      g.gain.value = rev;
      node.connect(g).connect(reverb);
    }
    if (echo) {
      const g = ctx.createGain();
      g.gain.value = echo;
      node.connect(g).connect(delay);
    }
  }

  function burst({ t, dur, type = 'lowpass', freq = 1000, q = 0.8, peak = 0.5, attack = 0.002, sweepTo, ...route }) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, attack, peak, dur);
    s.connect(f).connect(g);
    send(g, route);
    s.start(t, Math.random() * 1.5, attack + dur + 0.05);
  }

  function tone({ t, type = 'sine', from, to = from, dur, peak = 0.3, attack = 0.003, detune = 0, drive = 0, cutoff = 0, ...route }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + dur);
    let node = o;
    if (drive) {
      const sh = ctx.createWaveShaper();
      sh.curve = curve(drive);
      node = node.connect(sh);
    }
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      node = node.connect(f);
    }
    const g = ctx.createGain();
    env(g, t, attack, peak, dur);
    node.connect(g);
    send(g, route);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  const curves = {};
  function curve(k) {
    if (curves[k]) return curves[k];
    const c = new Float32Array(512);
    for (let i = 0; i < 512; i++) c[i] = Math.tanh((i / 256 - 1) * k);
    return (curves[k] = c);
  }

  const vary = (x, amt = 0.08) => x * (1 + (Math.random() * 2 - 1) * amt);

  function honk(t, from, to, dur, peak) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1100;
    band.Q.value = 2.2;
    const shaper = ctx.createWaveShaper();
    shaper.curve = curve(3);
    const g = ctx.createGain();
    env(g, t, 0.02, peak, dur);
    shaper.connect(band).connect(g);
    send(g, { rev: 0.4 });
    for (const detune of [0, 9, -7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 9;
      depth.gain.value = from * 0.05;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
      o.connect(shaper);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  function duck(t, depth = 0.35, hold = 0.12) {
    if (!musicBus || !music.track) return;
    const g = musicBus.gain;
    const level = paused ? MUSIC_LEVEL * 0.3 : MUSIC_LEVEL;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level * depth, t + 0.01);
    g.setTargetAtTime(level, t + hold, 0.12);
  }

  /* ---------- fight sounds ---------- */

  // A punch is three layers: the thump of a body, the slap of skin, the crack
  // of the transient. Every one is pitched a little differently.
  function impact(t, weight) {
    const p = vary(1, 0.1);
    tone({ t, from: 170 * p, to: 48, dur: 0.1 + weight * 0.14, peak: 0.75 + weight * 0.25, drive: 2 + weight * 2, rev: 0.12 + weight * 0.15 });
    burst({ t, dur: 0.05 + weight * 0.04, type: 'bandpass', freq: vary(1400), q: 0.9, peak: 0.7, rev: 0.1 });
    burst({ t, dur: 0.018, type: 'highpass', freq: 4500, peak: 0.5 + weight * 0.2 });
    if (weight > 0.5) {
      // Heavy: a sub boom and a crunch.
      tone({ t, from: 75, to: 32, dur: 0.38, peak: 0.9 });
      burst({ t: t + 0.006, dur: 0.14, type: 'lowpass', freq: 2600, sweepTo: 300, peak: 0.6, rev: 0.25 });
      duck(t, 0.3, 0.16);
    }
  }

  const SOUNDS = {
    whoosh(t) {
      burst({ t, dur: vary(0.11), type: 'bandpass', freq: vary(380), q: 1.4, peak: 0.22, attack: 0.035, sweepTo: vary(2600) });
    },
    hit(t) {
      impact(t, 0.25);
    },
    heavy(t) {
      impact(t, 1);
    },
    block(t) {
      // Forearms: a dull knock with a hard click on top.
      tone({ t, from: vary(260), to: 180, dur: 0.07, peak: 0.45, drive: 1.5 });
      tone({ t, type: 'triangle', from: vary(1700), to: 1500, dur: 0.05, peak: 0.12 });
      burst({ t, dur: 0.035, type: 'highpass', freq: 3200, peak: 0.4, rev: 0.12 });
    },
    jump(t) {
      burst({ t, dur: 0.09, type: 'bandpass', freq: 700, peak: 0.13, attack: 0.02, sweepTo: 1700 });
    },
    land(t) {
      tone({ t, from: 110, to: 60, dur: 0.07, peak: 0.35 });
      burst({ t, dur: 0.06, type: 'lowpass', freq: 500, peak: 0.3 });
      burst({ t: t + 0.01, dur: 0.12, type: 'highpass', freq: 5000, peak: 0.07 });
    },
    fall(t) {
      tone({ t, from: 95, to: 38, dur: 0.32, peak: 0.85, drive: 2 });
      burst({ t, dur: 0.22, type: 'lowpass', freq: 700, peak: 0.7, rev: 0.25 });
      // Splash on the wet roof.
      burst({ t: t + 0.03, dur: 0.35, type: 'highpass', freq: 3500, peak: 0.22, sweepTo: 7000 });
      duck(t, 0.4, 0.2);
    },
    zap(t) {
      tone({ t, type: 'sawtooth', from: 2200, to: 180, dur: 0.28, peak: 0.24, drive: 3, rev: 0.3 });
      tone({ t, type: 'square', from: 90, to: 60, dur: 0.25, peak: 0.2 });
      burst({ t, dur: 0.3, type: 'highpass', freq: 2800, peak: 0.35 });
      for (let i = 0; i < 5; i++) burst({ t: t + i * 0.035, dur: 0.02, type: 'bandpass', freq: 5000, q: 3, peak: 0.25 });
    },
    slam(t) {
      tone({ t, from: 120, to: 28, dur: 0.7, peak: 1, drive: 2.5, rev: 0.4 });
      burst({ t, dur: 0.45, type: 'lowpass', freq: 1100, sweepTo: 200, peak: 1, rev: 0.4 });
      burst({ t: t + 0.02, dur: 0.4, type: 'bandpass', freq: 2500, q: 0.6, peak: 0.25 });
      duck(t, 0.2, 0.3);
    },
    teleport(t) {
      burst({ t, dur: 0.28, type: 'bandpass', freq: 3200, q: 2, peak: 0.3, sweepTo: 250, rev: 0.4 });
      tone({ t, type: 'sine', from: 1600, to: 200, dur: 0.22, peak: 0.16, echo: 0.3, bus: sfxBus });
    },
    honk(t) {
      honk(t, 420, 260, 0.55, 0.95);
      duck(t, 0.25, 0.4);
    },
    ko(t) {
      tone({ t, from: 110, to: 24, dur: 1.4, peak: 1, drive: 2, rev: 0.5 });
      burst({ t, dur: 0.7, type: 'lowpass', freq: 1400, sweepTo: 150, peak: 0.9, rev: 0.5 });
      [220, 165, 110].forEach((f, i) => tone({ t: t + 0.12 + i * 0.2, type: 'sawtooth', from: f, to: f * 0.97, dur: 0.45, peak: 0.16, cutoff: 1800, rev: 0.4 }));
      duck(t, 0.05, 1.2);
    },
    round(t) {
      // Taiko-ish triple hit.
      for (let i = 0; i < 3; i++) {
        tone({ t: t + i * 0.14, from: 95, to: 48, dur: 0.18, peak: 0.85, drive: 1.5, rev: 0.4 });
        burst({ t: t + i * 0.14, dur: 0.05, type: 'highpass', freq: 4500, peak: 0.25 });
      }
    },
    fight(t) {
      tone({ t, from: 75, to: 30, dur: 0.6, peak: 1, drive: 2, rev: 0.5 });
      [330, 415, 494, 659].forEach((f, i) => tone({ t: t + i * 0.025, type: 'sawtooth', from: f, dur: 0.5, peak: 0.11, cutoff: 3000, rev: 0.5 }));
      burst({ t, dur: 0.45, type: 'highpass', freq: 3000, peak: 0.45, rev: 0.3 });
    },
    endIt(t) {
      [196, 185, 175].forEach((f, i) => tone({ t: t + i * 0.38, type: 'sawtooth', from: f, to: f * 0.98, dur: 0.34, peak: 0.24, cutoff: 1500, rev: 0.5 }));
      tone({ t, from: 60, to: 30, dur: 1.4, peak: 0.85, rev: 0.4 });
      // A heartbeat under the window.
      for (let i = 0; i < 4; i++) {
        tone({ t: t + 0.5 + i * 0.75, from: 70, to: 40, dur: 0.12, peak: 0.7 });
        tone({ t: t + 0.68 + i * 0.75, from: 60, to: 38, dur: 0.14, peak: 0.55 });
      }
    },
    finisher(t) {
      tone({ t, from: 55, to: 25, dur: 1.5, peak: 1, drive: 2, rev: 0.5 });
      burst({ t, dur: 1.2, type: 'highpass', freq: 2500, peak: 0.3, sweepTo: 9000, rev: 0.4 });
      [262, 330, 392, 523].forEach((f, i) => tone({ t: t + 0.6 + i * 0.07, type: 'sawtooth', from: f, dur: 0.6, peak: 0.13, cutoff: 3200, rev: 0.4 }));
    },
    thunder(t) {
      burst({ t, dur: 2, type: 'lowpass', freq: 380, q: 0.5, peak: 0.85, attack: 0.02, rev: 0.4 });
      burst({ t: t + 0.05, dur: 0.25, type: 'lowpass', freq: 1700, peak: 0.6 });
    },
    ui(t) {
      tone({ t, type: 'triangle', from: 660, to: 990, dur: 0.06, peak: 0.16 });
    },
    select(t) {
      tone({ t, type: 'square', from: 220, to: 880, dur: 0.18, peak: 0.11, cutoff: 3000 });
      burst({ t, dur: 0.25, type: 'highpass', freq: 2000, peak: 0.22, rev: 0.4 });
      tone({ t, from: 90, to: 45, dur: 0.25, peak: 0.6 });
    },
    // Stingers that end a match.
    victory(t) {
      const bpm = 0.11;
      const brass = (n, at, dur, peak = 0.13) => {
        for (const dt of [-8, 8]) tone({ t: t + at, type: 'sawtooth', from: midi(n), dur, peak, detune: dt, cutoff: 2600, attack: 0.02, rev: 0.4, bus: musicBus });
      };
      [67, 67, 67].forEach((n, i) => brass(n, i * bpm, 0.08));
      brass(72, 3 * bpm, 0.18);
      brass(71, 5 * bpm, 0.1);
      brass(72, 6 * bpm, 0.1);
      [72, 76, 79, 84].forEach((n) => brass(n, 7 * bpm, 1.3, 0.09));
      tone({ t: t + 7 * bpm, from: 120, to: 40, dur: 0.6, peak: 1, drive: 2 });
      burst({ t: t + 7 * bpm, dur: 1.6, type: 'highpass', freq: 5000, peak: 0.35, rev: 0.4 });
      [0, 3, 6].forEach((s) => tone({ t: t + s * bpm, from: 120, to: 50, dur: 0.12, peak: 0.6 }));
    },
    defeat(t) {
      // Sad trombone: wah, wah, wah, waaah.
      const notes = [[58, 0, 0.42], [57, 0.48, 0.42], [56, 0.96, 0.42], [55, 1.44, 1.3]];
      for (const [n, at, dur] of notes) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(midi(n), t + at);
        if (dur > 1) {
          const lfo = ctx.createOscillator();
          const dg = ctx.createGain();
          lfo.frequency.value = 5.5;
          dg.gain.value = midi(n) * 0.025;
          lfo.connect(dg).connect(o.frequency);
          lfo.start(t + at + 0.2);
          lfo.stop(t + at + dur);
        }
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 6;
        f.frequency.setValueAtTime(300, t + at);
        f.frequency.exponentialRampToValueAtTime(1400, t + at + 0.12);
        f.frequency.exponentialRampToValueAtTime(400, t + at + dur);
        const g = ctx.createGain();
        env(g, t + at, 0.03, 0.3, dur);
        o.connect(f).connect(g);
        send(g, { bus: musicBus, rev: 0.3 });
        o.start(t + at);
        o.stop(t + at + dur + 0.1);
      }
    },
  };

  /* ---------- music ---------- */

  const drum = {
    kick(t, v = 1) {
      tone({ t, from: 165, to: 44, dur: 0.24, peak: 0.95 * v, drive: 1.6, bus: musicBus });
      burst({ t, dur: 0.012, type: 'highpass', freq: 3000, peak: 0.25 * v, bus: musicBus });
    },
    clap(t, v = 1) {
      for (let i = 0; i < 3; i++) burst({ t: t + i * 0.011, dur: 0.02, type: 'bandpass', freq: 1500, q: 1.2, peak: 0.45 * v, bus: musicBus });
      burst({ t: t + 0.033, dur: 0.16, type: 'bandpass', freq: 1300, q: 0.9, peak: 0.4 * v, bus: musicBus, rev: 0.35 });
      tone({ t, from: 220, to: 170, dur: 0.07, peak: 0.25 * v, bus: musicBus });
    },
    hat(t, v = 1, open = false) {
      burst({ t, dur: open ? 0.16 : 0.03, type: 'highpass', freq: 7500, peak: 0.16 * v, bus: musicBus });
    },
    // The TR-808 cowbell: two square waves a fifth-ish apart, band-passed.
    cowbell(t, note, v = 1) {
      const f0 = midi(note);
      const g = ctx.createGain();
      env(g, t, 0.002, 0.26 * v, 0.28);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f0 * 2.2;
      bp.Q.value = 1.4;
      bp.connect(g);
      send(g, { bus: musicBus, echo: 0.35, rev: 0.15 });
      for (const r of [1, 1.4836]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f0 * r;
        o.connect(bp);
        o.start(t);
        o.stop(t + 0.32);
      }
    },
    // A distorted 808 with an optional glide into the next note.
    sub(t, note, dur, glideTo) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(midi(note), t);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(midi(glideTo), t + dur * 0.9);
      const sh = ctx.createWaveShaper();
      sh.curve = curve(2.6);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.005);
      g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.2);
      o.connect(sh).connect(lp).connect(g);
      send(g, { bus: musicBus });
      o.start(t);
      o.stop(t + dur + 0.3);
    },
    pluck(t, note, v = 1, type = 'sawtooth', len = 0.18) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midi(note);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(4200, t);
      f.frequency.exponentialRampToValueAtTime(500, t + len);
      f.Q.value = 3;
      const g = ctx.createGain();
      env(g, t, 0.003, 0.12 * v, len);
      o.connect(f).connect(g);
      send(g, { bus: musicBus, echo: 0.4, rev: 0.2 });
      o.start(t);
      o.stop(t + len + 0.05);
    },
    pad(t, notes, dur, v = 1) {
      for (const n of notes) {
        for (const dt of [-11, 11]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.detune.value = dt;
          o.frequency.value = midi(n);
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 1100;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.035 * v, t + dur * 0.3);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(f).connect(g);
          send(g, { bus: musicBus, rev: 0.4 });
          o.start(t);
          o.stop(t + dur + 0.05);
        }
      }
    },
  };

  // FIGHT: drift phonk, 144 bpm, A minor. Bars 0-3 are the intro and never
  // repeat; then a 16-bar loop: drop, then drop with a lead on top.
  const _ = null;
  const BELLS = [
    81, _, _, 84, _, _, 81, _, 88, _, 86, _, 84, _, 81, _,
    79, _, _, 81, _, _, 84, _, 86, _, 84, _, 81, _, 79, _,
  ];
  const BASS = [45, 41, 43, 40]; // A F G E, one per bar
  const LEAD = [
    69, _, 72, _, 76, _, 74, 72, _, 69, _, 67, 69, _, _, _,
    72, _, 74, _, 76, _, 79, 76, _, 74, _, 72, 74, _, 71, _,
  ];
  const fight = {
    bpm: 144,
    loopFrom: 4 * 16,
    loopLen: 16 * 16,
    play(step, t, intensity) {
      const s = step % 16;
      const bar = Math.floor(step / 16);
      const intro = bar < 4;
      const lead = !intro && ((bar - 4) % 16) >= 8;
      const bell = BELLS[step % 32];
      if (bell) drum.cowbell(t, bell, intro ? 0.8 : 1);
      if (s % 2 === 0) drum.hat(t, s % 4 === 2 ? 1 : 0.6);
      else if (intensity > 0 || (bar % 4 === 3 && s > 11)) drum.hat(t, 0.45);
      if (intro) {
        if (bar === 3 && s >= 8 && s % 2 === 0) drum.clap(t, 0.4 + (s - 8) * 0.08);
        return;
      }
      if (s === 0 || s === 6 || s === 10 || (intensity > 0 && s === 13)) drum.kick(t);
      if (s === 4 || s === 12) drum.clap(t);
      if (s === 14 && bar % 2) drum.hat(t, 0.7, true);
      const root = BASS[bar % 4];
      if (s === 0) drum.sub(t, root - 12, 0.62);
      if (s === 6) drum.sub(t, root - 12, 0.25);
      if (s === 10) drum.sub(t, root - 12, 0.62, BASS[(bar + 1) % 4] - 12);
      if (lead) {
        const n = LEAD[step % 32];
        if (n) drum.pluck(t, n, 1, 'sawtooth', 0.22);
      }
    },
  };

  // MENU: slow darksynth, 96 bpm. Pads, an arpeggio, a heavy half-time beat.
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const menu = {
    bpm: 96,
    loopFrom: 0,
    loopLen: 16 * 16,
    play(step, t) {
      const s = step % 16;
      const bar = Math.floor(step / 16);
      const ch = CHORDS[bar % 4];
      if (s === 0) drum.pad(t, ch.map((n) => n + 12), (60 / 96) * 4 + 0.3, 1);
      const arp = [0, 1, 2, 1, 2, 0, 1, 2];
      drum.pluck(t, ch[arp[s % 8]] + 24 + (s >= 8 && bar % 2 ? 12 : 0), 0.55, 'triangle', 0.16);
      if (bar >= 2) {
        if (s === 0 || s === 10) drum.kick(t, 0.8);
        if (s === 8) drum.clap(t, 0.7);
        if (s % 4 === 2) drum.hat(t, 0.5);
        if (s === 0) drum.sub(t, ch[0] - 24, 1.4);
      }
    },
  };

  const TRACKS = { fight, menu };

  function startTrack(name) {
    const tr = TRACKS[name];
    if (!tr || !ctx) return;
    if (music.track === tr) return;
    music.track = tr;
    music.step = 0;
    music.next = ctx.currentTime + 0.08;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(paused ? MUSIC_LEVEL * 0.3 : MUSIC_LEVEL, ctx.currentTime);
    if (!music.timer) music.timer = setInterval(tick, 25);
  }

  function tick() {
    const tr = music.track;
    if (!tr || !ctx) return;
    if (ctx.state !== 'running') {
      music.next = ctx.currentTime + 0.05;
      return;
    }
    const stepDur = 60 / tr.bpm / 4;
    if (music.next < ctx.currentTime - 0.2) music.next = ctx.currentTime + 0.02;
    while (music.next < ctx.currentTime + 0.14) {
      let step = music.step;
      if (step >= tr.loopFrom + tr.loopLen) step = music.step = tr.loopFrom;
      if (!muted && !hostMuted) tr.play(step, music.next, music.intensity);
      music.next += stepDur;
      music.step += 1;
    }
  }

  function stopTrack(fade = 0.5) {
    wanted = null;
    if (!ctx || !music.track) return;
    music.track = null;
    const g = musicBus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
    // Restore the level for stingers once the tail has faded.
    g.setValueAtTime(MUSIC_LEVEL, ctx.currentTime + fade + 0.05);
  }

  function applyGain() {
    if (master) master.gain.setTargetAtTime(muted || hostMuted ? 0 : 0.9, ctx.currentTime, 0.03);
  }

  /* ---------- rain ---------- */

  function startRain() {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    f.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    s.connect(f).connect(g).connect(master);
    s.start();
  }

  return {
    unlock,
    play(name, delay = 0) {
      if (!ctx || muted || hostMuted || !SOUNDS[name]) return;
      SOUNDS[name](ctx.currentTime + 0.005 + delay);
    },
    // music('fight' | 'menu' | null)
    music(name) {
      if (!name) return stopTrack();
      wanted = name;
      if (ctx) startTrack(name);
    },
    // 0 = normal, 1 = final round: busier drums.
    set intensity(v) {
      music.intensity = v;
    },
    setPaused(v) {
      paused = v;
      if (musicBus && music.track) musicBus.gain.setTargetAtTime(v ? MUSIC_LEVEL * 0.3 : MUSIC_LEVEL, ctx.currentTime, 0.1);
    },
    setMuted(v) {
      muted = v;
      applyGain();
    },
    setHostMuted(v) {
      hostMuted = v;
      applyGain();
    },
    // The host paused the game: freeze the clock, so music picks up where it stopped.
    setSuspended(v) {
      if (!ctx) return;
      if (v) ctx.suspend();
      else ctx.resume();
    },
    get muted() {
      return muted;
    },
  };
}
