import { Link } from 'react-router-dom';

type HeroPromoCard = {
  badge: string;
  title: string;
  description: string;
  linkTo: string;
  linkLabel: string;
};

type HeroContent = {
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  trustItems: readonly string[];
  promoCard: HeroPromoCard;
};

export function NethermindHero({ content }: { content: HeroContent }) {
  return (
    <section className="hero-nethermind">
      <div className="hero-nethermind-bg" aria-hidden>
        <span className="hero-glow hero-glow-orange" />
        <span className="hero-glow hero-glow-blue" />
        <span className="hero-grid-lines" />
      </div>

      <div className="hero-nethermind-inner">
        <div className="hero-nethermind-copy">
          <h1>{content.headline}</h1>
          <p className="hero-nethermind-lead">{content.subheadline}</p>
          <div className="hero-nethermind-actions">
            <Link to="/demo" className="btn btn-hero-primary btn-lg">
              {content.primaryCta}
            </Link>
            <Link to="/docs/getting-started" className="btn btn-hero-ghost btn-lg">
              {content.secondaryCta}
            </Link>
          </div>
          <ul className="hero-nethermind-trust">
            {content.trustItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <aside className="hero-promo-card">
          <div className="hero-promo-card-visual" aria-hidden>
            <div className="hero-promo-code">
              <span>npm i @stacks-passkey/core</span>
              <span>register()</span>
              <span>invoke(app, fn)</span>
            </div>
          </div>
          <div className="hero-promo-card-body">
            <span className="hero-promo-badge">{content.promoCard.badge}</span>
            <h2>{content.promoCard.title}</h2>
            <p>{content.promoCard.description}</p>
            <Link to={content.promoCard.linkTo} className="hero-promo-link">
              {content.promoCard.linkLabel}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
