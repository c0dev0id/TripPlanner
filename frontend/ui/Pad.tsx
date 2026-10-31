import { GripIcon } from './icons';

/**
 * The pad of a row, drawn as a day's grip: a tap or click goes to `onToggle`, which adds the
 * row to the selection or takes it away. The row's highlight shows the selection.
 */
export function Pad(props: { label: string; selected?: boolean; onToggle?: () => void }) {
  return (
    <button type="button" class="icon pad" title={props.label} aria-label={props.label} aria-pressed={props.onToggle ? !!props.selected : undefined} onClick={() => props.onToggle?.()}>
      <GripIcon />
    </button>
  );
}
