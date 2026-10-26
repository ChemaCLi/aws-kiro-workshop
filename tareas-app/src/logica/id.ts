// Genera un identificador único para cada tarea.
// Usa crypto.randomUUID cuando está disponible en el navegador; si no,
// recurre a un respaldo simple basado en tiempo y azar para no fallar.

/**
 * Devuelve un id único como texto.
 *
 * Prioriza `crypto.randomUUID()`, que produce un UUID estándar en los
 * navegadores modernos. Si esa función no existe (navegadores antiguos o
 * contextos sin `crypto`), construye un id con la hora actual y un valor
 * aleatorio. El respaldo no es un UUID formal, pero basta para distinguir
 * tareas dentro de esta aplicación personal.
 */
export function generarId(): string {
  // Caso principal: la API nativa está disponible.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Respaldo simple: combina la marca de tiempo con dos tramos aleatorios.
  const tiempo = Date.now().toString(36)
  const azar = Math.random().toString(36).slice(2, 10)
  const azarExtra = Math.random().toString(36).slice(2, 6)
  return `id-${tiempo}-${azar}${azarExtra}`
}
