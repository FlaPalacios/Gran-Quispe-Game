"""Recorta la hoja de 4 stickers en las reacciones del modo online.

Cada sticker es un círculo sobre fondo crema: se busca su recuadro en cada cuarto de la hoja y
se recorta con una máscara circular suavizada, así el fondo queda transparente.
Se corre desde la raíz del proyecto:  python recursos-fv/scripts/recortar-reacciones.py
"""
from PIL import Image, ImageDraw
import numpy as np

SOURCE = 'recursos-fv/graficos/reacciones/reacciones-hoja.png'
TARGET = 'src/assets/images/shared/reaccion-{}.webp'
SIZE = 256
# En orden de lectura: arriba a la izquierda, arriba a la derecha, abajo...
NAMES = ['risa', 'mentiroso', 'salud', 'sorpresa']

sheet = Image.open(SOURCE).convert('RGB')
pixels = np.asarray(sheet).astype(int)
H, W, _ = pixels.shape
ink = np.abs(pixels - pixels[5, 5]).sum(axis=2) > 40

for i, name in enumerate(NAMES):
    qy, qx = divmod(i, 2)
    y0, x0 = qy * H // 2, qx * W // 2
    ys, xs = np.where(ink[y0:y0 + H // 2, x0:x0 + W // 2])
    left, right, top = x0 + xs.min(), x0 + xs.max(), y0 + ys.min()
    radius = (right - left) / 2  # la sombra cae abajo: el ancho da el círculo
    cx, cy = (left + right) / 2, top + radius
    box = (round(cx - radius), round(cy - radius), round(cx + radius), round(cy + radius))
    crop = sheet.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    big = Image.new('L', (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(big).ellipse((2, 2, SIZE * 4 - 3, SIZE * 4 - 3), fill=255)
    crop.putalpha(big.resize((SIZE, SIZE), Image.LANCZOS))
    crop.save(TARGET.format(name), 'WEBP', quality=88)
    print(name, box)
