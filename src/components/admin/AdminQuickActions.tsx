import {
  Ban,
  CalendarPlus,
  Crown,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
} from "lucide-react";
import type { ReactNode } from "react";

type QuickAction =
  | "trial7"
  | "monthly30"
  | "premium30"
  | "vip30"
  | "extend7"
  | "extend15"
  | "extend30"
  | "extend90"
  | "cancel"
  | "block"
  | "unblock"
  | "deleteUser"
  | "makeAdmin"
  | "removeAdmin";

const actions: Array<{
  id: QuickAction;
  label: string;
  tone: "primary" | "gold" | "red" | "muted";
  icon: ReactNode;
}> = [
  {
    id: "trial7",
    label: "Liberar Trial 7 dias",
    tone: "primary",
    icon: <CalendarPlus className="size-4" />,
  },
  {
    id: "monthly30",
    label: "Liberar Mensal 30 dias",
    tone: "primary",
    icon: <CalendarPlus className="size-4" />,
  },
  {
    id: "premium30",
    label: "Liberar Premium 30 dias",
    tone: "gold",
    icon: <Crown className="size-4" />,
  },
  {
    id: "vip30",
    label: "Liberar VIP Manual 30 dias",
    tone: "gold",
    icon: <ShieldCheck className="size-4" />,
  },
  {
    id: "extend7",
    label: "Prorrogar +7 dias",
    tone: "primary",
    icon: <CalendarPlus className="size-4" />,
  },
  {
    id: "extend15",
    label: "Prorrogar +15 dias",
    tone: "primary",
    icon: <CalendarPlus className="size-4" />,
  },
  {
    id: "extend30",
    label: "Prorrogar +30 dias",
    tone: "primary",
    icon: <CalendarPlus className="size-4" />,
  },
  {
    id: "extend90",
    label: "Prorrogar +90 dias",
    tone: "primary",
    icon: <CalendarPlus className="size-4" />,
  },
  { id: "cancel", label: "Cancelar acesso", tone: "red", icon: <UserMinus className="size-4" /> },
  { id: "block", label: "Bloquear usuario", tone: "red", icon: <Ban className="size-4" /> },
  {
    id: "unblock",
    label: "Reativar usuario",
    tone: "primary",
    icon: <UserCheck className="size-4" />,
  },
  { id: "deleteUser", label: "Excluir cadastro", tone: "red", icon: <Trash2 className="size-4" /> },
  { id: "makeAdmin", label: "Tornar admin", tone: "muted", icon: <UserCog className="size-4" /> },
  {
    id: "removeAdmin",
    label: "Remover admin",
    tone: "muted",
    icon: <UserMinus className="size-4" />,
  },
];

export function AdminQuickActions({
  disabled = false,
  compact = false,
  onAction,
}: {
  disabled?: boolean;
  compact?: boolean;
  onAction: (action: QuickAction) => void;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-2 ${compact ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2"}`}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={disabled}
          onClick={() => onAction(action.id)}
          className={buttonClass(action.tone)}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}

export type { QuickAction };

function buttonClass(tone: "primary" | "gold" | "red" | "muted") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition disabled:opacity-50";
  if (tone === "gold") return `${base} btn-gold-grad glow-gold`;
  if (tone === "red")
    return `${base} border border-destructive/35 bg-destructive/15 text-destructive hover:bg-destructive/20`;
  if (tone === "muted")
    return `${base} border border-neon-purple/30 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/15`;
  return `${base} border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/15`;
}
