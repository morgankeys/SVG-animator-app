import { useCallback, useRef } from 'react';
import { useSelectionStore } from '../../state/selectionStore';
import { useUiStore } from '../../state/uiStore';
import { useTimelineRows, timelineDurationMs } from './useTimelineRows';
import { usePlayback } from './usePlayback';
import type { TimelineRow } from '../../model/animation';

const LABEL_WIDTH = 132;
const TRACK_MARGIN = 12; // matches .timeline-track-area horizontal margin in app.css

/**
 * Timeline strip (docs/ui-spec.md): one row per applied CSS `animation`, with
 * stops at the `@keyframes` percentages — no per-property hierarchy. Rows and
 * stops are pure projections of the buffers (useTimelineRows). Play/scrub drive
 * the rendered animation via the Web Animations API (usePlayback). Selecting a
 * row or stop drives shared selection and reveals the linked `@keyframes` in
 * the right panel (6.4).
 */
export function Timeline() {
  const rows = useTimelineRows();
  const totalMs = timelineDurationMs(rows);
  const { playing, playheadMs, play, pause, scrub } = usePlayback(totalMs);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Map a pointer x onto the track region (the same span the playhead is laid
  // out across: body width minus the label column and the track's side margins).
  const scrubToClientX = useCallback(
    (clientX: number) => {
      const body = bodyRef.current;
      if (!body) return;
      const rect = body.getBoundingClientRect();
      const trackLeft = rect.left + LABEL_WIDTH + TRACK_MARGIN;
      const trackWidth = rect.width - (LABEL_WIDTH + TRACK_MARGIN * 2);
      if (trackWidth <= 0) return;
      const fraction = Math.min(1, Math.max(0, (clientX - trackLeft) / trackWidth));
      scrub(fraction * totalMs);
    },
    [scrub, totalMs],
  );

  // Drag the playhead: capture the pointer so the drag survives leaving the line.
  const onPlayheadPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scrubToClientX(e.clientX);
  };
  const onPlayheadPointerMove = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) scrubToClientX(e.clientX);
  };
  const onPlayheadKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? totalMs / 10 : Math.max(10, totalMs / 100);
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrub(Math.max(0, playheadMs - step));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrub(Math.min(totalMs, playheadMs + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      scrub(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      scrub(totalMs);
    }
  };

  if (rows.length === 0) {
    return (
      <section className="timeline panel">
        <header className="panel-header">Timeline</header>
        <div className="panel-body placeholder">No animations or transitions yet</div>
      </section>
    );
  }

  return (
    <section className="timeline panel">
      <header className="panel-header timeline-header">
        <span>Timeline</span>
        <div className="timeline-transport">
          <button
            type="button"
            className="timeline-play"
            aria-label={playing ? 'Pause' : 'Play'}
            aria-pressed={playing}
            onClick={() => (playing ? pause() : play())}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            className="timeline-scrub"
            type="range"
            min={0}
            max={Math.round(totalMs)}
            step={10}
            value={Math.round(playheadMs)}
            aria-label="Scrub timeline"
            onChange={(e) => scrub(Number(e.target.value))}
          />
          <span className="timeline-time">
            {formatSeconds(playheadMs)} / {formatSeconds(totalMs)}
          </span>
        </div>
      </header>
      <div className="panel-body timeline-body" ref={bodyRef}>
        <div className="timeline-rows">
          {rows.map((row) => (
            <TimelineTrack key={row.rowId} row={row} totalMs={totalMs} />
          ))}
        </div>
        <div
          className="timeline-playhead"
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalMs)}
          aria-valuenow={Math.round(playheadMs)}
          aria-valuetext={formatSeconds(playheadMs)}
          style={{
            left: `calc(${LABEL_WIDTH + TRACK_MARGIN}px + ${playheadMs / totalMs} * (100% - ${
              LABEL_WIDTH + TRACK_MARGIN * 2
            }px))`,
          }}
          onPointerDown={onPlayheadPointerDown}
          onPointerMove={onPlayheadPointerMove}
          onKeyDown={onPlayheadKeyDown}
        />
      </div>
    </section>
  );
}

function TimelineTrack({ row, totalMs }: { row: TimelineRow; totalMs: number }) {
  const selection = useSelectionStore((s) => s.timeline);
  const selectTimeline = useSelectionStore((s) => s.selectTimeline);
  const selectElement = useSelectionStore((s) => s.selectElement);
  const setRightTab = useUiStore((s) => s.setRightTab);
  const rowSelected = selection?.rowId === row.rowId;

  // Selecting a row/stop reveals the linked @keyframes in the right panel (6.4).
  const selectRow = () => {
    selectTimeline({ rowId: row.rowId, stopIndex: null });
    selectElement(row.elementRef);
    setRightTab('code');
  };
  const selectStop = (stopIndex: number) => {
    selectTimeline({ rowId: row.rowId, stopIndex });
    selectElement(row.elementRef);
    setRightTab('code');
  };

  // Position the active span within the common timeline; stops sit along it.
  const left = `${(row.delayMs / totalMs) * 100}%`;
  const width = `${Math.max((row.durationMs / totalMs) * 100, 0.5)}%`;

  return (
    <div className={`timeline-row timeline-row--${row.kind}${rowSelected ? ' selected' : ''}`}>
      <button
        type="button"
        className="timeline-row-label"
        onClick={selectRow}
        title={`${row.kind} ${row.label} on ${row.elementRef}`}
      >
        <span className="timeline-row-name">{row.label}</span>
        <span className="timeline-row-meta">{formatDuration(row)}</span>
      </button>
      <div className="timeline-track-area" onClick={selectRow}>
        <div className={`timeline-track timeline-track--${row.kind}`} style={{ left, width }}>
          {row.stops.map((stop, index) => (
            <button
              key={`${index}-${stop.atPercent}`}
              type="button"
              className={`timeline-stop${
                rowSelected && selection?.stopIndex === index ? ' selected' : ''
              }`}
              style={{ left: `${stop.atPercent}%` }}
              title={`${stop.atPercent}%`}
              aria-label={`${row.label} keyframe ${stop.atPercent}%`}
              onClick={(e) => {
                e.stopPropagation();
                selectStop(index);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDuration(row: TimelineRow): string {
  const seconds = row.durationMs / 1000;
  const duration = Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(2)}s`;
  const repeat = row.iterations === Infinity ? ' ∞' : row.iterations !== 1 ? ` ×${row.iterations}` : '';
  return `${duration}${repeat}`;
}
