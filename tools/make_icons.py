#!/usr/bin/env python3
"""Generate Fasih launcher icons (mdpi..xxxhdpi) into android/app/src/main/res."""
import os
from PIL import Image, ImageDraw, ImageFont

RES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "android", "app", "src", "main", "res")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
C1, C2, AMBER = (0x43, 0x38, 0xCA), (0x6D, 0x28, 0xD9), (0xF5, 0x9E, 0x0B)
SS = 432  # master size (xxxhdpi adaptive layer, 108dp * 4)
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def background(n):
    # diagonal gradient C1 (top-left) -> C2 (bottom-right)
    img = Image.new("RGB", (n, n))
    data = []
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2.0 * (n - 1))
            data.append(tuple(int(round(C1[i] + (C2[i] - C1[i]) * t)) for i in range(3)))
    img.putdata(data)
    return img


def foreground(n):
    """Artwork kept inside the central 66% (adaptive safe zone)."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(n * 0.50))
    # F: centre of its ink box at (0.465, 0.455)
    bb = d.textbbox((0, 0), "F", font=font)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    cx, cy = n * 0.465, n * 0.455
    d.text((cx - w / 2 - bb[0], cy - h / 2 - bb[1]), "F", font=font, fill=(255, 255, 255, 255))
    # badge, bottom-right, ends at 0.82 (< 0.833)
    x1, y1 = n * 0.82, n * 0.80
    x0, y0 = n * 0.545, n * 0.625
    d.rounded_rectangle((x0, y0, x1, y1), radius=n * 0.05, fill=AMBER + (255,))
    bf = ImageFont.truetype(FONT, int(n * 0.105))
    bb = d.textbbox((0, 0), "C1", font=bf)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((x0 + x1) / 2 - tw / 2 - bb[0], (y0 + y1) / 2 - th / 2 - bb[1]), "C1", font=bf, fill=(255, 255, 255, 255))
    return img


def legacy(bg, fg, size, round_):
    comp = bg.convert("RGBA")
    comp.alpha_composite(fg)
    m = SS
    crop = int(m * 0.80)
    o = (m - crop) // 2
    comp = comp.crop((o, o, o + crop, o + crop)).resize((size * 4, size * 4), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    md = ImageDraw.Draw(mask)
    if round_:
        md.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    else:
        md.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=int(size * 4 * 0.22), fill=255)
    out = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    out.paste(comp, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


def main():
    bg_m, fg_m = background(SS), foreground(SS)
    for name, k in DENS.items():
        d = os.path.join(RES, "mipmap-" + name)
        os.makedirs(d, exist_ok=True)
        layer = int(round(108 * k))
        icon = int(round(48 * k))
        bg_m.resize((layer, layer), Image.LANCZOS).save(os.path.join(d, "ic_launcher_background.png"))
        fg_m.resize((layer, layer), Image.LANCZOS).save(os.path.join(d, "ic_launcher_foreground.png"))
        legacy(bg_m, fg_m, icon, False).save(os.path.join(d, "ic_launcher.png"))
        legacy(bg_m, fg_m, icon, True).save(os.path.join(d, "ic_launcher_round.png"))
    print("done")


if __name__ == "__main__":
    main()
