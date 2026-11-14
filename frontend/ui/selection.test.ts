import { describe, expect, it } from 'vitest';
import { anchoredAt, clickSelect, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, selectionOwner, type Selection } from './selection';

const order = ['a', 'b', 'c', 'd'];
const plain = { metaKey: false, ctrlKey: false, shiftKey: false };
const cmd = { ...plain, metaKey: true };
const ctrl = { ...plain, ctrlKey: true };
const shift = { ...plain, shiftKey: true };
const keys = (s: Selection<string>) => [...s.keys].sort();

describe('clickSelect', () => {
  it('selects the clicked row alone', () => {
    const s = clickSelect({ keys: new Set(['a', 'b']), anchor: 'a' }, order, 'c', plain);
    expect([keys(s), s.anchor]).toEqual([['c'], 'c']);
  });

  it('adds or takes away a row with Cmd or Ctrl, in the order selected', () => {
    const added = clickSelect(clickSelect(NOTHING_SELECTED, order, 'a', plain), order, 'c', cmd);
    expect([...clickSelect(added, order, 'b', ctrl).keys]).toEqual(['a', 'c', 'b']);
    expect(keys(clickSelect(added, order, 'a', cmd))).toEqual(['c']);
  });

  it('selects the rows from the one clicked last with Shift, either way, that one first', () => {
    const start = clickSelect(NOTHING_SELECTED, order, 'b', plain);
    const run = clickSelect(start, order, 'd', shift);
    expect([[...run.keys], run.anchor]).toEqual([['b', 'c', 'd'], 'd']);
    const back = clickSelect(run, order, 'a', shift);
    expect([[...back.keys], back.anchor]).toEqual([['d', 'c', 'b', 'a'], 'a']);
  });

  it('lets go of what lies outside a Shift run', () => {
    const long = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
    const first = clickSelect(clickSelect(NOTHING_SELECTED, long, 's1', plain), long, 's4', shift);
    expect(keys(first)).toEqual(['s1', 's2', 's3', 's4']);
    const second = clickSelect(first, long, 's9', shift);
    expect(keys(second)).toEqual(['s4', 's5', 's6', 's7', 's8', 's9']);
    expect(keys(clickSelect(second, long, 's5', shift))).toEqual(['s5', 's6', 's7', 's8', 's9']);
  });

  it('selects from a row that was only opened', () => {
    expect(keys(clickSelect(anchoredAt('s3'), ['s1', 's2', 's3', 's4', 's5'], 's5', shift))).toEqual(['s3', 's4', 's5']);
  });

  it('starts over after a Cmd click, at the row it was on', () => {
    const picked = clickSelect(clickSelect(NOTHING_SELECTED, order, 'a', plain), order, 'c', cmd);
    expect(keys(clickSelect(picked, order, 'd', shift))).toEqual(['c', 'd']);
  });

  it('selects the row alone on Shift without an anchor', () => {
    expect(keys(clickSelect(NOTHING_SELECTED, order, 'c', shift))).toEqual(['c']);
  });
});

describe('menuSelection', () => {
  it('keeps a selection that holds the row, else takes the row alone', () => {
    const two: Selection<string> = { keys: new Set(['a', 'b']), anchor: 'a' };
    expect(menuSelection(two, 'b')).toBe(two);
    expect(menuSelection(two, 'c')).toEqual({ keys: new Set(['c']), anchor: 'c' });
  });
});

describe('the selection held', () => {
  it('keeps an anchor without rows, which is no selection', () => {
    selectIn('days', { keys: new Set(['a', 'b']), anchor: 'b' });
    selectIn('routes', anchoredAt('r1'));
    expect([selectionOwner(), selectionOf('days').keys.size, selectionOf('routes').anchor]).toEqual([undefined, 0, 'r1']);
    selectIn('routes', NOTHING_SELECTED);
    expect(selectionOf('routes').anchor).toBeUndefined();
  });
});
