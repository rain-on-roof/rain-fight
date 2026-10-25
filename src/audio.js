// All sound is synthesised: rain, thunder, hits, specials and stingers. The
// context starts on the first user gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;
  let rainGain = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 5;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startRain();
  }

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }

  function burst({ t, dur, type = 'lowpass', freq = 1000, q = 0.8, peak = 0.5, attack = 0.003, sweepTo }) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, attack, peak, dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random(), attack + dur + 0.05);
  }

  function tone({ t, type = 'sine', from, to = from, dur, peak = 0.3, attack = 0.004 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + dur);
    const g = ctx.createGain();
    env(g, t, attack, peak, dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  function honk(t, from, to, dur, peak) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1100;
    band.Q.value = 2.2;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 3);
    shaper.curve = curve;
    const g = ctx.createGain();
    env(g, t, 0.02, peak, dur);
    shaper.connect(band).connect(g).connect(master);
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

  const SOUNDS = {
    whoosh(t) {
      burst({ t, dur: 0.12, type: 'bandpass', freq: 500, q: 1.1, peak: 0.18, attack: 0.03, sweepTo: 2200 });
    },
    hit(t) {
      tone({ t, from: 180, to: 60, dur: 0.12, peak: 0.7 });
      burst({ t, dur: 0.07, type: 'lowpass', freq: 2500, peak: 0.6 });
    },
    heavy(t) {
      tone({ t, from: 140, to: 40, dur: 0.22, peak: 0.9 });
      burst({ t, dur: 0.12, type: 'lowpass', freq: 1800, peak: 0.8 });
      burst({ t: t + 0.01, dur: 0.05, type: 'highpass', freq: 3000, peak: 0.3 });
    },
    block(t) {
      tone({ t, type: 'square', from: 900, to: 700, dur: 0.05, peak: 0.12 });
      burst({ t, dur: 0.05, type: 'highpass', freq: 2500, peak: 0.35 });
    },
    jump(t) {
      burst({ t, dur: 0.08, type: 'bandpass', freq: 900, peak: 0.12, sweepTo: 1800 });
    },
    land(t) {
      burst({ t, dur: 0.08, type: 'lowpass', freq: 400, peak: 0.3 });
    },
    fall(t) {
      tone({ t, from: 90, to: 40, dur: 0.25, peak: 0.6 });
      burst({ t, dur: 0.2, type: 'lowpass', freq: 600, peak: 0.6 });
      burst({ t: t + 0.05, dur: 0.3, type: 'highpass', freq: 4000, peak: 0.15 });
    },
    zap(t) {
      tone({ t, type: 'sawtooth', from: 1800, to: 200, dur: 0.25, peak: 0.25 });
      burst({ t, dur: 0.25, type: 'highpass', freq: 3000, peak: 0.3 });
    },
    slam(t) {
      tone({ t, from: 120, to: 30, dur: 0.6, peak: 1 });
      burst({ t, dur: 0.4, type: 'lowpass', freq: 900, peak: 0.9 });
    },
    teleport(t) {
      burst({ t, dur: 0.25, type: 'bandpass', freq: 3000, q: 2, peak: 0.25, sweepTo: 300 });
      tone({ t, type: 'triangle', from: 1200, to: 300, dur: 0.2, peak: 0.12 });
    },
    honk(t) {
      honk(t, 420, 260, 0.55, 0.9);
    },
    ko(t) {
      tone({ t, from: 100, to: 25, dur: 1.2, peak: 1 });
      burst({ t, dur: 0.6, type: 'lowpass', freq: 1200, peak: 0.9 });
      [220, 165, 110].forEach((f, i) => tone({ t: t + 0.1 + i * 0.18, type: 'sawtooth', from: f, to: f * 0.97, dur: 0.4, peak: 0.18 }));
    },
    round(t) {
      for (let i = 0; i < 3; i++) {
        tone({ t: t + i * 0.13, from: 90, to: 50, dur: 0.14, peak: 0.7 });
        burst({ t: t + i * 0.13, dur: 0.06, type: 'highpass', freq: 5000, peak: 0.25 });
      }
    },
    fight(t) {
      tone({ t, from: 70, to: 30, dur: 0.5, peak: 1 });
      [330, 415, 494, 659].forEach((f, i) => tone({ t: t + i * 0.03, type: 'sawtooth', from: f, dur: 0.45, peak: 0.12 }));
      burst({ t, dur: 0.3, type: 'highpass', freq: 3000, peak: 0.4 });
    },
    endIt(t) {
      [196, 185, 175].forEach((f, i) => tone({ t: t + i * 0.35, type: 'sawtooth', from: f, to: f * 0.98, dur: 0.32, peak: 0.25 }));
      tone({ t, from: 60, to: 30, dur: 1.2, peak: 0.8 });
    },
    finisher(t) {
      tone({ t, from: 50, to: 25, dur: 1.4, peak: 1 });
      [262, 330, 392, 523].forEach((f, i) => tone({ t: t + 0.6 + i * 0.07, type: 'sawtooth', from: f, dur: 0.6, peak: 0.14 }));
    },
    thunder(t) {
      burst({ t, dur: 1.8, type: 'lowpass', freq: 380, q: 0.5, peak: 0.9, attack: 0.02 });
      burst({ t: t + 0.05, dur: 0.25, type: 'lowpass', freq: 1600, peak: 0.6 });
    },
    ui(t) {
      tone({ t, type: 'triangle', from: 660, to: 990, dur: 0.06, peak: 0.15 });
    },
    select(t) {
      tone({ t, type: 'square', from: 220, to: 880, dur: 0.18, peak: 0.12 });
      burst({ t, dur: 0.2, type: 'highpass', freq: 2000, peak: 0.2 });
    },
  };

  function startRain() {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    f.Q.value = 0.4;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0.07;
    s.connect(f).connect(rainGain).connect(master);
    s.start();
  }

  return {
    unlock,
    play(name, delay = 0) {
      if (!ctx || muted || !SOUNDS[name]) return;
      SOUNDS[name](ctx.currentTime + 0.005 + delay);
    },
    setMuted(v) {
      muted = v;
      if (master) master.gain.setTargetAtTime(v ? 0 : 0.85, ctx.currentTime, 0.03);
    },
    get muted() {
      return muted;
    },
  };
}
