from pathlib import Path

from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parent.parent / "public" / "fonts"
files = sorted(fonts.glob("*.otf"))
if not files:
    raise SystemExit(f"No hay .otf en {fonts}. Copia primero los 4 archivos (ver LEEME.txt).")

for otf in files:
    out = otf.with_suffix(".woff2")
    font = TTFont(otf)
    font.flavor = "woff2"
    font.save(out)
    print(f"{otf.name}: {otf.stat().st_size // 1024} KB -> {out.name}: {out.stat().st_size // 1024} KB")