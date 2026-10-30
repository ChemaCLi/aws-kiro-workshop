# Spec 06: Sonido y música

## Objetivo

Hacer la experiencia sensorial: una campanita al terminar la ronda y música lofi de fondo, sin archivos de audio y con melodías agregables por el usuario.

## Historias de usuario

1. Quiero oír y sentir (vibración) cuando termina una ronda aunque no mire la pantalla.
2. Quiero música tranquila para concentrarme, que pueda encender y apagar.
3. Quiero que la campanita se oiga aunque haya música.
4. Quiero agregar mis propias melodías sin saber programar audio.

## Criterios de aceptación

1. `feedback.js`: `unlockAudio()` (dentro de un gesto), `chime()` (tres notas senoidales: 659,25, 783,99 y 1046,5 Hz con Web Audio, sin Tone.js), `haptic()`.
2. Al terminar una ronda: si **Sonido** está activo suena la campanita; siempre vibra `[140, 70, 140]`.
3. Interruptor **Sonido** (activo por defecto) y **Música de fondo** (apagado por defecto) en Foco, ambos persistentes.
4. Tone.js por CDN con versión fija (`tone@14.8.49`), con `defer`. Si no carga, el interruptor de música aparece deshabilitado con "No disponible (sin conexión)" y nada falla.
5. `lofi.js` expone `isMusicAvailable`, `startMusic`, `stopMusic`, `setMusicVolume`, `duckMusic`, `isMusicPlaying`.
6. La música se sintetiza: acordes (PolySynth triangular), bajo, melodía (senoidal), bombo, caja y hi-hat con swing, ruido de vinilo, reverb, chorus y filtro pasa-bajos. Con fade-in y fade-out de 1,4 s.
7. Las melodías viven en `melodies/*.json` (formato en `melodies/README.md`), listadas en `melodies/index.json`. Al arrancar se elige una al azar. Las inválidas se ignoran.
8. Al sonar la campanita, la música baja ~12 dB por ~1,6 s (`duckMusic`) y regresa suave.
9. Si la música estaba activa al recargar, arranca en el primer toque del usuario.
10. `unlockAudio()` se llama en el primer toque de iniciar ronda o encender música.
11. Tests: `PO-17`, `PO-18`, `PO-19`.

## Fuera de alcance

Selector de melodía, control de volumen en pantalla, notificaciones del sistema.
