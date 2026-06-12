import { createDocument, sampleDocument } from './document';

describe('createDocument', () => {
  it('defaults to empty buffers', () => {
    expect(createDocument()).toEqual({ markup: '', styles: '' });
  });

  it('holds the given buffers', () => {
    const doc = createDocument('<svg></svg>', 'svg { fill: red; }');
    expect(doc.markup).toBe('<svg></svg>');
    expect(doc.styles).toBe('svg { fill: red; }');
  });
});

describe('sampleDocument', () => {
  it('seeds an animated SVG', () => {
    const doc = sampleDocument();
    expect(doc.markup).toContain('<svg');
    expect(doc.markup).toContain('id="ball"');
    expect(doc.styles).toContain('@keyframes bounce');
    expect(doc.styles).toContain('animation: bounce');
  });

  it('returns a fresh copy each call', () => {
    expect(sampleDocument()).not.toBe(sampleDocument());
  });
});
