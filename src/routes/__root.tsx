import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { InstallAppPrompt } from "@/components/install/InstallAppPrompt";
import { SiteAnnouncements } from "@/components/ui-app/SiteAnnouncements";

const ASSET_RELOAD_KEY = "sniper_asset_reload_failure";
const ASSET_ERROR_RE = /failed to fetch dynamically imported module|importing a module script failed|loading chunk|chunkloaderror|preload/i;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          A página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu uma falha temporária. Tente novamente ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#030712" },
      { title: "SNIPER BO IA - Painel operacional com IA" },
      {
        name: "description",
        content: "Painel operacional BAC BO com leitura estatística e assistente IA em tempo real.",
      },
      { property: "og:title", content: "SNIPER BO IA - Painel operacional com IA" },
      {
        property: "og:description",
        content: "Painel operacional BAC BO com leitura estatística e assistente IA em tempo real.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/favicon.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SNIPER BO IA - Painel operacional com IA" },
      {
        name: "twitter:description",
        content: "Painel operacional BAC BO com leitura estatística e assistente IA em tempo real.",
      },
      { name: "twitter:image", content: "/favicon.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <ClientOnlyEnhancements />
    </QueryClientProvider>
  );
}

function ClientOnlyEnhancements() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return installAssetReloadGuard();
  }, []);

  if (!mounted) return null;

  return (
    <>
      <InstallAppPrompt />
      <SiteAnnouncements />
    </>
  );
}

function installAssetReloadGuard() {
  if (typeof window === "undefined") return () => undefined;

  const recover = (failure: string) => {
    const failureId = failure.slice(0, 220);
    if (window.sessionStorage.getItem(ASSET_RELOAD_KEY) === failureId) return;
    window.sessionStorage.setItem(ASSET_RELOAD_KEY, failureId);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("sbv", String(Date.now()));
    window.location.replace(nextUrl.toString());
  };

  const onVitePreloadError = (event: Event) => {
    event.preventDefault();
    recover("vite-preload");
  };

  const onResourceError = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLScriptElement && target.src.includes("/assets/")) {
      recover(target.src);
      return;
    }
    if (target instanceof HTMLLinkElement && target.href.includes("/assets/")) {
      recover(target.href);
      return;
    }

    const message = "message" in event ? String(event.message || "") : "";
    if (ASSET_ERROR_RE.test(message)) recover(message);
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const message = String(event.reason?.message || event.reason || "");
    if (!ASSET_ERROR_RE.test(message)) return;
    event.preventDefault();
    recover(message);
  };

  window.addEventListener("vite:preloadError", onVitePreloadError);
  window.addEventListener("error", onResourceError, true);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("vite:preloadError", onVitePreloadError);
    window.removeEventListener("error", onResourceError, true);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
