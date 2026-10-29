import { createEffect } from 'solid-js';

/** Keeps a dialog shown, not modal, exactly while `open` holds: the page behind it stays usable. */
export function showWhile(dialog: () => HTMLDialogElement, open: () => boolean): void {
  createEffect(() => {
    const element = dialog();
    if (open() && !element.open) element.show();
    else if (!open() && element.open) element.close();
  });
}

/** Keeps a dialog shown as a modal exactly while `open` holds. */
export function showModalWhile(dialog: () => HTMLDialogElement, open: () => boolean): void {
  createEffect(() => {
    const element = dialog();
    if (open() && !element.open) element.showModal();
    else if (!open() && element.open) element.close();
  });
}
