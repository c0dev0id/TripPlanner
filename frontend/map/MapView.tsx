import { GeoJSONSource, LngLatBounds, type Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import type { Day, LngLat, Route } from '../model/trip';
import { panTarget, showNeighbours } from '../state/drawing';
import { comparedLines } from '../state/duplicates';
import { routePositions } from '../routing/legs';
import { colorRuns } from '../recording/lineColors';
import { isRoutePinned } from '../state/pins';
import { keepsView } from '../state/place';
import { routeWidth } from '../state/preferences';
import { opened, openedLineColors } from '../state/recordingView';
import { activeRecordingId, loadedTrack, previewedLines, recordingColor, shownRecordings } from '../state/recordings';
import { openRouteColors } from '../state/routeColors';
import { failedLegs } from '../state/routing';
import { activeRouteId, neighbourDays, openTrip, openTripId, selectedDay, selectedDayId, selectedSequence } from '../state/trip';
import { newBaseMap } from './baseMap';
import { OverlayInfo } from './OverlayInfo';
import { Interactions } from './Interactions';
import { EntryMarkers } from './EntryMarkers';
import { PointMarkers } from './PointMarkers';
import { OwnPlaceMarkers } from './OwnPlaceMarkers';
import { PlaceMarkers } from './PlaceMarkers';
import { COMPARED_SOURCE, OPENED_RECORDING_SOURCE, RECORDINGS_SOURCE, recordingFeatures } from './recordingOverlay';
import { RecordingPoint } from './RecordingPoint';
import { RouteHover } from './RouteHover';
import { ROUTES_SOURCE, routeFeatures, type RouteRole } from './routeOverlay';
import { SearchBox } from './SearchBox';
import { StopMarkers } from './StopMarkers';

/** The page's map, once it is loaded and while it stands. */
const [shownMap, setShownMap] = createSignal<MapLibreMap>();

/** Resolves once the map has drawn the routes it was last given, whatever its base map still loads; at once while there is no map. */
export const routesDrawn = (): Promise<void> =>
  new Promise((resolve) => {
    const map = shownMap();
    if (!map) return resolve();
    const check = () => {
      if (!map.isSourceLoaded(ROUTES_SOURCE)) return;
      map.off('render', check);
      resolve();
    };
    map.on('render', check);
    map.triggerRepaint();
  });

/** The map with the trip's routes and stops drawn over the base map, and the editing on it. */
export function MapView() {
  let container!: HTMLDivElement;

  onMount(() => {
    // The map keeps its view in the address, as `map=`, and starts from it.
    const m = newBaseMap(container, { hash: 'map' }, setShownMap, { routeWidth, overlays: true });
    onCleanup(() => {
      setShownMap(undefined);
      m.remove();
    });
  });

  return (
    <>
      <div class="map" ref={container} />
      <Show when={shownMap()}>
        {(m) => (
          <>
            <RouteLines map={m()} />
            <RouteHover map={m()} />
            <RecordingLines map={m()} />
            <ComparedLines map={m()} />
            <RecordingPoint map={m()} />
            <StopMarkers map={m()} />
            <EntryMarkers map={m()} />
            <PointMarkers map={m()} />
            <Interactions map={m()} />
            <PlaceMarkers map={m()} />
            <OwnPlaceMarkers map={m()} />
            <OverlayInfo map={m()} />
            <SearchBox map={m()} />
          </>
        )}
      </Show>
    </>
  );
}

type ShownDay = { day: Day; role: RouteRole };

/** The days drawn: the selected one, and of a trip with `showNeighbours` the ones before and after; every day while none is selected. */
function shownDays(): ShownDay[] {
  const day = selectedDay();
  if (!day) return (openTrip()?.days ?? []).map((d) => ({ day: d, role: 'selected' as const }));
  const neighbours = showNeighbours() && openTrip()!.kind === 'trip' ? neighbourDays().map((d) => ({ day: d, role: 'neighbour' as const })) : [];
  return [...neighbours, { day, role: 'selected' }];
}

/** Whether the lines of the days drawn are the same: the same routes in the same roles. */
const sameLines = (a: ShownDay[], b: ShownDay[]): boolean => a.length === b.length && a.every((d, i) => d.day.routes === b[i]!.day.routes && d.role === b[i]!.role);

/**
 * Whether a route of a day drawn is on the map. The one taken up and the pinned ones
 * always are; the others of the day shown, or of the whole trip, while nothing is taken
 * up, which draws what is taken up alone among them. Of a neighbouring day, the pinned.
 */
function routeDrawn(route: Route, role: RouteRole): boolean {
  if (route.id === activeRouteId() || isRoutePinned(route.id)) return true;
  return role !== 'neighbour' && activeRouteId() === undefined && activeRecordingId() === undefined;
}

const samePlaces = (a: readonly LngLat[], b: readonly LngLat[]): boolean => a.length === b.length && a.every((p, i) => p[0] === b[i]![0] && p[1] === b[i]![1]);

/**
 * Where the stops drawn as grey dots stand: of a trip, those of the days drawn but the
 * selected one, whose stops are markers; none of a collection, which can hold thousands.
 */
function dimStops(): LngLat[] {
  if (openTrip()?.kind !== 'trip') return [];
  const dim = shownDays().filter((d) => d.day !== selectedDay());
  return dim.flatMap(({ day }) => day.stops.map((stop) => stop.lngLat));
}

/** Keeps the recordings shown on the map once their tracks are read, each in its colour; the opened one apart, coloured by a measure where chosen. */
function RecordingLines(props: { map: MapLibreMap }) {
  const openedId = createMemo(() => opened()?.recording.id);
  const others = createMemo(() =>
    recordingFeatures(
      shownRecordings().flatMap((recording) => {
        const track = recording.id === openedId() ? undefined : loadedTrack(recording);
        return track ? [{ id: recording.id, points: track.points, color: recordingColor(recording) }] : [];
      }),
    ),
  );
  const openedLine = createMemo(() => {
    const o = opened();
    if (!o) return recordingFeatures([]);
    const colors = openedLineColors();
    const id = o.recording.id;
    return recordingFeatures(colors ? colorRuns(o.track.points, colors).map((run) => ({ id, ...run })) : [{ id, points: o.track.points, color: recordingColor(o.recording) }]);
  });
  createEffect(() => props.map.getSource<GeoJSONSource>(RECORDINGS_SOURCE)?.setData(others()));
  createEffect(() => props.map.getSource<GeoJSONSource>(OPENED_RECORDING_SOURCE)?.setData(openedLine()));
  return null;
}

/** Draws the routes the duplicates report compares, each in its colour, and the recording a day's lookup shows. */
function ComparedLines(props: { map: MapLibreMap }) {
  createEffect(() => props.map.getSource<GeoJSONSource>(COMPARED_SOURCE)?.setData(recordingFeatures([...comparedLines(), ...previewedLines()])));
  return null;
}

/**
 * The padding of a view fitted to the map: a margin around what it shows, and beyond each
 * card over the map, the stretch it covers from the edge where that takes the smallest
 * share of the map: a card in a corner of a tall map is cleared below it, not beside it.
 */
function clearOfCards(map: MapLibreMap) {
  const area = map.getContainer().getBoundingClientRect();
  const padding = { top: 80, right: 80, bottom: 80, left: 80 };
  for (const card of map.getContainer().parentElement!.querySelectorAll('.map-card')) {
    const box = card.getBoundingClientRect();
    const cover = { top: box.bottom - area.top, right: area.right - box.left, bottom: area.bottom - box.top, left: box.right - area.left };
    const share = (e: keyof typeof cover) => cover[e] / (e === 'top' || e === 'bottom' ? area.height : area.width);
    const edge = (Object.keys(cover) as (keyof typeof cover)[]).reduce((least, e) => (share(e) < share(least) ? e : least));
    padding[edge] = Math.max(padding[edge], 80 + cover[edge]);
  }
  return padding;
}

/** Keeps the route lines on the map, shows the selected day with its recordings shown, or the whole trip, when it changes, and goes where the panel points. */
function RouteLines(props: { map: MapLibreMap }) {
  // The trip changes as a whole; its lines are drawn again only when the routes drawn or the marks on them change.
  const days = createMemo(shownDays, [], { equals: sameLines });
  const marks = createMemo(() => selectedSequence().flatMap((e) => (e.near ? [e.near.lngLat] : [])), [], { equals: samePlaces });
  const dims = createMemo(dimStops, [], { equals: samePlaces });
  const features = createMemo(() => routeFeatures(days(), openRouteColors(), activeRouteId(), failedLegs(), marks(), dims(), routeDrawn));
  createEffect(() => props.map.getSource<GeoJSONSource>(ROUTES_SOURCE)?.setData(features()));
  createEffect(
    on([selectedDayId, openTripId], () => {
      // Back at the view the address names, the map stays there.
      if (keepsView(openTripId())) return;
      const bounds = new LngLatBounds();
      for (const { day } of shownDays().filter((d) => d.role === 'selected')) {
        for (const route of day.routes.filter((r) => routeDrawn(r, 'selected'))) for (const position of routePositions(route)) bounds.extend(position);
        for (const stop of day.stops) bounds.extend(stop.lngLat);
      }
      for (const recording of shownRecordings()) for (const position of loadedTrack(recording)?.points ?? []) bounds.extend(position);
      if (!bounds.isEmpty()) props.map.fitBounds(bounds, { padding: clearOfCards(props.map), maxZoom: 13, duration: 600 });
    }),
  );
  createEffect(
    on(panTarget, (target) => {
      if (!target) return;
      if ('lngLat' in target) props.map.flyTo({ center: target.lngLat, zoom: Math.max(props.map.getZoom(), 12), duration: 500 });
      else if (target.positions.length > 0) props.map.fitBounds(target.positions.reduce((b, p) => b.extend(p), new LngLatBounds()), { padding: clearOfCards(props.map), maxZoom: 15, duration: 500 });
    }),
  );
  return null;
}
