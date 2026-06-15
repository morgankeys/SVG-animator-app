import { render, screen, fireEvent } from '@testing-library/react';
import { FramesView } from './FramesView';
import { useFramesStore } from '../../state/framesStore';
import { useInterpolationStore } from '../../state/interpolationStore';
import { parseSvgToFrame } from '../../model/frames';
import type { Frame } from '../../model/frames';

function frame(id: string, label: string, markup?: string): Frame {
  const result = parseSvgToFrame(
    id,
    label,
    markup ?? '<svg xmlns="http://www.w3.org/2000/svg"><g id="scene"><circle r="10"/></g></svg>',
  );
  if (!result.ok) throw new Error('fixture should parse');
  return result.frame;
}

beforeEach(() => {
  useFramesStore.setState({ frames: [] });
  useInterpolationStore.getState().reset();
});

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

describe('FramesView — correspondence mapping (10.2)', () => {
  const A = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="ball-1" cx="50" cy="20" r="10"/></svg>';
  const B = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="ball-2" cx="50" cy="80" r="10"/></svg>';

  it('auto-matches and shows correspondences with a unmatched count when applicable', () => {
    useFramesStore.setState({ frames: [frame('a', 'a.svg', A), frame('b', 'b.svg', B)] });
    render(<FramesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Auto-match' }));
    // svg + circle correspond across both frames.
    expect(useInterpolationStore.getState().correspondences).toHaveLength(2);
    expect(screen.getByText(/Correspondences \(2\)/)).toBeInTheDocument();
  });

  it('picks one node per frame and links them', () => {
    // Different tags so the matcher leaves them unmatched, forcing a manual link.
    const f1 = frame('a', 'a.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect id="x"/></svg>');
    const f2 = frame('b', 'b.svg', '<svg xmlns="http://www.w3.org/2000/svg"><path id="y"/></svg>');
    useFramesStore.setState({ frames: [f1, f2] });
    render(<FramesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Auto-match' }));

    // rect (a, ref 0/0) and path (b, ref 0/0) start unmatched; pick + link them.
    const rows = screen.getAllByText('rect');
    fireEvent.click(rows[0].closest('.tree-row')!);
    fireEvent.click(screen.getByText('path').closest('.tree-row')!);
    fireEvent.click(screen.getByRole('button', { name: /Link selected \(2\)/ }));

    const linked = useInterpolationStore
      .getState()
      .correspondences.find((c) => c.members.a === '0/0' && c.members.b === '0/0');
    expect(linked).toBeDefined();
    expect(linked!.status).toBe('manual');
  });

  it('renames a canonical id from the correspondence list', () => {
    useFramesStore.setState({ frames: [frame('a', 'a.svg', A), frame('b', 'b.svg', B)] });
    render(<FramesView />);
    fireEvent.click(screen.getByRole('button', { name: 'Auto-match' }));

    const input = screen.getByLabelText('Canonical id for ball') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'orb' } });
    fireEvent.blur(input);
    expect(useInterpolationStore.getState().correspondences.some((c) => c.id === 'orb')).toBe(true);
  });
});
