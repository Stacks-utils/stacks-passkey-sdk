import { useState, type ReactNode } from 'react';

export function StatusBadge({ status }: { status?: string }) {
  const normalized = status?.toLowerCase();
  let label = 'Confirming';
  let variant = 'pending';

  if (!status || normalized === 'pending') {
    label = 'Confirming';
    variant = 'pending';
  } else if (normalized === 'success') {
    label = 'Confirmed';
    variant = 'success';
  } else if (normalized === 'not found') {
    label = 'Not indexed';
    variant = 'failed';
  } else if (normalized === 'abort_by_response' || normalized === 'failed') {
    label = 'Failed';
    variant = 'failed';
  } else {
    label = status;
    variant = 'neutral';
  }

  return <span className={`badge badge-${variant}`}>{label}</span>;
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button type="button" className="copy-btn" onClick={handleCopy} title={`Copy ${label}`}>
      {copied ? 'Copied' : label}
    </button>
  );
}

export function CodeValue({
  value,
  href,
  truncate = false,
}: {
  value: string;
  href?: string;
  truncate?: boolean;
}) {
  const display =
    truncate && value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

  return (
    <span className="code-value">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" title={value}>
          {display}
        </a>
      ) : (
        <span title={value}>{display}</span>
      )}
      <CopyButton value={value} />
    </span>
  );
}

export function Section({ title, description, children, action }: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}
