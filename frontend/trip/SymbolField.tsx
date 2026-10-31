import { createMemo, createSignal, For, Show } from 'solid-js';
import { FREE_COLOR } from '../map/routeOverlay';
import { GARMIN_GROUPS, garminPictureUrl, hasPicture, ourIcon, OUR_ICONS } from '../symbols/symbols';
import { StopShape } from '../ui/StopShape';

/**
 * A stop's symbol in its dialog: our icons, and behind a toggle all of Garmin's symbols with
 * their pictures, to search. The choice goes into the form as `symbol`, empty for none.
 */
export function SymbolField(props: { initial: string | null }) {
  const [chosen, setChosen] = createSignal(props.initial);
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const matches = (name: string) => name.toLowerCase().includes(query().trim().toLowerCase());
  return (
    <fieldset class="choices symbols">
      <legend>Symbol</legend>
      <input type="hidden" name="symbol" value={chosen() ?? ''} />
      <div class="our-symbols">
        <For each={OUR_ICONS}>
          {(o) => (
            <button type="button" class="row symbol" aria-pressed={chosen() === o.symbol} title={`${o.label} (Garmin: ${o.symbol})`} onClick={() => setChosen(o.symbol)}>
              <StopShape symbol={o.symbol} color={FREE_COLOR} height={30} />
              <span>{o.label}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={ourIcon(chosen()) === undefined}>
        <p class="row garmin-chosen">
          <StopShape symbol={chosen()} color={FREE_COLOR} height={24} />
          Garmin: {chosen()}
        </p>
      </Show>
      <button type="button" class="link more-symbols" aria-expanded={open()} onClick={() => setOpen(!open())}>
        {open() ? 'Fewer symbols' : 'More Garmin symbols…'}
      </button>
      <Show when={open()}>
        <input type="search" placeholder="Search Garmin symbols" aria-label="Search Garmin symbols" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
        <div class="garmin-symbols">
          <For each={GARMIN_GROUPS}>
            {(g) => {
              const names = createMemo(() => g.names.filter(matches));
              return (
                <Show when={names().length > 0}>
                  <h4>{g.title}</h4>
                  <div class="garmin-grid">
                    <For each={names()}>
                      {(name) => (
                        <button type="button" class="row symbol" aria-pressed={chosen() === name} onClick={() => setChosen(name)}>
                          <Show when={hasPicture(name)} fallback={<span class="no-picture" />}>
                            <img src={garminPictureUrl(name)} alt="" width="24" height="24" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                          </Show>
                          <span>{name}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              );
            }}
          </For>
          <Show when={!GARMIN_GROUPS.some((g) => g.names.some(matches))}>
            <p class="muted">No Garmin symbol matches.</p>
          </Show>
        </div>
      </Show>
    </fieldset>
  );
}
