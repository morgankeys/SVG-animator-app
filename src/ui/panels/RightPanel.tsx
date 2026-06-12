/** Right panel: Rules / Code tabs (Phases 3–4). Static shell for now. */
export function RightPanel() {
  return (
    <section className="panel">
      <header className="panel-header tab-row">
        <button className="tab active" type="button">
          Rules
        </button>
        <button className="tab" type="button">
          Code
        </button>
      </header>
      <div className="panel-body placeholder">Style controls appear here (Phase 3)</div>
    </section>
  );
}
