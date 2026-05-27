interface Props {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

export function CircularProgress({
  value,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  color = "var(--neon-blue)",
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="color-mix(in oklab, var(--neon-blue) 15%, transparent)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray .6s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-lg font-bold">{label ?? `${pct.toFixed(1)}%`}</div>
        {sublabel && <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{sublabel}</div>}
      </div>
    </div>
  );
}