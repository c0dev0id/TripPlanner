import { batch, createMemo, For, Show, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { showModalWhile } from './modal';

/** What a dialog can do with its element besides saving it, such as deleting it. */
export type DialogAction = { label: string; run: () => void; danger?: boolean };

/**
 * The one shape of the dialogs that edit an element: its title, its fields in a form, Cancel
 * and Save, and its other actions at the other end. It is open while there is a value, builds
 * the fields from the value as it is then, and closes once the form is submitted. It renders
 * outside the panel, so the panel's styles do not reach it.
 */
export function EditDialog<T>(props: {
  label: string;
  value: T | undefined;
  title: (item: T) => string;
  onClose: () => void;
  onSubmit: (form: FormData, item: T) => void;
  submit?: string;
  actions?: (item: T) => DialogAction[];
  children: (item: T) => JSX.Element;
}) {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, () => props.value !== undefined);
  const submit = (e: SubmitEvent, item: T) => {
    e.preventDefault();
    batch(() => {
      props.onSubmit(new FormData(e.currentTarget as HTMLFormElement), item);
      props.onClose();
    });
  };
  return (
    <Portal>
      <dialog ref={dialog} class="dialog" aria-label={props.label} onClose={props.onClose}>
        <Show when={props.value} keyed>
          {(item) => {
            const title = createMemo(() => props.title(item));
            return (
              <form onSubmit={(e) => submit(e, item)}>
                <h3 class="name" title={title()}>
                  {title()}
                </h3>
                {props.children(item)}
                <div class="row end">
                  <For each={props.actions?.(item)}>
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
            );
          }}
        </Show>
      </dialog>
    </Portal>
  );
}
