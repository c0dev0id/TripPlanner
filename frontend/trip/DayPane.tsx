import { createMemo, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { Day } from '../model/trip';
import { routesDistance } from '../routing/legs';
import { setEditTarget, setShowNeighbours, showNeighbours } from '../state/drawing';
import { mediaOf } from '../state/media';
import { recordingsOf } from '../state/recordings';
import { pasteDaysAtEnd } from '../state/clipboard';
import { detailShown, isPlaceList, paneShown } from '../state/library';
import { addDay, closeDetail, detailDay, endLook, onlyDay, openDetail, openTrip, openTripId, pickDay } from '../state/trip';
import { counted, distanceText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, NeighboursIcon, NotebookIcon, PencilIcon, PlusIcon } from '../ui/icons';
import { menuNote, type MenuItem } from '../ui/menu';
import { Pane } from '../ui/Pane';
import { dayJournalShown, setDayJournalShown, setWorkspaceOpen } from '../state/journal';
import { SectionDetails } from './CollectionPanel';
import { DayStrip } from './DayStrip';
import { dayDetail, dayHeading, dayTitleOf } from './labels';
import { ChapterEditor } from './JournalEditor';
import { dayAddMenu, DayDetails, TripPanel } from './TripPanel';

/** A day as its labels count it: its date, what it holds and how far its routes go. */
export const dayCounts = (day: Day) => ({ date: day.date, routes: day.routes.length, stops: day.stops.length, recordings: recordingsOf(day.id).length, media: mediaOf(day.id).length, distanceM: routesDistance(day.routes) });

/**
 * The panes beside the library. An open trip has its days under each other and, beside
 * them, what a day holds once its pad was pressed; a trip of one day has that day's
 * contents alone, in the place of a list of one. A list of places has the category
 * whose pad was pressed in the tree. `onLeave` closes the trip, as the pad that closes
 * its pane asks.
 */
export function DayPane(props: { onLeave: () => void }) {
  return (
    <Show when={paneShown()}>
      <Show when={openTrip()!.kind === 'trip'} fallback={<SectionPane />}>
        <Show when={!onlyDay()}>
          <DaysPane onLeave={props.onLeave} />
        </Show>
        <DetailPane onLeave={props.onLeave} />
      </Show>
    </Show>
  );
}

/** What the free space of the open trip's pane offers: a day more, the days on the clipboard after its last, and its journal. */
function tripAddMenu(): MenuItem[] {
  const paste = pasteDaysAtEnd();
  return [{ label: t('Add day'), run: addDay }, ...(paste.length > 0 ? paste : [menuNote(t('Paste'))]), { label: t('Journal…'), run: () => setWorkspaceOpen(true) }];
}

/** The same for a trip of one day, in the pane of that day's contents: what adds to the day, whose paste takes days after it as well, then the day more and the journal. */
const onlyDayMenu = (day: Day): MenuItem[] => [...dayAddMenu(day), { label: t('Add day'), run: addDay }, { label: t('Journal…'), run: () => setWorkspaceOpen(true) }];

/** The pane of the open trip: its name over how many days it has and how far they go, and its days. Closing it closes the trip. */
function DaysPane(props: { onLeave: () => void }) {
  const trip = () => openTrip()!;
  const distance = createMemo(() => routesDistance(trip().days.flatMap((day) => day.routes)));
  const detail = () => [counted(trip().days.length, 'day'), distance() > 0 && distanceText(distance())].filter(Boolean).join(' · ');
  const neighboursLabel = () => t(showNeighbours() ? 'Hide adjacent days' : 'Show adjacent days (dimmed)');
  return (
    <Pane
      level="second"
      label={trip().name}
      onClose={props.onLeave}
      onUse={endLook}
      menu={tripAddMenu}
      strip={<DayStrip />}
      heading={
        <>
          <span class="lines grow">
            <span class="name" title={trip().name}>
              {trip().name}
            </span>
            <span class="muted detail">{detail()}</span>
          </span>
          <IconButton label={neighboursLabel()} pressed={showNeighbours()} onClick={() => setShowNeighbours(!showNeighbours())}>
            <NeighboursIcon />
          </IconButton>
          <IconButton label={t('Add day')} onClick={addDay}>
            <PlusIcon />
          </IconButton>
        </>
      }
    >
      <TripPanel />
    </Pane>
  );
}

/**
 * The pane of what a day holds, opened by the pad on the day's row: its name over its
 * date and length, and its notes, routes, stops, recordings and media. The day need not
 * be the one on the map; a click in the pane makes it that. A trip's only day stands
 * in the trip's pane under the trip's name: closing it closes the trip, and a day
 * added there brings the list of the days.
 */
function DetailPane(props: { onLeave: () => void }) {
  return (
    <Show when={detailDay()}>
      {(day) => {
        const only = () => onlyDay() !== undefined;
        const label = createMemo(() => (only() ? openTrip()!.name : dayTitleOf(openTrip()!, day())));
        return (
          <Pane
            level={detailShown() ? 'detail' : 'second'}
            label={label()}
            onClose={only() ? props.onLeave : closeDetail}
            onUse={() => pickDay(day().id)}
            menu={() => (only() ? onlyDayMenu(day()) : dayAddMenu(day()))}
            heading={
              <>
                <span class="lines grow">
                  <span class="name" title={label()}>
                    {only() ? label() : dayHeading('trip', openTrip()!.days.indexOf(day()), day().name)}
                  </span>
                  <span class="muted detail">{[only() && day().name, dayDetail('trip', dayCounts(day()))].filter(Boolean).join(' · ')}</span>
                </span>
                <IconButton label={t(dayJournalShown() ? 'Show the contents of {name}' : 'Show the journal of {name}', { name: dayTitleOf(openTrip()!, day()) })} pressed={dayJournalShown()} onClick={() => setDayJournalShown(!dayJournalShown())}>
                  <NotebookIcon />
                </IconButton>
                <IconButton label={t('Edit {what}', { what: dayTitleOf(openTrip()!, day()) })} onClick={() => setEditTarget({ kind: 'day', id: day().id })}>
                  <PencilIcon />
                </IconButton>
                <Show when={only()}>
                  <IconButton label={t('Add day')} onClick={addDay}>
                    <PlusIcon />
                  </IconButton>
                </Show>
              </>
            }
          >
            <Show when={dayJournalShown()} fallback={<DayDetails day={day()} />}>
              <ChapterEditor day={day()} />
            </Show>
          </Pane>
        );
      }}
    </Show>
  );
}

/** The pane of a category of a list, opened by the pad on its row: its name between the steps to the ones before and after, over what it holds. A click in it shows the category on the map. */
function SectionPane() {
  return (
    <Show when={detailDay()}>
      {(shown) => {
        const label = createMemo(() => dayTitleOf(openTrip()!, shown()));
        const heading = () => dayHeading(openTrip()!.kind, openTrip()!.days.indexOf(shown()), shown().name);
        /** The section `by` sections on from the one shown, where there is one. */
        const step = (by: number) => openTrip()!.days[openTrip()!.days.indexOf(shown()) + by];
        const detail = () => dayDetail(openTrip()!.kind, dayCounts(shown()), isPlaceList(openTripId()));
        return (
          <Pane
            level="second"
            label={label()}
            onClose={closeDetail}
            onUse={() => pickDay(shown().id)}
            strip={<DayStrip />}
            heading={
              <span class="day-title">
                <span class="day-step">
                  <IconButton label={t('Previous section')} disabled={!step(-1)} onClick={() => openDetail(step(-1)!.id)}>
                    <ChevronIcon />
                  </IconButton>
                </span>
                <span class="lines grow">
                  <span class="name" title={label()}>
                    {heading()}
                  </span>
                  <span class="muted detail">{detail()}</span>
                </span>
                <span class="day-step">
                  <IconButton label={t('Next section')} disabled={!step(1)} onClick={() => openDetail(step(1)!.id)}>
                    <ChevronIcon />
                  </IconButton>
                </span>
              </span>
            }
          >
            <SectionDetails day={shown()} />
          </Pane>
        );
      }}
    </Show>
  );
}
