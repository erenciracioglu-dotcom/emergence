// ═══════════════════════════════════════════════════════════════════
//  Emergence · effects: sparks of life, deaths, alarms, wrath
// ═══════════════════════════════════════════════════════════════════
class Effects {
  constructor(r) { this.r = r; this.reset(); }
  reset() { this.parts = []; this.rings = []; this.bolts = []; this.meteors = []; this.ghosts = []; this.sparks = []; }

  add(x, y, vx, vy, life, size, color, glow) {
    if (this.parts.length > 1600) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, color, glow: !!glow });
  }
  ring(x, y, r0, r1, life, color, width) { if (this.rings.length < 260) this.rings.push({ x, y, r0, r1, life, max: life, color, width: width || 1.2 }); }
  bubble(x, y) {
    if (this.parts.length > 1400) return;
    const a = Math.random() * TAU, s = 4 + Math.random() * 6;
    this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, 2 + Math.random() * 2, 0.9 + Math.random(), 'rgba(255,196,140,1)', true);
  }
  blood(x, y) {
    for (let k = 0; k < 2; k++) { const a = Math.random() * TAU, s = 8 + Math.random() * 18; this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.4, 1.3, 'rgba(255,90,60,1)', true); }
  }
  dust(x, y, color) {
    for (let k = 0; k < 3; k++) { const a = Math.random() * TAU, s = 6 + Math.random() * 14; this.add(x + Math.cos(a) * 6, y + Math.sin(a) * 6, Math.cos(a) * s, Math.sin(a) * s, 0.6 + Math.random() * 0.6, 1.4, color, false); }
  }

  // drain the universe's event queues into visible effects
  consume(u) {
    const f = u.fx, R = this.r;
    for (const b of f.births) this.ring(b.x, b.y, 2, 12, 0.6, `hsla(${b.hue},90%,72%,`, 1);
    for (const d of f.deaths) {
      if (d.cause === 'engulfed' || d.cause === 'meteor') continue;
      this.ghosts.push({ x: d.x, y: d.y, r: d.r, hue: d.hue, sat: d.sat, cause: d.cause, life: 1.1, max: 1.1 });
      if (d.cause === 'eaten') for (let k = 0; k < 7; k++) { const a = Math.random() * TAU, s = 10 + Math.random() * 26; this.add(d.x, d.y, Math.cos(a) * s, Math.sin(a) * s, 0.7 + Math.random() * 0.5, 1.6, 'rgba(255,96,64,1)', true); }
      else if (d.cause === 'plague') for (let k = 0; k < 5; k++) { const a = Math.random() * TAU, s = 4 + Math.random() * 10; this.add(d.x, d.y, Math.cos(a) * s, Math.sin(a) * s, 1.4, 1.3, 'rgba(214,240,90,1)', true); }
      else if (d.cause === 'smitten') for (let k = 0; k < 10; k++) { const a = Math.random() * TAU, s = 20 + Math.random() * 50; this.add(d.x, d.y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.4, 1.5, 'rgba(230,240,255,1)', true); }
      else for (let k = 0; k < 4; k++) { const a = Math.random() * TAU, s = 3 + Math.random() * 6; this.add(d.x, d.y, Math.cos(a) * s, Math.sin(a) * s, 1.6, 1.2, `hsla(${d.hue},40%,70%,1)`, false); }
    }
    for (const a of f.alarms) this.ring(a.x, a.y, 6, 240, 1.0, `hsla(${a.hue},80%,75%,`, 1.1);
    for (const s of f.sparks) {
      this.sparks.push({ x: s.x, y: s.y, hue: s.hue, life: 2.2, max: 2.2, fired: false });
      for (let k = 0; k < 46; k++) {
        const a = Math.random() * TAU, d = 50 + Math.random() * 110, t = 0.9 + Math.random() * 0.5;
        this.add(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, -Math.cos(a) * d / t, -Math.sin(a) * d / t, t, 1.3, 'rgba(255,236,190,1)', true);
      }
    }
    for (const b of f.bolts) {
      const pts = []; let x = (Math.random() - 0.5) * 0.25;
      for (let k = 0; k <= 14; k++) { pts.push(x); x += (Math.random() - 0.5) * 0.11; }
      const branch = []; let bx = pts[6]; for (let k = 0; k <= 6; k++) { branch.push(bx); bx += (Math.random() - 0.3) * 0.12; }
      this.bolts.push({ x: b.x, y: b.y, pts, branch, life: 0.45, max: 0.45 });
      R.flash = Math.max(R.flash, 0.38); R.flashColor = '225,235,255'; R.shake = Math.max(R.shake, 0.35);
      this.ring(b.x, b.y, 4, 90, 0.5, 'rgba(220,235,255,', 2);
    }
    for (const m of f.meteors) this.meteors.push({ x: m.x, y: m.y, life: m.dur, max: m.dur });
    for (const m of f.impacts) {
      R.flash = 1; R.flashColor = '255,214,160'; R.shake = 1.2;
      this.ring(m.x, m.y, 10, 300, 1.4, 'rgba(255,200,140,', 5);
      this.ring(m.x, m.y, 4, 160, 0.9, 'rgba(255,250,230,', 3);
      for (let k = 0; k < 90; k++) {
        const a = Math.random() * TAU, s = 40 + Math.random() * 220;
        this.add(m.x, m.y, Math.cos(a) * s, Math.sin(a) * s, 0.8 + Math.random() * 1.4, 1.2 + Math.random() * 2, Math.random() < 0.5 ? 'rgba(255,170,90,1)' : 'rgba(255,230,180,1)', true);
      }
      this.meteors = this.meteors.filter(q => Math.abs(q.x - m.x) > 1 || Math.abs(q.y - m.y) > 1);
    }
    for (const p of f.plagues) for (let k = 0; k < 36; k++) { const a = Math.random() * TAU, s = 6 + Math.random() * 40; this.add(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, 1.2 + Math.random(), 1.5, 'rgba(214,240,90,1)', true); }
    for (const b of f.blessings) {
      this.ring(b.x, b.y, 4, 34, 0.9, 'rgba(255,220,150,', 1.6);
      for (let k = 0; k < 16; k++) { const a = Math.random() * TAU, s = 10 + Math.random() * 24; this.add(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, 0.9, 1.4, 'rgba(255,226,160,1)', true); }
    }
    for (const k in f) f[k].length = 0;
  }

  draw(ctx, dt) {
    const R = this.r, z = R.cam.z, S = R.scale;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    // ghosts of the dead
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i]; g.life -= dt; if (g.life <= 0) { this.ghosts.splice(i, 1); continue; }
      const p = g.life / g.max;
      R.images(g.x, g.y, 40, (sx, sy) => {
        ctx.globalAlpha = p * 0.7;
        ctx.strokeStyle = g.cause === 'eaten' ? 'rgba(255,110,80,1)' : `hsla(${g.hue},${g.sat * 0.4}%,62%,1)`;
        ctx.lineWidth = Math.max(0.8, g.r * z * 0.18);
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, g.r * z * (0.4 + 0.8 * (1 - p) * (g.cause === 'eaten' ? 1.6 : 0.6))), 0, TAU); ctx.stroke();
      });
    }
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.life -= dt; if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      const p = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - p) * (1 - p));
      R.images(r.x, r.y, rad * z + 10, (sx, sy) => {
        ctx.strokeStyle = r.color + ((1 - p) * 0.7).toFixed(3) + ')'; ctx.lineWidth = r.width * (1 - p * 0.5);
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.5, rad * z), 0, TAU); ctx.stroke();
      });
    }
    // particles, batched by colour and brightness
    ctx.globalCompositeOperation = 'lighter';
    const parts = this.parts, batches = new Map(), sw = R.sw, sh = R.sh;
    let j = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.2; p.vy *= 1 - dt * 1.2;
      parts[j++] = p;
      const a = p.life / p.max * (p.glow ? 0.9 : 0.6), lvl = a > 0.66 ? 3 : a > 0.4 ? 2 : a > 0.18 ? 1 : 0;
      const [sx, sy] = R.toScreen(p.x, p.y);
      if (sx < -6 || sx > sw + 6 || sy < -6 || sy > sh + 6) continue;
      const key = p.color + lvl;
      let b = batches.get(key); if (!b) { b = { path: new Path2D(), color: p.color, a: [0.12, 0.3, 0.55, 0.85][lvl] }; batches.set(key, b); }
      const s = Math.max(0.8, p.size * Math.min(2.2, z));
      b.path.rect(sx - s / 2, sy - s / 2, s, s);
    }
    parts.length = j;
    for (const b of batches.values()) { ctx.globalAlpha = b.a; ctx.fillStyle = b.color; ctx.fill(b.path); }
    // sparks of life
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]; s.life -= dt; if (s.life <= 0) { this.sparks.splice(i, 1); continue; }
      const t = s.max - s.life;
      if (t > 1.0 && !s.fired) { s.fired = true; this.ring(s.x, s.y, 2, 70, 1.2, `hsla(${s.hue},90%,78%,`, 2); this.ring(s.x, s.y, 2, 130, 1.6, 'rgba(255,240,210,', 1); }
      const I = t < 1.0 ? t * 0.5 : Math.max(0, 1 - (t - 1.0) / 1.2) * 1.4;
      R.images(s.x, s.y, 200, (sx, sy) => {
        ctx.globalAlpha = Math.min(1, I);
        const G = (18 + 40 * I) * Math.min(2, z);
        R.drawWhite(ctx, sx, sy, G);
      });
    }
    // meteors on their way down
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]; m.life -= dt; if (m.life <= -0.2) { this.meteors.splice(i, 1); continue; }
      const p = Math.max(0, m.life / m.max), dist = 900 * p, hx = m.x - 0.55 * dist, hy = m.y - 0.83 * dist;
      {
        const [sx, sy] = R.toScreen(hx, hy);
        const tx = sx - 0.55 * 220 * z, ty = sy - 0.83 * 220 * z;
        const gr = ctx.createLinearGradient(sx, sy, tx, ty);
        gr.addColorStop(0, 'rgba(255,240,210,0.95)'); gr.addColorStop(0.3, 'rgba(255,150,70,0.6)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.globalAlpha = 1; ctx.strokeStyle = gr; ctx.lineWidth = Math.max(2, 7 * z); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        const G = Math.max(10, 26 * z); R.drawWhite(ctx, sx, sy, G);
      }
      if (Math.random() < 0.6) this.add(hx, hy, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.6, 1.6, 'rgba(255,160,80,1)', true);
    }
    // lightning
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.life -= dt; if (b.life <= 0) { this.bolts.splice(i, 1); continue; }
      const p = b.life / b.max;
      R.images(b.x, b.y, 50, (sx, sy) => {
        const H = sy + 20, n = b.pts.length - 1;
        ctx.globalAlpha = p * (0.6 + 0.4 * Math.random());
        for (const pass of [[6, 'rgba(150,180,255,0.35)'], [2, 'rgba(240,246,255,1)']]) {
          ctx.lineWidth = pass[0]; ctx.strokeStyle = pass[1]; ctx.lineJoin = 'round';
          ctx.beginPath();
          for (let k = 0; k <= n; k++) { const y = sy - H + H * (k / n), x = sx + b.pts[k] * H - b.pts[n] * H * (k / n); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
          ctx.beginPath();
          const by0 = sy - H + H * (6 / n), bx0 = sx + b.pts[6] * H - b.pts[n] * H * (6 / n);
          ctx.moveTo(bx0, by0);
          for (let k = 1; k < b.branch.length; k++) ctx.lineTo(bx0 + (b.branch[k] - b.branch[0]) * H, by0 + k * H * 0.05);
          ctx.stroke();
        }
      });
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
}
