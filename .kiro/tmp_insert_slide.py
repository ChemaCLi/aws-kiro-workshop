#!/usr/bin/env python3
"""Inserta una diapositiva nueva despues de 'Ahi es donde entra Kiro' (slide 22).
Renumera ids, aria-labels (ordinal y total) y agrega la entrada en #deck-motion."""
import re, json

P = 'workshop/presentation/presentation.html'
src = open(P, encoding='utf-8').read()
lines = src.split('\n')

NEW_TOTAL = 38

# --- Construir el HTML de la diapositiva nueva (sera slide 23) ---
card = (
    '<div style="display:flex;flex-direction:column;gap:10px;background:linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04));'
    'border:1px solid rgba(165,139,255,0.45);border-radius:20px;padding:28px 30px;box-sizing:border-box;">'
    '<div style="font-family:Inter, Arial, ui-sans-serif, system-ui, sans-serif;font-size:32px;font-weight:700;line-height:1.15;color:rgb(243,239,230);">{title}</div>'
    '<div style="font-family:Inter, Arial, ui-sans-serif, system-ui, sans-serif;font-size:24px;font-weight:400;line-height:1.4;color:rgb(201,196,184);">{desc}</div>'
    '</div>'
)

features = [
    ('Steerings', 'Reglas y contexto del proyecto que Kiro respeta siempre'),
    ('Custom Agents', 'Agentes a la medida, cada uno con su rol y sus permisos'),
    ('Specs', 'Requerimientos, diseno y tareas para trabajar con rigor'),
    ('Powers', 'Capacidades extra que amplian lo que Kiro puede hacer'),
    ('Memories', 'Recuerda tus proyectos y aprende de tus correcciones'),
    ('Workflows', 'Flujos de varios pasos y agentes que corren por ti'),
]
cards_html = ''.join(card.format(title=t, desc=d) for t, d in features)

NEW_SLIDE = (
    '<section class="deck-slide" id="23" aria-roledescription="slide" aria-label="Slide 23 of 38" '
    'data-document-role="page" data-label="Todo lo que Kiro trae de fabrica" '
    'data-speaker-notes="Kiro reune en una sola herramienta lo que antes estaba disperso: Steerings (reglas del proyecto), Custom Agents, Specs, Powers, Memories y Workflows. Ademas habla los estandares abiertos del ecosistema: Skills y archivos AGENTS.md, y se integra con servidores MCP. La idea es que no tengas que pegar piezas sueltas: ya viene todo junto.">'
    '<div class="deck-fit"><div class="deck-scaler">'
    '<div style="width: 1920px; height: 1080px; position: relative; background: rgb(21, 22, 29); overflow: clip; contain: paint;" class="slide" data-canvas-width="1920" data-canvas-height="1080">'
    '<div data-frame-id="aws-logo" style="position: absolute; left: 112px; top: 28px; width: 72px; height: 72px; z-index: 5; pointer-events: none;"><img src="assets/aws-logo.webp" alt="AWS" style="width: 72px; height: 72px; max-width: none; filter: drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95));"></div>'
    '<div data-frame-id="ug-label" style="position: absolute; left: 200px; top: 44px; z-index: 5; pointer-events: none; font-family: \'JetBrains Mono\', \'Courier New\', ui-monospace, Menlo, Consolas, monospace; font-size: 24px; font-weight: 500; letter-spacing: 0.14em; color: rgb(138, 180, 255);">// AWS User Group Orizaba</div>'
    '<div data-frame-id="kiro-logo" style="position: absolute; right: 112px; top: 28px; width: 45px; height: 60px; z-index: 5; pointer-events: none;"><img src="assets/kiro-logo-clean.png" alt="Kiro" style="width: 45px; height: 60px; max-width: none;"></div>'
    '<div style="position:absolute;inset:0;box-sizing:border-box;padding:120px 128px 96px;display:flex;flex-direction:column;gap:40px;">'
    # encabezado
    '<div style="display:flex;flex-direction:column;gap:14px;">'
    '<div style="font-family:\'JetBrains Mono\', \'Courier New\', ui-monospace, Menlo, Consolas, monospace;font-size:24px;font-weight:500;line-height:1.4;letter-spacing:0.16em;color:rgb(165,139,255);">&gt; TODO EN UN MISMO LUGAR</div>'
    '<div role="heading" aria-level="2" style="font-family:\'Space Grotesk\', Arial, ui-sans-serif, system-ui, sans-serif;font-size:72px;font-weight:700;line-height:1.1;color:rgb(243,239,230);">Todo lo que <span style="color:rgb(165,139,255);">Kiro</span> trae de fabrica</div>'
    '</div>'
    # grid de 6 features (3 columnas x 2 filas)
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;">' + cards_html + '</div>'
    # banda inferior: estandares y MCP
    '<div style="display:flex;align-items:center;gap:40px;padding:28px 36px;border-radius:20px;background:linear-gradient(135deg,rgba(165,139,255,0.16),rgba(165,139,255,0.06));border:1px solid rgba(165,139,255,0.55);box-sizing:border-box;">'
    '<div style="font-family:\'JetBrains Mono\', \'Courier New\', ui-monospace, Menlo, Consolas, monospace;font-size:22px;font-weight:600;letter-spacing:0.16em;color:rgb(165,139,255);white-space:nowrap;">&gt; ABIERTO</div>'
    '<div style="font-family:Inter, Arial, ui-sans-serif, system-ui, sans-serif;font-size:26px;font-weight:400;line-height:1.45;color:rgb(201,196,184);">Soporta estandares del ecosistema como <span style="color:rgb(243,239,230);font-weight:600;">Skills</span> y archivos <span style="color:rgb(243,239,230);font-weight:600;">AGENTS.md</span>, y se integra con servidores <span style="color:rgb(243,239,230);font-weight:600;">MCP</span>.</div>'
    '</div>'
    '</div>'
    '</div></div></div></section>'
)

# --- Insertar la seccion y renumerar ---
rx_sec = re.compile(r'(<section class="deck-slide" id=")(\d+)(" aria-roledescription="slide" aria-label="Slide )(\d+)( of )(\d+)(")')

out = []
inserted = False
for ln in lines:
    i = ln.find('<section class="deck-slide"')
    if i == -1:
        out.append(ln)
        continue
    m = rx_sec.search(ln)
    if not m:
        out.append(ln)
        continue
    ordinal = int(m.group(4))
    # Antes de la diapositiva 23, actualizar solo el total (de 37 a 38).
    def bump(match, add_id, add_ord):
        new_id = int(match.group(2)) + add_id
        new_ord = int(match.group(4)) + add_ord
        return f'{match.group(1)}{new_id}{match.group(3)}{new_ord}{match.group(5)}{NEW_TOTAL}{match.group(7)}'

    if ordinal <= 22:
        # solo cambia el total
        ln2 = rx_sec.sub(lambda mm: bump(mm, 0, 0), ln, count=1)
        out.append(ln2)
        if ordinal == 22 and not inserted:
            out.append(NEW_SLIDE)
            inserted = True
    else:
        # diapositivas 23..37 -> suben id y ordinal en 1, total 38
        ln2 = rx_sec.sub(lambda mm: bump(mm, 1, 1), ln, count=1)
        out.append(ln2)

assert inserted, 'No se encontro la diapositiva 22 para insertar despues'

new_src = '\n'.join(out)

# --- Actualizar el JSON de #deck-motion: insertar una entrada en el indice 22 ---
mjson = re.search(r'(id="deck-motion">)(.*?)(</script>)', new_src, re.S)
j = json.loads(mjson.group(2))
slides = j['slides']
# copia de la entrada de la diapositiva 22 (indice 21): fondo oscuro, sin auto steps
new_entry = {"transition": "fade", "bg": "#15161d", "steps": [{"hidden": [], "events": [], "auto": False}], "embeds": []}
slides.insert(22, new_entry)
j['slides'] = slides
new_json = json.dumps(j, separators=(',', ':'))
new_src = new_src[:mjson.start(2)] + new_json + new_src[mjson.end(2):]

open(P, 'w', encoding='utf-8').write(new_src)
print('OK: diapositiva insertada. total slides motion =', len(slides))
