import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from './App';
import { useDocumentStore } from '../state/documentStore';
import { useSelectionStore } from '../state/selectionStore';
import { sampleDocument } from '../model/document';

beforeEach(() => {
  useDocumentStore.setState({ ...sampleDocument(), past: [], future: [] });
  useSelectionStore.setState({ element: null });
});

describe('App shell', () => {
  it('renders the three panels and timeline', () => {
    render(<App />);
    expect(screen.getByText('Elements')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
  });
});

describe('App — undo/redo shortcuts', () => {
  it('Cmd/Ctrl+Z undoes the last buffer edit; with Shift it redoes', () => {
    render(<App />);
    act(() => {
      useDocumentStore.getState().setStyles('#ball { fill: red; }');
    });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useDocumentStore.getState().styles).toBe(sampleDocument().styles);
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(useDocumentStore.getState().styles).toBe('#ball { fill: red; }');
  });

  it('leaves undo alone while a text input has focus', () => {
    useSelectionStore.setState({ element: '0/0/1' });
    render(<App />);
    act(() => {
      useDocumentStore.getState().setStyles('#ball { fill: red; }');
    });
    const input = screen.getByRole('textbox', { name: 'fill' });
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(useDocumentStore.getState().styles).toBe('#ball { fill: red; }');
  });
});
