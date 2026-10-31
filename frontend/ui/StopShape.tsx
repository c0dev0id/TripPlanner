// The little objects are from Layer Slayer's waypoint shapes; the bed, the pin, the flags, the meeting and the info sign are new.
import { createSignal, createUniqueId, Show, type JSX } from 'solid-js';
import { garminPictureUrl, hasPicture, ourIcon, type StopIcon } from '../symbols/symbols';

/** Height of a stop's shape in CSS pixels. */
const SHAPE_HEIGHT = 36;
const INK = '#343a40';
const POLE = '#868e96';
/** Steam rising from a cup. */
const STEAM = 'q-1.6 -2 0 -4 q1.6 -2 0 -4';

/** The post a sign stands on, drawn before the sign, which hides its top. */
function Post() {
  return <rect x="15" y="18" width="2" height="17" rx="0.6" fill={POLE} />;
}

/** A flag on a pole whose foot is the stop's spot; the cloth is drawn after it. */
function FlagPole() {
  return (
    <>
      <rect x="15" y="3" width="2" height="32" rx="0.8" fill={POLE} />
      <circle cx="16" cy="2.6" r="1.6" fill={POLE} />
    </>
  );
}

/** The squares of a chequered flag's cloth: four across, three down. */
const CHEQUERS = [0, 1, 2].flatMap((row) => [0, 1, 2, 3].filter((col) => (row + col) % 2 === 0).map((col) => ({ x: 17 + col * 3.5, y: 3.5 + row * 4 })));

/** A pin in the stop's colour: bound to the route or free beside it. */
function Pin(props: { color: string }) {
  return (
    <>
      <path d="M16 35 C16 35 5 22 5 13 A11 11 0 0 1 27 13 C27 22 16 35 16 35 Z" fill={props.color} />
      <circle cx="16" cy="13" r="4.2" fill="#fff" />
    </>
  );
}

/** The drawing of each of our icons, in a 32 × 36 box with its foot at (16, 35). */
const DRAWINGS: Record<StopIcon, (color: string) => JSX.Element> = {
  other: (color) => <Pin color={color} />,
  start: () => (
    <>
      <FlagPole />
      <rect x="17" y="3.5" width="14" height="12" rx="0.6" fill="#2f9e44" />
    </>
  ),
  end: () => (
    <>
      <FlagPole />
      <rect x="17" y="3.5" width="14" height="12" rx="0.6" fill="#fff" stroke={INK} stroke-width="0.8" />
      <g fill={INK}>
        {CHEQUERS.map((c) => (
          <rect x={c.x} y={c.y} width="3.5" height="4" />
        ))}
      </g>
    </>
  ),
  meeting: () => (
    <>
      <Post />
      <rect x="4" y="2.5" width="24" height="18" rx="3" fill="#7048e8" />
      <g fill="#fff">
        <circle cx="10.5" cy="8" r="2.2" />
        <path d="M6 17 a4.5 5 0 0 1 9 0 Z" />
        <circle cx="21.5" cy="8" r="2.2" />
        <path d="M17 17 a4.5 5 0 0 1 9 0 Z" />
      </g>
      <g fill="#fff" stroke="#7048e8" stroke-width="1.1">
        <circle cx="16" cy="9.6" r="2.6" />
        <path d="M10.6 18.6 a5.4 5.6 0 0 1 10.8 0 Z" />
      </g>
    </>
  ),
  hotel: () => (
    <>
      <Post />
      <rect x="4" y="2.5" width="24" height="17" rx="3" fill="#1971c2" />
      <g fill="#fff">
        <rect x="7.5" y="6" width="2.4" height="9.5" rx="0.8" />
        <rect x="9.9" y="10.5" width="15" height="3.4" rx="1" />
        <rect x="10.3" y="8" width="4.6" height="2.3" rx="1" />
        <rect x="23.2" y="12" width="1.8" height="3.5" rx="0.6" />
        <rect x="7.5" y="13.9" width="1.8" height="1.6" />
      </g>
    </>
  ),
  restaurant: () => (
    <>
      <circle cx="16" cy="24.5" r="10.3" fill="#fff" stroke="#ced4da" stroke-width="0.9" />
      <circle cx="16" cy="24.5" r="6.8" fill="#f8f9fa" stroke="#dee2e6" stroke-width="0.7" />
      <path d="M12.6 25.6 q3.4 -4.6 6.8 0 q-3.4 2.4 -6.8 0z" fill="#e8590c" />
      <circle cx="17.6" cy="22.8" r="1.2" fill="#2f9e44" />
      <g fill={POLE}>
        <rect x="2.3" y="14" width="1.6" height="20.5" rx="0.8" />
        <rect x="1" y="6" width="0.7" height="6" />
        <rect x="2.75" y="6" width="0.7" height="6" />
        <rect x="4.5" y="6" width="0.7" height="6" />
        <rect x="1" y="11" width="4.2" height="3.6" rx="1.4" />
        <path d="M28.6 6 C31 8.5 31 12.5 30.2 15.5 L28.6 15.5 Z" />
        <rect x="28.2" y="15" width="1.9" height="19.5" rx="0.9" />
      </g>
    </>
  ),
  cafe: () => (
    <>
      <ellipse cx="16" cy="33.2" rx="12.5" ry="2.3" fill="#fff" stroke="#ced4da" stroke-width="0.8" />
      <path d="M24.5 17.5 a4.6 4.6 0 0 1 0 9.2" fill="none" stroke="#e9ecef" stroke-width="2.6" />
      <path d="M6 14.5 L26 14.5 L24.4 29.2 Q24 32.3 21 32.3 L11 32.3 Q8 32.3 7.6 29.2 Z" fill="#fff" stroke="#ced4da" stroke-width="0.8" />
      <path d="M6.9 21 L25.1 21 L24.8 24 L7.2 24 Z" fill="#e03131" />
      <ellipse cx="16" cy="14.5" rx="10" ry="2.4" fill="#7b4a2b" stroke="#ced4da" stroke-width="0.8" />
      <g fill="none" stroke="#adb5bd" stroke-width="1.3" stroke-linecap="round">
        <path d={`M12 10.5 ${STEAM}`} />
        <path d={`M16 10.5 ${STEAM}`} />
        <path d={`M20 10.5 ${STEAM}`} />
      </g>
    </>
  ),
  fuel: () => (
    <>
      <path d="M23 11 C29 11 29.5 15 29.5 20 L29.5 23.5" fill="none" stroke={INK} stroke-width="1.8" />
      <rect x="28" y="22.5" width="3" height="5.5" rx="0.7" fill={INK} />
      <rect x="10" y="3.5" width="12" height="3.5" rx="1.2" fill="#c92a2a" />
      <rect x="9" y="6" width="14" height="26.5" rx="2.5" fill="#e03131" />
      <rect x="7.5" y="31" width="17" height="4" rx="1" fill={INK} />
      <rect x="11.5" y="9" width="9" height="7" rx="1" fill="#fff" />
      <rect x="13" y="11" width="6" height="1.2" fill={INK} />
      <rect x="13" y="13.3" width="4" height="1.2" fill={INK} />
      <path d="M16 19.5 c0 0 -3 3.5 -3 5.3 a3 3 0 0 0 6 0 c0 -1.8 -3 -5.3 -3 -5.3z" fill="#fff" />
    </>
  ),
  sight: () => (
    <>
      <Post />
      <rect x="5" y="2.5" width="22" height="20" rx="3" fill="#1971c2" />
      <rect x="6.5" y="4" width="19" height="17" rx="2" fill="none" stroke="#fff" stroke-width="0.9" />
      <circle cx="16" cy="7.8" r="2" fill="#fff" />
      <path d="M13.6 11 h3.8 v6.6 h1.4 v1.6 h-5.6 v-1.6 h1.4 v-5 h-1 z" fill="#fff" />
    </>
  ),
  info: () => (
    <>
      <Post />
      <circle cx="16" cy="11" r="9.6" fill="#0c8599" />
      <circle cx="16" cy="6.4" r="1.8" fill="#fff" />
      <rect x="14.4" y="9.2" width="3.2" height="8.2" rx="1" fill="#fff" />
    </>
  ),
  photo: () => (
    <>
      <g stroke={POLE} stroke-width="1.6" stroke-linecap="round">
        <path d="M16 21 L9.5 34.5" />
        <path d="M16 21 L22.5 34.5" />
        <path d="M16 21 L16 34.5" />
      </g>
      <rect x="14" y="18.5" width="4" height="3" rx="0.8" fill={INK} />
      <rect x="11" y="4" width="8" height="4" rx="1" fill={INK} />
      <rect x="4.5" y="6.5" width="23" height="13.5" rx="2.8" fill={INK} />
      <circle cx="16" cy="13.2" r="5.4" fill="#adb5bd" />
      <circle cx="16" cy="13.2" r="3.6" fill="#1c7ed6" />
      <circle cx="14.8" cy="12" r="1.1" fill="#fff" />
      <rect x="6.5" y="8.5" width="3.2" height="2" rx="0.5" fill="#fab005" />
      <circle cx="24.8" cy="9.4" r="1" fill="#fa5252" />
    </>
  ),
  break: () => (
    <>
      <Post />
      <circle cx="16" cy="11" r="9.6" fill="#1971c2" />
      <circle cx="16" cy="11" r="8" fill="none" stroke="#fff" stroke-width="1" />
      <rect x="12" y="6.5" width="3" height="9" rx="0.8" fill="#fff" />
      <rect x="17" y="6.5" width="3" height="9" rx="0.8" fill="#fff" />
    </>
  ),
};

/** The symbols whose picture failed to load, as where `make garmin-icons` was not run: asked for once a page. */
const [failed, setFailed] = createSignal<ReadonlySet<string>>(new Set());

/** Garmin's picture of a symbol on a sign, in the same box; a pin in `color` for a symbol without a picture. */
function GarminSign(props: { symbol: string; color: string }) {
  return (
    <Show when={hasPicture(props.symbol) && !failed().has(props.symbol)} fallback={<Pin color={props.color} />}>
      <Post />
      <rect x="3" y="1" width="26" height="26" rx="4" fill="#fff" stroke="#ced4da" stroke-width="0.9" />
      <image href={garminPictureUrl(props.symbol)} x="4" y="2" width="24" height="24" onError={() => setFailed(new Set([...failed(), props.symbol]))} />
    </Show>
  );
}

/**
 * A stop drawn by its symbol: as the little object one of our icons draws where one stands
 * for the symbol, else as Garmin's picture of it on a sign; a plain stop is a pin in
 * `color`. The foot is in the middle of the bottom edge. A white outline around the drawing
 * sets it off from any map. With `foot`, a dot in `color` marks the exact spot on the bottom
 * edge, drawn over it.
 */
export function StopShape(props: { symbol: string | null; color: string; height?: number; foot?: boolean }) {
  const id = createUniqueId();
  const height = () => props.height ?? SHAPE_HEIGHT;
  return (
    <svg viewBox="-2 -1 36 36.5" height={height()} width={(height() * 36) / 36.5} overflow="visible" aria-hidden="true">
      <filter id={`outline-${id}`} x="-10%" y="-10%" width="120%" height="120%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="grown" />
        <feFlood flood-color="#fff" />
        <feComposite in2="grown" operator="in" result="rim" />
        <feMerge>
          <feMergeNode in="rim" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <g filter={`url(#outline-${id})`}>
        <Show when={ourIcon(props.symbol)} keyed fallback={<GarminSign symbol={props.symbol!} color={props.color} />}>
          {(icon) => DRAWINGS[icon](props.color)}
        </Show>
      </g>
      <Show when={props.foot}>
        <circle cx="16" cy="35.5" r="3" fill={props.color} stroke="#fff" stroke-width="1.4" />
      </Show>
    </svg>
  );
}
