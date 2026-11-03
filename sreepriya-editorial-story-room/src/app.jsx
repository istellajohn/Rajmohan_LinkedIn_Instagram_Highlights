import { buildArchive, EDITORS_SELECTION, SHELVES, LENS_LABELS, COLLECTIONS, fmtDate, fmtDateShort, fileDate, domainOf, validUrl, genericUrl, teaserDraft } from './data.js';
import { composeCover, COVER_R, COVER_STYLES, W, H, SAFE_T, SAFE_B, FAMILIES, FAMILY, PALETTES, palette, compose, draw, resolveVariant, frameKinds, clearMeasureCache, defaultSticker, clampSticker, hexOk, contrast, STICKER_W, STICKER_H, typo } from './engine.js';
import { saveFile, copyText, makeZip, readFileAs, store, downloadsCap } from './util.js';

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const LS_KEY = 'sns-story-room:v1';

const ASSETS = window.__SNS_ASSETS__;
const SUPPLIED_COLORS = { primary: '#610124', secondary: '#4F1228', accent: '#A87B51', ink: '#4F1228', paper: '#F7F7F7', mauve: '#B7909F', sand: '#CCB59F', blush: '#ECC5D4' };
const DEFAULT_BRAND = {
  colors: { ...SUPPLIED_COLORS },
  fonts: { serif: 'Newsreader', sans: 'Schibsted Grotesk', serifFile: null, sansFile: null, serifFileName: '', sansFileName: '' },
  logo: { mark: null, markName: '', markDark: null, markDarkName: '', lockup: null },
  clearspace: 0.5, grain: 1, washOpacity: 1,
  portrait: { dataUrl: null, name: '', approved: false, treatment: 'duotone' },
  texture: null, textureName: '', textureOpacity: 0.35,
};

const DEFAULT_COVERS = [
  { id: 'c-press', title: 'Press', style: 'initial', initial: 'P', palette: 'paper', seed: 0 },
  { id: 'c-journal', title: 'Journal', style: 'initial', initial: 'J', palette: 'paper', seed: 0 },
  { id: 'c-watch', title: 'Watch & Listen', style: 'initial', initial: 'W', palette: 'paper', seed: 0 },
  { id: 'c-recog', title: 'Recognition', style: 'initial', initial: 'R', palette: 'paper', seed: 0 },
  { id: 'c-succession', title: 'Succession', style: 'initial', initial: 'S', palette: 'paper', seed: 0 },
  { id: 'c-women', title: 'Women & Wealth', style: 'initial', initial: '&', palette: 'paper', seed: 0 },
  { id: 'c-archive', title: 'Archive', style: 'mark', palette: 'paper', seed: 0 },
];
function baseStory(rec) {
  const fam = rec.d.family;
  const pal = { press: 'paper', byline: 'paper', journal: 'sand', conversation: 'blush', milestone: 'paper', index: 'paper' }[fam] || 'paper';
  return {
    family: fam, variant: 'auto', frames: 1, palette: pal,
    displayHeadline: null, textScale: 1,
    showLogo: true, showWash: true, showMark: false, usePortrait: false,
    washOpacity: 1, washSeed: 0,
    image: null, imageName: '', crop: { cx: 0.5, cy: 0.5, zoom: 1 }, treatment: 'natural',
    sticker: null, overriddenUrl: '', cta: null,
    outletDisplay: null, outletConfirmed: false,
    caption: '', captionApproved: false, captionIsDraft: false,
    context: { kind: 'none', text: '', approved: false, attributionConfirmed: false },
    flagSyndicated: null, status: 'draft', exportedAt: null, linkPasted: false,
  };
}
function mergeStory(rec, saved) {
  const b = baseStory(rec);
  if (!saved) return b;
  return { ...b, ...saved, crop: { ...b.crop, ...(saved.crop || {}) }, context: { ...b.context, ...(saved.context || {}) } };
}

// index stories behave like records with entries
function indexRecord(ix, archive) {
  const entries = (ix.entries || []).map((id) => archive.byId.get(id)).filter(Boolean);
  const target = archive.byId.get(ix.linkTarget) || entries[0];
  const years = entries.map((e) => e.src.year);
  const src = Object.freeze({ id: ix.id, collection: 'index', title: ix.title || 'From the archive', year: years.length ? Math.max(...years) : '', date: target ? target.src.date : '', outlet: target ? target.src.outlet : '', primaryUrl: target ? target.src.primaryUrl : '', sreepriyaRole: '', format: 'Index', topic: '', notes: null });
  return { id: ix.id, src, d: { family: 'index', roleLabel: 'Index', credit: 'Sreepriya N S', cta: 'Explore the archive', attribution: 'Archive index of Sreepriya N S’s published work', access: { code: 'live', label: '' }, sortKey: '' }, isIndex: true, entries, target };
}

function useHash() {
  const read = () => (location.hash || '').replace('#', '') || 'composer';
  const [h, setH] = useState(read);
  useEffect(() => { const f = () => setH(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = (v) => { try { location.hash = v; } catch (e) { /* ignore */ } setH(v); };
  return [h, go];
}

const imgCache = new Map();
function loadImg(src) {
  if (!src) return null;
  let e = imgCache.get(src);
  if (!e) {
    const img = new Image();
    e = { img, ready: false, p: null };
    e.p = new Promise((res) => { img.onload = () => { e.ready = true; res(img); }; img.onerror = () => res(null); });
    img.src = src; imgCache.set(src, e);
  }
  return e;
}
function useImg(src, bump) {
  const [, force] = useState(0);
  const e = src ? loadImg(src) : null;
  useEffect(() => { if (e && !e.ready) e.p.then(() => { force((x) => x + 1); bump && bump(); }); }, [src]);
  return e && e.ready ? e.img : null;
}

// ---------------- App ----------------
export function App() {
  const embedded = useMemo(() => { try { return JSON.parse(document.getElementById('sns-data').textContent); } catch (e) { return null; } }, []);
  const saved = useMemo(() => store(LS_KEY), []);
  const [dataset, setDataset] = useState(() => (saved && saved.dataset) || embedded);
  const [datasetSource, setDatasetSource] = useState(() => (saved && saved.datasetSource) || 'Sreepriya_Media_Data.json (embedded)');
  const archive = useMemo(() => { try { return dataset ? buildArchive(dataset) : null; } catch (e) { return { error: e.message }; } }, [dataset]);
  const [project, setProject] = useState(() => ({
    covers: (saved && saved.covers) || DEFAULT_COVERS,
    stories: (saved && saved.stories) || {}, indexes: (saved && saved.indexes) || {}, queue: (saved && saved.queue) || [], favourites: (saved && saved.favourites) || [],
    brand: saved && saved.brand ? { ...DEFAULT_BRAND, ...saved.brand, colors: { ...DEFAULT_BRAND.colors, ...(saved.brand.colors || {}) }, fonts: { ...DEFAULT_BRAND.fonts, ...(saved.brand.fonts || {}) }, logo: { ...DEFAULT_BRAND.logo, ...(saved.brand.logo || {}) }, portrait: { ...DEFAULT_BRAND.portrait, ...(saved.brand.portrait || {}) } } : DEFAULT_BRAND,
  }));
  const [current, setCurrent] = useState(() => (saved && saved.current) || 'M030');
  const [view, go] = useHash();
  const [toast, setToast] = useState(null);
  const [fontsReady, setFontsReady] = useState(0);
  const [selection, setSelection] = useState([]);
  const [saveState, setSaveState] = useState('');
  const [manualCopy, setManualCopy] = useState(null);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const say = useCallback((msg, kind = 'ok') => { setToast({ msg, kind, id: Math.random() }); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);

  // fonts: built-in + uploaded
  const brand = project.brand;
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loads = [];
        for (const [fam, file] of [[brand.fonts.serif, brand.fonts.serifFile], [brand.fonts.sans, brand.fonts.sansFile]]) {
          if (file) {
            try { const buf = await (await fetch(file)).arrayBuffer(); const ff = new FontFace(fam, buf); await ff.load(); document.fonts.add(ff); } catch (e) { /* keep fallback */ }
          }
        }
        const fams = [brand.fonts.serif, brand.fonts.sans];
        for (const f of fams) for (const w of [300, 400, 500, 600]) for (const s of ['normal', 'italic']) loads.push(document.fonts.load(`${s} ${w} 40px "${f}"`, 'AaNo.₹é'));
        await Promise.all(loads);
      } catch (e) { /* ignore */ }
      if (alive) { clearMeasureCache(); setFontsReady((x) => x + 1); }
    })();
    return () => { alive = false; };
  }, [brand.fonts.serif, brand.fonts.sans, brand.fonts.serifFile, brand.fonts.sansFile]);

  // persistence
  useEffect(() => {
    const t = setTimeout(() => {
      const ok = store(LS_KEY, { covers: project.covers, stories: project.stories, indexes: project.indexes, queue: project.queue, favourites: project.favourites, brand: project.brand, current, dataset: dataset === embedded ? null : dataset, datasetSource });
      setSaveState(ok ? 'Saved in this browser' : 'Not saved in this browser (storage unavailable or full). Use Export project JSON.');
    }, 400);
    return () => clearTimeout(t);
  }, [project, current, dataset]);

  const markImg = useImg(brand.logo.mark || ASSETS.mark, bump);
  const markDarkImg = useImg(brand.logo.markDark, bump);
  const textureImg = useImg(brand.texture, bump);
  const portraitImg = useImg(brand.portrait.approved ? brand.portrait.dataUrl : null, bump);

  if (!archive || archive.error) {
    return <DataGate error={archive && archive.error} onLoad={(json, name) => { setDataset(json); setDatasetSource(name); }} />;
  }

  const getRec = (id) => {
    if (!id) return null;
    if (project.indexes[id]) return indexRecord(project.indexes[id], archive);
    return archive.byId.get(id) || null;
  };
  const getStory = (id) => {
    const rec = getRec(id);
    if (!rec) return null;
    if (rec.isIndex) { const ix = project.indexes[id]; return { ...mergeStory({ d: { family: 'index' } }, ix.story || {}), family: 'index' }; }
    return mergeStory(rec, project.stories[id]);
  };
  const setStory = (id, patch) => {
    setProject((p) => {
      if (p.indexes[id]) {
        const ix = p.indexes[id]; const st = { ...(ix.story || {}), ...patch };
        const benign = Object.keys(patch).every((k) => ['status', 'linkPasted', 'exportedAt'].includes(k));
        if (!benign) st.status = 'edited';
        return { ...p, indexes: { ...p.indexes, [id]: { ...ix, story: st } } };
      }
      const prev = p.stories[id] || {};
      const next = { ...prev, ...patch };
      const benign = Object.keys(patch).every((k) => ['status', 'linkPasted', 'exportedAt'].includes(k));
      if (!benign) next.status = 'edited';
      return { ...p, stories: { ...p.stories, [id]: next } };
    });
  };
  const resetStory = (id) => setProject((p) => { const s = { ...p.stories }; delete s[id]; return { ...p, stories: s }; });

  const ctx = {
    archive, project, setProject, current, setCurrent: (id) => { setCurrent(id); }, getRec, getStory, setStory, resetStory, brand, say, go, view,
    selection, setSelection, fontsReady, tick, bump,
    logo: { mark: (markImg), markDark: markDarkImg, key: (brand.logo.mark ? 'u' : 'd') },
    textureImg, portraitImg, dataset, setDataset, datasetSource, setDatasetSource, embedded, saveState,
    copy: async (text, label) => { const ok = await copyText(text); if (ok) say(`${label} copied`); else setManualCopy({ text, label }); return ok; },
  };

  const curRec = getRec(current) || archive.byId.get('M030') || archive.records[0];

  return (
    <div className="app">
      <Masthead ctx={ctx} />
      <main className="main">
        {view === 'library' && <LibraryView ctx={ctx} />}
        {view === 'queue' && <QueueView ctx={ctx} />}
        {view === 'brand' && <BrandView ctx={ctx} />}
        {view === 'covers' && <CoversView ctx={ctx} />}
        {view === 'export' && <ExportView ctx={ctx} rec={curRec} />}
        {(view === 'composer' || !['library', 'queue', 'brand', 'export', 'covers'].includes(view)) && <Composer ctx={ctx} rec={curRec} />}
      </main>
      {toast && <div className={'toast ' + toast.kind} role="status">{toast.msg}</div>}
      {manualCopy && (
        <div className="modal" role="dialog" aria-label="Copy manually">
          <div className="modal-card">
            <div className="eyebrow">Copy {manualCopy.label.toLowerCase()}</div>
            <p className="note">This view blocked clipboard access. The text is selected below; press Ctrl+C or Cmd+C.</p>
            <textarea id="manual-copy" readOnly value={manualCopy.text} ref={(el) => el && setTimeout(() => { el.focus(); el.select(); }, 30)} rows={Math.min(14, manualCopy.text.split('\n').length + 1)} />
            <div className="row end"><button className="btn" onClick={() => setManualCopy(null)}>Done</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataGate({ error, onLoad }) {
  const [err, setErr] = useState(error || '');
  return (
    <div className="gate">
      <div className="eyebrow">Data import required</div>
      <h1 className="display">The Editorial Story Room</h1>
      <p>No archive is loaded, so nothing is shown. Load <b>Sreepriya_Media_Data.json</b> to build the catalogue.</p>
      {err && <p className="err">{err}</p>}
      <label className="btn primary file"><input id="gate-file" type="file" accept=".json,application/json" onChange={async (e) => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await readFileAs(f, 'text')); buildArchive(j); onLoad(j, f.name); } catch (x) { setErr(x.message); } }} />Import data JSON</label>
    </div>
  );
}

// ---------------- Masthead ----------------
function Masthead({ ctx }) {
  const { archive, view, go } = ctx;
  const c = archive.counts;
  const nav = [['composer', 'Composer'], ['library', 'Library'], ['queue', `Batch Queue${ctx.project.queue.length ? ' · ' + ctx.project.queue.length : ''}`], ['covers', 'Highlight Covers'], ['brand', 'Brand Kit'], ['export', 'Export']];
  return (
    <header className="masthead">
      <div className="mh-left">
        <div className="eyebrow">Sreepriya N S · VALENCE studio</div>
        <div className="mh-title">The Editorial Story Room</div>
        <div className="mh-line">Published words. Public conversations. A record of work.</div>
      </div>
      <div className="mh-right">
        <div className="counts" aria-label="Archive counts">
          <span><b>{c.external_media}</b> Press &amp; Perspectives</span>
          <span><b>{c.entrust_journal}</b> The Entrust Journal</span>
          <span><b>{c.conversations}</b> Watch &amp; Listen</span>
          <span className="sum"><b>{c.total}</b> story-eligible records</span>
          <span className="held">{c.review} review-only rows held back</span>
        </div>
        <nav className="nav" aria-label="Sections">
          {nav.map(([k, l]) => <a key={k} href={'#' + k} className={(view === k || (k === 'composer' && !['library', 'queue', 'brand', 'export', 'covers'].includes(view))) ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(k); }}>{l}</a>)}
        </nav>
      </div>
    </header>
  );
}

// ---------------- filtering ----------------
const LENSES = [
  { key: 'selection', label: 'Editor’s Selection' },
  { key: 'external_media', label: 'Press & Perspectives' },
  { key: 'entrust_journal', label: 'The Entrust Journal' },
  { key: 'conversations', label: 'Watch & Listen' },
  { key: 'recognition', label: 'Recognition', sub: true },
  { key: 'year', label: 'Archive by year', sub: true },
  { key: 'indexes', label: 'Index stories', sub: true },
];
function useFilters() {
  const saved = store(LS_KEY + ':filters') || {};
  const [f, setF] = useState({ lens: 'selection', q: '', outlet: '', year: '', involvement: '', format: '', topic: '', access: '', shelf: '', series: '', hideSyndicated: false, favourites: false, sort: 'new', ...saved });
  useEffect(() => { store(LS_KEY + ':filters', f); }, [f]);
  return [f, (p) => setF((x) => ({ ...x, ...p }))];
}
function applyFilters(archive, project, f) {
  let list = archive.records;
  if (f.lens === 'selection') list = EDITORS_SELECTION.map((id) => archive.byId.get(id)).filter(Boolean);
  else if (f.lens === 'recognition') list = list.filter((r) => r.d.lens === 'Recognition & Appointments');
  else if (COLLECTIONS[f.lens]) list = list.filter((r) => r.src.collection === f.lens);
  const q = f.q.trim().toLowerCase();
  if (q) list = list.filter((r) => (r.src.title + ' ' + r.src.outlet + ' ' + r.src.topic + ' ' + r.id + ' ' + (r.d.series || '') + ' ' + (r.d.shelf || '')).toLowerCase().includes(q));
  if (f.outlet) list = list.filter((r) => r.src.outlet === f.outlet);
  if (f.year) list = list.filter((r) => String(r.src.year) === f.year);
  if (f.involvement) list = list.filter((r) => (r.d.lens || COLLECTIONS[r.src.collection].short) === f.involvement);
  if (f.format) list = list.filter((r) => r.src.format === f.format);
  if (f.topic) list = list.filter((r) => r.src.topic === f.topic);
  if (f.access) list = list.filter((r) => r.d.access.code === f.access);
  if (f.shelf) list = list.filter((r) => r.d.shelf === f.shelf);
  if (f.series) list = list.filter((r) => r.d.series === f.series);
  if (f.hideSyndicated) list = list.filter((r) => { const s = project.stories[r.id]; const flagged = s && s.flagSyndicated != null ? s.flagSyndicated : r.d.syndicated; return !flagged; });
  if (f.favourites) list = list.filter((r) => project.favourites.includes(r.id));
  if (f.lens !== 'selection' || f.sort !== 'new') list = [...list].sort((a, b) => (f.sort === 'old' ? 1 : -1) * (a.d.sortKey < b.d.sortKey ? -1 : a.d.sortKey > b.d.sortKey ? 1 : a.id < b.id ? -1 : 1));
  return list;
}
function uniq(arr) { return [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))); }

function FilterControls({ ctx, f, set, compact }) {
  const { archive } = ctx;
  const R = archive.records;
  const [open, setOpen] = useState(!compact);
  const active = ['outlet', 'year', 'involvement', 'format', 'topic', 'access', 'shelf', 'series'].filter((k) => f[k]).length + (f.hideSyndicated ? 1 : 0) + (f.favourites ? 1 : 0);
  return (
    <div className="filters">
      <div className="searchrow">
        <input id="search" type="search" placeholder="Search titles, outlets, topics, IDs" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search archive" />
        <button className="btn ghost sm" onClick={() => set({ sort: f.sort === 'new' ? 'old' : 'new' })} title="Change sort order">{f.sort === 'new' ? 'Newest first' : 'Oldest first'}</button>
      </div>
      <button className="disclose" onClick={() => setOpen(!open)} aria-expanded={open}>Refine {active ? `(${active} on)` : ''} <span>{open ? '−' : '+'}</span></button>
      {open && (
        <div className="filtergrid">
          <Sel id="f-outlet" label="Outlet" v={f.outlet} set={(v) => set({ outlet: v })} opts={uniq(R.map((r) => r.src.outlet))} />
          <Sel id="f-year" label="Year" v={f.year} set={(v) => set({ year: v })} opts={uniq(R.map((r) => String(r.src.year))).reverse()} />
          <Sel id="f-inv" label="Sreepriya’s involvement" v={f.involvement} set={(v) => set({ involvement: v })} opts={[...LENS_LABELS, 'The Entrust Journal', 'Watch & Listen']} />
          <Sel id="f-format" label="Format" v={f.format} set={(v) => set({ format: v })} opts={uniq(R.map((r) => r.src.format))} />
          <Sel id="f-topic" label="Topic (archive field)" v={f.topic} set={(v) => set({ topic: v })} opts={uniq(R.map((r) => r.src.topic))} />
          <Sel id="f-shelf" label="Audience shelf" v={f.shelf} set={(v) => set({ shelf: v })} opts={SHELVES} />
          <Sel id="f-series" label="Journal sub-series" v={f.series} set={(v) => set({ series: v })} opts={uniq(R.map((r) => r.d.series))} />
          <Sel id="f-access" label="Link access" v={f.access} set={(v) => set({ access: v })} opts={[['live', 'Live page'], ['restricted', 'Publisher restricts automated access'], ['subscription', 'Subscription required'], ['pdf', 'PDF copy, content limited']]} />
          <label className="check"><input id="f-synd" type="checkbox" checked={f.hideSyndicated} onChange={(e) => set({ hideSyndicated: e.target.checked })} /> Hide syndicated copies</label>
          <label className="check"><input id="f-fav" type="checkbox" checked={f.favourites} onChange={(e) => set({ favourites: e.target.checked })} /> Favourites only</label>
          {active > 0 && <button className="btn ghost sm" onClick={() => set({ outlet: '', year: '', involvement: '', format: '', topic: '', access: '', shelf: '', series: '', hideSyndicated: false, favourites: false })}>Clear refinements</button>}
        </div>
      )}
    </div>
  );
}
function Sel({ id, label, v, set, opts }) {
  return (
    <label className="sel" htmlFor={id}><span>{label}</span>
      <select id={id} value={v} onChange={(e) => set(e.target.value)}>
        <option value="">All</option>
        {opts.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function involvementTag(r) { return r.d.lens || COLLECTIONS[r.src.collection].short; }

function RecordRow({ ctx, r, active, onOpen, showYear }) {
  const { project, setProject, selection, setSelection } = ctx;
  const fav = project.favourites.includes(r.id);
  const sel = selection.includes(r.id);
  const st = project.stories[r.id];
  const synd = st && st.flagSyndicated != null ? st.flagSyndicated : r.d.syndicated;
  const rel = ctx.archive.relations.get(r.id);
  return (
    <li className={'rrow' + (active ? ' on' : '')}>
      <input type="checkbox" id={'sel-' + r.id} aria-label={'Select ' + r.id} checked={sel} onChange={() => setSelection(sel ? selection.filter((x) => x !== r.id) : [...selection, r.id])} />
      <button className="rmain" onClick={() => onOpen(r.id)}>
        <span className="rid">{r.id}</span>
        <span className="rtitle">{typo(r.src.title)}</span>
        <span className="rmeta"><i>{r.src.outlet}</i> · {r.src.date ? fmtDateShort(r.src.date) : r.src.year} · {involvementTag(r)}</span>
        <span className="rflags">
          {synd && <em className="flag">Syndicated copy{rel && rel[0] ? ' of ' + rel[0].id : ''}</em>}
          {r.d.access.code !== 'live' && <em className="flag warn">{r.d.access.code === 'restricted' ? 'Access restricted' : r.d.access.code === 'subscription' ? 'Subscription' : 'PDF copy'}</em>}
          {st && st.status && st.status !== 'draft' && <em className={'flag st-' + st.status}>{st.status === 'approved' ? 'Approved' : 'Edited'}</em>}
          {st && st.exportedAt && <em className="flag">Exported</em>}
        </span>
      </button>
      <button className={'star' + (fav ? ' on' : '')} aria-label={fav ? 'Remove favourite' : 'Add favourite'} aria-pressed={fav} onClick={() => setProject((p) => ({ ...p, favourites: fav ? p.favourites.filter((x) => x !== r.id) : [...p.favourites, r.id] }))}>{fav ? '★' : '☆'}</button>
    </li>
  );
}

function Rail({ ctx, rec }) {
  const { archive, project, selection, setSelection, setProject, say } = ctx;
  const [f, set] = useFilters();
  const list = useMemo(() => f.lens === 'indexes' ? [] : applyFilters(archive, project, f), [archive, project, f]);
  const lensCount = (k) => k === 'selection' ? EDITORS_SELECTION.length : k === 'recognition' ? archive.records.filter((r) => r.d.lens === 'Recognition & Appointments').length : k === 'indexes' ? Object.keys(project.indexes).length : k === 'year' ? archive.counts.total : archive.counts[k];
  const addSel = () => { const add = selection.filter((id) => !project.queue.includes(id)); setProject((p) => ({ ...p, queue: [...p.queue, ...add] })); say(`${add.length} added to the batch queue`); setSelection([]); };
  const grouped = f.lens === 'year';
  let lastYear = null;
  return (
    <aside className="rail" aria-label="Archive">
      <ul className="lenses">
        {LENSES.map((l) => (
          <li key={l.key}><button className={(f.lens === l.key ? 'on' : '') + (l.sub ? ' sub' : '')} onClick={() => set({ lens: l.key })}><span>{l.label}</span><b>{lensCount(l.key)}</b></button></li>
        ))}
      </ul>
      {f.lens === 'selection' && <p className="note small">A starter edit balanced across formats and years, chosen from verified IDs. It is not a ranking by reach.</p>}
      {f.lens === 'recognition' && <p className="note small">A lens on records already counted in Press &amp; Perspectives. Not added to the total.</p>}
      {f.lens === 'conversations' && <p className="note small">V003 and V004 are two PowerUp Money URLs that may be one appearance.</p>}
      {f.lens === 'indexes' ? <IndexList ctx={ctx} /> : (
        <>
          <FilterControls ctx={ctx} f={f} set={set} compact />
          <div className="listhead"><span>{list.length} {list.length === 1 ? 'record' : 'records'}</span>
            {selection.length > 0 && <span className="row"><button className="btn sm" onClick={addSel}>Queue {selection.length}</button><button className="btn ghost sm" onClick={() => setSelection([])}>Clear</button></span>}
            {selection.length === 0 && list.length > 0 && <button className="btn ghost sm" onClick={() => setSelection(list.slice(0, 40).map((r) => r.id))}>Select shown</button>}
          </div>
          <ol className="rlist">
            {list.length === 0 && <li className="empty">No records match. Clear a refinement or the search.</li>}
            {list.map((r) => {
              const head = grouped && r.src.year !== lastYear ? (lastYear = r.src.year, <li key={'y' + r.src.year} className="yearhead">{r.src.year}</li>) : null;
              return [head, <RecordRow key={r.id} ctx={ctx} r={r} active={rec && rec.id === r.id} onOpen={(id) => ctx.setCurrent(id)} />];
            })}
            {grouped && <li className="note small">No Sreepriya-specific external press was located for 2010–2020. The earliest external year in the archive is 2021.</li>}
          </ol>
        </>
      )}
    </aside>
  );
}

function IndexList({ ctx }) {
  const { project, setProject, archive, setCurrent } = ctx;
  const ids = Object.keys(project.indexes);
  const create = (entries, title) => {
    const n = ids.length + 1; let id = 'IDX' + String(n).padStart(2, '0'); while (project.indexes[id]) id = id + 'b';
    setProject((p) => ({ ...p, indexes: { ...p.indexes, [id]: { id, title, entries, linkTarget: entries[0], story: {} } } }));
    setCurrent(id);
  };
  const presets = SHELVES.map((s) => ({ s, list: archive.records.filter((r) => r.d.shelf === s && !r.d.syndicated) }));
  return (
    <div className="indexlist">
      <p className="note small">An index story lists 2 to 4 real entries. The link sticker opens one of them, which you choose.</p>
      <ol className="rlist">
        {ids.length === 0 && <li className="empty">No index stories yet.</li>}
        {ids.map((id) => { const ix = project.indexes[id]; return <li key={id} className="rrow"><button className="rmain" onClick={() => setCurrent(id)}><span className="rid">{id}</span><span className="rtitle">{ix.title}</span><span className="rmeta">{ix.entries.join(' · ')}</span></button></li>; })}
      </ol>
      <div className="eyebrow mt">Start from a shelf</div>
      <div className="presetgrid">
        {presets.map(({ s, list }) => <button key={s} className="btn ghost sm" disabled={list.length < 2} onClick={() => create([...list].sort((a, b) => (a.d.sortKey < b.d.sortKey ? 1 : -1)).slice(0, 4).map((r) => r.id), s)}>{s}</button>)}
      </div>
      {ctx.selection.length >= 2 && <button className="btn mt" onClick={() => create(ctx.selection.slice(0, 4), 'From the archive')}>Index from {Math.min(4, ctx.selection.length)} selected</button>}
    </div>
  );
}

// ---------------- composition plumbing ----------------
export function autoHeadline(rec) {
  return rec.src.title.replace(/\s+By Sreepriya\s+N\.?\s?S\.?\s*$/i, '').trim();
}
function storyUrl(rec, st) {
  if (rec.isIndex) return rec.target ? (ctxUrlOverride(rec.target) || rec.target.src.primaryUrl) : '';
  return (st.overriddenUrl && st.overriddenUrl.trim()) || rec.src.primaryUrl;
}
let __projRef = null;
function ctxUrlOverride(r) { const s = __projRef && __projRef.stories[r.id]; return s && s.overriddenUrl ? s.overriddenUrl.trim() : ''; }

function buildInputs(ctx, rec, st, frameIdx, extra = {}) {
  __projRef = ctx.project;
  const kinds = frameKinds(rec.isIndex ? 1 : st.frames);
  const kind = kinds[Math.min(frameIdx, kinds.length - 1)];
  const headline = rec.isIndex ? (rec.src.title || 'From the archive') : (st.displayHeadline != null && st.displayHeadline !== '' ? st.displayHeadline : autoHeadline(rec));
  const image = (st.usePortrait && ctx.portraitImg) ? { img: ctx.portraitImg, key: 'portrait', cx: st.crop.cx, cy: st.crop.cy, zoom: st.crop.zoom, treatment: ctx.brand.portrait.treatment || 'duotone' }
    : (st.image && extra.storyImg) ? { img: extra.storyImg, key: 'img:' + rec.id + ':' + (st.imageName || ''), cx: st.crop.cx, cy: st.crop.cy, zoom: st.crop.zoom, treatment: st.treatment } : null;
  const family = rec.isIndex ? 'index' : st.family;
  const variant = resolveVariant(family, st, headline.length, { hasImage: !!image, entries: rec.entries ? rec.entries.length : 0, avoid: extra.avoid });
  const brand = { ...ctx.brand, textureImg: ctx.textureImg };
  const logo = { mark: ctx.logo.mark, key: ctx.logo.key };
  return {
    rec, st, brand, logo, image, family, variant, frameKind: kind, frameNo: frameIdx + 1, frames: kinds.length,
    url: storyUrl(rec, st), headline, outletDisplay: rec.isIndex ? '' : (st.outletDisplay || rec.src.outlet),
    cta: st.cta || rec.d.cta,
    entries: rec.entries ? rec.entries.map((e) => ({ id: e.id, src: e.src, outlet: e.src.outlet })) : null,
    linkTarget: rec.target ? rec.target.id : null,
  };
}
function composeFrame(ctx, rec, st, frameIdx, extra) {
  const L = buildInputs(ctx, rec, st, frameIdx, extra);
  const comp = compose(L);
  return { ...comp, L };
}
function useStoryImg(st) { return useImg(st && st.image ? st.image : null); }

function fileName(rec, st, frameIdx, mode, L) {
  const fam = FAMILY[L.family].file;
  const date = rec.isIndex ? fileDate(rec.target && rec.target.src.date, rec.target && rec.target.src.year) : fileDate(rec.src.date, rec.src.year);
  return `SNS_${rec.id}_${fam}_${String(frameIdx + 1).padStart(2, '0')}_${date}${mode === 'guide' ? '_GUIDE' : ''}.png`;
}

function renderToBlob(comp, mode, brand) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  draw(c.getContext('2d'), comp, { mode, sans: brand.fonts.sans });
  return new Promise((res) => c.toBlob((b) => res({ blob: b, w: c.width, h: c.height }), 'image/png'));
}

function readiness(ctx, rec, st, comps) {
  const items = [];
  const url = storyUrl(rec, st);
  if (!validUrl(url)) items.push({ level: 'block', msg: 'Link required. The story URL is empty or not a valid http(s) address.' });
  else if (genericUrl(url)) items.push({ level: 'block', msg: 'This is a site homepage, not the article. Use the article’s own URL.' });
  if (!rec.isIndex) {
    if (rec.d.needsMastheadCheck && !st.outletConfirmed) items.push({ level: 'block', msg: 'The archive flags an outlet discrepancy. Confirm the masthead (Copy tab) before approving.' });
    if (rec.d.access.code !== 'live') items.push({ level: 'warn', msg: `${rec.d.access.label}. Open the link in a normal browser before posting.` });
    if (st.frames === 3 && st.context.kind !== 'none' && st.context.text.trim() && !st.context.approved) items.push({ level: 'block', msg: 'Frame 2 has unapproved text. Approve it or set it to none.' });
    if (st.context.kind === 'quote' && st.context.approved && !st.context.attributionConfirmed) items.push({ level: 'block', msg: 'A quote needs its exact wording confirmed as Sreepriya’s.' });
    if (st.caption.trim() && !st.captionApproved) items.push({ level: 'warn', msg: 'The caption is not approved yet.' });
    const synd = st.flagSyndicated != null ? st.flagSyndicated : rec.d.syndicated;
    if (synd) items.push({ level: 'info', msg: 'Syndicated copy. Consider linking the original placement instead.' });
  } else {
    if ((rec.entries || []).length < 2) items.push({ level: 'block', msg: 'An index needs at least two entries.' });
  }
  for (const c of comps) for (const w of c.warnings) items.push({ level: w.code === 'safe' ? 'warn' : 'block', msg: `Frame ${c.L.frameNo}: ${w.msg}` });
  const seen = new Set();
  return items.filter((i) => (seen.has(i.msg) ? false : (seen.add(i.msg), true)));
}

// ---------------- canvas preview ----------------
function StoryCanvas({ comp, mode, className, label, width }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c || !comp) return;
    const scale = width ? width / W : 1;
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const g = c.getContext('2d'); g.setTransform(scale, 0, 0, scale, 0, 0);
    draw(g, comp, { mode });
  }, [comp, mode, width]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} />;
}

// ---------------- Composer ----------------
function Composer({ ctx, rec }) {
  const stKey = JSON.stringify(ctx.project.stories[rec.id] || (ctx.project.indexes[rec.id] || null));
  const st = useMemo(() => ctx.getStory(rec.id), [rec.id, stKey, ctx.archive]);
  const [frame, setFrame] = useState(0);
  const [mode, setMode] = useState('guide');
  const [safe, setSafe] = useState(true);
  const [railOpen, setRailOpen] = useState(false);
  const storyImg = useStoryImg(st);
  const kinds = frameKinds(rec.isIndex ? 1 : st.frames);
  const fi = Math.min(frame, kinds.length - 1);
  const comps = useMemo(() => kinds.map((_, i) => composeFrame(ctx, rec, st, i, { storyImg })), [rec.id, stKey, st, ctx.fontsReady, ctx.tick, storyImg, ctx.brand, ctx.logo.mark, ctx.portraitImg, ctx.textureImg, ctx.project.stories]);
  const comp = comps[fi];
  useEffect(() => { setFrame(0); }, [rec.id]);
  const checks = readiness(ctx, rec, st, comps);
  return (
    <div className="composer">
      <div className={'railwrap' + (railOpen ? ' open' : '')}>
        <button className="railtoggle" onClick={() => setRailOpen(!railOpen)} aria-expanded={railOpen}>{railOpen ? 'Close archive' : 'Browse the archive'} <span>{rec.id}</span></button>
        <Rail ctx={ctx} rec={rec} />
      </div>
      <Stage ctx={ctx} rec={rec} st={st} comps={comps} comp={comp} fi={fi} setFrame={setFrame} kinds={kinds} mode={mode} setMode={setMode} safe={safe} setSafe={setSafe} checks={checks} />
      <Inspector ctx={ctx} rec={rec} st={st} comps={comps} checks={checks} storyImg={storyImg} />
    </div>
  );
}

const FRAME_NAMES = { hook: 'The hook', context: 'The context', read: 'The read' };

function Stage({ ctx, rec, st, comps, comp, fi, setFrame, kinds, mode, setMode, safe, setSafe, checks }) {
  const boxRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [busy, setBusy] = useState('');
  const url = storyUrl(rec, st);
  const okUrl = validUrl(url) && !genericUrl(url);
  const list = ctx.archive.records;
  const idx = list.findIndex((r) => r.id === rec.id);
  const nav = (d) => { if (rec.isIndex) return; const n = list[(idx + d + list.length) % list.length]; ctx.setCurrent(n.id); };
  const pct = (v, tot) => (v / tot) * 100 + '%';

  const onDown = (e) => {
    if (!comp.sticker) return;
    e.preventDefault();
    const r = boxRef.current.getBoundingClientRect();
    const s = r.width / W;
    setDrag({ sx: e.clientX, sy: e.clientY, ox: comp.sticker.x, oy: comp.sticker.y, s });
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag) return;
    const nx = drag.ox + (e.clientX - drag.sx) / drag.s, ny = drag.oy + (e.clientY - drag.sy) / drag.s;
    const c = clampSticker({ x: nx, y: ny, w: STICKER_W, h: STICKER_H });
    ctx.setStory(rec.id, { sticker: { x: Math.round(c.x), y: Math.round(c.y) } });
  };
  const onUp = () => setDrag(null);
  const onKey = (e) => {
    if (!comp.sticker) return;
    const step = e.shiftKey ? 40 : 10; let { x, y } = comp.sticker;
    if (e.key === 'ArrowUp') y -= step; else if (e.key === 'ArrowDown') y += step; else if (e.key === 'ArrowLeft') x -= step; else if (e.key === 'ArrowRight') x += step; else return;
    e.preventDefault(); const c = clampSticker({ x, y }); ctx.setStory(rec.id, { sticker: { x: c.x, y: c.y } });
  };

  const exportOne = async (i, m) => {
    setBusy('png');
    const c = comps[i];
    const { blob, w, h } = await renderToBlob(c, m, ctx.brand);
    const name = fileName(rec, st, i, m, c.L);
    const r = await saveFile(name, blob);
    setBusy('');
    if (r.ok) { ctx.say(`${name} (${w} × ${h}) handed to your browser`); ctx.setStory(rec.id, { exportedAt: new Date().toISOString() }); }
    else ctx.say(r.code === 'declined' ? 'Download cancelled.' : `Download unavailable here (${r.code}).`, 'err');
  };
  const exportPack = async (m) => {
    setBusy('pack');
    const files = [];
    for (let i = 0; i < comps.length; i++) { const { blob } = await renderToBlob(comps[i], m, ctx.brand); files.push({ name: fileName(rec, st, i, m, comps[i].L), data: blob }); }
    const h = handoffText(ctx, rec, st, comps);
    files.push({ name: `SNS_${rec.id}_handoff.txt`, data: new TextEncoder().encode(h) });
    const zip = await makeZip(files);
    const r = await saveFile(`SNS_${rec.id}_${FAMILY[comps[0].L.family].file}_pack${m === 'guide' ? '_GUIDE' : ''}.zip`, zip);
    if (!r.ok && (r.code === 'rejected_extension' || r.code === 'extension_not_enabled')) {
      ctx.say('ZIP is not available in this view. Saving each PNG separately.', 'warn');
      for (const f of files.filter((x) => x.name.endsWith('.png'))) { const rr = await saveFile(f.name, f.data); if (!rr.ok) { ctx.say(`Stopped at ${f.name} (${rr.code}).`, 'err'); break; } }
    } else if (r.ok) { ctx.say(`Pack of ${comps.length} frame${comps.length > 1 ? 's' : ''} + handoff saved`); ctx.setStory(rec.id, { exportedAt: new Date().toISOString() }); }
    else ctx.say(r.code === 'declined' ? 'Download cancelled.' : `Download unavailable here (${r.code}).`, 'err');
    setBusy('');
  };

  const sourceHit = comp.hits.find((h) => h.kind === 'source');
  return (
    <section className="stage" aria-label="Story preview">
      <div className="stagebar">
        <div className="frames" role="tablist" aria-label="Frames">
          {kinds.map((k, i) => <button key={k} role="tab" aria-selected={i === fi} className={i === fi ? 'on' : ''} onClick={() => setFrame(i)}><span>{String(i + 1).padStart(2, '0')}</span> {FRAME_NAMES[k]}</button>)}
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Export mode">
            <button className={mode === 'guide' ? 'on' : ''} onClick={() => setMode('guide')}>Placement guide</button>
            <button className={mode === 'clean' ? 'on' : ''} onClick={() => setMode('clean')}>Clean artwork</button>
          </div>
          <label className="check sm"><input id="safe-toggle" type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /> Safe zones</label>
        </div>
      </div>
      <div className="storybox-wrap">
        <div className="storybox" ref={boxRef}>
          <StoryCanvas comp={comp} mode={mode} className="storycanvas" label={`Story preview, ${rec.id}, frame ${fi + 1}`} />
          {safe && (<>
            <div className="safe top" style={{ height: pct(SAFE_T, H) }}><span>Top 250 px: profile and progress bar</span></div>
            <div className="safe bottom" style={{ height: pct(H - SAFE_B, H) }}><span>Bottom 300 px: reply bar</span></div>
          </>)}
          {sourceHit && okUrl && <a className="hotspot" href={url} target="_blank" rel="noopener noreferrer" title={'Open source: ' + url} style={{ left: pct(sourceHit.x, W), top: pct(sourceHit.y, H), width: pct(sourceHit.w, W), height: pct(sourceHit.h, H) }}><span className="sr">Open the source</span></a>}
          {comp.sticker && (
            <div className={'stickerhandle' + (drag ? ' dragging' : '')} tabIndex={0} role="slider" aria-label="Link sticker position. Drag, or use arrow keys." aria-valuetext={`x ${comp.sticker.x}, y ${comp.sticker.y}`}
              style={{ left: pct(comp.sticker.x, W), top: pct(comp.sticker.y, H), width: pct(comp.sticker.w, W), height: pct(comp.sticker.h, H) }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
              <span>Drag to move sticker area</span>
            </div>
          )}
        </div>
      </div>
      <div className="sourcebar">
        <div className="srclabel">
          <span className="eyebrow">{rec.isIndex ? 'Sticker destination' : 'Source'}</span>
          {okUrl ? <a href={url} target="_blank" rel="noopener noreferrer">{rec.isIndex ? `${rec.target.id} · ${rec.target.src.outlet}` : (st.outletDisplay || rec.src.outlet)} <span className="dom">{domainOf(url)}</span></a> : <span className="err">Link required</span>}
        </div>
        <div className="row wrap">
          <button className="btn" disabled={!okUrl} onClick={() => ctx.copy(url, 'Source link')}>Copy link</button>
          <button className="btn primary" disabled={!!busy} onClick={() => exportOne(fi, mode)}>{busy === 'png' ? 'Rendering…' : 'Download PNG'}</button>
          <button className="btn" disabled={!!busy} onClick={() => exportPack(mode)}>{busy === 'pack' ? 'Packing…' : comps.length > 1 ? `Download all ${comps.length} frames (.zip)` : 'PNG + handoff (.zip)'}</button>
        </div>
      </div>
      <div className="stagefoot">
        {!rec.isIndex && <div className="row"><button className="btn ghost sm" onClick={() => nav(-1)} aria-label="Previous record">← Previous</button><button className="btn ghost sm" onClick={() => nav(1)} aria-label="Next record">Next →</button></div>}
        <span className="note small">{mode === 'guide' ? 'Placement guide marks the sticker area in the PNG.' : 'Clean artwork keeps the space and omits the guide.'} Filename: {fileName(rec, st, fi, mode, comp.L)}</span>
      </div>
      {checks.filter((c) => c.level === 'block').length > 0 && <ul className="checks inline">{checks.filter((c) => c.level === 'block').map((c, i) => <li key={i} className="block">{c.msg}</li>)}</ul>}
    </section>
  );
}

// ---------------- Inspector ----------------
function Inspector({ ctx, rec, st, comps, checks, storyImg }) {
  const [tab, setTab] = useState(() => store(LS_KEY + ':tab') || 'design');
  useEffect(() => { store(LS_KEY + ':tab', tab); }, [tab]);
  const tabs = [['design', 'Design'], ['copy', 'Copy & link'], ['record', 'Record'], ['handoff', 'Handoff']];
  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="insphead">
        <div className="eyebrow">{rec.isIndex ? 'Index story' : COLLECTIONS[rec.src.collection].short} · {rec.id}</div>
        <div className="insptitle">{typo(rec.src.title)}</div>
        <StatusLine ctx={ctx} rec={rec} st={st} checks={checks} />
      </div>
      <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="tabbody">
        {tab === 'design' && <DesignTab ctx={ctx} rec={rec} st={st} comps={comps} storyImg={storyImg} />}
        {tab === 'copy' && <CopyTab ctx={ctx} rec={rec} st={st} />}
        {tab === 'record' && <RecordTab ctx={ctx} rec={rec} />}
        {tab === 'handoff' && <HandoffTab ctx={ctx} rec={rec} st={st} comps={comps} />}
      </div>
    </aside>
  );
}

function StatusLine({ ctx, rec, st, checks }) {
  const blocks = checks.filter((c) => c.level === 'block');
  const steps = [['draft', 'Draft'], ['edited', 'Edited'], ['approved', 'Approved']];
  return (
    <div className="status">
      <div className="seg sm" role="group" aria-label="Status">
        {steps.map(([k, l]) => <button key={k} className={st.status === k ? 'on' : ''} disabled={k === 'approved' && blocks.length > 0} title={k === 'approved' && blocks.length ? blocks[0].msg : ''} onClick={() => ctx.setStory(rec.id, { status: k })}>{l}</button>)}
      </div>
      <span className={'pub ' + (blocks.length ? 'no' : 'yes')}>{blocks.length ? (blocks.some((b) => /Link required|homepage/.test(b.msg)) ? 'Link required' : `${blocks.length} to resolve`) : st.status === 'approved' ? 'Publish-ready' : 'Ready to approve'}</span>
      {st.exportedAt && <span className="pub yes">Exported {new Date(st.exportedAt).toLocaleDateString()}</span>}
    </div>
  );
}

function Seg({ id, value, set, opts, label }) {
  return <div className="seg" role="group" aria-label={label} id={id}>{opts.map(([k, l, dis]) => <button key={k} className={value === k ? 'on' : ''} disabled={dis} onClick={() => set(k)}>{l}</button>)}</div>;
}
function Slider({ id, label, value, min, max, step, set, fmt }) {
  return <label className="slider" htmlFor={id}><span>{label}<b>{fmt ? fmt(value) : value}</b></span><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(parseFloat(e.target.value))} /></label>;
}
function Toggle({ id, label, checked, set, disabled, hint }) {
  return <label className={'check' + (disabled ? ' dis' : '')} htmlFor={id}><input id={id} type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => set(e.target.checked)} /> {label}{hint && <small> {hint}</small>}</label>;
}

function DesignTab({ ctx, rec, st, comps, storyImg }) {
  const set = (p) => ctx.setStory(rec.id, p);
  const fam = rec.isIndex ? 'index' : st.family;
  const L0 = comps[0].L;
  const families = rec.isIndex ? FAMILIES.filter((f) => f.key === 'index') : FAMILIES.filter((f) => f.key !== 'index');
  return (
    <div className="stack">
      <div className="group">
        <div className="glabel">Story treatment</div>
        <ol className="families">
          {families.map((f) => (
            <li key={f.key}><button className={fam === f.key ? 'on' : ''} onClick={() => !rec.isIndex && set({ family: f.key, sticker: null })}>
              <span className="fno">{f.no}</span><span className="fname">{f.name}</span><span className="fuse">{f.use}{rec.d.family === f.key && !rec.isIndex ? ' · suggested for this record' : ''}</span>
            </button></li>
          ))}
        </ol>
        {!rec.isIndex && <p className="note small">The Quiet Index needs several records. Build one from the Index stories lens or the Batch Queue.</p>}
      </div>
      <div className="group">
        <div className="glabel">Variation</div>
        <Seg label="Variation" value={st.variant} set={(v) => set({ variant: v, sticker: null })} opts={[['auto', `Auto (${L0.variant.toUpperCase()})`], ['a', 'A'], ['b', 'B']]} />
        <p className="note small">{FAMILY[fam].variants[L0.variant]}. Auto chooses by headline length{fam === 'conversation' ? ' and image availability' : fam === 'index' ? ' and entry count' : ''}.</p>
      </div>
      {!rec.isIndex && (
        <div className="group">
          <div className="glabel">Pack</div>
          <Seg label="Frames" value={st.frames} set={(v) => set({ frames: v })} opts={[[1, 'One frame'], [2, 'Two frames'], [3, 'Three frames']]} />
          <p className="note small">{st.frames === 1 ? 'Hook with the link zone. The default for an article with no verified excerpt.' : st.frames === 2 ? 'Hook, then a read frame carrying the actual title and link.' : 'Hook, context, read. Frame 2 stays a non-substantive detail until you approve text for it.'}</p>
        </div>
      )}
      <div className="group">
        <div className="glabel">Palette</div>
        <div className="swatches">
          {PALETTES.map((p) => { const pl = palette(p.key, ctx.brand); return (
            <button key={p.key} className={'swatch' + (st.palette === p.key ? ' on' : '')} onClick={() => set({ palette: p.key })} aria-label={p.name} title={p.name}>
              <span style={{ background: pl.bg }}><i style={{ background: pl.wash1 }} /><i style={{ background: pl.primary }} /><i style={{ background: pl.ink }} /></span><em>{p.name}</em>
            </button>); })}
        </div>
      </div>
      <div className="group">
        <div className="glabel">Type and wash</div>
        <Slider id="ts" label="Headline scale" value={st.textScale} min={0.7} max={1.3} step={0.02} set={(v) => set({ textScale: v })} fmt={(v) => Math.round(v * 100) + '%'} />
        <Slider id="wo" label="Watercolour opacity" value={st.washOpacity} min={0} max={1.4} step={0.05} set={(v) => set({ washOpacity: v })} fmt={(v) => Math.round(v * 100) + '%'} />
        <div className="row wrap">
          <Toggle id="t-wash" label="Watercolour" checked={st.showWash} set={(v) => set({ showWash: v })} />
          <Toggle id="t-logo" label="Entrust mark" checked={st.showLogo} set={(v) => set({ showLogo: v })} />
          <Toggle id="t-mark" label="Ghosted mark motif" checked={st.showMark} set={(v) => set({ showMark: v })} />
          <button className="btn ghost sm" onClick={() => set({ washSeed: (st.washSeed || 0) + 1 })}>Repaint wash</button>
        </div>
      </div>
      {(fam === 'conversation') && (
        <div className="group">
          <div className="glabel">Image</div>
          <Toggle id="t-portrait" label="Use approved portrait" checked={st.usePortrait} set={(v) => set({ usePortrait: v })} disabled={!ctx.portraitImg} hint={ctx.portraitImg ? '' : '(none approved yet: Brand Kit)'} />
          <label className="btn sm file"><input id="img-up" type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 6e6) { ctx.say('Image is over 6 MB. Use a smaller file.', 'err'); return; } set({ image: await readFileAs(f), imageName: f.name, usePortrait: false }); }} />{st.image ? 'Replace supplied thumbnail' : 'Upload supplied thumbnail or still'}</label>
          {st.image && <button className="btn ghost sm" onClick={() => set({ image: null, imageName: '' })}>Remove {st.imageName}</button>}
          {(st.image || st.usePortrait) && (<>
            <Slider id="cx" label="Horizontal position" value={st.crop.cx} min={0} max={1} step={0.01} set={(v) => set({ crop: { ...st.crop, cx: v } })} fmt={(v) => Math.round(v * 100) + '%'} />
            <Slider id="cy" label="Vertical position" value={st.crop.cy} min={0} max={1} step={0.01} set={(v) => set({ crop: { ...st.crop, cy: v } })} fmt={(v) => Math.round(v * 100) + '%'} />
            <Slider id="cz" label="Zoom" value={st.crop.zoom} min={1} max={2.5} step={0.01} set={(v) => set({ crop: { ...st.crop, zoom: v } })} fmt={(v) => v.toFixed(2) + '×'} />
            {!st.usePortrait && <Seg label="Treatment" value={st.treatment} set={(v) => set({ treatment: v })} opts={[['natural', 'Natural'], ['mono', 'Mono'], ['duotone', 'Duotone']]} />}
          </>)}
          <p className="note small">Only supplied thumbnails or approved portraits appear. Without one, the layout stays typographic. No play button is drawn, because nothing plays inside the story.</p>
        </div>
      )}
      <div className="group">
        <div className="glabel">Link sticker area</div>
        <p className="note small">Drag the dashed box on the preview, or use arrow keys on it. It stays inside the safe area, and text is kept clear of it.</p>
        <button className="btn ghost sm" onClick={() => set({ sticker: null })}>Reset position</button>
      </div>
      <button className="btn ghost sm danger" onClick={() => { if (rec.isIndex) return; ctx.resetStory(rec.id); ctx.say(`${rec.id} reset to its defaults`); }} disabled={rec.isIndex}>Reset this story</button>
    </div>
  );
}

function CopyTab({ ctx, rec, st }) {
  const set = (p) => ctx.setStory(rec.id, p);
  if (rec.isIndex) return <IndexCopy ctx={ctx} rec={rec} />;
  const R = rec.src;
  const url = storyUrl(rec, st);
  const urlState = !validUrl(url) ? 'Link required' : genericUrl(url) ? 'Homepage, not the article' : '';
  const draft = teaserDraft(R);
  const c = st.context;
  return (
    <div className="stack">
      <div className="group">
        <div className="glabel">Headline</div>
        <div className="srcfield"><span>Source headline (archive, read-only)</span><p>{R.title}</p></div>
        <label className="field" htmlFor="dh"><span>Display headline <small>Use a line break to force a break. Leave empty to use the source.</small></span>
          <textarea id="dh" rows={3} value={st.displayHeadline != null ? st.displayHeadline : ''} placeholder={R.title} onChange={(e) => set({ displayHeadline: e.target.value === '' ? null : e.target.value })} />
        </label>
        <div className="row wrap">
          <span className="note small">{(st.displayHeadline || R.title).length} characters{st.displayHeadline != null ? ' · edited for display' : ''}</span>
          {st.displayHeadline != null && <button className="btn ghost sm" onClick={() => set({ displayHeadline: null })}>Use source headline</button>}
        </div>
        {st.displayHeadline == null && autoHeadline(rec) !== R.title && <p className="note small">The trailing “By Sreepriya NS” is left off the hook because the byline line already credits her. The source title is unchanged.</p>}
        <p className="note small">The read frame always prints the unedited source title.</p>
      </div>
      <div className="group">
        <div className="glabel">Outlet credit</div>
        <label className="field" htmlFor="od"><span>Outlet as printed <small>Archive value: {R.outlet}</small></span>
          <input id="od" value={st.outletDisplay != null ? st.outletDisplay : ''} placeholder={R.outlet} onChange={(e) => set({ outletDisplay: e.target.value === '' ? null : e.target.value })} />
        </label>
        {rec.d.needsMastheadCheck && <Toggle id="oc" label="I have confirmed the masthead against the original" checked={st.outletConfirmed} set={(v) => set({ outletConfirmed: v })} hint={'(archive note: ' + R.notes + ')'} />}
      </div>
      <div className="group">
        <div className="glabel">Link</div>
        <div className="srcfield"><span>Primary URL (archive)</span><p className="url">{R.primaryUrl}</p></div>
        <label className="field" htmlFor="ou"><span>Corrected URL <small>Only if the archive link is wrong. Must be the article itself.</small></span>
          <input id="ou" value={st.overriddenUrl} placeholder="https://" onChange={(e) => set({ overriddenUrl: e.target.value })} />
        </label>
        {urlState && <p className="err small">{urlState}</p>}
        <div className="row wrap">
          <button className="btn sm" disabled={!!urlState} onClick={() => ctx.copy(url, 'Source link')}>Copy story link</button>
          {st.overriddenUrl && <button className="btn ghost sm" onClick={() => set({ overriddenUrl: '' })}>Restore archive URL</button>}
        </div>
        {R.backupUrl && (
          <div className="backup">
            <div className="srcfield"><span>Backup URL · {rec.d.backupPurpose}. Not for the sticker unless the primary fails.</span><p className="url"><a href={R.backupUrl} target="_blank" rel="noopener noreferrer">{R.backupUrl}</a></p></div>
            <button className="btn ghost sm" onClick={() => ctx.copy(R.backupUrl, 'Backup link')}>Copy backup link</button>
          </div>
        )}
        <label className="field" htmlFor="cta"><span>Call to action beside the sticker</span>
          <input id="cta" value={st.cta != null ? st.cta : ''} placeholder={rec.d.cta} onChange={(e) => set({ cta: e.target.value === '' ? null : e.target.value })} />
        </label>
        <Toggle id="fs" label="Flag as syndicated copy" checked={st.flagSyndicated != null ? st.flagSyndicated : rec.d.syndicated} set={(v) => set({ flagSyndicated: v })} hint={rec.d.syndicated ? '(archive: syndicated)' : ''} />
      </div>
      <div className="group">
        <div className="glabel">Frame 2: context {st.frames < 3 && <small>(used in three-frame packs)</small>}</div>
        <Seg label="Context kind" value={c.kind} set={(v) => set({ context: { ...c, kind: v, approved: false, attributionConfirmed: false } })} opts={[['none', 'Detail only'], ['excerpt', 'Excerpt'], ['quote', 'Quote'], ['summary', 'Summary']]} />
        {c.kind !== 'none' && (<>
          <label className="field" htmlFor="ctx"><span>{c.kind === 'quote' ? 'Exact quotation from the source' : c.kind === 'excerpt' ? 'Excerpt copied from the source' : 'One factual sentence'} <small>Editor-supplied only. Nothing is generated here.</small></span>
            <textarea id="ctx" rows={4} value={c.text} onChange={(e) => set({ context: { ...c, text: e.target.value, approved: false, attributionConfirmed: false } })} />
          </label>
          <Toggle id="ca" label="Approved: checked against the source" checked={c.approved} set={(v) => set({ context: { ...c, approved: v } })} disabled={!c.text.trim()} />
          {c.kind === 'quote' && <Toggle id="cq" label="Exact words confirmed as Sreepriya’s" checked={c.attributionConfirmed} set={(v) => set({ context: { ...c, attributionConfirmed: v } })} disabled={!c.approved} />}
        </>)}
        <p className="note small">Until text is approved, frame 2 shows only the outlet, date and role: no new claims.</p>
      </div>
      <div className="group">
        <div className="glabel">Caption for the handoff</div>
        <div className="draft"><span className="eyebrow">Draft, review before publishing</span><p>{draft}</p><button className="btn ghost sm" onClick={() => set({ caption: draft, captionApproved: false, captionIsDraft: true })}>Use as caption draft</button></div>
        <label className="field" htmlFor="cap"><span>Short caption <small>Production note. Not printed on the story.</small></span>
          <textarea id="cap" rows={3} value={st.caption} onChange={(e) => set({ caption: e.target.value, captionApproved: false })} />
        </label>
        <Toggle id="capok" label="Caption approved" checked={st.captionApproved} set={(v) => set({ captionApproved: v })} disabled={!st.caption.trim()} />
      </div>
    </div>
  );
}

function IndexCopy({ ctx, rec }) {
  const ix = ctx.project.indexes[rec.id];
  const upd = (p) => ctx.setProject((pp) => ({ ...pp, indexes: { ...pp.indexes, [rec.id]: { ...pp.indexes[rec.id], ...p } } }));
  const [add, setAdd] = useState('');
  const ents = ix.entries;
  return (
    <div className="stack">
      <label className="field" htmlFor="ixt"><span>Index title</span><input id="ixt" value={ix.title} onChange={(e) => upd({ title: e.target.value })} /></label>
      <div className="group">
        <div className="glabel">Entries ({ents.length} of 2–4)</div>
        <ol className="entries">
          {ents.map((id, i) => { const r = ctx.archive.byId.get(id); return (
            <li key={id}>
              <label className="check"><input type="radio" name="lt" checked={ix.linkTarget === id} onChange={() => upd({ linkTarget: id })} /> Sticker opens this</label>
              <span className="rid">{id}</span> <span>{r ? typo(r.src.title) : 'Missing record'}</span>
              <span className="row"><button className="btn ghost sm" disabled={i === 0} onClick={() => { const e = [...ents]; [e[i - 1], e[i]] = [e[i], e[i - 1]]; upd({ entries: e }); }}>Up</button>
                <button className="btn ghost sm" onClick={() => { const e = ents.filter((x) => x !== id); upd({ entries: e, linkTarget: ix.linkTarget === id ? e[0] : ix.linkTarget }); }}>Remove</button></span>
            </li>); })}
        </ol>
        {ents.length < 4 && <div className="row"><input id="ixadd" placeholder="Add by ID, e.g. M030" value={add} onChange={(e) => setAdd(e.target.value.toUpperCase().trim())} /><button className="btn sm" disabled={!ctx.archive.byId.get(add) || ents.includes(add)} onClick={() => { upd({ entries: [...ents, add] }); setAdd(''); }}>Add</button></div>}
        <p className="note small">One sticker, one destination. The chosen entry is marked with a dot on the story, and its link goes in the handoff.</p>
      </div>
      <button className="btn ghost sm danger" onClick={() => { ctx.setProject((p) => { const x = { ...p.indexes }; delete x[rec.id]; return { ...p, indexes: x, queue: p.queue.filter((q) => q !== rec.id) }; }); ctx.setCurrent('M030'); }}>Delete this index story</button>
    </div>
  );
}

function RecordTab({ ctx, rec }) {
  if (rec.isIndex) return <p className="note">Index stories are presentation objects built from the records listed in Copy &amp; link. They are not archive records and are not counted.</p>;
  const R = rec.src;
  const rel = ctx.archive.relations.get(rec.id) || [];
  const rows = [
    ['ID', R.id], ['Collection', COLLECTIONS[R.collection].short], ['Lens', rec.d.lens || '—'], ['Original title', R.title], ['Outlet', R.outlet],
    ['Date', `${R.date}${rec.d.qualifiedDate ? ' (qualified)' : ''}`], ['Date basis', R.dateBasis], ['Year', R.year],
    ['Sreepriya’s role', R.sreepriyaRole], ['Artwork label', rec.d.roleLabel], ['Writer / credit', R.writerCredit], ['Format', R.format], ['Topic (canonical)', R.topic],
    ['Audience shelf', rec.d.shelf || 'Unshelved (topic shown as-is)'], ...(rec.d.series ? [['Journal sub-series', rec.d.series + ' (from title and topic only)']] : []),
    ['Primary URL', <a href={R.primaryUrl} target="_blank" rel="noopener noreferrer" className="url">{R.primaryUrl}</a>],
    ['Publisher URL', R.publisherUrl === R.primaryUrl ? 'Same as primary' : <a className="url" href={R.publisherUrl} target="_blank" rel="noopener noreferrer">{R.publisherUrl}</a>],
    ['Backup URL', R.backupUrl ? <span><a className="url" href={R.backupUrl} target="_blank" rel="noopener noreferrer">{R.backupUrl}</a><br /><small>{rec.d.backupPurpose}</small></span> : '—'],
    ['Access', R.access], ['HTTP response', `${R.httpResponse} (a server answered; this does not prove paywall-free access)`], ['Last checked', R.lastChecked],
    ['Attribution evidence', R.attributionEvidence + ' (internal, not for artwork)'], ['Notes', R.notes || '—'],
  ];
  return (
    <div className="stack">
      <dl className="record">{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
      {rel.length > 0 && <div className="group"><div className="glabel">Related</div>{rel.map((x) => <button key={x.id + x.why} className="btn ghost sm" onClick={() => ctx.setCurrent(x.id)}>{x.why} {x.id}</button>)}</div>}
      {R.collection === 'entrust_journal' && /Mandate|Case Study/i.test(R.title) && <p className="note small">Published by Entrust as a narrative piece. It is not independently verified as a client case study, and the story must not present it as one.</p>}
    </div>
  );
}

function handoffData(ctx, rec, st, comps) {
  const url = storyUrl(rec, st);
  const R = rec.src;
  return {
    recordId: rec.id,
    collection: rec.isIndex ? 'Index story' : COLLECTIONS[R.collection].short,
    originalTitle: rec.isIndex ? null : R.title,
    displayHeadline: rec.isIndex ? R.title : (st.displayHeadline != null ? st.displayHeadline : null),
    outlet: rec.isIndex ? null : R.outlet,
    outletAsPrinted: rec.isIndex ? null : (st.outletDisplay || R.outlet),
    date: rec.isIndex ? null : R.date, dateBasis: rec.isIndex ? null : R.dateBasis,
    sreepriyaRole: rec.isIndex ? null : R.sreepriyaRole,
    linkStickerUrl: url, linkValid: validUrl(url) && !genericUrl(url),
    linkUrlEdited: !rec.isIndex && !!(st.overriddenUrl && st.overriddenUrl.trim()),
    backupUrl: rec.isIndex ? null : R.backupUrl, backupPurpose: rec.isIndex ? null : rec.d.backupPurpose,
    access: rec.isIndex ? null : R.access,
    stickerCallToAction: st.cta || rec.d.cta,
    approvedCaption: st.captionApproved ? st.caption : null,
    unapprovedCaptionDraft: !st.captionApproved && st.caption ? st.caption : null,
    recommendedAttribution: rec.isIndex ? `Index: ${rec.entries.map((e) => e.id).join(', ')}. Sticker opens ${rec.target ? rec.target.id : '—'}.` : rec.d.attribution + (/^\d{4}-/.test(R.date) ? `, ${fmtDate(R.date)}` : `, ${R.date}`),
    approvedContext: st.context && st.context.approved ? { kind: st.context.kind, text: st.context.text } : null,
    treatment: `${FAMILY[comps[0].L.family].name}, variation ${comps[0].L.variant.toUpperCase()}`,
    frames: comps.map((c, i) => fileName(rec, st, i, 'clean', c.L)),
    status: st.status, linkPastedIntoInstagram: !!st.linkPasted,
    entries: rec.isIndex ? rec.entries.map((e) => ({ id: e.id, title: e.src.title, outlet: e.src.outlet, url: e.src.primaryUrl })) : undefined,
    notes: rec.isIndex ? null : R.notes,
  };
}
function handoffText(ctx, rec, st, comps) {
  const d = handoffData(ctx, rec, st, comps);
  const L = [];
  L.push(`SNS STORY HANDOFF · ${d.recordId}`);
  L.push(`Collection: ${d.collection}`);
  if (d.originalTitle) L.push(`Original title: ${d.originalTitle}`);
  if (d.displayHeadline) L.push(`Display headline${d.originalTitle ? ' (edited)' : ''}: ${d.displayHeadline.replace(/\n/g, ' / ')}`);
  if (d.outlet) L.push(`Outlet: ${d.outlet}${d.outletAsPrinted !== d.outlet ? ` (printed as: ${d.outletAsPrinted})` : ''}`);
  if (d.date) L.push(`Date: ${d.date} · basis: ${d.dateBasis}`);
  if (d.sreepriyaRole) L.push(`Sreepriya’s role: ${d.sreepriyaRole}`);
  L.push('');
  L.push(`LINK STICKER URL: ${d.linkStickerUrl}${d.linkValid ? '' : '  <- LINK REQUIRED'}${d.linkUrlEdited ? '  (corrected by editor)' : ''}`);
  L.push(`Sticker call to action: ${d.stickerCallToAction}`);
  if (d.backupUrl) L.push(`Backup (not for the sticker): ${d.backupUrl} · ${d.backupPurpose}`);
  if (d.access) L.push(`Access: ${d.access}`);
  if (d.entries) d.entries.forEach((e) => L.push(`  ${e.id} · ${e.outlet} · ${e.title} · ${e.url}`));
  L.push('');
  L.push(`Approved caption: ${d.approvedCaption || '(none approved)'}`);
  if (d.unapprovedCaptionDraft) L.push(`Caption draft, not approved: ${d.unapprovedCaptionDraft}`);
  L.push(`Recommended attribution: ${d.recommendedAttribution}`);
  if (d.approvedContext) L.push(`Approved frame-2 ${d.approvedContext.kind}: ${d.approvedContext.text}`);
  L.push('');
  L.push(`Treatment: ${d.treatment}`);
  L.push(`Files: ${d.frames.join(', ')}`);
  L.push(`Status: ${d.status}`);
  L.push(`[${d.linkPastedIntoInstagram ? 'x' : ' '}] Link pasted into Instagram`);
  return L.join('\n');
}

function HandoffTab({ ctx, rec, st, comps }) {
  const txt = handoffText(ctx, rec, st, comps);
  const url = storyUrl(rec, st);
  const ok = validUrl(url) && !genericUrl(url);
  return (
    <div className="stack">
      <p className="note small">Production notes for whoever posts. None of this prints on the story.</p>
      <pre className="handoff">{txt}</pre>
      <Toggle id="lp" label="Link pasted into Instagram" checked={st.linkPasted} set={(v) => ctx.setStory(rec.id, { linkPasted: v })} />
      <div className="row wrap">
        <button className="btn" onClick={() => ctx.copy(txt, 'Handoff')}>Copy handoff</button>
        <button className="btn" disabled={!ok} onClick={() => ctx.copy(url, 'Source link')}>Copy source link</button>
        <button className="btn ghost" onClick={async () => { const r = await saveFile(`SNS_${rec.id}_handoff.txt`, txt); ctx.say(r.ok ? 'Handoff saved' : `Not saved (${r.code})`, r.ok ? 'ok' : 'err'); }}>Download .txt</button>
        <button className="btn ghost" onClick={async () => { const r = await saveFile(`SNS_${rec.id}_handoff.json`, JSON.stringify(handoffData(ctx, rec, st, comps), null, 2)); ctx.say(r.ok ? 'Handoff saved' : `Not saved (${r.code})`, r.ok ? 'ok' : 'err'); }}>Download .json</button>
      </div>
    </div>
  );
}

// ---------------- Library ----------------
function LibraryView({ ctx }) {
  const { archive, project } = ctx;
  const [f, set] = useFilters();
  const list = useMemo(() => applyFilters(archive, project, { ...f, lens: f.lens === 'indexes' || f.lens === 'selection' ? 'all' : f.lens }), [archive, project, f]);
  const open = (id) => { ctx.setCurrent(id); ctx.go('composer'); };
  const years = {};
  for (const r of list) (years[r.src.year] = years[r.src.year] || []).push(r);
  const yk = Object.keys(years).sort((a, b) => (f.sort === 'old' ? a - b : b - a));
  const sel = EDITORS_SELECTION.map((id) => archive.byId.get(id)).filter(Boolean);
  return (
    <div className="library">
      <section className="shelf">
        <div className="shelfhead"><h2 className="h2">Editor’s Selection</h2><p className="note">Fifteen records across bylines, interviews, quotes, recognition, the journal and conversations. A starter edit, not a ranking by reach.</p></div>
        <ol className="shelfrow">
          {sel.map((r) => (
            <li key={r.id}><button onClick={() => open(r.id)}>
              <span className="rid">{r.id} · {r.src.year}</span>
              <span className="stitle">{typo(r.src.title)}</span>
              <span className="smeta"><i>{r.src.outlet}</i><br />{involvementTag(r)}</span>
            </button></li>
          ))}
        </ol>
      </section>
      <section className="index">
        <div className="indexhead">
          <h2 className="h2">The archive, by year</h2>
          <div className="lensrow">
            {[['all', 'All collections'], ['external_media', 'Press & Perspectives'], ['entrust_journal', 'The Entrust Journal'], ['conversations', 'Watch & Listen'], ['recognition', 'Recognition']].map(([k, l]) => <button key={k} className={(f.lens === k || (k === 'all' && ['selection', 'indexes', 'year', 'all'].includes(f.lens))) ? 'on' : ''} onClick={() => set({ lens: k })}>{l}</button>)}
          </div>
          <FilterControls ctx={ctx} f={f} set={set} />
        </div>
        <p className="note">{list.length} records shown. Entrust journal dates are blog-listing dates; the original publication day is not independently confirmed. No Sreepriya-specific external press was located before 2021.</p>
        {yk.map((y) => (
          <div key={y} className="yearblock">
            <div className="yearnum">{y}<small>{years[y].length}</small></div>
            <ol className="yearlist">
              {years[y].map((r) => (
                <li key={r.id}>
                  <button className="ylink" onClick={() => open(r.id)}>
                    <span className="rid">{r.id}</span>
                    <span className="ytitle">{typo(r.src.title)}</span>
                    <span className="youtlet"><i>{r.src.outlet}</i> · {fmtDateShort(r.src.date)}</span>
                    <span className="ytag">{involvementTag(r)}{r.d.syndicated ? ' · syndicated copy' : ''}{r.d.access.code !== 'live' ? ' · ' + r.d.access.label.toLowerCase() : ''}</span>
                  </button>
                  <a className="ext" href={r.src.primaryUrl} target="_blank" rel="noopener noreferrer" aria-label={'Open source for ' + r.id}>Source ↗</a>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {list.length === 0 && <p className="empty">No records match these refinements.</p>}
      </section>
    </div>
  );
}

// ---------------- Queue ----------------
function QueueThumb({ ctx, id, avoid, onResolved }) {
  const stKey = JSON.stringify(ctx.project.stories[id] || (ctx.project.indexes[id] || null));
  const rec = useMemo(() => ctx.getRec(id), [id, stKey, ctx.archive]);
  const st = useMemo(() => (rec ? ctx.getStory(id) : null), [rec, stKey]);
  const img = useStoryImg(st);
  const comp = useMemo(() => rec ? composeFrame(ctx, rec, st, 0, { storyImg: img, avoid: st.variant === 'auto' ? avoid : null }) : null, [rec, st, avoid, ctx.fontsReady, ctx.tick, img, ctx.brand, ctx.logo.mark]);
  useEffect(() => { if (comp) onResolved(id, comp.L.family + ':' + comp.L.variant); }, [comp && comp.L.family, comp && comp.L.variant]);
  if (!rec) return <div className="thumb missing">Missing {id}</div>;
  return <StoryCanvas comp={comp} mode="clean" width={216} className="thumbcanvas" label={'Thumbnail ' + id} />;
}

function QueueView({ ctx }) {
  const { project, setProject } = ctx;
  const q = project.queue;
  const [resolved, setResolved] = useState({});
  const [busy, setBusy] = useState(false);
  const onResolved = useCallback((id, v) => setResolved((r) => (r[id] === v ? r : { ...r, [id]: v })), []);
  const move = (i, d) => setProject((p) => { const a = [...p.queue]; const j = i + d; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return { ...p, queue: a }; });
  const remove = (id) => setProject((p) => ({ ...p, queue: p.queue.filter((x) => x !== id) }));
  const [qsel, setQsel] = useState([]);
  const exportAll = async (mode) => {
    setBusy(true);
    const files = []; const notes = [];
    for (let k = 0; k < q.length; k++) {
      const id = q[k]; const rec = ctx.getRec(id); if (!rec) continue;
      const st = ctx.getStory(id);
      const sImg = st.image ? await loadImg(st.image).p : null;
      const prev = k > 0 ? resolved[q[k - 1]] : null;
      const kinds = frameKinds(rec.isIndex ? 1 : st.frames);
      const comps = kinds.map((_, i) => composeFrame(ctx, rec, st, i, { storyImg: sImg, avoid: st.variant === 'auto' ? prev : null }));
      for (let i = 0; i < comps.length; i++) { const { blob } = await renderToBlob(comps[i], mode, ctx.brand); files.push({ name: fileName(rec, st, i, mode, comps[i].L), data: blob }); }
      notes.push(handoffText(ctx, rec, st, comps));
    }
    files.push({ name: 'SNS_batch_handoff.txt', data: new TextEncoder().encode(notes.join('\n\n————————————————\n\n')) });
    const zip = await makeZip(files);
    const r = await saveFile(`SNS_batch_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${mode === 'guide' ? '_GUIDE' : ''}.zip`, zip);
    if (!r.ok && (r.code === 'rejected_extension' || r.code === 'extension_not_enabled')) {
      ctx.say('ZIP is not available here. Saving PNGs one at a time.', 'warn');
      for (const f of files.filter((x) => x.name.endsWith('.png'))) { const rr = await saveFile(f.name, f.data); if (!rr.ok) { ctx.say(`Stopped at ${f.name} (${rr.code}).`, 'err'); break; } }
    } else ctx.say(r.ok ? `${files.length - 1} PNGs and the batch handoff saved` : `Not saved (${r.code})`, r.ok ? 'ok' : 'err');
    if (r.ok) setProject((p) => { const s = { ...p.stories }; for (const id of q) if (!p.indexes[id]) s[id] = { ...(s[id] || {}), exportedAt: new Date().toISOString() }; return { ...p, stories: s }; });
    setBusy(false);
  };
  const exportHandoff = async () => {
    const all = q.map((id) => { const rec = ctx.getRec(id); if (!rec) return null; const st = ctx.getStory(id); const kinds = frameKinds(rec.isIndex ? 1 : st.frames); const comps = kinds.map((_, i) => composeFrame(ctx, rec, st, i, {})); return handoffData(ctx, rec, st, comps); }).filter(Boolean);
    const r = await saveFile('SNS_batch_handoff.json', JSON.stringify({ exportedAt: new Date().toISOString(), stories: all }, null, 2));
    ctx.say(r.ok ? 'Batch handoff saved' : `Not saved (${r.code})`, r.ok ? 'ok' : 'err');
  };
  const makeIndex = () => {
    const entries = qsel.filter((id) => ctx.archive.byId.get(id)).slice(0, 4);
    let n = Object.keys(project.indexes).length + 1; let id = 'IDX' + String(n).padStart(2, '0'); while (project.indexes[id]) { n++; id = 'IDX' + String(n).padStart(2, '0'); }
    setProject((p) => ({ ...p, indexes: { ...p.indexes, [id]: { id, title: 'From the archive', entries, linkTarget: entries[0], story: {} } }, queue: [...p.queue, id] }));
    setQsel([]); ctx.say(`${id} created from ${entries.length} records`);
  };
  return (
    <div className="queue">
      <div className="qhead">
        <div><h2 className="h2">Batch Queue</h2><p className="note">{q.length ? `${q.length} stories in posting order. Auto variations alternate so neighbours do not repeat a structure.` : 'Empty. Tick records in the archive and choose Queue.'}</p></div>
        <div className="row wrap">
          <button className="btn primary" disabled={!q.length || busy} onClick={() => exportAll('clean')}>{busy ? 'Rendering…' : 'Download all, clean artwork (.zip)'}</button>
          <button className="btn" disabled={!q.length || busy} onClick={() => exportAll('guide')}>Download all, placement guides</button>
          <button className="btn ghost" disabled={!q.length} onClick={exportHandoff}>Export batch handoff (.json)</button>
          <button className="btn ghost" disabled={qsel.length < 2 || qsel.length > 4} onClick={makeIndex} title="Select 2 to 4 records in the queue">Make a Quiet Index from {qsel.length || 'selected'}</button>
        </div>
      </div>
      <ol className="qgrid">
        {q.map((id, i) => {
          const rec = ctx.getRec(id); const st = rec ? ctx.getStory(id) : null;
          const prev = i > 0 ? resolved[q[i - 1]] : null;
          const same = prev && resolved[id] && prev === resolved[id];
          return (
            <li key={id} className="qitem">
              <button className="qthumb" onClick={() => { ctx.setCurrent(id); ctx.go('composer'); }} aria-label={'Open ' + id}><QueueThumb ctx={ctx} id={id} avoid={prev} onResolved={onResolved} /></button>
              <div className="qmeta">
                <label className="check sm"><input type="checkbox" checked={qsel.includes(id)} onChange={() => setQsel(qsel.includes(id) ? qsel.filter((x) => x !== id) : [...qsel, id])} /> <span className="rid">{String(i + 1).padStart(2, '0')} · {id}</span></label>
                <span className="qtitle">{rec ? typo(rec.src.title) : 'Missing record'}</span>
                {st && <span className="note small">{FAMILY[rec.isIndex ? 'index' : st.family].name} · {st.frames} frame{st.frames > 1 ? 's' : ''} · {st.status}{st.exportedAt ? ' · exported' : ''}</span>}
                {same && <span className="err small">Same structure as the previous story. Pick another variation or treatment.</span>}
                <span className="row"><button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)}>Earlier</button><button className="btn ghost sm" disabled={i === q.length - 1} onClick={() => move(i, 1)}>Later</button><button className="btn ghost sm" onClick={() => remove(id)}>Remove</button></span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------- Brand Kit ----------------
function BrandView({ ctx }) {
  const b = ctx.brand;
  const setB = (p) => ctx.setProject((pp) => ({ ...pp, brand: { ...pp.brand, ...p } }));
  const setC = (k, v) => setB({ colors: { ...b.colors, [k]: v } });
  const slots = [
    ['primary', '[ENTRUST_PRIMARY_HEX]', 'Oxblood, from the supplied palette'],
    ['secondary', '[ENTRUST_SECONDARY_HEX]', 'Deep wine, from the supplied palette'],
    ['accent', '[ACCENT_HEX]', 'Bronze, matches the wordmark'],
    ['paper', '[PAPER_HEX]', 'Paper, from the supplied palette'],
    ['ink', '[INK_HEX]', 'The palette has no separate ink; deep wine is used'],
    ['mauve', 'Wash · mauve', 'Supplied palette'], ['sand', 'Wash · sand', 'Supplied palette'], ['blush', 'Wash · blush', 'Supplied palette'],
  ];
  const upload = (accept, cb, max = 4e6) => async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > max) { ctx.say(`File is over ${Math.round(max / 1e6)} MB.`, 'err'); return; } cb(await readFileAs(f), f.name); };
  const pc = palette('paper', b);
  return (
    <div className="brand">
      <div className="qhead"><div><h2 className="h2">Brand Kit</h2><p className="note">Every story reads these values, so a change here cascades across all layouts. Logo and palette are from your upload; typefaces, portrait and painted artwork are still provisional.</p></div>
        <div className="row"><span className="prov">Provisional kit · editor view only</span><button className="btn ghost sm" onClick={() => setB({ ...DEFAULT_BRAND })}>Restore supplied kit</button></div></div>
      <div className="brandgrid">
        <section className="slot">
          <div className="slotname">[ENTRUST_LOGO_SVG_OR_PNG]</div>
          <div className="logos">
            <figure className="lg light"><img src={b.logo.mark || ASSETS.mark} alt="Entrust mark" /><figcaption>Mark · on light</figcaption></figure>
            <figure className="lg dark"><img src={b.logo.markDark || ASSETS.mark} alt="Entrust mark reversed" style={b.logo.markDark ? null : { filter: 'brightness(0) invert(1)' }} /><figcaption>{b.logo.markDark ? 'Reversed · supplied' : 'Reversed · single-colour tint until an official version arrives'}</figcaption></figure>
            <figure className="lg light wide"><img src={b.logo.lockup || ASSETS.lockup} alt="Entrust Family Office lockup" /><figcaption>Lockup as supplied</figcaption></figure>
          </div>
          <p className="note small">{b.logo.mark ? `Using ${b.logo.markName}.` : 'Using a transparent PNG cut from your upload. An SVG master would be sharper at large sizes.'}</p>
          <div className="row wrap">
            <label className="btn sm file"><input id="logo-up" type="file" accept="image/svg+xml,image/png" onChange={upload('img', (d, n) => setB({ logo: { ...b.logo, mark: d, markName: n } }))} />Replace mark (SVG/PNG)</label>
            <label className="btn sm file"><input id="logo-dark" type="file" accept="image/svg+xml,image/png" onChange={upload('img', (d, n) => setB({ logo: { ...b.logo, markDark: d, markDarkName: n } }))} />Add reversed mark</label>
          </div>
          <Slider id="cs" label="Clearspace (× mark height)" value={b.clearspace} min={0.25} max={1} step={0.05} set={(v) => setB({ clearspace: v })} />
        </section>
        <section className="slot">
          <div className="slotname">Colour tokens</div>
          <ul className="tokens">
            {slots.map(([k, name, hint]) => (
              <li key={k}><input type="color" id={'c-' + k} value={b.colors[k]} onChange={(e) => setC(k, e.target.value.toUpperCase())} aria-label={name} />
                <span><b>{name}</b><small>{hint}</small></span>
                <input className="hex" value={b.colors[k]} onChange={(e) => { const v = e.target.value.trim(); if (hexOk(v)) setC(k, v.toUpperCase()); }} aria-label={name + ' hex'} />
                {b.colors[k] !== SUPPLIED_COLORS[k] && <button className="btn ghost sm" onClick={() => setC(k, SUPPLIED_COLORS[k])}>Supplied</button>}
              </li>
            ))}
          </ul>
          <p className="note small">Ink on paper contrast: {contrast(pc.ink, pc.bg).toFixed(1)} : 1. Bronze labels on paper: {contrast(pc.accent, pc.bg).toFixed(1)} : 1, kept to large, bold small caps.</p>
        </section>
        <section className="slot">
          <div className="slotname">[EDITORIAL_SERIF] · [UTILITY_SANS]</div>
          {[['serif', 'Editorial serif', 'serifFile', 'serifFileName'], ['sans', 'Utility sans', 'sansFile', 'sansFileName']].map(([k, l, fk, fn]) => (
            <div key={k} className="fontslot">
              <label className="field" htmlFor={'font-' + k}><span>{l} family <small>Provisional: {DEFAULT_BRAND.fonts[k]}</small></span>
                <input id={'font-' + k} value={b.fonts[k]} onChange={(e) => setB({ fonts: { ...b.fonts, [k]: e.target.value } })} /></label>
              <p className="specimen" style={{ fontFamily: `"${b.fonts[k]}", ${k === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'}` }}>Preparing heirs for responsible stewardship</p>
              <label className="btn sm file"><input type="file" accept=".woff2,.woff,.ttf,.otf" onChange={upload('font', (d, n) => setB({ fonts: { ...b.fonts, [fk]: d, [fn]: n } }), 3e6)} />{b.fonts[fn] ? 'Replace ' + b.fonts[fn] : 'Upload font file'}</label>
              <p className="note small">Uploaded files are embedded so exports match the preview. A family name alone works only if this browser already has it.</p>
            </div>
          ))}
        </section>
        <section className="slot">
          <div className="slotname">[SREEPRIYA_APPROVED_PORTRAIT]</div>
          {b.portrait.dataUrl ? <img className="portrait" src={b.portrait.dataUrl} alt="Supplied portrait" /> : <div className="empty-slot">No portrait supplied. Conversation stories stay typographic; no likeness is invented.</div>}
          <label className="btn sm file"><input id="portrait-up" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload('img', (d, n) => setB({ portrait: { ...b.portrait, dataUrl: d, name: n, approved: false } }), 8e6)} />{b.portrait.dataUrl ? 'Replace portrait' : 'Upload portrait'}</label>
          {b.portrait.dataUrl && <Toggle id="p-ok" label="This portrait is approved for public stories" checked={b.portrait.approved} set={(v) => setB({ portrait: { ...b.portrait, approved: v } })} />}
          <Seg label="Portrait treatment" value={b.portrait.treatment} set={(v) => setB({ portrait: { ...b.portrait, treatment: v } })} opts={[['natural', 'Natural'], ['mono', 'Mono'], ['duotone', 'Duotone']]} />
        </section>
        <section className="slot">
          <div className="slotname">[APPROVED_WATERCOLOUR_ARTWORK]</div>
          <p className="note small">Not supplied. Stories use procedural washes painted from the colour tokens, seeded per record so they stay stable between previews and exports.</p>
          <Slider id="gw" label="Global wash strength" value={b.washOpacity} min={0} max={1.4} step={0.05} set={(v) => setB({ washOpacity: v })} fmt={(v) => Math.round(v * 100) + '%'} />
          <Slider id="gg" label="Paper grain" value={b.grain} min={0} max={2} step={0.1} set={(v) => setB({ grain: v })} fmt={(v) => Math.round(v * 100) + '%'} />
          <label className="btn sm file"><input id="tex-up" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload('img', (d, n) => setB({ texture: d, textureName: n }), 8e6)} />{b.texture ? 'Replace texture' : 'Upload background texture'}</label>
          {b.texture && <><Slider id="to" label="Texture opacity" value={b.textureOpacity} min={0} max={1} step={0.05} set={(v) => setB({ textureOpacity: v })} fmt={(v) => Math.round(v * 100) + '%'} /><button className="btn ghost sm" onClick={() => setB({ texture: null, textureName: '' })}>Remove texture</button></>}
        </section>
        <section className="slot">
          <div className="slotname">Palettes derived from the tokens</div>
          <div className="palrow">{PALETTES.map((p) => { const pl = palette(p.key, b); return <div key={p.key} className="palcard" style={{ background: pl.bg, color: pl.ink }}><span style={{ color: pl.primary, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '20px' }}>{p.name}</span><i style={{ background: pl.wash1 }} /><i style={{ background: pl.wash2 }} /><i style={{ background: pl.accent }} /></div>; })}</div>
          <p className="note small">The provisional neutral palette is a proof-of-layout option with no brand colour.</p>
        </section>
      </div>
    </div>
  );
}

// ---------------- Export + checks ----------------
function runChecks(ctx, rec) {
  const { archive, project } = ctx;
  const out = [];
  const add = (n, name, pass, detail) => out.push({ n, name, pass, detail });
  const c = archive.counts;
  add(1, 'Record counts', c.external_media === 78 && c.entrust_journal === 64 && c.conversations === 5 && c.total === 147 && c.review === 16, `${c.external_media} M + ${c.entrust_journal} O + ${c.conversations} V = ${c.total}; ${c.review} review-only excluded`);
  const lensOk = ['external_media', 'entrust_journal', 'conversations'].every((k) => applyFilters(archive, project, { lens: k, q: '', sort: 'new' }).length === c[k]);
  const recog = applyFilters(archive, project, { lens: 'recognition', q: '', sort: 'new' });
  add(2, 'Collections and filters', lensOk && recog.every((r) => r.src.collection === 'external_media'), `Each collection lens returns its own records; Recognition shows ${recog.length} M-series records without adding to the total`);
  const O = archive.records.filter((r) => r.src.collection === 'entrust_journal');
  add(3, 'Entrust Journal attribution', O.length > 0 && O.every((r) => r.d.roleLabel === 'Published on Entrust Family Office' && r.d.family === 'journal'), `${O.length} O-series records carry “Published on Entrust Family Office”`);
  const q = archive.byId.get('M003'), by = archive.byId.get('M030');
  add(4, 'Quote and byline labels differ', q && by && q.d.roleLabel === 'Quoted in' && by.d.roleLabel === 'Written for' && q.d.lens !== by.d.lens, `M003 “${q && q.d.roleLabel}” · M030 “${by && by.d.roleLabel}”`);
  const reprints = archive.records.filter((r) => r.d.syndicated);
  add(5, 'Reprints link to originals', reprints.length > 0 && reprints.every((r) => (archive.relations.get(r.id) || []).some((x) => archive.byId.get(x.id))), reprints.map((r) => `${r.id} → ${(archive.relations.get(r.id) || [])[0]?.id || '—'}`).join(', '));
  const test = mergeStory(by, { displayHeadline: 'Edited display line' });
  add(6, 'Headline edit leaves source intact', test.displayHeadline === 'Edited display line' && by.src.title === 'Redefining female leadership in family offices' && Object.isFrozen(by.src), 'Source records are frozen; display text lives in story state');
  const allLinks = archive.records.every((r) => validUrl(r.src.primaryUrl) && !genericUrl(r.src.primaryUrl));
  const backups = archive.records.filter((r) => r.src.backupUrl);
  const same = backups.filter((r) => r.src.backupUrl === r.src.primaryUrl).map((r) => r.id);
  add(7, 'Real links, backups kept separate', allLinks && backups.every((r) => validUrl(r.src.backupUrl)) && !Object.isExtensible(r0frozen(archive)), `${archive.records.length} primary URLs valid; ${backups.length} backup URLs held in their own field and never used for the sticker${same.length ? `; ${same.join(', ')} lists the same PDF in both fields (shown in its inspector)` : ''}`);
  const st = ctx.getStory(rec.id);
  const comp = composeFrame(ctx, rec, st, 0, {});
  const a = document.createElement('canvas'); a.width = W; a.height = H; draw(a.getContext('2d'), comp, { mode: 'guide', sans: ctx.brand.fonts.sans });
  const b2 = document.createElement('canvas'); b2.width = W; b2.height = H; draw(b2.getContext('2d'), comp, { mode: 'clean', sans: ctx.brand.fonts.sans });
  const da = a.getContext('2d').getImageData(0, 0, W, H).data, db = b2.getContext('2d').getImageData(0, 0, W, H).data;
  let outside = 0, inside = 0; const s = comp.sticker;
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { const i = (y * W + x) * 4; const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); if (d) { if (s && x >= s.x - 2 && x <= s.x + s.w + 2 && y >= s.y - 2 && y <= s.y + s.h + 2) inside++; else outside++; } }
  add(8, 'Guide and clean differ only in the sticker area', !!s && inside > 0 && outside === 0, s ? `${inside} sampled pixels differ inside the sticker area, ${outside} outside (current story ${rec.id})` : 'Current frame has no sticker');
  const logoDrawn = comp.items.some((i) => i.t === 'logo') || !st.showLogo || !['journal'].includes(comp.L.family);
  add(9, 'Export size and artwork', a.width === 1080 && a.height === 1920 && !!ctx.logo.mark && logoDrawn, `Canvas ${a.width} × ${a.height}; logo ${ctx.logo.mark ? 'loaded' : 'missing'}; watercolour drawn: ${comp.items.some((i) => i.t === 'wash') ? 'yes' : 'off'}`);
  const long = 'Why India’s family businesses must treat succession, governance and the next generation as one continuous plan, not three tasks';
  const fails = [];
  for (const f of ['press', 'byline', 'journal', 'conversation', 'milestone']) for (const v of ['a', 'b']) {
    const r0 = archive.byId.get(f === 'journal' ? 'O004' : f === 'conversation' ? 'V001' : f === 'milestone' ? 'M037' : f === 'byline' ? 'M041' : 'M003');
    const s0 = { ...mergeStory(r0, {}), family: f, variant: v, displayHeadline: long.slice(0, 120) };
    const cc = composeFrame(ctx, r0, s0, 0, {});
    const hb = cc.boxes.filter((x) => x.role === 'headline');
    const hitSticker = hb.some((bx) => bx.y + bx.h > cc.sticker.y - 8);
    if (cc.warnings.some((w) => w.code === 'overflow' || w.code === 'sticker') || hitSticker) fails.push(`${f}/${v}`);
  }
  add(10, '120-character headline fits every layout', fails.length === 0, fails.length ? 'Problems in ' + fails.join(', ') : `Tested a ${long.slice(0, 120).length}-character headline in 10 layouts: no clipping, sticker area clear`);
  const proj = exportProjectObj(ctx);
  const round = JSON.parse(JSON.stringify(proj));
  add(11, 'Project JSON round-trip', JSON.stringify(round.stories) === JSON.stringify(project.stories) && JSON.stringify(round.queue) === JSON.stringify(project.queue) && JSON.stringify(round.indexes) === JSON.stringify(project.indexes), `${Object.keys(project.stories).length} story edits, ${project.queue.length} queued, ${Object.keys(project.indexes).length} index stories survive serialise → parse`);
  const reviewIds = archive.reviewOnly.map((r) => r.id);
  add(12, 'Review-only rows absent', reviewIds.length === 16 && reviewIds.every((id) => !archive.byId.has(id)), `${reviewIds.join(', ')} are not in the catalogue`);
  return out;
}

function r0frozen(archive) { return archive.records[0].src; }
function exportProjectObj(ctx) {
  const { project } = ctx;
  return { kind: 'sns-story-room-project', version: 1, exportedAt: new Date().toISOString(), dataset: { source: ctx.datasetSource, asOf: ctx.archive.meta.asOf, counts: ctx.archive.counts }, covers: project.covers, stories: project.stories, indexes: project.indexes, queue: project.queue, favourites: project.favourites, brand: project.brand };
}

function ExportView({ ctx, rec }) {
  const [checks, setChecks] = useState(null);
  const [err, setErr] = useState('');
  const [dlAvail, setDlAvail] = useState(null);
  useEffect(() => { downloadsCap().then((d) => setDlAvail(!!d)); }, []);
  useEffect(() => { const t = setTimeout(() => { try { setChecks(runChecks(ctx, rec)); } catch (e) { setErr(String(e && e.message)); } }, 60); return () => clearTimeout(t); }, [ctx.fontsReady, rec.id]);
  const st = ctx.getStory(rec.id);
  const importProject = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await readFileAs(f, 'text'));
      if (j.kind !== 'sns-story-room-project') throw new Error('This is not a Story Room project file.');
      ctx.setProject((p) => ({ ...p, covers: Array.isArray(j.covers) && j.covers.length ? j.covers : p.covers, stories: j.stories || {}, indexes: j.indexes || {}, queue: (j.queue || []).filter((id) => ctx.archive.byId.has(id) || (j.indexes || {})[id]), favourites: j.favourites || [], brand: j.brand ? { ...DEFAULT_BRAND, ...j.brand } : p.brand }));
      ctx.say(`Project restored: ${Object.keys(j.stories || {}).length} story edits`);
    } catch (x) { ctx.say(x.message, 'err'); }
    e.target.value = '';
  };
  const importData = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await readFileAs(f, 'text')); const a = buildArchive(j); ctx.setDataset(j); ctx.setDatasetSource(f.name); ctx.say(`${f.name}: ${a.counts.total} records loaded (${a.counts.external_media} M, ${a.counts.entrust_journal} O, ${a.counts.conversations} V), ${a.counts.review} review-only excluded`); }
    catch (x) { ctx.say(x.message, 'err'); }
    e.target.value = '';
  };
  const passed = checks ? checks.filter((c) => c.pass).length : 0;
  return (
    <div className="exportv">
      <div className="qhead"><div><h2 className="h2">Export</h2><p className="note">Current story: {rec.id} · {FAMILY[rec.isIndex ? 'index' : st.family].name}. PNGs are rendered at 1080 × 1920 from the same engine as the preview.</p></div></div>
      <div className="exgrid">
        <section className="slot">
          <div className="slotname">How to post a story</div>
          <ol className="steps">
            <li><b>Data.</b> The archive JSON is already loaded ({ctx.archive.counts.total} records, as of {ctx.archive.meta.asOf}). To use a newer file, choose Import data JSON below.</li>
            <li><b>Choose.</b> In Composer, pick a record from the archive rail. Editor’s Selection is the starting shelf.</li>
            <li><b>Treat.</b> In Design, the suggested family is preselected. Change family, variation, frames and palette freely.</li>
            <li><b>Edit.</b> In Copy &amp; link, shorten the display headline if needed. Frame-2 text and captions stay out of the story until you tick Approved.</li>
            <li><b>Export.</b> Download the Clean artwork PNG for posting. The Placement guide version shows where the link sticker goes.</li>
            <li><b>Link.</b> Copy source link, then in Instagram add the LINK sticker over the reserved area and paste. Tick “Link pasted into Instagram” in Handoff.</li>
          </ol>
          {dlAvail === false && <p className="note small">Saving through the viewer is not available in this view, so downloads use the browser directly.</p>}
        </section>
        <section className="slot">
          <div className="slotname">Project</div>
          <p className="note small">{ctx.saveState}. Export the project to keep edits across devices or after clearing the browser.</p>
          <div className="row wrap">
            <button className="btn primary" onClick={async () => { const r = await saveFile(`SNS_story_room_project_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportProjectObj(ctx), null, 2)); ctx.say(r.ok ? 'Project JSON saved' : `Not saved (${r.code})`, r.ok ? 'ok' : 'err'); }}>Export project JSON</button>
            <label className="btn file"><input id="proj-in" type="file" accept=".json,application/json" onChange={importProject} />Import project JSON</label>
          </div>
          <div className="slotname mt">Archive data</div>
          <p className="note small">Source: {ctx.datasetSource}. {ctx.archive.counts.external_media} M · {ctx.archive.counts.entrust_journal} O · {ctx.archive.counts.conversations} V · {ctx.archive.counts.review} review-only rows excluded.{ctx.archive.errors.length ? ' ' + ctx.archive.errors.length + ' rows skipped.' : ''}</p>
          <div className="row wrap">
            <label className="btn file"><input id="data-in" type="file" accept=".json,application/json" onChange={importData} />Import data JSON</label>
            {ctx.dataset !== ctx.embedded && <button className="btn ghost" onClick={() => { ctx.setDataset(ctx.embedded); ctx.setDatasetSource('Sreepriya_Media_Data.json (embedded)'); }}>Use embedded archive</button>}
          </div>
          <p className="note small">Story edits are keyed by record ID and stay separate from the archive data, so re-importing data does not overwrite them.</p>
        </section>
        <section className="slot wide">
          <div className="slotname">Acceptance checks {checks && <span className={passed === checks.length ? 'pass' : 'fail'}>{passed} of {checks.length} pass</span>}</div>
          {err && <p className="err">{err}</p>}
          {!checks && !err && <p className="note">Running…</p>}
          {checks && <ol className="checklist">{checks.map((c) => <li key={c.n} className={c.pass ? 'pass' : 'fail'}><span>{c.pass ? 'Pass' : 'Fail'}</span><b>{c.n}. {c.name}</b><small>{c.detail}</small></li>)}</ol>}
          <button className="btn ghost sm" onClick={() => setChecks(runChecks(ctx, rec))}>Run again</button>
        </section>
      </div>
    </div>
  );
}


// ---------------- Highlight covers ----------------
function CircleCanvas({ comp, size, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c || !comp) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    const sc = (size * dpr) / (2 * COVER_R);
    const g = c.getContext('2d');
    g.setTransform(sc, 0, 0, sc, -(W / 2 - COVER_R) * sc, -(H / 2 - COVER_R) * sc);
    draw(g, comp, { mode: 'clean' });
  }, [comp, size]);
  return <canvas ref={ref} className="circlecanvas" style={{ width: size, height: size }} role="img" aria-label={label} />;
}
async function coverBlob(comp, square, brand) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  draw(c.getContext('2d'), comp, { mode: 'clean', sans: brand.fonts.sans });
  let out = c;
  if (square) { out = document.createElement('canvas'); out.width = W; out.height = W; out.getContext('2d').drawImage(c, 0, (H - W) / 2, W, W, 0, 0, W, W); }
  return new Promise((res) => out.toBlob((b) => res(b), 'image/png'));
}
function coverFile(cv, i, square) {
  const slug = (cv.title || 'Cover').replace(/[^A-Za-z0-9]+/g, '').slice(0, 24) || 'Cover';
  return `SNS_Highlight_${String(i + 1).padStart(2, '0')}_${slug}${square ? '_1080sq' : ''}.png`;
}
function CoversView({ ctx }) {
  const { project, setProject, brand } = ctx;
  const covers = project.covers || [];
  const [sel, setSel] = useState(covers[0] ? covers[0].id : null);
  const [mode, setMode] = useState('guide');
  const [busy, setBusy] = useState(false);
  const cur = covers.find((c) => c.id === sel) || covers[0];
  const idx = covers.indexOf(cur);
  const upd = (patch) => setProject((p) => ({ ...p, covers: p.covers.map((c) => (c.id === cur.id ? { ...c, ...patch } : c)) }));
  const comps = useMemo(() => covers.map((c) => composeCover({ ...c, label: c.title }, brand, ctx.logo)), [covers, brand, ctx.logo.mark, ctx.fontsReady]);
  const comp = cur ? comps[idx] : null;
  const save1 = async (square) => {
    const b = await coverBlob(comp, square, brand); const name = coverFile(cur, idx, square);
    const r = await saveFile(name, b); ctx.say(r.ok ? `${name} handed to your browser` : r.code === 'declined' ? 'Download cancelled.' : `Not saved (${r.code})`, r.ok ? 'ok' : 'err');
  };
  const saveAll = async () => {
    setBusy(true);
    const files = [];
    for (let i = 0; i < covers.length; i++) { files.push({ name: coverFile(covers[i], i, false), data: await coverBlob(comps[i], false, brand) }); files.push({ name: coverFile(covers[i], i, true), data: await coverBlob(comps[i], true, brand) }); }
    const notes = covers.map((c, i) => `${String(i + 1).padStart(2, '0')}  Highlight title: ${c.title}  ·  files: ${coverFile(c, i, false)}, ${coverFile(c, i, true)}`).join('\n');
    files.push({ name: 'SNS_Highlight_covers_handoff.txt', data: new TextEncoder().encode('SNS HIGHLIGHT COVERS\nIn Instagram: open the highlight, Edit highlight, Edit cover, choose the image, then fit the circle to the dashed guide.\n\n' + notes) });
    const zip = await makeZip(files);
    const r = await saveFile('SNS_Highlight_covers.zip', zip);
    if (!r.ok && (r.code === 'rejected_extension' || r.code === 'extension_not_enabled')) {
      ctx.say('ZIP is not available here. Saving each cover separately.', 'warn');
      for (const f of files.filter((x) => x.name.endsWith('.png') && !x.name.includes('_1080sq'))) { const rr = await saveFile(f.name, f.data); if (!rr.ok) break; }
    } else ctx.say(r.ok ? `${covers.length} covers saved in two sizes` : `Not saved (${r.code})`, r.ok ? 'ok' : 'err');
    setBusy(false);
  };
  const add = () => { const id = 'c-' + Math.random().toString(36).slice(2, 8); setProject((p) => ({ ...p, covers: [...p.covers, { id, title: 'New', style: 'initial', initial: 'N', palette: 'paper', seed: 0 }] })); setSel(id); };
  const move = (d) => setProject((p) => { const a = [...p.covers]; const j = idx + d; if (j < 0 || j >= a.length) return p; [a[idx], a[j]] = [a[j], a[idx]]; return { ...p, covers: a }; });
  return (
    <div className="covers">
      <div className="qhead">
        <div><h2 className="h2">Highlight Covers</h2><p className="note">One quiet system for the profile row. Instagram crops a circle from the centre of each 1080 × 1920 image; the artwork stays inside the dashed guide. The highlight title is typed in Instagram, so the cover carries a letter or mark, not a caption.</p></div>
        <div className="row wrap">
          <button className="btn primary" disabled={busy || !covers.length} onClick={saveAll}>{busy ? 'Rendering…' : `Download all ${covers.length} (.zip)`}</button>
          <button className="btn ghost" onClick={() => { setProject((p) => ({ ...p, covers: DEFAULT_COVERS })); setSel(DEFAULT_COVERS[0].id); }}>Restore default set</button>
        </div>
      </div>
      <div className="profilerow" aria-label="Profile row preview">
        {covers.map((c, i) => (
          <button key={c.id} className={'hl' + (c.id === (cur && cur.id) ? ' on' : '')} onClick={() => setSel(c.id)}>
            <span className="ring"><CircleCanvas comp={comps[i]} size={76} label={'Cover ' + c.title} /></span>
            <span className="hlt">{c.title}</span>
          </button>
        ))}
        <button className="hl add" onClick={add}><span className="ring plus">+</span><span className="hlt">Add</span></button>
      </div>
      {cur && (
        <div className="coveredit">
          <div className="coverstage">
            <div className="seg" role="group" aria-label="Preview mode"><button className={mode === 'guide' ? 'on' : ''} onClick={() => setMode('guide')}>Crop guide</button><button className={mode === 'clean' ? 'on' : ''} onClick={() => setMode('clean')}>Clean artwork</button></div>
            <div className="coverbox"><StoryCanvas comp={comp} mode={mode} className="storycanvas" label={'Cover ' + cur.title} /></div>
            <div className="row wrap"><button className="btn primary" onClick={() => save1(false)}>Download 1080 × 1920</button><button className="btn" onClick={() => save1(true)}>Download 1080 × 1080</button></div>
            <p className="note small">Exports are always clean artwork; the dashed circle is editor-only.</p>
          </div>
          <div className="coverctl stack">
            <label className="field" htmlFor="cv-title"><span>Highlight title <small>Typed in Instagram under the circle. Not printed on the cover.</small></span><input id="cv-title" value={cur.title} maxLength={24} onChange={(e) => upd({ title: e.target.value })} /></label>
            <div className="group"><div className="glabel">Cover device</div>
              <Seg label="Cover device" value={cur.style} set={(v) => upd({ style: v })} opts={COVER_STYLES.map((x) => [x.key, x.name])} />
              {cur.style === 'initial' && <label className="field" htmlFor="cv-init"><span>Letter or pair <small>Two letters at most reads best at highlight size.</small></span><input id="cv-init" maxLength={3} value={cur.initial || ''} onChange={(e) => upd({ initial: e.target.value })} /></label>}
              {cur.style === 'numeral' && <label className="field" htmlFor="cv-num"><span>Numeral or year</span><input id="cv-num" maxLength={4} value={cur.numeral || ''} onChange={(e) => upd({ numeral: e.target.value })} /></label>}
              {cur.style === 'word' && <p className="note small">Sets the highlight title in letterspaced capitals. Keep it to one short word.</p>}
              {cur.style === 'mark' && <p className="note small">Uses the Entrust mark from the Brand Kit.</p>}
            </div>
            <div className="group"><div className="glabel">Palette</div>
              <div className="swatches">{PALETTES.map((p) => { const pl = palette(p.key, brand); return <button key={p.key} className={'swatch' + (cur.palette === p.key ? ' on' : '')} onClick={() => upd({ palette: p.key })} aria-label={p.name} title={p.name}><span style={{ background: pl.bg }}><i style={{ background: pl.wash1 }} /><i style={{ background: pl.primary }} /><i style={{ background: pl.ink }} /></span><em>{p.name}</em></button>; })}</div>
              <Seg label="Ground" value={cur.ground || 'paper'} set={(v) => upd({ ground: v })} opts={[['paper', 'Paper ground'], ['solid', 'Colour ground']]} />
              <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setProject((p) => ({ ...p, covers: p.covers.map((c) => ({ ...c, palette: cur.palette, ground: cur.ground })) })); ctx.say('Palette applied to every cover'); }}>Apply this palette to all covers</button>
            </div>
            <div className="group"><div className="glabel">Watercolour</div>
              <div className="row wrap"><Toggle id="cv-w" label="Wash" checked={cur.showWash !== false} set={(v) => upd({ showWash: v })} /><Toggle id="cv-r" label="Hairline ring" checked={!!cur.ring} set={(v) => upd({ ring: v })} /><button className="btn ghost sm" onClick={() => upd({ seed: (cur.seed || 0) + 1 })}>Repaint wash</button></div>
              <Slider id="cv-o" label="Wash opacity" value={cur.washOpacity == null ? 1 : cur.washOpacity} min={0} max={1.4} step={0.05} set={(v) => upd({ washOpacity: v })} fmt={(v) => Math.round(v * 100) + '%'} />
            </div>
            <div className="row wrap"><button className="btn ghost sm" disabled={idx === 0} onClick={() => move(-1)}>Move left</button><button className="btn ghost sm" disabled={idx === covers.length - 1} onClick={() => move(1)}>Move right</button><button className="btn ghost sm danger" disabled={covers.length <= 1} onClick={() => { setProject((p) => ({ ...p, covers: p.covers.filter((c) => c.id !== cur.id) })); setSel(covers[idx === 0 ? 1 : 0].id); }}>Remove cover</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
