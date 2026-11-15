import { t } from '../i18n/t';
import type { FolderKind } from './trip';

/** The library's views, a tab each: the Stash's files, the trips, the lists of places, the rides as recorded, and the settings. */
export type LibraryTab = 'stash' | 'trips' | 'places' | 'recordings' | 'settings';

/** The tabs that show a tree of folders. */
export type TreeTab = Exclude<LibraryTab, 'recordings' | 'settings'>;
export const TREE_TABS: readonly TreeTab[] = ['stash', 'trips', 'places'];
export const LIBRARY_TABS: readonly LibraryTab[] = [...TREE_TABS, 'recordings', 'settings'];

/** Whether the tab shows a tree of folders. */
export const isTreeTab = (tab: LibraryTab): tab is TreeTab => (TREE_TABS as readonly LibraryTab[]).includes(tab);

/** What a tree holds besides folders, as it is counted and as a folder of it takes it. */
export type Held = 'trip' | 'file' | 'list';

/** A tree of the library: the kind of the folder at its top, which every folder in it is around, what it holds, and what it says of itself. */
export interface Tree {
  top: FolderKind;
  holds: Held;
  name: string;
  /** What it says while it holds nothing. */
  empty: string;
  /** What its search says it looks through. */
  search: string;
}

export const TREES: Record<TreeTab, Tree> = {
  stash: {
    top: 'collections',
    holds: 'file',
    name: t('Stash'),
    empty: t('The Stash is empty. Drop GPX files and folders here, or add them from the menu above.'),
    search: t('Search files, routes and tracks'),
  },
  trips: {
    top: 'folder',
    holds: 'trip',
    name: t('Trips'),
    empty: t('No trips yet. Create one from the menu above, or drop GPX files here.'),
    search: t('Search trips, routes and tracks'),
  },
  places: {
    top: 'places',
    holds: 'list',
    name: t('Places'),
    empty: t('No place lists yet. Create one from the menu above, or drop GPX files with waypoints here.'),
    search: t('Search lists of places'),
  },
};

/** The tree whose folders are of the kind, or lie in the folder of it. */
export const treeOfKind = (kind: FolderKind): TreeTab => TREE_TABS.find((tree) => TREES[tree].top === kind)!;

/** What the tabs are called. */
export const TAB_NAMES: Record<LibraryTab, string> = { stash: TREES.stash.name, trips: TREES.trips.name, places: TREES.places.name, recordings: t('Recordings'), settings: t('Settings') };
