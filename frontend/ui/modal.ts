import { createEffect } from 'solid-js';

/** Keeps a dialog shown as a modal exactly while `open` holds. */
export function showModalWhile(dialog: () => HTMLDialogElement, open: () => boolean): void {
  createEffect(() => {
    const element = dialog();
    if (open() && !element.open) element.showModal();
    else if (!open() && element.open) element.close();
  });
}
