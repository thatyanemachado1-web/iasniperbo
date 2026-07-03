import { createFileRoute } from "@tanstack/react-router";
import { useAdaptiveStrategyLearning } from "@/adaptiveStrategy/useAdaptiveStrategyLearning";
import { AiAgentsCommandCenter } from "@/components/agents/AiAgentsCommandCenter";
import { useDashboardData, isDashboardLive } from "@/hooks/useDashboardData";

export const Route = createFileRoute("/app/agentes")({
  component: AgentsPage,
});

function AgentsPage() {
  const { data, mode } = useDashboardData();
  const liveReady = isDashboardLive(data, mode);
  const { snapshot } = useAdaptiveStrategyLearning(data, liveReady);

  return <AiAgentsCommandCenter data={data} adaptiveSnapshot={snapshot} liveReady={liveReady} />;
}
