import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, onCleanup, Show } from 'solid-js';
import type { RoutePoint } from '../model/trip';
import { boundPointIds, routePoints } from '../routing/dayEdit';
import { dragsMarkers, straightLegItem, tapAction } from '../state/drawing';
import { convertPoint, editingRoute, movePoint, removePoint, selectedDay } from '../state/trip';
import { ForById } from '../ui/ForById';
import { MarkerHandle, onMarkerMenu, toLngLat } from './markers';

/**
 * Markers for the points of the route being edited, except those a stop stands on and
 * those of a track, which are many; draggable with every tool but the hand.
 */
export function PointMarkers(props: { map: MapLibreMap }) {
  const plain = createMemo(() => {
    const route = editingRoute();
    if (!route) return [];
    const taken = boundPointIds(selectedDay()!);
    return routePoints(route).filter((p) => !taken.has(p.id));
  });
  return (
    <Show when={editingRoute()?.id} keyed>
      {(routeId) => <ForById each={plain()}>{(point) => <PointMarker map={props.map} routeId={routeId} point={point()} />}</ForById>}
    </Show>
  );
}

function PointMarker(props: { map: MapLibreMap; routeId: string; point: RoutePoint }) {
  const { map, routeId } = props;
  const point = () => props.point;
  const pointId = point().id;

  const content = (<div class="point" classList={{ straight: point().straight === true }} />) as HTMLElement;
  const handle = new MarkerHandle(map, content, 'point-marker');
  createEffect(() => handle.setPosition(point().lngLat));
  createEffect(() => handle.setDraggable(dragsMarkers()));
  handle.marker.on('dragend', () => movePoint(routeId, pointId, toLngLat(handle.marker.getLngLat())));
  handle.root.addEventListener('click', () => {
    if (tapAction() === 'delete') removePoint(routeId, pointId);
    else if (tapAction() === 'stop') convertPoint(pointId);
  });
  const stopMenu = onMarkerMenu(handle, () => [
    { label: 'Make a stop here', run: () => convertPoint(pointId) },
    straightLegItem(routeId, point()),
    { label: 'Remove point', run: () => removePoint(routeId, pointId) },
  ]);
  onCleanup(() => {
    stopMenu();
    handle.remove();
  });
  return null;
}
