import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";

export const Route = createFileRoute("/app/admin/users")({
  component: AdminUsersPage,
  head: () => ({
    meta: [
      { title: "Usuários — Administração SNIPER BO IA" },
      { name: "description", content: "Gerenciamento de usuários, acessos e assinaturas do SNIPER BO IA." },
      { property: "og:url", content: "https://sniperbo.com/app/admin/users" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://sniperbo.com/app/admin/users" }],
  }),
});
