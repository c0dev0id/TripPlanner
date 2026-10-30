import { GripIcon } from './icons';

/**
 * The pad a row is selected by where the rows are selected for their menu, drawn as a day's
 * grip: a tap or click adds the row or takes it away. The row's highlight shows the selection.
 */
export function SelectPad(props: { selected: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" class="icon select-pad" title={props.label} aria-label={props.label} aria-pressed={props.selected} onClick={() => props.onToggle()}>
      <GripIcon />
    </button>
  );
}
