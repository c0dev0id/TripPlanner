import { GeoJSONSource, LngLatBounds, Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import type { Day } from '../model/trip';
import { ROUTING_ATTRIBUTION } from '../routing/osrm';
import { daySequence } from '../routing/sequence';
import { panTarget, showNeighbours } from '../state/drawing';
import { failedLegs } from '../state/routing';
import { editingRouteId, openTrip, selectedDay, selectedDayId } from '../state/trip';
import { ContextMenu } from './ContextMenu';
import { Interactions } from './Interactions';
import { PointMarkers } from './PointMarkers';
import { decodeCached, ROUTE_LAYERS, ROUTES_SOURCE, routeFeatures, type RouteRole } from './routeOverlay';
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

/** The days drawn: the selected one, and with `showNeighbours` the ones before and after. */
function shownDays(): { day: Day; role: RouteRole }[] {
  const days = openTrip()?.days ?? [];
  const index = days.findIndex((d) => d.id === selectedDayId());
  if (index < 0) return [];
  const shown: { day: Day; role: RouteRole }[] = [{ day: days[index]!, role: 'selected' }];
  if (showNeighbours()) {
    for (const neighbour of [days[index - 1], days[index + 1]]) if (neighbour) shown.unshift({ day: neighbour, role: 'neighbour' });
  }
  return shown;
}

/** Keeps the route lines on the map, shows the selected day when it changes, and goes where the panel points. */
function RouteLines(props: { map: MapLibreMap }) {
  const marks = createMemo(() => {
    const day = selectedDay();
    return day ? daySequence(day, decodeCached).filter((e) => e.near) : [];
  });
  const features = createMemo(() => routeFeatures(shownDays(), editingRouteId(), failedLegs(), marks()));
  createEffect(() => props.map.getSource<GeoJSONSource>(ROUTES_SOURCE)?.setData(features()));
  createEffect(
    on(selectedDayId, () => {
      const day = selectedDay();
      if (!day) return;
      const bounds = new LngLatBounds();
      for (const route of day.routes) for (const point of route.points) bounds.extend(point.lngLat);
      for (const stop of day.stops) bounds.extend(stop.lngLat);
      if (!bounds.isEmpty()) props.map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 600 });
    }),
  );
  createEffect(
    on(panTarget, (target) => {
      if (target) props.map.flyTo({ center: target.lngLat, zoom: Math.max(props.map.getZoom(), 12), duration: 500 });
    }),
  );
  return null;
}
