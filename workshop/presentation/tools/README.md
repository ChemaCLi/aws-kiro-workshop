# compress-videos.sh

Comprime videos grabados con la app de Screenshot de macOS (`.mov`) a archivos
`.mp4` livianos y sin audio, listos para usar en la presentación.

Qué hace, por cada video de entrada:

- Quita el audio (las grabaciones no tienen audio útil).
- Reduce la resolución (60% por defecto).
- Limita los cuadros por segundo (24 fps por defecto).
- Re-codifica a H.264 con buena compresión (`crf` configurable).
- Agrega `faststart` para que el video cargue rápido en el navegador.

El `.mov` original **no se borra ni se sobreescribe** (a menos que uses
`--delete-originals`). El resultado se guarda junto al original con el mismo
nombre y extensión `.mp4`.

## Requisitos

Solo necesitas [`ffmpeg`](https://ffmpeg.org) instalado. En macOS, con
[Homebrew](https://brew.sh):

```bash
brew install ffmpeg
```

Verifica que quedó instalado:

```bash
ffmpeg -version
```

## Uso básico

Desde la raíz del repo, comprime todos los `.mov` que haya en
`workshop/presentation/assets/`:

```bash
./workshop/presentation/tools/compress-videos.sh
```

Esto genera un `.mp4` por cada `.mov` encontrado, en la misma carpeta.

### Comprimir un video específico

```bash
./workshop/presentation/tools/compress-videos.sh "workshop/presentation/assets/video - demo.mov"
```

### Ver qué haría sin ejecutar nada (dry-run)

```bash
./workshop/presentation/tools/compress-videos.sh --dry-run
```

### Sobreescribir un `.mp4` ya generado

Por defecto, si el `.mp4` de destino ya existe, el script lo salta.

```bash
./workshop/presentation/tools/compress-videos.sh --overwrite
```

### Borrar el `.mov` original tras comprimir

Solo borra el original si el resultado comprimido quedó más pequeño:

```bash
./workshop/presentation/tools/compress-videos.sh --delete-originals
```

## Opciones disponibles

| Opción | Default | Descripción |
|---|---|---|
| `-i, --input-dir DIR` | `../assets` | Carpeta donde buscar videos (si no se pasan archivos explícitos) |
| `-o, --output-dir DIR` | misma carpeta del original | Carpeta donde guardar los `.mp4` |
| `-e, --ext EXT` | `mov` | Extensión de origen a buscar en `--input-dir` |
| `-s, --scale FACTOR` | `0.6` | Factor de escala de resolución (`0.5` = mitad de tamaño) |
| `-f, --fps FPS` | `24` | Cuadros por segundo del video de salida |
| `-c, --crf VALUE` | `28` | Calidad x264 (más bajo = mejor calidad y más peso) |
| `-p, --preset PRESET` | `slow` | Preset de codificación x264 (velocidad vs. compresión) |
| `--delete-originals` | off | Borra el `.mov` original si el `.mp4` quedó más chico |
| `--overwrite` | off | Sobreescribe el `.mp4` de destino si ya existe |
| `--dry-run` | off | Muestra qué haría sin codificar nada |
| `-h, --help` | | Muestra la ayuda |

## Ejemplos

Comprimir más agresivo (más pequeño, menos calidad):

```bash
./workshop/presentation/tools/compress-videos.sh --scale 0.5 --fps 20 --crf 32
```

Comprimir un video nuevo que acabas de grabar y reemplazar el original:

```bash
./workshop/presentation/tools/compress-videos.sh --overwrite --delete-originals \
  "workshop/presentation/assets/video - nueva demo.mov"
```

## Resultados de referencia

Con la configuración por defecto (`scale=0.6`, `fps=24`, `crf=28`), los 4
videos de la demo pasaron de **56.4MB a ~4.4MB (-96%)** sin pérdida visible de
calidad (texto y UI siguen nítidos).

---

# insert_slide.py

Inserta una diapositiva en `presentation.html` y deja todo sincronizado: el `id`
de cada `<section class="deck-slide">`, su `aria-label` ("Slide N of TOTAL") y la
lista `slides` del JSON `#deck-motion`. Solo usa la librería estándar de Python 3.

```bash
# Insertar después de la diapositiva 20 (el fragmento es un <section> completo)
python3 workshop/presentation/tools/insert_slide.py --after 20 --fragment /tmp/slide.html --transition fade

# Probar sin escribir
python3 workshop/presentation/tools/insert_slide.py --after 20 --fragment /tmp/slide.html --dry-run

# Solo validar que ids, labels y deck-motion cuadran
python3 workshop/presentation/tools/insert_slide.py --check
```

| Opción | Default | Descripción |
|---|---|---|
| `--after N` | | Número de diapositiva después de la cual insertar |
| `--fragment FILE` | | Archivo con el `<section>` nuevo (su id y aria-label se reescriben) |
| `--bg COLOR` | `#15161d` | Fondo registrado en `deck-motion` |
| `--transition NAME` | ninguna | Transición en `deck-motion` (p. ej. `fade`) |
| `--check` | off | Valida la consistencia y termina |
| `--dry-run` | off | No escribe el archivo |
