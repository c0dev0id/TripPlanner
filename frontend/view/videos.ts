import { onCleanup } from 'solid-js';

/** Where the page's videos are played from: YouTube's host that sets no cookie before a video plays. */
export const VIDEO_HOST = 'https://www.youtube-nocookie.com';

/** The address of a video's player, which takes commands from the page and starts without sound, as a video that starts by itself must. */
export const playerUrl = (videoId: string): string => `${VIDEO_HOST}/embed/${videoId}?enablejsapi=1&mute=1&playsinline=1&rel=0`;

/** How much of a video is in the window before it is the one read. */
const IN_VIEW = 0.6;

/** The page's players, those in the window, those that take commands by now, and the one that plays. */
const players = new Set<HTMLIFrameElement>();
const inView = new Set<HTMLIFrameElement>();
const ready = new WeakSet<HTMLIFrameElement>();
let playing: HTMLIFrameElement | undefined;

const tell = (frame: HTMLIFrameElement, message: object) => frame.contentWindow?.postMessage(JSON.stringify(message), VIDEO_HOST);
const command = (frame: HTMLIFrameElement, func: 'playVideo' | 'pauseVideo') => ready.has(frame) && tell(frame, { event: 'command', func, args: [] });

/** Has the one video play that is in the window, the uppermost of several, and the one that played stop. */
function turn(): void {
  const next = playing && inView.has(playing) ? playing : [...inView].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
  if (next === playing) return;
  if (playing) command(playing, 'pauseVideo');
  playing = next;
  if (next) command(next, 'playVideo');
}

let watcher: IntersectionObserver | undefined;
function watching(): IntersectionObserver {
  if (watcher) return watcher;
  // A player says that it takes commands once it is told that the page listens.
  window.addEventListener('message', (e) => {
    if (e.origin !== VIDEO_HOST || typeof e.data !== 'string' || !e.data.includes('"onReady"')) return;
    const frame = [...players].find((player) => player.contentWindow === e.source);
    if (!frame) return;
    ready.add(frame);
    if (frame === playing) command(frame, 'playVideo');
  });
  watcher = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= IN_VIEW) inView.add(entry.target as HTMLIFrameElement);
        else inView.delete(entry.target as HTMLIFrameElement);
      }
      turn();
    },
    { threshold: IN_VIEW },
  );
  return watcher;
}

/** Plays a video's player while it is the one read: one of the page's videos at a time, started when it is scrolled to and stopped when it is left. */
export function playWhenRead(frame: HTMLIFrameElement): void {
  const listen = () => tell(frame, { event: 'listening', id: 1, channel: 'widget' });
  frame.addEventListener('load', listen);
  players.add(frame);
  watching().observe(frame);
  onCleanup(() => {
    watching().unobserve(frame);
    players.delete(frame);
    inView.delete(frame);
    turn();
  });
}
