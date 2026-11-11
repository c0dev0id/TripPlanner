import marker from '@mapbox/maki/icons/marker.svg?raw';
import type { IControl } from 'maplibre-gl';
import { t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { alongOnly, isKindShown, isTooFarOut, toggleAlongOnly, toggleKind } from '../state/places';
import { setPreferencesOpen } from '../state/drawing';
import { setMenu, type MenuItem } from '../ui/menu';

/**
 * A map control whose button opens the app's menu with the kinds of places to show, whether
 * only those along the day's routes, and the way to the distances; kept for this browser.
 */
export class PlacesControl implements IControl {
  private root!: HTMLElement;

  onAdd(): HTMLElement {
    const open = (e: MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const items: MenuItem[] = [
        ...POI_CATEGORIES.map((category) => ({ label: category.label, switched: isKindShown(category), run: () => toggleKind(category) })),
        { label: t('Only along the day\'s routes'), switched: alongOnly(), run: toggleAlongOnly },
        { label: t('Distances from the route…'), run: () => setPreferencesOpen(true) },
        ...(isTooFarOut() ? [{ label: t('Zoom in to see places'), disabled: true, run: () => {} }] : []),
      ];
      setMenu({ x: rect.left - 226, y: rect.top, touch: false, items });
    };
    this.root = (
      <div class="maplibregl-ctrl maplibregl-ctrl-group places-control">
        <button type="button" title={t('Places')} aria-label={t('Places')} onClick={open}>
          <span innerHTML={marker} />
        </button>
      </div>
    ) as HTMLElement;
    return this.root;
  }

  onRemove(): void {
    this.root.remove();
  }
}
