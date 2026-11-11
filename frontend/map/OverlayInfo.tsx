import type { Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, on, Show } from 'solid-js';
import { t } from '../i18n/t';
import { dateText } from '../ui/format';
import { CLOSURE_LAYERS, ROADWORKS_LAYERS, shownOverlays } from './overlays';
import { popupOnTap } from './tapPopup';

/** A property as text, where it has one. */
const text = (properties: Record<string, unknown>, key: string): string | undefined => {
  const value = properties[key];
  return typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : undefined;
};

/** The day of an ISO date and time. */
const day = (iso: string | undefined): string | undefined => iso && dateText(iso.slice(0, 10));

/**
 * What the two services say about roadworks: Rhineland-Palatinate's in German field names,
 * Baden-Württemberg's in English ones.
 */
function Roadworks(props: { site: Record<string, unknown> }) {
  const of = (...keys: string[]) => keys.map((key) => text(props.site, key)).find((value) => value !== undefined);
  const from = day(of('von', 'starttime'));
  const until = day(of('bis', 'endtime'));
  const closed = props.site['type'] === 'ROAD_CLOSED';
  return (
    <div>
      <h4>{of('strasse', 'street') ?? t('Roadworks')}</h4>
      <Show when={of('art_der_arbeiten') ?? (closed ? t('Road closed') : undefined)}>{(kind) => <p>{kind()}</p>}</Show>
      <Show when={of('beschreibung', 'description')}>{(description) => <p>{description()}</p>}</Show>
      <Show when={from && until}>
        <p>
          {from} – {until}
        </p>
      </Show>
      <Show when={of('speedlimit')}>{(limit) => <p>{t('Speed limit {limit} km/h', { limit: limit() })}</p>}</Show>
      <Show when={of('quelle', 'reference')}>{(source) => <p class="muted">{source()}</p>}</Show>
    </div>
  );
}

/** Says what a closure or roadworks tapped on the map are. */
export function OverlayInfo(props: { map: MapLibreMap }) {
  const closure = popupOnTap(props.map, CLOSURE_LAYERS, (properties) => {
    // The source's descriptions are HTML; only their text is shown.
    const description = new DOMParser().parseFromString(text(properties, 'description') ?? '', 'text/html').body.textContent?.trim();
    return (
      <div>
        <h4>{text(properties, 'name')}</h4>
        {description && <p>{description}</p>}
      </div>
    ) as Node;
  });
  const roadworks = popupOnTap(props.map, ROADWORKS_LAYERS, (site) => (<Roadworks site={site} />) as Node);
  // A popup does not outlive its overlay being switched off.
  createEffect(
    on(shownOverlays, () => {
      closure.remove();
      roadworks.remove();
    }),
  );
  return null;
}
