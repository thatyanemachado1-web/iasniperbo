import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "blue" | "purple" | "green" | "red" | "amber" | "gold" | "muted";

const tones: Record<Tone, string> = {
  blue: "bg-neon-blue/15 text-neon-blue border-neon-blue/30",
  purple: "bg-neon-purple/15 text-neon-purple border-neon-purple/30",
  green: "bg-success/15 text-success border-success/30",
  red: "bg-destructive/15 text-destructive border-destructive/30",
  amber: "bg-warning/15 text-warning border-warning/30",
  gold: "bg-gold/15 text-gold border-gold/40",
  muted: "bg-muted/40 text-muted-foreground border-border",
};

export function AppBadge({
  tone = "blue",
  pulse = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      )}
      {...props}
    >
      {pulse && <span className="size-1.5 rounded-full bg-current animate-status-blink" />}
      {children}
    </span>
  );
}