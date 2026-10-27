import { Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl, type MapOptions } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { ROUTING_ATTRIBUTION } from '../routing/osrm';
import { ROUTE_LAYERS, ROUTES_SOURCE } from './routeOverlay';

/** OpenFreeMap serves this vector style without a key. */
const BASE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// The worker is built as a file of its own; MapLibre's own lookup does not find it in a bundle.
setWorkerUrl(workerUrl);

/**
 * A map over Europe with the navigation and scale controls and, once loaded, the empty
 * source and the layers of the route lines; `ready` gets the loaded map.
 */
export function newBaseMap(container: HTMLElement, options: Partial<MapOptions>, ready: (map: MapLibreMap) => void): MapLibreMap {
  const map = new MapLibreMap({ container, style: BASE_STYLE, center: [10.5, 47.5], zoom: 5, attributionControl: { compact: true }, ...options });
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new ScaleControl(), 'bottom-left');
  map.once('load', () => {
    map.addSource(ROUTES_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: ROUTING_ATTRIBUTION });
    for (const layer of ROUTE_LAYERS) map.addLayer(layer);
    ready(map);
  });
  return map;
}
