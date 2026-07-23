import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Logo } from '../components/Logo.js';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/demo', label: 'Playground', end: false },
  { to: '/docs', label: 'Docs', end: false },
  { to: '/admin', label: 'Relay', end: false },
] as const;

export function SiteLayout({ wide = false, hideFooter = false, admin = false }: { wide?: boolean; hideFooter?: boolean; admin?: boolean }) {
  return (
    <div className={`site${admin ? ' site-admin' : ''}`}>
      <header className="topbar topbar-forge">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <Logo size={32} />
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
          <span className="network-pill">Testnet</span>
        </div>
      </header>

      <main
        className={
          admin
            ? 'page page-admin'
            : wide
              ? 'page page-wide'
              : hideFooter
                ? 'page page-landing'
                : 'page page-standard'
        }
      >
        <Outlet />
      </main>

      {!hideFooter && (
        <footer className="site-footer">
          <Logo size={24} />
          <p>Passkey smart accounts · Gasless relay · Stacks Bitcoin L2</p>
        </footer>
      )}
    </div>
  );
}

export function PageHeader({ title, lead, action }: { title: string; lead?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {lead && <p className="page-lead">{lead}</p>}
      </div>
      {action}
    </div>
  );
}
