import { createResource, createSignal, For, Show } from 'solid-js';
import { createTrip, deleteTrip, errorMessage, listTrips } from '../api';
import { askConfirmation } from '../ui/confirm';
import { dateText } from '../ui/format';
import { DeleteIcon } from '../ui/icons';

/** The user's trips: open one, start a new one, delete one. */
export function Library(props: { onOpen: (id: number) => void; opening: boolean; error: string | undefined }) {
  const [trips, { refetch }] = createResource(listTrips);
  const [name, setName] = createSignal('');
  const [busy, setBusy] = createSignal<string>();

  const create = async (e: SubmitEvent) => {
    e.preventDefault();
    const tripName = name().trim();
    if (!tripName) return;
    setBusy(undefined);
    try {
      const trip = await createTrip(tripName);
      setName('');
      props.onOpen(trip.id);
    } catch (error) {
      setBusy(errorMessage(error));
    }
  };
  const remove = async (id: number, tripName: string) => {
    if (!(await askConfirmation(`Delete the trip “${tripName}” with all its days?`, 'Delete'))) return;
    try {
      await deleteTrip(id);
      void refetch();
    } catch (error) {
      setBusy(errorMessage(error));
    }
  };

  return (
    <section class="library">
      <h2>Trips</h2>
      <form class="row" onSubmit={create}>
        <input class="grow" placeholder="Name of a new trip" value={name()} onInput={(e) => setName(e.currentTarget.value)} aria-label="Name of a new trip" maxlength={200} />
        <button type="submit" class="primary" disabled={!name().trim() || props.opening}>
          New trip
        </button>
      </form>
      <Show when={busy() ?? props.error}>{(message) => <p class="error">{message()}</p>}</Show>
      <Show when={trips.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Show>
      <Show when={trips()} fallback={<p class="muted">Loading…</p>}>
        {(list) => (
          <Show when={list().length > 0} fallback={<p class="muted">No trips yet. Name one above to start planning.</p>}>
            <ul class="trips">
              <For each={list()}>
                {(trip) => (
                  <li class="row">
                    <button class="text grow" onClick={() => props.onOpen(trip.id)} disabled={props.opening}>
                      <span class="name">{trip.name}</span>
                      <span class="muted">
                        {trip.dayCount} {trip.dayCount === 1 ? 'day' : 'days'}
                        {trip.startsOn ? ` · from ${dateText(trip.startsOn)}` : ''}
                      </span>
                    </button>
                    <button class="icon" title="Delete trip" aria-label={`Delete ${trip.name}`} onClick={() => void remove(trip.id, trip.name)}>
                      <DeleteIcon />
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        )}
      </Show>
    </section>
  );
}
