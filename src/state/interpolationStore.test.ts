import { useInterpolationStore } from './interpolationStore';
import { parseMarkup } from '../model/markup';
import type { MatchFrame } from '../model/match';

function mf(id: string, markup: string): MatchFrame {
  return { id, tree: parseMarkup(markup) };
}

beforeEach(() => useInterpolationStore.getState().reset());

const A = '<svg><circle id="ball-1" cx="50" cy="20" r="10"/></svg>';
const B = '<svg><circle id="ball-2" cx="50" cy="80" r="10"/></svg>';

describe('interpolationStore', () => {
  it('runs the auto-matcher over frames', () => {
    useInterpolationStore.getState().runAutoMatch([mf('a', A), mf('b', B)]);
    const s = useInterpolationStore.getState();
    expect(s.matched).toBe(true);
    expect(s.correspondences.some((c) => c.members.a && c.members.b)).toBe(true);
  });

  it('toggles picks (one per frame) and links them', () => {
    const store = useInterpolationStore.getState();
    store.runAutoMatch([mf('a', A), mf('b', B)]);
    store.togglePick('a', '0/0');
    store.togglePick('b', '0/0');
    expect(Object.keys(useInterpolationStore.getState().picks)).toHaveLength(2);

    useInterpolationStore.getState().linkPicks();
    const after = useInterpolationStore.getState();
    expect(after.picks).toEqual({}); // cleared after linking
    const corr = after.correspondences.find((c) => c.members.a === '0/0');
    expect(corr!.members.b).toBe('0/0');
  });

  it('re-clicking a picked node clears it', () => {
    const store = useInterpolationStore.getState();
    store.runAutoMatch([mf('a', A), mf('b', B)]);
    store.togglePick('a', '0/0');
    store.togglePick('a', '0/0');
    expect(useInterpolationStore.getState().picks).toEqual({});
  });

  it('renames, unlinks, and resets', () => {
    const store = useInterpolationStore.getState();
    store.runAutoMatch([mf('a', A), mf('b', B)]);
    const id = useInterpolationStore.getState().correspondences.find((c) => c.members.a === '0/0')!.id;

    store.rename(id, 'orb');
    expect(useInterpolationStore.getState().correspondences.some((c) => c.id === 'orb')).toBe(true);

    store.unlink('orb', 'b');
    const orb = useInterpolationStore.getState().correspondences.find((c) => c.id === 'orb')!;
    expect(orb.members.b).toBeUndefined();

    useInterpolationStore.getState().reset();
    expect(useInterpolationStore.getState()).toMatchObject({ correspondences: [], matched: false });
  });
});
