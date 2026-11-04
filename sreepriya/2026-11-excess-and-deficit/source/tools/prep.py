import sys, random
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
sys.path.insert(0, sys.argv[1])
import wc
I, OUT = sys.argv[2], sys.argv[3]
# Portrait: crop full-length, mask with a watercolour-shaped alpha
im = Image.open(f"{I}/3.webp").convert("RGB")
crop = im.crop((40, 150, 760, 1280))  # 720 x 1130
W, H = crop.size
rng = random.Random(21)
pts = wc.blob_polygon(W/2, H/2, W*0.47, H*0.47, 14, rng)
a = wc.render(pts, (W, H), (0, 0, 0), seed=21, layers=40, per_layer=.06,
              base_var=.16, layer_var=.14, edge=0, gran=0, density_noise=.2)
alpha = np.asarray(a, np.float32)[..., 3] / 255
alpha = np.clip(alpha * 3.2, 0, 1)
alpha = np.asarray(Image.fromarray((alpha*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32)/255
# warm the photo a touch, keep it honest
crop = ImageEnhance.Color(crop).enhance(1.04)
rgba = np.dstack([np.asarray(crop), (alpha*255).astype(np.uint8)])
Image.fromarray(rgba, "RGBA").save(f"{OUT}/portrait.png")
# Logo: paper version (white -> transparent) and reversed (blush on burgundy)
lg = Image.open(f"{I}/2.png").convert("RGBA")
arr = np.asarray(lg, np.float32)
lum = arr[..., :3].mean(-1) / 255
alpha = np.clip((1 - lum) * 1.6, 0, 1) * (arr[..., 3] / 255)
paper = np.dstack([arr[..., :3], alpha*255]).astype(np.uint8)
Image.fromarray(paper, "RGBA").save(f"{OUT}/logo.png")
rev = np.dstack([np.full(lum.shape, 246), np.full(lum.shape, 226), np.full(lum.shape, 232), alpha*255]).astype(np.uint8)
Image.fromarray(rev, "RGBA").save(f"{OUT}/logo-rev.png")
print("prep ok")
