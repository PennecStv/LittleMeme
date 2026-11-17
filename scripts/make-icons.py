"""Génère le logo Little Meme et les icônes de l'app dans assets/. Lancer : python scripts/make-icons.py (nécessite Pillow)."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets'
FONT = ROOT / 'node_modules/@expo-google-fonts/montserrat/900Black/Montserrat_900Black.ttf'
BLUE, ORANGE, WHITE = (10, 26, 63), (255, 106, 0), (255, 255, 255)
S = 4  # suréchantillonnage pour des bords lisses


def mark(size, bubble=WHITE, ink=BLUE, bar=ORANGE, cutout=False):
    """Bulle de dialogue penchée avec un M et la barre orange. Fond transparent."""
    W = size * S
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    layer = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # bulle : carré arrondi + petite queue en bas à gauche
    x0, y0, x1, y1 = W * 0.12, W * 0.12, W * 0.88, W * 0.80
    d.rounded_rectangle((x0, y0, x1, y1), radius=W * 0.16, fill=bubble)
    d.polygon([(W * 0.24, y1 - W * 0.02), (W * 0.40, y1 - W * 0.02), (W * 0.18, W * 0.95)], fill=bubble)
    # M
    font = ImageFont.truetype(str(FONT), int(W * 0.46))
    l, t, r, b = d.textbbox((0, 0), 'M', font=font)
    cx, cy = W * 0.5, W * 0.42
    ink_fill = (0, 0, 0, 0) if cutout else ink
    d.text((cx - (l + r) / 2, cy - (t + b) / 2), 'M', font=font, fill=ink_fill)
    # barre sous le M
    bw, bh = W * 0.30, W * 0.065
    by = cy + (b - t) / 2 + W * 0.045
    d.rounded_rectangle((cx - bw / 2, by, cx + bw / 2, by + bh), radius=bh / 2, fill=(0, 0, 0, 0) if cutout else bar)
    layer = layer.rotate(6, resample=Image.BICUBIC, center=(W / 2, W / 2))
    img.alpha_composite(layer)
    return img.resize((size, size), Image.LANCZOS)


def on_bg(size, scale):
    """Logo centré sur fond bleu (icône iOS / générique, sans transparence)."""
    bg = Image.new('RGBA', (size, size), BLUE + (255,))
    m = mark(int(size * scale))
    off = (size - m.width) // 2
    bg.alpha_composite(m, (off, off))
    return bg.convert('RGB')


def padded(size, scale, **kw):
    """Logo centré sur fond transparent (zone de sécurité des icônes adaptatives Android)."""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    m = mark(int(size * scale), **kw)
    off = (size - m.width) // 2
    canvas.alpha_composite(m, (off, off))
    return canvas


OUT.mkdir(parents=True, exist_ok=True)
on_bg(1024, 0.86).save(OUT / 'icon.png')
padded(1024, 0.62).save(OUT / 'android-icon-foreground.png')
Image.new('RGB', (1024, 1024), BLUE).save(OUT / 'android-icon-background.png')
# monochrome (icônes thématiques Android) : silhouette blanche, M et barre découpés
padded(1024, 0.62, cutout=True).save(OUT / 'android-icon-monochrome.png')
padded(1024, 0.9).save(OUT / 'splash-icon.png')
on_bg(48, 0.9).save(OUT / 'favicon.png')
print('ok', OUT)
