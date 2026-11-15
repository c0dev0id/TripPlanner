import { createSignal, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { poiBadgeUrl } from '../map/poiImages';
import { POI_CATEGORIES } from '../poi/categories';
import { ownKinds } from '../state/ownPlaces';
import { cyclePlaceMode, isTooFarOut, placeMode, type PlaceMode } from '../state/places';
import { changePlaceKind, placeIcon, placeReachM } from '../state/preferences';
import { EditDialog } from '../ui/EditDialog';
import { EyeIcon, EyeOffIcon, GearIcon, RouteIcon } from '../ui/icons';
import { IconButton } from '../ui/IconButton';

/** The farthest a place may be from a route and still be shown along it, in kilometres. */
const MAX_KM = 20;

/** A kind of place whose settings are edited: one of the store's by its id, or a section of a list of the user's own (`own`). */
interface EditedKind {
  id: string;
  name: string;
  own: boolean;
}

const [edited, setEdited] = createSignal<EditedKind>();

/** What a kind's switch says the map shows of it. */
const MODE_TEXT: Record<PlaceMode, string> = {
  all: t('All on the map'),
  along: t("Along the day's routes"),
  none: t('Not on the map'),
};

/** The address of the badge picked for a kind of place, none where none is picked. */
export function pickedBadgeUrl(kind: string): string | undefined {
  const category = POI_CATEGORIES.find((each) => each.id === placeIcon(kind));
  return category && poiBadgeUrl(category);
}

/** The look of a kind of place: the badge picked for it, else that of the store's kind of the id, else a dot in its list's colour. */
export function PlaceKindMark(props: { id: string }) {
  const badge = () => pickedBadgeUrl(props.id) ?? POI_CATEGORIES.filter((category) => category.id === props.id).map(poiBadgeUrl)[0];
  const color = () => ownKinds().find((kind) => kind.dayId === props.id)?.color ?? 'transparent';
  return (
    <Show when={badge()} fallback={<span class="own-dot" style={{ background: color() }} />}>
      {(url) => <img class="poi-badge" src={url()} alt="" />}
    </Show>
  );
}

/** A kind's switch through all, along the day's routes and none on the map, and the gear to its settings. */
export function PlaceKindControls(props: EditedKind) {
  const mode = () => placeMode(props.id);
  return (
    <>
      <IconButton label={t('{name}: {mode}', { name: props.name, mode: MODE_TEXT[mode()] })} pressed={mode() !== 'none'} onClick={() => cyclePlaceMode(props.id)}>
        <Show when={mode() === 'all'} fallback={mode() === 'along' ? <RouteIcon /> : <EyeOffIcon />}>
          <EyeIcon />
        </Show>
      </IconButton>
      <IconButton label={t('Settings of {name}', { name: props.name })} onClick={() => setEdited({ id: props.id, name: props.name, own: props.own })}>
        <GearIcon />
      </IconButton>
    </>
  );
}

/** The store's kinds of places, on top of the Places tab, each with its switch and its settings. */
export function StandardPlaces() {
  return (
    <section class="standard-places">
      <h3>{t('Standard')}</h3>
      <ul>
        <For each={POI_CATEGORIES}>
          {(category) => (
            <li class="row place-kind">
              <PlaceKindMark id={category.id} />
              <span class="grow">{category.label}</span>
              <PlaceKindControls id={category.id} name={category.label} own={false} />
            </li>
          )}
        </For>
      </ul>
      <Show when={isTooFarOut()}>
        <p class="muted">{t('Zoom in to see places.')}</p>
      </Show>
    </section>
  );
}

/** The settings of a kind of place: how far from a route its places are still shown along it, and the badge they are drawn with. */
export function PlaceKindDialog() {
  const save = (form: FormData, kind: EditedKind) => {
    const reach = Math.round(Math.max(0.1, Math.min(MAX_KM, Number(form.get('reach')) || 0.2)) * 1000);
    const picked = POI_CATEGORIES.find((category) => category.id === form.get('icon'))?.id;
    // A kind's own look is kept as no choice: the store's kind its own badge, a list's kind its dot.
    void changePlaceKind(kind.id, reach, picked === kind.id ? undefined : picked);
  };
  return (
    <EditDialog label={t('Settings of a kind of place')} value={edited()} title={(kind) => kind.name} onClose={() => setEdited(undefined)} onSubmit={save}>
      {(kind) => (
        <>
          <label>
            {t('Along a route: how far from it, in km')}
            <input type="number" name="reach" min={0.1} max={MAX_KM} step={0.1} value={placeReachM(kind.id) / 1000} />
          </label>
          <fieldset class="choices place-icons">
            <legend>{t('Icon')}</legend>
            <Show when={kind.own}>
              <label>
                <input type="radio" name="icon" value="" checked={placeIcon(kind.id) === undefined} />
                <span class="own-dot" style={{ background: ownKinds().find((own) => own.dayId === kind.id)?.color ?? 'transparent' }} />
                {t("The list's dot")}
              </label>
            </Show>
            <For each={POI_CATEGORIES}>
              {(category) => (
                <label>
                  <input type="radio" name="icon" value={category.id} checked={(placeIcon(kind.id) ?? (kind.own ? undefined : kind.id)) === category.id} />
                  <img class="poi-badge" src={poiBadgeUrl(category)} alt="" />
                  {category.label}
                </label>
              )}
            </For>
          </fieldset>
        </>
      )}
    </EditDialog>
  );
}
