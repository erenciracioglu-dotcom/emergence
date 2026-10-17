// ═══════════════════════════════════════════════════════════════════
//  Emergence · the side panel: laws, life, chronicle, specimen
// ═══════════════════════════════════════════════════════════════════
const PRESETS = [
  { id: 'primordial', name: 'Primordial sea', laws: {} },
  { id: 'snowball', name: 'Snowball', laws: { temperature: -12, sun: 0.85, seasons: 0.85 } },
  { id: 'hothouse', name: 'Hothouse', laws: { temperature: 12, sun: 1.35, metabolism: 1.25 } },
  { id: 'longday', name: 'Long days', laws: { dayLength: 170, seasons: 0.2 } },
  { id: 'maelstrom', name: 'Maelstrom', laws: { currents: 2.6, viscosity: 0.55 } },
  { id: 'soup', name: 'Thick soup', laws: { viscosity: 3.2, fertility: 1.8, currents: 0.4 } },
  { id: 'radiant', name: 'Radiant', laws: { mutation: 4 } },
  { id: 'lean', name: 'Lean times', laws: { fertility: 0.5, metabolism: 1.35 } },
];
const MORPH_AXES = [
  [G_DIET, 'Diet', 'grazer', 'hunter'], [G_SIZE, 'Body size', 'small', 'large'], [G_SPEED, 'Muscle', 'slow', 'fast'],
  [G_PHOTO, 'Photosynthesis', 'none', 'full'], [G_ARMOR, 'Armour', 'soft', 'plated'], [G_SENSE, 'Senses', 'short', 'long'],
  [G_TPREF, 'Preferred warmth', 'cold', 'warm'], [G_LIFE, 'Lifespan', 'short', 'long'], [G_KIN, 'Kin recognition', 'narrow', 'broad'],
];
const GENE_VIEW = [
  [G_SIZE, 'Body size', g => (3 + 9 * g).toFixed(1) + 'u'], [G_SPEED, 'Muscle', g => Math.round(g * 100) + '%'],
  [G_DIET, 'Diet', g => g < 0.38 ? 'plants' : g < 0.62 ? 'mixed' : 'flesh'], [G_PHOTO, 'Photosynthesis', g => Math.round(g * 100) + '%'],
  [G_ARMOR, 'Armour', g => Math.round(g * 100) + '%'], [G_SENSE, 'Senses', g => Math.round(35 + 115 * g) + 'u'],
  [G_TPREF, 'Preferred warmth', g => Math.round(-5 + 40 * g) + '°'], [G_TTOL, 'Tolerance', g => '±' + Math.round(2 + 10 * g) + '°'],
  [G_LIFE, 'Lifespan', g => Math.round(60 + 200 * g) + 's'], [G_REPRO, 'Patience to breed', g => Math.round((0.45 + 0.5 * g) * 100) + '%'],
  [G_INVEST, 'Care for young', g => Math.round((0.15 + 0.45 * g) * 100) + '%'], [G_KIN, 'Kin recognition', g => Math.round(g * 100) + '%'],
  [G_ALARM, 'Alarm calls', g => Math.round(g * 100) + '%'], [G_OSC, 'Inner rhythm', g => (0.15 + 2.5 * g).toFixed(1) + 'Hz'],
];

function fmtLaw(d, v) {
  if (d.unit === '%') return Math.round(v * 100) + '%';
  if (d.unit === 's') return Math.round(v) + ' s';
  if (d.unit === '°') return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(v % 1 ? 1 : 0) + '°';
  return fmtInt(v);
}
function lawSentence(d, v, old) {
  const up = v > old, pct = fmtLaw(d, v);
  switch (d.key) {
    case 'sun': return up ? `You turned the sun up to ${pct}.` : `You dimmed the sun to ${pct}.`;
    case 'dayLength': return up ? `You slowed the turning of the world: a day now lasts ${pct}.` : `You hurried the days along: ${pct} each.`;
    case 'seasons': return up ? `You tilted the world further. Seasons swing harder (${pct}).` : `You straightened the world. Seasons soften (${pct}).`;
    case 'temperature': return up ? `You warmed the whole world (${pct}).` : `You cooled the whole world (${pct}).`;
    case 'currents': return up ? `You strengthened the currents to ${pct}.` : `You stilled the currents to ${pct}.`;
    case 'viscosity': return up ? `You thickened the water to ${pct}.` : `You thinned the water to ${pct}.`;
    case 'mutation': return up ? `You loosed more cosmic radiation: mutation at ${pct}.` : `You calmed the cosmic rays: mutation at ${pct}.`;
    case 'metabolism': return up ? `You raised the price of living: entropy at ${pct}.` : `You made living cheaper: entropy at ${pct}.`;
    case 'fertility': return up ? `You poured new matter into the universe (${pct}).` : `You drained matter from the universe (${pct}).`;
    case 'abiogenesis': return up ? `Life now sparks more readily from nothing (${pct}).` : `Life sparks from nothing more rarely (${pct}).`;
    case 'pestilence': return up ? `Plagues now rise more readily (${pct}).` : `Plagues rise more rarely (${pct}).`;
    default: return `You set ${d.label.toLowerCase()} to ${pct}.`;
  }
}

class Panels {
  constructor(app) {
    this.app = app; this.tab = 'chron'; this.lastUpdate = 0; this.chronSeen = -1; this.mx = G_DIET; this.my = G_SIZE;
    this.specKey = null;
  }
  init() {
    for (const t of $$('.tab')) t.addEventListener('click', () => this.show(t.id.slice(4)));
    this.buildLaws(); this.buildLife(); this.buildChron(); this.buildSpec();
    this.built = true;
    this.show('chron');
  }
  show(id) {
    this.tab = id;
    for (const t of $$('.tab')) { const on = t.id === 'tab-' + id; t.setAttribute('aria-selected', on ? 'true' : 'false'); if (on) { const d = t.querySelector('.dot'); if (d) d.remove(); } }
    for (const p of $$('.pane')) p.hidden = p.id !== 'pane-' + id;
    this.lastUpdate = 0; this.chronSeen = -1; this.specKey = null;
    this.update(performance.now(), true);
  }
  markTab(id) {
    if (this.tab === id || !$('#app').classList.contains('panel-open') && window.innerWidth <= 760) return;
    const t = $('#tab-' + id); if (t && !t.querySelector('.dot') && this.tab !== id) t.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
  }
  update(now, force) {
    if (this.tab === 'spec') this.drawBrain();
    if (!force && now - this.lastUpdate < 380) return;
    this.lastUpdate = now;
    if (this.tab === 'laws') this.updateLaws();
    else if (this.tab === 'life') this.updateLife();
    else if (this.tab === 'chron') this.updateChron();
    else if (this.tab === 'spec') this.updateSpec();
  }

  // ── Laws ──
  buildLaws() {
    const app = this.app, pane = $('#pane-laws');
    let h = '<h3>Presets</h3><p class="hint">Whole sets of laws at once. Your creatures stay; the world changes around them.</p><div class="presets">' +
      PRESETS.map(p => `<button class="seg" data-preset="${p.id}">${p.name}</button>`).join('') + '</div>';
    let group = '';
    for (const d of LAW_DEFS) {
      if (d.group !== group) { group = d.group; h += `<h3>${group}</h3>`; }
      h += `<div class="law"><div class="law-head"><label for="law-${d.key}">${d.label}</label><span><output id="out-${d.key}"></output><button class="reset" data-reset="${d.key}" title="Back to the original law">reset</button></span></div>
        <input type="range" id="law-${d.key}" min="${d.min}" max="${d.max}" step="${d.step}"><p>${d.desc}</p></div>`;
    }
    h += `<h3>State of the universe</h3>
      <div class="matter" id="matterBar" aria-label="Where the universe's matter is"><span style="background:#8b6bc4"></span><span style="background:#4fc49e"></span><span style="background:#d9733f"></span><span style="background:#e7c06c"></span></div>
      <div class="legend" id="matterLegend"></div>
      <p class="hint" id="climateLine" style="margin-top:8px"></p>
      <h3>Begin again</h3>
      <p class="hint">A seed fixes the starting world: the same number makes the same sea, the same vents and the same first sparks.</p>
      <div class="rowflex"><input class="field" id="seedField" inputmode="numeric" size="11" aria-label="Seed for a new universe"><button class="btn" id="bangBtn">Big Bang</button></div>
      <div class="rowflex" id="bangConfirm" hidden style="margin-top:8px"><span class="hint" style="margin:0">End this universe and start over?</span><button class="btn danger" id="bangYes">End it</button><button class="btn" id="bangNo">Keep it</button></div>
      <h3>Keep this universe</h3>
      <p class="hint">This universe is saved in your browser every minute, and you can pick it up again next time. You can also keep it as a file.</p>
      <div class="rowflex"><button class="btn" id="saveFileBtn">Save as file</button><button class="btn" id="openFileBtn">Open a file</button><button class="btn" id="snapBtn">Save a picture</button>
      <input type="file" id="fileIn" accept=".json,application/json" hidden></div>
      <p class="hint" id="saveStatus" style="margin-top:8px"></p>`;
    pane.innerHTML = h;
    for (const d of LAW_DEFS) {
      const inp = $('#law-' + d.key);
      inp.addEventListener('pointerdown', () => { inp._old = app.u.laws[d.key]; });
      inp.addEventListener('focus', () => { if (inp._old === undefined) inp._old = app.u.laws[d.key]; });
      inp.addEventListener('input', () => { app.setLaw(d.key, +inp.value); this.syncLaw(d); });
      inp.addEventListener('change', () => {
        const old = inp._old === undefined ? d.def : inp._old, v = app.u.laws[d.key]; inp._old = undefined;
        if (Math.abs(v - old) > 1e-9 && d.key !== 'popCap') app.u.logGod(lawSentence(d, v, old), undefined, undefined, 'law-' + d.key);
      });
    }
    for (const b of $$('[data-reset]', pane)) b.addEventListener('click', () => {
      const d = LAW_DEFS.find(x => x.key === b.dataset.reset), old = app.u.laws[d.key];
      app.setLaw(d.key, d.def); this.syncLaws();
      if (old !== d.def && d.key !== 'popCap') app.u.logGod(lawSentence(d, d.def, old), undefined, undefined, 'law-' + d.key);
    });
    for (const b of $$('[data-preset]', pane)) b.addEventListener('click', () => {
      const p = PRESETS.find(x => x.id === b.dataset.preset);
      for (const d of LAW_DEFS) if (d.key !== 'popCap' && d.key !== 'abiogenesis' && d.key !== 'pestilence') app.setLaw(d.key, p.laws[d.key] !== undefined ? p.laws[d.key] : d.def);
      this.syncLaws();
      app.u.logGod(p.id === 'primordial' ? 'You restored the original laws of the universe.' : 'You rewrote the laws of the universe: ' + p.name.toLowerCase() + '.', undefined, undefined, 'preset');
    });
    $('#seedField').value = String(Math.floor(Math.random() * 900000) + 100000);
    $('#bangBtn').addEventListener('click', () => { $('#bangConfirm').hidden = false; $('#bangBtn').disabled = true; });
    $('#bangNo').addEventListener('click', () => { $('#bangConfirm').hidden = true; $('#bangBtn').disabled = false; });
    $('#bangYes').addEventListener('click', () => {
      $('#bangConfirm').hidden = true; $('#bangBtn').disabled = false;
      const s = parseInt($('#seedField').value.replace(/\D/g, ''), 10) || Math.floor(Math.random() * 1e6);
      app.newUniverse(s);
      $('#seedField').value = String(Math.floor(Math.random() * 900000) + 100000);
    });
    $('#saveFileBtn').addEventListener('click', () => app.store.saveFile());
    $('#snapBtn').addEventListener('click', () => app.store.savePicture());
    $('#openFileBtn').addEventListener('click', () => $('#fileIn').click());
    $('#fileIn').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) app.store.openFile(f); e.target.value = ''; });
    this.syncLaws();
  }
  syncLaw(d) {
    const v = this.app.u.laws[d.key], inp = $('#law-' + d.key), out = $('#out-' + d.key);
    if (+inp.value !== v) inp.value = v;
    setFill(inp);
    out.textContent = fmtLaw(d, v); out.classList.toggle('def', Math.abs(v - d.def) < 1e-9);
  }
  syncLaws() { for (const d of LAW_DEFS) this.syncLaw(d); }
  updateLaws() {
    const u = this.app.u, w = u.world;
    const parts = [w.lastSumN, w.lastSumA, w.lastSumM, u.bioMatter], tot = parts.reduce((a, b) => a + b, 0) || 1;
    $$('#matterBar span').forEach((s, i) => s.style.width = (parts[i] / tot * 100).toFixed(2) + '%');
    const names = ['dissolved', 'algae', 'carrion', 'living bodies'], cols = ['#8b6bc4', '#4fc49e', '#d9733f', '#e7c06c'];
    $('#matterLegend').innerHTML = names.map((n, i) => `<span><i style="background:${cols[i]}"></i>${n} ${Math.round(parts[i] / tot * 100)}%</span>`).join('');
    $('#climateLine').textContent = `Water from ${w.tempMin.toFixed(0)}° to ${w.tempMax.toFixed(0)}°, averaging ${w.tempAvg.toFixed(1)}°. Average light ${Math.round(w.lightAvg * 100)}% of a clear noon.`;
  }

  // ── Life ──
  buildLife() {
    const pane = $('#pane-life');
    const opts = (sel) => MORPH_AXES.map(a => `<option value="${a[0]}"${a[0] === sel ? ' selected' : ''}>${a[1]}</option>`).join('');
    pane.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="label">Alive</div><div class="v" id="kAlive">0</div><canvas id="sparkPop" height="44"></canvas></div>
        <div class="kpi"><div class="label">Species</div><div class="v" id="kSpecies">0</div><canvas id="sparkSp" height="44"></canvas></div>
        <div class="kpi"><div class="label">Births / min</div><div class="v" id="kBirths">0</div></div>
        <div class="kpi"><div class="label">Deaths / min</div><div class="v" id="kDeaths">0</div></div>
      </div>
      <h3>Morphospace</h3>
      <p class="hint">Every dot is a living creature, placed by its genes. Clusters are species. Watch them drift and split.</p>
      <div class="axes"><span class="label">Across</span><select id="mx" aria-label="Horizontal axis">${opts(this.mx)}</select><span class="label">Up</span><select id="my" aria-label="Vertical axis">${opts(this.my)}</select></div>
      <canvas id="morphCv"></canvas>
      <h3>Behaviour</h3>
      <div class="meters" id="meters"></div>
      <h3>Living species</h3>
      <p class="hint">Click a species to light it up in the water. Click again to let go.</p>
      <ol id="speciesList"></ol>
      <h3>Traits over time</h3>
      <table class="traits" id="traitTable"></table>`;
    const sl = $('#speciesList');
    sl.addEventListener('pointerenter', () => { this.holdList = true; });
    sl.addEventListener('pointerleave', () => { this.holdList = false; });
    $('#mx').addEventListener('change', e => { this.mx = +e.target.value; this.updateLife(); });
    $('#my').addEventListener('change', e => { this.my = +e.target.value; this.updateLife(); });
    $('#speciesList').addEventListener('click', e => {
      const f = e.target.closest('[data-follow]');
      if (f) { e.stopPropagation(); this.app.followSpecies(+f.dataset.follow); return; }
      const row = e.target.closest('[data-sp]'); if (!row) return;
      const sp = this.app.u.species.get(+row.dataset.sp);
      this.app.highlight(this.app.r.highlight === sp ? null : sp);
      this.updateLife();
    });
  }
  speciesGroups() {
    const u = this.app.u, reg = u.species, groups = new Map();
    for (const sp of reg.map.values()) {
      if (sp.n <= 0) continue;
      const d = reg.displayOf(sp); const g = groups.get(d) || { sp: d, n: 0 }; g.n += sp.n; groups.set(d, g);
    }
    return Array.from(groups.values()).sort((a, b) => b.n - a.n);
  }
  updateLife() {
    const app = this.app, u = app.u, reg = u.species;
    const groups = this.speciesGroups();
    $('#kAlive').textContent = fmtInt(u.creatures.length);
    $('#kSpecies').innerHTML = groups.filter(g => g.sp.established).length + (groups.some(g => !g.sp.established) ? ' <small>+ strains</small>' : '');
    $('#kBirths').textContent = fmtInt(u.rate('births'));
    $('#kDeaths').textContent = fmtInt(u.rate('deaths'));
    sparkline($('#sparkPop'), u.popHist.map(p => p[1]), '#7bd4be');
    sparkline($('#sparkSp'), u.popHist.map(p => p[2]), '#d7ae60');
    this.drawMorph(groups);
    // behaviour meters
    let school = 0, sn = 0, packs = 0;
    for (const sp of reg.map.values()) if (sp.n > 0) { school += Math.max(0, sp.school) * sp.n; sn += sp.n; packs += sp.packRate; }
    school = sn ? school / sn : 0;
    const M = [
      ['Schooling', Math.min(1, school / 0.6), Math.round(school * 100) + '%', '#8fb8ff'],
      ['Kin feeding', Math.min(1, u.rate('shared') / 1500), fmtInt(u.rate('shared')) + '/m', '#f2d08c'],
      ['Pack hunts', Math.min(1, packs / 40), packs.toFixed(0) + '/m', '#e8775d'],
      ['Kills', Math.min(1, u.rate('kills') / 600), fmtInt(u.rate('kills')) + '/m', '#e8775d'],
      ['Alarm calls', Math.min(1, u.rate('alarms') / 200), fmtInt(u.rate('alarms')) + '/m', '#c9a0ff'],
      ['Starvation', Math.min(1, u.rate('starved') / 600), fmtInt(u.rate('starved')) + '/m', '#8d8577'],
    ];
    $('#meters').innerHTML = M.map(m => `<div class="meter"><span>${m[0]}</span><div class="bar"><span style="width:${(m[1] * 100).toFixed(1)}%;background:${m[3]}"></span></div><span class="num">${m[2]}</span></div>`).join('');
    // species list
    const hl = app.r.highlight;
    if (!this.holdList || this._lastHl !== hl) $('#speciesList').innerHTML = groups.slice(0, 30).map(g => {
      const sp = g.sp, anc = sp.parent ? reg.establishedAncestor(sp.parent) : null;
      const age = (u.t - sp.born) / u.laws.dayLength;
      const name = sp.name || (sp.genus + ' (unnamed strain)');
      const meta = `${sp.role} · ${age < 1 ? 'new' : Math.round(age) + (Math.round(age) === 1 ? ' day' : ' days')}${anc ? ' · from ' + anc.epithet : sp.parent ? '' : ' · first of its line'}`;
      const trend = g.n - (sp._lastN === undefined ? g.n : sp._lastN);
      return `<li class="sprow${hl === sp ? ' on' : ''}" data-sp="${sp.id}"><span class="sw" style="background:hsl(${sp.hue.toFixed(0)},${sp.sat.toFixed(0)}%,60%);color:hsl(${sp.hue.toFixed(0)},${sp.sat.toFixed(0)}%,60%)"></span>
        <div style="min-width:0"><div class="nm">${esc(name)}</div><div class="meta">${esc(meta)}</div></div>
        <div class="ct">${g.n}<small>${trend > 0 ? '▲' : trend < 0 ? '▼' : '·'} <button class="linkbtn" data-follow="${sp.id}" title="Follow one of them" aria-label="Follow one of them">◎</button></small></div></li>`;
    }).join('') || '<li class="hint">Nothing lives yet.</li>';
    this._lastHl = hl;
    if (!this._trendT || u.t - this._trendT > 20) { this._trendT = u.t; for (const g of groups) g.sp._lastN = g.n; }
    // trait trends
    const th = u.traitHist, rows = [['Body size', 1], ['Muscle', 2], ['Diet (hunter = 100)', 3], ['Photosynthesis', 4], ['Armour', 5], ['Senses', 6]];
    const last = th.length ? th[th.length - 1] : null;
    $('#traitTable').innerHTML = rows.map((r, i) => `<tr><td>${r[0]}</td><td class="num">${last ? Math.round(last[r[1]] * 100) : '–'}</td><td style="width:44%"><canvas data-trait="${r[1]}" height="36"></canvas></td></tr>`).join('');
    for (const cv of $$('#traitTable canvas')) sparkline(cv, th.map(p => p[+cv.dataset.trait]), '#d7ae60', 0, 1);
  }
  drawMorph(groups) {
    const app = this.app, u = app.u, cv = $('#morphCv'); if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const pad = 22, ax = MORPH_AXES.find(a => a[0] === this.mx), ay = MORPH_AXES.find(a => a[0] === this.my);
    // fit the view to the living (smoothed so it glides instead of jumping)
    const xs = u.creatures.map(c => c.g[this.mx]).sort((a, b) => a - b), ys = u.creatures.map(c => c.g[this.my]).sort((a, b) => a - b);
    const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0.5;
    let x0 = q(xs, 0.03), x1 = q(xs, 0.97), y0 = q(ys, 0.03), y1 = q(ys, 0.97);
    for (const g of groups.slice(0, 6)) { const a = g.sp.mean(this.mx), b = g.sp.mean(this.my); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
    const fitAx = (lo, hi) => { if (hi < lo) { lo = 0; hi = 1; } const m = (lo + hi) / 2, h = Math.max(0.15, (hi - lo) * 0.62); return [Math.max(0, Math.min(m - h, 1 - 2 * h)), Math.min(1, Math.max(m + h, 2 * h))]; };
    const fx = fitAx(x0, x1), fy = fitAx(y0, y1), vw = this.view && this.view.k === this.mx * 100 + this.my ? this.view : null;
    this.view = vw ? { k: vw.k, x0: lerp(vw.x0, fx[0], 0.25), x1: lerp(vw.x1, fx[1], 0.25), y0: lerp(vw.y0, fy[0], 0.25), y1: lerp(vw.y1, fy[1], 0.25) } : { k: this.mx * 100 + this.my, x0: fx[0], x1: fx[1], y0: fy[0], y1: fy[1] };
    const V = this.view;
    const X = v => pad + (v - V.x0) / (V.x1 - V.x0) * (W - pad - 10), Y = v => H - pad - (v - V.y0) / (V.y1 - V.y0) * (H - pad - 10);
    g.strokeStyle = 'rgba(214,178,112,0.09)'; g.lineWidth = 1;
    for (let k = 0; k <= 10; k++) {
      const v = k / 10;
      if (v >= V.x0 && v <= V.x1) { g.beginPath(); g.moveTo(X(v), Y(V.y0)); g.lineTo(X(v), Y(V.y1)); g.stroke(); }
      if (v >= V.y0 && v <= V.y1) { g.beginPath(); g.moveTo(X(V.x0), Y(v)); g.lineTo(X(V.x1), Y(v)); g.stroke(); }
    }
    g.fillStyle = 'rgba(166,158,137,0.85)'; g.font = '10px "Instrument Sans", system-ui, sans-serif';
    const lab = (lo, hi, a) => lo < 0.08 ? a[2] : Math.round(lo * 100) + '%';
    g.textAlign = 'left'; g.fillText(V.x0 < 0.08 ? ax[2] : ax[1].toLowerCase() + ' ' + Math.round(V.x0 * 100), X(V.x0), H - 6);
    g.textAlign = 'right'; g.fillText((V.x1 > 0.92 ? ax[3] : ax[1].toLowerCase() + ' ' + Math.round(V.x1 * 100)) + ' →', X(V.x1), H - 6);
    g.save(); g.translate(11, Y(V.y0)); g.rotate(-Math.PI / 2); g.textAlign = 'left'; g.fillText(V.y0 < 0.08 ? ay[2] : Math.round(V.y0 * 100) + '', 0, 0);
    g.textAlign = 'right'; g.fillText((V.y1 > 0.92 ? ay[3] : ay[1].toLowerCase() + ' ' + Math.round(V.y1 * 100)) + ' →', Y(V.y0) - Y(V.y1), 0); g.restore();
    const hl = app.r.highlight, sel = app.r.selected, reg = u.species;
    for (const c of u.creatures) {
      const on = !hl || c.sp === hl || reg.displayOf(c.sp) === hl;
      g.globalAlpha = on ? 0.8 : 0.12;
      g.fillStyle = `hsl(${c.hue | 0},${c.sat | 0}%,62%)`;
      const s = c.r > 7 ? 3 : 2.2;
      g.fillRect(X(c.g[this.mx]) - s / 2, Y(c.g[this.my]) - s / 2, s, s);
    }
    g.globalAlpha = 1;
    if (sel && !sel.dead) { g.strokeStyle = '#f2d08c'; g.lineWidth = 1.4; g.beginPath(); g.arc(X(sel.g[this.mx]), Y(sel.g[this.my]), 5.5, 0, TAU); g.stroke(); }
    g.font = 'italic 12px "IM Fell English", Georgia, serif'; g.textAlign = 'center';
    const boxes = [];
    for (const gr of groups.slice(0, 8)) {
      const sp = gr.sp; if (!sp.name) continue;
      const x = X(sp.mean(this.mx)), tw = g.measureText(sp.epithet).width;
      let y = Y(sp.mean(this.my)) - 7;
      for (let tries = 0; tries < 6 && boxes.some(b => Math.abs(b.x - x) < (b.w + tw) / 2 + 4 && Math.abs(b.y - y) < 14); tries++) y -= 14;
      if (boxes.some(b => Math.abs(b.x - x) < (b.w + tw) / 2 + 4 && Math.abs(b.y - y) < 14)) continue;
      boxes.push({ x, y, w: tw });
      g.fillStyle = 'rgba(4,6,12,0.7)'; g.fillRect(x - tw / 2 - 3, y - 11, tw + 6, 14);
      g.fillStyle = `hsl(${sp.hue | 0},70%,78%)`; g.fillText(sp.epithet, x, y);
    }
  }

  // ── Chronicle ──
  buildChron() {
    $('#pane-chron').innerHTML = `<div class="oracle" id="oracle" hidden>
        <h4>Ask the Oracle</h4>
        <p class="hint" style="margin:3px 0 0">Claude reads this universe’s history and answers. Each question uses your own Claude usage.</p>
        <div class="chips"><button class="seg" data-q="Tell the story of this universe so far, as a natural history.">The story so far</button>
          <button class="seg" data-q="Which species are winning right now, and why? Which are in danger?">Who is winning?</button>
          <button class="seg" data-q="As its god, what experiment should I try next to see something new emerge? Suggest two, using the tools and laws I have.">What should I try?</button></div>
        <form id="oracleForm"><input class="field" id="oracleQ" placeholder="Why did the hunters vanish?" autocomplete="off" aria-label="Your question for the Oracle"><button class="btn primary" id="oracleAsk">Ask</button></form>
        <div id="oracleOut"></div>
      </div>
      <ol id="chronList"></ol>`;
    $('#chronList').addEventListener('pointerenter', () => { this.holdChron = true; });
    $('#chronList').addEventListener('pointerleave', () => { this.holdChron = false; if (this.chronSeen !== this.app.u.chronSeq) this.updateChron(); });
    $('#chronList').addEventListener('click', e => {
      const li = e.target.closest('[data-px]'); if (!li) return;
      const sp = +li.dataset.sp; if (sp) { const s = this.app.u.species.get(sp); if (s && s.n > 0) this.app.highlight(this.app.u.species.displayOf(s), true); }
      this.app.r.flyTo(+li.dataset.px, +li.dataset.py, 2.6);
    });
  }
  updateChron() {
    const u = this.app.u;
    if (u.chronSeq === this.chronSeen || (this.holdChron && this.chronSeen >= 0)) return;
    const fresh = this.chronSeen;
    this.chronSeen = u.chronSeq;
    const list = u.chronicle.slice(-160).reverse();
    $('#chronList').innerHTML = list.map(e => {
      const loc = e.px !== null && e.px !== undefined;
      return `<li class="ce k-${e.kind}${loc ? ' loc' : ''}${fresh >= 0 && e.seq > fresh ? ' fresh' : ''}"${loc ? ` data-px="${e.px.toFixed(0)}" data-py="${e.py.toFixed(0)}" data-sp="${e.sp || 0}"` : ''}>
        <span class="g">${GLYPH[e.kind] || '·'}</span><div><div class="ts">Year ${e.yr} · ${e.s} · day ${e.d}</div><div class="txt">${richText(e.text)}</div></div></li>`;
    }).join('');
  }

  // ── Specimen ──
  buildSpec() {
    $('#pane-spec').innerHTML = '<div id="specBody"></div>';
    $('#pane-spec').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const app = this.app, c = app.r.selected;
      switch (b.dataset.act) {
        case 'pick': app.select(app.director.interestingCreature()); break;
        case 'follow': if (c && !c.dead) app.follow(app.r.follow === c ? null : c); break;
        case 'clone': if (c && !c.dead) { app.u.clone(c, 4); } break;
        case 'bless': if (c && !c.dead) { app.u.bless(c); app.u.logGod('You blessed a *' + (app.u.species.displayOf(c.sp).name || 'creature') + '* with full strength.', c.x, c.y, 'bless'); } break;
        case 'smite': if (c && !c.dead) app.u.smiteOne(c); break;
        case 'parent': { const p = app.u.creatures.find(x => x.id === c.parentId); if (p) app.select(p); break; }
        case 'release': app.select(null); break;
      }
      this.specKey = null; this.updateSpec();
    });
  }
  updateSpec() {
    const app = this.app, u = app.u, c = app.r.selected, body = $('#specBody');
    if (!c) {
      if (this.specKey !== 'none') { this.specKey = 'none'; body.innerHTML = `<p class="spec-empty">Click any creature in the water to examine it: its genes, its history, and its brain as it thinks.</p><button class="btn" data-act="pick">Show me someone interesting</button>`; }
      return;
    }
    const reg = u.species, d = reg.displayOf(c.sp), name = d && d.name ? d.name : c.sp.genus + ' (unnamed strain)';
    const key = c.id + ':' + c.dead;
    if (this.specKey !== key) {
      this.specKey = key;
      body.innerHTML = `<div class="spec-head"><div class="nm">${esc(name)}</div><div class="sub" id="specSub"></div></div>
        <div style="margin-top:9px" id="specChips"></div>
        <div style="margin-top:12px"><div class="label">Energy</div><div class="ebar"><span id="specE"></span></div><div class="hint num" id="specEtxt" style="margin:0"></div></div>
        <div class="stats" id="specStats"></div>
        <h3>Genome</h3><div class="genes" id="specGenes"></div>
        <h3>Brain, live</h3><p class="hint">Senses on the left, eight neurons in the middle, actions on the right. Gold excites, blue inhibits.</p>
        <canvas id="brainCv"></canvas>
        <div class="actions">${c.dead ? '' : `<button class="btn" data-act="follow" id="followBtn">Follow</button><button class="btn" data-act="clone" title="Make four exact copies">Clone ×4</button><button class="btn" data-act="bless" title="Fill its energy">Bless</button><button class="btn danger" data-act="smite">Smite</button>`}<button class="btn" data-act="release">Let go</button></div>`;
      $('#specGenes').innerHTML = GENE_VIEW.map(([gi, label]) => `<div class="gene"><span>${label}</span><div class="track"><span id="gb${gi}"></span>${gi === G_TPREF ? '<i id="gTemp"></i>' : ''}</div><span class="num" id="gv${gi}"></span></div>`).join('');
    }
    const days = c.age / u.laws.dayLength;
    const parentAlive = u.creatures.some(x => x.id === c.parentId);
    $('#specSub').innerHTML = `Specimen №${c.id} · generation ${c.gen}${c.parentId ? ` · ${parentAlive ? '<button class="linkbtn" data-act="parent">parent alive</button>' : 'parent gone'}` : ' · born of nothing'}`;
    $('#specChips').innerHTML = `<span class="chip">${c.role}</span>${c.dead ? `<span class="chip dead">${c.cause === 'old age' ? 'died of old age' : c.cause === 'eaten' || c.cause === 'engulfed' ? 'eaten' : c.cause}</span>` : '<span class="chip" style="color:var(--life);border-color:rgba(123,212,190,.45)">alive</span>'}${c.infected > 0 ? '<span class="chip sick">sick</span>' : c.immune ? '<span class="chip sick">immune</span>' : ''}${app.r.follow === c ? '<span class="chip">following</span>' : ''}`;
    $('#specE').style.width = Math.max(0, Math.min(100, c.E / c.Emax * 100)).toFixed(1) + '%';
    $('#specEtxt').textContent = c.dead ? 'Its matter has returned to the water.' : `${c.E.toFixed(0)} of ${c.Emax.toFixed(0)} · breeds at ${Math.round(c.reproF * 100)}%`;
    const T = u.world.temp[u.world.cellOf(c.x, c.y)];
    $('#specStats').innerHTML = [['Age', days.toFixed(1) + ' d'], ['Children', c.children], ['Kills', c.kills], ['Shared', Math.round(c.given)], ['Speed', Math.round(c.speed)], ['Water', T.toFixed(0) + '°']]
      .map(s => `<div class="stat"><div class="label">${s[0]}</div><div class="v">${s[1]}</div></div>`).join('');
    for (const [gi, , f] of GENE_VIEW) {
      const v = c.g[gi]; $('#gb' + gi).style.width = (v * 100).toFixed(1) + '%'; $('#gv' + gi).textContent = f(v);
    }
    const gt = $('#gTemp'); if (gt) gt.style.left = clamp((T + 5) / 40, 0, 1) * 100 + '%';
    const fb = $('#followBtn'); if (fb) fb.textContent = app.r.follow === c ? 'Stop following' : 'Follow';
  }
  drawBrain() {
    const c = this.app.r.selected, cv = $('#brainCv'); if (!c || !cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const xi = 84, xh = W * 0.55, xo = W - 62, top = 12, bot = H - 10;
    const yi = i => top + (bot - top) * (i + 0.5) / NI, yh = h => top + (bot - top) * (h + 0.5) / NH, yo = o => top + (bot - top) * (o + 0.5) / NO;
    const w = c.w, inp = c.inp, hid = c.hid, out = c.out;
    const outAct = [out[O_TURN], out[O_THRUST] * 2 - 1, out[O_ATTACK] * 2 - 1, out[O_SHARE] * 2 - 1, out[O_MEM0], out[O_MEM1]];
    const edge = (x1, y1, x2, y2, wt, act) => {
      const a = Math.min(1, Math.abs(wt * act) * 0.55); if (a < 0.03) return;
      g.strokeStyle = wt * act > 0 ? `rgba(242,196,110,${a})` : `rgba(120,170,255,${a})`;
      g.lineWidth = 0.6 + Math.min(2.2, Math.abs(wt) * 0.5);
      g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2); g.stroke();
    };
    for (let i = 0; i < NI; i++) for (let h = 0; h < NH; h++) edge(xi, yi(i), xh, yh(h), w[i * NH + h], inp[i]);
    for (let h = 0; h < NH; h++) for (let o = 0; o < NO; o++) edge(xh, yh(h), xo, yo(o), w[W2_OFF + h * NO + o], hid[h]);
    g.globalAlpha = 0.45;
    for (let i = 0; i < NI; i++) for (let o = 0; o < NO; o++) { const wt = w[WD_OFF + i * NO + o]; if (Math.abs(wt * inp[i]) > 0.6) edge(xi, yi(i), xo, yo(o), wt, inp[i]); }
    g.globalAlpha = 1;
    const node = (x, y, v, r) => {
      g.beginPath(); g.arc(x, y, r, 0, TAU);
      g.fillStyle = v >= 0 ? `rgba(242,196,110,${0.15 + 0.85 * Math.min(1, v)})` : `rgba(120,170,255,${0.15 + 0.85 * Math.min(1, -v)})`;
      g.fill(); g.strokeStyle = 'rgba(214,178,112,0.35)'; g.lineWidth = 0.8; g.stroke();
    };
    g.font = '10px "Instrument Sans", system-ui, sans-serif'; g.textBaseline = 'middle';
    for (let i = 0; i < NI; i++) { node(xi, yi(i), inp[i], 3.4); g.fillStyle = Math.abs(inp[i]) > 0.15 ? 'rgba(236,229,211,0.9)' : 'rgba(166,158,137,0.6)'; g.textAlign = 'right'; g.fillText(INPUT_LABELS[i], xi - 7, yi(i)); }
    for (let h = 0; h < NH; h++) node(xh, yh(h), hid[h], 5.5);
    for (let o = 0; o < NO; o++) { node(xo, yo(o), outAct[o], 5.5); g.fillStyle = 'rgba(236,229,211,0.9)'; g.textAlign = 'left'; g.fillText(OUTPUT_LABELS[o], xo + 9, yo(o)); }
  }
}

function sparkline(cv, data, color, lo, hi) {
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const d = data.slice(-180); if (d.length < 2) return;
  let mn = lo !== undefined ? lo : Math.min(...d), mx = hi !== undefined ? hi : Math.max(...d);
  if (lo === undefined) { const span = mx - mn || 1; mn -= span * 0.1; mx += span * 0.1; }
  const X = i => i / (d.length - 1) * (W - 3) + 1, Y = v => H - 2 - (v - mn) / (mx - mn || 1) * (H - 4);
  g.beginPath(); d.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)));
  g.lineTo(X(d.length - 1), H); g.lineTo(X(0), H); g.closePath();
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, color + '55'); gr.addColorStop(1, color + '00'); g.fillStyle = gr; g.fill();
  g.beginPath(); d.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)));
  g.strokeStyle = color; g.lineWidth = 1.3; g.stroke();
  g.beginPath(); g.arc(X(d.length - 1), Y(d[d.length - 1]), 2.2, 0, TAU); g.fillStyle = color; g.fill();
}
