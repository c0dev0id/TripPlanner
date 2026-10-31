import { createResource, createSignal, For, Show } from 'solid-js';
import { errorMessage, fetchMe, fetchTrip, logout } from './api';
import { Explorer } from './library/Explorer';
import { ContextMenu } from './ui/ContextMenu';
import { Lightbox } from './ui/Lightbox';
import { PanelResizer } from './ui/PanelResizer';
import { HintBar } from './map/HintBar';
import { MapView } from './map/MapView';
import { RecordingCards } from './map/RecordingCards';
import { Toolbar } from './map/Toolbar';
import { flushSave, resetSaveState } from './state/autosave';
import { relistTrips } from './state/library';
import { closeTrip, loadTrip, openTrip } from './state/trip';
import { DayDialog } from './trip/DayDialog';
import { ExportDialog } from './trip/ExportDialog';
import { JournalDialog } from './trip/JournalDialog';
import { RouteDialog } from './trip/RouteDialog';
import { ShareDialog } from './trip/ShareDialog';
import { StopDialog } from './trip/StopDialog';
import { TrackDialog } from './trip/TrackDialog';
import { TripDialog } from './trip/TripDialog';
import { ConfirmDialog } from './ui/ConfirmDialog';
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
  /** Leaves the open trip, saved, for the list it was opened from, which lists the trips afresh; nothing without one. */
  const leave = async () => {
    latest++;
    setOpening(false);
    if (!openTrip()) return;
    await flushSave();
    closeTrip();
    resetSaveState();
    relistTrips();
  };

  return (
    <>
      <aside class="panel">
        <header class="panel-header">
          <h1>Trip Planner</h1>
          <Show when={me()}>{(user) => <span class="user">{user().email}</span>}</Show>
          <select class="theme" aria-label="Theme" title="Light or dark, or as the browser says" value={theme()} onChange={(e) => chooseTheme(e.currentTarget.value as Theme)}>
            <For each={THEMES}>{(t) => <option value={t.value}>{t.label}</option>}</For>
          </select>
          <button type="button" class="link" onClick={logout}>
            Sign out
          </button>
        </header>
        <Explorer onOpen={(id, dayId) => void open(id, dayId)} onLeave={leave} onReload={() => void reload()} opening={opening()} error={error()} />
      </aside>
      <div class="map-wrap">
        <PanelResizer />
        <MapView />
        <RecordingCards />
        <HintBar />
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
      <JournalDialog />
      <ShareDialog />
    </>
  );
}
