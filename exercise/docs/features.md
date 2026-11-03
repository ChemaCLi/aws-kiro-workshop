# Focus Garden: funcionalidades

Tareas + pomodoro + jardín 3D + estadísticas. Mobile first, responsive, solo en español. Astro + Vite (ver `docs/decisions/0001-migrar-a-astro.md`).

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
| P8 | Música para concentrarme | Interruptor de música de fondo en Ajustes (melodías lofi e hiphop/trap generadas con Tone.js, una al azar); baja el volumen al sonar la campanita |
| P9 | Mantener la pantalla encendida | Automático mientras corre una ronda |
| P10 | Mostrarlo en una demo | **Modo demo** en Ajustes: rondas de 10 segundos |

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
| S4 | Probar la app con datos | **Cargar datos de ejemplo** desde Ajustes (el estado vacío de Estadísticas lleva allí) |
| S5 | Empezar de cero | **Borrar todos los datos** en Ajustes (con confirmación) |

### Conocer la app y entrar (landing)

La landing es una página aparte (`index.html`); la app vive en `app.html`. Detalle de pruebas en [settings](modules/settings/README.md).

| # | Caso de uso | Cómo se hace |
|---|-------------|--------------|
| L1 | Entender qué es Focus Garden antes de usarla | Página con scroll: hero con el texto a la izquierda y la isla 3D a la derecha, y secciones *Cómo funciona*, *Funciones* y *Open source* |
| L2 | Ver mi jardín según la hora | Cielo, astro y luz cambian en cuatro franjas (mañana, mediodía, tarde y noche); de noche hay luna y estrellas. Muestra mis plantas, o plantas de muestra si aún no tengo |
| L3 | Entrar con un toque | Botones **Continuar mi jardín** (si ya hay tareas o rondas) o **Empezar mi jardín**; también **Entrar** en la barra superior |
| L4 | Saber que puedo crear una cuenta cuando quiera | Al entrar sale siempre el aviso "Puedes crear una cuenta desde los ajustes si así lo deseas" (**Entendido**) |
| L5 | Crear una cuenta desde la landing | Botón "Mantén vivo tu jardín, lleva tu progreso contigo": lleva a la página de cuenta (`app.html#/cuenta`) para registrarse o iniciar sesión |
| L6 | Usar la landing sin 3D o con movimiento reducido | Isla de emojis si Three.js o WebGL fallan; escena, estrellas y chips quietos con `prefers-reduced-motion` |
| L7 | Saber que es open source | Sección *Open source* con el stack, los comandos para correrlo y el enlace al repositorio |
| L8 | Salir de la app y volver a la landing | Botón de salida en Tareas y fila "Salir a la página de inicio" en Ajustes; los botones atrás y adelante del navegador también funcionan |

### Ajustar la app (módulo [settings](modules/settings/README.md))

| # | Caso de uso | Cómo se hace |
|---|-------------|--------------|
| A1 | Llegar a los ajustes con un toque | Pestaña **Ajustes** (engrane), la última de la navegación; `app.html#/settings` |
| A2 | Activar o quitar la música | Interruptor **Música de fondo**; deshabilitado con "No disponible sin conexión" si Tone.js no carga |
| A3 | Activar o quitar la campanita | Interruptor **Sonido de la campanita** |
| A4 | Mostrarlo en una demo | Interruptor **Modo demo** (rondas de 10 segundos); Foco muestra un indicador con enlace a Ajustes |
| A5 | Probar la app con datos | **Cargar datos de ejemplo** en la sección Datos (pide confirmación si ya hay tareas); también desde el estado vacío de Estadísticas |
| A6 | Empezar de cero | **Borrar todos los datos** (con confirmación); conserva los ajustes |
| A7 | Entrar a mi cuenta desde Ajustes | Bloque **Mi cuenta** real: sin sesión lleva a la página de cuenta para crear cuenta o iniciar sesión; con sesión muestra mi nombre (o correo) y **Cerrar sesión** |
| A8 | Ver qué viene | Espacio "Mis sesiones" marcado **Próximamente**; aún no hace nada |

### Tener una cuenta propia (módulo [accounts-auth](modules/accounts-auth/README.md))

La cuenta es **opcional**: sin ella la app funciona igual, con los datos en el dispositivo. La página de cuenta vive en `app.html#/cuenta`.

| # | Caso de uso | Cómo se hace |
|---|-------------|--------------|
| C1 | Crear una cuenta con mi correo | Página de cuenta: registro con correo y contraseña; llega un código de confirmación que se escribe para activar la cuenta |
| C2 | Iniciar sesión con correo y contraseña | Formulario de inicio de sesión en la página de cuenta; restaura la sesión en este dispositivo |
| C3 | Entrar con Google, Meta o mi cuenta de Amazon | Botones de proveedor social; redirigen al inicio de sesión alojado por Cognito (OAuth 2.0 con PKCE) |
| C4 | Entrar con GitHub | Botón de GitHub; usa el puente OIDC porque Cognito no lo soporta de forma nativa. Si el puente no responde, los demás métodos siguen funcionando |
| C5 | Poner mi nombre tras registrarme | Tras el registro se pide solo el nombre; luego aparece **Ir a mi Garden** que lleva a Tareas |
| C6 | Ver mi cuenta y cerrar sesión | Bloque **Mi cuenta** en Ajustes: muestra mi nombre (o correo) y **Cerrar sesión**, que no borra mis datos locales |
| C7 | Usar la app sin cuenta | Todo sigue funcionando sin registrarse; crear cuenta no toca los datos locales |
| C8 | Seguir sin cuentas si no hay red o SDK | Sin conexión o sin el SDK de cuentas, los controles de cuenta se muestran deshabilitados con aviso y el resto de la app sigue igual |

### Transversales

- Dos páginas: la landing (`index.html`) y la app (`app.html`, una SPA).
- Navegación por pestañas en la app (barra inferior en móvil, riel lateral desde 768 px) y por URL (`app.html#/tasks`, `#/focus`, `#/garden`, `#/stats`, `#/settings`). Recargar se queda en la pestaña actual.
- Datos guardados en el dispositivo (`localStorage`).
- Se puede instalar en el teléfono (manifiesto web).
- Melodías lofi e hiphop/trap agregables como archivos JSON, sin audios (ver [melodies/README.md](../melodies/README.md)).

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
| Media | `cloud-sync`: guardar el progreso en la nube | transversal | Respaldará tareas, rondas y ajustes para no perderlos al cambiar de dispositivo. Se sugiere DynamoDB en lugar de MongoDB. Contradice "datos locales / sin servidor": deberá actualizar `product.md` y `tech.md` y definir qué datos viajan y qué sigue funcionando sin conexión |
| Baja | `multi-device-sessions`: sección "Mis sesiones" | settings | Mostrará los dispositivos donde la cuenta está abierta. Depende de `accounts-auth` y `cloud-sync` |
| Fuera de alcance por ahora | Multilenguaje | transversal | Es un refactor amplio: todos los textos viven dentro de los componentes |

## Cómo se agrega una funcionalidad

1. Escribirla aquí (caso de uso o roadmap).
2. Crear una spec incremental en `.kiro/specs/` (en la raíz del repositorio).
3. Implementar respetando los steerings.
4. Actualizar el README y el changelog del módulo, y correr al agente `qa-tester`.
