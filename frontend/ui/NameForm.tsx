import { createSignal } from 'solid-js';

/**
 * A name and a button that submits it; the field is cleared when `onSubmit` has run.
 * With `onCancel` a Cancel button stands beside it.
 */
export function NameForm(props: { placeholder: string; button: string; primary?: boolean; disabled?: boolean; onSubmit: (name: string) => Promise<void>; onCancel?: () => void }) {
  const [name, setName] = createSignal('');
  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) return;
    await props.onSubmit(trimmed);
    setName('');
  };
  return (
    <form class="row" onSubmit={(e) => void submit(e)}>
      <input class="grow" placeholder={props.placeholder} value={name()} onInput={(e) => setName(e.currentTarget.value)} aria-label={props.placeholder} maxlength={200} />
      <button type="submit" classList={{ primary: props.primary }} disabled={!name().trim() || props.disabled}>
        {props.button}
      </button>
      {props.onCancel && (
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
