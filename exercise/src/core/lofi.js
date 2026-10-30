// Música lofi hip hop de fondo, generada con Tone.js (cargado por CDN en index.html).
// Todo es defensivo: si Tone.js no está disponible (sin red), estas funciones no hacen
// nada y la app sigue funcionando igual, como pasa con Three.js.
//
// API: isMusicAvailable() · startMusic() · stopMusic() · setMusicVolume(db) · duckMusic(ms)

const DEFAULT_BPM = 72;
const BASE_VOLUME = -13; // dB del mix de la música cuando suena a volumen normal
const FADE = 1.4;        // segundos de fade-in / fade-out

// Las melodías viven como archivos JSON en /melodies (ver melodies/README.md).
// Cada una define bpm, chords, bass y melody; aquí se cargan y se elige una al arrancar.
const MELODIES_INDEX = new URL('../../melodies/index.json', import.meta.url);

let melodies = null; // lista cargada (se pide una sola vez)
let song = null;     // melodía activa

function validSong(m) {
  const ok = (arr) => Array.isArray(arr) && arr.length > 0;
  return m && ok(m.chords) && ok(m.bass) && ok(m.melody)
    && m.chords.length === m.bass.length && m.bass.length === m.melody.length;
}

async function loadMelodies() {
  if (melodies) return melodies;
  const files = await (await fetch(MELODIES_INDEX)).json();
  const loaded = await Promise.all(files.map(async (file) => {
    try {
      const m = await (await fetch(new URL(file, MELODIES_INDEX))).json();
      return validSong(m) ? m : null;
    } catch { return null; }
  }));
  melodies = loaded.filter(Boolean);
  return melodies;
}

let Tone = null;
let built = false;
let playing = false;

// Nodos de audio y partes del loop (se crean una sola vez).
let out, filter, reverb, chorus, vinyl;
let piano, bass, lead, kick, snare, hat;
let chordPart, bassPart, melodyPart, drumLoop;

function resolveTone() {
  Tone ??= globalThis.Tone ?? null;
  return Tone;
}

export function isMusicAvailable() {
  return Boolean(resolveTone());
}

// Ruido de vinilo tenue: da el aire "cálido" característico del lofi.
function makeVinyl(T) {
  const noise = new T.Noise('pink').start();
  const lp = new T.Filter(5200, 'lowpass');
  const hp = new T.Filter(700, 'highpass');
  const gain = new T.Gain(0.035);
  noise.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  return { noise, gain, node: gain };
}

function build() {
  const T = resolveTone();
  if (!T || built) return built;

  // ----- cadena de salida: todo pasa por aquí -----
  out = new T.Volume(-Infinity).toDestination(); // arranca en silencio; subimos con fade
  reverb = new T.Reverb({ decay: 6, wet: 0.32 }).connect(out);
  filter = new T.Filter({ type: 'lowpass', frequency: 2200, Q: 0.6 }).connect(reverb);
  chorus = new T.Chorus({ frequency: 0.6, delayTime: 3.5, depth: 0.5, wet: 0.25 }).connect(filter).start();

  // ----- instrumentos -----
  piano = new T.PolySynth(T.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.03, decay: 0.6, sustain: 0.25, release: 2.2 },
    volume: -11,
  }).connect(chorus);

  bass = new T.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.04, decay: 0.3, sustain: 0.9, release: 0.8 },
    volume: -8,
  }).connect(filter);

  lead = new T.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.08, decay: 0.4, sustain: 0.2, release: 1.6 },
    volume: -16,
  }).connect(chorus);

  // Percusión sintética sencilla.
  kick = new T.MembraneSynth({ octaves: 4, pitchDecay: 0.05, volume: -9 }).connect(filter);
  snare = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -20 }).connect(reverb);
  hat = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.045, sustain: 0 }, volume: -26 })
    .connect(new T.Filter(8000, 'highpass').connect(filter));

  vinyl = makeVinyl(T);
  vinyl.node.connect(out);

  // ----- partes del loop (un compás por paso; el largo lo define la melodía) -----
  T.Transport.swing = 0.3;         // ese arrastre lofi
  T.Transport.swingSubdivision = '8n';

  chordPart = new T.Loop((time) => {
    const bar = currentBar(T);
    piano.triggerAttackRelease(song.chords[bar], '1m', time, 0.5);
  }, '1m').start(0);

  bassPart = new T.Loop((time) => {
    const bar = currentBar(T);
    const root = song.bass[bar];
    bass.triggerAttackRelease(root, '2n', time, 0.9);
    // rebote a la quinta en la segunda mitad del compás
    bass.triggerAttackRelease(T.Frequency(root).transpose(7).toNote(), '4n', time + T.Time('2n').toSeconds(), 0.6);
  }, '1m').start(0);

  melodyPart = new T.Loop((time) => {
    const bar = currentBar(T);
    const row = song.melody[bar];
    row.forEach((note, i) => {
      if (note) lead.triggerAttackRelease(note, '8n', time + i * T.Time('8n').toSeconds(), 0.4 + Math.random() * 0.2);
    });
  }, '1m').start(0);

  // Batería: patrón de 8 corcheas por compás (boom-bap tranquilo).
  drumLoop = new T.Loop((time) => {
    const eighth = T.Time('8n').toSeconds();
    kick.triggerAttackRelease('C1', '8n', time, 1);
    kick.triggerAttackRelease('C1', '8n', time + eighth * 3, 0.8);
    snare.triggerAttackRelease('8n', time + eighth * 4, 0.9);
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) hat.triggerAttackRelease('16n', time + i * eighth, 0.5 + (i === 2 ? 0.2 : 0));
    }
  }, '1m').start(0);

  built = true;
  return true;
}

// Compás actual dentro del bucle de la melodía, a partir de la posición del Transport.
function currentBar(T) {
  const bars = Math.floor(T.Transport.seconds / T.Time('1m').toSeconds());
  const n = song.chords.length;
  return ((bars % n) + n) % n;
}

export async function startMusic() {
  const T = resolveTone();
  if (!T || playing) return;
  try {
    await T.start();            // requiere gesto del usuario; se llama desde un tap
    const list = await loadMelodies();
    if (!list.length || !build()) return;
    song = list[Math.floor(Math.random() * list.length)];
    T.Transport.bpm.value = song.bpm ?? DEFAULT_BPM;
    playing = true;
    T.Transport.start();
    // fade-in: de silencio a volumen base
    out.volume.cancelScheduledValues(T.now());
    out.volume.setValueAtTime(-Infinity, T.now());
    out.volume.linearRampTo(BASE_VOLUME, FADE);
  } catch { /* audio no permitido todavía */ }
}

export function stopMusic() {
  const T = resolveTone();
  if (!T || !playing || !built) return;
  playing = false;
  // El fade-out corre en el reloj de audio. El setTimeout solo apaga el Transport para
  // ahorrar CPU: si llega tarde, la música ya está en silencio, así que no afecta lo audible.
  out.volume.cancelScheduledValues(T.now());
  out.volume.rampTo(-Infinity, FADE);
  setTimeout(() => { if (!playing) T.Transport.stop(); }, FADE * 1000 + 100);
}

export function setMusicVolume(db) {
  const T = resolveTone();
  if (!T || !built) return;
  out.volume.rampTo(db, 0.4);
}

/** Baja el volumen un momento (para que la campanita de fin de ronda se oiga clara). */
export function duckMusic(durationMs = 1600) {
  const T = resolveTone();
  if (!T || !playing || !built) return;
  // Bajada y regreso programados en el reloj de audio (no en setTimeout): si el hilo
  // principal se congela o la pestaña se espacia, el volumen igual se restaura a tiempo.
  const v = out.volume;
  const now = T.now();
  const hold = now + 0.15 + durationMs / 1000;
  v.cancelScheduledValues(now);
  v.setValueAtTime(v.value, now);
  v.linearRampToValueAtTime(BASE_VOLUME - 12, now + 0.15);
  v.setValueAtTime(BASE_VOLUME - 12, hold);
  v.linearRampToValueAtTime(BASE_VOLUME, hold + 0.8);
}

export function isMusicPlaying() {
  return playing;
}

// Helper para probar en consola durante el workshop.
globalThis.__lofi = { startMusic, stopMusic, setMusicVolume, duckMusic, isMusicAvailable };
