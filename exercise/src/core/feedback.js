// Detalles que hacen que se sienta app móvil: sonido, vibración y pantalla encendida.

let audio;

/** Hay que llamarlo dentro de un gesto del usuario (un tap) para que el navegador permita audio. */
export function unlockAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* sin audio */ }
}

export function chime() {
  if (!audio) return;
  const t0 = audio.currentTime;
  [659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const at = t0 + i * 0.16;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.55);
  });
}

export function haptic(pattern = 12) {
  try { navigator.vibrate?.(pattern); } catch { /* no soportado */ }
}

let lock = null;
export async function keepAwake(on) {
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch { /* requiere contexto seguro; si falla, no pasa nada */ }
}
