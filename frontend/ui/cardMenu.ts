import { onCleanup } from 'solid-js';
import { onLongPress } from './longPress';
import { setMenu, type MenuItem } from './menu';

/**
 * Gives a card its menu: on a right-click or the keyboard's menu key, and on a touch screen
 * on a long press (away from a drag grip); the click that ends such a press does nothing
 * else. Called from the card's ref, inside the component that renders it.
 */
export function cardMenu(card: HTMLElement, items: () => MenuItem[]): void {
  let pointerType = 'mouse';
  /** Whether a long press opened the menu, so that its click is no click on the card. */
  let held = false;
  const open = (x: number, y: number, touch: boolean) => setMenu({ x, y, touch, items: items() });
  const down = (e: PointerEvent) => {
    pointerType = e.pointerType;
    held = false;
  };
  const contextMenu = (e: MouseEvent) => {
    e.preventDefault();
    // The menu key gives no position: the menu opens below the card.
    if (e.clientX === 0 && e.clientY === 0) {
      const box = card.getBoundingClientRect();
      open(box.left + 24, box.bottom, false);
    }
    // Android also fires contextmenu on a long press; that one comes from onLongPress.
    else if (pointerType === 'mouse') open(e.clientX, e.clientY, false);
  };
  const click = (e: MouseEvent) => {
    if (!held) return;
    held = false;
    e.preventDefault();
    e.stopPropagation();
  };
  card.classList.add('has-menu');
  const stopLongPress = onLongPress(card, (x, y, pressed) => {
    if ((pressed as Element).closest('.grip')) return;
    held = true;
    open(x, y, true);
  });
  card.addEventListener('pointerdown', down);
  card.addEventListener('contextmenu', contextMenu);
  card.addEventListener('click', click, true);
  onCleanup(() => {
    stopLongPress();
    card.removeEventListener('pointerdown', down);
    card.removeEventListener('contextmenu', contextMenu);
    card.removeEventListener('click', click, true);
  });
}
