import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, For, onCleanup } from 'solid-js';
import type { Stop } from '../model/trip';
import { pointOfDay } from '../routing/dayEdit';
import { dragsMarkers, setEditTarget, showNeighbours, straightLegItem, tapAction } from '../state/drawing';
import type { MenuItem } from '../ui/menu';
import { connectStop, disconnectStop, editingRouteId, moveStop, neighbourDays, openTrip, removeStop, selectedDay } from '../state/trip';
import { stopContent } from './markerContent';
import { MarkerHandle, onMarkerMenu, toLngLat } from './markers';

/** The days whose stops are small grey dots: the selected day's neighbours where shown, every day while none is selected. */
const dimDays = () => (selectedDay() ? (showNeighbours() ? neighbourDays() : []) : (openTrip()?.days ?? []));

/**
 * The stops of the selected day, drawn by their kind and named, draggable while a route
 * of the day is edited with a tool other than the hand; the other shown days' stops as dots.
 */
export function StopMarkers(props: { map: MapLibreMap }) {
  return (
    <>
      <For each={selectedDay()?.stops}>{(stop) => <StopMarker map={props.map} stop={stop} />}</For>
      <For each={dimDays()}>{(day) => <For each={day.stops}>{(stop) => <DimStopMarker map={props.map} stop={stop} />}</For>}</For>
    </>
  );
}

function StopMarker(props: { map: MapLibreMap; stop: Stop }) {
  const { map, stop } = props;
  const editing = () => editingRouteId() !== undefined;

  const handle = new MarkerHandle(map, stopContent(stop), 'stop-marker', 'bottom');
  createEffect(() => handle.setPosition(stop.lngLat));
  createEffect(() => {
    handle.setInteractive(editing());
    handle.setDraggable(editing() && dragsMarkers());
  });
  handle.marker.on('dragend', () => moveStop(stop.id, toLngLat(handle.marker.getLngLat())));
  handle.root.addEventListener('click', () => {
    if (tapAction() === 'delete') removeStop(stop.id);
    else if (tapAction() !== undefined) setEditTarget({ kind: 'stop', id: stop.id });
  });
  const stopMenu = onMarkerMenu(handle, () => {
    const day = selectedDay()!;
    const items: MenuItem[] = [{ label: 'Edit stop…', run: () => setEditTarget({ kind: 'stop', id: stop.id }) }];
    if (stop.pointId !== null) {
      const at = pointOfDay(day, stop.pointId);
      if (at && at.route.points[0] !== at.point) items.push(straightLegItem(at.route.id, at.point));
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
