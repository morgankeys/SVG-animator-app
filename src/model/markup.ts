/**
 * Markup parsing: project the markup buffer into an element tree (docs/architecture.md).
 * Pure DOM parsing — no React, runs under jsdom in tests.
 */

/**
 * Stable reference to an element in the markup: element-child indices from the
 * root, joined with "/" (e.g. "0/1" = second element child of the first root).
 * Indices count ALL element children in the real DOM — including `<defs>`, which
 * the projected tree omits — so a ref resolves identically against the parsed
 * buffer and the live sandbox DOM, and survives re-parses.
 */
export type ElementRef = string;

export interface ElementNode {
  ref: ElementRef;
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  children: ElementNode[];
}

/**
 * Parse the markup buffer into element trees, one per top-level element.
 * `<defs>` subtrees are excluded from the projection (docs/vision.md scope).
 */
export function parseMarkup(markup: string): ElementNode[] {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  return projectChildren(doc.body, []);
}

function projectChildren(parent: Element, parentPath: number[]): ElementNode[] {
  const nodes: ElementNode[] = [];
  Array.from(parent.children).forEach((child, index) => {
    if (child.tagName.toLowerCase() === 'defs') return; // excluded, but still occupies its index
    nodes.push(projectElement(child, [...parentPath, index]));
  });
  return nodes;
}

function projectElement(element: Element, path: number[]): ElementNode {
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    attributes[attr.name] = attr.value;
  }
  return {
    ref: path.join('/'),
    tag: element.tagName.toLowerCase(),
    id: element.id || undefined,
    classes: Array.from(element.classList),
    attributes,
    children: projectChildren(element, path),
  };
}

/** Inverse of resolveRef: compute the ref of a live element under `root`. */
export function elementToRef(root: ParentNode, element: Element): ElementRef | null {
  const path: number[] = [];
  let node: Element = element;
  while (node !== root) {
    const parent = node.parentNode;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.children, node);
    if (index < 0) return null;
    path.unshift(index);
    if (parent === root) return path.join('/');
    // nodeType, not instanceof: iframe nodes belong to another realm's classes.
    if (parent.nodeType !== Node.ELEMENT_NODE) return null;
    node = parent as Element;
  }
  return null; // the root itself has no ref
}

export function refToPath(ref: ElementRef): number[] {
  return ref === '' ? [] : ref.split('/').map(Number);
}

/**
 * Resolve a ref against any DOM root whose element children mirror the markup
 * buffer's top level (the parsed document body, or the sandbox iframe body).
 */
export function resolveRef(root: ParentNode, ref: ElementRef): Element | null {
  let current: ParentNode = root;
  for (const index of refToPath(ref)) {
    const child = (current as Element | Document | DocumentFragment).children[index];
    if (!child) return null;
    current = child;
  }
  return current === root ? null : (current as Element);
}

/*
 * Markup mutation (write path, docs/architecture.md): attribute edits splice
 * only the element's start-tag text in the buffer — re-serializing the DOM
 * would normalize quoting/self-closing syntax wholesale (invariant 3). The
 * element's tag is located by pre-order correspondence between the parsed DOM
 * and the source's start tags; when that correspondence can't be established
 * (parser-invented elements, untokenizable buffer) we return null and the
 * caller surfaces a warning instead of corrupting the buffer.
 */

interface StartTag {
  name: string;
  start: number; // index of '<'
  end: number; // index just past '>'
}

/** Elements the HTML parser treats as raw text — their content may contain '<'. */
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'xmp']);

/** Source-order start tags, or null when the buffer can't be tokenized. */
function scanStartTags(markup: string): StartTag[] | null {
  const tags: StartTag[] = [];
  let i = 0;
  while (i < markup.length) {
    const lt = markup.indexOf('<', i);
    if (lt < 0) break;
    if (markup.startsWith('<!--', lt)) {
      const close = markup.indexOf('-->', lt + 4);
      if (close < 0) return null;
      i = close + 3;
    } else if (
      markup.startsWith('</', lt) ||
      markup.startsWith('<!', lt) ||
      markup.startsWith('<?', lt)
    ) {
      const close = markup.indexOf('>', lt);
      if (close < 0) return null;
      i = close + 1;
    } else if (/[a-zA-Z]/.test(markup[lt + 1] ?? '')) {
      const tag = readStartTag(markup, lt);
      if (!tag) return null;
      tags.push(tag);
      i = tag.end;
      if (RAW_TEXT_TAGS.has(tag.name.toLowerCase())) {
        const close = markup.toLowerCase().indexOf(`</${tag.name.toLowerCase()}`, tag.end);
        if (close < 0) return null;
        i = close;
      }
    } else {
      i = lt + 1; // stray '<' in text
    }
  }
  return tags;
}

function readStartTag(markup: string, start: number): StartTag | null {
  let j = start + 1;
  while (j < markup.length && !/[\s/>]/.test(markup[j])) j++;
  const name = markup.slice(start + 1, j);
  while (j < markup.length) {
    const c = markup[j];
    if (c === '"' || c === "'") {
      const close = markup.indexOf(c, j + 1);
      if (close < 0) return null;
      j = close + 1;
    } else if (c === '>') {
      return { name, start, end: j + 1 };
    } else {
      j++;
    }
  }
  return null;
}

/**
 * The source start tag for `element`, by pre-order position. The whole tag
 * list is verified against the DOM so a single parser quirk can't silently
 * shift the correspondence onto the wrong tag.
 */
function correspondingTag(markup: string, body: Element, element: Element): StartTag | null {
  const all = Array.from(body.querySelectorAll('*'));
  const index = all.indexOf(element);
  if (index < 0) return null;
  const tags = scanStartTags(markup);
  if (!tags || tags.length !== all.length) return null;
  for (let k = 0; k < tags.length; k++) {
    if (tags[k].name.toLowerCase() !== all[k].tagName.toLowerCase()) return null;
  }
  return tags[index];
}

/**
 * Set an attribute on the referenced element. Only the element's start tag is
 * spliced; every other byte of the buffer round-trips exactly. Returns null
 * when the element's source tag can't be located unambiguously.
 */
export function setMarkupAttribute(
  markup: string,
  ref: ElementRef,
  name: string,
  value: string,
): string | null {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  const element = resolveRef(doc.body, ref);
  if (!element) return null;
  const tag = correspondingTag(markup, doc.body, element);
  if (!tag) return null;
  const updated = spliceAttribute(markup.slice(tag.start, tag.end), tag.name.length, name, value);
  if (updated === null) return null;
  return markup.slice(0, tag.start) + updated + markup.slice(tag.end);
}

/** Rewrite (or append) one attribute inside a start-tag's text. */
function spliceAttribute(
  tagText: string,
  tagNameLength: number,
  attr: string,
  value: string,
): string | null {
  const wanted = attr.toLowerCase();
  let j = 1 + tagNameLength;
  while (j < tagText.length) {
    while (j < tagText.length && /\s/.test(tagText[j])) j++;
    if (j >= tagText.length || tagText[j] === '>' || tagText[j] === '/') break;
    const nameStart = j;
    while (j < tagText.length && !/[\s=/>]/.test(tagText[j])) j++;
    const nameEnd = j;
    while (j < tagText.length && /\s/.test(tagText[j])) j++;
    let valueStart = -1;
    let valueEnd = -1;
    let quote = '';
    if (tagText[j] === '=') {
      j++;
      while (j < tagText.length && /\s/.test(tagText[j])) j++;
      const c = tagText[j];
      if (c === '"' || c === "'") {
        quote = c;
        valueStart = j + 1;
        valueEnd = tagText.indexOf(c, valueStart);
        if (valueEnd < 0) return null;
        j = valueEnd + 1;
      } else {
        valueStart = j;
        while (j < tagText.length && !/[\s>]/.test(tagText[j])) j++;
        valueEnd = j;
      }
    }
    if (tagText.slice(nameStart, nameEnd).toLowerCase() === wanted) {
      if (quote) {
        return (
          tagText.slice(0, valueStart) + escapeAttrValue(value, quote) + tagText.slice(valueEnd)
        );
      }
      // Unquoted or bare attribute: rewrite the whole attribute, quoted.
      const nameText = tagText.slice(nameStart, nameEnd);
      const afterEnd = valueStart >= 0 ? valueEnd : nameEnd;
      return (
        tagText.slice(0, nameStart) +
        `${nameText}="${escapeAttrValue(value, '"')}"` +
        tagText.slice(afterEnd)
      );
    }
  }
  // Not present: insert before the trailing `/>` or `>`, keeping its spacing.
  const tail = /\s*\/?>$/.exec(tagText);
  if (!tail) return null;
  return (
    tagText.slice(0, tail.index) + ` ${attr}="${escapeAttrValue(value, '"')}"` + tagText.slice(tail.index)
  );
}

function escapeAttrValue(value: string, quote: string): string {
  const amp = value.replace(/&/g, '&amp;');
  return quote === "'" ? amp.replace(/'/g, '&#39;') : amp.replace(/"/g, '&quot;');
}

/**
 * Guarantee the referenced element has an id (the styles write path needs one
 * for a stable `#id` write-target selector, docs/css-engine.md). Generates a
 * tag-based id unique in the document and writes it to the markup buffer.
 */
export function ensureElementId(
  markup: string,
  ref: ElementRef,
): { markup: string; id: string } | null {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  const element = resolveRef(doc.body, ref);
  if (!element) return null;
  if (element.id) return { markup, id: element.id };
  const base = element.tagName.toLowerCase();
  let id = base;
  for (let n = 2; doc.getElementById(id); n++) id = `${base}-${n}`;
  const next = setMarkupAttribute(markup, ref, 'id', id);
  return next === null ? null : { markup: next, id };
}
