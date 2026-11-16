import { createMemo, Show, type JSX } from 'solid-js';
import { t } from '../i18n/t';
import type { Folder, TripSummary } from '../model/trip';
import { fetchingTrip, isOpening, opening, outlineOf } from '../state/library';
import { openTripId } from '../state/trip';
import { dayDetail, dayHeading, routeOrTrack } from '../trip/labels';
import { SaveState } from '../trip/SaveStatus';
import { cardMenu } from '../ui/cardMenu';
import { ForById } from '../ui/ForById';
import { counted, dateText, openingText } from '../ui/format';
import { CollectionIcon, FolderIcon, TripIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { Pad } from '../ui/Pad';
import { dropTarget, type Drop } from '../ui/carry';
import type { RowSelect } from '../ui/selection';
import { PlaceKindControls, PlaceKindMark } from '../map/PlaceKinds';
import type { FoundRoute } from './search';
import { TripShape } from './TripShape';

/** How a card takes part in the selection: as a row does, and besides whether it is cut, what a press on its pad drags, and what a drop of what is carried does on it. */
export interface CardSelect extends RowSelect {
  cut: () => boolean;
  onDrag: (e: PointerEvent, dragged: () => void) => void;
  drop: (carried: unknown) => Drop;
}

/** How a card unfolds in the tree, whether it holds the tree's one mark, and of a trip whether it is the open one. */
export interface CardFold {
  unfolded: () => boolean;
  current: () => boolean;
  open?: () => boolean;
}

/**
 * The days of a trip that is not open, as the library knows them, drawn as the open trip
 * draws its own: a click opens the trip at the day. What needs the trip's document (the
 * grip that reorders, the journal, the recordings) comes with opening it.
 */
export function TripDays(props: { trip: TripSummary; onOpen: (dayId: string) => void }) {
  const collection = () => props.trip.kind === 'collection';
  const days = () => outlineOf(props.trip.id) ?? [];
  return (
    <ol class="days">
      <ForById each={days()}>
        {(day, index) => (
          <li class="day card">
            <div class="row">
              <span class="grip-space" />
              <button class="text grow" onClick={() => props.onOpen(day().id)}>
                <Show when={collection()}>
                  <PlaceKindMark id={day().id} />
                </Show>
                <span class="lines">
                  <span class="name">{dayHeading(props.trip.kind, index(), day().name)}</span>
                  <span class="muted detail">{dayDetail(props.trip.kind, day(), collection())}</span>
                </span>
              </button>
              <Show when={collection()}>
                <PlaceKindControls id={day().id} name={day().name} />
              </Show>
            </div>
          </li>
        )}
      </ForById>
      <Show when={days().length === 0}>
        <li class="muted no-days">{t(collection() ? 'No sections yet.' : 'No days yet.')}</li>
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
  children?: JSX.Element;
}) {
  const shape = createMemo(() => outlineOf(props.trip.id)?.map((day) => day.lines).filter((lines) => lines.length > 0));
  /** How far the opening of the trip has come, while it is being opened. */
  const loading = () => (isOpening(props.trip.id) ? opening()?.progress : undefined);
  /** How many places a list holds. */
  const held = createMemo(() => counted((outlineOf(props.trip.id) ?? []).reduce((sum, day) => sum + day.stops, 0), 'place'));
  const meta = () =>
    (props.trip.kind === 'collection'
      ? [props.where, held(), counted(props.trip.dayCount, 'category')]
      : [props.where, counted(props.trip.dayCount, 'day'), props.trip.startsOn && t('from {date}', { date: dateText(props.trip.startsOn) }), props.trip.state === 'done' && t('completed')]
    )
      .filter(Boolean)
      .join(' · ');
  return (
    <li
      class="card"
      classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current(), open: props.fold?.open?.(), opening: loading() !== undefined }}
      ref={(el) => dropTarget(el, (carried) => props.select?.drop(carried))}
    >
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.trip.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
          )}
        </Show>
        <button
          class="text grow"
          aria-expanded={props.fold?.unfolded()}
          onClick={(e) => props.select?.onClick(e) || props.onOpen(props.trip)}
          disabled={fetchingTrip()}
        >
          <Show when={!loading()} fallback={<span class="spinner" />}>
            <Show when={props.trip.kind === 'collection'} fallback={<TripIcon />}>
              <CollectionIcon />
            </Show>
          </Show>
          <span class="lines">
            <span class="name">{props.trip.name}</span>
            <span class="muted detail">
              <Show when={loading()} fallback={meta()}>
                {openingText(loading()!)}
              </Show>
            </span>
          </span>
          <Show when={shape()?.length ? shape() : undefined}>{(days) => <TripShape days={days()} />}</Show>
        </button>
        <Show when={props.trip.id === openTripId()}>
          <SaveState />
        </Show>
        <MenuButton of={props.trip.name} items={props.items} />
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
      ref={(el) => dropTarget(el, (carried) => props.select?.drop(carried))}
    >
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.folder.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
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
