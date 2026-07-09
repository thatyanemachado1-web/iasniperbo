import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AdminQuickActions, type QuickAction } from "@/components/admin/AdminQuickActions";
import type { AdminManagedUser } from "@/types/adminPanel";

const roles: AdminManagedUser["role"][] = ["user", "admin", "owner"];

const planOptions: Array<{ value: AdminManagedUser["plan"]; label: string }> = [
  { value: "free", label: "Free" },
  { value: "trial", label: "Trial" },
  { value: "monthly", label: "Mensal" },
  { value: "premium", label: "Premium" },
  { value: "vip_manual", label: "VIP manual" },
];

const statusOptions: Array<{ value: AdminManagedUser["subscriptionStatus"]; label: string }> = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Ativo" },
  { value: "expired", label: "Vencido" },
  { value: "canceled", label: "Cancelado" },
  { value: "blocked", label: "Bloqueado" },
  { value: "manual_vip", label: "VIP manual" },
];

export function AdminUserEditModal({
  user,
  currentAdminRole,
  busy,
  error,
  onClose,
  onSave,
  onQuickAction,
}: {
  user: AdminManagedUser | null;
  currentAdminRole: "admin" | "owner";
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (payload: Partial<AdminManagedUser> & { reason?: string }) => void;
  onQuickAction: (action: QuickAction, user: AdminManagedUser) => void;
}) {
  const [draft, setDraft] = useState<AdminManagedUser | null>(user);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setDraft(user);
    setReason("");
  }, [user]);

  if (!user || !draft) return null;

  const adminCanChangeRole = currentAdminRole === "owner";
  const adminCanEditTarget = currentAdminRole === "owner" || user.role === "user";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="max-h-[96vh] w-full overflow-y-auto rounded-t-3xl border border-neon-cyan/25 bg-background shadow-2xl sm:max-w-5xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-neon-cyan">
              Editar usuário
            </div>
            <h2 className="mt-1 text-xl font-black">{user.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-border/70 bg-secondary/40"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[1fr_0.75fr] sm:p-6">
          <div className="space-y-4">
            <div className="rounded-2xl border border-neon-cyan/15 bg-secondary/15 p-3">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neon-cyan">Acesso</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Plano atual">
                  <select
                    className="admin-input"
                    value={draft.plan}
                    disabled={!adminCanEditTarget}
                    onChange={(event) => {
                      const plan = event.target.value as AdminManagedUser["plan"];
                      setDraft({
                        ...draft,
                        plan,
                        subscriptionStatus: plan === "free" ? "canceled" : draft.subscriptionStatus,
                      });
                    }}
                  >
                    {planOptions.map((plan) => (
                      <option key={plan.value} value={plan.value}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status da assinatura">
                  <select
                    className="admin-input"
                    value={draft.subscriptionStatus}
                    disabled={!adminCanEditTarget}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        subscriptionStatus: event.target.value as AdminManagedUser["subscriptionStatus"],
                      })
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Inicio">
                  <input
                    className="admin-input"
                    type="date"
                    value={toInputDate(draft.currentPeriodStart)}
                    disabled={!adminCanEditTarget}
                    onChange={(event) =>
                      setDraft({ ...draft, currentPeriodStart: fromInputDate(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Vencimento">
                  <input
                    className="admin-input"
                    type="date"
                    value={toInputDate(draft.currentPeriodEnd)}
                    disabled={!adminCanEditTarget}
                    onChange={(event) =>
                      setDraft({ ...draft, currentPeriodEnd: fromInputDate(event.target.value, true) })
                    }
                  />
                </Field>
                <Field label="Acesso">
                  <label className="flex min-h-11 items-center justify-between rounded-xl border border-border/60 bg-secondary/35 px-3 text-sm">
                    <span>{draft.isBlocked ? "Bloqueado" : "Ativo"}</span>
                    <input
                      type="checkbox"
                      checked={!draft.isBlocked}
                      disabled={!adminCanEditTarget}
                      onChange={(event) => setDraft({ ...draft, isBlocked: !event.target.checked })}
                    />
                  </label>
                </Field>
                <Field label="Role">
                  <select
                    className="admin-input"
                    value={draft.role}
                    disabled={!adminCanChangeRole}
                    onChange={(event) =>
                      setDraft({ ...draft, role: event.target.value as AdminManagedUser["role"] })
                    }
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <input
                  className="admin-input"
                  value={draft.name}
                  disabled={!adminCanEditTarget}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
              <Field label="E-mail">
                <input
                  className="admin-input"
                  value={draft.email}
                  disabled={!adminCanEditTarget}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                />
              </Field>
              <Field label="DDI">
                <input
                  className="admin-input"
                  value={draft.countryCode}
                  disabled={!adminCanEditTarget}
                  placeholder="+55"
                  onChange={(event) => setDraft({ ...draft, countryCode: event.target.value })}
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  className="admin-input"
                  value={draft.phone}
                  disabled={!adminCanEditTarget}
                  placeholder="67992308362"
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                />
              </Field>
              <Field label="Cidade">
                <input
                  className="admin-input"
                  value={draft.city}
                  disabled={!adminCanEditTarget}
                  onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                />
              </Field>
              <Field label="País">
                <input
                  className="admin-input"
                  value={draft.country}
                  disabled={!adminCanEditTarget}
                  placeholder="Brasil"
                  onChange={(event) => setDraft({ ...draft, country: event.target.value })}
                />
              </Field>
            </div>

            <Field label="Observacao interna">
              <textarea
                className="admin-input min-h-24 resize-none"
                value={draft.adminNote}
                disabled={!adminCanEditTarget}
                onChange={(event) => setDraft({ ...draft, adminNote: event.target.value })}
              />
            </Field>
            <Field label="Motivo da alteração">
              <textarea
                className="admin-input min-h-20 resize-none"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Opcional, mas recomendado para auditoria."
              />
            </Field>

            {error && (
              <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={busy || !adminCanEditTarget}
              onClick={() => onSave({ ...draft, reason })}
              className="btn-primary-grad inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50"
            >
              Salvar alteracoes
            </button>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-neon-cyan/15 bg-secondary/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-neon-cyan">
                Acoes rapidas
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Toda ação fica registrada em logs administrativos.
              </p>
            </div>
            <AdminQuickActions
              disabled={busy || !adminCanEditTarget}
              onAction={(action) => onQuickAction(action, user)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function toInputDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function fromInputDate(value: string, endOfDay = false) {
  if (!value) return "";
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
