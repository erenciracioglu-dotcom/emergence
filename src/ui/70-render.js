// ═══════════════════════════════════════════════════════════════════
//  Emergence · the renderer: a microscope's view of the drop
// ═══════════════════════════════════════════════════════════════════
const HUE_BUCKETS = 48;

class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.sw = 1; this.sh = 1;
    this.cam = { x: 0, y: 0, z: 1, zFit: 1 };
    this.camT = null;            // fly-to target {x, y, z}
    this.follow = null;          // creature being followed
    this.glow = []; this.glowWhite = null; this._P = [0, 0];
    this.trailCv = document.createElement('canvas'); this.trailCtx = this.trailCv.getContext('2d');
    this.lastCam = { x: 0, y: 0, z: 0 };
    this.showTrails = true;
    this.fx = new Effects(this);
    this.highlight = null;       // species to highlight
    this.selected = null; this.hover = null;
    this.brush = null;           // {x, y, r, color, kind}
    this.time = 0;
    this.shake = 0; this.flash = 0; this.flashColor = '255,255,255';
    this.quality = 1;
    try { this.calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { this.calm = false; }
    this._makeGlows();
  }

  setUniverse(u) {
    this.u = u;
    const w = u.world;
    this.fieldCv = document.createElement('canvas');
    this.fieldCv.width = w.gw + 2; this.fieldCv.height = w.gh + 2;
    this.fieldCtx = this.fieldCv.getContext('2d');
    this.fieldImg = this.fieldCtx.createImageData(w.gw + 2, w.gh + 2);
    this.midCv = document.createElement('canvas');
    this.midCv.width = (w.gw + 2) * 4; this.midCv.height = (w.gh + 2) * 4;
    this.midCtx = this.midCv.getContext('2d');
    this.rock = new Float32Array(w.N);
    for (let c = 0; c < w.N; c++) this.rock[c] = Math.random();
    this.wallScale = 6;
    this.wallCv = document.createElement('canvas');
    this.wallCv.width = w.gw * this.wallScale; this.wallCv.height = w.gh * this.wallScale;
    this.wallCtx = this.wallCv.getContext('2d');
    this.wallImg = this.wallCtx.createImageData(this.wallCv.width, this.wallCv.height);
    this.wallSeen = -1; this.wallDirty = null;
    this.fieldSeen = -1;
    this.snow = new Float32Array(560 * 3);
    for (let i = 0; i < 560; i++) { this.snow[i * 3] = Math.random() * u.W; this.snow[i * 3 + 1] = Math.random() * u.H; this.snow[i * 3 + 2] = Math.random(); }
    this.fx.reset();
    this.selected = null; this.follow = null; this.highlight = null;
    this.fit(true);
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.sw = Math.max(1, r.width); this.sh = Math.max(1, r.height);
    this.cv.width = Math.round(this.sw * this.dpr * this.quality); this.cv.height = Math.round(this.sh * this.dpr * this.quality);
    const tq = 0.4;
    this.trailCv.width = Math.max(1, Math.round(this.sw * tq)); this.trailCv.height = Math.max(1, Math.round(this.sh * tq));
    if (this.u) this.fit(false);
  }
  get scale() { return this.dpr * this.quality; }

  fit(reset) {
    const u = this.u; if (!u) return;
    const zFit = Math.max(this.sw / u.W, this.sh / u.H);
    const old = this.cam.zFit;
    this.cam.zFit = zFit;
    if (reset) { this.cam.x = u.W / 2; this.cam.y = u.H / 2; this.cam.z = zFit; }
    else this.cam.z = clamp(this.cam.z * (zFit / (old || zFit)), this.zMin, this.zMax);
  }
  get zMin() { return this.cam.zFit * 0.6; }
  get zMax() { return this.cam.zFit * 9; }

  // ── coordinates on a torus ──
  wdx(dx) { const W = this.u.W; dx %= W; if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W; return dx; }
  wdy(dy) { const H = this.u.H; dy %= H; if (dy > H / 2) dy -= H; else if (dy < -H / 2) dy += H; return dy; }
  toScreen(x, y) { return [this.sw / 2 + this.wdx(x - this.cam.x) * this.cam.z, this.sh / 2 + this.wdy(y - this.cam.y) * this.cam.z]; }
  toWorld(sx, sy) {
    const u = this.u;
    return [u.world.wrapX(this.cam.x + (sx - this.sw / 2) / this.cam.z), u.world.wrapY(this.cam.y + (sy - this.sh / 2) / this.cam.z)];
  }
  // call fn(sx, sy) for every on-screen image of a world point (the torus repeats)
  images(x, y, margin, fn) {
    const z = this.cam.z, Wz = this.u.W * z, Hz = this.u.H * z;
    const bx = this.sw / 2 + this.wdx(x - this.cam.x) * z, by = this.sh / 2 + this.wdy(y - this.cam.y) * z;
    for (let ox = -1; ox <= 1; ox++) {
      const sx = bx + ox * Wz; if (sx < -margin || sx > this.sw + margin) continue;
      for (let oy = -1; oy <= 1; oy++) {
        const sy = by + oy * Hz; if (sy < -margin || sy > this.sh + margin) continue;
        fn(sx, sy);
      }
    }
  }

  zoomAt(sx, sy, factor) {
    const [wx, wy] = this.toWorld(sx, sy);
    const nz = clamp(this.cam.z * factor, this.zMin, this.zMax);
    this.cam.z = nz;
    // keep the world point under the cursor
    this.cam.x = this.u.world.wrapX(wx - (sx - this.sw / 2) / nz);
    this.cam.y = this.u.world.wrapY(wy - (sy - this.sh / 2) / nz);
    this.camT = null;
  }
  pan(dsx, dsy) {
    this.cam.x = this.u.world.wrapX(this.cam.x - dsx / this.cam.z);
    this.cam.y = this.u.world.wrapY(this.cam.y - dsy / this.cam.z);
    this.camT = null; this.follow = null;
  }
  flyTo(x, y, zMul) { this.camT = { x, y, z: this.cam.zFit * (zMul || 2.6) }; this.follow = null; }

  _updateCamera(dt) {
    const cam = this.cam, k = 1 - Math.exp(-dt * (this.follow ? 4.5 : 3.2));
    let tx = null, ty = null, tz = null;
    if (this.follow) {
      if (this.follow.dead) { this.follow = null; }
      else { tx = this.follow.x; ty = this.follow.y + (this.followOffsetY || 0) * this.sh / cam.z; tz = this.followZ || null; }
    } else if (this.camT) { tx = this.camT.x; ty = this.camT.y; tz = this.camT.z; }
    if (tx !== null) {
      cam.x = this.u.world.wrapX(cam.x + this.wdx(tx - cam.x) * k);
      cam.y = this.u.world.wrapY(cam.y + this.wdy(ty - cam.y) * k);
      if (tz) cam.z = cam.z * Math.pow(tz / cam.z, k);
      if (this.camT && Math.abs(this.wdx(tx - cam.x)) < 0.5 && Math.abs(this.wdy(ty - cam.y)) < 0.5 && (!tz || Math.abs(tz / cam.z - 1) < 0.01)) this.camT = null;
    }
  }

  // ── glow sprites ──
  _makeGlows() {
    // one atlas of coloured glows: a single image source is much cheaper to draw from
    const S = 64; this.GS = S;
    const at = this.glowAtlas = document.createElement('canvas'); at.width = S * (HUE_BUCKETS + 1); at.height = S;
    const ga = at.getContext('2d');
    for (let b = 0; b < HUE_BUCKETS; b++) {
      const hue = b * 360 / HUE_BUCKETS, cx = b * S + S / 2;
      const gr = ga.createRadialGradient(cx, S / 2, 0, cx, S / 2, S / 2);
      gr.addColorStop(0, `hsla(${hue},95%,70%,0.85)`); gr.addColorStop(0.22, `hsla(${hue},90%,58%,0.38)`);
      gr.addColorStop(0.55, `hsla(${hue},85%,50%,0.08)`); gr.addColorStop(1, `hsla(${hue},80%,50%,0)`);
      ga.fillStyle = gr; ga.fillRect(b * S, 0, S, S);
    }
    { const cx = HUE_BUCKETS * S + S / 2, gr = ga.createRadialGradient(cx, S / 2, 0, cx, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,250,235,0.95)'); gr.addColorStop(0.25, 'rgba(255,236,190,0.4)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
      ga.fillStyle = gr; ga.fillRect(HUE_BUCKETS * S, 0, S, S); }
    this.glowWhite = true;
  }
  glowIndex(h) { return (Math.round(h / 360 * HUE_BUCKETS) % HUE_BUCKETS) * this.GS; }
  drawGlow(ctx, h, x, y, G) { ctx.drawImage(this.glowAtlas, this.glowIndex(h), 0, this.GS, this.GS, x - G, y - G, G * 2, G * 2); }
  drawWhite(ctx, x, y, G) { ctx.drawImage(this.glowAtlas, HUE_BUCKETS * this.GS, 0, this.GS, this.GS, x - G, y - G, G * 2, G * 2); }

  // ── the water itself: light, algae, matter, carrion, heat ──
  _paintField() {
    const u = this.u, w = u.world, gw = w.gw, gh = w.gh, N = w.N, iw = gw + 2;
    if (!this.fR || this.fR.length !== N) { this.fR = new Float32Array(N); this.fG = new Float32Array(N); this.fB = new Float32Array(N); this.fT = new Float32Array(N); }
    const R = this.fR, G = this.fG, B = this.fB;
    const alg = w.alg, nut = w.nut, meat = w.meat, light = w.light, temp = w.temp, anom = w.anom, rad = w.rad, wall = w.wall, vh = w.ventHeat;
    const sun = Math.max(0.05, u.laws.sun);
    const flick = 0.85 + 0.15 * Math.sin(this.time * 9);
    for (let c = 0; c < N; c++) {
      if (wall[c]) { const n = this.rock[c]; R[c] = 16 + n * 6; G[c] = 17 + n * 6; B[c] = 22 + n * 7; continue; }
      const L = light[c] / sun, lv = L > 1 ? 1 : L;
      const T = temp[c], tw = T < 0 ? 0 : T > 32 ? 1 : T / 32;
      const lf = 0.3 + 0.85 * lv;
      let r = (6 + 9 * tw) * lf + 9 * lv, g = (12 + 5 * (1 - tw)) * lf + 11 * lv, b = (28 - 6 * tw) * lf + 7 * lv;
      const A = alg[c], a = A / (A + 6) * 0.95;
      const day = lv * 1.3 > 1 ? 1 : lv * 1.3;
      r += (30 * day + 8 * (1 - day)) * a; g += (150 * day + 105 * (1 - day)) * a; b += (105 * day + 190 * (1 - day)) * a;
      const Nn = nut[c], nn = Nn / (Nn + 30) * 0.3;
      r += 42 * nn * lf; g += 14 * nn * lf; b += 64 * nn * lf;
      const M = meat[c];
      if (M > 0.05) { const m = M / (M + 8) * 0.5; r += 64 * m; g += 24 * m; b += 12 * m; }
      const v = vh[c]; if (v > 0.2) { r += 3.4 * v; g += 1.2 * v; }
      const an = anom[c];
      if (an > 0) { r += 5.5 * an; g += 2 * an; } else if (an < 0) { r -= 0.5 * an; g -= 2.4 * an; b -= 4.8 * an; }
      const rd = rad[c]; if (rd > 0) { r += 85 * rd * flick; g += 95 * rd * flick; b += 10 * rd; }
      R[c] = r; G[c] = g; B[c] = b;
    }
    this._blur(R); this._blur(G); this._blur(B);
    const d = this.fieldImg.data;
    for (let j = 0; j < gh + 2; j++) {
      const sj = j === 0 ? gh - 1 : j === gh + 1 ? 0 : j - 1, row = sj * gw;
      for (let i = 0; i < iw; i++) {
        const si = i === 0 ? gw - 1 : i === gw + 1 ? 0 : i - 1, c = row + si, p = (j * iw + i) * 4;
        d[p] = R[c]; d[p + 1] = G[c]; d[p + 2] = B[c]; d[p + 3] = 255;
      }
    }
    this.fieldCtx.putImageData(this.fieldImg, 0, 0);
    // a second, larger smoothing pass: two bilinear stretches read like a soft spline
    const m = this.midCv, mc = this.midCtx;
    mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
    mc.drawImage(this.fieldCv, 0, 0, iw, gh + 2, 0, 0, m.width, m.height);
  }
  _blur(a) {
    const gw = this.u.world.gw, gh = this.u.world.gh, t = this.fT, im = this.u.world.im, ip = this.u.world.ip;
    for (let j = 0; j < gh; j++) { const row = j * gw; for (let i = 0; i < gw; i++) t[row + i] = (a[row + im[i]] + 2 * a[row + i] + a[row + ip[i]]) * 0.25; }
    for (let j = 0; j < gh; j++) {
      const row = j * gw, rm = ((j - 1 + gh) % gh) * gw, rp = ((j + 1) % gh) * gw;
      for (let i = 0; i < gw; i++) a[row + i] = (t[rm + i] + 2 * t[row + i] + t[rp + i]) * 0.25;
    }
  }

  _paintWalls() {
    const w = this.u.world, S = this.wallScale, gw = w.gw, gh = w.gh, W2 = gw * S, d = this.wallImg.data;
    let x0 = 0, y0 = 0, x1 = W2, y1 = gh * S;
    if (this.wallDirty && this.wallSeen >= 0) {
      const r = this.wallDirty;
      x0 = Math.max(0, Math.floor((r.x0 / CELL - 2) * S)); x1 = Math.min(W2, Math.ceil((r.x1 / CELL + 2) * S));
      y0 = Math.max(0, Math.floor((r.y0 / CELL - 2) * S)); y1 = Math.min(gh * S, Math.ceil((r.y1 / CELL + 2) * S));
      if (r.wrap) { x0 = 0; y0 = 0; x1 = W2; y1 = gh * S; }
    }
    const wall = w.wall;
    const sampleW = (fx, fy) => {
      fx -= 0.5; fy -= 0.5;
      let i0 = Math.floor(fx), j0 = Math.floor(fy); const tx = fx - i0, ty = fy - j0;
      const i1 = ((i0 + 1) % gw + gw) % gw, j1 = ((j0 + 1) % gh + gh) % gh; i0 = (i0 % gw + gw) % gw; j0 = (j0 % gh + gh) % gh;
      return (wall[j0 * gw + i0] * (1 - tx) + wall[j0 * gw + i1] * tx) * (1 - ty) + (wall[j1 * gw + i0] * (1 - tx) + wall[j1 * gw + i1] * tx) * ty;
    };
    const soft = (fx, fy) => (sampleW(fx, fy) * 2 + sampleW(fx + 0.6, fy) + sampleW(fx - 0.6, fy) + sampleW(fx, fy + 0.6) + sampleW(fx, fy - 0.6)) / 6;
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const fx = (px + 0.5) / S, fy = (py + 0.5) / S;
        const v = soft(fx, fy), p = (py * W2 + px) * 4;
        if (v < 0.36) { d[p + 3] = 0; continue; }
        const a = smoothstep(0.36, 0.52, v);
        const gx = soft(fx + 0.4, fy) - soft(fx - 0.4, fy), gy = soft(fx, fy + 0.4) - soft(fx, fy - 0.4);
        const rim = (1 - smoothstep(0.5, 0.9, v));
        const lit = clamp(-gx * 1.2 - gy * 1.5, -1, 1);
        const n = this.rock[(Math.floor(fy) % gh) * gw + (Math.floor(fx) % gw)] * 0.45 + Math.random() * 0.55;
        const base = 17 + n * 13;
        d[p] = base + 26 * rim + 26 * lit; d[p + 1] = base + 3 + 24 * rim + 22 * lit; d[p + 2] = base + 10 + 26 * rim + 18 * lit;
        d[p + 3] = 255 * a;
      }
    }
    this.wallCtx.putImageData(this.wallImg, 0, 0);
    this.wallSeen = w.wallVersion; this.wallDirty = null;
  }
  markWallDirty(x, y, r) {
    const W = this.u.W, H = this.u.H;
    const box = { x0: x - r, y0: y - r, x1: x + r, y1: y + r, wrap: x - r < 0 || y - r < 0 || x + r > W || y + r > H };
    if (!this.wallDirty) this.wallDirty = box;
    else { const b = this.wallDirty; b.x0 = Math.min(b.x0, box.x0); b.y0 = Math.min(b.y0, box.y0); b.x1 = Math.max(b.x1, box.x1); b.y1 = Math.max(b.y1, box.y1); b.wrap = b.wrap || box.wrap; }
  }

  // draw a texture covering the whole world, tiled across the torus
  _tileWorld(img, sx, sy, sw, sh) {
    const ctx = this.ctx, z = this.cam.z, Wz = this.u.W * z, Hz = this.u.H * z;
    const X0 = this.sw / 2 - this.cam.x * z, Y0 = this.sh / 2 - this.cam.y * z;
    const k0 = Math.floor(-X0 / Wz), l0 = Math.floor(-Y0 / Hz);
    for (let k = k0; X0 + k * Wz < this.sw; k++) {
      for (let l = l0; Y0 + l * Hz < this.sh; l++) {
        ctx.drawImage(img, sx, sy, sw, sh, X0 + k * Wz, Y0 + l * Hz, Wz + 0.6, Hz + 0.6);
      }
    }
  }

  // ── a frame ──
  draw(dt, simDt) {
    const u = this.u, ctx = this.ctx, S = this.scale;
    this.time += dt;
    this._updateCamera(dt);
    let shx = 0, shy = 0;
    if (this.calm) { this.shake = 0; this.flash = Math.min(this.flash, 0.15); }
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2.5); const m = this.shake * this.shake * 14; shx = (Math.random() - 0.5) * m; shy = (Math.random() - 0.5) * m; }
    ctx.setTransform(S, 0, 0, S, shx * S, shy * S);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#04060c'; ctx.fillRect(-20, -20, this.sw + 40, this.sh + 40);

    // the water
    this._paintField();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    this._tileWorld(this.midCv, 4, 4, u.world.gw * 4, u.world.gh * 4);
    if (u.world.wallCount > 0 || this.wallSeen >= 0) {
      if (this.wallSeen !== u.world.wallVersion) this._paintWalls();
      if (u.world.wallCount > 0) this._tileWorld(this.wallCv, 0, 0, this.wallCv.width, this.wallCv.height);
    }
    this._drawVents(ctx);
    this._drawForces(ctx);
    this._drawSnow(ctx, simDt);

    // trails
    const camMoved = Math.abs(this.cam.x - this.lastCam.x) > 0.01 || Math.abs(this.cam.y - this.lastCam.y) > 0.01 || Math.abs(this.cam.z - this.lastCam.z) > 1e-4;
    this.lastCam.x = this.cam.x; this.lastCam.y = this.cam.y; this.lastCam.z = this.cam.z;
    if (this.showTrails) this._drawTrails(ctx, camMoved, simDt);

    this._drawCreatures(ctx);
    this.fx.draw(ctx, dt, simDt);
    this._drawOverlays(ctx);

    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, this.flash);
      ctx.fillStyle = `rgba(${this.flashColor},0.55)`; ctx.fillRect(-20, -20, this.sw + 40, this.sh + 40);
      this.flash = Math.max(0, this.flash - dt * 3.2);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }

  _drawVents(ctx) {
    const z = this.cam.z;
    ctx.globalCompositeOperation = 'lighter';
    for (const v of this.u.world.vents) {
      this.images(v.x, v.y, 120 * z, (sx, sy) => {
        const pulse = 0.75 + 0.25 * Math.sin(this.time * 1.3 + v.x);
        ctx.globalAlpha = 0.16 * pulse;
        const R = 70 * z;
        this.drawGlow(ctx, 22, sx, sy, R);
        ctx.globalAlpha = 0.35 * pulse;
        const r2 = 14 * z; this.drawWhite(ctx, sx, sy, r2);
      });
      if (Math.random() < 0.35) this.fx.bubble(v.x + (Math.random() - 0.5) * 30, v.y + (Math.random() - 0.5) * 30);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  _drawForces(ctx) {
    const z = this.cam.z, t = this.time;
    ctx.lineCap = 'round';
    for (const f of this.u.forces) {
      this.images(f.x, f.y, f.R * 2.6 * z, (sx, sy) => {
        const R = f.R * z;
        ctx.globalCompositeOperation = 'lighter';
        if (f.type === 'vortex') {
          ctx.strokeStyle = 'rgba(150,200,255,0.16)'; ctx.lineWidth = Math.max(1, 2.2 * z);
          for (let arm = 0; arm < 3; arm++) {
            ctx.beginPath();
            for (let k = 0; k <= 40; k++) {
              const s = k / 40, a = arm * TAU / 3 + f.s * (t * 1.4) + s * 4.2 * f.s, rr = R * (0.15 + 1.6 * s);
              const x = sx + Math.cos(a) * rr, y = sy + Math.sin(a) * rr;
              k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
          }
        } else {
          for (let k = 0; k < 4; k++) {
            let ph = ((t * 0.35 * f.s) + k / 4) % 1; if (ph < 0) ph += 1;
            const rr = R * 2.2 * (f.s > 0 ? 1 - ph : ph);
            ctx.strokeStyle = f.s > 0 ? `rgba(200,170,255,${0.22 * Math.sin(ph * Math.PI)})` : `rgba(255,200,150,${0.22 * Math.sin(ph * Math.PI)})`;
            ctx.lineWidth = Math.max(1, 1.6 * z);
            ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, rr), 0, TAU); ctx.stroke();
          }
          ctx.globalAlpha = 0.5; const r2 = 10 * z; this.drawWhite(ctx, sx, sy, r2); ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = 'source-over';
      });
    }
  }

  _drawSnow(ctx, simDt) {
    const u = this.u, w = u.world, s = this.snow, n = s.length / 3, z = this.cam.z;
    const mv = Math.min(simDt, 0.25), sw = this.sw, sh = this.sh, Wz = u.W * z, Hz = u.H * z;
    const P = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < n; i++) {
      let x = s[i * 3], y = s[i * 3 + 1];
      if (mv > 0) {
        const c = w.cellOf(x, y);
        x = w.wrapX(x + w.fu[c] * mv * 1.1 + (Math.random() - 0.5) * 2 * mv);
        y = w.wrapY(y + w.fv[c] * mv * 1.1 + (Math.random() - 0.5) * 2 * mv);
        if (w.wall[w.cellOf(x, y)]) { x = Math.random() * u.W; y = Math.random() * u.H; }
        s[i * 3] = x; s[i * 3 + 1] = y;
      }
      const tw = s[i * 3 + 2];
      const a = tw * (0.6 + 0.4 * Math.sin(this.time * (0.5 + tw) + i));
      const lvl = a < 0.25 ? 0 : a < 0.5 ? 1 : a < 0.75 ? 2 : 3;
      const sz = Math.max(0.7, (0.5 + tw) * z * 0.9);
      const bx = sw / 2 + this.wdx(x - this.cam.x) * z, by = sh / 2 + this.wdy(y - this.cam.y) * z;
      for (let ox = -Wz; ox <= Wz; ox += Wz) {
        const sx = bx + ox; if (sx < -4 || sx > sw + 4) continue;
        for (let oy = -Hz; oy <= Hz; oy += Hz) { const sy = by + oy; if (sy < -4 || sy > sh + 4) continue; P[lvl].rect(sx, sy, sz, sz); }
      }
    }
    ctx.fillStyle = 'rgb(200,220,255)';
    for (let k = 0; k < 4; k++) { ctx.globalAlpha = 0.07 + k * 0.06; ctx.fill(P[k]); }
    ctx.globalAlpha = 1;
  }

  _drawTrails(ctx, camMoved, simDt) {
    const tc = this.trailCtx, tw = this.trailCv.width, th = this.trailCv.height, k = tw / this.sw;
    if (camMoved) tc.clearRect(0, 0, tw, th);
    if (simDt > 0) {
      tc.globalCompositeOperation = 'destination-out';
      tc.fillStyle = `rgba(0,0,0,${Math.min(0.5, 0.09 + simDt * 1.5)})`; tc.fillRect(0, 0, tw, th);
      tc.globalCompositeOperation = 'source-over';
      const z = this.cam.z, sw = this.sw, sh = this.sh, Wz = this.u.W * z, Hz = this.u.H * z, reg = this.u.species, hl = this.highlight;
      const paths = new Map();
      for (const c of this.u.creatures) {
        if (hl && c.sp !== hl && reg.displayOf(c.sp) !== hl) continue;
        const key = ((c.hue / 15) | 0) * 2 + (c.sat > 60 ? 1 : 0);
        let p = paths.get(key); if (!p) { p = new Path2D(); paths.set(key, p); }
        const r = Math.max(0.6, c.r * z * 0.32) * k;
        const bx = sw / 2 + this.wdx(c.x - this.cam.x) * z, by = sh / 2 + this.wdy(c.y - this.cam.y) * z;
        for (let ox = -Wz; ox <= Wz; ox += Wz) {
          const sx = bx + ox; if (sx < -10 || sx > sw + 10) continue;
          for (let oy = -Hz; oy <= Hz; oy += Hz) { const sy = by + oy; if (sy < -10 || sy > sh + 10) continue; p.moveTo(sx * k + r, sy * k); p.arc(sx * k, sy * k, r, 0, TAU); }
        }
      }
      for (const [key, p] of paths) { tc.fillStyle = `hsla(${(key >> 1) * 15 + 7},${key & 1 ? 75 : 45}%,60%,0.5)`; tc.fill(p); }
    }
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.trailCv, 0, 0, this.sw, this.sh);
    ctx.globalAlpha = 1;
  }

  _cols(c) {
    const ef = c.E / c.Emax, q = (Math.round(ef * 8) << 10) | Math.round(c.hue) | (c.infected > 0 ? 1 << 14 : 0);
    if (q === c._cq) return;
    c._cq = q;
    const h = Math.round(c.hue), s = Math.round(c.infected > 0 ? c.sat * 0.4 : c.sat), l = Math.round(13 + 30 * Math.min(1, ef));
    c.colBody = `hsl(${h},${s}%,${l}%)`;
    c.colEdge = `hsl(${h},${Math.min(100, s + 12)}%,${Math.round(52 + 16 * Math.min(1, ef))}%)`;
    c.colCore = `hsl(${h},${Math.max(10, s - 8)}%,82%)`;
    c.colTail = `hsla(${h},${s}%,70%,0.7)`;
    c.colTrail = `hsla(${h},${s}%,60%,0.5)`;
  }

  // creatures are drawn in batches: one path per colour bucket, so hundreds of
  // bodies cost a few dozen draw calls
  _drawCreatures(ctx) {
    const u = this.u, cs = u.creatures, z = this.cam.z, S = this.scale, hl = this.highlight, reg = u.species;
    const sw = this.sw, sh = this.sh, Wz = u.W * z, Hz = u.H * z;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    // glow
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cs) {
      const dim = hl && c.sp !== hl && reg.displayOf(c.sp) !== hl;
      const ef = c.E / c.Emax, a = (dim ? 0.16 : 1) * (0.16 + 0.34 * ef + (c.flash > 0 ? c.flash * 0.6 : 0) + (c.biteT > 0 ? 0.2 : 0));
      const G = (c.r * 3 + 3) * z + 4, gi = this.glowIndex(c.hue), GS = this.GS, atlas = this.glowAtlas;
      const bx = sw / 2 + this.wdx(c.x - this.cam.x) * z, by = sh / 2 + this.wdy(c.y - this.cam.y) * z;
      for (let ox = -Wz; ox <= Wz; ox += Wz) {
        const sx = bx + ox; if (sx < -G || sx > sw + G) continue;
        for (let oy = -Hz; oy <= Hz; oy += Hz) {
          const sy = by + oy; if (sy < -G || sy > sh + G) continue;
          ctx.globalAlpha = a > 1 ? 1 : a; ctx.drawImage(atlas, gi, 0, GS, GS, sx - G, sy - G, G * 2, G * 2);
          if (c.flash > 0) { ctx.globalAlpha = Math.min(1, c.flash) * 0.8; const F = G * 0.8; this.drawWhite(ctx, sx, sy, F); }
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // bodies
    const B = new Map(), Tl = new Map();
    const chloro = new Path2D(), plates = new Path2D(), eyeW = new Path2D(), eyeB = new Path2D(), sick = new Path2D(), jawsRed = new Path2D();
    const jaws = [null, new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()], jawsDim = new Path2D();
    const getB = (k) => { let b = B.get(k); if (!b) { b = { edge: new Path2D(), body: new Path2D(), core: new Path2D() }; B.set(k, b); } return b; };
    const getT = (k) => { let b = Tl.get(k); if (!b) { b = new Path2D(); Tl.set(k, b); } return b; };
    const t = this.time;
    for (const c of cs) {
      const r = c.r * z, M = r * 5 + 8;
      const bx = sw / 2 + this.wdx(c.x - this.cam.x) * z, by = sh / 2 + this.wdy(c.y - this.cam.y) * z;
      const dim = hl && c.sp !== hl && reg.displayOf(c.sp) !== hl ? 1 : 0;
      const hb = Math.round(c.hue / 15) % 24, sb = c.sat > 60 ? 1 : 0, ef = c.E / c.Emax, lb = ef < 0.34 ? 0 : ef < 0.67 ? 1 : 2, sk = c.infected > 0 ? 1 : 0;
      const key = hb | sb << 5 | lb << 6 | dim << 8 | sk << 9;
      const co = c.hx, si = c.hy, el = c.elong, rx = r * el, ry = r / Math.sqrt(el);
      for (let ox = -Wz; ox <= Wz; ox += Wz) {
        const sx = bx + ox; if (sx < -M || sx > sw + M) continue;
        for (let oy = -Hz; oy <= Hz; oy += Hz) {
          const sy = by + oy; if (sy < -M || sy > sh + M) continue;
          const b = getB(key);
          if (r < 1.7) { b.edge.rect(sx - 1, sy - 1, 2, 2); continue; }
          const P = this._P; const L = (lx, ly) => { P[0] = sx + lx * co - ly * si; P[1] = sy + lx * si + ly * co; return P; };
          // flagellum
          if (r > 2.4) {
            const wc = Math.min(5, Math.max(1, Math.round(r * 0.2 * 2)));
            const tp = getT(hb | sb << 5 | dim << 6 | wc << 7 | 1 << 11);
            const len = r * (1.1 + 2.2 * c.speedG), amp = r * 0.32, x0 = -rx * 0.85;
            let p = L(x0, 0); tp.moveTo(p[0], p[1]);
            for (let k = 1; k <= 5; k++) { const q = k / 5; p = L(x0 - len * q, Math.sin(c.tail * 6 - q * 5.5) * amp * q); tp.lineTo(p[0], p[1]); }
          }
          // jaws
          if (c.diet > 0.36 && r > 3) {
            // a pair of curved mandibles, open wide while biting
            const wc = Math.min(6, Math.max(1, Math.round(r * 0.14 * 2)));
            const jp = dim ? jawsDim : c.biteT > 0 ? jawsRed : jaws[wc];
            const open = c.biteT > 0 ? 0.5 : 0.12 + 0.05 * Math.sin(c.oscPh * 2), len = r * (0.4 + 0.9 * (c.diet - 0.3));
            for (let sg = -1; sg <= 1; sg += 2) {
              let q = L(rx * 0.86, sg * ry * 0.36); jp.moveTo(q[0], q[1]);
              q = L(rx + len * 0.55, sg * ry * (0.78 + open)); const qx = q[0], qy = q[1];
              q = L(rx + len, sg * ry * (0.16 + open * 0.6)); jp.quadraticCurveTo(qx, qy, q[0], q[1]);
            }
          }
          // membrane and cytoplasm
          const e = Math.max(0.8, r * (0.11 + 0.22 * c.armor));
          b.edge.moveTo(sx + (rx + e) * co, sy + (rx + e) * si); b.edge.ellipse(sx, sy, rx + e, ry + e, c.h, 0, TAU);
          b.body.moveTo(sx + rx * co, sy + rx * si); b.body.ellipse(sx, sy, rx, ry, c.h, 0, TAU);
          if (r < 3.2) continue;
          const nc = L(-rx * 0.18, 0); b.core.moveTo(nc[0] + r * 0.28, nc[1]); b.core.arc(nc[0], nc[1], r * 0.28, 0, TAU);
          if (c.photo > 0.14 && r > 4) {
            const n = 2 + Math.round(c.photo * 6), rr = r * 0.13;
            for (let k = 0; k < n; k++) { const a = k / n * TAU + 0.4, p = L(Math.cos(a) * rx * 0.58, Math.sin(a) * ry * 0.55); chloro.moveTo(p[0] + rr, p[1]); chloro.arc(p[0], p[1], rr, 0, TAU); }
          }
          if (c.armor > 0.3 && r > 4) {
            for (let k = 0; k < 6; k++) { const a0 = k * TAU / 6 + 0.18, p = L(Math.cos(a0) * rx * 1.2, Math.sin(a0) * ry * 1.2); plates.moveTo(p[0], p[1]); plates.ellipse(sx, sy, rx * 1.2, ry * 1.2, c.h, a0, a0 + 0.62); }
          }
          if (r > 5.5) {
            const ex = rx * 0.52, ey = ry * 0.46, er = r * 0.15, look = c.inp[I_PREY_S] * 0.4 - c.inp[I_THR_S] * 0.4;
            for (const sg of [1, -1]) {
              let p = L(ex, sg * ey); eyeW.moveTo(p[0] + er, p[1]); eyeW.arc(p[0], p[1], er, 0, TAU);
              p = L(ex + er * 0.35, sg * ey + er * look); eyeB.moveTo(p[0] + er * 0.52, p[1]); eyeB.arc(p[0], p[1], er * 0.52, 0, TAU);
            }
          }
          if (sk) {
            for (let k = 0; k < 4; k++) { const a = t * 3 + k * TAU / 4, p = L(Math.cos(a) * rx * 1.25, Math.sin(a) * ry * 1.25), rr = Math.max(0.8, r * 0.12); sick.moveTo(p[0] + rr, p[1]); sick.arc(p[0], p[1], rr, 0, TAU); }
          }
        }
      }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [k, p] of Tl) {
      const hue = (k & 31) * 15, sat = k >> 5 & 1 ? 76 : 46, dim = k >> 6 & 1, wc = k >> 7 & 15, tail = k >> 11 & 1;
      ctx.globalAlpha = dim ? 0.16 : 1;
      ctx.strokeStyle = tail ? `hsla(${hue},${sat}%,70%,0.7)` : `hsl(${hue},${Math.min(100, sat + 12)}%,64%)`;
      ctx.lineWidth = Math.max(0.7, wc / 2); ctx.stroke(p);
    }
    for (const [k, b] of B) {
      const hue = (k & 31) * 15, sat0 = k >> 5 & 1 ? 76 : 46, lb = k >> 6 & 3, dim = k >> 8 & 1, sk = k >> 9 & 1;
      const sat = sk ? sat0 * 0.4 : sat0;
      ctx.globalAlpha = dim ? 0.16 : 1;
      ctx.fillStyle = `hsl(${hue},${Math.min(100, sat + 12)}%,${54 + lb * 7}%)`; ctx.fill(b.edge);
      ctx.fillStyle = `hsl(${hue},${sat}%,${15 + lb * 12}%)`; ctx.fill(b.body);
      ctx.fillStyle = `hsl(${hue},${Math.max(10, sat - 8)}%,82%)`; ctx.globalAlpha = (dim ? 0.16 : 1) * 0.85; ctx.fill(b.core);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(120,230,120,0.85)'; ctx.fill(chloro);
    ctx.strokeStyle = 'rgba(236,230,214,0.55)'; ctx.lineWidth = Math.max(0.8, 1.2 * z); ctx.stroke(plates);
    ctx.strokeStyle = 'rgba(246,236,214,0.92)';
    for (let k = 1; k <= 6; k++) { ctx.lineWidth = k / 2; ctx.stroke(jaws[k]); }
    ctx.lineWidth = 1; ctx.globalAlpha = 0.16; ctx.stroke(jawsDim); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ff7a5c'; ctx.lineWidth = Math.max(1.2, 1.5 * z); ctx.stroke(jawsRed);
    ctx.fillStyle = '#f2efe6'; ctx.fill(eyeW); ctx.fillStyle = '#0a0c14'; ctx.fill(eyeB);
    ctx.fillStyle = 'rgba(214,240,90,0.9)'; ctx.fill(sick);
  }

  _drawOverlays(ctx) {
    const S = this.scale, z = this.cam.z, u = this.u;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    // sharing beams and bites
    ctx.lineCap = 'round';
    for (const c of u.creatures) {
      if (c.shareT > 0 && c.shareTarget && !c.shareTarget.dead) {
        const t = c.shareTarget, dx = this.wdx(t.x - c.x) * z, dy = this.wdy(t.y - c.y) * z;
        this.images(c.x, c.y, 60, (sx, sy) => {
          ctx.globalAlpha = Math.min(1, c.shareT * 3) * 0.75;
          ctx.strokeStyle = 'rgba(255,214,130,1)'; ctx.lineWidth = Math.max(1, 1.4 * z);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + dx, sy + dy); ctx.stroke();
          const ph = (this.time * 2.2 + c.id * 0.13) % 1;
          ctx.fillStyle = '#fff1c9'; ctx.beginPath(); ctx.arc(sx + dx * ph, sy + dy * ph, Math.max(1.2, 1.8 * z), 0, TAU); ctx.fill();
        });
      }
      if (c.biteT > 0 && c.biteTarget && !c.biteTarget.dead) {
        const t = c.biteTarget;
        this.images(t.x, t.y, 40, (sx, sy) => {
          ctx.globalAlpha = Math.min(1, c.biteT * 4) * 0.8;
          ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = Math.max(1, 1.6 * z);
          ctx.beginPath(); ctx.arc(sx, sy, t.r * z * 1.45 + 2, 0, TAU); ctx.stroke();
        });
        if (Math.random() < 0.12) this.fx.blood(t.x, t.y);
      }
    }
    ctx.globalAlpha = 1;
    // highlighted species labels
    if (this.highlight && z > this.cam.zFit * 0.9) {
      ctx.font = 'italic 12px "IM Fell English", Georgia, serif'; ctx.textAlign = 'center';
      let k = 0;
      for (const c of u.creatures) {
        if (c.sp !== this.highlight && u.species.displayOf(c.sp) !== this.highlight) continue;
        if (++k % 6) continue;
        this.images(c.x, c.y, 30, (sx, sy) => { ctx.fillStyle = 'rgba(236,230,214,0.55)'; ctx.fillText('•', sx, sy - c.r * z - 6); });
      }
    }
    // selection
    const sel = this.selected;
    if (sel) {
      const alive = !sel.dead;
      this.images(sel.x, sel.y, 80, (sx, sy) => {
        const R = sel.r * z * 2.1 + 9, rot = this.time * 0.8;
        ctx.strokeStyle = alive ? 'rgba(232,196,120,0.95)' : 'rgba(200,190,170,0.5)'; ctx.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(sx, sy, R, rot + k * TAU / 4, rot + k * TAU / 4 + 0.95); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(sx, sy, R + 5, 0, TAU); ctx.strokeStyle = 'rgba(232,196,120,0.18)'; ctx.stroke();
        if (alive && sel.senseR * z > 30) {
          ctx.setLineDash([2, 6]); ctx.strokeStyle = 'rgba(232,196,120,0.22)';
          ctx.beginPath(); ctx.arc(sx, sy, sel.senseR * z, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
      });
    }
    const hv = this.hover;
    if (hv && hv !== sel && !hv.dead) {
      this.images(hv.x, hv.y, 40, (sx, sy) => {
        ctx.strokeStyle = 'rgba(236,230,214,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, hv.r * z * 1.9 + 6, 0, TAU); ctx.stroke();
      });
    }
    // god's brush
    const b = this.brush;
    if (b) {
      this.images(b.x, b.y, b.r * z + 10, (sx, sy) => {
        ctx.strokeStyle = b.color; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.9;
        ctx.setLineDash(b.dash ? [4, 5] : []);
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(4, b.r * z), 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(sx, sy, 2, 0, TAU); ctx.fillStyle = b.color; ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
  }

  creatureAt(sx, sy, slop) {
    const [wx, wy] = this.toWorld(sx, sy);
    const u = this.u, w = u.world;
    let best = null, bd = Infinity;
    for (const c of u.creatures) {
      const d2 = w.dist2(wx, wy, c.x, c.y), R = c.r + slop / this.cam.z;
      if (d2 < R * R && d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }

  snapshotBlob() {
    return new Promise(res => { try { this.cv.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } });
  }
}

function copyPx(d, iw, dx, dy, sx, sy) {
  const p = (dy * iw + dx) * 4, q = (sy * iw + sx) * 4;
  d[p] = d[q]; d[p + 1] = d[q + 1]; d[p + 2] = d[q + 2]; d[p + 3] = 255;
}
