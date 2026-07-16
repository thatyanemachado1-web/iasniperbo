import { ExternalLink, Maximize2, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { elementBounds, isNativeLiveHouseAvailable, LiveHouseNative } from "@/lib/liveHouseNative";

const ESPORTIVA_AFFILIATE_URL = "https://go.aff.esportiva.bet/glfml929";

export function LiveHouseCard() {
  const [frameKey, setFrameKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [nativeMode, setNativeMode] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const nativeVisibleRef = useRef(false);

  useEffect(() => {
    setNativeMode(isNativeLiveHouseAvailable());
  }, []);

  useEffect(() => {
    if (!nativeMode || !viewportRef.current) return;
    const viewport = viewportRef.current;
    let frame = 0;
    let disposed = false;

    const syncNativeViewport = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (disposed) return;
        const bounds = elementBounds(viewport);
        const visible =
          bounds.width > 1 &&
          bounds.height > 1 &&
          bounds.top < window.innerHeight &&
          bounds.top + bounds.height > 0;

        if (!visible) {
          if (nativeVisibleRef.current) {
            nativeVisibleRef.current = false;
            void LiveHouseNative.hide();
          }
          return;
        }

        if (!nativeVisibleRef.current) {
          nativeVisibleRef.current = true;
          void LiveHouseNative.show({ url: ESPORTIVA_AFFILIATE_URL, ...bounds });
          return;
        }
        void LiveHouseNative.updateBounds(bounds);
      });
    };

    const observer = new ResizeObserver(syncNativeViewport);
    observer.observe(viewport);
    window.addEventListener("resize", syncNativeViewport);
    window.addEventListener("scroll", syncNativeViewport, true);
    syncNativeViewport();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", syncNativeViewport);
      window.removeEventListener("scroll", syncNativeViewport, true);
      nativeVisibleRef.current = false;
      void LiveHouseNative.destroy();
    };
  }, [nativeMode]);

  function openOfficialPlatform() {
    window.open(ESPORTIVA_AFFILIATE_URL, "sniperbo-esportiva");
  }

  function reloadPlatform() {
    if (nativeMode) {
      void LiveHouseNative.reload();
      return;
    }
    setFrameKey((current) => current + 1);
  }

  return (
    <GlassCard
      className={
        expanded
          ? "fixed inset-2 z-[70] flex flex-col p-2 sm:inset-4 sm:p-3"
          : "flex min-h-[calc(100svh-7.5rem)] flex-col p-2 sm:p-3"
      }
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-neon-cyan">
            <span className="size-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
            Mesa ao vivo
          </div>
          <p className="truncate text-[10px] text-muted-foreground">Esportiva.bet</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={reloadPlatform}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background/50 text-muted-foreground transition hover:border-neon-cyan/50 hover:text-neon-cyan"
            aria-label="Recarregar plataforma"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background/50 text-muted-foreground transition hover:border-neon-cyan/50 hover:text-neon-cyan"
            aria-label={expanded ? "Reduzir plataforma" : "Expandir plataforma"}
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={openOfficialPlatform}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 text-[10px] font-bold text-neon-cyan transition hover:bg-neon-cyan/15"
          >
            Abrir oficial <ExternalLink className="size-3" />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative overflow-hidden rounded-xl border border-neon-cyan/20 bg-[#020712] ${
          expanded ? "min-h-0 flex-1" : "min-h-[560px] flex-1 sm:min-h-[680px]"
        }`}
      >
        {nativeMode ? (
          <div className="absolute inset-0 grid place-items-center bg-[#020712] px-6 text-center">
            <div>
              <span className="mx-auto mb-3 block size-6 animate-spin rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan" />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neon-cyan">
                Plataforma ao vivo
              </p>
              <p className="mt-1 text-[9px] text-muted-foreground">
                Carregando a WebView segura da Esportiva…
              </p>
            </div>
          </div>
        ) : (
          <iframe
            key={frameKey}
            src={ESPORTIVA_AFFILIATE_URL}
            title="Plataforma Esportiva ao vivo"
            className="absolute inset-0 size-full border-0 bg-white"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}

        {!nativeMode && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
            <div className="pointer-events-auto flex max-w-xl items-start gap-2 rounded-xl border border-amber-400/25 bg-[#07101e]/95 px-3 py-2 text-[9px] leading-relaxed text-slate-300 shadow-2xl backdrop-blur-xl sm:text-[10px]">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
              <span>
                Se a casa bloquear esta janela no navegador, use “Abrir oficial”. No aplicativo
                móvel, este espaço será substituído pela WebView nativa.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-1 pt-2 text-[9px] text-muted-foreground">
        <span>Jogue com responsabilidade.</span>
        <span className="font-bold text-neon-cyan/80">+18</span>
      </div>
    </GlassCard>
  );
}
