import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { readUserSession } from "@/lib/userSession";

export const Route = createFileRoute("/app")({
  component: ProtectedAppRoute,
});

function ProtectedAppRoute() {
  const navigate = useNavigate();
  const session = readUserSession();

  useEffect(() => {
    if (!session.email) {
      navigate({ to: "/" });
    }
  }, [navigate, session.email]);

  if (!session.email) return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
