import { onCleanup } from 'solid-js';
import { setMenu, type MenuItem } from './menu';

/** How long a finger rests on a card before its menu opens, as long as the map waits. */
const HOLD_MS = 500;

/**
 * Gives a card its menu: on a right-click or the keyboard's menu key, and on a touch screen
 * once a finger has rested on it (away from a drag grip); the click that ends such a press
 * does nothing else. Called from the card's ref, inside the component that renders it.
 */
export function cardMenu(card: HTMLElement, items: () => MenuItem[]): void {
  let hold: ReturnType<typeof setTimeout> | undefined;
  let press: { x: number; y: number; touch: boolean } | undefined;
  /** Whether a finger opened the menu, so that its click is no click on the card. */
  let held = false;
  const open = (x: number, y: number, touch: boolean) => {
    held = touch;
    setMenu({ x, y, touch, items: items() });
  };
  const release = () => {
    clearTimeout(hold);
    hold = undefined;
  };
  const down = (e: PointerEvent) => {
    held = false;
    press = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
    if (press.touch && !(e.target as Element).closest('.grip')) hold = setTimeout(() => open(press!.x, press!.y, true), HOLD_MS);
  };
  const move = (e: PointerEvent) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) release();
  };
  const contextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (held) return;
    release();
    // The menu key gives no position: the menu opens below the card.
    if (e.clientX === 0 && e.clientY === 0) {
      const box = card.getBoundingClientRect();
      open(box.left + 24, box.bottom, false);
    } else open(e.clientX, e.clientY, press?.touch ?? false);
  };
  const click = (e: MouseEvent) => {
    if (!held) return;
    held = false;
    e.preventDefault();
    e.stopPropagation();
  };
  card.addEventListener('pointerdown', down);
  card.addEventListener('pointermove', move);
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
  card.addEventListener('contextmenu', contextMenu);
  card.addEventListener('click', click, true);
  onCleanup(() => {
    release();
    card.removeEventListener('pointerdown', down);
    card.removeEventListener('pointermove', move);
    card.removeEventListener('pointerup', release);
    card.removeEventListener('pointercancel', release);
    card.removeEventListener('contextmenu', contextMenu);
    card.removeEventListener('click', click, true);
  });
}
