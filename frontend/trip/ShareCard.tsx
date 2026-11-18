import { createEffect, createMemo, createSignal, Match, on, onCleanup, Switch } from 'solid-js';
import { cardUrl, errorMessage, saveCard } from '../api';
import { t } from '../i18n/t';
import { cardPicture } from '../map/cardPicture';
import { placeNameAt } from '../map/nominatim';
import { cardDays, cardMark, dayEnds, destinationsOf } from '../model/shareCard';
import { cardMade, openPublication } from '../state/publication';
import { openTrip, openTripId } from '../state/trip';

/**
 * The card a link to the trip's page is shown with where it is posted, while the page is
 * shared: made anew by itself where the trip's name or the routes on its page are no
 * longer what it was made of, and shown as it is kept.
 */
/** How long what the card shows has to stay as it is before the card is made of it. */
const SETTLED_MS = 2000;

export function ShareCard() {
  const [making, setMaking] = createSignal(false);
  const [failure, setFailure] = createSignal<string>();
  // A save gives the trip another version and nothing else: the name and the days stay the ones they were.
  const name = createMemo(() => openTrip()?.name);
  const days = createMemo(() => openTrip()?.days);
  /** What the card would show now, and the mark of it; nothing for a page that is not shared or has no route. */
  const wanted = createMemo(() => {
    const publication = openPublication();
    if (name() === undefined || !publication?.token) return undefined;
    const shown = cardDays(days()!, publication.hiddenRouteIds);
    return shown.length === 0 ? undefined : { tripId: openTripId()!, name: name()!, days: shown, mark: cardMark(name()!, shown) };
  });
  /** The mark of the card made last, or tried: one that could not be made is not tried again until it would show something else. */
  let tried: string | undefined;
  const renew = async () => {
    const want = wanted();
    if (!want || want.mark === openPublication()!.card || want.mark === tried || making()) return;
    tried = want.mark;
    setMaking(true);
    setFailure(undefined);
    try {
      const destinations = await destinationsOf(dayEnds(want.days), placeNameAt);
      await saveCard(want.tripId, want.mark, await cardPicture(want.name, want.days, destinations));
      cardMade(want.tripId, want.mark);
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setMaking(false);
    }
  };
  // The card is made once what it shows has stayed for a while: a name is typed letter by letter. What changed while one was made waits its turn.
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on([() => wanted()?.mark, making], () => {
      clearTimeout(timer);
      timer = setTimeout(() => void renew(), SETTLED_MS);
    }),
  );
  onCleanup(() => clearTimeout(timer));
  return (
    <span class="share-card">
      <Switch>
        <Match when={making()}>{t('Making the share card…')}</Match>
        <Match when={failure()}>{(message) => <span class="error">{t('The share card could not be made: {error}', { error: message() })}</span>}</Match>
        <Match when={wanted() && openPublication()?.card}>
          {(mark) => (
            <a href={cardUrl(openTripId()!, mark())} target="_blank" rel="noopener" title={t('The picture the link is shown with where it is posted')}>
              <img src={cardUrl(openTripId()!, mark())} alt="" /> {t('Share card')}
            </a>
          )}
        </Match>
      </Switch>
    </span>
  );
}
