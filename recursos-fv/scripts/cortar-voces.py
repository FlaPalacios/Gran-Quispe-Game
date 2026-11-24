"""Corta las grabaciones de voz de los personajes en un archivo por jugada o frase.

Cada grabación de recursos-fv/sonidos/voces/ trae todo seguido ("31, 32, 41…" o las frases).
Whisper da el momento de cada palabra; se corta a mitad de la pausa entre una y otra, se le
quita el silencio de los bordes y se normaliza al mismo pico. Salen OGG (Opus) y MP3 en
src/assets/audio/voces/voz-<personaje>-<clave>, que es lo que busca src/app/audio.js.

Se corre desde la raíz del proyecto:  python recursos-fv/scripts/cortar-voces.py
Necesita ffmpeg y  pip install faster-whisper  (usa el modelo "medium", ~1,5 GB la primera vez).

Para sumar a un personaje (por ejemplo, Don Dago como 4) se agregan sus dos grabaciones a
JOBS. En las frases hay que decir en qué palabra empieza cada una: se ve con la transcripción
que imprime el script (cada palabra con su número).
"""
import os
import re
import subprocess
from faster_whisper import WhisperModel

SOURCE = 'recursos-fv/sonidos/voces'
TARGET = 'src/assets/audio/voces'
CALLS = ['31', '32', '41', '42', '43', '51', '52', '53', '54', '61', '62', '63', '64', '65',
         '110', '120', '130', '140', '150', '160', 'quispe']
PHRASES = ['creo', 'desconfio', 'pille', 'pierdo', 'cholada', 'gano', 'fuera']

# (archivo, número de personaje, claves, palabra donde empieza cada clave o None si es una por palabra)
JOBS = [
    ('1 Alancito - jugadas.mp3', 1, CALLS, None),
    ('2 Doña Buricia - jugadas.mp3', 2, CALLS, None),
    ('3 Don Cucho - jugadas.mp3', 3, CALLS, None),
    # "Ya, te creo, causa." / "¡Mentira! ¡Destapa!" / "Te descubrí, chato." / "No, causa." /
    # "No pe, me he quinceado." / "¡Así se gana, sonsos!" / "Ya fui, mano."
    ('1 Alancito - frases.mp3', 1, PHRASES, [0, 4, 6, 9, 11, 16, 20]),
    # "Ya pues, hijito, te creo." / "Ay, mamita… a ver, destapa." / "¡Atatau, mentiroso! ¡A tu
    # abuelita no la engañas!" / "¡Achachau! ¡Me pillaron!" / "Ay, estos ojos ya no ven, hijito." /
    # "Así se juega, hijitos." / "Me voy a mi cuartito."
    ('2 Doña Buricia - frases.mp3', 2, PHRASES, [0, 5, 10, 18, 22, 29, 33]),
    # Sin frase de quedar fuera: "Ya, te creo. Por esta vez." / "No te creo ni el saludo." /
    # "Vas a pagar pato." / "Ya pues, como en la chamba." / "Necesito vacaciones." /
    # "Por fin algo me sale bien."
    ('3 Don Cucho - frases.mp3', 3, PHRASES[:6], [0, 6, 12, 16, 22, 24]),
]


def duration(path):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])
    return float(out)


def peak_db(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return float(re.search(r'max_volume: (-?[\d.]+) dB', err).group(1))


def main():
    model = WhisperModel('medium', device='cpu', compute_type='int8')
    os.makedirs(TARGET, exist_ok=True)
    for name, number, keys, starts in JOBS:
        path = os.path.join(SOURCE, name)
        segments, _ = model.transcribe(path, language='es', word_timestamps=True)
        words = [(w.start, w.end, w.word.strip()) for s in segments for w in s.words]
        print(name, ' '.join(f'{i}:{w}' for i, (_, _, w) in enumerate(words)))
        starts = starts or list(range(len(words)))
        assert len(starts) == len(keys), f'{name}: {len(starts)} cortes para {len(keys)} claves'
        spans = []
        for i, key in enumerate(keys):
            last = (starts[i + 1] if i + 1 < len(starts) else len(words)) - 1
            spans.append((words[starts[i]][0], words[last][1], key))

        total, gain = duration(path), -0.5 - peak_db(path)
        for i, (start, end, key) in enumerate(spans):
            # A mitad de la pausa con la vecina; después se recorta el silencio que sobre
            lo = 0 if i == 0 else (spans[i - 1][1] + start) / 2
            hi = total if i == len(spans) - 1 else (end + spans[i + 1][0]) / 2
            filters = (f'atrim={lo:.3f}:{hi:.3f},asetpts=PTS-STARTPTS,volume={gain:.2f}dB,'
                       'silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
                       'silenceremove=start_periods=1:start_threshold=-45dB,afade=t=in:d=0.03,areverse,'
                       'apad=pad_dur=0.04')
            base = os.path.join(TARGET, f'voz-{number}-{key}')
            for ext, codec in (('ogg', ['libopus', '-b:a', '40k']), ('mp3', ['libmp3lame', '-b:a', '64k'])):
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-af', filters, '-ac', '1',
                                '-c:a', *codec, f'{base}.{ext}'], check=True)


if __name__ == '__main__':
    main()
