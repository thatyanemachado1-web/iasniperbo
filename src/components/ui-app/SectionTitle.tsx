interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}
export function SectionTitle({ title, subtitle, right }: Props) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}