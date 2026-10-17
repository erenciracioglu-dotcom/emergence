// ═══════════════════════════════════════════════════════════════════
//  Emergence · the world: a flat torus of water with light, heat,
//  currents, algae and a closed cycle of matter
// ═══════════════════════════════════════════════════════════════════
class World {
  constructor(W, H, rng) {
    this.W = W; this.H = H;
    const gw = this.gw = (W / CELL) | 0, gh = this.gh = (H / CELL) | 0, N = this.N = gw * gh;
    this.invCell = 1 / CELL;
    this.nut = new Float32Array(N); this.alg = new Float32Array(N); this.meat = new Float32Array(N);
    this.light = new Float32Array(N); this.temp = new Float32Array(N);
    this.fu = new Float32Array(N); this.fv = new Float32Array(N);
    this.wall = new Uint8Array(N); this.anom = new Float32Array(N); this.rad = new Float32Array(N);
    this.cloud = new Float32Array(N); this.tnoise = new Float32Array(N);
    this.ventHeat = new Float32Array(N); this.ventW = new Float32Array(N);
    this.tmp1 = new Float32Array(N); this.tmp2 = new Float32Array(N);
    this.dayCol = new Float32Array(gw); this.warmCol = new Float32Array(gw);
    this.latRow = new Float32Array(gh); this.tempRow = new Float32Array(gh);
    this.im = new Int32Array(gw); this.ip = new Int32Array(gw);
    for (let i = 0; i < gw; i++) { this.im[i] = (i - 1 + gw) % gw; this.ip[i] = (i + 1) % gw; }

    this.flowWaves = new Waves(rng, 7, 2, gw, gh, (kx, ky) => 1 / Math.hypot(kx, ky), 0.018);
    this.cloudWaves = new Waves(rng, 6, 3, gw, gh, (kx, ky) => 1 / Math.hypot(kx, ky), 0.05);
    const tw = new Waves(rng, 6, 3, gw, gh, (kx, ky) => 1 / Math.hypot(kx, ky), 0);
    tw.fillValue(this.tnoise, 0); this._normalize(this.tnoise);
    // calibrate the flow so that 100 % currents means FLOW_SPEED RMS
    this.flowWaves.fillFlow(this.fu, this.fv, 0, 1);
    let ss = 0; for (let c = 0; c < N; c++) ss += this.fu[c] * this.fu[c] + this.fv[c] * this.fv[c];
    this.flowScale = FLOW_SPEED / Math.sqrt(ss / N + 1e-9);
    this.cloudWaves.fillValue(this.cloud, 0);
    let cs = 0; for (let c = 0; c < N; c++) cs += this.cloud[c] * this.cloud[c];
    this.cloudNorm = 1 / (Math.sqrt(cs / N) * 1.6 + 1e-9);

    // hydrothermal vents: warm, nutrient-rich oases
    this.vents = [];
    const nv = 2 + rng.int(2), names = VENT_NAMES.slice();
    for (let k = 0; k < nv; k++) {
      let x = 0, y = 0, ok = false;
      for (let tries = 0; tries < 60 && !ok; tries++) {
        x = rng.range(0, W); y = rng.range(0, H); ok = true;
        for (const v of this.vents) if (this.dist2(x, y, v.x, v.y) < 340 * 340) ok = false;
      }
      const ni = rng.int(names.length);
      this.vents.push({ x, y, name: names.splice(ni, 1)[0], rate: rng.range(1.2, 2.2) });
    }
    this._buildVents();

    // primordial matter
    const seedA = new Float32Array(N); this.cloudWaves.fillValue(seedA, 7.3); this._normalize(seedA);
    for (let c = 0; c < N; c++) { this.nut[c] = 12 + 2 * this.tnoise[c]; this.alg[c] = Math.max(0.5, 5 + 3 * seedA[c]); }
    this.openCells = N; this.wallCount = 0; this.wallVersion = 0; this.fieldVersion = 0; this.seasonShift = 0;
    this.baseMatter = this.sumNut() + this.sumAlg();
    this.matterBonus = 0;
    this.lastSumN = this.sumNut(); this.lastSumA = this.sumAlg(); this.lastSumM = 0;
    this.lightAvg = 0; this.tempAvg = 0; this.tempMin = 0; this.tempMax = 0;
  }

  _normalize(a) {
    let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i];
    const k = 1 / (Math.sqrt(s / a.length) * 1.6 + 1e-9);
    for (let i = 0; i < a.length; i++) a[i] = clamp(a[i] * k, -1, 1);
  }
  _buildVents() {
    const { gw, gh } = this;
    this.ventHeat.fill(0); this.ventW.fill(0);
    let tot = 0;
    for (const v of this.vents) {
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const d2 = this.dist2((i + 0.5) * CELL, (j + 0.5) * CELL, v.x, v.y);
        const c = j * gw + i;
        this.ventHeat[c] += 7 * Math.exp(-d2 / (2 * 55 * 55));
        const w = v.rate * Math.exp(-d2 / (2 * 25 * 25));
        if (w > 1e-4) { this.ventW[c] += w; tot += w; }
      }
    }
    this.ventRate = 0; for (const v of this.vents) this.ventRate += v.rate;
    if (tot > 0) for (let c = 0; c < this.N; c++) this.ventW[c] /= tot;
  }

  dx(a, b) { let d = b - a; const hw = this.W * 0.5; if (d > hw) d -= this.W; else if (d < -hw) d += this.W; return d; }
  dy(a, b) { let d = b - a; const hh = this.H * 0.5; if (d > hh) d -= this.H; else if (d < -hh) d += this.H; return d; }
  dist2(x1, y1, x2, y2) { const dx = this.dx(x1, x2), dy = this.dy(y1, y2); return dx * dx + dy * dy; }
  wrapX(x) { x %= this.W; return x < 0 ? x + this.W : x; }
  wrapY(y) { y %= this.H; return y < 0 ? y + this.H : y; }
  cellOf(x, y) {
    let i = (x * this.invCell) | 0, j = (y * this.invCell) | 0;
    if (i < 0) i += this.gw; else if (i >= this.gw) i -= this.gw;
    if (j < 0) j += this.gh; else if (j >= this.gh) j -= this.gh;
    return j * this.gw + i;
  }
  cellOfSafe(x, y) { return this.cellOf(this.wrapX(x), this.wrapY(y)); }
  sample(f, x, y) {
    const gw = this.gw, gh = this.gh;
    let fx = x * this.invCell - 0.5, fy = y * this.invCell - 0.5;
    fx %= gw; if (fx < 0) fx += gw; fy %= gh; if (fy < 0) fy += gh;
    const i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0;
    const i1 = i0 + 1 >= gw ? 0 : i0 + 1, j1 = j0 + 1 >= gh ? 0 : j0 + 1;
    const r0 = j0 * gw, r1 = j1 * gw;
    return (f[r0 + i0] * (1 - tx) + f[r0 + i1] * tx) * (1 - ty) + (f[r1 + i0] * (1 - tx) + f[r1 + i1] * tx) * ty;
  }
  sumNut() { let s = 0; for (let c = 0; c < this.N; c++) s += this.nut[c]; return s; }
  sumAlg() { let s = 0; for (let c = 0; c < this.N; c++) s += this.alg[c]; return s; }
  addNut(x, y, amt) { const c = this.cellOf(x, y); if (!this.wall[c]) this.nut[c] += amt; }
  // a body's matter becomes carrion, spread over the cell and its neighbours
  addMeat(x, y, amt) {
    const gw = this.gw, gh = this.gh, i = (this.wrapX(x) * this.invCell) | 0, j = (this.wrapY(y) * this.invCell) | 0;
    const cs = [j * gw + i, j * gw + (i + 1) % gw, j * gw + (i - 1 + gw) % gw, ((j + 1) % gh) * gw + i, ((j - 1 + gh) % gh) * gw + i];
    const share = [0.4, 0.15, 0.15, 0.15, 0.15];
    for (let k = 0; k < 5; k++) { const c = cs[k]; if (this.wall[c]) this.nut[cs[0]] += amt * share[k]; else this.meat[c] += amt * share[k]; }
  }
  // take matter from the neighbourhood (5×5 cells), falling back to the whole sea
  takeNut(x, y, amt) {
    const gw = this.gw, gh = this.gh;
    const ci = (this.wrapX(x) * this.invCell) | 0, cj = (this.wrapY(y) * this.invCell) | 0;
    let avail = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const c = ((cj + dj + gh) % gh) * gw + ((ci + di + gw) % gw); avail += this.nut[c];
    }
    const local = Math.min(amt, avail * 0.6), f = avail > 0 ? local / avail : 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const c = ((cj + dj + gh) % gh) * gw + ((ci + di + gw) % gw); this.nut[c] -= this.nut[c] * f;
    }
    // the rest is drawn from the sea at large by the matter regulator
    return amt;
  }

  // ── the field update: light, heat, currents, algae, transport ──
  update(dtF, u) {
    const L = u.laws, gw = this.gw, gh = this.gh, N = this.N;
    const shift = 0.13 * L.seasons * Math.sin(TAU * u.yearPhase);
    this.seasonShift = shift;
    for (let i = 0; i < gw; i++) {
      const d = Math.pow(0.5 + 0.5 * Math.cos(TAU * ((i + 0.5) / gw - u.dayPhase)), 1.25);
      this.dayCol[i] = 0.08 + 0.92 * d;
      this.warmCol[i] = 3.5 * (this.dayCol[i] - 0.4);
    }
    for (let j = 0; j < gh; j++) {
      const k = Math.cos(TAU * ((j + 0.5) / gh - 0.5 - shift));
      this.latRow[j] = 0.45 + 0.55 * (0.5 + 0.5 * k);
      this.tempRow[j] = 15 + 12 * k;
    }
    this.cloudWaves.fillValue(this.cloud, u.t);
    const forces = u.forces;
    if (L.currents > 0.001) this.flowWaves.fillFlow(this.fu, this.fv, u.t, this.flowScale * L.currents);
    else { this.fu.fill(0); this.fv.fill(0); }
    if (forces.length) this._applyForces(forces);

    // light & heat
    const sun = L.sun, toff = L.temperature, cn = this.cloudNorm;
    let lsum = 0, tsum = 0, tmin = 99, tmax = -99, cnt = 0;
    for (let j = 0; j < gh; j++) {
      const lat = this.latRow[j], tr = this.tempRow[j], row = j * gw;
      for (let i = 0; i < gw; i++) {
        const c = row + i;
        let cl = this.cloud[c] * cn; cl = cl > 1 ? 1 : cl < -1 ? -1 : cl;
        const T = tr + this.warmCol[i] + 2.5 * this.tnoise[c] + this.ventHeat[c] + this.anom[c] + toff;
        this.temp[c] = T;
        if (this.wall[c]) { this.light[c] = 0; continue; }
        const lv = sun * this.dayCol[i] * lat * (0.8 + 0.2 * cl);
        this.light[c] = lv; lsum += lv; tsum += T; cnt++;
        if (T < tmin) tmin = T; if (T > tmax) tmax = T;
      }
    }
    this.lightAvg = cnt ? lsum / cnt : 0; this.tempAvg = cnt ? tsum / cnt : 0; this.tempMin = tmin; this.tempMax = tmax;

    // the matter regulator keeps the universe's total matter at its law,
    // and vents pull nutrients from the open sea up into their oases
    const target = this.baseMatter * L.fertility + this.matterBonus;
    const total = this.lastSumN + this.lastSumA + this.lastSumM + u.bioMatter;
    const corr = (target - total) * Math.min(1, dtF * 0.12);
    let mulN = 1, addN = 0;
    if (corr > 0) addN = corr / Math.max(1, this.openCells);
    else if (this.lastSumN > 1) mulN = Math.max(0.5, 1 + corr / this.lastSumN);
    const inj = this.ventRate * dtF * Math.min(1, L.fertility);
    mulN *= Math.max(0, 1 - inj / Math.max(1, this.lastSumN));

    // algae: grow with light, warmth and nutrients; die in the dark
    let sumN = 0, sumA = 0, sumM = 0;
    const nut = this.nut, alg = this.alg, meat = this.meat, light = this.light, temp = this.temp, wall = this.wall, vw = this.ventW;
    const rot = 1 - Math.exp(-dtF * 0.035);
    for (let c = 0; c < N; c++) {
      if (wall[c]) { nut[c] = 0; alg[c] = 0; meat[c] = 0; continue; }
      let A = alg[c], Nn = nut[c] * mulN + addN + inj * vw[c];
      const Mc = meat[c];
      if (Mc > 0) { const r = Mc < 0.02 ? Mc : Mc * rot; meat[c] = Mc - r; Nn += r; sumM += Mc - r; }
      const Lc = light[c], dT = (temp[c] - 21) / 13, fT = Math.exp(-dT * dT);
      let grow = 0.28 * Lc * fT * (Nn / (Nn + 4)) * (A + 0.4) * (1 - A / AMAX) * dtF;
      if (grow < 0) grow = 0; else if (grow > Nn * 0.8) grow = Nn * 0.8;
      const dark = Lc < 0.25 ? (0.25 - Lc) * 4 : 0;
      let die = (0.004 + 0.01 * dark) * A * dtF;
      if (A > AMAX) die += (A - AMAX) * 0.5 * dtF;
      A += grow - die; Nn += die - grow;
      if (Nn < 0) Nn = 0;
      alg[c] = A; nut[c] = Nn; sumN += Nn; sumA += A;
    }
    this.lastSumN = sumN; this.lastSumA = sumA; this.lastSumM = sumM;

    // transport: currents carry matter (semi-Lagrangian), then it diffuses
    if (L.currents > 0.001 || forces.length) {
      this._advect(nut, this.tmp1, dtF); this._advect(alg, this.tmp2, dtF);
      this._diffuse(this.tmp1, nut, 0.12); this._diffuse(this.tmp2, alg, 0.025);
    } else {
      this.tmp1.set(nut); this.tmp2.set(alg);
      this._diffuse(this.tmp1, nut, 0.12); this._diffuse(this.tmp2, alg, 0.025);
    }

    // memories of god's touch fade
    const ka = Math.exp(-dtF / 45), kr = Math.exp(-dtF / 70);
    const anom = this.anom, rad = this.rad;
    for (let c = 0; c < N; c++) {
      if (anom[c] !== 0) { anom[c] *= ka; if (anom[c] > -0.02 && anom[c] < 0.02) anom[c] = 0; }
      if (rad[c] !== 0) { rad[c] *= kr; if (rad[c] < 0.002) rad[c] = 0; }
    }
    this.fieldVersion++;
  }

  _applyForces(forces) {
    const gw = this.gw, gh = this.gh;
    for (const f of forces) {
      const R = f.R, reach = R * 2.6, ci = (f.x / CELL) | 0, cj = (f.y / CELL) | 0, rc = Math.ceil(reach / CELL);
      const V = f.type === 'vortex' ? 46 * f.s : 34 * f.s;
      for (let dj = -rc; dj <= rc; dj++) {
        const j = ((cj + dj) % gh + gh) % gh;
        for (let di = -rc; di <= rc; di++) {
          const i = ((ci + di) % gw + gw) % gw;
          const dx = this.dx(f.x, (i + 0.5) * CELL), dy = this.dy(f.y, (j + 0.5) * CELL);
          const d2 = dx * dx + dy * dy; if (d2 > reach * reach) continue;
          const d = Math.sqrt(d2) + 1e-3, prof = (d / R) * Math.exp(0.5 * (1 - d2 / (R * R)));
          const c = j * gw + i;
          if (f.type === 'vortex') { this.fu[c] += -dy / d * V * prof; this.fv[c] += dx / d * V * prof; }
          else { this.fu[c] += -dx / d * V * prof; this.fv[c] += -dy / d * V * prof; }
        }
      }
    }
  }

  _advect(src, dst, dtF) {
    const gw = this.gw, gh = this.gh, s = dtF / CELL, fu = this.fu, fv = this.fv, wall = this.wall;
    for (let j = 0; j < gh; j++) {
      const row = j * gw;
      for (let i = 0; i < gw; i++) {
        const c = row + i;
        if (wall[c]) { dst[c] = 0; continue; }
        let x = i - fu[c] * s, y = j - fv[c] * s;
        if (x < 0) x += gw; else if (x >= gw) x -= gw;
        if (y < 0) y += gh; else if (y >= gh) y -= gh;
        const i0 = x | 0, j0 = y | 0, tx = x - i0, ty = y - j0;
        const i1 = i0 + 1 >= gw ? 0 : i0 + 1, j1 = j0 + 1 >= gh ? 0 : j0 + 1;
        const r0 = j0 * gw, r1 = j1 * gw;
        dst[c] = (src[r0 + i0] * (1 - tx) + src[r0 + i1] * tx) * (1 - ty) + (src[r1 + i0] * (1 - tx) + src[r1 + i1] * tx) * ty;
      }
    }
  }

  _diffuse(src, dst, k) {
    const gw = this.gw, gh = this.gh, wall = this.wall, im = this.im, ip = this.ip;
    for (let j = 0; j < gh; j++) {
      const row = j * gw, rm = ((j - 1 + gh) % gh) * gw, rp = ((j + 1) % gh) * gw;
      for (let i = 0; i < gw; i++) {
        const c = row + i;
        if (wall[c]) { dst[c] = 0; continue; }
        const v = src[c];
        let n1 = row + im[i], n2 = row + ip[i], n3 = rm + i, n4 = rp + i;
        const s = (wall[n1] ? v : src[n1]) + (wall[n2] ? v : src[n2]) + (wall[n3] ? v : src[n3]) + (wall[n4] ? v : src[n4]);
        dst[c] = v + k * (s - 4 * v);
      }
    }
  }

  // ── god's brushes on the world ──
  forCells(x, y, r, fn) {
    const gw = this.gw, gh = this.gh, rc = Math.ceil(r / CELL) + 1, ci = (this.wrapX(x) / CELL) | 0, cj = (this.wrapY(y) / CELL) | 0;
    for (let dj = -rc; dj <= rc; dj++) {
      const j = ((cj + dj) % gh + gh) % gh;
      for (let di = -rc; di <= rc; di++) {
        const i = ((ci + di) % gw + gw) % gw;
        const d2 = this.dist2(x, y, (i + 0.5) * CELL, (j + 0.5) * CELL);
        if (d2 <= r * r) fn(j * gw + i, Math.sqrt(d2) / r);
      }
    }
  }
  paintWall(x, y, r, on) {
    let changed = false;
    this.forCells(x, y, r, (c) => {
      if (on && !this.wall[c]) { this.wall[c] = 1; this.nut[c] = 0; this.alg[c] = 0; this.meat[c] = 0; changed = true; }
      else if (!on && this.wall[c]) { this.wall[c] = 0; changed = true; }
    });
    if (changed) this._recountWalls();
    return changed;
  }
  _recountWalls() {
    let n = 0; for (let c = 0; c < this.N; c++) if (this.wall[c]) n++;
    this.wallCount = n; this.openCells = this.N - n; this.wallVersion++;
  }
  isWall(x, y) { return this.wall[this.cellOf(x, y)] === 1; }
  findOpen(x, y) {
    const gw = this.gw, gh = this.gh, ci = (x / CELL) | 0, cj = (y / CELL) | 0;
    for (let r = 1; r < 30; r++) {
      for (let k = 0; k < 8 * r; k++) {
        const a = (k / (8 * r)) * TAU, i = ((ci + Math.round(Math.cos(a) * r)) % gw + gw) % gw, j = ((cj + Math.round(Math.sin(a) * r)) % gh + gh) % gh;
        if (!this.wall[j * gw + i]) return [(i + 0.5) * CELL, (j + 0.5) * CELL];
      }
    }
    return null;
  }
  paintHeat(x, y, r, amt) {
    this.forCells(x, y, r, (c, d) => { if (!this.wall[c]) this.anom[c] = clamp(this.anom[c] + amt * (1 - d * d), -30, 30); });
  }
  paintRad(x, y, r, amt) {
    this.forCells(x, y, r, (c, d) => { if (!this.wall[c]) this.rad[c] = Math.min(1, this.rad[c] + amt * (1 - d * d)); });
  }
  paintManna(x, y, r, amt) {
    this.forCells(x, y, r, (c, d) => { if (!this.wall[c]) this.alg[c] = Math.min(AMAX * 1.15, this.alg[c] + amt * (1 - d * d)); });
  }

  serialize() {
    return {
      W: this.W, H: this.H, nut: f32b64(this.nut), alg: f32b64(this.alg), meat: f32b64(this.meat), wall: u8b64(this.wall),
      anom: f32b64(this.anom), rad: f32b64(this.rad), vents: this.vents, baseMatter: this.baseMatter, matterBonus: this.matterBonus,
    };
  }
  restore(o) {
    this.nut.set(b64f32(o.nut)); this.alg.set(b64f32(o.alg)); this.wall.set(b64u8(o.wall));
    if (o.meat) this.meat.set(b64f32(o.meat));
    this.anom.set(b64f32(o.anom)); this.rad.set(b64f32(o.rad));
    this.vents = o.vents; this._buildVents();
    this.baseMatter = o.baseMatter; this.matterBonus = o.matterBonus || 0;
    this.lastSumN = this.sumNut(); this.lastSumA = this.sumAlg();
    this._recountWalls();
  }
}

// ─── compact binary ⇄ base64 for saving universes ───
function bytesToB64(u8) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}
function b64ToBytes(b) {
  const s = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('binary');
  const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
function f32b64(a) { return bytesToB64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); }
function b64f32(b) { const u8 = b64ToBytes(b); return new Float32Array(u8.buffer, 0, u8.byteLength >> 2); }
function u8b64(a) { return bytesToB64(a); }
function b64u8(b) { return b64ToBytes(b); }
