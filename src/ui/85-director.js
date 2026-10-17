// ═══════════════════════════════════════════════════════════════════
//  Emergence · Watch mode: a slow documentary camera with captions
// ═══════════════════════════════════════════════════════════════════
class Director {
  constructor(app) {
    this.app = app; this.on = false; this.subject = null; this.timer = 0; this.kind = ''; this.recent = []; this.wakeT = 0;
    window.addEventListener('pointermove', () => {
      if (!this.on) return;
      $('#app').classList.add('mouse-awake'); clearTimeout(this.wakeT);
      this.wakeT = setTimeout(() => $('#app').classList.remove('mouse-awake'), 1800);
    });
  }
  toggle() { this.on ? this.stop() : this.start(); }
  start() {
    const app = this.app;
    if (!app.u.creatures.length) { app.shell.toast({ kind: 'note', text: 'Nothing lives yet. Wait for the first spark.' }, true); return; }
    this.on = true; $('#app').classList.add('doc'); $('#watchBtn').classList.add('on'); app.r.followOffsetY = 0.1;
    app.shell.setTool('observe'); app.r.brush = null;
    this.recent = []; this.pick();
  }
  stop() {
    if (!this.on) return;
    this.on = false; $('#app').classList.remove('doc', 'mouse-awake'); $('#watchBtn').classList.remove('on');
    const r = this.app.r; r.follow = null; r.followZ = null; r.followOffsetY = 0; this.subject = null;
    this.setCaption('', '');
  }
  update(dt) {
    if (!this.on) return;
    this.timer -= dt;
    const s = this.subject;
    if (s && s.dead && !this.deathNoted) {
      this.deathNoted = true;
      const name = this.name(s);
      const line = { eaten: `…and the ${name} is taken. Its body feeds another.`, engulfed: `…and the ${name} is swallowed whole.`, starved: `…and the ${name} starves. Its matter returns to the water.`,
        'old age': `…and the ${name} dies of age, its lineage carried on by others.`, plague: `…and the plague takes the ${name}.`, smitten: '…and your lightning ends it.', meteor: '…and fire falls from the sky.' }[s.cause] || `…and the ${name} is gone.`;
      this.setCaption(line, '');
      this.timer = Math.min(this.timer, 5);
    }
    if (this.timer <= 0) this.pick();
  }
  name(c) { const d = this.app.u.species.displayOf(c.sp); return d && d.name ? `*${d.name}*` : 'nameless creature'; }
  sname(sp) { return sp && sp.name ? `*${sp.name}*` : 'a nameless strain'; }

  candidates() {
    const u = this.app.u, reg = u.species, cs = u.creatures, out = [];
    const days = (s) => { const d = s / u.laws.dayLength; return d < 1 ? 'less than a day' : d < 1.5 ? 'a day' : Math.round(d) + ' days'; };
    let hunt = null, scav = null, share = null, sick = null, sun = null, flee = null, elder = null, giant = null;
    for (const c of cs) {
      if (c.biteT > 0 && c.diet > 0.42 && c.biteTarget && !c.biteTarget.dead) hunt = c;
      else if (c.scavT > 0 && c.diet > 0.35) scav = c;
      if (c.shareT > 0 && c.shareTarget && !c.shareTarget.dead) share = c;
      if (c.infected > 0) sick = c;
      if (c.photo > 0.5 && c.inp[I_LIGHT] > 0.6) sun = c;
      if (c.pain > 0.6 && c.speed > 30) flee = c;
      if (c.sp.established || reg.displayOf(c.sp).established) {
        if (!elder || c.age > elder.age) elder = c;
        if (!giant || c.rA > giant.rA) giant = c;
      }
    }
    if (hunt) {
      const prey = hunt.biteTarget;
      out.push({ kind: 'hunt', c: hunt, w: 6, zoom: 3.6, line: pick([`A ${this.name(hunt)} has caught a ${this.name(prey)}. Flesh is the richest food in this world, and the hardest won.`,
        `The ${this.name(hunt)} strikes. Its prey, a ${this.name(prey)}, struggles to tear free.`, `Hunter and hunted: a ${this.name(hunt)} closes its jaws on a ${this.name(prey)}.`]) });
    }
    if (scav) out.push({ kind: 'scav', c: scav, w: 2.5, zoom: 3.4, line: `A ${this.name(scav)} feeds on the remains of the dead. Nothing in this universe is wasted.` });
    if (share) out.push({ kind: 'share', c: share, w: 4, zoom: 3.8, line: pick([`A ${this.name(share)} passes its energy to a hungry relative. Kin know each other by colour.`, `Generosity, or kinship: a well-fed ${this.name(share)} feeds a starving cousin.`]) });
    if (sick) out.push({ kind: 'sick', c: sick, w: 4, zoom: 3.2, line: `Sickness moves through the ${this.name(sick)}, passed by touch from one relative to the next.` });
    if (sun) out.push({ kind: 'sun', c: sun, w: 2, zoom: 3.0, line: `This ${this.name(sun)} basks in the light, living like a plant that swims.` });
    if (flee) out.push({ kind: 'flee', c: flee, w: 2.5, zoom: 3.2, line: `A ${this.name(flee)} flees, wounded. Somewhere behind it, something hungrier.` });
    if (elder && elder.age > u.laws.dayLength * 1.5) out.push({ kind: 'elder', c: elder, w: 1.6, zoom: 3.4, line: `This ${this.name(elder)} has lived ${days(elder.age)}, longer than anything else alive. ${elder.children === 0 ? 'It has no children.' : elder.children === 1 ? 'It has one child.' : `It has ${elder.children} children.`}` });
    if (giant && giant.rA > 7.5) out.push({ kind: 'giant', c: giant, w: 1.6, zoom: 2.6, line: `The largest creature alive, a ${this.name(giant)}, ${(giant.rA * 2).toFixed(0)} units across.` });
    // species-level stories
    let school = null, newest = null, spark = null;
    for (const sp of reg.map.values()) {
      if (sp.n < 1) continue;
      if (sp.established && sp.school > 0.35 && sp.n >= 15 && (!school || sp.school * sp.n > school.school * school.n)) school = sp;
      if (sp.established && sp.parent && u.t - sp.estTime < u.laws.dayLength * 2 && (!newest || sp.estTime > newest.estTime)) newest = sp;
      if (!sp.parent && u.t - sp.born < 25) spark = sp;
    }
    const memberOf = (sp, best) => { let m = null; for (const c of cs) if (c.sp === sp || reg.displayOf(c.sp) === sp) { if (!m || best(c) > best(m)) m = c; } return m; };
    if (school) { const m = memberOf(school, c => c.kinN); if (m) out.push({ kind: 'school', c: m, w: 3.5, zoom: 2.4, line: `${school.n} ${this.sname(school)} move as one. In a crowd of kin, a hunter cannot choose.` }); }
    if (newest) { const m = memberOf(newest, c => c.E); if (m) out.push({ kind: 'new', c: m, w: 4, zoom: 3.2, line: `${this.sname(newest)}, a species only ${days(u.t - newest.estTime)} old: ${newest.desc}.` }); }
    if (spark) { const m = memberOf(spark, c => c.E); if (m) out.push({ kind: 'spark', c: m, w: 6, zoom: 2.8, line: 'Life has sparked again from nothing. Most new lineages vanish within a day; a few take hold.' }); }
    // places and the whole
    const v = u.world.vents[Math.floor(Math.random() * u.world.vents.length)];
    if (v) out.push({ kind: 'vent', at: [v.x, v.y], w: 1.2, zoom: 2.2, line: `Around the ${v.name}, warm water rises from below, rich with matter. Life gathers where the sea is generous.` });
    const groups = new Map(); for (const sp of reg.map.values()) if (sp.n > 0) { const d = reg.displayOf(sp); groups.set(d, (groups.get(d) || 0) + sp.n); }
    const top = Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
    if (top.length) {
      const est = top.filter(t => t[0].established).length;
      out.push({ kind: 'overview', at: null, w: 1.5, zoom: 1, line: `Year ${u.year}, ${u.season.toLowerCase()}. ${fmtInt(cs.length)} creatures of ${est} ${est === 1 ? 'species' : 'species'}. The ${this.sname(top[0][0])} hold the most water.` });
    }
    return out;
  }
  pick() {
    const r = this.app.r, list = this.candidates().filter(c => !this.recent.includes(c.kind) || c.kind === 'hunt');
    if (!list.length) { this.timer = 4; return; }
    let tot = 0; for (const c of list) tot += c.w;
    let x = Math.random() * tot, ch = list[0];
    for (const c of list) { x -= c.w; if (x <= 0) { ch = c; break; } }
    this.recent.push(ch.kind); if (this.recent.length > 3) this.recent.shift();
    this.kind = ch.kind; this.deathNoted = false;
    if (ch.c) {
      this.subject = ch.c; r.follow = ch.c; r.followZ = r.cam.zFit * ch.zoom; r.camT = null;
      const c = ch.c, d = this.app.u.species.displayOf(c.sp);
      const dd = c.age / this.app.u.laws.dayLength;
      this.setCaption(ch.line, `${c.role} · generation ${c.gen} · ${dd < 0.15 ? 'newborn' : dd.toFixed(1) + ' days old'}`);
    } else {
      this.subject = null; r.follow = null; r.followZ = null;
      if (ch.at) r.flyTo(ch.at[0], ch.at[1], ch.zoom); else r.camT = { x: r.cam.x, y: r.cam.y, z: r.cam.zFit };
      this.setCaption(ch.line, ch.kind === 'overview' ? this.app.u.name : '');
    }
    this.timer = ch.kind === 'overview' ? 10 : 13 + Math.random() * 7;
  }
  setCaption(line, meta) {
    const L = $('#capLine'), M = $('#capMeta');
    L.style.transition = 'opacity .45s'; L.style.opacity = 0; M.style.opacity = 0;
    clearTimeout(this._capT);
    this._capT = setTimeout(() => { L.innerHTML = richText(line).replace(/<em class="sp">/g, '<em>'); M.textContent = meta; L.style.opacity = 1; M.style.opacity = 1; }, line ? 460 : 0);
  }
  interestingCreature() {
    const c = this.candidates().filter(x => x.c).sort((a, b) => b.w - a.w)[0];
    if (c) return c.c;
    const cs = this.app.u.creatures; return cs.length ? cs[Math.floor(Math.random() * cs.length)] : null;
  }
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
