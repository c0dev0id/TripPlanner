import type { IControl } from 'maplibre-gl';
import { For } from 'solid-js';
import { render } from 'solid-js/web';
import { isShown, OVERLAYS, toggleOverlay } from './overlays';

/** A map control with a button per overlay, its sign, that switches it on and off; kept for this browser. */
export class OverlayControl implements IControl {
  private root = document.createElement('div');
  private dispose?: () => void;

  onAdd(): HTMLElement {
    this.root.className = 'maplibregl-ctrl maplibregl-ctrl-group overlay-toggles';
    this.dispose = render(
      () => (
        <For each={OVERLAYS}>
          {(overlay) => (
            <button type="button" title={overlay.label} aria-label={overlay.label} aria-pressed={isShown(overlay)} onClick={() => toggleOverlay(overlay)}>
              <img src={overlay.sign.url} alt="" />
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
