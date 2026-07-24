import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function CodeBlock({ children }: { children: string }) {
  return <pre className="doc-code">{children.trim()}</pre>;
}

export function DocPage({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <article className="docs-content">
      <header className="docs-page-header">
        <h1>{title}</h1>
        {lead && <p className="page-lead">{lead}</p>}
      </header>
      <div className="doc-page-body">{children}</div>
    </article>
  );
}

export function Callout({ title, children, variant = 'info' }: { title?: string; children: ReactNode; variant?: 'info' | 'tip' | 'warn' }) {
  return (
    <div className={`doc-callout doc-callout-${variant}`}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function FeatureGrid({ items }: { items: readonly { title: string; description: string }[] }) {
  return (
    <div className="doc-features-grid">
      {items.map((feature) => (
        <div key={feature.title} className="doc-feature-card">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
      ))}
    </div>
  );
}

export function StepGuide({
  steps,
}: {
  steps: readonly {
    title: string;
    summary: string;
    detail?: ReactNode;
    link?: { to: string; label: string };
  }[];
}) {
  return (
    <ol className="doc-step-guide">
      {steps.map((step, index) => (
        <li key={step.title} className="doc-step-item">
          <span className="doc-step-num">{index + 1}</span>
          <div className="doc-step-body">
            <h3>{step.title}</h3>
            <p>{step.summary}</p>
            {step.detail}
            {step.link && (
              <Link to={step.link.to} className="doc-step-link">
                {step.link.label} →
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DocLinkGrid({ links }: { links: readonly { to: string; title: string; desc: string }[] }) {
  return (
    <div className="doc-link-grid">
      {links.map((item) => (
        <Link key={item.to} to={item.to} className="doc-link-card">
          <strong>{item.title}</strong>
          <span>{item.desc}</span>
        </Link>
      ))}
    </div>
  );
}
