import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram.js';
import { ScrollReveal } from '../components/ScrollReveal.js';
import { DOC_NAV_GROUPS, DOC_PAGES_BY_SLUG, DEFAULT_DOC_SLUG, docPagesInGroup } from './docs-nav.js';

export function DocsLayout() {
  return (
    <div className="docs-layout-v2 portal-page">
      <header className="portal-page-hero docs-portal-hero">
        <ScrollReveal>
          <h1>Integrate passkey smart accounts</h1>
          <p className="portal-lead">
            Step-by-step guides for install, React wiring, sign-up, transfers, invokes, fee modes, and relay operations.
          </p>
          <Link to="/demo" className="btn btn-primary btn-sm">
            Try live demo
          </Link>
        </ScrollReveal>
      </header>
      <div className="docs-layout-body">
      <aside className="docs-toc">
        <p className="docs-toc-title">Developer docs</p>
        <nav>
          {DOC_NAV_GROUPS.map((group) => (
            <div key={group} className="docs-toc-group">
              <p className="docs-toc-group-label">{group}</p>
              {docPagesInGroup(group).map((item) => (
                <NavLink
                  key={item.slug}
                  to={`/docs/${item.slug}`}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="docs-toc-cta">
          <Link to="/demo" className="btn btn-primary btn-block">
            Try live demo
          </Link>
        </div>
      </aside>

      <Outlet />

      <aside className="docs-arch-aside">
        <ArchitectureDiagram />
      </aside>
      </div>
    </div>
  );
}

export function DocsIndexPage() {
  return <Navigate to={`/docs/${DEFAULT_DOC_SLUG}`} replace />;
}

export function DocRoutePage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? DOC_PAGES_BY_SLUG[slug] : undefined;

  if (!page) {
    return <Navigate to={`/docs/${DEFAULT_DOC_SLUG}`} replace />;
  }

  const { Section } = page;
  return <Section />;
}
