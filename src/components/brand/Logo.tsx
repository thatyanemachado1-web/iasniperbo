import { BrainAI } from "./BrainAI";

export function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrainAI size={size} />
      {withText && (
        <div className="leading-none">
          <div className="text-base font-bold tracking-wider text-gradient-brand">SNIPER BO</div>
          <div className="text-[10px] font-semibold tracking-[0.25em] text-neon-cyan/80">I.A</div>
        </div>
      )}
    </div>
  );
}