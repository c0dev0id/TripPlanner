import { GripIcon } from './icons';

/**
 * The pad a row is selected by where the rows are selected for their menu, drawn as a day's
 * grip: a tap or click adds the row named `name` or takes it away. The row's highlight shows
 * the selection.
 */
export function SelectPad(props: { selected: boolean; name: string; onToggle: () => void }) {
  return (
    <button type="button" class="icon select-pad" title={`Select ${props.name}`} aria-label={`Select ${props.name}`} aria-pressed={props.selected} onClick={() => props.onToggle()}>
      <GripIcon />
    </button>
  );
}
