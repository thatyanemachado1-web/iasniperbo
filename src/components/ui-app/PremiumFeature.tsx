import type { ReactNode } from "react";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { canSeeAdminUi } from "@/lib/adminSession";
import { hasSignalAccess, readUserSession } from "@/lib/userSession";

interface PremiumFeatureProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function PremiumFeature({
  children,
  title = "Ferramenta completa bloqueada",
  description = "Entre em contato ou finalize o checkout para liberar.",
  className = "",
}: PremiumFeatureProps) {
  const allowed = hasSignalAccess(readUserSession()) || canSeeAdminUi();
  if (allowed) return className ? <div className={className}>{children}</div> : <>{children}</>;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div className="pointer-events-none select-none blur-[2px] opacity-55">
        {children}
      </div>
      <PremiumLock title={title} description={description} ctaLabel="Ir para checkout" intensity="light" />
    </div>
  );
}
