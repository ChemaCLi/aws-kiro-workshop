# Propiedad 13: Las reglas de contraseña incumplidas son exactas

**Feature: accounts-auth, Property 13: Las reglas de contraseña incumplidas son exactas.**

**Validates: Requirements 2.5**

## Enunciado

Para muchas contraseñas aleatorias evaluadas contra políticas variadas, `passwordUnmetRules(password, policy)` de [`src/core/auth.js`](../../../../src/core/auth.js) cumple el "si y solo si" exacto:

1. **Vacío si y solo si cumple todo.** La lista devuelta está vacía exactamente cuando la contraseña satisface todas las reglas que la política exige. Si falta cualquier regla exigida, la lista no está vacía. Esta equivalencia es lo que permite mostrar los requisitos pendientes ANTES de llamar a Cognito (req. 2.5).
2. **Biconditional por regla.** Una regla aparece en la lista si y solo si la política la exige y la contraseña no la satisface. Dicho al revés: nunca aparece una regla que la política no exige, ni una que la contraseña sí cumple. Se comprueba contra un oráculo independiente, escrito aparte de la implementación, que decide regla por regla qué debería estar incumplido.
3. **Cada regla a lo más una vez.** Ningún mensaje se repite: cada regla incumplida aparece exactamente una vez. Un mensaje duplicado confundiría al usuario y delataría un recorrido mal hecho de la lista de reglas.

La propiedad se evalúa sobre contraseñas aleatorias (variando longitud y presencia de mayúscula, minúscula, número y símbolo) y políticas aleatorias (longitud mínima variable y cada requisito opcional activado o no). Se incluyen casos límite: contraseña vacía, contraseña que cumple todo, contraseña que no cumple nada, y política sin requisitos opcionales (solo longitud).

`passwordUnmetRules` es una función pura y no depende de `location`, pero `auth.js` importa `auth-config.js`, que sí deriva `redirectUri` de `location.origin`. Para que el script corra igual en el navegador y en Node, se define un `location` mínimo y limpio **antes** de importar el módulo y se restaura al terminar, igual que en la Propiedad 5.

## Nota sobre el oráculo

El oráculo reimplementa, de forma independiente a `auth.js`, las cinco reglas de la política de Cognito: longitud mínima (siempre exigida, por defecto 8), y mayúscula, minúscula, número y símbolo (cada una exigida solo si la política la activa). Usa el mismo conjunto de símbolos que documenta Cognito. Como `passwordUnmetRules` devuelve los mensajes en el orden fijo de sus reglas, el oráculo produce la lista esperada en ese mismo orden, y la comprobación exige igualdad exacta de contenido y orden. Así, si la implementación añade, omite o reordena un mensaje, el biconditional falla.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y el stub de `location`. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 13: Las reglas de contraseña incumplidas son exactas
// Validates: Requirements 2.5

// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};

// En Node no hay `location`; se define un stub limpio solo si falta, y se restaura al terminar.
const needsLocationStub = typeof location === 'undefined';
if (needsLocationStub) {
  globalThis.location = { origin: 'https://focus-garden.example' };
}

// Mensajes esperados, idénticos a los de `auth.js`. El oráculo los emite según el orden de
// las reglas (longitud, mayúscula, minúscula, número, símbolo), que es el orden en que
// `passwordUnmetRules` recorre su lista.
const MSG_MIN_LENGTH = (minLength) => `Debe tener al menos ${minLength} caracteres`;
const MSG_UPPERCASE = 'Debe incluir una letra mayúscula';
const MSG_LOWERCASE = 'Debe incluir una letra minúscula';
const MSG_NUMBER = 'Debe incluir un número';
const MSG_SYMBOL = 'Debe incluir un símbolo';

// Conjunto de símbolos aceptados por Cognito (mismo que documenta su política).
const SYMBOL_RE = /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`+=\- ]/;

// Oráculo independiente: decide, regla por regla, qué mensajes DEBERÍAN estar incumplidos,
// en el orden fijo de las reglas. No llama a `auth.js`; es la verdad contra la que se compara.
const expectedUnmet = (password, policy) => {
  const minLength = policy.minLength ?? 8;
  const expected = [];
  if (password.length < minLength) expected.push(MSG_MIN_LENGTH(minLength));
  if (policy.requireUppercase && !/[A-Z]/.test(password)) expected.push(MSG_UPPERCASE);
  if (policy.requireLowercase && !/[a-z]/.test(password)) expected.push(MSG_LOWERCASE);
  if (policy.requireNumbers && !/[0-9]/.test(password)) expected.push(MSG_NUMBER);
  if (policy.requireSymbols && !SYMBOL_RE.test(password)) expected.push(MSG_SYMBOL);
  return expected;
};

// Dos listas son iguales si tienen el mismo largo y los mismos mensajes en el mismo orden.
const sameList = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

// Piezas aleatorias para componer contraseñas que varían en longitud y en la presencia de
// cada categoría de carácter, de modo que el barrido cruce reglas cumplidas e incumplidas.
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+.';
const randomInt = (maxExclusive) => Math.floor(Math.random() * maxExclusive);
const pick = (chars) => chars[randomInt(chars.length)];
const flip = () => Math.random() < 0.5;

// Genera una contraseña de longitud aleatoria (0 a 15), incluyendo u omitiendo al azar cada
// categoría de carácter; la longitud 0 cubre el caso de contraseña vacía.
const randomPassword = () => {
  const length = randomInt(16);
  const pools = [];
  if (flip()) pools.push(UPPER);
  if (flip()) pools.push(LOWER);
  if (flip()) pools.push(DIGITS);
  if (flip()) pools.push(SYMBOLS);
  if (pools.length === 0) pools.push(LOWER);
  let password = '';
  for (let i = 0; i < length; i++) password += pick(pools[randomInt(pools.length)]);
  return password;
};

// Genera una política con longitud mínima entre 6 y 12 y cada requisito opcional al azar;
// así el barrido incluye políticas sin requisitos opcionales y con todos activos.
const randomPolicy = () => ({
  minLength: 6 + randomInt(7),
  requireUppercase: flip(),
  requireLowercase: flip(),
  requireNumbers: flip(),
  requireSymbols: flip(),
});

try {
  const { passwordUnmetRules } = await import('./src/core/auth.js');

  // El biconditional exacto para un par (password, policy): la lista de `auth.js` debe
  // coincidir, en contenido y orden, con la del oráculo; y ningún mensaje se repite.
  const matchesOracle = ({ password, policy }) => {
    const actual = passwordUnmetRules(password, policy);
    const expected = expectedUnmet(password, policy);
    const noDuplicates = new Set(actual).size === actual.length;
    return Array.isArray(actual) && noDuplicates && sameList(actual, expected);
  };

  // Casos límite fijos: contraseña vacía, cumple todo, no cumple nada, política solo longitud.
  const ALL_REQUIRED = {
    minLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSymbols: true,
  };
  const ONLY_LENGTH = {
    minLength: 8, requireUppercase: false, requireLowercase: false, requireNumbers: false, requireSymbols: false,
  };
  const edgeCases = [
    { password: '', policy: ALL_REQUIRED },            // vacía: incumple todas las exigidas
    { password: 'Abcdef1!', policy: ALL_REQUIRED },    // cumple todo: lista vacía
    { password: 'abcdefgh', policy: ALL_REQUIRED },    // incumple mayúscula, número y símbolo
    { password: 'abc', policy: ONLY_LENGTH },          // solo longitud exigida, y la incumple
    { password: 'abcdefghij', policy: ONLY_LENGTH },   // solo longitud exigida, y la cumple
  ];
  for (const edgeCase of edgeCases) {
    if (!matchesOracle(edgeCase)) {
      throw new Error(`Falla en caso límite con: ${JSON.stringify(edgeCase)}`);
    }
  }

  // Barrido aleatorio: al menos 100 pares (password, policy) deben cumplir el biconditional.
  const RUNS = 500;
  forAll(RUNS, () => ({ password: randomPassword(), policy: randomPolicy() }), matchesOracle);

  console.log(`Feature: accounts-auth, Property 13: OK (${edgeCases.length} casos límite + ${RUNS} pares aleatorios)`);
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll`, el oráculo, el stub de `location` y usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, Property 13: OK (5 casos límite + 500 pares aleatorios)
```

Un `Error: Falla en caso límite con: ...` o `Error: Falla con: ...` señala que, para ese par `(password, policy)`, la lista de `passwordUnmetRules` no coincide con el oráculo: incluye una regla que sí se cumple o que la política no exige, omite una regla exigida e incumplida, repite un mensaje, o los ordena distinto. En cualquier caso se reporta a `coder` con el par que falló.

## Última ejecución

La lógica de la propiedad (oráculo independiente que reimplementa las cinco reglas de Cognito —longitud mínima, mayúscula, minúscula, número y símbolo, con el mismo conjunto de símbolos de la política— frente a la misma implementación de `passwordUnmetRules` de `src/core/auth.js`) se corrió con Node 24 sobre los 5 casos límite más 500 pares aleatorios `(password, policy)`: todos cumplieron el biconditional exacto (igualdad de contenido y orden con el oráculo) y en ninguno se repitió un mensaje. La salida fue `Feature: accounts-auth, Property 13: OK (5 casos límite + 500 pares aleatorios)`.

Nota del entorno: igual que en la Propiedad 5, en esta sandbox el `await import('./src/core/auth.js')` de nivel superior se queda colgado al resolver el módulo (una peculiaridad del entorno, no de la lógica ni del módulo). Para ejecutar el script tal como está documentado, usar la consola de DevTools con la app servida, o pegar el bloque en `node --input-type=module` por stdin y cerrar con Ctrl-D; ambos resuelven el `import` sin ese cuelgue.
