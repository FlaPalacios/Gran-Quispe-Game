"""Recorta la mesa, el cubilete y los dados ilustrados a archivos sueltos.

Mesa: se recorta al borde de la madera y se mide dónde cae el paño verde, porque de ahí
salen las medidas con las que la escena coloca el cubilete y los dados (ver props.js).

Cubilete: las tres poses salen de una sola hoja, así que ya vienen a la misma escala. Se
recortan sin reescalar y se centran sobre su punto de apoyo en la mesa, con el mismo lienzo
para las tres: así la escena solo cambia de textura, con el origen abajo al centro, y el
cubilete no pega un salto al inclinarse.

Dados: seis caras en una cuadrícula de 3 x 2 (arriba 1, 2, 3; abajo 4, 5, 6). Todos quedan
en el mismo lienzo, centrados, para que un 6 no se vea más grande que un 1.

Se corre desde la raíz del proyecto:  python "recursos-fv/scripts/recortar-objetos.py"
Necesita:  pip install pillow numpy
"""
from PIL import Image
import numpy as np
import os

SOURCE = 'recursos-fv/graficos/objetos'
PNG_DIR = 'recursos-fv/graficos/png-originales'
WEBP_DIR = 'src/assets/images/shared'
ALPHA = 16
CUP_POSES = ['cubilete-tapado', 'cubilete-inclinado', 'cubilete-volcado']
DICE_CELL = 512


def mask(image):
    return np.asarray(image.getchannel('A')) > ALPHA


def save(image, name):
    image.save(f'{PNG_DIR}/{name}.png')
    image.save(f'{WEBP_DIR}/{name}.webp', 'WEBP', quality=88, method=6)
    print(f'  {name}: {image.width} x {image.height}')


def bands(present, gap=10):
    """Tramos seguidos de columnas (o filas) con dibujo, separando por los huecos."""
    marks = np.nonzero(present)[0]
    out, start = [], marks[0]
    for i in range(1, len(marks)):
        if marks[i] - marks[i - 1] > gap:
            out.append((start, marks[i - 1]))
            start = marks[i]
    out.append((start, marks[-1]))
    return out


os.makedirs(PNG_DIR, exist_ok=True)
os.makedirs(WEBP_DIR, exist_ok=True)

# --- Mesa ---
table = Image.open(f'{SOURCE}/Mesa de póker rústica de fieltro verde.png').convert('RGBA')
table = table.crop(table.getchannel('A').getbbox())
save(table, 'mesa')

pixels = np.asarray(table).astype(int)
visible = pixels[..., 3] > 128
r, g, b = pixels[..., 0], pixels[..., 1], pixels[..., 2]
felt = visible & (g > r * 1.25) & (g > b * 1.25) & (g > 50)
ys, xs = np.nonzero(felt)
print('  medidas para props.js (fracciones del alto y el ancho de la mesa):')
print(f'    proporción de la mesa {table.width / table.height:.3f}')
print(f'    paño: centro ({(xs.min() + xs.max()) / 2 / table.width:.4f}, '
      f'{(ys.min() + ys.max()) / 2 / table.height:.4f}), '
      f'tamaño ({(xs.max() - xs.min() + 1) / table.width:.4f}, '
      f'{(ys.max() - ys.min() + 1) / table.height:.4f})')
print(f'    color del paño: {[int(c) for c in pixels[..., :3][felt].mean(axis=0)]}')

# --- Cubilete: tres poses sobre su punto de apoyo ---
cups = Image.open(f'{SOURCE}/Tres vasos de cuero ilustrados.png').convert('RGBA')
cup_mask = mask(cups)
poses = []
for x0, x1 in bands(cup_mask.any(axis=0)):
    column = cup_mask[:, x0:x1 + 1]
    rows = np.nonzero(column.any(axis=1))[0]
    bottom = rows.max()
    # Donde se apoya: el centro de lo que toca la mesa en las últimas filas
    touching = np.nonzero(column[bottom - 4:bottom + 1].any(axis=0))[0]
    poses.append({
        'box': (x0, rows.min(), x1 + 1, bottom + 1),
        'anchor': x0 + int(round(touching.mean())),
        'bottom': bottom,
    })

# Un solo lienzo para las tres, con el apoyo justo al centro y abajo
reach = max(max(p['anchor'] - p['box'][0], p['box'][2] - p['anchor']) for p in poses)
tall = max(p['bottom'] - p['box'][1] + 1 for p in poses)
for name, pose in zip(CUP_POSES, poses):
    canvas = Image.new('RGBA', (reach * 2, tall), (0, 0, 0, 0))
    canvas.alpha_composite(cups.crop(pose['box']), (reach - (pose['anchor'] - pose['box'][0]), tall - (pose['bottom'] - pose['box'][1] + 1)))
    save(canvas, name)

# --- Dados: seis caras al mismo tamaño ---
sheet = Image.open(f'{SOURCE}/Colección de dados ilustrados 3D.png').convert('RGBA')
sheet_mask = mask(sheet)
faces = []
for row in range(2):
    band = sheet_mask[row * DICE_CELL:(row + 1) * DICE_CELL]
    rows = np.nonzero(band.any(axis=1))[0]
    for x0, x1 in bands(band.any(axis=0)):
        column = band[:, x0:x1 + 1]
        inside = np.nonzero(column.any(axis=1))[0]
        faces.append((x0, row * DICE_CELL + inside.min(), x1 + 1, row * DICE_CELL + inside.max() + 1))

width = max(x1 - x0 for x0, _, x1, _ in faces)
height = max(y1 - y0 for _, y0, _, y1 in faces)
for value, box in enumerate(faces, start=1):
    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    face = sheet.crop(box)
    canvas.alpha_composite(face, ((width - face.width) // 2, (height - face.height) // 2))
    save(canvas, f'dado-{value}')
