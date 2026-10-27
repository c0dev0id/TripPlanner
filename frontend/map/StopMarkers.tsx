import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, For, onCleanup } from 'solid-js';
import type { Day, Stop } from '../model/trip';
import { straightLegItem, tapAction } from '../state/drawing';
import { movePlace, openTrip, removeStop, selectedDayId } from '../state/trip';
import { MarkerHandle, onMarkerMenu, toLngLat } from './markers';

/**
 * The stops of every day: numbered and named on the selected day, where they can be
 * dragged (which moves the place) and deleted; small grey dots on the other days.
 */
export function StopMarkers(props: { map: MapLibreMap }) {
  return (
    <For each={openTrip()?.days ?? []}>
      {(day) => <For each={day.stops}>{(stop, index) => <StopMarker map={props.map} day={day} stop={stop} index={index()} />}</For>}
    </For>
  );
}

function StopMarker(props: { map: MapLibreMap; day: Day; stop: Stop; index: number }) {
  const { map, day, stop } = props;
  const place = createMemo(() => openTrip()?.places.find((p) => p.id === stop.placeId));
  const selected = () => selectedDayId() === day.id;

  const content = (
    <div class="stop" classList={{ other: !selected() }}>
      <span class="stop-number">{props.index + 1}</span>
      <span class="stop-name">{place()?.name}</span>
    </div>
  ) as HTMLElement;
  const handle = new MarkerHandle(map, content, 'stop-marker');
  createEffect(() => handle.setPosition(place()?.lngLat));
  createEffect(() => handle.setInteractive(selected()));
  handle.marker.on('dragend', () => movePlace(stop.placeId, toLngLat(handle.marker.getLngLat())));
  handle.root.addEventListener('click', () => {
    if (selected() && tapAction() === 'delete') removeStop(stop.id);
  });
  const stopMenu = onMarkerMenu(handle, map, () => {
    if (!selected()) return undefined;
    const items = [{ label: 'Remove stop', run: () => removeStop(stop.id) }];
    // The leg that arrives here is the last leg of the route before this stop.
    const arriving = day.routes[props.index - 1];
    if (arriving) items.unshift(straightLegItem(arriving.id, arriving.points.at(-1)!));
    return items;
  });
  onCleanup(() => {
    stopMenu();
    handle.remove();
  });
  return null;
}
