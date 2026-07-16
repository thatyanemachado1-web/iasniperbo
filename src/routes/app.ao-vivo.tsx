import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/ao-vivo")({
  component: LivePlayPage,
});

function LivePlayPage() {
  return null;
}
