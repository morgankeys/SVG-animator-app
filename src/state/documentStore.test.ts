import { useDocumentStore } from './documentStore';
import { sampleDocument } from '../model/document';

beforeEach(() => {
  useDocumentStore.setState({ ...sampleDocument(), past: [], future: [] });
});

describe('documentStore', () => {
  it('is seeded with the sample document', () => {
    const { markup, styles } = useDocumentStore.getState();
    expect({ markup, styles }).toEqual(sampleDocument());
  });

  it('setMarkup replaces only the markup buffer', () => {
    const before = useDocumentStore.getState().styles;
    useDocumentStore.getState().setMarkup('<svg id="new"></svg>');
    expect(useDocumentStore.getState().markup).toBe('<svg id="new"></svg>');
    expect(useDocumentStore.getState().styles).toBe(before);
  });

  it('setStyles replaces only the styles buffer', () => {
    const before = useDocumentStore.getState().markup;
    useDocumentStore.getState().setStyles('#ball { fill: green; }');
    expect(useDocumentStore.getState().styles).toBe('#ball { fill: green; }');
    expect(useDocumentStore.getState().markup).toBe(before);
  });

  it('setDocument replaces both buffers', () => {
    useDocumentStore.getState().setDocument({ markup: '<svg/>', styles: 'svg {}' });
    const { markup, styles } = useDocumentStore.getState();
    expect({ markup, styles }).toEqual({ markup: '<svg/>', styles: 'svg {}' });
  });

  it('applyStyleEdit writes through to the styles buffer', () => {
    const result = useDocumentStore.getState().applyStyleEdit('0/0/1', 'fill', 'tomato');
    expect(result.ok).toBe(true);
    expect(useDocumentStore.getState().styles).toContain('fill: tomato');
    expect(useDocumentStore.getState().markup).toBe(sampleDocument().markup);
  });

  it('applyAttributeEdit writes through to the markup buffer', () => {
    const result = useDocumentStore.getState().applyAttributeEdit('0/0/1', 'cx', '111');
    expect(result.ok).toBe(true);
    expect(useDocumentStore.getState().markup).toContain('cx="111"');
    expect(useDocumentStore.getState().styles).toBe(sampleDocument().styles);
  });

  it('failed edits leave the buffers untouched and report the reason', () => {
    const before = sampleDocument();
    const result = useDocumentStore.getState().applyStyleEdit('0/9', 'fill', 'red');
    expect(result).toEqual({ ok: false, reason: 'element-not-found' });
    const { markup, styles } = useDocumentStore.getState();
    expect({ markup, styles }).toEqual(before);
  });

  it('addShape inserts into the markup buffer and returns the new ref', () => {
    const result = useDocumentStore.getState().addShape('rect', '0/0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref).toBe('0/0/2');
    expect(useDocumentStore.getState().markup).toContain('<rect x="20" y="20"');
    expect(useDocumentStore.getState().styles).toBe(sampleDocument().styles);
  });

  it('addShape is one undoable step', () => {
    const before = sampleDocument().markup;
    useDocumentStore.getState().addShape('circle', null);
    expect(useDocumentStore.getState().markup).not.toBe(before);
    expect(useDocumentStore.getState().undo()).toBe(true);
    expect(useDocumentStore.getState().markup).toBe(before);
  });

  it('a failed addShape records no history', () => {
    useDocumentStore.setState({
      markup: '<table><tr><td>x</td></tr></table>',
      styles: '',
      past: [],
      future: [],
    });
    const result = useDocumentStore.getState().addShape('rect', '0');
    expect(result).toEqual({ ok: false, reason: 'markup-write-failed' });
    expect(useDocumentStore.getState().undo()).toBe(false);
  });

  it('deleteElement removes from markup as one undoable step', () => {
    const before = sampleDocument().markup;
    const result = useDocumentStore.getState().deleteElement('0/0/1');
    expect(result.ok).toBe(true);
    expect(useDocumentStore.getState().markup).not.toContain('id="ball"');
    expect(useDocumentStore.getState().undo()).toBe(true);
    expect(useDocumentStore.getState().markup).toBe(before);
  });

  it('moveElement reorders markup and returns the new ref', () => {
    const result = useDocumentStore.getState().moveElement('0/0/0', 'down');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ref).toBe('0/0/1');
    expect(useDocumentStore.getState().styles).toBe(sampleDocument().styles);
  });

  it('a failed structural edit records no history', () => {
    useDocumentStore.getState().moveElement('0/0/0', 'up'); // boundary → fails
    expect(useDocumentStore.getState().undo()).toBe(false);
  });
});

describe('documentStore — undo/redo', () => {
  const current = () => {
    const { markup, styles } = useDocumentStore.getState();
    return { markup, styles };
  };

  it('undo restores the prior buffers; redo reapplies the edit', () => {
    useDocumentStore.getState().applyStyleEdit('0/0/1', 'fill', 'tomato');
    const edited = current();
    expect(useDocumentStore.getState().undo()).toBe(true);
    expect(current()).toEqual(sampleDocument());
    expect(useDocumentStore.getState().redo()).toBe(true);
    expect(current()).toEqual(edited);
  });

  it('one undo step restores BOTH buffers of a two-buffer edit (id assignment)', () => {
    useDocumentStore.setState({
      markup: '<svg><circle cx="1"/></svg>',
      styles: '',
      past: [],
      future: [],
    });
    useDocumentStore.getState().applyStyleEdit('0/0', 'fill', 'red');
    expect(current().markup).toContain('id="circle"');
    useDocumentStore.getState().undo();
    expect(current()).toEqual({ markup: '<svg><circle cx="1"/></svg>', styles: '' });
  });

  it('covers setters too (later code edits go through the same commit)', () => {
    useDocumentStore.getState().setStyles('#ball { fill: red; }');
    useDocumentStore.getState().undo();
    expect(current().styles).toBe(sampleDocument().styles);
  });

  it('a new edit clears the redo stack', () => {
    useDocumentStore.getState().setStyles('a {}');
    useDocumentStore.getState().undo();
    useDocumentStore.getState().setStyles('b {}');
    expect(useDocumentStore.getState().redo()).toBe(false);
    expect(current().styles).toBe('b {}');
  });

  it('no-op writes record no history', () => {
    useDocumentStore.getState().setStyles(sampleDocument().styles);
    expect(useDocumentStore.getState().undo()).toBe(false);
  });

  it('failed edits record no history', () => {
    useDocumentStore.getState().applyStyleEdit('0/9', 'fill', 'red');
    expect(useDocumentStore.getState().undo()).toBe(false);
  });

  it('history is capped', () => {
    for (let i = 0; i < 120; i++) useDocumentStore.getState().setStyles(`/* ${i} */`);
    expect(useDocumentStore.getState().past).toHaveLength(100);
  });
});
