import { For, Show } from 'solid-js';

/** What something that takes a while says of itself: how far it is or what came of it, and under that, each on a line, what it could not do. */
export function Said(props: { note: { text: string; errors: readonly string[] } }) {
  return (
    <>
      <Show when={props.note.text}>
        <p class="muted hint">{props.note.text}</p>
      </Show>
      <For each={props.note.errors}>{(error) => <p class="error">{error}</p>}</For>
    </>
  );
}
