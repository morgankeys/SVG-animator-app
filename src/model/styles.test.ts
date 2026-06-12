import {
  compileStyles,
  parseStyles,
  serializeStyles,
  findDeclaration,
  setDeclarationValue,
  createDeclaration,
} from './styles';
import { resolveEffectiveProperties } from './cascade';
import { sampleDocument } from './document';
import type { Declaration, Rule } from '../lib/postcss';

describe('compileStyles', () => {
  it('compiles the sample styles', () => {
    const result = compileStyles(sampleDocument().styles);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.css).toContain('#ball');
    expect(result.css).toContain('@keyframes bounce');
    expect(result.css).toContain('animation: bounce 2s ease-in-out infinite');
  });

  it('compiles SCSS features (variables, nesting)', () => {
    const result = compileStyles('$c: red;\n#a { fill: $c; .b { stroke: $c; } }');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.css).toContain('fill: red');
    expect(result.css).toContain('#a .b');
  });

  it('handles an empty buffer', () => {
    const result = compileStyles('');
    expect(result).toEqual({ ok: true, css: '' });
  });

  it('surfaces compile errors with position instead of throwing', () => {
    const result = compileStyles('#a {\n  fill: $undefined-var;\n}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/undefined/i);
    expect(result.error.line).toBe(2);
  });
});

describe('parseStyles / serializeStyles', () => {
  it('round-trips the sample styles byte-for-byte', () => {
    const source = sampleDocument().styles;
    expect(serializeStyles(parseStyles(source))).toBe(source);
  });

  it('round-trips quirky formatting and comments byte-for-byte', () => {
    const source = '/* keep me */\n#a{fill:red;;}\n\n\n.b ,  .c  { stroke : blue }';
    expect(serializeStyles(parseStyles(source))).toBe(source);
  });

  it('preserves untouched raws when a declaration value is mutated in place', () => {
    const source = '/* header */\n#ball {\n  fill: red; /* trailing */\n  opacity: 1;\n}\n';
    const ast = parseStyles(source);
    const rule = ast.first?.next() as Rule;
    (rule.first as Declaration).value = 'green';
    expect(serializeStyles(ast)).toBe(
      '/* header */\n#ball {\n  fill: green; /* trailing */\n  opacity: 1;\n}\n',
    );
  });
});

function elementFrom(markup: string, selector: string): Element {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  return doc.querySelector(selector)!;
}

describe('findDeclaration / setDeclarationValue', () => {
  const source = '#ground {\n  fill: #3c3c3c;\n}\n\n#ball {\n  fill: blue; /* keep */\n  opacity: 1;\n}\n';

  it('mutates the addressed declaration in place, preserving all other raws', () => {
    const ast = parseStyles(source);
    expect(setDeclarationValue(ast, { ruleIndex: 1, declIndex: 1 }, '0.5')).toBe(true);
    expect(serializeStyles(ast)).toBe(source.replace('opacity: 1', 'opacity: 0.5'));
  });

  it('returns false for stale addresses and leaves the AST untouched', () => {
    const ast = parseStyles(source);
    expect(setDeclarationValue(ast, { ruleIndex: 5, declIndex: 0 }, 'x')).toBe(false);
    expect(setDeclarationValue(ast, { ruleIndex: 0, declIndex: 3 }, 'x')).toBe(false);
    expect(serializeStyles(ast)).toBe(source);
  });

  it('accepts addresses produced by the cascade (keyframe stops occupy rule indices)', () => {
    const css = '@keyframes b { 0% { opacity: 0; } } circle { fill: blue; } #ball { fill: red; }';
    const ast = parseStyles(css);
    const ball = elementFrom('<svg><circle id="ball"/></svg>', '#ball');
    const fill = resolveEffectiveProperties(ast, ball).get('fill')!;
    expect(findDeclaration(ast, fill.source!)?.value).toBe('red');
    expect(setDeclarationValue(ast, fill.source!, 'green')).toBe(true);
    expect(serializeStyles(ast)).toBe(css.replace('fill: red', 'fill: green'));
  });
});

describe('createDeclaration', () => {
  const ball = elementFrom(
    '<svg><g id="scene"><circle id="ball" class="shape"/></g></svg>',
    '#ball',
  );

  it('appends a new declaration to an existing exact #id rule', () => {
    const ast = parseStyles('#ball {\n  fill: blue;\n}\n');
    const result = createDeclaration(ast, ball, 'opacity', '0.5');
    expect(result).toEqual({ ok: true, selector: '#ball', createdRule: false });
    expect(serializeStyles(ast)).toBe('#ball {\n  fill: blue;\n  opacity: 0.5;\n}\n');
  });

  it('updates the property in place when the target rule already declares it', () => {
    const ast = parseStyles('#ball {\n  fill: blue; /* keep */\n}\n');
    createDeclaration(ast, ball, 'fill', 'red');
    expect(serializeStyles(ast)).toBe('#ball {\n  fill: red; /* keep */\n}\n');
  });

  it('never writes into a shared selector; creates a per-element rule instead', () => {
    const ast = parseStyles('circle {\n  fill: blue;\n}\n');
    const result = createDeclaration(ast, ball, 'opacity', '0.5');
    expect(result).toEqual({ ok: true, selector: '#ball', createdRule: true });
    const out = serializeStyles(ast);
    expect(out).toContain('circle {\n  fill: blue;\n}'); // untouched
    expect(out).toContain('#ball {\n  opacity: 0.5;\n}');
  });

  it('does not target a selector list that also matches other elements', () => {
    const ast = parseStyles('#ball, .other {\n  fill: blue;\n}\n');
    const result = createDeclaration(ast, ball, 'opacity', '0.5');
    expect(result).toEqual({ ok: true, selector: '#ball', createdRule: true });
    expect(serializeStyles(ast)).toContain('#ball, .other {\n  fill: blue;\n}');
  });

  it('does not target rules nested inside at-rules (conditional)', () => {
    const ast = parseStyles('@media (min-width: 10px) {\n  #ball {\n    fill: blue;\n  }\n}\n');
    const result = createDeclaration(ast, ball, 'opacity', '0.5');
    expect(result).toEqual({ ok: true, selector: '#ball', createdRule: true });
    expect((ast.last as Rule).parent).toBe(ast); // appended at top level
  });

  it('targets the last exact #id rule so the new declaration wins source-order ties', () => {
    const ast = parseStyles('#ball {\n  fill: blue;\n}\n\n#ball {\n  stroke: red;\n}\n');
    createDeclaration(ast, ball, 'opacity', '0.5');
    expect(serializeStyles(ast)).toBe(
      '#ball {\n  fill: blue;\n}\n\n#ball {\n  stroke: red;\n  opacity: 0.5;\n}\n',
    );
  });

  it('matches the buffer formatting when creating a rule (sample-style buffer)', () => {
    const sky = elementFrom('<svg><rect id="sky"/></svg>', '#sky');
    const ast = parseStyles(sampleDocument().styles);
    createDeclaration(ast, sky, 'stroke', 'black');
    expect(serializeStyles(ast)).toContain('}\n\n#sky {\n  stroke: black;\n}');
  });

  it('reports needs-id for elements without an id (caller assigns one in markup)', () => {
    const anon = elementFrom('<svg><circle class="shape"/></svg>', 'circle');
    const ast = parseStyles('');
    expect(createDeclaration(ast, anon, 'fill', 'red')).toEqual({
      ok: false,
      reason: 'needs-id',
    });
    expect(serializeStyles(ast)).toBe('');
  });
});
