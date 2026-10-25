"""Cut chroma-green sprite sheets into one packed atlas per fighter.

    python tools/cut_sprites.py            # every fighter found in assets/sprites/src
    python tools/cut_sprites.py volt       # one fighter

Each sheet (in art-src/sprites, not shipped) is a 4x2 or 2x2 grid of poses on flat #00FF00. Poses are found as
connected blobs (not grid cells, since a sweep or a kick may reach across a
cell edge), keyed to alpha with the green spill removed, trimmed, and packed
into `assets/sprites/<id>.webp` with `<id>.json` holding each frame's rect and
its anchor: the bottom and the point midway between the feet, so a punch
extends forward from where the fighter actually stands.

`tools/sprite-anchors.json` can override any anchor by hand, and a contact
sheet with the anchors drawn on goes to `art-src/check-<id>.png`.
"""
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "sprites"
OUT = ROOT / "assets" / "sprites"
CHECK = ROOT / "art-src"

SHEETS = {
    "a": ["idle", "walk", "crouch", "jump", "jab", "kick", "uppercut", "sweep"],
    "b": ["block", "crouchBlock", "hit", "down", "special", "flykick", "win", "dizzy"],
    "c": ["underwear", "tumble", "charred", "getup"],
}
DOWN = 4  # blob search runs on a 4x smaller mask


def key(img):
    """Chroma-key flat green to alpha and pull green spill out of the edges."""
    a = np.asarray(img.convert("RGB"), dtype=np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dom = g - np.maximum(r, b)
    alpha = np.clip(1 - (dom - 28) / (110 - 28), 0, 1)
    edge = alpha < 0.999
    g2 = np.where(edge & (dom > 0), np.maximum(r, b), g)
    rgb = np.stack([r, g2, b], -1)
    return np.dstack([rgb, alpha * 255]).astype(np.uint8)


def blobs(alpha):
    """Connected components of the opaque mask, on a downsampled grid."""
    h, w = alpha.shape
    small = alpha[: h // DOWN * DOWN, : w // DOWN * DOWN].reshape(h // DOWN, DOWN, w // DOWN, DOWN).max(axis=(1, 3)) > 128
    lab = np.zeros(small.shape, dtype=np.int32)
    comps = []
    for y0, x0 in zip(*np.nonzero(small)):
        if lab[y0, x0]:
            continue
        n = len(comps) + 1
        lab[y0, x0] = n
        q = deque([(y0, x0)])
        cells = []
        while q:
            y, x = q.popleft()
            cells.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < small.shape[0] and 0 <= xx < small.shape[1] and small[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        q.append((yy, xx))
        ys = np.array([c[0] for c in cells])
        xs = np.array([c[1] for c in cells])
        comps.append({"id": n, "area": len(cells), "box": [xs.min(), ys.min(), xs.max() + 1, ys.max() + 1], "cy": ys.mean(), "cx": xs.mean()})
    return lab, comps


def gap(a, b):
    ax0, ay0, ax1, ay1 = a["box"]
    bx0, by0, bx1, by1 = b["box"]
    dx = max(0, max(ax0, bx0) - min(ax1, bx1))
    dy = max(0, max(ay0, by0) - min(ay1, by1))
    return max(dx, dy)


def group(comps, count):
    """Merge fragments (a glint, a detached scarf end) into the nearest pose."""
    comps = [dict(c, members=[c["id"]]) for c in comps]
    big = [c for c in comps if c["area"] >= 150]
    # Specks join a pose they almost touch; the rest is background noise.
    for s in comps:
        if s["area"] >= 150:
            continue
        t = min(big, key=lambda c: gap(s, c))
        if gap(s, t) <= 6:
            absorb(t, s)
    comps = big
    while len(comps) > count:
        comps.sort(key=lambda c: c["area"])
        s = comps.pop(0)
        t = min(comps, key=lambda c: gap(s, c))
        absorb(t, s)
    return comps


def absorb(t, s):
    x0, y0, x1, y1 = t["box"]
    sx0, sy0, sx1, sy1 = s["box"]
    tot = t["area"] + s["area"]
    t["cx"] = (t["cx"] * t["area"] + s["cx"] * s["area"]) / tot
    t["cy"] = (t["cy"] * t["area"] + s["cy"] * s["area"]) / tot
    t["box"] = [min(x0, sx0), min(y0, sy0), max(x1, sx1), max(y1, sy1)]
    t["area"] = tot
    t["members"] += s["members"]


def order(comps, rows):
    comps = sorted(comps, key=lambda c: c["cy"])
    per = len(comps) // rows
    out = []
    for r in range(rows):
        out += sorted(comps[r * per : (r + 1) * per], key=lambda c: c["cx"])
    return out


def stance(alpha, name):
    """Where the fighter stands: midway between the feet (the bottom few rows),
    so frames swap without the body sliding. Lying frames use their middle."""
    h, w = alpha.shape
    if name in ("down", "tumble"):
        return w // 2
    rows = alpha[int(h * 0.93) :] > 128
    xs = np.nonzero(rows.any(axis=0))[0]
    return int((xs.min() + xs.max()) / 2) if len(xs) else w // 2


def cut(fighter):
    overrides = {}
    path = ROOT / "tools" / "sprite-anchors.json"
    if path.exists():
        overrides = json.loads(path.read_text()).get(fighter, {})
    frames = []
    for sheet, names in SHEETS.items():
        src = SRC / f"{fighter}-{sheet}.png"
        if not src.exists():
            continue
        rgba = key(Image.open(src))
        lab, comps = blobs(rgba[..., 3])
        comps = group(comps, len(names))
        if len(comps) != len(names):
            raise SystemExit(f"{src.name}: found {len(comps)} poses, expected {len(names)}")
        for name, c in zip(names, order(comps, 2)):
            mask_small = np.isin(lab, c["members"])
            mask = np.kron(mask_small, np.ones((DOWN, DOWN), dtype=bool))
            mask = np.pad(mask, ((0, rgba.shape[0] - mask.shape[0]), (0, rgba.shape[1] - mask.shape[1])))
            # Grow by a cell so anti-aliased edges are kept.
            grown = mask.copy()
            for dy in (-DOWN, 0, DOWN):
                for dx in (-DOWN, 0, DOWN):
                    grown |= np.roll(np.roll(mask, dy, 0), dx, 1)
            px = rgba.copy()
            px[..., 3] = np.where(grown, px[..., 3], 0)
            ys, xs = np.nonzero(px[..., 3] > 8)
            x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            crop = px[y0:y1, x0:x1]
            ax = stance(crop[..., 3], name)
            ay = crop.shape[0]
            o = overrides.get(name, {})
            ax = o.get("ax", ax)
            ay = o.get("ay", ay)
            frames.append({"name": name, "img": Image.fromarray(crop), "ax": ax, "ay": ay, "sheet": sheet})
    return match_scale(frames)


def match_scale(frames):
    """Bring the extras sheet to the base sheets' scale: its two standing
    poses (undressed, charred) should be as tall as the idle stance."""
    by = {f["name"]: f for f in frames}
    if "idle" not in by or "underwear" not in by or "charred" not in by:
        return frames
    tall = (by["underwear"]["img"].size[1] + by["charred"]["img"].size[1]) / 2
    k = by["idle"]["img"].size[1] / tall
    if abs(k - 1) < 0.03:
        return frames
    for f in frames:
        if f["sheet"] != "c":
            continue
        w, h = f["img"].size
        f["img"] = f["img"].resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        f["ax"] = round(f["ax"] * k)
        f["ay"] = round(f["ay"] * k)
    return frames


def pack(fighter, frames):
    pad = 4
    width = 2048
    x = y = row_h = 0
    for f in frames:
        w, h = f["img"].size
        if x + w + pad > width:
            x = 0
            y += row_h + pad
            row_h = 0
        f["x"], f["y"] = x, y
        x += w + pad
        row_h = max(row_h, h)
    atlas = Image.new("RGBA", (width, y + row_h), (0, 0, 0, 0))
    meta = {}
    for f in frames:
        atlas.paste(f["img"], (f["x"], f["y"]))
        w, h = f["img"].size
        meta[f["name"]] = {"x": f["x"], "y": f["y"], "w": w, "h": h, "ax": int(f["ax"]), "ay": int(f["ay"])}
    atlas.save(OUT / f"{fighter}.webp", "WEBP", quality=88, method=6)
    (OUT / f"{fighter}.json").write_text(json.dumps(meta, indent=1))

    # Contact sheet with anchors, for a human eye.
    check = Image.new("RGBA", atlas.size, (40, 30, 70, 255))
    check.alpha_composite(atlas)
    d = ImageDraw.Draw(check)
    for name, m in meta.items():
        d.rectangle([m["x"], m["y"], m["x"] + m["w"], m["y"] + m["h"]], outline=(255, 255, 255, 90))
        cx, cy = m["x"] + m["ax"], m["y"] + m["ay"]
        d.line([cx, m["y"], cx, cy], fill=(255, 60, 60, 255), width=2)
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 220, 0, 255))
        d.text((m["x"] + 4, m["y"] + 4), name, fill=(255, 255, 255, 255))
    CHECK.mkdir(exist_ok=True)
    check.convert("RGB").save(CHECK / f"check-{fighter}.png")
    return meta


def main():
    names = sys.argv[1:] or sorted({p.stem.rsplit("-", 1)[0] for p in SRC.glob("*.png")})
    for n in names:
        frames = cut(n)
        meta = pack(n, frames)
        size = (OUT / f"{n}.webp").stat().st_size // 1024
        print(f"{n}: {len(meta)} frames, {size} KB")


if __name__ == "__main__":
    main()
