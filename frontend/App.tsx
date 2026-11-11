import { createEffect, createResource, createSignal, For, onMount, Show } from 'solid-js';
import { errorMessage, fetchMe, fetchTrip, logout } from './api';
import { Explorer } from './library/Explorer';
import { ContextMenu } from './ui/ContextMenu';
import { Lightbox } from './ui/Lightbox';
import { PanelResizer } from './ui/PanelResizer';
import { PoiBar } from './map/PoiBar';
import { PoiDialog } from './map/PoiDialog';
import { RoutingBar } from './map/RoutingBar';
import { MapView } from './map/MapView';
import { RecordingCards } from './map/RecordingCards';
import { Toolbar } from './map/Toolbar';
import { flushSave, resetSaveState, savedSinceLoad } from './state/autosave';
import { libraryFolders, relistTrips, showFolder, shownFolderId } from './state/library';
import { keepViewOf, readPlace, withPlace } from './state/place';
import { closeTrip, editingRouteId, editRoute, loadTrip, openTrip, openTripId, selectedDay, selectedDayId } from './state/trip';
import { DayDialog } from './trip/DayDialog';
import { ExportDialog } from './trip/ExportDialog';
import { JournalDialog } from './trip/JournalDialog';
import { RouteDialog } from './trip/RouteDialog';
import { ShareDialog } from './trip/ShareDialog';
import { StopDialog } from './trip/StopDialog';
import { TrackDialog } from './trip/TrackDialog';
import { TripDialog } from './trip/TripDialog';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { chooseLanguage, LANGUAGES, languageChoice, type Language } from './i18n/language';
import { t } from './i18n/t';
import { chooseTheme, theme, THEMES, type Theme } from './ui/theme';

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
      <aside class="panel">
        <header class="panel-header">
          <h1>Trip Planner</h1>
          <Show when={me()}>{(user) => <span class="user">{user().email}</span>}</Show>
          <select class="language" aria-label={t('Language')} title={t('German or English, or as the browser says')} value={languageChoice} onChange={(e) => chooseLanguage(e.currentTarget.value as Language | 'auto')}>
            <For each={LANGUAGES}>{(l) => <option value={l.value}>{l.label}</option>}</For>
          </select>
          <select class="theme" aria-label={t('Theme')} title={t('Light or dark, or as the browser says')} value={theme()} onChange={(e) => chooseTheme(e.currentTarget.value as Theme)}>
            <For each={THEMES}>{(choice) => <option value={choice.value}>{choice.label}</option>}</For>
          </select>
          <button type="button" class="link" onClick={logout}>
            {t('Sign out')}
          </button>
        </header>
        <Explorer onOpen={(id, dayId) => void open(id, dayId)} onLeave={leave} onReload={() => void reload()} opening={opening()} error={error()} />
      </aside>
      <div class="map-wrap">
        <PanelResizer />
        <MapView />
        <RecordingCards />
        <RoutingBar />
        <PoiBar />
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
      <PoiDialog />
      <JournalDialog />
      <ShareDialog />
    </>
  );
}
