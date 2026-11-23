import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from brush import stroke
from wc import hexrgb
O, IMG = sys.argv[1], sys.argv[2]
C = {k: hexrgb(v) for k, v in {
    "saffron": "#E3A23B", "blush": "#EBAFC2", "indigo": "#35558A", "teal": "#3F8C8C",
    "sap": "#7FA05E", "sand": "#D9BC92", "mauve": "#B48CA0", "sky": "#8FB3CF"}.items()}
# small dabs: list bullets and number badges
for i, k in enumerate(["saffron", "indigo", "teal", "sap", "mauve", "blush", "sand", "sky"]):
    stroke(260, 120, C[k], 200 + i, x0=12, length=230, thick=78, density=.6).save(f"{O}/dab-{k}.png")
# column-header strokes (slide 10)
stroke(560, 130, C["saffron"], 221, x0=12, length=530, thick=92, density=.5).save(f"{O}/hd-saffron.png")
stroke(560, 130, C["indigo"], 222, x0=12, length=530, thick=92, density=.42).save(f"{O}/hd-indigo.png")
# highlight sweeps behind a phrase (slide 6)
stroke(1000, 170, C["sand"], 231, x0=14, length=960, thick=118, density=.42, tilt=-.004).save(f"{O}/hl-sand.png")
stroke(1000, 170, C["saffron"], 232, x0=14, length=960, thick=104, density=.30, tilt=.003).save(f"{O}/hl-saffron.png")
# wide bands (slide 8)
stroke(1200, 300, C["blush"], 241, x0=14, length=1170, thick=250, density=.42).save(f"{O}/band-blush.png")
stroke(1200, 300, C["sand"], 242, x0=14, length=1170, thick=220, density=.36, tilt=.01).save(f"{O}/band-sand.png")
# held strokes (slide 9) and balanced ledger (slide 11): long, cropped by a container
for i, k in enumerate(["saffron", "teal", "sap", "indigo"]):
    stroke(1200, 170, C[k], 251 + i, x0=14, length=1170, thick=118, density=.55, tilt=(-1) ** i * .004).save(f"{O}/long-{k}.png")
stroke(1200, 200, C["blush"], 261, x0=14, length=1170, thick=150, density=.38).save(f"{O}/long-blush.png")
# sand sweep behind the portrait (slide 2)
stroke(900, 260, C["sand"], 271, x0=14, length=870, thick=200, density=.4).save(f"{O}/sweep-sand.png")
stroke(900, 260, C["sap"], 272, x0=14, length=870, thick=150, density=.38, tilt=-.01).save(f"{O}/sweep-sap.png")
# portrait painted on with a brush: vertical stroke alpha as the mask
im = Image.open(f"{IMG}/3.webp").convert("RGB").crop((40, 150, 760, 1280))  # 720 x 1130
W, H = im.size
m = stroke(H + 40, W + 60, (0, 0, 0), 281, x0=20, length=H, thick=W * 1.02, density=.9, dry_from=.9)
a = np.asarray(m, np.float32)[..., 3] / 255
a = np.clip(a * 2.4, 0, 1)
a = np.rot90(a, 1)[20:20 + H, 30:30 + W] if np.rot90(a, 1).shape[0] >= H + 20 else np.rot90(a, 1)[:H, :W]
a = a[:H, :W]
im = ImageEnhance.Color(im).enhance(1.03)
Image.fromarray(np.dstack([np.asarray(im), (a * 255).astype(np.uint8)]), "RGBA").save(f"{O}/portrait.png")
print("gen2 ok")
