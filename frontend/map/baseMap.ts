import { Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl, type MapOptions, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { ROUTING_ATTRIBUTION } from '../routing/osrm';
import { BaseMapControl } from './BaseMapControl';
import { chosenBaseMap } from './baseMaps';
import { ROUTE_LAYERS, ROUTES_SOURCE } from './routeOverlay';

// The worker is built as a file of its own; MapLibre's own lookup does not find it in a bundle.
setWorkerUrl(workerUrl);

/**
 * The base style with the route overlay on top: its source and layers are appended to
 * every style the map loads, and the source keeps its data across a change of base map,
 * since MapLibre hands the transform the style it is leaving.
 */
function withRouteOverlay(previous: StyleSpecification | undefined, next: StyleSpecification): StyleSpecification {
  const source = previous?.sources[ROUTES_SOURCE] ?? { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: ROUTING_ATTRIBUTION };
  return { ...next, sources: { ...next.sources, [ROUTES_SOURCE]: source }, layers: [...next.layers, ...ROUTE_LAYERS] };
}

/**
 * A map over Europe on the base map this browser chose, with the navigation, scale and
 * base map controls and the route overlay; `ready` gets the map once it has loaded.
 */
export function newBaseMap(container: HTMLElement, options: Partial<MapOptions>, ready: (map: MapLibreMap) => void): MapLibreMap {
  const map = new MapLibreMap({ container, style: chosenBaseMap().style, transformStyle: withRouteOverlay, center: [10.5, 47.5], zoom: 5, attributionControl: { compact: true }, ...options });
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new BaseMapControl(), 'top-right');
  map.addControl(new ScaleControl(), 'bottom-left');
  map.once('load', () => ready(map));
  return map;
}
