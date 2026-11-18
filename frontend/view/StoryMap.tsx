import { BAND_QUERY } from './layout';
import { t } from '../i18n/t';
import { GeoJSONSource, Marker, type LngLatLike, type Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { frameOf, zoomToFit } from '../geo/frame';
import { newBaseMap } from '../map/baseMap';
import { entryMarkerElement, markerElement, stopContent } from '../map/markerContent';
import { ROUTES_SOURCE, routeFeatures } from '../map/routeOverlay';
import { dayOfEntry, placeOfEntry, type Entry } from '../model/journal';
import { DEFAULT_ROUTE_COLORING, routeColors } from '../model/routeLook';
import { bestBearing } from '../model/shareCard';
import type { Day, LngLat, Trip } from '../model/trip';
import { routePositions, routesDistance } from '../routing/legs';
import { distanceText } from '../ui/format';
import { Callouts } from './Callouts';
import { dayMark, entryMark, TRIP_MARK } from './follow';

/** How long the reading has to stay on something before the map goes there, in milliseconds. */
const SETTLE_MS = 200;
/** How long the map takes to get there at the least and at the most; farther takes longer. */
const MOVE_MS = { least: 1100, most: 2600 };
/** How close the map goes to a single place. */
const SPOT_ZOOM = 11.5;
/** How far the map is tilted over a day and over a single place, in degrees. */
const [DAY_PITCH, SPOT_PITCH] = [48, 60];
/** How far the map is turned off north at the most to fill itself with a day: more where it is a band much wider than high, which a day running north would be lost in. */
const MOST_TURN = { high: 30, wide: 60 };
const WIDE = 1.6;
/** How much farther off a tilted map shows an area than a fit reckons, which does so for a map seen from above. */
const TILT_ZOOM_OUT = 0.35;

/** Where a day's routes run and its stops stand. */
const positionsOf = (day: Day): LngLat[] => [...day.routes.flatMap(routePositions), ...day.stops.map((stop) => stop.lngLat)];

/**
 * The trip on a map that follows what is being read (`at`): the day read stands out and
 * fills the map with its stops and with the entries that stand somewhere on it; an entry
 * read is gone to; the trip as a whole shows every day. With `rail`, a card says what is
 * shown and has every day to go to, as wide as the day is long. A marker goes to where
 * its entry is told of. While the page is printed, the map shows the trip as a whole.
 */
export function StoryMap(props: { trip: Trip; entries: Entry[]; api: string; at: string; go: (mark: string) => void; rail: boolean }) {
  let container!: HTMLDivElement;
  let card: HTMLDivElement | undefined;
  const [map, setMap] = createSignal<MapLibreMap>();
  // The drawing buffer is kept so that the map prints.
  onMount(() => {
    const made = newBaseMap(container, { canvasContextAttributes: { preserveDrawingBuffer: true } }, setMap);
    // Where the page scrolls over the map (the plan's, and the story's while it is a band above the text), one finger
    // or the wheel scrolls the page, and the map takes two fingers or the wheel with Ctrl.
    const band = matchMedia(BAND_QUERY);
    const gestures = () => (props.rail && !band.matches ? made.cooperativeGestures.disable() : made.cooperativeGestures.enable());
    gestures();
    band.addEventListener('change', gestures);
    onCleanup(() => {
      band.removeEventListener('change', gestures);
      made.remove();
    });
  });
  const [printing, setPrinting] = createSignal(false);
  const print = () => setPrinting(true);
  const printed = () => setPrinting(false);
  window.addEventListener('beforeprint', print);
  window.addEventListener('afterprint', printed);
  onCleanup(() => {
    window.removeEventListener('beforeprint', print);
    window.removeEventListener('afterprint', printed);
  });
  const at = () => (printing() ? TRIP_MARK : props.at);
  const entry = createMemo(() => props.entries.find((e) => entryMark(e.id) === at()));
  const day = createMemo(() => (entry() ? dayOfEntry(props.trip.days, entry()!) : props.trip.days.find((d) => dayMark(d.id) === at())));
  const spot = () => entry() && placeOfEntry(props.trip.days, entry()!);
  /** The entries that stand somewhere in the chapter read. */
  const chapter = createMemo(() => props.entries.filter((e) => e.lngLat && dayOfEntry(props.trip.days, e) === day()));

  createEffect(() => {
    const days = props.trip.days.map((d) => ({ day: d, role: day() === undefined || d === day() ? ('selected' as const) : ('neighbour' as const) }));
    map()?.getSource<GeoJSONSource>(ROUTES_SOURCE)?.setData(routeFeatures(days, routeColors(props.trip.days, DEFAULT_ROUTE_COLORING), undefined, new Set(), []));
  });

  // The stops of the day read, or of every day; the entries that stand somewhere in the chapter read.
  createEffect(() => {
    const on = map();
    if (!on) return;
    const markers = [
      ...stops().map((stop) => new Marker({ element: markerElement('stop-marker', stopContent(() => stop)), anchor: 'bottom' }).setLngLat(stop.lngLat)),
      // The entries come in one after the other.
      ...chapter().map((e, n) => {
        const told = () => props.go(entryMark(e.id));
        const element = entryMarkerElement(e, props.api, { photo: told, note: told });
        element.style.setProperty('--n', String(n));
        return new Marker({ element }).setLngLat(e.lngLat!);
      }),
      // Where what is read stands, a ring goes out from.
      ...(spot() ? [new Marker({ element: markerElement('spot-marker', document.createElement('i')) }).setLngLat(spot()!)] : []),
    ];
    for (const marker of markers) marker.addTo(on);
    onCleanup(() => markers.forEach((marker) => marker.remove()));
  });

  /** How much of the map's foot the card covers; nothing while the page is printed, which has no card. */
  const footOf = () => (card && !printing() ? container.clientHeight - card.offsetTop : 0);
  /** The stops shown: of the day read, or of every day. */
  const stops = createMemo(() => (day() ? [day()!] : props.trip.days).flatMap((d) => d.stops));

  // The map goes to what is read once the reading has stayed there; at first, and for printing, it is there at once.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let moved = false;
  createEffect(
    on([map, spot, day, () => props.trip, printing], ([on, at, of, trip, now]) => {
      if (!on) return;
      clearTimeout(timer);
      const move = () => {
        // A map that is printed, or read by one who asked for less motion, is seen from above and is there at once.
        const still = now || matchMedia('(prefers-reduced-motion: reduce)').matches;
        const flown = moved && !still;
        moved = true;
        on.stop();
        // The card at the foot of the map covers some of it: what is shown stands above it, and off the edges by less on a small map.
        const foot = footOf();
        const edge = Math.min(60, Math.round(container.clientHeight / 8));
        // The map flies: up and over to where it goes, the longer the farther that is.
        const fly = (to: { center: LngLatLike; zoom: number; pitch: number; bearing: number; offset?: [number, number] }) => {
          const away = on.project(to.center);
          const far = Math.hypot(away.x - container.clientWidth / 2, away.y - container.clientHeight / 2);
          on.flyTo({ ...to, curve: 1.25, duration: flown ? Math.min(MOVE_MS.most, MOVE_MS.least + far * 0.7) : 0, essential: true });
        };
        // A day is seen at a tilt, turned a little where that fills the map better; a place of it closer and steeper, in the day's turn.
        const lines = of ? of.routes.map(routePositions).filter((line) => line.length > 1) : [];
        const shape = container.clientWidth / Math.max(1, container.clientHeight - foot);
        const turn = still || lines.length === 0 ? 0 : bestBearing(lines, shape, DAY_PITCH, shape > WIDE ? MOST_TURN.wide : MOST_TURN.high);
        // A place is moved up by an offset, not by a padding, which the map would keep and add to the next one.
        if (at) return fly({ center: at, zoom: SPOT_ZOOM, pitch: still ? 0 : SPOT_PITCH, bearing: turn, offset: [0, -foot / 2] });
        const shown = (of ? [of] : trip.days).flatMap(positionsOf);
        if (of) for (const e of chapter()) shown.push(e.lngLat!);
        if (shown.length === 0) return;
        // What is shown is fitted as the map is turned, into the room over the card and off the edges.
        const tilted = of !== undefined && !still;
        const frame = frameOf(shown, turn);
        const zoom = Math.min(13, zoomToFit(frame, { width: container.clientWidth - 2 * edge, height: container.clientHeight - foot - 2 * edge }));
        fly({ center: frame.center, zoom: zoom - (tilted ? TILT_ZOOM_OUT : 0), pitch: tilted ? DAY_PITCH : 0, bearing: turn, offset: [0, -foot / 2] });
      };
      if (moved && !now) timer = setTimeout(move, SETTLE_MS);
      else move();
      // What is printed is what was drawn last.
      if (now) on.redraw();
    }),
  );
  onCleanup(() => clearTimeout(timer));

  const number = () => props.trip.days.indexOf(day()!) + 1;
  const distance = () => routesDistance((day() ? [day()!] : props.trip.days).flatMap((d) => d.routes));
  return (
    <aside class="story-map" classList={{ beside: props.rail }} aria-label={t('Map of the trip')}>
      <div class="map" ref={container} />
      <Show when={map()}>{(on) => <Callouts map={on()} stops={stops()} foot={footOf} />}</Show>
      <Show when={props.rail}>
        <button type="button" class="whole" onClick={() => props.go(TRIP_MARK)}>
          {t('Whole trip')}
        </button>
        <div class="map-card" ref={card}>
          <p>
            <span class="overline">{day() ? t('Day {n}', { n: number() }) : t('The trip')}</span>
            <span class="name">{day() ? day()!.name : props.trip.name}</span>
            <span class="meta">{distance() > 0 && distanceText(distance())}</span>
          </p>
          <div class="rail" role="group" aria-label={t('Jump to a day')}>
            <For each={props.trip.days}>
              {(d, index) => (
                <button type="button" style={{ flex: `${Math.max(routesDistance(d.routes), 1)} 1 0` }} classList={{ active: d === day() }} aria-label={[t('Day {n}', { n: index() + 1 }), d.name].filter(Boolean).join(', ')} onClick={() => props.go(dayMark(d.id))}>
                  {index() + 1}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </aside>
  );
}
