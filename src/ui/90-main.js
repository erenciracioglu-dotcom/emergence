// ═══════════════════════════════════════════════════════════════════
//  Emergence · the app: boot, the main loop, the god's verbs
// ═══════════════════════════════════════════════════════════════════
const SPEEDS = [0.5, 1, 2, 4, 8, 16];
const App = {
  u: null, r: null, speed: 1, paused: false, effSpeed: 1, tool: 'observe', acc: 0, last: 0, toastSeq: 0,

  boot(hot) {
    this.r = new Renderer($('#world'));
    this.shell = new Shell(this); this.panels = new Panels(this); this.river = new River(this);
    this.director = new Director(this); this.oracle = new Oracle(this); this.store = new Store(this); this.intro = new Intro(this); this.sound = new Sound(this);
    let u = null;
    if (hot && hot.save) { try { u = Universe.restore(JSON.parse(hot.save)); } catch (e) { u = null; } }
    this.r.resize();
    if (!u) u = this.makeUniverse(Math.floor(Math.random() * 900000) + 100000);
    this.setUniverse(u);
    this.shell.init(); this.panels.init();
    if (hot && hot.ui) { this.speed = hot.ui.speed || 1; this.paused = !!hot.ui.paused; this.shell.updateTimebar(); if (hot.ui.tab) this.panels.show(hot.ui.tab); }
    const storeReady = this.store.init();
    if (hot && hot.save) this.intro.dismiss(true);
    else storeReady.then(meta => this.intro.init(meta), () => this.intro.init(null));
    this.oracle.init();
    window.addEventListener('resize', () => { this.r.resize(); this.river.resize(); this.shell.renderToolOpts(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.store.saveNow(); });
    window.addEventListener('pagehide', () => this.store.saveNow());
    try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ save: JSON.stringify(this.u.serialize()), ui: { speed: this.speed, paused: this.paused, tab: this.panels.tab } })); } catch (e) { /* not in a viewer */ }
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
    window.__emergence = this; this.Universe = Universe;
  },

  makeUniverse(seed, laws) {
    const vw = window.innerWidth || 1280, vh = window.innerHeight || 800;
    const aspect = clamp(vw / vh, 0.55, 2.4), area = vw < 760 ? 1.0e6 : 1.6e6;
    const W = Math.max(500, Math.round(Math.sqrt(area * aspect) / 50) * 50), H = Math.max(500, Math.round(Math.sqrt(area / aspect) / 50) * 50);
    const L = Object.assign(defaultLaws(), laws || {});
    if (!laws) L.popCap = vw < 760 ? 500 : 900;
    return new Universe({ seed, W, H, laws: L });
  },
  setUniverse(u) {
    this.u = u; this.r.setUniverse(u); this.river.reset();
    $('#uname').textContent = u.name;
    this.toastSeq = u.chronSeq;
    if (this.panels.built) { this.panels.syncLaws(); this.panels.show(this.panels.tab); }
    if (this.director.on) this.director.stop();
  },
  newUniverse(seed) {
    const laws = Object.assign({}, this.u.laws);
    for (const d of LAW_DEFS) if (d.key !== 'popCap') laws[d.key] = d.def;
    this.setUniverse(this.makeUniverse(seed, laws));
    this.shell.toast({ kind: 'genesis', text: `Big Bang. ${this.u.name} begins, from seed ${seed}.` }, true);
  },
  setLaw(key, v) { this.u.laws[key] = v; },
  setPaused(p) { this.paused = p; this.shell.updateTimebar(); },
  setSpeed(s) { this.speed = s; this.acc = 0; this.shell.updateTimebar(); },
  stepSpeed(d) { const i = clamp(SPEEDS.indexOf(this.speed) + d, 0, SPEEDS.length - 1); this.setSpeed(SPEEDS[i]); },
  select(c) {
    this.r.selected = c || null;
    if (!c) { if (this.r.follow && !this.director.on) this.r.follow = null; }
    else if (window.innerWidth > 760 || $('#app').classList.contains('panel-open')) this.panels.show('spec');
    if (c && !$('#app').classList.contains('panel-open') && window.innerWidth > 760) this.shell.togglePanel(true);
    this.panels.specKey = null;
  },
  follow(c) {
    this.r.follow = c || null; this.r.followZ = c ? Math.max(this.r.cam.z, this.r.cam.zFit * 2.8) : null;
    if (c) this.r.selected = c;
    this.panels.specKey = null;
  },
  followSpecies(id) {
    const reg = this.u.species, sp = reg.get(id); if (!sp) return;
    let best = null; for (const c of this.u.creatures) if (c.sp === sp || reg.displayOf(c.sp) === sp) { if (!best || c.E > best.E) best = c; }
    if (best) { this.select(best); this.follow(best); }
  },
  highlight(sp, fly) {
    this.r.highlight = sp || null;
    if (sp && fly) {
      const reg = this.u.species; let n = 0, sx = 0, sy = 0, ax = 0, ay = 0, W = this.u.W, H = this.u.H;
      for (const c of this.u.creatures) if (c.sp === sp || reg.displayOf(c.sp) === sp) { ax += Math.cos(c.x / W * TAU); ay += Math.sin(c.x / W * TAU); sx += Math.cos(c.y / H * TAU); sy += Math.sin(c.y / H * TAU); n++; }
      if (n) this.r.flyTo(((Math.atan2(ay, ax) / TAU + 1) % 1) * W, ((Math.atan2(sy, sx) / TAU + 1) % 1) * H, 1.6);
    }
  },

  // keep the frame rate up on modest machines by drawing at a lower resolution
  adaptQuality(dt) {
    if (dt <= 0 || this.speed > 2 || this.paused) { this.qSlow = 0; this.qFast = 0; return; }
    this.ftAvg = (this.ftAvg || dt) * 0.95 + dt * 0.05;
    if (this.ftAvg > 0.034) { this.qFast = 0; this.qSlow = (this.qSlow || 0) + dt; if (this.qSlow > 3 && this.r.quality > 0.5) { this.r.quality = Math.max(0.5, this.r.quality - 0.15); this.r.resize(); this.qSlow = 0; this.ftAvg = 0.02; } }
    else if (this.ftAvg < 0.019) { this.qSlow = 0; this.qFast = (this.qFast || 0) + dt; if (this.qFast > 10 && this.r.quality < 1) { this.r.quality = Math.min(1, this.r.quality + 0.15); this.r.resize(); this.qFast = 0; } }
    else { this.qSlow = 0; this.qFast = 0; }
  },
  checkChronicle() {
    const u = this.u;
    if (u.chronSeq === this.toastSeq) return;
    for (const e of u.chronicle) {
      if (e.seq <= this.toastSeq) continue;
      // toasts for the big moments, but not a flood of them
      const now = performance.now(), quiet = { species: 40000, extinct: 30000, plague: 60000, life: 40000 }[e.kind] || 0;
      this.lastToast = this.lastToast || {};
      if (e.major && !this.director.on && !this.intro.shown && (!quiet || now - (this.lastToast[e.kind] || -1e9) > quiet || e.kind === 'god')) { this.shell.toast(e); this.lastToast[e.kind] = now; }
      this.sound.story(e);
      if (e.major || e.kind === 'species') this.panels.markTab('chron');
    }
    this.toastSeq = u.chronSeq;
  },

  frame(now) {
    const dtReal = Math.min(0.1, Math.max(0, (now - this.last) / 1000)); this.last = now;
    let ticks = 0;
    if (!this.paused) {
      this.acc += dtReal * this.speed;
      const budget = this.speed >= 8 ? 26 : this.speed >= 4 ? 15 : 11, t0 = performance.now();
      while (this.acc >= DT) {
        this.u.step(); this.acc -= DT; ticks++;
        if (performance.now() - t0 > budget) { this.acc = Math.min(this.acc, DT); break; }
      }
    }
    const simDt = ticks * DT;
    if (dtReal > 0) this.effSpeed = this.effSpeed * 0.92 + (simDt / dtReal) * 0.08;
    this.adaptQuality(dtReal);
    this.sound.update(dtReal); this.sound.consume(this.u.fx);
    this.r.fx.consume(this.u);
    this.shell.strokeFrame(dtReal); this.shell.updateCursor();
    this.director.update(dtReal);
    this.r.draw(dtReal, simDt);
    this.shell.updateHUD(now); this.panels.update(now); this.river.update(now);
    this.checkChronicle();
    this.store.tick(now);
    requestAnimationFrame(t => this.frame(t));
  },
};

(function start() {
  const go = (data) => App.boot(data || {});
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(go); else go(hot && hot.data ? hot.data : {});
})();
