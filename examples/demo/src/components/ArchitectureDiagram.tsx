export function ArchitectureDiagram() {
  return (
    <div className="arch-diagram">
      <h3>Architecture at a glance</h3>
      <div className="arch-flow">
        <div className="arch-node arch-node-highlight">Browser (WebAuthn)</div>
        <div className="arch-arrow">↓</div>
        <div className="arch-node">STorigin.smart-account</div>
        <div className="arch-arrow">↓</div>
        <div className="arch-node">passkey-adapter</div>
        <div className="arch-arrow">↓</div>
        <div className="arch-row">
          <div className="arch-node arch-node-sm">passkey-factory</div>
          <div className="arch-node arch-node-sm">passkey-exec</div>
        </div>
        <div className="arch-arrow">↓</div>
        <div className="arch-node arch-node-accent">Your App contract</div>
      </div>
      <p className="arch-footnote">Relay sponsors gas &amp; registers apps</p>
    </div>
  );
}
