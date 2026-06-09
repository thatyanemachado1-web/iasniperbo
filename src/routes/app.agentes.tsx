import { createFileRoute } from "@tanstack/react-router";
import { useAdaptiveStrategyLearning } from "@/adaptiveStrategy/useAdaptiveStrategyLearning";
import { AiAgentsCommandCenter } from "@/components/agents/AiAgentsCommandCenter";
import { useDashboardData } from "@/hooks/useDashboardData";

export const Route = createFileRoute("/app/agentes")({
  component: AgentsPage,
});

function AgentsPage() {
  const { data, mode } = useDashboardData();
  const liveReady = mode === "live" && data.mockMode === false;
  const { snapshot } = useAdaptiveStrategyLearning(data, liveReady);

  return <AiAgentsCommandCenter data={data} adaptiveSnapshot={snapshot} liveReady={liveReady} />;
}
