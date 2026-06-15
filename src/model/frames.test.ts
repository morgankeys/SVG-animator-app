import { parseSvgToFrame, importSvgFiles, newFrameId } from './frames';

const SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <g id="frame-1">
    <circle id="circle-1" cx="50" cy="50" r="20" />
  </g>
</svg>`;

describe('parseSvgToFrame', () => {
  it('parses a valid SVG into a frame with a projected tree', () => {
    const result = parseSvgToFrame('f1', '01-start.svg', SVG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.frame).toMatchObject({ id: 'f1', label: '01-start.svg', markup: SVG });
    expect(result.frame.tree).toHaveLength(1);
    const [svg] = result.frame.tree;
    expect(svg.tag).toBe('svg');
    expect(svg.children[0].id).toBe('frame-1');
    expect(svg.children[0].children[0].id).toBe('circle-1');
  });

  it('excludes <defs> from the tree, matching the Elements panel projection', () => {
    const withDefs = `<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect/></svg>`;
    const result = parseSvgToFrame('f', 'd.svg', withDefs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tags = result.frame.tree[0].children.map((c) => c.tag);
    expect(tags).toEqual(['rect']); // defs occupies an index but is omitted
    expect(result.frame.tree[0].children[0].ref).toBe('0/1');
  });

  it('rejects an empty file', () => {
    const result = parseSvgToFrame('f', 'empty.svg', '   \n  ');
    expect(result).toEqual({ ok: false, label: 'empty.svg', error: 'File is empty.' });
  });

  it('rejects malformed XML', () => {
    const result = parseSvgToFrame('f', 'bad.svg', '<svg><circle></svg>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/parse error/i);
  });

  it('rejects a non-SVG root element', () => {
    const result = parseSvgToFrame('f', 'note.svg', '<note><body>hi</body></note>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/expected <svg>/);
  });
});

describe('newFrameId', () => {
  it('produces unique ids', () => {
    expect(newFrameId()).not.toBe(newFrameId());
  });
});

describe('importSvgFiles', () => {
  it('reads File objects and parses each into a result', async () => {
    const good = new File([SVG], 'good.svg', { type: 'image/svg+xml' });
    const bad = new File(['<note/>'], 'bad.svg', { type: 'image/svg+xml' });
    const results = await importSvgFiles([good, bad]);

    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[0].ok && results[0].frame.label).toBe('good.svg');
    expect(results[1].ok).toBe(false);
  });
});
