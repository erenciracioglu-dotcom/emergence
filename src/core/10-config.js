// ═══════════════════════════════════════════════════════════════════
//  Emergence · constants, laws of physics, genome layout
// ═══════════════════════════════════════════════════════════════════
const DT = 1 / 60;            // one tick of universe time, seconds
const CELL = 10;              // field resolution (world units per cell)
const HCELL = 50;             // spatial-hash cell
const FIELD_EVERY = 4;        // fields update every N ticks
const BRAIN_EVERY = 2;        // each creature thinks every N ticks
const DAYS_PER_YEAR = 8;      // two days per season
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const AMAX = 14;              // algae carrying capacity per cell
const FLOW_SPEED = 13;        // RMS current speed at 100 %, units/s
const DRAG = 0.30;            // Stokes drag coefficient (∝ radius · velocity)
const GRAZE_K = 13;           // grazing ∝ m^0.75, like metabolism
const SCAV_K = 36;            // scavenging carrion
const BODY_K = 30;            // matter locked in a body per unit mass
const PHOTO_K = 3.4;
const BITE_K = 42;
const SHARE_K = 10;
const MOVE_COST = 0.012;
const UPKEEP = 0.38;           // size-independent cost of being alive (a nucleus, a nervous system)
const BIRTH_COST = 3;          // fixed matter lost with every birth
const ENGULF_RATIO = 1.6;      // a body this many times wider can swallow another whole
const EST_N = 10;             // a branch species is "established" when it reaches this many
const EST_ROOT = 14;          // a freshly sparked lineage must grow to this before it counts
const SPECIATE_D = 0.27;      // genetic distance from species centroid that founds a new species
const MAX_FORCES = 8;

// The laws a curious god may bend.
const LAW_DEFS = [
  { key: 'sun', label: 'Sunlight', group: 'Light & time', min: 0, max: 2, step: 0.01, def: 1, unit: '%',
    desc: 'How much light pours in. Light grows the algae and feeds the phototrophs.' },
  { key: 'dayLength', label: 'Day length', group: 'Light & time', min: 20, max: 180, step: 1, def: 60, unit: 's',
    desc: 'Seconds for the sun to circle the world once. Slow days give sun-chasers time to keep up.' },
  { key: 'seasons', label: 'Seasons', group: 'Light & time', min: 0, max: 1, step: 0.01, def: 0.5, unit: '%',
    desc: 'How far the warm belt swings north and south over a year.' },
  { key: 'temperature', label: 'Climate', group: 'Climate & medium', min: -15, max: 15, step: 0.5, def: 0, unit: '°',
    desc: 'Shift every temperature at once. Creatures adapted to the old climate must move or change.' },
  { key: 'currents', label: 'Currents', group: 'Climate & medium', min: 0, max: 3, step: 0.01, def: 1, unit: '%',
    desc: 'Strength of the slow gyres that carry algae, matter and anything too weak to swim.' },
  { key: 'viscosity', label: 'Viscosity', group: 'Climate & medium', min: 0.25, max: 4, step: 0.01, def: 1, unit: '%',
    desc: 'Thickness of the medium. Thick water slows everyone; thin water rewards speed.' },
  { key: 'mutation', label: 'Mutation', group: 'Constants of life', min: 0, max: 5, step: 0.01, def: 1, unit: '%',
    desc: 'Cosmic radiation: how far each child strays from its parent.' },
  { key: 'metabolism', label: 'Entropy', group: 'Constants of life', min: 0.4, max: 2.5, step: 0.01, def: 1, unit: '%',
    desc: 'The cost of staying alive. High entropy favours the small and frugal.' },
  { key: 'fertility', label: 'Matter', group: 'Constants of life', min: 0.25, max: 3, step: 0.01, def: 1, unit: '%',
    desc: 'Total matter in the universe. Every body is borrowed from it and returned at death.' },
  { key: 'abiogenesis', label: 'Spontaneous life', group: 'Constants of life', min: 0, max: 1, step: 0.01, def: 0.25, unit: '%',
    desc: 'How often new life sparks from nothing in rich, sunlit water.' },
  { key: 'pestilence', label: 'Pestilence', group: 'Constants of life', min: 0, max: 1, step: 0.01, def: 0.4, unit: '%',
    desc: 'How readily plagues rise in crowded colonies of a single species.' },
  { key: 'popCap', label: 'Population limit', group: 'Constants of life', min: 150, max: 2000, step: 10, def: 900, unit: '',
    desc: 'A ceiling on the living, for your computer’s sake.' },
];
function defaultLaws() { const o = {}; for (const d of LAW_DEFS) o[d.key] = d.def; return o; }

// ─── Genome ───
const GENE_DEFS = [
  // key, label, mutation σ, species-distance weight
  ['size', 'Body size', 0.05, 1.2],
  ['speed', 'Muscle', 0.05, 0.8],
  ['diet', 'Diet', 0.05, 1.6],
  ['photo', 'Photosynthesis', 0.05, 1.4],
  ['armor', 'Armour', 0.05, 1.0],
  ['sense', 'Senses', 0.05, 0.6],
  ['tPref', 'Preferred warmth', 0.035, 1.1],
  ['tTol', 'Warmth tolerance', 0.05, 0.5],
  ['life', 'Lifespan', 0.05, 0.5],
  ['repro', 'Patience to breed', 0.05, 0.4],
  ['invest', 'Care for young', 0.05, 0.4],
  ['kin', 'Kin recognition', 0.05, 0.3],
  ['pigA', 'Pigment a', 0.02, 0.75],
  ['pigB', 'Pigment b', 0.02, 0.75],
  ['alarm', 'Alarm calls', 0.06, 0.3],
  ['osc', 'Inner rhythm', 0.06, 0.2],
];
const NG = GENE_DEFS.length;
const G_SIZE = 0, G_SPEED = 1, G_DIET = 2, G_PHOTO = 3, G_ARMOR = 4, G_SENSE = 5, G_TPREF = 6, G_TTOL = 7,
  G_LIFE = 8, G_REPRO = 9, G_INVEST = 10, G_KIN = 11, G_PIGA = 12, G_PIGB = 13, G_ALARM = 14, G_OSC = 15;
const GENE_SIGMA = new Float32Array(GENE_DEFS.map(d => d[2]));
const SPECIES_W = new Float32Array(GENE_DEFS.map(d => d[3]));
const GENE_KEYS = GENE_DEFS.map(d => d[0]);
