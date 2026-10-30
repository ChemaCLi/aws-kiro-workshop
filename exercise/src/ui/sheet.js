// Bottom sheets: se abren desde abajo, se cierran con backdrop, Escape o arrastrando hacia abajo.
import { esc } from './util.js';

export function openSheet({ title, render, onClose }) {
  const root = document.createElement('div');
  root.className = 'sheet-root';
  root.innerHTML = `
    <div class="sheet-backdrop"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-handle" data-grab><span></span></div>
      <h2 class="pb-4 text-[22px] font-extrabold tracking-tight">${esc(title)}</h2>
      <div data-body></div>
    </section>`;
  document.getElementById('sheet-host').append(root);

  const sheet = root.querySelector('.sheet');
  const backdrop = root.querySelector('.sheet-backdrop');
  let closed = false;

  const close = (result) => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    sheet.style.animation = 'none';
    sheet.style.transition = 'transform .22s ease';
    backdrop.style.opacity = '0';
    requestAnimationFrame(() => { sheet.style.transform = 'translateY(110%)'; });
    setTimeout(() => root.remove(), 240);
    onClose?.(result);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', () => close());

  // Arrastrar el asa hacia abajo para cerrar
  const grab = root.querySelector('[data-grab]');
  let startY = null;
  grab.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    grab.setPointerCapture(e.pointerId);
    sheet.style.animation = 'none';
    sheet.style.transition = 'none';
  });
  grab.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    sheet.style.transform = `translateY(${Math.max(0, e.clientY - startY)}px)`;
  });
  const release = (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (dy > 110) close();
    else { sheet.style.transition = 'transform .2s ease'; sheet.style.transform = ''; }
  };
  grab.addEventListener('pointerup', release);
  grab.addEventListener('pointercancel', release);

  render(root.querySelector('[data-body]'), close);
  return close;
}

export function confirmSheet({ title, message, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    openSheet({
      title,
      onClose: () => resolve(answer),
      render(body, close) {
        body.innerHTML = `
          <p class="text-[15px] leading-relaxed text-ink/70">${esc(message)}</p>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button data-no class="press rounded-2xl border border-line bg-cream py-3.5 font-semibold">Cancelar</button>
            <button data-yes class="press rounded-2xl py-3.5 font-semibold text-white ${danger ? 'bg-red-600' : 'bg-moss'}">${esc(confirmLabel)}</button>
          </div>`;
        body.querySelector('[data-no]').onclick = () => close();
        body.querySelector('[data-yes]').onclick = () => { answer = true; close(); };
      },
    });
  });
}
