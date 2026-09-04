import os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")

DOLLS = {
    "doll-main": "Кукла. Основная.png",
    "doll-ceramic": "Кукла. Керамика.png",
    "doll-glass": "Кукла. Стекло.png",
    "doll-plush": "Кукла. Плюшевая.png",
}

os.makedirs(os.path.join(PUBLIC, "dolls"), exist_ok=True)
for slug, fname in DOLLS.items():
    path = os.path.join(ROOT, fname)
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = im.size
    max_h = 1500
    if h > max_h:
        scale = max_h / h
        im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    out = os.path.join(PUBLIC, "dolls", slug + ".webp")
    im.save(out, "WEBP", quality=88, method=6)
    print(slug, im.size, os.path.getsize(out) / 1024, "KB")

# Poster РК2025
poster_path = os.path.join(ROOT, "РК2025.jpg")
im = Image.open(poster_path)
im = ImageOps.exif_transpose(im).convert("RGB")
w, h = im.size
max_w = 1200
if w > max_w:
    scale = max_w / w
    im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
os.makedirs(os.path.join(PUBLIC, "images"), exist_ok=True)
out = os.path.join(PUBLIC, "images", "poster-2025.jpg")
im.save(out, "JPEG", quality=85, optimize=True)
print("poster-2025", im.size, os.path.getsize(out) / 1024, "KB")
