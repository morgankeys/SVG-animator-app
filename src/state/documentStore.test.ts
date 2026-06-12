import { useDocumentStore } from './documentStore';
import { sampleDocument } from '../model/document';

beforeEach(() => {
  useDocumentStore.setState(sampleDocument());
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
});
