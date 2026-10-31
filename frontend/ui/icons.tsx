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

export const PinIcon = () => (
  <Icon>
    <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" />
  </Icon>
);

export const ClockIcon = () => (
  <Icon>
    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
    <path d="M12 7v5l3 3" />
  </Icon>
);

export const HandIcon = () => (
  <Icon>
    <path d="M8 13v-7.5a1.5 1.5 0 0 1 3 0v6.5" />
    <path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" />
    <path d="M14 5.5a1.5 1.5 0 0 1 3 0v6.5" />
    <path d="M17 7.5a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" />
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

export const GripIcon = () => (
  <Icon>
    <path d="M9 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M9 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M9 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M15 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M15 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M15 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  </Icon>
);

/** A recorded ride: a line through its points. */
export const RecordingIcon = () => (
  <Icon>
    <path d="M4 16l6 -7l5 5l5 -6" />
    <path d="M15 14m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M10 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M4 16m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M20 8m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  </Icon>
);

export const NotebookIcon = () => (
  <Icon>
    <path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1m3 0v16" />
    <path d="M13 8l2 0" />
    <path d="M13 12l2 0" />
  </Icon>
);

export const ShareIcon = () => (
  <Icon>
    <path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M8.7 10.7l6.6 -3.4" />
    <path d="M8.7 13.3l6.6 3.4" />
  </Icon>
);

export const LayersIcon = () => (
  <Icon>
    <path d="M12 4l-8 4l8 4l8 -4l-8 -4" />
    <path d="M4 12l8 4l8 -4" />
    <path d="M4 16l8 4l8 -4" />
  </Icon>
);

export const SettingsIcon = () => (
  <Icon>
    <path d="M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 6l8 0" />
    <path d="M16 6l4 0" />
    <path d="M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 12l2 0" />
    <path d="M10 12l10 0" />
    <path d="M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 18l11 0" />
    <path d="M19 18l1 0" />
  </Icon>
);

export const SearchIcon = () => (
  <Icon>
    <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
    <path d="M21 21l-6 -6" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M18 6l-12 12" />
    <path d="M6 6l12 12" />
  </Icon>
);

export const PencilIcon = () => (
  <Icon>
    <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5l0 14" />
    <path d="M5 12l14 0" />
  </Icon>
);

export const HomeIcon = () => (
  <Icon>
    <path d="M5 12l-2 0l9 -9l9 9l-2 0" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
    <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />
  </Icon>
);

export const MapPlusIcon = () => (
  <Icon>
    <path d="M12 19l-3 -2l-6 3v-13l6 -3l6 3l6 -3v7.5" />
    <path d="M9 4v13" />
    <path d="M15 7v5" />
    <path d="M16 19h6" />
    <path d="M19 16v6" />
  </Icon>
);

export const FolderPlusIcon = () => (
  <Icon>
    <path d="M12 19h-7a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v3.5" />
    <path d="M16 19h6" />
    <path d="M19 16v6" />
  </Icon>
);

export const FolderImportIcon = () => (
  <Icon>
    <path d="M12 19h-7a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v3.5" />
    <path d="M19 16v6" />
    <path d="M22 19l-3 3l-3 -3" />
  </Icon>
);

export const FileImportIcon = () => (
  <Icon>
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M5 13v-8a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5.5m-9.5 -2h7m-3 -3l3 3l-3 3" />
  </Icon>
);

export const CopyIcon = () => (
  <Icon>
    <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
    <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
  </Icon>
);

export const NeighboursIcon = () => (
  <Icon>
    <path d="M7 8l-4 4l4 4" />
    <path d="M17 8l4 4l-4 4" />
    <path d="M3 12l18 0" />
  </Icon>
);

export const AlertIcon = () => (
  <Icon>
    <path d="M12 9v4" />
    <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
    <path d="M12 16h.01" />
  </Icon>
);

export const DotIcon = () => (
  <Icon>
    <path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
  </Icon>
);
