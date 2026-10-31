import { createResource, createSignal, For, Show } from 'solid-js';
import { errorMessage, fetchMe, fetchTrip, logout } from './api';
import { Library } from './library/Library';
import { ContextMenu } from './ui/ContextMenu';
import { Lightbox } from './ui/Lightbox';
import { PanelResizer } from './ui/PanelResizer';
import { HintBar } from './map/HintBar';
import { MapView } from './map/MapView';
import { RecordingCards } from './map/RecordingCards';
import { Toolbar } from './map/Toolbar';
import { flushSave, resetSaveState } from './state/autosave';
import { closeTrip, loadTrip, openTrip } from './state/trip';
import { CollectionPanel } from './trip/CollectionPanel';
import { DayDialog } from './trip/DayDialog';
import { ExportDialog } from './trip/ExportDialog';
import { JournalDialog } from './trip/JournalDialog';
import { RouteDialog } from './trip/RouteDialog';
import { ShareDialog } from './trip/ShareDialog';
import { StopDialog } from './trip/StopDialog';
import { TrackDialog } from './trip/TrackDialog';
import { TripDialog } from './trip/TripDialog';
import { TripPanel } from './trip/TripPanel';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { chooseTheme, theme, THEMES, type Theme } from './ui/theme';

export function App() {
  const [me] = createResource(fetchMe);
  const [opening, setOpening] = createSignal(false);
  const [error, setError] = createSignal<string>();

  /** Opens a trip, at the day `dayId` where one is given. */
  const open = async (id: number, dayId?: string) => {
    setOpening(true);
    setError(undefined);
    try {
      loadTrip(await fetchTrip(id), dayId);
      resetSaveState();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setOpening(false);
    }
  };
  const leave = async () => {
    await flushSave();
    closeTrip();
    resetSaveState();
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
        <Show when={openTrip()} fallback={<Library onOpen={(id, dayId) => void open(id, dayId)} opening={opening()} error={error()} />}>
          <Show when={openTrip()?.kind === 'collection'} fallback={<TripPanel onLeave={() => void leave()} onReload={() => void open(openTrip()!.id)} />}>
            <CollectionPanel onLeave={() => void leave()} onReload={() => void open(openTrip()!.id)} />
          </Show>
        </Show>
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
