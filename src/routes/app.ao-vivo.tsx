import { createFileRoute } from "@tanstack/react-router";
import { LiveHouseCard } from "@/components/live/LiveHouseCard";

export const Route = createFileRoute("/app/ao-vivo")({
  component: LivePlayPage,
});

function LivePlayPage() {
  return <LiveHouseCard />;
}
