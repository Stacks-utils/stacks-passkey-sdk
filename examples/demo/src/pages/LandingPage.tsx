import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  HOW_IT_WORKS,
  LANDING_HERO,
  LANDING_HERO_CARD,
  LANDING_STATS,
  LANDING_STICKY_FEATURES,
  LANDING_TESTIMONIAL,
  PLAYGROUND_FEATURES,
  PORTAL_TOOLS,
  USE_CASE_PILLS,
  TRUST_LOGOS,
} from '../content/portal-content.js';
import { NethermindHero } from '../components/NethermindHero.js';
import { ScrollReveal } from '../components/ScrollReveal.js';
import { SiteFooter } from '../components/SiteFooter.js';
import { StickyFeatures, type StickyFeature } from '../components/StickyFeatures.js';
import { TrustLogoCarousel } from '../components/TrustLogoCarousel.js';

function FeatureVisual({ kind }: { kind: string }) {
  const panels: Record<string, { title: string; lines: string[] }> = {
    passkey: {
      title: 'register() → signIn()',
      lines: ['WebAuthn credential', 'Origin key derived', 'Session in localStorage'],
    },
    fees: {
      title: 'fee.mode',
      lines: ['gasless → project gas tank', 'account-pay → smart account STX', 'Fixed relay reimbursement'],
    },
    invoke: {
      title: 'invoke(my-app, fn)',
      lines: ['compute-invoke-hash', 'Passkey signs action', 'adapter → passkey-exec'],
    },
    relay: {
      title: 'Relay /v1/*',
      lines: ['POST /sponsor', 'GET /v1/project', 'Wallet-scoped API keys'],
    },
  };
  const panel = panels[kind] ?? panels.passkey;
  return (
    <div className="feature-visual-card">
      <p className="feature-visual-label">{panel.title}</p>
      <ul>
        {panel.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

const stickyFeatures: StickyFeature[] = LANDING_STICKY_FEATURES.map((f) => ({
  title: f.title,
  description: f.description,
  visual: <FeatureVisual kind={f.visualKey} />,
}));

function LandingSection({
  id,
  eyebrow,
  title,
  lead,
  action,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  lead?: string;
  action?: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="landing-section">
      {(eyebrow || title || lead || action) && (
        <div className="landing-section-head">
          <div>
            {eyebrow && <p className="landing-section-eyebrow">{eyebrow}</p>}
            {title && <h2>{title}</h2>}
            {lead && <p className="landing-section-lead">{lead}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="landing-v2">
      <NethermindHero
        content={{
          ...LANDING_HERO,
          promoCard: LANDING_HERO_CARD,
        }}
      />

      <TrustLogoCarousel label="Built for developers shipping on Stacks" logos={TRUST_LOGOS} />

      <div className="landing-v2-main">
        <div className="landing-v2-inner">
          <ScrollReveal>
            <LandingSection eyebrow="Impact" title="Why teams choose passkeys on Stacks">
              <div className="stats-row">
                {LANDING_STATS.map((stat) => (
                  <div key={stat.label} className="stat-card landing-glass-card">
                    <p className="stat-value">
                      {stat.value}
                      <span>{stat.suffix}</span>
                    </p>
                    <p className="stat-label">{stat.label}</p>
                  </div>
                ))}
              </div>
            </LandingSection>
          </ScrollReveal>

          <StickyFeatures
            heading="Everything your dApp needs — in one SDK"
            lead="From first passkey to first invoke: the same methods wired in this portal's live playground."
            features={stickyFeatures}
          />

          <ScrollReveal>
            <LandingSection
              eyebrow="Portal"
              title="Explore the SDK stack"
              lead="Playground, docs, dev portal, and architecture — all on testnet."
            >
              <div className="portal-tools-grid">
                {PORTAL_TOOLS.map((tool, i) => (
                  <ScrollReveal key={tool.to} delay={i * 60} as="div">
                    <Link to={tool.to} className="portal-tool-card landing-glass-card">
                      <span className="portal-tool-badge">{tool.badge}</span>
                      <h3>{tool.title}</h3>
                      <p>{tool.desc}</p>
                      <span className="portal-tool-link">Open →</span>
                    </Link>
                  </ScrollReveal>
                ))}
              </div>
            </LandingSection>
          </ScrollReveal>

          <ScrollReveal>
            <LandingSection
              id="playground"
              eyebrow="Live demo"
              title="What the playground runs"
              lead="Real SDK methods and testnet contracts — no mocked flows."
              action={
                <Link to="/demo" className="text-link landing-text-link">
                  Open playground
                </Link>
              }
            >
              <div className="features-grid-v2">
                {PLAYGROUND_FEATURES.map((feature, i) => (
                  <ScrollReveal key={feature.title} delay={i * 50} as="div">
                    <article className="feature-card-v2 landing-glass-card">
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </article>
                  </ScrollReveal>
                ))}
              </div>
            </LandingSection>
          </ScrollReveal>

          <ScrollReveal>
            <LandingSection eyebrow="Architecture" title="How it works">
              <div className="how-steps-v2">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.num} className="how-step-v2 landing-glass-card">
                    <span className="how-step-num">{step.num}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </LandingSection>
          </ScrollReveal>

          <ScrollReveal>
            <LandingSection eyebrow="Use cases" title="Built for teams shipping wallet-less UX">
              <div className="use-case-pills">
                {USE_CASE_PILLS.map((label) => (
                  <span key={label} className="use-case-pill">
                    {label}
                  </span>
                ))}
              </div>
            </LandingSection>
          </ScrollReveal>

          <ScrollReveal>
            <blockquote className="testimonial-card landing-glass-card">
              <p>&ldquo;{LANDING_TESTIMONIAL.quote}&rdquo;</p>
              <footer>
                <strong>{LANDING_TESTIMONIAL.author}</strong>
                <span>{LANDING_TESTIMONIAL.role}</span>
              </footer>
            </blockquote>
          </ScrollReveal>

          <ScrollReveal>
            <section className="landing-cta-band">
              <div className="landing-cta-band-glow" aria-hidden />
              <div className="landing-cta-band-inner landing-glass-card">
                <h2>Try it on testnet today</h2>
                <p>
                  Sign up with a passkey, invoke set-score on passkey-demo-app, and inspect the transaction in the
                  result panel.
                </p>
                <div className="landing-cta-actions">
                  <Link to="/demo" className="btn btn-hero-primary btn-lg">
                    Live playground
                  </Link>
                  <Link to="/portal" className="btn btn-hero-ghost btn-lg">
                    Dev portal
                  </Link>
                </div>
              </div>
            </section>
          </ScrollReveal>
        </div>

        <SiteFooter variant="landing" />
      </div>
    </div>
  );
}
