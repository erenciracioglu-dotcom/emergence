// ═══════════════════════════════════════════════════════════════════
//  Emergence · the River of Life: every species' population through time,
//  branches stacked beside the lineage they split from
// ═══════════════════════════════════════════════════════════════════
class River {
  constructor(app) {
    this.app = app; this.cv = $('#riverCv'); this.next = 0; this.cache = new Map(); this.geo = null;
    this.cv.addEventListener('pointermove', e => this.hover(e));
    this.cv.addEventListener('pointerleave', () => this.app.shell.untip());
    this.cv.addEventListener('click', e => this.click(e));
  }
  resize() { this.next = 0; }
  reset() { this.cache.clear(); this.next = 0; }
  update(now) { if (now < this.next) return; this.next = now + 1000; this.draw(); }

  info(id) {
    const sp = this.app.u.species.get(id);
    if (sp) { const o = { id, hue: sp.hue, sat: sp.sat, name: sp.name, epithet: sp.epithet, born: sp.born, parent: sp.parent ? this.app.u.species.displayOf(sp.parent).id : 0, alive: sp.n > 0, sp }; this.cache.set(id, o); return o; }
    return this.cache.get(id) || { id, hue: 40, sat: 8, name: '', epithet: '', born: 0, parent: 0, alive: false, sp: null };
  }
  order(cols) {
    const ids = new Set();
    for (const c of cols) for (const p of c.s) ids.add(p[0]);
    const infos = new Map(); for (const id of ids) infos.set(id, this.info(id));
    const kids = new Map(), roots = [];
    for (const inf of infos.values()) {
      if (inf.parent && infos.has(inf.parent) && inf.parent !== inf.id) { if (!kids.has(inf.parent)) kids.set(inf.parent, []); kids.get(inf.parent).push(inf); }
      else roots.push(inf);
    }
    const out = [];
    const visit = (inf) => { out.push(inf); const k = (kids.get(inf.id) || []).sort((a, b) => a.born - b.born); for (const c of k) visit(c); };
    roots.sort((a, b) => a.born - b.born).forEach(visit);
    return out;
  }
  draw() {
    const app = this.app, u = app.u, cv = this.cv;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const cols = u.hist.cols, n = cols.length;
    if (n < 3) {
      g.fillStyle = 'rgba(166,158,137,0.7)'; g.font = 'italic 13px "IM Fell English", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('The river begins when life does.', W / 2, H / 2); this.geo = null; return;
    }
    const order = this.order(cols), idx = new Map(order.map((o, i) => [o.id, i]));
    let maxT = 1; for (const c of cols) { let s = 0; for (const p of c.s) s += p[1]; if (s > maxT) maxT = s; }
    const sc = (H - 14) / maxT, top = order.map(() => new Float32Array(n)), bot = order.map(() => new Float32Array(n)), X = i => i / (n - 1) * W;
    const tmp = new Float32Array(order.length);
    for (let i = 0; i < n; i++) {
      tmp.fill(0); let s = 0;
      for (const p of cols[i].s) { const k = idx.get(p[0]); if (k !== undefined) { tmp[k] = p[1]; s += p[1]; } }
      let y = (H - 4 - s * sc) / 2 + 2;
      for (let k = 0; k < order.length; k++) { top[k][i] = y; y += tmp[k] * sc; bot[k][i] = y; }
    }
    const hl = app.r.highlight;
    for (let k = 0; k < order.length; k++) {
      const o = order[k], T = top[k], B = bot[k];
      let any = false; for (let i = 0; i < n; i++) if (B[i] - T[i] > 0.05) { any = true; break; }
      if (!any) continue;
      g.beginPath(); g.moveTo(X(0), T[0]);
      for (let i = 1; i < n; i++) g.lineTo(X(i), T[i]);
      for (let i = n - 1; i >= 0; i--) g.lineTo(X(i), B[i]);
      g.closePath();
      const dim = hl && o.sp !== hl, lv = (o.alive ? 50 : 36) + [0, 9, -6, 5][k % 4];
      g.fillStyle = `hsla(${o.hue.toFixed(0)},${Math.max(8, o.sat * 0.92).toFixed(0)}%,${lv}%,${dim ? 0.22 : 0.92})`;
      g.fill();
      g.strokeStyle = 'rgba(4,6,12,0.45)'; g.lineWidth = 0.6; g.stroke();
    }
    // names on the thickest stretch of each major band
    g.font = 'italic 11.5px "IM Fell English", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const placed = [];
    const ranked = order.map((o, k) => { let best = 0, bi = 0; for (let i = 0; i < n; i++) { const th = bot[k][i] - top[k][i]; if (th > best) { best = th; bi = i; } } return { o, k, best, bi }; })
      .filter(r => r.best > 11 && r.o.epithet).sort((a, b) => b.best - a.best).slice(0, 7);
    for (const r of ranked) {
      const x = clamp(X(r.bi), 40, W - 40), y = (top[r.k][r.bi] + bot[r.k][r.bi]) / 2, tw = g.measureText(r.o.epithet).width;
      if (placed.some(p => Math.abs(p.x - x) < (p.w + tw) / 2 + 6 && Math.abs(p.y - y) < 12)) continue;
      placed.push({ x, y, w: tw });
      g.fillStyle = 'rgba(6,8,14,0.82)'; g.fillText(r.o.epithet, x, y + 0.5);
    }
    // years and god's interventions along the edges
    const t0 = cols[0].t, t1 = cols[n - 1].t, TX = t => (t - t0) / Math.max(1e-6, t1 - t0) * W;
    g.font = '500 9px "IBM Plex Mono", monospace'; g.textBaseline = 'bottom';
    for (const e of u.chronicle) {
      if (e.t < t0 || e.t > t1) continue;
      const x = TX(e.t);
      if (e.kind === 'year') { g.fillStyle = 'rgba(214,178,112,0.3)'; g.fillRect(x, H - 6, 1, 6); g.fillStyle = 'rgba(214,178,112,0.7)'; g.textAlign = 'left'; g.fillText('Y' + e.yr, x + 3, H); }
      else if (e.mark) {
        g.fillStyle = e.mark === 'meteor' ? '#ffa25a' : e.mark === 'plague' ? '#d6f05a' : e.mark === 'dying' ? '#e8775d' : '#d7ae60';
        g.beginPath(); g.moveTo(x - 3.5, 0); g.lineTo(x + 3.5, 0); g.lineTo(x, 5); g.closePath(); g.fill();
      }
    }
    this.geo = { order, top, bot, n, W, cols };
    const c0 = cols[0], c1 = cols[n - 1];
    $('#riverSpan').textContent = `Year ${Math.floor((c0.d || 0) / DAYS_PER_YEAR) + 1} → Year ${Math.floor((c1.d || 0) / DAYS_PER_YEAR) + 1} · peak ${fmtInt(maxT)}`;
  }
  pick(e) {
    const geo = this.geo; if (!geo) return null;
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const i = clamp(Math.round(x / geo.W * (geo.n - 1)), 0, geo.n - 1);
    for (let k = 0; k < geo.order.length; k++) if (y >= geo.top[k][i] - 1 && y <= geo.bot[k][i] + 1 && geo.bot[k][i] - geo.top[k][i] > 0.2) {
      return { o: geo.order[k], col: geo.cols[i], count: (geo.cols[i].s.find(p => p[0] === geo.order[k].id) || [0, 0])[1] };
    }
    return null;
  }
  hover(e) {
    const p = this.pick(e);
    if (!p) { this.app.shell.untip(); return; }
    const d = p.col.d || 0, yr = Math.floor(d / DAYS_PER_YEAR) + 1, se = SEASONS[Math.floor((d % DAYS_PER_YEAR) / DAYS_PER_YEAR * 4) % 4];
    this.app.shell.tip(`<div class="nm">${esc(p.o.name || 'unnamed strain')}</div><div>${p.count} alive · Year ${yr}, ${se.toLowerCase()}</div><div class="k">${p.o.alive ? 'click to light them up' : 'extinct'}</div>`, e.clientX + 12, e.clientY - 64);
  }
  click(e) {
    const p = this.pick(e); if (!p || !p.o.sp || !p.o.alive) return;
    this.app.highlight(this.app.r.highlight === p.o.sp ? null : p.o.sp, true);
  }
}
