import { RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listAdminLogs } from "@/lib/adminApi";
import { readEffectiveAdminSession } from "@/lib/adminSession";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AdminActionLogTable } from "@/components/admin/AdminActionLogTable";
import type { AdminActionLog } from "@/types/adminPanel";

export function AdminLogsPage() {
  const session = readEffectiveAdminSession();
  const [logs, setLogs] = useState<AdminActionLog[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      setLogs(await listAdminLogs(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const clean = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (clean && !`${log.adminEmail} ${log.targetEmail} ${log.adminUserId} ${log.targetUserId}`.toLowerCase().includes(clean)) return false;
      if (action !== "all" && log.action !== action) return false;
      if (date && !log.createdAt.startsWith(date)) return false;
      return true;
    });
  }, [logs, search, action, date]);

  if (!session) {
    return (
      <GlassCard className="border-destructive/35">
        <SectionTitle title="Acesso administrativo bloqueado" />
        <p className="text-sm text-muted-foreground">Somente admin ou owner pode ver logs administrativos.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      <GlassCard className="border-neon-cyan/25">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle title="LOGS ADMINISTRATIVOS" subtitle="Auditoria de alterações em usuários, planos e permissões." />
          <button type="button" onClick={() => void load()} className="glass inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-neon-cyan">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.7fr]">
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 focus-within:border-neon-cyan/70">
            <Search className="size-4 text-neon-cyan" />
            <input className="w-full bg-transparent text-sm outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar por admin ou usuário" />
          </label>
          <select className="admin-input" value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="all">Todas as ações</option>
            <option value="UPDATE_USER">UPDATE_USER</option>
            <option value="UPDATE_PLAN">UPDATE_PLAN</option>
            <option value="EXTEND_ACCESS">EXTEND_ACCESS</option>
            <option value="BLOCK_USER">BLOCK_USER</option>
            <option value="UNBLOCK_USER">UNBLOCK_USER</option>
            <option value="UPDATE_ROLE">UPDATE_ROLE</option>
            <option value="MANUAL_VIP_GRANTED">MANUAL_VIP_GRANTED</option>
            <option value="CANCEL_ACCESS">CANCEL_ACCESS</option>
          </select>
          <input className="admin-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>

        {error && <div className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      </GlassCard>

      <AdminActionLogTable logs={filtered} />
    </div>
  );
}
