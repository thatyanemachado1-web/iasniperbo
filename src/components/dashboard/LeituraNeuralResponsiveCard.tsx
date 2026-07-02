import { LeituraNeuralClassicCard } from "@/components/dashboard/LeituraNeuralClassicCard";
import {
  LeituraNeuralMiniCard,
  type LeituraNeuralCardProps,
} from "@/components/dashboard/LeituraNeuralMiniCard";

export type { LeituraNeuralCardProps };

export function LeituraNeuralResponsiveCard(props: LeituraNeuralCardProps) {
  return (
    <>
      <div className="h-full md:hidden">
        <LeituraNeuralMiniCard {...props} />
      </div>
      <div className="hidden h-full md:block">
        <LeituraNeuralClassicCard {...props} />
      </div>
    </>
  );
}
