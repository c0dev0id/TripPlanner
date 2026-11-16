import { t } from '../i18n/t';
import { createEffect, createMemo, createSignal, on, Show } from 'solid-js';
import { FREE_COLOR } from '../model/routeLook';
import type { Day, Route, Stop } from '../model/trip';
import { routeDistance, routePositions, routesDistance } from '../routing/legs';
import { dropsOnPart, isCut } from '../state/clipboard';
import { panTo, showWhole } from '../state/drawing';
import { partSelect } from '../state/partSelection';
import { mediaOf } from '../state/media';
import { recordingsOf } from '../state/recordings';
import { isPlaceList } from '../state/library';
import { isDayMarked, isRouteActive, moveDay, openTrip, openTripId, pickDay, selectedDayId, takeUpRoute, updateDay } from '../state/trip';
import { symbolLabel } from '../symbols/symbols';
import { cardMenu } from '../ui/cardMenu';
import { ForById } from '../ui/ForById';
import { Grip } from '../ui/Grip';
import { distanceText } from '../ui/format';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { Pad } from '../ui/Pad';
import { StopShape } from '../ui/StopShape';
import { dayDetail, routeKindLabel, routeLabel } from './labels';
import { PlaceKindControls, PlaceKindMark } from '../map/PlaceKinds';
import { carriedWith, partMenu } from './partMenu';
import { RoutePin } from './RoutePin';
import { DayMedia } from './Media';
import { DayRecordings } from './Recordings';

/**
 * The open collection: its sections with their routes and waypoints, planning material to
 * look through on the map and to copy into a day of a trip, and with their recordings,
 * which wait there for their day.
 */
export function CollectionPanel() {
  const collection = () => openTrip()!;
  const [renamed, setRenamed] = createSignal<Day>();
  const places = createMemo(() => isPlaceList(openTripId()));
  return (
    <section class="trip">
      <ol class="days">
        <ForById each={collection().days}>{(day, index) => <SectionItem day={day()} index={index()} places={places()} onRename={setRenamed} />}</ForById>
      </ol>
      <NameDialog
        title={t('Rename section')}
        open={renamed() !== undefined}
        placeholder={t('Section name')}
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

/** A section as a card: its name over what it holds, which in a list of places (`places`) are places; opened, its routes and waypoints. Its menu renames and removes it. */
function SectionItem(props: { day: Day; index: number; places: boolean; onRename: (day: Day) => void }) {
  const selected = () => selectedDayId() === props.day.id;
  // The section's routes change less often than the section.
  const routes = createMemo(() => props.day.routes);
  const distance = createMemo(() => routesDistance(routes()));
  const meta = () => dayDetail('collection', { date: null, routes: routes().length, stops: props.day.stops.length, recordings: recordingsOf(props.day.id).length, media: mediaOf(props.day.id).length, distanceM: distance() }, props.places);
  const items = (): MenuItem[] => partMenu('day', props.day.id, { edit: () => props.onRename(props.day) });
  const select = partSelect('day', props.day.id, () => openTrip()!.days.map((d) => d.id));
  let row!: HTMLLIElement;
  // The day shown is brought into view: one opened from elsewhere may lie far down its trip.
  createEffect(on(selected, (is) => is && requestAnimationFrame(() => row.scrollIntoView({ block: 'nearest' }))));
  return (
    <li
      ref={(el) => {
        row = el;
        dropsOnPart(el, 'day', () => props.day.id);
      }}
      class="day card"
      classList={{ open: selected(), current: isDayMarked(props.day.id), selected: select.selected(), cut: isCut(props.day.id) }}
    >
      <div class="row" ref={(el) => cardMenu(el, items)}>
        <Grip
          label={t('Drag to reorder {what}, or tap to select', { what: props.day.name })}
          index={props.index}
          onMove={(to) => moveDay(props.day.id, to)}
          onToggle={select.onToggle}
          carries={() => carriedWith('day', props.day.id, props.day.name)}
        />
        <button class="text grow" onClick={(e) => select.onClick(e) || pickDay(props.day.id)} aria-pressed={selected()}>
          <Show when={props.places}>
            <PlaceKindMark id={props.day.id} />
          </Show>
          <span class="lines">
            <span class="name">{props.day.name}</span>
            <span class="muted detail">{meta()}</span>
          </span>
        </button>
        <Show when={props.places}>
          <PlaceKindControls id={props.day.id} name={props.day.name} />
        </Show>
        <MenuButton of={props.day.name} items={items} />
      </div>
    </li>
  );
}

/** What a section holds, in the pane beside the list: its routes, its waypoints, which in a list of places are places, and, where it has any, its recordings and its media. */
export function SectionDetails(props: { day: Day }) {
  const places = () => isPlaceList(openTripId());
  /** Whether the section holds nothing of what it is for: no route, no recording, no media and, in a list of places, no place. */
  const empty = () => props.day.routes.length + recordingsOf(props.day.id).length + mediaOf(props.day.id).length + (places() ? props.day.stops.length : 0) === 0;
  return (
    <div class="day-details">
      <Show when={empty()}>
        <p class="muted">{places() ? t('No places in this category yet. Right-click the map to add one, or add a GPX file to the list.') : t('No routes in this section yet.')}</p>
      </Show>
      <Show when={props.day.routes.length > 0}>
        <ul class="routes">
          <ForById each={props.day.routes}>{(route) => <RouteItem route={route()} day={props.day} />}</ForById>
        </ul>
      </Show>
      <Show when={props.day.stops.length > 0}>
        <div class="row">
          <h4 class="grow">{places() ? t('Places') : t('Waypoints')}</h4>
        </div>
        <ol class="stops">
          <ForById each={props.day.stops}>{(stop) => <WaypointItem stop={stop()} day={props.day} />}</ForById>
        </ol>
      </Show>
      <Show when={recordingsOf(props.day.id).length > 0}>
        <DayRecordings day={props.day} />
      </Show>
      <Show when={mediaOf(props.day.id).length > 0}>
        <DayMedia day={props.day} />
      </Show>
    </div>
  );
}

/**
 * A route of a section: a click takes it up, which draws it alone among the section's
 * routes but for the pinned ones, and shows it whole; a click on the one taken up lets
 * it go. Its menu copies and removes it.
 */
function RouteItem(props: { route: Route; day: Day }) {
  const label = createMemo(() => routeLabel(props.route, props.day));
  const distance = createMemo(() => routeDistance(props.route));
  const active = () => isRouteActive(props.route.id);
  let row!: HTMLDivElement;
  // A route taken up on the map is brought into view.
  createEffect(on(active, (is) => is && row.scrollIntoView({ block: 'nearest' })));
  const select = partSelect('route', props.route.id, () => props.day.routes.map((r) => r.id));
  const click = (e: MouseEvent) => {
    if (select.onClick(e)) return;
    takeUpRoute(active() ? undefined : props.route.id);
    if (active()) showWhole(routePositions(props.route));
  };
  return (
    <li class="route" classList={{ editing: active(), selected: select.selected(), cut: isCut(props.route.id) }}>
      <div
        class="row"
        ref={(el) => {
          row = el;
          cardMenu(el, () => partMenu('route', props.route.id));
        }}
      >
        <Pad label={t('Select {name}', { name: label() })} selected={select.selected()} onToggle={select.onToggle} />
        <button class="text grow" aria-pressed={active()} onClick={click}>
          <span class="lines">
            <span class="name" title={label()}>
              {label()}
            </span>
            <span class="muted detail">
              {[routeKindLabel(props.route), distance() > 0 && distanceText(distance())].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
        <RoutePin id={props.route.id} of={label()} />
        <MenuButton of={label()} items={() => partMenu('route', props.route.id)} />
      </div>
    </li>
  );
}

/** A waypoint of a section: a click pans the map there; its menu copies and removes it. */
function WaypointItem(props: { stop: Stop; day: Day }) {
  const label = () => symbolLabel(props.stop.symbol);
  const select = partSelect('stop', props.stop.id, () => props.day.stops.map((s) => s.id));
  return (
    <li class="row sequence-item" classList={{ selected: select.selected(), cut: isCut(props.stop.id) }} ref={(el) => cardMenu(el, () => partMenu('stop', props.stop.id))}>
      <Pad label={t('Select {name}, or drag it', { name: props.stop.name })} selected={select.selected()} onToggle={select.onToggle} carries={() => carriedWith('stop', props.stop.id, props.stop.name)} />
      <button class="text grow" onClick={(e) => select.onClick(e) || panTo(props.stop.lngLat)}>
        <Show when={isPlaceList(openTripId())} fallback={<StopShape symbol={props.stop.symbol} color={FREE_COLOR} height={22} />}>
          <PlaceKindMark id={props.day.id} />
        </Show>
        <span class="lines">
          <span class="name">{props.stop.name}</span>
          <Show when={label()}>
            <span class="muted detail">{label()}</span>
          </Show>
        </span>
      </button>
      <MenuButton of={props.stop.name} items={() => partMenu('stop', props.stop.id)} />
    </li>
  );
}
