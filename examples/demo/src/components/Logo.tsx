export function Logo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Stacks Passkey"
      width={size}
      height={size}
      className="brand-logo"
      style={{ width: size, height: size }}
      decoding="async"
    />
  );
}
