import { BrainAI } from "./BrainAI";
import { SniperLogoMark } from "./SniperLogoMark";

export function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrainAI size={size} />
      {withText && <SniperLogoMark className="h-9 w-auto max-w-[160px] sm:h-10 sm:max-w-[190px]" />}
    </div>
  );
}
