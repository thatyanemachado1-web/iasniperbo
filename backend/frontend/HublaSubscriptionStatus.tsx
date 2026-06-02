import { useEffect, useState } from "react";

type SubscriptionStatus = {
  email: string;
  plan: string;
  status: string;
  active: boolean;
  expires_at: string | null;
};

export function HublaSubscriptionStatus({ token }: { token: string }) {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.VITE_FASTAPI_URL || ""}/api/me/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Nao foi possivel carregar sua assinatura.");
        return response.json();
      })
      .then((data) => {
        if (active) setSubscription(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Erro de assinatura.");
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (error) return <div className="text-sm text-red-400">{error}</div>;
  if (!subscription) return <div className="text-sm text-slate-400">Carregando assinatura...</div>;

  return (
    <div className="rounded-xl border border-cyan-400/30 bg-slate-950/70 p-4">
      <div className="text-xs uppercase tracking-widest text-cyan-300">Minha assinatura</div>
      <div className="mt-2 text-lg font-bold text-white">{subscription.active ? "Plano ativo" : "Plano inativo"}</div>
      <div className="mt-3 grid gap-2 text-sm text-slate-300">
        <span>Plano: {subscription.plan}</span>
        <span>Status: {subscription.status}</span>
        <span>Vencimento: {subscription.expires_at ? formatDate(subscription.expires_at) : "Sem data"}</span>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
