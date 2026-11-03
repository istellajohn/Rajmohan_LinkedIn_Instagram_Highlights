// Files, clipboard, zip. Downloads go through the viewer's `downloads` capability
// when present (the artifact frame blocks direct downloads); a plain anchor is the
// fallback outside the viewer.

let dlPromise = null;
export function downloadsCap() {
  if (!dlPromise) {
    dlPromise = (window.claude && typeof window.claude.use === 'function')
      ? window.claude.use('downloads').catch(() => null)
      : Promise.resolve(null);
  }
  return dlPromise;
}

export async function saveFile(filename, data) {
  const dl = await downloadsCap();
  if (dl) {
    try { const r = await dl.save({ filename, data }); return { ok: true, status: r && r.status }; }
    catch (e) { return { ok: false, code: (e && e.code) || 'unavailable', message: (e && e.message) || '' }; }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith('.json') ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true, status: 'saved-direct' };
  } catch (e) { return { ok: false, code: 'unavailable', message: String(e) }; }
}

export function copyText(text) {
  // must be called inside the click handler
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
  } catch (e) { /* fall through */ }
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
// store-only zip
export async function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = []; let offset = 0;
  const now = new Date();
  const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  for (const f of files) {
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer());
    const name = enc.encode(f.name); const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}

export function readFileAs(file, how) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('Could not read the file'));
    if (how === 'text') r.readAsText(file); else if (how === 'buffer') r.readAsArrayBuffer(file); else r.readAsDataURL(file);
  });
}

export function store(key, val) {
  try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { return val === undefined ? null : false; }
}
