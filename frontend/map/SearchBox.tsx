import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { createSignal, For, onCleanup, Show } from 'solid-js';
import { errorMessage } from '../api';
import { spotItems } from '../state/drawing';
import { CloseIcon, SearchIcon } from '../ui/icons';
import { setMenu } from '../ui/menu';
import { NOMINATIM_ATTRIBUTION, NOMINATIM_MIN_INTERVAL_MS, parsePlaces, searchUrl, type Bounds, type Place } from './nominatim';

/** When the last search went out, to keep to Nominatim's one request per second. */
let lastSearch = 0;
const SEARCH_TIMEOUT_MS = 15_000;
const PIN_COLOR = '#b4440f';

/**
 * Searches places and addresses with Nominatim, preferring those in view, on Enter. The
 * first place found gets a pin and the map flies to it; the list offers the others. The
 * pin stays until the search is cleared; while a route is edited, its menu adds a point
 * or a stop there. Narrow screens show a button that opens the box.
 */
export function SearchBox(props: { map: MapLibreMap }) {
  const map = props.map;
  const [query, setQuery] = createSignal('');
  const [places, setPlaces] = createSignal<Place[]>();
  const [shown, setShown] = createSignal<Place>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [open, setOpen] = createSignal(false);
  const pin = new Marker({ color: PIN_COLOR });
  pin.getElement().classList.add('search-pin');
  pin.getElement().addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const items = shown() && spotItems(shown()!.lngLat);
    if (items) setMenu({ x: e.clientX, y: e.clientY, touch: false, items });
  });
  let input!: HTMLInputElement;

  const show = (place: Place) => {
    setShown(place);
    pin.setLngLat(place.lngLat).addTo(map);
    pin.getElement().title = place.label;
    if (place.bounds) map.fitBounds(place.bounds, { padding: 40, maxZoom: 15 });
    else map.flyTo({ center: place.lngLat, zoom: 14 });
  };

  const search = async () => {
    const text = query().trim();
    if (!text || busy()) return;
    setBusy(true);
    setError(undefined);
    try {
      const wait = lastSearch + NOMINATIM_MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastSearch = Date.now();
      const view = map.getBounds();
      const near: Bounds = [Math.max(-180, view.getWest()), view.getSouth(), Math.min(180, view.getEast()), view.getNorth()];
      const response = await fetch(searchUrl(text, near), { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
      const found = parsePlaces(await response.json());
      setPlaces(found);
      if (found[0]) show(found[0]);
      else setError(`Nothing found for “${text}”.`);
    } catch (fault) {
      setError(errorMessage(fault));
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setQuery('');
    setPlaces(undefined);
    setShown(undefined);
    setError(undefined);
    pin.remove();
    setOpen(false);
  };

  // The list closes once the map is moved by hand; the flight to a place leaves it open.
  const onMoveStart = (e: { originalEvent?: Event }) => {
    if (!e.originalEvent) return;
    setPlaces(undefined);
    setOpen(false);
  };
  const fold = () => setOpen(false);
  map.on('movestart', onMoveStart);
  map.on('click', fold);
  onCleanup(() => {
    map.off('movestart', onMoveStart);
    map.off('click', fold);
    pin.remove();
  });

  return (
    <div class="place-search" classList={{ open: open() }}>
      <button
        type="button"
        class="search-toggle"
        title="Search a place or address"
        aria-label="Search a place or address"
        onClick={() => {
          setOpen(true);
          input.focus();
        }}
      >
        <SearchIcon />
      </button>
      <form
        class="search-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          ref={input}
          type="text"
          enterkeyhint="search"
          placeholder="Search a place or address"
          aria-label="Search a place or address"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            if (places()) setPlaces(undefined);
            else setOpen(false);
          }}
        />
        <Show when={query() || shown()}>
          <button type="button" class="icon" title="Clear the search and its pin" aria-label="Clear the search" onClick={clear}>
            <CloseIcon />
          </button>
        </Show>
        <button type="submit" class="icon" title="Search" aria-label="Search" disabled={busy()}>
          <SearchIcon />
        </button>
      </form>
      <Show when={error()}>{(message) => <p class="search-note">{message()}</p>}</Show>
      <Show when={places()?.length}>
        <ul class="search-results">
          <For each={places()}>
            {(place) => (
              <li>
                <button
                  type="button"
                  classList={{ current: shown() === place }}
                  onClick={() => {
                    show(place);
                    setPlaces(undefined);
                  }}
                >
                  {place.label}
                </button>
              </li>
            )}
          </For>
          <li class="search-note">{NOMINATIM_ATTRIBUTION}</li>
        </ul>
      </Show>
    </div>
  );
}
