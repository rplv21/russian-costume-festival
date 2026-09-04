import os
import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_LOGOS = os.path.join(ROOT, "public", "logos")
OUT_IMAGES = os.path.join(ROOT, "public", "images")
os.makedirs(OUT_LOGOS, exist_ok=True)
os.makedirs(OUT_IMAGES, exist_ok=True)

JOBS = [
    ("Минкульт РФ.pdf", os.path.join(OUT_LOGOS, "minkult-rf.png"), 6),
    ("ЯОДНТ. Лого.pdf", os.path.join(OUT_LOGOS, "yaodnt.png"), 6),
    ("Орнамент.pdf", os.path.join(OUT_IMAGES, "ornament.png"), 4),
]

for fname, out_path, zoom in JOBS:
    src = os.path.join(ROOT, fname)
    doc = fitz.open(src)
    page = doc[0]
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=True)
    pix.save(out_path)
    print(fname, "->", out_path, pix.width, pix.height, os.path.getsize(out_path) / 1024, "KB")
    doc.close()
