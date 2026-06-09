import { createFileRoute } from "@tanstack/react-router";
import { LocalAiChatCard } from "@/components/ai/LocalAiChatCard";
import { AdaptiveStrategyLearningPanel } from "@/components/adaptiveStrategy/AdaptiveStrategyLearningPanel";
import { useAdaptiveStrategyLearning } from "@/adaptiveStrategy/useAdaptiveStrategyLearning";
import { useDashboardData } from "@/hooks/useDashboardData";

export const Route = createFileRoute("/app/ia")({
  component: IAPage,
  head: () => ({
    meta: [
      { title: "Chat IA — Análise da mesa BAC BO | SNIPER BO IA" },
      { name: "description", content: "Converse com o assistente IA do SNIPER BO IA para analisar leituras, tendências e padrões da mesa BAC BO ao vivo." },
      { property: "og:title", content: "Chat IA — SNIPER BO IA" },
      { property: "og:description", content: "Assistente IA local para analisar leituras e tendências da mesa BAC BO." },
      { property: "og:url", content: "https://sniperbo.com/app/ia" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://sniperbo.com/app/ia" }],
  }),
});

function IAPage() {
  const { data, mode } = useDashboardData();
  const { snapshot, resetAdaptiveLearning } = useAdaptiveStrategyLearning(
    data,
    mode === "live" && !data.mockMode,
  );

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Chat de análise IA da mesa BAC BO</h1>
      <LocalAiChatCard adaptiveSnapshot={snapshot} />
      <AdaptiveStrategyLearningPanel snapshot={snapshot} onReset={resetAdaptiveLearning} />
    </div>
  );
}
