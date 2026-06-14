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

describe('usePlayback — free-run tracking', () => {
  it('follows the live animation while not playing', async () => {
    mocked.mockReturnValue([fakeAnimation(500)]);
    renderHook(() => usePlayback(2000));
    // The browser-driven animation sits at 500ms → the playhead should track it.
    await waitFor(() => expect(useUiStore.getState().playheadMs).toBe(500));
  });

  it('wraps the followed time into the timeline span', async () => {
    // An infinite animation's currentTime grows past one iteration; fold it back.
    mocked.mockReturnValue([fakeAnimation(2500)]);
    renderHook(() => usePlayback(2000));
    await waitFor(() => expect(useUiStore.getState().playheadMs).toBe(500));
  });

  it('does not touch the playhead when no live animation exists', async () => {
    renderHook(() => usePlayback(2000));
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(useUiStore.getState().playheadMs).toBe(0);
  });
});
