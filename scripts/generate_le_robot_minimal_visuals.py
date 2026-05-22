from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"D:\KOUDOUS\MES 5 PROJETS PHARES\Crew_System")
ASSETS = ROOT / "workspace" / "projects" / "koudous_daouda_le_robot" / "brief" / "source_materials"
OUT = ROOT / "workspace" / "projects" / "koudous_daouda_le_robot" / "outputs" / "visuals" / "week_2026-06-01_2026-06-07"
OUT.mkdir(parents=True, exist_ok=True)

W = H = 7680
NAVY = "#102B48"
NAVY_DARK = "#071A2D"
BG = "#F6FCF9"
PALE = "#DDF7EF"
MINT = "#79E7CC"
TEAL = "#007C70"
SOFT = "#EAF8F2"

FONT_DIR = Path(r"C:\Windows\Fonts")


def font(filename: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in [FONT_DIR / filename, FONT_DIR / "segoeuib.ttf", FONT_DIR / "segoeui.ttf", FONT_DIR / "arial.ttf"]:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def circle_crop(img: Image.Image, size: int) -> Image.Image:
    img = img.convert("RGB")
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    cropped = img.crop((left, top, left + side, top + side)).resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(cropped.convert("RGBA"), (0, 0), mask)
    return out


def shadow_paste(base: Image.Image, asset: Image.Image, xy: tuple[int, int], blur: int = 100, opacity: int = 80) -> None:
    x, y = xy
    alpha = asset.getchannel("A") if asset.mode == "RGBA" else Image.new("L", asset.size, 255)
    shadow = Image.new("RGBA", asset.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.point(lambda value: int(value * opacity / 255)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow, (x, y + 90))
    base.alpha_composite(asset, xy)


def badge(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0) -> None:
    text = "Le Robot"
    fnt = font("segoeuib.ttf", int(150 * scale))
    pad_x = int(68 * scale)
    pad_y = int(38 * scale)
    bbox = draw.textbbox((0, 0), text, font=fnt)
    width = bbox[2] - bbox[0] + pad_x * 2
    height = bbox[3] - bbox[1] + pad_y * 2
    draw.rounded_rectangle((x, y, x + width, y + height), radius=int(50 * scale), fill=NAVY)
    draw.text((x + pad_x, y + pad_y - int(12 * scale)), text, font=fnt, fill=BG)


def prepare_photo(size: int, ring_color: str = MINT) -> Image.Image:
    photo = Image.open(ASSETS / "photo_profil_le_robot.jpg")
    portrait = circle_crop(photo, size)
    ring = Image.new("RGBA", (size + 170, size + 170), (0, 0, 0, 0))
    draw = ImageDraw.Draw(ring)
    draw.ellipse((0, 0, size + 169, size + 169), fill=ring_color)
    draw.ellipse((62, 62, size + 108, size + 108), fill=BG)
    ring.alpha_composite(portrait, (85, 85))
    return ring


def visual_01() -> Path:
    img = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw.ellipse((-1750, -1740, 2800, 2810), fill=PALE)
    draw.ellipse((5850, 5420, 9550, 9120), fill=PALE)
    draw.rectangle((0, H - 72, W, H), fill=MINT)

    badge(draw, 650, 620, 1.0)
    draw.text((650, 1570), "AUTOMATISE", font=font("segoeuib.ttf", 760), fill=NAVY_DARK)
    draw.text((650, 2385), "L'ENNUYEUX.", font=font("segoeuib.ttf", 760), fill=NAVY_DARK)

    draw.rounded_rectangle((680, 3420, 2460, 3655), radius=58, fill=MINT)
    draw.text((750, 3394), "pas ton \u00e9nergie", font=font("segoeuib.ttf", 180), fill=NAVY_DARK)

    draw.text((650, 6520), "Koudous DAOUDA", font=font("seguisb.ttf", 170), fill=NAVY)
    draw.text((650, 6785), "n8n  |  Python  |  Agents IA", font=font("segoeui.ttf", 115), fill=TEAL)

    portrait = prepare_photo(2500)
    shadow_paste(img, portrait, (4570, 3650), blur=95, opacity=70)

    path = OUT / "facebook_01_le_manifeste_minimal_8k.png"
    img.convert("RGB").save(path, quality=100, optimize=True)
    return path


def visual_02() -> Path:
    img = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 650, H), fill=PALE)
    draw.ellipse((5200, -1200, 9000, 2600), fill=PALE)
    draw.rectangle((0, H - 72, W, H), fill=MINT)

    badge(draw, 720, 660, 1.0)
    draw.text((720, 1510), "TU R\u00c9P\u00c8TES", font=font("segoeuib.ttf", 760), fill=NAVY_DARK)
    draw.text((720, 2315), "TROP.", font=font("segoeuib.ttf", 1040), fill=NAVY_DARK)

    draw.rounded_rectangle((760, 3770, 3380, 4028), radius=64, fill=MINT)
    draw.text((850, 3736), "pas parce que tu travailles trop", font=font("seguisb.ttf", 150), fill=NAVY_DARK)

    draw.text((720, 6605), "Le Robot automatise l'ennuyeux.", font=font("segoeuib.ttf", 180), fill=TEAL)
    draw.text((720, 6880), "Koudous DAOUDA", font=font("segoeui.ttf", 118), fill=NAVY)

    portrait = prepare_photo(1700, ring_color=NAVY)
    shadow_paste(img, portrait, (5130, 5030), blur=90, opacity=75)

    path = OUT / "facebook_02_la_claque_douce_minimal_8k.png"
    img.convert("RGB").save(path, quality=100, optimize=True)
    return path


if __name__ == "__main__":
    for generated in [visual_01(), visual_02()]:
        with Image.open(generated) as image:
            print(generated)
            print(image.size, generated.stat().st_size)
