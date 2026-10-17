// ═══════════════════════════════════════════════════════════════════
//  Emergence · the universe: ticks of time, life and death, history
// ═══════════════════════════════════════════════════════════════════
class Universe {
  constructor(opts) {
    this.seed = (opts.seed >>> 0) || 1;
    this.rng = new RNG(this.seed);
    this.laws = Object.assign(defaultLaws(), opts.laws || {});
    this.W = opts.W; this.H = opts.H;
    this.world = new World(this.W, this.H, this.rng);
    this.name = opts.name || ('The ' + this.rng.pick(UNIVERSE_ADJ) + ' ' + this.rng.pick(UNIVERSE_NOUN));
    this.t = 0; this.tick = 0; this.days = 0; this.dayPhase = 0.4; this.yearPhase = 0;
    this.creatures = []; this.newborns = []; this.nextId = 1;
    this.species = new SpeciesRegistry(this);
    this.forces = []; this.forceSeq = 1;
    this.alarms = []; this.pendingMeteors = [];
    this.hgw = (this.W / HCELL) | 0; this.hgh = (this.H / HCELL) | 0;
    const HC = this.hgw * this.hgh;
    this.hCount = new Int32Array(HC); this.hStart = new Int32Array(HC + 1); this.hFill = new Int32Array(HC); this.hItems = [];
    this.fx = { births: [], deaths: [], sparks: [], alarms: [], bolts: [], meteors: [], impacts: [], plagues: [], blessings: [] };
    this.fxOn = true;
    this.chronicle = []; this.chronSeq = 0;
    this.bioMatter = 0; this.crowd = 0; this.hasHunters = false;
    this.maxGen = 0;
    // per-second activity buckets (last 60 s)
    this.bk = { births: new Float32Array(60), deaths: new Float32Array(60), kills: new Float32Array(60), starved: new Float32Array(60),
      shared: new Float32Array(60), packs: new Float32Array(60), alarms: new Float32Array(60), sparks: new Float32Array(60) };
    this.bkI = 0; this.bkNext = 1;
    this.totals = { births: 0, deaths: 0, kills: 0, sparks: 0, smitten: 0, meteors: 0, plagues: 0, speciesEver: 0, extinctions: 0 };
    this.hist = { cols: [], dt: 2, next: 0 };
    this.popHist = []; this.traitHist = [];
    this.flags = {}; this.records = { pop: 0, gen: 0, size: 0 };
    this.nextBook = 0.5; this.nextChron = 1; this.nextPest = 8; this.lastYear = 1;
    this.popWindow = [];
    this.godLast = null;
    if (!opts.restoring) {
      this.log('genesis', 'Light pours into ' + this.name + '. The water is warm, and rich with matter.', { major: false });
    }
  }

  // ── time ──
  get year() { return Math.floor(this.days / DAYS_PER_YEAR) + 1; }
  get dayOfYear() { return Math.floor(this.days % DAYS_PER_YEAR) + 1; }
  get season() { return SEASONS[Math.floor(((this.days % DAYS_PER_YEAR) / DAYS_PER_YEAR) * 4) % 4]; }
  get dayNumber() { return Math.floor(this.days) + 1; }
  stamp() { return { t: this.t, y: this.year, d: this.dayOfYear, s: this.season }; }

  // ── the clock ──
  step() {
    const dt = DT, L = this.laws;
    this.t += dt; this.tick++;
    this.days += dt / L.dayLength;
    this.dayPhase = (0.4 + this.days) % 1;
    this.yearPhase = (this.days / DAYS_PER_YEAR) % 1;

    if (this.tick % FIELD_EVERY === 0) {
      let bm = 0; const cs = this.creatures;
      for (let k = 0; k < cs.length; k++) bm += cs[k].E + cs[k].body;
      this.bioMatter = bm;
      this.world.update(dt * FIELD_EVERY, this);
    }
    if (this.pendingMeteors.length) this._meteors();

    const cs = this.creatures, n = cs.length;
    const cap = L.popCap, cr = (n - 0.8 * cap) / (0.2 * cap);
    this.crowd = cr > 0 ? 0.7 * cr : 0;
    for (let k = 0; k < n; k++) {
      const c = cs[k];
      if (!c.dead && (c.id + this.tick) % BRAIN_EVERY === 0) { this.sense(c); brainForward(c.w, c.inp, c.hid, c.out); }
    }
    for (let k = 0; k < n; k++) { const c = cs[k]; if (!c.dead) this.move(c, dt); }
    this.buildHash();
    this.contacts(dt);
    for (let k = 0; k < n; k++) { const c = cs[k]; if (!c.dead) this.live(c, dt); }

    // remove the dead, welcome the newborn
    let j = 0;
    for (let k = 0; k < n; k++) { const c = cs[k]; if (!c.dead) cs[j++] = c; }
    cs.length = j;
    if (this.newborns.length) { for (const b of this.newborns) cs.push(b); this.newborns.length = 0; }

    this.abiogenesis(dt);
    if (this.alarms.length) { const t = this.t; this.alarms = this.alarms.filter(a => t - a.t < 1.1); }
    if (this.t >= this.bkNext) this._second();
    if (this.t >= this.nextBook) { this.nextBook = this.t + 0.5; this._bookkeeping(); }
    if (this.t >= this.hist.next) this._sampleHistory();
    if (this.t >= this.nextChron) { this.nextChron = this.t + 1; this._chronicleChecks(); }
    if (this.t >= this.nextPest) { this.nextPest = this.t + 6; this._pestilence(); }
    if (!this.fxOn) for (const k in this.fx) this.fx[k].length = 0;
  }

  // ── spatial hash (rebuilt each tick, after movement) ──
  buildHash() {
    const cs = this.creatures, n = cs.length, hgw = this.hgw, cnt = this.hCount, HC = cnt.length;
    cnt.fill(0);
    for (let k = 0; k < n; k++) {
      const c = cs[k]; const h = ((c.y / HCELL) | 0) * hgw + ((c.x / HCELL) | 0);
      c.hc = h; cnt[h]++;
    }
    let s = 0;
    for (let h = 0; h < HC; h++) { this.hStart[h] = s; this.hFill[h] = s; s += cnt[h]; }
    this.hStart[HC] = s;
    const items = this.hItems; items.length = n;
    for (let k = 0; k < n; k++) { const c = cs[k]; items[this.hFill[c.hc]++] = c; }
  }

  // ── perception ──
  sense(c) {
    const w = this.world, W = this.W, H = this.H, hw = W * 0.5, hh = H * 0.5;
    const inp = c.inp, hx = c.hx, hy = c.hy;
    const ad = c.r + 4 + c.senseR * 0.12, ca = 0.82, sa = 0.57; // cos/sin of ~35°
    const ldx = hx * ca - hy * sa, ldy = hx * sa + hy * ca, rdx = hx * ca + hy * sa, rdy = -hx * sa + hy * ca;
    const lx = c.x + ldx * ad, ly = c.y + ldy * ad, rx = c.x + rdx * ad, ry = c.y + rdy * ad;
    const ep = c.effPlant, em = c.effMeat * 1.6;
    let fL = ep * w.sample(w.alg, lx, ly), fR = ep * w.sample(w.alg, rx, ry);
    if (em > 0.02) { fL += em * w.sample(w.meat, lx, ly); fR += em * w.sample(w.meat, rx, ry); }
    fL = fL / (fL + 5); fR = fR / (fR + 5);
    if (w.wallCount) { if (w.isWall(lx, ly)) fL = -1; if (w.isWall(rx, ry)) fR = -1; }
    inp[I_FOODL] = fL; inp[I_FOODR] = fR;
    const LL = w.sample(w.light, lx, ly), LR = w.sample(w.light, rx, ry);
    inp[I_LIGHT] = (LL + LR) * 0.5;
    const ld = (LL - LR) * 4; inp[I_LIGHTD] = ld > 1 ? 1 : ld < -1 ? -1 : ld;
    const T = w.temp[w.cellOf(c.x, c.y)];
    const te = (T - c.tPref) / 10; inp[I_TEMP] = te > 1 ? 1 : te < -1 ? -1 : te;
    inp[I_ENERGY] = c.E / c.Emax;
    inp[I_PAIN] = c.pain;
    inp[I_OSC] = Math.sin(c.oscPh);
    inp[I_MEM0] = c.out[O_MEM0]; inp[I_MEM1] = c.out[O_MEM1];

    // neighbours
    const R = c.senseR, R2 = R * R;
    let kinN = 0, ksx = 0, ksy = 0, kax = 0, kay = 0, draft = 0, near = 0;
    let bT = 0, tdx = 0, tdy = 0, bP = 0, pdx = 0, pdy = 0;
    const myPow = c.power, myDef = c.defense, pa = c.pigA, pb = c.pigB, kt2 = c.kinTol2, r5 = c.r * 5, cr16 = c.r * 1.6;
    const hgw = this.hgw, hgh = this.hgh, rc = Math.ceil(R / HCELL);
    const ci = (c.x / HCELL) | 0, cj = (c.y / HCELL) | 0;
    const hs = this.hStart, items = this.hItems;
    for (let dj = -rc; dj <= rc; dj++) {
      let j = cj + dj; if (j < 0) j += hgh; else if (j >= hgh) j -= hgh;
      for (let di = -rc; di <= rc; di++) {
        let i = ci + di; if (i < 0) i += hgw; else if (i >= hgw) i -= hgw;
        const h = j * hgw + i, end = hs[h + 1];
        for (let q = hs[h]; q < end; q++) {
          const o = items[q];
          if (o === c || o.dead) continue;
          let dx = o.x - c.x; if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
          let dy = o.y - c.y; if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
          const d2 = dx * dx + dy * dy;
          if (d2 > R2 || d2 < 1e-6) continue;
          const d = Math.sqrt(d2), prox = 1 - d / R;
          if (d2 < 1600) near++;
          const qa = o.pigA - pa, qb = o.pigB - pb;
          if (qa * qa + qb * qb < kt2) {
            kinN++; ksx += dx; ksy += dy; kax += o.hx; kay += o.hy;
            if (d < r5) { const f = (dx * hx + dy * hy) / d; if (f > 0.75) { const dr = 0.3 * (1 - d / r5); if (dr > draft) draft = dr; } }
          } else {
            if (o.diet > 0.15) {
              let th = o.diet * o.power / (o.power + myDef);
              if (o.r > cr16) th = th > 0.6 + 0.4 * o.diet ? th : 0.6 + 0.4 * o.diet;
              th *= prox;
              if (th > bT) { bT = th; tdx = dx / d; tdy = dy / d; }
            }
            let pr = prox * myPow / (myPow + o.defense);
            if (o.r > cr16) pr *= 0.35; else if (c.r > o.r * ENGULF_RATIO) pr = prox * (0.75 + 0.25 * c.diet);
            if (pr > bP) { bP = pr; pdx = dx / d; pdy = dy / d; }
          }
        }
      }
    }
    // hunger for flesh sharpens the perception of prey
    const tm = bT * 1.5 > 1 ? 1 : bT * 1.5, pm = (bP * 1.5 > 1 ? 1 : bP * 1.5) * (0.25 + 1.75 * c.diet);
    inp[I_THR_F] = (tdx * hx + tdy * hy) * tm; inp[I_THR_S] = (-tdx * hy + tdy * hx) * tm;
    inp[I_PREY_F] = (pdx * hx + pdy * hy) * pm; inp[I_PREY_S] = (-pdx * hy + pdy * hx) * pm;
    if (kinN > 0) {
      const cx = ksx / kinN, cy = ksy / kinN, k2 = 2 / R;
      let f = (cx * hx + cy * hy) * k2, s = (-cx * hy + cy * hx) * k2;
      inp[I_KIN_F] = f > 1 ? 1 : f < -1 ? -1 : f; inp[I_KIN_S] = s > 1 ? 1 : s < -1 ? -1 : s;
      const ax = kax / kinN, ay = kay / kinN;
      inp[I_KIN_AL] = -ax * hy + ay * hx;
      inp[I_KIN_N] = kinN / (kinN + 4);
      c.align = kinN >= 2 ? ((kax * kax + kay * kay) - kinN) / (kinN * (kinN - 1)) : 0;
    } else {
      inp[I_KIN_F] = 0; inp[I_KIN_S] = 0; inp[I_KIN_AL] = 0; inp[I_KIN_N] = 0; c.align = 0;
    }
    c.kinN = kinN; c.draft = draft; c.near = near;

    // alarm calls from kin
    let af = 0, as = 0;
    if (this.alarms.length) {
      let best = 0;
      for (const a of this.alarms) {
        const age = this.t - a.t; if (age > 1) continue;
        let dx = a.x - c.x; if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
        let dy = a.y - c.y; if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
        const d2 = dx * dx + dy * dy, ar = 40 + 220 * age;
        if (d2 > ar * ar || d2 < 1) continue;
        const qa = a.pa - pa, qb = a.pb - pb;
        if (qa * qa + qb * qb > kt2 * 2.25) continue;
        const d = Math.sqrt(d2), s = 1 - d / 260;
        if (s > best) { best = s; af = (dx * hx + dy * hy) / d * s; as = (-dx * hy + dy * hx) / d * s; }
      }
    }
    inp[I_ALARM_F] = af; inp[I_ALARM_S] = as;
  }

  // ── motion through the medium ──
  move(c, dt) {
    const L = this.laws, out = c.out, w = this.world;
    c.av += (out[O_TURN] * c.turnMax - c.av) * 0.2;
    let h = c.h + c.av * dt;
    if (h > Math.PI) h -= TAU; else if (h < -Math.PI) h += TAU;
    c.h = h; c.hx = Math.cos(h); c.hy = Math.sin(h);
    let thrust = out[O_THRUST] * c.maxThrust * (c.infected > 0 ? 0.6 : 1);
    if (c.held > 0) { thrust *= 0.35; c.held -= dt; }
    if (c.digest > 0) { thrust *= 0.6; c.digest -= dt; }
    const ef = c.E / (0.25 * c.Emax); if (ef < 1) thrust *= 0.55 + 0.45 * (ef > 0 ? ef : 0);   // the starving are weak
    c.thrustF = thrust;
    const ax = thrust * c.hx / c.m, ay = thrust * c.hy / c.m;
    const cell = w.cellOf(c.x, c.y);
    const k = DRAG * L.viscosity * c.r / c.m * (1 - c.draft), kdt = k * dt;
    c.vx = (c.vx + ax * dt + kdt * w.fu[cell]) / (1 + kdt);
    c.vy = (c.vy + ay * dt + kdt * w.fv[cell]) / (1 + kdt);
    let nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
    if (w.wallCount) {
      const lead = c.r * 0.6;
      if (w.isWall(nx + (c.vx > 0 ? lead : -lead), c.y)) { nx = c.x; c.vx *= -0.3; }
      if (w.isWall(nx, ny + (c.vy > 0 ? lead : -lead))) { ny = c.y; c.vy *= -0.3; }
      if (w.isWall(nx, ny)) { const p = w.findOpen(nx, ny); if (p) { nx = p[0]; ny = p[1]; } }
    }
    if (nx < 0) nx += this.W; else if (nx >= this.W) nx -= this.W;
    if (ny < 0) ny += this.H; else if (ny >= this.H) ny -= this.H;
    c.x = nx; c.y = ny;
    c.speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    c.oscPh += TAU * c.oscF * dt;
    c.tail += (1.2 + 7 * out[O_THRUST]) * dt * 1.6;
  }

  // ── touch: shoving, biting, sharing, contagion ──
  contacts(dt) {
    const cs = this.creatures, n = cs.length, W = this.W, H = this.H, hw = W * 0.5, hh = H * 0.5;
    const hgw = this.hgw, hgh = this.hgh, hs = this.hStart, items = this.hItems;
    for (let k = 0; k < n; k++) {
      const a = cs[k]; if (a.dead) continue;
      const ci = a.hc % hgw, cj = (a.hc / hgw) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        let j = cj + dj; if (j < 0) j += hgh; else if (j >= hgh) j -= hgh;
        for (let di = -1; di <= 1; di++) {
          let i = ci + di; if (i < 0) i += hgw; else if (i >= hgw) i -= hgw;
          const h = j * hgw + i, end = hs[h + 1];
          for (let q = hs[h]; q < end; q++) {
            const b = items[q];
            if (b.id <= a.id || b.dead || a.dead) continue;
            let dx = b.x - a.x; if (dx > hw) dx -= W; else if (dx < -hw) dx += W;
            let dy = b.y - a.y; if (dy > hh) dy -= H; else if (dy < -hh) dy += H;
            const rr = a.r + b.r, d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) || 0.01;
            // shove apart, heavier bodies yield less
            const ov = (rr - d) / d, ms = a.m + b.m, pa = ov * b.m / ms * 0.5, pb = ov * a.m / ms * 0.5;
            a.x -= dx * pa; a.y -= dy * pa; b.x += dx * pb; b.y += dy * pb;
            if (a.x < 0) a.x += W; else if (a.x >= W) a.x -= W; if (a.y < 0) a.y += H; else if (a.y >= H) a.y -= H;
            if (b.x < 0) b.x += W; else if (b.x >= W) b.x -= W; if (b.y < 0) b.y += H; else if (b.y >= H) b.y -= H;
            const nx = dx / d, ny = dy / d;
            const qa = b.pigA - a.pigA, qb = b.pigB - a.pigB, pd = qa * qa + qb * qb;
            this.interact(a, b, nx, ny, pd, dt);
            if (!b.dead && !a.dead) this.interact(b, a, -nx, -ny, pd, dt);
          }
        }
      }
    }
  }

  interact(a, b, nx, ny, pd, dt) {
    if (pd < a.kinTol2) {
      if (a.out[O_SHARE] > 0.5) this.share(a, b, dt);
    } else if (a.out[O_ATTACK] > 0.5 && a.digest <= 0 && nx * a.hx + ny * a.hy > 0.35 && a.E > 0) {
      this.bite(a, b, dt);
    }
    if (a.infected > 0 && b.infected <= 0 && !b.immune && pd < 0.0625 && this.rng.next() < 1.4 * dt) this.infect(b);
  }

  bite(a, b, dt) {
    // a body much smaller than the mouth is swallowed whole
    if (a.r > b.r * ENGULF_RATIO && this.rng.next() < (0.2 + a.diet) * 3.2 * dt) {
      const food = Math.max(0, b.E) + b.body, gain = food * a.effMeat;
      let keep = gain, spill = food - gain;
      if (a.E + keep > a.Emax) { spill += a.E + keep - a.Emax; keep = a.Emax - a.E; }
      a.E += keep; this.world.addNut(b.x, b.y, spill);
      b.E = 0; b.body = 0;
      a.kills++; a.sp.killAcc++; this.bk.kills[this.bkI]++; this.totals.kills++;
      a.biteT = 0.35; a.biteTarget = b; b.killerSp = a.sp.id; b.engulfedBy = a; a.digest = 2 + 3 * b.m / a.m;
      this.kill(b, 'engulfed');
      return;
    }
    const conf = 1 / (1 + 0.2 * b.kinN);   // a crowd of kin confuses the hunter
    let sz = Math.sqrt(a.r / b.r); sz = sz < 0.4 ? 0.4 : sz > 1.4 ? 1.4 : sz;
    const dmg = BITE_K * a.power * (1 - 0.7 * b.armor) * conf * sz * dt;
    const take = Math.min(dmg, Math.max(0, b.E));
    b.E -= dmg;
    const gain = take * a.effMeat, thorn = take * 0.3 * b.armor;
    a.E += gain - thorn;
    this.world.addNut(b.x, b.y, take - gain + thorn);
    a.costAcc += 0.4 * a.m75 * dt;
    b.pain = 1;
    // the bite grips: the prey is slowed and dragged along
    const grip = a.power / (a.power + b.power);
    b.held = 0.3 * grip + 0.05;
    const kv = Math.min(1, 10 * grip * dt);
    b.vx += (a.vx - b.vx) * kv; b.vy += (a.vy - b.vy) * kv;
    a.biteT = 0.25; a.biteTarget = b;
    const sid = a.sp.id;
    if (b.lastBiteTick === this.tick && b.lastBiterSp === sid && b.lastBiterId !== a.id && this.t - b.packT > 1) {
      b.packT = this.t; a.sp.packAcc++; this.bk.packs[this.bkI]++;
    }
    b.lastBiteTick = this.tick; b.lastBiterSp = sid; b.lastBiterId = a.id;
    if (b.alarmCd <= 0 && b.alarmP > 0.05 && this.rng.next() < b.alarmP * 10 * dt) {
      b.alarmCd = 2.5; b.E -= 1.5; this.world.addNut(b.x, b.y, 1.5);
      const al = { x: b.x, y: b.y, t: this.t, pa: b.pigA, pb: b.pigB, hue: b.hue };
      if (this.alarms.length < 80) this.alarms.push(al);
      if (this.fxOn && this.fx.alarms.length < 120) this.fx.alarms.push(al);
      this.bk.alarms[this.bkI]++;
    }
    if (b.E <= 0 && !b.dead) {
      a.kills++; a.sp.killAcc++; this.bk.kills[this.bkI]++; this.totals.kills++;
      b.killerSp = sid; a.digest = 2;
      this.kill(b, 'eaten');
    }
  }

  share(a, b, dt) {
    const ea = a.E / a.Emax, eb = b.E / b.Emax;
    if (ea <= eb + 0.1 || b.E >= b.Emax) return;
    let amt = SHARE_K * a.m75 * (a.out[O_SHARE] - 0.5) * 2 * dt;
    const cap1 = (ea - eb) * a.Emax * 0.5, cap2 = (b.Emax - b.E) / 0.9;
    if (amt > cap1) amt = cap1; if (amt > cap2) amt = cap2;
    if (amt <= 0.0005) return;
    a.E -= amt; b.E += amt * 0.9; this.world.addNut(a.x, a.y, amt * 0.1);
    a.given += amt; b.received += amt;
    a.sp.sharedAcc += amt; this.bk.shared[this.bkI] += amt;
    a.shareT = 0.3; a.shareTarget = b;
  }

  infect(c) {
    if (c.dead || c.immune || c.infected > 0) return;
    c.infected = 14;
  }

  // ── living: metabolism, feeding, ageing, death, birth ──
  live(c, dt) {
    const L = this.laws, w = this.world;
    c.age += dt;
    if (c.age < c.maturity + 1 && (this.tick + c.id) % 10 === 0) { const b0 = c.body; c.grow(); c.E -= c.body - b0; }
    const cell = w.cellOf(c.x, c.y);
    const T = w.temp[cell];
    let q10 = Math.pow(2, (T - 18) / 10); q10 = q10 < 0.55 ? 0.55 : q10 > 2.2 ? 2.2 : q10;
    let mis = T - c.tPref; mis = mis < 0 ? -mis : mis; mis -= c.tTol;
    const stress = mis > 0 ? 0.012 * mis * mis : 0;
    const crowd = c.near > 5 ? 0.05 * (c.near - 5) : 0;
    let cost = (c.basalK * q10 * L.metabolism + stress + this.crowd + crowd) * c.m75 + UPKEEP * L.metabolism + MOVE_COST * c.thrustF;
    if (c.infected > 0) {
      cost += 0.9 * c.m75 + 0.6;
      c.infected -= dt;
      if (c.infected <= 0) { c.infected = 0; c.immune = true; }
    }
    cost = cost * dt + c.costAcc; c.costAcc = 0;
    c.E -= cost;
    w.nut[cell] += cost;

    if (c.E < c.Emax) {
      // graze the algae at the mouth
      const mc = w.cellOf(w.wrapX(c.x + c.hx * c.r), w.wrapY(c.y + c.hy * c.r));
      const A = w.alg[mc];
      if (A > 0.01 && c.effPlant > 0.01) {
        let take = GRAZE_K * (1 - 0.85 * c.diet) * c.m75 * (A / (A + 5)) * dt;
        const room = (c.Emax - c.E) / c.effPlant;
        if (take > room) take = room; if (take > A) take = A;
        w.alg[mc] -= take;
        const gain = take * c.effPlant;
        c.E += gain; w.nut[mc] += take - gain;
      }
      // feed on carrion
      const C = w.meat[mc];
      if (C > 0.05 && c.effMeat > 0.02) {
        let take = SCAV_K * c.diet * c.m75 * (C / (C + 4)) * dt;
        const room = (c.Emax - c.E) / c.effMeat;
        if (take > room) take = room; if (take > C) take = C;
        w.meat[mc] -= take;
        const gain = take * c.effMeat;
        c.E += gain; w.nut[mc] += take - gain;
        c.scavT = 0.3;
      }
      // drink the light
      if (c.photo > 0.02) {
        const Lc = w.light[cell], Nn = w.nut[cell];
        let sp = c.speed / 40; sp = sp > 1 ? 1 : sp;
        let g = PHOTO_K * c.photo * Lc * c.m * (Nn / (Nn + 3)) * (1 - 0.6 * sp) * dt;
        if (g > Nn * 0.5) g = Nn * 0.5;
        if (g > 0) { w.nut[cell] -= g; c.E += g; }
      }
      if (c.E > c.Emax) { w.nut[cell] += c.E - c.Emax; c.E = c.Emax; }
    }

    if (c.pain > 0) c.pain *= 0.94;
    if (c.alarmCd > 0) c.alarmCd -= dt;
    if (c.biteT > 0) c.biteT -= dt;
    if (c.shareT > 0) c.shareT -= dt;
    if (c.scavT > 0) c.scavT -= dt;
    if (c.flash > 0) c.flash -= dt * 1.5;

    if (c.E <= 0) { this.kill(c, c.infected > 0 ? 'plague' : 'starved'); return; }
    if (c.age > c.life && this.rng.next() < 0.5 * dt) { this.kill(c, 'old age'); return; }

    c.reproCd -= dt;
    if (c.reproCd <= 0 && c.age >= c.maturity && c.E >= c.reproF * c.Emax &&
        this.creatures.length + this.newborns.length < L.popCap) this.reproduce(c);
  }

  reproduce(c) {
    const w = this.world, rng = this.rng;
    const childE = c.E * c.investF, over = childE * 0.06 + BIRTH_COST;
    c.E -= childE + over; w.addNut(c.x, c.y, over);
    let M = this.laws.mutation;
    const rad = w.rad[w.cellOf(c.x, c.y)]; if (rad > 0) M *= 1 + 7 * rad;
    const g = mutateGenes(c.g, M, rng);
    const nw = mutateBrain(c.w, M, rng);
    const back = c.r + 2;
    const x = w.wrapX(c.x - c.hx * back + rng.gauss() * 2), y = w.wrapY(c.y - c.hy * back + rng.gauss() * 2);
    const b = new Creature(this.nextId++, g, nw, x, y, c.h + rng.gauss() * 1.2, rng);
    b.gen = c.gen + 1; b.parentId = c.id; b.born = this.t;
    b.vx = c.vx * 0.5 - c.hx * 10; b.vy = c.vy * 0.5 - c.hy * 10;
    // the parent's gift pays first for the child's body, the rest is its reserve
    let gift = childE - b.body;
    if (gift < b.Emax * 0.12) { const need = b.Emax * 0.12 - gift; c.E -= need; gift += need; }
    b.E = Math.min(gift, b.Emax); if (gift > b.E) w.addNut(x, y, gift - b.E);
    b.out[O_TURN] = 0; b.out[O_THRUST] = 0.4;
    b.flash = 0.6;
    this.species.add(b, this.species.assign(g, c.sp));
    c.children++; c.reproCd = 2.5 + 5 * c.investF;
    if (b.gen > this.maxGen) this.maxGen = b.gen;
    this.newborns.push(b);
    this.bk.births[this.bkI]++; this.totals.births++;
    if (this.fxOn && this.fx.births.length < 300) this.fx.births.push({ x, y, hue: b.hue });
  }

  kill(c, cause) {
    if (c.dead) return;
    c.dead = true; c.cause = cause; c.diedAt = this.t;
    this.world.addMeat(c.x, c.y, c.body + (c.E > 0 ? c.E : 0));
    c.E = 0;
    this.species.remove(c);
    this.bk.deaths[this.bkI]++; this.totals.deaths++;
    if (cause === 'starved') this.bk.starved[this.bkI]++;
    if (this.fxOn && this.fx.deaths.length < 300) this.fx.deaths.push({ x: c.x, y: c.y, hue: c.hue, sat: c.sat, r: c.r, cause });
  }

  // ── abiogenesis: life sparks from nothing ──
  abiogenesis(dt) {
    const n = this.creatures.length;
    let rate = this.laws.abiogenesis * 0.016;
    if (n < 24) rate += 0.45;
    if (this.t > 120 && n > 220 && !this.hasHunters && this.laws.abiogenesis > 0) rate += 0.012;
    if (this.t < 40 && this.totals.sparks < 4) rate += 0.35;
    if (this.t < 1.2) rate = 0;
    if (this.rng.next() < rate * dt) this.spark();
  }
  pickCradle() {
    const w = this.world, rng = this.rng;
    let best = -1, bx = 0, by = 0;
    for (let k = 0; k < 14; k++) {
      const x = rng.range(0, this.W), y = rng.range(0, this.H), c = w.cellOf(x, y);
      if (w.wall[c]) continue;
      const s = w.alg[c] * 0.6 + w.nut[c] * 0.25 + w.light[c] * 8 + rng.next() * 3;
      if (s > best) { best = s; bx = x; by = y; }
    }
    return best < 0 ? null : [bx, by];
  }
  spark(x, y, byGod, kind) {
    const w = this.world, rng = this.rng;
    if (x === undefined) { const p = this.pickCradle(); if (!p) return null; x = p[0]; y = p[1]; }
    if (w.isWall(x, y)) { const p = w.findOpen(x, y); if (!p) return null; x = p[0]; y = p[1]; }
    const T = w.temp[w.cellOf(x, y)];
    if (!kind && !byGod && this.t > 120 && this.creatures.length > 200 && rng.chance(this.hasHunters ? 0.15 : 0.6)) kind = 'hunter';
    const g0 = protoGenome(rng, T, kind);
    const sp = this.species.createRoot(g0);
    const w0 = instinctBrain(rng, 0.35, g0[G_DIET]);
    const count = 8 + rng.int(5);
    let first = null;
    for (let k = 0; k < count; k++) {
      const g = mutateGenes(g0, 0.5, rng), bw = mutateBrain(w0, 0.6, rng);
      const a = rng.next() * TAU, r = rng.range(2, 22);
      const c = new Creature(this.nextId++, g, bw, w.wrapX(x + Math.cos(a) * r), w.wrapY(y + Math.sin(a) * r), rng.next() * TAU, rng);
      c.age = c.maturity * rng.range(0.4, 1.0); c.grow();
      c.E = c.Emax * 0.62; c.born = this.t; c.flash = 1;
      w.takeNut(x, y, c.E + c.body);
      this.species.add(c, sp);
      this.newborns.push(c);
      if (!first) first = c;
    }
    this.totals.sparks++; this.bk.sparks[this.bkI]++;
    if (this.fxOn) this.fx.sparks.push({ x, y, hue: first.hue });
    if (!this.flags.firstLife) {
      this.flags.firstLife = true;
      this.log('life', 'A spark in ' + this.placeName(x, y) + ': matter folds into something that eats, moves and divides. Life has begun.', { x, y, major: true, sp: sp.id });
    } else if (byGod) {
      this.logGod('You breathed new life into ' + this.placeName(x, y) + (kind ? ': ' + kind + 's.' : '.'), x, y);
    } else if (kind === 'hunter') {
      const lines = [', and this time it is hungry for flesh.', ': these ones are born hungry.', ': matter folds itself into a hunter.', ': mouths made for other mouths.'];
      const fuss = !this.lastHunterSpark || this.t - this.lastHunterSpark > 240;
      this.lastHunterSpark = this.t;
      this.log('life', 'Life sparks again in ' + this.placeName(x, y) + rng.pick(lines), { x, y, sp: sp.id, major: fuss });
    }
    return sp;
  }

  // ── plague ──
  _pestilence() {
    const L = this.laws, n = this.creatures.length;
    for (const sp of this.species.map.values()) if (sp.plagueCd > 0) sp.plagueCd -= 6;
    if (L.pestilence <= 0 || n < 250) return;
    let top = null;
    for (const sp of this.species.map.values()) if (sp.n > 0 && (!top || sp.n > top.n)) top = sp;
    if (!top || top.n < 150 || top.n < 0.4 * n || top.plagueCd > 0) return;
    if (this.rng.next() > L.pestilence * 0.3) return;
    const members = this.creatures.filter(c => c.sp === top && !c.dead && !c.immune);
    if (members.length < 10) return;
    for (let k = 0; k < 4; k++) this.infect(this.rng.pick(members));
    top.plagueCd = 120; this.totals.plagues++;
    const p = members[0];
    if (this.fxOn) this.fx.plagues.push({ x: p.x, y: p.y });
    this.log('plague', 'A plague rises among the crowded *' + this.species.displayOf(top).name + '*.', { x: p.x, y: p.y, sp: top.id, major: true, mark: 'plague' });
  }

  // ── bookkeeping every half second ──
  _bookkeeping() {
    const reg = this.species, cs = this.creatures;
    for (const sp of reg.map.values()) { sp.alignAcc = 0; sp.alignCnt = 0; }
    for (let k = 0; k < cs.length; k++) { const c = cs[k]; if (c.kinN >= 2) { c.sp.alignAcc += c.align; c.sp.alignCnt++; } }
    let hunters = false;
    for (const sp of reg.map.values()) {
      if (sp.n <= 0) continue;
      if (sp.n >= 5 && sp.mean(G_DIET) > 0.5) hunters = true;
      const val = sp.alignCnt >= 6 ? (sp.alignAcc / sp.alignCnt) * (sp.alignCnt / sp.n) : 0;
      sp.school = sp.school * 0.85 + val * 0.15;
      sp._refreshColor();
    }
    this.hasHunters = hunters;
  }

  _second() {
    this.bkNext = Math.floor(this.t) + 1;
    for (const sp of this.species.map.values()) {
      sp.shareRate = sp.shareRate * 0.9 + sp.sharedAcc * 6; sp.sharedAcc = 0;
      sp.packRate = sp.packRate * 0.96 + sp.packAcc * 2.4; sp.packAcc = 0;
      sp.killRate = sp.killRate * 0.9 + sp.killAcc * 6; sp.killAcc = 0;
    }
    this.bkI = (this.bkI + 1) % 60;
    for (const k in this.bk) this.bk[k][this.bkI] = 0;
    this.popWindow.push(this.creatures.length); if (this.popWindow.length > 40) this.popWindow.shift();
  }
  rate(key) { let s = 0; const a = this.bk[key]; for (let i = 0; i < 60; i++) s += a[i]; return s; }

  _sampleHistory() {
    const h = this.hist;
    h.next = this.t + h.dt;
    const m = new Map();
    for (const sp of this.species.map.values()) {
      if (sp.n <= 0) continue;
      const d = this.species.displayOf(sp);
      m.set(d.id, (m.get(d.id) || 0) + sp.n);
    }
    const col = { t: this.t, d: this.days, n: this.creatures.length, s: Array.from(m.entries()) };
    h.cols.push(col);
    let est = 0; for (const sp of this.species.map.values()) if (sp.n > 0 && sp.established) est++;
    const cs = this.creatures, nn = cs.length;
    const tm = new Float32Array(6);
    for (let k = 0; k < nn; k++) { const g = cs[k].g; tm[0] += g[G_SIZE]; tm[1] += g[G_SPEED]; tm[2] += g[G_DIET]; tm[3] += g[G_PHOTO]; tm[4] += g[G_ARMOR]; tm[5] += g[G_SENSE]; }
    if (nn) for (let i = 0; i < 6; i++) tm[i] /= nn;
    this.popHist.push([this.t, nn, est]);
    this.traitHist.push([this.t, ...Array.from(tm, v => Math.round(v * 1000) / 1000)]);
    if (h.cols.length > 720) {
      h.cols = h.cols.filter((_, i) => i % 2 === 0); h.dt *= 2;
      this.popHist = this.popHist.filter((_, i) => i % 2 === 0);
      this.traitHist = this.traitHist.filter((_, i) => i % 2 === 0);
    }
  }

  // ── the chronicle notices what matters ──
  log(kind, text, o) {
    o = o || {};
    const e = { seq: ++this.chronSeq, t: this.t, yr: this.year, d: this.dayOfYear, s: this.season, kind, text,
      sp: o.sp || 0, px: o.x === undefined ? null : o.x, py: o.y === undefined ? null : o.y, major: !!o.major, mark: o.mark || '' };
    this.chronicle.push(e);
    if (this.chronicle.length > 400) this.chronicle.splice(0, this.chronicle.length - 400);
    return e;
  }
  logGod(text, x, y, mergeKey) {
    const last = this.godLast;
    if (mergeKey && last && last.mergeKey === mergeKey && this.t - last.t < 4 && this.chronicle[this.chronicle.length - 1] === last) {
      last.count = (last.count || 1) + 1; last.t = this.t; last.text = typeof text === 'function' ? text(last.count) : text;
      last.seq = ++this.chronSeq;
      return last;
    }
    const e = this.log('god', typeof text === 'function' ? text(1) : text, { x, y });
    e.mergeKey = mergeKey; e.count = 1; this.godLast = e;
    return e;
  }
  placeName(x, y) {
    const w = this.world;
    for (const v of w.vents) if (w.dist2(x, y, v.x, v.y) < 110 * 110) return 'the waters around the ' + v.name;
    const T = w.temp[w.cellOf(w.wrapX(x), w.wrapY(y))];
    if (T > 23) return 'the warm equatorial belt';
    if (T < 8) return 'the cold polar waters';
    return 'the temperate waters';
  }
  onEstablish(sp, anc, c) {
    this.totals.speciesEver++;
    if (!sp.parent || !anc) {
      this.log('species', '*' + sp.name + '* takes hold in ' + this.placeName(c.x, c.y) + ', the first of its line.', { sp: sp.id, x: c.x, y: c.y, major: true });
    } else {
      this.log('species', 'A new species, *' + sp.name + '*, has split from *' + anc.name + '*: ' + sp.desc + '.', { sp: sp.id, x: c.x, y: c.y, major: true });
    }
  }
  onExtinct(sp, c) {
    this.totals.extinctions++;
    const life = (this.t - sp.born) / this.laws.dayLength;
    const days = life < 1 ? 'less than a day' : Math.round(life) + (Math.round(life) === 1 ? ' day' : ' days');
    let why = '';
    if (c && c.cause === 'eaten' && c.killerSp) { const k = this.species.get(c.killerSp); if (k && k.name && k !== sp) why = ' The last was eaten by *' + this.species.displayOf(k).name + '*.'; }
    else if (c && c.cause === 'plague') why = ' Plague took the last of them.';
    else if (c && c.cause === 'smitten') why = ' Your lightning took the last of them.';
    else if (c && c.cause === 'meteor') why = ' The meteor took the last of them.';
    this.log('extinct', '*' + sp.name + '* is gone after ' + days + '. At its height it numbered ' + sp.peak + '.' + why, { sp: sp.id, major: sp.peak >= 25 });
  }

  _chronicleChecks() {
    const reg = this.species, n = this.creatures.length, F = this.flags;
    // new year
    const yr = this.year;
    if (yr !== this.lastYear) {
      this.lastYear = yr;
      let est = 0; for (const sp of reg.map.values()) if (sp.n > 0 && sp.established) est++;
      this.log('year', 'Year ' + yr + ' begins. ' + n + ' creatures of ' + est + (est === 1 ? ' species' : ' species') + ' are alive.', { major: false });
    }
    for (const sp of reg.map.values()) {
      if (sp.n <= 0 || !sp.established) continue;
      const diet = sp.mean(G_DIET), photo = sp.mean(G_PHOTO);
      if (!F.hunters && diet > 0.58 && sp.n >= 8) {
        F.hunters = true;
        this.log('milestone', 'The first true hunters: *' + sp.name + '* now live by eating other creatures.', { sp: sp.id, major: true });
      }
      if (!F.photo && photo > 0.5 && sp.n >= 8) {
        F.photo = true;
        this.log('milestone', '*' + sp.name + '* have learned to drink sunlight, living like plants that swim.', { sp: sp.id, major: true });
      }
      const old = this.t - sp.born > this.laws.dayLength;
      if (!sp.flags.school && old && sp.school > 0.5 && sp.n >= 20) {
        sp.flags.school = true;
        this.log('behaviour', '*' + sp.name + '* have begun to move as one: schools of kin, turning together.', { sp: sp.id, major: !F.school });
        F.school = true;
      }
      if (!sp.flags.share && old && sp.shareRate > 300 && sp.n >= 12) {
        sp.flags.share = true;
        this.log('behaviour', '*' + sp.name + '* feed their hungry kin, passing energy from the full to the starving.', { sp: sp.id, major: !F.share });
        F.share = true;
      }
      if (!sp.flags.pack && old && sp.packRate > 10 && sp.n >= 8 && diet > 0.4) {
        sp.flags.pack = true;
        this.log('behaviour', '*' + sp.name + '* hunt in packs, closing on prey together.', { sp: sp.id, major: !F.pack });
        F.pack = true;
      }
      if (!sp.flags.giant && sp.mean(G_SIZE) > 0.72 && sp.n >= 8) {
        sp.flags.giant = true;
        this.log('behaviour', '*' + sp.name + '* have grown into giants, ' + Math.round(10 * (3 + 9 * sp.mean(G_SIZE))) / 10 + ' units across.', { sp: sp.id });
      }
    }
    // population records and collapses
    const marks = [100, 250, 500, 750, 1000, 1500, 2000];
    for (const m of marks) if (n >= m && this.records.pop < m) { this.records.pop = m; this.log('record', 'The living now number ' + m + '.', {}); }
    const pw = this.popWindow;
    if (pw.length >= 30 && !F.dyingCd) {
      const was = Math.max(...pw.slice(0, 10));
      if (was >= 150 && n < was * 0.5) {
        F.dyingCd = 1; setTimeoutSim(this, 'dyingCd', 240);
        this.log('dying', 'A great dying: the living fell from ' + was + ' to ' + n + ' in half a minute.', { major: true, mark: 'dying' });
      }
    }
    if (F.dyingCd && this.t > F.dyingCdUntil) F.dyingCd = 0;
    const gm = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000];
    for (const g of gm) if (this.maxGen >= g && this.records.gen < g) {
      this.records.gen = g; this.log('record', 'The ' + ordinal(g) + ' generation is born.', {});
    }
  }

  // ── god's hand ──
  creaturesNear(x, y, r) {
    const out = [], r2 = r * r, w = this.world;
    for (const c of this.creatures) if (!c.dead && w.dist2(x, y, c.x, c.y) <= r2) out.push(c);
    return out;
  }
  nearest(x, y, r) {
    let best = null, bd = r * r; const w = this.world;
    for (const c of this.creatures) { if (c.dead) continue; const d = w.dist2(x, y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  impulse(x, y, R, v) {
    const w = this.world;
    for (const c of this.creatures) {
      if (c.dead) continue;
      const dx = w.dx(x, c.x), dy = w.dy(y, c.y), d2 = dx * dx + dy * dy;
      if (d2 > R * R || d2 < 1) continue;
      const d = Math.sqrt(d2), f = v * (1 - d / R) / Math.sqrt(c.m);
      c.vx += dx / d * f; c.vy += dy / d * f;
    }
  }
  smite(x, y) {
    const victims = this.creaturesNear(x, y, 24);
    for (const c of victims) this.kill(c, 'smitten');
    this.impulse(x, y, 90, 140);
    this.totals.smitten += victims.length;
    if (this.fxOn) this.fx.bolts.push({ x, y });
    this.logGod(k => k > 1 ? 'Your lightning fell ' + k + ' times.' : 'Your lightning fell on ' + this.placeName(x, y) + '.', x, y, 'smite');
    return victims.length;
  }
  meteor(x, y) {
    this.pendingMeteors.push({ x, y, t: this.t + 0.75 });
    if (this.fxOn) this.fx.meteors.push({ x, y, dur: 0.75 });
  }
  _meteors() {
    const keep = [];
    for (const m of this.pendingMeteors) { if (this.t >= m.t) this._impact(m.x, m.y); else keep.push(m); }
    this.pendingMeteors = keep;
  }
  _impact(x, y) {
    const w = this.world, R = 78;
    const dead = this.creaturesNear(x, y, R * 0.8);
    for (const c of dead) this.kill(c, 'meteor');
    for (const c of this.creaturesNear(x, y, R * 1.5)) { c.E *= 0.45; c.pain = 1; }
    this.impulse(x, y, R * 3, 300);
    let added = 0;
    w.forCells(x, y, R, (c, d) => {
      if (w.wall[c]) return;
      w.nut[c] += w.alg[c]; w.alg[c] = 0;
      const a = 26 * (1 - d * d); w.nut[c] += a; added += a;
      w.anom[c] = clamp(w.anom[c] + 16 * (1 - d), -30, 30);
      if (d < 0.7) w.rad[c] = Math.min(1, w.rad[c] + 0.5 * (1 - d));
    });
    w.matterBonus += added;
    this.totals.meteors++;
    if (this.fxOn) this.fx.impacts.push({ x, y });
    this.log('god', 'A meteor struck ' + this.placeName(x, y) + (dead.length ? '. ' + dead.length + ' perished in the fire.' : '.') + ' The crater steams with fresh matter.', { x, y, major: true, mark: 'meteor' });
  }
  plagueAt(x, y) {
    const t = this.nearest(x, y, 50);
    if (!t) return null;
    const sp = t.sp;
    this.infect(t);
    let k = 1;
    for (const c of this.creaturesNear(t.x, t.y, 80)) if (c.sp === sp && !c.immune) { this.infect(c); k++; }
    this.totals.plagues++;
    if (this.fxOn) this.fx.plagues.push({ x: t.x, y: t.y });
    const name = this.species.displayOf(sp).name;
    this.log('god', 'You loosed a plague upon the *' + (name || 'nameless') + '*. ' + k + ' fell sick.', { x: t.x, y: t.y, sp: sp.id, major: true, mark: 'plague' });
    return t;
  }
  paintWall(x, y, r, on) {
    const changed = this.world.paintWall(x, y, r, on);
    if (changed && on) {
      for (const c of this.creaturesNear(x, y, r + 14)) {
        if (this.world.isWall(c.x, c.y)) { const p = this.world.findOpen(c.x, c.y); if (p) { c.x = p[0]; c.y = p[1]; c.vx = c.vy = 0; } else this.kill(c, 'entombed'); }
      }
    }
    return changed;
  }
  addForce(type, x, y, s) {
    if (this.forces.length >= MAX_FORCES) this.forces.shift();
    const f = { id: this.forceSeq++, type, x: this.world.wrapX(x), y: this.world.wrapY(y), s, R: 105, born: this.t };
    this.forces.push(f);
    return f;
  }
  removeForceNear(x, y, r) {
    let best = -1, bd = r * r;
    this.forces.forEach((f, i) => { const d = this.world.dist2(x, y, f.x, f.y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { this.forces.splice(best, 1); return true; }
    return false;
  }
  clone(c, n) {
    if (!c || c.dead) return 0;
    const w = this.world, rng = this.rng;
    for (let k = 0; k < n; k++) {
      const a = rng.next() * TAU;
      const b = new Creature(this.nextId++, new Float32Array(c.g), new Float32Array(c.w), w.wrapX(c.x + Math.cos(a) * (c.r * 3)), w.wrapY(c.y + Math.sin(a) * (c.r * 3)), rng.next() * TAU, rng);
      b.gen = c.gen; b.parentId = c.parentId; b.born = this.t; b.age = b.maturity; b.grow();
      b.E = b.Emax * 0.8; b.flash = 1; w.takeNut(b.x, b.y, b.E + b.body);
      this.species.add(b, c.sp);
      this.newborns.push(b);
    }
    this.logGod('You made ' + n + ' copies of a *' + (this.species.displayOf(c.sp).name || 'creature') + '*.', c.x, c.y);
    return n;
  }
  bless(c) {
    if (!c || c.dead) return;
    const add = c.Emax - c.E; c.E = c.Emax; c.flash = 1;
    this.world.takeNut(c.x, c.y, add);
    if (this.fxOn) this.fx.blessings.push({ x: c.x, y: c.y, hue: c.hue });
  }
  smiteOne(c) {
    if (!c || c.dead) return;
    if (this.fxOn) this.fx.bolts.push({ x: c.x, y: c.y });
    this.kill(c, 'smitten'); this.totals.smitten++;
    this.logGod('You struck down a single *' + (this.species.displayOf(c.sp).name || 'creature') + '*.', c.x, c.y);
  }

  // ── a compact portrait of the universe (for the Oracle) ──
  portrait() {
    const reg = this.species, alive = reg.alive();
    const groups = new Map();
    for (const sp of alive) { const d = reg.displayOf(sp); const g = groups.get(d) || { n: 0 }; g.n += sp.n; groups.set(d, g); }
    const top = Array.from(groups.entries()).sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([sp, g]) => {
      const anc = sp.parent ? reg.establishedAncestor(sp.parent) : null;
      return {
        name: sp.name || '(unnamed strain)', parent: anc ? anc.name : null, population: g.n, peak: sp.peak,
        ageDays: Math.round((this.t - sp.born) / this.laws.dayLength * 10) / 10, role: sp.role,
        traits: { size: r2(sp.mean(G_SIZE)), speed: r2(sp.mean(G_SPEED)), diet_0herb_1carn: r2(sp.mean(G_DIET)), photosynthesis: r2(sp.mean(G_PHOTO)),
          armour: r2(sp.mean(G_ARMOR)), senses: r2(sp.mean(G_SENSE)), preferredTempC: Math.round(-5 + 40 * sp.mean(G_TPREF)) },
        behaviour: { schooling: r2(sp.school), energySharedPerMin: Math.round(sp.shareRate), packHuntsPerMin: r2(sp.packRate), killsPerMin: r2(sp.killRate) },
        divergedBecause: sp.desc || null,
      };
    });
    const extinct = [];
    for (const sp of reg.map.values()) if (sp.established && sp.n === 0) extinct.push({ name: sp.name, peak: sp.peak, livedDays: Math.round((sp.extinct - sp.born) / this.laws.dayLength * 10) / 10 });
    const lawsChanged = {};
    for (const d of LAW_DEFS) if (Math.abs(this.laws[d.key] - d.def) > 1e-6) lawsChanged[d.label] = this.laws[d.key];
    return {
      universe: this.name, time: { year: this.year, season: this.season, day: this.dayOfYear, totalDays: Math.round(this.days * 10) / 10 },
      population: this.creatures.length, maxGeneration: this.maxGen,
      perMinute: { births: this.rate('births'), deaths: this.rate('deaths'), kills: this.rate('kills'), starvations: this.rate('starved'), energyShared: Math.round(this.rate('shared')) },
      climate: { meanTempC: r2(this.world.tempAvg), minTempC: r2(this.world.tempMin), maxTempC: r2(this.world.tempMax), meanLight: r2(this.world.lightAvg) },
      lawsChangedByGod: lawsChanged, livingSpecies: top, extinctSpecies: extinct.slice(-14),
      totals: this.totals,
      recentChronicle: this.chronicle.slice(-40).map(e => 'Y' + e.yr + ' ' + e.s + ' d' + e.d + ': ' + e.text.replace(/\*/g, '')),
    };
  }

  // ── saving & restoring a whole universe ──
  serialize() {
    const spec = [];
    for (const sp of this.species.map.values()) {
      spec.push({ id: sp.id, p: sp.parent ? sp.parent.id : 0, f: Array.from(sp.founder, v => Math.round(v * 1e4) / 1e4), born: sp.born, ext: sp.extinct,
        est: sp.established ? 1 : 0, estT: sp.estTime, genus: sp.genus, ep: sp.epithet, name: sp.name, peak: sp.peak, total: sp.total,
        desc: sp.desc, flags: sp.flags, school: sp.school, hue: sp.hue, sat: sp.sat });
    }
    const cr = this.creatures.map(c => [c.id, r2(c.x), r2(c.y), r2(c.vx), r2(c.vy), r2(c.h), r2(c.E), r2(c.age), c.gen, c.sp.id, c.parentId,
      r2(c.born), c.children, c.kills, r2(c.given), r2(c.infected), c.immune ? 1 : 0, f32b64(c.g), f32b64(c.w)]);
    return {
      app: 'emergence', v: 1, seed: this.seed, name: this.name, W: this.W, H: this.H, t: this.t, tick: this.tick, days: this.days,
      laws: this.laws, nextId: this.nextId, rng: this.rng.state(), world: this.world.serialize(), forces: this.forces,
      species: spec, nextSpecies: this.species.nextId, usedNames: Array.from(this.species.usedNames), usedGenera: Array.from(this.species.usedGenera),
      creatures: cr, chronicle: this.chronicle, chronSeq: this.chronSeq, hist: this.hist, popHist: this.popHist, traitHist: this.traitHist,
      flags: this.flags, records: this.records, totals: this.totals, maxGen: this.maxGen, lastYear: this.lastYear,
    };
  }
  static restore(o) {
    const u = new Universe({ seed: o.seed, W: o.W, H: o.H, laws: o.laws, name: o.name, restoring: true });
    u.t = o.t; u.tick = o.tick; u.days = o.days; u.dayPhase = (0.4 + u.days) % 1; u.yearPhase = (u.days / DAYS_PER_YEAR) % 1;
    u.nextId = o.nextId; u.rng.restore(o.rng);
    u.world.restore(o.world);
    u.forces = o.forces || [];
    const reg = u.species; reg.nextId = o.nextSpecies; reg.usedNames = new Set(o.usedNames); reg.usedGenera = new Set(o.usedGenera);
    for (const s of o.species) {
      const sp = new Species(s.id, null, Float32Array.from(s.f), s.born);
      sp.extinct = s.ext; sp.established = !!s.est; sp.estTime = s.estT; sp.genus = s.genus; sp.epithet = s.ep; sp.name = s.name;
      sp.peak = s.peak; sp.total = s.total; sp.desc = s.desc; sp.flags = s.flags || {}; sp.school = s.school || 0; sp.hue = s.hue; sp.sat = s.sat;
      sp._pid = s.p; reg.map.set(sp.id, sp);
      if (sp.established) reg.establishedCount++;
    }
    for (const sp of reg.map.values()) {
      if (sp._pid && reg.map.has(sp._pid)) { sp.parent = reg.map.get(sp._pid); sp.parent.kids.push(sp); }
    }
    const fixRoot = (sp) => { let r = sp; while (r.parent) r = r.parent; return r; };
    for (const sp of reg.map.values()) { sp.root = fixRoot(sp); let d = 0, p = sp.parent; while (p) { d++; p = p.parent; } sp.depth = d; }
    for (const a of o.creatures) {
      const c = new Creature(a[0], new Float32Array(b64f32(a[17])), new Float32Array(b64f32(a[18])), a[1], a[2], a[5], u.rng);
      c.vx = a[3]; c.vy = a[4]; c.E = a[6]; c.age = a[7]; c.gen = a[8]; c.parentId = a[10]; c.born = a[11]; c.children = a[12]; c.kills = a[13];
      c.given = a[14]; c.infected = a[15]; c.immune = !!a[16]; c.grow();
      let sp = reg.map.get(a[9]);
      if (!sp) { sp = reg.createRoot(c.g); }
      const peak = sp.peak, total = sp.total; reg.add(c, sp); sp.peak = Math.max(peak, sp.n); sp.total = total;
      u.creatures.push(c);
    }
    u.chronicle = o.chronicle || []; u.chronSeq = o.chronSeq || u.chronicle.length;
    u.hist = o.hist || u.hist; u.hist.next = u.t; u.popHist = o.popHist || []; u.traitHist = o.traitHist || [];
    u.flags = o.flags || {}; u.records = o.records || u.records; u.totals = Object.assign(u.totals, o.totals || {});
    u.maxGen = o.maxGen || 0; u.lastYear = o.lastYear || u.year;
    u.nextBook = u.t; u.nextChron = u.t + 1; u.nextPest = u.t + 8; u.bkNext = Math.floor(u.t) + 1;
    u.flags.firstLife = u.flags.firstLife || u.creatures.length > 0;
    u.buildHash();
    return u;
  }
}

function r2(v) { return Math.round(v * 100) / 100; }
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function setTimeoutSim(u, key, secs) { u.flags[key + 'Until'] = u.t + secs; }
