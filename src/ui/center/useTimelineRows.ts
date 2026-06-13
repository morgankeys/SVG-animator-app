import { useMemo } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import { parseStyles } from '../../model/styles';
import { buildTimelineRows } from '../../model/animation';
import type { TimelineRow } from '../../model/animation';

/**
 * Timeline rows are a pure projection of the buffers (docs/architecture.md), so
 * both the Timeline strip and the right-panel keyframe linking derive them from
 * here. A styles parse error yields no rows rather than throwing.
 */
export function useTimelineRows(): TimelineRow[] {
  const markup = useDocumentStore((s) => s.markup);
  const styles = useDocumentStore((s) => s.styles);
  return useMemo(() => {
    try {
      const body = new DOMParser().parseFromString(markup, 'text/html').body;
      return buildTimelineRows(parseStyles(styles), body);
    } catch {
      return [];
    }
  }, [markup, styles]);
}

/** Common timeline span: the longest single iteration (delay + duration), min 1ms. */
export function timelineDurationMs(rows: TimelineRow[]): number {
  return Math.max(1, ...rows.map((r) => r.delayMs + r.durationMs));
}
