import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, For, onCleanup, Show } from 'solid-js';
import type { Route } from '../model/trip';
import { roundLngLat } from '../routing/legs';
import { tapAction } from '../state/drawing';
import { movePoint, removePoint, routeById, selectedDay, setStraight } from '../state/trip';
import { MarkerHandle, onMarkerMenu } from './markers';

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
  const route = createMemo((): Route | undefined => routeById(routeId));
  const point = createMemo(() => route()?.points.find((p) => p.id === pointId));

  const content = (<div class="point" classList={{ straight: point()?.straight === true }} />) as HTMLElement;
  const handle = new MarkerHandle(map, content, { className: 'point-marker' });
  createEffect(() => handle.setPosition(point()?.lngLat));
  handle.marker.on('dragend', () => {
    const { lng, lat } = handle.marker.getLngLat().wrap();
    movePoint(routeId, pointId, roundLngLat([lng, lat]));
  });
  handle.root.addEventListener('click', () => {
    if (tapAction() === 'delete') removePoint(routeId, pointId);
  });
  const stopMenu = onMarkerMenu(handle, map, () => {
    const straight = point()?.straight === true;
    return [
      { label: straight ? 'Route the leg to here' : 'Straight leg to here', run: () => setStraight(routeId, pointId, !straight) },
      { label: 'Remove point', run: () => removePoint(routeId, pointId) },
    ];
  });
  onCleanup(() => {
    stopMenu();
    handle.remove();
  });
  return null;
}
