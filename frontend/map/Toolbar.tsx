import { For, Show, type JSX } from 'solid-js';
import { t } from '../i18n/t';
import { currentTool, setEditTarget, setTool, toolsOf, TOOLS, type Tool } from '../state/drawing';
import type { Route } from '../model/trip';
import { routedLegs } from '../routing/legs';
import { recalculateRoute } from '../state/routing';
import { editingRoute, takeUpRoute, redo, redoLabel, undo, undoLabel } from '../state/trip';
import { setMenu, type MenuItem } from '../ui/menu';
import { CheckIcon, DeleteIcon, DotsIcon, HandIcon, InsertIcon, PinIcon, RedoIcon, RefreshIcon, SettingsIcon, UndoIcon } from '../ui/icons';

/** A toolbar button: an icon over a short caption, with a tooltip that says more. `active` marks the picked tool. */
function ToolButton(props: { label: string; title: string; active?: boolean; disabled?: boolean; onClick: (e: MouseEvent) => void; children: JSX.Element }) {
  return (
    <button
      class="tool"
      classList={{ active: props.active }}
      title={props.title}
      aria-pressed={props.active === undefined ? undefined : props.active}
      disabled={props.disabled}
      onClick={(e) => props.onClick(e)}
    >
      {props.children}
      <span class="tool-label">{props.label}</span>
    </button>
  );
}

const TOOL_ICONS: Record<Tool, () => JSX.Element> = { hand: HandIcon, point: InsertIcon, stop: PinIcon, delete: DeleteIcon };

/**
 * The tools of the selected route, over the map: what a tap does, the route's settings,
 * undo and redo, reroute, done. A phone's width holds the tools, undo and done; the rest
 * is in the menu of a button that only shows there.
 */
export function Toolbar() {
  const settings = (route: Route) => setEditTarget({ kind: 'route', id: route.id });
  const openMore = (e: MouseEvent, route: Route) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const items: MenuItem[] = [
      { label: t('Redo'), disabled: !redoLabel(), run: redo },
      // A track has no legs to route.
      ...(route.kind === 'track' ? [] : [{ label: t('Reroute'), disabled: routedLegs(route).length === 0, run: () => recalculateRoute(route.id) }]),
      { label: t("Route settings…"), run: () => settings(route) },
    ];
    setMenu({ x: box.left, y: box.top, touch: false, items });
  };
  const button = (t: Tool) => (
    <ToolButton label={TOOLS[t].label} title={TOOLS[t].hint} active={currentTool() === t} onClick={() => setTool(t)}>
      {TOOL_ICONS[t]()}
    </ToolButton>
  );
  return (
    <Show when={editingRoute()}>
      {(route) => (
        <div class="toolbar" role="toolbar" aria-label={t('Route tools')}>
          <div class="toolbar-group" role="group" aria-label={t('Tool')}>
            <For each={toolsOf(route())}>{button}</For>
          </div>
          <div class="toolbar-group wide" role="group" aria-label={t('Route')}>
            <ToolButton label={t('Route')} title={t("Route name, profile, motorways and more")} onClick={() => settings(route())}>
              <SettingsIcon />
            </ToolButton>
          </div>
          <div class="toolbar-group" role="group" aria-label={t('History')}>
            <ToolButton label={t('Undo')} title={undoLabel() ? t('Undo: {what} (Ctrl+Z)', { what: undoLabel()! }) : t('Nothing to undo')} disabled={!undoLabel()} onClick={undo}>
              <UndoIcon />
            </ToolButton>
            <span class="wide">
              <ToolButton label={t('Redo')} title={redoLabel() ? t('Redo: {what} (Ctrl+Shift+Z)', { what: redoLabel()! }) : t('Nothing to redo')} disabled={!redoLabel()} onClick={redo}>
                <RedoIcon />
              </ToolButton>
              <ToolButton label={t('Reroute')} title={t('Recalculate every leg of the route')} disabled={routedLegs(route()).length === 0} onClick={() => recalculateRoute(route().id)}>
                <RefreshIcon />
              </ToolButton>
            </span>
            <span class="narrow">
              <ToolButton label={t('More')} title={t("Redo, reroute and route settings")} onClick={(e) => openMore(e, route())}>
                <DotsIcon />
              </ToolButton>
            </span>
          </div>
          <div class="toolbar-group" role="group" aria-label={t('Editing')}>
            <ToolButton label={t('Done')} title={t('Finish editing the route (Esc)')} onClick={() => takeUpRoute(undefined)}>
              <CheckIcon />
            </ToolButton>
          </div>
        </div>
      )}
    </Show>
  );
}
