import { Link } from 'react-router-dom';
import { HOW_IT_WORKS, PLAYGROUND_FEATURES } from '../content/portal-content.js';
import { PortalToolGrid } from '../components/PortalToolGrid.js';

export function LandingPage() {
  return (
    <div className="landing landing-shipyard">
      <section className="landing-hero">
        <p className="landing-eyebrow">Stacks Passkey SDK · Testnet</p>
        <h1>
          Passkey smart accounts
          <br />
          for Stacks
        </h1>
        <p className="landing-sub">
          WebAuthn sign-in, sponsored smart-account deploys, STX transfers, and adapter-based contract calls — integrated
          with the passkey-adapter and relay in this repo.
        </p>
        <div className="landing-actions">
          <Link to="/demo" className="btn btn-primary btn-lg">
            Open playground
          </Link>
          <Link to="/docs" className="btn btn-outline btn-lg">
            Read developer docs
          </Link>
        </div>
      </section>

      <PortalToolGrid />

      <section id="playground" className="use-cases-section">
        <div className="section-head-row">
          <div>
            <h2>What the playground runs</h2>
            <p className="section-lead">
              Everything on the demo page is wired to real SDK methods and testnet contracts — no mocked flows.
            </p>
          </div>
          <Link to="/demo" className="text-link">
            Open playground
          </Link>
        </div>
        <div className="use-cases-grid">
          {PLAYGROUND_FEATURES.map((feature) => (
            <div key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="how-it-works">
        <h2>How it works</h2>
        <div className="how-steps">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.num} className="how-step">
              <span className="how-step-num">{step.num}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta-band">
        <div>
          <h2>Try it on testnet</h2>
          <p>Sign up with a passkey, invoke set-score on passkey-demo-app, and inspect the transaction in the result panel.</p>
        </div>
        <div className="landing-cta-actions">
          <Link to="/demo" className="btn btn-primary">
            Live playground
          </Link>
          <Link to="/admin" className="btn btn-outline">
            Relay admin
          </Link>
        </div>
      </section>
    </div>
  );
}
