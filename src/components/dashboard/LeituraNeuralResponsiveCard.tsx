import { LeituraNeuralClassicCard } from "@/components/dashboard/LeituraNeuralClassicCard";
import {
  LeituraNeuralMiniCard,
  type LeituraNeuralCardProps,
} from "@/components/dashboard/LeituraNeuralMiniCard";

export type { LeituraNeuralCardProps };

export function LeituraNeuralResponsiveCard({
  greenFlash = false,
  tieFlash = false,
  redFlash = false,
  ...props
}: LeituraNeuralCardProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-full flex-1 flex-col md:hidden">
        <LeituraNeuralMiniCard
          {...props}
          greenFlash={greenFlash}
          tieFlash={tieFlash}
          redFlash={redFlash}
          essentialOnly
          className="h-full w-full"
        />
      </div>
      <div className="hidden h-full flex-1 flex-col md:flex">
        <LeituraNeuralClassicCard
          {...props}
          greenFlash={greenFlash}
          tieFlash={tieFlash}
          redFlash={redFlash}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
