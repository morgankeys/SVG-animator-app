import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from './Timeline';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { sampleDocument } from '../../model/document';

beforeEach(() => {
  useDocumentStore.setState({ ...sampleDocument(), past: [], future: [] });
  useSelectionStore.setState({ element: null, timeline: null });
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
    expect(screen.getByText('No animations yet')).toBeInTheDocument();
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
});
