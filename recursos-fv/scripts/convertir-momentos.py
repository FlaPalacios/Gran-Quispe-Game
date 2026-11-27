"""Lleva los sonidos de los momentos de fin de ronda a src/assets/audio/.

Cada uno se recorta (sin silencio delante, para que caiga junto con el texto), se comprime un
poco y se nivela en sonoridad percibida (LUFS: se mide con loudnorm y se aplica la ganancia
con un limitador) al nivel de las voces de los personajes, que rondan los -17 LUFS. Así suenan
parejos entre sí; el ajuste fino sigue en la tabla SFX de src/app/audio.js. Salen en OGG (Opus) y MP3 (Safari no lee OGG).

Se corre desde la raíz del proyecto:  python "recursos-fv/scripts/convertir-momentos.py"
Necesita ffmpeg.
"""
import json
import re
import subprocess

SOURCE = 'recursos-fv/sonidos/efectos-grabados'
TARGET = 'src/assets/audio'
# LUFS medidos sobre el original en estéreo; al pasar a mono queda unos 2 puntos más bajo,
# en -17, como las voces
LOUDNESS = -15
PEAK = -1.5  # dBTP

# Archivo original → (nombre en el juego, inicio, fin en segundos). Los cortes salen de mirar
# la envolvente: el sonido útil, sin el silencio de los videos.
SOUNDS = {
    'mentiste mal.mp3': ('sfx-mentiste-mal', 0.17, 0.5),
    'te equivocaste.mp3': ('sfx-te-equivocaste', 0, 0.46),
    'te equivocaste golpe.mp4': ('sfx-te-equivocaste-golpe', 0.42, 1.2),
    # El pedo fuerte; lo de antes es soplido de fondo
    'cholada-Fart.m4a': ('sfx-cholada', 0.11, 0.95),
    'perder una vida.mp4': ('sfx-perder-vida', 1.42, 1.95),
    'tomaaaas.mp3': ('sfx-tomaaas', 0.04, 4.99),
}

COMPRESS = 'acompressor=threshold=-18dB:ratio=3:attack=5:release=120'


def run(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', *args], capture_output=True, text=True, check=True)


RATE = 48000


def chain(start, end, extra=''):
    fade = f'afade=t=out:st={end - start - 0.05:.3f}:d=0.05'
    return f'atrim={start}:{end},asetpts=PTS-STARTPTS,aresample={RATE},{COMPRESS},{fade}{extra}'


for source, (name, start, end) in SOUNDS.items():
    path = f'{SOURCE}/{source}'
    # La sonoridad se mide en bloques de 400 ms: los clips más cortos se miden repetidos
    loop = f',aloop=loop=8:size={int((end - start) * RATE)}'
    measure = run(['-i', path, '-vn', '-af', chain(start, end, loop + ',loudnorm=print_format=json'), '-f', 'null', '-'])
    stats = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', measure.stderr).group(0))
    gain = LOUDNESS - float(stats['input_i'])
    af = chain(start, end, f',volume={gain:.2f}dB,alimiter=limit={10 ** (PEAK / 20):.3f}:level=false')
    run(['-y', '-i', path, '-vn', '-af', af, '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', f'{TARGET}/{name}.ogg'])
    run(['-y', '-i', path, '-vn', '-af', af, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', f'{TARGET}/{name}.mp3'])
    print(name, 'medido', stats['input_i'], 'LUFS, ganancia', round(gain, 1), 'dB')
