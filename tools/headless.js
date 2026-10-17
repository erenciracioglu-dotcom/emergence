// Headless run of the simulation core, no browser needed. Prints the ecology every 30 simulated seconds.
//   node tools/headless.js [seconds=600] [seed=42] [width=1700] [height=950] [lawsJSON]
//   SAVE=universe.json node tools/headless.js 900 7   also saves the universe at the end and checks it restores
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'src', 'core');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const code = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + '\nreturn { Universe, World, Creature, SpeciesRegistry, DT, LAW_DEFS, G_SIZE, G_SPEED, G_DIET, G_PHOTO, G_ARMOR, G_SENSE, G_KIN, G_ALARM, G_TPREF, NW, NG };';
const M = new Function('Buffer', code)(Buffer);

const secs = +(process.argv[2] || 600), seed = +(process.argv[3] || 42);
const W = +(process.argv[4] || 1700), H = +(process.argv[5] || 950);
const laws = process.argv[6] ? JSON.parse(process.argv[6]) : {};
const u = new M.Universe({ seed, W, H, laws });
u.fxOn = false;
const ticks = Math.round(secs / M.DT);
const t0 = Date.now();
let lastReport = 0, lastChron = 0, tickTimeAcc = 0, tickCount = 0, worst = 0;
for (let k = 0; k < ticks; k++) {
  const a = process.hrtime.bigint();
  u.step();
  const dtms = Number(process.hrtime.bigint() - a) / 1e6;
  tickTimeAcc += dtms; tickCount++; if (dtms > worst) worst = dtms;
  if (u.t - lastReport >= 30) {
    lastReport = u.t;
    const cs = u.creatures, n = cs.length;
    const mean = (gi) => n ? cs.reduce((s, c) => s + c.g[gi], 0) / n : 0;
    const alive = u.species.alive(), est = alive.filter(s => s.established);
    const roles = {}; for (const c of cs) roles[c.role] = (roles[c.role] || 0) + 1;
    const w = u.world;
    const top = est.sort((a, b) => b.n - a.n).slice(0, 5).map(s => `${s.name}:${s.n}(d${s.mean(M.G_DIET).toFixed(2)} sz${s.mean(M.G_SIZE).toFixed(2)} sch${s.school.toFixed(2)} sh${Math.round(s.shareRate)} pk${s.packRate.toFixed(1)})`).join(' | ');
    console.log(`t=${u.t.toFixed(0)}s Y${u.year} ${u.season} n=${n} sp=${alive.length}/${est.length} gen=${u.maxGen} ` +
      `nut=${(w.lastSumN / 1000).toFixed(0)}k alg=${(w.lastSumA / 1000).toFixed(0)}k meat=${(w.lastSumM / 1000).toFixed(1)}k bio=${(u.bioMatter / 1000).toFixed(1)}k ` +
      `light=${w.lightAvg.toFixed(2)} T=${w.tempAvg.toFixed(1)} ` +
      `b/m=${u.rate('births')} d/m=${u.rate('deaths')} k/m=${u.rate('kills')} st/m=${u.rate('starved')} sh/m=${Math.round(u.rate('shared'))} ` +
      `sz=${mean(M.G_SIZE).toFixed(2)} spd=${mean(M.G_SPEED).toFixed(2)} diet=${mean(M.G_DIET).toFixed(2)} ph=${mean(M.G_PHOTO).toFixed(2)} arm=${mean(M.G_ARMOR).toFixed(2)} ` +
      `roles=${JSON.stringify(roles)} ms/tick=${(tickTimeAcc / tickCount).toFixed(2)} worst=${worst.toFixed(1)}`);
    console.log('   top: ' + top);
    tickTimeAcc = 0; tickCount = 0; worst = 0;
    for (const e of u.chronicle) if (e.seq > lastChron) { console.log(`   📜 Y${e.yr} ${e.s} d${e.d} [${e.kind}] ${e.text}`); lastChron = e.seq; }
  }
}
console.log(`done ${secs}s sim in ${((Date.now() - t0) / 1000).toFixed(1)}s real; totals ${JSON.stringify(u.totals)}`);
if (process.env.SAVE) {
  const s = JSON.stringify(u.serialize()); fs.writeFileSync(process.env.SAVE, s); console.log('saved', (s.length / 1e6).toFixed(2), 'MB');
  const u2 = M.Universe.restore(JSON.parse(s)); u2.fxOn = false;
  for (let k = 0; k < 600; k++) u2.step();
  console.log('restored & ran 10s: n=', u2.creatures.length, 'species', u2.species.alive().length);
}
