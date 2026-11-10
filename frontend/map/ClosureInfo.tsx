import { Popup, type Map as MapLibreMap, type MapMouseEvent } from 'maplibre-gl';
import { createEffect, on, onCleanup } from 'solid-js';
import { tapAction } from '../state/drawing';
import { CLOSURE_LAYERS, shownOverlays } from './overlays';
import { tapReach } from './tapFilter';

/** Says what a closure tapped on the map is, in a popup, while the tap does no tool's work. */
export function ClosureInfo(props: { map: MapLibreMap }) {
  const map = props.map;
  const popup = new Popup({ maxWidth: '280px', offset: 10, className: 'closure-info' });
  const onClick = (e: MapMouseEvent) => {
    const action = tapAction();
    if (action === 'point' || action === 'stop' || action === 'delete') return;
    const reach = tapReach((e.originalEvent as PointerEvent).pointerType === 'touch');
    const { x, y } = e.point;
    // The overlay's layers are in the style only while it is shown.
    const layers = CLOSURE_LAYERS.filter((id) => map.getLayer(id));
    const closure = layers.length > 0 ? map.queryRenderedFeatures([[x - reach, y - reach], [x + reach, y + reach]], { layers })[0] : undefined;
    if (!closure) return;
    const content = document.createElement('div');
    content.append(Object.assign(document.createElement('h4'), { textContent: String(closure.properties.name ?? '') }));
    // The source's descriptions are HTML; only their text is shown.
    const description = new DOMParser().parseFromString(String(closure.properties.description ?? ''), 'text/html').body.textContent?.trim();
    if (description) content.append(Object.assign(document.createElement('p'), { textContent: description }));
    popup.setLngLat(e.lngLat).setDOMContent(content).addTo(map);
  };
  map.on('click', onClick);
  // A popup does not outlive its overlay being switched off.
  createEffect(on(shownOverlays, () => popup.remove()));
  onCleanup(() => {
    map.off('click', onClick);
    popup.remove();
  });
  return null;
}
