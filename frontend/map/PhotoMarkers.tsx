import type { Map as MapLibreMap } from 'maplibre-gl';
import { createMemo, For, onCleanup } from 'solid-js';
import { entryFileUrl, entryPreviewUrl, tripApi } from '../api';
import { photosOfDay, type Entry } from '../model/journal';
import { allEntries } from '../state/journal';
import { selectedDay } from '../state/trip';
import { MarkerHandle } from './markers';

/** The selected day's photos where they were taken, as small previews that open the photo. */
export function PhotoMarkers(props: { map: MapLibreMap }) {
  const photos = createMemo(() => {
    const day = selectedDay();
    return day ? photosOfDay(allEntries(), day) : [];
  });
  return <For each={photos()}>{(photo) => <PhotoMarker map={props.map} photo={photo} />}</For>;
}

function PhotoMarker(props: { map: MapLibreMap; photo: Entry }) {
  const base = tripApi(props.photo.tripId);
  const content = (
    <a class="photo" href={entryFileUrl(base, props.photo.id)} target="_blank" rel="noopener" title={props.photo.file!.name}>
      <img src={entryPreviewUrl(base, props.photo.id)} alt={props.photo.file!.name} />
    </a>
  ) as HTMLElement;
  const handle = new MarkerHandle(props.map, content, 'photo-marker');
  handle.marker.setDraggable(false);
  handle.setPosition(props.photo.lngLat!);
  onCleanup(() => handle.remove());
  return null;
}
