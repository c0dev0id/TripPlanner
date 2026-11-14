import { t } from '../i18n/t';
import { createMemo, Show } from 'solid-js';
import { MAX_WEBSITE, type Stop } from '../model/trip';
import { webAddress } from '../poi/details';
import { editTarget, setEditTarget } from '../state/drawing';
import { openTrip, removeStop, selectedDay, updateStop } from '../state/trip';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';
import { SymbolField } from './SymbolField';

/** A stop of the selected day: name, symbol, address, contact, website, notes and, in a trip, arrival time and pause, booking and whether it is optional; and its removal. */
export function StopDialog() {
  const stop = createMemo((): Stop | undefined => {
    const target = editTarget();
    return target?.kind === 'stop' ? selectedDay()?.stops.find((s) => s.id === target.id) : undefined;
  });
  const close = () => setEditTarget(undefined);
  /** What belongs to a ride is asked of a trip's stop only: when to arrive, how long to stay, the booking, whether it is optional. */
  const ridden = () => openTrip()?.kind === 'trip';
  const save = (form: FormData, s: Stop) => {
    const pause = field(form, 'pauseMinutes');
    updateStop(s.id, {
      name: field(form, 'name') || s.name,
      symbol: field(form, 'symbol') || null,
      address: field(form, 'address'),
      contact: field(form, 'contact'),
      website: field(form, 'website'),
      notes: field(form, 'notes'),
      ...(ridden() && {
        arriveAt: field(form, 'arriveAt') || null,
        pauseMinutes: pause === '' ? null : Number(pause),
        optional: form.get('optional') === 'on',
        bookingReference: field(form, 'bookingReference'),
      }),
    });
  };
  const remove = (s: Stop) => {
    removeStop(s.id);
    close();
  };
  return (
    <EditDialog label={t('Stop')} value={stop()} title={(s) => s.name} onClose={close} onSubmit={save} actions={(s) => [{ label: t('Remove'), run: () => remove(s), danger: true }]}>
      {(s) => (
        <>
          <label>
            {t('Name')}
            <input name="name" value={s.name} maxlength={200} required />
          </label>
          <SymbolField initial={s.symbol} />
          <Show when={ridden()}>
            <div class="row">
              <label class="grow">
                {t('Arrive at')}
                <input type="time" name="arriveAt" value={s.arriveAt ?? ''} />
              </label>
              <label class="grow">
                {t('Pause (minutes)')}
                <input type="number" name="pauseMinutes" min={0} max={1440} step={5} value={s.pauseMinutes ?? ''} />
              </label>
            </div>
          </Show>
          <label>
            {t('Address')}
            <textarea name="address" rows={2}>
              {s.address}
            </textarea>
          </label>
          <label>
            {t('Contact')}
            <input name="contact" value={s.contact} />
          </label>
          <Show when={ridden()}>
            <label>
              {t('Booking reference')}
              <input name="bookingReference" value={s.bookingReference} />
            </label>
          </Show>
          <label>
            <span>
              {t('Website')}
              <Show when={webAddress(s.website)}>
                {(address) => (
                  <>
                    {' · '}
                    <a href={address()} target="_blank" rel="noopener noreferrer">
                      {t('Open')}
                    </a>
                  </>
                )}
              </Show>
            </span>
            <input name="website" inputmode="url" value={s.website} maxlength={MAX_WEBSITE} />
          </label>
          <label>
            {t('Notes')}
            <textarea name="notes" rows={3}>
              {s.notes}
            </textarea>
          </label>
          <Show when={ridden()}>
            <label class="toggle">
              <input type="checkbox" name="optional" checked={s.optional} /> {t('Optional: a stop to decide on the day, left out of an export on request')}
            </label>
          </Show>
        </>
      )}
    </EditDialog>
  );
}
