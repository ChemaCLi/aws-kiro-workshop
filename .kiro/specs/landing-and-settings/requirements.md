# Requirements Document

## Introduction

Este spec es el primero de cuatro en que se divide la evolución de Focus Garden hacia cuentas y sincronización. Construye lo que no necesita servidor: una pantalla de bienvenida (landing) con el jardín 3D de fondo que cambia según la hora local, una modal informativa al entrar sin cuenta, un botón de "crear cuenta" que por ahora solo anuncia "Próximamente", y un módulo de Ajustes (engrane) que reúne la música, el sonido, el modo demo y las acciones de datos que hoy viven en Foco y Estadísticas.

Los tres specs siguientes son solo roadmap y no se implementan aquí: `accounts-auth` (registro e inicio de sesión), `cloud-sync` (guardar el progreso en la nube; se sugiere DynamoDB en lugar de MongoDB) y `multi-device-sessions` (la sección "Mis sesiones").

Los datos siguen guardándose en `localStorage`. No hay backend en este spec.

**Revisión del 2026-10-31 (rediseño de la landing).** Tras la primera versión se rediseñó la landing: dejó de ser una pantalla encima de las pestañas y pasó a ser una **página aparte** (`index.html`) con contenido de presentación (cómo funciona, funciones y open source). La App es otra página (`app.html`, una SPA). El recordatorio de la cuenta se muestra en cada entrada y se retiró el indicador `introSeen`. Los requisitos 1 a 7, 9, 12 y 13 se reescribieron para reflejarlo y se agregaron los requisitos 14 (páginas separadas y salida) y 15 (contenido de la landing).

## Glossary

- **App**: La aplicación Focus Garden (una SPA con pestañas por hash), servida desde `app.html`.
- **Landing**: Página `index.html`, aparte de la App, con scroll normal. Presenta Focus Garden y es la forma de entrar a la App.
- **Hero**: Primera sección de la Landing. Tiene el texto y los botones a la izquierda y el Hero_Garden a la derecha (debajo del texto en teléfono).
- **Hero_Garden**: Escena del Hero. Es la isla 3D de Three.js, o su alternativa de CSS y emojis cuando Three.js no carga.
- **Time_Period**: Franja del día calculada con la hora local del dispositivo: `morning` (06:00 a 11:59), `midday` (12:00 a 15:59), `afternoon` (16:00 a 19:59) o `night` (20:00 a 05:59).
- **Primary_Button**: Botón principal del Hero. Dice "Continuar mi jardín" cuando existen Local_Data y "Empezar mi jardín" cuando no existen.
- **Enter_Buttons**: Todos los botones que inician la entrada a la App: el Primary_Button, el botón "Entrar" de la barra superior y el botón de la llamada final.
- **Create_Account_Button**: Botón secundario del Hero con el texto "Mantén vivo tu jardín, lleva tu progreso contigo".
- **Coming_Soon_Sheet**: Hoja corta que se abre desde el Create_Account_Button y anuncia que las cuentas llegan pronto.
- **Local_Data**: Al menos una tarea o una ronda terminada guardada en `localStorage`.
- **Intro_Modal**: Hoja informativa "Antes de empezar" con el texto "Puedes crear una cuenta desde los ajustes si así lo deseas". Se muestra cada vez que se entra a la App desde la Landing.
- **Exit_Button**: Enlace dentro de la App que lleva a la Landing. Está en el encabezado de Tareas y al final de Ajustes.
- **Settings_View**: Componente `<settings-view>` del módulo `settings`, que se abre con la pestaña Ajustes.
- **Settings_Tab**: Entrada de `TABS` en `app-shell.js` con id `settings`, etiqueta "Ajustes" e ícono de engrane.
- **Navigation_Bar**: Barra de pestañas inferior en móvil (menos de 768 px) y riel lateral desde 768 px.
- **Data_Actions**: Las acciones "Cargar datos de ejemplo" y "Borrar todos los datos".
- **Reserved_Slot**: Bloque visible de la Settings_View, marcado "Próximamente", que reserva el lugar de una función de un spec posterior.
- **Store**: Estado único de la App en `src/core/store.js`.
- **Reduced_Motion**: Preferencia del sistema `prefers-reduced-motion: reduce`.

## Requirements

### Requirement 1: Landing de bienvenida

**User Story:** Como persona que descubre Focus Garden, quiero una página de bienvenida atractiva que me explique qué es y me deje entrar con un toque, para decidir si quiero probarla.

#### Acceptance Criteria

1. WHEN `index.html` is opened, THE Landing SHALL be displayed as its own page, separate from the App.
2. THE Hero SHALL display the title "Cada ronda de enfoque hace crecer tu jardín", a supporting sentence and the Enter_Buttons.
3. WHILE the viewport width is 1024 px or more, THE Hero SHALL place the text on the left and the Hero_Garden on the right; below 1024 px THE Hero SHALL place the Hero_Garden below the text.
4. THE Landing SHALL NOT display the Navigation_Bar nor load the shell, the tab views or the ticker of the App; it only reuses `rules.js`, `store.js` and the shared sheet.
5. THE Landing SHALL scroll normally, keep a top bar fixed to the top, and respect the safe areas defined by `--safe-t` and `--safe-b`.
6. THE Landing SHALL use the design tokens `cream`, `paper`, `ink`, `moss`, `leaf` and `line`, and the system rounded font.
7. THE Landing SHALL keep every button and link of the interface at a touch target of at least 44 px of height.

### Requirement 2: Jardín según la hora del día

**User Story:** Como persona que abre la app a distintas horas, quiero que el jardín de la bienvenida refleje la hora del día, para que se sienta vivo y conectado con mi momento.

#### Acceptance Criteria

1. WHEN the Landing is displayed, THE Hero_Garden SHALL render the look that matches the Time_Period computed from the local time of the device.
2. THE Hero_Garden SHALL provide a distinct look for each of the four Time_Period values: `morning`, `midday`, `afternoon` and `night`.
3. THE Time_Period computation SHALL be a pure function in `src/core/rules.js` that receives a `Date` and returns one of the four Time_Period values.
4. WHILE the Landing remains open, THE Landing SHALL recompute the Time_Period at intervals of 60 seconds and when the page becomes visible again, and update the sky and the Hero_Garden when the Time_Period changes.
5. WHEN the Landing is displayed, THE Hero_Garden SHALL show the plants of the completed tasks that have at least one round, using the same rules as the module `3d-world`.
6. WHERE no completed task has a round, THE Hero_Garden SHALL show the island with the starter plants defined for the Landing.
7. THE Hero SHALL show a sky gradient and a celestial body for each Time_Period: a sun in `morning`, `midday` and `afternoon`, and a moon in `night`.
8. WHILE the Time_Period is `night`, THE Hero SHALL show twinkling stars and use light text colors with enough contrast over the dark sky.
9. WHILE the viewport width is below 1024 px, THE Hero SHALL place the celestial body in a corner so that it does not cover the title.

### Requirement 3: Degradación elegante y movimiento reducido

**User Story:** Como persona con un dispositivo limitado o con movimiento reducido, quiero que la bienvenida funcione y sea cómoda, para poder entrar sin problemas.

#### Acceptance Criteria

1. IF Three.js fails to load, THEN THE Landing SHALL display a Hero_Garden made of CSS gradients and emojis for the current Time_Period and keep every button functional.
2. IF WebGL is not available, THEN THE Landing SHALL display the same CSS and emoji Hero_Garden as when Three.js fails to load.
3. WHILE Reduced_Motion is active, THE Hero_Garden SHALL render without automatic rotation and without animated transitions, and THE Landing SHALL stop the twinkling of the stars, the shooting star, the floating chips and the smooth scrolling.
4. THE Landing SHALL load Three.js only through the dynamic `import()` already used by the module `3d-world`.
5. WHEN the Landing is displayed, THE Landing SHALL show the title and the buttons before Three.js finishes loading.

### Requirement 4: Entrada con un toque

**User Story:** Como persona que quiere probar la app, quiero entrar con un solo toque, para empezar sin crear una cuenta.

#### Acceptance Criteria

1. WHERE Local_Data does not exist, THE Hero SHALL display the Primary_Button with the text "Empezar mi jardín".
2. WHERE Local_Data exists, THE Hero SHALL display the Primary_Button with the text "Continuar mi jardín".
3. WHERE Local_Data does not exist, THE Hero SHALL display below the buttons the text "Tus datos se guardan solo en este dispositivo. Ideal para probar." and WHERE Local_Data exists THE Hero SHALL hide it.
4. WHEN the user completes the entry flow defined in Requirement 5, THE Landing SHALL navigate to `app.html`, and THE App SHALL show the Navigation_Bar and the Tareas tab.
5. WHEN the user taps an Enter_Button, THE Landing SHALL reach the Intro_Modal with that single tap and the App with one more tap on "Entendido".
6. WHEN a round of the Store is in progress while the user visits the Landing, THE App SHALL keep the round correct on return because the remaining time is computed from `endsAt`.

### Requirement 5: Recordatorio de la cuenta al entrar

**User Story:** Como persona que entra a la app, quiero que me recuerden que puedo crear una cuenta cuando quiera, para decidir con calma sin sentirme presionada.

#### Acceptance Criteria

1. WHEN the user taps any Enter_Button, with or without Local_Data, THE Landing SHALL display the Intro_Modal before navigating to the App.
2. THE Intro_Modal SHALL display the title "Antes de empezar", the text "Puedes crear una cuenta desde los ajustes si así lo deseas" and one button with the text "Entendido".
3. WHEN the user taps "Entendido", THE Landing SHALL close the Intro_Modal and navigate to `app.html`.
4. WHEN the user closes the Intro_Modal with Escape, by tapping the backdrop or by dragging it down, THE Landing SHALL navigate to `app.html` as well.
5. WHILE the Intro_Modal is open, THE Landing SHALL ignore further taps on the Enter_Buttons so that only one Intro_Modal exists.
6. THE Intro_Modal SHALL use `role="dialog"`, move the focus to the "Entendido" button when it opens, and return the focus to the document when it closes.
7. THE Landing SHALL NOT save any flag about the Intro_Modal: it appears on every entry from the Landing.

### Requirement 6: Botón de crear cuenta (Próximamente)

**User Story:** Como persona interesada en mantener mi progreso, quiero ver la opción de crear una cuenta aunque aún no exista, para saber que llegará.

#### Acceptance Criteria

1. THE Hero SHALL display the Create_Account_Button below the Enter_Buttons with the text "Mantén vivo tu jardín, lleva tu progreso contigo".
2. WHEN the user taps the Create_Account_Button, THE Landing SHALL open the Coming_Soon_Sheet.
3. THE Coming_Soon_Sheet SHALL display the title "Próximamente" and a sentence that explains that las cuentas llegan pronto.
4. THE Coming_Soon_Sheet SHALL display one button with the text "Entendido" that closes it.
5. WHEN the user closes the Coming_Soon_Sheet in any way, THE Landing SHALL stay open on the same page.
6. THE Create_Account_Button SHALL NOT navigate to a registration page nor send any network request.

### Requirement 7: Pestaña de Ajustes en la navegación

**User Story:** Como persona que usa la app a diario, quiero llegar a los ajustes con un toque desde cualquier pestaña, para cambiar música o sonido sin buscar.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL include the Settings_Tab with the label "Ajustes" and a stroke gear icon defined in `src/ui/icons.js`.
2. THE Settings_Tab SHALL be the last entry of `TABS` in `app-shell.js`.
3. WHILE the viewport width is less than 768 px, THE Navigation_Bar SHALL display the five tabs in the bottom bar without horizontal scrolling.
4. WHILE the viewport width is 768 px or more, THE Navigation_Bar SHALL display the five tabs in the side rail.
5. WHEN `app.html` is opened with the URL hash `#/settings`, THE App SHALL display the Settings_View directly, without passing through the Landing.
6. WHEN the user taps the Settings_Tab, THE App SHALL display the Settings_View and mark the Settings_Tab with `aria-current="page"`.
7. THE Settings_Tab SHALL provide an `aria-label` equal to "Ajustes".

### Requirement 8: Música, sonido y modo demo en Ajustes

**User Story:** Como persona que ajusta la app, quiero encontrar la música, el sonido y el modo demo en un solo lugar, para no buscarlos en varias pantallas.

#### Acceptance Criteria

1. THE Settings_View SHALL display a switch for "Música de fondo", a switch for "Sonido de la campanita" and a switch for "Modo demo".
2. THE Settings_View SHALL expose each switch with `role="switch"` and an `aria-checked` value equal to the current value in `store.state.settings`.
3. WHEN the user toggles the switch "Música de fondo" on, THE Settings_View SHALL set `settings.music` to true and start the music, as `focus-view` does today.
4. WHEN the user toggles the switch "Música de fondo" off, THE Settings_View SHALL set `settings.music` to false and stop the music.
5. IF Tone.js is not available, THEN THE Settings_View SHALL display the switch "Música de fondo" as disabled with the text "No disponible sin conexión" and keep the other settings functional.
6. WHEN the user toggles the switch "Sonido de la campanita", THE Settings_View SHALL update `settings.sound`.
7. WHEN the user toggles the switch "Modo demo", THE Settings_View SHALL update `settings.demo` with the Store behavior unchanged, so that rounds last 10 seconds while the Modo demo is on.
8. THE Settings_View SHALL describe the Modo demo with the text "Rondas de 10 segundos para mostrar la app".
9. WHEN the user toggles any switch, THE Settings_View SHALL trigger `haptic()` and keep the new value after reloading the App.

### Requirement 9: Acciones de datos en Ajustes

**User Story:** Como persona que quiere probar o limpiar la app, quiero las acciones de datos en Ajustes, para controlarlas desde un lugar claro y seguro.

#### Acceptance Criteria

1. THE Settings_View SHALL display the Data_Actions "Cargar datos de ejemplo" and "Borrar todos los datos" in a section titled "Datos".
2. WHEN the user taps "Cargar datos de ejemplo" and the Store contains at least one task, THE Settings_View SHALL open `confirmSheet` with the message that the current tasks and rounds will be replaced, and run `store.seedDemo()` only after the user confirms.
3. WHEN the user taps "Cargar datos de ejemplo" and the Store contains no tasks, THE Settings_View SHALL run `store.seedDemo()` without confirmation and show the toast "Datos de ejemplo cargados ✨".
4. WHEN the user taps "Borrar todos los datos", THE Settings_View SHALL open `confirmSheet` in danger mode and run `store.reset()` only after the user confirms.
5. WHEN `store.reset()` completes from the Settings_View, THE Settings_View SHALL show the toast "Todo limpio 🌱".
6. WHEN the user cancels a `confirmSheet` of the Data_Actions, THE Store SHALL keep tasks, rounds and settings unchanged.
7. WHEN `store.reset()` or `store.seedDemo()` completes, THE Store SHALL keep the values of `settings.music`, `settings.sound`, `settings.demo` and `settings.minutes`.

### Requirement 10: Foco y Estadísticas sin controles movidos

**User Story:** Como persona que usa Foco y Estadísticas, quiero que esas pantallas se enfoquen en su tarea, para no ver controles que ya viven en Ajustes.

#### Acceptance Criteria

1. THE `focus-view` SHALL NOT display the controls for music, sound and Modo demo.
2. THE `focus-view` SHALL keep the round duration chips of 5, 10, 15, 25, 35, 45 and 60 minutes.
3. WHILE `settings.demo` is true, THE `focus-view` SHALL display an indicator with the text "Modo demo" and a link-style control that navigates to the Settings_Tab.
4. THE `stats-view` SHALL NOT display the Data_Actions.
5. WHERE the `stats-view` shows an empty state, THE `stats-view` SHALL offer a control with the text "Cargar datos de ejemplo en Ajustes" that navigates to the Settings_Tab.
6. WHEN a round finishes while music is playing, THE App SHALL lower the music volume and play the chime exactly as before this spec.

### Requirement 11: Espacios reservados para cuenta y sesiones

**User Story:** Como persona que verá cuentas y sesiones en el futuro, quiero ver desde ya dónde estarán, para entender hacia dónde crece la app.

#### Acceptance Criteria

1. THE Settings_View SHALL display a Reserved_Slot titled "Mi cuenta" with the label "Próximamente" and the text "Aquí podrás crear tu cuenta e iniciar sesión".
2. THE Settings_View SHALL display a Reserved_Slot titled "Mis sesiones" with the label "Próximamente" and the text "Aquí verás los dispositivos donde tienes abierta tu cuenta".
3. THE Reserved_Slot SHALL be visually distinct from the active controls by using reduced opacity (`text-ink/50`) and SHALL NOT respond to taps.
4. THE Reserved_Slot SHALL be exposed to assistive technologies with `aria-disabled="true"`.
5. THE Settings_View SHALL NOT make any network request nor store any account data.

### Requirement 12: Compatibilidad con datos guardados

**User Story:** Como persona que ya usa la app, quiero conservar mis datos al actualizar, para no perder mis tareas, rondas ni ajustes.

#### Acceptance Criteria

1. WHEN the App loads data saved by a previous version, THE Store SHALL preserve every task, round and setting.
2. THE Store SHALL keep the key `jardin-movil:v1` because this spec does not change the shape of the saved state.
3. IF the saved settings contain the obsolete field `introSeen`, THEN THE Store SHALL ignore it without failing.
4. THE Store SHALL expose a read method that returns whether Local_Data exists, computed from `state.tasks` and `state.rounds` without mutating state.

### Requirement 13: Documentación

**User Story:** Como mantenedor del proyecto, quiero que la documentación refleje este cambio, para que el equipo y el agente `qa-tester` sepan qué verificar.

#### Acceptance Criteria

1. THE documentation SHALL include the new README `docs/modules/settings/README.md` with the sections Descripción, Pruebas para qa-tester and Changelog.
2. THE README of the module `settings` SHALL contain one test case, with steps and expected result, for each of Requirements 1 to 11 and 14.
3. THE documentation SHALL update `docs/modules/pomodoro/README.md` and `docs/modules/statistics/README.md` to remove the moved controls and add a Changelog entry with the date, version and change.
4. THE documentation SHALL update `docs/features.md` by adding the use cases of the Landing and the module `settings` under "Casos de uso disponibles".
5. THE documentation SHALL add to the roadmap of `docs/features.md` the three follow-up specs: `accounts-auth`, `cloud-sync` (suggesting DynamoDB instead of MongoDB) and `multi-device-sessions`.
6. THE documentation SHALL add the module `settings` to the module table of the product description and to the documentation map.
7. THE documentation SHALL record the Changelog entries of the module `settings` with version `1.0.0` for the first version and `2.0.0` for the redesign of the Landing, and the entries of `pomodoro` and `statistics` with a MINOR version.
8. THE documentation SHALL update the structure and the stack in `tech.md`, the color source in `design-system.md`, the deployment skill and the README of the app so that they mention both pages (`index.html` and `app.html`).

### Requirement 14: Landing y App en páginas separadas, con salida

**User Story:** Como persona que usa el navegador con naturalidad, quiero que la bienvenida y la app sean páginas distintas, para poder ir atrás y adelante, recargar sin perder el lugar y volver a la bienvenida cuando quiera.

#### Acceptance Criteria

1. THE Landing (`index.html`) and the App (`app.html`) SHALL be different documents, and moving between them SHALL be a real navigation recorded in the browser history.
2. WHEN the user presses the back button of the browser after entering the App, THE browser SHALL return to the Landing, and WHEN the user presses forward THE browser SHALL return to the App.
3. WHEN `app.html` is reloaded, THE App SHALL stay on the current tab and SHALL NOT display the Landing.
4. THE App SHALL display the Exit_Button in the header of the Tareas view, with `aria-label` "Salir a la página de inicio" and a target of at least 44 by 44 px, and a row "Salir a la página de inicio" at the end of the Settings_View.
5. WHEN the user activates an Exit_Button, THE App SHALL navigate to `index.html` without modifying any saved data.
6. THE manifest `manifest.webmanifest` SHALL use `./app.html` as `start_url`, so that an installed app opens directly in the App.
7. THE deployment scripts of the skill `deploy-to-aws` SHALL publish both `index.html` and `app.html`.
8. WHEN the browser restores the Landing from its back-forward cache, THE Landing SHALL reload so that the button text and the garden reflect the data saved meanwhile.

### Requirement 15: Contenido de la landing

**User Story:** Como persona que aún no conoce Focus Garden, quiero entender qué hace, cómo funciona y que es open source, para confiar en probarla.

#### Acceptance Criteria

1. THE Landing SHALL display a top bar fixed to the top with the name of the app, links to the sections "Cómo funciona", "Funciones" and "Open source" (from 768 px of width) and an "Entrar" button.
2. THE Landing SHALL display a section "Cómo funciona" with three steps and a ladder with the six plants and the rounds each one needs, built from `PLANTS` of `src/core/rules.js`, and the sentence that finishing a task without rounds plants nothing.
3. THE Landing SHALL display a section "Funciones" with six cards: tareas por tipo, pomodoro, jardín 3D, estadísticas, música lofi y pensada para el celular. The type chips SHALL be built from `TASK_TYPES`.
4. THE Landing SHALL display a section "Open source" that states that the code is open, lists the stack (HTML y JavaScript con módulos ES, Web Components, CDN, sin build), shows the commands to run it locally and links to the repository on GitHub in a new tab with `rel="noopener noreferrer"`.
5. THE Landing SHALL display a final call to action with an Enter_Button and a footer with a link to the repository.
6. THE Landing SHALL NOT claim a specific license, because the repository does not declare one.
7. THE Landing SHALL NOT use raster images: it is built with CSS, emojis and the Hero_Garden.
8. WHEN the user follows a link to a section, THE Landing SHALL scroll smoothly unless Reduced_Motion is active, leaving the title of the section visible below the top bar.

## Supuestos y notas

- **Frecuencia de la Intro_Modal (decisión revisada).** Aparece **cada vez** que se entra a la App desde la Landing, con "Continuar" o sin datos, y no guarda ningún indicador. La primera versión la mostraba una sola vez y solo sin cuenta, y no aparecía con "Continuar"; eso hacía que el recordatorio pareciera no funcionar. Como la Landing ya no se carga al recargar la App, el aviso solo sale cuando la persona decide volver a entrar, así que no estorba al uso diario.
- **Landing separada de la App (decisión).** Antes la Landing era un componente sobre las pestañas y se mostraba en cada carga, incluso al recargar dentro de la App, sin forma de volver a ella. Ahora son dos documentos: atrás, adelante y recargar se comportan como en cualquier sitio, y la Landing no carga el código de la App. El hash de pestañas (`#/focus`) solo existe en `app.html`.
- **"Continuar" con datos previos.** Quien actualiza desde la versión anterior y ya tiene Local_Data ve "Continuar mi jardín" y también ve el recordatorio.
- **Guardados con `introSeen`.** Los guardados de la primera versión pueden traer `settings.introSeen`. Se ignora sin migrar: el campo ya no se lee y la clave `jardin-movil:v1` no cambia.
- **Botón principal con borde grueso.** El Primary_Button de la Landing usa un borde inferior grueso, un guiño a los videojuegos que se aparta de la regla "sin sombras duras" de `design-system.md`. Se limita a la Landing; la App no lo usa.
- **Franjas horarias.** Los límites de Time_Period (06:00, 12:00, 16:00, 20:00) son una propuesta ajustable en el diseño sin cambiar los requisitos.
- **Tensión con "Datos locales / sin servidor".** El principio de producto 6 dice que todo vive en `localStorage` y que no hay cuentas ni servidor. Este spec lo respeta porque solo anuncia las cuentas. `accounts-auth` y `cloud-sync` lo contradicen y deben resolverlo, actualizando `product.md` y `tech.md` (el stack hoy es sin backend y sin build), definiendo qué datos viajan y qué sigue funcionando sin conexión.
- **Principio de producto 2 ("sin complejidad innecesaria").** Los Reserved_Slot son el único añadido sin función. Se aceptan porque el usuario los pidió para anclar los specs 2 a 4; deben retirarse si esos specs se cancelan.
- **Roadmap sin implementar.** `accounts-auth`, `cloud-sync` y `multi-device-sessions` solo se anotan en `docs/features.md`; antes de construirlos cada uno necesita su propio spec.
- **Duración de ronda.** Se queda en Foco porque se cambia entre rondas y es parte del flujo de enfoque.
