import { render, screen, fireEvent } from '@testing-library/react';
import { RightPanel } from './RightPanel';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { useUiStore } from '../../state/uiStore';
import { sampleDocument } from '../../model/document';

beforeEach(() => {
  useDocumentStore.setState(sampleDocument());
  useSelectionStore.setState({ element: null });
  useUiStore.setState({ rightTab: 'rules' });
});

describe('RightPanel — Rules tab', () => {
  it('prompts when nothing is selected', () => {
    render(<RightPanel />);
    expect(screen.getByText(/select an element/i)).toBeInTheDocument();
  });

  it('shows effective declarations and markup-owned geometry for the selection', () => {
    useSelectionStore.setState({ element: '0/0/1' }); // circle#ball
    render(<RightPanel />);
    // Appearance (styles-owned)
    expect(screen.getByRole('textbox', { name: 'fill' })).toHaveValue('#4f9cf9');
    // Animation shorthand
    expect(screen.getByRole('textbox', { name: 'animation' })).toHaveValue(
      'bounce 2s ease-in-out infinite',
    );
    // Geometry (markup-owned)
    expect(screen.getByRole('textbox', { name: 'cx' })).toHaveValue('200');
    expect(screen.getByText('markup')).toBeInTheDocument();
  });

  it('flags competing declarations with a warning', () => {
    useDocumentStore
      .getState()
      .setStyles('circle { fill: blue; }\n#ball { fill: red; }');
    useSelectionStore.setState({ element: '0/0/1' });
    render(<RightPanel />);
    expect(screen.getByRole('textbox', { name: 'fill' })).toHaveValue('red'); // the winner
    const warning = screen.getByRole('img', { name: 'Competing rules' });
    expect(warning).toHaveAttribute('title', expect.stringContaining('circle (blue)'));
  });

  it('marks inline style values as markup-owned and disables the control', () => {
    useDocumentStore.setState({
      markup: '<svg><circle id="ball" style="opacity: 0.5"/></svg>',
      styles: '#ball { opacity: 0.9; }',
    });
    useSelectionStore.setState({ element: '0/0' });
    render(<RightPanel />);
    const opacity = screen.getByRole('textbox', { name: 'opacity' });
    expect(opacity).toHaveValue('0.5'); // inline wins
    expect(opacity).toBeDisabled();
    expect(screen.getByText('inline')).toBeInTheDocument();
  });
});

describe('RightPanel — Rules tab editing (Phase 4.2)', () => {
  function commit(input: HTMLElement, value: string) {
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  }

  it('editing a CSS control rewrites the styles buffer in place', () => {
    useSelectionStore.setState({ element: '0/0/1' });
    render(<RightPanel />);
    commit(screen.getByRole('textbox', { name: 'fill' }), 'tomato');
    const { markup, styles } = useDocumentStore.getState();
    expect(styles).toBe(sampleDocument().styles.replace('fill: #4f9cf9', 'fill: tomato'));
    expect(markup).toBe(sampleDocument().markup);
    // The projection reflects the buffer, not a parallel UI state.
    expect(screen.getByRole('textbox', { name: 'fill' })).toHaveValue('tomato');
  });

  it('setting an unset property creates a declaration in the write-target rule', () => {
    useSelectionStore.setState({ element: '0/0/1' });
    render(<RightPanel />);
    const stroke = screen.getByRole('textbox', { name: 'stroke' });
    expect(stroke).toHaveValue('');
    commit(stroke, 'black');
    expect(useDocumentStore.getState().styles).toContain('stroke: black;');
    expect(screen.getByRole('textbox', { name: 'stroke' })).toHaveValue('black');
  });

  it('styling an id-less element assigns it an id in the markup buffer first', () => {
    useDocumentStore.setState({ markup: '<svg>\n  <circle cx="1" />\n</svg>\n', styles: '' });
    useSelectionStore.setState({ element: '0/0' });
    render(<RightPanel />);
    commit(screen.getByRole('textbox', { name: 'fill' }), 'red');
    const { markup, styles } = useDocumentStore.getState();
    expect(markup).toBe('<svg>\n  <circle cx="1" id="circle" />\n</svg>\n');
    expect(styles).toContain('#circle {');
    expect(styles).toContain('fill: red');
  });

  it('editing a geometry control rewrites only the markup buffer', () => {
    useSelectionStore.setState({ element: '0/0/1' });
    render(<RightPanel />);
    commit(screen.getByRole('textbox', { name: 'cx' }), '123');
    const { markup, styles } = useDocumentStore.getState();
    expect(markup).toBe(sampleDocument().markup.replace('cx="200"', 'cx="123"'));
    expect(styles).toBe(sampleDocument().styles);
  });

  it('an empty commit reverts instead of writing', () => {
    useSelectionStore.setState({ element: '0/0/1' });
    render(<RightPanel />);
    commit(screen.getByRole('textbox', { name: 'fill' }), '   ');
    expect(useDocumentStore.getState().styles).toBe(sampleDocument().styles);
    expect(screen.getByRole('textbox', { name: 'fill' })).toHaveValue('#4f9cf9');
  });

  it('Escape restores the buffer value without writing', () => {
    useSelectionStore.setState({ element: '0/0/1' });
    render(<RightPanel />);
    const fill = screen.getByRole('textbox', { name: 'fill' });
    fireEvent.change(fill, { target: { value: 'red' } });
    fireEvent.keyDown(fill, { key: 'Escape' });
    expect(fill).toHaveValue('#4f9cf9');
    expect(useDocumentStore.getState().styles).toBe(sampleDocument().styles);
  });
});

describe('RightPanel — Code tab', () => {
  it('shows the styles buffer, highlighted and read-only', () => {
    render(<RightPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    const code = screen.getByTestId('code-view');
    expect(code.textContent).toContain('@keyframes bounce');
    expect(code.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'false');
  });
});
