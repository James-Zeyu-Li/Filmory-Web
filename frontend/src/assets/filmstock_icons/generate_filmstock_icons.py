import json
import pathlib
import re
import shutil
import subprocess

BASE_DIR = pathlib.Path(__file__).resolve().parent
SVG_DIR = BASE_DIR / "svg"
PNG_DIR = BASE_DIR / "png"
ASSETS_DIR = BASE_DIR.parent.parent / "Filmory" / "Assets.xcassets" / "FilmStockIcons"

SVG_DIR.mkdir(parents=True, exist_ok=True)
PNG_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

FILMSTOCKS_PATH = BASE_DIR.parent / "filmstocks.json"
entries = json.loads(FILMSTOCKS_PATH.read_text())

# Optional palettes.json (can be brand-level or film-id-level).
PALETTES_PATH = BASE_DIR / "palettes.json"
if PALETTES_PATH.exists():
    PALETTES = json.loads(PALETTES_PATH.read_text())
else:
    PALETTES = {}

# Iconic palette mapping by brand. Accent defaults to warm-orange for film tongue.
BRAND_PRIMARY = {
    "Kodak": "#FFB700",
    "Fujifilm": "#FB0020",
    "Ilford": "#EA4434",
    "Kentmere": "#EA4434",
    "Lomography": "#FAE397",
    "CineStill": "#D91F27",
    "Foma (福马)": "#A0820A",
    "乐凯 Lucky": "#EF2D29",
}

ACCENT_ORANGE = "#F28C28"

def _get_palette_value(pal: dict, key: str):
    return pal.get(key) or pal.get(key.lower())


def palette_for(entry):
    brand = entry["brand"]
    film_id = entry["id"]

    pal = PALETTES.get(film_id) or PALETTES.get(brand)
    if pal:
        primary = _get_palette_value(pal, "PRIMARY") or BRAND_PRIMARY.get(brand)
        secondary = _get_palette_value(pal, "SECONDARY") or _get_palette_value(pal, "secondary") or []
        accent = _get_palette_value(pal, "ACCENT") or _get_palette_value(pal, "accent")
        if not accent:
            if isinstance(secondary, list) and secondary:
                accent = secondary[0]
            elif isinstance(secondary, str):
                accent = secondary
        return (primary or "#9CA3AF", accent or ACCENT_ORANGE)

    # Fallback for missing palettes.json
    return (BRAND_PRIMARY.get(brand, "#9CA3AF"), ACCENT_ORANGE)


BRAND_SHORT = {
    "Kodak": "KODAK",
    "Fujifilm": "FUJI",
    "Ilford": "ILFORD",
    "Kentmere": "KENT",
    "Lomography": "LOMO",
    "CineStill": "CINESTILL",
    "Foma (福马)": "FOMA",
    "乐凯 Lucky": "LUCKY",
}

REPLACE_LONG = [
    ("LomoChrome", "LC"),
    ("Color Negative", "CN"),
    ("Superia X-TRA", "Superia"),
    ("Vision3", "V3"),
    ("Eastman ", ""),
    ("Double-X", "DoubleX"),
    ("Fomapan", "Foma"),
]


def format_model(brand: str, name: str) -> str:
    if brand == "Kentmere" and "Kentmere 400" in name:
        return "Pan 400"
    if brand == "Kentmere" and "Kentmere 100" in name:
        return "Pan 100"
    out = name
    if len(out) > 18:
        for a, b in REPLACE_LONG:
            out = out.replace(a, b)
        out = re.sub(r"\s+", " ", out).strip()
    return out

def split_model_lines(text: str, max_len: int = 11, max_lines: int = 3) -> list[str]:
    if len(text) <= max_len or max_lines <= 1:
        return [text]
    parts = text.split(" ")
    lines: list[str] = []
    current: list[str] = []
    for part in parts:
        candidate = " ".join(current + [part]).strip()
        if len(candidate) <= max_len or not current:
            current.append(part)
            continue
        lines.append(" ".join(current).strip())
        current = [part]
        if len(lines) == max_lines - 1:
            break
    if current:
        remaining = parts[parts.index(current[0]):]
        tail = " ".join(remaining).strip()
        lines.append(tail)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
    # Fallback split if still too long without spaces
    if len(lines) == 1 and len(lines[0]) > max_len:
        s = lines[0]
        chunk = max_len
        lines = [s[i:i+chunk].strip() for i in range(0, len(s), chunk)]
        lines = lines[:max_lines]
    return lines


def clamp(n, lo, hi):
    return max(lo, min(hi, n))


def shade(hex_color, factor):
    # factor in [-1, 1]
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)

    def adj(c):
        if factor >= 0:
            return int(c + (255 - c) * factor)
        return int(c * (1 + factor))

    r, g, b = adj(r), adj(g), adj(b)
    return f"#{r:02x}{g:02x}{b:02x}"


def text_size(text, base, min_size, max_len):
    if len(text) <= max_len:
        return base
    size = base - (len(text) - max_len) * 2
    return clamp(size, min_size, base)

def text_length_attr(text: str, size: int, max_width: int, avg_char_width: float) -> str:
    if not text:
        return ""
    est_width = len(text) * avg_char_width * size
    if est_width <= max_width:
        return ""
    return f' textLength="{max_width}" lengthAdjust="spacingAndGlyphs"'


SVG_TEMPLATE = """<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1024\" height=\"1024\" viewBox=\"0 0 1024 1024\">
  <defs>
    <style>
      .brand {{ font-family: 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; letter-spacing: 1px; }}
      .model {{ font-family: 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif; font-weight: 600; letter-spacing: 0.5px; }}
    </style>
    <filter id=\"softShadow\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\">
      <feDropShadow dx=\"0\" dy=\"4\" stdDeviation=\"4\" flood-color=\"#000\" flood-opacity=\"0.18\"/>
    </filter>
  </defs>
  <g filter=\"url(#softShadow)\">
    <!-- Film tongue -->
    <rect x=\"{tongue_x}\" y=\"{tongue_y}\" width=\"{tongue_w}\" height=\"{tongue_h}\" rx=\"26\" fill=\"{accent}\" stroke=\"{outline}\" stroke-width=\"2\"/>
    <rect x=\"{tongue_cut_x}\" y=\"{tongue_cut_y}\" width=\"{tongue_cut_w}\" height=\"{tongue_cut_h}\" rx=\"16\" fill=\"{tongue_cut}\" opacity=\"0.2\"/>
    <circle cx=\"{tongue_dot1_x}\" cy=\"{tongue_dot_y}\" r=\"8\" fill=\"{detail}\" opacity=\"0.6\"/>
    <circle cx=\"{tongue_dot2_x}\" cy=\"{tongue_dot_y}\" r=\"8\" fill=\"{detail}\" opacity=\"0.6\"/>
    <circle cx=\"{tongue_dot3_x}\" cy=\"{tongue_dot_y}\" r=\"8\" fill=\"{detail}\" opacity=\"0.6\"/>

    <!-- Cap -->
    <rect x=\"{cap_x}\" y=\"{cap_y}\" width=\"{cap_w}\" height=\"{cap_h}\" rx=\"18\" fill=\"{lid}\" stroke=\"{outline}\" stroke-width=\"2\"/>
    <rect x=\"{top_x}\" y=\"{top_y}\" width=\"{top_w}\" height=\"{top_h}\" rx=\"12\" fill=\"{lid}\" stroke=\"{outline}\" stroke-width=\"2\"/>

    <!-- Body -->
    <rect x=\"{body_x}\" y=\"{body_y}\" width=\"{body_w}\" height=\"{body_h}\" rx=\"64\" fill=\"{body}\" stroke=\"{outline}\" stroke-width=\"2\"/>
    <rect x=\"{inner_x}\" y=\"{inner_y}\" width=\"{inner_w}\" height=\"{inner_h}\" rx=\"56\" fill=\"none\" stroke=\"{inner}\" stroke-width=\"1\"/>

    <!-- Diagonal band (fixed position) -->
    <path d=\"M {band_x1} {band_y1} L {band_x2} {band_y2} L {band_x3} {band_y3} L {band_x4} {band_y4} Z\" fill=\"{band}\"/>

    <!-- Perforation dots -->
    <circle cx=\"{dot1_x}\" cy=\"{dot_y}\" r=\"10\" fill=\"{detail}\" opacity=\"0.55\"/>
    <circle cx=\"{dot2_x}\" cy=\"{dot_y}\" r=\"10\" fill=\"{detail}\" opacity=\"0.55\"/>
    <circle cx=\"{dot3_x}\" cy=\"{dot_y}\" r=\"10\" fill=\"{detail}\" opacity=\"0.55\"/>

    {text_block}
  </g>
</svg>
"""

# layout constants
Y_OFFSET = 24
BODY_W, BODY_H = 560, 680
BODY_X, BODY_Y = (1024 - BODY_W) // 2, 210 + Y_OFFSET
CAP_W, CAP_H = 560, 88
CAP_X, CAP_Y = BODY_X, 150 + Y_OFFSET
TOP_W, TOP_H = 220, 50
TOP_X, TOP_Y = (1024 - TOP_W) // 2, 110 + Y_OFFSET

INNER_MARGIN = 24
INNER_X = BODY_X + INNER_MARGIN
INNER_Y = BODY_Y + INNER_MARGIN
INNER_W = BODY_W - INNER_MARGIN * 2
INNER_H = BODY_H - INNER_MARGIN * 2

# diagonal band (fixed) - moved downward to avoid text overlap
BAND_HEIGHT = 150
BAND_X1 = BODY_X
BAND_Y1 = BODY_Y + int(BODY_H * 0.70)
BAND_X2 = BODY_X + BODY_W
BAND_Y2 = BODY_Y + int(BODY_H * 0.50)
BAND_X3 = BODY_X + BODY_W
BAND_Y3 = BAND_Y2 + BAND_HEIGHT
BAND_X4 = BODY_X
BAND_Y4 = BAND_Y1 + BAND_HEIGHT

# tongue
TONGUE_W, TONGUE_H = 160, 220
TONGUE_X = BODY_X - 70
TONGUE_Y = BODY_Y + int(BODY_H * 0.28)
TONGUE_CUT_W, TONGUE_CUT_H = 80, 120
TONGUE_CUT_X = TONGUE_X + 30
TONGUE_CUT_Y = TONGUE_Y + 40
TONGUE_DOT_Y = TONGUE_Y + TONGUE_H - 42
TONGUE_DOT1_X = TONGUE_X + 32
TONGUE_DOT2_X = TONGUE_X + 70
TONGUE_DOT3_X = TONGUE_X + 108

# dots
RIGHT = BODY_X + BODY_W
BASELINE_Y = BODY_Y + BODY_H - 80
DOT3_X = RIGHT - 70
DOT2_X = RIGHT - 120
DOT1_X = RIGHT - 170


def luminance(hex_color):
    c = hex_color.lstrip("#")
    r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def make_svg(entry, show_text: bool = True):
    primary, accent = palette_for(entry)
    outline = "#F7F7F7"
    detail = shade(primary, -0.4)
    body = primary
    lid = shade(primary, -0.08)
    inner = shade(primary, -0.2)
    tongue_cut = "#FFFFFF"

    max_text_width = BODY_W - 80
    brand_size = 104
    model_size = 92
    brand_y = BODY_Y + int(BODY_H * 0.18)
    model_y = brand_y + 120

    text_color = "#1C1C1C" if luminance(primary) > 160 else "#F7F7F7"

    band_color = shade(primary, -0.12)
    if luminance(primary) < 70 and luminance(accent) > 160:
        band_color = accent
        lid = shade(primary, 0.08)
        inner = shade(primary, 0.12)

    text_block = ""
    if show_text:
        brand_text = BRAND_SHORT.get(entry["brand"], entry["brand"][:4].upper())
        model_text = format_model(entry["brand"], entry["name"])

        model_lines = split_model_lines(model_text, max_len=11, max_lines=3)

        # Ensure model lines stay above band; shift up if necessary.
        safe_bottom = BAND_Y2 - 12
        line_height = int(model_size * 0.9)
        total_height = max(0, (len(model_lines) - 1) * line_height)
        if model_y + total_height > safe_bottom and total_height > 0:
            min_model_y = brand_y + int(brand_size * 0.9) + 18
            if model_y + total_height > safe_bottom:
                model_y = max(min_model_y, safe_bottom - total_height)

        brand_text_length_attr = text_length_attr(brand_text, brand_size, max_text_width, 0.58)
        model_line1_length_attr = text_length_attr(model_lines[0], model_size, max_text_width, 0.56)
        model_line2_tspan = ""
        if len(model_lines) >= 2:
            model_line2_tspan = f'<tspan x="512" dy="{line_height}"{text_length_attr(model_lines[1], model_size, max_text_width, 0.56)}>{model_lines[1]}</tspan>'
        if len(model_lines) == 3:
            model_line2_tspan += f'<tspan x="512" dy="{line_height}"{text_length_attr(model_lines[2], model_size, max_text_width, 0.56)}>{model_lines[2]}</tspan>'

        text_block = f'''
    <!-- Text (kept above band) -->
    <text x="512" y="{brand_y}" font-size="{brand_size}" class="brand" text-anchor="middle" fill="{text_color}"{brand_text_length_attr}>{brand_text}</text>
    <text x="512" y="{model_y}" font-size="{model_size}" class="model" text-anchor="middle" fill="{text_color}">
      <tspan x="512" dy="0"{model_line1_length_attr}>{model_lines[0]}</tspan>
      {model_line2_tspan}
    </text>
        '''.strip()

    return SVG_TEMPLATE.format(
        tongue_x=TONGUE_X, tongue_y=TONGUE_Y, tongue_w=TONGUE_W, tongue_h=TONGUE_H,
        tongue_cut_x=TONGUE_CUT_X, tongue_cut_y=TONGUE_CUT_Y,
        tongue_cut_w=TONGUE_CUT_W, tongue_cut_h=TONGUE_CUT_H,
        tongue_dot1_x=TONGUE_DOT1_X, tongue_dot2_x=TONGUE_DOT2_X, tongue_dot3_x=TONGUE_DOT3_X, tongue_dot_y=TONGUE_DOT_Y,
        cap_x=CAP_X, cap_y=CAP_Y, cap_w=CAP_W, cap_h=CAP_H,
        top_x=TOP_X, top_y=TOP_Y, top_w=TOP_W, top_h=TOP_H,
        body_x=BODY_X, body_y=BODY_Y, body_w=BODY_W, body_h=BODY_H,
        inner_x=INNER_X, inner_y=INNER_Y, inner_w=INNER_W, inner_h=INNER_H,
        band_x1=BAND_X1, band_y1=BAND_Y1,
        band_x2=BAND_X2, band_y2=BAND_Y2,
        band_x3=BAND_X3, band_y3=BAND_Y3,
        band_x4=BAND_X4, band_y4=BAND_Y4,
        dot1_x=DOT1_X, dot2_x=DOT2_X, dot3_x=DOT3_X, dot_y=BASELINE_Y,
        band=band_color, accent=accent, outline=outline, detail=detail,
        body=body, lid=lid, inner=inner, tongue_cut=tongue_cut,
        text_block=text_block,
    )


def normalize_key(brand: str, name: str, film_format: str | None) -> str:
    key = f"{brand}|{name}|{film_format or ''}"
    return key.replace(" ", "").replace("-", "").lower()


def normalize_brand_key(brand: str) -> str:
    return brand.replace(" ", "").replace("-", "").lower()


def sanitize_key(key: str) -> str:
    lower = key.lower().replace("|", "_")
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789_")
    result = []
    for ch in lower:
        result.append(ch if ch in allowed else "_")
    sanitized = "".join(result)
    while "__" in sanitized:
        sanitized = sanitized.replace("__", "_")
    return sanitized.strip("_")


def asset_name_for(entry) -> str:
    key = normalize_key(entry["brand"], entry["name"], entry.get("filmFormat"))
    return "filmstock_" + sanitize_key(key)


def brand_asset_name(brand: str) -> str:
    return "filmstock_brand_" + sanitize_key(normalize_brand_key(brand))


def render_png(svg_path: pathlib.Path, png_path: pathlib.Path):
    rsvg = shutil.which("rsvg-convert")
    if not rsvg:
        raise RuntimeError("rsvg-convert not found; please install it to render PNGs.")
    subprocess.run(
        [rsvg, "-w", "1024", "-h", "1024", "-o", str(png_path), str(svg_path)],
        check=True
    )


def write_imageset(asset_root: pathlib.Path, asset_name: str, png_path: pathlib.Path):
    imageset = asset_root / f"{asset_name}.imageset"
    imageset.mkdir(parents=True, exist_ok=True)
    target_png = imageset / f"{asset_name}.png"
    shutil.copyfile(png_path, target_png)
    contents = {
        "images": [
            {
                "idiom": "universal",
                "filename": target_png.name,
                "scale": "1x",
            }
        ],
        "info": {
            "version": 1,
            "author": "xcode",
        },
    }
    (imageset / "Contents.json").write_text(json.dumps(contents, ensure_ascii=False, indent=2) + "\n")


manifest = []
for e in entries:
    svg_name = e["id"] + ".svg"
    svg_path = SVG_DIR / svg_name
    svg_path.write_text(make_svg(e, show_text=True))
    png_path = PNG_DIR / (e["id"] + ".png")
    render_png(svg_path, png_path)
    write_imageset(ASSETS_DIR, asset_name_for(e), png_path)
    manifest.append({
        "id": e["id"],
        "brand": e["brand"],
        "name": e["name"],
        "filmFormat": e.get("filmFormat"),
        "svg": str(svg_path),
        "png": str(png_path),
        "primary": palette_for(e)[0],
        "accent": palette_for(e)[1],
    })

# Brand-level blank icons (no text)
brand_names = sorted({entry["brand"] for entry in entries})
brand_names.extend(["Digital", "Generic"])
for brand in brand_names:
    brand_entry = {"id": f"brand|{brand}", "brand": brand, "name": "", "filmFormat": ""}
    svg_name = f"brand|{brand}.svg"
    svg_path = SVG_DIR / svg_name
    svg_path.write_text(make_svg(brand_entry, show_text=False))
    png_path = PNG_DIR / f"brand|{brand}.png"
    render_png(svg_path, png_path)
    write_imageset(ASSETS_DIR, brand_asset_name(brand), png_path)

(BASE_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(f"Generated {len(entries)} SVGs")
