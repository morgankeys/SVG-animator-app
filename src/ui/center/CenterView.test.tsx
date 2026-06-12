import { render, screen, fireEvent } from '@testing-library/react';
import { CenterView } from './CenterView';
import { useUiStore } from '../../state/uiStore';

beforeEach(() => {
  useUiStore.setState({ centerTab: 'preview' });
});

describe('CenterView tabs', () => {
  it('shows only the sandbox on Preview', () => {
    render(<CenterView />);
    expect(screen.getByTitle('Rendered document')).toBeInTheDocument();
    expect(screen.queryByTestId('code-view')).not.toBeInTheDocument();
  });

  it('shows only the code view on Code, with the consolidated source', () => {
    render(<CenterView />);
    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    expect(screen.queryByTitle('Rendered document')).not.toBeInTheDocument();
    const code = screen.getByTestId('code-view');
    expect(code.textContent).toContain('id="ball"');
    expect(code.textContent).toContain('@keyframes bounce');
  });

  it('shows both on Split', () => {
    render(<CenterView />);
    fireEvent.click(screen.getByRole('button', { name: 'Split' }));
    expect(screen.getByTitle('Rendered document')).toBeInTheDocument();
    expect(screen.getByTestId('code-view')).toBeInTheDocument();
  });
});
