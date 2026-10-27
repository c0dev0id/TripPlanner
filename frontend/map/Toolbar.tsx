import { For, Show, type JSX } from 'solid-js';
import { PROFILES } from '../model/trip';
import { setTool, tool, type Tool } from '../state/drawing';
import { recalculateDay } from '../state/routing';
import { redo, redoLabel, selectedDay, setDayProfile, undo, undoLabel } from '../state/trip';
import { DeleteIcon, InsertIcon, RedoIcon, RefreshIcon, StopIcon, UndoIcon } from '../ui/icons';

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

/** The tools of the selected day over the map: what a tap does, the routing profile, undo and redo, recalculation. */
export function Toolbar() {
  const button = (t: Tool, label: string, title: string, icon: JSX.Element) => (
    <ToolButton label={label} title={title} active={tool() === t} onClick={() => setTool(t)}>
      {icon}
    </ToolButton>
  );
  return (
    <Show when={selectedDay()}>
      {(day) => (
        <div class="toolbar" role="toolbar" aria-label="Day tools">
          <div class="toolbar-group" role="group" aria-label="Tap">
            {button('stop', 'Stop', 'Tap the map to add a stop at the end of the day, or tap a route to add a stop there', <StopIcon />)}
            {button('point', 'Point', 'Tap a route to insert a point there, for shaping it', <InsertIcon />)}
            {button('delete', 'Delete', 'Tap a stop or a point to delete it', <DeleteIcon />)}
          </div>
          <div class="toolbar-group segmented" role="radiogroup" aria-label="Routing profile">
            <For each={PROFILES}>
              {(profile) => (
                <label classList={{ active: day().routes.length > 0 && day().routes.every((r) => r.profile === profile.value) }}>
                  <input
                    type="radio"
                    name="profile"
                    value={profile.value}
                    checked={day().routes.length > 0 && day().routes.every((r) => r.profile === profile.value)}
                    onChange={() => setDayProfile(profile.value)}
                  />
                  <span>{profile.label}</span>
                </label>
              )}
            </For>
          </div>
          <div class="toolbar-group" role="group" aria-label="History">
            <ToolButton label="Undo" title={undoLabel() ? `Undo: ${undoLabel()} (Ctrl+Z)` : 'Nothing to undo'} disabled={!undoLabel()} onClick={undo}>
              <UndoIcon />
            </ToolButton>
            <ToolButton label="Redo" title={redoLabel() ? `Redo: ${redoLabel()} (Ctrl+Shift+Z)` : 'Nothing to redo'} disabled={!redoLabel()} onClick={redo}>
              <RedoIcon />
            </ToolButton>
            <ToolButton label="Reroute" title="Route every leg of the day again" disabled={day().routes.length === 0} onClick={recalculateDay}>
              <RefreshIcon />
            </ToolButton>
          </div>
        </div>
      )}
    </Show>
  );
}
