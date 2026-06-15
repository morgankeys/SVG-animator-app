import { useFramesStore } from './framesStore';
import type { Frame } from '../model/frames';

const frame = (id: string): Frame => ({ id, label: `${id}.svg`, markup: '<svg/>', tree: [] });

beforeEach(() => useFramesStore.setState({ frames: [] }));

describe('framesStore', () => {
  it('appends frames in order', () => {
    useFramesStore.getState().addFrames([frame('a'), frame('b')]);
    useFramesStore.getState().addFrames([frame('c')]);
    expect(useFramesStore.getState().frames.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('removes a frame by id', () => {
    useFramesStore.getState().addFrames([frame('a'), frame('b')]);
    useFramesStore.getState().removeFrame('a');
    expect(useFramesStore.getState().frames.map((f) => f.id)).toEqual(['b']);
  });

  it('reorders frames left and right, clamping at the ends', () => {
    useFramesStore.getState().addFrames([frame('a'), frame('b'), frame('c')]);
    const ids = () => useFramesStore.getState().frames.map((f) => f.id);

    useFramesStore.getState().moveFrame('b', 'left');
    expect(ids()).toEqual(['b', 'a', 'c']);
    useFramesStore.getState().moveFrame('b', 'left'); // already first → no-op
    expect(ids()).toEqual(['b', 'a', 'c']);
    useFramesStore.getState().moveFrame('c', 'right'); // already last → no-op
    expect(ids()).toEqual(['b', 'a', 'c']);
    useFramesStore.getState().moveFrame('a', 'right');
    expect(ids()).toEqual(['b', 'c', 'a']);
  });

  it('clears all frames', () => {
    useFramesStore.getState().addFrames([frame('a')]);
    useFramesStore.getState().clearFrames();
    expect(useFramesStore.getState().frames).toEqual([]);
  });
});
