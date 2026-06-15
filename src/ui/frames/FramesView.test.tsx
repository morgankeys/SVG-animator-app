import { render, screen, fireEvent } from '@testing-library/react';
import { FramesView } from './FramesView';
import { useFramesStore } from '../../state/framesStore';
import { parseSvgToFrame } from '../../model/frames';
import type { Frame } from '../../model/frames';

function frame(id: string, label: string): Frame {
  const result = parseSvgToFrame(
    id,
    label,
    '<svg xmlns="http://www.w3.org/2000/svg"><g id="scene"><circle r="10"/></g></svg>',
  );
  if (!result.ok) throw new Error('fixture should parse');
  return result.frame;
}

beforeEach(() => useFramesStore.setState({ frames: [] }));

describe('FramesView', () => {
  it('shows an empty hint when no frames are imported', () => {
    render(<FramesView />);
    expect(screen.getByText(/No frames imported/)).toBeInTheDocument();
  });

  it('renders each frame with a thumbnail and its element tree', () => {
    useFramesStore.setState({ frames: [frame('a', 'one.svg'), frame('b', 'two.svg')] });
    render(<FramesView />);
    expect(screen.getByText('one.svg')).toBeInTheDocument();
    expect(screen.getByText('two.svg')).toBeInTheDocument();
    // thumbnails are SVG data-url images
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
    // each tree projects the frame markup (defs excluded elsewhere; here just structure)
    expect(screen.getAllByText('#scene')).toHaveLength(2);
  });

  it('reorders frames with the move controls', () => {
    useFramesStore.setState({ frames: [frame('a', 'one.svg'), frame('b', 'two.svg')] });
    render(<FramesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Move two.svg earlier' }));
    expect(useFramesStore.getState().frames.map((f) => f.label)).toEqual(['two.svg', 'one.svg']);
  });

  it('disables move controls at the ends', () => {
    useFramesStore.setState({ frames: [frame('a', 'one.svg'), frame('b', 'two.svg')] });
    render(<FramesView />);
    expect(screen.getByRole('button', { name: 'Move one.svg earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move two.svg later' })).toBeDisabled();
  });

  it('removes a frame', () => {
    useFramesStore.setState({ frames: [frame('a', 'one.svg')] });
    render(<FramesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove one.svg' }));
    expect(useFramesStore.getState().frames).toHaveLength(0);
  });
});
