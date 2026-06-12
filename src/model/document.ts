/**
 * The canonical project state: two text buffers (docs/architecture.md, invariant 1).
 * Everything the UI shows is derived from these strings; nothing else is authoritative.
 */
export interface Document {
  /** HTML + inline SVG. Source of truth for structure. */
  markup: string;
  /** SCSS (a superset of CSS). Source of truth for style/animation. */
  styles: string;
}

export function createDocument(markup = '', styles = ''): Document {
  return { markup, styles };
}

/** Hardcoded starter document: a simple animated SVG used until projects load (Phase 12). */
export function sampleDocument(): Document {
  return createDocument(SAMPLE_MARKUP, SAMPLE_STYLES);
}

const SAMPLE_MARKUP = `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <g id="scene">
    <rect id="ground" x="0" y="260" width="400" height="40" />
    <circle id="ball" cx="200" cy="230" r="28" />
  </g>
</svg>
`;

const SAMPLE_STYLES = `#ground {
  fill: #3c3c3c;
}

#ball {
  fill: #4f9cf9;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-160px);
  }
  100% {
    transform: translateY(0);
  }
}
`;
