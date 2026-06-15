import { useFramesStore } from '../../state/framesStore';
import { useInterpolationStore } from '../../state/interpolationStore';
import type { Frame } from '../../model/frames';
import { findCorrespondence } from '../../model/mapping';
import { FrameTree } from './FrameTree';
import type { NodeDecoration } from './FrameTree';
import { CorrespondenceList } from './CorrespondenceList';

/**
 * Side-by-side frame viewer + correspondence mapping surface (Phases 9.2, 10.2):
 * each frame shows a rendered thumbnail and its element tree, with frame-order
 * (← →) and remove controls. Once "Auto-match" runs, the trees become the
 * manual mapping surface — rows carry a correspondence color/id, flag unmatched
 * nodes, and click to pick for linking; a list below edits the correspondences.
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
    <div className="frames-mapping">
      <MappingToolbar frames={frames} />
      <div className="frames-view">
        {frames.map((frame, index) => (
          <FrameCard key={frame.id} frame={frame} index={index} count={frames.length} />
        ))}
      </div>
      <CorrespondenceList frames={frames} />
    </div>
  );
}

function MappingToolbar({ frames }: { frames: Frame[] }) {
  const runAutoMatch = useInterpolationStore((s) => s.runAutoMatch);
  const reset = useInterpolationStore((s) => s.reset);
  const linkPicks = useInterpolationStore((s) => s.linkPicks);
  const clearPicks = useInterpolationStore((s) => s.clearPicks);
  const generate = useInterpolationStore((s) => s.generate);
  const matched = useInterpolationStore((s) => s.matched);
  const pickCount = useInterpolationStore((s) => Object.keys(s.picks).length);
  const warnings = useInterpolationStore((s) => s.warnings);
  const generated = useInterpolationStore((s) => s.generated);

  return (
    <div className="mapping-toolbar-wrap">
      <div className="mapping-toolbar">
        <button type="button" className="mapping-btn primary" onClick={() => runAutoMatch(frames)}>
          {matched ? 'Re-run auto-match' : 'Auto-match'}
        </button>
        {matched && (
          <>
            <button
              type="button"
              className="mapping-btn"
              disabled={pickCount < 2}
              onClick={() => linkPicks()}
            >
              Link selected ({pickCount})
            </button>
            <button
              type="button"
              className="mapping-btn"
              disabled={pickCount === 0}
              onClick={() => clearPicks()}
            >
              Clear picks
            </button>
            <button type="button" className="mapping-btn" onClick={() => reset()}>
              Clear mapping
            </button>
            <button
              type="button"
              className="mapping-btn primary"
              disabled={frames.length < 2}
              onClick={() => generate(frames)}
              title="Generate unified markup + @keyframes and load it into the editor"
            >
              Generate animation →
            </button>
            <span className="mapping-hint">
              Pick one node per frame, then Link to map them together.
            </span>
          </>
        )}
      </div>
      {generated && warnings.length > 0 && (
        <ul className="mapping-warnings" aria-label="Generation warnings">
          {warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
      {generated && warnings.length === 0 && (
        <p className="mapping-ok">✓ Generated — loaded into the editor (Preview/Timeline).</p>
      )}
    </div>
  );
}

function FrameCard({ frame, index, count }: { frame: Frame; index: number; count: number }) {
  const moveFrame = useFramesStore((s) => s.moveFrame);
  const removeFrame = useFramesStore((s) => s.removeFrame);
  const correspondences = useInterpolationStore((s) => s.correspondences);
  const pickRef = useInterpolationStore((s) => s.picks[frame.id]);
  const togglePick = useInterpolationStore((s) => s.togglePick);
  const unlink = useInterpolationStore((s) => s.unlink);
  const matched = useInterpolationStore((s) => s.matched);

  const decorate = matched
    ? (ref: string): NodeDecoration | undefined => {
        const corr = findCorrespondence(correspondences, frame.id, ref);
        if (!corr) return undefined;
        return {
          corrId: corr.id,
          status: corr.status,
          picked: pickRef === ref,
          linked: Object.keys(corr.members).length > 1,
        };
      }
    : undefined;

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
        <FrameTree
          tree={frame.tree}
          decorate={decorate}
          onPick={matched ? (ref) => togglePick(frame.id, ref) : undefined}
          onUnlink={matched ? (corrId) => unlink(corrId, frame.id) : undefined}
        />
      </div>
    </section>
  );
}

function toDataUrl(markup: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}
