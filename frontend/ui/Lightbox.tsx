import { createEffect, createSignal, Show } from 'solid-js';
import { CloseIcon } from './icons';
import { showModalWhile } from './modal';

export interface LightboxImage {
  /** The image itself. */
  src: string;
  /** A small version of it, shown until the image has loaded. */
  preview: string;
  name: string;
}

const [image, setImage] = createSignal<LightboxImage>();

/** Opens the image over the page from a click on its link, unless the click asks for a new tab. */
export function openImage(e: MouseEvent, shown: LightboxImage): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  setImage(shown);
}

/** An image over the page, as large as the viewport allows, with its name and a link to the file. */
export function Lightbox() {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, () => image() !== undefined);
  const [loaded, setLoaded] = createSignal<string>();
  createEffect(() => {
    const shown = image();
    if (!shown) return;
    const full = new Image();
    full.onload = () => setLoaded(shown.src);
    full.src = shown.src;
  });
  const close = () => setImage(undefined);
  return (
    <dialog ref={dialog} class="lightbox" aria-label="Photo" onClose={close} onClick={(e) => e.target === e.currentTarget && close()}>
      <Show when={image()} keyed>
        {(shown) => (
          <figure>
            <img src={loaded() === shown.src ? shown.src : shown.preview} alt={shown.name} />
            <figcaption>
              <span class="name" title={shown.name}>
                {shown.name}
              </span>
              <a href={shown.src} target="_blank" rel="noopener">
                Open the file
              </a>
              <button type="button" title="Close" aria-label="Close" onClick={close}>
                <CloseIcon />
              </button>
            </figcaption>
          </figure>
        )}
      </Show>
    </dialog>
  );
}
