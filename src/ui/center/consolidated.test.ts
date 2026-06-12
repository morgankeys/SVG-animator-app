import { buildConsolidatedSource } from './consolidated';

describe('buildConsolidatedSource', () => {
  it('joins markup and compiled CSS in a style tag', () => {
    expect(buildConsolidatedSource('<svg></svg>\n', '#a {\n  fill: red;\n}')).toBe(
      '<svg></svg>\n\n<style>\n#a {\n  fill: red;\n}\n</style>\n',
    );
  });

  it('returns markup alone when there is no CSS', () => {
    expect(buildConsolidatedSource('<svg></svg>', '')).toBe('<svg></svg>');
    expect(buildConsolidatedSource('<svg></svg>', '  \n')).toBe('<svg></svg>');
  });
});
