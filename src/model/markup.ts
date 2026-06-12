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
