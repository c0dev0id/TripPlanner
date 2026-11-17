import { createMemo, Show, type JSX } from 'solid-js';
import { t } from '../i18n/t';
import type { OutlineDay } from '../api';
import type { Day, Folder, TripSummary } from '../model/trip';
import { fetchingTrip, isOpening, opening, outlineOf } from '../state/library';
import { openTrip, openTripId } from '../state/trip';
import { dayCounts } from '../trip/DayPane';
import { dayDetail, dayHeading, routeOrTrack } from '../trip/labels';
import { cardMenu } from '../ui/cardMenu';
import { ForById } from '../ui/ForById';
import { counted, dateText, openingText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, ChevronLeftIcon, CollectionIcon, FolderIcon, GripIcon, TripIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { Pad } from '../ui/Pad';
import type { Held } from '../ui/carry';
import type { RowSelect } from '../ui/selection';
import { PlaceKindControls, PlaceKindMark } from '../map/PlaceKinds';
import type { FoundRoute } from './search';
import { TripShape } from './TripShape';

/** How a card takes part in the selection: as a row does, and besides whether it is cut, what a drag by its pad carries, and how its row is made a place to drop (see `ui/carry.ts`). */
export interface CardSelect extends RowSelect {
  cut: () => boolean;
  carries: () => Held | undefined;
  place: (el: HTMLElement) => void;
}

/** The button on a trip's row that opens the pane of its days: whether the pane shows them, and what a press does. */
export interface CardPane {
  open: () => boolean;
  onToggle: () => void;
}

/** How a card unfolds in the tree, whether it holds the tree's one mark, and of a trip whether it is the open one. */
export interface CardFold {
  unfolded: () => boolean;
  current: () => boolean;
  open?: () => boolean;
}

/**
 * The one day of a trip that has no other: the trip's row tells of that day, and takes
 * what only a day takes. Of the open trip it is the day as it stands, of any other the
 * day as the library knows it. None for a list of places, whose one category still says
 * what its places are.
 */
export function loneDay(trip: TripSummary): Day | OutlineDay | undefined {
  if (trip.kind !== 'trip') return undefined;
  const days = trip.id === openTripId() ? openTrip()?.days : trip.dayCount === 1 ? outlineOf(trip.id) : undefined;
  return days?.length === 1 ? days[0] : undefined;
}

/**
 * The categories of a list of places that is not open, as the library knows them, drawn
 * as the open list draws its own, grip and all: a click opens the list at the category.
 * What needs the list's document (reordering by the grip, the menu) comes with opening
 * it.
 */
export function TripDays(props: { trip: TripSummary; onOpen: (dayId: string) => void }) {
  const days = () => outlineOf(props.trip.id) ?? [];
  return (
    <ol class="days">
      <ForById each={days()}>
        {(day, index) => (
          <li class="day card">
            <div class="row">
              {/* The grip the category has once its list is open, drawn here as well, so that the rows do not change as another list is opened. */}
              <span class="grip-space" aria-hidden="true">
                <GripIcon />
              </span>
              <button class="text grow" onClick={() => props.onOpen(day().id)}>
                <PlaceKindMark id={day().id} />
                <span class="lines">
                  <span class="name">{dayHeading('collection', index(), day().name)}</span>
                  <span class="muted detail">{dayDetail('collection', day(), true)}</span>
                </span>
              </button>
              <PlaceKindControls id={day().id} name={day().name} />
            </div>
          </li>
        )}
      </ForById>
      <Show when={days().length === 0}>
        <li class="muted no-days">{t('No sections yet.')}</li>
      </Show>
    </ol>
  );
}

/**
 * A trip as a card: its name over its days, its start and whether it was ridden, or for a
 * collection its sections, after the folder it is in where `where` names it, or, while it
 * is being opened, over how far its document has come, beside a spinner; its menu
 * renames, moves, copies and deletes it. A click opens it. Where it can be selected, a tap
 * on its pad selects it, a press drags it, and a click with Cmd, Ctrl or Shift held
 * selects instead of opening, which `select.onClick` says.
 */
export function TripCard(props: {
  trip: TripSummary;
  onOpen: (trip: TripSummary) => void;
  items: () => MenuItem[];
  where?: string;
  select?: CardSelect;
  fold?: CardFold;
  pane?: CardPane;
  children?: JSX.Element;
}) {
  const shape = createMemo(() => outlineOf(props.trip.id)?.map((day) => day.lines).filter((lines) => lines.length > 0));
  /** How far the opening of the trip has come, while it is being opened. */
  const loading = () => (isOpening(props.trip.id) ? opening()?.progress : undefined);
  /** How many places a list holds. */
  const held = createMemo(() => counted((outlineOf(props.trip.id) ?? []).reduce((sum, day) => sum + day.stops, 0), 'place'));
  /** The trip's name: of the open one as it stands, which the library learns once it is saved. */
  const name = () => (props.trip.id === openTripId() ? (openTrip()?.name ?? props.trip.name) : props.trip.name);
  /** How many days the trip has: of the open one as it stands, which the library learns with the next listing. */
  const days = () => (props.trip.id === openTripId() ? (openTrip()?.days.length ?? props.trip.dayCount) : props.trip.dayCount);
  /** The trip's one day as its row tells it, where it has no other: its date and its length. */
  const lone = () => {
    const day = loneDay(props.trip);
    return day && (typeof day.routes === 'number' ? (day as OutlineDay) : dayCounts(day as Day));
  };
  const meta = () =>
    (props.trip.kind === 'collection'
      ? [props.where, held(), counted(props.trip.dayCount, 'category')]
      : [props.where, ...(lone() ? [dayDetail('trip', lone()!)] : [counted(days(), 'day'), props.trip.startsOn && t('from {date}', { date: dateText(props.trip.startsOn) })]), props.trip.state === 'done' && t('completed')]
    )
      .filter(Boolean)
      .join(' · ');
  return (
    <li
      class="card"
      classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current(), open: props.fold?.open?.(), opening: loading() !== undefined }}
      ref={(el) => props.select?.place(el)}
    >
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.trip.name })} selected={select().selected()} onToggle={select().onToggle} carries={select().carries} />
          )}
        </Show>
        <button
          class="text grow"
          aria-expanded={props.trip.kind === 'collection' ? props.fold?.unfolded() : undefined}
          onClick={(e) => props.select?.onClick(e) || props.onOpen(props.trip)}
          disabled={fetchingTrip()}
        >
          <Show when={!loading()} fallback={<span class="spinner" />}>
            <Show when={props.trip.kind === 'collection'} fallback={<TripIcon />}>
              <CollectionIcon />
            </Show>
          </Show>
          <span class="lines">
            <span class="name">{name()}</span>
            <span class="muted detail">
              <Show when={loading()} fallback={meta()}>
                {openingText(loading()!)}
              </Show>
            </span>
          </span>
          <Show when={shape()?.length ? shape() : undefined}>{(days) => <TripShape days={days()} />}</Show>
        </button>
        <MenuButton of={props.trip.name} items={props.items} />
        <Show when={props.pane}>
          {(pane) => (
            <IconButton label={t(pane().open() ? 'Hide the days of {name}' : 'Show the days of {name}', { name: props.trip.name })} pressed={pane().open()} onClick={pane().onToggle}>
              {pane().open() ? <ChevronLeftIcon /> : <ChevronIcon />}
            </IconButton>
          )}
        </Show>
      </div>
      <Show when={props.fold?.unfolded()}>
        <div class="tree-children">{props.children}</div>
      </Show>
    </li>
  );
}

/**
 * A folder as a card: its name over `note`, what it holds and in search results where it
 * is; its menu is the library's. Trips and folders dragged onto it move into it, as files
 * dropped from the computer are imported there (`data-drop-folder`); with `select`, its
 * pad selects it or drags it into another.
 */
export function FolderCard(props: { folder: Folder; note: string; onOpen: (id: number) => void; items: () => MenuItem[]; select?: CardSelect; fold?: CardFold; children?: JSX.Element }) {
  return (
    <li
      class="card"
      classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current() }}
      data-drop-folder={String(props.folder.id)}
      ref={(el) => props.select?.place(el)}
    >
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.folder.name })} selected={select().selected()} onToggle={select().onToggle} carries={select().carries} />
          )}
        </Show>
        <button class="text grow" aria-expanded={props.fold?.unfolded()} onClick={(e) => props.select?.onClick(e) || props.onOpen(props.folder.id)}>
          <FolderIcon />
          <span class="lines">
            <span class="name">{props.folder.name}</span>
            <span class="muted detail">{props.note}</span>
          </span>
        </button>
        <MenuButton of={props.folder.name} items={props.items} />
      </div>
      <Show when={props.fold?.unfolded()}>
        <ul class="tree-children">{props.children}</ul>
      </Show>
    </li>
  );
}

/** A route or a track the search found, as a card: its name over what it is and where, its trip and day; a click opens it there. */
export function RouteCard(props: { found: FoundRoute; onOpen: (found: FoundRoute) => void; items: () => MenuItem[]; select: RowSelect }) {
  return (
    <li class="card" classList={{ selected: props.select.selected() }}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Pad label={t('Select {name}', { name: props.found.route.name })} selected={props.select.selected()} onToggle={props.select.onToggle} />
        <button class="text grow" disabled={fetchingTrip()} onClick={(e) => props.select.onClick(e) || props.onOpen(props.found)}>
          <span class="lines">
            <span class="name">{props.found.route.name}</span>
            <span class="muted detail">{[routeOrTrack(props.found.route.kind), props.found.within.name, props.found.day].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
        <MenuButton of={props.found.route.name} items={props.items} />
      </div>
    </li>
  );
}
