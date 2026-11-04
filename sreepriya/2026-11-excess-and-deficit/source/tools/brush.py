"""Dry-brush strokes and translucent glazes, procedurally.

stroke(): a single sweep of a flat brush. Horizontal bristle streaks, a
slightly heavier attack where the brush lands, ragged paper-tooth edges,
and an optional dry tail where bristles run out of pigment.

glaze(): a flat transparent wash in a simple shape (rect / circle) with a
hand-wobbled edge, a faint pigment rim and gentle uneven settling.
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from wc import value_noise, hexrgb  # noqa: E402


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0 + 1e-9), 0, 1)
    return t * t * (3 - 2 * t)


def streaks(W, H, seed, along=260, across=3.2):
    """Noise stretched along x: reads as bristle tracks."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((H, W), np.float32)
    for k, (a, c, w) in enumerate([(along, across, .6), (along / 2.5, across * 2.5, .4)]):
        gw, gh = max(2, int(W / a)), max(2, int(H / c))
        g = (rng.random((gh, gw)) * 255).astype(np.uint8)
        acc += np.asarray(Image.fromarray(g).resize((W, H), Image.BICUBIC), np.float32) / 255 * w
    return acc


def stroke(W, H, color, seed, x0=20, length=None, thick=None, dry_from=None,
           density=0.62, tilt=0.0, wobble=0.05):
    length = length or W - 2 * x0
    thick = thick or H * 0.7
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    t = (xx - x0) / length
    n1 = value_noise(W, 1, 90, 3, seed)[0]           # slow drift of the centre line
    n2 = value_noise(W, 1, 25, 3, seed + 1)[0]       # ragged thickness
    cy = H / 2 + (n1 - .5) * thick * wobble * 2 + (xx - W / 2) * tilt
    attack = smoothstep(0, 0.035, t)
    tail = smoothstep(1.0, 0.965, t)
    half = thick / 2 * (0.82 + 0.18 * attack) * (1 + 0.07 * (n2 - .5) * 2)
    half = half * (0.9 + 0.1 * tail)
    v = np.abs(yy - cy) / half
    grain = 0.55 * value_noise(W, H, 9, 3, seed + 2) + 0.45 * value_noise(W, H, 2.2, 2, seed + 12)
    tooth = value_noise(W, H, 6, 2, seed + 3)
    edge = smoothstep(1.0, 0.86, v + 0.16 * (grain - .5))
    edge *= smoothstep(-0.01, 0.012, t + 0.01 * (grain - .5)) * smoothstep(1.0, 0.985, t + 0.02 * (grain - .5))
    S = streaks(W, H, seed + 4)
    low = value_noise(W, H, 160, 3, seed + 5)
    press = value_noise(W, 1, 240, 2, seed + 6)[0]
    dens = density * (0.70 + 0.30 * low) * (0.80 + 0.34 * press) + 0.30 * (S - .5)
    dens += 0.12 * np.exp(-np.clip(t, 0, None) / 0.05)           # heavier where the brush lands
    dens += 0.10 * smoothstep(0.72, 0.98, v) * edge               # faint pigment line at the edges
    cover = np.ones_like(dens)
    # light dry-brush speckle along the edges even on a wet stroke
    cover *= smoothstep(0.12, 0.26, tooth + 0.62 - smoothstep(0.8, 1.0, v) * 0.55)
    if dry_from is not None:
        dry = np.clip((t - dry_from) / (1 - dry_from), 0, 1)
        score = S * 0.75 + tooth * 0.25
        cover *= smoothstep(dry * 1.05 - 0.02, dry * 1.05 + 0.10, score)
        dens *= 1 - 0.35 * dry
    a = np.clip(dens * cover * edge, 0, 1)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255
    r, g, b = color
    rgb = np.stack([np.full((H, W), r), np.full((H, W), g), np.full((H, W), b)], -1)
    return Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), "RGBA")


def glaze(W, H, color, seed, shape="rect", pad=14, alpha=0.5, radius=0):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dn = (value_noise(W, H, 55, 3, seed) - .5) * 7 + (value_noise(W, H, 12, 2, seed + 9) - .5) * 2.2
    if shape == "circle":
        cx, cy, R = W / 2, H / 2, min(W, H) / 2 - pad
        sdf = np.hypot(xx - cx, yy - cy) - R
    else:
        hx, hy = W / 2 - pad, H / 2 - pad
        qx, qy = np.abs(xx - W / 2) - hx + radius, np.abs(yy - H / 2) - hy + radius
        sdf = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - radius
    sdf = sdf + dn
    inside = smoothstep(1.2, -1.2, sdf)
    rim = np.exp(-np.abs(np.minimum(sdf, 0)) / 2.6) * inside
    low = value_noise(W, H, 120, 3, seed + 1)
    ang = (seed * 1.7) % 6.283
    grad = ((xx / W - .5) * math.cos(ang) + (yy / H - .5) * math.sin(ang))
    gran = value_noise(W, H, 3, 2, seed + 2)
    dens = alpha * (0.86 + 0.26 * low + 0.22 * grad) * (0.9 + 0.2 * gran) + 0.16 * rim
    a = np.clip(dens * inside, 0, 1)
    r, g, b = color
    rgb = np.stack([np.full((H, W), r), np.full((H, W), g), np.full((H, W), b)], -1)
    return Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), "RGBA")


if __name__ == "__main__":
    OUT = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    C = {k: hexrgb(v) for k, v in {
        "saffron": "#E3A23B", "blush": "#EBAFC2", "coral": "#E58A6E", "indigo": "#35558A",
        "teal": "#3F8C8C", "sap": "#7FA05E", "sand": "#D9BC92", "mauve": "#B48CA0",
        "sky": "#8FB3CF", "ochre": "#C98E3A",
    }.items()}
    # ---- Option 1: brush strokes
    stroke(1100, 200, C["blush"], 101, x0=14, length=1060, thick=158, density=.42).save(f"{OUT}/st-excess-blush.png")
    stroke(1100, 200, C["saffron"], 102, x0=14, length=1050, thick=126, density=.62, tilt=-.008).save(f"{OUT}/st-excess-saffron.png")
    stroke(1100, 200, C["indigo"], 103, x0=14, length=700, thick=132, density=.6, dry_from=.3).save(f"{OUT}/st-deficit-indigo.png")
    # ---- Option 2: glazes
    g = [("sand", 11), ("sap", 12), ("blush", 13), ("sky", 14), ("saffron", 15), ("mauve", 16), ("teal", 17), ("sand", 18)]
    for i, (k, s) in enumerate(g):
        glaze(250, 180, C[k], s, alpha=.42).save(f"{OUT}/gl-{i}.png")
    glaze(300, 230, C["saffron"], 31, alpha=.5).save(f"{OUT}/gl-ex-1.png")
    glaze(280, 210, C["coral"], 32, alpha=.42).save(f"{OUT}/gl-ex-2.png")
    glaze(300, 300, C["teal"], 33, shape="circle", alpha=.42).save(f"{OUT}/gl-ex-3.png")
    glaze(260, 200, C["indigo"], 34, alpha=.4).save(f"{OUT}/gl-ex-4.png")
    glaze(240, 240, C["blush"], 35, shape="circle", alpha=.5).save(f"{OUT}/gl-ex-5.png")
    print("ok")
