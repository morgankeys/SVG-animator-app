import { validateMapping, validateReferences } from './validate';
import { parseMarkup } from './markup';
import type { Correspondence } from './match';

function frame(id: string, markup: string) {
  return { id, tree: parseMarkup(markup) };
}

describe('validateMapping', () => {
  const frames = [
    frame('a', `<svg><circle id="c"/><rect id="r"/></svg>`),
    frame('b', `<svg><circle id="c"/></svg>`),
  ];

  it('errors on conflicting canonical ids', () => {
    const corrs: Correspondence[] = [
      { id: 'dup', members: { a: '0/0' }, confidence: 1, status: 'manual' },
      { id: 'dup', members: { a: '0/1' }, confidence: 1, status: 'manual' },
    ];
    const issues = validateMapping(frames, corrs);
    expect(issues.some((i) => i.severity === 'error' && /used by 2/.test(i.message))).toBe(true);
  });

  it('warns when a correspondence links different element types', () => {
    // a:circle (0/0) <-> b:circle (0/0) is fine; force a tag mismatch instead.
    const corrs: Correspondence[] = [
      { id: 'x', members: { a: '0/1', b: '0/0' }, confidence: 1, status: 'manual' }, // rect <-> circle
    ];
    const issues = validateMapping(frames, corrs);
    expect(issues.some((i) => /different element types/.test(i.message))).toBe(true);
  });

  it('warns about an unresolved, incomplete correspondence', () => {
    const corrs: Correspondence[] = [
      { id: 'r', members: { a: '0/1' }, confidence: 0, status: 'unmatched' },
    ];
    const issues = validateMapping(frames, corrs);
    expect(issues.some((i) => /still unmatched/.test(i.message))).toBe(true);
  });

  it('does not warn once an incomplete correspondence is marked frame-specific', () => {
    const corrs: Correspondence[] = [
      { id: 'r', members: { a: '0/1' }, confidence: 0, status: 'frame-specific' },
    ];
    expect(validateMapping(frames, corrs)).toEqual([]);
  });
});

describe('validateReferences', () => {
  it('passes when every reference resolves', () => {
    const markup = `<svg><defs><linearGradient id="g"/></defs><circle id="c" fill="url(#g)"/><use href="#c"/></svg>`;
    expect(validateReferences(markup)).toEqual([]);
  });

  it('flags a dangling url(#…) reference', () => {
    const markup = `<svg><circle fill="url(#missing)"/></svg>`;
    const issues = validateReferences(markup);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error' });
    expect(issues[0].message).toContain('#missing');
  });

  it('flags a dangling href fragment', () => {
    const issues = validateReferences(`<svg><use href="#nope"/></svg>`);
    expect(issues.some((i) => /#nope/.test(i.message))).toBe(true);
  });

  it('reports each missing id once', () => {
    const markup = `<svg><circle fill="url(#m)"/><rect stroke="url(#m)"/></svg>`;
    expect(validateReferences(markup)).toHaveLength(1);
  });
});
