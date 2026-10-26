// Cálculo del avance de la Barra_De_Progreso.
// Función pura, sin interfaz ni acceso a datos, fácil de probar.

/**
 * Calcula el porcentaje de tareas completadas respecto al total.
 *
 * Devuelve un entero en el rango 0..100, redondeado al entero más cercano.
 * Si el total es 0 (no hay tareas), devuelve 0 para evitar la división por
 * cero. El resultado también se acota al rango 0..100 por seguridad, por si
 * llegaran valores inconsistentes (por ejemplo, más completadas que el total).
 *
 * @param totalTareas Número total de tareas registradas.
 * @param tareasCompletadas Número de tareas marcadas como completadas.
 * @returns Porcentaje de avance entre 0 y 100, redondeado al entero.
 */
export function calcularProgreso(
  totalTareas: number,
  tareasCompletadas: number,
): number {
  // Sin tareas: no hay avance que mostrar y evitamos dividir entre cero.
  if (totalTareas <= 0) {
    return 0
  }

  const porcentaje = Math.round((tareasCompletadas / totalTareas) * 100)

  // Acotamos al rango válido 0..100 por si los datos vienen inconsistentes.
  return Math.min(100, Math.max(0, porcentaje))
}
