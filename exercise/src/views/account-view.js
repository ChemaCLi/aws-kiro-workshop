// Vista "Cuenta": la Auth_Page en la ruta hash #/cuenta. Alberga el registro, el inicio con
// correo y contraseña, los cuatro proveedores sociales, la confirmación de código y el
// Name_Prompt. No depende del store; se suscribe a `app:auth` para reaccionar a cambios de
// sesión sin acoplarse a otra vista.
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
// Vacío a propósito: Google, Meta, Amazon y GitHub quedaron en pausa (ver
// `exercise/docs/decisions/0002-pausar-proveedores-sociales.md`) mientras se avanza con
// guardado en la nube y sincronización multidispositivo. Solo correo y contraseña por ahora;
// basta con devolver esta lista a sus cuatro proveedores para retomarlos.
const PROVIDERS = [];

// Avisos de "no disponible" por motivo que devuelve `signInWithProvider`, para explicar por
// qué un método quedó inactivo sin romper los demás (req. 5.5, 10).
const UNAVAILABLE_MESSAGES = {
  offline: 'Necesitas conexión para usar tu cuenta',
  'no-webcrypto': 'Este método necesita una conexión segura (https)',
  'github-bridge': 'El inicio con GitHub no está disponible ahora',
};

export function mountAccountView(root) {
  // Estado interno de la máquina de pantallas.
  let view = 'signIn';
  // Datos que persisten entre pantallas: el correo del registro llega a la confirmación.
  let email = '';
  // Reglas de contraseña incumplidas a mostrar bajo el formulario de registro (req. 2.5).
  let passwordErrors = [];
  // Mensaje de error general del paso actual (credenciales, código, red...).
  let errorMessage = '';
  // Aviso por proveedor cuando `signInWithProvider` devuelve `{ unavailable }`.
  let providerNotice = '';
  // Si el Account_SDK puede autenticar ahora mismo; alterna el estado `disabled` (req. 10).
  let available = isAuthAvailable();
  let unsubscribeAvailability = null;

  // --- Pintado ---

  function title() {
    const titles = {
      signIn: 'Iniciar sesión',
      signUp: 'Crear cuenta',
      confirm: 'Confirma tu correo',
      namePrompt: '¿Cómo te llamas?',
    };
    return titles[view] || 'Tu cuenta';
  }

  function subtitle() {
    const subtitles = {
      signIn: 'Guarda tu jardín en la nube.',
      signUp: 'Es opcional: puedes seguir sin cuenta.',
      confirm: `Enviamos un código a ${email}.`,
      namePrompt: 'Así te saludaremos en tu jardín.',
    };
    return subtitles[view] || '';
  }

  /** Despacha al cuerpo de la pantalla activa. */
  function viewBody() {
    if (view === 'signUp') return signUpBody();
    if (view === 'confirm') return confirmBody();
    if (view === 'namePrompt') return namePromptBody();
    return signInBody();
  }

  // --- Piezas reutilizables ---

  /** Campo de texto con su `<label>` visible; el input mide 16 px para no disparar el zoom de iOS. */
  function field({ id, label, type, value = '', autocomplete = '', inputmode = '' }) {
    return `
      <label for="${id}" class="mb-1 block text-xs font-bold uppercase tracking-wide text-ink/50">${esc(label)}</label>
      <input id="${id}" name="${id}" type="${type}" value="${esc(value)}"
        ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}
        class="mb-3 min-h-11 w-full rounded-2xl border border-line bg-cream px-3.5 text-[16px] font-medium text-ink
          outline-none focus:border-moss" />`;
  }

  /** Botón primario (moss) con objetivo táctil de 44 px. */
  function primaryButton(label, act) {
    return `
      <button type="submit" data-act="${act}" ${available ? '' : 'disabled'}
        class="press min-h-11 w-full rounded-2xl bg-moss py-3.5 font-extrabold text-paper disabled:opacity-50">
        ${esc(label)}</button>`;
  }

  /** Error general del paso, si lo hay, con `aria-live` para que los lectores lo anuncien. */
  function errorBlock() {
    if (!errorMessage) return '';
    return `<p role="alert" aria-live="polite" class="mb-3 text-sm font-bold text-red-600">${esc(errorMessage)}</p>`;
  }

  /** Lista de reglas de contraseña incumplidas antes de enviar el registro (req. 2.5). */
  function passwordRulesBlock() {
    if (!passwordErrors.length) return '';
    const items = passwordErrors.map((rule) => `<li>${esc(rule)}</li>`).join('');
    return `
      <ul role="alert" aria-live="polite" class="mb-3 list-disc space-y-0.5 pl-5 text-sm font-medium text-red-600">
        ${items}</ul>`;
  }

  /** Los botones de proveedor, cada uno con `aria-label` por ser de solo ícono + nombre. */
  function providersBlock() {
    if (!PROVIDERS.length) return ''; // en pausa: ver el comentario junto a PROVIDERS arriba
    const buttons = PROVIDERS.map((p) => `
      <button type="button" data-provider="${p.id}" aria-label="Continuar con ${esc(p.label)}" ${available ? '' : 'disabled'}
        class="press flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-paper py-3 font-bold
          disabled:opacity-50">
        ${icon(p.icon, 'h-5 w-5')} ${esc(p.label)}</button>`).join('');
    const notice = providerNotice
      ? `<p role="status" aria-live="polite" class="mt-2 text-sm font-medium text-ink/60">${esc(providerNotice)}</p>`
      : '';
    return `
      <div class="mt-5">
        <p class="mb-2 text-center text-xs font-bold uppercase tracking-wide text-ink/50">O continúa con</p>
        <div class="grid grid-cols-2 gap-2">${buttons}</div>
        ${notice}
      </div>`;
  }

  // --- Cuerpos de cada pantalla ---

  function signInBody() {
    return `
      <form data-form="signIn" novalidate>
        ${errorBlock()}
        ${field({ id: 'email', label: 'Correo', type: 'email', autocomplete: 'email', inputmode: 'email' })}
        ${field({ id: 'password', label: 'Contraseña', type: 'password', autocomplete: 'current-password' })}
        ${primaryButton('Entrar', 'signIn')}
      </form>
      ${providersBlock()}
      <div class="mt-6 grid gap-2 text-center">
        <button type="button" data-act="goSignUp" class="press min-h-11 text-sm font-bold text-moss">
          ¿No tienes cuenta? Crear una</button>
        <button type="button" data-act="guest" class="press min-h-11 text-sm font-bold text-ink/60">
          Volver sin cuenta</button>
      </div>`;
  }

  function signUpBody() {
    return `
      <form data-form="signUp" novalidate>
        ${errorBlock()}
        ${field({ id: 'email', label: 'Correo', type: 'email', autocomplete: 'email', inputmode: 'email' })}
        ${field({ id: 'password', label: 'Contraseña', type: 'password', autocomplete: 'new-password' })}
        ${passwordRulesBlock()}
        ${primaryButton('Crear cuenta', 'signUp')}
      </form>
      <div class="mt-6 grid gap-2 text-center">
        <button type="button" data-act="goSignIn" class="press min-h-11 text-sm font-bold text-moss">
          ¿Ya tienes cuenta? Inicia sesión</button>
        <button type="button" data-act="guest" class="press min-h-11 text-sm font-bold text-ink/60">
          Volver sin cuenta</button>
      </div>`;
  }

  function confirmBody() {
    return `
      <form data-form="confirm" novalidate>
        ${errorBlock()}
        ${field({ id: 'code', label: 'Código de confirmación', type: 'text', autocomplete: 'one-time-code', inputmode: 'numeric' })}
        ${primaryButton('Confirmar', 'confirm')}
      </form>
      <div class="mt-6 text-center">
        <button type="button" data-act="resend" class="press min-h-11 text-sm font-bold text-moss">
          Reenviar código</button>
      </div>`;
  }

  function namePromptBody() {
    // El Garden_Button solo aparece con texto escrito; se pinta según el valor actual del input.
    const name = root.querySelector('#displayName')?.value.trim() || '';
    const gardenButton = name
      ? `<button type="submit" data-act="saveName"
          class="press min-h-11 w-full rounded-2xl bg-moss py-3.5 font-extrabold text-paper">
          Ir a mi Garden 🌱</button>`
      : '';
    return `
      <form data-form="namePrompt" novalidate>
        ${errorBlock()}
        ${field({ id: 'displayName', label: 'Tu nombre', type: 'text', autocomplete: 'name' })}
        <div data-slot="gardenButton">${gardenButton}</div>
      </form>
      <div class="mt-6 text-center">
        <button type="button" data-act="skipName" class="press min-h-11 text-sm font-bold text-ink/60">
          Omitir por ahora</button>
      </div>`;
  }

  /** Estado deshabilitado cuando no se puede autenticar: aviso y controles inactivos (req. 10.2). */
  function disabledBody() {
    return `
      <div class="rounded-2xl border border-line bg-paper p-5 text-center">
        <p class="text-4xl">📡</p>
        <p class="mt-3 text-lg font-extrabold">Necesitas conexión para usar tu cuenta</p>
        <p class="mt-1 text-sm font-medium text-ink/60">En cuanto vuelva la red podrás iniciar sesión, sin recargar.</p>
        <button type="button" data-act="guest" class="press mt-5 min-h-11 w-full rounded-2xl border border-line bg-cream py-3 font-bold">
          Volver sin cuenta</button>
      </div>`;
  }

  function render() {
    // El estado `disabled` cubre cualquier pantalla cuando no se puede autenticar (req. 10.2).
    const body = available ? viewBody() : disabledBody();
    root.innerHTML = `
      <div class="scroll page absolute inset-0 pb-12">
        <header class="pad-top px-5">
          <h1 class="text-[34px] font-extrabold leading-tight tracking-tight">${esc(title())}</h1>
          <p class="text-sm font-medium text-ink/60">${esc(subtitle())}</p>
        </header>
        <div class="mx-5 mt-5">${body}</div>
      </div>`;
    focusFirstField();
  }

  /** Enfoca el primer campo de la pantalla para que el teclado quede listo sin un toque extra. */
  function focusFirstField() {
    const first = root.querySelector('input');
    if (first) first.focus();
  }

  /** Cambia de pantalla limpiando errores del paso anterior para no arrastrarlos. */
  function goTo(newView) {
    view = newView;
    errorMessage = '';
    passwordErrors = [];
    providerNotice = '';
    render();
  }

  /** Aplica la ruta post-login: `name-prompt` muestra el Name_Prompt; `tasks` sale a Tareas. */
  function applyRoute(route) {
    if (route === 'name-prompt') {
      view = 'namePrompt';
      render();
      return;
    }
    navigate('tasks');
  }

  // --- Vuelta del redirect OAuth ---

  /** Quita los parámetros OAuth de la URL para que recargar no reintente el canje. */
  function cleanRedirectParams() {
    if (typeof history === 'undefined' || !history.replaceState) return;
    const clean = `${location.pathname}${location.hash}`;
    history.replaceState(null, '', clean);
  }

  /**
   * Detecta si la URL trae una vuelta de proveedor y, de ser así, la procesa con
   * `handleRedirect`. Los parámetros OAuth (`code`, `state`, `error`) viajan en
   * `location.search` porque el `redirectUri` configurado apunta a `app.html` sin hash; el
   * hash (`#/cuenta`) solo decide qué vista muestra el shell. Si no hay ni `code` ni `error`,
   * no es una vuelta y simplemente pintamos la pantalla por defecto. Se llama una sola vez,
   * al montar la vista (igual que antes al conectar el Web Component), así que procesa el
   * redirect sin importar qué pestaña esté activa al recargar.
   */
  async function maybeHandleRedirect() {
    const params = new URLSearchParams(location.search);
    const isRedirect = params.has('code') || params.has('error');
    if (!isRedirect) {
      render();
      return;
    }

    const result = await handleRedirect(params);
    cleanRedirectParams();

    // Cancelación en el Hosted UI: volver a signIn sin mensaje de error (req. 4.6).
    if (result.cancelled) {
      view = 'signIn';
      render();
      return;
    }
    // Fallo del canje o token no confiable: volver a signIn con un aviso seguro.
    if (result.error) {
      view = 'signIn';
      errorMessage = 'No pudimos completar el inicio de sesión. Inténtalo de nuevo.';
      render();
      return;
    }
    // Sesión abierta: ir al Name_Prompt o a Tareas según la ruta derivada (req. 4.7).
    applyRoute(result.route);
  }

  // --- Reacción a cambios de sesión ---

  /** Cuando `auth.js` abre una sesión, enrutamos; cuando la cierra, volvemos a signIn. */
  function handleAuthEvent(e) {
    const session = e.detail?.session;
    if (!session) {
      view = 'signIn';
      render();
      return;
    }
    // Una sesión recién abierta en otra vista también nos lleva al destino correcto.
    if (view !== 'namePrompt') applyRoute(postSignInRoute(session));
  }

  // --- Manejadores de eventos ---

  /** Repinta solo el contenedor del Garden_Button para no perder el foco del input. */
  function refreshGardenButton() {
    const slot = root.querySelector('[data-slot="gardenButton"]');
    if (!slot) return;
    const name = root.querySelector('#displayName')?.value.trim() || '';
    slot.innerHTML = name
      ? `<button type="submit" data-act="saveName"
          class="press min-h-11 w-full rounded-2xl bg-moss py-3.5 font-extrabold text-paper">
          Ir a mi Garden 🌱</button>`
      : '';
  }

  function onInput(e) {
    // En el Name_Prompt, al escribir aparece o desaparece el Garden_Button sin repintar todo.
    if (view === 'namePrompt' && e.target.id === 'displayName') refreshGardenButton();
  }

  function onClick(e) {
    const providerButton = e.target.closest('[data-provider]');
    if (providerButton) {
      startProvider(providerButton.dataset.provider);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'goSignUp') goTo('signUp');
    if (act === 'goSignIn') goTo('signIn');
    if (act === 'guest' || act === 'skipName') navigate('tasks');
    if (act === 'resend') resend();
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = e.target.dataset.form;
    if (form === 'signIn') submitSignIn();
    if (form === 'signUp') submitSignUp();
    if (form === 'confirm') submitConfirm();
    if (form === 'namePrompt') submitName();
  }

  /** Traduce un error de Cognito a su mensaje seguro en español (req. 3.3). */
  function messageFor(error) {
    // `callCognito` ya adjunta `.message` mapeado; si faltara, caemos a `mapAuthError` por código.
    if (error && error.message) return error.message;
    return mapAuthError(error?.code).message;
  }

  // --- Acciones contra el servicio Auth ---

  async function submitSignIn() {
    const emailValue = root.querySelector('#email')?.value.trim() || '';
    const password = root.querySelector('#password')?.value || '';
    errorMessage = '';
    try {
      const { route } = await signInWithPassword({ email: emailValue, password });
      email = emailValue;
      applyRoute(route);
    } catch (error) {
      // Cuenta sin confirmar: llevamos a confirmar con el código en vez de solo avisar (req. 3.4).
      if (error.action === 'resend-code') {
        email = emailValue;
        goTo('confirm');
        errorMessage = messageFor(error);
        render();
        return;
      }
      errorMessage = messageFor(error);
      render();
    }
  }

  async function submitSignUp() {
    const emailValue = root.querySelector('#email')?.value.trim() || '';
    const password = root.querySelector('#password')?.value || '';
    // Validación local de la política ANTES de llamar a Cognito (req. 2.5).
    const unmet = passwordUnmetRules(password, PASSWORD_POLICY);
    if (unmet.length) {
      passwordErrors = unmet;
      errorMessage = '';
      render();
      return;
    }
    passwordErrors = [];
    errorMessage = '';
    try {
      await signUp({ email: emailValue, password });
      email = emailValue;
      goTo('confirm');
    } catch (error) {
      // Correo ya en uso: el mensaje ofrece iniciar sesión (req. 2.4).
      errorMessage = messageFor(error);
      render();
    }
  }

  async function submitConfirm() {
    const code = root.querySelector('#code')?.value.trim() || '';
    errorMessage = '';
    try {
      await confirmSignUp({ email, code });
      // Confirmada la cuenta, pasamos a pedir la Display_Name (req. 2.3, 6.1).
      goTo('namePrompt');
    } catch (error) {
      errorMessage = messageFor(error);
      render();
    }
  }

  async function resend() {
    errorMessage = '';
    try {
      await resendCode({ email });
      toast('Te reenviamos el código 📩');
    } catch (error) {
      errorMessage = messageFor(error);
      render();
    }
  }

  async function submitName() {
    const name = root.querySelector('#displayName')?.value.trim() || '';
    // Sin nombre no guardamos nada; salir sin nombre también lleva a Tareas (req. 6.4).
    if (!name) {
      navigate('tasks');
      return;
    }
    try {
      await saveDisplayName(name);
      navigate('tasks');
    } catch (error) {
      errorMessage = messageFor(error);
      render();
    }
  }

  async function startProvider(provider) {
    providerNotice = '';
    const result = await signInWithProvider(provider);
    // `signInWithProvider` navega cuando arranca; si no pudo, mostramos el aviso del método
    // sin tumbar los otros botones (req. 5.5).
    if (result && result.unavailable) {
      providerNotice = UNAVAILABLE_MESSAGES[result.reason] || 'Ese método no está disponible ahora';
      render();
    }
  }

  function onAuth(e) { handleAuthEvent(e); }

  function setup(root) {
    document.addEventListener('app:auth', onAuth);
    // Rehabilita (o deshabilita) la Auth_Page sin recargar cuando cambia la red (req. 10.4).
    unsubscribeAvailability = onAvailabilityChange((isAvailable) => {
      available = isAvailable;
      render();
    });
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('input', onInput);
    // Al montarse, puede ser la vuelta de un redirect social: lo procesamos antes de pintar.
    maybeHandleRedirect();
  }

  function teardown() {
    document.removeEventListener('app:auth', onAuth);
    unsubscribeAvailability?.();
  }

  // No usa mountView: esta vista no depende del store, así que se monta sin suscripción.
  setup(root);
  return teardown;
}
