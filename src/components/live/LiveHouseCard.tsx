import { ExternalLink, Maximize2, Play, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { LiveSignalSelector } from "@/components/live/LiveSignalSelector";
import { elementBounds, isNativeLiveHouseAvailable, LiveHouseNative } from "@/lib/liveHouseNative";

const ESPORTIVA_AFFILIATE_URL = "https://go.aff.esportiva.bet/glfml929";
// This official host redirects to esportiva.bet.br and is also accepted by the Android WebView allowlist.
const ESPORTIVA_BAC_BO_URL = "https://esportiva.bet/games/evolution/bac-bo";
// v2 requires one confirmed affiliate-page load before Bac Bo can be persisted.
const LIVE_HOUSE_TARGET_STORAGE_KEY = "sniperbo:live-house-target:v2";
const BAC_BO_TARGET = "bac-bo";

export function LiveHouseCard() {
  const [frameKey, setFrameKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [nativeMode, setNativeMode] = useState(false);
  const [platformUrl, setPlatformUrl] = useState(ESPORTIVA_AFFILIATE_URL);
  const [destinationReady, setDestinationReady] = useState(false);
  const [affiliatePageLoaded, setAffiliatePageLoaded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const nativeVisibleRef = useRef(false);
  const platformUrlRef = useRef(ESPORTIVA_AFFILIATE_URL);

  useEffect(() => {
    setNativeMode(isNativeLiveHouseAvailable());
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LIVE_HOUSE_TARGET_STORAGE_KEY) === BAC_BO_TARGET) {
        platformUrlRef.current = ESPORTIVA_BAC_BO_URL;
        setPlatformUrl(ESPORTIVA_BAC_BO_URL);
        setAffiliatePageLoaded(true);
      }
    } catch {
      // Continue with the affiliate landing page when storage is unavailable.
    } finally {
      setDestinationReady(true);
    }
  }, []);

  useEffect(() => {
    if (!nativeMode) return;

    let disposed = false;
    const listener = LiveHouseNative.addListener("pageFinished", ({ requestedUrl }) => {
      if (!disposed && requestedUrl === ESPORTIVA_AFFILIATE_URL) {
        setAffiliatePageLoaded(true);
      }
    });

    return () => {
      disposed = true;
      void listener.then((handle) => handle.remove());
    };
  }, [nativeMode]);

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
          void LiveHouseNative.show({ url: platformUrlRef.current, ...bounds });
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

  function openBacBo() {
    if (platformUrlRef.current !== ESPORTIVA_BAC_BO_URL && !affiliatePageLoaded) return;

    platformUrlRef.current = ESPORTIVA_BAC_BO_URL;
    setPlatformUrl(ESPORTIVA_BAC_BO_URL);
    try {
      window.localStorage.setItem(LIVE_HOUSE_TARGET_STORAGE_KEY, BAC_BO_TARGET);
    } catch {
      // Navigation still works for the current visit when storage is unavailable.
    }
    if (!nativeMode || !viewportRef.current) return;

    nativeVisibleRef.current = true;
    void LiveHouseNative.show({
      url: ESPORTIVA_BAC_BO_URL,
      ...elementBounds(viewportRef.current),
    });
  }

  function reloadPlatform() {
    if (platformUrlRef.current === ESPORTIVA_AFFILIATE_URL) {
      setAffiliatePageLoaded(false);
    }
    if (nativeMode) {
      void LiveHouseNative.reload();
      return;
    }
    setFrameKey((current) => current + 1);
  }

  const bacBoActive = platformUrl === ESPORTIVA_BAC_BO_URL;
  const canOpenBacBo = bacBoActive || affiliatePageLoaded;

  return (
    <GlassCard
      className={
        expanded
          ? "fixed inset-2 z-[70] flex flex-col p-2 sm:inset-4 sm:p-3"
          : "flex min-h-[calc(100svh-7.5rem)] flex-col p-2 sm:p-3"
      }
    >
      <div className="flex flex-col gap-2 px-1 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-neon-cyan">
            <span className="size-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
            Mesa ao vivo
          </div>
          <p className="truncate text-[10px] text-muted-foreground">Esportiva.bet</p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:shrink-0">
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
          <button
            type="button"
            onClick={openBacBo}
            disabled={!canOpenBacBo}
            aria-pressed={bacBoActive}
            title={canOpenBacBo ? undefined : "Aguarde o seu link de afiliado terminar de carregar"}
            className="inline-flex min-h-8 max-w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/12 px-2.5 py-1 text-center text-[10px] font-black leading-tight text-emerald-300 transition hover:bg-emerald-400/20 disabled:cursor-wait disabled:border-border/60 disabled:bg-background/40 disabled:text-muted-foreground"
          >
            {bacBoActive
              ? "Bac Bo aberto"
              : affiliatePageLoaded
                ? "Já concluí o cadastro/login — abrir Bac Bo"
                : "Aguarde o link de afiliado carregar"}{" "}
            <Play className="size-3 shrink-0 fill-current" />
          </button>
        </div>
      </div>

      <LiveSignalSelector />

      <div
        ref={viewportRef}
        className={`relative overflow-hidden rounded-xl border border-neon-cyan/20 bg-[#020712] ${
          expanded ? "min-h-0 flex-1" : "min-h-[560px] flex-1 sm:min-h-[680px]"
        }`}
      >
        {nativeMode || !destinationReady ? (
          <div className="absolute inset-0 grid place-items-center bg-[#020712] px-6 text-center">
            <div>
              <span className="mx-auto mb-3 block size-6 animate-spin rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan" />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neon-cyan">
                Plataforma ao vivo
              </p>
              <p className="mt-1 text-[9px] text-muted-foreground">Carregando a Esportiva…</p>
            </div>
          </div>
        ) : (
          <iframe
            key={frameKey}
            src={platformUrl}
            onLoad={() => {
              if (platformUrl === ESPORTIVA_AFFILIATE_URL) {
                setAffiliatePageLoaded(true);
              }
            }}
            title="Plataforma Esportiva ao vivo"
            className="absolute inset-0 size-full border-0 bg-white"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-1 pt-2 text-[9px] text-muted-foreground">
        <span>Jogue com responsabilidade.</span>
        <span className="font-bold text-neon-cyan/80">+18</span>
      </div>
    </GlassCard>
  );
}
