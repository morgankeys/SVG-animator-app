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
      <div className="panel-body timeline-body">
        <div className="timeline-rows">
          {rows.map((row) => (
            <TimelineTrack key={row.rowId} row={row} totalMs={totalMs} />
          ))}
        </div>
        <div
          className="timeline-playhead"
          style={{
            left: `calc(${LABEL_WIDTH + TRACK_MARGIN}px + ${playheadMs / totalMs} * (100% - ${
              LABEL_WIDTH + TRACK_MARGIN * 2
            }px))`,
          }}
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
