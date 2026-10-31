import { GripIcon } from './icons';

/**
 * The pad of a row, drawn as a day's grip: a tap or click goes to `onToggle`, which adds the
 * row to the selection or takes it away, and a press goes to `onPress`, which may drag the
 * row. The row's highlight shows the selection.
 */
export function Pad(props: { label: string; selected?: boolean; onToggle?: () => void; onPress?: (e: PointerEvent) => void }) {
  return (
    <button
      type="button"
      class="icon pad"
      classList={{ drags: props.onPress !== undefined }}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.onToggle ? !!props.selected : undefined}
      onClick={() => props.onToggle?.()}
      onPointerDown={(e) => props.onPress?.(e)}
    >
      <GripIcon />
    </button>
  );
}
