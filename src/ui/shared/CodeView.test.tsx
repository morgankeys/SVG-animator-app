import { render } from '@testing-library/react';
import { CodeView } from './CodeView';

describe('CodeView highlight', () => {
  const value = '#a { color: red }\n@keyframes k { 0% {} 100% {} }';

  it('spotlights the given range as a mark decoration', () => {
    const from = value.indexOf('@keyframes');
    const { container } = render(
      <CodeView value={value} language="css" highlight={{ from, to: value.length }} />,
    );
    const mark = container.querySelector('.cm-range-highlight');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toContain('@keyframes k');
  });

  it('renders no highlight when none is given', () => {
    const { container } = render(<CodeView value={value} language="css" />);
    expect(container.querySelector('.cm-range-highlight')).toBeNull();
  });
});
