import {
  parseMarkup,
  refToPath,
  resolveRef,
  elementToRef,
  setMarkupAttribute,
  ensureElementId,
  insertAfter,
  insertChild,
  removeElement,
  moveElement,
} from './markup';
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

describe('setMarkupAttribute', () => {
  it('rewrites only the attribute value; every other byte survives', () => {
    const markup = sampleDocument().markup;
    const next = setMarkupAttribute(markup, '0/0/1', 'cx', '123');
    expect(next).toBe(markup.replace('cx="200"', 'cx="123"'));
  });

  it('inserts a missing attribute before a self-closing tag end, keeping its spacing', () => {
    const next = setMarkupAttribute('<svg>\n  <circle cx="1" />\n</svg>', '0/0', 'r', '5');
    expect(next).toBe('<svg>\n  <circle cx="1" r="5" />\n</svg>');
  });

  it('inserts into a plain open tag', () => {
    const next = setMarkupAttribute('<svg><g id="a"><rect/></g></svg>', '0/0', 'fill', 'red');
    expect(next).toBe('<svg><g id="a" fill="red"><rect/></g></svg>');
  });

  it('matches attribute names case-insensitively, preserving the written case', () => {
    const next = setMarkupAttribute('<svg><rect X="1"/></svg>', '0/0', 'x', '9');
    expect(next).toBe('<svg><rect X="9"/></svg>');
  });

  it('preserves single quotes and escapes the value for its quote style', () => {
    const next = setMarkupAttribute("<svg><text aria-label='hi'/></svg>", '0/0', 'aria-label', "it's");
    expect(next).toBe("<svg><text aria-label='it&#39;s'/></svg>");
  });

  it('quotes a previously unquoted value', () => {
    const next = setMarkupAttribute('<svg><rect x=1 y="2"/></svg>', '0/0', 'x', '9');
    expect(next).toBe('<svg><rect x="9" y="2"/></svg>');
  });

  it('is not fooled by comments or attribute values containing tags', () => {
    const markup = '<!-- <circle cx="0"/> --><svg><g data-note="<circle>"><circle cx="1"/></g></svg>';
    const next = setMarkupAttribute(markup, '0/0/0', 'cx', '7');
    expect(next).toBe(markup.replace('cx="1"', 'cx="7"'));
  });

  it('edits the right element among same-tag siblings', () => {
    const markup = '<svg><circle r="1"/><circle r="2"/><circle r="3"/></svg>';
    expect(setMarkupAttribute(markup, '0/1', 'r', '9')).toBe(
      '<svg><circle r="1"/><circle r="9"/><circle r="3"/></svg>',
    );
  });

  it('returns null instead of guessing when the parser invents elements', () => {
    // The HTML parser inserts <tbody>, so source tags and DOM no longer correspond.
    const markup = '<table><tr><td>x</td></tr></table>';
    expect(setMarkupAttribute(markup, '0', 'border', '1')).toBeNull();
  });

  it('returns null for dangling refs', () => {
    expect(setMarkupAttribute('<svg></svg>', '0/4', 'x', '1')).toBeNull();
  });
});

describe('insertAfter', () => {
  it('inserts a sibling after a leaf at its indentation, shifting later siblings', () => {
    const markup = sampleDocument().markup;
    const result = insertAfter(markup, '0/0/0', '<line x1="0" y1="0" x2="1" y2="1" />');
    expect(result).not.toBeNull();
    expect(result!.ref).toBe('0/0/1');
    expect(result!.markup).toContain(
      '    <rect id="ground" x="0" y="260" width="400" height="40" />\n' +
        '    <line x1="0" y1="0" x2="1" y2="1" />\n' +
        '    <circle id="ball"',
    );
    expect(parseMarkup(result!.markup)[0].children[0].children.map((c) => c.tag)).toEqual([
      'rect',
      'line',
      'circle',
    ]);
  });

  it('inserts after a container subtree, not inside it', () => {
    const markup = '<svg>\n  <g id="a"><rect/></g>\n  <circle/>\n</svg>';
    const result = insertAfter(markup, '0/0', '<text>x</text>');
    expect(result!.ref).toBe('0/1');
    expect(parseMarkup(result!.markup)[0].children.map((c) => c.tag)).toEqual([
      'g',
      'text',
      'circle',
    ]);
  });

  it('returns null for a dangling ref', () => {
    expect(insertAfter('<svg></svg>', '0/3', '<rect/>')).toBeNull();
  });
});

describe('insertChild', () => {
  it('appends as the last child of a container that has children', () => {
    const result = insertChild(sampleDocument().markup, '0/0', '<text>hi</text>');
    expect(result!.ref).toBe('0/0/2');
    expect(parseMarkup(result!.markup)[0].children[0].children.map((c) => c.tag)).toEqual([
      'rect',
      'circle',
      'text',
    ]);
  });

  it('inserts between the tags of an empty container, indenting one level deeper', () => {
    const result = insertChild('<svg>\n  <g id="box"></g>\n</svg>', '0/0', '<rect/>');
    expect(result).toEqual({
      markup: '<svg>\n  <g id="box">\n    <rect/>\n  </g>\n</svg>',
      ref: '0/0/0',
    });
  });

  it('refuses to append into a self-closing container', () => {
    expect(insertChild('<svg><g id="box"/></svg>', '0/0', '<rect/>')).toBeNull();
  });

  it('appends a new root when parentRef is empty', () => {
    const result = insertChild('<svg></svg>\n', '', '<svg></svg>');
    expect(result!.ref).toBe('1');
    expect(parseMarkup(result!.markup).map((n) => n.tag)).toEqual(['svg', 'svg']);
  });

  it('seeds an empty buffer', () => {
    expect(insertChild('', '', '<rect/>')).toEqual({ markup: '<rect/>\n', ref: '0' });
  });
});

describe('removeElement', () => {
  it('splices out a leaf and its own line, leaving siblings intact', () => {
    const markup = sampleDocument().markup;
    const next = removeElement(markup, '0/0/0'); // delete rect#ground
    expect(next).toBe(markup.replace('\n    <rect id="ground" x="0" y="260" width="400" height="40" />', ''));
    expect(parseMarkup(next!)[0].children[0].children.map((c) => c.tag)).toEqual(['circle']);
  });

  it('removes a whole subtree', () => {
    const next = removeElement(sampleDocument().markup, '0/0'); // delete g#scene + children
    expect(parseMarkup(next!)[0].children).toHaveLength(0);
    expect(next).not.toContain('circle');
  });

  it('removes an inline element without leaving the surrounding line blank', () => {
    expect(removeElement('<svg><circle/><rect/></svg>', '0/0')).toBe('<svg><rect/></svg>');
  });

  it('returns null for dangling refs and parser-rewritten markup', () => {
    expect(removeElement('<svg></svg>', '0/2')).toBeNull();
    expect(removeElement('<table><tr><td>x</td></tr></table>', '0')).toBeNull();
  });
});

describe('moveElement', () => {
  it('swaps a leaf with its previous sibling (up), preserving separators', () => {
    const markup = sampleDocument().markup;
    const result = moveElement(markup, '0/0/1', 'up'); // circle#ball up over rect#ground
    expect(result!.ref).toBe('0/0/0');
    expect(parseMarkup(result!.markup)[0].children[0].children.map((c) => c.id)).toEqual([
      'ball',
      'ground',
    ]);
    // Indentation is preserved (siblings shared it).
    expect(result!.markup).toContain('    <circle id="ball"');
    expect(result!.markup).toContain('    <rect id="ground"');
  });

  it('swaps a leaf with its next sibling (down)', () => {
    const result = moveElement(sampleDocument().markup, '0/0/0', 'down'); // rect down under circle
    expect(result!.ref).toBe('0/0/1');
    expect(parseMarkup(result!.markup)[0].children[0].children.map((c) => c.id)).toEqual([
      'ball',
      'ground',
    ]);
  });

  it('moves whole subtrees, not just start tags', () => {
    const markup = '<svg>\n  <circle/>\n  <g><rect/></g>\n</svg>';
    const result = moveElement(markup, '0/1', 'up'); // g (with child) up over circle
    expect(result!.ref).toBe('0/0');
    expect(parseMarkup(result!.markup)[0].children.map((c) => c.tag)).toEqual(['g', 'circle']);
    expect(parseMarkup(result!.markup)[0].children[0].children.map((c) => c.tag)).toEqual(['rect']);
  });

  it('returns null at the boundary (no sibling in that direction)', () => {
    expect(moveElement(sampleDocument().markup, '0/0/0', 'up')).toBeNull();
    expect(moveElement(sampleDocument().markup, '0/0/1', 'down')).toBeNull();
  });

  it('steps over an interleaved <defs>, leaving it in place', () => {
    const markup = '<svg>\n  <rect/>\n  <defs></defs>\n  <circle/>\n</svg>';
    const result = moveElement(markup, '0/2', 'up'); // circle up over rect, past <defs>
    expect(result!.ref).toBe('0/0'); // circle takes rect's index
    expect(parseMarkup(result!.markup)[0].children.map((c) => c.tag)).toEqual(['circle', 'rect']);
    // <defs> stays between them (it rode along in the preserved separator).
    expect(result!.markup).toBe('<svg>\n  <circle/>\n  <defs></defs>\n  <rect/>\n</svg>');
  });

  it('treats a <defs> as no sibling at the visible boundary', () => {
    expect(moveElement('<svg>\n  <defs></defs>\n  <rect/>\n</svg>', '0/1', 'up')).toBeNull();
  });
});

describe('ensureElementId', () => {
  it('returns the existing id without touching the buffer', () => {
    const markup = sampleDocument().markup;
    expect(ensureElementId(markup, '0/0/1')).toEqual({ markup, id: 'ball' });
  });

  it('assigns a tag-based id and writes it to the buffer', () => {
    const result = ensureElementId('<svg>\n  <circle cx="1" />\n</svg>', '0/0');
    expect(result).toEqual({
      markup: '<svg>\n  <circle cx="1" id="circle" />\n</svg>',
      id: 'circle',
    });
  });

  it('avoids colliding with existing ids', () => {
    const result = ensureElementId('<svg><g id="circle"/><circle/></svg>', '0/1');
    expect(result?.id).toBe('circle-2');
    expect(result?.markup).toContain('<circle id="circle-2"/>');
  });
});
