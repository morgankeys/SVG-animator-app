import { specificity, compareSpecificity } from './specificity';

describe('specificity', () => {
  it.each([
    ['*', [0, 0, 0]],
    ['circle', [0, 0, 1]],
    ['g circle', [0, 0, 2]],
    ['.ball', [0, 1, 0]],
    ['#ball', [1, 0, 0]],
    ['svg #scene > circle.ball:hover', [1, 2, 2]],
    ['[fill="red"]', [0, 1, 0]],
    ['circle::before', [0, 0, 2]],
    ['li:first-child', [0, 1, 1]],
    [':not(.a)', [0, 1, 0]], // wrapper free, argument counted
    [':where(.a, #b)', [0, 0, 0]],
    ['a[href="#id .cls"]', [0, 1, 1]], // string contents ignored
  ])('%s → %j', (selector, expected) => {
    expect(specificity(selector)).toEqual(expected);
  });
});

describe('compareSpecificity', () => {
  it('orders ids > classes > types', () => {
    expect(compareSpecificity([1, 0, 0], [0, 9, 9])).toBeGreaterThan(0);
    expect(compareSpecificity([0, 1, 0], [0, 0, 9])).toBeGreaterThan(0);
    expect(compareSpecificity([0, 1, 1], [0, 1, 1])).toBe(0);
  });
});
