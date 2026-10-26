// Estado de carga: se muestra mientras la aplicación recupera las tareas del Almacen.
// Usa role="status" y aria-live para que los lectores de pantalla anuncien la carga.

interface PropiedadesEstadoCargando {
  // Mensaje opcional; por defecto indica que se están cargando las tareas.
  mensaje?: string
}

function EstadoCargando({ mensaje = 'Cargando tus tareas…' }: PropiedadesEstadoCargando) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 py-10 text-center"
    >
      {/* Indicador giratorio puramente decorativo. */}
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700"
      />
      <p className="text-slate-700">{mensaje}</p>
    </div>
  )
}

export default EstadoCargando
