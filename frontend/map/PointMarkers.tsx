import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, For, onCleanup, Show } from 'solid-js';
import { straightLegItem, tapAction } from '../state/drawing';
import { convertPoint, editingRoute, movePoint, removePoint, routeById, selectedDay } from '../state/trip';
import { MarkerHandle, onMarkerMenu, toLngLat } from './markers';

/** Draggable markers for the points of the route being edited, except those a stop stands on. */
export function PointMarkers(props: { map: MapLibreMap }) {
  const plain = createMemo(() => {
    const route = editingRoute();
    const taken = new Set(selectedDay()?.stops.map((s) => s.pointId));
    return route ? route.points.filter((p) => !taken.has(p.id)).map((p) => p.id) : [];
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
