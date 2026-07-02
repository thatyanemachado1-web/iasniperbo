import type { RoundResult } from "@/types/dashboard";

export const NEUTRAL_SIDE_CHIP_CLASS =
  "border-border/60 bg-secondary/25 text-foreground";

export const BANKER_SIDE_CHIP_CLASS =
  "border-banker/30 bg-banker/8 text-banker";

export const sideTextClass: Record<RoundResult, string> = {
  B: "text-banker",
  P: "text-muted-foreground",
  T: "text-muted-foreground",
};

export const sideBgClass: Record<RoundResult, string> = {
  B: BANKER_SIDE_CHIP_CLASS,
  P: NEUTRAL_SIDE_CHIP_CLASS,
  T: NEUTRAL_SIDE_CHIP_CLASS,
};

export const sideDotClass: Record<RoundResult, string> = {
  B: "border-banker/60 bg-banker text-white shadow-[0_0_14px_-6px_var(--banker)]",
  P: "border-border/60 bg-secondary/50 text-foreground",
  T: "border-border/60 bg-secondary/50 text-foreground",
};

export function dashboardSideTextClass(
  side: "BANKER" | "PLAYER" | "TIE" | "B" | "P" | "T" | null | undefined,
) {
  if (side === "BANKER" || side === "B") return "text-banker";
  if (!side) return "text-muted-foreground";
  return "text-muted-foreground";
}

export function dashboardSideChipTone(
  side: "BANKER" | "PLAYER" | "NONE" | null | undefined,
): "banker" | "muted" {
  if (side === "BANKER") return "banker";
  return "muted";
}

export function dashboardSideChipClass(
  side: "BANKER" | "PLAYER" | "TIE" | null | undefined,
) {
  if (side === "BANKER") return BANKER_SIDE_CHIP_CLASS;
  return NEUTRAL_SIDE_CHIP_CLASS;
}
