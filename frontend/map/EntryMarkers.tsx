import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { createMemo, For, onCleanup } from 'solid-js';
import { tripApi } from '../api';
import { placedEntriesOfDay, targetOf, type Entry } from '../model/journal';
import { allEntries, setJournalTarget } from '../state/journal';
import { selectedDay } from '../state/trip';
import { entryContent, entryMarkerClass, markerElement } from './markerContent';

/** The selected day's journal entries where they stand: a photo as a small preview that opens it, a note as an icon that opens the journal. */
export function EntryMarkers(props: { map: MapLibreMap }) {
  const entries = createMemo(() => {
    const day = selectedDay();
    return day ? placedEntriesOfDay(allEntries(), day) : [];
  });
  return <For each={entries()}>{(entry) => <EntryMarker map={props.map} entry={entry} />}</For>;
}

function EntryMarker(props: { map: MapLibreMap; entry: Entry }) {
  const content = entryContent(props.entry, tripApi(props.entry.tripId), () => setJournalTarget(targetOf(props.entry)));
  const marker = new Marker({ element: markerElement(entryMarkerClass(props.entry), content) }).setLngLat(props.entry.lngLat!).addTo(props.map);
  onCleanup(() => marker.remove());
  return null;
}
