import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, For, onCleanup, Show } from 'solid-js';
import { straightLegItem, tapAction } from '../state/drawing';
import { movePoint, removePoint, routeById, selectedDay } from '../state/trip';
import { MarkerHandle, onMarkerMenu, toLngLat } from './markers';

/** Draggable markers for the points between the stops of the selected day's routes. */
export function PointMarkers(props: { map: MapLibreMap }) {
  return (
    <Show when={selectedDay()} keyed>
      {(day) => (
        <For each={day.routes}>
          {(route) => <For each={route.points.slice(1, -1).map((p) => p.id)}>{(pointId) => <PointMarker map={props.map} routeId={route.id} pointId={pointId} />}</For>}
        </For>
      )}
    </Show>
  );
}

function PointMarker(props: { map: MapLibreMap; routeId: string; pointId: string }) {
  const { map, routeId, pointId } = props;
  const point = createMemo(() => routeById(routeId)?.points.find((p) => p.id === pointId));

  const content = (<div class="point" classList={{ straight: point()?.straight === true }} />) as HTMLElement;
  const handle = new MarkerHandle(map, content, 'point-marker');
  createEffect(() => handle.setPosition(point()?.lngLat));
  handle.marker.on('dragend', () => movePoint(routeId, pointId, toLngLat(handle.marker.getLngLat())));
  handle.root.addEventListener('click', () => {
    if (tapAction() === 'delete') removePoint(routeId, pointId);
  });
  const stopMenu = onMarkerMenu(handle, map, () => {
    const p = point();
    return p && [straightLegItem(routeId, p), { label: 'Remove point', run: () => removePoint(routeId, pointId) }];
  });
  onCleanup(() => {
    stopMenu();
    handle.remove();
  });
  return null;
}
