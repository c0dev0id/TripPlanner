import { BAND_QUERY } from './layout';
import { t } from '../i18n/t';
import { GeoJSONSource, LngLatBounds, Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { newBaseMap } from '../map/baseMap';
import { entryMarkerElement, markerElement, stopContent } from '../map/markerContent';
import { ROUTES_SOURCE, routeFeatures } from '../map/routeOverlay';
import { dayOfEntry, placeOfEntry, type Entry } from '../model/journal';
import { DEFAULT_ROUTE_COLORING, routeColors } from '../model/routeLook';
import type { Day, Trip } from '../model/trip';
import { routePositions, routesDistance } from '../routing/legs';
import { distanceText } from '../ui/format';
import { dayMark, entryMark, TRIP_MARK } from './follow';

/** How long the reading has to stay on something before the map goes there, in milliseconds. */
const SETTLE_MS = 200;
/** How long the map takes to get there. */
const MOVE_MS = 900;
/** How close the map goes to a single place. */
const SPOT_ZOOM = 12;

/** The area a day's routes and stops lie in; reckoned once for each day, since a route's line is long. */
const areas = new WeakMap<Day, LngLatBounds>();
function areaOf(day: Day): LngLatBounds {
  let area = areas.get(day);
  if (!area) {
    area = new LngLatBounds();
    for (const route of day.routes) for (const position of routePositions(route)) area.extend(position);
    for (const stop of day.stops) area.extend(stop.lngLat);
    areas.set(day, area);
  }
  return area;
}

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
      ...(day() ? [day()!] : props.trip.days).flatMap((d) => d.stops).map((stop) => new Marker({ element: markerElement('stop-marker', stopContent(() => stop)), anchor: 'bottom' }).setLngLat(stop.lngLat)),
      ...chapter().map((e) => {
        const told = () => props.go(entryMark(e.id));
        return new Marker({ element: entryMarkerElement(e, props.api, { photo: told, note: told }) }).setLngLat(e.lngLat!);
      }),
    ];
    for (const marker of markers) marker.addTo(on);
    onCleanup(() => markers.forEach((marker) => marker.remove()));
  });

  // The map goes to what is read once the reading has stayed there; at first, and for printing, it is there at once.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let moved = false;
  createEffect(
    on([map, spot, day, () => props.trip, printing], ([on, at, of, trip, now]) => {
      if (!on) return;
      clearTimeout(timer);
      const move = () => {
        const duration = moved && !now && !matchMedia('(prefers-reduced-motion: reduce)').matches ? MOVE_MS : 0;
        moved = true;
        on.stop();
        // The card at the foot of the map covers some of it: what is shown stands above it, and off the edges by less on a small map.
        const foot = card && !now ? container.clientHeight - card.offsetTop : 0;
        const edge = Math.min(60, Math.round(container.clientHeight / 8));
        // A place is moved up by an offset, not by a padding, which the map would keep and add to the next one.
        if (at) return on.easeTo({ center: at, zoom: Math.max(on.getZoom(), SPOT_ZOOM), offset: [0, -foot / 2], duration });
        const area = (of ? [of] : trip.days).reduce((all, d) => all.extend(areaOf(d)), new LngLatBounds());
        if (of) for (const e of chapter()) area.extend(e.lngLat!);
        if (!area.isEmpty()) on.fitBounds(area, { padding: { top: edge, left: edge, right: edge, bottom: edge + foot }, maxZoom: 13, duration });
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
