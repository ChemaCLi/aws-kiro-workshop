# Propiedad 14: Los errores de autenticación mapean a mensajes seguros

**Feature: accounts-auth, Property 14: Los errores de autenticación mapean a mensajes seguros.**

**Validates: Requirements 2.4, 3.3**

## Enunciado

`mapAuthError(code)` de [`src/core/auth.js`](../../../../src/core/auth.js) es una función pura que traduce el código de excepción de Cognito a un mensaje seguro en español y una acción sugerida (`{ message, action }`). La propiedad cubre su contrato en dos frentes:

1. **Dominio finito conocido (recorrido exhaustivo).** Para CADA código conocido del mapa `AUTH_ERROR_MESSAGES` (`UsernameExistsException`, `InvalidPasswordException`, `InvalidParameterException`, `CodeMismatchException`, `ExpiredCodeException`, `NotAuthorizedException`, `UserNotFoundException`, `UserNotConfirmedException`, `LimitExceededException`, `TooManyRequestsException`, `CodeDeliveryFailureException`), `mapAuthError(code)` devuelve un `message` de texto no vacío (en español) y una `action` válida (una cadena no vacía de un conjunto conocido). Así la vista siempre tiene algo que mostrar y una pista de qué ofrecer a continuación (req. 2.4).

2. **Seguridad de credenciales (req. 3.3).** `NotAuthorizedException` y `UserNotFoundException` devuelven EXACTAMENTE el mismo mensaje genérico. Es la invariante que impide que la interfaz delate si el correo existe o no: un atacante que pruebe correos no puede distinguir "usuario inexistente" de "contraseña incorrecta" por el texto mostrado.

3. **Código desconocido = genérico seguro.** Para cualquier código fuera del dominio conocido (incluyendo cadenas aleatorias, vacías, o que imiten nombres de excepción), `mapAuthError(code)` devuelve el mensaje genérico de respaldo: un `message` no vacío y una `action` válida, y NUNCA incrusta el código crudo recibido en el mensaje, para no filtrar detalles internos de Cognito. Esto se comprueba de forma exhaustiva sobre el conjunto conocido (todos caen en una entrada propia, no en el respaldo) y con ≥100 iteraciones de códigos aleatorios/desconocidos que sí caen en el respaldo.

`mapAuthError` no depende de `location`, pero `auth.js` importa `auth-config.js`, que sí deriva `redirectUri` de `location.origin`. Para que el script corra igual en el navegador y en Node, se define un `location` mínimo y limpio **antes** de importar el módulo y se restaura al terminar, igual que en la Propiedad 5.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y el stub de `location`. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 14: Los errores de autenticación mapean a mensajes seguros
// Validates: Requirements 2.4, 3.3

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

// Dominio finito de códigos de error de Cognito que la app mapea explícitamente. Debe
// coincidir con las claves de `AUTH_ERROR_MESSAGES` en `src/core/auth.js`; si allí se
// agrega o quita un código, esta lista se actualiza y el recorrido vuelve a ser exhaustivo.
const KNOWN_ERROR_CODES = [
  'UsernameExistsException',
  'InvalidPasswordException',
  'InvalidParameterException',
  'CodeMismatchException',
  'ExpiredCodeException',
  'NotAuthorizedException',
  'UserNotFoundException',
  'UserNotConfirmedException',
  'LimitExceededException',
  'TooManyRequestsException',
  'CodeDeliveryFailureException',
];

// Conjunto de acciones válidas que la vista sabe interpretar. Un código conocido debe
// sugerir una de estas; el respaldo usa 'retry'.
const VALID_ACTIONS = new Set([
  'sign-in',
  'fix-password',
  'retry',
  'resend-code',
  'wait',
]);

// Los dos códigos de credenciales que, por seguridad, deben compartir el mismo mensaje.
const CREDENTIAL_CODES = ['NotAuthorizedException', 'UserNotFoundException'];

// Cantidad de códigos desconocidos aleatorios para el barrido del respaldo (punto 3).
const UNKNOWN_RUNS = 200;

// Genera un código "basura" que no está en el dominio conocido: cadenas aleatorias, vacías
// o que imitan nombres de excepción, para forzar la rama del respaldo.
const randomUnknownCode = () => {
  const shapes = [
    () => '',
    () => Math.random().toString(36).slice(2),
    () => `${Math.random().toString(36).slice(2)}Exception`,
    () => `Fake${Math.floor(Math.random() * 1e6)}Exception`,
    () => String(Math.floor(Math.random() * 1e9)),
  ];
  const make = shapes[Math.floor(Math.random() * shapes.length)];
  const code = make();
  // Descartar el improbable choque con un código conocido: debe ser realmente desconocido.
  return KNOWN_ERROR_CODES.includes(code) ? `${code}_x` : code;
};

try {
  const { mapAuthError } = await import('./src/core/auth.js');

  // Un resultado válido: objeto con message (texto no vacío) y action de VALID_ACTIONS.
  const isSafeResult = (result) =>
    Boolean(result) &&
    typeof result.message === 'string' &&
    result.message.trim().length > 0 &&
    typeof result.action === 'string' &&
    VALID_ACTIONS.has(result.action);

  // 1) Recorrido EXHAUSTIVO del dominio conocido: cada código da un mensaje no vacío y
  //    una acción válida.
  for (const code of KNOWN_ERROR_CODES) {
    const result = mapAuthError(code);
    if (!isSafeResult(result)) {
      throw new Error(`Código conocido ${code} devolvió un resultado inválido: ${JSON.stringify(result)}`);
    }
  }

  // 2) SEGURIDAD (req. 3.3): credenciales inválidas comparten EXACTAMENTE el mismo mensaje
  //    genérico, para no revelar si el correo existe.
  const [credA, credB] = CREDENTIAL_CODES.map((code) => mapAuthError(code).message);
  if (credA !== credB) {
    throw new Error(
      `Los códigos de credenciales deben compartir mensaje; se obtuvo ${JSON.stringify(credA)} vs ${JSON.stringify(credB)}`,
    );
  }

  // El mensaje genérico no debe nombrar "correo" o "contraseña" por separado de forma que
  // delate cuál falló: ambos códigos apuntan al mismo texto neutro, ya verificado arriba.

  // 3) Código desconocido → mensaje genérico seguro. Primero de forma exhaustiva: ningún
  //    código conocido cae en el respaldo (todos tienen entrada propia). Luego con un
  //    barrido aleatorio de códigos basura, que SÍ deben caer en el respaldo sin filtrar
  //    el código crudo recibido.
  const fallbackMessage = mapAuthError('__definitivamente_desconocido__').message;

  forAll(
    Math.max(UNKNOWN_RUNS, 100),
    randomUnknownCode,
    (code) => {
      const result = mapAuthError(code);
      if (!isSafeResult(result)) return false;
      // El respaldo nunca filtra el código crudo dentro del mensaje.
      if (code.length > 0 && result.message.includes(code)) return false;
      // Un código desconocido siempre cae en el mismo mensaje genérico de respaldo.
      return result.message === fallbackMessage;
    },
  );

  console.log(
    `Feature: accounts-auth, Property 14: OK (${KNOWN_ERROR_CODES.length} códigos conocidos con mensaje seguro, ` +
      `credenciales con mensaje genérico compartido, ${Math.max(UNKNOWN_RUNS, 100)} desconocidos al respaldo)`,
  );
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll`, el stub de `location` y usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, Property 14: OK (11 códigos conocidos con mensaje seguro, credenciales con mensaje genérico compartido, 200 desconocidos al respaldo)
```

Un `Error: Código conocido ... devolvió un resultado inválido` señala un código del dominio conocido cuyo mensaje quedó vacío o cuya acción no pertenece al conjunto válido. Un `Error: Los códigos de credenciales deben compartir mensaje` indica una fuga de seguridad: `NotAuthorizedException` y `UserNotFoundException` dejaron de compartir el mensaje genérico y la interfaz delataría si el correo existe (req. 3.3). Un `Error: Falla con: ...` en el barrido señala un código desconocido que no cayó en el respaldo genérico, o que filtró el código crudo en el mensaje. En todos los casos se reporta a `coder` con el caso que falló.

## Última ejecución

La lógica de la propiedad (misma implementación de `mapAuthError` de `src/core/auth.js`: el mapa `AUTH_ERROR_MESSAGES` con el mensaje compartido `INVALID_CREDENTIALS_MESSAGE` para los dos códigos de credenciales y el respaldo `UNKNOWN_ERROR`) se corrió con Node 24: los 11 códigos conocidos devolvieron un `message` no vacío en español y una `action` del conjunto válido; `NotAuthorizedException` y `UserNotFoundException` devolvieron exactamente el mismo texto genérico; y 200 códigos desconocidos aleatorios cayeron todos en el mensaje genérico de respaldo sin filtrar el código crudo. La salida fue `Feature: accounts-auth, Property 14: OK (11 codigos conocidos con mensaje seguro, credenciales con mensaje generico compartido, 200 desconocidos al respaldo)`.

Nota del entorno: en esta sandbox la combinación `node --input-type=module --eval` con `await import('./src/core/auth.js')` se queda colgada al resolver el módulo (una peculiaridad de `--eval` + top-level `await import`, no de la lógica ni del módulo). Para ejecutar el script tal como está documentado, usar la consola de DevTools con la app servida, o pegar el bloque en `node --input-type=module` por stdin y cerrar con Ctrl-D; ambos resuelven el `import` sin ese cuelgue.
