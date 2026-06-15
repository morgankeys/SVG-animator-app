import { useState } from 'react';
import { useInterpolationStore } from '../../state/interpolationStore';
import type { Frame } from '../../model/frames';
import type { Correspondence } from '../../model/match';
import { correspondenceColor } from './correspondenceColor';

/**
 * Editable list of mapped correspondences (Phase 10.2). Each row shows the
 * correspondence color/id, which frames it spans, and its status — and lets the
 * user rename the canonical id, acknowledge a frame-specific element
 * (appears/disappears), or unlink a member. Reads/writes the interpolation store.
 */
export function CorrespondenceList({ frames }: { frames: Frame[] }) {
  const correspondences = useInterpolationStore((s) => s.correspondences);
  const matched = useInterpolationStore((s) => s.matched);

  if (!matched) return null;

  const unmatched = correspondences.filter((c) => c.status === 'unmatched').length;

  return (
    <div className="corr-list">
      <header className="corr-list-header">
        <span>Correspondences ({correspondences.length})</span>
        {unmatched > 0 && <span className="corr-warn">⚠ {unmatched} unmatched</span>}
      </header>
      <div className="corr-list-rows">
        {correspondences.map((corr) => (
          <CorrespondenceRow key={corr.id} corr={corr} frames={frames} />
        ))}
      </div>
    </div>
  );
}

function CorrespondenceRow({ corr, frames }: { corr: Correspondence; frames: Frame[] }) {
  const rename = useInterpolationStore((s) => s.rename);
  const unlink = useInterpolationStore((s) => s.unlink);
  const setStatus = useInterpolationStore((s) => s.setStatus);
  const [draft, setDraft] = useState(corr.id);

  const memberCount = Object.keys(corr.members).length;
  const complete = memberCount === frames.length;
  const isFrameSpecific = corr.status === 'frame-specific';

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== corr.id) rename(corr.id, next);
    else setDraft(corr.id);
  };

  return (
    <div className={`corr-row status-${corr.status}`}>
      <span className="corr-dot" style={{ background: correspondenceColor(corr.id) }} />
      <input
        className="corr-id-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(corr.id);
        }}
        aria-label={`Canonical id for ${corr.id}`}
      />
      <span className="corr-frames">
        {frames.map((f, i) => {
          const ref = corr.members[f.id];
          return (
            <span
              key={f.id}
              className={`corr-frame-dot${ref !== undefined ? ' present' : ''}`}
              title={
                ref !== undefined
                  ? `Frame ${i + 1} (${f.label}): ${ref}`
                  : `Not present in frame ${i + 1}`
              }
            >
              {ref !== undefined ? i + 1 : '·'}
            </span>
          );
        })}
      </span>
      <span className={`corr-status-badge status-${corr.status}`}>{corr.status}</span>
      {!complete && (
        <button
          type="button"
          className="mapping-btn small"
          onClick={() => setStatus(corr.id, isFrameSpecific ? 'unmatched' : 'frame-specific')}
          title="Element intentionally appears/disappears (animate opacity)"
        >
          {isFrameSpecific ? '✓ frame-specific' : 'mark frame-specific'}
        </button>
      )}
      {memberCount > 1 && (
        <span className="corr-unlink-group">
          {frames.map((f, i) =>
            corr.members[f.id] !== undefined ? (
              <button
                key={f.id}
                type="button"
                className="tree-action"
                aria-label={`Unlink frame ${i + 1} from ${corr.id}`}
                title={`Unlink frame ${i + 1}`}
                onClick={() => unlink(corr.id, f.id)}
              >
                ⊘{i + 1}
              </button>
            ) : null,
          )}
        </span>
      )}
    </div>
  );
}
