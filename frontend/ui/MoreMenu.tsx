import { For, onCleanup } from 'solid-js';
import { DotsIcon } from './icons';

export interface MoreItem {
  label: string;
  run: () => void;
  disabled?: boolean;
}

/** A row's further actions behind a dots button: a list that opens below it and closes on a choice or a click elsewhere. */
export function MoreMenu(props: { label: string; items: MoreItem[] }) {
  let details!: HTMLDetailsElement;
  const close = (e: Event) => {
    if (details.open && !details.contains(e.target as Node)) details.open = false;
  };
  document.addEventListener('pointerdown', close, true);
  onCleanup(() => document.removeEventListener('pointerdown', close, true));
  return (
    <details class="more" ref={details}>
      <summary class="icon" title={props.label} aria-label={props.label}>
        <DotsIcon />
      </summary>
      <ul>
        <For each={props.items}>
          {(item) => (
            <li>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  details.open = false;
                  item.run();
                }}
              >
                {item.label}
              </button>
            </li>
          )}
        </For>
      </ul>
    </details>
  );
}
