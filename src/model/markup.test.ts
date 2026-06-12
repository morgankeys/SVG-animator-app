import { parseMarkup, refToPath, resolveRef, elementToRef } from './markup';
import { sampleDocument } from './document';

describe('parseMarkup', () => {
  it('parses the sample document into the expected tree', () => {
    const roots = parseMarkup(sampleDocument().markup);
    expect(roots).toHaveLength(1);

    const svg = roots[0];
    expect(svg.tag).toBe('svg');
    expect(svg.ref).toBe('0');
    expect(svg.attributes['viewBox']).toBe('0 0 400 300');

    expect(svg.children).toHaveLength(1);
    const scene = svg.children[0];
    expect(scene.tag).toBe('g');
    expect(scene.id).toBe('scene');
    expect(scene.ref).toBe('0/0');

    expect(scene.children.map((c) => [c.tag, c.id, c.ref])).toEqual([
      ['rect', 'ground', '0/0/0'],
      ['circle', 'ball', '0/0/1'],
    ]);
  });

  it('captures classes and attributes', () => {
    const [rect] = parseMarkup('<rect class="a b" x="1" y="2"/>');
    expect(rect.classes).toEqual(['a', 'b']);
    expect(rect.attributes).toMatchObject({ class: 'a b', x: '1', y: '2' });
    expect(rect.id).toBeUndefined();
  });

  it('handles deep nesting', () => {
    const roots = parseMarkup('<svg><g><g><circle id="c"/></g></g></svg>');
    const circle = roots[0].children[0].children[0].children[0];
    expect(circle.id).toBe('c');
    expect(circle.ref).toBe('0/0/0/0');
  });

  it('excludes <defs> subtrees but preserves sibling indices', () => {
    const roots = parseMarkup(
      '<svg><defs><linearGradient id="grad"/></defs><circle id="dot"/></svg>',
    );
    const svg = roots[0];
    expect(svg.children).toHaveLength(1);
    expect(svg.children[0].id).toBe('dot');
    // The circle is the SECOND element child in the real DOM (defs occupies index 0).
    expect(svg.children[0].ref).toBe('0/1');
  });
});

describe('refToPath', () => {
  it('splits refs into index paths', () => {
    expect(refToPath('0/2/1')).toEqual([0, 2, 1]);
    expect(refToPath('')).toEqual([]);
  });
});

describe('resolveRef', () => {
  it('round-trips every node in a parsed tree back to its DOM element', () => {
    const markup = sampleDocument().markup;
    const dom = new DOMParser().parseFromString(markup, 'text/html');
    const walk = (nodes: ReturnType<typeof parseMarkup>) =>
      nodes.forEach((node) => {
        const el = resolveRef(dom.body, node.ref);
        expect(el?.tagName.toLowerCase()).toBe(node.tag);
        expect(el?.id || undefined).toBe(node.id);
        walk(node.children);
      });
    walk(parseMarkup(markup));
  });

  it('resolves refs past an excluded <defs> sibling', () => {
    const dom = new DOMParser().parseFromString(
      '<svg><defs></defs><circle id="dot"/></svg>',
      'text/html',
    );
    expect(resolveRef(dom.body, '0/1')?.id).toBe('dot');
  });

  it('returns null for dangling refs', () => {
    const dom = new DOMParser().parseFromString('<svg></svg>', 'text/html');
    expect(resolveRef(dom.body, '0/5')).toBeNull();
    expect(resolveRef(dom.body, '')).toBeNull();
  });
});

describe('elementToRef', () => {
  it('inverts resolveRef for every node in the sample document', () => {
    const dom = new DOMParser().parseFromString(sampleDocument().markup, 'text/html');
    const walk = (nodes: ReturnType<typeof parseMarkup>) =>
      nodes.forEach((node) => {
        const el = resolveRef(dom.body, node.ref)!;
        expect(elementToRef(dom.body, el)).toBe(node.ref);
        walk(node.children);
      });
    walk(parseMarkup(sampleDocument().markup));
  });

  it('counts a <defs> sibling in the index', () => {
    const dom = new DOMParser().parseFromString(
      '<svg><defs></defs><circle id="dot"/></svg>',
      'text/html',
    );
    expect(elementToRef(dom.body, dom.getElementById('dot')!)).toBe('0/1');
  });

  it('returns null for the root itself and for detached elements', () => {
    const dom = new DOMParser().parseFromString('<svg></svg>', 'text/html');
    expect(elementToRef(dom.body, dom.body)).toBeNull();
    expect(elementToRef(dom.body, dom.createElement('div'))).toBeNull();
  });
});
