import { createMemo, createSignal, Show } from 'solid-js';
import { FREE_COLOR } from '../map/routeOverlay';
import type { Day, Route, Stop } from '../model/trip';
import { routeDistance, routePositions, routesDistance } from '../routing/legs';
import { copyRoute, copyStop } from '../state/clipboard';
import { panTo, showWhole } from '../state/drawing';
import { openTrip, removeDay, removeStop, selectDay, selectedDayId, updateDay } from '../state/trip';
import { symbolLabel } from '../symbols/symbols';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { ForById } from '../ui/ForById';
import { counted, distanceText } from '../ui/format';
import { BackIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { NameDialog } from '../ui/NameDialog';
import { StopShape } from '../ui/StopShape';
import { routeKindLabel, routeLabel } from './labels';
import { removeRouteAsked } from './remove';
import { SaveStatus } from './SaveStatus';

/**
 * The open collection of planning material: its sections, a file each, with their routes
 * and waypoints to look through on the map and to copy into a day of a trip.
 */
export function CollectionPanel(props: { onLeave: () => void; onReload: () => void }) {
  const collection = () => openTrip()!;
  /** One level up: from a section to the whole collection, from the collection to the list it was opened from. */
  const back = () => (selectedDayId() ? { label: 'Back to the collection', run: () => selectDay(undefined) } : { label: 'Back to the trips', run: props.onLeave });
  const [renamed, setRenamed] = createSignal<Day>();
  return (
    <section class="trip">
      <div class="row">
        <button class="icon" title={back().label} aria-label={back().label} onClick={() => back().run()}>
          <BackIcon />
        </button>
        <h2 class="grow name" title={collection().name}>
          {collection().name}
        </h2>
      </div>
      <SaveStatus onReload={props.onReload} />
      <p class="muted hint">Planning material: copy a route or a waypoint from its menu, then paste it into a day of a trip from the day's menu.</p>
      <ol class="days">
        <ForById each={collection().days}>{(day) => <SectionItem day={day()} onRename={setRenamed} />}</ForById>
      </ol>
      <NameDialog
        title="Rename section"
        open={renamed() !== undefined}
        placeholder="Name of the section"
        initial={renamed()?.name}
        onClose={() => setRenamed(undefined)}
        onSubmit={(name) => {
          const day = renamed()!;
          updateDay(day.id, { name, date: day.date, notes: day.notes });
        }}
      />
    </section>
  );
}

/** A section as a card: its name over what it holds; opened, its routes and waypoints. Its menu renames and removes it. */
function SectionItem(props: { day: Day; onRename: (day: Day) => void }) {
  const selected = () => selectedDayId() === props.day.id;
  // The section's routes change less often than the section.
  const routes = createMemo(() => props.day.routes);
  const distance = createMemo(() => routesDistance(routes()));
  const meta = () =>
    [counted(routes().length, 'route'), props.day.stops.length > 0 && counted(props.day.stops.length, 'waypoint'), distance() > 0 && distanceText(distance())].filter(Boolean).join(' · ');
  const remove = async () => {
    if (await askConfirmation(`Remove the section “${props.day.name}” with its routes and waypoints?`, 'Remove')) removeDay(props.day.id);
  };
  const items = (): MenuItem[] => [
    { label: 'Rename…', run: () => props.onRename(props.day) },
    { label: 'Remove', run: () => void remove() },
  ];
  return (
    <li class="day card" classList={{ selected: selected() }}>
      <div class="row" ref={(el) => cardMenu(el, items)}>
        <button class="text grow" onClick={() => selectDay(selected() ? undefined : props.day.id)} aria-pressed={selected()}>
          <span class="lines">
            <span class="name">{props.day.name}</span>
            <span class="muted detail">{meta()}</span>
          </span>
        </button>
      </div>
      <Show when={selected()}>
        <div class="day-details">
          <ul class="routes">
            <ForById each={props.day.routes}>{(route) => <RouteItem route={route()} day={props.day} />}</ForById>
          </ul>
          <Show when={props.day.stops.length > 0}>
            <div class="row heading">
              <h4 class="grow">Waypoints</h4>
            </div>
            <ol class="stops">
              <ForById each={props.day.stops}>{(stop) => <WaypointItem stop={stop()} />}</ForById>
            </ol>
          </Show>
        </div>
      </Show>
    </li>
  );
}

/** A route of a section: a click shows it whole on the map; its menu copies and removes it. */
function RouteItem(props: { route: Route; day: Day }) {
  const label = createMemo(() => routeLabel(props.route, props.day));
  const distance = createMemo(() => routeDistance(props.route));
  const items = (): MenuItem[] => [
    { label: 'Copy', run: () => copyRoute(props.day, props.route) },
    { label: 'Remove', run: () => void removeRouteAsked(props.route) },
  ];
  return (
    <li class="route">
      <div class="row" ref={(el) => cardMenu(el, items)}>
        <button class="text grow" onClick={() => showWhole(routePositions(props.route))}>
          <span class="lines">
            <span class="name" title={label()}>
              {label()}
            </span>
            <span class="muted detail">
              {[routeKindLabel(props.route), distance() > 0 && distanceText(distance())].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
      </div>
    </li>
  );
}

/** A waypoint of a section: a click pans the map there; its menu copies and removes it. */
function WaypointItem(props: { stop: Stop }) {
  const kind = () => symbolLabel(props.stop.symbol);
  const items = (): MenuItem[] => [
    { label: 'Copy', run: () => copyStop(props.stop) },
    { label: 'Remove', run: () => removeStop(props.stop.id) },
  ];
  return (
    <li class="row sequence-item" ref={(el) => cardMenu(el, items)}>
      <button class="text grow" onClick={() => panTo(props.stop.lngLat)}>
        <StopShape symbol={props.stop.symbol} color={FREE_COLOR} height={22} />
        <span class="lines">
          <span class="name">{props.stop.name}</span>
          <Show when={kind()}>
            <span class="muted detail">{kind()}</span>
          </Show>
        </span>
      </button>
    </li>
  );
}
