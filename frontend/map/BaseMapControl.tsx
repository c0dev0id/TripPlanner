import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { createRoot, createSignal, For, Show } from 'solid-js';
import { LayersIcon } from '../ui/icons';
import { BASE_MAPS, chooseBaseMap, chosenBaseMap, type BaseMap } from './baseMaps';

/** A map control that opens the list of base maps; the pick is kept for this browser. */
export class BaseMapControl implements IControl {
  private root: HTMLElement | undefined;
  private dispose: (() => void) | undefined;

  onAdd(map: MapLibreMap): HTMLElement {
    createRoot((dispose) => {
      this.dispose = dispose;
      const [open, setOpen] = createSignal(false);
      const [current, setCurrent] = createSignal(chosenBaseMap().id);
      const pick = (baseMap: BaseMap) => {
        setOpen(false);
        if (baseMap.id === current()) return;
        setCurrent(baseMap.id);
        chooseBaseMap(baseMap);
        map.setStyle(baseMap.style);
      };
      // A click elsewhere closes the list; the listener lives only while it is open.
      const closeOnOutsideClick = (e: PointerEvent) => {
        if (!this.root!.contains(e.target as Node)) setOpen(false);
      };
      const toggle = () => {
        setOpen(!open());
        if (open()) document.addEventListener('pointerdown', closeOnOutsideClick, { once: true });
      };
      this.root = (
        <div class="maplibregl-ctrl maplibregl-ctrl-group base-maps">
          <button type="button" title="Base map" aria-label="Base map" aria-expanded={open()} onClick={toggle}>
            <LayersIcon />
          </button>
          <Show when={open()}>
            <ul role="menu" aria-label="Base maps">
              <For each={BASE_MAPS}>
                {(baseMap) => (
                  <li>
                    <button type="button" role="menuitemradio" aria-checked={current() === baseMap.id} onClick={() => pick(baseMap)}>
                      {baseMap.label}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      ) as HTMLElement;
    });
    return this.root!;
  }

  onRemove(): void {
    this.dispose?.();
    this.root?.remove();
  }
}
