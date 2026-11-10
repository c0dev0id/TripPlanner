import { Popup, type Map as MapLibreMap, type MapMouseEvent } from 'maplibre-gl';
import { onCleanup } from 'solid-js';
import { tapAction } from '../state/drawing';
import { tapReach } from './tapFilter';

/**
 * A popup that opens where a tap hits a feature of the layers, with what `content` makes
 * of the feature's properties, while the tap does no tool's work. It goes with the
 * component that made it.
 */
export function popupOnTap(map: MapLibreMap, className: string, layers: readonly string[], content: (properties: Record<string, unknown>) => Node | undefined): Popup {
  const popup = new Popup({ maxWidth: '280px', offset: 10, className });
  const onClick = (e: MapMouseEvent) => {
    const action = tapAction();
    if (action === 'point' || action === 'stop' || action === 'delete') return;
    const reach = tapReach((e.originalEvent as PointerEvent).pointerType === 'touch');
    const { x, y } = e.point;
    // An overlay's layers are in the style only while it is shown.
    const present = layers.filter((id) => map.getLayer(id));
    if (present.length === 0) return;
    const feature = map.queryRenderedFeatures([[x - reach, y - reach], [x + reach, y + reach]], { layers: present })[0];
    const node = feature && content(feature.properties);
    if (node) popup.setLngLat(e.lngLat).setDOMContent(node).addTo(map);
  };
  map.on('click', onClick);
  onCleanup(() => {
    map.off('click', onClick);
    popup.remove();
  });
  return popup;
}
