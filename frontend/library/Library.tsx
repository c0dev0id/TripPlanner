import { plural, t } from '../i18n/t';
import { createEffect, createMemo, createSelector, createSignal, For, Match, on, onCleanup, Show, Switch, type JSX } from 'solid-js';
import { changeTrip, createTrip, deleteFolder, deleteTrip, duplicateTrip, errorMessage, mergeTrips, moveFolder, moveTrip, renameFolder, renameTrip, tripArchiveUrl } from '../api';
import { asName, newId, type Folder, type TripSummary } from '../model/trip';
import { pasteDays, pasteIntoTrip, type CopiedRoute } from '../routing/dayEdit';
import { clearClip, copyLibraryItems, libraryClip, libraryPasteItem, type LibraryClip } from '../state/clipboard';
import { heldOf, importNote, libraryFolders, libraryTrips, outlineOf, query, relistFolders, relistTrips, runLibrary, showFolder, shownFolderId } from '../state/library';
import { folderPath, heldInAll, heldText } from './folders';
import { flushSave } from '../state/autosave';
import { setEditTarget } from '../state/drawing';
import { openTrip, openTripId, selectDay } from '../state/trip';
import { dayLabel } from '../trip/labels';
import { readPreference, writePreference } from '../ui/preferences';
import { cardMenu } from '../ui/cardMenu';
import { askChoice, askConfirmation } from '../ui/confirm';
import { counted, dateText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, CollectionIcon, FoldIcon, FolderIcon, HomeIcon, TripIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { clickSelect, holdSelection, menuSelection, NOTHING_SELECTED, selectionOwner, toggled, type Selection } from '../ui/selection';
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

/** How a card unfolds in the tree, and whether it is the folder new things go into, or the open trip. */
interface CardFold {
  unfolded: () => boolean;
  toggle: () => void;
  current: () => boolean;
}

/** The browser's preference that keeps what is unfolded in the tree. */
const UNFOLDED = 'libraryUnfolded';

/** The arrowhead that unfolds a folder or a trip in the tree, and folds it again. */
function FoldButton(props: { fold: CardFold }) {
  const label = () => t(props.fold.unfolded() ? 'Fold away' : 'Unfold');
  return (
    <button class="icon fold" aria-expanded={props.fold.unfolded()} title={label()} aria-label={label()} onClick={() => props.fold.toggle()}>
      <ChevronIcon />
    </button>
  );
}

/** The days of a trip that is not open, as the library knows them: a click opens the trip at the day. */
function TripDays(props: { trip: TripSummary; onOpen: (dayId: string) => void }) {
  return (
    <ul class="tree-days">
      <For each={outlineOf(props.trip.id) ?? []} fallback={<li class="muted">{t(props.trip.kind === 'collection' ? 'No sections yet.' : 'No days yet.')}</li>}>
        {(day, index) => (
          <li class="row">
            <button class="text grow" onClick={() => props.onOpen(day.id)}>
              <span class="name">{props.trip.kind === 'collection' ? day.name : dayLabel(day, index())}</span>
            </button>
          </li>
        )}
      </For>
    </ul>
  );
}

/** At most this many search results are listed. */
const SEARCH_LIMIT = 20;

/** The dialog the library has open: a new name for a folder or a trip. */
type LibraryDialog = { kind: 'rename-folder'; folder: Folder } | { kind: 'rename-trip'; trip: TripSummary };

/**
 * The folder the explorer shows, its folders and trips, or what the search found across
 * all folders: open one, move, merge, rename, delete.
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
  const foldAll = () => {
    setUnfolded(new Set<string>());
    writePreference(UNFOLDED, undefined);
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
  // The folders a trip lies in unfold when it opens, so that it is in view; the trip itself only while it is empty, when all there is to do in it is adding to it.
  createEffect(
    on(openTripId, (id) => {
      const keys: string[] = openTrip()?.days.length === 0 ? [`trip:${id}`] : [];
      for (let f = folders().find((folder) => folder.id === trips().find((trip) => trip.id === id)?.folderId); f; f = folders().find((folder) => folder.id === f!.parentId)) keys.push(keyOf({ folder: f }));
      if (keys.length > 0) fold(keys, true);
    }),
  );
  const childFolders = (parent: number | null) => folders().filter((f) => f.parentId === parent);
  const childTrips = (parent: number | null) => trips().filter((trip) => trip.folderId === parent);
  /** A click on a folder makes it the one new trips and pasted ones go into, and unfolds it, or folds it where it was both already. */
  const clickFolder = (f: Folder) => {
    const key = keyOf({ folder: f });
    fold([key], !(unfolded().has(key) && shownFolderId() === f.id));
    showFolder(f.id);
  };
  /** A click on a trip opens it; on the open one it shows the trip whole again. */
  const clickTrip = (trip: TripSummary) => (trip.id === openTripId() ? selectDay(undefined) : props.onOpen(trip));
  /** Whether what is acted on holds the open trip, which the library must not change behind its back. */
  const holdsOpen = (items: readonly Item[]): boolean => tripsWithin(items).some((trip) => trip.id === openTripId());

  /** Asks to delete the folder and, when it holds anything, whether that moves up or goes with it; undefined when the user cancels. */
  const askFolderDeletion = async (f: Folder): Promise<'move' | 'delete' | undefined> => {
    const contentsText = ({ folders, trips }: { folders: number; trips: number }) => {
      const folderText = folders > 0 ? counted(folders, 'folder') : '';
      const tripText = trips > 0 ? counted(trips, 'trip') : '';
      return folderText && tripText ? t('{folders} and {trips}', { folders: folderText, trips: tripText }) : folderText || tripText;
    };
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
  const [selected, setSelected] = createSignal<Selection<string>>(NOTHING_SELECTED);
  createEffect(on(shownFolderId, () => setSelected(NOTHING_SELECTED)));
  // One selection at a time across the lists: this one gives way to another's.
  createEffect(() => holdSelection('library', selected().keys.size));
  createEffect(() => selectionOwner() !== 'library' && setSelected(NOTHING_SELECTED));
  const isSelected = createSelector(() => selected().keys, (key: string, keys) => keys.has(key));
  /** Every folder and trip there is, by key. */
  const itemOf = (key: string): Item | undefined => {
    const id = Number(key.slice(key.indexOf(':') + 1));
    if (key.startsWith('folder:')) return itemOfFolder(folders().find((f) => f.id === id));
    return itemOfTrip(trips().find((t) => t.id === id));
  };
  /** The folders and trips in view, top to bottom: those of the top and of every unfolded folder. */
  const shownKeys = (parent: number | null = null): string[] => [
    ...childFolders(parent).flatMap((f) => [keyOf({ folder: f }), ...(isUnfolded({ folder: f }) ? shownKeys(f.id) : [])]),
    ...childTrips(parent).map((trip) => keyOf({ trip })),
  ];
  /** What a card's menu, or a press on its pad, acts on: the selection where it holds the card, else the card alone. */
  const chosenWith = (item: Item, selection: Selection<string> = selected()): Item[] => (selection.keys.has(keyOf(item)) ? [...selection.keys].flatMap((key) => itemOf(key) ?? []) : [item]);
  const select = (item: Item) => ({
    selected: () => isSelected(keyOf(item)),
    cut: () => isCut(item),
    onToggle: () => setSelected((s) => toggled(s, keyOf(item))),
    onClick: (e: MouseEvent) => setSelected((s) => clickSelect(s, shownKeys(), keyOf(item), e)),
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
  const countText = (items: readonly Item[]): string => {
    const folderText = foldersOf(items).length > 0 ? counted(foldersOf(items).length, 'folder') : '';
    const tripText = tripsOf(items).length > 0 ? counted(tripsOf(items).length, 'trip') : '';
    return folderText && tripText ? t('{folders} and {trips}', { folders: folderText, trips: tripText }) : folderText || tripText;
  };
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
  /** Moves folders and trips into a folder, none for the top, those not in it already; the server refuses a folder inside itself. */
  const moveInto = (moved: readonly Item[], into: number | null) => {
    const goingTrips = tripsOf(moved).filter((trip) => trip.folderId !== into);
    const goingFolders = foldersOf(moved).filter((f) => f.id !== into && f.parentId !== into);
    if (goingTrips.length + goingFolders.length === 0) return;
    void runLibrary(() => Promise.all([...goingTrips.map((trip) => moveTrip(trip.id, into)), ...goingFolders.map((f) => moveFolder(f.id, into))]), relist);
  };
  /** Move… with the folders to move into as its submenu, and none for the top; none where there is nowhere to go. */
  const moveItem = (moved: readonly Item[]): MenuItem[] => {
    const from = 'folder' in moved[0]! ? moved[0].folder.parentId : moved[0]!.trip.folderId;
    const movedFolders = new Set(foldersOf(moved).map((f) => f.id));
    const places: MenuItem[] = [
      ...(from === null ? [] : [{ label: t('No folder'), run: () => moveInto(moved, null) }]),
      ...folders()
        .filter((f) => f.id !== from && !movedFolders.has(f.id))
        .map((f) => ({ label: pathOf(f.id), run: () => moveInto(moved, f.id) }))
        .sort((x, y) => x.label.localeCompare(y.label)),
    ];
    return places.length > 0 ? [{ label: t('Move…'), items: places }] : [];
  };
  /** What the clipboard holds of the library, by number: 2 folders and 3 trips. */
  const clipText = (copied: LibraryClip): string => {
    const folderText = copied.folderIds.length > 0 ? counted(copied.folderIds.length, 'folder') : '';
    const tripText = copied.tripIds.length > 0 ? counted(copied.tripIds.length, 'trip') : '';
    return folderText && tripText ? t('{folders} and {trips}', { folders: folderText, trips: tripText }) : folderText || tripText;
  };
  /** Pastes the folders and trips on the clipboard into a folder: cut, they move there; copied, each trip gets a copy there. */
  const pasteLibrary = (into: number | null) => {
    const copied = libraryClip();
    if (!copied) return;
    if (copied.move) {
      clearClip();
      moveInto([...copied.folderIds.map((id) => itemOf(`folder:${id}`)), ...copied.tripIds.map((id) => itemOf(`trip:${id}`))].filter((item): item is Item => item !== undefined), into);
      return;
    }
    void runLibrary(async () => {
      for (const id of copied.tripIds) await moveTrip((await duplicateTrip(id)).id, into);
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
  /** What is pasted into the one folder or trip: folders and trips into a folder, routes into either, days into a trip. */
  const pasteItems = (item: Item): MenuItem[] => {
    if ('folder' in item) {
      const f = item.folder;
      if (libraryClip()) return [{ label: t('Paste'), run: () => pasteLibrary(f.id) }];
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
    const chosen = [...selected().keys].flatMap((key) => itemOf(key) ?? []);
    if (!verb || (verb === 'paste' ? !libraryClip() : chosen.length === 0) || (verb === 'copy' && foldersOf(chosen).length > 0)) return;
    e.preventDefault();
    if (verb === 'paste') pasteLibrary(shownFolderId());
    else if (verb === 'delete') void remove(chosen);
    else clip(chosen, verb === 'cut');
  };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));

  /**
   * The menu of a folder or a trip, the same for both: rename, duplicate, cut, copy, paste
   * into it, move, merge, export, delete. Opened on a card of the selection it acts on all
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
    return [
      ...(several ? [{ label: t('{what} selected', { what: countText(chosen) }), disabled: true, run: nothing }] : []),
      // The open trip is renamed as it is edited; the others on the server.
      { label: t('Rename…'), disabled: several, run: () => ('folder' in item ? setDialog({ kind: 'rename-folder', folder: item.folder }) : item.trip.id === openTripId() ? setEditTarget({ kind: 'trip' }) : setDialog({ kind: 'rename-trip', trip: item.trip })) },
      { label: t('Duplicate'), disabled: !onlyTrips, run: () => void flushSave().then(() => runLibrary(() => Promise.all(chosenTrips.map((trip) => duplicateTrip(trip.id))), relist)) },
      { label: t('Cut'), run: () => clip(chosen, true) },
      { label: t('Copy'), disabled: !onlyTrips, run: () => clip(chosen, false) },
      ...(paste.length > 0 ? paste : [{ label: t('Paste'), disabled: true, run: nothing }]),
      ...moveItem(chosen),
      ...(onlyTrips && several
        ? [
            others.every((trip) => trip.kind === first!.kind)
              ? { label: t('Merge into “{name}”', { name: first!.name }), run: () => void merge(first!, others) }
              : { label: t('Trips and planning material do not merge'), disabled: true, run: nothing },
          ]
        : []),
      { label: t('Export'), disabled: within.length === 0, run: () => void flushSave().then(() => window.location.assign(tripArchiveUrl(within.map((trip) => trip.id)))) },
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
            note={heldText(heldOf(f().id))}
            onOpen={() => clickFolder(f())}
            items={() => itemMenu({ folder: f() })}
            select={select({ folder: f() })}
            fold={{ unfolded: () => isUnfolded({ folder: f() }), toggle: () => fold([keyOf({ folder: f() })], !isUnfolded({ folder: f() })), current: () => shownFolderId() === f().id }}
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
            fold={{ unfolded: () => isUnfolded({ trip: trip() }), toggle: () => fold([keyOf({ trip: trip() })], !isUnfolded({ trip: trip() })), current: () => openTripId() === trip().id }}
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
                  <li class="card" classList={{ current: shownFolderId() === null }} data-drop-folder="top">
                    <div class="row">
                      <button class="text grow" onClick={() => showFolder(null)}>
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
                <Show when={folders().length + trips().length === 0}>
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
                folderNote={(f) => [pathOf(f.parentId), heldText(heldOf(f.id))].filter(Boolean).join(' · ')}
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
 * collection its sections, after the folder it is in where `where` names it; its menu
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
  const shape = () => outlineOf(props.trip.id)?.map((day) => day.lines).filter((lines) => lines.length > 0);
  const meta = () =>
    (props.trip.kind === 'collection'
      ? [props.where, t('Planning material'), counted(props.trip.dayCount, 'section')]
      : [props.where, counted(props.trip.dayCount, 'day'), props.trip.startsOn && t('from {date}', { date: dateText(props.trip.startsOn) }), props.trip.state === 'done' && t('done')]
    )
      .filter(Boolean)
      .join(' · ');
  return (
    <li class="card" classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current() }}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.trip.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
          )}
        </Show>
        <Show when={props.fold}>{(fold) => <FoldButton fold={fold()} />}</Show>
        <button
          class="text grow"
          onClick={(e) => (props.select && (e.metaKey || e.ctrlKey || e.shiftKey) ? props.select.onClick(e) : props.onOpen(props.trip))}
          disabled={props.disabled}
        >
          <Show when={props.trip.kind === 'collection'} fallback={<TripIcon />}>
            <CollectionIcon />
          </Show>
          <span class="lines">
            <span class="name">{props.trip.name}</span>
            <span class="muted detail">{meta()}</span>
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
 * is; its menu renames and deletes it. Trips and folders dragged onto it move into it;
 * where `onDrag` is given, its pad drags it into another.
 */
function FolderCard(props: { folder: Folder; note: string; onOpen: (id: number) => void; items: () => MenuItem[]; select?: CardSelect; fold?: CardFold; children?: JSX.Element }) {
  return (
    <li class="card" classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current() }}>
      <div class="row" data-drop-folder={String(props.folder.id)} ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.folder.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
          )}
        </Show>
        <Show when={props.fold}>{(fold) => <FoldButton fold={fold()} />}</Show>
        <button class="text grow" onClick={(e) => (props.select && (e.metaKey || e.ctrlKey || e.shiftKey) ? props.select.onClick(e) : props.onOpen(props.folder.id))}>
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
