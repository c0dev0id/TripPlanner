import { createSignal } from 'solid-js';

/**
 * The app's one menu: a context menu on the map or a marker, the further actions of a
 * row in the panel, the base maps. One is open at a time, at a spot in viewport pixels;
 * ContextMenu renders it and closes it on any interaction elsewhere.
 */

/** An item that does something, or one that opens a submenu of `items`; `swatch` is a colour shown before its label, `symbol` a stop's symbol drawn there, a plain stop's pin in `color`. */
export type MenuItem = { label: string; disabled?: boolean; swatch?: string; symbol?: { name: string; color: string } } & (
  | {
      run: () => void;
      /** Set on the items of a choice, true on the one chosen. */
      checked?: boolean;
    }
  | { items: MenuItem[] }
);

/** A line of a menu that says something and does nothing: what is selected, or what is not offered here. */
export const menuNote = (label: string): MenuItem => ({ label, disabled: true, run: () => undefined });

/** A menu opened by a long press (`touch`) ignores the lifting finger until it is tapped again. */
export const [menu, setMenu] = createSignal<{ x: number; y: number; touch: boolean; items: MenuItem[] }>();
