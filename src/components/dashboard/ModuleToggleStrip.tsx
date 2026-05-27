import { cn } from "@/lib/utils";
import { readAdminSession, updateModuleToggles } from "@/lib/adminApi";
import type { ModuleToggles } from "@/types/dashboard";
import { BrainCircuit, Loader2, Power, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const DEFAULT_TOGGLES: ModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};

export function ModuleToggleStrip({ toggles }: { toggles?: ModuleToggles }) {
  const [local, setLocal] = useState<ModuleToggles>(toggles ?? DEFAULT_TOGGLES);
  const [busyKey, setBusyKey] = useState<keyof ModuleToggles | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (toggles) setLocal(toggles);
  }, [toggles?.tieAlert, toggles?.surfAnalyzer]);

  async function toggle(key: keyof ModuleToggles) {
    const session = readAdminSession();
    if (!session) {
      setNote("Entre no admin para controlar");
      window.setTimeout(() => setNote(""), 2200);
      return;
    }

    const next = { ...local, [key]: !local[key] };
    setLocal(next);
    setBusyKey(key);
    setNote("");
    try {
      const saved = await updateModuleToggles(session, { [key]: next[key] });
      setLocal(saved);
    } catch (error) {
      setLocal(local);
      setNote(error instanceof Error ? error.message : "Não foi possível atualizar");
      window.setTimeout(() => setNote(""), 2600);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      <MiniSwitch
        label="Tie"
        active={local.tieAlert}
        busy={busyKey === "tieAlert"}
        icon={<BrainCircuit className="size-3" />}
        onClick={() => toggle("tieAlert")}
      />
      <MiniSwitch
        label="Surf"
        active={local.surfAnalyzer}
        busy={busyKey === "surfAnalyzer"}
        icon={<Waves className="size-3" />}
        onClick={() => toggle("surfAnalyzer")}
      />
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
  busy,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  busy: boolean;
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
        {busy ? <Loader2 className="size-3 animate-spin" /> : icon}
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
