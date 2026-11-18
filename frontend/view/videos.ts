import { createSignal, onCleanup, type Accessor } from 'solid-js';

/** Where the page's videos are played from: YouTube's host that sets no cookie before a video plays. */
export const VIDEO_HOST = 'https://www.youtube-nocookie.com';

/** The address of a video's player, which takes commands from the page, has no controls of its own and starts without sound, as a video that starts by itself must. */
export const playerUrl = (videoId: string): string => `${VIDEO_HOST}/embed/${videoId}?enablejsapi=1&mute=1&playsinline=1&rel=0&controls=0&fs=0&iv_load_policy=3`;

/** What a player says of itself: whether it plays and has its sound off, and where in the video it is, in seconds. */
export interface Playback {
  playing: boolean;
  muted: boolean;
  time: number;
  duration: number;
}

/** A video's player as the page's own controls see it and move it. */
export interface Player {
  playback: Accessor<Playback>;
  /** Plays, or pauses what plays. */
  toggle: () => void;
  seek: (seconds: number) => void;
  /** Turns the sound on, or off. */
  sound: () => void;
}

/** YouTube's number for a player that plays. */
const PLAYING = 1;

/** How much of a video is in the window before it is the one read. */
const IN_VIEW = 0.6;

/** The page's players, those in the window, those that take commands by now, and the one that plays. */
const players = new Set<HTMLIFrameElement>();
const inView = new Set<HTMLIFrameElement>();
const ready = new WeakSet<HTMLIFrameElement>();
let playing: HTMLIFrameElement | undefined;
/** Whether the reader turned the sound on: the videos that start after that have it too. */
let audible = false;

const tell = (frame: HTMLIFrameElement, message: object) => frame.contentWindow?.postMessage(JSON.stringify(message), VIDEO_HOST);
const command = (frame: HTMLIFrameElement, func: 'playVideo' | 'pauseVideo' | 'seekTo' | 'mute' | 'unMute', ...args: unknown[]) => ready.has(frame) && tell(frame, { event: 'command', func, args });
/** What each player said of itself last, to be told what it says now. */
/** Starts a player, with the sound as the reader last chose it. */
const start = (frame: HTMLIFrameElement) => {
  command(frame, audible ? 'unMute' : 'mute');
  command(frame, 'playVideo');
};
const told = new WeakMap<HTMLIFrameElement, (info: Record<string, unknown>) => void>();

/** Has the one video play that is in the window, the uppermost of several, and the one that played stop. */
function turn(): void {
  const next = playing && inView.has(playing) ? playing : [...inView].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
  if (next === playing) return;
  if (playing) command(playing, 'pauseVideo');
  playing = next;
  if (next) start(next);
}

let watcher: IntersectionObserver | undefined;
function watching(): IntersectionObserver {
  if (watcher) return watcher;
  // A player says that it takes commands once it is told that the page listens, and from then on what it does.
  window.addEventListener('message', (e) => {
    if (e.origin !== VIDEO_HOST || typeof e.data !== 'string') return;
    const frame = [...players].find((player) => player.contentWindow === e.source);
    if (!frame) return;
    const said = JSON.parse(e.data) as { event?: string; info?: Record<string, unknown> | null };
    if (said.info) told.get(frame)?.(said.info);
    if (said.event !== 'onReady') return;
    ready.add(frame);
    if (frame === playing) start(frame);
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

/**
 * Plays a video's player while it is the one read: one of the page's videos at a time, started when it is scrolled
 * to and stopped when it is left. Gives the page's own controls what the player says of itself and the way to move it.
 */
export function playWhenRead(frame: HTMLIFrameElement): Player {
  const [playback, setPlayback] = createSignal<Playback>({ playing: false, muted: true, time: 0, duration: 0 });
  // A player tells only what changed.
  told.set(frame, (info) =>
    setPlayback((was) => ({
      playing: typeof info.playerState === 'number' ? info.playerState === PLAYING : was.playing,
      muted: typeof info.muted === 'boolean' ? info.muted : was.muted,
      time: typeof info.currentTime === 'number' ? info.currentTime : was.time,
      duration: typeof info.duration === 'number' ? info.duration : was.duration,
    })),
  );
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
  return {
    playback,
    toggle: () => command(frame, playback().playing ? 'pauseVideo' : 'playVideo'),
    seek: (seconds) => command(frame, 'seekTo', seconds, true),
    sound: () => {
      audible = playback().muted;
      command(frame, audible ? 'unMute' : 'mute');
    },
  };
}
