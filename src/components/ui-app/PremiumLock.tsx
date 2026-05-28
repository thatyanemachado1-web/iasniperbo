import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface PremiumLockProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  intensity?: "light" | "strong";
}

export function PremiumLock({
  title = "Recurso Premium",
  description = "Leitura em tempo real bloqueada",
  ctaLabel = "Desbloquear Premium",
  intensity = "strong",
}: PremiumLockProps) {
  const navigate = useNavigate();
  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl text-center px-4 ${
        intensity === "strong" ? "backdrop-blur-md" : "backdrop-blur-sm"
      }`}
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, #030712 70%, transparent), color-mix(in oklab, #030712 85%, transparent))",
      }}
    >
      <div className="relative">
        <div className="absolute inset-0 blur-xl bg-gold/40 rounded-full" />
        <div className="relative size-12 rounded-full glass-strong border border-gold/50 flex items-center justify-center glow-gold">
          <Lock className="size-5 text-gold" />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-gold">{title}</div>
        <div className="mt-1 text-sm text-foreground">{description}</div>
      </div>
      <button
        onClick={() => navigate({ to: "/app/planos" })}
        className="btn-primary-grad inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
      >
        <Sparkles className="size-4" />
        {ctaLabel}
      </button>
    </div>
  );
}
