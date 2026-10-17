// ═══════════════════════════════════════════════════════════════════
//  Emergence · keeping universes: browser autosave, files, pictures
// ═══════════════════════════════════════════════════════════════════
class Store {
  constructor(app) { this.app = app; this.db = null; this.next = 0; this.busy = false; this.dl = undefined; }
  async init() {
    try {
      if (!('indexedDB' in window)) return null;
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('emergence', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('saves');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        setTimeout(() => rej(new Error('timeout')), 3000);
      });
      const meta = await this._get('meta');
      return meta || null;
    } catch (e) { this.db = null; return null; }
  }
  _tx(mode, fn) {
    return new Promise((res, rej) => {
      try { const tx = this.db.transaction('saves', mode), st = tx.objectStore('saves'); const out = fn(st); tx.oncomplete = () => res(out && out.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }
      catch (e) { rej(e); }
    });
  }
  _get(key) { return this.db ? this._tx('readonly', st => st.get(key)) : Promise.resolve(null); }
  async saveNow() {
    if (!this.db || this.busy) return;
    const u = this.app.u; if (!u.creatures.length && u.t < 5) return;
    this.busy = true;
    try {
      const data = JSON.stringify(u.serialize());
      const meta = { name: u.name, year: u.year, season: u.season, n: u.creatures.length, savedAt: Date.now() };
      await this._tx('readwrite', st => { st.put(data, 'auto'); st.put(meta, 'meta'); });
      this.status(`Saved in this browser · Year ${u.year}, ${u.season.toLowerCase()}`);
    } catch (e) { /* storage unavailable: autosave quietly off */ }
    this.busy = false;
  }
  async loadAuto() {
    try { const s = await this._get('auto'); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  tick(now) {
    if (!this.db) return;
    if (!this.next) this.next = now + 45000;
    if (now > this.next) { this.next = now + 60000; this.saveNow(); }
  }
  status(t) { const el = $('#saveStatus'); if (el) el.textContent = t; }
  async downloads() {
    if (this.dl !== undefined) return this.dl;
    try { this.dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { this.dl = null; }
    return this.dl;
  }
  slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  // opened straight from disk (no Claude viewer around it), a plain browser download works
  localDownload(name, blob) {
    if (window.claude) return false;
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      this.status('Saved to your downloads folder.'); return true;
    } catch (e) { return false; }
  }
  async saveFile() {
    const dl = await this.downloads(), u = this.app.u;
    if (!dl) {
      if (this.localDownload(`${this.slug(u.name)}-year-${u.year}.json`, new Blob([JSON.stringify(u.serialize())], { type: 'application/json' }))) return;
      this.status('Saving files is not available in this view. Your universe is still kept in this browser.'); return;
    }
    try {
      const data = JSON.stringify(u.serialize());
      await dl.save({ filename: `${this.slug(u.name)}-year-${u.year}.json`, data });
      this.status('Saved as a file. Open it here any time to continue.');
    } catch (e) { this.status(e && e.code === 'declined' ? 'Not saved.' : 'The file could not be saved here.'); }
  }
  async savePicture() {
    const dl = await this.downloads(), u = this.app.u;
    const blob = await this.app.r.snapshotBlob();
    if (!dl) {
      if (blob && this.localDownload(`${this.slug(u.name)}-year-${u.year}-${u.season.toLowerCase()}.png`, blob)) return;
      this.status('Saving pictures is not available in this view.'); return;
    }
    if (!blob) { this.status('The picture could not be made.'); return; }
    try { await dl.save({ filename: `${this.slug(u.name)}-year-${u.year}-${u.season.toLowerCase()}.png`, data: blob }); this.status('Picture saved.'); }
    catch (e) { this.status(e && e.code === 'declined' ? 'Not saved.' : 'The picture could not be saved here.'); }
  }
  openFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o || o.app !== 'emergence' || !o.world) throw new Error('not a universe');
        this.app.setUniverse(Universe.restore(o));
        this.app.shell.toast({ kind: 'note', text: `${o.name} is back, in year ${this.app.u.year}.` }, true);
        this.status('Opened ' + file.name + '.');
      } catch (e) { this.status('That file is not a saved Emergence universe.'); }
    };
    rd.onerror = () => this.status('The file could not be read.');
    rd.readAsText(file);
  }
}

// ── the opening card ──
class Intro {
  constructor(app) { this.app = app; this.shown = true; this.locked = false; }
  init(meta) {
    $('#beginBtn').addEventListener('click', () => this.dismiss(true));
    if (meta && meta.name) {
      this.locked = true;
      const ago = Math.max(1, Math.round((Date.now() - meta.savedAt) / 60000));
      const when = ago < 60 ? ago + ' min ago' : ago < 1440 ? Math.round(ago / 60) + ' h ago' : Math.round(ago / 1440) + ' days ago';
      $('#introRow').innerHTML = `<button class="btn primary" id="resumeBtn">Return to ${esc(meta.name)}</button><button class="btn" id="beginBtn2">Begin a new universe</button>`;
      $('#introResume').hidden = false;
      $('#introResume').textContent = `Year ${meta.year}, ${String(meta.season).toLowerCase()} · ${fmtInt(meta.n)} alive · saved ${when}`;
      $('#resumeBtn').addEventListener('click', async () => {
        const o = await this.app.store.loadAuto();
        if (o) { try { this.app.setUniverse(Universe.restore(o)); } catch (e) { this.app.shell.toast({ kind: 'note', text: 'That universe could not be restored. A new one has begun.' }, true); } }
        this.locked = false; this.dismiss(true);
      });
      $('#beginBtn2').addEventListener('click', () => { this.locked = false; this.dismiss(true); });
    } else {
      setTimeout(() => this.dismiss(), 9000);
    }
  }
  dismiss(force) {
    if (!this.shown || (this.locked && !force)) return;
    this.shown = false; this.locked = false;
    $('#intro').classList.add('gone');
    setTimeout(() => { $('#intro').hidden = true; }, 1500);
  }
}
