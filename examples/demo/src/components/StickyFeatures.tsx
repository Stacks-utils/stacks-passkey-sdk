import { useEffect, useRef, useState, type ReactNode } from 'react';

export type StickyFeature = {
  title: string;
  description: string;
  visual: React.ReactNode;
};

function getActiveIndex(steps: HTMLElement[], section: HTMLElement | null) {
  if (steps.length === 0) return 0;

  if (section) {
    const { top, bottom } = section.getBoundingClientRect();
    if (bottom < window.innerHeight * 0.25) return steps.length - 1;
    if (top > window.innerHeight * 0.45) return 0;
  }

  const marker = window.innerHeight * 0.42;
  let active = 0;
  steps.forEach((el, index) => {
    if (el.getBoundingClientRect().top <= marker) active = index;
  });
  return active;
}

export function StickyFeatures({ features, heading, lead }: { features: StickyFeature[]; heading: string; lead?: string }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobileMq = window.matchMedia('(max-width: 1024px)');

    const steps = () => stepRefs.current.filter((el): el is HTMLDivElement => el != null);
    const items = () => itemRefs.current.filter((el): el is HTMLDivElement => el != null);

    const updateFromSteps = () => {
      const els = steps();
      if (els.length === 0) return;
      setActive(getActiveIndex(els, sectionRef.current));
    };

    if (reduced) return;

    let observer: IntersectionObserver | undefined;
    let onScroll: (() => void) | undefined;

    const bind = () => {
      observer?.disconnect();
      if (onScroll) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }

      if (mobileMq.matches) {
        const ratios = new Map<number, number>();
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const index = Number((entry.target as HTMLElement).dataset.index);
              ratios.set(index, entry.intersectionRatio);
            });
            let best = 0;
            let bestRatio = 0;
            ratios.forEach((ratio, index) => {
              if (ratio > bestRatio) {
                bestRatio = ratio;
                best = index;
              }
            });
            if (bestRatio > 0) setActive(best);
          },
          { rootMargin: '-30% 0px -30% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
        );
        items().forEach((el, index) => {
          el.dataset.index = String(index);
          observer!.observe(el);
        });
      } else {
        onScroll = updateFromSteps;
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        updateFromSteps();
      }
    };

    bind();
    mobileMq.addEventListener('change', bind);

    return () => {
      observer?.disconnect();
      if (onScroll) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
      mobileMq.removeEventListener('change', bind);
    };
  }, [features.length]);

  return (
    <section className="sticky-features" ref={sectionRef} aria-labelledby="sticky-features-heading">
      <div className="sticky-features-intro">
        <h2 id="sticky-features-heading">{heading}</h2>
        {lead && <p>{lead}</p>}
      </div>

      <div className="sticky-features-grid">
        <div className="sticky-features-list" role="tablist" aria-orientation="vertical">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={`sticky-feature-item${active === index ? ' is-active' : ''}`}
              role="tab"
              aria-selected={active === index}
            >
              <span className="sticky-feature-marker" aria-hidden />
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="sticky-features-track">
          <div className="sticky-features-visual" aria-live="polite">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`sticky-feature-panel${active === index ? ' is-active' : ''}`}
                aria-hidden={active !== index}
              >
                {feature.visual}
              </div>
            ))}
          </div>

          {features.map((feature, index) => (
            <div
              key={`step-${feature.title}`}
              ref={(el) => {
                stepRefs.current[index] = el;
              }}
              className="sticky-feature-step"
              aria-hidden
            />
          ))}
        </div>
      </div>
    </section>
  );
}
