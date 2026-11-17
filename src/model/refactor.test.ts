import { refactorFrameIds, rewriteReferences } from './refactor';
import { parseSvgToFrame } from './frames';
import type { Frame } from './frames';
import type { Correspondence } from './match';

function frame(id: string, markup: string): Frame {
  const r = parseSvgToFrame(id, `${id}.svg`, markup);
  if (!r.ok) throw new Error(`fixture should parse: ${r.error}`);
  return r.frame;
}

describe('rewriteReferences', () => {
  const idMap = { 'grad-1': 'grad', 'circle-1': 'circle' };

  it('rewrites url(#id) references', () => {
    expect(rewriteReferences('fill', 'url(#grad-1)', idMap)).toBe('url(#grad)');
    expect(rewriteReferences('fill', "url('#grad-1')", idMap)).toBe("url('#grad')");
    expect(rewriteReferences('fill', 'url(#untouched)', idMap)).toBe('url(#untouched)');
  });

  it('rewrites href / xlink:href fragment references', () => {
    expect(rewriteReferences('href', '#circle-1', idMap)).toBe('#circle');
    expect(rewriteReferences('xlink:href', '#circle-1', idMap)).toBe('#circle');
    expect(rewriteReferences('href', 'https://x/#circle-1', idMap)).toBe('https://x/#circle-1');
  });

  it('rewrites aria id-lists token by token', () => {
    expect(rewriteReferences('aria-labelledby', 'circle-1 other', idMap)).toBe('circle other');
  });

  it('returns the value unchanged when the id map is empty', () => {
    expect(rewriteReferences('fill', 'url(#grad-1)', {})).toBe('url(#grad-1)');
  });
});

describe('refactorFrameIds', () => {
  const correspondences: Correspondence[] = [
    { id: 'circle', members: { a: '0/0', b: '0/0' }, confidence: 0.9, status: 'auto' },
  ];

  it('renames a member node to its canonical id', () => {
    const f = frame('a', `<svg><circle id="circle-1" cx="50" cy="50" r="20"/></svg>`);
    const result = refactorFrameIds(f, correspondences);
    expect(result.markup).toContain('id="circle"');
    expect(result.markup).not.toContain('circle-1');
    expect(result.idMap).toEqual({ 'circle-1': 'circle' });
    expect(result.warnings).toEqual([]);
  });

  it('rewrites references that pointed at the renamed id', () => {
    const f = frame(
      'a',
      `<svg><circle id="circle-1" cx="50" cy="50" r="20"/><use href="#circle-1"/></svg>`,
    );
    const corrs: Correspondence[] = [
      { id: 'circle', members: { a: '0/0' }, confidence: 1, status: 'manual' },
      { id: 'copy', members: { a: '0/1' }, confidence: 1, status: 'manual' },
    ];
    const result = refactorFrameIds(f, corrs);
    expect(result.markup).toContain('href="#circle"');
  });

  it('assigns a fresh id to an anonymous member node', () => {
    const f = frame('a', `<svg><circle cx="50" cy="50" r="20"/></svg>`);
    const corrs: Correspondence[] = [
      { id: 'ball', members: { a: '0/0' }, confidence: 1, status: 'manual' },
    ];
    const result = refactorFrameIds(f, corrs);
    expect(result.markup).toContain('id="ball"');
    expect(result.assigned).toEqual({ '0/0': 'ball' });
  });

  it('preserves surrounding formatting and unrelated attributes', () => {
    const src = `<svg>\n  <circle id="circle-1" cx="50" cy="50" r="20" fill="red"/>\n</svg>`;
    const result = refactorFrameIds(frame('a', src), correspondences);
    expect(result.markup).toBe(
      `<svg>\n  <circle id="circle" cx="50" cy="50" r="20" fill="red"/>\n</svg>`,
    );
  });

  it('leaves url(#…) pointing at an unrenamed defs id alone', () => {
    const f = frame(
      'a',
      `<svg><defs><linearGradient id="grad"/></defs><circle id="circle-1" fill="url(#grad)" r="5"/></svg>`,
    );
    // <defs> occupies index 0, so the circle is at 0/1.
    const corrs: Correspondence[] = [
      { id: 'circle', members: { a: '0/1' }, confidence: 1, status: 'manual' },
    ];
    const result = refactorFrameIds(f, corrs);
    expect(result.markup).toContain('id="circle"');
    expect(result.markup).toContain('url(#grad)'); // untouched
  });

  it('warns when a canonical id collides with an existing id', () => {
    // Canonical "circle" collides with a sibling already named "circle".
    const f = frame(
      'a',
      `<svg><circle id="circle-1" r="5"/><rect id="circle"/></svg>`,
    );
    const result = refactorFrameIds(f, correspondences);
    expect(result.warnings.some((w) => /collide/i.test(w))).toBe(true);
  });

  it('skips correspondences with no member in this frame', () => {
    const f = frame('b', `<svg><rect id="only-b"/></svg>`);
    const corrs: Correspondence[] = [
      { id: 'circle', members: { a: '0/0' }, confidence: 1, status: 'manual' },
    ];
    const result = refactorFrameIds(f, corrs);
    expect(result.markup).toBe(f.markup); // nothing to do
    expect(result.idMap).toEqual({});
  });
});
