import { useEffect, useMemo, useRef } from 'react';
import { useDocumentStore } from '../state/documentStore';
import { useSelectionStore } from '../state/selectionStore';
import { compileStyles } from '../model/styles';
import { buildSandboxHtml } from './buildHtml';
import { createBridge } from './bridge';
import { setSandboxIframe } from './registry';

/**
 * Renders the document buffers in a sandboxed same-origin iframe. The browser
 * inside is our CSS engine; the app never re-implements the cascade.
 * srcdoc changes reload the frame — fine for now, the bridge can optimize later.
 */
export function SandboxFrame() {
  const markup = useDocumentStore((s) => s.markup);
  const styles = useDocumentStore((s) => s.styles);
  const selected = useSelectionStore((s) => s.element);
  const selectElement = useSelectionStore((s) => s.selectElement);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const compiled = useMemo(() => compileStyles(styles), [styles]);
  const srcdoc = useMemo(
    () => buildSandboxHtml(markup, compiled.ok ? compiled.css : ''),
    [markup, compiled],
  );

  useEffect(() => {
    setSandboxIframe(iframeRef.current);
    return () => setSandboxIframe(null);
  }, []);

  // Selection sync, both directions. srcdoc changes reload the frame and drop
  // its DOM, so everything re-wires on the iframe load event too.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const bridge = createBridge(iframe);
    let unsubscribe = () => {};
    const wire = () => {
      unsubscribe();
      bridge.highlight(selected);
      unsubscribe = bridge.onSelect(selectElement);
    };
    wire();
    iframe.addEventListener('load', wire);
    return () => {
      iframe.removeEventListener('load', wire);
      unsubscribe();
    };
  }, [selected, selectElement, srcdoc]);

  return (
    <div className="sandbox-wrap">
      {!compiled.ok && (
        <div className="sandbox-error" role="alert">
          Style error{compiled.error.line != null ? ` (line ${compiled.error.line})` : ''}:{' '}
          {compiled.error.message}
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="sandbox-frame"
        title="Rendered document"
        sandbox="allow-same-origin"
        srcDoc={srcdoc}
      />
    </div>
  );
}
