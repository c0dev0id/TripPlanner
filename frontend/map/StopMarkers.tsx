import { t } from '../i18n/t';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, onCleanup } from 'solid-js';
import type { Stop } from '../model/trip';
import { distinctStops, pointOfDay } from '../routing/dayEdit';
import { dragsMarkers, setEditTarget, straightLegItem, tapAction } from '../state/drawing';
import type { MenuItem } from '../ui/menu';
import { PlaceKindMark } from './PlaceKinds';
import { isPlaceList, shownDay } from '../state/library';
import { activeRouteId, canConnect, showsStopsOf, connectStop, disconnectStop, editingRouteId, moveStop, openTripId, removeStop, selectedDay, selectedDayId } from '../state/trip';
import { stopContent } from './markerContent';
import { MarkerHandle, onMarkerMenu, toLngLat } from './markers';
import { ForById } from '../ui/ForById';

/**
 * The stops of the selected day, drawn by their kind and named: of the route or track
 * taken up alone while one is (showsStopsOf), else each place once, where several routes
 * have a copy of it. They are draggable while a route of the day is edited with a tool
 * other than the hand; the other shown days' stops are dots on the map (routeOverlay).
 */
export function StopMarkers(props: { map: MapLibreMap }) {
  const stops = createMemo(() => {
    const shown = (shownDay()?.stops ?? []).filter((stop) => showsStopsOf(stop.routeId));
    return activeRouteId() === undefined ? distinctStops(shown) : shown;
  });
  return <ForById each={stops()}>{(stop) => <StopMarker map={props.map} stop={stop()} />}</ForById>;
}

function StopMarker(props: { map: MapLibreMap; stop: Stop }) {
  const stop = () => props.stop;
  const id = stop().id;
  const editing = () => editingRouteId() !== undefined;

  // A list's places wear their kind's look, its badge or its dot.
  const mark = isPlaceList(openTripId()) ? () => <PlaceKindMark id={selectedDayId() ?? ''} /> : undefined;
  const handle = new MarkerHandle(props.map, stopContent(stop, mark), 'stop-marker', 'bottom');
  createEffect(() => handle.setPosition(stop().lngLat));
  createEffect(() => {
    handle.setInteractive(editing());
    handle.setDraggable(editing() && dragsMarkers());
  });
  handle.marker.on('dragend', () => {
    moveStop(id, toLngLat(handle.marker.getLngLat()));
    // Where the move is asked about first, or refused, the marker goes back to where its stop is.
    handle.setPosition(stop().lngLat);
  });
  handle.root.addEventListener('click', () => {
    if (tapAction() === 'delete') removeStop(id);
    else if (tapAction() !== undefined) setEditTarget({ kind: 'stop', id });
  });
  const stopMenu = onMarkerMenu(handle, () => {
    const day = selectedDay()!;
    const items: MenuItem[] = [{ label: t('Edit stop…'), run: () => setEditTarget({ kind: 'stop', id }) }];
    const pointId = stop().pointId;
    if (pointId !== null) {
      const at = pointOfDay(day, pointId);
      if (at && at.route.points[0] !== at.point) items.push(straightLegItem(at.route.id, at.point));
      items.push({ label: t('Disconnect from the route'), run: () => disconnectStop(id) });
    } else if (canConnect(id)) {
      items.push({ label: t('Connect to the route'), run: () => connectStop(id) });
    }
    items.push({ label: t('Remove stop'), run: () => removeStop(id) });
    return items;
  });
  onCleanup(() => {
    stopMenu();
    handle.remove();
  });
  return null;
}
