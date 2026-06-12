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
