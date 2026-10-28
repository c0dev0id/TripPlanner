import { Show, type JSX } from 'solid-js';
import { setEditTarget, setTool, tool, TOOLS, type Tool } from '../state/drawing';
import { recalculateRoute } from '../state/routing';
import { editingRoute, editRoute, redo, redoLabel, undo, undoLabel } from '../state/trip';
import { CheckIcon, DeleteIcon, HandIcon, InsertIcon, RedoIcon, RefreshIcon, SettingsIcon, StopIcon, UndoIcon } from '../ui/icons';

/** A toolbar button: an icon over a short caption, with a tooltip that says more. `active` marks the picked tool. */
function ToolButton(props: { label: string; title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class="tool"
      classList={{ active: props.active }}
      title={props.title}
      aria-pressed={props.active === undefined ? undefined : props.active}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.children}
      <span class="tool-label">{props.label}</span>
    </button>
  );
}

/** The tools of the selected route, over the map: what a tap does, the route's settings, undo and redo, reroute, done. */
export function Toolbar() {
  const button = (t: Tool, icon: JSX.Element) => (
    <ToolButton label={TOOLS[t].label} title={`${TOOLS[t].hint[0]!.toUpperCase()}${TOOLS[t].hint.slice(1)}`} active={tool() === t} onClick={() => setTool(t)}>
      {icon}
    </ToolButton>
  );
  return (
    <Show when={editingRoute()}>
      {(route) => (
        <div class="toolbar" role="toolbar" aria-label="Route tools">
          <div class="toolbar-group" role="group" aria-label="Tool">
            {button('hand', <HandIcon />)}
            {button('point', <InsertIcon />)}
            {button('stop', <StopIcon />)}
            {button('delete', <DeleteIcon />)}
          </div>
          <div class="toolbar-group" role="group" aria-label="Route">
            <ToolButton label="Route" title="The route's name, profile, motorways and more" onClick={() => setEditTarget({ kind: 'route', id: route().id })}>
              <SettingsIcon />
            </ToolButton>
          </div>
          <div class="toolbar-group" role="group" aria-label="History">
            <ToolButton label="Undo" title={undoLabel() ? `Undo: ${undoLabel()} (Ctrl+Z)` : 'Nothing to undo'} disabled={!undoLabel()} onClick={undo}>
              <UndoIcon />
            </ToolButton>
            <ToolButton label="Redo" title={redoLabel() ? `Redo: ${redoLabel()} (Ctrl+Shift+Z)` : 'Nothing to redo'} disabled={!redoLabel()} onClick={redo}>
              <RedoIcon />
            </ToolButton>
            <ToolButton label="Reroute" title="Route every leg of the route again" disabled={route().points.length < 2} onClick={() => recalculateRoute(route().id)}>
              <RefreshIcon />
            </ToolButton>
          </div>
          <div class="toolbar-group" role="group" aria-label="Editing">
            <ToolButton label="Done" title="Leave the route (Esc)" onClick={() => editRoute(undefined)}>
              <CheckIcon />
            </ToolButton>
          </div>
        </div>
      )}
    </Show>
  );
}
