// Tipos compartidos de tareas-app.
// Definen la forma de una tarea y las categorías permitidas, de modo que la
// interfaz, la lógica y la capa de datos trabajen con el mismo modelo.

/**
 * Categoría de una tarea (Tipo_De_Tarea).
 *
 * Solo se admiten estos cuatro valores. El tipo es opcional en una tarea:
 * la persona puede registrar una tarea sin asignarle categoría.
 */
export type TipoDeTarea =
  | 'Trabajo'
  | 'Salud'
  | 'Relaciones interpersonales'
  | 'Hobbies';

/**
 * Una tarea registrada por la persona.
 *
 * Campos obligatorios: `id`, `descripcion`, `duracionRealSegundos` y `completada`.
 * Campos opcionales: `tipo`, `horasEstimadas` y `fechaLimite`.
 */
export interface Tarea {
  /** Identificador único de la tarea (p. ej. `crypto.randomUUID`). Obligatorio. */
  id: string;

  /** Descripción de la tarea. Obligatoria, de 1 a 200 caracteres (tras recortar espacios). */
  descripcion: string;

  /** Categoría de la tarea. Opcional; si se asigna, uno de los valores de `TipoDeTarea`. */
  tipo?: TipoDeTarea;

  /** Horas estimadas de trabajo. Opcional; si se indica, un número entre 0 y 1000. */
  horasEstimadas?: number;

  /** Fecha límite en formato ISO 'YYYY-MM-DD'. Opcional; si se indica, una fecha de calendario válida. */
  fechaLimite?: string;

  /**
   * Duración real acumulada, en segundos. Obligatoria.
   *
   * Se guarda en segundos para no perder precisión al acumular; empieza en 0 y
   * su rango válido es 0..(999999 * 60). La interfaz la muestra en minutos
   * enteros hacia abajo (0..999999 minutos).
   */
  duracionRealSegundos: number;

  /** `true` cuando la tarea se completó y sale de la lista visible. Obligatorio. */
  completada: boolean;
}
