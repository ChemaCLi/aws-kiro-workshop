// Componente para mostrar un mensaje de error claro a la persona.
// Indica qué ocurrió y, cuando aplica, ofrece una acción para resolverlo (p. ej. reintentar).
// Cumple los requisitos 1.6 (ofrecer acción de reintentar al fallar la carga) y
// 7.4 (mensaje que indica qué pasó y qué puede hacer la persona).

interface MensajeErrorProps {
  // Texto del error, en lenguaje claro: qué ocurrió y qué puede hacer la persona.
  mensaje: string
  // Texto del botón de acción. Si se omite, se usa "Reintentar".
  etiquetaAccion?: string
  // Callback de la acción (p. ej. reintentar). Si se omite, no se muestra el botón.
  onAccion?: () => void
}

// Muestra el mensaje de error con rol de alerta para que las tecnologías de asistencia
// lo anuncien de inmediato. El botón de acción solo aparece cuando se proporciona un callback.
function MensajeError({ mensaje, etiquetaAccion = 'Reintentar', onAccion }: MensajeErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900"
    >
      <p className="text-sm font-medium">{mensaje}</p>

      {onAccion ? (
        <button
          type="button"
          onClick={onAccion}
          className="self-start rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {etiquetaAccion}
        </button>
      ) : null}
    </div>
  )
}

export default MensajeError
