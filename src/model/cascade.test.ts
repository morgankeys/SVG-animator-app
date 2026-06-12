import { resolveEffectiveProperties } from './cascade';
import { parseStyles } from './styles';

function elementFrom(markup: string, id: string): Element {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  return doc.getElementById(id)!;
}

const ballMarkup = '<svg><g id="scene" class="grp"><circle id="ball" class="shape"/></g></svg>';

function resolve(css: string, markup = ballMarkup, id = 'ball') {
  return resolveEffectiveProperties(parseStyles(css), elementFrom(markup, id));
}

describe('resolveEffectiveProperties', () => {
  it('collects declarations from matching rules only', () => {
    const props = resolve('#ball { fill: red; } #other { fill: blue; } rect { stroke: green; }');
    expect(props.get('fill')!.value).toBe('red');
    expect(props.has('stroke')).toBe(false);
  });

  it('higher specificity wins; lower becomes competing with a warning-ready list', () => {
    const props = resolve('circle { fill: blue; } #ball { fill: red; }');
    const fill = props.get('fill')!;
    expect(fill.value).toBe('red');
    expect(fill.source).toMatchObject({ selector: '#ball', ruleIndex: 1, declIndex: 0 });
    expect(fill.competing).toEqual([{ selector: 'circle', value: 'blue' }]);
    expect(fill.editable).toBe(true);
  });

  it('source order breaks specificity ties (later wins)', () => {
    const props = resolve('.shape { opacity: 0.2; } .shape { opacity: 0.8; }');
    expect(props.get('opacity')!.value).toBe('0.8');
    expect(props.get('opacity')!.competing).toEqual([{ selector: '.shape', value: '0.2' }]);
  });

  it('!important beats specificity', () => {
    const props = resolve('circle { fill: blue !important; } #ball { fill: red; }');
    expect(props.get('fill')!.value).toBe('blue');
    expect(props.get('fill')!.source).toMatchObject({ important: true });
  });

  it('uses the most specific matching selector of a selector list', () => {
    // The rule matches as both `circle` [0,0,1] and `#scene > circle` [1,0,1];
    // the id-stronger match must beat a plain .shape rule that comes later.
    const props = resolve('circle, #scene > circle { fill: red; } .shape { fill: blue; }');
    expect(props.get('fill')!.value).toBe('red');
  });

  it('inline style beats normal rules but loses to !important; not editable', () => {
    const markup =
      '<svg><circle id="ball" style="fill: purple; opacity: 0.5"/></svg>';
    const props = resolve('#ball { fill: red !important; opacity: 0.9; }', markup);
    expect(props.get('fill')!.value).toBe('red'); // important rule wins
    const opacity = props.get('opacity')!;
    expect(opacity.value).toBe('0.5'); // inline wins over normal rule
    expect(opacity.source).toBeNull();
    expect(opacity.editable).toBe(false);
    expect(opacity.competing).toEqual([{ selector: '#ball', value: '0.9' }]);
  });

  it('ignores @keyframes stop blocks', () => {
    // "0%"/"100%" parse as rules but are stops, not cascade participants.
    const props = resolve(
      '@keyframes b { 0% { opacity: 0; } 100% { opacity: 1; } } #ball { fill: red; }',
    );
    expect(props.has('opacity')).toBe(false);
    expect(props.get('fill')!.value).toBe('red');
  });

  it('skips invalid selectors without crashing', () => {
    const props = resolve('#ball { fill: red; } :not-a-real-pseudo(x) { fill: blue; }');
    expect(props.get('fill')!.value).toBe('red');
  });

  it('reports no computed value for detached elements', () => {
    const props = resolve('#ball { fill: red; }');
    expect(typeof props.get('fill')!.computed).toBe('string');
  });
});
