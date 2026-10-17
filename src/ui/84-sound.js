// ═══════════════════════════════════════════════════════════════════
//  Emergence · the sound of the drop: a soft drone that follows the
//  seasons and the sun, and small voices for births, deaths and wrath
// ═══════════════════════════════════════════════════════════════════
class Sound {
  constructor(app) { this.app = app; this.on = false; this.ac = null; this.tokens = 2; this.lastSeason = ''; this.lastT = 0; }
  toggle() { this.on ? this.stop() : this.start(); }
  start() {
    try { this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { this.app.shell.toast({ kind: 'note', text: 'Sound is not available in this browser.' }, true); return; }
    const ac = this.ac;
    if (ac.resume) ac.resume().catch(() => {});
    if (!this.master) this.build();
    this.master.gain.cancelScheduledValues(ac.currentTime);
    this.master.gain.setTargetAtTime(0.5, ac.currentTime, 1.2);
    this.on = true; this.mark();
  }
  stop() {
    if (!this.ac) return;
    this.master.gain.setTargetAtTime(0, this.ac.currentTime, 0.4);
    this.on = false; this.mark();
  }
  mark() { for (const b of [$('#soundBtn'), $('#mSoundBtn')]) if (b) { b.classList.toggle('on', this.on); b.setAttribute('aria-pressed', this.on ? 'true' : 'false'); b.title = this.on ? 'Silence the universe (S)' : 'Listen to the universe (S)'; } }

  build() {
    const ac = this.ac;
    this.master = ac.createGain(); this.master.gain.value = 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(ac.destination);
    // a cathedral of water: generated impulse response
    const len = Math.floor(ac.sampleRate * 3.2), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = ac.createConvolver(); this.verb.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.55; this.verb.connect(wet); wet.connect(this.master);
    this.dry = ac.createGain(); this.dry.gain.value = 0.7; this.dry.connect(this.master);
    // the drone: four slow voices through one breathing filter
    this.filter = ac.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 500; this.filter.Q.value = 0.6;
    const dg = ac.createGain(); dg.gain.value = 0.16; this.filter.connect(dg); dg.connect(this.dry); dg.connect(this.verb);
    this.drone = [];
    for (let k = 0; k < 4; k++) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = k === 0 ? 'triangle' : 'sine'; o.frequency.value = 110; o.detune.value = (k - 1.5) * 4;
      g.gain.value = [0.5, 0.32, 0.26, 0.16][k];
      o.connect(g); g.connect(this.filter); o.start();
      this.drone.push(o);
    }
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.04; lg.gain.value = 140; lfo.connect(lg); lg.connect(this.filter.frequency); lfo.start();
  }
  scale() {
    const s = this.app.u.season;
    const root = { Spring: 50, Summer: 52, Autumn: 48, Winter: 45 }[s] || 50;
    const mode = s === 'Spring' || s === 'Summer' ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10];
    return { root, mode };
  }
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  update(dt) {
    if (!this.on || !this.ac) return;
    const ac = this.ac, u = this.app.u, r = this.app.r;
    this.tokens = Math.min(3, this.tokens + dt * 1.6);
    if (u.season !== this.lastSeason) {
      this.lastSeason = u.season;
      const { root, mode } = this.scale(), notes = [root - 12, root - 5, root, root + mode[2]];
      this.drone.forEach((o, i) => o.frequency.setTargetAtTime(this.hz(notes[i]), ac.currentTime, 4));
    }
    // brighter when the camera looks at sunlit water
    const w = u.world, L = w.light[w.cellOf(r.cam.x, r.cam.y)] / Math.max(0.1, u.laws.sun);
    this.filter.frequency.setTargetAtTime(260 + 900 * Math.min(1, L), ac.currentTime, 2);
  }
  pan(x, y) {
    const [sx, sy] = this.app.r.toScreen(x, y), sw = this.app.r.sw, sh = this.app.r.sh;
    const off = sx < -40 || sx > sw + 40 || sy < -40 || sy > sh + 40;
    return { p: clamp(sx / sw * 2 - 1, -1, 1), v: off ? 0.25 : 1 };
  }
  voice(freq, t0, dur, gain, type, pan, verbOnly) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = g;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); node = p; }
    o.connect(g);
    if (!verbOnly) node.connect(this.dry);
    node.connect(this.verb);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise(t0, dur, gain, f, pan) {
    const ac = this.ac, n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = b; fl.type = 'lowpass'; fl.frequency.value = f; g.gain.value = gain;
    s.connect(fl); fl.connect(g);
    let node = g; if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); node = p; }
    node.connect(this.dry); node.connect(this.verb); s.start(t0);
  }
  note(octave) { const { root, mode } = this.scale(); return root + 12 * octave + mode[Math.floor(Math.random() * mode.length)]; }

  // read the universe's event queues (before the renderer clears them)
  consume(fx) {
    if (!this.on || !this.ac || this.app.paused) return;
    const ac = this.ac, t = ac.currentTime + 0.02;
    for (const b of fx.births) {
      if (this.tokens < 1 || Math.random() > 0.5) continue;
      const q = this.pan(b.x, b.y); if (q.v < 1 && Math.random() < 0.7) continue;
      this.tokens -= 1; this.voice(this.hz(this.note(2)), t + Math.random() * 0.1, 1.6, 0.05 * q.v, 'sine', q.p);
    }
    for (const d of fx.deaths) {
      if (d.cause !== 'eaten' && d.cause !== 'engulfed') continue;
      if (this.tokens < 1 || Math.random() > 0.6) continue;
      const q = this.pan(d.x, d.y); this.tokens -= 1;
      this.voice(this.hz(this.note(0)), t, 0.9, 0.06 * q.v, 'triangle', q.p);
    }
    for (const s of fx.sparks) { const q = this.pan(s.x, s.y); const { root, mode } = this.scale(); [0, 1, 2, 4].forEach((k, i) => this.voice(this.hz(root + 24 + mode[k]), t + i * 0.13, 2.6, 0.06 * q.v, 'sine', q.p)); }
    for (const b of fx.bolts) { const q = this.pan(b.x, b.y); this.noise(t, 0.5, 0.35, 3800, q.p); this.voice(55, t, 0.6, 0.12, 'sawtooth', q.p, true); }
    for (const m of fx.impacts) { const q = this.pan(m.x, m.y); this.noise(t, 2.2, 0.7, 420, q.p); this.voice(36, t, 3.2, 0.32, 'sine', q.p); }
    for (const p of fx.plagues) { const q = this.pan(p.x, p.y); [0, 1, 6].forEach(k => this.voice(this.hz(this.scale().root + 12 + k), t, 2.4, 0.035, 'triangle', q.p)); }
    for (const b of fx.blessings) { const q = this.pan(b.x, b.y); this.voice(this.hz(this.note(2)), t, 2.2, 0.07, 'sine', q.p); this.voice(this.hz(this.note(3)), t + 0.1, 2.2, 0.05, 'sine', q.p); }
  }
  // the chronicle's big moments
  story(e) {
    if (!this.on || !this.ac) return;
    const t = this.ac.currentTime + 0.05, { root, mode } = this.scale();
    if (e.kind === 'species') [0, 2, 4].forEach((k, i) => this.voice(this.hz(root + 12 + mode[k] + (i === 2 ? 12 : 0)), t + i * 0.22, 3, 0.06, 'sine', (i - 1) * 0.4));
    else if (e.kind === 'extinct') [4, 2, 0].forEach((k, i) => this.voice(this.hz(root + mode[k]), t + i * 0.35, 3.2, 0.06, 'triangle', 0));
    else if (e.kind === 'milestone' || e.kind === 'behaviour') [0, 4, 2, 4].forEach((k, i) => this.voice(this.hz(root + 24 + mode[k]), t + i * 0.18, 2.4, 0.045, 'sine', (i - 1.5) * 0.3));
    else if (e.kind === 'year') this.voice(this.hz(root - 12), t, 5, 0.12, 'sine', 0);
  }
}
