// Prueba de propiedad para la allowlist de orígenes del puente OIDC.
// Feature: accounts-auth, Property 15: El puente acepta solo orígenes de la allowlist.
// Validates: Requirements 11.5, 12.6
// Runner nativo de Node (node:test): el puente SÍ es Node, no necesita navegador.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isAllowedOrigin } from '../lib/origins.js';

// Arnés mínimo igual al del README de accounts-auth: corre `check` con `runs`
// entradas aleatorias y lanza con la primera que no cumpla, mostrando el input.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) {
      throw new Error(`Falla con: ${JSON.stringify(input)}`);
    }
  }
};

const RUNS = 200;

// --- Generadores aleatorios acotados al espacio de entrada que importa ---

const randomInt = (maxExclusive) => Math.floor(Math.random() * maxExclusive);

const pick = (list) => list[randomInt(list.length)];

const SCHEMES = ['https://', 'http://'];
const HOSTS = ['example.com', 'focus-garden.app', 'app.example.com', 'localhost', 'cognito.example.org'];
const PORTS = ['', ':3000', ':8080', ':443'];

/** Un origen con la forma esquema://host[:puerto], como lo mandaría un navegador. */
const randomOrigin = () => `${pick(SCHEMES)}${pick(HOSTS)}${pick(PORTS)}`;

/** Una allowlist aleatoria de entre 0 y 4 orígenes, posiblemente con repetidos. */
const randomAllowlist = () => {
  const size = randomInt(5);
  const list = [];
  for (let i = 0; i < size; i++) list.push(randomOrigin());
  return list;
};

test('Feature: accounts-auth, Property 15 - acepta un origen si y solo si es miembro exacto de la allowlist', () => {
  forAll(RUNS, () => ({ origin: randomOrigin(), allowlist: randomAllowlist() }), ({ origin, allowlist }) => {
    const expected = allowlist.includes(origin);
    return isAllowedOrigin(origin, allowlist) === expected;
  });
});

test('Feature: accounts-auth, Property 15 - un miembro exacto de la allowlist siempre se acepta', () => {
  forAll(RUNS, () => {
    // Garantiza al menos un elemento y que el origen probado sea miembro.
    const allowlist = randomAllowlist();
    if (allowlist.length === 0) allowlist.push(randomOrigin());
    return { origin: pick(allowlist), allowlist };
  }, ({ origin, allowlist }) => isAllowedOrigin(origin, allowlist) === true);
});

test('Feature: accounts-auth, Property 15 - rechaza variantes de subdominio', () => {
  // Un subdominio del origen permitido ("https://evil.example.com" frente a
  // una allowlist con "https://example.com") nunca debe colarse.
  const allowlist = ['https://example.com', 'https://focus-garden.app'];
  const subdomains = [
    'https://evil.example.com',
    'https://sub.example.com',
    'https://attacker.focus-garden.app',
    'https://a.b.example.com',
  ];
  forAll(RUNS, () => pick(subdomains), (origin) => isAllowedOrigin(origin, allowlist) === false);
});

test('Feature: accounts-auth, Property 15 - rechaza variantes de prefijo y sufijo', () => {
  const allowlist = ['https://example.com'];
  const variants = [
    'https://example.com.evil.com', // sufijo malicioso
    'https://example.co',           // prefijo (recorte)
    'https://example.com/',         // barra final
    'https://example.com:8080',     // puerto extra
    'http://example.com',           // esquema distinto
    ' https://example.com',         // espacio inicial
    'https://example.com ',         // espacio final
    'xhttps://example.com',         // prefijo pegado
  ];
  forAll(RUNS, () => pick(variants), (origin) => isAllowedOrigin(origin, allowlist) === false);
});

test('Feature: accounts-auth, Property 15 - el string vacío nunca se acepta', () => {
  forAll(RUNS, randomAllowlist, (allowlist) => isAllowedOrigin('', allowlist) === false);
  // Aun si la allowlist contuviera una cadena vacía, un origen vacío se rechaza del lado seguro.
  assert.equal(isAllowedOrigin('', ['']), false);
});

test('Feature: accounts-auth, Property 15 - una allowlist que no es arreglo se rechaza', () => {
  const notArrays = [undefined, null, 'https://example.com', 42, {}, { includes: () => true }, true];
  forAll(RUNS, () => ({ origin: randomOrigin(), allowlist: pick(notArrays) }),
    ({ origin, allowlist }) => isAllowedOrigin(origin, allowlist) === false);
});

test('Feature: accounts-auth, Property 15 - un origen que no es string se rechaza', () => {
  const notStrings = [undefined, null, 42, {}, [], true];
  forAll(RUNS, () => ({ origin: pick(notStrings), allowlist: randomAllowlist() }),
    ({ origin, allowlist }) => isAllowedOrigin(origin, allowlist) === false);
});
