import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

// Prueba de humo: confirma que Vitest y fast-check están configurados y se ejecutan.
// Las pruebas reales de la lógica se agregan en las tareas siguientes del plan.
describe('configuración de pruebas', () => {
  it('ejecuta Vitest correctamente', () => {
    expect(1 + 1).toBe(2)
  })

  it('ejecuta pruebas de propiedades con fast-check', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a
      }),
    )
  })
})
