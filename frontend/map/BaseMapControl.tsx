import { t } from '../i18n/t';
import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { LayersIcon } from '../ui/icons';
import { setMenu } from '../ui/menu';
import { BASE_MAPS, chooseBaseMap, chosenBaseMap, type BaseMap } from './baseMaps';
import { isShown, OVERLAYS, toggleOverlay, type Overlay } from './overlays';

/** A map control whose button opens the app's menu with the base maps and the overlays to switch on or off; both are kept for this browser. */
export class BaseMapControl implements IControl {
  private root!: HTMLElement;

  onAdd(map: MapLibreMap): HTMLElement {
    const pick = (baseMap: BaseMap) => {
      if (baseMap === chosenBaseMap()) return;
      chooseBaseMap(baseMap);
      map.setStyle(baseMap.style);
    };
    const toggle = (overlay: Overlay) => {
      toggleOverlay(overlay);
      // The style is the same; loading it again puts the overlays switched on into it.
      map.setStyle(chosenBaseMap().style);
    };
    const open = (e: MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const baseMaps = BASE_MAPS.map((b) => ({ label: b.label, checked: b === chosenBaseMap(), run: () => pick(b) }));
      const overlays = OVERLAYS.map((o) => ({ label: o.label, checked: isShown(o), run: () => toggle(o) }));
      setMenu({ x: rect.left - 166, y: rect.top, touch: false, items: [...baseMaps, { label: t('Overlays'), items: overlays }] });
    };
    this.root = (
      <div class="maplibregl-ctrl maplibregl-ctrl-group base-maps">
        <button type="button" title={t('Base map and overlays')} aria-label={t('Base map and overlays')} onClick={open}>
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
