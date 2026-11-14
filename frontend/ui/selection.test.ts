import { beforeEach, describe, expect, it } from 'vitest';
import { clickRow, clickSelect, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, selectionOwner, toggleRow, type Selection } from './selection';

const order = ['a', 'b', 'c', 'd'];
const plain = { metaKey: false, ctrlKey: false, shiftKey: false };
const cmd = { ...plain, metaKey: true };
const ctrl = { ...plain, ctrlKey: true };
const shift = { ...plain, shiftKey: true };

describe('clickSelect', () => {
  it('adds or takes away a row with Cmd or Ctrl, in the order selected', () => {
    const added = clickSelect(clickSelect(NOTHING_SELECTED, order, 'a', cmd), order, 'c', cmd);
    expect([...clickSelect(added, order, 'b', ctrl)]).toEqual(['a', 'c', 'b']);
    expect([...clickSelect(added, order, 'a', cmd)]).toEqual(['c']);
  });

  it('selects the rows from the anchor with Shift and no others, either way, the anchor first', () => {
    const others: Selection<string> = new Set(['a']);
    expect([...clickSelect(others, order, 'd', shift, 'b')]).toEqual(['b', 'c', 'd']);
    expect([...clickSelect(others, order, 'a', shift, 'c')]).toEqual(['c', 'b', 'a']);
  });

  it('selects the row alone on Shift without an anchor among the rows', () => {
    expect([...clickSelect(NOTHING_SELECTED, order, 'c', shift)]).toEqual(['c']);
    expect([...clickSelect(NOTHING_SELECTED, order, 'c', shift, 'gone')]).toEqual(['c']);
  });
});

describe('menuSelection', () => {
  it('keeps a selection that holds the row, else takes the row alone', () => {
    const two: Selection<string> = new Set(['a', 'b']);
    expect(menuSelection(two, 'b')).toBe(two);
    expect([...menuSelection(two, 'c')]).toEqual(['c']);
  });
});

describe('clicks on the rows of a list', () => {
  const sections = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
  const click = (key: string, keys = plain) => clickRow('sections', sections, key, keys);
  const selected = () => [...selectionOf('sections')].sort();
  beforeEach(() => {
    selectIn('sections', NOTHING_SELECTED);
    click('s1');
  });

  it('start a Shift run at the row clicked last, whatever that click did', () => {
    expect(click('s4', shift)).toBe(true);
    expect(selected()).toEqual(['s1', 's2', 's3', 's4']);
    click('s9', shift);
    expect(selected()).toEqual(['s4', 's5', 's6', 's7', 's8', 's9']);
    click('s5', shift);
    expect(selected()).toEqual(['s5', 's6', 's7', 's8', 's9']);
    expect(click('s3')).toBe(false);
    expect(selected()).toEqual([]);
    click('s8', shift);
    expect(selected()).toEqual(['s3', 's4', 's5', 's6', 's7', 's8']);
  });

  it('start a run at a row whose pad was tapped, or that Cmd took away', () => {
    toggleRow('sections', 's6');
    click('s8', shift);
    expect(selected()).toEqual(['s6', 's7', 's8']);
    click('s7', cmd);
    click('s9', shift);
    expect(selected()).toEqual(['s7', 's8', 's9']);
  });

  it('let go of what another list held, and start no run from its row', () => {
    click('s2', cmd);
    expect(clickRow('routes', ['r1', 'r2', 'r3'], 'r3', shift)).toBe(true);
    expect([selectionOwner(), selected(), [...selectionOf('routes')]]).toEqual(['routes', [], ['r3']]);
    clickRow('routes', ['r1', 'r2', 'r3'], 'r1', plain);
    expect(selectionOwner()).toBeUndefined();
  });
});
