// ═══════════════════════════════════════════════════════════════════
//  Emergence · utilities: math, seeded randomness, toroidal waves, names
// ═══════════════════════════════════════════════════════════════════
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 0x1234567; this.g = 0; this.hasG = false; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  chance(p) { return this.next() < p; }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  gauss() {
    if (this.hasG) { this.hasG = false; return this.g; }
    let u = this.next(); if (u < 1e-12) u = 1e-12;
    const v = this.next(), r = Math.sqrt(-2 * Math.log(u));
    this.g = r * Math.sin(TAU * v); this.hasG = true;
    return r * Math.cos(TAU * v);
  }
  state() { return [this.s, this.g, this.hasG ? 1 : 0]; }
  restore(a) { this.s = a[0] | 0; this.g = a[1]; this.hasG = !!a[2]; }
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Sum of plane waves with integer wave numbers: seamless on the torus, cheap to
// evaluate on the grid using precomputed row/column phasors.
class Waves {
  constructor(rng, n, kmax, gw, gh, ampLaw, omegaMax) {
    this.n = n; this.gw = gw; this.gh = gh;
    this.kx = new Int8Array(n); this.ky = new Int8Array(n);
    this.amp = new Float32Array(n); this.ph = new Float64Array(n); this.om = new Float32Array(n);
    for (let m = 0; m < n; m++) {
      let kx = 0, ky = 0;
      while (kx === 0 && ky === 0) { kx = rng.int(2 * kmax + 1) - kmax; ky = rng.int(2 * kmax + 1) - kmax; }
      this.kx[m] = kx; this.ky[m] = ky;
      this.amp[m] = ampLaw(kx, ky) * rng.range(0.6, 1.0);
      this.ph[m] = rng.next() * TAU;
      this.om[m] = rng.range(-omegaMax, omegaMax);
    }
    this.cx = new Float32Array(n * gw); this.sx = new Float32Array(n * gw);
    this.cy = new Float32Array(n * gh); this.sy = new Float32Array(n * gh);
    for (let m = 0; m < n; m++) {
      for (let i = 0; i < gw; i++) { const a = TAU * this.kx[m] * (i + 0.5) / gw; this.cx[m * gw + i] = Math.cos(a); this.sx[m * gw + i] = Math.sin(a); }
      for (let j = 0; j < gh; j++) { const a = TAU * this.ky[m] * (j + 0.5) / gh; this.cy[m * gh + j] = Math.cos(a); this.sy[m * gh + j] = Math.sin(a); }
    }
  }
  // out = Σ amp·sin(θ)
  fillValue(out, t) {
    const { n, gw, gh } = this; out.fill(0);
    for (let m = 0; m < n; m++) {
      const p = this.ph[m] + this.om[m] * t, pc = Math.cos(p), ps = Math.sin(p), a = this.amp[m];
      const xo = m * gw, yo = m * gh;
      for (let j = 0; j < gh; j++) {
        const yc = this.cy[yo + j], ys = this.sy[yo + j];
        const rr = (pc * yc - ps * ys) * a, ri = (pc * ys + ps * yc) * a;
        const row = j * gw;
        for (let i = 0; i < gw; i++) out[row + i] += rr * this.sx[xo + i] + ri * this.cx[xo + i];
      }
    }
  }
  // divergence-free flow from stream function ψ = Σ amp·sin(θ):  u = ∂ψ/∂y, v = −∂ψ/∂x  (grid units)
  fillFlow(u, v, t, scale) {
    const { n, gw, gh } = this; u.fill(0); v.fill(0);
    for (let m = 0; m < n; m++) {
      const p = this.ph[m] + this.om[m] * t, pc = Math.cos(p), ps = Math.sin(p);
      const a = this.amp[m] * scale;
      const du = a * TAU * this.ky[m] / gh, dv = -a * TAU * this.kx[m] / gw;
      const xo = m * gw, yo = m * gh;
      for (let j = 0; j < gh; j++) {
        const yc = this.cy[yo + j], ys = this.sy[yo + j];
        const rr = pc * yc - ps * ys, ri = pc * ys + ps * yc;
        const row = j * gw;
        for (let i = 0; i < gw; i++) {
          const c = rr * this.cx[xo + i] - ri * this.sx[xo + i];
          u[row + i] += du * c; v[row + i] += dv * c;
        }
      }
    }
  }
}

// ─── Names: genera, Latin epithets, places ───
const NAME_A = ['Va', 'Thal', 'Om', 'Quo', 'Ny', 'Ser', 'Aph', 'Lu', 'Cor', 'Ze', 'Mir', 'Os', 'Pel', 'Ix', 'Tra', 'Nau', 'Sil', 'Bry', 'Cae',
  'Dra', 'Ery', 'Fen', 'Ga', 'Hel', 'Ith', 'Ka', 'Lyr', 'My', 'Nox', 'Or', 'Phy', 'Rho', 'Spi', 'Ty', 'Ul', 'Vor', 'Xan', 'Zo', 'Ae', 'Bel',
  'Cyr', 'Del', 'Eu', 'Glau', 'Hy', 'Ise', 'Ker', 'Mel', 'Ne', 'Pha', 'Sca', 'Tel', 'Ura', 'Vel', 'Zy', 'Am', 'Bo', 'Che', 'Dio', 'Ar'];
const NAME_B = ['la', 'ri', 'no', 'mo', 'ce', 'ta', 'phi', 'di', 've', 'sa', 'li', 'go', 'ra', 'me', 'ni', 'co', 'the', 'pa', 'do', 'su', 'ly', 'xe', 'ma', 'ne', 'ro'];
const NAME_C = ['ris', 'x', 'on', 'a', 'ella', 'ites', 'ops', 'us', 'ia', 'ax', 'yx', 'ora', 'is', 'ium', 'ea', 'ula', 'oma', 'ina', 'eon', 'yra', 'ion'];

const EPITHETS = {
  size: [['magnus', 'grandis', 'gigas', 'robustus', 'colossus', 'titanicus'], ['minor', 'pusillus', 'minutus', 'nanus', 'parvulus', 'exiguus']],
  speed: [['velox', 'celer', 'rapidus', 'fulgurans', 'volans'], ['lentus', 'tardus', 'placidus', 'segnis', 'quietus']],
  diet: [['vorax', 'rapax', 'ferox', 'sanguineus', 'praedator', 'lupinus'], ['pascens', 'mitis', 'herbivorus', 'frugalis', 'innocens']],
  photo: [['lucidus', 'solaris', 'heliophilus', 'chloros', 'luminifer'], ['umbrosus', 'noctivagus', 'obscurus', 'opacus']],
  armor: [['loricatus', 'scutatus', 'armatus', 'durus', 'clipeatus'], ['nudus', 'mollis', 'tener', 'fragilis']],
  sense: [['vigilans', 'oculatus', 'sagax', 'perspicax'], ['caecus', 'hebes', 'somnians']],
  tPref: [['calidus', 'thermophilus', 'aestivus', 'igneus', 'torridus'], ['glacialis', 'borealis', 'frigidus', 'hiemalis', 'nivalis']],
  tTol: [['tolerans', 'vagans', 'ubiquitus', 'eurythermus'], ['stenothermus', 'fastidiosus', 'delicatus']],
  life: [['longaevus', 'antiquus', 'perennis', 'senex'], ['ephemerus', 'brevis', 'fugax']],
  repro: [['parcus', 'patiens', 'prudens'], ['prolificus', 'fecundus', 'avidus']],
  invest: [['maternus', 'nutrix', 'pius'], ['multiparus', 'prodigus', 'spargens']],
  kin: [['familiaris', 'gregarius', 'socialis'], ['solitarius', 'eremita', 'singularis']],
  alarm: [['clamans', 'vocalis', 'monitor'], ['tacitus', 'silens', 'mutus']],
  osc: [['rhythmicus', 'pulsans', 'saltans'], ['constans', 'aequus', 'tranquillus']],
  pig: { red: ['ruber', 'rubra'], orange: ['aurantius'], yellow: ['flavus', 'aureus'], green: ['viridis', 'smaragdinus'], teal: ['thalassinus'],
    cyan: ['cyaneus', 'glaucus'], blue: ['caeruleus', 'azureus'], violet: ['violaceus', 'ianthinus'], magenta: ['purpureus', 'roseus'] },
  root: ['prima', 'primordialis', 'originis', 'nova', 'antiqua', 'genetrix', 'auroralis'],
  plain: ['umbra', 'lumen', 'nebulosa', 'errans', 'ornata', 'serena', 'mirabilis', 'vulgaris', 'communis', 'peregrina', 'stellata', 'marina'],
};
function hueName(h) {
  h = ((h % 360) + 360) % 360;
  if (h < 18 || h >= 340) return 'red'; if (h < 42) return 'orange'; if (h < 70) return 'yellow'; if (h < 150) return 'green';
  if (h < 175) return 'teal'; if (h < 200) return 'cyan'; if (h < 250) return 'blue'; if (h < 290) return 'violet'; return 'magenta';
}

const UNIVERSE_ADJ = ['Opaline', 'Amber', 'Hollow', 'Glass', 'Drowned', 'Lantern', 'Saltwater', 'Velvet', 'Tidal', 'Ember', 'Silver', 'Quiet',
  'Indigo', 'Brine', 'Clouded', 'Sunken', 'Gilded', 'Wandering', 'Sable', 'Murmuring'];
const UNIVERSE_NOUN = ['Drop', 'Shallows', 'Sea', 'Basin', 'Reach', 'Deep', 'Lagoon', 'Vessel', 'Mere', 'Gulf', 'Tarn', 'Sound', 'Pool', 'Firth'];
const VENT_NAMES = ['Ember Vent', 'Salt Chimney', 'Sulphur Garden', 'Black Smoker', 'Iron Spring', 'Pale Fumarole', 'Copper Well', 'Ash Throat'];
