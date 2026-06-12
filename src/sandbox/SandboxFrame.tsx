import { useMemo } from 'react';
import { useDocumentStore } from '../state/documentStore';
import { compileStyles } from '../model/styles';
import { buildSandboxHtml } from './buildHtml';

/**
 * Renders the document buffers in a sandboxed same-origin iframe. The browser
 * inside is our CSS engine; the app never re-implements the cascade.
 * srcdoc changes reload the frame — fine for now, the bridge can optimize later.
 */
export function SandboxFrame() {
  const markup = useDocumentStore((s) => s.markup);
  const styles = useDocumentStore((s) => s.styles);

  const compiled = useMemo(() => compileStyles(styles), [styles]);
  const srcdoc = useMemo(
    () => buildSandboxHtml(markup, compiled.ok ? compiled.css : ''),
    [markup, compiled],
  );

  return (
    <div className="sandbox-wrap">
      {!compiled.ok && (
        <div className="sandbox-error" role="alert">
          Style error{compiled.error.line != null ? ` (line ${compiled.error.line})` : ''}:{' '}
          {compiled.error.message}
        </div>
      )}
      <iframe
        className="sandbox-frame"
        title="Rendered document"
        sandbox="allow-same-origin"
        srcDoc={srcdoc}
      />
    </div>
  );
}
