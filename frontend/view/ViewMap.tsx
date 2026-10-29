import { GeoJSONSource, LngLatBounds, Marker } from 'maplibre-gl';
import { onCleanup, onMount } from 'solid-js';
import { newBaseMap } from '../map/baseMap';
import { entryMarkerElement, markerElement, stopContent } from '../map/markerContent';
import { ROUTES_SOURCE, routeFeatures } from '../map/routeOverlay';
import type { Entry } from '../model/journal';
import type { Trip } from '../model/trip';

/** The whole trip on a map that cannot be edited: every day's routes, the stops by name, the journal entries where they stand. */
export function ViewMap(props: { trip: Trip; entries: Entry[]; api: string }) {
  let container!: HTMLDivElement;
  onMount(() => {
    // The drawing buffer is kept so that the map prints.
    const map = newBaseMap(container, { canvasContextAttributes: { preserveDrawingBuffer: true } }, (m) => {
      const days = props.trip.days.map((day) => ({ day, role: 'selected' as const }));
      m.getSource<GeoJSONSource>(ROUTES_SOURCE)!.setData(routeFeatures(days, undefined, new Set(), []));
      const bounds = new LngLatBounds();
      for (const day of props.trip.days) {
        for (const route of day.routes) for (const point of route.points) bounds.extend(point.lngLat);
        for (const stop of day.stops) {
          bounds.extend(stop.lngLat);
          new Marker({ element: markerElement('stop-marker', stopContent(() => stop)), anchor: 'bottom' }).setLngLat(stop.lngLat).addTo(m);
        }
      }
      for (const entry of props.entries) {
        if (entry.lngLat) new Marker({ element: entryMarkerElement(entry, props.api) }).setLngLat(entry.lngLat).addTo(m);
      }
      if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 0 });
    });
    onCleanup(() => map.remove());
  });
  return <div class="map" ref={container} />;
}
