// Composition engine. Layouts emit primitives; one Canvas renderer draws them
// for both the on-screen preview and the 1080 x 1920 PNG export.
import { fmtDate, fmtDateShort, domainOf } from './data.js';

export const W = 1080, H = 1920, SAFE_T = 250, SAFE_B = 1620;
export const ML = 112, MR = 96;
export const STICKER_W = 500, STICKER_H = 120;

export const FAMILIES = [
  { key: 'press', no: '01', name: 'The Press Leaf', file: 'PressLeaf', use: 'Media articles and expert quotations', variants: { a: 'Masthead and offset headline', b: 'Low masthead, full-measure headline' } },
  { key: 'byline', no: '02', name: 'The Byline Folio', file: 'BylineFolio', use: 'Articles Sreepriya wrote or co-wrote', variants: { a: 'Drop initial, essay setting', b: 'Narrow column with margin notes' } },
  { key: 'journal', no: '03', name: 'The Entrust Journal', file: 'EntrustJournal', use: 'Writing published on Entrust', variants: { a: 'Masthead, chapter mark, title', b: 'Open page, title set low' } },
  { key: 'conversation', no: '04', name: 'The Conversation', file: 'Conversation', use: 'Video, podcast and publisher interviews', variants: { a: 'Programme field above, text below', b: 'Vertical split with programme panel' } },
  { key: 'milestone', no: '05', name: 'The Milestone', file: 'Milestone', use: 'Appointments and recognition', variants: { a: 'Year-led archival notice', b: 'Wall label set low' } },
  { key: 'index', no: '06', name: 'The Quiet Index', file: 'QuietIndex', use: 'A contents page of 2 to 4 real entries', variants: { a: 'Contents page', b: 'Exhibition wall labels' } },
];
export const FAMILY = Object.fromEntries(FAMILIES.map((f) => [f.key, f]));

// ---------- colour ----------
export function hexOk(h) { return /^#[0-9a-fA-F]{6}$/.test(h || ''); }
function hx(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toHex(r, g, b) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a, b, t) { const A = hx(a), B = hx(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
export function rgba(h, a) { const [r, g, b] = hx(h); return `rgba(${r},${g},${b},${a})`; }
function lum(h) { const c = hx(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
export function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

export const PALETTES = [
  { key: 'paper', name: 'Paper & wine' },
  { key: 'sand', name: 'Sand' },
  { key: 'blush', name: 'Blush' },
  { key: 'oxblood', name: 'Oxblood' },
  { key: 'neutral', name: 'Provisional neutral' },
];
export function palette(key, b) {
  const k = b.colors;
  switch (key) {
    case 'sand': return { key, bg: mix(k.paper, k.sand, 0.34), ink: k.ink, primary: k.primary, accent: mix(k.accent, k.ink, 0.25), muted: mix(k.ink, k.paper, 0.38), rule: mix(k.ink, k.paper, 0.55), wash1: k.mauve, wash2: k.blush, panel: k.primary, onPanel: k.paper, dark: false };
    case 'blush': return { key, bg: mix(k.paper, k.blush, 0.32), ink: k.ink, primary: k.primary, accent: mix(k.accent, k.ink, 0.3), muted: mix(k.ink, k.paper, 0.4), rule: mix(k.ink, k.paper, 0.55), wash1: k.mauve, wash2: k.sand, panel: k.secondary, onPanel: k.blush, dark: false };
    case 'oxblood': return { key, bg: k.secondary, ink: k.paper, primary: k.blush, accent: k.sand, muted: mix(k.paper, k.secondary, 0.35), rule: mix(k.paper, k.secondary, 0.6), wash1: k.mauve, wash2: k.primary, panel: k.primary, onPanel: k.paper, dark: true };
    case 'neutral': return { key, bg: '#F2F0ED', ink: '#26221F', primary: '#3B3631', accent: '#7D7468', muted: '#77706A', rule: '#B9B2AA', wash1: '#C8C1B8', wash2: '#DCD6CE', panel: '#3B3631', onPanel: '#F2F0ED', dark: false, provisional: true };
    default: return { key: 'paper', bg: k.paper, ink: k.ink, primary: k.primary, accent: k.accent, muted: mix(k.ink, k.paper, 0.4), rule: mix(k.ink, k.paper, 0.6), wash1: k.blush, wash2: k.sand, panel: k.primary, onPanel: k.paper, dark: false };
  }
}

// ---------- text ----------
let _m;
function mctx() { if (!_m) _m = document.createElement('canvas').getContext('2d'); return _m; }
export function famStack(name, kind) {
  const fb = kind === 'serif' ? '"Iowan Old Style", "Palatino Linotype", Georgia, serif' : '"Helvetica Neue", Arial, sans-serif';
  return `"${String(name).replace(/["\\]/g, '')}", ${fb}`;
}
export function fontStr(f, size) { return `${f.style || 'normal'} ${f.weight || 400} ${Math.round(size * 10) / 10}px ${f.stack}`; }
const wcache = new Map();
export function measure(s, f, size, ls) {
  const key = fontStr(f, size) + '|' + (ls || 0) + '|' + s;
  let v = wcache.get(key);
  if (v != null) return v;
  const c = mctx(); c.font = fontStr(f, size);
  if (ls) { v = 0; for (const ch of s) v += c.measureText(ch).width; v += ls * Math.max(0, [...s].length - 1); }
  else v = c.measureText(s).width;
  if (wcache.size > 20000) wcache.clear();
  wcache.set(key, v);
  return v;
}
export function clearMeasureCache() { wcache.clear(); }

export function typo(s) {
  return String(s || '')
    .replace(/(^|[\s(\[“])"/g, '$1“').replace(/"/g, '”')
    .replace(/(^|[\s(\[“])'/g, '$1‘').replace(/'/g, '’')
    .replace(/\s+--\s+/g, ' – ').replace(/[ \t]+/g, ' ');
}

function wrap(text, f, size, widthAt, ls) {
  const paras = String(text).split(/\n/);
  const lines = []; let over = false;
  for (const p of paras) {
    const words = p.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      const lim = widthAt(lines.length);
      if (measure(test, f, size, ls) <= lim || !cur) {
        cur = test;
        if (measure(cur, f, size, ls) > lim + 0.5) over = true;
      } else { lines.push(cur); cur = w; if (measure(cur, f, size, ls) > widthAt(lines.length) + 0.5) over = true; }
    }
    lines.push(cur);
  }
  return { lines, over };
}
export const ASC = 0.74, DESC = 0.26;
function blockH(n, size, lh) { return size * ASC + (n - 1) * size * lh + size * DESC; }

// fits text in a box; returns lines and size
export function fitText(text, f, o) {
  const lh = o.lh || 1.1, ls = o.lsEm ? 0 : 0;
  const maxS = o.max, minS = o.min || Math.min(o.max, 24);
  const widthFn = o.widthFn || (() => o.w);
  let best = null;
  for (let s = maxS; s >= minS - 0.01; s -= Math.max(1, s * 0.03)) {
    const lsPx = o.ls ? o.ls * s : 0;
    const r = wrap(text, f, s, typeof widthFn === 'function' && o.widthFn ? (i) => o.widthFn(i, s) : widthFn, lsPx);
    const h = blockH(r.lines.length, s, lh);
    const ok = !r.over && (!o.h || h <= o.h) && (!o.maxLines || r.lines.length <= o.maxLines);
    if (ok) { best = { size: s, lines: r.lines, h, overflow: false, ls: lsPx }; break; }
  }
  if (!best) {
    const s = minS; const lsPx = o.ls ? o.ls * s : 0;
    const r = wrap(text, f, s, o.widthFn ? (i) => o.widthFn(i, s) : widthFn, lsPx);
    best = { size: s, lines: r.lines, h: blockH(r.lines.length, s, lh), overflow: true, ls: lsPx };
  }
  if (o.balance && !o.widthFn && best.lines.length > 1 && !best.overflow) {
    const n = best.lines.length; let lo = o.w * 0.5, hi = o.w;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2; const r = wrap(text, f, best.size, () => mid, best.ls);
      if (r.lines.length <= n && !r.over) hi = mid; else lo = mid;
    }
    const r = wrap(text, f, best.size, () => hi, best.ls);
    if (r.lines.length === n) best.lines = r.lines;
  }
  return best;
}

// ---------- seeded randomness ----------
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------- watercolour (layered deformed polygons with granulation masks) ----------
function deform(poly, depth, r) {
  let p = poly;
  for (let d = 0; d < depth; d++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push(a);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const v = (a.v + b.v) / 2;
      out.push({ x: (a.x + b.x) / 2 + gauss(r) * len * 0.34 * v, y: (a.y + b.y) / 2 + gauss(r) * len * 0.34 * v, v: v * (0.55 + r() * 0.5) });
    }
    p = out;
  }
  return p;
}
const washCache = new Map();
function makeNoise(seed) {
  const r = rng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const P = new Uint8Array(512); for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const V = new Float32Array(256); for (let i = 0; i < 256; i++) V[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = V[P[X + P[Y]]], b = V[P[X + 1 + P[Y]]], c = V[P[X + P[Y + 1]]], d = V[P[X + 1 + P[Y + 1]]];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct) { let s = 0, amp = 0.5, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += amp * n(x * f + i * 17.3, y * f - i * 9.1); norm += amp; amp *= 0.5; f *= 2.03; } return s / norm; }
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Pigment model: a domain-warped shape; a darker tide line where the edge dried hard;
// soft bleed where the edge stayed wet; uneven density with two pigments mingling;
// cauliflower back-runs; granulation; and, for strokes, dry-brush streaks at the ends.
export function washCanvas(w) {
  const SC = 0.62;
  const key = [w.rx, w.ry, w.rot || 0, w.color, w.color2 || '', w.kind || 'bloom', w.seed].join('|');
  if (washCache.has(key)) return washCache.get(key);
  const r0 = w.rot || 0;
  const ex = Math.hypot(w.rx * Math.cos(r0), w.ry * Math.sin(r0)) * 1.4, ey = Math.hypot(w.rx * Math.sin(r0), w.ry * Math.cos(r0)) * 1.4;
  const cw = Math.ceil(2 * ex * SC), ch = Math.ceil(2 * ey * SC);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const img = g.createImageData(cw, ch); const D = img.data;
  const sd = w.seed >>> 0;
  const n1 = makeNoise(sd + 1), n2 = makeNoise(sd + 2), n3 = makeNoise(sd + 3), n4 = makeNoise(sd + 4), n5 = makeNoise(sd + 5), n6 = makeNoise(sd + 6), n7 = makeNoise(sd + 7), n8 = makeNoise(sd + 8), n9 = makeNoise(sd + 9);
  const c1 = hx(w.color), c2 = hx(w.color2 || w.color);
  const rot = w.rot || 0, co = Math.cos(rot), si = Math.sin(rot);
  const stroke = w.kind === 'stroke';
  const pr = rng(sd + 11); const poolDir = pr() < 0.5 ? -1 : 1, poolDir2 = (pr() - 0.5) * 0.8;
  const deep = (lum(w.color) < lum(w.color2 || w.color) ? c1 : c2).map((x) => x * 0.86);
  const rx = w.rx, ry = w.ry;
  for (let py = 0; py < ch; py++) {
    const Y = py / SC - ey;
    for (let px = 0; px < cw; px++) {
      const X = px / SC - ex;
      let u = X * co + Y * si, v = -X * si + Y * co;
      const d0 = Math.hypot(u / rx, v / ry);
      if (d0 > 1.55) continue;
      const q1 = fbm(n1, X * 0.0036, Y * 0.0036, 3), q2 = fbm(n2, X * 0.0036 + 5.2, Y * 0.0036 + 1.3, 3);
      const wu = u + (q1 - 0.5) * rx * 0.6, wv = v + (q2 - 0.5) * ry * (stroke ? 0.35 : 0.6);
      let d;
      if (stroke) { const t = Math.min(1, Math.abs(wu) / rx); const taper = 1 - 0.45 * t * t; d = Math.hypot(wu / rx, wv / (ry * taper)); }
      else d = Math.hypot(wu / rx, wv / ry);
      const field = 1 - d + (fbm(n3, X * 0.011, Y * 0.011, 4) - 0.5) * 0.3;
      const wet = sstep(0.38, 0.66, fbm(n4, X * 0.0024, Y * 0.0024, 2));
      // soft bleed beyond the edge where the paper was still wet
      let aOut = 0;
      if (field < 0.01) { const fe = 0.015 + 0.13 * wet; const k = Math.max(0, 1 + Math.min(0, field) / fe); aOut = k * k * 0.15 * wet; }
      let aIn = 0, tideK = 0;
      if (field > -0.006) {
        const fv = fbm(n5, X * 0.0052, Y * 0.0052, 3);
        let dens = 0.1 + 0.32 * fv * fv * 1.6;
        dens += 0.11 * sstep(-1, 1, (v / ry) * poolDir + (u / rx) * poolDir2);
        dens *= 0.8 + 0.2 * Math.min(1, Math.max(0, field) * 4);
        tideK = Math.exp(-Math.max(0, field) / 0.02) * (1 - wet * 0.85);
        const br = fbm(n6, X * 0.0085, Y * 0.0085, 3);
        let bloom = 0;
        if (field > 0.08 && br > 0.6) { const kk = sstep(0.6, 0.63, br); dens *= 1 - 0.45 * kk; bloom = Math.exp(-Math.abs(br - 0.605) / 0.01) * 0.16; }
        aIn = (dens + tideK * 0.42 + bloom) * sstep(-0.006, 0.012, field);
        if (stroke) {
          const end = sstep(0.55, 1.0, Math.abs(wu) / rx);
          if (end > 0) {
            const vw = v + (fbm(n2, u * 0.004, 3.1, 2) - 0.5) * ry * 0.5;
            const streak = fbm(n8, u * 0.0016 + 7.7, vw * 0.032, 3);
            aIn *= 1 - end * sstep(0.42, 0.56, streak);
          }
        }
      }
      let a = Math.max(aIn, aOut);
      if (a <= 0.003) continue;
      a *= 0.82 + 0.36 * n7(X * 0.33, Y * 0.33);
      let m = sstep(0.3, 0.8, fbm(n9, X * 0.0028, Y * 0.0028, 2)) * 0.85;
      const i = (py * cw + px) * 4;
      let R = c1[0] + (c2[0] - c1[0]) * m, G = c1[1] + (c2[1] - c1[1]) * m, Bc = c1[2] + (c2[2] - c1[2]) * m;
      const t = Math.min(1, tideK * 0.8);
      R += (deep[0] - R) * t; G += (deep[1] - G) * t; Bc += (deep[2] - Bc) * t;
      D[i] = R; D[i + 1] = G; D[i + 2] = Bc;
      D[i + 3] = Math.min(255, a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const out = { canvas: c, scale: SC, cw, ch };
  if (washCache.size > 80) washCache.delete(washCache.keys().next().value);
  washCache.set(key, out);
  return out;
}

let grainCv = null;
export function grainCanvas() {
  if (grainCv) return grainCv;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const small = document.createElement('canvas'); small.width = 60; small.height = 107;
  const sg = small.getContext('2d'); const r = rng(7);
  const sd = sg.createImageData(60, 107);
  for (let i = 0; i < sd.data.length; i += 4) { const v = 128 + (r() - 0.5) * 70; sd.data[i] = sd.data[i + 1] = sd.data[i + 2] = v; sd.data[i + 3] = 255; }
  sg.putImageData(sd, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, W, H);
  const id = g.getImageData(0, 0, W, H); const d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 46; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  g.strokeStyle = 'rgba(70,60,60,0.10)'; g.lineWidth = 0.8;
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H, l = 10 + r() * 40, a = r() * Math.PI;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 8, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  grainCv = c; return c;
}

// tinted images (logo reversal, ghost marks, portrait treatments)
const tintCache = new Map();
export function tinted(img, color, key) {
  const k = key + '|' + color;
  if (tintCache.has(k)) return tintCache.get(k);
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  tintCache.set(k, c); return c;
}
export function treated(img, mode, pal, key) {
  if (mode === 'natural') return img;
  const k = key + '|' + mode + '|' + pal.ink + pal.bg;
  if (tintCache.has(k)) return tintCache.get(k);
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height); const d = id.data;
  const dk = hx(pal.dark ? pal.bg : pal.ink), lt = hx(pal.dark ? pal.ink : pal.bg);
  for (let i = 0; i < d.length; i += 4) {
    const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    if (mode === 'mono') { d[i] = d[i + 1] = d[i + 2] = y * 255; }
    else { d[i] = dk[0] + (lt[0] - dk[0]) * y; d[i + 1] = dk[1] + (lt[1] - dk[1]) * y; d[i + 2] = dk[2] + (lt[2] - dk[2]) * y; }
  }
  g.putImageData(id, 0, 0);
  tintCache.set(k, c); return c;
}

// ---------- layout context helpers ----------
function mk(L) {
  const items = [], boxes = [], hits = [], warnings = [];
  const SERIF = { stack: famStack(L.brand.fonts.serif, 'serif') };
  const SANS = { stack: famStack(L.brand.fonts.sans, 'sans') };
  const api = {
    items, boxes, hits, warnings, SERIF, SANS,
    push(it) { items.push(it); return it; },
    text(s, o) {
      const f = { ...(o.sans ? SANS : SERIF), weight: o.weight || 400, style: o.italic ? 'italic' : 'normal' };
      const str = o.caps ? String(s).toUpperCase() : String(s);
      const lh = o.lh || 1.1;
      let fit;
      if (o.size) fit = fitText(str, f, { max: o.size, min: o.size, w: o.w, lh, ls: o.ls, widthFn: o.widthFn });
      else fit = fitText(str, f, { max: o.max, min: o.min, w: o.w, h: o.h, lh, ls: o.ls, maxLines: o.maxLines, balance: o.balance, widthFn: o.widthFn });
      const size = fit.size;
      const h = blockH(fit.lines.length, size, lh);
      let top = o.anchor === 'bottom' ? o.y - h : o.anchor === 'middle' ? o.y - h / 2 : o.y;
      const lines = fit.lines.map((s2, i) => {
        const lw = measure(s2, f, size, fit.ls);
        const off = o.offsetFn ? o.offsetFn(i, size) : 0;
        const x = o.align === 'right' ? o.x + o.w - lw : o.align === 'center' ? o.x + (o.w - lw) / 2 : o.x + off;
        return { s: s2, x, y: top + size * ASC + i * size * lh, w: lw };
      });
      const maxW = lines.reduce((m, l) => Math.max(m, l.w), 0);
      const it = { t: 'text', f, size, ls: fit.ls, lines, fill: o.fill, alpha: o.alpha == null ? 1 : o.alpha, rot: o.rot || 0, origin: o.origin };
      items.push(it);
      const box = { x: o.align === 'right' ? o.x + o.w - maxW : o.x, y: top, w: maxW, h, role: o.role || 'text' };
      if (!o.rot) boxes.push(box);
      if (fit.overflow && o.critical !== false) warnings.push({ code: 'overflow', role: o.role || 'text', msg: `${o.roleName || 'Text'} does not fit its area at the smallest allowed size. Shorten the display text or use the other variation.` });
      return { top, bottom: top + h, h, size, lines, maxW, overflow: fit.overflow, firstBase: top + size * ASC };
    },
    rule(x1, y1, x2, y2, color, w = 1.5, alpha = 1) { items.push({ t: 'rule', x1, y1, x2, y2, color, w, alpha }); },
    rect(x, y, w, h, fill, alpha = 1) { items.push({ t: 'rect', x, y, w, h, fill, alpha }); },
    wash(o) { if (!L.st.showWash) return; items.push({ t: 'wash', color2: o.color === L.pal.wash1 ? L.pal.wash2 : L.pal.wash1, ...o, alpha: (o.alpha == null ? 1 : o.alpha) * L.washOpacity * (L.pal.dark ? 0.6 : 0.85) * (L.brand.washOpacity == null ? 1 : L.brand.washOpacity), seed: hashStr(L.seedBase + ':' + (o.k || 0)) }); },
    hit(kind, box, url) { hits.push({ kind, ...box, url }); },
  };
  return api;
}

function folio(A, L, left, right, y = 256) {
  const o = { sans: true, size: 20, weight: 500, caps: true, ls: 0.16, fill: L.pal.muted, critical: false };
  if (left) A.text(left, { ...o, x: ML, y, w: 600 });
  if (right) A.text(right, { ...o, x: W - MR - 420, y, w: 420, align: 'right' });
}

function drawChevron(A, x, y, color) {
  A.rule(x, y, x + 34, y, color, 2);
  A.rule(x + 34, y, x + 24, y - 9, color, 2);
  A.rule(x + 34, y, x + 24, y + 9, color, 2);
}

function linkZone(A, L, ctaText) {
  const s = L.sticker;
  const y = s.y - 34;
  const t = A.text(ctaText, { sans: true, size: 24, weight: 600, caps: true, ls: 0.14, fill: L.pal.ink, x: s.x, y: y - 24, w: 700, role: 'cta', critical: false });
  drawChevron(A, s.x + t.maxW + 18, y - 12, L.pal.ink);
  A.push({ t: 'sticker', x: s.x, y: s.y, w: s.w, h: s.h, color: L.pal.accent, domain: domainOf(L.url) });
}

function frameCount(A, L) {
  if (L.frames <= 1) return;
  A.text(`${String(L.frameNo).padStart(2, '0')} / ${String(L.frames).padStart(2, '0')}`, { sans: true, size: 20, weight: 500, ls: 0.14, fill: L.pal.muted, x: W - MR - 200, y: SAFE_B - 34, w: 200, align: 'right', critical: false, role: 'count' });
}

function logoMark(A, L, x, y, h, opts = {}) {
  if (!L.st.showLogo || !L.logo.mark) return 0;
  const img = L.logo.mark; const w = h * (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  A.push({ t: 'logo', img, x, y, w, h, tone: L.pal.dark ? L.pal.ink : null, key: L.logo.key + 'mark', alpha: opts.alpha || 1 });
  A.boxes.push({ x, y, w, h, role: 'logo' });
  return w;
}

function ghostMark(A, L, x, y, h, alpha) {
  if (!L.st.showMark || !L.logo.mark) return;
  const img = L.logo.mark; const w = h * (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  A.push({ t: 'logo', img, x, y, w, h, tone: L.pal.primary, key: L.logo.key + 'ghost', alpha });
}

function portraitAvail(L) { return !!(L.image && L.image.img); }

// ---------- family layouts ----------
function contentBottom(L) { return L.hasLink ? L.sticker.y - 118 : SAFE_B - 70; }

function pressLeaf(A, L, v) {
  const { pal, rec } = L; const R = rec.src;
  const cb = contentBottom(L);
  if (v === 'a') {
    A.wash({ cx: 1150, cy: 860, rx: 420, ry: 640, rot: -0.2, color: pal.wash1, k: 1, alpha: 0.95 });
    
    folio(A, L, `No. ${R.id}`, L.dateShort);
    const lab = A.text(rec.d.roleLabel, { sans: true, size: 24, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: ML, y: 352, w: 800, role: 'label' });
    const m = A.text(L.outlet, { italic: true, max: 104, min: 50, w: W - ML - MR - 60, maxLines: 2, lh: 1.0, fill: pal.primary, x: ML, y: lab.bottom + 26, role: 'outlet', roleName: 'Outlet name' });
    A.hit('source', { x: ML, y: m.top, w: m.maxW, h: m.h }, L.url);
    const ry = m.bottom + 34;
    A.rule(ML, ry, W - MR, ry, pal.ink, 2);
    const hx0 = ML + 168, hy = ry + 92;
    const credH = 70;
    const hd = A.text(L.headline, { max: 116 * L.scale, min: 50, lh: 1.05, w: W - MR - hx0, h: cb - credH - hy, x: hx0, y: hy, fill: pal.ink, balance: true, role: 'headline', roleName: 'Headline' });
    A.text(String(R.year), { italic: true, size: 44, fill: pal.accent, x: ML, y: hd.top, w: 140, critical: false });
    A.rule(ML + 128, hd.top + 70, ML + 128, hd.bottom, pal.rule, 1.2);
    A.text(rec.d.credit, { italic: true, size: 38, fill: pal.muted, x: hx0, y: hd.bottom + 34, w: W - MR - hx0, critical: false, role: 'credit' });
  } else {
    A.wash({ cx: -60, cy: 1180, rx: 380, ry: 520, rot: 0.25, color: pal.wash2, k: 3, alpha: 0.9 });
    A.wash({ cx: 1110, cy: 250, rx: 300, ry: 240, rot: -0.3, color: pal.wash1, k: 4, alpha: 0.7 });
    folio(A, L, `No. ${R.id}`, L.dateShort);
    const lab = A.text(rec.d.roleLabel, { sans: true, size: 22, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: W - MR - 760, y: 330, w: 760, align: 'right', role: 'label' });
    const m = A.text(L.outlet, { italic: true, max: 74, min: 42, w: 760, maxLines: 2, lh: 1.02, fill: pal.primary, x: W - MR - 760, y: lab.bottom + 20, align: 'right', role: 'outlet', roleName: 'Outlet name' });
    A.hit('source', { x: W - MR - m.maxW, y: m.top, w: m.maxW, h: m.h }, L.url);
    const ry = m.bottom + 40;
    A.rule(ML, ry, W - MR, ry, pal.ink, 1.5);
    A.text(L.dateLong, { sans: true, size: 22, weight: 500, fill: pal.muted, x: ML, y: ry + 22, w: 500, critical: false });
    A.text(R.format, { sans: true, size: 22, weight: 500, fill: pal.muted, x: W - MR - 460, y: ry + 22, w: 460, align: 'right', critical: false });
    const hy = ry + 120;
    const hd = A.text(L.headline, { max: 100 * L.scale, min: 46, lh: 1.06, w: W - ML - MR, h: cb - 96 - hy, x: ML, y: hy, fill: pal.ink, balance: true, role: 'headline', roleName: 'Headline' });
    A.rule(ML, hd.bottom + 44, ML + 72, hd.bottom + 44, pal.accent, 2);
    A.text(rec.d.credit, { italic: true, size: 36, fill: pal.muted, x: ML + 96, y: hd.bottom + 28, w: 760, critical: false, role: 'credit' });
  }
}

function bylineFolio(A, L, v) {
  const { pal, rec } = L; const R = rec.src;
  const cb = contentBottom(L);
  const headline = L.headline.replace(/^[“"‘']+/, '');
  if (v === 'a') {
    A.text(rec.d.roleLabel, { sans: true, size: 20, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: ML, y: 256, w: 600 });
    const m = A.text(L.outlet, { italic: true, max: 50, min: 34, w: 620, maxLines: 1, fill: pal.ink, x: ML, y: 292, role: 'outlet', roleName: 'Outlet name' });
    A.hit('source', { x: ML, y: m.top, w: m.maxW, h: m.h }, L.url);
    A.text(`No. ${R.id}`, { sans: true, size: 20, weight: 500, caps: true, ls: 0.16, fill: pal.muted, x: W - MR - 300, y: 256, w: 300, align: 'right' });
    A.text(L.dateShort, { sans: true, size: 20, weight: 500, caps: true, ls: 0.1, fill: pal.muted, x: W - MR - 300, y: 292, w: 300, align: 'right' });
    A.rule(ML, 372, W - MR, 372, pal.rule, 1.2);
    // drop initial: first letter carries into the headline
    const first = headline.charAt(0); const rest = headline.slice(1);
    const top = 470, bw = W - ML - MR, lh = 1.07, K = 3;
    const notesH = 150;
    let chosen = null;
    for (let s = 104 * L.scale; s >= 44; s -= 2) {
      const capH = s * ASC + (K - 1) * s * lh;
      const D = capH / 0.70;
      const dw = measure(first, { ...A.SERIF, weight: 400, style: 'normal' }, D, 0) + 26;
      const f = { ...A.SERIF, weight: 400, style: 'normal' };
      const r = wrap(rest, f, s, (i) => (i < K ? bw - dw : bw), 0);
      const h = Math.max(blockH(r.lines.length, s, lh), capH + s * DESC);
      if (!r.over && h <= cb - notesH - 120 - top) { chosen = { s, D, dw, lines: r.lines, h }; break; }
    }
    if (!chosen) { const s = 44, capH = s * ASC + (K - 1) * s * lh, D = capH / 0.7; const dw = measure(first, { ...A.SERIF, weight: 400 }, D, 0) + 26; const r = wrap(rest, { ...A.SERIF, weight: 400 }, s, (i) => (i < K ? bw - dw : bw), 0); chosen = { s, D, dw, lines: r.lines, h: blockH(r.lines.length, s, lh) }; A.warnings.push({ code: 'overflow', msg: 'Headline does not fit the drop-initial setting. Shorten it or switch to variation B.' }); }
    const { s, D, dw } = chosen;
    A.wash({ cx: ML + dw * 0.45, cy: top + D * 0.42, rx: 250 + D * 0.3, ry: 230 + D * 0.25, rot: 0.5, color: pal.wash1, k: 5, alpha: 0.95 });
    A.push({ t: 'text', f: { ...A.SERIF, weight: 400, style: 'normal' }, size: D, ls: 0, lines: [{ s: first, x: ML - D * 0.04, y: top + D * 0.70 }], fill: pal.primary, alpha: 1 });
    A.boxes.push({ x: ML, y: top, w: dw, h: D * 0.75, role: 'initial' });
    const lines = chosen.lines.map((t, i) => ({ s: t, x: i < K ? ML + dw : ML, y: top + s * ASC + i * s * lh }));
    A.push({ t: 'text', f: { ...A.SERIF, weight: 400, style: 'normal' }, size: s, ls: 0, lines, fill: pal.ink, alpha: 1 });
    const hb = top + chosen.h;
    A.boxes.push({ x: ML, y: top, w: bw, h: chosen.h, role: 'headline' });
    A.rule(ML, hb + 56, ML + 64, hb + 56, pal.ink, 1.5);
    A.text(rec.d.credit, { italic: true, size: 42, fill: pal.primary, x: ML + 88, y: hb + 38, w: 760, role: 'credit' });
    const ny = cb - notesH + 30;
    A.rule(ML, ny, W - MR, ny, pal.rule, 1);
    A.text('Published', { sans: true, size: 18, weight: 600, caps: true, ls: 0.16, fill: pal.muted, x: ML, y: ny + 22, w: 260 });
    A.text(L.dateLong, { sans: true, size: 22, fill: pal.ink, x: ML, y: ny + 56, w: 280, maxLines: 2, max: 22, min: 18, critical: false });
    A.text('Subject', { sans: true, size: 18, weight: 600, caps: true, ls: 0.16, fill: pal.muted, x: ML + 330, y: ny + 22, w: 300 });
    A.text(R.topic, { sans: true, max: 22, min: 18, w: W - MR - ML - 330, maxLines: 2, fill: pal.ink, x: ML + 330, y: ny + 56, critical: false });
  } else {
    const first = headline.charAt(0);
    A.push({ t: 'text', f: { ...A.SERIF, weight: 300, style: 'normal' }, size: 1180, ls: 0, lines: [{ s: first, x: -70, y: 1360 }], fill: pal.primary, alpha: pal.dark ? 0.12 : 0.07 });
    A.wash({ cx: 140, cy: 1330, rx: 380, ry: 320, rot: -0.3, color: pal.wash2, k: 6, alpha: 0.9 });
    folio(A, L, 'Sreepriya N S', `No. ${R.id}`);
    const colX = ML, colW = 250, mainX = ML + 316, mainW = W - MR - mainX, top = 470;
    A.rule(ML, 380, W - MR, 380, pal.rule, 1.2);
    let y = top;
    const lab = A.text(rec.d.roleLabel, { sans: true, size: 18, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: colX, y, w: colW });
    const m = A.text(L.outlet, { italic: true, max: 40, min: 28, w: colW, maxLines: 3, lh: 1.05, fill: pal.ink, x: colX, y: lab.bottom + 14, role: 'outlet', roleName: 'Outlet name' });
    A.hit('source', { x: colX, y: m.top, w: m.maxW, h: m.h }, L.url);
    y = m.bottom + 42;
    A.text('Published', { sans: true, size: 17, weight: 600, caps: true, ls: 0.16, fill: pal.muted, x: colX, y, w: colW });
    const dd = A.text(L.dateLong, { sans: true, max: 22, min: 18, maxLines: 2, fill: pal.ink, x: colX, y: y + 30, w: colW, critical: false });
    y = dd.bottom + 36;
    A.text('Subject', { sans: true, size: 17, weight: 600, caps: true, ls: 0.16, fill: pal.muted, x: colX, y, w: colW });
    A.text(R.topic, { sans: true, max: 21, min: 18, maxLines: 4, lh: 1.25, fill: pal.ink, x: colX, y: y + 30, w: colW, critical: false });
    const hd = A.text(L.headline, { max: 88 * L.scale, min: 42, lh: 1.08, w: mainW, h: cb - 110 - top, x: mainX, y: top, fill: pal.ink, balance: true, role: 'headline', roleName: 'Headline' });
    A.rule(mainX - 36, top, mainX - 36, Math.max(hd.bottom, 900), pal.rule, 1.2);
    A.text(rec.d.credit, { italic: true, size: 38, fill: pal.primary, x: mainX, y: hd.bottom + 40, w: mainW, role: 'credit' });
  }
}

function journalSeriesMark(R, series) {
  const n = /Story\s*(\d+)/i.exec(R.title) || /Case Study\s*(\d+)/i.exec(R.title);
  return series + (n ? ` · No. ${n[1]}` : '');
}

function entrustJournal(A, L, v) {
  const { pal, rec } = L; const R = rec.src;
  const cb = contentBottom(L);
  const stripY = cb - 56;
  const masthead = (y) => {
    const w = logoMark(A, L, ML, y, 92);
    const x = ML + (w ? w + 28 : 0);
    A.text('The Journal', { sans: true, size: 21, weight: 600, caps: true, ls: 0.2, fill: pal.ink, x, y: y + 20, w: 500 });
    A.text('Entrust Family Office', { italic: true, size: 30, fill: pal.muted, x, y: y + 52, w: 500 });
  };
  const strip = () => {
    A.rule(ML, stripY, W - MR, stripY, pal.ink, 1.2);
    const t = A.text('Published on Entrust Family Office', { sans: true, size: 19, weight: 600, caps: true, ls: 0.14, fill: pal.ink, x: ML, y: stripY + 20, w: 640, role: 'source' });
    A.hit('source', { x: ML, y: stripY + 10, w: t.maxW, h: 40 }, L.url);
    A.text(L.dateShort, { sans: true, size: 19, weight: 500, caps: true, ls: 0.1, fill: pal.muted, x: W - MR - 300, y: stripY + 20, w: 300, align: 'right' });
  };
  const series = rec.d.series || 'Journal';
  if (v === 'a') {
    A.wash({ cx: 1000, cy: 330, rx: 400, ry: 320, rot: 0.35, color: pal.wash1, k: 7, alpha: 0.95 });
    
    masthead(266);
    A.rule(ML, 400, ML + 240, 400, pal.accent, 2);
    A.text(journalSeriesMark(R, series) + `  ·  ${R.id}`, { sans: true, size: 17, weight: 600, caps: true, ls: 0.22, fill: pal.muted, x: 0, y: 0, w: 1400, rot: -Math.PI / 2, origin: { x: 62, y: stripY - 30 }, critical: false });
    const ty = 500;
    const hd = A.text(L.headline, { max: 112 * L.scale, min: 48, lh: 1.04, w: W - ML - MR - 30, h: stripY - 150 - ty, x: ML, y: ty, fill: pal.ink, balance: true, role: 'headline', roleName: 'Title' });
    A.text(rec.d.credit, { italic: true, size: 40, fill: pal.primary, x: ML, y: hd.bottom + 44, w: 760, role: 'credit' });
    ghostMark(A, L, W - MR - 300, stripY - 470, 420, pal.dark ? 0.1 : 0.06);
    strip();
  } else {
    A.wash({ cx: 1080, cy: 640, rx: 360, ry: 520, rot: 0.15, color: pal.wash2, k: 9, alpha: 0.95 });
    
    masthead(262);
    ghostMark(A, L, ML - 30, 560, 560, pal.dark ? 0.09 : 0.05);
    const bottom = stripY - 150;
    const hd = A.text(L.headline, { max: 104 * L.scale, min: 46, lh: 1.05, w: W - ML - MR - 40, h: bottom - 640, x: ML, y: bottom, anchor: 'bottom', fill: pal.ink, balance: true, role: 'headline', roleName: 'Title' });
    A.text(journalSeriesMark(R, series), { sans: true, size: 20, weight: 600, caps: true, ls: 0.18, fill: pal.accent, x: ML, y: hd.top - 74, w: 800 });
    A.rule(ML, hd.top - 30, ML + 72, hd.top - 30, pal.accent, 2);
    A.text(rec.d.credit, { italic: true, size: 40, fill: pal.primary, x: ML, y: hd.bottom + 40, w: 760, role: 'credit' });
    strip();
  }
}

function conversation(A, L, v) {
  const { pal, rec } = L; const R = rec.src;
  const cb = contentBottom(L);
  const kind = R.collection === 'conversations' ? (/Podcast/i.test(R.format) ? 'Podcast' : 'Video interview') : R.format;
  const hasImg = portraitAvail(L);
  if (v === 'a') {
    const fieldB = 960;
    if (hasImg) {
      A.push({ t: 'image', ...L.image, x: 0, y: 0, w: W, h: fieldB });
      A.rule(0, fieldB, W, fieldB, pal.ink, 2);
    } else {
      A.wash({ cx: 560, cy: 640, rx: 640, ry: 230, rot: -0.07, color: pal.wash1, k: 11, alpha: 1, kind: 'stroke' });
      
      folio(A, L, kind, `No. ${R.id}`);
      const m = A.text(L.outlet, { italic: true, weight: 300, max: 230, min: 80, maxLines: 2, lh: 0.96, w: W - ML - MR, x: ML, y: fieldB - 70, anchor: 'bottom', fill: pal.primary, role: 'outlet', roleName: 'Programme name' });
      A.hit('source', { x: ML, y: m.top, w: m.maxW, h: m.h }, L.url);
    }
    const ly = fieldB + 46;
    A.text(rec.d.roleLabel + (hasImg ? `  ·  ${L.outlet}` : ''), { sans: true, size: 22, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: ML, y: ly, w: 640, maxLines: 1, max: 22, min: 16, critical: false });
    if (hasImg) A.hit('source', { x: ML, y: ly - 6, w: 640, h: 34 }, L.url);
    A.text(L.dateShort, { sans: true, size: 22, weight: 500, caps: true, ls: 0.1, fill: pal.muted, x: W - MR - 300, y: ly, w: 300, align: 'right' });
    const ty = ly + 70;
    const hd = A.text(L.headline, { max: 74 * L.scale, min: 36, lh: 1.1, w: W - ML - MR, h: cb - 72 - ty, x: ML, y: ty, fill: pal.ink, balance: true, role: 'headline', roleName: 'Title' });
    A.text(rec.d.credit, { italic: true, size: 34, fill: pal.muted, x: ML, y: hd.bottom + 28, w: 860, role: 'credit' });
  } else {
    const pw = 404;
    if (hasImg) A.push({ t: 'image', ...L.image, x: 0, y: 0, w: pw, h: H });
    else {
      A.rect(0, 0, pw, H, pal.dark ? pal.primary : pal.panel, pal.dark ? 0.18 : 1);
      const t = A.text(L.outlet, { italic: true, weight: 300, max: 150, min: 64, maxLines: 1, w: 1320, x: 0, y: 0, fill: pal.dark ? pal.ink : pal.onPanel, rot: -Math.PI / 2, origin: { x: 128, y: SAFE_B - 10 }, role: 'outlet', critical: false });
      A.hit('source', { x: 128, y: SAFE_B - 10 - t.maxW, w: t.size, h: t.maxW }, L.url);
    }
    A.wash({ cx: pw + 20, cy: 520, rx: 230, ry: 420, rot: 0.1, color: pal.wash1, k: 13, alpha: 0.85 });
    const x = pw + 64, w = W - MR - x;
    A.text(kind, { sans: true, size: 20, weight: 600, caps: true, ls: 0.16, fill: pal.muted, x, y: 256, w, critical: false });
    A.text(`No. ${R.id}  ·  ${L.dateShort}`, { sans: true, size: 20, weight: 500, caps: true, ls: 0.1, fill: pal.muted, x, y: 290, w, critical: false });
    const lab = A.text(rec.d.roleLabel, { sans: true, size: 22, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x, y: 420, w });
    const m = A.text(L.outlet, { italic: true, max: 56, min: 34, maxLines: 2, lh: 1.02, w, x, y: lab.bottom + 18, fill: pal.primary, role: 'outlet', roleName: 'Programme name' });
    A.hit('source', { x, y: m.top, w: m.maxW, h: m.h }, L.url);
    A.rule(x, m.bottom + 34, W - MR, m.bottom + 34, pal.ink, 1.5);
    const ty = m.bottom + 96;
    const hd = A.text(L.headline, { max: 72 * L.scale, min: 34, lh: 1.1, w, h: cb - 80 - ty, x, y: ty, fill: pal.ink, balance: true, role: 'headline', roleName: 'Title' });
    A.text(rec.d.credit, { italic: true, max: 34, min: 26, maxLines: 2, fill: pal.muted, x, y: hd.bottom + 30, w, role: 'credit', critical: false });
  }
}

function milestone(A, L, v) {
  const { pal, rec } = L; const R = rec.src;
  const cb = contentBottom(L);
  const kind = rec.d.milestoneKind;
  if (v === 'a') {
    A.wash({ cx: 420, cy: 560, rx: 520, ry: 170, rot: -0.06, color: pal.wash2, k: 14, alpha: 1, kind: 'stroke' });
    folio(A, L, 'Sreepriya N S', `No. ${R.id}`);
    const yr = A.text(String(R.year), { weight: 250, size: 320, fill: pal.primary, x: ML - 16, y: 380, w: 900, role: 'year' });
    const ry = yr.bottom + 20;
    A.rule(ML, ry, W - MR, ry, pal.ink, 1.2); A.rule(ML, ry + 8, W - MR, ry + 8, pal.ink, 1.2);
    A.text(kind, { sans: true, size: 22, weight: 600, caps: true, ls: 0.18, fill: pal.accent, x: ML, y: ry + 40, w: 400 });
    A.text(L.dateShort, { sans: true, size: 22, weight: 500, caps: true, ls: 0.1, fill: pal.muted, x: W - MR - 400, y: ry + 40, w: 400, align: 'right' });
    const ty = ry + 130;
    const hd = A.text(L.headline, { max: 86 * L.scale, min: 40, lh: 1.08, w: W - ML - MR, h: cb - 90 - ty, x: ML, y: ty, fill: pal.ink, balance: true, role: 'headline', roleName: 'Headline' });
    const m = A.text(`${rec.d.roleLabel} ${L.outlet}`, { italic: true, max: 40, min: 28, maxLines: 2, fill: pal.muted, x: ML, y: hd.bottom + 34, w: W - ML - MR, role: 'outlet', critical: false });
    A.hit('source', { x: ML, y: m.top, w: m.maxW, h: m.h }, L.url);
  } else {
    A.wash({ cx: 900, cy: 600, rx: 420, ry: 380, rot: 0.5, color: pal.wash1, k: 15, alpha: 0.95 });
    
    folio(A, L, `${R.year}  ·  Archive`, `No. ${R.id}`);
    ghostMark(A, L, ML, 420, 380, pal.dark ? 0.1 : 0.06);
    const bx = ML + 44, bw = 780;
    const bottom = cb - 20;
    // assemble bottom-up
    const m = A.text(`${L.outlet}, ${L.dateLong}`, { italic: true, max: 36, min: 26, maxLines: 2, fill: pal.muted, x: bx, y: bottom, anchor: 'bottom', w: bw, role: 'outlet', critical: false });
    A.hit('source', { x: bx, y: m.top, w: m.maxW, h: m.h }, L.url);
    const hd = A.text(L.headline, { max: 72 * L.scale, min: 38, lh: 1.1, w: bw, h: m.top - 40 - 820, x: bx, y: m.top - 36, anchor: 'bottom', fill: pal.ink, balance: true, role: 'headline', roleName: 'Headline' });
    const lb = A.text(kind, { sans: true, size: 20, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: bx, y: hd.top - 40, anchor: 'bottom', w: bw, critical: false });
    A.rule(ML, lb.top - 6, ML, bottom, pal.ink, 1.5);
  }
}

function quietIndex(A, L, v) {
  const { pal } = L;
  const ents = L.entries;
  const cb = contentBottom(L);
  const years = ents.map((e) => e.src.year).filter(Boolean);
  const span = years.length ? (Math.min(...years) === Math.max(...years) ? `${Math.min(...years)}` : `${Math.min(...years)} – ${Math.max(...years)}`) : '';
  const words = ['', 'One piece', 'Two pieces', 'Three pieces', 'Four pieces'][ents.length] || `${ents.length} pieces`;
  if (v === 'a') {
    A.wash({ cx: 1060, cy: 330, rx: 380, ry: 280, rot: 0.3, color: pal.wash1, k: 17, alpha: 0.9 });
    folio(A, L, 'Index', 'Sreepriya N S');
    const t = A.text(L.headline, { italic: true, max: 96 * L.scale, min: 50, maxLines: 2, lh: 1.0, w: W - ML - MR - 120, x: ML, y: 340, fill: pal.primary, role: 'headline', roleName: 'Index title' });
    A.text(`${words}${span ? ', ' + span : ''}`, { sans: true, size: 22, weight: 500, fill: pal.muted, x: ML, y: t.bottom + 26, w: 700 });
    let y = t.bottom + 92;
    A.rule(ML, y, W - MR, y, pal.ink, 2);
    const per = (cb - 40 - y) / Math.max(1, ents.length);
    ents.forEach((e, i) => {
      const top = y + 28;
      const isLink = e.id === L.linkTarget;
      A.text(e.id, { sans: true, size: 18, weight: 600, caps: true, ls: 0.14, fill: isLink ? pal.accent : pal.muted, x: ML, y: top + 4, w: 120 });
      if (isLink) A.push({ t: 'dot', x: ML + 8, y: top + 46, r: 7, color: pal.accent });
      const ox = ML + 150, ow = W - MR - ox - 110;
      A.text(e.outlet, { italic: true, max: 30, min: 22, maxLines: 1, fill: pal.accent, x: ox, y: top, w: ow, critical: false });
      A.text(String(e.src.year), { sans: true, size: 20, weight: 500, fill: pal.muted, x: W - MR - 100, y: top + 4, w: 100, align: 'right' });
      const tt = A.text(typo(e.src.title), { max: 44, min: 26, maxLines: 3, lh: 1.08, w: W - MR - ox, h: per - 84, x: ox, y: top + 46, fill: pal.ink, role: 'entry', roleName: `Entry ${e.id}` });
      y = Math.max(top + per - 28, tt.bottom + 26);
      if (i < ents.length - 1) A.rule(ox, y, W - MR, y, pal.rule, 1);
    });
  } else {
    A.wash({ cx: 80, cy: 300, rx: 460, ry: 300, rot: 0.2, color: pal.wash2, k: 18, alpha: 0.95 });
    folio(A, L, 'From the archive', 'Sreepriya N S');
    const t = A.text(L.headline, { italic: true, max: 78 * L.scale, min: 44, maxLines: 2, lh: 1.02, w: W - ML - MR, x: ML, y: 400, fill: pal.primary, role: 'headline', roleName: 'Index title' });
    A.text(`${words}${span ? ', ' + span : ''}`, { sans: true, size: 22, weight: 500, fill: pal.muted, x: ML, y: t.bottom + 24, w: 700 });
    let y = t.bottom + 100;
    const [lead, ...rest] = ents;
    if (lead) {
      A.rule(ML, y, W - MR, y, pal.ink, 1.5);
      const isLink = lead.id === L.linkTarget;
      A.text(`${lead.id}  ·  ${lead.outlet}  ·  ${lead.src.year}`, { sans: true, size: 19, weight: 600, caps: true, ls: 0.14, fill: isLink ? pal.accent : pal.muted, x: ML, y: y + 26, w: W - ML - MR, maxLines: 1, max: 19, min: 14, critical: false });
      if (isLink) A.push({ t: 'dot', x: W - MR - 7, y: y + 36, r: 7, color: pal.accent });
      const lt = A.text(typo(lead.src.title), { max: 62, min: 36, maxLines: 3, lh: 1.06, w: W - ML - MR, x: ML, y: y + 74, fill: pal.ink, role: 'entry', roleName: `Entry ${lead.id}` });
      y = lt.bottom + 56;
    }
    const colW = (W - ML - MR - 48) / 2;
    const rowsH = cb - 20 - y;
    rest.forEach((e, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = ML + col * (colW + 48);
      const yy = y + row * (rowsH / Math.ceil(rest.length / 2));
      const isLink = e.id === L.linkTarget;
      A.rule(x, yy, x + colW, yy, pal.rule, 1);
      A.text(`${e.id}  ·  ${e.src.year}`, { sans: true, size: 17, weight: 600, caps: true, ls: 0.14, fill: isLink ? pal.accent : pal.muted, x, y: yy + 20, w: colW });
      if (isLink) A.push({ t: 'dot', x: x + colW - 7, y: yy + 30, r: 6, color: pal.accent });
      A.text(e.outlet, { italic: true, max: 26, min: 20, maxLines: 1, fill: pal.accent, x, y: yy + 54, w: colW, critical: false });
      A.text(typo(e.src.title), { max: 34, min: 22, maxLines: 4, lh: 1.1, w: colW, h: rowsH / Math.ceil(rest.length / 2) - 110, x, y: yy + 96, fill: pal.ink, role: 'entry', roleName: `Entry ${e.id}` });
    });
  }
}

// context frame: approved text, or a non-substantive detail frame
function contextFrame(A, L) {
  const { pal, rec } = L; const R = rec.src;
  const c = L.st.context || {};
  const approved = c.kind !== 'none' && c.text && c.text.trim() && c.approved && (c.kind !== 'quote' || c.attributionConfirmed);
  A.wash({ cx: 1100, cy: 1480, rx: 420, ry: 360, rot: 0.3, color: pal.wash1, k: 30, alpha: 0.9 });
  folio(A, L, `No. ${R.id}`, L.outlet);
  if (approved) {
    const label = c.kind === 'quote' ? 'In her words' : c.kind === 'excerpt' ? 'From the piece' : 'In brief';
    A.text(label, { sans: true, size: 22, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: ML, y: 470, w: 600 });
    A.rule(ML, 520, ML + 72, 520, pal.accent, 2);
    const body = A.text(typo(c.text.trim()), { italic: c.kind === 'quote', weight: 400, max: c.kind === 'quote' ? 80 : 64, min: 34, lh: c.kind === 'quote' ? 1.16 : 1.2, w: W - ML - MR - 40, h: 1380 - 600, x: ML, y: 600, fill: pal.ink, balance: true, role: 'headline', roleName: 'Context text' });
    const attr = c.kind === 'quote'
      ? (R.collection === 'entrust_journal' ? 'Sreepriya N S, writing on Entrust Family Office' : /^Author/i.test(R.sreepriyaRole) ? `Sreepriya N S, writing for ${L.outlet}` : `Sreepriya N S, in ${L.outlet}`)
      : c.kind === 'excerpt' ? `${L.outlet}, ${L.dateLong}` : `Editor’s summary of the ${L.outlet} piece`;
    A.text(attr, { sans: true, max: 22, min: 18, maxLines: 2, weight: 500, fill: pal.muted, x: ML, y: body.bottom + 48, w: W - ML - MR, critical: false });
  } else {
    // detail frame: real metadata only, no new claims
    if (L.family === 'milestone') {
      A.text(String(R.year), { weight: 250, size: 520, fill: pal.primary, x: ML - 30, y: 620, w: 1400, alpha: 0.9, critical: false });
    } else if (L.family === 'journal' && L.logo.mark && L.st.showLogo) {
      const img = L.logo.mark; const h = 760; const w = h * img.naturalWidth / img.naturalHeight;
      A.push({ t: 'logo', img, x: (W - w) / 2 + 60, y: 560, w, h, tone: pal.primary, key: L.logo.key + 'ghostbig', alpha: pal.dark ? 0.16 : 0.1 });
    } else {
      A.text(L.outlet, { italic: true, weight: 300, size: 250, fill: pal.primary, x: ML, y: 760, w: 4000, lh: 0.95, alpha: 0.92, critical: false });
    }
    A.rule(ML, 1360, W - MR, 1360, pal.rule, 1);
    A.text(rec.d.roleLabel, { sans: true, size: 20, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: ML, y: 1388, w: 600 });
    A.text(L.dateLong, { sans: true, size: 20, weight: 500, caps: true, ls: 0.1, fill: pal.muted, x: W - MR - 420, y: 1388, w: 420, align: 'right' });
  }
}

function readFrame(A, L) {
  const { pal, rec } = L; const R = rec.src;
  const cb = contentBottom(L);
  const isJournal = R.collection === 'entrust_journal';
  A.wash({ cx: 140, cy: 360, rx: 520, ry: 150, rot: -0.05, color: pal.wash2, k: 40, alpha: 1, kind: 'stroke' });
  if (isJournal) {
    const w = logoMark(A, L, ML, 262, 80);
    A.text('The Journal', { sans: true, size: 20, weight: 600, caps: true, ls: 0.2, fill: pal.ink, x: ML + (w ? w + 26 : 0), y: 290, w: 400 });
    A.text(`No. ${R.id}`, { sans: true, size: 20, weight: 500, caps: true, ls: 0.16, fill: pal.muted, x: W - MR - 300, y: 290, w: 300, align: 'right' });
  } else folio(A, L, `No. ${R.id}`, 'Sreepriya N S');
  const lab = A.text(L.cta, { sans: true, size: 24, weight: 600, caps: true, ls: 0.16, fill: pal.accent, x: ML, y: 470, w: 800 });
  A.rule(ML, lab.bottom + 26, W - MR, lab.bottom + 26, pal.ink, 1.5);
  const ty = lab.bottom + 92;
  const metaH = 170;
  const hd = A.text(typo(R.title), { max: 80, min: 38, lh: 1.08, w: W - ML - MR, h: cb - metaH - ty, x: ML, y: ty, fill: pal.ink, balance: true, role: 'headline', roleName: 'Source title' });
  const m = A.text(isJournal ? 'Entrust Family Office' : L.outlet, { italic: true, max: 46, min: 30, maxLines: 2, fill: pal.primary, x: ML, y: hd.bottom + 44, w: W - ML - MR, role: 'outlet' });
  A.hit('source', { x: ML, y: m.top, w: m.maxW, h: m.h }, L.url);
  A.text(`${L.dateLong}  ·  ${rec.d.credit}`, { sans: true, max: 22, min: 17, maxLines: 2, weight: 500, fill: pal.muted, x: ML, y: m.bottom + 18, w: W - ML - MR, critical: false });
}

export function resolveVariant(family, st, headlineLen, ctx = {}) {
  if (st.variant === 'a' || st.variant === 'b') return st.variant;
  let v;
  if (family === 'conversation') v = ctx.hasImage ? 'a' : headlineLen > 76 ? 'b' : 'a';
  else if (family === 'index') v = (ctx.entries || 0) >= 4 ? 'a' : 'b';
  else if (family === 'byline') v = headlineLen > 72 ? 'b' : 'a';
  else v = headlineLen > 70 ? 'b' : 'a';
  if (ctx.avoid && ctx.avoid === family + ':' + v) v = v === 'a' ? 'b' : 'a';
  return v;
}

export function frameKinds(n) { return n >= 3 ? ['hook', 'context', 'read'] : n === 2 ? ['hook', 'read'] : ['hook']; }

// L: { rec, st, brand, logo, image, frameKind, frameNo, frames, url, entries, linkTarget, avoid }
export function compose(L) {
  const st = L.st;
  const family = L.family;
  const pal = palette(st.palette, L.brand);
  const frames = L.frames;
  const kind = L.frameKind;
  const hasLink = kind === 'read' || frames === 1;
  const def = defaultSticker(family, L.variant);
  const sticker = clampSticker({ ...def, ...(st.sticker || {}) });
  const rec = L.rec;
  const R = rec.src;
  const Lx = {
    ...L, pal, hasLink, sticker, scale: st.textScale || 1,
    washOpacity: st.washOpacity == null ? 1 : st.washOpacity,
    seedBase: `${R.id}:${st.washSeed || 0}`,
    outlet: typo(L.outletDisplay || R.outlet),
    headline: typo(L.headline),
    dateShort: L.dateShortStr || fmtDateShort(R.date),
    dateLong: L.dateLongStr || fmtDate(R.date),
    cta: L.cta,
  };
  const A = mk(Lx);
  A.push({ t: 'bg', fill: pal.bg });
  if (L.brand.texture && L.brand.textureImg) A.push({ t: 'texture', img: L.brand.textureImg, alpha: L.brand.textureOpacity == null ? 0.35 : L.brand.textureOpacity });
  A.push({ t: 'grain', dark: pal.dark, alpha: L.brand.grain == null ? 1 : L.brand.grain });
  if (kind === 'hook') {
    ({ press: pressLeaf, byline: bylineFolio, journal: entrustJournal, conversation, milestone, index: quietIndex })[family](A, Lx, L.variant);
  } else if (kind === 'context') contextFrame(A, Lx);
  else readFrame(A, Lx);
  if (hasLink) linkZone(A, Lx, L.cta);
  frameCount(A, Lx);
  // sticker collision check (exclude decorative)
  if (hasLink) {
    const s = sticker; const pad = 12;
    for (const b of A.boxes) {
      if (b.role === 'cta' || b.role === 'count') continue;
      if (b.x < s.x + s.w + pad && b.x + b.w > s.x - pad && b.y < s.y + s.h + pad && b.y + b.h > s.y - pad) { A.warnings.push({ code: 'sticker', msg: `The link-sticker area overlaps the ${b.role}. Move the sticker or shorten the text.` }); break; }
    }
  }
  for (const b of A.boxes) {
    if (b.role === 'cta' || b.role === 'logo') continue;
    if (b.y < SAFE_T - 4 || b.y + b.h > SAFE_B + 4) { A.warnings.push({ code: 'safe', msg: `The ${b.role} reaches outside the platform-safe area.` }); break; }
  }
  return { items: A.items, hits: A.hits, warnings: A.warnings, boxes: A.boxes, sticker: hasLink ? sticker : null, pal };
}

export function defaultSticker(family, variant) {
  if (family === 'conversation' && variant === 'b') return { x: 468, y: 1452, w: STICKER_W, h: STICKER_H };
  if (family === 'index') return { x: ML, y: 1452, w: STICKER_W, h: STICKER_H };
  return { x: ML, y: 1452, w: STICKER_W, h: STICKER_H };
}
export function clampSticker(s) {
  return { ...s, w: STICKER_W, h: STICKER_H, x: Math.max(40, Math.min(W - 40 - STICKER_W, s.x)), y: Math.max(1120, Math.min(SAFE_B - STICKER_H, s.y)) };
}

// ---------- renderer ----------
export function draw(ctx, comp, opts = {}) {
  const mode = opts.mode || 'guide';
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  if ('fontKerning' in ctx) ctx.fontKerning = 'normal';
  for (const it of comp.items) {
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    switch (it.t) {
      case 'bg': ctx.fillStyle = it.fill; ctx.fillRect(0, 0, W, H); break;
      case 'texture': {
        const img = it.img; const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        ctx.globalAlpha = it.alpha; ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s); break;
      }
      case 'grain': ctx.globalAlpha = (it.dark ? 0.05 : 0.075) * it.alpha; ctx.globalCompositeOperation = it.dark ? 'screen' : 'multiply'; ctx.drawImage(grainCanvas(), 0, 0); break;
      case 'wash': {
        const wc = washCanvas(it);
        ctx.globalAlpha = Math.max(0, Math.min(1, it.alpha));
        ctx.globalCompositeOperation = comp.pal.dark ? 'source-over' : 'multiply';
        const dw = wc.cw / wc.scale, dh = wc.ch / wc.scale;
        ctx.drawImage(wc.canvas, it.cx - dw / 2, it.cy - dh / 2, dw, dh); break;
      }
      case 'rect': ctx.globalAlpha = it.alpha; ctx.fillStyle = it.fill; ctx.fillRect(it.x, it.y, it.w, it.h); break;
      case 'rule': ctx.globalAlpha = it.alpha; ctx.strokeStyle = it.color; ctx.lineWidth = it.w; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke(); break;
      case 'circle': ctx.globalAlpha = it.alpha; ctx.strokeStyle = it.color; ctx.lineWidth = it.w; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.stroke(); break;
      case 'coverguide': {
        if (mode !== 'guide') break;
        ctx.save(); ctx.setLineDash([14, 10]); ctx.strokeStyle = it.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = it.color; ctx.font = `600 20px ${famStack(opts.sans || 'Schibsted Grotesk', 'sans')}`;
        const t = 'HIGHLIGHT CROP: KEEP ARTWORK INSIDE'; const tw = ctx.measureText(t).width; ctx.fillText(t, it.x - tw / 2, it.y + it.r + 46);
        ctx.restore(); break;
      }
      case 'dot': ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.fill(); break;
      case 'text': {
        if (!it.lines.length) break;
        ctx.globalAlpha = it.alpha; ctx.fillStyle = it.fill; ctx.font = fontStr(it.f, it.size);
        ctx.save();
        if (it.rot) { ctx.translate(it.origin.x, it.origin.y); ctx.rotate(it.rot); }
        for (const ln of it.lines) {
          if (it.ls) { let x = ln.x; for (const ch of ln.s) { ctx.fillText(ch, x, ln.y); x += ctx.measureText(ch).width + it.ls; } }
          else ctx.fillText(ln.s, ln.x, ln.y);
        }
        ctx.restore(); break;
      }
      case 'logo': {
        const src = it.tone ? tinted(it.img, it.tone, it.key) : it.img;
        ctx.globalAlpha = it.alpha; ctx.drawImage(src, it.x, it.y, it.w, it.h); break;
      }
      case 'image': {
        const img = treated(it.img, it.treatment || 'natural', comp.pal, it.key);
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        const z = Math.max(1, it.zoom || 1);
        const s = Math.max(it.w / iw, it.h / ih) * z;
        const dw = iw * s, dh = ih * s;
        const ox = (it.w - dw) * (it.cx == null ? 0.5 : it.cx), oy = (it.h - dh) * (it.cy == null ? 0.5 : it.cy);
        ctx.save(); ctx.beginPath(); ctx.rect(it.x, it.y, it.w, it.h); ctx.clip();
        ctx.drawImage(img, it.x + ox, it.y + oy, dw, dh); ctx.restore(); break;
      }
      case 'sticker': {
        if (mode !== 'guide') break;
        ctx.save();
        ctx.fillStyle = rgba(it.color, 0.12); ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.setLineDash([12, 9]); ctx.strokeStyle = it.color; ctx.lineWidth = 3; ctx.strokeRect(it.x + 1.5, it.y + 1.5, it.w - 3, it.h - 3);
        ctx.setLineDash([]);
        ctx.fillStyle = it.color; ctx.font = `600 19px ${famStack(opts.sans || 'Schibsted Grotesk', 'sans')}`;
        const t = '[ADD INSTAGRAM LINK STICKER HERE]'; let tw = 0; for (const ch of t) tw += ctx.measureText(ch).width + 1.2;
        let x = it.x + (it.w - tw) / 2; for (const ch of t) { ctx.fillText(ch, x, it.y + it.h / 2 - 4); x += ctx.measureText(ch).width + 1.2; }
        ctx.font = `400 18px ${famStack(opts.sans || 'Schibsted Grotesk', 'sans')}`;
        const d = it.domain || 'link required'; const dw2 = ctx.measureText(d).width;
        ctx.fillText(d, it.x + (it.w - dw2) / 2, it.y + it.h / 2 + 26);
        ctx.restore(); break;
      }
      default: break;
    }
  }
  ctx.restore();
}

// ---------- highlight covers ----------
// Instagram shows a highlight cover as a small circle cut from the centre of a 9:16 image.
// Artwork lives inside a central circle; nothing important sits outside it.
export const COVER_R = 400;
export const COVER_STYLES = [
  { key: 'initial', name: 'Initial' },
  { key: 'word', name: 'Word' },
  { key: 'mark', name: 'Entrust mark' },
  { key: 'numeral', name: 'Numeral' },
];
export function composeCover(cv, brand, logo) {
  const pal = palette(cv.palette || 'paper', brand);
  const items = [];
  const cx = W / 2, cy = H / 2;
  const SERIF = { stack: famStack(brand.fonts.serif, 'serif') }, SANS = { stack: famStack(brand.fonts.sans, 'sans') };
  const ground = cv.ground === 'solid' ? (pal.dark ? pal.bg : pal.panel) : pal.bg;
  const onGround = cv.ground === 'solid' && !pal.dark ? pal.onPanel : pal.ink;
  const accentOn = cv.ground === 'solid' && !pal.dark ? pal.onPanel : pal.primary;
  items.push({ t: 'bg', fill: ground });
  items.push({ t: 'grain', dark: pal.dark || cv.ground === 'solid', alpha: brand.grain == null ? 1 : brand.grain });
  if (cv.showWash !== false) {
    const seed = hashStr('cover:' + cv.id + ':' + (cv.seed || 0));
    const a = (cv.washOpacity == null ? 1 : cv.washOpacity) * (pal.dark || cv.ground === 'solid' ? 0.5 : 0.95) * (brand.washOpacity == null ? 1 : brand.washOpacity);
    items.push({ t: 'wash', cx: cx + 20, cy: cy - 10, rx: 300, ry: 280, rot: 0.3, color: cv.ground === 'solid' && !pal.dark ? pal.wash1 : pal.wash1, color2: pal.wash2, seed, alpha: a, kind: 'bloom' });
  }
  if (cv.ring) items.push({ t: 'circle', x: cx, y: cy, r: 330, color: onGround, w: 2, alpha: 0.7 });
  const label = String(cv.label || '').trim();
  const fitOne = (s, f, max, wmax) => { let size = max; while (size > 20 && measure(s, f, size, 0) > wmax) size -= 2; return size; };
  if (cv.style === 'mark' && logo && logo.mark) {
    const img = logo.mark; const h = 300; const w = h * img.naturalWidth / img.naturalHeight;
    items.push({ t: 'logo', img, x: cx - w / 2, y: cy - h / 2 - 10, w, h, tone: cv.ground === 'solid' || pal.dark ? onGround : null, key: (logo.key || 'd') + 'cover', alpha: 1 });
  } else if (cv.style === 'word') {
    const f = { ...SANS, weight: 600, style: 'normal' };
    const s = label.toUpperCase();
    let size = 92; const ls = 0.14;
    while (size > 30 && measure(s, f, size, size * ls) > 560) size -= 2;
    const w = measure(s, f, size, size * ls);
    items.push({ t: 'text', f, size, ls: size * ls, lines: [{ s, x: cx - w / 2, y: cy + size * 0.36 }], fill: onGround, alpha: 1 });
  } else {
    const f = { ...SERIF, weight: cv.style === 'numeral' ? 300 : 400, style: cv.style === 'numeral' ? 'normal' : 'italic' };
    const s = cv.style === 'numeral' ? (cv.numeral || '01') : (cv.initial || label.charAt(0) || 'S');
    const size = fitOne(s, f, cv.style === 'numeral' ? 380 : 460, 540);
    const w = measure(s, f, size, 0);
    items.push({ t: 'text', f, size, ls: 0, lines: [{ s, x: cx - w / 2 - (f.style === 'italic' ? size * 0.03 : 0), y: cy + size * 0.33 }], fill: accentOn, alpha: 1 });
  }
  items.push({ t: 'coverguide', x: cx, y: cy, r: COVER_R, color: pal.accent });
  return { items, pal, hits: [], warnings: [], boxes: [], sticker: null };
}
