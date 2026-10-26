# Implementation Plan: tareas-app

## Overview

El plan construye la aplicación por capas, de abajo hacia arriba, de modo que cada tarea deje algo que la persona (o las pruebas) puedan verificar. Primero se prepara el proyecto con Vite + React + TypeScript + Tailwind y Vitest. Luego se definen los tipos compartidos, la capa de datos (`Almacen` sobre `localStorage`) y la lógica pura (validación, formato de tiempo, progreso y la máquina de estados del temporizador pomodoro), cada una con sus pruebas de propiedades. Después se construyen los componentes de interfaz y la pantalla principal, y finalmente se conecta todo en `PantallaTareas` con sus estados de carga, vacío y error. Las pruebas de propiedades referencian cada propiedad del diseño con la etiqueta **Feature: tareas-app, Property N**.

## Tasks

- [x] 1. Preparar el proyecto y las herramientas base
  - Crear el proyecto con `npm create vite@latest . -- --template react-ts` e instalar dependencias con `npm install`.
  - Instalar y configurar Tailwind CSS (sirve para dar estilos pensados primero para pantalla de teléfono) y la hoja de estilos base.
  - Configurar Vitest para ejecutar con `npx vitest run`; agregar la librería de pruebas de propiedades (fast-check) para las pruebas universales.
  - Crear la estructura de carpetas `src/componentes/`, `src/pantallas/`, `src/logica/`, `src/datos/`, y un `README.md` breve con qué hace la app y cómo ejecutarla (`npm run dev`).
  - _Requirements: 1.1_

- [x] 2. Definir los tipos compartidos y el generador de id
  - [x] 2.1 Crear `src/tipos.ts` con `TipoDeTarea` y la interfaz `Tarea` (id, descripcion, tipo?, horasEstimadas?, fechaLimite?, duracionRealSegundos, completada).
    - Documentar los rangos y campos obligatorios/opcionales según el modelo de datos.
    - _Requirements: 2.2, 2.3, 2.4, 4.4_
  - [x] 2.2 Crear `src/logica/id.ts` con una función que genere un id único usando `crypto.randomUUID` con respaldo simple si no está disponible.
    - _Requirements: 2.9_

- [x] 3. Implementar la capa de datos (Almacen sobre localStorage)
  - [x] 3.1 Implementar `src/datos/almacen.ts` con `ResultadoAlmacen<T>`, `ErrorAlmacen`, la interfaz `Almacen` y `crearAlmacenLocalStorage()`.
    - Usar una clave privada con sufijo de versión (p. ej. `tareas-app:tareas:v1`).
    - `leerTareas`: lista vacía si no hay datos (sin error); error `formato` si el JSON es inválido o la forma no coincide; error `lectura` si `getItem` lanza.
    - `guardarTareas`: serializa a JSON y escribe; error `escritura` si `setItem` lanza.
    - La capa de datos nunca lanza hacia la interfaz; siempre devuelve `ResultadoAlmacen`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 3.2 Escribir prueba de propiedad del round trip del Almacen
    - **Feature: tareas-app, Property 16: El Almacén cumple round trip al guardar y leer tareas**
    - **Validates: Requirements 6.1, 6.2**
    - Usar `localStorage` simulado; mínimo 100 iteraciones.
  - [ ]* 3.3 Escribir pruebas unitarias del Almacen para casos límite
    - Sin datos → lista vacía sin error; JSON dañado → error `formato`; fallo de lectura → `lectura`; fallo de escritura → `escritura`.
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [x] 4. Implementar la lógica de tiempo
  - [x] 4.1 Implementar `src/logica/tiempo.ts` con `formatearMmSs(segundos)` y `segundosAMinutos(segundos)`.
    - `segundosAMinutos` redondea hacia abajo y acota a 0..999999.
    - _Requirements: 3.2, 4.4, 4.5_
  - [ ]* 4.2 Escribir prueba de propiedad del formato mm:ss
    - **Feature: tareas-app, Property 6: El tiempo restante se formatea correctamente como mm:ss**
    - **Validates: Requirements 3.2**
    - Para segundos entre 0 y 900; mínimo 100 iteraciones.
  - [ ]* 4.3 Escribir prueba de propiedad de duración real en minutos enteros hacia abajo
    - **Feature: tareas-app, Property 12: La duración real se muestra en minutos enteros hacia abajo**
    - **Validates: Requirements 4.4, 4.5**
    - Verificar piso(segundos/60) acotado a 0..999999; incluir caso 0 → 0 minutos; mínimo 100 iteraciones.

- [x] 5. Implementar la lógica de progreso
  - [x] 5.1 Implementar `src/logica/progreso.ts` con `calcularProgreso(totalTareas, tareasCompletadas)`.
    - Devuelve porcentaje 0..100 redondeado al entero; si total es 0 devuelve 0.
    - _Requirements: 5.3, 5.4_
  - [ ]* 5.2 Escribir prueba de propiedad del cálculo de progreso
    - **Feature: tareas-app, Property 15: La barra de progreso es el porcentaje redondeado de completadas**
    - **Validates: Requirements 5.3, 5.4**
    - Incluir el caso sin tareas → 0; mínimo 100 iteraciones.

- [x] 6. Implementar la validación de tareas
  - [x] 6.1 Implementar `src/logica/validacionTarea.ts` con `validarTarea(datos)` y los tipos `DatosFormularioTarea`, `TareaValida`, `ErroresFormulario`, `ResultadoValidacion`.
    - Descripción: obligatoria, 1..200 tras recortar espacios; vacía o solo espacios y >200 se rechazan.
    - Tipo: opcional; solo `Trabajo`, `Salud`, `Relaciones interpersonales`, `Hobbies`.
    - Horas estimadas: opcional; si hay texto debe ser número entre 0 y 1000.
    - Fecha límite: opcional; si hay texto debe ser fecha de calendario válida.
    - En caso de error, devolver errores por campo (conservar lo ingresado).
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [ ]* 6.2 Escribir prueba de propiedad de la descripción
    - **Feature: tareas-app, Property 1: La descripción válida se acepta y la inválida se rechaza**
    - **Validates: Requirements 2.2, 2.5, 2.6**
    - Mínimo 100 iteraciones.
  - [ ]* 6.3 Escribir prueba de propiedad del tipo de tarea
    - **Feature: tareas-app, Property 2: El tipo de tarea solo admite los valores permitidos**
    - **Validates: Requirements 2.4**
    - Mínimo 100 iteraciones.
  - [ ]* 6.4 Escribir prueba de propiedad de las horas estimadas
    - **Feature: tareas-app, Property 3: Las horas estimadas solo son válidas como número en rango**
    - **Validates: Requirements 2.7**
    - Mínimo 100 iteraciones.
  - [ ]* 6.5 Escribir prueba de propiedad de la fecha límite
    - **Feature: tareas-app, Property 4: La fecha límite solo es válida como fecha de calendario**
    - **Validates: Requirements 2.8**
    - Mínimo 100 iteraciones.

- [x] 7. Implementar la máquina de estados del temporizador pomodoro
  - [x] 7.1 Implementar `src/logica/temporizador.ts` con `FasePomodoro`, `DURACIONES`, `EstadoTemporizador`, `EventoTemporizador`, `ResultadoTransicion`, `estadoInicial()` y `transicion(estado, evento)`.
    - `iniciar`: si no corría, pasa a corriendo; si ya corría, idempotente.
    - `pausar`: si corría y la fase es trabajo, entrega `trabajoNoContabilizado` en `segundosParaDuracionReal` y lo pone en 0; si ya estaba pausado, idempotente y suma 0.
    - `tick`: solo con corriendo; resta 1 a `segundosRestantes`; en trabajo incrementa `trabajoNoContabilizado`; al llegar a 0 marca `avisoFinDeFase`, vacía el trabajo pendiente y avanza de fase.
    - `finalizar`/`cerrar`: entregan el trabajo pendiente (si fase trabajo) y vuelven al estado inicial.
    - Ciclo de fases: cuarta fase de trabajo → descanso largo y contador a 0; trabajo no final → descanso corto; cualquier descanso → trabajo.
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3_
  - [ ]* 7.2 Escribir prueba de propiedad de idempotencia de iniciar
    - **Feature: tareas-app, Property 7: Iniciar sobre un temporizador en marcha es idempotente**
    - **Validates: Requirements 3.9**
    - Mínimo 100 iteraciones.
  - [ ]* 7.3 Escribir prueba de propiedad de idempotencia de pausar
    - **Feature: tareas-app, Property 8: Pausar sobre un temporizador ya pausado es idempotente**
    - **Validates: Requirements 3.8**
    - Mínimo 100 iteraciones.
  - [ ]* 7.4 Escribir prueba de propiedad del tick en marcha
    - **Feature: tareas-app, Property 9: Cada tick en marcha reduce el tiempo restante en un segundo**
    - **Validates: Requirements 3.5**
    - Mínimo 100 iteraciones.
  - [ ]* 7.5 Escribir prueba de propiedad del ciclo de fases
    - **Feature: tareas-app, Property 10: Las transiciones de fase siguen el ciclo pomodoro**
    - **Validates: Requirements 3.3, 3.4, 3.7**
    - Mínimo 100 iteraciones.
  - [ ]* 7.6 Escribir prueba de propiedad de no-doble-conteo de la duración real
    - **Feature: tareas-app, Property 11: La duración real suma el tiempo de trabajo sin doble conteo**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Usar secuencias aleatorias de eventos iniciar/tick/pausar/finalizar/cerrar con reloj inyectado; mínimo 100 iteraciones.

- [x] 8. Checkpoint - Verificar la lógica y los datos
  - Asegúrate de que todas las pruebas pasen (`npx vitest run`); si surgen dudas, pregunta a la persona.

- [x] 9. Implementar los componentes de estado e interfaz base
  - [x] 9.1 Implementar `src/componentes/EstadoCargando.tsx` y `src/componentes/EstadoVacio.tsx`.
    - EstadoVacio muestra un mensaje de que no hay tareas registradas.
    - _Requirements: 1.3, 1.4_
  - [x] 9.2 Implementar `src/componentes/MensajeError.tsx` con texto claro de qué ocurrió y, cuando aplica, un botón de acción (reintentar).
    - _Requirements: 1.6, 7.4_
  - [x] 9.3 Implementar `src/componentes/BarraProgreso.tsx` que muestra el porcentaje de `calcularProgreso`.
    - _Requirements: 5.3, 5.4_

- [x] 10. Implementar el formulario y las tarjetas de tarea
  - [x] 10.1 Implementar `src/componentes/FormularioTarea.tsx` con campos etiquetados (descripción, selector de tipo con los 4 valores, horas estimadas, fecha límite).
    - Llama a `validarTarea`; muestra errores por campo y conserva lo ingresado; operable con teclado y foco visible.
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, 7.1, 7.2, 7.4_
  - [ ]* 10.2 Escribir prueba de etiquetas accesibles del formulario
    - **Feature: tareas-app, Property 17: Cada campo del formulario tiene una etiqueta asociada**
    - **Validates: Requirements 7.1**
  - [x] 10.3 Implementar `src/componentes/TarjetaTarea.tsx` que muestra descripción, tipo, horas estimadas, fecha límite y la `Duracion_Real` en minutos; incluye botón para abrir el temporizador y el control "Completado" operable con ratón y teclado (Enter/Barra Espaciadora).
    - _Requirements: 3.1, 4.4, 4.5, 5.1, 7.2_
  - [x] 10.4 Implementar `src/componentes/TemporizadorPomodoro.tsx` que muestra el tiempo restante en `mm:ss`, botones iniciar/pausar y el aviso de fin de fase.
    - Mantiene el `setInterval` de 1 segundo y despacha eventos (`iniciar`, `pausar`, `tick`, `finalizar`, `cerrar`) a `transicion`; entrega hacia arriba los segundos para la `Duracion_Real`.
    - Operable con teclado y foco visible.
    - _Requirements: 3.2, 3.5, 3.6, 3.7, 7.2_

- [x] 11. Implementar y conectar la pantalla principal
  - [x] 11.1 Implementar `src/pantallas/PantallaTareas.tsx` con el estado (`estadoCarga`, `tareas`, `mensajeError`, `tareaConTemporizadorAbierto`).
    - Al montar: estado cargando, `almacen.leerTareas()`, luego listo (lista o vacío) o error con mensaje y reintento.
    - Renderiza `EstadoCargando`, `EstadoVacio` o la lista (`TarjetaTarea`) y la `BarraProgreso`.
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 6.2, 6.3, 6.5_
  - [x] 11.2 Conectar el registro de tareas en `PantallaTareas`: agregar en memoria (con id de `logica/id.ts`) y guardar con `guardarTareas`; si falla, revertir y mostrar error.
    - **Lógica a verificar: Property 5: Registrar una tarea válida hace crecer la lista en uno**
    - _Requirements: 2.9, 6.1, 6.4_
  - [ ]* 11.3 Escribir prueba de propiedad de agregar tarea a la lista
    - **Feature: tareas-app, Property 5: Registrar una tarea válida hace crecer la lista en uno**
    - **Validates: Requirements 2.9**
    - Probar la función pura que agrega la tarea a la lista; mínimo 100 iteraciones.
  - [x] 11.4 Conectar el completar tarea en `PantallaTareas`: marcar `completada`, quitarla de la lista visible, recalcular progreso y guardar; si falla, conservar la tarea y mostrar error.
    - **Lógica a verificar: Property 14: Completar una tarea la quita de la lista visible**
    - _Requirements: 5.2, 5.3, 5.5_
  - [ ]* 11.5 Escribir prueba de propiedad de completar tarea
    - **Feature: tareas-app, Property 14: Completar una tarea la quita de la lista visible**
    - **Validates: Requirements 5.2**
    - Probar la función pura que marca completada y filtra la lista visible; mínimo 100 iteraciones.
  - [x] 11.6 Conectar la acumulación de `Duracion_Real` en `PantallaTareas`: cuando el temporizador entrega `segundosParaDuracionReal`, sumar a la tarea y guardar; si falla, conservar el valor previo y mostrar error.
    - **Lógica a verificar: Property 13: La duración real actualizada se persiste en el Almacén**
    - _Requirements: 4.6, 4.7_
  - [ ]* 11.7 Escribir prueba de propiedad de persistencia de la duración real
    - **Feature: tareas-app, Property 13: La duración real actualizada se persiste en el Almacén**
    - **Validates: Requirements 4.6**
    - Sumar tiempo, guardar y releer del `Almacen`; comparar con memoria; mínimo 100 iteraciones.
  - [x] 11.8 Montar `PantallaTareas` en `App.tsx` y `main.tsx` para arrancar la aplicación.
    - _Requirements: 1.1, 1.2_

- [x] 12. Checkpoint final - Verificar la aplicación completa
  - Asegúrate de que todas las pruebas pasen (`npx vitest run`); si surgen dudas, pregunta a la persona.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido, pero se recomienda ejecutarlas para validar las propiedades del diseño.
- Cada tarea referencia requisitos específicos para trazabilidad; las pruebas de propiedades referencian la propiedad del diseño con la etiqueta **Feature: tareas-app, Property N**.
- La lógica es pura y determinista; el temporizador se prueba con eventos `tick` (reloj inyectado), sin `setInterval` dentro de la lógica.
- Los checkpoints aseguran validación incremental antes de seguir.
- Toda escritura pasa por el `Almacen`; la interfaz revierte en memoria si el guardado falla, de modo que lo mostrado siempre sea consistente.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "4.1", "5.1", "6.1", "7.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.2", "4.3", "5.2", "6.2", "6.3", "6.4", "6.5", "7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 4, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 5, "tasks": ["10.1", "10.3", "10.4"] },
    { "id": 6, "tasks": ["10.2"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["11.2", "11.4", "11.6"] },
    { "id": 9, "tasks": ["11.3", "11.5", "11.7", "11.8"] }
  ]
}
```
