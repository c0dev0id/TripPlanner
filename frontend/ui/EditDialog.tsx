import { For, Show, type JSX } from 'solid-js';
import { showModalWhile } from './modal';

/** What a dialog can do with its element besides saving it, such as deleting it. */
export type DialogAction = { label: string; run: () => void; danger?: boolean };

/**
 * The one shape of the dialogs that edit an element: a title, its fields in a form,
 * Cancel and Save, and the element's other actions at the other end. The fields are
 * built afresh each time it opens, so they show the element as it is then.
 */
export function EditDialog(props: { label: string; title: string; open: boolean; onClose: () => void; onSubmit: (form: FormData) => void; submit?: string; actions?: DialogAction[]; children: JSX.Element }) {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, () => props.open);
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    props.onSubmit(new FormData(e.currentTarget as HTMLFormElement));
  };
  return (
    <dialog ref={dialog} class="dialog" aria-label={props.label} onClose={props.onClose}>
      <Show when={props.open}>
        <form onSubmit={submit}>
          <h3 class="name" title={props.title}>
            {props.title}
          </h3>
          {props.children}
          <div class="row end">
            <For each={props.actions}>
              {(action) => (
                <button type="button" classList={{ danger: action.danger }} onClick={action.run}>
                  {action.label}
                </button>
              )}
            </For>
            <span class="grow" />
            <button type="button" onClick={props.onClose}>
              Cancel
            </button>
            <button type="submit" class="primary">
              {props.submit ?? 'Save'}
            </button>
          </div>
        </form>
      </Show>
    </dialog>
  );
}

/** The trimmed text of a form field. */
export const field = (form: FormData, name: string): string => String(form.get(name) ?? '').trim();
