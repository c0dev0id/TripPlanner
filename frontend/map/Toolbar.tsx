import { For, Show, type JSX } from 'solid-js';
import { HIGHWAYS, PROFILES, takesMotorwayDial } from '../model/trip';
import { setTool, tool, TOOLS, type Tool } from '../state/drawing';
import { recalculateRoute } from '../state/routing';
import { editingRoute, editRoute, redo, redoLabel, setRouteHighways, setRouteProfile, undo, undoLabel } from '../state/trip';
import { CheckIcon, DeleteIcon, InsertIcon, RedoIcon, RefreshIcon, StopIcon, UndoIcon } from '../ui/icons';

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

/** A choice among a few values, one radio button each, with an optional title before them. */
function Segmented<T extends string>(props: { name: string; label: string; title?: string; choices: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div class="toolbar-group segmented" role="radiogroup" aria-label={props.label}>
      <Show when={props.title}>{(title) => <span class="segmented-title">{title()}</span>}</Show>
      <For each={props.choices}>
        {(choice) => (
          <label>
            <input type="radio" name={props.name} value={choice.value} checked={props.value === choice.value} onChange={() => props.onChange(choice.value)} />
            <span>{choice.label}</span>
          </label>
        )}
      </For>
    </div>
  );
}

/** The tools of the route being edited, over the map: what a tap does, the profile and the motorway dial, undo and redo, reroute, done. */
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
          <div class="toolbar-group" role="group" aria-label="Tap">
            {button('point', <InsertIcon />)}
            {button('stop', <StopIcon />)}
            {button('delete', <DeleteIcon />)}
          </div>
          <Segmented name="profile" label="Routing profile" choices={PROFILES} value={route().profile} onChange={(profile) => setRouteProfile(route().id, profile)} />
          <Show when={takesMotorwayDial(route().profile)}>
            <Segmented name="highways" label="Motorways" title="Motorways" choices={HIGHWAYS} value={route().highways} onChange={(highways) => setRouteHighways(route().id, highways)} />
          </Show>
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
            <ToolButton label="Done" title="Stop editing the route (Esc)" onClick={() => editRoute(undefined)}>
              <CheckIcon />
            </ToolButton>
          </div>
        </div>
      )}
    </Show>
  );
}
