import { createFileRoute } from "@tanstack/react-router";
import { LocalAiChatCard } from "@/components/ai/LocalAiChatCard";
import { AdaptiveStrategyLearningPanel } from "@/components/adaptiveStrategy/AdaptiveStrategyLearningPanel";
import { useAdaptiveStrategyLearning } from "@/adaptiveStrategy/useAdaptiveStrategyLearning";
import { useDashboardData } from "@/hooks/useDashboardData";

export const Route = createFileRoute("/app/ia")({
  component: IAPage,
});

function IAPage() {
  const { data, mode } = useDashboardData();
  const { snapshot, resetAdaptiveLearning } = useAdaptiveStrategyLearning(
    data,
    mode === "live" && !data.mockMode,
  );

  return (
    <div className="space-y-4">
      <LocalAiChatCard adaptiveSnapshot={snapshot} />
      <AdaptiveStrategyLearningPanel snapshot={snapshot} onReset={resetAdaptiveLearning} />
    </div>
  );
}
