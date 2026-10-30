#!/usr/bin/env python3
"""Inserta una diapositiva en presentation.html y deja la numeración consistente.

Qué mantiene sincronizado (lo que la skill `presentacion-taller` pide al agregar una diapositiva):
  - el `id` de cada <section class="deck-slide">,
  - el `aria-label` "Slide N of TOTAL",
  - la lista `slides` del JSON `#deck-motion` del <head>.

Uso:
  python3 tools/insert_slide.py --after 20 --fragment /tmp/slide.html [--bg '#15161d'] [--transition fade]
  python3 tools/insert_slide.py --check          # solo valida la consistencia
  python3 tools/insert_slide.py --after 20 --fragment f.html --dry-run

El fragmento es un <section class="deck-slide" ...> completo; su id y aria-label se reescriben.
"""

import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_HTML = Path(__file__).resolve().parent.parent / 'presentation.html'

SECTION_OPEN = re.compile(r'<section class="deck-slide" id="\d+"([^>]*?)aria-label="Slide \d+ of \d+"')
MOTION_SCRIPT = re.compile(r'(<script type="application/json" id="deck-motion">)(.*?)(</script>)', re.S)


def dump_motion(motion):
    """Serializa igual que el archivo original (compacto, sin escapar acentos)."""
    return json.dumps(motion, separators=(',', ':'), ensure_ascii=False)


def read_motion(html):
    """Devuelve (match, dict) del JSON deck-motion; aborta si no se puede reescribir sin cambios."""
    match = MOTION_SCRIPT.search(html)
    if not match:
        sys.exit('No encontré el <script id="deck-motion">.')
    motion = json.loads(match.group(2))
    if dump_motion(motion) != match.group(2):
        sys.exit('El JSON deck-motion no sobrevive a un ida y vuelta; no lo toco para no reformatearlo.')
    return match, motion


def slide_spans(html):
    """Rangos (inicio, fin) de cada diapositiva, en orden."""
    starts = [m.start() for m in SECTION_OPEN.finditer(html)]
    spans = []
    for start in starts:
        end = html.index('</section>', start) + len('</section>')
        spans.append((start, end))
    return spans


def renumber(html):
    """Reasigna id y aria-label de todas las diapositivas según su orden."""
    total = len(slide_spans(html))
    counter = iter(range(1, total + 1))

    def rewrite(match):
        number = next(counter)
        return f'<section class="deck-slide" id="{number}"{match.group(1)}aria-label="Slide {number} of {total}"'

    return SECTION_OPEN.sub(rewrite, html)


def check(html):
    """Lista de problemas de consistencia (vacía si todo cuadra)."""
    problems = []
    spans = slide_spans(html)
    total = len(spans)
    _, motion = read_motion(html)
    if len(motion['slides']) != total:
        problems.append(f'deck-motion tiene {len(motion["slides"])} entradas y hay {total} diapositivas')
    for number, (start, _) in enumerate(spans, 1):
        tag = html[start:html.index('>', start)]
        if f'id="{number}"' not in tag or f'Slide {number} of {total}"' not in tag:
            problems.append(f'la diapositiva en posición {number} tiene id/aria-label desalineado')
    return problems


def insert_slide(html, after, fragment, bg, transition):
    spans = slide_spans(html)
    if not 0 <= after <= len(spans):
        sys.exit(f'--after debe estar entre 0 y {len(spans)}')
    insert_at = spans[after - 1][1] + 1 if after > 0 else spans[0][0]
    html = html[:insert_at] + fragment.strip() + '\n' + html[insert_at:]
    html = renumber(html)

    match, motion = read_motion(html)
    entry = {'bg': bg, 'steps': [{'hidden': [], 'events': [], 'auto': False}], 'embeds': []}
    if transition:
        entry = {'transition': transition, **entry}
    motion['slides'].insert(after, entry)
    return html[:match.start(2)] + dump_motion(motion) + html[match.end(2):]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--html', type=Path, default=DEFAULT_HTML)
    parser.add_argument('--after', type=int, help='número de diapositiva después de la cual insertar')
    parser.add_argument('--fragment', type=Path, help='archivo con el <section> de la nueva diapositiva')
    parser.add_argument('--bg', default='#15161d', help='fondo para deck-motion (default carbón)')
    parser.add_argument('--transition', default='', help='transición para deck-motion (p. ej. fade)')
    parser.add_argument('--check', action='store_true', help='solo validar consistencia')
    parser.add_argument('--dry-run', action='store_true', help='no escribe el archivo')
    args = parser.parse_args()

    html = args.html.read_text(encoding='utf-8')

    if args.check:
        problems = check(html)
        print('\n'.join(problems) if problems else f'OK: {len(slide_spans(html))} diapositivas consistentes')
        sys.exit(1 if problems else 0)

    if args.after is None or args.fragment is None:
        parser.error('--after y --fragment son obligatorios (o usa --check)')

    result = insert_slide(html, args.after, args.fragment.read_text(encoding='utf-8'), args.bg, args.transition)
    problems = check(result)
    if problems:
        sys.exit('El resultado quedó inconsistente:\n' + '\n'.join(problems))
    if args.dry_run:
        print(f'Dry-run OK: quedarían {len(slide_spans(result))} diapositivas')
        return
    args.html.write_text(result, encoding='utf-8')
    print(f'Insertada después de la {args.after}. Total: {len(slide_spans(result))} diapositivas')


if __name__ == '__main__':
    main()
