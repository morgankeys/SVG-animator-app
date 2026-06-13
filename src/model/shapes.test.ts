import { SHAPE_KINDS, SHAPE_LABELS, createShapeMarkup } from './shapes';
import { parseMarkup } from './markup';

describe('shapes', () => {
  it('every kind has a label and parses to a single element', () => {
    for (const kind of SHAPE_KINDS) {
      expect(SHAPE_LABELS[kind]).toBeTruthy();
      const nodes = parseMarkup(createShapeMarkup(kind));
      expect(nodes).toHaveLength(1);
    }
  });

  it('maps kinds to their SVG tags (group → <g>)', () => {
    expect(parseMarkup(createShapeMarkup('rect'))[0].tag).toBe('rect');
    expect(parseMarkup(createShapeMarkup('group'))[0].tag).toBe('g');
    expect(parseMarkup(createShapeMarkup('text'))[0].tag).toBe('text');
  });

  it('creates an empty group ready to receive children', () => {
    expect(createShapeMarkup('group')).toBe('<g></g>');
    expect(parseMarkup(createShapeMarkup('group'))[0].children).toHaveLength(0);
  });
});
