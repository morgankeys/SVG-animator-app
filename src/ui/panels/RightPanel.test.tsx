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
    expect(screen.getByText('fill')).toBeInTheDocument();
    expect(screen.getByText('#4f9cf9')).toBeInTheDocument();
    // Animation shorthand
    expect(screen.getByText('bounce 2s ease-in-out infinite')).toBeInTheDocument();
    // Geometry (markup-owned)
    expect(screen.getByText('cx')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('markup')).toBeInTheDocument();
  });

  it('flags competing declarations with a warning', () => {
    useDocumentStore
      .getState()
      .setStyles('circle { fill: blue; }\n#ball { fill: red; }');
    useSelectionStore.setState({ element: '0/0/1' });
    render(<RightPanel />);
    expect(screen.getByText('red')).toBeInTheDocument(); // the winner
    const warning = screen.getByRole('img', { name: 'Competing rules' });
    expect(warning).toHaveAttribute('title', expect.stringContaining('circle (blue)'));
  });

  it('marks inline style values as markup-owned', () => {
    useDocumentStore.setState({
      markup: '<svg><circle id="ball" style="opacity: 0.5"/></svg>',
      styles: '#ball { opacity: 0.9; }',
    });
    useSelectionStore.setState({ element: '0/0' });
    render(<RightPanel />);
    expect(screen.getByText('0.5')).toBeInTheDocument(); // inline wins
    expect(screen.getByText('inline')).toBeInTheDocument();
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
