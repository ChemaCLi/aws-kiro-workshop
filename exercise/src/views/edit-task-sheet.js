// Sheet "Editar tarea": permite cambiar título y nota de una tarea existente.
import { store } from '../core/store.js';
import { openSheet } from '../ui/sheet.js';
import { esc, toast } from '../ui/util.js';

export function openEditTask(task) {
  if (!task) return;
  openSheet({
    title: 'Editar tarea',
    render(body, close) {
      body.innerHTML = `
        <form class="space-y-5" autocomplete="off">
          <input name="title" maxlength="80" placeholder="¿Qué quieres lograr?" enterkeyhint="done"
            value="${esc(task.title)}"
            class="w-full rounded-2xl border border-line bg-cream px-4 py-3.5 font-medium outline-none focus:border-moss" />
          <div>
            <p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Nota</p>
            <textarea name="note" maxlength="500" rows="4" placeholder="Agrega detalles sobre la tarea..."
              class="w-full rounded-2xl border border-line bg-cream px-4 py-3.5 text-sm font-medium outline-none focus:border-moss">${esc(task.note ?? '')}</textarea>
          </div>
          <button type="submit" class="press w-full rounded-2xl bg-moss py-4 text-[17px] font-bold text-white">Guardar cambios</button>
        </form>`;

      const form = body.querySelector('form');
      const input = form.elements.title;
      const note = form.elements.note;
      const submit = form.querySelector('[type=submit]');

      input.addEventListener('input', () => { submit.disabled = !input.value.trim(); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const updated = store.updateTask(task.id, { title: input.value, note: note.value });
        if (!updated) return;
        close();
        toast('Tarea actualizada');
      });

      setTimeout(() => input.focus(), 320);
    },
  });
}
