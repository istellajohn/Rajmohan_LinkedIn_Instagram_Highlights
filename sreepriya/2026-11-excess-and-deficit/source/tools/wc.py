"""Procedural watercolour generator.

Layered polygon deformation (stacked translucent, recursively deformed
polygons) plus pigment-edge darkening, granulation and paper texture.
Outputs transparent PNGs meant to be multiplied over paper.
"""
import math, random, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "assets"
os.makedirs(OUT, exist_ok=True)


def value_noise(w, h, scale, octaves=4, seed=0):
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    s = scale
    for _ in range(octaves):
        gw, gh = max(2, int(w / s)), max(2, int(h / s))
        g = (rng.random((gh, gw)) * 255).astype(np.uint8)
        im = Image.fromarray(g).resize((w, h), Image.BICUBIC)
        acc += np.asarray(im, np.float32) / 255 * amp
        tot += amp
        amp *= 0.5
        s /= 2
    return acc / tot


def deform(pts, depth, var, rng):
    for _ in range(depth):
        out = []
        n = len(pts)
        for i in range(n):
            a = pts[i]
            b = pts[(i + 1) % n]
            out.append(a)
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            mx += rng.gauss(0, L * var)
            my += rng.gauss(0, L * var)
            out.append((mx, my))
        pts = out
        var *= 0.62
    return pts


def blob_polygon(cx, cy, rx, ry, sides, rng, rot=0.0):
    return [
        (cx + rx * math.cos(rot + 2 * math.pi * i / sides),
         cy + ry * math.sin(rot + 2 * math.pi * i / sides))
        for i in range(sides)
    ]


def render(shape_pts, size, color, layers=40, base_var=0.34, layer_var=0.24,
           per_layer=0.032, seed=1, edge=0.5, gran=0.14, bloom=0.0,
           density_noise=0.75):
    W, H = size
    rng = random.Random(seed)
    base = deform(shape_pts, 3, base_var, rng)
    acc = np.zeros((H, W), np.float32)
    tex_big = value_noise(W, H, 260, 3, seed + 7)
    for k in range(layers):
        poly = deform(base, 4, layer_var, rng)
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).polygon(poly, fill=255)
        m = np.asarray(m, np.float32) / 255
        # each layer gets its own patchy density so pigment pools unevenly
        if k % 5 == 0:
            tex = value_noise(W, H, rng.choice([90, 140, 200]), 3, seed * 100 + k)
        a = per_layer * (1 - density_noise + density_noise * 2 * tex)
        acc = acc + a * m * (1 - acc)
    acc *= (0.55 + 0.9 * tex_big)
    acc = np.clip(acc, 0, 1)
    # pigment migrates to the drying edge
    im = Image.fromarray((acc * 255).astype(np.uint8))
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
    rim = np.clip(acc - blur, 0, 1)
    rim = np.asarray(Image.fromarray((np.clip(rim * 6, 0, 1) * 255).astype(np.uint8))
                     .filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
    rim *= np.clip(value_noise(W, H, 60, 3, seed + 17) * 2.2 - 0.5, 0, 1)
    # backrun / cauliflower bloom: lighter interior blotches with dark borders
    if bloom > 0:
        bn = value_noise(W, H, 70, 3, seed + 31)
        hole = np.clip((bn - 0.58) * 6, 0, 1) * (acc > 0.15)
        hb = np.asarray(Image.fromarray((hole * 255).astype(np.uint8))
                        .filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
        ring = np.clip(hb * (1 - hb) * 4, 0, 1)
        acc = acc * (1 - bloom * 0.6 * hb) + bloom * 0.25 * ring * (acc > 0.05)
    acc = np.asarray(Image.fromarray((np.clip(acc,0,1) * 255).astype(np.uint8))
                     .filter(ImageFilter.GaussianBlur(1.6)), np.float32) / 255
    grain = value_noise(W, H, 7, 2, seed + 3)
    alpha = acc * (1 + edge * rim * 1.6)
    alpha *= (1 - gran) + gran * 2 * grain
    alpha = np.clip(alpha, 0, 1)
    r, g, b = color
    dark = 1 - 0.35 * rim  # edges slightly deeper in tone
    rgb = np.stack([np.full((H, W), r) * dark, np.full((H, W), g) * dark,
                    np.full((H, W), b) * dark], -1)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def paper(W=1080, H=1350, seed=11, tint=(248, 244, 237)):
    n1 = value_noise(W, H, 2, 2, seed)
    n2 = value_noise(W, H, 40, 4, seed + 1)
    n3 = value_noise(W, H, 400, 2, seed + 2)
    v = 1 - 0.045 * n1 - 0.03 * n2 - 0.025 * n3
    # faint cold-press tooth
    rgb = np.stack([tint[0] * v, tint[1] * v, tint[2] * v], -1)
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")


def blob(name, w, h, color, seed, sides=10, inset=0.18, **kw):
    rng = random.Random(seed)
    cx, cy = w / 2, h / 2
    pts = blob_polygon(cx, cy, w * (0.5 - inset), h * (0.5 - inset), sides, rng,
                       rot=rng.random() * 6.28)
    render(pts, (w, h), hexrgb(color), seed=seed, **kw).save(f"{OUT}/{name}.png")


def wash(name, w, h, color, seed, pad=0.12, **kw):
    """Loose rectangular wash (a background swipe of the brush)."""
    rng = random.Random(seed)
    px, py = w * pad, h * pad
    pts = [(px, py), (w * .5, py * .8), (w - px, py), (w - px * .8, h * .5),
           (w - px, h - py), (w * .5, h - py * .8), (px, h - py), (px * .8, h * .5)]
    render(pts, (w, h), hexrgb(color), seed=seed, **kw).save(f"{OUT}/{name}.png")


if __name__ == "__main__":
    paper().save(f"{OUT}/paper.jpg", quality=94)
    paper(seed=12, tint=(246, 240, 232)).save(f"{OUT}/paper-warm.jpg", quality=94)
    # Brand anchors (as pigments): burgundy #600020, wine #4F1026, tan #A87B51,
    # mauve #B78F9D, sand #CEB59E, blush #EBC8D6.
    # Supporting pigments: rose madder, sap green, indigo, saffron ochre.
    P = {
        "burgundy": "#7A0F2E", "rose": "#C2456A", "blush": "#E9A9BF",
        "mauve": "#A97C8E", "tan": "#B0804F", "sand": "#D8B98F",
        "ochre": "#E0A43A", "sap": "#6E8F55", "leaf": "#93AE6E",
        "indigo": "#3E5C86", "teal": "#4F8C8A", "wine": "#4F1026",
    }
    # Cover: the overflowing pool (excess) and the barely-tinted pool (deficit)
    blob("excess-a", 900, 900, P["rose"], 3, layers=52, per_layer=.07, bloom=.6, base_var=.5)
    blob("excess-b", 760, 760, P["burgundy"], 5, layers=40, per_layer=.06, base_var=.48)
    blob("excess-c", 620, 620, P["ochre"], 9, layers=36, per_layer=.05, base_var=.55)
    blob("deficit-a", 520, 520, P["indigo"], 13, layers=26, per_layer=.025, inset=.30, edge=.8)
    # General-purpose blooms
    for i, (k, c) in enumerate(P.items()):
        blob(f"bloom-{k}", 700, 700, c, 40 + i, layers=44, per_layer=.06, bloom=.45)
    # Background washes
    wash("wash-blush", 1200, 700, P["blush"], 71, layers=40, per_layer=.05, base_var=.2, layer_var=.22)
    wash("wash-sand", 1200, 700, P["sand"], 72, layers=40, per_layer=.05, base_var=.2, layer_var=.22)
    wash("wash-sap", 1200, 700, P["leaf"], 73, layers=40, per_layer=.05, base_var=.2, layer_var=.22)
    wash("wash-indigo", 1200, 700, P["indigo"], 74, layers=40, per_layer=.045, base_var=.2, layer_var=.22)
    wash("wash-burgundy", 1200, 1500, P["burgundy"], 75, layers=50, per_layer=.08, base_var=.12, layer_var=.18, pad=.06)
    wash("wash-rose", 1200, 700, P["rose"], 76, layers=40, per_layer=.05, base_var=.2, layer_var=.22)
    wash("wash-mauve", 1200, 700, P["mauve"], 77, layers=40, per_layer=.05, base_var=.2, layer_var=.22)
    wash("wash-ochre", 1200, 700, P["ochre"], 78, layers=40, per_layer=.05, base_var=.2, layer_var=.22)
    print("done")
