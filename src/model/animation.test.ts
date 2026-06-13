import {
  buildTimelineRows,
  collectKeyframes,
  resolveElementAnimations,
} from './animation';
import { parseStyles } from './styles';
import { resolveEffectiveProperties } from './cascade';

function bodyOf(markup: string): HTMLElement {
  return new DOMParser().parseFromString(markup, 'text/html').body;
}

function rows(markup: string, css: string) {
  return buildTimelineRows(parseStyles(css), bodyOf(markup));
}

const ballMarkup = '<svg><circle id="ball"/></svg>';

describe('collectKeyframes', () => {
  it('collects stops with from/to and percentage selectors, sorted', () => {
    const kf = collectKeyframes(
      parseStyles('@keyframes bounce { from { opacity: 0 } 50% { opacity: 1 } to { opacity: 0 } }'),
    );
    const bounce = kf.get('bounce')!;
    expect(bounce.stops.map((s) => s.percent)).toEqual([0, 50, 100]);
  });

  it('expands a grouped selector (0%, 100%) into one stop per percent', () => {
    const kf = collectKeyframes(parseStyles('@keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }'));
    expect(kf.get('blink')!.stops.map((s) => s.percent)).toEqual([0, 50, 100]);
  });

  it('exposes the @keyframes block range as a styles-buffer span', () => {
    const css = '#ball { fill: red }\n@keyframes spin { 0% { x: 0 } }';
    const kf = collectKeyframes(parseStyles(css));
    const range = kf.get('spin')!.range;
    expect(css.slice(range.from, range.to)).toBe('@keyframes spin { 0% { x: 0 } }');
  });

  it('a later @keyframes of the same name wins', () => {
    const kf = collectKeyframes(parseStyles('@keyframes a { 0% {} } @keyframes a { 0% {} 100% {} }'));
    expect(kf.get('a')!.stops).toHaveLength(2);
  });
});

describe('resolveElementAnimations', () => {
  function specs(css: string, markup = ballMarkup, id = 'ball') {
    const el = bodyOf(markup).querySelector(`#${id}`)!;
    return resolveElementAnimations(resolveEffectiveProperties(parseStyles(css), el));
  }

  it('parses the shorthand into name/duration/timing/iterations', () => {
    const [spec] = specs('#ball { animation: bounce 2s ease-in-out infinite }');
    expect(spec).toMatchObject({
      name: 'bounce',
      durationMs: 2000,
      timingFunction: 'ease-in-out',
      iterations: Infinity,
    });
  });

  it('reads the second time as delay and ms units', () => {
    const [spec] = specs('#ball { animation: slide 500ms 250ms }');
    expect(spec).toMatchObject({ name: 'slide', durationMs: 500, delayMs: 250 });
  });

  it('keeps commas inside cubic-bezier/steps together', () => {
    const [spec] = specs('#ball { animation: go 1s cubic-bezier(0.1, 0.2, 0.3, 0.4) }');
    expect(spec.name).toBe('go');
    expect(spec.timingFunction).toBe('cubic-bezier(0.1, 0.2, 0.3, 0.4)');
  });

  it('splits multiple comma-separated animations into separate specs', () => {
    const list = specs('#ball { animation: a 1s, b 2s }');
    expect(list.map((s) => [s.name, s.durationMs])).toEqual([
      ['a', 1000],
      ['b', 2000],
    ]);
  });

  it('builds from longhands when there is no shorthand', () => {
    const [spec] = specs('#ball { animation-name: pulse; animation-duration: 3s }');
    expect(spec).toMatchObject({ name: 'pulse', durationMs: 3000 });
  });

  it('lets a longhand override the matching shorthand part', () => {
    const [spec] = specs('#ball { animation: bounce 2s; animation-duration: 5s }');
    expect(spec).toMatchObject({ name: 'bounce', durationMs: 5000 });
  });

  it('ignores an animation with name none or no name', () => {
    expect(specs('#ball { animation: none }')).toHaveLength(0);
    expect(specs('#ball { animation-duration: 2s }')).toHaveLength(0);
  });
});

describe('buildTimelineRows', () => {
  it('produces one row per applied animation with keyframe stops', () => {
    const css =
      '#ball { animation: bounce 2s infinite }\n' +
      '@keyframes bounce { 0% { transform: translateY(0) } 50% { transform: translateY(-160px) } 100% { transform: translateY(0) } }';
    const [row] = rows(ballMarkup, css);
    expect(row).toMatchObject({
      kind: 'animation',
      elementRef: '0/0',
      label: 'bounce',
      durationMs: 2000,
      iterations: Infinity,
    });
    expect(row.stops.map((s) => s.atPercent)).toEqual([0, 50, 100]);
  });

  it('points each stop range at its keyframe block in the styles buffer', () => {
    const css = '#ball { animation: bounce 1s }\n@keyframes bounce { 0% { opacity: 0 } 100% { opacity: 1 } }';
    const [row] = rows(ballMarkup, css);
    expect(css.slice(row.stops[1].range.from, row.stops[1].range.to)).toBe('100% { opacity: 1 }');
  });

  it('still lists an animation whose @keyframes is missing (no stops)', () => {
    const [row] = rows(ballMarkup, '#ball { animation: ghost 1s }');
    expect(row.label).toBe('ghost');
    expect(row.keyframesRange).toBeNull();
    expect(row.stops).toEqual([]);
  });

  it('resolves the animation through the cascade (a later rule wins)', () => {
    const css =
      'circle { animation: a 1s } #ball { animation: b 2s }\n@keyframes b { 0% {} 100% {} }';
    const built = rows(ballMarkup, css);
    expect(built).toHaveLength(1);
    expect(built[0].label).toBe('b');
  });

  it('excludes elements inside <defs>', () => {
    const markup = '<svg><defs><circle id="def"/></defs><circle id="ball"/></svg>';
    const css =
      '#def { animation: a 1s } #ball { animation: b 1s }\n@keyframes a { 0% {} } @keyframes b { 0% {} }';
    const built = rows(markup, css);
    expect(built.map((r) => r.label)).toEqual(['b']);
  });

  it('gives each row a stable id keyed by element ref and index', () => {
    const css = '#ball { animation: a 1s, b 1s }\n@keyframes a {0%{}} @keyframes b {0%{}}';
    const built = rows(ballMarkup, css);
    expect(built.map((r) => r.rowId)).toEqual(['0/0::0', '0/0::1']);
  });
});
