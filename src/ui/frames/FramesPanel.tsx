import { useRef, useState } from 'react';
import { useFramesStore } from '../../state/framesStore';
import { importSvgFiles } from '../../model/frames';
import type { FrameImportResult } from '../../model/frames';

/**
 * Frame import surface (Phase 9.1): file picker (File System Access API with a
 * hidden `<input>` fallback) + drag-drop, feeding parsed frames into the frames
 * store. Failed files are surfaced honestly rather than dropped silently. The
 * side-by-side viewer with element trees is Phase 9.2 — this stays a compact
 * list of what's been imported.
 */
export function FramesPanel() {
  const frames = useFramesStore((s) => s.frames);
  const addFrames = useFramesStore((s) => s.addFrames);
  const removeFrame = useFramesStore((s) => s.removeFrame);
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ label: string; error: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const ingest = async (files: File[]) => {
    if (files.length === 0) return;
    const results = await importSvgFiles(files);
    addFrames(results.flatMap((r) => (r.ok ? [r.frame] : [])));
    setErrors(failures(results));
  };

  const handlePick = async () => {
    // File System Access API where available; otherwise the hidden input.
    const picker = (window as WindowWithFilePicker).showOpenFilePicker;
    if (!picker) {
      inputRef.current?.click();
      return;
    }
    try {
      const handles = await picker({
        multiple: true,
        types: [{ description: 'SVG files', accept: { 'image/svg+xml': ['.svg'] } }],
      });
      await ingest(await Promise.all(handles.map((h) => h.getFile())));
    } catch {
      // The user dismissed the picker — nothing to import.
    }
  };

  return (
    <section className="panel frames-panel">
      <header className="panel-header panel-header-row">
        <span>Frames</span>
        <button type="button" className="add-button" aria-label="Import SVGs" onClick={handlePick}>
          +
        </button>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept=".svg,image/svg+xml"
        multiple
        hidden
        onChange={(e) => {
          void ingest(Array.from(e.target.files ?? []));
          e.target.value = ''; // allow re-picking the same file
        }}
      />

      <div
        className={`panel-body frames-dropzone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void ingest(Array.from(e.dataTransfer.files));
        }}
      >
        {frames.length === 0 && errors.length === 0 ? (
          <p className="frames-empty">Drop SVG files here or use + to import.</p>
        ) : (
          <ul className="frames-list">
            {frames.map((frame) => (
              <li key={frame.id} className="frames-item">
                <span className="frames-label">{frame.label}</span>
                <button
                  type="button"
                  className="tree-action"
                  aria-label={`Remove ${frame.label}`}
                  onClick={() => removeFrame(frame.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {errors.map((e, i) => (
          <div key={i} className="rules-warning" role="alert">
            {e.label}: {e.error}
          </div>
        ))}
      </div>
    </section>
  );
}

function failures(results: FrameImportResult[]): { label: string; error: string }[] {
  return results.flatMap((r) => (r.ok ? [] : [{ label: r.label, error: r.error }]));
}

/** File System Access API surface we rely on; absent in unsupported browsers. */
interface WindowWithFilePicker extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<{ getFile: () => Promise<File> }[]>;
}
