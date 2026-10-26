// Validación de los datos del formulario de registro de tareas.
// Es lógica pura, sin interfaz: recibe los textos que ingresó la persona y
// devuelve, o bien una tarea normalizada, o bien errores por campo para que la
// interfaz los muestre conservando lo ya ingresado.

import type { TipoDeTarea } from '../tipos'

/** Categorías permitidas para una tarea. Se usan para validar el tipo. */
const TIPOS_PERMITIDOS: readonly TipoDeTarea[] = [
  'Trabajo',
  'Salud',
  'Relaciones interpersonales',
  'Hobbies',
]

/** Límites de la descripción, en caracteres tras recortar espacios. */
const DESCRIPCION_MIN = 1
const DESCRIPCION_MAX = 200

/** Rango permitido para las horas estimadas. */
const HORAS_MIN = 0
const HORAS_MAX = 1000

/**
 * Datos tal como llegan del formulario (todos como texto o vacíos).
 *
 * Reflejan el estado de los campos del formulario antes de validar: los
 * campos opcionales pueden venir como cadena vacía cuando la persona no los
 * completó.
 */
export interface DatosFormularioTarea {
  descripcion: string
  tipo?: TipoDeTarea | '' // '' = sin asignar
  horasEstimadas?: string // texto del input; se valida y convierte
  fechaLimite?: string // 'YYYY-MM-DD' del input date; '' = sin fecha
}

/**
 * Tarea ya validada y normalizada, lista para registrarse.
 *
 * Los campos opcionales se omiten cuando la persona no los completó.
 */
export interface TareaValida {
  descripcion: string
  tipo?: TipoDeTarea
  horasEstimadas?: number
  fechaLimite?: string // ISO 'YYYY-MM-DD'
}

/**
 * Errores por campo. Solo aparecen los campos con problema, con un mensaje
 * claro para mostrar junto al campo correspondiente.
 */
export type ErroresFormulario = Partial<
  Record<'descripcion' | 'tipo' | 'horasEstimadas' | 'fechaLimite', string>
>

/** Resultado de validar: éxito con la tarea, o fallo con errores por campo. */
export type ResultadoValidacion =
  | { valido: true; tarea: TareaValida }
  | { valido: false; errores: ErroresFormulario }

/**
 * Valida y normaliza los datos del formulario de una tarea.
 *
 * Reglas:
 * - `descripcion`: obligatoria; tras recortar espacios debe tener de 1 a 200
 *   caracteres. Vacía o solo espacios, o de más de 200 caracteres, se rechaza.
 * - `tipo`: opcional; si se asigna, solo se aceptan las categorías permitidas.
 * - `horasEstimadas`: opcional; si hay texto, debe ser un número entre 0 y 1000.
 * - `fechaLimite`: opcional; si hay texto, debe ser una fecha de calendario válida.
 *
 * Si algún campo falla, devuelve todos los errores encontrados por campo, de
 * modo que la interfaz conserve lo ingresado y muestre cada mensaje.
 */
export function validarTarea(datos: DatosFormularioTarea): ResultadoValidacion {
  const errores: ErroresFormulario = {}

  // --- Descripción (obligatoria, 1..200 tras recortar espacios) ---
  const descripcion = datos.descripcion.trim()
  if (descripcion.length < DESCRIPCION_MIN) {
    errores.descripcion = 'La descripción es obligatoria.'
  } else if (descripcion.length > DESCRIPCION_MAX) {
    errores.descripcion = `La descripción no puede superar los ${DESCRIPCION_MAX} caracteres.`
  }

  // --- Tipo (opcional; solo valores permitidos) ---
  // '' o ausente significa "sin asignar" y es válido.
  let tipo: TipoDeTarea | undefined
  const tipoTexto = datos.tipo
  if (tipoTexto !== undefined && tipoTexto !== '') {
    if (TIPOS_PERMITIDOS.includes(tipoTexto)) {
      tipo = tipoTexto
    } else {
      errores.tipo = 'El tipo de tarea no es válido.'
    }
  }

  // --- Horas estimadas (opcional; si hay texto, número entre 0 y 1000) ---
  let horasEstimadas: number | undefined
  const horasTexto = (datos.horasEstimadas ?? '').trim()
  if (horasTexto !== '') {
    // Number('') es 0, por eso ya descartamos el texto vacío arriba.
    const horas = Number(horasTexto)
    if (!Number.isFinite(horas) || horas < HORAS_MIN || horas > HORAS_MAX) {
      errores.horasEstimadas = `Las horas estimadas deben ser un número entre ${HORAS_MIN} y ${HORAS_MAX}.`
    } else {
      horasEstimadas = horas
    }
  }

  // --- Fecha límite (opcional; si hay texto, fecha de calendario válida) ---
  let fechaLimite: string | undefined
  const fechaTexto = (datos.fechaLimite ?? '').trim()
  if (fechaTexto !== '') {
    if (esFechaDeCalendarioValida(fechaTexto)) {
      fechaLimite = fechaTexto
    } else {
      errores.fechaLimite = 'La fecha límite no es una fecha válida.'
    }
  }

  // Si hubo cualquier error, devolvemos todos juntos (conservar lo ingresado).
  if (Object.keys(errores).length > 0) {
    return { valido: false, errores }
  }

  // Construimos la tarea normalizada omitiendo los campos opcionales vacíos.
  const tarea: TareaValida = { descripcion }
  if (tipo !== undefined) {
    tarea.tipo = tipo
  }
  if (horasEstimadas !== undefined) {
    tarea.horasEstimadas = horasEstimadas
  }
  if (fechaLimite !== undefined) {
    tarea.fechaLimite = fechaLimite
  }

  return { valido: true, tarea }
}

/**
 * Indica si un texto 'YYYY-MM-DD' corresponde a una fecha de calendario real.
 *
 * No basta con que `new Date` no falle: JavaScript ajusta fechas imposibles
 * (por ejemplo, el 31 de febrero pasa a marzo). Por eso comparamos las partes
 * que ingresó la persona contra las que produce la fecha ya interpretada.
 */
function esFechaDeCalendarioValida(texto: string): boolean {
  // Exigimos el formato exacto del input date: cuatro dígitos de año, dos de
  // mes y dos de día, separados por guiones.
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (partes === null) {
    return false
  }

  const anio = Number(partes[1])
  const mes = Number(partes[2])
  const dia = Number(partes[3])

  // Interpretamos en UTC para evitar desfaces por zona horaria.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))

  // Si alguna parte no coincide con la fecha interpretada, la fecha no existe.
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  )
}
