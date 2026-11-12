import { createEffect, createResource, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import { errorMessage, fetchMe, fetchTrip, logout } from './api';
import { DuplicatesReport } from './library/DuplicatesReport';
import { Explorer } from './library/Explorer';
import { ContextMenu } from './ui/ContextMenu';
import { Lightbox } from './ui/Lightbox';
import { PanelResizer } from './ui/PanelResizer';
import { RoutingBar } from './map/RoutingBar';
import { MapView } from './map/MapView';
import { RecordingCards } from './map/RecordingCards';
import { Toolbar } from './map/Toolbar';
import { flushSave, resetSaveState, savedSinceLoad } from './state/autosave';
import { setPreferencesOpen } from './state/drawing';
import { libraryFolders, relistTrips, showFolder, shownFolderId, showingDuplicates } from './state/library';
import { foldPanel, onPhone, panelFolded } from './state/panel';
import { keepViewOf, readPlace, withPlace } from './state/place';
import { closeTrip, editingRouteId, editRoute, loadTrip, openTrip, openTripId, selectedDay, selectedDayId } from './state/trip';
import { PreferencesDialog } from './preferences/PreferencesDialog';
import { DayDialog } from './trip/DayDialog';
import { DayPane } from './trip/DayPane';
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
  const [opening, setOpening] = createSignal(false);
  const [error, setError] = createSignal<string>();

  /** Counts the trips asked for and the leavings, so that a trip that arrives after the user went elsewhere is not opened. */
  let latest = 0;
  /** Opens a trip, at the day `dayId` where one is given; a trip open before is saved first. */
  const open = async (id: number, dayId?: string) => {
    const ask = ++latest;
    setOpening(true);
    setError(undefined);
    try {
      await flushSave();
      const trip = await fetchTrip(id);
      if (ask !== latest) return;
      loadTrip(trip, dayId);
      resetSaveState();
    } catch (e) {
      if (ask === latest) setError(errorMessage(e));
    } finally {
      if (ask === latest) setOpening(false);
    }
  };
  /** Loads the open trip again from the server, after it was changed elsewhere. */
  const reload = () => open(openTrip()!.id);
  /** Leaves the open trip, saved, for the list it was opened from, which lists the trips afresh where a save changed one; nothing without one. */
  const leave = async () => {
    latest++;
    setOpening(false);
    if (!openTrip()) return;
    await flushSave();
    const changed = savedSinceLoad();
    closeTrip();
    resetSaveState();
    if (changed) relistTrips();
  };

  // On a phone the library lies over the map: a day picked in it, or the duplicates report asked for, is shown by folding it away.
  createEffect(on(selectedDayId, (id) => id && onPhone() && foldPanel(true)));
  createEffect(on(showingDuplicates, (shown) => shown && onPhone() && foldPanel(true)));

  document.addEventListener('keydown', partKeys);
  onCleanup(() => document.removeEventListener('keydown', partKeys));

  /** Whether the page is back at the place its address named, from when on the address follows the place. */
  const [returned, setReturned] = createSignal(false);
  onMount(async () => {
    const place = readPlace(location.hash);
    showFolder(place.folderId);
    if (place.tripId !== undefined) {
      if (/(^#|&)map=/.test(location.hash)) keepViewOf(place.tripId);
      await open(place.tripId, place.dayId);
      if (selectedDay()?.routes.some((route) => route.id === place.routeId)) editRoute(place.routeId);
    }
    setReturned(true);
  });
  createEffect(() => {
    // The folder shown is only known once the folders are listed.
    if (!returned() || libraryFolders.loading) return;
    const place = { folderId: shownFolderId(), tripId: openTripId(), dayId: selectedDayId(), routeId: editingRouteId() };
    history.replaceState(history.state, '', location.pathname + location.search + withPlace(location.hash, place));
  });

  return (
    <>
      <aside class="panel library-panel" classList={{ folded: panelFolded() }}>
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
        <Explorer onOpen={(id, dayId) => void open(id, dayId)} onLeave={leave} opening={opening()} error={error()} />
      </aside>
      <Show when={showingDuplicates()} fallback={<DayPane />}>
        <DuplicatesReport onOpen={(id, dayId) => void open(id, dayId)} disabled={opening()} />
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
