import { For, Show } from 'solid-js';
import { answerQuestion, question } from './confirm';
import { showModalWhile } from './modal';

/** The open question, in a modal dialog of the page: Esc or Cancel cancels, Enter picks the default action. */
export function ConfirmDialog() {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, () => question() !== undefined);
  return (
    <dialog ref={dialog} class="dialog" aria-label="Confirm" onClose={() => answerQuestion()}>
      <Show when={question()}>
        {(open) => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              answerQuestion(open().actions.at(-1));
            }}
          >
            <p>{open().message}</p>
            <div class="row end">
              <button type="button" onClick={() => answerQuestion()}>
                Cancel
              </button>
              <For each={open().actions.slice(0, -1)}>
                {(action) => (
                  <button type="button" onClick={() => answerQuestion(action)}>
                    {action}
                  </button>
                )}
              </For>
              <button type="submit" class="primary" autofocus>
                {open().actions.at(-1)}
              </button>
            </div>
          </form>
        )}
      </Show>
    </dialog>
  );
}
