// Señal de un solo uso entre la landing y la app: "la persona eligió entrar sin cuenta".
// La landing la marca justo antes de navegar a app.html; la primera pantalla de la app la
// consume una sola vez para mostrar el aviso de que puede crear una cuenta desde Ajustes.
// Usa sessionStorage porque es volátil y de esta pestaña, no estado de la cuenta ni de
// Local_Data (que siguen viviendo en la clave `jardin-movil:v1`).
const FLAG = 'focus-garden:guest-entry';

export function markGuestEntry() {
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* sin storage, sin aviso: no es crítico */ }
}

/** Devuelve true solo la primera vez que se llama tras marcar la entrada sin cuenta. */
export function consumeGuestEntry() {
  try {
    if (sessionStorage.getItem(FLAG) !== '1') return false;
    sessionStorage.removeItem(FLAG);
    return true;
  } catch {
    return false;
  }
}
