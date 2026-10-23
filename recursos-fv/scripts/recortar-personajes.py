"""Recorta las hojas de personajes de la cantina a 512 x 768 por personaje.

Las tres hojas (neutral, descubierto y descubre) vienen dibujadas a distinta escala y
altura, así que no basta con partirlas en cuatro: si cada recorte se ajustara por su
cuenta, la cara pegaría un salto al cambiar de expresión. Aquí se alinean entre sí (se
busca con qué escala y desplazamiento se solapan más las siluetas), se toma la caja que
abarca las tres poses —para que no quede cortado un brazo levantado ni un dedo
señalando— y se aplica el mismo encuadre a las tres.

Se corre desde la raíz del proyecto:  python "recursos-fv/scripts/recortar-personajes.py"
Necesita:  pip install pillow numpy
"""
from PIL import Image
import numpy as np
import os

SHEETS = {
    'neutral': 'recursos-fv/graficos/personajes/Personajes_Caricaturescos_en_Cuadrícula.png',
    # Ojo: los nombres de las hojas quedaron cruzados respecto a lo que dibujan
    'descubierto': 'recursos-fv/graficos/personajes/Cuatro retratos cómicos de vergüenza.png',
    'descubre': 'recursos-fv/graficos/personajes/Personajes_Cuando lo pillan mintiendo.png',
}
CHARACTERS = 4
QW, QH = 512, 768  # cada personaje, y también cada celda de la cuadrícula 2 x 2
MARGIN = 8
PNG_DIR = 'recursos-fv/graficos/png-originales'
WEBP_DIR = 'src/assets/images/cantina'


def quadrant(sheet, i):
    row, col = divmod(i, 2)
    return sheet.crop((col * QW, row * QH, (col + 1) * QW, (row + 1) * QH))


def mask(img, threshold=16):
    return np.asarray(img.getchannel('A')) > threshold


def place(img, scale, dx, dy):
    """Escala img y la pega en un lienzo del tamaño de un personaje."""
    out = Image.new('RGBA', (QW, QH), (0, 0, 0, 0))
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    out.alpha_composite(img.resize(size, Image.LANCZOS), (round(dx), round(dy)))
    return out


def overlap(target, src, scale, dx, dy):
    small = mask(src.resize((round(QW * scale), round(QH * scale)), Image.NEAREST))
    canvas = np.zeros((QH, QW), bool)
    y0, x0 = max(0, dy), max(0, dx)
    y1, x1 = min(QH, dy + small.shape[0]), min(QW, dx + small.shape[1])
    if y1 <= y0 or x1 <= x0:
        return 0
    canvas[y0:y1, x0:x1] = small[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    return np.logical_and(target, canvas).sum() / np.logical_or(target, canvas).sum()


def fit(target, src):
    """Con qué escala y desplazamiento src calza mejor sobre target. Primero grueso, luego fino."""
    best = (0, 1.0, 0, 0)
    for step in ('grueso', 'fino'):
        if step == 'grueso':
            scales, xs, ys = np.arange(0.80, 1.21, 0.02), range(-80, 81, 8), range(-80, 81, 8)
        else:
            _, s, dx, dy = best
            scales = np.arange(s - 0.02, s + 0.021, 0.005)
            xs, ys = range(dx - 8, dx + 9, 2), range(dy - 8, dy + 9, 2)
        best = (0, best[1], best[2], best[3])
        for scale in scales:
            for dy in ys:
                for dx in xs:
                    value = overlap(target, src, float(scale), int(dx), int(dy))
                    if value > best[0]:
                        best = (value, float(scale), int(dx), int(dy))
    return best


sheets = {name: Image.open(path).convert('RGBA') for name, path in SHEETS.items()}
os.makedirs(PNG_DIR, exist_ok=True)

for i in range(CHARACTERS):
    neutral = quadrant(sheets['neutral'], i)
    reference = mask(neutral)
    poses = {'neutral': (neutral, 1.0, 0, 0)}
    for pose in ('descubierto', 'descubre'):
        cell = quadrant(sheets[pose], i)
        value, scale, dx, dy = fit(reference, cell)
        poses[pose] = (cell, scale, dx, dy)
        print(f'  personaje {i + 1} {pose}: calce {value:.2f}, escala {scale:.3f}, mueve ({dx}, {dy})')

    # La caja que abarca las tres poses: el encuadre que sirve para todas
    boxes = []
    for cell, scale, dx, dy in poses.values():
        ys, xs = np.nonzero(mask(place(cell, scale, dx, dy)))
        boxes.append((xs.min(), xs.max(), ys.min(), ys.max()))
    x0, x1 = min(b[0] for b in boxes), max(b[1] for b in boxes)
    y0, y1 = min(b[2] for b in boxes), max(b[3] for b in boxes)

    frame = min((QW - MARGIN * 2) / (x1 - x0 + 1), (QH - MARGIN) / (y1 - y0 + 1))
    left = (QW - (x1 - x0 + 1) * frame) / 2 - x0 * frame  # centrado a lo ancho
    top = QH - (y1 + 1) * frame                           # apoyado en el borde de abajo

    for pose, (cell, scale, dx, dy) in poses.items():
        image = place(cell, scale * frame, left + dx * frame, top + dy * frame)
        name = f'cantina-personaje-{i + 1}' + ('' if pose == 'neutral' else f'-{pose}')
        image.save(f'{PNG_DIR}/{name}.png')
        image.save(f'{WEBP_DIR}/{name}.webp', 'WEBP', quality=86, method=6)
        print(f'    {name}.webp')
