import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function MobileCardDetailsTrigger({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-neon-cyan hover:text-neon-blue"
        >
          Ver detalhes <ChevronRight className="size-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-neon-cyan/20 bg-background/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-[0.16em]">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
