import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { LayersIcon } from '../ui/icons';
import { setMenu } from '../ui/menu';
import { BASE_MAPS, chooseBaseMap, chosenBaseMap, type BaseMap } from './baseMaps';

/** A map control whose button opens the app's menu with the base maps; the pick is kept for this browser. */
export class BaseMapControl implements IControl {
  private root!: HTMLElement;

  onAdd(map: MapLibreMap): HTMLElement {
    const pick = (baseMap: BaseMap) => {
      if (baseMap === chosenBaseMap()) return;
      chooseBaseMap(baseMap);
      map.setStyle(baseMap.style);
    };
    const open = (e: MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setMenu({ x: rect.left - 166, y: rect.top, touch: false, items: BASE_MAPS.map((b) => ({ label: b.label, checked: b === chosenBaseMap(), run: () => pick(b) })) });
    };
    this.root = (
      <div class="maplibregl-ctrl maplibregl-ctrl-group base-maps">
        <button type="button" title="Base map" aria-label="Base map" onClick={open}>
          <LayersIcon />
        </button>
      </div>
    ) as HTMLElement;
    return this.root;
  }

  onRemove(): void {
    this.root.remove();
  }
}
