export function RiskBadge({ level }: { level: string }) {
  return <span className={`badge badge-${level.toLowerCase()}`}>{level}</span>;
}

export function RiskBar({ score }: { score: number }) {
  const color = score >= 75 ? '#A0141E' : score >= 50 ? '#C05000' : score >= 25 ? '#1565C0' : '#2E7D32';
  return (
    <div className="risk-bar-wrap">
      <div className="risk-bar-track">
        <div className="risk-bar-fill" style={{ width:`${Math.min(score,100)}%`, background:color }} />
      </div>
      <span className="risk-bar-label">{score}</span>
    </div>
  );
}
