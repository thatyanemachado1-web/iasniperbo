import { LeituraNeuralClassicCard } from "@/components/dashboard/LeituraNeuralClassicCard";
import {
  LeituraNeuralMiniCard,
  type LeituraNeuralCardProps,
} from "@/components/dashboard/LeituraNeuralMiniCard";

export type { LeituraNeuralCardProps };

export function LeituraNeuralResponsiveCard(props: LeituraNeuralCardProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-full flex-1 flex-col md:hidden">
        <LeituraNeuralMiniCard {...props} className="h-full w-full" />
      </div>
      <div className="hidden h-full flex-1 flex-col md:flex">
        <LeituraNeuralClassicCard {...props} className="h-full w-full" />
      </div>
    </div>
  );
}
