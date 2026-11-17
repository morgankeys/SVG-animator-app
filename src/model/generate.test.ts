import { generateInterpolation } from './generate';
import { parseSvgToFrame } from './frames';
import type { Frame } from './frames';
import type { Correspondence } from './match';

function frame(id: string, markup: string): Frame {
  const r = parseSvgToFrame(id, `${id}.svg`, markup);
  if (!r.ok) throw new Error(`fixture should parse: ${r.error}`);
  return r.frame;
}

describe('generateInterpolation', () => {
  it('emits canonical ids in markup and a keyframe per frame for a differing property', () => {
    const f1 = frame('a', `<svg><circle id="ball-1" cx="50" cy="20" r="10" fill="red"/></svg>`);
    const f2 = frame('b', `<svg><circle id="ball-2" cx="50" cy="80" r="10" fill="blue"/></svg>`);
    const corrs: Correspondence[] = [
      { id: 'svg', members: { a: '0', b: '0' }, confidence: 1, status: 'auto' },
      { id: 'ball', members: { a: '0/0', b: '0/0' }, confidence: 0.9, status: 'auto' },
    ];

    const { markup, styles, warnings } = generateInterpolation([f1, f2], corrs);

    // Unified markup uses the base frame's structure with canonical ids.
    expect(markup).toContain('id="ball"');
    expect(markup).not.toContain('ball-1');

    // cy and fill differ → both animated; cx and r are constant → omitted.
    expect(styles).toContain('@keyframes ball-frames');
    expect(styles).toContain('animation: ball-frames');
    expect(styles).toMatch(/0% \{[\s\S]*cy: 20;[\s\S]*fill: red;[\s\S]*\}/);
    expect(styles).toMatch(/100% \{[\s\S]*cy: 80;[\s\S]*fill: blue;[\s\S]*\}/);
    expect(styles).not.toContain('r: 10'); // unchanged property not emitted
    expect(warnings).toEqual([]);
  });

  it('places stops at even percentages across three frames', () => {
    const mk = (id: string, cy: number) =>
      frame(id, `<svg><circle id="ball" cx="50" cy="${cy}" r="10"/></svg>`);
    const corrs: Correspondence[] = [
      { id: 'ball', members: { '1': '0/0', '2': '0/0', '3': '0/0' }, confidence: 1, status: 'auto' },
    ];
    const { styles } = generateInterpolation([mk('1', 0), mk('2', 50), mk('3', 100)], corrs);
    expect(styles).toContain('0% {');
    expect(styles).toContain('50% {');
    expect(styles).toContain('100% {');
  });

  it('animates opacity to 0 for an element that disappears in a later frame', () => {
    const f1 = frame('a', `<svg><circle id="ball" r="10"/><rect id="bar" width="10" height="2"/></svg>`);
    const f2 = frame('b', `<svg><circle id="ball" r="10"/></svg>`);
    const corrs: Correspondence[] = [
      { id: 'ball', members: { a: '0/0', b: '0/0' }, confidence: 1, status: 'auto' },
      { id: 'bar', members: { a: '0/1' }, confidence: 0, status: 'frame-specific' },
    ];
    const { styles } = generateInterpolation([f1, f2], corrs);
    expect(styles).toContain('@keyframes bar-frames');
    expect(styles).toMatch(/0% \{[\s\S]*opacity: 1;[\s\S]*\}/);
    expect(styles).toMatch(/100% \{[\s\S]*opacity: 0;[\s\S]*\}/);
  });

  it('warns about an element that appears only in a non-base frame', () => {
    const f1 = frame('a', `<svg><circle id="ball" r="10"/></svg>`);
    const f2 = frame('b', `<svg><circle id="ball" r="10"/><rect id="late" width="5" height="5"/></svg>`);
    const corrs: Correspondence[] = [
      { id: 'ball', members: { a: '0/0', b: '0/0' }, confidence: 1, status: 'auto' },
      { id: 'late', members: { b: '0/1' }, confidence: 0, status: 'unmatched' },
    ];
    const { warnings } = generateInterpolation([f1, f2], corrs);
    expect(warnings.some((w) => /appears only in non-base/.test(w))).toBe(true);
  });

  it('reads animated values from inline style, overriding presentation attributes', () => {
    const f1 = frame('a', `<svg><circle id="ball" r="10" style="fill: red"/></svg>`);
    const f2 = frame('b', `<svg><circle id="ball" r="10" style="fill: green"/></svg>`);
    const corrs: Correspondence[] = [
      { id: 'ball', members: { a: '0/0', b: '0/0' }, confidence: 1, status: 'auto' },
    ];
    const { styles } = generateInterpolation([f1, f2], corrs);
    expect(styles).toContain('fill: red');
    expect(styles).toContain('fill: green');
  });

  it('warns when nothing differs', () => {
    const f1 = frame('a', `<svg><circle id="ball" cx="50" cy="50" r="10"/></svg>`);
    const f2 = frame('b', `<svg><circle id="ball" cx="50" cy="50" r="10"/></svg>`);
    const corrs: Correspondence[] = [
      { id: 'ball', members: { a: '0/0', b: '0/0' }, confidence: 1, status: 'auto' },
    ];
    const { styles, warnings } = generateInterpolation([f1, f2], corrs);
    expect(styles).toBe('');
    expect(warnings.some((w) => /No animatable differences/.test(w))).toBe(true);
  });

  it('handles no frames', () => {
    const { warnings } = generateInterpolation([], []);
    expect(warnings.some((w) => /No frames/.test(w))).toBe(true);
  });
});
