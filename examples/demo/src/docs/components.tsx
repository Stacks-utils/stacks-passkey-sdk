import type { ReactNode } from 'react';

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
