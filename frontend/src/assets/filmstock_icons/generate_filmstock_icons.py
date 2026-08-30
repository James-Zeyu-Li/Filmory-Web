import json
import pathlib
import re
import shutil
import subprocess

BASE_DIR = pathlib.Path(__file__).resolve().parent
SVG_DIR = BASE_DIR / "svg"
PNG_DIR = BASE_DIR / "png"

SVG_DIR.mkdir(parents=True, exist_ok=True)
PNG_DIR.mkdir(parents=True, exist_ok=True)

# Source of truth: the app's own film catalog (frontend/src/catalog/gear/commonFilmStocks.ts),
# mirrored here as brand/name pairs so this script can stay plain Python.
# Keep brand/name in sync with that file - FilmSvgAvatar matches icons by
# normalizing brand+name+format from whatever the app actually renders.
FILMSTOCKS_PATH = BASE_DIR.parent / "filmstocks.json"
entries = json.loads(FILMSTOCKS_PATH.read_text())

PALETTES_PATH = BASE_DIR / "palettes.json"
PALETTES = json.loads(PALETTES_PATH.read_text()) if PALETTES_PATH.exists() else {}

DEFAULT_PALETTE = ("#9CA3AF", "#6B7280")
FORMATS = ["135", "120"]


def normalize(s: str) -> str:
    # Must mirror FilmSvgAvatar.tsx's `normalize()` exactly so generated
    # filenames are found by the app's lookup.
    return re.sub(r"[^a-z0-9]", "", s.lower())


def palette_for(brand: str, name: str):
    stock_key = f"{brand}|{name}" if name else None
    pal = PALETTES.get(stock_key) if stock_key else None
    if not pal:
        pal = PALETTES.get(brand)
    if not pal:
        return DEFAULT_PALETTE
    return (pal.get("primary") or DEFAULT_PALETTE[0], pal.get("accent") or DEFAULT_PALETTE[1])


BRAND_SHORT = {
    "Kodak": "KODAK",
    "Fujifilm": "FUJIFILM",
    "Ilford": "ILFORD",
    "Kentmere": "KENTMERE",
    "Lomography": "LOMOGRAPHY",
    "CineStill": "CINESTILL",
    "Fomapan": "FOMAPAN",
    "Lucky": "LUCKY",
    "Rollei": "ROLLEI",
    "Harman": "HARMAN",
    "Shanghai": "SHANGHAI",
    "ORWO": "ORWO",
    "AgfaPhoto": "AGFAPHOTO",
    "ADOX": "ADOX",
    "Bergger": "BERGGER",
    "Ferrania": "FERRANIA",
    "Kosmo Foto": "KOSMO FOTO",
    "Svema": "SVEMA",
    "Reflx Lab": "REFLX LAB",
    "Flic Film": "FLIC FILM",
    "Candido": "CANDIDO",
}


def luminance(hex_color):
    c = hex_color.lstrip("#")
    r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def text_color_for(bg_hex):
    return "#1C1C1C" if luminance(bg_hex) > 150 else "#F7F7F7"


def split_model_lines(text: str, max_len: int = 13, max_lines: int = 2) -> list[str]:
    if len(text) <= max_len:
        return [text]
    words = text.split(" ")
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join(current + [word]).strip()
        if len(candidate) <= max_len or not current:
            current.append(word)
            continue
        lines.append(" ".join(current))
        current = [word]
        if len(lines) == max_lines - 1:
            break
    if current:
        remaining_start = words.index(current[0], len(lines))
        lines.append(" ".join(words[remaining_start:]))
    return lines[:max_lines]


def text_length_attr(text: str, size: int, max_width: int, avg_char_width: float) -> str:
    if not text:
        return ""
    est_width = len(text) * avg_char_width * size
    if est_width <= max_width:
        return ""
    return f' textLength="{max_width}" lengthAdjust="spacingAndGlyphs"'


# ── Layout: flat rounded color-block card ──────────────────────────────
# Card bleeds close to the canvas edge so the icon reads as a bold, filled
# image rather than a small graphic floating in a lot of blank margin -
# especially for light-primary stocks (white/cream) where that margin used
# to blend into the app's own card background and look like a thick border.
CARD_X, CARD_Y, CARD_W, CARD_H, CARD_RX = 24, 24, 976, 976, 96
STRIPE_Y, STRIPE_H = 729, 153
BADGE_W, BADGE_H, BADGE_RX = 176, 92, 20
BADGE_X, BADGE_Y = CARD_X + CARD_W - BADGE_W - 48, CARD_Y + 48

MAX_TEXT_WIDTH = CARD_W - 160
BRAND_SIZE = 124
MODEL_SIZE = 112
BRAND_Y = 450
MODEL_Y = 580
MODEL_LINE_HEIGHT = 103

SVG_TEMPLATE = """<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1024\" height=\"1024\" viewBox=\"0 0 1024 1024\">
  <defs>
    <style>
      .brand {{ font-family: 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; letter-spacing: 1px; }}
      .model {{ font-family: 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif; font-weight: 600; letter-spacing: 0.5px; }}
      .badge {{ font-family: 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; }}
    </style>
  </defs>
  <rect x=\"{card_x}\" y=\"{card_y}\" width=\"{card_w}\" height=\"{card_h}\" rx=\"{card_rx}\" fill=\"{primary}\"/>
  <rect x=\"{card_x}\" y=\"{stripe_y}\" width=\"{card_w}\" height=\"{stripe_h}\" fill=\"{accent}\"/>
{format_badge}
{text_block}
</svg>
"""


def make_svg(brand: str, name: str, display_name: str, film_format: str | None, show_text: bool):
    primary, accent = palette_for(brand, name)
    text_color = text_color_for(primary)

    format_badge = ""
    if film_format:
        badge_text_color = text_color_for(accent)
        badge_text_length = text_length_attr(film_format, 44, BADGE_W - 32, 0.62)
        format_badge = f'''  <rect x="{BADGE_X}" y="{BADGE_Y}" width="{BADGE_W}" height="{BADGE_H}" rx="{BADGE_RX}" fill="{accent}"/>
  <text x="{BADGE_X + BADGE_W / 2}" y="{BADGE_Y + BADGE_H / 2 + 15}" font-size="44" class="badge" text-anchor="middle" fill="{badge_text_color}"{badge_text_length}>{film_format}</text>'''

    text_block = ""
    if show_text:
        brand_text = BRAND_SHORT.get(brand, brand[:10].upper())
        model_lines = split_model_lines(display_name) if display_name else []

        brand_length_attr = text_length_attr(brand_text, BRAND_SIZE, MAX_TEXT_WIDTH, 0.58)
        model_tspans = ""
        for i, line in enumerate(model_lines):
            dy = 0 if i == 0 else MODEL_LINE_HEIGHT
            length_attr = text_length_attr(line, MODEL_SIZE, MAX_TEXT_WIDTH, 0.56)
            model_tspans += f'<tspan x="512" dy="{dy}"{length_attr}>{line}</tspan>'

        model_text_el = ""
        if model_tspans:
            model_text_el = f'  <text x="512" y="{MODEL_Y}" font-size="{MODEL_SIZE}" class="model" text-anchor="middle" fill="{text_color}">{model_tspans}</text>'

        text_block = f'''  <text x="512" y="{BRAND_Y}" font-size="{BRAND_SIZE}" class="brand" text-anchor="middle" fill="{text_color}"{brand_length_attr}>{brand_text}</text>
{model_text_el}'''

    return SVG_TEMPLATE.format(
        card_x=CARD_X, card_y=CARD_Y, card_w=CARD_W, card_h=CARD_H, card_rx=CARD_RX,
        stripe_y=STRIPE_Y, stripe_h=STRIPE_H,
        primary=primary, accent=accent,
        format_badge=format_badge,
        text_block=text_block,
    )


def render_png(svg_path: pathlib.Path, png_path: pathlib.Path):
    rsvg = shutil.which("rsvg-convert")
    if not rsvg:
        return
    subprocess.run(
        [rsvg, "-w", "1024", "-h", "1024", "-o", str(png_path), str(svg_path)],
        check=True
    )


# Clear stale icons from the previous naming/coloring scheme so no orphaned
# file can be picked up by the app's glob import.
for stale_dir in (SVG_DIR, PNG_DIR):
    for f in stale_dir.glob("*"):
        f.unlink()

manifest = []
for e in entries:
    brand, name = e["brand"], e["name"]
    display_name = e.get("displayName", name)
    norm_brand, norm_name = normalize(brand), normalize(name)

    for film_format in FORMATS:
        stock_id = f"{norm_brand}|{norm_name}|{film_format}"
        svg_path = SVG_DIR / f"{stock_id}.svg"
        svg_path.write_text(make_svg(brand, name, display_name, film_format, show_text=True))
        png_path = PNG_DIR / f"{stock_id}.png"
        render_png(svg_path, png_path)

        primary, accent = palette_for(brand, name)
        manifest.append({
            "id": stock_id, "brand": brand, "name": name, "displayName": display_name,
            "filmFormat": film_format, "primary": primary, "accent": accent,
        })

# Brand-level fallback icons (brand name only, no model line) used when a
# specific stock isn't in the catalog above but the brand is recognized.
# Digital/Generic stay fully blank - reserved for user-typed custom entries.
brand_names = sorted({entry["brand"] for entry in entries})
for brand in brand_names:
    svg_path = SVG_DIR / f"brand|{normalize(brand)}.svg"
    svg_path.write_text(make_svg(brand, "", "", None, show_text=True))
    render_png(svg_path, PNG_DIR / f"brand|{normalize(brand)}.png")

for brand in ["Digital", "Generic"]:
    svg_path = SVG_DIR / f"brand|{normalize(brand)}.svg"
    svg_path.write_text(make_svg(brand, "", "", None, show_text=False))
    render_png(svg_path, PNG_DIR / f"brand|{normalize(brand)}.png")

(BASE_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(f"Generated {len(entries)} stocks x {len(FORMATS)} formats + {len(brand_names)} brand fallbacks + 2 generic")
