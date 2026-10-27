import { GeoJSONSource, LngLatBounds, Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import { ROUTING_ATTRIBUTION } from '../routing/osrm';
import { failedLegs } from '../state/routing';
import { openTrip, selectedDay, selectedDayId } from '../state/trip';
import { ContextMenu } from './ContextMenu';
import { Interactions } from './Interactions';
import { PointMarkers } from './PointMarkers';
import { ROUTE_LAYERS, ROUTES_SOURCE, routeFeatures } from './routeOverlay';
import { StopMarkers } from './StopMarkers';

/** OpenFreeMap serves this vector style without a key. */
const BASE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// The worker is built as a file of its own; MapLibre's own lookup does not find it in a bundle.
setWorkerUrl(workerUrl);

/** The map with the trip's routes and stops drawn over the base map, and the editing on it. */
export function MapView() {
  let container!: HTMLDivElement;
  const [map, setMap] = createSignal<MapLibreMap>();

  onMount(() => {
    const m = new MapLibreMap({ container, style: BASE_STYLE, center: [10.5, 47.5], zoom: 5, attributionControl: { compact: true } });
    m.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    m.addControl(new ScaleControl(), 'bottom-left');
    m.once('load', () => {
      m.addSource(ROUTES_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: ROUTING_ATTRIBUTION });
      for (const layer of ROUTE_LAYERS) m.addLayer(layer);
      setMap(m);
    });
    onCleanup(() => m.remove());
  });

  return (
    <>
      <div class="map" ref={container} />
      <Show when={map()}>
        {(m) => (
          <>
            <RouteLines map={m()} />
            <StopMarkers map={m()} />
            <PointMarkers map={m()} />
            <Interactions map={m()} />
            <ContextMenu map={m()} />
          </>
        )}
      </Show>
    </>
  );
}

/** Keeps the route lines on the map, and shows the selected day when it changes. */
function RouteLines(props: { map: MapLibreMap }) {
  const features = createMemo(() => routeFeatures(openTrip(), selectedDayId(), failedLegs()));
  createEffect(() => props.map.getSource<GeoJSONSource>(ROUTES_SOURCE)?.setData(features()));
  createEffect(
    on(selectedDayId, () => {
      const trip = openTrip();
      const day = selectedDay();
      if (!trip) return;
      const positions = (day?.stops.length ? day.stops : trip.days.flatMap((d) => d.stops)).map((s) => trip.places.find((p) => p.id === s.placeId)?.lngLat);
      const bounds = positions.reduce((b, p) => (p ? b.extend(p) : b), new LngLatBounds());
      if (!bounds.isEmpty()) props.map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 600 });
    }),
  );
  return null;
}
