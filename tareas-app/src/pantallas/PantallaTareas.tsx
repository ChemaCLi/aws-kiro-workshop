// Pantalla principal de tareas-app.
//
// Orquesta el estado de la aplicación y los estados de carga, vacío y error.
// Al montar, pide las tareas al `Almacen`; mientras llegan muestra el estado
// de carga, y luego muestra la lista (o el estado vacío) o un mensaje de error
// con la acción de reintentar.
//
// Cubre los requisitos:
// - 1.2 (mostrar lista y herramientas al abrir)
// - 1.3 (estado vacío cuando no hay tareas)
// - 1.4 (estado de carga mientras se recuperan las tareas)
// - 1.5 (mostrar la lista al terminar la carga y ocultar el estado de carga)
// - 1.6, 6.5 (error de lectura: mensaje y acción de reintentar)
// - 6.2, 6.3 (leer las tareas del Almacen; lista vacía sin error si no hay datos)
//
// El registro, el completar y la acumulación de duración de tareas persisten en
// el Almacen (guardar y revertir ante error).

import { useEffect, useMemo, useState } from 'react'
import type { Tarea } from '../tipos'
import { crearAlmacenLocalStorage } from '../datos/almacen'
import { generarId } from '../logica/id'
import type { TareaValida } from '../logica/validacionTarea'
import BarraProgreso from '../componentes/BarraProgreso'
import EstadoCargando from '../componentes/EstadoCargando'
import EstadoVacio from '../componentes/EstadoVacio'
import MensajeError from '../componentes/MensajeError'
import FormularioTarea from '../componentes/FormularioTarea'
import TarjetaTarea from '../componentes/TarjetaTarea'
import TemporizadorPomodoro from '../componentes/TemporizadorPomodoro'

// Estado del proceso de carga inicial de las tareas desde el Almacen.
type EstadoCarga = 'cargando' | 'listo' | 'error'

function PantallaTareas() {
  // Almacen creado una sola vez por montaje (no se recrea en cada render).
  const almacen = useMemo(() => crearAlmacenLocalStorage(), [])

  // Estado del proceso de carga: 'cargando' al abrir, 'listo' con datos o 'error'.
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando')
  // Tareas en memoria: fuente de verdad de la interfaz (incluye completadas).
  const [tareas, setTareas] = useState<Tarea[]>([])
  // Texto del error visible (carga o guardado); null cuando no hay error.
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  // Id de la tarea cuyo temporizador está abierto, o null si no hay ninguno.
  const [tareaConTemporizadorAbierto, setTareaConTemporizadorAbierto] = useState<
    string | null
  >(null)

  // Carga las tareas desde el Almacen. Se usa al montar y al reintentar.
  // Pasa a 'cargando', lee y, según el resultado, a 'listo' o 'error'.
  function cargarTareas() {
    setEstadoCarga('cargando')
    setMensajeError(null)

    const resultado = almacen.leerTareas()
    if (resultado.ok) {
      setTareas(resultado.valor)
      setEstadoCarga('listo')
      return
    }

    // La lectura falló (lectura o formato): mostramos el mensaje del Almacen
    // y dejamos la pantalla en estado de error con acción de reintentar.
    setMensajeError(resultado.error.mensaje)
    setEstadoCarga('error')
  }

  // Al montar la pantalla, intentamos cargar las tareas una vez.
  useEffect(() => {
    cargarTareas()
    // El Almacen es estable (useMemo); solo queremos cargar al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Acciones (el registro, el completar y la acumulación de duración
  // persisten en el Almacen con el mismo patrón: guardar y revertir ante error) ---

  // Registra una tarea válida: la agrega a la lista y la guarda en el Almacen.
  // Primero calcula la lista resultante y la persiste; solo si el guardado
  // tiene éxito confirma la nueva lista en memoria. Si el guardado falla,
  // conserva la lista previa (revierte) y muestra el mensaje de error.
  function manejarRegistrar(tareaValida: TareaValida) {
    // Construimos la nueva tarea con un id único generado por la lógica.
    const nueva: Tarea = {
      id: generarId(),
      descripcion: tareaValida.descripcion,
      tipo: tareaValida.tipo,
      horasEstimadas: tareaValida.horasEstimadas,
      fechaLimite: tareaValida.fechaLimite,
      duracionRealSegundos: 0,
      completada: false,
    }

    // Lista que quedaría tras agregar la tarea (la lista previa no se muta).
    const nuevaLista = [...tareas, nueva]

    // Intentamos persistir antes de tocar el estado visible.
    const resultado = almacen.guardarTareas(nuevaLista)
    if (!resultado.ok) {
      // El guardado falló: no cambiamos la lista (conservamos la previa) y
      // mostramos el mensaje del Almacen para que la persona sepa qué pasó.
      setMensajeError(resultado.error.mensaje)
      return
    }

    // Guardado correcto: confirmamos la nueva lista y limpiamos el error.
    setTareas(nuevaLista)
    setMensajeError(null)
  }

  // Marca una tarea como completada: la saca de la lista visible, recalcula el
  // progreso (automático desde el estado) y guarda en el Almacen. Primero
  // calcula la lista resultante y la persiste; solo si el guardado tiene éxito
  // confirma la nueva lista en memoria. Si el guardado falla, conserva la lista
  // previa (la tarea sigue visible) y muestra el mensaje de error.
  function manejarCompletar(tareaId: string) {
    // Lista que quedaría con esa tarea marcada como completada (sin mutar la
    // lista previa). La barra de progreso y la lista visible se recalculan
    // solos desde el estado cuando confirmamos esta lista.
    const nuevaLista = tareas.map((tarea) =>
      tarea.id === tareaId ? { ...tarea, completada: true } : tarea,
    )

    // Intentamos persistir antes de tocar el estado visible.
    const resultado = almacen.guardarTareas(nuevaLista)
    if (!resultado.ok) {
      // El guardado falló: no cambiamos la lista (la tarea sigue visible) y
      // mostramos un mensaje claro para que la persona pueda intentarlo de nuevo.
      setMensajeError(
        'No se pudo completar la tarea. Revisa tu espacio de almacenamiento e inténtalo de nuevo.',
      )
      return
    }

    // Guardado correcto: confirmamos la nueva lista y limpiamos el error.
    setTareas(nuevaLista)
    setMensajeError(null)
  }

  // Abre el temporizador pomodoro de una tarea.
  function manejarAbrirTemporizador(tareaId: string) {
    setTareaConTemporizadorAbierto(tareaId)
  }

  // Cierra el temporizador abierto.
  function manejarCerrarTemporizador() {
    setTareaConTemporizadorAbierto(null)
  }

  // Suma segundos de trabajo a la Duracion_Real de la tarea con el temporizador
  // abierto y guarda el cambio en el Almacen. Igual que registrar y completar:
  // primero calcula la lista resultante y la persiste; solo si el guardado tiene
  // éxito confirma la nueva lista en memoria (y limpia el error). Si el guardado
  // falla, conserva la Duracion_Real previa sin modificar (no cambia la lista) y
  // muestra un mensaje claro de qué pasó y qué puede hacer la persona.
  function manejarAcumularSegundos(segundos: number) {
    // Sin temporizador abierto no hay tarea a la cual sumar: no hacemos nada.
    if (tareaConTemporizadorAbierto === null) {
      return
    }

    // Lista que quedaría con la Duracion_Real de esa tarea aumentada en los
    // segundos entregados por el temporizador (la lista previa no se muta).
    const nuevaLista = tareas.map((tarea) =>
      tarea.id === tareaConTemporizadorAbierto
        ? { ...tarea, duracionRealSegundos: tarea.duracionRealSegundos + segundos }
        : tarea,
    )

    // Intentamos persistir antes de tocar el estado visible.
    const resultado = almacen.guardarTareas(nuevaLista)
    if (!resultado.ok) {
      // El guardado falló: conservamos la Duracion_Real previa (no cambiamos la
      // lista) y mostramos un mensaje para que la persona pueda intentarlo de nuevo.
      setMensajeError(
        'No se pudo guardar el tiempo trabajado. Revisa tu espacio de almacenamiento e inténtalo de nuevo.',
      )
      return
    }

    // Guardado correcto: confirmamos la nueva lista y limpiamos el error.
    setTareas(nuevaLista)
    setMensajeError(null)
  }

  // Tareas visibles: solo las no completadas (la lista que ve la persona).
  const tareasVisibles = tareas.filter((tarea) => !tarea.completada)
  // Conteos para la barra de progreso: completadas respecto al total.
  const totalTareas = tareas.length
  const tareasCompletadas = tareas.filter((tarea) => tarea.completada).length
  // Tarea cuyo temporizador está abierto (si existe en la lista).
  const tareaDelTemporizador = tareas.find(
    (tarea) => tarea.id === tareaConTemporizadorAbierto,
  )

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Tareas</h1>
        <p className="text-slate-700">
          Organiza tus tareas y trabájalas con un temporizador pomodoro.
        </p>
      </header>

      {/* Estado de carga: mientras se recuperan las tareas del Almacen. */}
      {estadoCarga === 'cargando' ? <EstadoCargando /> : null}

      {/* Estado de error de carga: mensaje claro y acción de reintentar. */}
      {estadoCarga === 'error' ? (
        <MensajeError
          mensaje={mensajeError ?? 'No se pudieron cargar las tareas.'}
          etiquetaAccion="Reintentar"
          onAccion={cargarTareas}
        />
      ) : null}

      {/* Estado listo: formulario, progreso y lista (o estado vacío). */}
      {estadoCarga === 'listo' ? (
        <>
          <FormularioTarea onRegistrar={manejarRegistrar} />

          <BarraProgreso
            totalTareas={totalTareas}
            tareasCompletadas={tareasCompletadas}
          />

          {/* Temporizador de la tarea abierta, si hay una seleccionada. */}
          {tareaDelTemporizador ? (
            <TemporizadorPomodoro
              descripcionTarea={tareaDelTemporizador.descripcion}
              onAcumularSegundos={manejarAcumularSegundos}
              onCerrar={manejarCerrarTemporizador}
            />
          ) : null}

          {/* Lista de tareas visibles o estado vacío cuando no hay ninguna. */}
          {tareasVisibles.length === 0 ? (
            <EstadoVacio />
          ) : (
            <ul className="flex flex-col gap-3">
              {tareasVisibles.map((tarea) => (
                <li key={tarea.id}>
                  <TarjetaTarea
                    tarea={tarea}
                    onAbrirTemporizador={manejarAbrirTemporizador}
                    onCompletar={manejarCompletar}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </main>
  )
}

export default PantallaTareas
