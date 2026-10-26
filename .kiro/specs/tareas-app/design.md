# Design Document

## Overview

tareas-app es una aplicación web de una sola página, pensada para usarse en el navegador de un teléfono, de uso personal y sin servidor ni cuentas. La persona registra tareas, las trabaja con un temporizador estilo pomodoro que acumula la duración real, y las marca como completadas para que salgan de la lista y avance una barra de progreso. Los datos viven en el navegador (`localStorage`) detrás de un módulo de datos (`src/datos/almacen.ts`), de modo que la fuente de almacenamiento pueda cambiarse en el futuro sin tocar la interfaz.

El diseño separa tres capas con responsabilidades claras:

- **Interfaz (componentes/pantallas):** muestra las tareas, formularios, el temporizador y la barra de progreso; captura las acciones de la persona.
- **Lógica (`src/logica/`):** reglas puras sin interfaz (validación, cálculo del progreso, máquina de estados del temporizador, formato de tiempo). Son funciones pequeñas y fáciles de probar con Vitest.
- **Datos (`src/datos/`):** guarda y lee las tareas en `localStorage`, con manejo de errores explícito.

Esta separación permite probar la lógica aislada, mostrar estados de carga/vacío/error de forma consistente y sustituir el almacenamiento más adelante.

### Stack técnico

- Vite + React + TypeScript.
- Estilos con Tailwind CSS (diseño pensado primero para pantalla de teléfono).
- Persistencia en `localStorage` a través del módulo `Almacen`.
- Pruebas de la lógica con Vitest.
- Sin servidor, sin inicio de sesión y sin cuentas.

## Architecture

### Diagrama de capas

```
┌─────────────────────────────────────────────┐
│  Interfaz (React)                             │
│  pantallas/  componentes/                     │
│   - PantallaTareas                            │
│   - FormularioTarea, ListaTareas, Tarjeta...  │
│   - TemporizadorPomodoro, BarraProgreso       │
└───────────────┬───────────────────────────────┘
                │ llama a funciones puras / acciones
                ▼
┌─────────────────────────────────────────────┐
│  Lógica (TypeScript puro, sin React)          │
│  logica/                                      │
│   - validacionTarea                           │
│   - progreso                                  │
│   - temporizador (máquina de estados)         │
│   - tiempo (formato mm:ss, minutos)           │
└───────────────┬───────────────────────────────┘
                │ usa para leer/guardar
                ▼
┌─────────────────────────────────────────────┐
│  Datos                                        │
│  datos/almacen.ts  → localStorage             │
└─────────────────────────────────────────────┘
```

### Flujo de datos general

1. Al abrir, `PantallaTareas` pide al `Almacen` las tareas. Mientras llega la respuesta muestra el estado de carga.
2. El `Almacen` lee `localStorage`, interpreta el JSON y devuelve un resultado (éxito con las tareas, o error tipificado).
3. La pantalla guarda las tareas en su estado de React y muestra la lista o el estado vacío. Si hubo error, muestra el mensaje y la acción de reintentar.
4. Al registrar, completar o acumular duración, la pantalla actualiza su estado en memoria y pide al `Almacen` guardar. Si el guardado falla, revierte a lo previo en memoria y muestra el mensaje de error.

### Organización de carpetas

```
src/
  componentes/
    BarraProgreso.tsx
    TarjetaTarea.tsx
    TemporizadorPomodoro.tsx
    MensajeError.tsx
    EstadoVacio.tsx
    EstadoCargando.tsx
  pantallas/
    PantallaTareas.tsx        una sola pantalla principal
  logica/
    validacionTarea.ts
    progreso.ts
    temporizador.ts
    tiempo.ts
    id.ts
  datos/
    almacen.ts
  tipos.ts                    tipos compartidos (Tarea, etc.)
  App.tsx
  main.tsx
docs/
```

## Components and Interfaces

### Capa de datos: `src/datos/almacen.ts`

El `Almacen` es la única puerta a `localStorage`. Devuelve resultados tipificados en lugar de lanzar excepciones hacia la interfaz, para que la pantalla decida qué mensaje mostrar. Usa una sola clave de almacenamiento.

```typescript
// Resultado explícito para que la interfaz distinga éxito de error.
export type ResultadoAlmacen<T> =
  | { ok: true; valor: T }
  | { ok: false; error: ErrorAlmacen };

// Tipos de error que la interfaz traduce a mensajes claros.
export type ErrorAlmacen =
  | { tipo: 'lectura'; mensaje: string }   // no se pudo leer de localStorage
  | { tipo: 'escritura'; mensaje: string } // no se pudo guardar en localStorage
  | { tipo: 'formato'; mensaje: string };  // datos guardados dañados/ilegibles

export interface Almacen {
  // Lee todas las tareas. Si no hay datos, devuelve lista vacía (no es error).
  leerTareas(): ResultadoAlmacen<Tarea[]>;
  // Guarda la lista completa de tareas.
  guardarTareas(tareas: Tarea[]): ResultadoAlmacen<void>;
}

// Implementación concreta sobre localStorage del navegador.
export function crearAlmacenLocalStorage(): Almacen;
```

Notas de diseño:

- La clave de almacenamiento es una constante privada del módulo (por ejemplo `'tareas-app:tareas:v1'`), con sufijo de versión para futuras migraciones.
- `leerTareas` interpreta el JSON y valida la forma básica de cada tarea. Si el JSON es inválido o la forma no coincide, devuelve `error: { tipo: 'formato' }` (Requisito 6.6). Si `getItem` lanza, devuelve `tipo: 'lectura'` (6.5). Si no hay valor almacenado, devuelve lista vacía sin error (6.3).
- `guardarTareas` serializa a JSON y llama a `setItem`. Si lanza (por cuota u otro motivo), devuelve `tipo: 'escritura'` (6.4).
- La pantalla guarda la lista completa en cada cambio. Es simple y suficiente para uso personal; la interfaz revierte en memoria si el guardado falla.

### Capa de lógica: `src/logica/`

Funciones puras, sin React ni acceso directo a `localStorage`. Reciben datos y devuelven datos, por lo que son fáciles de probar.

#### `validacionTarea.ts`

```typescript
export interface DatosFormularioTarea {
  descripcion: string;
  tipo?: TipoDeTarea | '';        // '' = sin asignar
  horasEstimadas?: string;        // texto del input; se valida y convierte
  fechaLimite?: string;           // 'YYYY-MM-DD' del input date; '' = sin fecha
}

export interface TareaValida {
  descripcion: string;
  tipo?: TipoDeTarea;
  horasEstimadas?: number;
  fechaLimite?: string;           // ISO 'YYYY-MM-DD'
}

// Error por campo para conservar los datos ya ingresados y mostrar mensajes.
export type ErroresFormulario = Partial<
  Record<'descripcion' | 'tipo' | 'horasEstimadas' | 'fechaLimite', string>
>;

export type ResultadoValidacion =
  | { valido: true; tarea: TareaValida }
  | { valido: false; errores: ErroresFormulario };

// Valida y normaliza los datos del formulario.
export function validarTarea(datos: DatosFormularioTarea): ResultadoValidacion;
```

Reglas de validación:

- `descripcion`: obligatoria; tras recortar espacios debe tener de 1 a 200 caracteres. Vacía o solo espacios → error "la descripción es obligatoria" (2.5). Más de 200 → error de límite (2.6).
- `tipo`: opcional; si se asigna, solo se aceptan `Trabajo`, `Salud`, `Relaciones interpersonales`, `Hobbies` (2.4).
- `horasEstimadas`: opcional; si hay texto, debe ser un número entre 0 y 1000; si no, error (2.7).
- `fechaLimite`: opcional; si hay texto, debe ser una fecha de calendario válida; si no, error (2.8).

#### `tiempo.ts`

```typescript
// Formatea segundos restantes como mm:ss (p. ej. 90 -> "01:30").
export function formatearMmSs(segundos: number): string;

// Convierte segundos acumulados a minutos enteros hacia abajo, acotado a 0..999999.
export function segundosAMinutos(segundos: number): number;
```

#### `progreso.ts`

```typescript
// Porcentaje de tareas completadas respecto al total, 0..100, redondeado al entero.
// Si total es 0, devuelve 0 (evita división por cero).
export function calcularProgreso(
  totalTareas: number,
  tareasCompletadas: number,
): number;
```

#### `temporizador.ts` — máquina de estados del pomodoro

El temporizador se modela como una función de transición pura sobre un estado inmutable. La interfaz dispara los "ticks" con un intervalo de 1 segundo y el reloj del navegador; la lógica no usa `setInterval` directamente, lo que la hace testeable de forma determinista.

```typescript
export type FasePomodoro = 'trabajo' | 'descanso-corto' | 'descanso-largo';

export const DURACIONES: Record<FasePomodoro, number> = {
  'trabajo': 900,         // 15 minutos
  'descanso-corto': 300,  // 5 minutos
  'descanso-largo': 600,  // 10 minutos
};

export interface EstadoTemporizador {
  fase: FasePomodoro;
  segundosRestantes: number;       // de la fase en curso
  corriendo: boolean;              // true mientras disminuye el tiempo
  fasesTrabajoCompletadas: number; // 0..3; a las 4 toca descanso largo
  // Segundos de trabajo acumulados en esta fase desde el último inicio/reanudación
  // que todavía no se han sumado a la Duracion_Real. Evita el doble conteo.
  trabajoNoContabilizado: number;
}

export type EventoTemporizador =
  | { tipo: 'iniciar' }
  | { tipo: 'pausar' }
  | { tipo: 'tick' }        // pasa 1 segundo de reloj
  | { tipo: 'finalizar' }   // termina el temporizador de la tarea
  | { tipo: 'cerrar' };     // cierra la vista del temporizador

export interface ResultadoTransicion {
  estado: EstadoTemporizador;
  // Segundos de trabajo que la interfaz debe sumar a la Duracion_Real de la tarea
  // a raíz de este evento (0 cuando no corresponde sumar). Nunca doble conteo.
  segundosParaDuracionReal: number;
  // Señal de fin de fase para que la interfaz muestre el aviso visible.
  avisoFinDeFase: boolean;
}

export function estadoInicial(): EstadoTemporizador;

// Transición pura: dado un estado y un evento, devuelve el siguiente estado,
// cuánto sumar a la Duracion_Real y si hay aviso de fin de fase.
export function transicion(
  estado: EstadoTemporizador,
  evento: EventoTemporizador,
): ResultadoTransicion;
```

Comportamiento de la máquina de estados:

- `iniciar`: si no está corriendo, pasa a `corriendo = true`. Si ya corría, no cambia nada (idempotente, 3.9).
- `pausar`: si corría, pasa a `corriendo = false` y, si la fase era `trabajo`, entrega en `segundosParaDuracionReal` el valor de `trabajoNoContabilizado` y lo pone en 0. Si ya estaba pausado, no cambia nada y suma 0 (idempotente, 3.8, 4.1).
- `tick`: solo tiene efecto si `corriendo` es true. Resta 1 a `segundosRestantes`. Si la fase es `trabajo`, incrementa `trabajoNoContabilizado` en 1. Cuando `segundosRestantes` llega a 0, marca `avisoFinDeFase = true`, cierra la fase (si era trabajo, suma el `trabajoNoContabilizado` restante a `segundosParaDuracionReal` y lo reinicia) y avanza a la siguiente fase según el ciclo (3.5, 3.7).
- `finalizar` / `cerrar`: si la fase era `trabajo`, entrega el `trabajoNoContabilizado` pendiente en `segundosParaDuracionReal` y lo pone en 0 (4.2, 4.3). Vuelve al estado inicial.

Ciclo de fases (3.3, 3.4, 3.7):

- Tras una fase de `trabajo` que termina: si las fases de trabajo completadas llegan a 4, pasa a `descanso-largo` y reinicia el contador a 0; si no, pasa a `descanso-corto` e incrementa el contador.
- Tras una fase de descanso (corto o largo): pasa a `trabajo`.

Este diseño cumple el requisito clave de "sumar solo el tiempo de trabajo transcurrido y aún no contabilizado": el tiempo se acumula tick a tick en `trabajoNoContabilizado` y se vacía (se entrega para sumar) exactamente una vez al pausar, finalizar, cerrar o cambiar de fase. Así no hay doble conteo ni pérdida.

### Capa de interfaz: pantallas y componentes

#### `PantallaTareas.tsx` (única pantalla)

Orquesta el estado de la aplicación y los estados de carga/vacío/error.

Estado interno (React):

- `estadoCarga`: `'cargando' | 'listo' | 'error'`.
- `tareas`: `Tarea[]` en memoria (fuente de verdad de la interfaz).
- `mensajeError`: texto de error visible y, cuando aplica, acción de reintentar.
- `tareaConTemporizadorAbierto`: id de la tarea cuyo temporizador se muestra, o `null`.

Responsabilidades:

- Al montar: estado `cargando`, llama a `almacen.leerTareas()`, luego `listo` con las tareas o `error` con mensaje y reintento (1.2–1.6).
- Mostrar `EstadoCargando`, `EstadoVacio` o `ListaTareas` según corresponda (1.3, 1.4, 1.5, 6.3).
- Agregar tarea válida: la añade en memoria y llama a `guardarTareas`; si falla, revierte y muestra error (2.9, 6.1, 6.4).
- Completar tarea: la quita de la lista en memoria, recalcula progreso y guarda; si falla, la conserva y muestra error (5.2, 5.5).
- Acumular `Duracion_Real`: cuando el temporizador entrega `segundosParaDuracionReal`, suma a la tarea y guarda; si falla, conserva el valor previo y muestra error (4.6, 4.7).

#### Componentes

- `FormularioTarea`: campos con etiquetas asociadas (descripción, tipo como selector de los 4 valores, horas estimadas, fecha límite). Llama a `validarTarea`; si hay errores los muestra junto al campo y conserva lo ingresado (2.1, 2.2, 7.1, 7.4).
- `ListaTareas`: renderiza una `TarjetaTarea` por tarea.
- `TarjetaTarea`: muestra descripción, tipo, horas estimadas, fecha límite y la `Duracion_Real` en minutos; incluye el botón para abrir el `TemporizadorPomodoro` y el control "Completado" operable con ratón y teclado (3.1, 4.4, 5.1).
- `TemporizadorPomodoro`: muestra el tiempo restante en `mm:ss`, los botones iniciar/pausar y el aviso de fin de fase. Mantiene el `setInterval` de 1 segundo y despacha eventos a la máquina de estados pura (3.2, 3.5, 3.6, 3.7).
- `BarraProgreso`: muestra el porcentaje calculado por `calcularProgreso` (5.3, 5.4).
- `MensajeError`: muestra el mensaje y, si aplica, un botón de acción (reintentar). Con texto claro de qué ocurrió y qué hacer (1.6, 7.4).
- `EstadoVacio` y `EstadoCargando`: estados de lista vacía y de carga.

## Data Models

### `Tarea` (en `src/tipos.ts`)

```typescript
export type TipoDeTarea =
  | 'Trabajo'
  | 'Salud'
  | 'Relaciones interpersonales'
  | 'Hobbies';

export interface Tarea {
  id: string;                    // identificador único (p. ej. crypto.randomUUID)
  descripcion: string;           // 1..200 caracteres, obligatoria
  tipo?: TipoDeTarea;            // opcional
  horasEstimadas?: number;       // opcional, 0..1000
  fechaLimite?: string;          // opcional, 'YYYY-MM-DD'
  duracionRealSegundos: number;  // acumulada, 0..(999999*60), empieza en 0
  completada: boolean;           // true cuando sale de la lista
}
```

Decisiones de modelo:

- La `Duracion_Real` se guarda en **segundos** (`duracionRealSegundos`) para no perder precisión al acumular; la interfaz la muestra en minutos enteros hacia abajo con `segundosAMinutos` (4.4, 4.5).
- `completada` se guarda en la misma lista en lugar de borrar la tarea. La `Lista_De_Tareas` que ve la persona es el subconjunto con `completada === false`; el total para el progreso es toda la lista. Así el progreso puede reflejar completadas sobre total (5.3) y las completadas quedan persistidas.
- `id` se genera al registrar la tarea (módulo `logica/id.ts`, usando `crypto.randomUUID` con respaldo simple si no está disponible).

### Modelo de persistencia

- Clave única en `localStorage` con la lista completa de tareas serializada como JSON.
- `leerTareas` valida que el contenido sea un arreglo y que cada elemento tenga la forma mínima de `Tarea`; si no, error de formato (6.6).

## Error Handling

El manejo de errores sigue el principio de "errores visibles": la persona siempre ve qué pasó y qué puede hacer, y nunca se pierde el estado válido en memoria.

| Situación | Origen | Respuesta de la interfaz | Requisito |
|-----------|--------|--------------------------|-----------|
| No se pueden cargar las tareas al abrir | `leerTareas` → `lectura` | Mensaje de error + acción "Reintentar" | 1.6, 6.5 |
| Datos guardados dañados/ilegibles | `leerTareas` → `formato` | Mensaje de que los datos no se pudieron interpretar | 6.6 |
| No se puede guardar un cambio | `guardarTareas` → `escritura` | Revertir al estado previo en memoria + mensaje | 6.4, 2.9 |
| Falla al guardar la `Duracion_Real` | `guardarTareas` → `escritura` | Conservar la `Duracion_Real` previa + mensaje | 4.7 |
| Falla al guardar "completada" | `guardarTareas` → `escritura` | Conservar la tarea en la lista + mensaje | 5.5 |
| Datos de formulario inválidos | `validarTarea` | Mostrar error por campo, conservar lo ingresado | 2.5–2.8, 7.4 |

Principios transversales:

- La capa de datos nunca lanza hacia la interfaz: devuelve `ResultadoAlmacen` con un error tipificado.
- La interfaz actualiza memoria primero y confirma con el guardado; si el guardado falla, revierte, de modo que lo mostrado siempre coincide con un estado consistente.
- Todos los mensajes de error son en lenguaje claro e indican la acción posible (reintentar, corregir el campo, etc.) (7.4).

## Testing Strategy

Enfoque dual con Vitest sobre la capa de lógica (pura y determinista) y el `Almacen` (con `localStorage` simulado):

- **Pruebas unitarias (ejemplos y casos límite):** estados vacío/carga/error, lista vacía → progreso 0, duración 0 → 0 minutos, errores de guardado y lectura, datos dañados, operación por teclado.
- **Pruebas de propiedades (property-based):** validación, cálculo de progreso, formato de tiempo, transiciones del temporizador, no-doble-conteo de la duración real y round trip del `Almacen`. Mínimo 100 iteraciones por propiedad. El temporizador se prueba con un reloj inyectado (eventos `tick`) para ser determinista.

Cada prueba de propiedad debe referenciar la propiedad del documento con la etiqueta: **Feature: tareas-app, Property {número}: {texto}**.

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe cumplirse en todas las ejecuciones válidas del sistema. Es una afirmación formal sobre lo que el sistema debe hacer, y sirve de puente entre la especificación legible por humanos y las garantías de corrección verificables de forma automática.*

### Property 1: La descripción válida se acepta y la inválida se rechaza

*Para toda* cadena de descripción, `validarTarea` la acepta si y solo si, tras recortar espacios, tiene de 1 a 200 caracteres; cualquier descripción vacía, de solo espacios o de más de 200 caracteres se rechaza conservando los datos ingresados.

**Validates: Requirements 2.2, 2.5, 2.6**

### Property 2: El tipo de tarea solo admite los valores permitidos

*Para todo* valor de tipo, `validarTarea` lo acepta únicamente si es uno de `Trabajo`, `Salud`, `Relaciones interpersonales` u `Hobbies`, o si no se asigna; cualquier otro valor se rechaza.

**Validates: Requirements 2.4**

### Property 3: Las horas estimadas solo son válidas como número en rango

*Para todo* valor de horas estimadas, `validarTarea` lo acepta únicamente si está ausente o es un número entre 0 y 1000; cualquier valor no numérico o fuera de rango se rechaza.

**Validates: Requirements 2.7**

### Property 4: La fecha límite solo es válida como fecha de calendario

*Para todo* valor de fecha límite, `validarTarea` lo acepta únicamente si está ausente o corresponde a una fecha de calendario válida; cualquier fecha inválida se rechaza.

**Validates: Requirements 2.8**

### Property 5: Registrar una tarea válida hace crecer la lista en uno

*Para toda* lista de tareas y toda tarea válida, agregarla produce una lista cuya longitud crece en exactamente uno y que contiene esa tarea.

**Validates: Requirements 2.9**

### Property 6: El tiempo restante se formatea correctamente como mm:ss

*Para todo* número de segundos restantes entre 0 y 900, `formatearMmSs` produce una cadena `mm:ss` con dos dígitos de minutos y dos de segundos que representa exactamente esos segundos.

**Validates: Requirements 3.2**

### Property 7: Iniciar sobre un temporizador en marcha es idempotente

*Para todo* estado del temporizador que ya está corriendo, aplicar el evento `iniciar` no modifica el estado ni reinicia el tiempo restante.

**Validates: Requirements 3.9**

### Property 8: Pausar sobre un temporizador ya pausado es idempotente

*Para todo* estado del temporizador que no está corriendo, aplicar el evento `pausar` no modifica el tiempo restante ni entrega tiempo adicional para la duración real.

**Validates: Requirements 3.8**

### Property 9: Cada tick en marcha reduce el tiempo restante en un segundo

*Para todo* estado del temporizador en marcha con tiempo restante mayor que cero, un evento `tick` reduce el tiempo restante en exactamente un segundo.

**Validates: Requirements 3.5**

### Property 10: Las transiciones de fase siguen el ciclo pomodoro

*Para toda* fase y todo conteo de fases de trabajo completadas, cuando una fase llega a cero la siguiente fase es la correcta del ciclo: tras la cuarta fase de trabajo consecutiva se pasa a descanso largo y el contador vuelve a cero; tras una fase de trabajo no final se pasa a descanso corto; tras cualquier descanso se pasa a trabajo.

**Validates: Requirements 3.3, 3.4, 3.7**

### Property 11: La duración real suma el tiempo de trabajo sin doble conteo

*Para toda* secuencia de eventos `iniciar`, `tick`, `pausar`, `finalizar` y `cerrar`, el total sumado a la `Duracion_Real` es exactamente igual al número de ticks ocurridos durante fases de trabajo mientras el temporizador estaba en marcha, sin contar ningún segundo dos veces ni omitir ninguno.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 12: La duración real se muestra en minutos enteros hacia abajo

*Para todo* valor de duración real en segundos, el valor mostrado en minutos es igual al piso de los segundos dividido entre 60, acotado al rango de 0 a 999999.

**Validates: Requirements 4.4, 4.5**

### Property 13: La duración real actualizada se persiste en el Almacén

*Para toda* tarea a la que se suma tiempo de trabajo, tras guardar y volver a leer desde el `Almacen`, la `Duracion_Real` recuperada es igual a la `Duracion_Real` en memoria.

**Validates: Requirements 4.6**

### Property 14: Completar una tarea la quita de la lista visible

*Para toda* lista de tareas y toda tarea de ella, marcarla como completada produce una `Lista_De_Tareas` visible que no contiene esa tarea.

**Validates: Requirements 5.2**

### Property 15: La barra de progreso es el porcentaje redondeado de completadas

*Para todo* conjunto de tareas, la barra de progreso es igual al redondeo al entero más cercano de (tareas completadas / total de tareas) × 100, dentro del rango de 0 a 100, y es 0 cuando no hay tareas.

**Validates: Requirements 5.3, 5.4**

### Property 16: El Almacén cumple round trip al guardar y leer tareas

*Para toda* lista de tareas válida, guardarla con `guardarTareas` y luego leerla con `leerTareas` produce una lista estructuralmente igual a la original.

**Validates: Requirements 6.1, 6.2**

### Property 17: Cada campo del formulario tiene una etiqueta asociada

*Para todo* campo del formulario de registro de tareas, el campo renderizado tiene una etiqueta de texto asociada de forma accesible.

**Validates: Requirements 7.1**
