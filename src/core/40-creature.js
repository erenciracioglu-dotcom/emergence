// ═══════════════════════════════════════════════════════════════════
//  Emergence · a creature: genome → body, brain → behaviour
// ═══════════════════════════════════════════════════════════════════
class Creature {
  constructor(id, g, w, x, y, h, rng) {
    this.id = id; this.g = g; this.w = w;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.h = h; this.hx = Math.cos(h); this.hy = Math.sin(h); this.av = 0;
    this.E = 0; this.age = 0; this.gen = 0; this.sp = null; this.parentId = 0;
    this.born = 0; this.children = 0; this.kills = 0; this.given = 0; this.received = 0;
    this.dead = false; this.cause = ''; this.killerSp = 0;
    this.inp = new Float32Array(NI); this.hid = new Float32Array(NH); this.out = new Float32Array(NO);
    this.inp[I_BIAS] = 1; this.out[O_THRUST] = 0.5;
    this.pain = 0; this.infected = 0; this.immune = false; this.alarmCd = 0; this.reproCd = 3;
    this.oscPh = rng.next() * TAU; this.tail = rng.next() * TAU;
    this.kinN = 0; this.align = 0; this.draft = 0; this.near = 0;
    this.thrustF = 0; this.costAcc = 0; this.speed = 0;
    this.held = 0; this.digest = 0; this.engulfedBy = null; this.biteT = 0; this.biteTarget = null; this.shareT = 0; this.shareTarget = null; this.scavT = 0; this.diedAt = 0; this.hc = 0;
    this.lastBiteTick = -1; this.lastBiterSp = 0; this.lastBiterId = 0; this.packT = -9;
    this.flash = 0;            // brief glow on birth / blessing
    this._cq = -1; this.colBody = ''; this.colEdge = ''; this.colCore = '';
    this.derive();
  }

  derive() {
    const g = this.g;
    this.size = g[G_SIZE]; this.speedG = g[G_SPEED]; this.diet = g[G_DIET]; this.photo = g[G_PHOTO]; this.armor = g[G_ARMOR];
    this.rA = 3 + 9 * this.size;
    this.senseR = 35 + 115 * g[G_SENSE];
    this.tPref = -5 + 40 * g[G_TPREF];
    this.tTol = 2 + 10 * g[G_TTOL];
    this.life = 60 + 200 * g[G_LIFE];
    this.reproF = 0.45 + 0.5 * g[G_REPRO];
    this.investF = 0.15 + 0.45 * g[G_INVEST];
    const kt = 0.04 + 0.32 * g[G_KIN]; this.kinTol2 = kt * kt;
    this.alarmP = g[G_ALARM];
    this.oscF = 0.15 + 2.5 * g[G_OSC];
    this.thrustK = (25 + 130 * this.speedG) * (1 - 0.45 * this.photo) * (1 - 0.35 * this.armor);
    this.effPlant = 0.85 * Math.pow(1 - this.diet, 1.1) * (1 - 0.5 * this.photo);
    this.effMeat = 0.92 * Math.pow(this.diet, 0.8);
    this.basalK = 0.55 * (1 + 0.35 * this.armor + 0.4 * this.photo + 0.25 * g[G_SENSE] + 0.2 * g[G_TTOL] + 0.35 * this.speedG + 0.2 * g[G_LIFE]);
    this.maturity = 6 + 8 * this.size;
    this.turnMax = 5.5 - 2.5 * this.size;
    this.pigA = g[G_PIGA]; this.pigB = g[G_PIGB];
    this.hue = (Math.atan2(this.pigB, this.pigA) * 180 / Math.PI + 360) % 360;
    this.sat = 34 + 58 * Math.min(1, Math.hypot(this.pigA, this.pigB));
    this.elong = 1 + 0.32 * this.speedG;
    this.grow();
  }

  grow() {
    const f = this.age >= this.maturity ? 1 : 0.55 + 0.45 * this.age / this.maturity;
    this.r = this.rA * f;
    this.m = (this.r / 5) * (this.r / 5);
    this.m75 = Math.pow(this.m, 0.75);
    this.Emax = 100 * this.m;
    this.body = BODY_K * this.m;
    this.maxThrust = this.thrustK * this.m75;
    this.power = this.m75 * (0.15 + this.diet);
    this.defense = this.m75 * (0.25 + 0.9 * this.armor + 0.2 * this.size);
  }

  // diet label for humans
  get role() { return roleOf(this.diet, this.photo); }
}

function roleOf(diet, photo) {
  if (photo > 0.5 && diet < 0.45) return 'phototroph';
  if (diet > 0.62) return 'hunter';
  if (diet > 0.38) return 'omnivore';
  return 'grazer';
}

function mutateGenes(g, M, rng) {
  const out = new Float32Array(NG);
  const p = Math.min(1, 0.28 * M), sm = Math.sqrt(Math.max(0, M)), macro = 0.008 * M;
  for (let i = 0; i < NG; i++) {
    let v = g[i];
    if (i === G_PIGA || i === G_PIGB) {
      if (M > 0) v += rng.gauss() * GENE_SIGMA[i] * sm;
      out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
      continue;
    }
    if (M > 0) {
      if (rng.next() < p) v += rng.gauss() * GENE_SIGMA[i] * (0.5 + 0.5 * sm);
      if (rng.next() < macro) v += rng.gauss() * 0.25;
    }
    out[i] = v > 1 ? 1 : v < 0 ? 0 : v;
  }
  return out;
}

function protoGenome(rng, localT, kind) {
  const g = new Float32Array(NG);
  g[G_SIZE] = rng.range(0.1, 0.35);
  g[G_SPEED] = rng.range(0.25, 0.6);
  g[G_DIET] = rng.chance(0.18) ? rng.range(0.35, 0.6) : rng.range(0, 0.3);
  g[G_PHOTO] = rng.chance(0.3) ? rng.range(0.3, 0.7) : rng.range(0, 0.15);
  if (kind === 'hunter') { g[G_DIET] = rng.range(0.6, 0.85); g[G_PHOTO] = rng.range(0, 0.08); g[G_SIZE] = rng.range(0.38, 0.6); }
  else if (kind === 'grazer') { g[G_DIET] = rng.range(0, 0.15); g[G_PHOTO] = rng.range(0, 0.1); }
  else if (kind === 'phototroph') { g[G_DIET] = rng.range(0, 0.1); g[G_PHOTO] = rng.range(0.55, 0.85); }
  g[G_ARMOR] = rng.range(0, 0.2);
  g[G_SENSE] = kind === 'hunter' ? rng.range(0.5, 0.8) : rng.range(0.25, 0.6);
  if (kind === 'hunter') g[G_SPEED] = rng.range(0.5, 0.75);
  g[G_TPREF] = clamp((localT + 5) / 40 + rng.gauss() * 0.04, 0, 1);
  g[G_TTOL] = rng.range(0.3, 0.7);
  g[G_LIFE] = rng.range(0.3, 0.6);
  g[G_REPRO] = rng.range(0.3, 0.6);
  g[G_INVEST] = rng.range(0.3, 0.55);
  g[G_KIN] = rng.range(0.3, 0.6);
  const a = rng.next() * TAU, rr = rng.range(0.55, 0.95);
  g[G_PIGA] = Math.cos(a) * rr; g[G_PIGB] = Math.sin(a) * rr;
  g[G_ALARM] = rng.range(0, 0.4);
  g[G_OSC] = rng.next();
  return g;
}

function geneDist(a, b) {
  let s = 0;
  for (let i = 0; i < NG; i++) { const d = a[i] - b[i]; s += SPECIES_W[i] * d * d; }
  return Math.sqrt(s);
}
