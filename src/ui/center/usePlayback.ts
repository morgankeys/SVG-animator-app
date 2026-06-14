import { useCallback, useEffect, useRef } from 'react';
import { useUiStore } from '../../state/uiStore';
import { getSandboxAnimations } from '../../sandbox/registry';

/**
 * Timeline transport (docs/css-engine.md, 6.3): one owned playhead drives every
 * live Web Animation by pausing it and setting `currentTime`, so the rendered
 * frame always matches the playhead — scrubbing and playback share one path.
 *
 * On play we advance the playhead with requestAnimationFrame, looping at
 * `totalMs`; animations are re-fetched each frame so a mid-play frame reload is
 * picked up. While we're NOT playing the animation runs freely (browser-driven,
 * e.g. on load), and we let the playhead *follow* it — reading `currentTime`
 * each frame — so the timeline mirrors what's on screen and pressing play
 * resumes from there instead of snapping the animation back to a stale playhead.
 */
export function usePlayback(totalMs: number) {
  const playing = useUiStore((s) => s.playing);
  const setPlaying = useUiStore((s) => s.setPlaying);
  const playheadMs = useUiStore((s) => s.playheadMs);
  const setPlayheadMs = useUiStore((s) => s.setPlayheadMs);

  // Pause every live animation at `ms` so the rendered frame matches the playhead.
  const applyFrame = useCallback((ms: number) => {
    for (const animation of getSandboxAnimations()) {
      try {
        animation.pause();
        animation.currentTime = ms;
      } catch {
        // Some animations reject a currentTime before they're ready; ignore.
      }
    }
  }, []);

  const headRef = useRef(playheadMs);
  headRef.current = playheadMs;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = totalMs > 0 ? (headRef.current + (now - last)) % totalMs : 0;
      last = now;
      headRef.current = next;
      setPlayheadMs(next);
      applyFrame(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, totalMs, setPlayheadMs, applyFrame]);

  // While paused/free-running, follow the live animation so the playhead tracks
  // what the browser renders (and play resumes without a jump). No-op when no
  // live animation exists yet (frame not loaded, or jsdom in tests).
  useEffect(() => {
    if (playing) return;
    let frame = 0;
    const tick = () => {
      const [sample] = getSandboxAnimations();
      if (sample != null) {
        const raw = Number(sample.currentTime ?? 0);
        const ms = totalMs > 0 ? ((raw % totalMs) + totalMs) % totalMs : 0;
        if (ms !== headRef.current) {
          headRef.current = ms;
          setPlayheadMs(ms);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, totalMs, setPlayheadMs]);

  const play = useCallback(() => setPlaying(true), [setPlaying]);
  const pause = useCallback(() => setPlaying(false), [setPlaying]);
  const scrub = useCallback(
    (ms: number) => {
      setPlaying(false);
      setPlayheadMs(ms);
      applyFrame(ms);
    },
    [setPlaying, setPlayheadMs, applyFrame],
  );

  return { playing, playheadMs, play, pause, scrub };
}
