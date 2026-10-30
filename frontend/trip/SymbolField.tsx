import { createMemo, createSignal, For, Show } from 'solid-js';
import { FREE_COLOR } from '../map/routeOverlay';
import { GARMIN_GROUPS, garminPictureUrl, ourIcon, OUR_ICONS } from '../symbols/symbols';
import { StopShape } from '../ui/StopShape';

/**
 * A stop's symbol in its dialog: our icons, and behind a toggle all of Garmin's symbols with
 * their pictures, to search. The choice goes into the form as `symbol`, empty for none.
 */
export function SymbolField(props: { initial: string | null }) {
  const [chosen, setChosen] = createSignal(props.initial);
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  /** Garmin's groups with the symbols whose names hold the query. */
  const shown = createMemo(() => {
    const q = query().trim().toLowerCase();
    return GARMIN_GROUPS.map((g) => ({ title: g.title, names: g.names.filter((n) => n.toLowerCase().includes(q)) })).filter((g) => g.names.length > 0);
  });
  return (
    <fieldset class="symbols">
      <legend>Symbol</legend>
      <input type="hidden" name="symbol" value={chosen() ?? ''} />
      <div class="our-symbols">
        <For each={OUR_ICONS}>
          {(o) => (
            <button type="button" class="symbol" aria-pressed={chosen() === o.symbol} title={`${o.label} (Garmin: ${o.symbol})`} onClick={() => setChosen(o.symbol)}>
              <StopShape symbol={o.symbol} color={FREE_COLOR} height={30} />
              <span>{o.label}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={chosen() !== null && ourIcon(chosen()) === undefined}>
        <p class="garmin-chosen">
          <img src={garminPictureUrl(chosen()!)} alt="" width="24" height="24" />
          Garmin: {chosen()}
        </p>
      </Show>
      <button type="button" class="more-symbols" aria-expanded={open()} onClick={() => setOpen(!open())}>
        {open() ? 'Fewer symbols' : 'More Garmin symbols…'}
      </button>
      <Show when={open()}>
        <input type="search" placeholder="Search Garmin symbols" aria-label="Search Garmin symbols" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
        <div class="garmin-symbols">
          <For each={shown()} fallback={<p class="muted">No Garmin symbol matches.</p>}>
            {(g) => (
              <>
                <h4>{g.title}</h4>
                <div class="garmin-grid">
                  <For each={g.names}>
                    {(name) => (
                      <button type="button" class="symbol" aria-pressed={chosen() === name} onClick={() => setChosen(name)}>
                        <img src={garminPictureUrl(name)} alt="" width="24" height="24" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                        <span>{name}</span>
                      </button>
                    )}
                  </For>
                </div>
              </>
            )}
          </For>
        </div>
      </Show>
    </fieldset>
  );
}
