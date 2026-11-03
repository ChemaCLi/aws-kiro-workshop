// Sincronización EN VIVO del pomodoro entre dispositivos conectados a la vez, vía el WebSocket
// de live-sync-api/ (ver su README). Un dispositivo es "master" (el que manda el timer) y los
// demás son "slave" (lo reciben); nunca al revés, para no formar un bucle de actualizaciones.
// Aparte de cloud-sync.js: eso sincroniza tareas/rondas/ajustes con una latencia de segundos,
// esto sincroniza SOLO el timer, en vivo, mientras la app está abierta. Sin sesión no corre.
import { AUTH_CONFIG } from './auth-config.js';
import { getDeviceId } from './device-id.js';
import { store } from './store.js';
import { toast } from '../ui/util.js';

const PING_MS = 5 * 60 * 1000; // bien por debajo del timeout de inactividad de API Gateway (10 min)
const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 30000;

let activeSession = null;
let socket = null;
let role = null; // 'master' | 'slave' | null (aún sin confirmar tras conectar)
let unsubscribeStore = null;
let pingTimer = null;
let reconnectTimer = null;
let reconnectDelay = RECONNECT_MIN_MS;
let lastSentTimer = null; // JSON del último timer que este dispositivo mandó como master

function socketUrl(session) {
  const params = new URLSearchParams({ token: session.accessToken, deviceId: getDeviceId() });
  return `${AUTH_CONFIG.liveSyncEndpoint}?${params.toString()}`;
}

function send(action, payload = {}) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ action, ...payload }));
}

/** Manda el timer actual si este dispositivo es master y cambió desde el último envío. */
function broadcastIfChanged() {
  if (role !== 'master') return;
  const current = JSON.stringify(store.state.timer);
  if (current === lastSentTimer) return;
  lastSentTimer = current;
  send('state-update', { timer: store.state.timer });
}

/** Al volverse master (al conectar o al ganar un claim-master), empieza a transmitir cambios. */
function becomeMaster() {
  role = 'master';
  lastSentTimer = null; // fuerza a mandar el estado actual en el próximo change, aunque no cambie
  unsubscribeStore?.();
  unsubscribeStore = store.subscribe(broadcastIfChanged);
}

function becomeSlave() {
  role = 'slave';
  unsubscribeStore?.();
  unsubscribeStore = null;
}

/** Aviso de que el master se desconectó, con la opción de tomar el control desde este dispositivo. */
function offerResume() {
  toast('Tenías una sesión activa, ¿la quieres reanudar?', {
    action: { label: 'Reanudar', run: () => send('claim-master') },
    duration: 8000,
  });
}

function onMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return; // mensaje que no es JSON: se ignora, no rompe la conexión
  }
  switch (message.type) {
    case 'init':
      if (message.role === 'master') becomeMaster();
      else {
        becomeSlave();
        if (message.timer) store.applyRemoteTimer(message.timer);
      }
      break;
    case 'state-update':
      if (role !== 'master') store.applyRemoteTimer(message.timer);
      break;
    case 'master-disconnected':
      if (role !== 'master') offerResume();
      break;
    case 'claim-master-result':
      if (message.success) becomeMaster();
      break;
    default:
      break; // 'session-list' y cualquier otro: sin UI todavía (ver el plan de Mis sesiones)
  }
}

function scheduleReconnect() {
  if (!activeSession) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => connect(activeSession), reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
}

function connect(session) {
  if (!activeSession || activeSession !== session) return;
  clearTimeout(reconnectTimer);
  try {
    socket = new WebSocket(socketUrl(session));
  } catch {
    scheduleReconnect();
    return;
  }

  socket.addEventListener('open', () => {
    reconnectDelay = RECONNECT_MIN_MS;
    clearTimeout(pingTimer);
    pingTimer = setInterval(() => send('ping'), PING_MS);
  });
  socket.addEventListener('message', onMessage);
  socket.addEventListener('close', () => {
    clearInterval(pingTimer);
    becomeSlave(); // sin conexión, este dispositivo no puede ser la fuente de verdad
    role = null;
    scheduleReconnect();
  });
  socket.addEventListener('error', () => socket?.close());
}

/**
 * Arranca la sincronización en vivo para una Session: abre el WebSocket (reconectando con
 * backoff ante cualquier corte: inactividad, el máximo de 2 h de API Gateway, o red) y aplica
 * los timers que lleguen mientras este dispositivo sea slave.
 *
 * @param {{ accessToken: string, sub: string } | null} session
 */
export function startLiveSync(session) {
  stopLiveSync();
  if (!session?.sub) return;
  activeSession = session;
  reconnectDelay = RECONNECT_MIN_MS;
  connect(session);
}

/** Detiene la sincronización en vivo (cierre de sesión). No toca localStorage. */
export function stopLiveSync() {
  activeSession = null;
  role = null;
  lastSentTimer = null;
  clearTimeout(reconnectTimer);
  clearInterval(pingTimer);
  unsubscribeStore?.();
  unsubscribeStore = null;
  socket?.close();
  socket = null;
}
