# Melodías

Cada archivo `.json` de esta carpeta es una melodía lofi. Para agregar una:

1. Crea `mi-melodia.json` con este formato (un compás por elemento, todas las listas con el mismo largo):

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

- `chords`: notas del acorde de cada compás.
- `bass`: nota raíz de cada compás.
- `melody`: 8 corcheas por compás; `null` es silencio.
- `bpm` es opcional (por defecto 72).

2. Agrega el nombre del archivo a `index.json` (el navegador no puede listar carpetas).

Cada vez que arranca la música se elige una melodía al azar de la lista. Los archivos inválidos se ignoran.
