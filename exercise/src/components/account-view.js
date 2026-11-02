// <account-view>: la Auth_Page en la ruta hash #/cuenta. Alberga el registro, el inicio con
// correo y contraseña, los cuatro proveedores sociales, la confirmación de código y el
// Name_Prompt. Es un HTMLElement light DOM (no extiende StoreView: no depende del store);
// se suscribe a `app:auth` para reaccionar a cambios de sesión sin importar a otra vista.
import {
  signUp,
  confirmSignUp,
  resendCode,
  signInWithPassword,
  signInWithProvider,
  handleRedirect,
  saveDisplayName,
  isAuthAvailable,
  onAvailabilityChange,
  postSignInRoute,
  passwordUnmetRules,
  mapAuthError,
} from '../core/auth.js';
import { icon } from '../ui/icons.js';
import { esc, navigate, toast } from '../ui/util.js';

// Política de contraseña con la que validamos ANTES de llamar a Cognito (req. 2.5). El User
// Pool manda la política real; aquí usamos los valores por defecto de Cognito como referencia
// local para no mostrar al usuario reglas que el backend no exige. Si el backend fuera más
// estricto, su `InvalidPasswordException` sirve de respaldo vía `mapAuthError`.
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
};

// Proveedores sociales en el orden en que se muestran. Cada clave coincide con
// `AUTH_CONFIG.providers`; el ícono y la etiqueta son para el botón accesible.
const PROVIDERS = [
  { id: 'Google', icon: 'google', label: 'Google' },
  { id: 'Meta', icon: 'meta', label: 'Meta' },
  { id: 'Amazon', icon: 'amazon', label: 'Amazon' },
  { id: 'GitHub', icon: 'github', label: 'GitHub' },
];

// Avisos de "no disponible" por motivo que devuelve `signInWithProvider`, para explicar por
// qué un método quedó inactivo sin romper los demás (req. 5.5, 10).
const UNAVAILABLE_MESSAGES = {
  offline: 'Necesitas conexión para usar tu cuenta',
  'no-webcrypto': 'Este método necesita una conexión segura (https)',
  'github-bridge': 'El inicio con GitHub no está disponible ahora',
};

class AccountView extends HTMLElement {
  // Estado interno de la máquina de pantallas (ver tabla del design.md).
  #view = 'signIn';
  // Datos que persisten entre pantallas: el correo del registro llega a la confirmación.
  #email = '';
  // Reglas de contraseña incumplidas a mostrar bajo el formulario de registro (req. 2.5).
  #passwordErrors = [];
  // Mensaje de error general del paso actual (credenciales, código, red...).
  #errorMessage = '';
  // Aviso por proveedor cuando `signInWithProvider` devuelve `{ unavailable }`.
  #providerNotice = '';
  // Si el Account_SDK puede autenticar ahora mismo; alterna el estado `disabled` (req. 10).
  #available = isAuthAvailable();
  // Baja de la suscripción a disponibilidad; se llama en `disconnectedCallback`.
  #unsubscribeAvailability = null;
  // Handler de `app:auth` guardado para poder desuscribir al desmontar.
  #onAuth = (e) => this.#handleAuthEvent(e);

  connectedCallback() {
    document.addEventListener('app:auth', this.#onAuth);
    // Rehabilita (o deshabilita) la Auth_Page sin recargar cuando cambia la red (req. 10.4).
    this.#unsubscribeAvailability = onAvailabilityChange((available) => {
      this.#available = available;
      this.#render();
    });
    this.addEventListener('click', (e) => this.#onClick(e));
    this.addEventListener('submit', (e) => this.#onSubmit(e));
    this.addEventListener('input', (e) => this.#onInput(e));
    // Al montarse, puede ser la vuelta de un redirect social: lo procesamos antes de pintar.
    this.#maybeHandleRedirect();
  }

  disconnectedCallback() {
    document.removeEventListener('app:auth', this.#onAuth);
    if (this.#unsubscribeAvailability) this.#unsubscribeAvailability();
  }

  // --- Vuelta del redirect OAuth ---

  /**
   * Detecta si la URL trae una vuelta de proveedor y, de ser así, la procesa con
   * `handleRedirect`. Los parámetros OAuth (`code`, `state`, `error`) viajan en
   * `location.search` porque el `redirectUri` configurado apunta a `app.html` sin hash; el
   * hash (`#/cuenta`) solo decide qué vista monta `app-shell`. Si no hay ni `code` ni `error`,
   * no es una vuelta y simplemente pintamos la pantalla por defecto.
   */
  async #maybeHandleRedirect() {
    const params = new URLSearchParams(location.search);
    const isRedirect = params.has('code') || params.has('error');
    if (!isRedirect) {
      this.#render();
      return;
    }

    const result = await handleRedirect(params);
    this.#cleanRedirectParams();

    // Cancelación en el Hosted UI: volver a signIn sin mensaje de error (req. 4.6).
    if (result.cancelled) {
      this.#view = 'signIn';
      this.#render();
      return;
    }
    // Fallo del canje o token no confiable: volver a signIn con un aviso seguro.
    if (result.error) {
      this.#view = 'signIn';
      this.#errorMessage = 'No pudimos completar el inicio de sesión. Inténtalo de nuevo.';
      this.#render();
      return;
    }
    // Sesión abierta: ir al Name_Prompt o a Tareas según la ruta derivada (req. 4.7).
    this.#applyRoute(result.route);
  }

  /** Quita los parámetros OAuth de la URL para que recargar no reintente el canje. */
  #cleanRedirectParams() {
    if (typeof history === 'undefined' || !history.replaceState) return;
    const clean = `${location.pathname}${location.hash}`;
    history.replaceState(null, '', clean);
  }

  // --- Reacción a cambios de sesión ---

  /** Cuando `auth.js` abre una sesión, enrutamos; cuando la cierra, volvemos a signIn. */
  #handleAuthEvent(e) {
    const session = e.detail?.session;
    if (!session) {
      this.#view = 'signIn';
      this.#render();
      return;
    }
    // Una sesión recién abierta en otra vista también nos lleva al destino correcto.
    if (this.#view !== 'namePrompt') this.#applyRoute(postSignInRoute(session));
  }

  /** Aplica la ruta post-login: `name-prompt` muestra el Name_Prompt; `tasks` sale a Tareas. */
  #applyRoute(route) {
    if (route === 'name-prompt') {
      this.#view = 'namePrompt';
      this.#render();
      return;
    }
    navigate('tasks');
  }

  // --- Pintado ---

  #render() {
    // El estado `disabled` cubre cualquier pantalla cuando no se puede autenticar (req. 10.2).
    const body = this.#available ? this.#viewBody() : this.#disabledBody();
    this.innerHTML = `
      <div class="scroll page absolute inset-0 pb-12">
        <header class="pad-top px-5">
          <h1 class="text-[34px] font-extrabold leading-tight tracking-tight">${esc(this.#title())}</h1>
          <p class="text-sm font-medium text-ink/60">${esc(this.#subtitle())}</p>
        </header>
        <div class="mx-5 mt-5">${body}</div>
      </div>`;
    this.#focusFirstField();
  }

  /** Enfoca el primer campo de la pantalla para que el teclado quede listo sin un toque extra. */
  #focusFirstField() {
    const first = this.querySelector('input');
    if (first) first.focus();
  }

  #title() {
    const titles = {
      signIn: 'Iniciar sesión',
      signUp: 'Crear cuenta',
      confirm: 'Confirma tu correo',
      namePrompt: '¿Cómo te llamas?',
    };
    return titles[this.#view] || 'Tu cuenta';
  }

  #subtitle() {
    const subtitles = {
      signIn: 'Guarda tu jardín en la nube.',
      signUp: 'Es opcional: puedes seguir sin cuenta.',
      confirm: `Enviamos un código a ${this.#email}.`,
      namePrompt: 'Así te saludaremos en tu jardín.',
    };
    return subtitles[this.#view] || '';
  }

  /** Despacha al cuerpo de la pantalla activa. */
  #viewBody() {
    if (this.#view === 'signUp') return this.#signUpBody();
    if (this.#view === 'confirm') return this.#confirmBody();
    if (this.#view === 'namePrompt') return this.#namePromptBody();
    return this.#signInBody();
  }

  // --- Piezas reutilizables ---

  /** Campo de texto con su `<label>` visible; el input mide 16 px para no disparar el zoom de iOS. */
  #field({ id, label, type, value = '', autocomplete = '', inputmode = '' }) {
    return `
      <label for="${id}" class="mb-1 block text-xs font-bold uppercase tracking-wide text-ink/50">${esc(label)}</label>
      <input id="${id}" name="${id}" type="${type}" value="${esc(value)}"
        ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}
        class="mb-3 min-h-11 w-full rounded-2xl border border-line bg-cream px-3.5 text-[16px] font-medium text-ink
          outline-none focus:border-moss" />`;
  }

  /** Botón primario (moss) con objetivo táctil de 44 px. */
  #primaryButton(label, act) {
    return `
      <button type="submit" data-act="${act}" ${this.#available ? '' : 'disabled'}
        class="press min-h-11 w-full rounded-2xl bg-moss py-3.5 font-extrabold text-paper disabled:opacity-50">
        ${esc(label)}</button>`;
  }

  /** Error general del paso, si lo hay, con `aria-live` para que los lectores lo anuncien. */
  #errorBlock() {
    if (!this.#errorMessage) return '';
    return `<p role="alert" aria-live="polite" class="mb-3 text-sm font-bold text-red-600">${esc(this.#errorMessage)}</p>`;
  }

  /** Lista de reglas de contraseña incumplidas antes de enviar el registro (req. 2.5). */
  #passwordRulesBlock() {
    if (!this.#passwordErrors.length) return '';
    const items = this.#passwordErrors.map((rule) => `<li>${esc(rule)}</li>`).join('');
    return `
      <ul role="alert" aria-live="polite" class="mb-3 list-disc space-y-0.5 pl-5 text-sm font-medium text-red-600">
        ${items}</ul>`;
  }

  /** Los cuatro botones de proveedor, cada uno con `aria-label` por ser de solo ícono + nombre. */
  #providersBlock() {
    const buttons = PROVIDERS.map((p) => `
      <button type="button" data-provider="${p.id}" aria-label="Continuar con ${esc(p.label)}" ${this.#available ? '' : 'disabled'}
        class="press flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-paper py-3 font-bold
          disabled:opacity-50">
        ${icon(p.icon, 'h-5 w-5')} ${esc(p.label)}</button>`).join('');
    const notice = this.#providerNotice
      ? `<p role="status" aria-live="polite" class="mt-2 text-sm font-medium text-ink/60">${esc(this.#providerNotice)}</p>`
      : '';
    return `
      <div class="mt-5">
        <p class="mb-2 text-center text-xs font-bold uppercase tracking-wide text-ink/50">O continúa con</p>
        <div class="grid grid-cols-2 gap-2">${buttons}</div>
        ${notice}
      </div>`;
  }

  // --- Cuerpos de cada pantalla ---

  #signInBody() {
    return `
      <form data-form="signIn" novalidate>
        ${this.#errorBlock()}
        ${this.#field({ id: 'email', label: 'Correo', type: 'email', autocomplete: 'email', inputmode: 'email' })}
        ${this.#field({ id: 'password', label: 'Contraseña', type: 'password', autocomplete: 'current-password' })}
        ${this.#primaryButton('Entrar', 'signIn')}
      </form>
      ${this.#providersBlock()}
      <div class="mt-6 grid gap-2 text-center">
        <button type="button" data-act="goSignUp" class="press min-h-11 text-sm font-bold text-moss">
          ¿No tienes cuenta? Crear una</button>
        <button type="button" data-act="guest" class="press min-h-11 text-sm font-bold text-ink/60">
          Volver sin cuenta</button>
      </div>`;
  }

  #signUpBody() {
    return `
      <form data-form="signUp" novalidate>
        ${this.#errorBlock()}
        ${this.#field({ id: 'email', label: 'Correo', type: 'email', autocomplete: 'email', inputmode: 'email' })}
        ${this.#field({ id: 'password', label: 'Contraseña', type: 'password', autocomplete: 'new-password' })}
        ${this.#passwordRulesBlock()}
        ${this.#primaryButton('Crear cuenta', 'signUp')}
      </form>
      <div class="mt-6 grid gap-2 text-center">
        <button type="button" data-act="goSignIn" class="press min-h-11 text-sm font-bold text-moss">
          ¿Ya tienes cuenta? Inicia sesión</button>
        <button type="button" data-act="guest" class="press min-h-11 text-sm font-bold text-ink/60">
          Volver sin cuenta</button>
      </div>`;
  }

  #confirmBody() {
    return `
      <form data-form="confirm" novalidate>
        ${this.#errorBlock()}
        ${this.#field({ id: 'code', label: 'Código de confirmación', type: 'text', autocomplete: 'one-time-code', inputmode: 'numeric' })}
        ${this.#primaryButton('Confirmar', 'confirm')}
      </form>
      <div class="mt-6 text-center">
        <button type="button" data-act="resend" class="press min-h-11 text-sm font-bold text-moss">
          Reenviar código</button>
      </div>`;
  }

  #namePromptBody() {
    // El Garden_Button solo aparece con texto escrito; se pinta según el valor actual del input.
    const name = this.querySelector('#displayName')?.value.trim() || '';
    const gardenButton = name
      ? `<button type="submit" data-act="saveName"
          class="press min-h-11 w-full rounded-2xl bg-moss py-3.5 font-extrabold text-paper">
          Ir a mi Garden 🌱</button>`
      : '';
    return `
      <form data-form="namePrompt" novalidate>
        ${this.#errorBlock()}
        ${this.#field({ id: 'displayName', label: 'Tu nombre', type: 'text', autocomplete: 'name' })}
        <div data-slot="gardenButton">${gardenButton}</div>
      </form>
      <div class="mt-6 text-center">
        <button type="button" data-act="skipName" class="press min-h-11 text-sm font-bold text-ink/60">
          Omitir por ahora</button>
      </div>`;
  }

  /** Estado deshabilitado cuando no se puede autenticar: aviso y controles inactivos (req. 10.2). */
  #disabledBody() {
    return `
      <div class="rounded-2xl border border-line bg-paper p-5 text-center">
        <p class="text-4xl">📡</p>
        <p class="mt-3 text-lg font-extrabold">Necesitas conexión para usar tu cuenta</p>
        <p class="mt-1 text-sm font-medium text-ink/60">En cuanto vuelva la red podrás iniciar sesión, sin recargar.</p>
        <button type="button" data-act="guest" class="press mt-5 min-h-11 w-full rounded-2xl border border-line bg-cream py-3 font-bold">
          Volver sin cuenta</button>
      </div>`;
  }

  // --- Manejadores de eventos ---

  #onInput(e) {
    // En el Name_Prompt, al escribir aparece o desaparece el Garden_Button sin repintar todo.
    if (this.#view === 'namePrompt' && e.target.id === 'displayName') this.#refreshGardenButton();
  }

  /** Repinta solo el contenedor del Garden_Button para no perder el foco del input. */
  #refreshGardenButton() {
    const slot = this.querySelector('[data-slot="gardenButton"]');
    if (!slot) return;
    const name = this.querySelector('#displayName')?.value.trim() || '';
    slot.innerHTML = name
      ? `<button type="submit" data-act="saveName"
          class="press min-h-11 w-full rounded-2xl bg-moss py-3.5 font-extrabold text-paper">
          Ir a mi Garden 🌱</button>`
      : '';
  }

  #onClick(e) {
    const providerButton = e.target.closest('[data-provider]');
    if (providerButton) {
      this.#startProvider(providerButton.dataset.provider);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'goSignUp') this.#goTo('signUp');
    if (act === 'goSignIn') this.#goTo('signIn');
    if (act === 'guest' || act === 'skipName') navigate('tasks');
    if (act === 'resend') this.#resend();
  }

  /** Cambia de pantalla limpiando errores del paso anterior para no arrastrarlos. */
  #goTo(view) {
    this.#view = view;
    this.#errorMessage = '';
    this.#passwordErrors = [];
    this.#providerNotice = '';
    this.#render();
  }

  #onSubmit(e) {
    e.preventDefault();
    const form = e.target.dataset.form;
    if (form === 'signIn') this.#submitSignIn();
    if (form === 'signUp') this.#submitSignUp();
    if (form === 'confirm') this.#submitConfirm();
    if (form === 'namePrompt') this.#submitName();
  }

  // --- Acciones contra el servicio Auth ---

  async #submitSignIn() {
    const email = this.querySelector('#email')?.value.trim() || '';
    const password = this.querySelector('#password')?.value || '';
    this.#errorMessage = '';
    try {
      const { route } = await signInWithPassword({ email, password });
      this.#email = email;
      this.#applyRoute(route);
    } catch (error) {
      // Cuenta sin confirmar: llevamos a confirmar con el código en vez de solo avisar (req. 3.4).
      if (error.action === 'resend-code') {
        this.#email = email;
        this.#goTo('confirm');
        this.#errorMessage = this.#messageFor(error);
        this.#render();
        return;
      }
      this.#errorMessage = this.#messageFor(error);
      this.#render();
    }
  }

  async #submitSignUp() {
    const email = this.querySelector('#email')?.value.trim() || '';
    const password = this.querySelector('#password')?.value || '';
    // Validación local de la política ANTES de llamar a Cognito (req. 2.5).
    const unmet = passwordUnmetRules(password, PASSWORD_POLICY);
    if (unmet.length) {
      this.#passwordErrors = unmet;
      this.#errorMessage = '';
      this.#render();
      return;
    }
    this.#passwordErrors = [];
    this.#errorMessage = '';
    try {
      await signUp({ email, password });
      this.#email = email;
      this.#goTo('confirm');
    } catch (error) {
      // Correo ya en uso: el mensaje ofrece iniciar sesión (req. 2.4).
      this.#errorMessage = this.#messageFor(error);
      this.#render();
    }
  }

  async #submitConfirm() {
    const code = this.querySelector('#code')?.value.trim() || '';
    this.#errorMessage = '';
    try {
      await confirmSignUp({ email: this.#email, code });
      // Confirmada la cuenta, pasamos a pedir la Display_Name (req. 2.3, 6.1).
      this.#goTo('namePrompt');
    } catch (error) {
      this.#errorMessage = this.#messageFor(error);
      this.#render();
    }
  }

  async #resend() {
    this.#errorMessage = '';
    try {
      await resendCode({ email: this.#email });
      toast('Te reenviamos el código 📩');
    } catch (error) {
      this.#errorMessage = this.#messageFor(error);
      this.#render();
    }
  }

  async #submitName() {
    const name = this.querySelector('#displayName')?.value.trim() || '';
    // Sin nombre no guardamos nada; salir sin nombre también lleva a Tareas (req. 6.4).
    if (!name) {
      navigate('tasks');
      return;
    }
    try {
      await saveDisplayName(name);
      navigate('tasks');
    } catch (error) {
      this.#errorMessage = this.#messageFor(error);
      this.#render();
    }
  }

  async #startProvider(provider) {
    this.#providerNotice = '';
    const result = await signInWithProvider(provider);
    // `signInWithProvider` navega cuando arranca; si no pudo, mostramos el aviso del método
    // sin tumbar los otros botones (req. 5.5).
    if (result && result.unavailable) {
      this.#providerNotice = UNAVAILABLE_MESSAGES[result.reason] || 'Ese método no está disponible ahora';
      this.#render();
    }
  }

  /** Traduce un error de Cognito a su mensaje seguro en español (req. 3.3). */
  #messageFor(error) {
    // `callCognito` ya adjunta `.message` mapeado; si faltara, caemos a `mapAuthError` por código.
    if (error && error.message) return error.message;
    return mapAuthError(error?.code).message;
  }
}

customElements.define('account-view', AccountView);
