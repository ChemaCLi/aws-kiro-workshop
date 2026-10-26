// Temporizador_Pomodoro asociado a una tarea.
//
// Este componente es la "cáscara" de interfaz alrededor de la máquina de estados
// pura de `src/logica/temporizador.ts`. La lógica (qué pasa al iniciar, pausar,
// con cada tick y al cambiar de fase) vive en `transicion`; aquí solo nos
// encargamos de:
//   1. Guardar el estado del temporizador y actualizarlo con cada evento.
//   2. Mantener un `setInterval` de 1 segundo que despacha el evento `tick`
//      mientras el temporizador está corriendo, y limpiarlo al pausar o al
//      desmontar el componente.
//   3. Entregar hacia arriba los segundos de trabajo (`segundosParaDuracionReal`)
//      para que la pantalla los sume a la Duracion_Real de la tarea.
//   4. Mostrar el tiempo restante en formato mm:ss, la fase actual, los botones
//      iniciar/pausar y el aviso visible de fin de fase.
//
// Cubre los requisitos 3.2 (mostrar mm:ss), 3.5 (bajar 1 s por tick), 3.6
// (pausar conserva el tiempo), 3.7 (aviso de fin de fase y avance automático) y
// 7.2 (operable con teclado, foco visible).

import { useEffect, useReducer, useRef, useState } from 'react'
import {
  estadoInicial,
  transicion,
  type EstadoTemporizador,
  type EventoTemporizador,
  type FasePomodoro,
} from '../logica/temporizador'
import { formatearMmSs } from '../logica/tiempo'

interface PropiedadesTemporizadorPomodoro {
  // Descripción de la tarea a la que pertenece el temporizador (para el título).
  descripcionTarea: string
  // Se llama con los segundos de trabajo que deben sumarse a la Duracion_Real
  // de la tarea. Solo se invoca cuando hay segundos por contabilizar (> 0).
  onAcumularSegundos: (segundos: number) => void
  // Se llama cuando la persona cierra la vista del temporizador. Antes de cerrar,
  // se entregan los segundos de trabajo pendientes vía `onAcumularSegundos`.
  onCerrar: () => void
}

// Nombres legibles de cada fase para mostrarlos a la persona.
const NOMBRE_FASE: Record<FasePomodoro, string> = {
  'trabajo': 'Trabajo',
  'descanso-corto': 'Descanso corto',
  'descanso-largo': 'Descanso largo',
}

// Reductor que aplica la transición pura y guarda, como efecto secundario del
// render, los segundos a contabilizar y si hay aviso de fin de fase. Para no
// mezclar responsabilidades, el reductor solo calcula el nuevo estado; los
// valores "hacia arriba" (segundos y aviso) se exponen aparte en el estado del
// componente mediante un pequeño envoltorio.
interface EstadoInterno {
  // Estado actual de la máquina de estados del temporizador.
  temporizador: EstadoTemporizador
  // `true` cuando la última transición marcó fin de fase (para el aviso visible).
  avisoFinDeFase: boolean
}

type AccionInterna =
  | { tipo: 'evento'; evento: EventoTemporizador; onAcumular: (segundos: number) => void }
  | { tipo: 'ocultarAviso' }

function estadoInternoInicial(): EstadoInterno {
  return { temporizador: estadoInicial(), avisoFinDeFase: false }
}

// Aplica un evento a la máquina de estados y, si la transición entrega segundos
// de trabajo, los reporta hacia arriba mediante el callback recibido.
function reductor(estado: EstadoInterno, accion: AccionInterna): EstadoInterno {
  switch (accion.tipo) {
    case 'evento': {
      const resultado = transicion(estado.temporizador, accion.evento)
      // Entregar hacia arriba los segundos de trabajo pendientes, si los hay.
      if (resultado.segundosParaDuracionReal > 0) {
        accion.onAcumular(resultado.segundosParaDuracionReal)
      }
      return {
        temporizador: resultado.estado,
        // Si esta transición no genera aviso, mantenemos el aviso previo visible
        // solo cuando acaba de ocurrir; aquí lo reemplazamos por el nuevo valor.
        avisoFinDeFase: resultado.avisoFinDeFase,
      }
    }
    case 'ocultarAviso': {
      return { ...estado, avisoFinDeFase: false }
    }
  }
}

function TemporizadorPomodoro({
  descripcionTarea,
  onAcumularSegundos,
  onCerrar,
}: PropiedadesTemporizadorPomodoro) {
  const [estado, despachar] = useReducer(reductor, undefined, estadoInternoInicial)
  // Nombre de la fase anterior, para anunciar los cambios de fase con aria-live.
  const [faseAnunciada, setFaseAnunciada] = useState<FasePomodoro>(estado.temporizador.fase)

  // Guardamos el callback en una ref para que el efecto del intervalo no dependa
  // de su identidad (evita reiniciar el intervalo si el padre cambia la función).
  const refAcumular = useRef(onAcumularSegundos)
  useEffect(() => {
    refAcumular.current = onAcumularSegundos
  }, [onAcumularSegundos])

  const { temporizador, avisoFinDeFase } = estado
  const corriendo = temporizador.corriendo

  // Intervalo de 1 segundo: mientras el temporizador corre, despacha un `tick`
  // cada segundo. Se limpia al pausar, al cambiar de fase (corriendo pasa a
  // false) y al desmontar el componente, evitando ticks huérfanos.
  useEffect(() => {
    if (!corriendo) {
      return
    }
    const id = window.setInterval(() => {
      despachar({ tipo: 'evento', evento: { tipo: 'tick' }, onAcumular: refAcumular.current })
    }, 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [corriendo])

  // Cuando cambia la fase, actualizamos el texto que anuncia el lector de pantalla.
  useEffect(() => {
    if (temporizador.fase !== faseAnunciada) {
      setFaseAnunciada(temporizador.fase)
    }
  }, [temporizador.fase, faseAnunciada])

  // Despacha un evento de la máquina de estados reportando los segundos hacia arriba.
  function enviarEvento(evento: EventoTemporizador) {
    despachar({ tipo: 'evento', evento, onAcumular: refAcumular.current })
  }

  function alIniciar() {
    // Al reiniciar la cuenta ocultamos cualquier aviso de fin de fase previo.
    despachar({ tipo: 'ocultarAviso' })
    enviarEvento({ tipo: 'iniciar' })
  }

  function alPausar() {
    enviarEvento({ tipo: 'pausar' })
  }

  function alCerrar() {
    // 'cerrar' entrega el trabajo pendiente (si estamos en fase de trabajo)
    // antes de volver al estado inicial; luego avisamos al padre para cerrar la vista.
    enviarEvento({ tipo: 'cerrar' })
    onCerrar()
  }

  const nombreFase = NOMBRE_FASE[temporizador.fase]
  const tiempoRestante = formatearMmSs(temporizador.segundosRestantes)

  return (
    <section
      aria-label={`Temporizador pomodoro de la tarea: ${descripcionTarea}`}
      className="flex flex-col gap-4 rounded-lg border border-slate-300 bg-white px-4 py-4 shadow-sm"
    >
      {/* Fase actual. Se anuncia a lectores de pantalla cuando cambia. */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700" aria-live="polite">
          Fase actual: <span className="font-semibold text-slate-900">{nombreFase}</span>
        </p>
        {/* Botón para cerrar la vista del temporizador. */}
        <button
          type="button"
          onClick={alCerrar}
          className="rounded-md px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Cerrar
        </button>
      </div>

      {/* Tiempo restante en formato mm:ss. */}
      <p
        className="text-center text-5xl font-bold tabular-nums tracking-tight text-slate-900"
        aria-live="off"
      >
        <span className="sr-only">Tiempo restante: </span>
        {tiempoRestante}
      </p>

      {/* Aviso visible de fin de fase. Se anuncia con rol de estado (aria-live). */}
      {avisoFinDeFase ? (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-900"
        >
          Fin de la fase. Comienza la fase de {nombreFase.toLowerCase()}.
        </p>
      ) : null}

      {/* Controles iniciar/pausar. Son botones nativos: ya son operables con
          teclado (Tab para enfocar, Enter o Barra Espaciadora para activar) y
          muestran un anillo de foco visible. */}
      <div className="flex gap-3">
        {corriendo ? (
          <button
            type="button"
            onClick={alPausar}
            className="flex-1 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Pausar
          </button>
        ) : (
          <button
            type="button"
            onClick={alIniciar}
            className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Iniciar
          </button>
        )}
      </div>
    </section>
  )
}

export default TemporizadorPomodoro
