import { GeoJSONSource, LngLatBounds, Marker } from 'maplibre-gl';
import { createEffect, onCleanup, onMount } from 'solid-js';
import { entryFileUrl, entryPreviewUrl } from '../api';
import { newBaseMap } from '../map/baseMap';
import { BOUND_COLOR, FREE_COLOR, ROUTES_SOURCE, routeFeatures } from '../map/routeOverlay';
import type { Entry } from '../model/journal';
import type { Stop, Trip } from '../model/trip';
import { StopShape } from '../ui/StopShape';

/** The whole trip on a map that cannot be edited: every day's routes, the stops by name, the photos where they were taken. */
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
          new Marker({ element: stopElement(stop), anchor: 'bottom' }).setLngLat(stop.lngLat).addTo(m);
        }
      }
      createEffect(() => {
        for (const photo of props.entries) {
          if (photo.lngLat && photo.file?.image) new Marker({ element: photoElement(photo, props.api) }).setLngLat(photo.lngLat).addTo(m);
        }
      });
      if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 0 });
    });
    onCleanup(() => map.remove());
  });
  return <div class="map" ref={container} />;
}

function stopElement(stop: Stop): HTMLElement {
  const root = document.createElement('div');
  root.className = 'stop-marker';
  root.append(
    (
      <div class="stop" classList={{ free: stop.pointId === null }}>
        <StopShape kind={stop.kind} color={stop.pointId === null ? FREE_COLOR : BOUND_COLOR} foot />
        <span class="stop-name">{stop.name}</span>
      </div>
    ) as HTMLElement,
  );
  return root;
}

function photoElement(photo: Entry, api: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'photo-marker';
  root.append(
    (
      <a class="photo" href={entryFileUrl(api, photo.id)} target="_blank" rel="noopener" title={photo.file!.name}>
        <img src={entryPreviewUrl(api, photo.id)} alt={photo.file!.name} />
      </a>
    ) as HTMLElement,
  );
  return root;
}
