// Barra_De_Progreso: muestra el avance de tareas completadas respecto al total.
// Calcula el porcentaje con `calcularProgreso` (función pura) y lo presenta con
// role="progressbar" y sus atributos aria para que sea accesible (5.3, 5.4).

import { calcularProgreso } from '../logica/progreso'

interface PropiedadesBarraProgreso {
  // Número total de tareas registradas (completadas + pendientes).
  totalTareas: number
  // Número de tareas marcadas como completadas.
  tareasCompletadas: number
}

function BarraProgreso({ totalTareas, tareasCompletadas }: PropiedadesBarraProgreso) {
  // Porcentaje entero 0..100; si no hay tareas, `calcularProgreso` devuelve 0.
  const porcentaje = calcularProgreso(totalTareas, tareasCompletadas)

  return (
    <div className="flex flex-col gap-2">
      {/* Etiqueta visible que acompaña a la barra. */}
      <div className="flex items-center justify-between text-sm font-medium text-slate-700">
        <span id="etiqueta-barra-progreso">Progreso</span>
        <span>{porcentaje}%</span>
      </div>

      {/* Pista de la barra. El relleno refleja el porcentaje de avance. */}
      <div
        role="progressbar"
        aria-labelledby="etiqueta-barra-progreso"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${porcentaje}% completado`}
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
      >
        {/* Relleno con contraste suficiente sobre la pista clara. */}
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  )
}

export default BarraProgreso
