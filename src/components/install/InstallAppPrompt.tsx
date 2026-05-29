import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "sniper_install_prompt_dismissed";

export function InstallAppPrompt() {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    hidePublicEditorBadge();
    const interval = window.setInterval(hidePublicEditorBadge, 1200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "yes") return;
    if (isStandaloneApp()) return;

    const timer = window.setTimeout(() => setVisible(true), 900);
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const isIos = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  if (!visible) return null;

  async function openInstallFlow() {
    if (installPrompt && !isIos) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") closePrompt();
      return;
    }
    setModalOpen(true);
  }

  function closePrompt() {
    window.localStorage.setItem(DISMISSED_KEY, "yes");
    setVisible(false);
    setModalOpen(false);
  }

  return (
    <>
      <div
        data-sniper-install
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[9998] sm:inset-x-auto sm:right-5 sm:w-[420px]"
      >
        <div className="rounded-2xl border border-neon-cyan/25 bg-[#101329]/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openInstallFlow}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label="Instalar aplicativo SNIPER BO IA"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-neon-cyan/30 bg-gradient-to-br from-neon-blue/25 to-neon-purple/25">
                <Smartphone className="size-6 text-neon-cyan" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-black leading-tight text-white">Instalar Aplicativo</div>
                <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Adicione o SNIPER BO IA na tela inicial
                </div>
              </div>
              <Download className="ml-auto size-5 shrink-0 text-neon-cyan" />
            </button>
            <button
              type="button"
              onClick={closePrompt}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80"
              aria-label="Fechar aviso de instalacao"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end bg-black/70 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full rounded-3xl border border-neon-cyan/20 bg-[#151515] p-5 text-white shadow-2xl sm:max-w-lg">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">📱</div>
                <div>
                  <h2 className="text-2xl font-light tracking-wide">Instalar Aplicativo</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Siga os passos para adicionar à tela inicial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80"
                aria-label="Fechar instrucoes"
              >
                <X className="size-6" />
              </button>
            </div>

            <div className="space-y-3">
              <InstallStep number="1">
                Toque no botão <strong>Compartilhar</strong> <Share className="ml-1 inline size-5 align-[-3px]" />
              </InstallStep>
              <InstallStep number="2">
                Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>
              </InstallStep>
              <InstallStep number="3">
                Toque em <strong>Adicionar</strong> no canto superior direito
              </InstallStep>
            </div>

            <div className="mt-5 rounded-2xl border border-neon-blue/20 bg-neon-blue/10 px-4 py-3 text-sm text-neon-cyan">
              Após instalado, o app abre na tela inicial como qualquer outro aplicativo.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InstallStep({ number, children }: { number: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white/[0.07] px-4 py-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neon-blue text-xl font-black text-white">
        {number}
      </div>
      <div className="text-lg leading-snug text-white/90">{children}</div>
    </div>
  );
}

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function hidePublicEditorBadge() {
  const selectors = [
    'a[href*="lovable" i]',
    'iframe[src*="lovable" i]',
    '[aria-label*="lovable" i]',
    '[data-lovable]',
    '[data-testid*="lovable" i]',
  ];

  document.querySelectorAll<HTMLElement>(selectors.join(",")).forEach((element) => {
    if (element.closest("[data-sniper-install]")) return;
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    element.setAttribute("aria-hidden", "true");
  });

  document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
    const text = element.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
    const classOrId = `${element.className || ""} ${element.id || ""}`.toLowerCase();
    const looksLikeLovable = text.includes("edit with") && text.includes("lovable");
    const namedLovable = classOrId.includes("lovable");
    if (!looksLikeLovable && !namedLovable) return;
    const style = window.getComputedStyle(element);
    if (style.position === "fixed" || style.position === "sticky") {
      element.style.setProperty("display", "none", "important");
      element.style.setProperty("visibility", "hidden", "important");
      element.setAttribute("aria-hidden", "true");
    }
  });
}
