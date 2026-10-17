// ═══════════════════════════════════════════════════════════════════
//  Emergence · the Oracle: Claude reads the universe's history and answers
// ═══════════════════════════════════════════════════════════════════
class Oracle {
  constructor(app) { this.app = app; this.sample = null; this.ctl = null; }
  async init() {
    let s = null;
    try { s = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { s = null; }
    if (!s) return;
    this.sample = s;
    $('#oracle').hidden = false;
    $('#oracleForm').addEventListener('submit', e => { e.preventDefault(); const q = $('#oracleQ').value.trim(); if (q) this.ask(q); });
    for (const b of $$('#oracle [data-q]')) b.addEventListener('click', () => this.ask(b.dataset.q, b.textContent));
  }
  async ask(q, label) {
    if (!this.sample) return;
    if (this.ctl) this.ctl.abort();
    const ctl = this.ctl = new AbortController();
    const out = $('#oracleOut'), btn = $('#oracleAsk');
    out.innerHTML = '<span class="wait">The Oracle is reading the history of your universe…</span>';
    btn.disabled = true;
    const data = this.app.u.portrait();
    const prompt = `You are the Oracle of "${data.universe}", a tiny simulated universe. The person asking is its god: they watch it, and they can bend its laws (sunlight, day length, seasons, climate, currents, viscosity, mutation, entropy, total matter, spontaneous life, pestilence) and use tools (manna, breathing new life, lightning, meteors, plague, stone walls, heat and cold, radiation, whirlpools and gravity wells).

How this universe works: creatures are single cells with a 16-gene genome (body size, muscle, diet from grazer to hunter, photosynthesis, armour, senses, preferred warmth, tolerance, lifespan, breeding patience, care for young, kin recognition, pigment, alarm calls, rhythm) and a small neural-network brain; both mutate when a creature divides. They graze algae that grows in sunlight and warmth, hunt or swallow smaller creatures, scavenge carrion, share energy with kin they recognise by pigment colour, school with kin, raise alarm calls, and catch plagues from close relatives. Matter is conserved: bodies return to the water as carrion and nutrients. A new species is named when a lineage's genes drift far enough from its parent's average. Time: 8 days make a year; each day is one turn of the sun.

Answer the god's question using only the data below. Write two to four short paragraphs, under 200 words in total, in a vivid natural-history voice. Be concrete: name species, numbers and days. Put species names between single asterisks, like *Genus epithet*. If the data cannot answer, say what to watch for instead. No headings, no lists.

DATA:
${JSON.stringify(data)}

QUESTION: ${q}`;
    try {
      const res = await this.sample(prompt, { signal: ctl.signal, modelTier: 'default', effort: 'low', cache: false, onText: ({ text }) => { if (this.ctl === ctl) out.innerHTML = richText(text); } });
      if (this.ctl === ctl) { out.innerHTML = richText(res.text); if (res.truncated) out.insertAdjacentHTML('beforeend', '<div class="err">The answer was cut short.</div>'); }
    } catch (e) {
      if (this.ctl !== ctl) return;
      const code = e && e.code;
      if (code === 'cancelled') { if (e.text) out.innerHTML = richText(e.text); }
      else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
        out.innerHTML = '<span class="err">The Oracle is not available in this view.</span>';
        setTimeout(() => { $('#oracle').hidden = true; }, 4000);
      } else if (code === 'rate_limited') out.innerHTML = (e.text ? richText(e.text) : '') + '<div class="err">The Oracle needs a rest. Ask again in a little while.</div>';
      else if (code === 'refused') out.innerHTML = '<span class="err">The Oracle will not answer that. Try asking differently.</span>';
      else out.innerHTML = (e && e.text ? richText(e.text) : '') + '<div class="err">The Oracle could not answer just now. Try again.</div>';
    } finally {
      if (this.ctl === ctl) { btn.disabled = false; this.ctl = null; }
    }
  }
}
