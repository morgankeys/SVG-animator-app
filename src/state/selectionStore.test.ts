import { useSelectionStore } from './selectionStore';

beforeEach(() => {
  useSelectionStore.setState({ element: null });
});

describe('selectionStore', () => {
  it('starts with nothing selected', () => {
    expect(useSelectionStore.getState().element).toBeNull();
  });

  it('selects and clears an element ref', () => {
    useSelectionStore.getState().selectElement('0/0/1');
    expect(useSelectionStore.getState().element).toBe('0/0/1');
    useSelectionStore.getState().selectElement(null);
    expect(useSelectionStore.getState().element).toBeNull();
  });
});
