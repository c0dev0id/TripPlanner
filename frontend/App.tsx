import { createResource, Show } from 'solid-js';
import { fetchMe, logout } from './api';
import { MapView } from './map/MapView';

export function App() {
  const [me] = createResource(fetchMe);
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
        <section>
          <h2>Trips</h2>
          <p class="muted">No trips yet.</p>
        </section>
      </aside>
      <MapView />
    </>
  );
}
