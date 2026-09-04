import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MAPPING = {
    "аккредитацию": "zayavka-akkreditatsiya-smi.docx",
    "деловой": "zayavka-delovaya-chast.docx",
    "ярмарке": "zayavka-vystavka-yarmarka.docx",
    "согласие": "soglasie-personalnye-dannye.docx",
}
# the plain "participation" application form has none of the above keywords
GENERIC_TARGET = "zayavka-uchastie.docx"

out_dir = os.path.join(ROOT, "public", "documents")
os.makedirs(out_dir, exist_ok=True)

for fname in os.listdir(ROOT):
    if not fname.lower().endswith(".docx"):
        continue
    lower = fname.lower()
    target = None
    for key, val in MAPPING.items():
        if key in lower:
            target = val
            break
    if target is None:
        target = GENERIC_TARGET
    src = os.path.join(ROOT, fname)
    dst = os.path.join(out_dir, target)
    shutil.copy(src, dst)
    print("copied ->", target)
