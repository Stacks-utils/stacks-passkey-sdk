import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram.js';
import { MobileMenuButton } from '../components/MobileMenuButton.js';
import { ScrollReveal } from '../components/ScrollReveal.js';
import { useEscapeKey, useScrollLock } from '../hooks/useScrollLock.js';
import { HOSTED_RELAY_URL } from '../config.js';
import { DOC_NAV_GROUPS, DOC_PAGES_BY_SLUG, DEFAULT_DOC_SLUG, docPagesInGroup } from './docs-nav.js';

function DocsTocNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav>
      {DOC_NAV_GROUPS.map((group) => (
        <div key={group} className="docs-toc-group">
          <p className="docs-toc-group-label">{group}</p>
          {docPagesInGroup(group).map((item) => (
            <NavLink
              key={item.slug}
              to={`/docs/${item.slug}`}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              onClick={onNavigate}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function DocsLayout() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useScrollLock(menuOpen);
  useEscapeKey(closeMenu, menuOpen);

  return (
    <div className="docs-layout-v2 portal-page">
      <header className="portal-page-hero docs-portal-hero">
        <ScrollReveal>
          <h1>Integrate passkey smart accounts</h1>
          <p className="portal-lead">
            Step-by-step guides for install, React wiring, sign-up, transfers, invokes, fee modes, and relay operations.
            The portal demo uses the hosted testnet relay at <code>{HOSTED_RELAY_URL}</code>.
          </p>
          <Link to="/demo" className="btn btn-primary btn-sm">
            Try live demo
          </Link>
        </ScrollReveal>
      </header>

      <div className="mobile-only-bar docs-mobile-bar">
        <MobileMenuButton open={menuOpen} onClick={() => setMenuOpen((open) => !open)} label="Open docs menu" />
        <span className="mobile-only-bar-title">Developer docs</span>
      </div>

      <button
        type="button"
        className={`mobile-drawer-backdrop docs-drawer-backdrop${menuOpen ? ' is-open' : ''}`}
        aria-label="Close docs menu"
        onClick={closeMenu}
      />

      <div className="docs-layout-body">
        <aside className={`docs-toc docs-toc-drawer${menuOpen ? ' is-drawer-open' : ''}`}>
          <p className="docs-toc-title">Developer docs</p>
          <DocsTocNav onNavigate={closeMenu} />
          <div className="docs-toc-cta">
            <Link to="/demo" className="btn btn-primary btn-block" onClick={closeMenu}>
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
