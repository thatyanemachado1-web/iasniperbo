import {
  LeituraNeuralMiniCard,
  type LeituraNeuralCardProps,
} from "@/components/dashboard/LeituraNeuralMiniCard";

export type { LeituraNeuralCardProps };

export function LeituraNeuralResponsiveCard(props: LeituraNeuralCardProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <LeituraNeuralMiniCard {...props} className="h-full w-full" />
    </div>
  );
}
