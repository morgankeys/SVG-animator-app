import { renderHook, waitFor, act } from '@testing-library/react';
import { usePlayback } from './usePlayback';
import { useUiStore } from '../../state/uiStore';
import { getSandboxAnimations } from '../../sandbox/registry';

vi.mock('../../sandbox/registry', () => ({
  getSandboxAnimations: vi.fn(() => [] as unknown[]),
}));

const mocked = vi.mocked(getSandboxAnimations);

/** A stand-in for a live Web Animation we can read/pin a `currentTime` on. */
function fakeAnimation(currentTime: number) {
  return { currentTime, pause: vi.fn() } as unknown as Animation;
}

beforeEach(() => {
  useUiStore.setState({ playing: false, playheadMs: 0 });
  mocked.mockReturnValue([]);
});

describe('usePlayback — pinned while not playing', () => {
  it('freezes a live animation at the playhead instead of letting it autoplay', async () => {
    const anim = fakeAnimation(500); // the browser would run it freely to 500ms+
    mocked.mockReturnValue([anim]);
    useUiStore.setState({ playing: false, playheadMs: 0 });
    renderHook(() => usePlayback(2000));
    await waitFor(() => expect(anim.pause).toHaveBeenCalled());
    expect(anim.currentTime).toBe(0); // pinned to the playhead, not free-running
    expect(useUiStore.getState().playheadMs).toBe(0); // playhead stays put
  });

  it('pins animations to the current (e.g. scrubbed) playhead position', async () => {
    const anim = fakeAnimation(0);
    mocked.mockReturnValue([anim]);
    useUiStore.setState({ playing: false, playheadMs: 750 });
    renderHook(() => usePlayback(2000));
    await waitFor(() => expect(anim.currentTime).toBe(750));
  });

  it('does nothing when no live animation exists', async () => {
    renderHook(() => usePlayback(2000));
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(useUiStore.getState().playheadMs).toBe(0);
  });
});
