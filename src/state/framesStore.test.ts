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

  it('clears all frames', () => {
    useFramesStore.getState().addFrames([frame('a')]);
    useFramesStore.getState().clearFrames();
    expect(useFramesStore.getState().frames).toEqual([]);
  });
});
