import { Link, NavLink, Navigate, Outlet, useParams } from 'react-router-dom';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram.js';
import { DOC_NAV_GROUPS, DOC_PAGES, DOC_PAGES_BY_SLUG, DEFAULT_DOC_SLUG, docPagesInGroup } from './docs-nav.js';

export function DocsLayout() {
  return (
    <div className="docs-layout-v2">
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
