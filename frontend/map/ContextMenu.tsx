import { For, onCleanup, onMount, Show } from 'solid-js';
import { menu, setMenu } from '../state/drawing';

/** The open menu, kept inside the viewport; a click elsewhere or Esc closes it. */
export function ContextMenu() {
  let list: HTMLUListElement | undefined;

  const onPointerDown = (e: PointerEvent) => {
    if (list && !list.contains(e.target as Node)) setMenu(undefined);
  };
  // Before the map's own Esc handling, which steps back a level only while no menu is open.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && menu()) {
      e.stopPropagation();
      setMenu(undefined);
    }
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  onCleanup(() => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
  });

  return (
    <Show when={menu()} keyed>
      {(m) => {
        // A long-press menu opens under the finger; only a new tap may choose an item.
        let armed = !m.touch;
        onMount(() => {
          list!.style.left = `${Math.max(0, Math.min(m.x, window.innerWidth - list!.offsetWidth))}px`;
          list!.style.top = `${Math.max(0, Math.min(m.y, window.innerHeight - list!.offsetHeight))}px`;
        });
        return (
          <ul ref={list} class="context-menu" style={{ left: `${m.x}px`, top: `${m.y}px` }} onContextMenu={(e) => e.preventDefault()} onPointerDown={() => (armed = true)}>
            <For each={m.items}>
              {(item) => (
                <li>
                  <button
                    disabled={item.disabled}
                    onClick={() => {
                      if (!armed) return;
                      setMenu(undefined);
                      item.run();
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              )}
            </For>
          </ul>
        );
      }}
    </Show>
  );
}
