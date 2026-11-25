"""Saca el logo del fondo negro con un contorno sólido, sin transparencias por dentro.

La versión anterior ponía la transparencia según el brillo de cada píxel: el cuero oscuro del
cubilete y el contorno negro quedaban medio transparentes y sobre el fondo del menú se veía
"lavado". Aquí: lo que brilla más que el halo es dibujo; se ensancha lo justo para tomar el
contorno negro, se rellenan los huecos encerrados (la boca del cubilete, los puntos de los
dados) y todo eso queda opaco. El halo del original se descarta.

Se corre desde la raíz del proyecto:  python recursos-fv/scripts/recortar-logo.py
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SOURCE = 'recursos-fv/graficos/Gran_Quispe_logo.png'
TARGET = 'src/assets/images/shared/logo.webp'
WIDTH = 1100
SUBJECT_MIN = 40   # el halo no pasa de ~25 en el canal más brillante; el dibujo, sí
OUTLINE_PX = 13    # cuánto se ensancha para tomar el contorno negro (mide ~18 px)

art = Image.open(SOURCE).convert('RGB')
bright = np.asarray(art).max(axis=2) > SUBJECT_MIN
mask = Image.fromarray((bright * 255).astype('uint8')).filter(ImageFilter.MaxFilter(OUTLINE_PX * 2 + 1))
# Fondo = lo oscuro conectado con el borde; lo demás (huecos incluidos) es dibujo
ImageDraw.floodfill(mask, (0, 0), 128)
alpha = Image.fromarray(np.where(np.asarray(mask) == 128, 0, 255).astype('uint8'))
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))

logo = art.copy()
logo.putalpha(alpha)
logo = logo.crop(alpha.getbbox())
logo = logo.resize((WIDTH, round(logo.height * WIDTH / logo.width)), Image.LANCZOS)
logo.save(TARGET, 'WEBP', quality=90)
print(TARGET, logo.size)

# Ícono: solo el cubilete con los dados (la parte de arriba del logo), cuadrado.
# icono.png con transparencia para la pestaña; icono-apple.png sobre fondo oscuro para la
# pantalla de inicio del iPhone, que no admite transparencia.
top = logo.crop((0, 0, logo.width, round(logo.height * 0.525)))
top = top.crop(top.getchannel('A').getbbox())
side = round(max(top.size) * 1.06)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
square.alpha_composite(top, ((side - top.width) // 2, (side - top.height) // 2))
square.resize((512, 512), Image.LANCZOS).save('src/assets/images/shared/icono.png', optimize=True)
apple = Image.new('RGBA', (180, 180), (0x12, 0x0d, 0x0a, 255))
apple.alpha_composite(square.resize((160, 160), Image.LANCZOS), (10, 10))
apple.convert('RGB').save('src/assets/images/shared/icono-apple.png', optimize=True)
print('iconos listos')

# Imagen para compartir el enlace (WhatsApp, redes): el banner con el logo en su tercio
# izquierdo, el más oscuro, como en "Acerca del juego". 1200x630 en JPEG, que leen todos.
banner = Image.open('recursos-fv/graficos/escenarios/banner - Dados andina bajo luz de cantina.png').convert('RGB')
scale = max(1200 / banner.width, 630 / banner.height)
banner = banner.resize((round(banner.width * scale), round(banner.height * scale)), Image.LANCZOS)
left, top = (banner.width - 1200) // 2, (banner.height - 630) // 2
share = banner.crop((left, top, left + 1200, top + 630)).convert('RGBA')
mark = logo.resize((390, round(logo.height * 390 / logo.width)), Image.LANCZOS)
share.alpha_composite(mark, (48, (630 - mark.height) // 2))
share.convert('RGB').save('public/compartir.jpg', quality=85, optimize=True)
print('public/compartir.jpg', share.size)
