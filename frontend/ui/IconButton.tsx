import type { JSX } from 'solid-js';

/** A button that is an icon, named by its label for the tooltip and the screen reader; `pressed` marks a switch that is on. */
export function IconButton(props: { label: string; onClick: () => void; pressed?: boolean; disabled?: boolean; children: JSX.Element }) {
  return (
    <button class="icon" title={props.label} aria-label={props.label} aria-pressed={props.pressed} disabled={props.disabled} onClick={() => props.onClick()}>
      {props.children}
    </button>
  );
}
