/**
 * Shape templates for direct creation (Phase 5.1). Each kind maps to the
 * element's serialized markup; insertion (model/markup.ts) splices that text
 * into the buffer. Defaults are modest, visible shapes the user then positions
 * and styles through the Rules panel — markup stays the source of truth.
 */

export const SHAPE_KINDS = [
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'text',
  'group',
] as const;

export type ShapeKind = (typeof SHAPE_KINDS)[number];

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  circle: 'Circle',
  ellipse: 'Ellipse',
  line: 'Line',
  polyline: 'Polyline',
  polygon: 'Polygon',
  path: 'Path',
  text: 'Text',
  group: 'Group',
};

const TEMPLATES: Record<ShapeKind, string> = {
  rect: '<rect x="20" y="20" width="100" height="60" fill="#888888" />',
  circle: '<circle cx="60" cy="60" r="40" fill="#888888" />',
  ellipse: '<ellipse cx="80" cy="60" rx="60" ry="40" fill="#888888" />',
  line: '<line x1="20" y1="20" x2="120" y2="100" stroke="#888888" stroke-width="2" />',
  polyline:
    '<polyline points="20,20 60,80 100,20 140,80" fill="none" stroke="#888888" stroke-width="2" />',
  polygon: '<polygon points="60,20 100,100 20,100" fill="#888888" />',
  path: '<path d="M20 20 L120 20 L70 100 Z" fill="#888888" />',
  text: '<text x="20" y="44" font-size="24" fill="#888888">Text</text>',
  group: '<g></g>',
};

/** The serialized markup for a new shape of `kind`. */
export function createShapeMarkup(kind: ShapeKind): string {
  return TEMPLATES[kind];
}
