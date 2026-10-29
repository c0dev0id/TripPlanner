import { GeoJSONSource, LngLatBounds, type Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import type { Day } from '../model/trip';
import { panTarget, showNeighbours } from '../state/drawing';
import { failedLegs } from '../state/routing';
import { editingRouteId, neighbourDays, openTrip, selectedDay, selectedDayId, selectedSequence } from '../state/trip';
import { newBaseMap } from './baseMap';
import { Interactions } from './Interactions';
import { EntryMarkers } from './EntryMarkers';
import { PointMarkers } from './PointMarkers';
import { ROUTES_SOURCE, routeFeatures, type RouteRole } from './routeOverlay';
import { SearchBox } from './SearchBox';
import { StopMarkers } from './StopMarkers';

/** The map with the trip's routes and stops drawn over the base map, and the editing on it. */
export function MapView() {
  let container!: HTMLDivElement;
  const [map, setMap] = createSignal<MapLibreMap>();

  onMount(() => {
    const m = newBaseMap(container, {}, setMap);
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
            <EntryMarkers map={m()} />
            <PointMarkers map={m()} />
            <Interactions map={m()} />
            <SearchBox map={m()} />
          </>
        )}
      </Show>
    </>
  );
}

type ShownDay = { day: Day; role: RouteRole };

/** The days drawn: the selected one, and with `showNeighbours` the ones before and after; every day while none is selected. */
function shownDays(): ShownDay[] {
  const day = selectedDay();
  if (!day) return (openTrip()?.days ?? []).map((d) => ({ day: d, role: 'selected' as const }));
  const neighbours = showNeighbours() ? neighbourDays().map((d) => ({ day: d, role: 'neighbour' as const })) : [];
  return [...neighbours, { day, role: 'selected' }];
}

const sameDays = (a: ShownDay[], b: ShownDay[]): boolean => a.length === b.length && a.every((d, i) => d.day === b[i]!.day && d.role === b[i]!.role);

/** Keeps the route lines on the map, shows the selected day, or the whole trip, when it changes, and goes where the panel points. */
function RouteLines(props: { map: MapLibreMap }) {
  // The trip changes as a whole; its lines are drawn again only when a day drawn changes.
  const days = createMemo(shownDays, [], { equals: sameDays });
  const marks = () => selectedSequence().flatMap((e) => (e.near ? [e.near.lngLat] : []));
  const features = createMemo(() => routeFeatures(days(), editingRouteId(), failedLegs(), marks()));
  // The map fits the trip when another trip opens, not on each change to this one.
  const tripId = createMemo(() => openTrip()?.id);
  createEffect(() => props.map.getSource<GeoJSONSource>(ROUTES_SOURCE)?.setData(features()));
  createEffect(
    on([selectedDayId, tripId], () => {
      const bounds = new LngLatBounds();
      for (const { day } of days().filter((d) => d.role === 'selected')) {
        for (const route of day.routes) for (const point of route.points) bounds.extend(point.lngLat);
        for (const stop of day.stops) bounds.extend(stop.lngLat);
      }
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
