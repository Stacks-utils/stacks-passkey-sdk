import { Link } from 'react-router-dom';
import { Logo } from './Logo.js';

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/demo', label: 'Live playground' },
      { to: '/docs/getting-started', label: 'Getting started' },
      { to: '/docs/fee-modes', label: 'Fee modes' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { to: '/docs/install', label: 'Install SDK' },
      { to: '/docs/react-hooks', label: 'React hooks' },
      { to: '/docs/app-contract', label: 'Clarity app guide' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { to: '/portal', label: 'Dev portal' },
      { to: '/docs/relay', label: 'Run your relay' },
      { to: '/docs/troubleshooting', label: 'Troubleshooting' },
    ],
  },
  {
    title: 'Architecture',
    links: [
      { to: '/docs/overview', label: 'What & why' },
      { to: '/docs/self-deploy', label: 'Self-deploy flow' },
      { to: '/docs/config', label: 'Configuration' },
    ],
  },
] as const;

export function SiteFooter({ variant = 'default' }: { variant?: 'default' | 'landing' }) {
  return (
    <footer className={`site-footer-v2${variant === 'landing' ? ' site-footer-landing' : ''}`}>
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Logo size={36} />
          <p>
            Passkey smart accounts for Stacks — biometric sign-in, sponsored deploys, and adapter-based contract calls.
          </p>
        </div>
        <div className="site-footer-columns">
          {FOOTER_COLUMNS.map((col) => (
                <div key={col.title} className="site-footer-col">
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className={variant === 'landing' ? 'landing-footer-link' : undefined}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>Stacks Passkey SDK · Testnet portal</span>
        <span className="network-pill network-pill-sm">Testnet</span>
      </div>
    </footer>
  );
}
