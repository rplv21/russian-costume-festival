"""
Сжимает фото фестиваля 2024 года (РК.2024/*.jpg, оригиналы с камеры, ~1-5 МБ каждое)
в два веб-размера: миниатюры для сетки и полноразмерные версии для лайтбокса/скачивания.
Запускать из корня проекта: python scripts/resize-gallery-2024.py
"""
import os
from PIL import Image, ImageOps

SRC_DIR = "РК.2024"
THUMB_DIR = "public/gallery/2024/thumb"
FULL_DIR = "public/gallery/2024/full"

THUMB_WIDTH = 480
FULL_WIDTH = 1920
THUMB_QUALITY = 72
FULL_QUALITY = 82

os.makedirs(THUMB_DIR, exist_ok=True)
os.makedirs(FULL_DIR, exist_ok=True)

files = sorted(f for f in os.listdir(SRC_DIR) if f.lower().endswith(".jpg"))
print(f"Найдено {len(files)} фото")

total_thumb = 0
total_full = 0

for i, name in enumerate(files, 1):
    src_path = os.path.join(SRC_DIR, name)
    img = ImageOps.exif_transpose(Image.open(src_path)).convert("RGB")
    w, h = img.size

    out_name = f"{i:03d}.jpg"

    thumb_w = min(THUMB_WIDTH, w)
    thumb_h = round(h * thumb_w / w)
    thumb = img.resize((thumb_w, thumb_h), Image.LANCZOS)
    thumb_path = os.path.join(THUMB_DIR, out_name)
    thumb.save(thumb_path, "JPEG", quality=THUMB_QUALITY, optimize=True)
    total_thumb += os.path.getsize(thumb_path)

    full_w = min(FULL_WIDTH, w)
    full_h = round(h * full_w / w)
    full = img.resize((full_w, full_h), Image.LANCZOS) if full_w < w else img
    full_path = os.path.join(FULL_DIR, out_name)
    full.save(full_path, "JPEG", quality=FULL_QUALITY, optimize=True)
    total_full += os.path.getsize(full_path)

    if i % 50 == 0 or i == len(files):
        print(f"  {i}/{len(files)}")

print(f"Готово. Миниатюры: {total_thumb / 1024 / 1024:.1f} МБ, полные: {total_full / 1024 / 1024:.1f} МБ, всего: {(total_thumb + total_full) / 1024 / 1024:.1f} МБ")
