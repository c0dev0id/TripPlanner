import { GeolocateControl, Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl, type GeoJSONSourceSpecification, type MapOptions, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { ROUTING_ATTRIBUTION } from '../routing/valhalla';
import { BaseMapControl } from './BaseMapControl';
import { chosenBaseMap } from './baseMaps';
import { OPENED_RECORDING_SOURCE, RECORDING_LAYERS, RECORDING_POINT_LAYERS, RECORDING_POINT_SOURCE, RECORDINGS_SOURCE } from './recordingOverlay';
import { ROUTE_LAYERS, ROUTES_SOURCE } from './routeOverlay';

// The worker is built as a file of its own; MapLibre's own lookup does not find it in a bundle.
setWorkerUrl(workerUrl);

/**
 * The base style with the overlays on top, the recordings under the routes and the point
 * picked on a recording over them: their sources and layers are appended to every style
 * the map loads, and the sources keep their data across a change of base map, since
 * MapLibre hands the transform the style it is leaving.
 */
function withOverlays(previous: StyleSpecification | undefined, next: StyleSpecification): StyleSpecification {
  const empty = (): GeoJSONSourceSpecification => ({ type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const sources: StyleSpecification['sources'] = { ...next.sources, [ROUTES_SOURCE]: previous?.sources[ROUTES_SOURCE] ?? { ...empty(), attribution: ROUTING_ATTRIBUTION } };
  for (const id of [RECORDINGS_SOURCE, OPENED_RECORDING_SOURCE, RECORDING_POINT_SOURCE]) sources[id] = previous?.sources[id] ?? empty();
  return { ...next, sources, layers: [...next.layers, ...RECORDING_LAYERS, ...ROUTE_LAYERS, ...RECORDING_POINT_LAYERS] };
}

/**
 * A map over Europe on the base map this browser chose, with the navigation, locate-me,
 * base map and scale controls and the route overlay; `ready` gets the map once it has
 * loaded.
 */
export function newBaseMap(container: HTMLElement, options: Partial<MapOptions>, ready: (map: MapLibreMap) => void): MapLibreMap {
  const map = new MapLibreMap({ container, style: chosenBaseMap().style, transformStyle: withOverlays, center: [10.5, 47.5], zoom: 5, attributionControl: { compact: true }, ...options });
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 13 } }), 'top-right');
  map.addControl(new BaseMapControl(), 'top-right');
  map.addControl(new ScaleControl(), 'bottom-left');
  map.once('load', () => ready(map));
  return map;
}
