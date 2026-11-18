import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createSignal, For, on, onCleanup } from 'solid-js';
import type { Stop } from '../model/trip';
import { placeCallouts, type Callout } from './callouts';

/** How many places of what the map shows are named at most, and how much of the map there is to be for each name: a small map names few. */
const MOST = 14;
const ROOM_EACH = 22_000;
/** How a name is set, for its width to be reckoned before it is drawn; as the stylesheet has it. */
const FONT = "600 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
const [HEIGHT, PADDING, WIDEST] = [26, 28, 200];

/**
 * The names of the stops over the map: each a little off its stop with a line to it,
 * set once the map has come to rest and brought in one after the other; while the map
 * moves there are none. `foot` is how much of the map's foot is covered and takes no name.
 */
export function Callouts(props: { map: MapLibreMap; stops: readonly Stop[]; foot: () => number }) {
  const [names, setNames] = createSignal<(Callout & { name: string })[]>([]);
  const [shown, setShown] = createSignal(false);
  const ruler = document.createElement('canvas').getContext('2d')!;
  ruler.font = FONT;
  let frame = 0;
  const set = () => {
    const box = props.map.getContainer();
    const places = props.stops
      .filter((stop) => stop.name !== '')
      .map((stop) => ({ id: stop.id, ...props.map.project(stop.lngLat), width: Math.min(WIDEST, Math.ceil(ruler.measureText(stop.name).width) + PADDING), height: HEIGHT }));
    const byId = new Map(props.stops.map((stop) => [stop.id, stop.name]));
    const room = { width: box.clientWidth, height: box.clientHeight - props.foot() };
    const from = box.getBoundingClientRect();
    // What lies over the map beside the names, as the button to the whole trip does, takes none.
    const taken = [...box.parentElement!.querySelectorAll('.whole')].map((el) => el.getBoundingClientRect()).map((over) => ({ left: over.left - from.left, top: over.top - from.top, right: over.right - from.left, bottom: over.bottom - from.top }));
    setNames(placeCallouts(places, room, Math.min(MOST, Math.floor((room.width * room.height) / ROOM_EACH)), taken).map((callout) => ({ ...callout, name: byId.get(callout.id)! })));
    // Drawn hidden first, so that the names come in from there.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => setShown(true));
  };
  const hide = () => {
    cancelAnimationFrame(frame);
    setShown(false);
  };
  props.map.on('movestart', hide);
  props.map.on('moveend', set);
  onCleanup(() => {
    cancelAnimationFrame(frame);
    props.map.off('movestart', hide);
    props.map.off('moveend', set);
  });
  // Other stops while the map rests are named at once; a map on its way names them when it is there.
  createEffect(on(() => props.stops, () => !props.map.isMoving() && set()));
  return (
    <div class="callouts" classList={{ shown: shown() }}>
      <svg aria-hidden="true">
        <For each={names()}>
          {(name, i) => {
            const length = Math.hypot(name.line.x2 - name.line.x1, name.line.y2 - name.line.y1);
            return <line {...name.line} style={{ '--n': i(), '--length': length }} />;
          }}
        </For>
      </svg>
      <For each={names()}>
        {(name, i) => (
          <span class="callout" style={{ left: `${name.left}px`, top: `${name.top}px`, width: `${name.width}px`, '--n': i(), '--dx': `${(name.line.x1 - name.line.x2) * 0.3}px`, '--dy': `${(name.line.y1 - name.line.y2) * 0.3}px` }}>
            {name.name}
          </span>
        )}
      </For>
    </div>
  );
}
