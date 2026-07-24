import { NavLink, Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.js';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/demo', label: 'Playground', end: false },
  { to: '/docs', label: 'Docs', end: false },
  { to: '/portal', label: 'Dev portal', end: false },
] as const;

export function SiteLayout({ wide = false, hideFooter = false, admin = false }: { wide?: boolean; hideFooter?: boolean; admin?: boolean }) {
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
          <nav className="site-nav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <span className="network-pill">Testnet</span>
            <Link to="/demo" className="btn btn-primary btn-sm topbar-cta">
              Try demo
            </Link>
          </div>
        </div>
      </header>

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
