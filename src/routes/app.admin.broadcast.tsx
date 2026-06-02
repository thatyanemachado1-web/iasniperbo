import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Send } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { sendAdminBroadcast } from "@/lib/adminApi";
import { readEffectiveAdminSession } from "@/lib/adminSession";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";

export const Route = createFileRoute("/app/admin/broadcast")({
  component: AdminBroadcastPage,
});

function AdminBroadcastPage() {
  const session = readEffectiveAdminSession();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setStatus("");
    try {
      await sendAdminBroadcast(session, { title, message, audience });
      setStatus("Aviso registrado com sucesso. O envio real pode ser conectado ao provedor de notificacoes depois.");
      setTitle("");
      setMessage("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Falha ao registrar aviso.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <GlassCard className="border-destructive/35">
        <SectionTitle title="Acesso administrativo bloqueado" />
        <p className="text-sm text-muted-foreground">Somente admin ou owner pode enviar aviso geral.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="border-neon-cyan/25">
      <SectionTitle title="ENVIAR AVISO GERAL" subtitle="Prepare comunicados para usuarios por publico alvo." right={<Megaphone className="size-5 text-neon-cyan" />} />
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Titulo
          <input className="admin-input mt-2" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Mensagem
          <textarea className="admin-input mt-2 min-h-36 resize-none" value={message} onChange={(event) => setMessage(event.target.value)} required />
        </label>
        <label className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Publico alvo
          <select className="admin-input mt-2" value={audience} onChange={(event) => setAudience(event.target.value)}>
            <option value="all">Todos</option>
            <option value="premium">Premium</option>
            <option value="trial">Trial</option>
            <option value="expired">Vencidos</option>
          </select>
        </label>
        {status && <div className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-2 text-sm text-neon-cyan">{status}</div>}
        <button type="submit" disabled={busy} className="btn-primary-grad inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50">
          <Send className="size-4" />
          Enviar aviso geral
        </button>
      </form>
    </GlassCard>
  );
}
