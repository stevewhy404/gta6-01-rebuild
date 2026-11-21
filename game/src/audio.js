// Solmar Bay — synthesized sound: no audio files, everything is WebAudio.
// Engine hum, sirens, gunshots, pickups and a slow bass groove, all generated.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;
  let musicTimer = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(master);
      engineOsc.start();
      // Siren: square wave alternating 700 / 950 Hz.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      started = true;
      return true;
    } catch (e) { return false; }
  }

  function noiseBurst(dur, freq, vol) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start();
  }

  function blip(freq, dur, vol, type = 'sine') {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    setEngine(speedRatio, inCar) {
      if (!ctx || muted) { if (engineGain) engineGain.gain.value = 0; return; }
      if (!started) return;
      engineOsc.frequency.value = 55 + speedRatio * 160;
      engineFilter.frequency.value = 300 + speedRatio * 900;
      engineGain.gain.value = inCar ? 0.05 + speedRatio * 0.06 : 0;
    },
    setSiren(on, dt) {
      if (!ctx || !started) return;
      sirenTimer += dt;
      if (sirenTimer > 0.42) { sirenTimer = 0; sirenHigh = !sirenHigh; }
      sirenGain.gain.value = (on && !muted) ? 0.045 : 0;
      sirenOsc.frequency.value = sirenHigh ? 950 : 700;
    },
    shoot() { noiseBurst(0.09, 1800, 0.35); blip(220, 0.06, 0.15, 'square'); },
    enemyShoot() { noiseBurst(0.08, 1200, 0.18); },
    crash() { noiseBurst(0.25, 500, 0.5); },
    pickup() { blip(660, 0.12, 0.25); setTimeout(() => blip(990, 0.18, 0.25), 90); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 0.3), i * 110)); },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 0.3, 'triangle'), i * 160)); },
    honk() { blip(370, 0.18, 0.25, 'square'); setTimeout(() => blip(370, 0.18, 0.25, 'square'), 200); },
    door() { noiseBurst(0.08, 900, 0.2); },
    startMusic() {
      if (!ctx || musicTimer) return;
      // Slow sunset groove: bass line + soft pad, scheduled in 8th notes.
      const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
      let step = 0;
      musicTimer = setInterval(() => {
        if (muted || !ctx) return;
        const f = bass[step % bass.length];
        if (f) blip(f, 0.32, 0.12, 'triangle');
        if (step % 8 === 0) blip(220, 0.9, 0.03, 'sine');
        step++;
      }, 300);
    },
  };
}
