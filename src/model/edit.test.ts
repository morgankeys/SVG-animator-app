import { writeStyleDeclaration, writeMarkupAttribute } from './edit';
import { createDocument, sampleDocument } from './document';

describe('writeStyleDeclaration', () => {
  it('mutates the cascade winner in place, preserving formatting', () => {
    const doc = sampleDocument();
    const result = writeStyleDeclaration(doc, '0/0/1', 'fill', 'tomato');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.markup).toBe(doc.markup);
    expect(result.document.styles).toBe(doc.styles.replace('fill: #4f9cf9', 'fill: tomato'));
  });

  it('mutates the winner even when it lives in a shared rule (competing edits warn, not block)', () => {
    const doc = createDocument('<svg><circle id="ball"/></svg>', 'circle { fill: blue; }');
    const result = writeStyleDeclaration(doc, '0/0', 'fill', 'red');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.styles).toBe('circle { fill: red; }');
  });

  it('creates an unset property in the write-target rule', () => {
    const doc = sampleDocument();
    const result = writeStyleDeclaration(doc, '0/0/1', 'stroke', 'black');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.markup).toBe(doc.markup);
    expect(result.document.styles).toContain(
      '#ball {\n  fill: #4f9cf9;\n  animation: bounce 2s ease-in-out infinite;\n  stroke: black;\n}',
    );
  });

  it('assigns an id in the markup buffer when the element needs one', () => {
    const doc = createDocument('<svg>\n  <circle cx="1" />\n</svg>\n', '');
    const result = writeStyleDeclaration(doc, '0/0', 'fill', 'red');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.markup).toBe('<svg>\n  <circle cx="1" id="circle" />\n</svg>\n');
    expect(result.document.styles).toContain('#circle {');
    expect(result.document.styles).toContain('fill: red');
  });

  it('refuses to edit an inline-style winner (markup-owned)', () => {
    const doc = createDocument(
      '<svg><circle id="ball" style="fill: purple"/></svg>',
      '#ball { fill: red; }',
    );
    expect(writeStyleDeclaration(doc, '0/0', 'fill', 'green')).toEqual({
      ok: false,
      reason: 'not-editable',
    });
  });

  it('fails cleanly on dangling refs and unparsable styles', () => {
    expect(writeStyleDeclaration(sampleDocument(), '0/9', 'fill', 'red')).toEqual({
      ok: false,
      reason: 'element-not-found',
    });
    const broken = createDocument('<svg><circle id="ball"/></svg>', '#ball {');
    expect(writeStyleDeclaration(broken, '0/0', 'fill', 'red')).toEqual({
      ok: false,
      reason: 'styles-unparsable',
    });
  });
});

describe('writeMarkupAttribute', () => {
  it('writes the attribute into the markup buffer only', () => {
    const doc = sampleDocument();
    const result = writeMarkupAttribute(doc, '0/0/1', 'cx', '321');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.styles).toBe(doc.styles);
    expect(result.document.markup).toBe(doc.markup.replace('cx="200"', 'cx="321"'));
  });

  it('fails cleanly when the element or its source tag cannot be found', () => {
    expect(writeMarkupAttribute(sampleDocument(), '0/9', 'cx', '1')).toEqual({
      ok: false,
      reason: 'element-not-found',
    });
    // Parser-invented <tbody> breaks source correspondence.
    const doc = createDocument('<table><tr><td>x</td></tr></table>', '');
    expect(writeMarkupAttribute(doc, '0', 'border', '1')).toEqual({
      ok: false,
      reason: 'markup-write-failed',
    });
  });
});
