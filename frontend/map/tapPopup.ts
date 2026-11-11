import { Popup, type LngLat, type Map as MapLibreMap, type Point } from 'maplibre-gl';
import { onCleanup } from 'solid-js';

/**
 * The popups that say what a feature tapped on the map is. Interactions hands them each tap
 * that does no tool's work; the first whose layers hold a feature there opens, the others
 * close.
 */

/** A popup and what opens it at a tap: true where its layers hold a feature there. */
interface Target {
  popup: Popup;
  open: (point: Point, lngLat: LngLat, reach: number) => boolean;
}

/** In the order they are asked: the first made comes first. */
const targets: Target[] = [];

/** Opens the popup of the feature within `reach` pixels of the tap, if any, and closes the others; says whether one opened. */
export function popupAt(point: Point, lngLat: LngLat, reach: number): boolean {
  let opened = false;
  for (const target of targets) {
    if (!opened && target.open(point, lngLat, reach)) opened = true;
    else target.popup.remove();
  }
  return opened;
}

/**
 * A popup for the features of the layers, with what `content` makes of the tapped
 * feature's properties. It goes with the component that made it.
 */
export function popupOnTap(map: MapLibreMap, layers: readonly string[], content: (properties: Record<string, unknown>) => Node | undefined): Popup {
  const popup = new Popup({ closeOnClick: false, maxWidth: '280px', offset: 10, className: 'map-info' });
  const open: Target['open'] = ({ x, y }, lngLat, reach) => {
    // An overlay's layers are in the style only while it is shown.
    const present = layers.filter((id) => map.getLayer(id));
    const feature = present.length > 0 ? map.queryRenderedFeatures([[x - reach, y - reach], [x + reach, y + reach]], { layers: present })[0] : undefined;
    const node = feature && content(feature.properties);
    if (node) popup.setLngLat(lngLat).setDOMContent(node).addTo(map);
    return node !== undefined;
  };
  const target = { popup, open };
  targets.push(target);
  onCleanup(() => {
    targets.splice(targets.indexOf(target), 1);
    popup.remove();
  });
  return popup;
}
