// Máquina de estados pura del temporizador estilo pomodoro.
//
// El temporizador se modela como una función de transición pura sobre un
// estado inmutable. La interfaz es quien dispara los "ticks" con un intervalo
// de 1 segundo usando el reloj del navegador; aquí no se usa `setInterval`, lo
// que hace la lógica determinista y fácil de probar.
//
// Idea clave para no doble-contar la duración real: el tiempo de trabajo se
// acumula tick a tick en `trabajoNoContabilizado` y se entrega (se vacía)
// exactamente una vez al pausar, finalizar, cerrar o cambiar de fase. Así cada
// segundo de trabajo se suma una sola vez y no se pierde ninguno.

/** Fase actual del ciclo pomodoro. */
export type FasePomodoro = 'trabajo' | 'descanso-corto' | 'descanso-largo'

/**
 * Duración en segundos de cada fase.
 *
 * - trabajo: 15 minutos (900 s)
 * - descanso-corto: 5 minutos (300 s)
 * - descanso-largo: 10 minutos (600 s)
 */
export const DURACIONES: Record<FasePomodoro, number> = {
  'trabajo': 900,
  'descanso-corto': 300,
  'descanso-largo': 600,
}

// Cantidad de fases de trabajo tras las cuales toca un descanso largo.
const FASES_TRABAJO_PARA_DESCANSO_LARGO = 4

export interface EstadoTemporizador {
  /** Fase en curso. */
  fase: FasePomodoro
  /** Segundos restantes de la fase en curso. */
  segundosRestantes: number
  /** `true` mientras el tiempo disminuye con cada tick. */
  corriendo: boolean
  /** Fases de trabajo completadas (0..3); a la 4.ª toca descanso largo. */
  fasesTrabajoCompletadas: number
  /**
   * Segundos de trabajo acumulados desde el último inicio/reanudación que
   * todavía no se han sumado a la Duracion_Real. Evita el doble conteo.
   */
  trabajoNoContabilizado: number
}

export type EventoTemporizador =
  | { tipo: 'iniciar' }
  | { tipo: 'pausar' }
  | { tipo: 'tick' } // pasa 1 segundo de reloj
  | { tipo: 'finalizar' } // termina el temporizador de la tarea
  | { tipo: 'cerrar' } // cierra la vista del temporizador

export interface ResultadoTransicion {
  /** Estado resultante tras aplicar el evento. */
  estado: EstadoTemporizador
  /**
   * Segundos de trabajo que la interfaz debe sumar a la Duracion_Real de la
   * tarea a raíz de este evento. Es 0 cuando no corresponde sumar. Nunca
   * produce doble conteo.
   */
  segundosParaDuracionReal: number
  /** `true` para que la interfaz muestre el aviso visible de fin de fase. */
  avisoFinDeFase: boolean
}

/**
 * Estado inicial del temporizador: fase de trabajo completa, pausado y sin
 * fases completadas ni trabajo pendiente de contabilizar.
 */
export function estadoInicial(): EstadoTemporizador {
  return {
    fase: 'trabajo',
    segundosRestantes: DURACIONES['trabajo'],
    corriendo: false,
    fasesTrabajoCompletadas: 0,
    trabajoNoContabilizado: 0,
  }
}

/**
 * Calcula la siguiente fase y el nuevo contador de fases de trabajo cuando la
 * fase en curso llega a su fin, según el ciclo pomodoro:
 *
 * - Tras la cuarta fase de trabajo consecutiva → descanso largo y el contador
 *   vuelve a 0.
 * - Tras una fase de trabajo no final → descanso corto e incrementa el contador.
 * - Tras cualquier descanso (corto o largo) → trabajo (el contador no cambia).
 */
function siguienteFase(estado: EstadoTemporizador): {
  fase: FasePomodoro
  fasesTrabajoCompletadas: number
} {
  if (estado.fase === 'trabajo') {
    const completadas = estado.fasesTrabajoCompletadas + 1
    if (completadas >= FASES_TRABAJO_PARA_DESCANSO_LARGO) {
      // Cuarta fase de trabajo: toca descanso largo y se reinicia el contador.
      return { fase: 'descanso-largo', fasesTrabajoCompletadas: 0 }
    }
    // Fase de trabajo no final: descanso corto y avanza el contador.
    return { fase: 'descanso-corto', fasesTrabajoCompletadas: completadas }
  }

  // Tras cualquier descanso se vuelve a trabajar; el contador se mantiene.
  return { fase: 'trabajo', fasesTrabajoCompletadas: estado.fasesTrabajoCompletadas }
}

/**
 * Transición pura del temporizador: dado un estado y un evento, devuelve el
 * siguiente estado, cuántos segundos sumar a la Duracion_Real y si hay aviso
 * de fin de fase. No muta el estado recibido.
 */
export function transicion(
  estado: EstadoTemporizador,
  evento: EventoTemporizador,
): ResultadoTransicion {
  switch (evento.tipo) {
    case 'iniciar': {
      // Si ya corría, es idempotente: no cambia nada.
      if (estado.corriendo) {
        return { estado, segundosParaDuracionReal: 0, avisoFinDeFase: false }
      }
      // Si estaba pausado, arranca la cuenta.
      return {
        estado: { ...estado, corriendo: true },
        segundosParaDuracionReal: 0,
        avisoFinDeFase: false,
      }
    }

    case 'pausar': {
      // Si ya estaba pausado, es idempotente y no suma tiempo.
      if (!estado.corriendo) {
        return { estado, segundosParaDuracionReal: 0, avisoFinDeFase: false }
      }
      // Al pausar en fase de trabajo, se entrega el trabajo pendiente y se
      // vacía; en un descanso no hay nada que contabilizar.
      const enTrabajo = estado.fase === 'trabajo'
      const segundosParaDuracionReal = enTrabajo ? estado.trabajoNoContabilizado : 0
      return {
        estado: {
          ...estado,
          corriendo: false,
          trabajoNoContabilizado: enTrabajo ? 0 : estado.trabajoNoContabilizado,
        },
        segundosParaDuracionReal,
        avisoFinDeFase: false,
      }
    }

    case 'tick': {
      // El tick solo tiene efecto si el temporizador está corriendo.
      if (!estado.corriendo) {
        return { estado, segundosParaDuracionReal: 0, avisoFinDeFase: false }
      }

      const enTrabajo = estado.fase === 'trabajo'
      // En fase de trabajo, cada tick suma un segundo al trabajo pendiente.
      const trabajoAcumulado = enTrabajo
        ? estado.trabajoNoContabilizado + 1
        : estado.trabajoNoContabilizado
      const segundosRestantes = estado.segundosRestantes - 1

      // Fin de fase: el contador de la fase llegó a 0.
      if (segundosRestantes <= 0) {
        const { fase, fasesTrabajoCompletadas } = siguienteFase(estado)
        // Al cerrar una fase de trabajo, se entrega todo el trabajo pendiente
        // (incluido el segundo de este tick) y se reinicia.
        const segundosParaDuracionReal = enTrabajo ? trabajoAcumulado : 0
        return {
          estado: {
            fase,
            segundosRestantes: DURACIONES[fase],
            corriendo: false,
            fasesTrabajoCompletadas,
            trabajoNoContabilizado: 0,
          },
          segundosParaDuracionReal,
          avisoFinDeFase: true,
        }
      }

      // Tick normal: baja el tiempo y acumula el trabajo sin entregarlo aún.
      return {
        estado: {
          ...estado,
          segundosRestantes,
          trabajoNoContabilizado: trabajoAcumulado,
        },
        segundosParaDuracionReal: 0,
        avisoFinDeFase: false,
      }
    }

    case 'finalizar':
    case 'cerrar': {
      // Al finalizar o cerrar en fase de trabajo, se entrega el trabajo
      // pendiente antes de volver al estado inicial. En descanso no hay nada
      // que contabilizar.
      const segundosParaDuracionReal =
        estado.fase === 'trabajo' ? estado.trabajoNoContabilizado : 0
      return {
        estado: estadoInicial(),
        segundosParaDuracionReal,
        avisoFinDeFase: false,
      }
    }
  }
}
