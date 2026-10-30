// Sheet "Nueva tarea": título + tipo.
import { store } from '../core/store.js';
import { TASK_TYPES } from '../core/rules.js';
import { haptic } from '../core/feedback.js';
import { openSheet } from '../ui/sheet.js';
import { esc, toast } from '../ui/util.js';

let lastType = TASK_TYPES[0].id;

export function openAddTask() {
  openSheet({
    title: 'Nueva tarea',
    render(body, close) {
      const chips = TASK_TYPES.map((t) => `
        <button type="button" role="radio" data-type="${t.id}" data-on="${t.id === lastType}" aria-checked="${t.id === lastType}"
          class="chip rounded-full px-3.5 py-2 text-sm font-bold" style="--c:${t.color}">${t.emoji} ${esc(t.label)}</button>`).join('');

      body.innerHTML = `
        <form class="space-y-5" autocomplete="off">
          <input name="title" maxlength="80" placeholder="¿Qué quieres lograr?" enterkeyhint="done"
            class="w-full rounded-2xl border border-line bg-cream px-4 py-3.5 font-medium outline-none focus:border-moss" />
          <div>
            <p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Tipo</p>
            <div class="flex flex-wrap gap-2" role="radiogroup">${chips}</div>
          </div>
          <button type="submit" disabled class="press w-full rounded-2xl bg-moss py-4 text-[17px] font-bold text-white">Agregar tarea</button>
        </form>`;

      const form = body.querySelector('form');
      const input = form.elements.title;
      const submit = form.querySelector('[type=submit]');

      input.addEventListener('input', () => { submit.disabled = !input.value.trim(); });
      form.querySelector('[role=radiogroup]').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-type]');
        if (!chip) return;
        lastType = chip.dataset.type;
        haptic(8);
        for (const c of form.querySelectorAll('[data-type]')) {
          const on = c === chip;
          c.dataset.on = String(on);
          c.setAttribute('aria-checked', String(on));
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const task = store.addTask({ title: input.value, type: lastType });
        if (!task) return;
        haptic(15);
        close();
        toast('Tarea agregada ✨');
      });

      setTimeout(() => input.focus(), 320);
    },
  });
}
