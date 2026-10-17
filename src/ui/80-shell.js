// ═══════════════════════════════════════════════════════════════════
//  Emergence · the instrument shell: tools, time, HUD, input
// ═══════════════════════════════════════════════════════════════════
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const richText = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em class="sp">$1</em>');
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

function svg(inner, extra) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ''}>${inner}</svg>`; }
function trefoil() {
  let d = '';
  for (let k = 0; k < 3; k++) {
    const a1 = (-90 + k * 120 - 30) * Math.PI / 180, a2 = (-90 + k * 120 + 30) * Math.PI / 180, r1 = 3.2, r2 = 9;
    const p = (r, a) => `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
    d += `M${p(r1, a1)}L${p(r2, a1)}A${r2} ${r2} 0 0 1 ${p(r2, a2)}L${p(r1, a2)}A${r1} ${r1} 0 0 0 ${p(r1, a1)}Z`;
  }
  return `<path d="${d}"/><circle cx="12" cy="12" r="1.3"/>`;
}
function spiral() {
  let d = 'M12 12', a = 0;
  for (let k = 1; k <= 60; k++) { a += 0.28; const r = 0.15 * a * a / 1.6 + a * 0.6; d += `L${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`; if (r > 9.5) break; }
  return `<path d="${d}"/>`;
}
const ICONS = {
  observe: svg('<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2l5.3 5.3"/><path d="M8 9.2a3 3 0 012.6-1.7"/>'),
  manna: svg('<path d="M6 19.5c-.6-8.3 4.6-14 13.5-14.3.2 9-5 14.2-13.5 14.3z"/><path d="M6 19.5l7.5-7.6"/>'),
  life: svg('<path d="M12 2.8l1.7 6.6 6.6 1.6-6.6 1.7L12 19.3l-1.7-6.6L3.7 11l6.6-1.6z"/><path d="M19 3.5v3M17.5 5h3"/>'),
  smite: svg('<path d="M13.4 2.5L5 13.4h6.1l-1.4 8.1 8.6-11.2h-6.1z"/>'),
  meteor: svg('<circle cx="15.2" cy="15.2" r="4.6"/><path d="M3 3l8.2 8.2M8 3l5 5M3 8l5 5"/>'),
  plague: svg('<circle cx="12" cy="7.6" r="3.1"/><circle cx="7.2" cy="15.6" r="3.1"/><circle cx="16.8" cy="15.6" r="3.1"/><circle cx="12" cy="12.6" r=".9" fill="currentColor"/>'),
  stone: svg('<path d="M2.8 19.5l5.4-9.3 3.1 3.9 3.3-7.6 6.6 13z"/><path d="M8.2 10.2l1.4 4.6"/>'),
  climate: svg('<path d="M10 13.6V5a2 2 0 014 0v8.6a4.3 4.3 0 11-4 0z"/><path d="M12 9.5v6.8"/><path d="M18 5.5h2.5M18 9h2.5"/>'),
  radiation: svg(trefoil()),
  forces: svg(spiral()),
  play: svg('<path d="M7.5 5.2l11 6.8-11 6.8z" fill="currentColor"/>'),
  pause: svg('<path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" fill="currentColor" stroke="none"/>'),
  film: svg('<rect x="3" y="5.5" width="18" height="13" rx="1.6"/><path d="M7 5.5v13M17 5.5v13M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>'),
  eyeOff: svg('<path d="M3.5 3.5l17 17"/><path d="M10.4 6.2c.5-.1 1-.2 1.6-.2 5 0 8.4 4.3 9.5 6-.5.9-1.6 2.3-3 3.5M6.6 7.6C4.6 8.9 3.2 10.7 2.5 12c1.1 1.7 4.5 6 9.5 6 1.5 0 2.8-.4 4-1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  panel: svg('<rect x="3" y="4.5" width="18" height="15" rx="1.6"/><path d="M14.5 4.5v15"/>'),
  sound: svg('<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4.2 4.2 0 010 6M18 6.5a7.7 7.7 0 010 11"/>'),
};

const TOOLS = [
  { id: 'observe', name: 'Observe', key: '1', desc: 'Click a creature to examine it. Drag to look around, scroll to zoom. Double-click to zoom in.' },
  { id: 'manna', name: 'Manna', key: '2', desc: 'Paint fresh algae into the water. The matter is drawn from the whole sea, so the total never changes.', brush: [16, 140, 46], color: 'rgba(130,240,190,0.9)' },
  { id: 'life', name: 'Breathe life', key: '3', desc: 'Spark a new lineage where you click: a handful of founders with a genome of their own.', modes: [['random', 'Any life'], ['grazer', 'Grazers'], ['hunter', 'Hunters'], ['phototroph', 'Sun-drinkers']], color: 'rgba(255,236,190,0.9)' },
  { sep: true },
  { id: 'smite', name: 'Lightning', key: '4', desc: 'Strike down whatever lies under the bolt. Hold to keep striking.', wrath: true, color: 'rgba(210,225,255,0.95)', ring: 24 },
  { id: 'meteor', name: 'Meteor', key: '5', desc: 'A small extinction event. Everything near the impact dies; the crater fills with fresh matter and heat.', wrath: true, color: 'rgba(255,170,100,0.95)', ring: 78 },
  { id: 'plague', name: 'Plague', key: '6', desc: 'Infect the creature you click and its kind nearby. It spreads by touch among close relatives; survivors become immune.', wrath: true, color: 'rgba(214,240,90,0.95)', ring: 50 },
  { sep: true },
  { id: 'stone', name: 'Stone', key: '7', desc: 'Raise walls of rock to split the water. Populations cut off from each other drift apart into new species. Right-drag to erase.', brush: [10, 90, 22], modes: [['raise', 'Raise'], ['erase', 'Erase']], color: 'rgba(200,196,186,0.95)' },
  { id: 'climate', name: 'Climate', key: '8', desc: 'Paint heat or cold onto the water. It fades over about a minute. Right-drag paints the opposite.', brush: [20, 160, 60], modes: [['heat', 'Heat'], ['cold', 'Cold']], color: 'rgba(255,170,100,0.95)' },
  { id: 'radiation', name: 'Radiation', key: '9', desc: 'A mutagenic glow. Children born inside it mutate up to eight times as much. Fades over a couple of minutes.', brush: [16, 140, 50], color: 'rgba(214,240,90,0.95)' },
  { id: 'forces', name: 'Forces', key: '0', desc: 'Place a whirlpool or a gravity well that bends the currents. Click one again to remove it.', modes: [['ccw', 'Whirlpool ↺'], ['cw', 'Whirlpool ↻'], ['well', 'Gravity well'], ['spring', 'Repulsor']], color: 'rgba(170,200,255,0.95)' },
];

class Shell {
  constructor(app) {
    this.app = app;
    this.ptrs = new Map(); this.mode = null; this.down = null; this.stroke = null; this.space = false;
    this.brushSize = {}; this.toolMode = {};
    for (const t of TOOLS) { if (t.brush) this.brushSize[t.id] = t.brush[2]; if (t.modes) this.toolMode[t.id] = t.modes[0][0]; }
    this.cursor = null; this.lastHud = 0; this.toastQ = [];
  }

  init() {
    const app = this.app;
    // toolbar
    const nav = $('#tools');
    nav.innerHTML = TOOLS.map(t => t.sep ? '<div class="tools-sep"></div>' :
      `<button class="tool${t.wrath ? ' wrath' : ''}" data-tool="${t.id}" aria-label="${t.name} (${t.key})">${ICONS[t.id]}<span class="key">${t.key}</span></button>`).join('');
    nav.addEventListener('click', e => { const b = e.target.closest('.tool'); if (b) this.setTool(b.dataset.tool, true); });
    for (const b of $$('.tool', nav)) {
      b.addEventListener('pointerenter', () => { const t = TOOLS.find(x => x.id === b.dataset.tool); const r = b.getBoundingClientRect(); if (window.innerWidth > 760 && $('#toolopts').hidden) this.tip(`<div class="nm">${t.name}</div><div class="k">key ${t.key}</div>`, r.right + 8, r.top + 4); });
      b.addEventListener('pointerleave', () => this.untip());
    }
    // time
    $('#playBtn').addEventListener('click', () => app.setPaused(!app.paused));
    for (const b of $$('#timebar [data-speed]')) b.addEventListener('click', () => { app.setSpeed(+b.dataset.speed); if (app.paused) app.setPaused(false); });
    // top right
    $('#watchBtn').innerHTML = ICONS.film + '<span>Watch</span>';
    $('#uiBtn').innerHTML = ICONS.eyeOff; $('#fsBtn').innerHTML = ICONS.expand; $('#panelBtn').innerHTML = ICONS.panel;
    $('#mPanelBtn').innerHTML = ICONS.panel; $('#mWatchBtn').innerHTML = ICONS.film;
    $('#soundBtn').innerHTML = ICONS.sound; $('#mSoundBtn').innerHTML = ICONS.sound;
    $('#soundBtn').addEventListener('click', () => app.sound.toggle());
    $('#mSoundBtn').addEventListener('click', () => app.sound.toggle());
    $('#watchBtn').addEventListener('click', () => app.director.toggle());
    $('#mWatchBtn').addEventListener('click', () => app.director.toggle());
    $('#docExit').addEventListener('click', () => app.director.stop());
    $('#uiBtn').addEventListener('click', () => this.toggleUI());
    $('#showUi').addEventListener('click', () => this.toggleUI(false));
    $('#fsBtn').addEventListener('click', () => this.fullscreen());
    $('#panelBtn').addEventListener('click', () => this.togglePanel());
    $('#mPanelBtn').addEventListener('click', () => this.togglePanel());
    if (window.innerWidth <= 760) this.togglePanel(false);
    this._bindCanvas(); this._bindKeys();
    this.setTool('observe');
    this.updateTimebar();
  }

  // ── tools ──
  setTool(id, fromClick) {
    const app = this.app, prev = app.tool;
    if (fromClick && id === prev && id !== 'observe') id = 'observe';
    app.tool = id;
    for (const b of $$('.tool')) b.classList.toggle('on', b.dataset.tool === id);
    $('#world').classList.toggle('observe', id === 'observe');
    this.renderToolOpts();
    if (id === 'observe') app.r.brush = null;
    this.untip();
  }
  renderToolOpts() {
    const app = this.app, t = TOOLS.find(x => x.id === app.tool), box = $('#toolopts');
    if (!t || t.id === 'observe') { box.hidden = true; return; }
    let h = `<h2>${t.name}</h2><p>${t.desc}</p>`;
    if (t.modes) h += `<div class="row" role="group" aria-label="${t.name} mode">${t.modes.map(m => `<button class="seg${this.toolMode[t.id] === m[0] ? ' on' : ''}" data-mode="${m[0]}">${m[1]}</button>`).join('')}</div>`;
    if (t.brush) h += `<div class="brushrow"><span class="label">Brush</span><input type="range" id="brushSize" min="${t.brush[0]}" max="${t.brush[1]}" step="1" value="${this.brushSize[t.id]}" aria-label="Brush size"><output id="brushOut">${this.brushSize[t.id]}</output></div>`;
    box.innerHTML = h; box.hidden = false;
    // align with the tool button on wide screens
    const btn = $(`.tool[data-tool="${t.id}"]`);
    if (btn && window.innerWidth > 760) { const r = btn.getBoundingClientRect(), ar = $('#app').getBoundingClientRect(); box.style.top = Math.max(ar.top + 14, Math.min(r.top - ar.top - 8, ar.height - box.offsetHeight - 120)) + 'px'; }
    else box.style.top = '';
    for (const b of $$('[data-mode]', box)) b.addEventListener('click', () => { this.toolMode[t.id] = b.dataset.mode; this.renderToolOpts(); });
    const rs = $('#brushSize', box);
    if (rs) { setFill(rs); rs.addEventListener('input', () => { this.brushSize[t.id] = +rs.value; $('#brushOut').textContent = rs.value; setFill(rs); }); }
  }
  toolInfo() { return TOOLS.find(x => x.id === this.app.tool); }

  // ── HUD ──
  updateHUD(now) {
    if (now - this.lastHud < 180) return;
    this.lastHud = now;
    const u = this.app.u;
    $('#when').textContent = `Year ${u.year} · ${u.season} · Day ${u.dayOfYear}`;
    let est = 0; for (const sp of u.species.map.values()) if (sp.n > 0 && sp.established) est++;
    $('#census').innerHTML = `<b>${fmtInt(u.creatures.length)}</b> alive · <b>${est}</b> species`;
    $('#census2').innerHTML = `gen <b>${u.maxGen}</b> · ${fmtInt(u.rate('births'))} births/min`;
    const eff = this.app.effSpeed;
    $('#realSpeed').textContent = this.app.paused ? 'paused' : (eff >= 9.95 ? eff.toFixed(0) : eff.toFixed(1)) + '× real';
    this.drawDial();
  }
  drawDial() {
    const u = this.app.u, cv = $('#dial'), g = cv.getContext('2d'), S = cv.width, c = S / 2;
    g.clearRect(0, 0, S, S);
    // seasons ring
    const cols = ['rgba(140,220,160,0.55)', 'rgba(255,200,110,0.6)', 'rgba(230,140,90,0.55)', 'rgba(150,185,255,0.55)'];
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(c, c, S * 0.44, -Math.PI / 2 + k * TAU / 4 + 0.05, -Math.PI / 2 + (k + 1) * TAU / 4 - 0.05); g.strokeStyle = cols[k]; g.lineWidth = S * 0.05; g.stroke(); }
    const ya = -Math.PI / 2 + u.yearPhase * TAU;
    g.beginPath(); g.arc(c + Math.cos(ya) * S * 0.44, c + Math.sin(ya) * S * 0.44, S * 0.055, 0, TAU); g.fillStyle = '#f2d08c'; g.fill();
    // day and night
    const da = u.dayPhase * TAU;
    g.save(); g.beginPath(); g.arc(c, c, S * 0.32, 0, TAU); g.clip();
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, S, S);
    g.translate(c, c); g.rotate(-da);
    const gr = g.createLinearGradient(0, -S * 0.32, 0, S * 0.32); gr.addColorStop(0, '#f6d48e'); gr.addColorStop(0.5, '#b98a3e'); gr.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(-S, -S, 2 * S, 2 * S);
    g.restore();
    g.beginPath(); g.arc(c, c, S * 0.32, 0, TAU); g.strokeStyle = 'rgba(214,178,112,0.4)'; g.lineWidth = S * 0.02; g.stroke();
  }
  updateTimebar() {
    const app = this.app;
    $('#playBtn').innerHTML = app.paused ? ICONS.play : ICONS.pause;
    $('#playBtn').title = app.paused ? 'Resume (Space)' : 'Pause (Space)';
    $('#playBtn').setAttribute('aria-label', app.paused ? 'Resume' : 'Pause');
    for (const b of $$('#timebar [data-speed]')) b.classList.toggle('on', +b.dataset.speed === app.speed);
  }

  // ── panels & chrome ──
  togglePanel(force) {
    const a = $('#app'), on = force === undefined ? !a.classList.contains('panel-open') : force;
    a.classList.toggle('panel-open', on);
    $('#panelBtn').classList.toggle('on', on);
    setTimeout(() => { this.app.river.resize(); }, 350);
  }
  toggleUI(force) {
    const a = $('#app'), on = force === undefined ? !a.classList.contains('ui-hidden') : force;
    a.classList.toggle('ui-hidden', on);
  }
  fullscreen() {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => this.toast({ kind: 'note', text: 'Full screen is not available here.' }, true));
    } catch (e) { /* not available in this view */ }
  }

  // ── toasts & tooltips ──
  toast(e, plain) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast glass';
    const g = GLYPH[e.kind] || '✦';
    el.innerHTML = `<span class="g">${g}</span>${plain ? esc(e.text) : richText(e.text)}`;
    if (e.px !== null && e.px !== undefined) el.addEventListener('click', () => { this.app.r.flyTo(e.px, e.py, 2.6); el.remove(); });
    else el.addEventListener('click', () => el.remove());
    box.appendChild(el);
    const max = window.innerWidth <= 760 ? 1 : 3;
    while (box.children.length > max) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 650); }, plain ? 3200 : 6500);
  }
  tip(html, x, y) {
    const t = $('#tip'); t.innerHTML = html; t.hidden = false;
    const ar = $('#app').getBoundingClientRect();
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = clamp(x - ar.left, 8, ar.width - w - 8) + 'px';
    t.style.top = clamp(y - ar.top, 8, ar.height - h - 8) + 'px';
  }
  untip() { $('#tip').hidden = true; }

  // ── pointer input on the world ──
  _bindCanvas() {
    const app = this.app, cv = $('#world');
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      app.intro.dismiss();
      const [x, y] = pos(e);
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this.ptrs.set(e.pointerId, { x, y });
      if (this.ptrs.size === 2) {
        this.endStroke(); this.mode = 'pinch';
        const [a, b] = Array.from(this.ptrs.values());
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        return;
      }
      if (this.ptrs.size > 2) return;
      const tool = app.tool, btn = e.button;
      this.down = { x, y, lx: x, ly: y, btn, moved: false, t: performance.now(), touch: e.pointerType === 'touch' };
      const rightPaints = tool === 'stone' || tool === 'climate';
      if (btn === 1 || (btn === 2 && !rightPaints) || this.space || tool === 'observe') { this.mode = 'pan'; }
      else { this.mode = 'act'; this.toolDown(x, y, btn === 2); }
    });
    cv.addEventListener('pointermove', e => {
      const [x, y] = pos(e);
      const p = this.ptrs.get(e.pointerId);
      if (p) { p.x = x; p.y = y; }
      this.cursor = [x, y];
      if (this.mode === 'pinch' && this.ptrs.size >= 2) {
        const [a, b] = Array.from(this.ptrs.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        app.r.pan(cx - this.pinch.cx, cy - this.pinch.cy);
        if (this.pinch.d > 10) app.r.zoomAt(cx, cy, d / this.pinch.d);
        this.pinch = { d, cx, cy };
        return;
      }
      if (this.mode === 'pan' && this.down) {
        const dx = x - this.down.lx, dy = y - this.down.ly;
        if (!this.down.moved && Math.hypot(x - this.down.x, y - this.down.y) > (this.down.touch ? 8 : 4)) { this.down.moved = true; cv.classList.add('grabbing'); if (this.space) this.spaceUsed = true; }
        if (this.down.moved) app.r.pan(dx, dy);
        this.down.lx = x; this.down.ly = y;
        return;
      }
      if (this.mode === 'act') { this.stroke && (this.stroke.sx = x, this.stroke.sy = y); return; }
      // hovering
      if (e.pointerType === 'mouse' && app.tool === 'observe') {
        const c = app.r.creatureAt(x, y, 7);
        app.r.hover = c;
        if (c) { const r = cv.getBoundingClientRect(); this.tip(creatureTip(app.u, c), e.clientX + 14, e.clientY + 12); }
        else this.untip();
      }
    });
    const up = (e) => {
      const [x, y] = pos(e);
      this.ptrs.delete(e.pointerId);
      if (this.mode === 'pinch') { if (this.ptrs.size === 0) this.mode = null; return; }
      if (this.mode === 'pan' && this.down) {
        if (!this.down.moved && this.down.btn === 0) this.click(x, y);
        cv.classList.remove('grabbing');
      }
      if (this.mode === 'act') this.endStroke();
      this.mode = null; this.down = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { this.cursor = null; app.r.hover = null; this.untip(); });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const [x, y] = pos(e);
      const k = e.ctrlKey ? 0.012 : 0.0016;
      app.r.zoomAt(x, y, Math.exp(-e.deltaY * k));
    }, { passive: false });
    cv.addEventListener('dblclick', e => { if (app.tool !== 'observe') return; const [x, y] = pos(e); app.r.zoomAt(x, y, 2); });
  }

  click(x, y) {
    const app = this.app;
    const c = app.r.creatureAt(x, y, this.down && this.down.touch ? 16 : 8);
    if (c) app.select(c);
    else if (app.r.selected) app.select(null);
  }

  toolDown(sx, sy, alt) {
    const app = this.app, u = app.u, r = app.r, t = app.tool;
    const [x, y] = r.toWorld(sx, sy);
    this.stroke = { tool: t, alt, sx, sy, lx: x, ly: y, x0: x, y0: y, next: 0, painted: 0 };
    const mode = this.toolMode[t];
    switch (t) {
      case 'smite': u.smite(x, y); this.stroke.next = performance.now() + 240; break;
      case 'meteor':
        if (performance.now() - (this.lastMeteor || 0) < 700) break;
        this.lastMeteor = performance.now(); u.meteor(x, y); break;
      case 'plague': if (!u.plagueAt(x, y)) this.toast({ kind: 'note', text: 'Click on a creature to infect it.' }, true); break;
      case 'life': u.spark(x, y, true, mode === 'random' ? undefined : mode); break;
      case 'forces': {
        if (u.removeForceNear(x, y, 34 / r.cam.z)) { u.logGod('You stilled one of the forces.', x, y); break; }
        const f = mode === 'ccw' ? ['vortex', 1] : mode === 'cw' ? ['vortex', -1] : mode === 'well' ? ['well', 1] : ['well', -1];
        u.addForce(f[0], x, y, f[1]);
        const what = mode === 'well' ? 'opened a gravity well' : mode === 'spring' ? 'set a repulsor' : 'stirred a whirlpool';
        u.logGod('You ' + what + ' in ' + u.placeName(x, y) + '.', x, y);
        break;
      }
      default: this.paintAt(x, y, 1 / 30);
    }
  }
  // called every frame while a stroke is active
  strokeFrame(dt) {
    const s = this.stroke; if (!s) return;
    const app = this.app, r = app.r;
    const [x, y] = r.toWorld(s.sx, s.sy);
    if (s.tool === 'smite') { if (performance.now() > s.next) { app.u.smite(x, y); s.next = performance.now() + 240; } return; }
    const t = this.toolInfo(); if (!t || !t.brush) return;
    const R = this.brushSize[s.tool];
    const dx = r.wdx(x - s.lx), dy = r.wdy(y - s.ly), d = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(d / (R * 0.35)));
    for (let k = 1; k <= steps; k++) this.paintAt(app.u.world.wrapX(s.lx + dx * k / steps), app.u.world.wrapY(s.ly + dy * k / steps), dt / steps);
    s.lx = x; s.ly = y;
  }
  paintAt(x, y, dt) {
    const s = this.stroke, app = this.app, u = app.u, w = u.world, R = this.brushSize[s.tool], mode = this.toolMode[s.tool], fx = app.r.fx;
    s.painted++;
    switch (s.tool) {
      case 'manna': w.paintManna(x, y, R, 24 * dt); if (Math.random() < 0.5) fx.add(x + (Math.random() - 0.5) * R, y + (Math.random() - 0.5) * R, 0, 0, 0.8, 1.4, 'rgba(140,255,200,1)', true); break;
      case 'stone': {
        const raise = (mode === 'raise') !== s.alt;
        if (u.paintWall(x, y, R, raise)) { app.r.markWallDirty(x, y, R); if (Math.random() < 0.6) fx.dust(x, y, raise ? 'rgba(200,190,170,1)' : 'rgba(120,170,220,1)'); }
        s.raise = raise; break;
      }
      case 'climate': { const heat = (mode === 'heat') !== s.alt; w.paintHeat(x, y, R, (heat ? 1 : -1) * 30 * dt); s.heat = heat; break; }
      case 'radiation': w.paintRad(x, y, R, 1.0 * dt); break;
    }
  }
  endStroke() {
    const s = this.stroke; this.stroke = null;
    if (!s || !s.painted) return;
    const u = this.app.u, place = u.placeName(s.x0, s.y0);
    const msg = { manna: 'You let manna fall on ' + place + '.', stone: (s.raise ? 'You raised stone in ' : 'You wore away stone in ') + place + '.',
      climate: (s.heat ? 'You warmed ' : 'You chilled ') + place + '.', radiation: 'You bathed ' + place + ' in radiation.' }[s.tool];
    if (msg) u.logGod(msg, s.x0, s.y0, s.tool + (s.raise ? 'r' : '') + (s.heat ? 'h' : ''));
  }

  _bindKeys() {
    const app = this.app;
    window.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' && e.target.type !== 'range' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); if (!e.repeat) { this.space = true; this.spaceUsed = false; } return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (tag === 'INPUT' && /^[0-9]$/.test(k)) return;
      app.intro.dismiss();
      const tool = TOOLS.find(t => t.key === k);
      if (tool) { this.setTool(tool.id); return; }
      switch (k) {
        case 'Escape': if (app.director.on) app.director.stop(); else if (app.r.highlight) app.highlight(null); else if (app.r.selected) app.select(null); else this.setTool('observe'); break;
        case 'h': case 'H': this.toggleUI(); break;
        case 'd': case 'D': app.director.toggle(); break;
        case 's': case 'S': app.sound.toggle(); break;
        case 'p': case 'P': this.togglePanel(); break;
        case 't': case 'T': app.r.showTrails = !app.r.showTrails; this.toast({ kind: 'note', text: app.r.showTrails ? 'Trails on.' : 'Trails off.' }, true); break;
        case 'f': case 'F': if (app.r.selected && !app.r.selected.dead) app.follow(app.r.selected); break;
        case '[': case ']': { const t = this.toolInfo(); if (t && t.brush) { const v = clamp(this.brushSize[t.id] * (k === ']' ? 1.2 : 1 / 1.2), t.brush[0], t.brush[1]); this.brushSize[t.id] = Math.round(v); this.renderToolOpts(); } break; }
        case '+': case '=': app.r.zoomAt(app.r.sw / 2, app.r.sh / 2, 1.25); break;
        case '-': case '_': app.r.zoomAt(app.r.sw / 2, app.r.sh / 2, 0.8); break;
        case '.': case '>': app.stepSpeed(1); break;
        case ',': case '<': app.stepSpeed(-1); break;
        case 'ArrowLeft': app.r.pan(60, 0); break;
        case 'ArrowRight': app.r.pan(-60, 0); break;
        case 'ArrowUp': app.r.pan(0, 60); break;
        case 'ArrowDown': app.r.pan(0, -60); break;
      }
    });
    window.addEventListener('keyup', e => {
      if (e.key === ' ') {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' && e.target.type !== 'range' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        if (this.space && !this.spaceUsed && !(this.mode === 'pan' && this.down && this.down.moved)) app.setPaused(!app.paused);
        this.space = false;
      }
    });
  }

  // brush cursor follows the pointer
  updateCursor() {
    const app = this.app, t = this.toolInfo();
    if (!this.cursor || !t || t.id === 'observe' || this.mode === 'pinch') { app.r.brush = null; return; }
    const [x, y] = app.r.toWorld(this.cursor[0], this.cursor[1]);
    let color = t.color;
    if (t.id === 'climate') color = ((this.toolMode.climate === 'heat') !== !!(this.stroke && this.stroke.alt)) ? 'rgba(255,170,100,0.95)' : 'rgba(143,184,255,0.95)';
    if (t.id === 'stone' && this.toolMode.stone === 'erase') color = 'rgba(143,184,255,0.95)';
    app.r.brush = { x, y, r: t.brush ? this.brushSize[t.id] : (t.ring || 14), color, dash: !t.brush };
  }
}

const GLYPH = { genesis: '☉', life: '✦', species: '❧', extinct: '†', milestone: '★', behaviour: '≈', plague: '☣', dying: '☠', record: '№', year: '◷', god: '⚡', note: '·' };

function setFill(range) {
  const p = (range.value - range.min) / (range.max - range.min) * 100;
  range.style.setProperty('--fill', p + '%');
}

function creatureTip(u, c) {
  const d = u.species.displayOf(c.sp);
  const name = d && d.name ? d.name : 'An unnamed strain';
  const days = (c.age / u.laws.dayLength).toFixed(1);
  return `<div class="nm">${esc(name)}</div><div>${c.role} · generation ${c.gen}</div><div class="k">${days} days old · energy ${Math.round(c.E / c.Emax * 100)}%${c.infected > 0 ? ' · sick' : ''}</div>`;
}
