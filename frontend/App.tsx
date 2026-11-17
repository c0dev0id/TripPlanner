import { createEffect, createSignal, on, onCleanup, onMount, Show, untrack } from 'solid-js';
import { errorMessage, fetchTrip, type Progress } from './api';
import { DuplicatesReport } from './library/DuplicatesReport';
import { switchTab } from './state/tabs';
import { keepPinsOfOpenTrip } from './state/pinnedLines';
import { PlaceKindDialog } from './map/PlaceKinds';
import { isTreeTab } from './model/library';
import { t } from './i18n/t';
import { Explorer, LibraryTabs } from './library/Explorer';
import { ContextMenu } from './ui/ContextMenu';
import { Lightbox } from './ui/Lightbox';
import { Pane } from './ui/Pane';
import { RoutingBar } from './map/RoutingBar';
import { MapView, routesDrawn } from './map/MapView';
import { LOOK_SOURCE } from './map/routeOverlay';
import { RecordingCards } from './map/RecordingCards';
import { Toolbar } from './map/Toolbar';
import { flushSave, resetSaveState, savedSinceLoad, saveState } from './state/autosave';
import { folderOfTrip, libraryFolders, libraryTab, libraryTrips, relistTrips, rootOf, setOpening, showFolder, shownFolderId, showTab } from './state/library';
import { showingDuplicates } from './state/pane';
import { keepViewOf, readPlace, withPlace } from './state/place';
import { closeTrip, detailDayId, editingRouteId, endLook, loadTrip, lookAt, looked, lookedTripId, openTrip, openTripId, refreshLook, selectedDay, selectedDayId, type OpenAt } from './state/trip';
import { SectionDialog } from './trip/CollectionPanel';
import { DayDialog } from './trip/DayDialog';
import { DayPane } from './trip/DayPane';
import { ExportDialog } from './trip/ExportDialog';
import { JournalWorkspace } from './trip/JournalWorkspace';
import { QuickEntry } from './trip/QuickEntry';
import { UploadStatus } from './trip/UploadStatus';
import { partKeys } from './trip/partKeys';
import { RouteDialog } from './trip/RouteDialog';
import { SaveProblem } from './trip/SaveStatus';
import { StopDialog } from './trip/StopDialog';
import { TrackDialog } from './trip/TrackDialog';
import { TripDialog } from './trip/TripDialog';
import { ConfirmDialog } from './ui/ConfirmDialog';

export function App() {
  const [error, setError] = createSignal<string>();

  /** Counts the trips asked for and the leavings, so that a trip that arrives after the user went elsewhere is not opened. */
  let latest = 0;
  /** Opens a trip at the days and with the route `at` names; a trip open before is saved first, and stays open where that fails. */
  const open = async (id: number, at?: OpenAt) => {
    const ask = ++latest;
    /** Says on the trip's row how far the opening has come, while it is still the trip asked for. */
    const say = (progress: Progress | 'arrived') => void (ask === latest && setOpening({ tripId: id, progress }));
    say({ received: 0 });
    setError(undefined);
    try {
      await flushSave();
      if (saveState() === 'failed') return void (ask === latest && setOpening(undefined));
      // The trip left for this one is listed as it was saved, as when it is left for none.
      if (savedSinceLoad()) relistTrips();
      const trip = await fetchTrip(id, say);
      // Putting a large trip on the map keeps the browser busy: its row says so first, which takes a frame where the page is in view.
      say('arrived');
      if (!document.hidden) await new Promise((painted) => requestAnimationFrame(() => setTimeout(painted)));
      if (ask !== latest) return;
      keepPinsOfOpenTrip();
      loadTrip(trip, at);
      resetSaveState();
      // The trip is open; its row keeps saying that it opens until the map has drawn the routes.
      void routesDrawn().then(() => ask === latest && setOpening(undefined));
    } catch (e) {
      if (ask !== latest) return;
      setError(errorMessage(e));
      setOpening(undefined);
    }
  };
  /** The trip left with saves the library has not listed yet: looked at, it is newer than its listing. */
  let leftUnlisted: number | undefined;
  /** Looks at a trip, or at a day of it: read from the server, or looked at already, and drawn on the map, while the open trip stays open. */
  const look = async (id: number, dayId?: string) => {
    const ask = ++latest;
    leftUnlisted = undefined;
    if (lookedTripId() === id) {
      setOpening(undefined);
      return lookAt(looked()!.trip, dayId);
    }
    const say = (progress: Progress | 'arrived') => void (ask === latest && setOpening({ tripId: id, progress }));
    say({ received: 0 });
    setError(undefined);
    try {
      const trip = await fetchTrip(id, say);
      if (ask !== latest) return;
      lookAt(trip, dayId);
      void routesDrawn(LOOK_SOURCE).then(() => ask === latest && setOpening(undefined));
    } catch (e) {
      if (ask !== latest) return;
      setError(errorMessage(e));
      setOpening(undefined);
    }
  };
  /** The trip looked at as the library lists it: when it was last changed, null where it is listed no more, nothing while none is looked at or the trips are not listed. */
  const lookListed = () => {
    const id = lookedTripId();
    const trips = libraryTrips.error ? undefined : libraryTrips();
    return id === undefined || !trips ? undefined : ([id, trips.find((trip) => trip.id === id)?.updatedAt ?? null] as const);
  };
  // A trip looked at is read again once the library lists it as changed, and let go of once it lists it no more.
  createEffect(
    on(lookListed, (now, before) => {
      if (!now) return;
      const [id, changedAt] = now;
      if (changedAt === null) return endLook();
      if (before?.[0] !== id || before[1] === changedAt) return;
      if (leftUnlisted === id) leftUnlisted = undefined;
      else void fetchTrip(id).then(refreshLook);
    }),
  );
  /** Loads the open trip again from the server, after it was changed elsewhere. */
  const reload = () => open(openTrip()!.id);
  /**
   * Leaves the open trip, saved, and lists the trips afresh where a save changed one;
   * with `look`, a trip that is on the map stays there as it is, looked at. Answers
   * whether none is open any more: not where the save failed, which keeps the trip open.
   */
  const leave = async (look = false): Promise<boolean> => {
    latest++;
    setOpening(undefined);
    if (!openTrip()) return true;
    await flushSave();
    if (saveState() === 'failed') return false;
    const changed = savedSinceLoad();
    const [left, dayId] = [openTrip()!, selectedDay()?.id];
    keepPinsOfOpenTrip();
    closeTrip();
    if (look && left.kind === 'trip' && !looked()) {
      keepViewOf(left.id);
      lookAt(left, dayId);
      if (changed) leftUnlisted = left.id;
    }
    resetSaveState();
    if (changed) relistTrips();
    return true;
  };

  /** Opens a trip at a day from a report in the pane, which stays there; as a trip opened in the tree, it makes its folder the one shown. */
  const openLocation = (id: number, dayId: string) => {
    showFolder(folderOfTrip(id));
    void open(id, { dayId });
  };

  document.addEventListener('keydown', partKeys);
  onCleanup(() => document.removeEventListener('keydown', partKeys));

  /** Whether the page is back at the place its address named, from when on the address follows the place. */
  const [returned, setReturned] = createSignal(false);
  const place = readPlace(location.hash);
  // The folder the address names is shown once the folders are listed, which say whose tree it is in.
  let shown = false;
  createEffect(() => {
    if (shown || libraryFolders.loading) return;
    shown = true;
    untrack(() => {
      showFolder(place.folderId);
      if (place.view) showTab(place.view);
    });
  });
  onMount(async () => {
    // Back at the view the address names, the map stays there for the open trip and for the one looked at.
    const hasView = /(^#|&)map=/.test(location.hash);
    if (place.tripId !== undefined) {
      if (hasView) keepViewOf(place.tripId);
      await open(place.tripId, place);
    }
    if (place.lookId !== undefined) {
      if (hasView) keepViewOf(place.lookId);
      await look(place.lookId, place.lookDayId);
    }
    setReturned(true);
  });
  createEffect(() => {
    // The folder shown is only known once the folders are listed.
    if (!returned() || libraryFolders.loading) return;
    const tab = libraryTab();
    const now = { folderId: shownFolderId(), ...(isTreeTab(tab) ? {} : { view: tab }), tripId: openTripId(), dayId: selectedDayId(), routeId: editingRouteId(), detailDayId: detailDayId(), lookId: lookedTripId(), lookDayId: looked()?.dayId };
    history.replaceState(history.state, '', location.pathname + location.search + withPlace(location.hash, now));
  });

  /** What files dropped on the library beside its rows go to: the top of the tree shown, or the rides. */
  const dropFolder = () => {
    const tab = libraryTab();
    return isTreeTab(tab) ? String(rootOf(tab) ?? 'top') : undefined;
  };

  return (
    <>
      <Pane level="library" label={t('Library')} heading={<LibraryTabs onTab={(tab) => switchTab(tab, open)} />}>
        <div class="library-panel" data-drop-folder={dropFolder()} data-drop-rides={libraryTab() === 'recordings' ? '' : undefined}>
          <Explorer onOpen={(id, at) => void open(id, at)} onLook={(id, dayId) => void look(id, dayId)} onLeave={leave} error={error()} />
        </div>
      </Pane>
      <Show when={showingDuplicates()}>
        <DuplicatesReport onOpen={openLocation} />
      </Show>
      <DayPane onLeave={() => void leave(true)} />
      <div class="map-wrap">
        <MapView />
        <Show when={openTrip()}>
          <SaveProblem onReload={() => void reload()} />
        </Show>
        <RecordingCards />
        <RoutingBar />
        <Toolbar />
      </div>
      <ContextMenu />
      <Lightbox />
      <ConfirmDialog />
      <TripDialog />
      <DayDialog />
      <SectionDialog />
      <RouteDialog />
      <TrackDialog />
      <StopDialog />
      <ExportDialog />
      <QuickEntry />
      <JournalWorkspace />
      <UploadStatus />
      <PlaceKindDialog />
    </>
  );
}
