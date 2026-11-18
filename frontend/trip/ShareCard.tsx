import { createEffect, createSignal, Match, on, Switch } from 'solid-js';
import { cardUrl, errorMessage, saveCard } from '../api';
import { t } from '../i18n/t';
import { cardPicture } from '../map/cardPicture';
import { placeNameAt } from '../map/nominatim';
import { cardDays, cardMark, dayEnds, destinationsOf } from '../model/shareCard';
import { cardMade, openPublication } from '../state/publication';
import { openTrip } from '../state/trip';

/**
 * The card a link to the trip's page is shown with where it is posted, while the page is
 * shared: made anew by itself where the trip's name or the routes on its page are no
 * longer what it was made of, and shown as it is kept.
 */
export function ShareCard() {
  const [state, setState] = createSignal<'making' | { failed: string }>();
  /** What the card would show now, and the mark of it; nothing for a page that is not shared or has no route. */
  const wanted = () => {
    const [trip, publication] = [openTrip(), openPublication()];
    if (!trip || !publication?.token) return undefined;
    const days = cardDays(trip, publication.hiddenRouteIds);
    return days.length === 0 ? undefined : { tripId: trip.id, name: trip.name, days, mark: cardMark(trip.name, days) };
  };
  const renew = async () => {
    const want = wanted();
    if (!want || want.mark === openPublication()!.card || state() === 'making') return;
    setState('making');
    try {
      const destinations = await destinationsOf(dayEnds(want.days), placeNameAt);
      await saveCard(want.tripId, want.mark, await cardPicture(want.name, want.days, destinations));
      cardMade(want.tripId, want.mark);
      setState(undefined);
    } catch (e) {
      return void setState({ failed: errorMessage(e) });
    }
    // What changed while the card was made is made a card of in turn.
    void renew();
  };
  createEffect(on(() => wanted()?.mark, () => void renew()));
  const failed = () => {
    const now = state();
    return typeof now === 'object' && now.failed;
  };
  return (
    <span class="share-card">
      <Switch>
        <Match when={state() === 'making'}>{t('Making the share card…')}</Match>
        <Match when={failed()}>{(message) => <span class="error">{t('The share card could not be made: {error}', { error: message() })}</span>}</Match>
        <Match when={wanted() && openPublication()?.card}>
          {(mark) => (
            <a href={cardUrl(openTrip()!.id, mark())} target="_blank" rel="noopener" title={t('The picture the link is shown with where it is posted')}>
              <img src={cardUrl(openTrip()!.id, mark())} alt="" /> {t('Share card')}
            </a>
          )}
        </Match>
      </Switch>
    </span>
  );
}
