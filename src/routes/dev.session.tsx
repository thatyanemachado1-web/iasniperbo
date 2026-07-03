import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  bootstrapLocalDevSession,
  isLocalFrontend,
  localDevAppUrl,
  LOCAL_DEV_SESSION_EMAIL,
} from "@/lib/localDevSession";
import { readUserSession } from "@/lib/userSession";

export const Route = createFileRoute("/dev/session")({
  component: DevSessionPage,
});

function DevSessionPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "blocked">("loading");

  useEffect(() => {
    if (!isLocalFrontend()) {
      setStatus("blocked");
      return;
    }

    bootstrapLocalDevSession();
    setStatus("ready");
    const timer = window.setTimeout(() => {
      window.location.assign(localDevAppUrl());
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  const session = readUserSession();

  if (status === "blocked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 text-white">
        <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <h1 className="text-lg font-black uppercase">Somente localhost</h1>
          <p className="mt-2 text-sm text-slate-300">
            A sessão de preview local só funciona em <code>127.0.0.1</code> ou{" "}
            <code>localhost</code>.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-semibold text-neon-cyan">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 text-white">
      <div className="max-w-md rounded-2xl border border-neon-cyan/25 bg-neon-cyan/10 p-6 text-center">
        <h1 className="text-lg font-black uppercase">Sessão local pronta</h1>
        <p className="mt-2 text-sm text-slate-300">
          {status === "loading"
            ? "Configurando preview VIP com dashboard de produção..."
            : "Redirecionando para o painel..."}
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left text-xs text-slate-300">
          <div>
            <span className="text-slate-500">Email:</span> {session.email || LOCAL_DEV_SESSION_EMAIL}
          </div>
          <div>
            <span className="text-slate-500">Plano:</span> VIP · preview local
          </div>
          <div>
            <span className="text-slate-500">Dashboard:</span> sniperbo.com
          </div>
        </div>
        <Link to={localDevAppUrl()} className="mt-4 inline-block text-sm font-semibold text-neon-cyan">
          Abrir /app agora
        </Link>
      </div>
    </div>
  );
}
