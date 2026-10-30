# Diseño: Sonido y música

## Archivos

```
index.html                   + <script src="…/tone@14.8.49/build/Tone.js" defer>
melodies/index.json          ["jazzy-amin.json"]
melodies/jazzy-amin.json     primera melodía
melodies/README.md           formato para agregar melodías
src/core/feedback.js         + unlockAudio, chime
src/core/lofi.js             música
src/components/focus-view.js + interruptores de sonido y música
src/components/app-shell.js  + reacción al evento 'round', reanudar música tras recarga
```

## `feedback.js`

- Un `AudioContext` perezoso (`audio ??=`) y `unlockAudio()` que lo reanuda si está suspendido.
- `chime()` usa osciladores senoidales con envolvente exponencial (ataque 0,02 s, caída 0,5 s), una nota cada 0,16 s.

## `lofi.js`

Todo defensivo: cada función de la API comprueba `resolveTone()`.

1. `loadMelodies()` pide `index.json` una sola vez y valida cada archivo con `validSong` (listas no vacías y del mismo largo).
2. `build()` crea una sola vez la cadena: `Volume → Reverb → Filter → Chorus`, instrumentos y percusión sintética, ruido de vinilo, `Transport.swing = 0.3`.
3. Cuatro `Tone.Loop` de un compás (acordes, bajo, melodía, batería). El compás actual se toma de `Transport.seconds`, así que cualquier largo de melodía funciona.
4. `startMusic()`: `Tone.start()` (requiere gesto), elige melodía al azar, ajusta bpm (72 por defecto), inicia `Transport` y sube el volumen con rampa.
5. `stopMusic()`: rampa a silencio; el `Transport` se detiene tras el fade.
6. `duckMusic(ms)`: bajada y regreso **programados en el reloj de audio**, no con `setTimeout`.
7. `globalThis.__lofi` para probar en consola.

## Integración

- `app-shell` escucha `store` → `round`: si `settings.sound`, `chime()` y `duckMusic()`; siempre `haptic([140, 70, 140])`.
- Si `settings.music` está activo al cargar, se registra un `pointerdown` de una sola vez que llama `startMusic()`.
- En `focus-view`, el interruptor de música llama `unlockAudio()`, `setSetting('music', on)` y `startMusic()`/`stopMusic()`.

## Decisiones

- **Tone.js por CDN y melodías en JSON**: sin audios, extensible por cualquier persona (skill `add-lofi-melody`).
- La campanita no usa Tone.js para seguir sonando aunque Tone.js no cargue.
