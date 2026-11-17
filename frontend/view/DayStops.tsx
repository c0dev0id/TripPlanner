import { t } from '../i18n/t';
import { createMemo, For, Show } from 'solid-js';
import type { Day } from '../model/trip';
import { webAddress } from '../poi/details';
import { routesDistance } from '../routing/legs';
import { daySequence, standingAlone } from '../routing/sequence';
import { dayTimeline } from '../routing/timeline';
import { symbolLabel } from '../symbols/symbols';
import { offTime, timelineText, timesText } from '../trip/labels';
import { distanceText, timeText } from '../ui/format';

/** A day in a line: how far it goes and when it starts and ends, where it has times. */
export function daySummary(day: Day): string {
  const distance = routesDistance(day.routes);
  const timeline = dayTimeline(daySequence(day));
  return [distance > 0 && distanceText(distance), timeline && timelineText(timeline)].filter(Boolean).join(' · ');
}

/** A day's stops in riding order, then those that stand alone: each by its name with its times, its distance from the day's start and what the planner noted about it. */
export function DayStops(props: { day: Day }) {
  const sequence = createMemo(() => daySequence(props.day));
  const timeline = createMemo(() => dayTimeline(sequence()));
  const stops = () => [
    ...sequence().flatMap((e) => (e.stop ? [{ stop: e.stop, distanceM: e.distanceM as number | undefined }] : [])),
    ...standingAlone(props.day, sequence()).map((stop) => ({ stop, distanceM: undefined })),
  ];
  return (
    <ol class="stops">
      <For each={stops()}>
        {({ stop, distanceM }) => {
          const times = () => {
            const time = timeline()?.times.get(stop.id);
            if (!time) return '';
            const off = offTime(time);
            return off ? `${timesText(time)} (${t('{off}, arrives {time}', { off: off.text, time: timeText(off.rideMin) })})` : timesText(time);
          };
          const detail = () => [times(), distanceM !== undefined && distanceText(distanceM), symbolLabel(stop.symbol), stop.optional && t('optional')].filter(Boolean).join(' · ');
          return (
            <li>
              <span class="name">{stop.name}</span>
              <Show when={detail()}>
                <span class="muted"> {detail()}</span>
              </Show>
              <Show when={stop.address}>
                <span class="line">{stop.address}</span>
              </Show>
              <Show when={stop.contact}>
                <span class="line">{stop.contact}</span>
              </Show>
              <Show when={stop.bookingReference}>
                <span class="line">{t('Booking {ref}', { ref: stop.bookingReference })}</span>
              </Show>
              <Show when={stop.notes}>
                <span class="line">{stop.notes}</span>
              </Show>
              <Show when={webAddress(stop.website)}>
                {(address) => (
                  <a class="line" href={address()} target="_blank" rel="noopener noreferrer">
                    {t('Website')}
                  </a>
                )}
              </Show>
            </li>
          );
        }}
      </For>
    </ol>
  );
}
