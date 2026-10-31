import { createEffect, onCleanup, onMount } from 'solid-js';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { showsDark } from './theme';

/** The colours a chart draws its axes in, read from its box's styles (styles.css): its text colour, and its border colour for grid lines. */
export interface ChartInk {
  text: string;
  grid: string;
}

/**
 * A uPlot chart filling its box: made again when what `make` reads changes or the page
 * turns light or dark, and sized with its box. `ready` gets every chart made.
 */
export function Chart(props: { make: (ink: ChartInk) => { options: Omit<uPlot.Options, 'width' | 'height'>; data: uPlot.AlignedData }; ready?: (chart: uPlot) => void }) {
  let box!: HTMLDivElement;
  onMount(() => {
    let chart: uPlot | undefined;
    const size = () => ({ width: box.clientWidth, height: box.clientHeight });
    createEffect(() => {
      showsDark();
      const style = getComputedStyle(box);
      const { options, data } = props.make({ text: style.color, grid: style.borderTopColor });
      chart?.destroy();
      chart = new uPlot({ ...options, ...size() }, data, box);
      props.ready?.(chart);
    });
    const resize = new ResizeObserver(() => chart?.setSize(size()));
    resize.observe(box);
    onCleanup(() => {
      resize.disconnect();
      chart?.destroy();
    });
  });
  return <div class="chart" ref={box} />;
}
