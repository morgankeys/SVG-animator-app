/** Center view: Preview / Code / Split tabs (Phase 1). Static shell for now. */
export function CenterView() {
  return (
    <section className="center-view panel">
      <header className="panel-header tab-row">
        <button className="tab active" type="button">
          Preview
        </button>
        <button className="tab" type="button">
          Code
        </button>
        <button className="tab" type="button">
          Split
        </button>
      </header>
      <div className="panel-body canvas placeholder">Canvas appears here (Phase 1)</div>
    </section>
  );
}
