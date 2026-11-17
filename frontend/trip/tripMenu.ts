import { t } from '../i18n/t';
import { setExportScope } from '../state/drawing';
import { setWorkspaceOpen } from '../state/journal';
import type { MenuItem } from '../ui/menu';

/** The open trip's journal, with the page it is shared on. */
export const journalItem = (): MenuItem => ({ label: t('Journal and sharing…'), run: () => setWorkspaceOpen(true) });

/** What the open trip has that no other has: its GPX export and its journal. Its row in the library and the head of its pane both offer them. */
export const openTripItems = (): MenuItem[] => [{ label: t('Export GPX…'), run: () => setExportScope({ kind: 'trip' }) }, journalItem()];
