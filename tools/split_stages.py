"""Split each painted stage into a slow-moving backdrop and a floor.

    python tools/split_stages.py

Sources live in art-src/stages (not shipped). Each is upscaled 2x (flat cel
shading survives Lanczos well), cut at the line where the floor meets the
parapet, and written to assets/stage/<name>-back.webp and -floor.webp.
The floor rows below are measured on the 1915x821 sources.
"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
STAGES = {"chinatown": ("stage-1.png", 607), "oldtown": ("stage-2.png", 650), "harbor": ("stage-3.png", 622), "billboard": ("stage-4.png", 635)}
UP = 2

for name, (src, floor) in STAGES.items():
    im = Image.open(ROOT / "art-src" / "stages" / src).convert("RGB")
    im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    cut = floor * UP
    out = ROOT / "assets" / "stage"
    im.crop((0, 0, im.width, cut)).save(out / f"{name}-back.webp", "WEBP", quality=84, method=6)
    im.crop((0, cut, im.width, im.height)).save(out / f"{name}-floor.webp", "WEBP", quality=84, method=6)
    print(name, im.size, "cut", cut, "fighters", round(im.height * 0.86))
