/**
 * Frame import pipeline (Phase 9.1). A `Frame` is an imported SVG representing
 * one state of the artwork for the SVG-keyframes feature (docs/svg-interpolation.md).
 *
 * Pure, jsdom-testable: text in, parsed `Frame` (or an error) out. Reading the
 * actual File objects is the only impure edge (`importSvgFiles`), kept thin.
 * Frames are workspace state for the interpolation epic, not the document
 * buffers — Phase 12 persistence will fold them into `Document.meta`.
 */
import { parseMarkup } from './markup';
import type { ElementNode } from './markup';

export interface Frame {
  /** Stable id for this frame within the import workspace. */
  id: string;
  /** Display label, typically the source filename (e.g. "01-start.svg"). */
  label: string;
  /** Original SVG source, kept verbatim. */
  markup: string;
  /** Parsed element tree (`<defs>` excluded, same projection as the Elements panel). */
  tree: ElementNode[];
}

export type FrameImportResult =
  | { ok: true; frame: Frame }
  | { ok: false; label: string; error: string };

let frameCounter = 0;

/** Generate a fresh, unique frame id. Impure (counter + randomness) by design. */
export function newFrameId(): string {
  frameCounter += 1;
  return `frame-${frameCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validate and parse one SVG source into a `Frame`. The caller supplies the id
 * (so this stays deterministic and testable). Surfaces, rather than swallows,
 * the ways a file can fail to be a usable SVG.
 */
export function parseSvgToFrame(id: string, label: string, source: string): FrameImportResult {
  if (source.trim() === '') {
    return { ok: false, label, error: 'File is empty.' };
  }

  // Parse as XML to detect malformed markup; text/html (used by parseMarkup) is
  // too lenient to report errors, so we check validity here first.
  const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (xml.querySelector('parsererror')) {
    return { ok: false, label, error: 'Not a valid SVG file (XML parse error).' };
  }

  const rootTag = xml.documentElement?.tagName.toLowerCase();
  if (rootTag !== 'svg') {
    return {
      ok: false,
      label,
      error: `Not an SVG: root element is <${rootTag ?? '?'}>, expected <svg>.`,
    };
  }

  const tree = parseMarkup(source);
  return { ok: true, frame: { id, label, markup: source, tree } };
}

/** Read and parse a batch of dropped/picked files into frames (id assigned per file). */
export async function importSvgFiles(files: File[]): Promise<FrameImportResult[]> {
  return Promise.all(
    files.map(async (file) => parseSvgToFrame(newFrameId(), file.name, await readText(file))),
  );
}

/** Read a file as text, falling back to FileReader where `Blob.text` is absent (older jsdom). */
function readText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
