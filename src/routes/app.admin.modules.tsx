import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { getModuleToggles, readAdminSession, updateModuleToggles } from "@/lib/adminApi";
import { readEffectiveAdminSession } from "@/lib/adminSession";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { ModuleToggles } from "@/types/dashboard";

export const Route = createFileRoute("/app/admin/modules")({
  component: AdminModulesPage,
});

const futureModules = ["Leitura Neural", "Assistente de Voz", "Modo Demonstracao"];

function AdminModulesPage() {
  const session = readEffectiveAdminSession() || readAdminSession();
  const [toggles, setToggles] = useState<ModuleToggles>({ tieAlert: true, surfAnalyzer: true });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    getModuleToggles(session).then(setToggles).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar modulos."));
  }, []);

  async function save(next: Partial<ModuleToggles>) {
    if (!session) return;
    try {
      const updated = await updateModuleToggles(session, next);
      setToggles(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar modulo.");
    }
  }

  if (!session) {
    return (
      <GlassCard className="border-destructive/35">
        <SectionTitle title="Acesso administrativo bloqueado" />
        <p className="text-sm text-muted-foreground">Somente admin ou owner pode configurar modulos.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="border-neon-cyan/25">
      <SectionTitle title="CONFIGURAR MODULOS" subtitle="Ative ou desative recursos operacionais do painel." right={<Settings2 className="size-5 text-neon-cyan" />} />
      {error && <div className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ModuleSwitch label="Tie Alert" checked={toggles.tieAlert} onChange={(checked) => void save({ tieAlert: checked })} />
        <ModuleSwitch label="Surf Analyzer" checked={toggles.surfAnalyzer} onChange={(checked) => void save({ surfAnalyzer: checked })} />
        {futureModules.map((label) => (
          <ModuleSwitch key={label} label={label} checked disabled onChange={() => undefined} />
        ))}
      </div>
    </GlassCard>
  );
}

function ModuleSwitch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-neon-cyan/15 bg-background/35 px-4 py-4">
      <span className="font-black">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
