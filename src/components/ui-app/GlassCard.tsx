import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-4 sm:p-5 relative overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}