import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { For, onCleanup } from 'solid-js';
import { tripApi } from '../api';
import { placedEntriesOfDay, type Entry } from '../model/journal';
import type { Day } from '../model/trip';
import { roundLngLat } from '../routing/legs';
import { allEntries, placeEntry, showDayJournal } from '../state/journal';
import { shownDay } from '../state/library';
import { entryMarkerElement } from './markerContent';
import { toLngLat } from './markers';

/**
 * The selected day's journal entries where they stand: a photo small, which opens it
 * large, a note as an icon that opens the day's journal at it. A marker is dragged to
 * where its entry should stand.
 */
export function EntryMarkers(props: { map: MapLibreMap }) {
  return <For each={shownDay() ? placedEntriesOfDay(allEntries(), shownDay()!) : []}>{(entry) => <EntryMarker map={props.map} entry={entry} day={shownDay()!} />}</For>;
}

function EntryMarker(props: { map: MapLibreMap; entry: Entry; day: Day }) {
  const element = entryMarkerElement(props.entry, tripApi(props.entry.tripId), { note: () => showDayJournal(props.day.id, props.entry.id) });
  const marker = new Marker({ element, draggable: true }).setLngLat(props.entry.lngLat!).addTo(props.map);
  // The click that ends a drag is none on the marker.
  let dragged = false;
  marker.on('dragstart', () => (dragged = true));
  marker.on('dragend', () => void placeEntry(props.entry, roundLngLat(toLngLat(marker.getLngLat()))));
  element.addEventListener(
    'click',
    (e) => {
      if (!dragged) return;
      dragged = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
  onCleanup(() => marker.remove());
  return null;
}
