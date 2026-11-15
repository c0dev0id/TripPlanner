import type { IControl } from 'maplibre-gl';
import { Show, type JSX } from 'solid-js';
import { render } from 'solid-js/web';

/** What a toggle among the map's controls switches: its state, its label in either state and its icon in either state. */
interface Toggle {
  pressed: () => boolean;
  setPressed: (pressed: boolean) => void;
  label: () => string;
  on: () => JSX.Element;
  off: () => JSX.Element;
}

/** A map control of one button that switches something of the page on and off, in the accent while on. */
export class ToggleControl implements IControl {
  private root = document.createElement('div');
  private dispose?: () => void;

  constructor(private toggle: Toggle) {}

  onAdd(): HTMLElement {
    this.root.className = 'maplibregl-ctrl maplibregl-ctrl-group map-toggle';
    const { pressed, setPressed, label, on, off } = this.toggle;
    this.dispose = render(
      () => (
        <button type="button" title={label()} aria-label={label()} aria-pressed={pressed()} onClick={() => setPressed(!pressed())}>
          <Show when={pressed()} fallback={off()}>
            {on()}
          </Show>
        </button>
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
