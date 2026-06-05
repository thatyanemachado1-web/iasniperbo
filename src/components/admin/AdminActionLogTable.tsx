import { AdminBadge } from "@/components/admin/AdminBadge";
import type { AdminActionLog } from "@/types/adminPanel";

export function AdminActionLogTable({ logs }: { logs: AdminActionLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-neon-cyan/15 bg-background/35 px-4 py-12 text-center text-sm text-muted-foreground">
        Nenhuma alteração administrativa registrada ainda.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neon-cyan/15 bg-background/35">
      <div className="hidden lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data/hora</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">Antes/depois</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border/45 align-top">
                <td className="px-4 py-3">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{log.adminEmail || log.adminUserId}</td>
                <td className="px-4 py-3 text-muted-foreground">{log.targetEmail || log.targetUserId}</td>
                <td className="px-4 py-3"><AdminBadge tone="role">{log.action}</AdminBadge></td>
                <td className="px-4 py-3">{log.reason || "-"}</td>
                <td className="px-4 py-3">
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer text-neon-cyan">Ver JSON</summary>
                    <pre className="mt-2 max-h-52 overflow-auto rounded-xl bg-black/40 p-3">{JSON.stringify({ before: log.beforeJson, after: log.afterJson }, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {logs.map((log) => (
          <article key={log.id} className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <AdminBadge tone="role">{log.action}</AdminBadge>
              <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div><span className="text-muted-foreground">Admin:</span> {log.adminEmail || log.adminUserId}</div>
              <div><span className="text-muted-foreground">Usuário:</span> {log.targetEmail || log.targetUserId}</div>
              <div><span className="text-muted-foreground">Motivo:</span> {log.reason || "-"}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleString("pt-BR");
}
