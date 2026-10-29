// Procedural WebAudio: ambient beds per scene, SFX, optional theme / narration files.
const AUDIO_DIR = '../audio/';
const IDS = ['taipei', 'island', 'cosmos', 'continents', 'sand'];

async function exists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    if (!r.ok) return false;
    return !/text\/html/.test(r.headers.get('content-type') || '');
  } catch (e) { return false; }
}

export function createAudio() {
  let ctx = null, master = null, bedBus = null, sfxBus = null, noiseBuf = null;
  let on = false, sceneId = null, bed = null, ducked = false;
  const listeners = [];
  const emit = () => listeners.forEach((f) => f());

  const theme = { ok: false, playing: false, el: null };
  const narr = { ok: {}, playing: false, el: null, played: new Set() };

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no webaudio');
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain(); master.gain.value = 0.6;
    bedBus = ctx.createGain(); bedBus.gain.value = ducked ? 0.3 : 1;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9;
    bedBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // ---- building blocks ----
  const H = {
    noise(dest, type, freq, gain, q = 0.7) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      src.loopStart = Math.random() * 1.5;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(dest); src.start();
      return { src, f, g };
    },
    osc(dest, type, freq, gain, detune = 0) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
      const g = ctx.createGain(); g.gain.value = gain;
      o.connect(g); g.connect(dest); o.start();
      return { o, g };
    },
    lfo(param, rate, depth) {
      const o = ctx.createOscillator(); o.frequency.value = rate;
      const g = ctx.createGain(); g.gain.value = depth;
      o.connect(g); g.connect(param); o.start();
      return o;
    },
    ping(dest, freq, t, dur, vol, type = 'sine') {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    },
  };

  // Each bed returns a stop() function. `track` collects sources to stop.
  function makeBed(id, out) {
    const srcs = [], timers = [];
    const keep = (x) => { srcs.push(x.o || x.src || x); return x; };
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    if (id === 'taipei') {
      const pad = ctx.createGain(); pad.gain.value = 0.11; pad.connect(out);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 1.5; lp.connect(pad);
      for (const n of [45, 52, 57, 60, 64]) for (const dt of [-8, 8]) keep(H.osc(lp, 'sawtooth', hz(n), 0.1, dt));
      srcs.push(H.lfo(lp.frequency, 0.06, 260));
      keep(H.noise(out, 'lowpass', 190, 0.16));
      const tr = keep(H.noise(out, 'bandpass', 900, 0.02, 0.8));
      srcs.push(H.lfo(tr.g.gain, 0.11, 0.012));
      const scale = [76, 79, 81, 83, 86];
      timers.push(setInterval(() => H.ping(out, hz(scale[Math.floor(Math.random() * 5)]), ctx.currentTime + 0.05, 2.4, 0.025), 5200));
    } else if (id === 'island') {
      const w = keep(H.noise(out, 'lowpass', 700, 0.0, 0.5));
      srcs.push(H.lfo(w.g.gain, 0.11, 0.13)); w.g.gain.value = 0.14;
      const w2 = keep(H.noise(out, 'highpass', 2600, 0.0, 0.5));
      srcs.push(H.lfo(w2.g.gain, 0.17, 0.02)); w2.g.gain.value = 0.025;
      const wind = keep(H.noise(out, 'bandpass', 500, 0.05, 2));
      srcs.push(H.lfo(wind.f.frequency, 0.05, 220));
      const pent = [79, 81, 84, 86, 88, 91];
      timers.push(setInterval(() => {
        const t0 = ctx.currentTime + 0.05, k = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < k; i++) H.ping(out, hz(pent[Math.floor(Math.random() * pent.length)]), t0 + i * (0.12 + Math.random() * 0.3), 2.2, 0.035);
      }, 2300));
    } else if (id === 'cosmos') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 3;
      const g = ctx.createGain(); g.gain.value = 0.2; lp.connect(g); g.connect(out);
      for (const [f, d] of [[55, 0], [55, 6], [82.4, -5], [110, 4], [164.8, 9]]) keep(H.osc(lp, 'sawtooth', f, 0.12, d));
      srcs.push(H.lfo(lp.frequency, 0.035, 260));
      const sh = keep(H.noise(out, 'bandpass', 3200, 0.012, 6));
      srcs.push(H.lfo(sh.f.frequency, 0.05, 1500));
      timers.push(setInterval(() => H.ping(out, hz(91 + Math.floor(Math.random() * 3) * 2), ctx.currentTime + 0.05, 4, 0.02), 6500));
    } else if (id === 'continents') {
      const hp = ctx.createBiquadFilter(); hp.type = 'lowpass'; hp.frequency.value = 1400; hp.connect(out);
      const g = ctx.createGain(); g.gain.value = 0.1; g.connect(hp);
      const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [65, 69, 72, 76], [62, 65, 69, 72]];
      const voices = [0, 1, 2, 3].map((i) => keep(H.osc(g, 'triangle', hz(chords[0][i]), 0.28, i * 3 - 4)));
      let ci = 0;
      const next = () => {
        ci = (ci + 1) % chords.length;
        voices.forEach((v, i) => v.o.frequency.setTargetAtTime(hz(chords[ci][i]), ctx.currentTime, 1.2));
      };
      timers.push(setInterval(next, 6000));
      const br = keep(H.noise(out, 'bandpass', 1800, 0.03, 1.2));
      srcs.push(H.lfo(br.g.gain, 0.09, 0.02));
    } else {
      // sand: music-box arpeggio (C major pentatonic, gentle)
      const notes = [72, 76, 79, 84, 79, 76, 74, 79, 83, 86, 83, 79];
      let i = 0, nextT = ctx.currentTime + 0.2;
      const step = 0.34;
      const sched = () => {
        while (nextT < ctx.currentTime + 0.4) {
          const n = notes[i % notes.length];
          H.ping(out, hz(n), nextT, 1.5, 0.05, 'sine');
          H.ping(out, hz(n + 12), nextT, 0.5, 0.012, 'sine');
          if (i % 12 === 0) H.ping(out, hz(48), nextT, 2.5, 0.05, 'triangle');
          nextT += step; i++;
        }
      };
      sched();
      timers.push(setInterval(sched, 120));
      keep(H.noise(out, 'lowpass', 300, 0.03));
    }
    return () => {
      timers.forEach(clearInterval);
      srcs.forEach((s) => { try { s.stop(); } catch (e) { /* already stopped */ } });
    };
  }

  function startBed(id) {
    if (!ctx || !on) return;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 1);
    g.connect(bedBus);
    const stop = makeBed(id, g);
    const old = bed;
    bed = { g, stop };
    if (old) retire(old);
  }
  function retire(b) {
    const now = ctx.currentTime;
    b.g.gain.cancelScheduledValues(now);
    b.g.gain.setValueAtTime(b.g.gain.value, now);
    b.g.gain.linearRampToValueAtTime(0, now + 1);
    setTimeout(() => { b.stop(); b.g.disconnect(); }, 1200);
  }

  // ---- SFX ----
  function sfx(name) {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    if (name === 'shatter') {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t, Math.random()); src.stop(t + 0.4);
      for (let i = 0; i < 6; i++) H.ping(sfxBus, 2000 + Math.random() * 4500, t + Math.random() * 0.12, 0.08 + Math.random() * 0.15, 0.06);
    } else if (name === 'chime') {
      [784, 1175, 1568].forEach((f, i) => H.ping(sfxBus, f, t + i * 0.07, 1.3, 0.11 - i * 0.02));
    } else if (name === 'whoosh') {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2500, t + 0.3); f.frequency.exponentialRampToValueAtTime(400, t + 0.75);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t, Math.random()); src.stop(t + 0.85);
    }
  }

  // ---- public api ----
  function setOn(v) {
    if (v === on) return;
    if (v) {
      try { ensure(); } catch (e) { return; }
      ctx.resume();
      on = true;
      startBed(sceneId);
    } else {
      on = false;
      if (bed) { retire(bed); bed = null; }
      stopNarration();
    }
    emit();
  }
  function setScene(id) {
    const changed = sceneId !== null && id !== sceneId;
    sceneId = id;
    stopNarration();
    if (on) { startBed(id); if (changed) sfx('whoosh'); }
    emit();
  }
  function duck(flag) {
    ducked = flag;
    if (ctx) bedBus.gain.setTargetAtTime(flag ? 0.3 : 1, ctx.currentTime, 0.3);
  }

  function toggleTheme() {
    if (!theme.ok) return;
    if (theme.playing) { theme.el.pause(); }
    else theme.el.play().catch(() => { theme.playing = false; duck(false); emit(); });
  }
  function playNarration(id = sceneId) {
    if (!narr.ok[id]) return;
    stopNarration(true);
    narr.el.src = `${AUDIO_DIR}world-${id}.mp3`;
    narr.played.add(id);
    narr.el.play().catch(() => { narr.playing = false; emit(); });
  }
  function stopNarration(silent) {
    if (narr.el && narr.playing) { narr.el.pause(); }
    narr.playing = false;
    if (!silent) emit();
  }
  function toggleNarration() { if (narr.playing) stopNarration(); else playNarration(); }
  // Auto-play once per scene, only when sound is on.
  function autoNarrate() {
    if (on && narr.ok[sceneId] && !narr.played.has(sceneId)) playNarration(sceneId);
  }

  async function probe() {
    theme.el = new Audio(); theme.el.preload = 'none'; theme.el.loop = true; theme.el.volume = 0.7;
    theme.el.addEventListener('play', () => { theme.playing = true; duck(true); emit(); });
    theme.el.addEventListener('pause', () => { theme.playing = false; duck(false); emit(); });
    theme.el.addEventListener('error', () => { theme.ok = false; theme.playing = false; duck(false); emit(); });
    narr.el = new Audio(); narr.el.preload = 'none'; narr.el.volume = 0.9;
    narr.el.addEventListener('play', () => { narr.playing = true; emit(); });
    narr.el.addEventListener('pause', () => { narr.playing = false; emit(); });
    narr.el.addEventListener('ended', () => { narr.playing = false; emit(); });
    narr.el.addEventListener('error', () => { if (narr.el.getAttribute('src')) { narr.playing = false; narr.ok[sceneId] = false; emit(); } });
    theme.el.src = `${AUDIO_DIR}theme.mp3`;
    const [t, ...n] = await Promise.all([exists(`${AUDIO_DIR}theme.mp3`), ...IDS.map((id) => exists(`${AUDIO_DIR}world-${id}.mp3`))]);
    theme.ok = t;
    IDS.forEach((id, i) => { narr.ok[id] = n[i]; });
    emit();
    autoNarrate();
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (on) ctx.resume();
  });

  return {
    sfx, setOn, setScene, probe, toggleTheme, toggleNarration, autoNarrate,
    onChange: (f) => listeners.push(f),
    get on() { return on; },
    get themeOk() { return theme.ok; },
    get themePlaying() { return theme.playing; },
    narrOk: (id) => !!narr.ok[id],
    get narrPlaying() { return narr.playing; },
  };
}
