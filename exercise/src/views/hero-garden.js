// Jardín del hero: isla 3D decorativa de fondo de la landing, con luz según la franja del día.
// Si Three.js o WebGL fallan, pinta una isla de emojis sin animación sobre el cielo CSS de la landing.
import { PLANTS } from '../core/rules.js';
import { GARDEN_LOOKS } from '../three/garden-looks.js';

/** Máximo de plantas en la isla de emojis: más ya no caben en la elipse sin amontonarse. */
const MAX_FALLBACK_PLANTS = 12;

/** Astro que acompaña a cada franja en la isla de emojis. */
const PERIOD_SKY_EMOJI = { morning: '🌅', midday: '☀️', afternoon: '🌇', night: '🌙' };

const DEFAULT_PERIOD = 'midday';

/** Aire extra alrededor de la isla del hero: sin él, las esquinas se cortan al girar en un lienzo ancho. */
const HERO_FIT_MARGIN = 1.3;

/**
 * Monta el fondo vivo de la landing en `root` y devuelve `{ setPlots, setPeriod, dispose }`.
 * No se suscribe al store: la landing le entrega las plantas y la franja, así se puede
 * liberar (`dispose`) en cuanto la persona entra y no queda nada escuchando.
 */
export function mountHeroGarden(root) {
  let scene = null;
  let plots = [];
  let period = DEFAULT_PERIOD;
  let failed = false;
  let disposed = false;

  root.classList.add('block', 'relative', 'overflow-hidden');
  root.setAttribute('aria-hidden', 'true'); // es decoración: el contenido útil está en la tarjeta de la landing
  root.innerHTML = '<div data-stage class="absolute inset-0"></div>';
  const stage = root.querySelector('[data-stage]');

  const resizeObserver = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    scene?.resize(width, height);
  });
  resizeObserver.observe(stage);

  /** Isla de emojis: astro de la franja, elipse verde sobre tierra y las plantas. Sin animaciones. */
  function paintFallback() {
    const plants = plots.slice(0, MAX_FALLBACK_PLANTS)
      .map((plot) => `<span>${plot.plant?.emoji ?? PLANTS[0].emoji}</span>`)
      .join('');
    stage.innerHTML = `
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
        <span class="text-6xl">${PERIOD_SKY_EMOJI[period]}</span>
        <div class="relative w-full max-w-xs">
          <div class="absolute inset-x-3 -bottom-2 h-6 rounded-full bg-line"></div>
          <div class="relative flex min-h-28 flex-wrap content-center items-center justify-center gap-1 rounded-[50%] border border-line bg-leaf/70 px-10 py-6 text-3xl">${plants}</div>
        </div>
      </div>`;
  }

  /**
   * Carga la escena con import() dinámico para que la landing se vea sin esperar a Three.js.
   * Es el único llamador que congela la escena con movimiento reducido.
   */
  async function loadScene() {
    try {
      const { createGardenScene } = await import('../three/garden-scene.js');
      const createdScene = await createGardenScene(stage, {
        interactive: false,
        freezeWhenReducedMotion: true,
        fitMargin: HERO_FIT_MARGIN,
      });
      if (disposed) {
        // La persona entró antes de que terminara la carga: no hay nadie a quien mostrarle la escena.
        createdScene.dispose();
        return;
      }
      scene = createdScene;
      scene.setLook(GARDEN_LOOKS[period]);
      scene.sync(plots);
      const { width, height } = stage.getBoundingClientRect();
      scene.resize(width, height);
    } catch (err) {
      if (disposed) return;
      console.warn('Three.js no disponible, uso la isla de emojis', err);
      failed = true;
      paintFallback();
    }
  }

  loadScene();

  return {
    /** Guarda las plantas y las dibuja en la escena, o repinta la isla de emojis si no hay 3D. */
    setPlots(newPlots) {
      plots = newPlots;
      if (scene) scene.sync(plots);
      else if (failed) paintFallback();
    },
    /** Guarda la franja y cambia la luz de la escena, o repinta el astro de la isla de emojis. */
    setPeriod(newPeriod) {
      period = newPeriod in GARDEN_LOOKS ? newPeriod : DEFAULT_PERIOD;
      if (scene) scene.setLook(GARDEN_LOOKS[period]);
      else if (failed) paintFallback();
    },
    /** Libera la escena y el observador. Si la escena aún carga, se libera apenas termine de cargar. */
    dispose() {
      disposed = true;
      resizeObserver.disconnect();
      scene?.dispose();
      scene = null;
    },
  };
}
