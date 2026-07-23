export function DonutChart({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const dash = `${clamped} ${100 - clamped}`;
  return (
    <div className="donut-chart">
      <svg viewBox="0 0 36 36" className="donut-svg">
        <path
          className="donut-bg"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className="donut-fill"
          strokeDasharray={dash}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <text x="18" y="20.35" className="donut-text">
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="donut-label">{label}</span>
    </div>
  );
}
