import { carry, type Held } from './carry';
import { GripIcon } from './icons';

/**
 * The pad of a row: a tap or click goes to `onToggle`, which adds the row to the selection
 * or takes it away. With `carries`, which says what a drag of the row carries, a press
 * that moves carries it to a place that takes it (see `ui/carry.ts`) and ends in no tap.
 * Every pad is drawn as a grip, whether it drags or only selects, so that the rows of a
 * list look alike. The row's highlight shows the selection.
 */
export function Pad(props: { label: string; selected?: boolean; onToggle?: () => void; carries?: () => Held | undefined }) {
  let dragged = false;
  return (
    <button
      type="button"
      class="icon pad"
      classList={{ drags: props.carries !== undefined }}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.onToggle ? !!props.selected : undefined}
      onClick={() => {
        if (!dragged) props.onToggle?.();
        dragged = false;
      }}
      onPointerDown={(e) => {
        dragged = false;
        if (props.carries) carry(e, props.carries, () => (dragged = true));
      }}
    >
      <GripIcon />
    </button>
  );
}
