import { t } from '../i18n/t';
import { createEffect, Show } from 'solid-js';
import { tripApi } from '../api';
import { dayOfEntry, entryTitle, placeOfEntry, type Entry, type EntryTarget } from '../model/journal';
import { byTimeTaken } from '../model/journalDocument';
import type { Day } from '../model/trip';
import { roundLngLat } from '../routing/legs';
import { panTo } from '../state/drawing';
import { addEntry, chapters, editEntry, journalError, linkEntry, orderChapter, placeEntry, removeEntry, shownEntryId } from '../state/journal';
import { mapView } from '../state/places';
import { openPublication, publish } from '../state/publication';
import { openTrip, openTripId, selectDay } from '../state/trip';
import { queueEntries } from '../state/uploads';
import { cardMenu } from '../ui/cardMenu';
import { dropTarget } from '../ui/carry';
import { askConfirmation } from '../ui/confirm';
import { ForById } from '../ui/ForById';
import { takenAtText } from '../ui/format';
import { Grip } from '../ui/Grip';
import { ClockIcon, PinIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { pickFiles } from '../ui/pickFile';
import { createRequest } from '../ui/request';
import { EntryFile } from './EntryFile';
import { dayLabelOf, partLabel, routeLabel } from './labels';

type Runner = (work: () => Promise<void>) => Promise<void>;

/** How long after the last key a text being written is saved, in milliseconds. */
const SAVE_AFTER_MS = 800;

/** Shows where an entry belongs: its day on the map, and the map at the place it stands on, or at its stop. */
function showOnMap(entry: Entry): void {
  const days = openTrip()!.days;
  const day = dayOfEntry(days, entry);
  if (day) selectDay(day.id);
  const at = placeOfEntry(days, entry);
  if (at) panTo(at);
}

/** What is done to an entry besides writing it: what it is linked to, the chapter it is in, where it stands on the map, whether its photo is the cover of the trip's page, and its deletion. */
function entryMenu(entry: Entry, day: Day | undefined, run: Runner): MenuItem[] {
  const trip = openTrip()!;
  const link = (target: EntryTarget) => () => void run(() => linkEntry(entry, target));
  const place = (lngLat: Entry['lngLat']) => () => void run(() => placeEntry(entry, lngLat));
  const items: MenuItem[] = [];
  if (day) {
    items.push({
      label: t('Link to'),
      items: [
        { label: t('The day'), checked: entry.dayId === day.id, run: link({ dayId: day.id }) },
        ...day.routes.map((route) => ({ label: routeLabel(route, day), checked: entry.routeId === route.id, run: link({ routeId: route.id }) })),
        ...day.stops.map((stop) => ({ label: stop.name, checked: entry.stopId === stop.id, run: link({ stopId: stop.id }) })),
      ],
    });
  }
  const others: MenuItem[] = [...(day ? [{ label: t('Introduction'), run: link({}) }] : []), ...trip.days.filter((d) => d !== day).map((d) => ({ label: dayLabelOf(trip, d), run: link({ dayId: d.id }) }))];
  if (others.length > 0) items.push({ label: t('Move to'), items: others });
  const view = mapView();
  if (!entry.lngLat && day && view) items.push({ label: t('Put on the map'), run: place(roundLngLat([(view.bounds[0] + view.bounds[2]) / 2, (view.bounds[1] + view.bounds[3]) / 2])) });
  if (entry.takenLngLat && String(entry.takenLngLat) !== String(entry.lngLat)) items.push({ label: t('Put where it was taken'), run: place(entry.takenLngLat) });
  if (entry.lngLat) items.push({ label: t('Take off the map'), run: place(null) });
  const publication = openPublication();
  if (entry.file?.image && publication) {
    const isCover = publication.coverEntryId === entry.id;
    items.push({ label: t(isCover ? 'No longer the cover of the page' : 'Use as the cover of the page'), run: () => void run(() => publish({ coverEntryId: isCover ? null : entry.id })) });
  }
  items.push({
    label: t('Delete'),
    run: async () => {
      if (await askConfirmation(t('Delete this journal entry?'), t('Delete'))) void run(() => removeEntry(entry));
    },
  });
  return items;
}

/** An entry's text, written in place and saved a moment after the last key and when it is left. What comes from elsewhere is taken while it is not being written. */
function EntryText(props: { entry: Entry; run: Runner }) {
  let field!: HTMLTextAreaElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fit = () => {
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  };
  const save = () => {
    clearTimeout(timer);
    if (field.value !== props.entry.text) void props.run(() => editEntry(props.entry, field.value));
  };
  createEffect(() => {
    const text = props.entry.text;
    if (document.activeElement !== field) field.value = text;
    requestAnimationFrame(fit);
  });
  return (
    <textarea
      ref={field}
      class="entry-text"
      rows={1}
      maxlength={20000}
      placeholder={t(props.entry.file?.image ? 'Caption' : 'Text')}
      onInput={() => {
        fit();
        clearTimeout(timer);
        timer = setTimeout(save, SAVE_AFTER_MS);
      }}
      onBlur={save}
    />
  );
}

/** A row of the journal: the grip it is put in order by, its file, its text, what it is linked to and where it stands, and its menu. */
function EntryRow(props: { entry: Entry; index: number; day: Day | undefined; onMove: (to: number) => void; run: Runner }) {
  let row!: HTMLLIElement;
  const items = () => entryMenu(props.entry, props.day, props.run);
  /** What the entry is on where that is a route or a stop: the day is the chapter itself. */
  const part = () => partLabel(openTrip()!, props.entry);
  createEffect(() => {
    if (shownEntryId() === props.entry.id) row.scrollIntoView({ block: 'nearest' });
  });
  return (
    <li
      class="journal-row"
      classList={{ shown: shownEntryId() === props.entry.id }}
      ref={(el) => {
        row = el;
        cardMenu(el, items);
      }}
    >
      <Grip label={t('Drag to reorder')} index={props.index} onMove={props.onMove} carries={() => ({ kind: 'entry', what: entryTitle(props.entry), carried: props.entry })} />
      <EntryFile entry={props.entry} base={tripApi(props.entry.tripId)} />
      <div class="lines">
        <EntryText entry={props.entry} run={props.run} />
        <Show when={part() || props.entry.lngLat || props.entry.takenAt}>
          <button type="button" class="entry-link muted detail" title={t('Show on map')} onClick={() => showOnMap(props.entry)}>
            <Show when={props.entry.lngLat}>
              <PinIcon />
            </Show>
            {[part(), props.entry.takenAt && takenAtText(props.entry.takenAt)].filter(Boolean).join(' · ')}
          </button>
        </Show>
      </div>
      <MenuButton of={entryTitle(props.entry)} items={items} />
    </li>
  );
}

/**
 * A chapter of the open trip's journal to be written and put in order: the entries of a
 * day with those on its routes and stops, or with no day the trip's own. A row is dragged
 * into another place, or onto another chapter, which it then joins; a new entry is
 * written under them.
 */
export function ChapterEditor(props: { day: Day | undefined }) {
  let text!: HTMLTextAreaElement;
  const { error, run } = createRequest();
  const dayId = () => props.day?.id ?? null;
  const target = (): EntryTarget => (props.day ? { dayId: props.day.id } : {});
  const entries = () => chapters().find((c) => (c.day?.id ?? null) === dayId())?.entries ?? [];
  const order = (ordered: Entry[]) => void run(() => orderChapter(dayId(), ordered));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= entries().length) return;
    const ordered = [...entries()];
    ordered.splice(to, 0, ...ordered.splice(from, 1));
    order(ordered);
  };
  const add = (e: SubmitEvent) => {
    e.preventDefault();
    const written = text.value.trim();
    if (!written) return;
    void run(async () => {
      await addEntry(openTripId()!, target(), { text: written });
      text.value = '';
    });
  };
  const addFiles = async () => queueEntries(openTripId()!, target(), await pickFiles({}));
  return (
    <div class="journal-chapter">
      <Show when={entries().filter((e) => e.takenAt !== null).length > 1}>
        <button type="button" class="by-time" onClick={() => order(byTimeTaken(entries()))}>
          <ClockIcon /> {t('Sort photos by time')}
        </button>
      </Show>
      <ul class="journal-rows" ref={(el) => dropTarget<Entry>(el, 'entry', (carried) => (entries().some((e) => e.id === carried.id) ? null : () => order([...entries(), carried])))}>
        <ForById each={entries()}>{(entry, index) => <EntryRow entry={entry()} index={index()} day={props.day} onMove={(to) => move(index(), to)} run={run} />}</ForById>
      </ul>
      <Show when={journalError() ?? error()}>{(message) => <p class="error">{message()}</p>}</Show>
      <form class="journal-add" onSubmit={add} on:keydown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.currentTarget.requestSubmit()}>
        <textarea ref={text} rows={2} maxlength={20000} placeholder={t('Write what happened. Markdown works.')} />
        <div class="row end">
          <button type="button" onClick={() => void addFiles()}>
            {t('Photos or files…')}
          </button>
          <button type="submit" class="primary">
            {t('Add')}
          </button>
        </div>
      </form>
    </div>
  );
}
