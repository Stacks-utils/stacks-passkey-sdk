import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo.js';
import { MobileMenuButton } from '../components/MobileMenuButton.js';
import { useEscapeKey, useScrollLock } from '../hooks/useScrollLock.js';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/demo', label: 'Playground', end: false },
  { to: '/docs', label: 'Docs', end: false },
  { to: '/portal', label: 'Dev portal', end: false },
] as const;

function SiteNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`}
          onClick={onNavigate}
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function SiteLayout({ wide = false, hideFooter = false, admin = false }: { wide?: boolean; hideFooter?: boolean; admin?: boolean }) {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useScrollLock(navOpen);
  useEscapeKey(closeNav, navOpen);

  return (
    <div className={`site site-v2${admin ? ' site-admin' : ''}`}>
      <header className="topbar topbar-v2">
        <div className="topbar-inner topbar-inner-wide">
          <NavLink to="/" className="brand">
            <Logo size={44} />
            <div className="brand-text">
              <strong>Stacks Passkey</strong>
              <span>SDK portal</span>
            </div>
          </NavLink>
          <nav className="site-nav site-nav-desktop" aria-label="Main">
            <SiteNavLinks />
          </nav>
          <div className="topbar-actions">
            <span className="network-pill network-pill-topbar">Testnet</span>
            <Link to="/demo" className="btn btn-primary btn-sm topbar-cta">
              Try demo
            </Link>
            <MobileMenuButton open={navOpen} onClick={() => setNavOpen((open) => !open)} label="Open site menu" />
          </div>
        </div>
      </header>

      <div className={`mobile-nav-drawer${navOpen ? ' is-open' : ''}`} aria-hidden={!navOpen}>
        <button type="button" className="mobile-drawer-backdrop" aria-label="Close menu" onClick={closeNav} />
        <div className="mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Site navigation">
          <div className="mobile-nav-panel-head">
            <strong>Menu</strong>
            <MobileMenuButton open={navOpen} onClick={closeNav} label="Close site menu" />
          </div>
          <nav className="mobile-nav-links" aria-label="Main mobile">
            <SiteNavLinks onNavigate={closeNav} />
          </nav>
          <Link to="/demo" className="btn btn-primary btn-block" onClick={closeNav}>
            Try demo
          </Link>
        </div>
      </div>

      <main
        className={
          admin
            ? 'page page-admin'
            : wide
              ? 'page page-wide'
              : hideFooter
                ? 'page page-landing-v2'
                : 'page page-standard'
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
