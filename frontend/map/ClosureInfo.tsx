import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, on } from 'solid-js';
import { CLOSURE_LAYERS, shownOverlays } from './overlays';
import { popupOnTap } from './tapPopup';

/** Says what a closure tapped on the map is. */
export function ClosureInfo(props: { map: MapLibreMap }) {
  const popup = popupOnTap(props.map, CLOSURE_LAYERS, (closure) => {
    // The source's descriptions are HTML; only their text is shown.
    const description = new DOMParser().parseFromString(String(closure['description'] ?? ''), 'text/html').body.textContent?.trim();
    return (
      <div>
        <h4>{String(closure['name'] ?? '')}</h4>
        {description && <p>{description}</p>}
      </div>
    ) as Node;
  });
  // A popup does not outlive its overlay being switched off.
  createEffect(on(shownOverlays, () => popup.remove()));
  return null;
}
