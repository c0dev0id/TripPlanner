import { createEffect, createResource, createSignal, onCleanup, onMount, Show, untrack } from 'solid-js';
import { errorMessage, fetchMe, fetchTrip, logout, type Progress } from './api';
import { DuplicatesReport } from './library/DuplicatesReport';
import { Explorer } from './library/Explorer';
import { ContextMenu } from './ui/ContextMenu';
import { Lightbox } from './ui/Lightbox';
import { PanelResizer } from './ui/PanelResizer';
import { RoutingBar } from './map/RoutingBar';
import { MapView, routesDrawn } from './map/MapView';
import { RecordingCards } from './map/RecordingCards';
import { Toolbar } from './map/Toolbar';
import { flushSave, resetSaveState, savedSinceLoad } from './state/autosave';
import { setPreferencesOpen } from './state/drawing';
import { libraryFolders, libraryTab, libraryTrips, relistTrips, rootOf, setOpening, showFolder, showingDuplicates, shownFolderId, showTab } from './state/library';
import { foldPanel, panelFolded } from './state/panel';
import { keepViewOf, readPlace, withPlace } from './state/place';
import { closeTrip, editingRouteId, takeUpRoute, loadTrip, openTrip, openTripId, selectedDay, selectedDayId } from './state/trip';
import { PreferencesDialog } from './preferences/PreferencesDialog';
import { DayDialog } from './trip/DayDialog';
import { DayPane } from './trip/DayPane';
import { DayStrip } from './trip/DayStrip';
import { ExportDialog } from './trip/ExportDialog';
import { JournalDialog } from './trip/JournalDialog';
import { partKeys } from './trip/partKeys';
import { RouteDialog } from './trip/RouteDialog';
import { SaveProblem, SaveState } from './trip/SaveStatus';
import { ShareDialog } from './trip/ShareDialog';
import { StopDialog } from './trip/StopDialog';
import { TrackDialog } from './trip/TrackDialog';
import { TripDialog } from './trip/TripDialog';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { IconButton } from './ui/IconButton';
import { MenuIcon } from './ui/icons';
import { t } from './i18n/t';

export function App() {
  const [me] = createResource(fetchMe);
  const [error, setError] = createSignal<string>();

  /** Counts the trips asked for and the leavings, so that a trip that arrives after the user went elsewhere is not opened. */
  let latest = 0;
  /** Opens a trip, at the day `dayId` where one is given, with that day's route `routeId` taken up; a trip open before is saved first. */
  const open = async (id: number, dayId?: string, routeId?: string) => {
    const ask = ++latest;
    /** Says on the trip's row how far the opening has come, while it is still the trip asked for. */
    const say = (progress: Progress | 'arrived') => void (ask === latest && setOpening({ tripId: id, progress }));
    say({ received: 0 });
    setError(undefined);
    try {
      await flushSave();
      // The trip left for this one is listed as it was saved, as when it is left for none.
      if (savedSinceLoad()) relistTrips();
      const trip = await fetchTrip(id, say);
      // Putting a large trip on the map keeps the browser busy: its row says so first, which takes a frame where the page is in view.
      say('arrived');
      if (!document.hidden) await new Promise((painted) => requestAnimationFrame(() => setTimeout(painted)));
      if (ask !== latest) return;
      loadTrip(trip, dayId);
      if (selectedDay()?.routes.some((route) => route.id === routeId)) takeUpRoute(routeId);
      resetSaveState();
      // The trip is open; its row keeps saying that it opens until the map has drawn the routes.
      void routesDrawn().then(() => ask === latest && setOpening(undefined));
    } catch (e) {
      if (ask !== latest) return;
      setError(errorMessage(e));
      setOpening(undefined);
    }
  };
  /** Loads the open trip again from the server, after it was changed elsewhere. */
  const reload = () => open(openTrip()!.id);
  /** Leaves the open trip, saved, and lists the trips afresh where a save changed one; nothing without one. */
  const leave = async () => {
    latest++;
    setOpening(undefined);
    if (!openTrip()) return;
    await flushSave();
    const changed = savedSinceLoad();
    closeTrip();
    resetSaveState();
    if (changed) relistTrips();
  };

  /** Opens a trip at a day from a report in the pane; as a trip opened in the tree, it makes its folder the one shown. */
  const openLocation = (id: number, dayId: string) => {
    showFolder(libraryTrips()?.find((trip) => trip.id === id)?.folderId ?? null);
    void open(id, dayId);
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
      if (place.recordings) showTab('recordings');
    });
  });
  onMount(async () => {
    if (place.tripId !== undefined) {
      if (/(^#|&)map=/.test(location.hash)) keepViewOf(place.tripId);
      await open(place.tripId, place.dayId, place.routeId);
    }
    setReturned(true);
  });
  createEffect(() => {
    // The folder shown is only known once the folders are listed.
    if (!returned() || libraryFolders.loading) return;
    const now = { folderId: shownFolderId(), recordings: libraryTab() === 'recordings', tripId: openTripId(), dayId: selectedDayId(), routeId: editingRouteId() };
    history.replaceState(history.state, '', location.pathname + location.search + withPlace(location.hash, now));
  });

  /** What files dropped on the library beside its rows go to: the top of the tree shown, or the rides. */
  const dropFolder = () => {
    const tab = libraryTab();
    return tab === 'recordings' ? undefined : String(rootOf(tab) ?? 'top');
  };

  return (
    <>
      <aside class="panel library-panel" classList={{ folded: panelFolded() }} data-drop-folder={dropFolder()} data-drop-rides={libraryTab() === 'recordings' ? '' : undefined}>
        <header class="panel-header">
          <IconButton label={t(panelFolded() ? 'Show the library' : 'Fold the library away')} pressed={!panelFolded()} onClick={() => foldPanel(!panelFolded())}>
            <MenuIcon />
          </IconButton>
          <Show when={openTrip()}>
            {(trip) => (
              <span class="open-trip">
                <span class="name">{trip().name}</span>
                <SaveState />
              </span>
            )}
          </Show>
          <h1>Trip Planner</h1>
          <Show when={me()}>{(user) => <span class="user">{user().email}</span>}</Show>
          <button type="button" class="link" onClick={() => setPreferencesOpen(true)}>
            {t('Preferences')}
          </button>
          <button type="button" class="link" onClick={logout}>
            {t('Sign out')}
          </button>
        </header>
        <Show when={panelFolded() && openTrip()}>
          <DayStrip />
        </Show>
        <Explorer onOpen={(id, dayId, routeId) => void open(id, dayId, routeId)} onLeave={leave} error={error()} />
      </aside>
      <Show when={showingDuplicates()} fallback={<DayPane />}>
        <DuplicatesReport onOpen={openLocation} />
      </Show>
      <div class="map-wrap">
        <PanelResizer />
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
      <RouteDialog />
      <TrackDialog />
      <StopDialog />
      <ExportDialog />
      <PreferencesDialog />
      <JournalDialog />
      <ShareDialog />
    </>
  );
}
