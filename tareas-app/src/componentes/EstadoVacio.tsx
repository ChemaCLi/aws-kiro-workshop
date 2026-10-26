// Estado vacío: se muestra cuando la lista no contiene tareas registradas.

interface PropiedadesEstadoVacio {
  // Mensaje opcional; por defecto invita a registrar la primera tarea.
  mensaje?: string
}

function EstadoVacio({
  mensaje = 'No hay tareas registradas todavía. Agrega tu primera tarea para empezar.',
}: PropiedadesEstadoVacio) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <h2 className="text-lg font-semibold text-slate-900">Sin tareas por ahora</h2>
      <p className="max-w-xs text-slate-700">{mensaje}</p>
    </div>
  )
}

export default EstadoVacio
