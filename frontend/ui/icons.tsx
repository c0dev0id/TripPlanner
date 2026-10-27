// Shapes from Tabler Icons (https://tabler.io/icons), copyright (c) 2020-2026 Paweł Kuna,
// MIT License.
import type { JSX } from 'solid-js';

/** Line icons on Tabler's 24 × 24 grid, drawn in the text colour. */
function Icon(props: { children: JSX.Element }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {props.children}
    </svg>
  );
}

export const BackIcon = () => (
  <Icon>
    <path d="M5 12l14 0" />
    <path d="M5 12l6 6" />
    <path d="M5 12l6 -6" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="M5 12l5 5l10 -10" />
  </Icon>
);

export const DownloadIcon = () => (
  <Icon>
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 11l5 5l5 -5" />
    <path d="M12 4l0 12" />
  </Icon>
);

export const UndoIcon = () => (
  <Icon>
    <path d="M9 14l-4 -4l4 -4" />
    <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
  </Icon>
);

export const RedoIcon = () => (
  <Icon>
    <path d="M15 14l4 -4l-4 -4" />
    <path d="M19 10h-11a4 4 0 1 0 0 8h1" />
  </Icon>
);

export const RefreshIcon = () => (
  <Icon>
    <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
  </Icon>
);

export const StopIcon = () => (
  <Icon>
    <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" />
  </Icon>
);

export const InsertIcon = () => (
  <Icon>
    <circle cx="4" cy="20" r="2" />
    <circle cx="20" cy="4" r="2" />
    <path d="M5.5 18.5l2 -2" />
    <path d="M16.5 7.5l2 -2" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </Icon>
);

export const DeleteIcon = () => (
  <Icon>
    <path d="M4 7l16 0" />
    <path d="M10 11l0 6" />
    <path d="M14 11l0 6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
  </Icon>
);

export const FolderIcon = () => (
  <Icon>
    <path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" />
  </Icon>
);

export const DotsIcon = () => (
  <Icon>
    <path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  </Icon>
);

export const PencilIcon = () => (
  <Icon>
    <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
);
