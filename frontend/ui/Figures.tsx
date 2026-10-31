import { For } from 'solid-js';

/** Figures as a list of names and values. */
export function Figures(props: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl class="figures">
      <For each={props.rows}>
        {([label, value]) => (
          <>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </>
        )}
      </For>
    </dl>
  );
}
