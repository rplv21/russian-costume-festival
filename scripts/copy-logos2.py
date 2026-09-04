import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGOS = os.path.join(ROOT, "public", "logos")
os.makedirs(LOGOS, exist_ok=True)

for fname in os.listdir(ROOT):
    lower = fname.lower()
    if lower.startswith("герб"):
        shutil.copy(os.path.join(ROOT, fname), os.path.join(LOGOS, "gerb-yao.svg"))
        print("copied gerb-yao.svg")
    elif "пушкин" in lower:
        shutil.copy(os.path.join(ROOT, fname), os.path.join(LOGOS, "pushkinskaya-karta.png"))
        print("copied pushkinskaya-karta.png")
