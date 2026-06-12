import { useMemo } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import { compileStyles } from '../../model/styles';
import { buildConsolidatedSource } from './consolidated';
import { CodeView } from '../shared/CodeView';

/** Read-only consolidated view: markup + compiled CSS, as it would export. */
export function CodeTab() {
  const markup = useDocumentStore((s) => s.markup);
  const styles = useDocumentStore((s) => s.styles);

  const compiled = useMemo(() => compileStyles(styles), [styles]);
  const source = useMemo(
    () => buildConsolidatedSource(markup, compiled.ok ? compiled.css : ''),
    [markup, compiled],
  );

  return (
    <div className="code-tab">
      {!compiled.ok && (
        <div className="sandbox-error" role="alert">
          Style error{compiled.error.line != null ? ` (line ${compiled.error.line})` : ''}:{' '}
          {compiled.error.message} — styles omitted below.
        </div>
      )}
      <CodeView value={source} language="html" />
    </div>
  );
}
