type MobileMenuButtonProps = {
  open: boolean;
  onClick: () => void;
  label?: string;
};

export function MobileMenuButton({ open, onClick, label = 'Menu' }: MobileMenuButtonProps) {
  return (
    <button
      type="button"
      className="mobile-menu-btn"
      aria-expanded={open}
      aria-label={open ? 'Close menu' : label}
      onClick={onClick}
    >
      <span className={`mobile-menu-icon${open ? ' is-open' : ''}`} aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
