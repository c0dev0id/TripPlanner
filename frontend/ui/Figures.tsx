import { For } from 'solid-js';

/** Figures as a list of names and values; a figure without a value is left out. */
export function Figures(props: { rows: readonly (readonly [string, string | undefined])[] }) {
  return (
    <dl class="figures">
      <For each={props.rows.filter(([, value]) => value !== undefined)}>
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
