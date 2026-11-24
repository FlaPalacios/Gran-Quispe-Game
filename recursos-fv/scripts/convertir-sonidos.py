"""Lleva los sonidos grabados por Flavio a src/assets/audio/.

De cada uno salen dos archivos, porque Safari no lee OGG y el resto sí (y pesa menos):
OGG (Opus) y MP3. Las grabaciones vienen con volúmenes muy distintos y bastante bajos, así
que se normalizan al mismo pico; el ajuste fino de cuál suena más fuerte que cuál va en la
tabla SFX de src/app/audio.js, no aquí.

Se corre desde la raíz del proyecto:  python "recursos-fv/scripts/convertir-sonidos.py"
Necesita:  pip install av numpy
"""
import av
import numpy as np
import os
from fractions import Fraction

SOURCE = 'recursos-fv/sonidos/efectos-grabados'
TARGET = 'src/assets/audio'
RATE = 44100
PEAK = 0.95

# Archivo original → nombre en el juego
SOUNDS = {
    'sonido cerveza empezar juego': 'sfx-empezar',
    'Sonido revelar dadoss': 'sfx-destapar',
    'Risa Cholada': 'sfx-cholada',
    'Risa Descubierto hombre': 'sfx-risa-hombre',
    'Risa Descubierto hombre 2': 'sfx-risa-hombre-2',
    'Risa Descubierto abuela': 'sfx-risa-abuela',
    'Sonido Cerveza ganar': 'sfx-cerveza-ganar',
    'Sonido de Ganar': 'sfx-gana-partida',
    'Sonido de Perder': 'sfx-eliminado',
}


def load(path):
    """Decodifica a mono, 44,1 kHz y coma flotante."""
    with av.open(path) as container:
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=RATE)
        chunks = []
        for frame in container.decode(container.streams.audio[0]):
            for resampled in resampler.resample(frame):
                chunks.append(resampled.to_ndarray().reshape(-1))
        for resampled in resampler.resample(None):
            chunks.append(resampled.to_ndarray().reshape(-1))
    return np.concatenate(chunks)


def frames(samples, rate):
    """Parte las muestras en cuadros, remuestreando si el codec pide otra frecuencia."""
    resampler = av.AudioResampler(format='fltp', layout='mono', rate=rate)
    out = []
    for i in range(0, len(samples), 1024):
        frame = av.AudioFrame.from_ndarray(
            np.ascontiguousarray(samples[i:i + 1024].reshape(1, -1)), format='fltp', layout='mono'
        )
        frame.sample_rate = RATE
        frame.time_base = Fraction(1, RATE)
        frame.pts = i
        out.extend(resampler.resample(frame))
    out.extend(resampler.resample(None))
    return out


def save(samples, path, codec, rate, bit_rate):
    with av.open(path, 'w') as container:
        stream = container.add_stream(codec, rate=rate, layout='mono')
        stream.bit_rate = bit_rate
        position = 0
        for frame in frames(samples, rate):
            frame.pts = position
            position += frame.samples
            container.mux(stream.encode(frame))
        container.mux(stream.encode(None))


for source, name in SOUNDS.items():
    samples = load(f'{SOURCE}/{source}.mp3')
    samples = (samples * (PEAK / np.abs(samples).max())).astype(np.float32)
    # Opus graba a 48 kHz; el MP3 se queda en la frecuencia original
    save(samples, f'{TARGET}/{name}.ogg', 'libopus', 48000, 64000)
    save(samples, f'{TARGET}/{name}.mp3', 'libmp3lame', RATE, 96000)
    size = lambda ext: os.path.getsize(f'{TARGET}/{name}.{ext}') // 1024
    rms = np.sqrt((samples ** 2).mean())
    print(f'{name}: {len(samples) / RATE:.2f}s  fuerza {rms:.3f}  ogg {size("ogg")} KB  mp3 {size("mp3")} KB')
