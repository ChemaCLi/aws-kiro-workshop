// Arnés mínimo de pruebas por propiedades, portado de los scripts que antes se pegaban en la
// consola del navegador (ver docs/modules/*/properties/). Corre `check` con `runs` entradas
// generadas y falla con la primera que no cumpla, mostrando la entrada que la rompió.
export function forAll(runs, generate, check) {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
}

export const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
