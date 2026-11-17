import { t } from '../i18n/t';
import { createMemo, For, Match, Show, Switch } from 'solid-js';
import { entryFileUrl, entryImageUrl } from '../api';
import { sizeText, targetOf, type Entry } from '../model/journal';
import { blocksOf } from '../model/journalDocument';
import type { Trip } from '../model/trip';
import { targetLabel } from '../trip/labels';
import { ForById } from '../ui/ForById';
import { PinIcon } from '../ui/icons';
import { openImage, type LightboxImage } from '../ui/Lightbox';
import { markdownHtml } from '../ui/markdown';
import { entryMark } from './follow';

/** What the story's parts are told to do with what is being read: to watch an element that names a mark, and to go to one. */
export interface Reading {
  watch: (el: HTMLElement) => void;
  go: (mark: string) => void;
}

/** Whether an entry has somewhere to be shown on the map: a place of its own, or a route or a stop it is on. */
const isSomewhere = (entry: Entry): boolean => entry.lngLat !== null || (entry.routeId ?? entry.stopId) !== null;

/** The button that shows on the map where an entry belongs, called by its route or stop where it is on one. */
function Chip(props: { entry: Entry; trip: Trip; go: (mark: string) => void }) {
  const label = () => ((props.entry.routeId ?? props.entry.stopId) !== null && targetLabel(props.trip, targetOf(props.entry))) || t('On the map');
  return (
    <button type="button" class="chip" onClick={() => props.go(entryMark(props.entry.id))}>
      <PinIcon />
      {label()}
    </button>
  );
}

/** The photos that follow each other, as one figure: one alone as wide as the text, two beside each other, more in rows; their captions under them. A click opens a photo large, with the others a step away. */
function Gallery(props: { entries: Entry[]; trip: Trip; api: string; reading: Reading }) {
  const images = createMemo((): LightboxImage[] => props.entries.map((entry) => ({ src: entryImageUrl(props.api, entry, 2048), preview: entryImageUrl(props.api, entry, 400), name: entry.text || entry.file!.name })));
  const placed = () => props.entries.find(isSomewhere);
  const captions = () => props.entries.filter((entry) => entry.text !== '');
  const sizes = () => (props.entries.length === 1 ? '(min-width: 900px) 760px, 100vw' : '(min-width: 900px) 380px, 50vw');
  return (
    <figure class="gallery" classList={{ single: props.entries.length === 1, pair: props.entries.length === 2 }} data-mark={placed() && entryMark(placed()!.id)} ref={(el) => placed() && props.reading.watch(el)}>
      <div class="photos">
        <For each={props.entries}>
          {(entry, index) => (
            <a href={images()[index()]!.src} data-told={entryMark(entry.id)} onClick={(e) => openImage(e, images()[index()]!, images())}>
              <img
                src={entryImageUrl(props.api, entry, 1280)}
                srcset={`${entryImageUrl(props.api, entry, 400)} 400w, ${entryImageUrl(props.api, entry, 1280)} 1280w, ${entryImageUrl(props.api, entry, 2048)} 2048w`}
                sizes={sizes()}
                width={entry.file!.width ?? undefined}
                height={entry.file!.height ?? undefined}
                alt={entry.text || t('Photo')}
                loading="lazy"
              />
            </a>
          )}
        </For>
      </div>
      <Show when={captions().length > 0 || placed()}>
        <figcaption>
          <div class="captions">
            <For each={captions()}>{(entry) => <div innerHTML={markdownHtml(entry.text)} />}</For>
          </div>
          <Show when={placed()}>{(entry) => <Chip entry={entry()} trip={props.trip} go={props.reading.go} />}</Show>
        </figcaption>
      </Show>
    </figure>
  );
}

/** A chapter's entries as they are read: texts, galleries of the photos that follow each other, and files that are no image. */
export function Blocks(props: { entries: Entry[]; trip: Trip; api: string; reading: Reading }) {
  const blocks = createMemo(() => blocksOf(props.entries).map((block) => ({ ...block, id: block.kind === 'gallery' ? block.entries[0]!.id : block.entry.id })));
  return (
    <div class="blocks">
      <ForById each={blocks()}>
        {(block) => (
          <Switch>
            <Match when={block().kind === 'gallery' && block()} keyed>
              {(gallery) => <Gallery entries={(gallery as { entries: Entry[] }).entries} trip={props.trip} api={props.api} reading={props.reading} />}
            </Match>
            <Match when={block().kind === 'text' && (block() as { entry: Entry }).entry} keyed>
              {(entry) => (
                <div class="prose" data-mark={isSomewhere(entry) ? entryMark(entry.id) : undefined} ref={(el) => isSomewhere(entry) && props.reading.watch(el)}>
                  <div innerHTML={markdownHtml(entry.text)} />
                  <Show when={isSomewhere(entry)}>
                    <Chip entry={entry} trip={props.trip} go={props.reading.go} />
                  </Show>
                </div>
              )}
            </Match>
            <Match when={block().kind === 'file' && (block() as { entry: Entry }).entry} keyed>
              {(entry) => (
                <div class="file-block">
                  <a href={entryFileUrl(props.api, entry)} target="_blank" rel="noopener">
                    {entry.file!.name}
                  </a>
                  <span class="muted"> {sizeText(entry.file!.size)}</span>
                  <Show when={entry.text}>
                    <div innerHTML={markdownHtml(entry.text)} />
                  </Show>
                </div>
              )}
            </Match>
          </Switch>
        )}
      </ForById>
    </div>
  );
}
