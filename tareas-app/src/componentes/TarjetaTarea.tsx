// Tarjeta de una tarea: muestra sus datos y ofrece acciones (abrir el
// temporizador pomodoro y marcarla como completada).
//
// Presenta la descripción, el tipo, las horas estimadas, la fecha límite y la
// Duracion_Real (en minutos enteros hacia abajo con `segundosAMinutos`).
// Las acciones usan elementos <button> nativos para que sean operables con
// ratón y con teclado (Enter / Barra Espaciadora) y tengan foco visible.
// Cubre los requisitos 3.1 (abrir el temporizador), 4.4 y 4.5 (mostrar la
// duración real en minutos), 5.1 (marcar completada) y 7.2 (controles
// operables con teclado y foco visible).

import type { Tarea } from '../tipos'
import { segundosAMinutos } from '../logica/tiempo'

interface PropiedadesTarjetaTarea {
  // Tarea a mostrar. Trae todos sus datos (descripción, tipo, etc.).
  tarea: Tarea
  // Se llama con el id de la tarea al pedir abrir el temporizador pomodoro.
  onAbrirTemporizador: (tareaId: string) => void
  // Se llama con el id de la tarea al marcarla como completada.
  onCompletar: (tareaId: string) => void
}

// Clases compartidas por los botones para asegurar un foco visible y accesible.
const CLASES_FOCO_VISIBLE =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'

/**
 * Da formato a la duración real en minutos, siempre con texto claro.
 * Devuelve "0 minutos" cuando aún no hay tiempo acumulado y respeta el
 * singular ("1 minuto") para que la frase se lea bien.
 */
function textoDuracionReal(segundos: number): string {
  const minutos = segundosAMinutos(segundos)
  const unidad = minutos === 1 ? 'minuto' : 'minutos'
  return `${minutos} ${unidad}`
}

function TarjetaTarea({ tarea, onAbrirTemporizador, onCompletar }: PropiedadesTarjetaTarea) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* Descripción: dato principal y siempre presente. */}
      <h3 className="text-base font-semibold text-slate-900">{tarea.descripcion}</h3>

      {/* Detalles opcionales y la duración real. Cada campo opcional solo
          aparece cuando tiene valor, para no mostrar datos vacíos. */}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
        {tarea.tipo ? (
          <div className="flex gap-1">
            <dt className="font-medium text-slate-600">Tipo:</dt>
            <dd>{tarea.tipo}</dd>
          </div>
        ) : null}

        {tarea.horasEstimadas !== undefined ? (
          <div className="flex gap-1">
            <dt className="font-medium text-slate-600">Horas estimadas:</dt>
            <dd>{tarea.horasEstimadas}</dd>
          </div>
        ) : null}

        {tarea.fechaLimite ? (
          <div className="flex gap-1">
            <dt className="font-medium text-slate-600">Fecha límite:</dt>
            <dd>{tarea.fechaLimite}</dd>
          </div>
        ) : null}

        {/* La duración real siempre se muestra (0 minutos cuando no hay tiempo). */}
        <div className="flex gap-1">
          <dt className="font-medium text-slate-600">Duración real:</dt>
          <dd>{textoDuracionReal(tarea.duracionRealSegundos)}</dd>
        </div>
      </dl>

      {/* Acciones: botones nativos operables con ratón y teclado. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onAbrirTemporizador(tarea.id)}
          className={`rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 ${CLASES_FOCO_VISIBLE}`}
        >
          Abrir temporizador
        </button>

        <button
          type="button"
          onClick={() => onCompletar(tarea.id)}
          className={`rounded-md border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 ${CLASES_FOCO_VISIBLE}`}
        >
          Completado
        </button>
      </div>
    </article>
  )
}

export default TarjetaTarea
