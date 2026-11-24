#!/bin/sh
# Lleva la música de recursos-fv/sonidos/musica/ a src/assets/audio/, en OGG (Opus) y MP3 (Safari no lee
# OGG). Recorta el silencio del principio y del final para que el bucle no tenga hueco: los
# cortes (inicio y fin, en segundos) salen de
#   ffmpeg -i "<archivo>" -af silencedetect=n=-45dB:d=0.3 -f null -
# Se corre desde la raíz del proyecto:  sh recursos-fv/scripts/convertir-musica.sh
# Necesita ffmpeg.
set -e
M=recursos-fv/sonidos/musica
A=src/assets/audio

convert() { # origen inicio fin destino
  ffmpeg -v error -y -i "$1" -af "atrim=$2:$3,asetpts=PTS-STARTPTS" -c:a libopus -b:a 80k "$A/$4.ogg"
  ffmpeg -v error -y -i "$1" -af "atrim=$2:$3,asetpts=PTS-STARTPTS" -c:a libmp3lame -b:a 128k "$A/$4.mp3"
}

convert "$M/musica-menu - Cantina de Noche (Suno, 70 bpm).mp3" 0 183.5 musica-menu
convert "$M/musica-partida - Gran Quispe (ElevenLabs, 70 bpm).mp3" 2.7 121.57 musica-partida
