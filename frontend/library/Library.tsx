import { plural, t } from '../i18n/t';
import { createEffect, createMemo, createSelector, createSignal, For, Match, on, onCleanup, Show, Switch, type JSX } from 'solid-js';
import { changeTrip, createTrip, deleteFolder, deleteTrip, duplicateTrip, errorMessage, mergeTrips, moveFolder, moveTrip, renameFolder, renameTrip, tripArchiveUrl } from '../api';
import { asName, newId, type Folder, type TripSummary } from '../model/trip';
import { addDay as withDayAdded, pasteDays, pasteIntoTrip, type CopiedRoute } from '../routing/dayEdit';
import { clearClip, copyLibraryItems, libraryClip, libraryPasteItem, type LibraryClip } from '../state/clipboard';
import { heldOf, importNote, libraryFolders, libraryTrips, opening, outlineOf, query, relistFolders, relistTrips, runLibrary, showFolder, shownFolderId } from '../state/library';
import { countsText, folderPath, heldInAll, heldText, kindAround } from './folders';
import { flushSave } from '../state/autosave';
import { setEditTarget } from '../state/drawing';
import { addDay, isMarkInTrip, isTripMarked, markFolder, markTrip, openTripId, selectDay } from '../state/trip';
import { dayDetail, dayHeading } from '../trip/labels';
import { readPreference, writePreference } from '../ui/preferences';
import { cardMenu } from '../ui/cardMenu';
import { askChoice, askConfirmation } from '../ui/confirm';
import { counted, dateText, openingText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CollectionIcon, FoldIcon, FolderIcon, HomeIcon, TripIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { clickSelect, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, selects, toggled, type Selection } from '../ui/selection';
import { fileVerb } from '../ui/fileVerb';
import { ForById } from '../ui/ForById';
import { Pad } from '../ui/Pad';
import { dragToFolder } from './dragToFolder';
import { TripShape } from './TripShape';

/** A folder or a trip of the library, as what is selected, cut, moved and deleted together. */
type Item = { folder: Folder } | { trip: TripSummary };

/** The top of the library, as a row of the tree and a place to paste into. */
const ALL_TRIPS = t('All trips');

const keyOf = (item: Item): string => ('folder' in item ? `folder:${item.folder.id}` : `trip:${item.trip.id}`);
const nameOf = (item: Item): string => ('folder' in item ? item.folder.name : item.trip.name);
const itemOfFolder = (folder: Folder | undefined): Item | undefined => folder && { folder };
const itemOfTrip = (trip: TripSummary | undefined): Item | undefined => trip && { trip };
const foldersOf = (items: readonly Item[]): Folder[] => items.flatMap((item) => ('folder' in item ? [item.folder] : []));
const tripsOf = (items: readonly Item[]): TripSummary[] => items.flatMap((item) => ('trip' in item ? [item.trip] : []));

/** How a card takes part in the selection: whether it is selected or cut, and what its pad and a click with a modifier do. */
interface CardSelect {
  selected: () => boolean;
  cut: () => boolean;
  onToggle: () => void;
  onClick: (e: MouseEvent) => void;
  onDrag: (e: PointerEvent, dragged: () => void) => void;
}

/** How a card unfolds in the tree, whether it holds the tree's one mark, and of a trip whether it is the open one. */
interface CardFold {
  unfolded: () => boolean;
  current: () => boolean;
  open?: () => boolean;
}

/** The browser's preference that keeps what is unfolded in the tree. */
const UNFOLDED = 'libraryUnfolded';

/**
 * The days of a trip that is not open, as the library knows them, drawn as the open trip
 * draws its own: a click opens the trip at the day. What needs the trip's document (the
 * grip that reorders, the journal, the recordings) comes with opening it.
 */
function TripDays(props: { trip: TripSummary; onOpen: (dayId: string) => void }) {
  const collection = () => props.trip.kind === 'collection';
  const days = () => outlineOf(props.trip.id) ?? [];
  return (
    <ol class="days">
      <ForById each={days()}>
        {(day, index) => (
          <li class="day card">
            <div class="row">
              <Show when={!collection()}>
                <span class="grip-space" />
              </Show>
              <button class="text grow" onClick={() => props.onOpen(day().id)}>
                <span class="lines">
                  <span class="name">{dayHeading(props.trip.kind, index(), day().name)}</span>
                  <span class="muted detail">{dayDetail(props.trip.kind, day())}</span>
                </span>
              </button>
            </div>
          </li>
        )}
      </ForById>
      <Show when={days().length === 0}>
        <li class="muted no-days">{t(collection() ? 'No sections yet.' : 'No days yet.')}</li>
      </Show>
    </ol>
  );
}

/** At most this many search results are listed. */
const SEARCH_LIMIT = 20;

/** The dialog the library has open: a new name for a folder or a trip. */
type LibraryDialog = { kind: 'rename-folder'; folder: Folder } | { kind: 'rename-trip'; trip: TripSummary };

/**
 * The library as a tree: folders and trips unfolding in place, the open trip's days among
 * them, or what the search found across all folders. Its rows are opened, selected, cut,
 * copied, pasted into, moved, merged, renamed, exported and deleted.
 */
export function Library(props: {
  onOpen: (trip: TripSummary, dayId?: string) => void;
  onOpenFolder: (id: number) => void;
  /** Leaves the open trip, saved: before the library changes it behind its back. */
  onLeave: () => Promise<void>;
  opening: boolean;
  /** What stands under the open trip in the tree: its days, or a collection's sections. */
  children: JSX.Element;
}) {
  const [dialog, setDialog] = createSignal<LibraryDialog>();
  const folders = () => libraryFolders() ?? [];
  const trips = () => libraryTrips() ?? [];
  const pathOf = (id: number | null) => folderPath(folders(), id);

  /** The folders and trips unfolded in the tree, by key; this browser keeps them. */
  const [unfolded, setUnfolded] = createSignal<ReadonlySet<string>>(new Set(JSON.parse(readPreference(UNFOLDED) ?? '[]') as string[]));
  const isUnfolded = (item: Item): boolean => unfolded().has(keyOf(item));
  /** Folds every folder and trip away, which closes the day shown with its trip. */
  const foldAll = () => {
    setUnfolded(new Set<string>());
    writePreference(UNFOLDED, undefined);
    selectDay(undefined);
  };
  const fold = (keys: readonly string[], unfold: boolean) => {
    const next = new Set(unfolded());
    for (const key of keys) {
      if (unfold) next.add(key);
      else next.delete(key);
    }
    setUnfolded(next);
    writePreference(UNFOLDED, JSON.stringify([...next]));
  };
  // The folders a trip lies in unfold when it opens, so that it is in view.
  createEffect(
    on(openTripId, (id) => {
      const keys: string[] = [];
      for (let f = folders().find((folder) => folder.id === trips().find((trip) => trip.id === id)?.folderId); f; f = folders().find((folder) => folder.id === f!.parentId)) keys.push(keyOf({ folder: f }));
      if (keys.length > 0) fold(keys, true);
    }),
  );
  const childFolders = (parent: number | null) => folders().filter((f) => f.parentId === parent);
  const childTrips = (parent: number | null) => trips().filter((trip) => trip.folderId === parent);
  /** Whether the folder, null for the top, holds the tree's one mark: it is the folder shown, and the mark is not on the open trip or its day. */
  const isMarkedFolder = (id: number | null): boolean => shownFolderId() === id && !isMarkInTrip();
  /** Gives the mark to a folder, null for the top, which makes it the one shown. */
  const markFolderShown = (id: number | null) => {
    showFolder(id);
    markFolder();
  };
  /** The keys of all a folder holds, at any depth. */
  const keysWithin = (id: number): string[] => [...childFolders(id).flatMap((f) => [keyOf({ folder: f }), ...keysWithin(f.id)]), ...childTrips(id).map((trip) => keyOf({ trip }))];
  /**
   * A click on a folder marks it, which makes it the one new trips and pasted ones go into,
   * and unfolds it; marked and unfolded already, it folds. A folder that folds takes all it holds with it:
   * its folders and trips fold too, and the day shown of an open trip among them closes.
   */
  const clickFolder = (f: Folder) => {
    const key = keyOf({ folder: f });
    if (unfolded().has(key) && isMarkedFolder(f.id)) {
      fold([key, ...keysWithin(f.id)], false);
      if (holdsOpen([{ folder: f }])) selectDay(undefined);
    } else fold([key], true);
    markFolderShown(f.id);
  };
  /** Whether the trip is the open one and holds the mark, rather than the day of it that is shown. */
  const isMarkedTrip = (trip: TripSummary): boolean => trip.id === openTripId() && isTripMarked();
  /**
   * A click on a trip, which is a folder of days. It marks the trip and unfolds it: one
   * that is not open opens, and the open one closes its day that is shown. Marked
   * already, the trip folds, and unfolds again at the next click.
   */
  const clickTrip = (trip: TripSummary) => {
    const key = keyOf({ trip });
    if (isMarkedTrip(trip)) return fold([key], !unfolded().has(key));
    fold([key], true);
    if (trip.id === openTripId()) markTrip();
    else props.onOpen(trip);
  };
  /** Whether what is acted on holds the open trip, which the library must not change behind its back. */
  const holdsOpen = (items: readonly Item[]): boolean => tripsWithin(items).some((trip) => trip.id === openTripId());

  /** Asks to delete the folder and, when it holds anything, whether that moves up or goes with it; undefined when the user cancels. */
  const askFolderDeletion = async (f: Folder): Promise<'move' | 'delete' | undefined> => {
    const contentsText = (held: { folders: number; trips: number }) => countsText(held.folders, held.trips);
    const own = contentsText(heldOf(f.id));
    if (!own) return (await askConfirmation(t('Delete the folder “{name}”?', { name: f.name }), t('Delete'))) ? 'move' : undefined;
    const all = contentsText(heldInAll(folders(), heldOf, f.id));
    const where = f.parentId === null ? t('to the top') : t('into “{path}”', { path: pathOf(f.parentId) });
    const question = t(
      all === own
        ? 'The folder “{name}” holds {own}. Move them {where} and delete the folder, or delete it with everything in it?'
        : 'The folder “{name}” holds {own} ({all} in all). Move them {where} and delete the folder, or delete it with everything in it?',
      { name: f.name, own, all, where },
    );
    const deleteAll = t('Delete all');
    const choice = await askChoice(question, [deleteAll, t('Move contents')]);
    return choice === undefined ? undefined : choice === deleteAll ? 'delete' : 'move';
  };
  const removeFolder = async (f: Folder) => {
    const contents = await askFolderDeletion(f);
    if (!contents) return;
    await runLibrary(() => deleteFolder(f.id, contents), () => {
      relistFolders();
      relistTrips();
    });
  };
  /** The folders and trips selected to be acted on together, by key, the first selected first; none once another folder is shown. */
  const selected = () => selectionOf('library');
  const setSelected = (rows: Selection<string>) => selectIn('library', rows);
  createEffect(on(shownFolderId, () => setSelected(NOTHING_SELECTED)));
  const isSelected = createSelector(() => selected().keys, (key: string, keys) => keys.has(key));
  /** Every folder and trip there is, by key. */
  const itemOf = (key: string): Item | undefined => {
    const id = Number(key.slice(key.indexOf(':') + 1));
    if (key.startsWith('folder:')) return itemOfFolder(folders().find((f) => f.id === id));
    return itemOfTrip(trips().find((t) => t.id === id));
  };
  /** The folders and trips in view that can be selected, top to bottom: those of the top and of every unfolded folder, without the special folders. */
  const shownKeys = (parent: number | null = null): string[] => [
    ...childFolders(parent).flatMap((f) => [...(f.kind === 'folder' ? [keyOf({ folder: f })] : []), ...(isUnfolded({ folder: f }) ? shownKeys(f.id) : [])]),
    ...childTrips(parent).map((trip) => keyOf({ trip })),
  ];
  /** What a card's menu, or a press on its pad, acts on: the selection where it holds the card, else the card alone. */
  const chosenWith = (item: Item, selection: Selection<string> = selected()): Item[] => (selection.keys.has(keyOf(item)) ? [...selection.keys].flatMap((key) => itemOf(key) ?? []) : [item]);
  const select = (item: Item) => ({
    selected: () => isSelected(keyOf(item)),
    cut: () => isCut(item),
    onToggle: () => setSelected(toggled(selected(), keyOf(item))),
    onClick: (e: MouseEvent) => setSelected(clickSelect(selected(), shownKeys(), keyOf(item), e)),
    onDrag: (e: PointerEvent, dragged: () => void) => {
      const moved = chosenWith(item);
      dragToFolder(e, moved.length === 1 ? nameOf(item) : countText(moved), (into) => moveInto(moved, into), dragged);
    },
  });
  const isCut = (item: Item): boolean => {
    const cut = libraryClip();
    return cut !== undefined && cut.move && ('folder' in item ? cut.folderIds.includes(item.folder.id) : cut.tripIds.includes(item.trip.id));
  };
  /** How many folders and trips: 2 folders and 3 trips. */
  const countText = (items: readonly Item[]): string => countsText(foldersOf(items).length, tripsOf(items).length);
  /** Lists the library afresh, nothing selected: after folders or trips were moved, merged, pasted or deleted. */
  const relist = () => {
    setSelected(NOTHING_SELECTED);
    relistFolders();
    relistTrips();
  };
  /** The trips among the items and those in their folders, at any depth. */
  const tripsWithin = (items: readonly Item[]): TripSummary[] => {
    const inside = new Set(foldersOf(items).map((f) => f.id));
    for (let grown = true; grown; ) {
      grown = false;
      for (const f of folders()) if (f.parentId !== null && inside.has(f.parentId) && !inside.has(f.id)) grown = inside.add(f.id).size > 0;
    }
    return [...tripsOf(items), ...trips().filter((trip) => trip.folderId !== null && inside.has(trip.folderId))];
  };
  const remove = async (doomed: readonly Item[]) => {
    const [only] = doomed;
    if (doomed.length === 1 && 'folder' in only!) return removeFolder(only.folder);
    const question =
      doomed.length === 1 && 'trip' in only!
        ? t('Delete the trip “{name}” with all its days?', { name: only.trip.name })
        : t(foldersOf(doomed).length > 0 ? 'Delete {what} with everything in them?' : 'Delete {what} with all their days?', { what: countText(doomed) });
    if (!(await askConfirmation(question, t('Delete')))) return;
    if (holdsOpen(doomed)) await props.onLeave();
    await runLibrary(() => Promise.all([...tripsOf(doomed).map((trip) => deleteTrip(trip.id)), ...foldersOf(doomed).map((f) => deleteFolder(f.id, 'delete'))]), relist);
  };
  const merge = async (into: TripSummary, others: TripSummary[]) => {
    const what = counted(others.length, into.kind);
    const where = t(into.kind === 'collection' ? 'Their sections move into it' : 'Their days and journal move into it, a day onto its day of the same date where it has one');
    const question = plural(others.length, 'Merge {what} into “{name}”? {where}, and the merged one is deleted.|Merge {what} into “{name}”? {where}, and the merged ones are deleted.', { what, name: into.name, where });
    if (!(await askConfirmation(question, t('Merge')))) return;
    if (holdsOpen([{ trip: into }, ...others.map((trip) => ({ trip }))])) await props.onLeave();
    await runLibrary(() => mergeTrips(into.id, others.map((t) => t.id)), relist);
  };
  /** Whether the folder, null for the top, holds collections: the special folders and the folders in them do, everything else holds trips. */
  const holdsCollections = (id: number | null): boolean => kindAround(folders(), id) !== 'folder';
  /** Says of a folder, null for the top, whether it takes the items: all their trips, at any depth, are of the kind it holds. */
  const takerOf = (items: readonly Item[]) => {
    const within = tripsWithin(items);
    return (into: number | null): boolean => {
      const collections = holdsCollections(into);
      return within.every((trip) => (trip.kind === 'collection') === collections);
    };
  };
  /** Refuses, as the server would, to put the items into a folder that does not hold their kind. */
  const assertFits = (items: readonly Item[], into: number | null) => {
    if (!takerOf(items)(into)) throw new Error(t('Collections are kept in the folders for recordings and collections, trips in the others.'));
  };
  /** Moves folders and trips into a folder, none for the top, those not in it already; the server refuses a folder inside itself. */
  const moveInto = (moved: readonly Item[], into: number | null) => {
    const goingTrips = tripsOf(moved).filter((trip) => trip.folderId !== into);
    const goingFolders = foldersOf(moved).filter((f) => f.id !== into && f.parentId !== into);
    if (goingTrips.length + goingFolders.length === 0) return;
    void runLibrary(async () => {
      assertFits(moved, into);
      await Promise.all([...goingTrips.map((trip) => moveTrip(trip.id, into)), ...goingFolders.map((f) => moveFolder(f.id, into))]);
    }, relist);
  };
  /** Move… with the folders that take what is moved as its submenu, and none for the top; none where there is nowhere to go. */
  const moveItem = (moved: readonly Item[]): MenuItem[] => {
    const from = 'folder' in moved[0]! ? moved[0].folder.parentId : moved[0]!.trip.folderId;
    const movedFolders = new Set(foldersOf(moved).map((f) => f.id));
    const takes = takerOf(moved);
    const places: MenuItem[] = [
      ...(from === null || !takes(null) ? [] : [{ label: t('No folder'), run: () => moveInto(moved, null) }]),
      ...folders()
        .filter((f) => f.id !== from && !movedFolders.has(f.id) && takes(f.id))
        .map((f) => ({ label: pathOf(f.id), run: () => moveInto(moved, f.id) }))
        .sort((x, y) => x.label.localeCompare(y.label)),
    ];
    return places.length > 0 ? [{ label: t('Move…'), items: places }] : [];
  };
  /** What the clipboard holds of the library, by number: 2 folders and 3 trips. */
  const clipText = (copied: LibraryClip): string => countsText(copied.folderIds.length, copied.tripIds.length);
  /** The folders and trips on the clipboard, those still there. */
  const clipItems = (copied: LibraryClip): Item[] => [...folders().filter((f) => copied.folderIds.includes(f.id)).map((folder) => ({ folder })), ...trips().filter((trip) => copied.tripIds.includes(trip.id)).map((trip) => ({ trip }))];
  /** Pastes the folders and trips on the clipboard into a folder, which empties it: cut, they move there; copied, each trip gets a copy there. */
  const pasteLibrary = (into: number | null) => {
    const copied = libraryClip();
    if (!copied) return;
    const items = clipItems(copied);
    // A paste the folder refuses leaves the clipboard as it was.
    if (takerOf(items)(into)) clearClip();
    if (copied.move) return moveInto(items, into);
    void runLibrary(async () => {
      assertFits(items, into);
      await Promise.all(copied.tripIds.map(async (id) => moveTrip((await duplicateTrip(id)).id, into)));
    }, relist);
  };
  const renamedFolder = () => {
    const d = dialog();
    return d?.kind === 'rename-folder' ? d.folder : undefined;
  };
  const renamedTrip = () => {
    const d = dialog();
    return d?.kind === 'rename-trip' ? d.trip : undefined;
  };
  /** Pastes copied routes into the trip where an import would put them, and saves it. */
  const pasteInto = (tripId: number, routes: CopiedRoute[]) => changeTrip(tripId, (trip) => pasteIntoTrip(trip, routes, newId));
  /** A new collection in the folder for pasted routes, named after the first; its id. */
  const collectionFor = async (f: Folder, routes: CopiedRoute[]) => {
    const first = routes[0]!.route.name || t('Pasted routes');
    return (await createTrip(asName(routes.length > 1 ? t('{name} and {n} more', { name: first, n: routes.length - 1 }) : first), f.id, 'collection')).id;
  };
  /** What is pasted into the one folder or trip: folders and trips into a folder, routes into a trip or, as a new collection, into a folder that holds collections, days into a trip. */
  const pasteItems = (item: Item): MenuItem[] => {
    if ('folder' in item) {
      const f = item.folder;
      const copied = libraryClip();
      if (copied) return takerOf(clipItems(copied))(f.id) ? [{ label: t('Paste'), run: () => pasteLibrary(f.id) }] : [];
      if (!holdsCollections(f.id)) return [];
      return libraryPasteItem({ routes: (routes) => runLibrary(async () => pasteInto(await collectionFor(f, routes), routes), relistTrips) });
    }
    const id = item.trip.id;
    /** The open trip is left, saved, before it is changed on the server. */
    const left = async (paste: () => Promise<unknown>) => {
      if (holdsOpen([item])) await props.onLeave();
      await runLibrary(paste, relistTrips);
    };
    return libraryPasteItem({
      routes: (routes) => left(() => pasteInto(id, routes)),
      days: (days) => left(() => changeTrip(id, (trip) => pasteDays(trip, days, undefined, newId))),
    });
  };
  /** Puts folders and trips on the clipboard: cut, to be moved where they are pasted; copied, which only trips are. */
  const clip = (chosen: readonly Item[], move: boolean) => copyLibraryItems({ tripIds: tripsOf(chosen).map((trip) => trip.id), folderIds: foldersOf(chosen).map((f) => f.id), move });
  /** The keys that cut, copy and delete the selected folders and trips, and paste those on the clipboard into the folder shown, as the menu does. */
  const onKey = (e: KeyboardEvent) => {
    const verb = fileVerb(e);
    if (!verb) return;
    const chosen = [...selected().keys].flatMap((key) => itemOf(key) ?? []);
    if ((verb === 'paste' ? !libraryClip() : chosen.length === 0) || (verb === 'copy' && foldersOf(chosen).length > 0)) return;
    e.preventDefault();
    if (verb === 'paste') pasteLibrary(shownFolderId());
    else if (verb === 'delete') void remove(chosen);
    else clip(chosen, verb === 'cut');
  };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));

  /** Adds a day at the end of a trip: of the open one as an edit that can be undone, which shows the day; of another on the server. */
  const addDayTo = (trip: TripSummary) => (trip.id === openTripId() ? addDay() : void runLibrary(() => changeTrip(trip.id, (loaded) => withDayAdded(loaded, newId())), relistTrips));

  /**
   * The menu of a folder or a trip, the same for both: rename, duplicate, cut, copy, paste
   * into it, move, merge, a trip's new day, export, delete. Opened on a card of the selection it acts on all
   * of it; what does not apply to what is selected is greyed out.
   */
  const itemMenu = (item: Item): MenuItem[] => {
    const selection = menuSelection(selected(), keyOf(item));
    setSelected(selection.keys.size > 1 ? selection : NOTHING_SELECTED);
    const chosen = chosenWith(item, selection);
    const several = chosen.length > 1;
    const chosenTrips = tripsOf(chosen);
    const onlyTrips = chosenTrips.length === chosen.length;
    const [first, ...others] = chosenTrips;
    const paste = several ? [] : pasteItems(item);
    const within = tripsWithin(chosen);
    const nothing = () => undefined;
    const pasteEntries = paste.length > 0 ? paste : [{ label: t('Paste'), disabled: true, run: nothing }];
    const exportEntry = { label: t('Export'), disabled: within.length === 0, run: () => void flushSave().then(() => window.location.assign(tripArchiveUrl(within.map((trip) => trip.id)))) };
    // A special folder stays as it is: it only takes what is pasted and exports what it holds.
    if ('folder' in item && item.folder.kind !== 'folder') return [...pasteEntries, exportEntry];
    return [
      ...(several ? [{ label: t('{what} selected', { what: countText(chosen) }), disabled: true, run: nothing }] : []),
      // The open trip is renamed as it is edited; the others on the server.
      { label: t('Rename…'), disabled: several, run: () => ('folder' in item ? setDialog({ kind: 'rename-folder', folder: item.folder }) : item.trip.id === openTripId() ? setEditTarget({ kind: 'trip' }) : setDialog({ kind: 'rename-trip', trip: item.trip })) },
      { label: t('Duplicate'), disabled: !onlyTrips, run: () => void flushSave().then(() => runLibrary(() => Promise.all(chosenTrips.map((trip) => duplicateTrip(trip.id))), relist)) },
      { label: t('Cut'), run: () => clip(chosen, true) },
      { label: t('Copy'), disabled: !onlyTrips, run: () => clip(chosen, false) },
      ...pasteEntries,
      ...moveItem(chosen),
      ...(onlyTrips && several
        ? [
            others.every((trip) => trip.kind === first!.kind)
              ? { label: t('Merge into “{name}”', { name: first!.name }), run: () => void merge(first!, others) }
              : { label: t('Trips and planning material do not merge'), disabled: true, run: nothing },
          ]
        : []),
      ...(!several && 'trip' in item && item.trip.kind === 'trip' ? [{ label: t('Add day'), run: () => addDayTo(item.trip) }] : []),
      exportEntry,
      { label: t('Delete'), run: () => void remove(chosen) },
    ];
  };

  /** The folders and trips of a folder, each unfolding to what it holds: folders to theirs, a trip to its days. */
  const Branch = (branch: { parent: number | null }): JSX.Element => (
    <>
      <ForById each={childFolders(branch.parent)}>
        {(f) => (
          <FolderCard
            folder={f()}
            note={heldText(heldOf(f().id), holdsCollections(f().id) ? 'collection' : 'trip')}
            onOpen={() => clickFolder(f())}
            items={() => itemMenu({ folder: f() })}
            select={f().kind === 'folder' ? select({ folder: f() }) : undefined}
            fold={{ unfolded: () => isUnfolded({ folder: f() }), current: () => isMarkedFolder(f().id) }}
          >
            <Branch parent={f().id} />
          </FolderCard>
        )}
      </ForById>
      <ForById each={childTrips(branch.parent)}>
        {(trip) => (
          <TripCard
            trip={trip()}
            onOpen={clickTrip}
            disabled={props.opening}
            items={() => itemMenu({ trip: trip() })}
            select={select({ trip: trip() })}
            fold={{ unfolded: () => isUnfolded({ trip: trip() }), current: () => isMarkedTrip(trip()), open: () => openTripId() === trip().id }}
          >
            <Show when={openTripId() === trip().id} fallback={<TripDays trip={trip()} onOpen={(dayId) => props.onOpen(trip(), dayId)} />}>
              {props.children}
            </Show>
          </TripCard>
        )}
      </ForById>
    </>
  );

  return (
    <div class="library">
      <Show when={importNote()}>
        {(note) => (
          <>
            <p class="muted hint">{note().text}</p>
            <For each={note().errors}>{(error) => <p class="error">{error}</p>}</For>
          </>
        )}
      </Show>
      {/* Reading a resource that failed throws; its error is shown instead. */}
      <Switch fallback={<p class="muted">{t('Loading…')}</p>}>
        <Match when={libraryTrips.error ?? libraryFolders.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Match>
        <Match when={libraryTrips() && libraryFolders()}>
          <Show
            when={query().trim()}
            fallback={
              <>
                <Show when={libraryClip()}>
                  {(copied) => (
                    <button class="paste-here" onClick={() => pasteLibrary(shownFolderId())}>
                      {t(copied().move ? 'Move {what} to “{where}”' : 'Paste a copy of {what} into “{where}”', { what: clipText(copied()), where: pathOf(shownFolderId()) || ALL_TRIPS })}
                    </button>
                  )}
                </Show>
                <ul class="tree">
                  <li class="card" classList={{ current: isMarkedFolder(null) }}>
                    <div class="row">
                      <button class="text grow" onClick={() => markFolderShown(null)}>
                        <HomeIcon />
                        <span class="lines">
                          <span class="name">{ALL_TRIPS}</span>
                          <span class="muted detail">{heldText(heldOf(null))}</span>
                        </span>
                      </button>
                      <IconButton label={t('Fold all folders and trips away')} disabled={unfolded().size === 0} onClick={foldAll}>
                        <FoldIcon />
                      </IconButton>
                    </div>
                  </li>
                  <Branch parent={null} />
                </ul>
                <Show when={trips().length === 0 && folders().every((f) => f.kind !== 'folder')}>
                  <p class="muted">{t('No trips yet. Start one with the new trip icon above.')}</p>
                </Show>
              </>
            }
          >
            {(q) => (
              <SearchResults
                query={q()}
                folders={folders()}
                trips={trips()}
                onOpenFolder={props.onOpenFolder}
                onOpenTrip={props.onOpen}
                disabled={props.opening}
                folderNote={(f) => [pathOf(f.parentId), heldText(heldOf(f.id), holdsCollections(f.id) ? 'collection' : 'trip')].filter(Boolean).join(' · ')}
                tripWhere={(trip) => pathOf(trip.folderId) || t('No folder')}
                folderItems={(f) => itemMenu({ folder: f })}
                tripItems={(trip) => itemMenu({ trip })}
              />
            )}
          </Show>
        </Match>
      </Switch>
      <NameDialog
        title={t('Rename folder')}
        open={renamedFolder() !== undefined}
        placeholder={t('Name of the folder')}
        initial={renamedFolder()?.name}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => {
          const f = renamedFolder()!;
          if (name !== f.name) void runLibrary(() => renameFolder(f.id, name), relistFolders);
        }}
      />
      <NameDialog
        title={t('Rename trip')}
        open={renamedTrip() !== undefined}
        placeholder={t('Name of the trip')}
        initial={renamedTrip()?.name}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => {
          const trip = renamedTrip()!;
          if (name !== trip.name) void runLibrary(() => renameTrip(trip.id, name), relistTrips);
        }}
      />
    </div>
  );
}

/**
 * A trip as a card: its name over its days, its start and whether it was ridden, or for a
 * collection its sections, after the folder it is in where `where` names it, or, while it
 * is being opened, over how far its document has come, beside a spinner; its menu
 * renames, moves, copies and deletes it. A click opens it. Where it can be selected, a tap
 * on its pad selects it, a press drags it, and a click with Cmd, Ctrl or Shift held goes
 * to `select.onClick`.
 */
function TripCard(props: {
  trip: TripSummary;
  onOpen: (trip: TripSummary) => void;
  disabled: boolean;
  items: () => MenuItem[];
  where?: string;
  select?: CardSelect;
  fold?: CardFold;
  children?: JSX.Element;
}) {
  const shape = createMemo(() => outlineOf(props.trip.id)?.map((day) => day.lines).filter((lines) => lines.length > 0));
  /** How far the opening of the trip has come, while it is being opened. */
  const loading = () => (opening()?.tripId === props.trip.id ? opening()!.progress : undefined);
  const meta = () =>
    (props.trip.kind === 'collection'
      ? [props.where, t('Planning material'), counted(props.trip.dayCount, 'section')]
      : [props.where, counted(props.trip.dayCount, 'day'), props.trip.startsOn && t('from {date}', { date: dateText(props.trip.startsOn) }), props.trip.state === 'done' && t('done')]
    )
      .filter(Boolean)
      .join(' · ');
  return (
    <li class="card" classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current(), open: props.fold?.open?.(), opening: loading() !== undefined }}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.trip.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
          )}
        </Show>
        <button
          class="text grow"
          aria-expanded={props.fold?.unfolded()}
          onClick={(e) => (props.select && selects(e) ? props.select.onClick(e) : props.onOpen(props.trip))}
          disabled={props.disabled}
        >
          <Show when={!loading()} fallback={<span class="spinner" />}>
            <Show when={props.trip.kind === 'collection'} fallback={<TripIcon />}>
              <CollectionIcon />
            </Show>
          </Show>
          <span class="lines">
            <span class="name">{props.trip.name}</span>
            <span class="muted detail">
              <Show when={loading()} fallback={meta()}>
                {openingText(loading()!)}
              </Show>
            </span>
          </span>
          <Show when={shape()?.length ? shape() : undefined}>{(days) => <TripShape days={days()} />}</Show>
        </button>
        <MenuButton of={props.trip.name} items={props.items} />
      </div>
      <Show when={props.fold?.unfolded()}>
        <div class="tree-children">{props.children}</div>
      </Show>
    </li>
  );
}

/**
 * A folder as a card: its name over `note`, what it holds and in search results where it
 * is; its menu is the library's. Trips and folders dragged onto it move into it; with
 * `select`, its pad selects it or drags it into another. The two special folders are
 * tinted and have no pad.
 */
function FolderCard(props: { folder: Folder; note: string; onOpen: (id: number) => void; items: () => MenuItem[]; select?: CardSelect; fold?: CardFold; children?: JSX.Element }) {
  return (
    <li class="card" classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current() }} data-kind={props.folder.kind} data-drop-folder={String(props.folder.id)}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.folder.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
          )}
        </Show>
        <button class="text grow" aria-expanded={props.fold?.unfolded()} onClick={(e) => (props.select && selects(e) ? props.select.onClick(e) : props.onOpen(props.folder.id))}>
          <FolderIcon />
          <span class="lines">
            <span class="name">{props.folder.name}</span>
            <span class="muted detail">{props.note}</span>
          </span>
        </button>
        <MenuButton of={props.folder.name} items={props.items} />
      </div>
      <Show when={props.fold?.unfolded()}>
        <ul class="tree-children">{props.children}</ul>
      </Show>
    </li>
  );
}

/** Folders and trips whose names contain the query, whatever folder they are in, up to a limit. */
function SearchResults(props: {
  query: string;
  folders: Folder[];
  trips: TripSummary[];
  onOpenFolder: (id: number) => void;
  onOpenTrip: (trip: TripSummary) => void;
  disabled: boolean;
  /** What a found folder's card says: where it is and what it holds. */
  folderNote: (f: Folder) => string;
  /** Where a found trip is. */
  tripWhere: (trip: TripSummary) => string;
  folderItems: (f: Folder) => MenuItem[];
  tripItems: (trip: TripSummary) => MenuItem[];
}) {
  const matches = (name: string) => name.toLowerCase().includes(props.query.toLowerCase());
  const found = createMemo(() => ({ folders: props.folders.filter((f) => matches(f.name)), trips: props.trips.filter((t) => matches(t.name)) }));
  const total = () => found().folders.length + found().trips.length;
  const listedTrips = () => found().trips.slice(0, Math.max(0, SEARCH_LIMIT - found().folders.length));
  return (
    <Show when={total() > 0} fallback={<p class="muted">{t('Nothing found.')}</p>}>
      <ul class="results">
        <For each={found().folders.slice(0, SEARCH_LIMIT)}>
          {(f) => <FolderCard folder={f} note={props.folderNote(f)} onOpen={props.onOpenFolder} items={() => props.folderItems(f)} />}
        </For>
        <For each={listedTrips()}>
          {(trip) => <TripCard trip={trip} onOpen={props.onOpenTrip} disabled={props.disabled} items={() => props.tripItems(trip)} where={props.tripWhere(trip)} />}
        </For>
      </ul>
      <Show when={total() > SEARCH_LIMIT}>
        <p class="muted">{t('{n} more; narrow the search.', { n: total() - SEARCH_LIMIT })}</p>
      </Show>
    </Show>
  );
}
