// Capa de datos de tareas-app.
//
// El `Almacen` es la única puerta a `localStorage`. En lugar de lanzar
// excepciones hacia la interfaz, devuelve resultados tipificados
// (`ResultadoAlmacen`) para que la pantalla decida qué mensaje mostrar.
// Así la interfaz nunca tiene que envolver llamadas en try/catch.

import type { Tarea, TipoDeTarea } from '../tipos';

/**
 * Resultado explícito de una operación del Almacen.
 *
 * Permite a la interfaz distinguir el éxito (`ok: true` con un `valor`) del
 * error (`ok: false` con un `error` tipificado) sin usar excepciones.
 */
export type ResultadoAlmacen<T> =
  | { ok: true; valor: T }
  | { ok: false; error: ErrorAlmacen };

/**
 * Tipos de error que la interfaz traduce a mensajes claros para la persona.
 *
 * - `lectura`: no se pudo leer de `localStorage` (p. ej. `getItem` lanzó).
 * - `escritura`: no se pudo guardar en `localStorage` (p. ej. cuota llena).
 * - `formato`: los datos guardados están dañados o tienen una forma ilegible.
 */
export type ErrorAlmacen =
  | { tipo: 'lectura'; mensaje: string }
  | { tipo: 'escritura'; mensaje: string }
  | { tipo: 'formato'; mensaje: string };

/**
 * Contrato de la capa de datos. La interfaz solo conoce esta forma, de modo
 * que la fuente de almacenamiento pueda cambiarse en el futuro sin tocarla.
 */
export interface Almacen {
  /** Lee todas las tareas. Si no hay datos, devuelve lista vacía (no es error). */
  leerTareas(): ResultadoAlmacen<Tarea[]>;
  /** Guarda la lista completa de tareas. */
  guardarTareas(tareas: Tarea[]): ResultadoAlmacen<void>;
}

// Clave única de almacenamiento, privada del módulo. El sufijo de versión
// (`:v1`) deja margen para futuras migraciones del formato guardado.
const CLAVE_ALMACENAMIENTO = 'tareas-app:tareas:v1';

// Valores de tipo permitidos, usados para validar la forma de cada tarea leída.
const TIPOS_PERMITIDOS: readonly TipoDeTarea[] = [
  'Trabajo',
  'Salud',
  'Relaciones interpersonales',
  'Hobbies',
];

/**
 * Comprueba que un valor desconocido tenga la forma mínima de una `Tarea`.
 *
 * Valida los campos obligatorios (id, descripcion, duracionRealSegundos,
 * completada) y, si están presentes, la forma de los opcionales. Se usa al
 * leer para detectar datos dañados o con una estructura que no coincide.
 */
function esTareaValida(valor: unknown): valor is Tarea {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const posible = valor as Record<string, unknown>;

  // Campos obligatorios.
  if (typeof posible.id !== 'string') {
    return false;
  }
  if (typeof posible.descripcion !== 'string') {
    return false;
  }
  if (
    typeof posible.duracionRealSegundos !== 'number' ||
    !Number.isFinite(posible.duracionRealSegundos)
  ) {
    return false;
  }
  if (typeof posible.completada !== 'boolean') {
    return false;
  }

  // Campos opcionales: si están presentes, deben tener la forma correcta.
  if (
    posible.tipo !== undefined &&
    !TIPOS_PERMITIDOS.includes(posible.tipo as TipoDeTarea)
  ) {
    return false;
  }
  if (
    posible.horasEstimadas !== undefined &&
    (typeof posible.horasEstimadas !== 'number' ||
      !Number.isFinite(posible.horasEstimadas))
  ) {
    return false;
  }
  if (
    posible.fechaLimite !== undefined &&
    typeof posible.fechaLimite !== 'string'
  ) {
    return false;
  }

  return true;
}

/**
 * Implementación concreta del `Almacen` sobre el `localStorage` del navegador.
 *
 * Nunca lanza hacia la interfaz: toda ruta de fallo devuelve un
 * `ResultadoAlmacen` con un error tipificado.
 */
export function crearAlmacenLocalStorage(): Almacen {
  return {
    leerTareas(): ResultadoAlmacen<Tarea[]> {
      // 1. Leer la cadena cruda. Si `getItem` lanza, es un error de lectura.
      let crudo: string | null;
      try {
        crudo = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      } catch {
        return {
          ok: false,
          error: {
            tipo: 'lectura',
            mensaje: 'No se pudieron cargar las tareas guardadas.',
          },
        };
      }

      // 2. Sin datos guardados: lista vacía, no es un error.
      if (crudo === null) {
        return { ok: true, valor: [] };
      }

      // 3. Interpretar el JSON. Si es inválido, los datos están dañados.
      let interpretado: unknown;
      try {
        interpretado = JSON.parse(crudo);
      } catch {
        return {
          ok: false,
          error: {
            tipo: 'formato',
            mensaje: 'Los datos guardados no se pudieron interpretar.',
          },
        };
      }

      // 4. Validar la forma: debe ser un arreglo de tareas con la forma mínima.
      if (!Array.isArray(interpretado) || !interpretado.every(esTareaValida)) {
        return {
          ok: false,
          error: {
            tipo: 'formato',
            mensaje: 'Los datos guardados no se pudieron interpretar.',
          },
        };
      }

      return { ok: true, valor: interpretado };
    },

    guardarTareas(tareas: Tarea[]): ResultadoAlmacen<void> {
      // Serializar y escribir. Si `setItem` lanza (p. ej. por cuota llena),
      // es un error de escritura.
      try {
        const serializado = JSON.stringify(tareas);
        localStorage.setItem(CLAVE_ALMACENAMIENTO, serializado);
        return { ok: true, valor: undefined };
      } catch {
        return {
          ok: false,
          error: {
            tipo: 'escritura',
            mensaje: 'Los datos no se pudieron guardar.',
          },
        };
      }
    },
  };
}
