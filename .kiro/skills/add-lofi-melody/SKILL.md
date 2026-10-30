---
name: add-lofi-melody
description: Crear y registrar melodías lofi nuevas para la música de fondo (Tone.js) como archivos JSON, sin audios. Actívala cuando se pida agregar, componer, cambiar o validar melodías, o ajustar el sonido del pomodoro.
---

# Agregar una melodía

La música se genera en el navegador con Tone.js (CDN). Cada melodía es un archivo JSON en `melodies/`. No se agregan archivos de audio.

## Formato

```json
{
  "name": "Nombre visible",
  "bpm": 72,
  "chords": [["D4", "F4", "A4", "C5"], ["G3", "B3", "D4", "F4"]],
  "bass": ["D2", "G2"],
  "melody": [
    ["C5", "E5", null, "A5", null, "G5", null, null],
    [null, "D5", null, "B4", "D5", null, null, null]
  ]
}
```

| Campo | Significado |
|-------|-------------|
| `name` | Nombre legible |
| `bpm` | Opcional, 72 por defecto. Lofi funciona bien entre 60 y 85 |
| `chords` | Notas del acorde de cada compás (3 a 5 notas) |
| `bass` | Nota raíz de cada compás (octavas 1 a 3) |
| `melody` | 8 corcheas por compás; `null` es silencio |

**Las tres listas deben tener el mismo número de compases** (`validSong` en `lofi.js` descarta las demás).

## Pasos

1. Crear `melodies/<nombre-en-kebab-case>.json`.
2. Agregar el nombre del archivo a `melodies/index.json` (el navegador no puede listar carpetas).
3. Probar: activar **Música de fondo** en Foco. Se elige una melodía al azar; recargar hasta que salga la nueva o dejar solo esa en `index.json` temporalmente.
4. Actualizar el changelog del módulo pomodoro.

## Cómo componer algo que suene lofi

- Acordes de séptima y novena (maj7, m7, m9) con progresiones tipo ii–V–I (Dm7 – G7 – Cmaj7 – Am7).
- 4 u 8 compases que se repiten. Los acordes en registro medio (octavas 3 y 4).
- Melodía escasa: 3 a 5 notas por compás y muchos silencios. Notas del acorde y de su escala pentatónica.
- Bajo en la raíz, grave y simple.
- No se necesita percusión: ya la genera `lofi.js` (bombo, caja y hi-hat con swing).

## Validación rápida

```bash
node -e "const m=require('./melodies/mi-melodia.json');const ok=m.chords.length===m.bass.length&&m.bass.length===m.melody.length&&m.melody.every(r=>r.length===8);console.log(ok?'OK':'Revisar largos')"
```

Los archivos inválidos se ignoran sin error; si no suena, revisar la consola de red (`index.json` y el archivo deben responder 200) y el formato.

## Reglas

- Notas en notación científica de Tone.js (`C4`, `F#3`, `Bb4`).
- Nombres de archivo en minúsculas y sin espacios.
- No cambiar `lofi.js` para una melodía nueva. Si hace falta un comportamiento nuevo (otro tipo de patrón de batería, por ejemplo), crear una spec.
