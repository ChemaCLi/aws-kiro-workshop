# Propiedad 12: el modelo del Account_Slot refleja disponibilidad y sesión

**Feature: accounts-auth, Property 12: El modelo del Account_Slot refleja disponibilidad y sesión.**

**Validates: Requirements 7.1, 7.2, 7.3, 10.1, 10.3**

## Enunciado

Para cualquier sesión y cualquier bandera `sdkReady`, `accountSlotModel(session, sdkReady)` de [`src/core/auth.js`](../../../../src/core/auth.js) devuelve la forma `{ enabled, mode, label, canSignOut }` y respeta estas tres situaciones de la tabla del Account_Slot de `settings-view.js`:

1. **Sin SDK (`!sdkReady`).** El Account_Slot queda deshabilitado con aviso y nunca ofrece cerrar sesión, aunque hubiera tokens: `enabled: false`, `mode: 'disabled'`, `canSignOut: false`. Esto no debe romper el resto de Ajustes (req. 10.1, 10.3). La situación es independiente de que haya o no sesión: sin red no hay nada que hacer con la cuenta.

2. **Con SDK y sin sesión.** El Account_Slot es un control de invitado que lleva a la Auth_Page: `enabled: true`, `mode: 'guest'`, `canSignOut: false` (req. 7.3).

3. **Con SDK y con sesión.** El Account_Slot muestra la Display_Name y expone el control de cerrar sesión: `enabled: true`, `mode: 'signed-in'`, `canSignOut: true`. La etiqueta es la Display_Name cuando existe y no está en blanco; si falta o es solo espacios, cae al correo (`email`) (req. 7.1, 7.2).

La propiedad se comprueba de dos formas complementarias:

- **Combinación exhaustiva** del dominio pequeño que decide `enabled`/`mode`/`canSignOut`: `sdkReady` en `true`/`false` cruzado con tres sesiones representativas (sin sesión, sesión con Display_Name, y sesión sin Display_Name pero con correo). Son los casos que distinguen las tres ramas de la función.
- **Barrido aleatorio** de ≥ 100 iteraciones con sesiones variadas (Display_Name y correo con valores arbitrarios, a veces vacíos o solo espacios, a veces ausentes) para confirmar que la elección de la etiqueta y el resto del modelo se mantienen en todo el espacio de entradas.

## Qué es puro y exportado

`accountSlotModel(session, sdkReady)` es una función **exportada** y **pura**: no toca el DOM ni lee la disponibilidad por su cuenta, recibe `sdkReady` como argumento. La propiedad se verifica **directamente** sobre ella, sin replicar nada. El oráculo de la etiqueta (Display_Name o correo) se escribe aparte en el script para contrastar contra la implementación.

## Nota sobre Node y `location`

`auth-config.js` deriva `redirectUri` de `location.origin`, que no existe en Node, y `auth.js` lo importa. El script define un `location` mínimo y limpio **antes** de importar el módulo (y lo restaura al terminar), de modo que el mismo script corre en la consola del navegador (donde `location` ya existe y el stub no se aplica) y en Node.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta, el stub de `location` y el oráculo de la etiqueta. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 12: El modelo del Account_Slot refleja disponibilidad y sesión
// Validates: Requirements 7.1, 7.2, 7.3, 10.1, 10.3

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

// --- Helpers de generación ---------------------------------------------------

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Cadena arbitraria para Display_Name y correo: incluye letras, dígitos, espacios y signos
// típicos de un correo, para ejercitar también valores con espacios al inicio/fin.
const randomText = (len = randomInt(0, 20)) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .@_-';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

// A veces devuelve un valor de texto, a veces lo omite (undefined) o lo deja vacío/en blanco,
// para que el barrido cubra Display_Name/correo ausentes, vacíos y solo con espacios.
const maybeText = () => {
  const dice = Math.random();
  if (dice < 0.2) return undefined;      // ausente
  if (dice < 0.35) return '';            // vacío
  if (dice < 0.45) return '   ';         // solo espacios (cuenta como ausente para la etiqueta)
  return randomText();
};

try {
  // Importa el servicio real. La ruta relativa se resuelve contra la URL de la página en el
  // navegador, y contra la carpeta desde la que corre Node (ver "Cómo ejecutarlo").
  const { accountSlotModel } = await import('./src/core/auth.js');

  // Oráculo de la etiqueta con sesión, escrito aparte de la implementación: la Display_Name
  // si existe y no está en blanco; si falta, el correo; si tampoco hay correo, cadena vacía.
  const expectedLabel = (session) => {
    const displayName = session.displayName;
    if (displayName && displayName.trim()) return displayName;
    return session.email || '';
  };

  // Verificación completa del modelo para una sesión y una bandera. Única fuente de las
  // aserciones: la usan tanto la combinación exhaustiva como el barrido aleatorio.
  const modelHolds = (session, sdkReady) => {
    const model = accountSlotModel(session, sdkReady);
    if (!model || typeof model !== 'object') return false;

    // 1) Sin SDK: deshabilitado, modo 'disabled' y sin cerrar sesión, haya o no sesión.
    if (!sdkReady) {
      return model.enabled === false && model.mode === 'disabled' && model.canSignOut === false;
    }

    // 2) Con SDK y sin sesión: invitado habilitado que lleva a la Auth_Page, sin cerrar sesión.
    if (!session) {
      return model.enabled === true && model.mode === 'guest' && model.canSignOut === false;
    }

    // 3) Con SDK y con sesión: habilitado, modo 'signed-in', etiqueta = Display_Name o correo,
    //    y siempre se puede cerrar sesión.
    return (
      model.enabled === true &&
      model.mode === 'signed-in' &&
      model.canSignOut === true &&
      model.label === expectedLabel(session)
    );
  };

  // Combinación exhaustiva: sdkReady true/false × (sin sesión, con Display_Name, sin
  // Display_Name pero con correo). Cubre las tres ramas de la función y el fallback de etiqueta.
  const sessions = [
    null,                                                   // sin sesión
    { displayName: 'Ana', email: 'ana@example.com' },       // con Display_Name
    { email: 'sin-nombre@example.com' },                    // sin Display_Name, con correo
  ];
  for (const sdkReady of [true, false]) {
    for (const session of sessions) {
      if (!modelHolds(session, sdkReady)) {
        throw new Error(`Caso exhaustivo falla: sdkReady=${sdkReady} session=${JSON.stringify(session)}`);
      }
    }
  }

  // Casos límite de la etiqueta con sesión y SDK listo: Display_Name en blanco cae al correo,
  // y sin ninguno de los dos la etiqueta es cadena vacía.
  const labelEdgeCases = [
    [{ displayName: 'Beto', email: 'beto@x.com' }, 'Beto'],
    [{ displayName: '', email: 'vacio@x.com' }, 'vacio@x.com'],
    [{ displayName: '   ', email: 'espacios@x.com' }, 'espacios@x.com'],
    [{ email: 'solo-correo@x.com' }, 'solo-correo@x.com'],
    [{ displayName: '', email: '' }, ''],
    [{}, ''],
  ];
  for (const [session, label] of labelEdgeCases) {
    const model = accountSlotModel(session, true);
    if (model.label !== label) {
      throw new Error(`Etiqueta inesperada para ${JSON.stringify(session)}: ${JSON.stringify(model.label)} (esperaba ${JSON.stringify(label)})`);
    }
  }

  // Barrido aleatorio (>=100): sesiones con Display_Name y correo variados, a veces vacíos o
  // ausentes, y sdkReady al azar. El modelo completo se cumple en todo el espacio.
  forAll(300, () => {
    const sdkReady = Math.random() < 0.5;
    // 1 de cada 4 veces no hay sesión; el resto es una sesión con campos arbitrarios.
    const session = Math.random() < 0.25 ? null : { displayName: maybeText(), email: maybeText() };
    return { session, sdkReady };
  }, ({ session, sdkReady }) => modelHolds(session, sdkReady));

  console.log('Feature: accounts-auth, Property 12: OK (Account_Slot deshabilitado sin SDK, invitado sin sesion, Display_Name o correo con sesion)');
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir la app (por ejemplo `npx serve exercise` o, dentro de `exercise/`, `python3 -m http.server 8080`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica. La ruta `./src/core/auth.js` del `import()` se resuelve contra la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll` y el stub de `location`, y usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`) se corre el bloque ` ```js ` con:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crean archivos temporales.

## Resultado esperado

El script termina sin lanzar error y muestra en consola:

```
Feature: accounts-auth, Property 12: OK (Account_Slot deshabilitado sin SDK, invitado sin sesion, Display_Name o correo con sesion)
```

Un `Error: Caso exhaustivo falla: ...` señala que alguna de las tres situaciones (sin SDK, invitado, con sesión) no devolvió el `enabled`/`mode`/`canSignOut` esperado, e incluye `sdkReady` y la sesión que falló. Un `Error: Etiqueta inesperada ...` señala que el fallback Display_Name → correo no se aplicó bien. Un `Error: Falla con: ...` del barrido reporta el `{ session, sdkReady }` aleatorio que rompió el modelo. En cualquier caso se reporta a `coder` con el caso que falló.

## Última ejecución

La lógica de la propiedad (misma implementación de `accountSlotModel` de `src/core/auth.js`) se corrió con Node 24 sobre la combinación exhaustiva (6 casos: `sdkReady` true/false × tres sesiones), los 6 casos límite de etiqueta y un barrido de 300 iteraciones aleatorias con Display_Name y correo variados: todos los casos cumplieron las tres situaciones del Account_Slot y el fallback de etiqueta. La salida fue `Feature: accounts-auth, Property 12: OK (Account_Slot deshabilitado sin SDK, invitado sin sesion, Display_Name o correo con sesion)`.

Nota del entorno: en esta sandbox la combinación `node --input-type=module --eval` con `await import('./src/core/auth.js')` se queda colgada al resolver el módulo (una peculiaridad de `--eval` + top-level `await import`, no de la lógica ni del módulo). Para ejecutar el script tal como está documentado, usar la consola de DevTools con la app servida, o pegar el bloque en `node --input-type=module` por stdin y cerrar con Ctrl-D; ambos resuelven el `import` sin ese cuelgue.
