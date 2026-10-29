import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, For, onCleanup, Show } from 'solid-js';
import { boundPointIds } from '../routing/dayEdit';
import { dragsMarkers, straightLegItem, tapAction } from '../state/drawing';
import { convertPoint, editingRoute, movePoint, removePoint, routeById, selectedDay } from '../state/trip';
import { MarkerHandle, onMarkerMenu, toLngLat } from './markers';

/**
 * Markers for the points of the route being edited, except those a stop stands on and
 * those of a track, which are many; draggable with every tool but the hand.
 */
export function PointMarkers(props: { map: MapLibreMap }) {
  const plain = createMemo(() => {
    const route = editingRoute();
    if (!route || route.kind === 'track') return [];
    const taken = boundPointIds(selectedDay()!);
    return route.points.filter((p) => !taken.has(p.id)).map((p) => p.id);
  });
  return (
    <Show when={editingRoute()?.id} keyed>
      {(routeId) => <For each={plain()}>{(pointId) => <PointMarker map={props.map} routeId={routeId} pointId={pointId} />}</For>}
    </Show>
  );
}

function PointMarker(props: { map: MapLibreMap; routeId: string; pointId: string }) {
  const { map, routeId, pointId } = props;
  const point = createMemo(() => routeById(routeId)?.points.find((p) => p.id === pointId));

  const content = (<div class="point" classList={{ straight: point()?.straight === true }} />) as HTMLElement;
  const handle = new MarkerHandle(map, content, 'point-marker');
  createEffect(() => handle.setPosition(point()?.lngLat));
  createEffect(() => handle.setDraggable(dragsMarkers()));
  handle.marker.on('dragend', () => movePoint(routeId, pointId, toLngLat(handle.marker.getLngLat())));
  handle.root.addEventListener('click', () => {
    if (tapAction() === 'delete') removePoint(routeId, pointId);
    else if (tapAction() === 'stop') convertPoint(pointId);
  });
  const stopMenu = onMarkerMenu(handle, () => {
    const p = point();
    return (
      p && [
        { label: 'Make a stop here', run: () => convertPoint(pointId) },
        straightLegItem(routeId, p),
        { label: 'Remove point', run: () => removePoint(routeId, pointId) },
      ]
    );
  });
  onCleanup(() => {
    stopMenu();
    handle.remove();
  });
  return null;
}
