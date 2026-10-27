import { createResource, createSignal, Show } from 'solid-js';
import { errorMessage, fetchMe, fetchTrip, logout } from './api';
import { Library } from './library/Library';
import { HintBar } from './map/HintBar';
import { MapView } from './map/MapView';
import { Toolbar } from './map/Toolbar';
import { flushSave, resetSaveState } from './state/autosave';
import { closeTrip, loadTrip, openTrip } from './state/trip';
import { StopDialog } from './trip/StopDialog';
import { TripPanel } from './trip/TripPanel';
import { ConfirmDialog } from './ui/ConfirmDialog';

export function App() {
  const [me] = createResource(fetchMe);
  const [opening, setOpening] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const open = async (id: number) => {
    setOpening(true);
    setError(undefined);
    try {
      loadTrip(await fetchTrip(id));
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
          <button type="button" class="link" onClick={logout}>
            Sign out
          </button>
        </header>
        <Show when={openTrip()} fallback={<Library onOpen={(id) => void open(id)} opening={opening()} error={error()} />}>
          <TripPanel onLeave={() => void leave()} onReload={() => void open(openTrip()!.id)} />
        </Show>
      </aside>
      <div class="map-wrap">
        <MapView />
        <HintBar />
        <Toolbar />
      </div>
      <ConfirmDialog />
      <StopDialog />
    </>
  );
}
