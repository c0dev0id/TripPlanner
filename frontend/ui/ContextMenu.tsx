import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { menu, setMenu, type MenuItem } from './menu';

/** The open menu, kept inside the viewport; a press or a scroll elsewhere, or Esc, closes it. */
export function ContextMenu() {
  let list: HTMLUListElement | undefined;

  const onPointerDown = (e: PointerEvent) => {
    if (list && !list.contains(e.target as Node)) setMenu(undefined);
  };
  const onWheel = () => setMenu(undefined);
  // Before the map's own Esc handling, which steps back a level only while no menu is open.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && menu()) {
      e.stopPropagation();
      setMenu(undefined);
    }
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('wheel', onWheel, true);
  document.addEventListener('keydown', onKeyDown, true);
  onCleanup(() => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('wheel', onWheel, true);
    document.removeEventListener('keydown', onKeyDown, true);
  });

  return (
    <Show when={menu()} keyed>
      {(m) => {
        // A long-press menu opens under the finger; only a new tap may choose an item.
        let armed = !m.touch;
        return <MenuList ref={(el) => (list = el)} items={m.items} at={{ x: m.x, y: m.y }} armed={() => armed} onPointerDown={() => (armed = true)} />;
      }}
    </Show>
  );
}

/**
 * A list of menu items at a spot, kept inside the viewport. An item with items opens them
 * beside it, to the right or, without room there, to the left of `at.left`: on hover with
 * a mouse, and on a click, a tap or the keyboard.
 */
function MenuList(props: {
  items: MenuItem[];
  at: { x: number; y: number; left?: number };
  armed: () => boolean;
  ref?: (list: HTMLUListElement) => void;
  onPointerDown?: () => void;
}) {
  let list!: HTMLUListElement;
  const [open, setOpen] = createSignal<{ index: number; x: number; y: number; left: number }>();
  const openAt = (index: number, button: HTMLElement) => {
    const box = button.getBoundingClientRect();
    setOpen({ index, x: box.right, y: box.top - 4, left: box.left });
  };
  onMount(() => {
    const width = list.offsetWidth;
    const x = props.at.x + width > window.innerWidth && props.at.left !== undefined ? props.at.left - width : props.at.x;
    list.style.left = `${Math.max(0, Math.min(x, window.innerWidth - width))}px`;
    list.style.top = `${Math.max(0, Math.min(props.at.y, window.innerHeight - list.offsetHeight))}px`;
  });
  return (
    <ul
      ref={(el) => {
        list = el;
        props.ref?.(el);
      }}
      class="context-menu"
      style={{ left: `${props.at.x}px`, top: `${props.at.y}px` }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={() => props.onPointerDown?.()}
    >
      <For each={props.items}>
        {(item, index) => {
          const submenu = 'items' in item ? item.items : undefined;
          const checked = 'checked' in item ? item.checked : undefined;
          return (
            <li>
              <button
                role={checked === undefined ? undefined : 'menuitemradio'}
                aria-checked={checked}
                aria-haspopup={submenu ? 'menu' : undefined}
                aria-expanded={submenu ? open()?.index === index() : undefined}
                disabled={item.disabled}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'mouse') return;
                  if (submenu) openAt(index(), e.currentTarget);
                  else setOpen(undefined);
                }}
                onClick={(e) => {
                  if (!props.armed()) return;
                  if (submenu) return openAt(index(), e.currentTarget);
                  setMenu(undefined);
                  if ('run' in item) item.run();
                }}
              >
                {item.label}
              </button>
              <Show when={submenu && open()?.index === index() && open()}>{(at) => <MenuList items={submenu!} at={at()} armed={props.armed} />}</Show>
            </li>
          );
        }}
      </For>
    </ul>
  );
}
