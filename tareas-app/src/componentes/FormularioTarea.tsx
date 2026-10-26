// Formulario para registrar una tarea.
// Muestra campos etiquetados (descripción, tipo, horas estimadas y fecha límite),
// valida con `validarTarea` al enviar y, si hay errores, los muestra por campo
// conservando lo ingresado. Si todo es válido, entrega la tarea normalizada
// mediante `onRegistrar`.
//
// Cumple los requisitos:
// - 2.1 (solicitar descripción, tipo, horas estimadas y fecha límite)
// - 2.2, 2.5, 2.6 (descripción obligatoria de 1..200)
// - 2.7 (horas estimadas como número entre 0 y 1000)
// - 2.8 (fecha límite como fecha de calendario válida)
// - 7.1 (cada campo con su etiqueta asociada)
// - 7.2 (operable con teclado, foco visible)
// - 7.4 (al fallar, conserva lo ingresado y muestra qué ocurrió)

import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { TipoDeTarea } from '../tipos'
import {
  validarTarea,
  type DatosFormularioTarea,
  type ErroresFormulario,
  type TareaValida,
} from '../logica/validacionTarea'

// Opciones del selector de tipo: los cuatro valores permitidos.
// Se declaran aquí para que la interfaz y la validación usen el mismo conjunto.
const TIPOS: readonly TipoDeTarea[] = [
  'Trabajo',
  'Salud',
  'Relaciones interpersonales',
  'Hobbies',
]

// Estado inicial de los campos: todos vacíos (los opcionales como cadena vacía).
const DATOS_INICIALES: DatosFormularioTarea = {
  descripcion: '',
  tipo: '',
  horasEstimadas: '',
  fechaLimite: '',
}

interface PropiedadesFormularioTarea {
  // Se invoca con la tarea ya validada y normalizada cuando el registro es válido.
  onRegistrar: (tarea: TareaValida) => void
}

function FormularioTarea({ onRegistrar }: PropiedadesFormularioTarea) {
  // Valores de los campos tal como los ingresa la persona (se conservan al fallar).
  const [datos, setDatos] = useState<DatosFormularioTarea>(DATOS_INICIALES)
  // Errores por campo tras el último intento de registro.
  const [errores, setErrores] = useState<ErroresFormulario>({})

  // Actualiza un campo del formulario y limpia su error mientras la persona corrige.
  function manejarCambio(
    campo: keyof DatosFormularioTarea,
  ): (evento: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void {
    return (evento) => {
      const valor = evento.target.value
      setDatos((previos) => ({ ...previos, [campo]: valor }))
      setErrores((previos) => {
        if (previos[campo] === undefined) {
          return previos
        }
        const siguiente = { ...previos }
        delete siguiente[campo]
        return siguiente
      })
    }
  }

  // Valida al enviar; si falla, muestra errores por campo y conserva lo ingresado.
  // Si es válido, entrega la tarea hacia arriba y limpia el formulario.
  function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const resultado = validarTarea(datos)
    if (!resultado.valido) {
      setErrores(resultado.errores)
      return
    }
    setErrores({})
    setDatos(DATOS_INICIALES)
    onRegistrar(resultado.tarea)
  }

  // Clases compartidas de los campos, con foco visible para uso por teclado.
  const clasesCampo =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'

  return (
    <form onSubmit={manejarEnvio} noValidate className="flex flex-col gap-4">
      {/* Descripción: campo obligatorio de 1 a 200 caracteres. */}
      <div className="flex flex-col gap-1">
        <label htmlFor="campo-descripcion" className="text-sm font-medium text-slate-700">
          Descripción
        </label>
        <input
          id="campo-descripcion"
          name="descripcion"
          type="text"
          value={datos.descripcion}
          onChange={manejarCambio('descripcion')}
          aria-invalid={errores.descripcion !== undefined}
          aria-describedby={errores.descripcion !== undefined ? 'error-descripcion' : undefined}
          className={clasesCampo}
        />
        {errores.descripcion !== undefined ? (
          <p id="error-descripcion" className="text-sm font-medium text-red-700">
            {errores.descripcion}
          </p>
        ) : null}
      </div>

      {/* Tipo: opcional; incluye la opción "sin tipo" y los cuatro valores permitidos. */}
      <div className="flex flex-col gap-1">
        <label htmlFor="campo-tipo" className="text-sm font-medium text-slate-700">
          Tipo de tarea <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <select
          id="campo-tipo"
          name="tipo"
          value={datos.tipo}
          onChange={manejarCambio('tipo')}
          aria-invalid={errores.tipo !== undefined}
          aria-describedby={errores.tipo !== undefined ? 'error-tipo' : undefined}
          className={clasesCampo}
        >
          <option value="">Sin tipo</option>
          {TIPOS.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
        {errores.tipo !== undefined ? (
          <p id="error-tipo" className="text-sm font-medium text-red-700">
            {errores.tipo}
          </p>
        ) : null}
      </div>

      {/* Horas estimadas: opcional; si hay texto debe ser un número entre 0 y 1000. */}
      <div className="flex flex-col gap-1">
        <label htmlFor="campo-horas" className="text-sm font-medium text-slate-700">
          Horas estimadas <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <input
          id="campo-horas"
          name="horasEstimadas"
          type="number"
          inputMode="decimal"
          min={0}
          max={1000}
          step="any"
          value={datos.horasEstimadas}
          onChange={manejarCambio('horasEstimadas')}
          aria-invalid={errores.horasEstimadas !== undefined}
          aria-describedby={errores.horasEstimadas !== undefined ? 'error-horas' : undefined}
          className={clasesCampo}
        />
        {errores.horasEstimadas !== undefined ? (
          <p id="error-horas" className="text-sm font-medium text-red-700">
            {errores.horasEstimadas}
          </p>
        ) : null}
      </div>

      {/* Fecha límite: opcional; si hay texto debe ser una fecha de calendario válida. */}
      <div className="flex flex-col gap-1">
        <label htmlFor="campo-fecha" className="text-sm font-medium text-slate-700">
          Fecha límite <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <input
          id="campo-fecha"
          name="fechaLimite"
          type="date"
          value={datos.fechaLimite}
          onChange={manejarCambio('fechaLimite')}
          aria-invalid={errores.fechaLimite !== undefined}
          aria-describedby={errores.fechaLimite !== undefined ? 'error-fecha' : undefined}
          className={clasesCampo}
        />
        {errores.fechaLimite !== undefined ? (
          <p id="error-fecha" className="text-sm font-medium text-red-700">
            {errores.fechaLimite}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        className="self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Registrar tarea
      </button>
    </form>
  )
}

export default FormularioTarea
