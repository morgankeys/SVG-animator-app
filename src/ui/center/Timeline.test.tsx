import { render, screen, fireEvent, act } from '@testing-library/react';
import { Timeline } from './Timeline';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { sampleDocument } from '../../model/document';

import { useUiStore } from '../../state/uiStore';

beforeEach(() => {
  useDocumentStore.setState({ ...sampleDocument(), past: [], future: [] });
  useSelectionStore.setState({ element: null, timeline: null });
  useUiStore.setState({ playing: false, playheadMs: 0, rightTab: 'rules' });
});

describe('Timeline', () => {
  it('renders one row per applied animation with its stops', () => {
    render(<Timeline />);
    // The sample has #ball { animation: bounce 2s ... } with 0/50/100% stops.
    expect(screen.getByText('bounce')).toBeInTheDocument();
    expect(screen.getByLabelText('bounce keyframe 0%')).toBeInTheDocument();
    expect(screen.getByLabelText('bounce keyframe 50%')).toBeInTheDocument();
    expect(screen.getByLabelText('bounce keyframe 100%')).toBeInTheDocument();
  });

  it('shows a placeholder when nothing is animated', () => {
    useDocumentStore.getState().setStyles('#ball { fill: red; }');
    render(<Timeline />);
    expect(screen.getByText('No animations or transitions yet')).toBeInTheDocument();
  });

  it('selecting a row sets the timeline and element selection', () => {
    render(<Timeline />);
    fireEvent.click(screen.getByText('bounce'));
    expect(useSelectionStore.getState().timeline).toEqual({ rowId: '0/0/1::0', stopIndex: null });
    expect(useSelectionStore.getState().element).toBe('0/0/1');
  });

  it('selecting a stop narrows the timeline selection to that stop', () => {
    render(<Timeline />);
    fireEvent.click(screen.getByLabelText('bounce keyframe 50%'));
    expect(useSelectionStore.getState().timeline).toEqual({ rowId: '0/0/1::0', stopIndex: 1 });
  });

  it('selecting a row reveals the keyframes by switching the right panel to Code', () => {
    render(<Timeline />);
    fireEvent.click(screen.getByText('bounce'));
    expect(useUiStore.getState().rightTab).toBe('code');
  });

  it('the play button toggles transport state', () => {
    render(<Timeline />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(useUiStore.getState().playing).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(useUiStore.getState().playing).toBe(false);
  });

  it('scrubbing sets the playhead and pauses', () => {
    useUiStore.setState({ playing: true });
    render(<Timeline />);
    fireEvent.change(screen.getByLabelText('Scrub timeline'), { target: { value: '1000' } });
    expect(useUiStore.getState().playheadMs).toBe(1000);
    expect(useUiStore.getState().playing).toBe(false);
  });

  it('dragging the playhead scrubs to the pointer position and pauses', () => {
    // jsdom has no layout; pin a known track geometry (body 1000px wide).
    const rect = { left: 0, top: 0, right: 1000, bottom: 100, width: 1000, height: 100, x: 0, y: 0 };
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ ...rect, toJSON: () => rect } as DOMRect);
    useUiStore.setState({ playing: true });
    render(<Timeline />);
    // Track spans 144px (label 132 + margin 12) to 856px → width 844px. clientX
    // 566 is halfway across (144 + 422) → playhead at half of 2000ms = 1000ms.
    // jsdom has no PointerEvent, but MouseEvent carries clientX and React
    // delegates `pointerdown` to a native listener, so dispatch one directly.
    const slider = screen.getByRole('slider', { name: 'Playhead' });
    const event = new MouseEvent('pointerdown', { bubbles: true, clientX: 566 });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    act(() => {
      slider.dispatchEvent(event);
    });
    expect(useUiStore.getState().playheadMs).toBeCloseTo(1000, 0);
    expect(useUiStore.getState().playing).toBe(false);
    spy.mockRestore();
  });

  it('arrow keys step the playhead and pause', () => {
    useUiStore.setState({ playing: true, playheadMs: 0 });
    render(<Timeline />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Playhead' }), { key: 'ArrowRight' });
    // Sample total is 2000ms → default step is totalMs/100 = 20ms.
    expect(useUiStore.getState().playheadMs).toBe(20);
    expect(useUiStore.getState().playing).toBe(false);
  });
});
