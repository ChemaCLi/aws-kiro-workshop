// Funciones puras para dar formato al tiempo del temporizador y a la
// duración real acumulada. No dependen de React ni de localStorage, por lo
// que son fáciles de probar de forma aislada.

// Minutos máximo que se pueden mostrar como duración real (acotado por diseño).
const MINUTOS_MAXIMOS = 999999

/**
 * Formatea una cantidad de segundos restantes como "mm:ss".
 *
 * Por ejemplo: 90 -> "01:30", 0 -> "00:00", 905 -> "15:05".
 * Se asegura de que tanto los minutos como los segundos siempre tengan dos
 * dígitos. Los valores negativos se tratan como 0 y los segundos con decimales
 * se redondean hacia abajo para contar segundos completos.
 */
export function formatearMmSs(segundos: number): string {
  // Evita valores negativos o decimales: trabajamos con segundos enteros >= 0.
  const totalSegundos = Math.max(0, Math.floor(segundos))

  const minutos = Math.floor(totalSegundos / 60)
  const segundosRestantes = totalSegundos % 60

  // padStart(2, '0') garantiza dos dígitos (p. ej. "05" en vez de "5").
  const mm = String(minutos).padStart(2, '0')
  const ss = String(segundosRestantes).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Convierte segundos acumulados a minutos enteros hacia abajo.
 *
 * Redondea hacia abajo (piso) porque solo mostramos minutos completos de
 * trabajo, y acota el resultado al rango 0..999999 para evitar valores
 * negativos o desproporcionados en la interfaz.
 */
export function segundosAMinutos(segundos: number): number {
  const minutos = Math.floor(segundos / 60)

  // Acota al rango permitido: nunca por debajo de 0 ni por encima del máximo.
  if (minutos < 0) {
    return 0
  }
  if (minutos > MINUTOS_MAXIMOS) {
    return MINUTOS_MAXIMOS
  }
  return minutos
}
