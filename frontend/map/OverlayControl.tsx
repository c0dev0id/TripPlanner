import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { For } from 'solid-js';
import { render } from 'solid-js/web';
import { chosenBaseMap } from './baseMaps';
import { isShown, OVERLAYS, toggleOverlay, type Overlay } from './overlays';

/** A map control with a button per overlay, its sign, that switches it on and off; kept for this browser. */
export class OverlayControl implements IControl {
  private root = document.createElement('div');
  private dispose?: () => void;

  onAdd(map: MapLibreMap): HTMLElement {
    const toggle = (overlay: Overlay) => {
      toggleOverlay(overlay);
      // The style is the same; loading it again puts the overlays switched on into it.
      map.setStyle(chosenBaseMap().style);
    };
    this.root.className = 'maplibregl-ctrl maplibregl-ctrl-group overlay-toggles';
    this.dispose = render(
      () => (
        <For each={OVERLAYS}>
          {(overlay) => (
            <button type="button" title={overlay.label} aria-label={overlay.label} aria-pressed={isShown(overlay)} onClick={() => toggle(overlay)}>
              <img src={overlay.images[overlay.sign]!.url} alt="" />
            </button>
          )}
        </For>
      ),
      this.root,
    );
    return this.root;
  }

  onRemove(): void {
    this.dispose?.();
    this.root.remove();
  }
}
