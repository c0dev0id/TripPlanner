import { setMenu, type MenuItem } from '../state/drawing';
import { DotsIcon } from './icons';

/** A row's further actions behind a dots button, opened as the app's one menu below it. */
export function MoreMenu(props: { label: string; items: () => MenuItem[] }) {
  const open = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: rect.right - 160, y: rect.bottom + 2, touch: false, items: props.items() });
  };
  return (
    <button type="button" class="icon more" title={props.label} aria-label={props.label} onClick={open}>
      <DotsIcon />
    </button>
  );
}
