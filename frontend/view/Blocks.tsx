import { t } from '../i18n/t';
import { createMemo, For, Match, Show, Switch } from 'solid-js';
import { entryFileUrl, entryImageUrl } from '../api';
import { sizeText, type Entry } from '../model/journal';
import { blocksOf } from '../model/journalDocument';
import type { Trip } from '../model/trip';
import { partLabel } from '../trip/labels';
import { ForById } from '../ui/ForById';
import { PinIcon } from '../ui/icons';
import { openImage, type LightboxImage } from '../ui/Lightbox';
import { markdownHtml } from '../ui/markdown';
import { entryMark } from './follow';
import { playerUrl, playWhenRead } from './videos';

/** What the story's parts are told to do with what is being read: to watch an element that names a mark, and to go to one. */
export interface Reading {
  watch: (el: HTMLElement) => void;
  go: (mark: string) => void;
}

/** Whether an entry has somewhere to be shown on the map: a place of its own, or a route or a stop it is on. */
const isSomewhere = (entry: Entry): boolean => entry.lngLat !== null || (entry.routeId ?? entry.stopId) !== null;

/** What the way to an entry on the map is called: by its route or stop where it is on one. */
const placeLabel = (trip: Trip, entry: Entry): string => partLabel(trip, entry) ?? t('On the map');

/** The button that shows on the map where an entry belongs. */
function Chip(props: { entry: Entry; trip: Trip; go: (mark: string) => void }) {
  return (
    <button type="button" class="chip" onClick={() => props.go(entryMark(props.entry.id))}>
      <PinIcon />
      {placeLabel(props.trip, props.entry)}
    </button>
  );
}

/**
 * The photos that follow each other: one alone as wide as the text, or half of it where it is higher than wide, two beside each other, more in rows. Each has its
 * caption under it and, where it has somewhere to be shown, a pin on it that shows it on the map. A click opens a
 * photo large, with the others a step away.
 */
function Gallery(props: { entries: Entry[]; trip: Trip; api: string; reading: Reading }) {
  const images = createMemo((): LightboxImage[] => props.entries.map((entry) => ({ src: entryImageUrl(props.api, entry, 2048), preview: entryImageUrl(props.api, entry, 400), name: entry.text || t('Photo') })));
  const placed = () => props.entries.find(isSomewhere);
  /** Whether the photos are all higher than wide: one alone or two of them are then set at half the text's width each, uncropped in shape. */
  const upright = () => props.entries.length <= 2 && props.entries.every((entry) => (entry.file!.height ?? 0) > (entry.file!.width ?? 0));
  const sizes = () => (props.entries.length === 1 && !upright() ? '(min-width: 900px) 760px, 100vw' : '(min-width: 900px) 380px, 50vw');
  return (
    <div class="gallery" classList={{ single: props.entries.length === 1, pair: props.entries.length === 2, upright: upright() }} data-mark={placed() && entryMark(placed()!.id)} ref={(el) => placed() && props.reading.watch(el)}>
      <For each={props.entries}>
        {(entry, index) => (
          <figure data-told={entryMark(entry.id)}>
            <div class="frame">
              <a href={images()[index()]!.src} onClick={(e) => openImage(e, images()[index()]!, images())}>
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
              <Show when={isSomewhere(entry)}>
                <button type="button" class="pin" title={placeLabel(props.trip, entry)} aria-label={placeLabel(props.trip, entry)} onClick={() => props.reading.go(entryMark(entry.id))}>
                  <PinIcon />
                </button>
              </Show>
            </div>
            <Show when={entry.text}>
              <figcaption class="captions" innerHTML={markdownHtml(entry.text)} />
            </Show>
          </figure>
        )}
      </For>
    </div>
  );
}

/** A video in its player, which plays while it is read; under it its caption, and the way to it on YouTube, which is all a printed page has of it. */
function Video(props: { entry: Entry; videoId: string; caption: string; trip: Trip; reading: Reading }) {
  const placed = () => isSomewhere(props.entry);
  return (
    <figure class="video" data-mark={placed() ? entryMark(props.entry.id) : undefined} ref={(el) => placed() && props.reading.watch(el)}>
      <iframe ref={playWhenRead} src={playerUrl(props.videoId)} title={props.caption || t('Video')} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" />
      <figcaption>
        <div class="captions">
          <Show when={props.caption}>
            <div innerHTML={markdownHtml(props.caption)} />
          </Show>
          <a href={`https://www.youtube.com/watch?v=${props.videoId}`} target="_blank" rel="noopener noreferrer">
            {t('Watch on YouTube')}
          </a>
        </div>
        <Show when={placed()}>
          <Chip entry={props.entry} trip={props.trip} go={props.reading.go} />
        </Show>
      </figcaption>
    </figure>
  );
}

/** A chapter's entries as they are read: texts, galleries of the photos that follow each other, and files that are no image. */
export function Blocks(props: { entries: Entry[]; trip: Trip; api: string; reading: Reading }) {
  const blocks = createMemo(() => blocksOf(props.entries).map((block) => ({ ...block, id: block.kind === 'gallery' ? block.entries[0]!.id : block.entry.id })));
  return (
    <div class="blocks">
      <ForById each={blocks()}>
        {(block) => {
          const photos = () => {
            const b = block();
            return b.kind === 'gallery' && b.entries;
          };
          const video = () => {
            const b = block();
            return b.kind === 'video' && b;
          };
          const entry = (kind: 'text' | 'file') => {
            const b = block();
            return b.kind === kind && b.entry;
          };
          return (
            <Switch>
              <Match when={photos()}>{(entries) => <Gallery entries={entries()} trip={props.trip} api={props.api} reading={props.reading} />}</Match>
              <Match when={video()}>{(v) => <Video entry={v().entry} videoId={v().videoId} caption={v().caption} trip={props.trip} reading={props.reading} />}</Match>
              <Match when={entry('text')}>
                {(text) => (
                  <div class="prose" data-mark={isSomewhere(text()) ? entryMark(text().id) : undefined} ref={(el) => isSomewhere(text()) && props.reading.watch(el)}>
                    <div innerHTML={markdownHtml(text().text)} />
                    <Show when={isSomewhere(text())}>
                      <Chip entry={text()} trip={props.trip} go={props.reading.go} />
                    </Show>
                  </div>
                )}
              </Match>
              <Match when={entry('file')}>
                {(file) => (
                  <div class="file-block">
                    <a href={entryFileUrl(props.api, file())} target="_blank" rel="noopener">
                      {file().file!.name}
                    </a>
                    <span class="muted"> {sizeText(file().file!.size)}</span>
                    <Show when={file().text}>
                      <div innerHTML={markdownHtml(file().text)} />
                    </Show>
                  </div>
                )}
              </Match>
            </Switch>
          );
        }}
      </ForById>
    </div>
  );
}
