from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont


ROOT = Path(r"D:\KOUDOUS\MES 5 PROJETS PHARES\Crew_System")
ASSETS = ROOT / "workspace" / "projects" / "koudous_daouda_le_robot" / "brief" / "source_materials"
OUT = ROOT / "workspace" / "projects" / "koudous_daouda_le_robot" / "outputs" / "visuals" / "week_2026-06-01_2026-06-07"
OUT.mkdir(parents=True, exist_ok=True)

BASE_SIZE = 7680
DEFAULT_SIZE = 1024

MINT = "#79E7CC"
NAVY_DARK = "#071A2D"
WHITE = "#FFFFFF"
FONT_DIR = Path(r"C:\Windows\Fonts")


def scale(value: int, canvas_size: int) -> int:
    return max(1, int(round(value * canvas_size / BASE_SIZE)))


def font(filename: str, base_size: int, canvas_size: int) -> ImageFont.FreeTypeFont:
    size = scale(base_size, canvas_size)
    for candidate in [FONT_DIR / filename, FONT_DIR / "segoeuib.ttf", FONT_DIR / "segoeui.ttf", FONT_DIR / "arial.ttf"]:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def open_photo() -> Image.Image:
    photo = Image.open(ASSETS / "photo_profil_le_robot.jpg").convert("RGB")
    photo = ImageEnhance.Contrast(photo).enhance(1.05)
    photo = ImageEnhance.Sharpness(photo).enhance(1.15)
    return photo


def crop_cover(img: Image.Image, size: tuple[int, int], focus_y: float = 0.30) -> Image.Image:
    target_w, target_h = size
    ratio = max(target_w / img.width, target_h / img.height)
    resized = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_w) // 2)
    max_top = max(0, resized.height - target_h)
    top = int(max_top * focus_y)
    return resized.crop((left, top, left + target_w, top + target_h))


def draw_signature(draw: ImageDraw.ImageDraw, x: int, y: int, canvas_size: int) -> None:
    mark = "Le Robot"
    mark_font = font("segoeuib.ttf", 155, canvas_size)
    offset = scale(10, canvas_size)
    stroke = scale(3, canvas_size)
    draw.text((x + offset, y + offset), mark, font=mark_font, fill=(7, 26, 45, 120))
    draw.text(
        (x, y),
        mark,
        font=mark_font,
        fill=WHITE,
        stroke_width=stroke,
        stroke_fill=(7, 26, 45, 72),
    )


def draw_brand_circle(draw: ImageDraw.ImageDraw, canvas_size: int) -> None:
    # Corner-anchored circle: clipped by the top and right edges, not floating on the side.
    draw.ellipse(
        (
            scale(5400, canvas_size),
            scale(-1700, canvas_size),
            scale(9500, canvas_size),
            scale(2400, canvas_size),
        ),
        fill=(221, 247, 239, 110),
    )


def draw_headline(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    lines: list[str],
    canvas_size: int,
) -> int:
    headline_font = font("segoeuib.ttf", 600, canvas_size)
    gap = scale(220, canvas_size)
    for line in lines:
        draw.text((x, y), line, font=headline_font, fill=WHITE)
        bbox = draw.textbbox((x, y), line, font=headline_font)
        y += (bbox[3] - bbox[1]) + gap
    return y


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    text_font: ImageFont.FreeTypeFont,
    fill: str,
) -> None:
    x1, y1, x2, y2 = box
    bbox = draw.textbbox((0, 0), text, font=text_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = x1 + ((x2 - x1) - text_w) / 2 - bbox[0]
    y = y1 + ((y2 - y1) - text_h) / 2 - bbox[1]
    draw.text((x, y), text, font=text_font, fill=fill)


def render_scrollstopper(
    post_no: int,
    lines: list[str],
    subline: str,
    filename: str,
    canvas_size: int = DEFAULT_SIZE,
) -> Path:
    base = crop_cover(open_photo(), (canvas_size, canvas_size), focus_y=0.30).convert("RGBA")
    base = ImageEnhance.Brightness(base).enhance(0.55)
    base.alpha_composite(Image.new("RGBA", (canvas_size, canvas_size), (7, 26, 45, 112)))

    draw = ImageDraw.Draw(base)
    draw.rectangle((0, canvas_size - scale(74, canvas_size), canvas_size, canvas_size), fill=MINT)
    draw_brand_circle(draw, canvas_size)

    draw_signature(draw, scale(720, canvas_size), scale(650, canvas_size), canvas_size)
    y = draw_headline(draw, scale(720, canvas_size), scale(1580, canvas_size), lines, canvas_size)

    chip = (
        scale(760, canvas_size),
        y + scale(250, canvas_size),
        scale(760 + 2600, canvas_size),
        y + scale(560, canvas_size),
    )
    draw.rounded_rectangle(chip, radius=scale(66, canvas_size), fill=MINT)
    draw_centered_text(draw, chip, subline, font("seguisb.ttf", 160, canvas_size), NAVY_DARK)

    draw.text(
        (scale(720, canvas_size), scale(6900, canvas_size)),
        "Koudous DAOUDA",
        font=font("seguisb.ttf", 150, canvas_size),
        fill=WHITE,
    )

    out = OUT / filename
    base.convert("RGB").save(out, quality=100, optimize=True)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Le Robot scroll-stopper visuals.")
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE, help="Square output size in pixels. Use 1024 first, 7680 for final 8K.")
    args = parser.parse_args()

    if args.size == 1024:
        suffix = "1k"
    elif args.size == BASE_SIZE:
        suffix = "8k"
    else:
        suffix = f"{args.size}px"
    generated = [
        render_scrollstopper(
            1,
            ["TU FAIS", "LE BOULOT", "D'UN ROBOT."],
            "Moi, je l'automatise.",
            f"facebook_01_background_scrollstopper_{suffix}.png",
            canvas_size=args.size,
        ),
        render_scrollstopper(
            2,
            ["TON BUSINESS", "TE DONNE", "DES DEVOIRS."],
            "Relances. Tableaux. Emails.",
            f"facebook_02_background_scrollstopper_{suffix}.png",
            canvas_size=args.size,
        ),
    ]

    for path in generated:
        with Image.open(path) as image:
            print(path)
            print(image.size, path.stat().st_size)


if __name__ == "__main__":
    main()
