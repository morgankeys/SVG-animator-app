import { render, screen, fireEvent, act } from '@testing-library/react';
import { ElementsPanel } from './ElementsPanel';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { sampleDocument } from '../../model/document';

beforeEach(() => {
  useDocumentStore.setState(sampleDocument());
  useSelectionStore.setState({ element: null });
});

describe('ElementsPanel', () => {
  it('renders the sample markup as a tree', () => {
    render(<ElementsPanel />);
    const items = screen.getAllByRole('treeitem');
    expect(items).toHaveLength(4); // svg > g#scene > (rect#ground, circle#ball)
    expect(screen.getByText('#scene')).toBeInTheDocument();
    expect(screen.getByText('#ground')).toBeInTheDocument();
    expect(screen.getByText('#ball')).toBeInTheDocument();
  });

  it('excludes <defs> from the tree', () => {
    useDocumentStore
      .getState()
      .setMarkup('<svg><defs><linearGradient id="g"/></defs><circle id="dot"/></svg>');
    render(<ElementsPanel />);
    expect(screen.queryByText('defs')).not.toBeInTheDocument();
    expect(screen.getByText('#dot')).toBeInTheDocument();
  });

  it('collapses and expands a subtree', () => {
    render(<ElementsPanel />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Collapse' })[1]); // collapse g#scene
    expect(screen.queryByText('#ball')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByText('#ball')).toBeInTheDocument();
  });

  it('clicking a row selects its ref in the shared store', () => {
    render(<ElementsPanel />);
    fireEvent.click(screen.getByText('#ball'));
    expect(useSelectionStore.getState().element).toBe('0/0/1');
    expect(screen.getByText('#ball').closest('[role="treeitem"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('updates when the markup buffer changes', () => {
    render(<ElementsPanel />);
    fireEvent.click(screen.getByText('#ball')); // select, then mutate buffer
    act(() => useDocumentStore.getState().setMarkup('<svg><rect id="only"/></svg>'));
    expect(screen.queryByText('#ball')).not.toBeInTheDocument();
    expect(screen.getByText('#only')).toBeInTheDocument();
  });

  it('adds a shape via the menu, writing the buffer and selecting the new element', () => {
    render(<ElementsPanel />);
    fireEvent.click(screen.getByText('#ball')); // select the leaf circle
    fireEvent.click(screen.getByRole('button', { name: 'Add shape' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rectangle' }));

    expect(useDocumentStore.getState().markup).toContain('<rect x="20" y="20"');
    // Inserted as the circle's next sibling, then selected.
    expect(useSelectionStore.getState().element).toBe('0/0/2');
    // Menu closes after a choice.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows a warning when the shape cannot be inserted', () => {
    useDocumentStore.getState().setMarkup('<table><tr><td>x</td></tr></table>');
    render(<ElementsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Add shape' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rectangle' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
