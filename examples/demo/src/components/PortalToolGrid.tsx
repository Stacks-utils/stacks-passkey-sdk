import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PORTAL_TOOLS } from '../content/portal-content.js';

export function PortalToolGrid() {
  return (
    <section className="forge-tools">
      {PORTAL_TOOLS.map((tool) => (
        <Link key={tool.to} to={tool.to} className="forge-tool-card" style={{ '--tool-accent': tool.accent } as CSSProperties}>
          <span className="forge-tool-badge">{tool.badge}</span>
          <h3>{tool.title}</h3>
          <p>{tool.desc}</p>
          <span className="forge-tool-link">Open</span>
        </Link>
      ))}
    </section>
  );
}
