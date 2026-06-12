import { SandboxFrame } from '../../sandbox/SandboxFrame';

/** Center view: Preview / Code / Split tabs. Tab switching arrives in 1.5. */
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
      <div className="panel-body canvas">
        <SandboxFrame />
      </div>
    </section>
  );
}
