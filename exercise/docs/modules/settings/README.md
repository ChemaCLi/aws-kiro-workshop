# Módulo settings

## Descripción

Módulo de la landing y los ajustes (spec `landing-and-settings`, con la landing rediseñada después). Agrupa dos piezas: la **Landing**, una página aparte (`index.html`), y la pestaña **Ajustes** (`<settings-view>`) de la app (`app.html`). No hay servidor ni cuentas: todo sigue en `localStorage` bajo la clave `jardin-movil:v1`.

### Dos páginas

| Página | Qué es | Archivos |
|--------|--------|----------|
| `index.html` | La **landing**: una página con scroll normal | `src/landing.js`, `src/styles/landing.css` |
| `app.html` | La **app**: una SPA con pestañas por hash (`#/tasks`, `#/focus`...) | `src/main.js`, `src/styles/app.css` |

Entrar y salir son navegaciones reales, así que los botones atrás y adelante del navegador funcionan: desde la app, "atrás" lleva a la landing. Recargar `app.html` se queda en la app. `manifest.webmanifest` usa `app.html` como `start_url`: quien instala la app la abre directo, sin pasar por la landing. Lo compartido vive en `src/styles/base.css` (tipografía, hojas, animaciones comunes) y `src/ui/tailwind-config.js` (colores de Tailwind).

### Landing

- **Hero**: el texto a la izquierda y el jardín 3D (`<hero-garden>`) a la derecha desde 1024 px; en teléfono, el texto primero y el jardín debajo. Título "Cada ronda de enfoque hace crecer tu jardín", insignia "Gratis · Open source · Sin cuenta", tres cifras (plantas, tipos de tarea y cuentas necesarias; las dos primeras salen de `PLANTS` y `TASK_TYPES`) y dos chips decorativos que flotan sobre el jardín. Una barra superior fija enlaza a cada sección y tiene el botón "Entrar".
- **Cielo por franja del día**: la franja se calcula con la hora local mediante `timePeriodFor(date)` (`rules.js`): `morning` 06:00–11:59, `midday` 12:00–15:59, `afternoon` 16:00–19:59 y `night` 20:00–05:59. Cada franja tiene su cielo CSS (`.hero-sky[data-period]`), su astro (sol o luna) y su luz 3D (`GARDEN_LOOKS`). De noche el texto cambia a colores claros y aparecen estrellas que titilan y una estrella fugaz ocasional. En teléfono el astro es más pequeño y se acomoda en la esquina para no tapar el título. La franja se recalcula cada 60 s y al volver a la pestaña (`visibilitychange`); solo se toca la escena si cambió. El jardín muestra las plantas reales (`heroPlots`, mismas reglas que `3d-world`) o, si no hay ninguna tarea terminada con rondas, las plantas de inicio `LANDING_STARTER_PLOTS`.
- **Secciones**: *Cómo funciona* (tres pasos y la escalera de plantas, generada con `PLANTS`), *Funciones* (seis tarjetas; los chips de tipo salen de `TASK_TYPES`), *Open source* (stack, comandos para correrlo y enlace al repositorio en GitHub) y una llamada final.
- **Botones de entrada**: los del hero y la llamada final dicen **"Continuar mi jardín"** si hay datos locales (`store.hasLocalData()`: al menos una tarea o una ronda) y **"Empezar mi jardín"** si no; sin datos, el hero muestra además la nota "Tus datos se guardan solo en este dispositivo. Ideal para probar." El de la barra superior dice siempre "Entrar".
- **Recordatorio de la cuenta**: al pulsar cualquier botón de entrada aparece la hoja "Antes de empezar" ("Puedes crear una cuenta desde los ajustes si así lo deseas") con el botón "Entendido", que recibe el foco. Sale **cada vez que se entra a la app desde la landing**, con "Continuar" o sin datos. Cualquier forma de cerrarla (botón, Escape, fondo, arrastre) abre la app en Tareas (`app.html`).
- **"Mantén vivo tu jardín, lleva tu progreso contigo"**: abre la hoja **Próximamente** ("Las cuentas llegan pronto…") con un botón "Entendido" que solo la cierra; la landing sigue abierta. No navega ni hace ninguna petición de red.
- **Degradación elegante**: el texto y los botones se pintan antes de que Three.js termine de cargar (`import()` dinámico, el mismo de `3d-world`). Si Three.js o WebGL fallan, el hero pinta una isla de CSS y emojis (astro de la franja y hasta 12 plantas) y todo lo demás sigue funcionando. Con movimiento reducido (`prefers-reduced-motion: reduce`) la escena no rota ni anima transiciones (`freezeWhenReducedMotion`) y se apagan el parpadeo de las estrellas, la estrella fugaz, los chips flotantes y el desplazamiento suave. Si el navegador restaura la landing desde su caché al volver con "atrás" (`pageshow` con `persisted`), se recarga para leer los datos guardados más recientes.
- **Salir de la app**: botón con ícono de salida arriba a la derecha en **Tareas** y fila "Salir a la página de inicio" al final de **Ajustes**. Ambos son enlaces a `index.html`; los datos y una ronda en curso se conservan (el reloj usa `endsAt`).

### Ajustes (`<settings-view>`)

Pestaña **Ajustes** (ícono de engrane `settings`), la última de `TABS` en `app-shell.js`: cinco pestañas en la barra inferior (< 768 px) o en el riel lateral (≥ 768 px), con `aria-label="Ajustes"` y `aria-current="page"` cuando está activa. Se abre también con `app.html#/settings`.

- **Interruptores** (`role="switch"` con `aria-checked` igual al valor de `store.state.settings`, retroalimentación `haptic()`, persistidos al recargar):
  - **Música de fondo** (`settings.music`): inicia o detiene la música (desbloquea el audio dentro del toque). Si Tone.js no está disponible, el interruptor queda deshabilitado con el texto "No disponible sin conexión" y los demás ajustes siguen funcionando.
  - **Sonido de la campanita** (`settings.sound`).
  - **Modo demo** (`settings.demo`): "Rondas de 10 segundos para mostrar la app". No se puede cambiar mientras hay una ronda en curso (corriendo o en pausa).
- **Datos**: **"Cargar datos de ejemplo"** pide confirmación solo si ya hay tareas (reemplaza tareas y rondas), si no, carga directo y muestra el toast "Datos de ejemplo cargados ✨". **"Borrar todos los datos"** siempre pide confirmación en modo peligro y, al confirmar, muestra "Todo limpio 🌱". Cancelar no cambia nada. `reset()` y `seedDemo()` conservan `music`, `sound`, `demo` y `minutes`.
- **Espacios reservados**: bloques **"Mi cuenta"** ("Aquí podrás crear tu cuenta e iniciar sesión") y **"Mis sesiones"** ("Aquí verás los dispositivos donde tienes abierta tu cuenta"), con la etiqueta "Próximamente", atenuados (`text-ink/50`), con `aria-disabled="true"`, sin respuesta a toques, sin peticiones de red ni datos de cuenta. Anclan los specs futuros `accounts-auth`, `cloud-sync` y `multi-device-sessions`.

### Cambios en otras vistas

- **Foco** ya no tiene los controles de música, sonido ni modo demo. Conserva los chips de 5, 10, 15, 25, 35, 45 y 60 minutos. Con `settings.demo` activo muestra "Modo demo" y el enlace "Cambiar en Ajustes".
- **Estadísticas** ya no tiene las acciones de datos. Su estado vacío ofrece "Cargar datos de ejemplo en Ajustes", que navega a la pestaña Ajustes.
- Al terminar una ronda con música sonando, la música baja de volumen y suena la campanita igual que antes.

### Datos guardados

La landing no guarda nada propio: solo lee `localStorage` para saber si hay datos y qué plantas dibujar. Los ajustes siguen en `settings` dentro de `jardin-movil:v1`, sin subir la versión de la clave. Un guardado de una versión anterior que aún traiga el campo `introSeen` se ignora sin problema.

## Pruebas para qa-tester

Antes de empezar: servir la carpeta de la app con un servidor estático y abrir `http://localhost:8080/` (landing) y `http://localhost:8080/app.html` (app) en un navegador con DevTools. Para ver el botón "Empezar mi jardín", borrar el `localStorage` de la clave `jardin-movil:v1` y recargar. La consola de la app ofrece `__store` (estado). Los datos de ejemplo se cargan desde Ajustes > **Cargar datos de ejemplo**.

### Pruebas de ejemplos y bordes (UI)

#### Caso 1 — Landing (Requisito 1)

1. Abrir `http://localhost:8080/` a 1280 px de ancho, con el `localStorage` vacío.
2. Comprobar la barra superior, el hero (texto a la izquierda, jardín 3D a la derecha), y bajar por las secciones *Cómo funciona*, *Funciones*, *Open source* y la llamada final. Comprobar que no hay barra de pestañas de la app.
3. Repetir a 390 px (texto arriba, jardín debajo) y a 320 px. Con DevTools, medir los botones y revisar que no hay desplazamiento horizontal.
4. Tocar los enlaces de la barra superior ("Cómo funciona", "Funciones", "Open source") y "Cómo funciona" del hero.

**Esperado:** la landing es una página con scroll normal; el hero tiene el jardín alineado a la derecha desde 1024 px y debajo del texto en teléfono; los enlaces llevan a su sección sin cortar el título bajo la barra fija; la escalera de plantas muestra pasto, flor, arbusto, árbol, mariposa y sakura (6+) con 1 a 6+ rondas; los chips de tipo coinciden con los colores de la app; el enlace de GitHub abre el repositorio en otra pestaña; cada botón mide al menos 44×44 px; sin desbordes horizontales a 320, 390 ni 1280 px; colores crema, papel, tinta y musgo con fuente redondeada.

#### Caso 2 — Cielo, astro y estrellas según la hora (Requisito 2)

1. En DevTools > Sensors (o con la hora del sistema), probar las horas 05:59, 06:00, 11:59, 12:00, 15:59, 16:00, 19:59 y 20:00 y recargar tras cada una; observar el cielo, el astro y la luz de la isla.
2. De noche, observar las estrellas durante 15 s y la legibilidad del título, los botones y las cifras.
3. A 390 px, comprobar que el astro no tapa el título en ninguna franja.
4. Con la landing abierta, cambiar la hora del sistema a otra franja y esperar hasta 60 s (o alternar de pestaña y volver).
5. Con `localStorage` vacío observar las plantas del jardín. Después cargar datos de ejemplo desde Ajustes, volver a la landing y observarlo otra vez.

**Esperado:** las cuatro franjas se ven distintas (mañana con sol bajo, mediodía con sol alto, tarde con sol naranja y noche con luna) con los límites 06:00, 12:00, 16:00 y 20:00; solo de noche hay estrellas que titilan y una estrella fugaz ocasional, y el texto pasa a colores claros con buen contraste; en teléfono el astro queda en la esquina; la franja se actualiza sin recargar en un máximo de 60 s; sin datos se ven las plantas de inicio y con datos de ejemplo las de las tareas terminadas con rondas.

#### Caso 3 — Degradación y movimiento reducido (Requisito 3)

1. En DevTools > Network > bloqueo de URL de petición, bloquear `unpkg.com` (o poner la red sin conexión) y recargar la landing.
2. Con `unpkg.com` bloqueado, tocar "Mantén vivo tu jardín…" y el botón principal.
3. Quitar el bloqueo y, en Rendering, emular `prefers-reduced-motion: reduce`; recargar y observar la isla, las estrellas (de noche) y los chips durante 10 s. Tocar "Cómo funciona".
4. Con red lenta (Slow 3G) recargar y observar el orden en que aparece cada elemento.

**Esperado:** con Three.js bloqueado aparece la isla de CSS y emojis (astro de la franja y plantas) sobre el cielo CSS, con la consola avisando "Three.js no disponible" y todos los botones funcionan; con movimiento reducido la isla se ve fija y sin rotación, las estrellas no titilan, no hay estrella fugaz, los chips no flotan y el enlace baja a la sección sin animación; con red lenta el texto y los botones aparecen antes que la escena 3D; Three.js solo se descarga por `import()` dinámico.

#### Caso 4 — Botones de entrada (Requisito 4)

1. Con `localStorage` vacío, leer el texto de los botones del hero y de la llamada final, la nota del hero y el botón de la barra superior.
2. Cargar datos de ejemplo (Ajustes > **Cargar datos de ejemplo**), volver a la landing y repetir la lectura.
3. Borrar todos los datos y volver a la landing.

**Esperado:** sin datos, el hero y la llamada final dicen "Empezar mi jardín" y la nota "Tus datos se guardan solo en este dispositivo. Ideal para probar." está visible; con tareas o rondas dicen "Continuar mi jardín" y la nota desaparece; el botón de la barra superior dice siempre "Entrar"; tras borrar los datos vuelve a "Empezar mi jardín".

#### Caso 5 — Recordatorio de la cuenta al entrar (Requisito 5)

1. Con `localStorage` vacío, tocar "Empezar mi jardín". Comprobar el texto, el botón y el foco; inspeccionar `role="dialog"`. Tocar "Entendido".
2. Volver a la landing con "atrás", tocar de nuevo el botón principal: debe salir otra vez.
3. Cargar datos de ejemplo, volver a la landing y tocar "Continuar mi jardín".
4. Repetir con el botón "Entrar" de la barra superior y con el de la llamada final.
5. Abrir la hoja y cerrarla con Escape, tocando el fondo y arrastrándola hacia abajo (una vez por vía).
6. Tocar rápido dos veces el botón principal.

**Esperado:** aparece una hoja con `role="dialog"`, el título "Antes de empezar", el texto "Puedes crear una cuenta desde los ajustes si así lo deseas" y un botón "Entendido" con el foco inicial; sale **siempre** que se entra desde la landing, con "Continuar mi jardín", con "Empezar mi jardín" y con los otros dos botones de entrada; mientras está abierta la landing sigue a la vista y no se navega; cerrarla por cualquier vía abre `app.html` en la pestaña Tareas; un doble toque no abre dos hojas.

#### Caso 6 — Botón de crear cuenta (Requisito 6)

1. En la landing, abrir DevTools > Network, limpiar el registro y activar "Preserve log".
2. Tocar "Mantén vivo tu jardín, lleva tu progreso contigo".
3. Tocar "Entendido" y comprobar que la landing sigue visible.
4. Volver a abrir la hoja y cerrarla con Escape.
5. Revisar la pestaña Network y la URL del navegador.

**Esperado:** la hoja muestra el título "Próximamente" y una frase que dice que las cuentas llegan pronto, con un solo botón "Entendido"; cerrarla por cualquier vía deja la landing abierta en la misma URL; **no aparece ninguna petición de red** y no se abre ninguna página de registro.

#### Caso 7 — Pestaña de Ajustes en la navegación (Requisito 7)

1. Entrar a la app a 360 px y a 320 px: contar las pestañas de la barra inferior y probar si hay desplazamiento horizontal.
2. Pasar a 1024 px y revisar el riel lateral.
3. Tocar la pestaña Ajustes; inspeccionar `aria-label` y `aria-current`.
4. Abrir `http://localhost:8080/app.html#/settings` y comprobar la vista.
5. Revisar con el teclado (Tab) que el engrane tiene el nombre accesible "Ajustes".

**Esperado:** hay cinco pestañas en este orden: Tareas, Foco, Jardín, Stats y Ajustes (la última, con ícono de engrane de trazo); en < 768 px caben en la barra inferior sin desplazamiento horizontal (también a 320 px); desde 768 px están en el riel lateral; al tocar Ajustes se muestra `<settings-view>` y la pestaña queda con `aria-current="page"` (las demás con `"false"`); con `app.html#/settings` se abre Ajustes directamente, sin pasar por la landing; el botón tiene `aria-label="Ajustes"`.

#### Caso 8 — Música, sonido y modo demo en Ajustes (Requisito 8)

1. En Ajustes, comprobar los tres interruptores y sus textos de apoyo; inspeccionar `role="switch"` y `aria-checked` contra `__store.state.settings`.
2. Activar "Música de fondo", comprobar que suena (si Tone.js cargó) y que `settings.music` es `true`; desactivarla y comprobar que se detiene y `music` es `false`.
3. Alternar "Sonido de la campanita" y revisar `settings.sound`.
4. Activar "Modo demo", ir a Foco, iniciar una ronda y medir su duración; volver a Ajustes con la ronda en curso.
5. Recargar la página tras cambiar los tres interruptores.
6. Bloquear `unpkg.com` (Tone.js) y recargar, y abrir Ajustes.
7. En un dispositivo con vibración, verificar que cada toque vibra brevemente (`haptic()`).

**Esperado:** hay interruptores "Música de fondo", "Sonido de la campanita" y "Modo demo" con `role="switch"` y `aria-checked` igual al valor guardado; "Música de fondo" arranca y detiene la música y actualiza `settings.music`; "Sonido de la campanita" actualiza `settings.sound`; "Modo demo" actualiza `settings.demo`, con el texto "Rondas de 10 segundos para mostrar la app", y las rondas duran 10 s; con una ronda en curso el interruptor del modo demo está deshabilitado; los valores se conservan tras recargar; sin Tone.js el interruptor de música queda deshabilitado con el texto "No disponible sin conexión" y los otros dos siguen funcionando.

#### Caso 9 — Acciones de datos en Ajustes (Requisito 9)

1. Con `localStorage` vacío (sin tareas), en Ajustes tocar "Cargar datos de ejemplo".
2. Con tareas ya cargadas, tocar de nuevo "Cargar datos de ejemplo" y **cancelar** en la hoja de confirmación; anotar tareas, rondas y ajustes antes y después.
3. Repetir y confirmar.
4. Tocar "Borrar todos los datos", cancelar y revisar que nada cambió; repetir y confirmar.
5. Después de confirmar el borrado, revisar `__store.state.settings` (`music`, `sound`, `demo`, `minutes`).

**Esperado:** la sección "Datos" muestra las dos acciones; sin tareas, "Cargar datos de ejemplo" carga directo y aparece el toast "Datos de ejemplo cargados ✨"; con tareas abre una confirmación que avisa que se reemplazan las tareas y rondas actuales y solo carga al confirmar; "Borrar todos los datos" abre una confirmación en modo peligro (botón rojo) y solo borra al confirmar, con el toast "Todo limpio 🌱"; cancelar deja tareas, rondas y ajustes iguales; tras borrar o cargar datos de ejemplo se conservan `music`, `sound`, `demo` y `minutes`.

#### Caso 10 — Foco y Estadísticas sin los controles movidos (Requisito 10)

1. Abrir Foco: buscar interruptores de música, sonido o modo demo y contar los chips de duración.
2. Con `settings.demo` en `false`, comprobar que no hay indicador; activar el modo demo en Ajustes y volver a Foco.
3. Tocar el enlace del indicador "Modo demo".
4. Abrir Stats con el `localStorage` vacío y comprobar el estado vacío; tocar "Cargar datos de ejemplo en Ajustes".
5. Con datos cargados, abrir Stats y buscar las acciones "Cargar datos de ejemplo" o "Borrar todos los datos".
6. Con música activada y una ronda en modo demo, esperar a que termine la ronda.

**Esperado:** Foco no muestra controles de música, sonido ni modo demo y mantiene los chips 5, 10, 15, 25, 35, 45 y 60 minutos; con el modo demo activo aparece "Modo demo" con un enlace ("Cambiar en Ajustes") que navega a Ajustes; Stats no muestra las acciones de datos; su estado vacío ofrece "Cargar datos de ejemplo en Ajustes" y navega a Ajustes; al terminar la ronda con música sonando, la música baja de volumen y suena la campanita como antes.

#### Caso 11 — Espacios reservados para cuenta y sesiones (Requisito 11)

1. En Ajustes, desplazarse hasta el final y leer los bloques "Mi cuenta" y "Mis sesiones".
2. Inspeccionar los elementos (`aria-disabled`, clases de opacidad) y tocar cada bloque y la etiqueta.
3. Con la pestaña Network abierta y limpia, entrar a Ajustes, desplazarse y tocar los bloques.
4. Revisar `localStorage` (`jardin-movil:v1`) en busca de datos de cuenta.

**Esperado:** "Mi cuenta" muestra la etiqueta "Próximamente" y el texto "Aquí podrás crear tu cuenta e iniciar sesión"; "Mis sesiones" muestra "Próximamente" y "Aquí verás los dispositivos donde tienes abierta tu cuenta"; ambos se ven atenuados (`text-ink/50`) frente a los controles activos, tienen `aria-disabled="true"` y no responden a toques; **no hay peticiones de red** desde Ajustes y no se guarda ningún dato de cuenta.

#### Caso 12 — Landing y app son páginas separadas, con botón de salir

1. Desde la landing, entrar a la app (pasando por el recordatorio) y fijarse en la URL.
2. Cambiar a otra pestaña de la app (por ejemplo Foco) y recargar el navegador.
3. Tocar el botón de salida de la esquina superior derecha en **Tareas**.
4. Con los botones del navegador, ir "atrás" y luego "adelante".
5. Volver a la app, abrir **Ajustes**, bajar hasta el final y tocar "Salir a la página de inicio".
6. Abrir `http://localhost:8080/app.html#/settings` directamente.
7. Con una ronda en curso (Modo demo), salir a la landing y volver a la app antes de que pasen 10 s.
8. En DevTools > Application, revisar `start_url` del manifiesto.

**Esperado:** al entrar, la URL cambia de `/` o `/index.html` a `/app.html#/tasks` (otra página, no un cambio dentro de la misma); recargar en la app se queda en la misma pestaña de `app.html` y no muestra la landing; el botón de salida tiene `aria-label="Salir a la página de inicio"`, mide al menos 44×44 px y lleva a `index.html`; "atrás" desde la app regresa a la landing y "adelante" vuelve a la app; la fila de Ajustes lleva a la landing; abrir `app.html#/settings` muestra Ajustes sin pasar por la landing; la ronda en curso sigue contando con el tiempo correcto al volver (se calcula con `endsAt`); `start_url` es `./app.html`.

### Pruebas de propiedades (consola del navegador)

El proyecto no tiene Node, bundler ni ejecutor de pruebas, y la política de dependencias pide confirmación antes de sumar una librería. Las propiedades de la lógica pura de `core` se ejecutan por eso en la consola del navegador con un arnés de pocas líneas, sin dependencias.

**Arnés `forAll(runs, generate, check)`:**

```js
// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};
```

- `runs`: número de iteraciones.
- `generate()`: devuelve una entrada aleatoria nueva en cada llamada.
- `check(input)`: devuelve `true` si la propiedad se cumple. Si devuelve `false`, el arnés lanza un error con la entrada que falló, que sirve como contraejemplo.

**Cómo ejecutarlo:**

1. Servir la app con cualquier servidor estático y abrirla en el navegador (por ejemplo `http://localhost:8080`).
2. Abrir la consola de DevTools, pegar el arnés y después el script de la propiedad (ver la carpeta de abajo). Los módulos se importan con `await import('./src/core/rules.js')`; el estado en vivo está en `__store`.
3. Correr **al menos 100 iteraciones** con datos aleatorios (`runs >= 100`).
4. En dominios finitos (por ejemplo, las 24 horas del día para la franja horaria) no se muestrea: se recorre el dominio completo con un bucle y se combina con `forAll` para las variaciones aleatorias.

   ```js
   // Dominio finito: las 24 horas, todas, sin azar.
   for (let hour = 0; hour < 24; hour++) {
     if (!check(hour)) throw new Error(`Falla con la hora: ${hour}`);
   }
   ```

5. Las propiedades que tocan el estado guardado (`reset`, `seedDemo`, `setSetting`) deben restaurar el `localStorage` original al terminar, para no dejar datos de prueba.

**Etiqueta de cada propiedad:** `Feature: landing-and-settings, Property N: título`. El script que la comprueba empieza con esa etiqueta como comentario.

**Resultado esperado:** el script termina sin lanzar error. Un `Error: Falla con: ...` indica un contraejemplo y se reporta a `coder` con la entrada que muestra.

**Scripts de las propiedades:** cada propiedad guarda su script en [`properties/`](./properties/), con el nombre `propiedad-N-<tema>.md`.

| # | Propiedad | Requisitos | Script |
|---|-----------|------------|--------|
| 1 | La franja depende solo de la hora local y cubre todo el día | 2.1, 2.3 | [propiedad-1-franja-horaria.md](./properties/propiedad-1-franja-horaria.md) |
| 2 | El hero nunca queda vacío y respeta el jardín real | 2.5, 2.6 | [propiedad-2-hero-plots.md](./properties/propiedad-2-hero-plots.md) |
| 3 | `hasLocalData` es exacto y no muta | 4.1, 4.2, 4.3, 12.4 | [propiedad-3-has-local-data.md](./properties/propiedad-3-has-local-data.md) |
| 4 | `reset` y `seedDemo` conservan los ajustes | 5.8, 9.7 | [propiedad-4-reset-seed.md](./properties/propiedad-4-reset-seed.md) |
| 5 | Alternar un ajuste dos veces restaura el valor y se persiste | 8.3, 8.4, 8.6, 8.7, 8.9 | [propiedad-5-alternar-ajustes.md](./properties/propiedad-5-alternar-ajustes.md) |

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 2.0.0 | 2026-10-31 | La landing deja de ser un componente dentro de la SPA y pasa a ser la página `index.html`; la app se muda a `app.html` (y el `start_url` del manifiesto la apunta). Landing rediseñada: hero con el texto a la izquierda y el jardín a la derecha, estrellas y luna de noche, sol por franja, secciones *Cómo funciona*, *Funciones* y *Open source*. El recordatorio de la cuenta sale **siempre** al entrar desde la landing (antes solo la primera vez y sin "Continuar"); se elimina `settings.introSeen`, `shouldShowIntro` y `ENTRY_MODES`, y con ellos las propiedades 4 y 5 anteriores (las demás se renumeraron). Botón de salir en Tareas y en Ajustes. Estilos compartidos en `src/styles/` y colores de Tailwind en `src/ui/tailwind-config.js`. La hoja "Próximamente" ahora solo informa. Cambio MAYOR de estructura sin migración de datos: la clave `jardin-movil:v1` no cambia. |
| 1.0.0 | 2026-10-31 | Versión inicial del módulo: landing de bienvenida con hero 3D según la hora del día (con respaldo de CSS y emojis y soporte de movimiento reducido), Intro_Modal de una sola vez controlada por `settings.introSeen`, hoja "Próximamente" para crear cuenta, pestaña Ajustes (`<settings-view>`) con música, sonido, modo demo y la sección "Datos", y espacios reservados "Mi cuenta" y "Mis sesiones". `introSeen` es un campo aditivo: la clave `jardin-movil:v1` no cambia. |
| 0.1.0 | 2026-10-29 | Esqueleto del módulo: secciones fijas y arnés de propiedades `forAll` para la consola. |
