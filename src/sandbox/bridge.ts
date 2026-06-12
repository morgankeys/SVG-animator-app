/**
 * Typed bridge to the sandbox iframe (stub, Phase 1.4). Same-origin, so we can
 * reach into contentDocument directly. Grows with the phases: selection
 * hit-testing (2.3), matches/getComputedStyle (3.1), getAnimations (6.3).
 */
export interface SandboxBridge {
  /** The rendered document's body, or null before the iframe first loads. */
  getBody(): HTMLElement | null;
}

export function createBridge(iframe: HTMLIFrameElement): SandboxBridge {
  return {
    getBody: () => iframe.contentDocument?.body ?? null,
  };
}
