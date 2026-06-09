import { createFileRoute } from "@tanstack/react-router";
import { useAdaptiveStrategyLearning } from "@/adaptiveStrategy/useAdaptiveStrategyLearning";
import { AiAgentsCommandCenter } from "@/components/agents/AiAgentsCommandCenter";
import { useDashboardData } from "@/hooks/useDashboardData";

export const Route = createFileRoute("/app/agentes")({
  component: AgentsPage,
  head: () => ({
    meta: [
      { title: "Central de Agentes IA — SNIPER BO IA" },
      { name: "description", content: "Central de agentes IA do SNIPER BO IA: orquestre leitura adaptativa, validação de estratégias e narração ao vivo da mesa BAC BO." },
      { property: "og:title", content: "Central de Agentes IA — SNIPER BO IA" },
      { property: "og:description", content: "Agentes IA coordenando leitura, validação e narração da mesa BAC BO." },
      { property: "og:url", content: "https://sniperbo.com/app/agentes" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://sniperbo.com/app/agentes" }],
  }),
});

function AgentsPage() {
  const { data, mode } = useDashboardData();
  const liveReady = mode === "live" && data.mockMode === false;
  const { snapshot } = useAdaptiveStrategyLearning(data, liveReady);

  return (
    <>
      <h1 className="sr-only">Central de Agentes IA SNIPER BO</h1>
      <AiAgentsCommandCenter data={data} adaptiveSnapshot={snapshot} liveReady={liveReady} />
    </>
  );
}
