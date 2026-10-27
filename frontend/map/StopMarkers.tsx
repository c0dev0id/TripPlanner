import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, For, onCleanup, Show } from 'solid-js';
import type { Day, Stop } from '../model/trip';
import { setStopDialogId, showNeighbours, straightLegItem, tapAction, type MenuItem } from '../state/drawing';
import { connectStop, disconnectStop, editingRouteId, moveStop, openTrip, removeStop, selectedDayId } from '../state/trip';
import { StopShape } from '../ui/StopShape';
import { MarkerHandle, onMarkerMenu, toLngLat } from './markers';
import { BOUND_COLOR, FREE_COLOR } from './routeOverlay';

/**
 * The stops of the selected day, drawn by their kind and named, draggable while a route
 * of the day is edited; the neighbouring days' stops as small grey dots.
 */
export function StopMarkers(props: { map: MapLibreMap }) {
  const shown = createMemo(() => {
    const days = openTrip()?.days ?? [];
    const index = days.findIndex((d) => d.id === selectedDayId());
    if (index < 0) return [];
    const neighbours = showNeighbours() ? [days[index - 1], days[index + 1]].filter((d): d is Day => d !== undefined) : [];
    return [{ day: days[index]!, dim: false }, ...neighbours.map((day) => ({ day, dim: true }))];
  });
  return (
    <For each={shown()}>
      {({ day, dim }) => (
        <For each={day.stops}>
          {(stop) => (
            <Show when={!dim} fallback={<DimStopMarker map={props.map} stop={stop} />}>
              <StopMarker map={props.map} day={day} stop={stop} />
            </Show>
          )}
        </For>
      )}
    </For>
  );
}

function StopMarker(props: { map: MapLibreMap; day: Day; stop: Stop }) {
  const { map, day, stop } = props;
  const bound = () => stop.pointId !== null;
  const editing = () => editingRouteId() !== undefined;
  const color = () => (bound() ? BOUND_COLOR : FREE_COLOR);

  const content = (
    <div class="stop" classList={{ free: !bound() }}>
      <StopShape kind={stop.kind} color={color()} />
      <span class="stop-foot" style={{ background: color() }} />
      <span class="stop-name">{stop.name}</span>
    </div>
  ) as HTMLElement;
  const handle = new MarkerHandle(map, content, 'stop-marker', 'bottom');
  createEffect(() => handle.setPosition(stop.lngLat));
  createEffect(() => handle.setInteractive(editing()));
  handle.marker.on('dragend', () => moveStop(stop.id, toLngLat(handle.marker.getLngLat())));
  handle.root.addEventListener('click', () => {
    if (tapAction() === 'delete') removeStop(stop.id);
    else if (tapAction() !== undefined) setStopDialogId(stop.id);
  });
  const stopMenu = onMarkerMenu(handle, map, () => {
    const items: MenuItem[] = [{ label: 'Edit stop…', run: () => setStopDialogId(stop.id) }];
    if (bound()) {
      const route = day.routes.find((r) => r.points.some((p) => p.id === stop.pointId));
      const point = route?.points.find((p) => p.id === stop.pointId);
      if (route && point && route.points[0] !== point) items.push(straightLegItem(route.id, point));
      items.push({ label: 'Disconnect from the route', run: () => disconnectStop(stop.id) });
    } else if (day.routes.some((r) => r.points.length > 1)) {
      items.push({ label: 'Connect to the route', run: () => connectStop(stop.id) });
    }
    items.push({ label: 'Remove stop', run: () => removeStop(stop.id) });
    return items;
  });
  onCleanup(() => {
    stopMenu();
    handle.remove();
  });
  return null;
}

/** A neighbouring day's stop: a grey dot that lets taps through. */
function DimStopMarker(props: { map: MapLibreMap; stop: Stop }) {
  const content = (<div class="stop-dot" />) as HTMLElement;
  const handle = new MarkerHandle(props.map, content, 'stop-marker');
  handle.setInteractive(false);
  createEffect(() => handle.setPosition(props.stop.lngLat));
  onCleanup(() => handle.remove());
  return null;
}
