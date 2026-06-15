import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { FramesPanel } from './FramesPanel';
import { useFramesStore } from '../../state/framesStore';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';

beforeEach(() => useFramesStore.setState({ frames: [] }));

function svgFile(name: string, content = SVG): File {
  return new File([content], name, { type: 'image/svg+xml' });
}

describe('FramesPanel', () => {
  it('shows an empty hint before anything is imported', () => {
    render(<FramesPanel />);
    expect(screen.getByText(/Drop SVG files here/)).toBeInTheDocument();
  });

  it('imports valid SVGs via the file input and lists them', async () => {
    const { container } = render(<FramesPanel />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [svgFile('a.svg'), svgFile('b.svg')] } });
    });
    expect(await screen.findByText('a.svg')).toBeInTheDocument();
    expect(screen.getByText('b.svg')).toBeInTheDocument();
    expect(useFramesStore.getState().frames).toHaveLength(2);
  });

  it('surfaces invalid files as errors and skips them', async () => {
    const { container } = render(<FramesPanel />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [svgFile('bad.svg', '<note/>')] } });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/bad\.svg.*expected <svg>/);
    expect(useFramesStore.getState().frames).toHaveLength(0);
  });

  it('imports files dropped onto the dropzone', async () => {
    render(<FramesPanel />);
    const zone = screen.getByText(/Drop SVG files here/).parentElement as HTMLElement;
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [svgFile('dropped.svg')] } });
    });
    expect(await screen.findByText('dropped.svg')).toBeInTheDocument();
  });

  it('removes an imported frame', async () => {
    const { container } = render(<FramesPanel />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [svgFile('gone.svg')] } });
    });
    await screen.findByText('gone.svg');
    fireEvent.click(screen.getByRole('button', { name: 'Remove gone.svg' }));
    await waitFor(() => expect(screen.queryByText('gone.svg')).not.toBeInTheDocument());
  });
});
