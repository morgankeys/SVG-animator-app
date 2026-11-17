import { autoMatch, normalizeStem, scoreNodes } from './match';
import type { MatchFrame } from './match';
import { parseMarkup } from './markup';

/** Build a MatchFrame by parsing inline SVG markup (same projection as the app). */
function frame(id: string, markup: string): MatchFrame {
  return { id, tree: parseMarkup(markup) };
}

/** Find the correspondence that contains `ref` in frame `frameId`. */
function corrFor(
  result: ReturnType<typeof autoMatch>,
  frameId: string,
  ref: string,
) {
  return result.find((c) => c.members[frameId] === ref);
}

describe('normalizeStem', () => {
  it('strips trailing frame indices and suffixes', () => {
    expect(normalizeStem('circle-1')).toBe('circle');
    expect(normalizeStem('circle_2')).toBe('circle');
    expect(normalizeStem('circle.frame2')).toBe('circle');
    expect(normalizeStem('frame-1')).toBe('frame');
    expect(normalizeStem('ball-state-4')).toBe('ball');
  });

  it('leaves a bare stem untouched and never returns empty', () => {
    expect(normalizeStem('circle')).toBe('circle');
    expect(normalizeStem('123')).toBe('123'); // all-digits → falls back to raw
  });

  it('strips a trailing single-letter index only when a real stem remains', () => {
    expect(normalizeStem('circleA')).toBe('circle');
    expect(normalizeStem('ab')).toBe('ab'); // too short to strip
  });
});

describe('autoMatch — the canonical id-suffix case', () => {
  const f1 = frame(
    'a',
    `<svg><g id="frame-1"><circle id="circle-1" cx="50" cy="50" r="20"/></g></svg>`,
  );
  const f2 = frame(
    'b',
    `<svg><g id="frame-2"><circle id="circle-2" cx="50" cy="80" r="20"/></g></svg>`,
  );

  it('unifies #circle-1 ↔ #circle-2 and #frame-1 ↔ #frame-2', () => {
    const result = autoMatch([f1, f2]);
    const circle = corrFor(result, 'a', '0/0/0');
    expect(circle).toBeDefined();
    expect(circle!.members.b).toBe('0/0/0');
    expect(circle!.status).toBe('auto');
    expect(circle!.id).toBe('circle');

    const group = corrFor(result, 'a', '0/0');
    expect(group!.members.b).toBe('0/0');
    expect(group!.id).toBe('frame');
  });

  it('assigns each correspondence a unique canonical id', () => {
    const result = autoMatch([f1, f2]);
    const ids = result.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('autoMatch — tag is a hard filter', () => {
  it('never matches a circle to a rect even in the same position', () => {
    const f1 = frame('a', `<svg><circle id="a" cx="10" cy="10" r="5"/></svg>`);
    const f2 = frame('b', `<svg><rect id="a" x="10" y="10" width="5" height="5"/></svg>`);
    const result = autoMatch([f1, f2]);
    // The <svg> roots legitimately match; the circle and rect must NOT.
    const circle = corrFor(result, 'a', '0/0');
    const rect = corrFor(result, 'b', '0/0');
    expect(Object.keys(circle!.members)).toEqual(['a']);
    expect(Object.keys(rect!.members)).toEqual(['b']);
    expect(circle!.status).toBe('unmatched');
    expect(rect!.status).toBe('unmatched');
  });
});

describe('autoMatch — geometry distinguishes siblings of the same tag', () => {
  const f1 = frame(
    'a',
    `<svg><circle id="big" cx="20" cy="20" r="40"/><circle id="small" cx="80" cy="80" r="5"/></svg>`,
  );
  const f2 = frame(
    'b',
    // ids swapped/absent; geometry + position must carry the match
    `<svg><circle cx="22" cy="22" r="42"/><circle cx="78" cy="82" r="6"/></svg>`,
  );

  it('matches by position and radius, not document order alone', () => {
    const result = autoMatch([f1, f2]);
    const big = corrFor(result, 'a', '0/0');
    const small = corrFor(result, 'a', '0/1');
    expect(big!.members.b).toBe('0/0');
    expect(small!.members.b).toBe('0/1');
  });
});

describe('autoMatch — frame-specific elements', () => {
  it('flags an element present in one frame but not the other as unmatched', () => {
    const f1 = frame('a', `<svg><circle id="ball" cx="50" cy="50" r="20"/></svg>`);
    const f2 = frame(
      'b',
      `<svg><circle id="ball" cx="50" cy="50" r="20"/><rect id="shadow" x="0" y="90" width="100" height="5"/></svg>`,
    );
    const result = autoMatch([f1, f2]);

    const ball = corrFor(result, 'a', '0/0');
    expect(ball!.members.b).toBe('0/0');
    expect(ball!.status).toBe('auto');

    const shadow = corrFor(result, 'b', '0/1');
    expect(shadow).toBeDefined();
    expect(shadow!.members.a).toBeUndefined();
    expect(shadow!.status).toBe('unmatched');
    expect(shadow!.id).toBe('shadow');
  });
});

describe('autoMatch — three frames fold in sequentially', () => {
  it('carries a correspondence across all frames and marks it auto', () => {
    const mk = (id: string, cy: number) =>
      frame(id, `<svg><circle id="ball-${id}" cx="50" cy="${cy}" r="20"/></svg>`);
    const result = autoMatch([mk('1', 20), mk('2', 50), mk('3', 80)]);
    const ball = result.find((c) => c.members['1'] === '0/0');
    expect(ball!.members).toEqual({ '1': '0/0', '2': '0/0', '3': '0/0' });
    expect(ball!.status).toBe('auto');
  });

  it('matches an element that first appears in frame 2 against frame 3', () => {
    const f1 = frame('1', `<svg><circle id="ball" cx="50" cy="50" r="20"/></svg>`);
    const f2 = frame(
      '2',
      `<svg><circle id="ball" cx="50" cy="50" r="20"/><rect id="bar" x="0" y="0" width="10" height="10"/></svg>`,
    );
    const f3 = frame(
      '3',
      `<svg><circle id="ball" cx="50" cy="50" r="20"/><rect id="bar" x="0" y="0" width="12" height="10"/></svg>`,
    );
    const result = autoMatch([f1, f2, f3]);
    const bar = result.find((c) => c.members['2'] === '0/1');
    expect(bar!.members['3']).toBe('0/1');
    expect(bar!.members['1']).toBeUndefined();
  });
});

describe('autoMatch — degenerate input', () => {
  it('returns [] for no frames', () => {
    expect(autoMatch([])).toEqual([]);
  });

  it('returns one singleton per node for a single frame', () => {
    const result = autoMatch([frame('a', `<svg><circle/><rect/></svg>`)]);
    expect(result).toHaveLength(3); // svg + circle + rect
    expect(result.every((c) => c.status === 'unmatched')).toBe(true);
  });
});

describe('scoreNodes is exported for fixtures and stays bounded', () => {
  it('keeps scores within 0–1', () => {
    const f = parseMarkup(`<svg><circle id="x" cx="1" cy="1" r="1"/></svg>`);
    const flat = [{ node: f[0].children[0], ref: '0/0', tag: 'circle', depth: 1, siblingIndex: 0, ancestorTags: ['svg'] }];
    const s = scoreNodes(flat[0], flat[0], flat);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
