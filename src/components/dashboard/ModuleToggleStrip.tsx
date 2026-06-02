import { cn } from "@/lib/utils";
import type { ModuleToggles } from "@/types/dashboard";
import { BrainCircuit, Power, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const DEFAULT_TOGGLES: ModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};

export function ModuleToggleStrip({
  toggles,
  modules = ["tieAlert", "surfAnalyzer"],
  onChange,
}: {
  toggles?: ModuleToggles;
  modules?: Array<keyof ModuleToggles>;
  onChange?: (toggles: ModuleToggles) => void;
}) {
  const [local, setLocal] = useState<ModuleToggles>(toggles ?? DEFAULT_TOGGLES);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (toggles) setLocal(toggles);
  }, [toggles?.tieAlert, toggles?.surfAnalyzer]);

  function toggle(key: keyof ModuleToggles) {
    const next = { ...local, [key]: !local[key] };
    setLocal(next);
    onChange?.(next);
    setNote("Preferência salva neste painel");
    window.setTimeout(() => setNote(""), 1800);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      {modules.includes("tieAlert") && (
        <MiniSwitch
          label="Tie"
          active={local.tieAlert}
          icon={<BrainCircuit className="size-3" />}
          onClick={() => toggle("tieAlert")}
        />
      )}
      {modules.includes("surfAnalyzer") && (
        <MiniSwitch
          label="Surf"
          active={local.surfAnalyzer}
          icon={<Waves className="size-3" />}
          onClick={() => toggle("surfAnalyzer")}
        />
      )}
      {note && (
        <span className="basis-full text-right text-[9px] font-semibold text-warning sm:basis-auto">
          {note}
        </span>
      )}
    </div>
  );
}

function MiniSwitch({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex h-7 items-center gap-1.5 rounded-full border px-1.5 text-[9px] font-black uppercase tracking-[0.12em] backdrop-blur-xl transition",
        active
          ? "border-neon-cyan/35 bg-neon-cyan/10 text-neon-cyan shadow-[0_0_18px_-12px_var(--neon-cyan)]"
          : "border-border/70 bg-secondary/35 text-muted-foreground",
      )}
      aria-pressed={active}
      aria-label={`${active ? "Desativar" : "Ativar"} análise ${label}`}
      title={`${active ? "Desativar" : "Ativar"} análise ${label}`}
    >
      <span className="grid size-4 place-items-center rounded-full bg-background/45">
        {icon}
      </span>
      <span>{label}</span>
      <span
        className={cn(
          "relative h-4 w-7 rounded-full border transition",
          active ? "border-success/40 bg-success/20" : "border-muted-foreground/25 bg-background/50",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 grid size-3 -translate-y-1/2 place-items-center rounded-full transition",
            active
              ? "right-0.5 bg-success text-background shadow-[0_0_10px_var(--success)]"
              : "left-0.5 bg-muted-foreground/55 text-background",
          )}
        >
          <Power className="size-2" />
        </span>
      </span>
      <span className={cn("text-[8px]", active ? "text-success" : "text-muted-foreground")}>
        {active ? "ON" : "OFF"}
      </span>
    </button>
  );
}
