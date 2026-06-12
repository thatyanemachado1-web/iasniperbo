import { MessageCircle, ShieldCheck } from "lucide-react";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { cn } from "@/lib/utils";

const WAITLIST_URL = "https://wa.me/5567992308362";

export function SalesClosedPanel({
  onClientLogin,
  className,
  fullHeight = true,
}: {
  onClientLogin?: () => void;
  className?: string;
  fullHeight?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-app px-4 py-10 flex items-center justify-center",
        fullHeight ? "min-h-screen" : "min-h-[62vh] rounded-2xl border border-neon-cyan/20",
        className,
      )}
    >
      <div className="absolute inset-0 scan-grid opacity-[0.18] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none">
        <NeuralLines cx={50} cy={48} count={18} opacity={0.38} reach={1.25} />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 42% at 50% 35%, color-mix(in oklab, var(--neon-blue) 24%, transparent), transparent 62%), radial-gradient(ellipse 40% 40% at 50% 70%, color-mix(in oklab, var(--neon-purple) 22%, transparent), transparent 68%)",
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        <AppBadge tone="red">Modo Vendas Encerradas</AppBadge>
        <h1 className="mt-5 text-4xl font-black tracking-normal text-white sm:text-6xl">
          VAGAS TOTALMENTE ENCERRADAS
        </h1>
        <div className="mt-5 max-w-2xl space-y-3 text-sm leading-6 text-muted-foreground sm:text-base">
          <p>No momento, o acesso ao Sniper BO IA está fechado para novos membros.</p>
          <p>Somente clientes Premium com acesso ativo conseguem acessar a plataforma.</p>
          <p>A próxima abertura de vagas será comunicada oficialmente.</p>
        </div>

        <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClientLogin}
            className="btn-primary-grad inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black glow-blue"
          >
            <ShieldCheck className="size-4" />
            JÁ SOU CLIENTE PREMIUM
          </button>
          <a
            href={WAITLIST_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10 px-5 py-3 text-sm font-black text-neon-cyan hover:glow-blue"
          >
            <MessageCircle className="size-4" />
            ENTRAR NA FILA DE ESPERA
          </a>
        </div>
      </div>
    </div>
  );
}
