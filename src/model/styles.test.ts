import { compileStyles, parseStyles, serializeStyles } from './styles';
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
