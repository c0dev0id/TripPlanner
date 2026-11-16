import { GripIcon, RingIcon } from './icons';

/**
 * The pad of a row: a tap or click goes to `onToggle`, which adds the row to the selection
 * or takes it away, and a press goes to `onPress`, which may drag the row; a press that
 * dragged ends in no tap. A pad that drags is drawn as a grip, one that only selects as a
 * ring, filled while its row is selected. The row's highlight shows the selection.
 */
export function Pad(props: { label: string; selected?: boolean; onToggle?: () => void; onPress?: (e: PointerEvent, onDrag: () => void) => void }) {
  let dragged = false;
  return (
    <button
      type="button"
      class="icon pad"
      classList={{ drags: props.onPress !== undefined }}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.onToggle ? !!props.selected : undefined}
      onClick={() => {
        if (!dragged) props.onToggle?.();
        dragged = false;
      }}
      onPointerDown={(e) => {
        dragged = false;
        props.onPress?.(e, () => (dragged = true));
      }}
    >
      {props.onPress ? <GripIcon /> : <RingIcon />}
    </button>
  );
}
