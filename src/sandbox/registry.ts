/**
 * Module-level handle to the mounted sandbox iframe, so panels outside the
 * canvas (e.g. Rules) can read LIVE state — computed styles, animations.
 * Never document state: buffers stay the only source of truth.
 */
let current: HTMLIFrameElement | null = null;

export function setSandboxIframe(iframe: HTMLIFrameElement | null): void {
  current = iframe;
}

export function getSandboxBody(): HTMLElement | null {
  return current?.contentDocument?.body ?? null;
}

/**
 * Live Web Animations in the rendered document (docs/css-engine.md): the
 * Timeline scrubs/plays by reading and setting these (`currentTime`), leaning
 * on the browser rather than re-deriving timing. Empty when the frame hasn't
 * loaded or the environment lacks `Document.getAnimations` (e.g. jsdom).
 */
export function getSandboxAnimations(): Animation[] {
  const doc = current?.contentDocument;
  if (!doc || typeof doc.getAnimations !== 'function') return [];
  return doc.getAnimations();
}
