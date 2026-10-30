# Focus Garden: funcionalidades

Tareas + pomodoro + jardín 3D + estadísticas. Mobile first, responsive, solo en español, sin build.

## Casos de uso disponibles

### Organizar mi día (módulo [todo-list](modules/todo-list/README.md))

| # | Caso de uso | Cómo se hace |
|---|-------------|--------------|
| T1 | Anotar una tarea en pocos toques | Botón **+**, escribir título, elegir tipo (se recuerda el último), **Agregar tarea** |
| T2 | Clasificar mis tareas | Cinco tipos con color y emoji: Trabajo, Personal, Salud, Social, Entretenimiento |
| T3 | Ver cuánto llevo | Tarjeta de progreso: "N de M" terminadas, barra y rondas del día |
| T4 | Enfocarme en una tarea | Botón ▶ de la fila: elige la tarea y abre Foco |
| T5 | Marcar una tarea como hecha | Tocar el círculo; si tiene rondas, aparece un aviso con su planta |
| T6 | Deshacer un error al completar | Tocar de nuevo el círculo de una tarea completada |
| T7 | Eliminar una tarea | Deslizar a la izquierda; toast con **Deshacer** |
| T8 | Filtrar por tipo | Chips bajo la tarjeta de progreso |

### Trabajar con enfoque (módulo [pomodoro](modules/pomodoro/README.md))

| # | Caso de uso | Cómo se hace |
|---|-------------|--------------|
| P1 | Elegir en qué enfocarme | Tarjeta superior de Foco o ▶ desde Tareas |
| P2 | Ajustar la duración de la ronda | Chips de 5, 10, 15, 25, 35, 45 y 60 minutos (25 por defecto) |
| P3 | Iniciar, pausar y reiniciar | Botón central, y botón de reinicio |
| P4 | No perder la ronda | El reloj se calcula con la hora de fin: sobrevive a cambiar de pestaña, bloquear la pantalla o recargar |
| P5 | Saber que terminó | Campanita, vibración, aviso emergente y título de la pestaña con la cuenta atrás |
| P6 | Encadenar rondas | Al terminar: **Otra ronda** o **Terminar** la tarea |
| P7 | Ver qué planta voy ganando | Tira de plantas (1 a 6+ rondas) y pista de la siguiente |
| P8 | Música para concentrarme | Interruptor de música lofi generada con Tone.js; baja el volumen al sonar la campanita |
| P9 | Mantener la pantalla encendida | Automático mientras corre una ronda |
| P10 | Mostrarlo en una demo | **Modo demo**: rondas de 10 segundos |

### Ver mi progreso en un mundo (módulo [3d-world](modules/3d-world/README.md))

| # | Caso de uso | Cómo se hace |
|---|-------------|--------------|
| W1 | Ver el resultado de mi esfuerzo | Isla flotante con una parcela por tarea terminada con al menos una ronda |
| W2 | Entender qué significa cada planta | Leyenda inferior: 1 pasto, 2 flor, 3 arbusto, 4 árbol, 5 mariposa, 6+ sakura |
| W3 | Recordar qué logré | Tocar una planta: tarjeta con título, tipo, rondas y cuándo se terminó |
| W4 | Explorar | Arrastrar para rotar, pellizcar o rueda para acercar; giro automático |
| W5 | Ver crecer la isla | La isla se agranda cuando hacen falta más parcelas |
| W6 | Usar la app sin 3D | Vista de emojis si Three.js no carga |

### Entender cómo me va (módulo [statistics](modules/statistics/README.md))

| # | Caso de uso | Cómo se hace |
|---|-------------|--------------|
| S1 | Ver números clave | Tareas terminadas, rondas, minutos de foco y racha de días |
| S2 | Ver en qué gasto mi energía | Dona por tipo con porcentajes |
| S3 | Ver mi tendencia | Barras apiladas de los últimos 7 días |
| S4 | Probar la app con datos | **Cargar datos de ejemplo** |
| S5 | Empezar de cero | **Borrar todos los datos** (con confirmación) |

### Transversales

- Navegación por pestañas (barra inferior en móvil, riel lateral desde 768 px) y por URL (`#/tasks`, `#/focus`, `#/garden`, `#/stats`).
- Datos guardados en el dispositivo (`localStorage`).
- Se puede instalar en el teléfono (manifiesto web).
- Melodías lofi agregables como archivos JSON, sin audios (ver [melodies/README.md](../melodies/README.md)).

## Pendiente (roadmap)

Ordenado por valor para el problema central (organización, avance y enfoque). Cada ítem debe convertirse en una spec antes de construirse.

| Prioridad | Idea | Módulo | Notas |
|-----------|------|--------|-------|
| Alta | Descansos cortos y largos del pomodoro | pomodoro | Hoy solo hay rondas de enfoque |
| Alta | Editar el título y el tipo de una tarea | todo-list | Hoy solo se crea, completa y elimina |
| Alta | Funcionar sin conexión (service worker) | transversal | Hoy Tailwind, Tone.js y Three.js dependen de la red |
| Media | Exportar e importar datos (JSON) | transversal | Respaldo manual, sin servidor |
| Media | Notificaciones del sistema al terminar la ronda | pomodoro | Pedir permiso solo al iniciar la primera ronda |
| Media | Fecha límite y recordatorios | todo-list | |
| Media | Selector de melodía y volumen | pomodoro | Hoy se elige una al azar |
| Media | Más plantas y niveles | 3d-world | Por ejemplo fauna o edificios para rondas altas |
| Media | Ciclo de día y clima en la isla | 3d-world | Respetando `prefers-reduced-motion` |
| Baja | Estadísticas por semana y mes | statistics | Comparar contra el periodo anterior |
| Baja | Metas diarias y logros | statistics | |
| Baja | Tema oscuro | transversal | Tokens de color nuevos en `design-system.md` |
| Baja | Pruebas automáticas de `rules.js` y `store.js` | transversal | Con `node --test`, sin librerías |
| Baja | Sincronización entre dispositivos | transversal | Requiere backend; diseñar aparte |
| Fuera de alcance por ahora | Multilenguaje | transversal | Es un refactor amplio: todos los textos viven dentro de los componentes |

## Cómo se agrega una funcionalidad

1. Escribirla aquí (caso de uso o roadmap).
2. Crear una spec incremental en `.kiro/specs/` (en la raíz del repositorio).
3. Implementar respetando los steerings.
4. Actualizar el README y el changelog del módulo, y correr al agente `qa-tester`.
