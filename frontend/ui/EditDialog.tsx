import { Show, type JSX } from 'solid-js';
import { showModalWhile } from './modal';

/**
 * The one shape of the dialogs that edit an element: a title, its fields in a form,
 * Cancel and Save, and where the element can go, a Delete at the other end. The fields
 * are built afresh each time it opens, so they show the element as it is then.
 */
export function EditDialog(props: {
  label: string;
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
  submit?: string;
  danger?: { label: string; run: () => void };
  children: JSX.Element;
}) {
  let dialog!: HTMLDialogElement;
  showModalWhile(
    () => dialog,
    () => props.open,
  );
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
            <Show when={props.danger}>
              {(danger) => (
                <button type="button" class="danger" onClick={() => danger().run()}>
                  {danger().label}
                </button>
              )}
            </Show>
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
