// ═══════════════════════════════════════════════════════════════════
//  Emergence · species: lineages, divergence, names, the tree of life
// ═══════════════════════════════════════════════════════════════════
class Species {
  constructor(id, parent, founderG, t) {
    this.id = id; this.parent = parent; this.root = parent ? parent.root : this;
    this.founder = new Float32Array(founderG);
    this.sum = new Float64Array(NG);
    this.n = 0; this.peak = 0; this.total = 0; this.born = t; this.extinct = -1;
    this.established = false; this.estTime = -1;
    this.genus = parent ? parent.genus : ''; this.epithet = ''; this.name = '';
    this.kids = []; this.depth = parent ? parent.depth + 1 : 0;
    this.hue = 0; this.sat = 50; this.desc = ''; this.role = 'grazer';
    this.school = 0; this.alignAcc = 0; this.alignCnt = 0;
    this.sharedAcc = 0; this.shareRate = 0; this.packAcc = 0; this.packRate = 0; this.killAcc = 0; this.killRate = 0;
    this.trend = 0; this.nPrev = 0; this.plagueCd = 0;
    this.flags = {};
    this._refreshColor();
  }
  mean(i) { return this.n > 0 ? this.sum[i] / this.n : this.founder[i]; }
  centroid(out) {
    if (this.n > 0) { const k = 1 / this.n; for (let i = 0; i < NG; i++) out[i] = this.sum[i] * k; }
    else out.set(this.founder);
    return out;
  }
  _refreshColor() {
    const a = this.mean(G_PIGA), b = this.mean(G_PIGB);
    this.hue = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    this.sat = 34 + 58 * Math.min(1, Math.hypot(a, b));
    this.role = roleOf(this.mean(G_DIET), this.mean(G_PHOTO));
  }
  get label() { return this.name || (this.established ? '' : 'an unnamed strain'); }
}

const TRAIT_PHRASES = {
  size: ['larger', 'smaller'], speed: ['faster', 'slower'], diet: ['hungrier for flesh', 'gentler grazers'],
  photo: ['able to drink sunlight', 'turning from the sun'], armor: ['armoured', 'soft-bodied'], sense: ['sharper-sensed', 'duller-sensed'],
  tPref: ['warmth-loving', 'cold-adapted'], tTol: ['hardier to change', 'more delicate'], life: ['longer-lived', 'short-lived'],
  repro: ['slower to breed', 'quicker to breed'], invest: ['raising fewer, stronger young', 'scattering many small young'],
  kin: ['more clannish', 'less clannish'], alarm: ['quick to cry alarm', 'quieter'], osc: ['more restless', 'calmer'],
};

class SpeciesRegistry {
  constructor(u) {
    this.u = u; this.map = new Map(); this.nextId = 1; this.usedNames = new Set(); this.usedGenera = new Set();
    this.tmpA = new Float32Array(NG); this.tmpB = new Float32Array(NG);
    this.establishedCount = 0;
  }
  get(id) { return this.map.get(id); }
  newGenus() {
    const rng = this.u.rng;
    for (let k = 0; k < 40; k++) {
      let n = rng.pick(NAME_A) + (rng.chance(0.55) ? rng.pick(NAME_B) : '') + rng.pick(NAME_C);
      n = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
      if (n.length >= 5 && n.length <= 11 && !this.usedGenera.has(n)) { this.usedGenera.add(n); return n; }
    }
    return 'Genus' + this.nextId;
  }
  createRoot(g) {
    const sp = new Species(this.nextId++, null, g, this.u.t);
    sp.genus = this.newGenus();
    this.map.set(sp.id, sp);
    return sp;
  }
  assign(g, parent) {
    parent.centroid(this.tmpA);
    if (geneDist(g, this.tmpA) > SPECIATE_D) {
      const sp = new Species(this.nextId++, parent, g, this.u.t);
      parent.kids.push(sp); this.map.set(sp.id, sp);
      return sp;
    }
    return parent;
  }
  add(c, sp) {
    c.sp = sp; sp.n++; sp.total++;
    const g = c.g, s = sp.sum;
    for (let i = 0; i < NG; i++) s[i] += g[i];
    if (sp.n > sp.peak) sp.peak = sp.n;
    if (sp.extinct >= 0) sp.extinct = -1;
    if (!sp.established && sp.n >= (sp.parent ? EST_N : EST_ROOT)) this.tryEstablish(sp, c);
  }
  remove(c) {
    const sp = c.sp; if (!sp) return;
    sp.n--;
    const g = c.g, s = sp.sum;
    for (let i = 0; i < NG; i++) s[i] -= g[i];
    if (sp.n <= 0) {
      sp.n = 0; sp.sum.fill(0); sp.extinct = this.u.t;
      if (sp.established) this.u.onExtinct(sp, c);
      else if (sp.kids.length === 0) this.prune(sp);
    }
  }
  prune(sp) {
    // a strain that never took hold and left no descendants vanishes from the record
    this.map.delete(sp.id);
    if (sp.parent) {
      const k = sp.parent.kids, i = k.indexOf(sp); if (i >= 0) k.splice(i, 1);
      if (!sp.parent.established && sp.parent.n === 0 && sp.parent.kids.length === 0) this.prune(sp.parent);
    }
  }
  establishedAncestor(sp) {
    let s = sp; while (s && !s.established) s = s.parent; return s;
  }
  displayOf(sp) { return this.establishedAncestor(sp) || sp.root; }

  // a branch must persist, stay distinct from its parent, and not crowd in on a sibling's moment
  tryEstablish(sp, c) {
    const t = this.u.t;
    if (sp.parent) {
      if (t - sp.born < 15) return;
      const anc = this.establishedAncestor(sp.parent) || sp.parent;
      if (anc.lastSplit !== undefined && t - anc.lastSplit < 25) return;
      sp.centroid(this.tmpA); anc.centroid(this.tmpB);
      if (geneDist(this.tmpA, this.tmpB) < SPECIATE_D * 0.7) return;
      anc.lastSplit = t;
    }
    this.establish(sp, c);
  }
  establish(sp, c) {
    sp.established = true; sp.estTime = this.u.t; this.establishedCount++;
    sp._refreshColor();
    const anc = sp.parent ? this.establishedAncestor(sp.parent) : null;
    this.nameSpecies(sp, anc);
    this.u.onEstablish(sp, anc, c);
  }

  // which traits set this species apart from its ancestor?
  divergence(sp, anc) {
    sp.centroid(this.tmpA);
    if (anc) anc.centroid(this.tmpB); else this.tmpB.set(sp.founder);
    const out = [];
    for (let i = 0; i < NG; i++) {
      if (i === G_PIGA || i === G_PIGB) continue;
      const d = this.tmpA[i] - this.tmpB[i];
      out.push({ i, key: GENE_KEYS[i], d, score: Math.abs(d) * Math.sqrt(SPECIES_W[i]) });
    }
    const pd = Math.hypot(this.tmpA[G_PIGA] - this.tmpB[G_PIGA], this.tmpA[G_PIGB] - this.tmpB[G_PIGB]);
    out.push({ i: G_PIGA, key: 'pig', d: pd, score: pd * 0.55 });
    out.sort((a, b) => b.score - a.score);
    return out;
  }
  nameSpecies(sp, anc) {
    const rng = this.u.rng, genus = sp.genus;
    let pool;
    if (!anc) pool = EPITHETS.root.slice();
    else {
      const div = this.divergence(sp, anc);
      const top = div[0];
      if (top.key === 'pig') pool = EPITHETS.pig[hueName(sp.hue)].slice();
      else pool = EPITHETS[top.key][top.d > 0 ? 0 : 1].slice();
      const bits = [];
      const ancRole = anc.role, newRole = roleOf(this.tmpA[G_DIET], this.tmpA[G_PHOTO]);
      if (newRole !== ancRole && newRole === 'hunter') bits.push('turned to hunting');
      else if (newRole !== ancRole && newRole === 'phototroph') bits.push('learned to live on light');
      for (const d of div) {
        if (bits.length >= 2) break;
        if (d.score < 0.05) break;
        if (d.key === 'pig') bits.push('tinted ' + hueName(sp.hue));
        else { const ph = TRAIT_PHRASES[d.key][d.d > 0 ? 0 : 1]; if (!bits.includes(ph)) bits.push(ph); }
      }
      sp.desc = bits.length ? bits.join(' and ') : 'subtly changed';
    }
    // shuffle a little so siblings differ
    for (let k = pool.length - 1; k > 0; k--) { const j = rng.int(k + 1); const t = pool[k]; pool[k] = pool[j]; pool[j] = t; }
    let name = '';
    for (const ep of pool) { const n = genus + ' ' + ep; if (!this.usedNames.has(n)) { name = n; sp.epithet = ep; break; } }
    if (!name) {
      const pl = EPITHETS.plain.slice();
      for (let k = 0; k < pl.length && !name; k++) { const ep = rng.pick(pl); const n = genus + ' ' + ep; if (!this.usedNames.has(n)) { name = n; sp.epithet = ep; } }
    }
    if (!name) {
      const base = genus + ' ' + (pool[0] || 'nova'); const R = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      for (const r of R) { if (!this.usedNames.has(base + ' ' + r)) { name = base + ' ' + r; sp.epithet = (pool[0] || 'nova') + ' ' + r; break; } }
      if (!name) { name = base + ' ' + sp.id; sp.epithet = (pool[0] || 'nova') + ' ' + sp.id; }
    }
    this.usedNames.add(name); sp.name = name;
  }
  alive() { const a = []; for (const sp of this.map.values()) if (sp.n > 0) a.push(sp); return a; }
}
