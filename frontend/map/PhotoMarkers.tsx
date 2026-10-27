import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { createMemo, For, onCleanup } from 'solid-js';
import { tripApi } from '../api';
import { photosOfDay, type Entry } from '../model/journal';
import { allEntries } from '../state/journal';
import { selectedDay } from '../state/trip';
import { markerElement, photoContent } from './markerContent';

/** The selected day's photos where they were taken, as small previews that open the photo. */
export function PhotoMarkers(props: { map: MapLibreMap }) {
  const photos = createMemo(() => {
    const day = selectedDay();
    return day ? photosOfDay(allEntries(), day) : [];
  });
  return <For each={photos()}>{(photo) => <PhotoMarker map={props.map} photo={photo} />}</For>;
}

function PhotoMarker(props: { map: MapLibreMap; photo: Entry }) {
  const marker = new Marker({ element: markerElement('photo-marker', photoContent(props.photo, tripApi(props.photo.tripId))) }).setLngLat(props.photo.lngLat!).addTo(props.map);
  onCleanup(() => marker.remove());
  return null;
}
