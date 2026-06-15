import { useFramesStore } from '../../state/framesStore';
import type { Frame } from '../../model/frames';
import { FrameTree } from './FrameTree';

/**
 * Side-by-side viewer for imported frames (Phase 9.2): each frame shows a
 * rendered thumbnail and its read-only element tree, with controls to set the
 * frame order (← →) and remove. Order here is the timeline order the
 * interpolation epic (Phase 10) will turn into keyframe percentages.
 *
 * Thumbnails render the SVG via an <img> data URL — a clean style/script
 * boundary, so a frame's CSS can't leak into the app chrome.
 */
export function FramesView() {
  const frames = useFramesStore((s) => s.frames);

  if (frames.length === 0) {
    return (
      <div className="placeholder frames-view-empty">
        No frames imported. Use the Frames panel (bottom-left) to import SVGs.
      </div>
    );
  }

  return (
    <div className="frames-view">
      {frames.map((frame, index) => (
        <FrameCard
          key={frame.id}
          frame={frame}
          index={index}
          count={frames.length}
        />
      ))}
    </div>
  );
}

function FrameCard({ frame, index, count }: { frame: Frame; index: number; count: number }) {
  const moveFrame = useFramesStore((s) => s.moveFrame);
  const removeFrame = useFramesStore((s) => s.removeFrame);

  return (
    <section className="frame-card">
      <header className="frame-card-header">
        <span className="frame-card-index">{index + 1}</span>
        <span className="frame-card-label" title={frame.label}>
          {frame.label}
        </span>
        <span className="tree-actions">
          <button
            type="button"
            className="tree-action"
            aria-label={`Move ${frame.label} earlier`}
            disabled={index === 0}
            onClick={() => moveFrame(frame.id, 'left')}
          >
            ←
          </button>
          <button
            type="button"
            className="tree-action"
            aria-label={`Move ${frame.label} later`}
            disabled={index === count - 1}
            onClick={() => moveFrame(frame.id, 'right')}
          >
            →
          </button>
          <button
            type="button"
            className="tree-action"
            aria-label={`Remove ${frame.label}`}
            onClick={() => removeFrame(frame.id)}
          >
            ✕
          </button>
        </span>
      </header>
      <div className="frame-card-thumb">
        <img src={toDataUrl(frame.markup)} alt={`Preview of ${frame.label}`} />
      </div>
      <div className="frame-card-tree">
        <FrameTree tree={frame.tree} />
      </div>
    </section>
  );
}

function toDataUrl(markup: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}
