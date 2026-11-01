# Propiedad 1: franja horaria

**Feature: landing-and-settings, Property 1: La franja depende solo de la hora local y cubre todo el día.**

**Validates: Requirements 2.1, 2.3**

## Enunciado

Para cualquier `Date` válida, `timePeriodFor(date)` devuelve exactamente una de `morning`, `midday`, `afternoon`, `night` y coincide con su hora local:

| Hora local | Franja |
|------------|--------|
| 6–11 | `morning` |
| 12–15 | `midday` |
| 16–19 | `afternoon` |
| 20–23 y 0–5 | `night` |

Dos fechas con la misma hora local dan la misma franja, sin importar día, mes, año, minutos, segundos o milisegundos.

## Script

Usa el arnés `forAll` de [`../README.md`](../README.md). Recorre las 24 horas completas (dominio finito, sin azar) y, por cada hora, prueba 120 fechas aleatorias con esa misma hora local.

```js
// Feature: landing-and-settings, Property 1: La franja depende solo de la hora local y cubre todo el día
// Validates: Requirements 2.1, 2.3

const { timePeriodFor, TIME_PERIODS } = await import('./src/core/rules.js');

// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};

// Tabla de referencia: la franja esperada para cada hora local, escrita aparte de la implementación.
const expectedPeriodForHour = (hour) => {
  if (hour >= 6 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 15) return 'midday';
  if (hour >= 16 && hour <= 19) return 'afternoon';
  return 'night'; // 20-23 y 0-5
};

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Fecha aleatoria (año, mes, día, minutos, segundos y ms al azar) con la hora local indicada.
// Día máximo 28 para que todo mes sea válido.
const randomDateAtHour = (hour) =>
  new Date(randomInt(1990, 2090), randomInt(0, 11), randomInt(1, 28), hour,
    randomInt(0, 59), randomInt(0, 59), randomInt(0, 999));

// Cubre todo el día: devuelve exactamente una franja válida y coincide con la hora local.
const periodMatchesLocalHour = (date) => {
  const period = timePeriodFor(date);
  return TIME_PERIODS.includes(period) && period === expectedPeriodForHour(date.getHours());
};

// 1) Dominio finito: las 24 horas completas, con la hora local exacta en minuto 0 y en minuto 59.
for (let hour = 0; hour < 24; hour++) {
  const base = new Date(2025, 5, 15, hour, 0, 0, 0);
  const lastMinute = new Date(2025, 5, 15, hour, 59, 59, 999);
  for (const date of [base, lastMinute]) {
    if (date.getHours() !== hour) continue; // hora inexistente por cambio de horario (DST): se omite
    if (!periodMatchesLocalHour(date)) throw new Error(`Falla con la hora: ${hour}`);
  }
}

// 2) Por cada hora, ≥100 fechas aleatorias con esa hora local: misma franja sin importar el resto de la fecha.
for (let hour = 0; hour < 24; hour++) {
  const reference = timePeriodFor(new Date(2025, 5, 15, hour, 30, 0, 0));
  forAll(120, () => randomDateAtHour(hour).getTime(), (timestamp) => {
    const date = new Date(timestamp);
    if (date.getHours() !== hour) return true; // hora inexistente por DST: la fecha se corrió, no aplica
    return periodMatchesLocalHour(date) && timePeriodFor(date) === reference;
  });
}

// 3) Fechas completamente aleatorias: siempre exactamente una franja válida que coincide con su hora.
forAll(500, () => randomInt(-2e12, 4e12), (timestamp) => periodMatchesLocalHour(new Date(timestamp)));

console.log('Feature: landing-and-settings, Property 1: OK');
```

## Cómo ejecutarlo

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools y pegar el script completo. La ruta `./src/core/rules.js` del `import()` dinámico se resuelve contra la URL de la página (`index.html`), no contra este archivo.
3. Para correrlo con Node (rules.js no usa DOM), cambiar solo la línea del `import` por la ruta absoluta del archivo:

   ```js
   const { timePeriodFor, TIME_PERIODS } = await import('file:///RUTA/A/exercise/src/core/rules.js');
   ```

   y ejecutar el script con `node --input-type=module`.

## Resultado esperado

El script termina sin lanzar error e imprime `Feature: landing-and-settings, Property 1: OK`. Un `Error: Falla con: ...` o `Falla con la hora: N` es un contraejemplo y se reporta a `coder` con la entrada que muestra.

## Última ejecución

Con Node (`node --input-type=module`, `import` con ruta `file://`) el script pasó en las zonas horarias `America/Mexico_City`, `UTC`, `America/New_York`, `Asia/Kolkata` y `Pacific/Auckland` (variable `TZ`), con la salida `Feature: landing-and-settings, Property 1: OK`. Verificado contra `timePeriodFor` de `src/core/rules.js` sin modificarlo.
