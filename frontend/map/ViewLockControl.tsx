import { t } from '../i18n/t';
import type { IControl } from 'maplibre-gl';
import { Show } from 'solid-js';
import { render } from 'solid-js/web';
import { setViewLocked, viewLocked } from '../state/drawing';
import { LockIcon, LockOpenIcon } from '../ui/icons';

/** A map control whose button locks the map's view: while it is locked, taking up another day, route or recording leaves the map where it is. */
export class ViewLockControl implements IControl {
  private root = document.createElement('div');
  private dispose?: () => void;

  onAdd(): HTMLElement {
    this.root.className = 'maplibregl-ctrl maplibregl-ctrl-group view-lock';
    const label = () => t(viewLocked() ? 'The map stays where it is; let it follow what is taken up again' : 'Keep the map where it is while something else is taken up');
    this.dispose = render(
      () => (
        <button type="button" title={label()} aria-label={label()} aria-pressed={viewLocked()} onClick={() => setViewLocked(!viewLocked())}>
          <Show when={viewLocked()} fallback={<LockOpenIcon />}>
            <LockIcon />
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
