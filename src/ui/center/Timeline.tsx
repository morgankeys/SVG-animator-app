import { useSelectionStore } from '../../state/selectionStore';
import { useTimelineRows, timelineDurationMs } from './useTimelineRows';
import type { TimelineRow } from '../../model/animation';

/**
 * Timeline strip (docs/ui-spec.md): one row per applied CSS `animation`, with
 * stops at the `@keyframes` percentages — no per-property hierarchy. Rows and
 * stops are pure projections of the buffers (useTimelineRows). Selecting a row
 * or stop drives shared selection; playback/scrub arrive in 6.3, keyframe
 * linking in 6.4.
 */
export function Timeline() {
  const rows = useTimelineRows();

  return (
    <section className="timeline panel">
      <header className="panel-header">Timeline</header>
      {rows.length === 0 ? (
        <div className="panel-body placeholder">No animations yet</div>
      ) : (
        <div className="panel-body timeline-body">
          <div className="timeline-rows">
            {rows.map((row) => (
              <TimelineTrack key={row.rowId} row={row} totalMs={timelineDurationMs(rows)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TimelineTrack({ row, totalMs }: { row: TimelineRow; totalMs: number }) {
  const selection = useSelectionStore((s) => s.timeline);
  const selectTimeline = useSelectionStore((s) => s.selectTimeline);
  const selectElement = useSelectionStore((s) => s.selectElement);
  const rowSelected = selection?.rowId === row.rowId;

  const selectRow = () => {
    selectTimeline({ rowId: row.rowId, stopIndex: null });
    selectElement(row.elementRef);
  };
  const selectStop = (stopIndex: number) => {
    selectTimeline({ rowId: row.rowId, stopIndex });
    selectElement(row.elementRef);
  };

  // Position the active span within the common timeline; stops sit along it.
  const left = `${(row.delayMs / totalMs) * 100}%`;
  const width = `${Math.max((row.durationMs / totalMs) * 100, 0.5)}%`;

  return (
    <div className={`timeline-row${rowSelected ? ' selected' : ''}`}>
      <button
        type="button"
        className="timeline-row-label"
        onClick={selectRow}
        title={`${row.label} on ${row.elementRef}`}
      >
        <span className="timeline-row-name">{row.label}</span>
        <span className="timeline-row-meta">{formatDuration(row)}</span>
      </button>
      <div className="timeline-track-area" onClick={selectRow}>
        <div className="timeline-track" style={{ left, width }}>
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

function formatDuration(row: TimelineRow): string {
  const seconds = row.durationMs / 1000;
  const duration = Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(2)}s`;
  const repeat = row.iterations === Infinity ? ' ∞' : row.iterations !== 1 ? ` ×${row.iterations}` : '';
  return `${duration}${repeat}`;
}
