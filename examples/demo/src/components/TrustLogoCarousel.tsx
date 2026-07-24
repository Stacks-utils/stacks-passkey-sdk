type TrustLogoCarouselProps = {
  label: string;
  logos: readonly string[];
};

export function TrustLogoCarousel({ label, logos }: TrustLogoCarouselProps) {
  const track = [...logos, ...logos];

  return (
    <section className="trust-carousel" aria-label={label}>
      <p className="trust-carousel-label">{label}</p>
      <div className="trust-carousel-viewport">
        <div className="trust-carousel-track">
          {track.map((name, index) => (
            <span key={`${name}-${index}`} className="trust-carousel-item">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
