import { t } from '../i18n/t';
import { DotsIcon } from './icons';
import { setMenu, type MenuItem } from './menu';

/** The button that opens a row's menu under itself, shown on screens without a right-click; the row's long press opens the same menu. */
export function MenuButton(props: { of: string; items: () => MenuItem[] }) {
  const label = () => t('Actions for {what}', { what: props.of });
  const open = (e: MouseEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: box.left, y: box.bottom, touch: false, items: props.items() });
  };
  return (
    <button class="icon menu-button" title={label()} aria-label={label()} aria-haspopup="menu" onClick={open}>
      <DotsIcon />
    </button>
  );
}
