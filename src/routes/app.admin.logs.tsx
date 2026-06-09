import { createFileRoute } from "@tanstack/react-router";
import { AdminLogsPage } from "@/components/admin/AdminLogsPage";

export const Route = createFileRoute("/app/admin/logs")({
  component: AdminLogsPage,
  head: () => ({
    meta: [
      { title: "Logs administrativos — SNIPER BO IA" },
      { name: "description", content: "Auditoria e logs de eventos administrativos do SNIPER BO IA." },
      { property: "og:url", content: "https://sniperbo.com/app/admin/logs" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://sniperbo.com/app/admin/logs" }],
  }),
});
