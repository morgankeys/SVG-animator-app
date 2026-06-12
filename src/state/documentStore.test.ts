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
});
