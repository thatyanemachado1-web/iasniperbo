import type { RoundResult } from "@/types/dashboard";

export const NEUTRAL_SIDE_CHIP_CLASS =
  "border-border/60 bg-secondary/25 text-foreground";

export const PLAYER_SIDE_CHIP_CLASS =
  "border-player/35 bg-player/10 text-player";

export const BANKER_SIDE_CHIP_CLASS =
  "border-banker/30 bg-banker/8 text-banker";

export const TIE_SIDE_CHIP_CLASS =
  "border-tie/35 bg-tie/10 text-tie";

export const sideTextClass: Record<RoundResult, string> = {
  B: "text-banker",
  P: "text-player",
  T: "text-tie",
};

export const sideBgClass: Record<RoundResult, string> = {
  B: BANKER_SIDE_CHIP_CLASS,
  P: PLAYER_SIDE_CHIP_CLASS,
  T: TIE_SIDE_CHIP_CLASS,
};

export const sideDotClass: Record<RoundResult, string> = {
  B: "border-banker/60 bg-banker text-white shadow-[0_0_14px_-6px_var(--banker)]",
  P: "border-player/60 bg-player text-white shadow-[0_0_14px_-6px_var(--player)]",
  T: "border-tie/70 bg-tie text-background shadow-[0_0_14px_-6px_var(--tie)]",
};

export function dashboardSideTextClass(
  side: "BANKER" | "PLAYER" | "TIE" | "B" | "P" | "T" | null | undefined,
) {
  if (side === "BANKER" || side === "B") return "text-banker";
  if (side === "PLAYER" || side === "P") return "text-player";
  if (side === "TIE" || side === "T") return "text-tie";
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
  if (side === "PLAYER") return PLAYER_SIDE_CHIP_CLASS;
  if (side === "TIE") return TIE_SIDE_CHIP_CLASS;
  return NEUTRAL_SIDE_CHIP_CLASS;
}
