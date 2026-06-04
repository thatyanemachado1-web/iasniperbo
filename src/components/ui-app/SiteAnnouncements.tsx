import { Bell, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getPublicSiteContent } from "@/lib/siteContentApi";
import {
  DEFAULT_SITE_CONTENT_SETTINGS,
  type AnnouncementTone,
  type SiteContentSettings,
} from "@/lib/siteContent";

const REFRESH_MS = 45_000;

const toneStyles: Record<AnnouncementTone, { frame: string; badge: string; text: string }> = {
  info: {
    frame: "border-neon-cyan/35 bg-background/95 text-foreground",
    badge: "bg-neon-cyan/15 text-neon-cyan",
    text: "text-neon-cyan",
  },
  success: {
    frame: "border-success/35 bg-success/10 text-foreground",
    badge: "bg-success/15 text-success",
    text: "text-success",
  },
  warning: {
    frame: "border-amber-400/45 bg-amber-500/10 text-foreground",
    badge: "bg-amber-400/15 text-amber-200",
    text: "text-amber-200",
  },
  danger: {
    frame: "border-destructive/45 bg-destructive/10 text-foreground",
    badge: "bg-destructive/15 text-destructive",
    text: "text-destructive",
  },
};

export function SiteAnnouncements() {
  const [settings, setSettings] = useState<SiteContentSettings>(DEFAULT_SITE_CONTENT_SETTINGS);
  const [popupOpen, setPopupOpen] = useState(false);
  const popupStorageKey = useMemo(
    () => `sniper_site_popup_seen_${settings.popupId}`,
    [settings.popupId],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        const next = await getPublicSiteContent(controller.signal);
        if (active) setSettings(next);
      } catch {
        if (active) setSettings(DEFAULT_SITE_CONTENT_SETTINGS);
      }
    }

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    applyRuntimeHead(settings);
  }, [settings]);

  useEffect(() => {
    if (!settings.popupEnabled || !settings.popupMessage) {
      setPopupOpen(false);
      return;
    }
    const dismissed = window.localStorage.getItem(popupStorageKey);
    setPopupOpen(!dismissed);
  }, [popupStorageKey, settings.popupEnabled, settings.popupMessage]);

  function dismissPopup() {
    window.localStorage.setItem(popupStorageKey, "1");
    setPopupOpen(false);
  }

  const bannerTone = toneStyles[settings.bannerTone] ?? toneStyles.info;
  const popupTone = toneStyles[settings.popupTone] ?? toneStyles.info;
  const showBanner = settings.bannerEnabled && Boolean(settings.bannerMessage);

  return (
    <>
      {showBanner && (
        <div className="pointer-events-none fixed inset-x-3 top-3 z-[70] flex justify-center">
          <div
            className={`pointer-events-auto flex w-full max-w-4xl items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${bannerTone.frame}`}
          >
            <div className={`mt-0.5 rounded-full p-2 ${bannerTone.badge}`}>
              <Bell className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-black uppercase tracking-[0.18em] ${bannerTone.text}`}>
                {settings.bannerTitle}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {settings.bannerMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {popupOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-4 py-5 backdrop-blur-sm sm:items-center">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${popupTone.frame}`}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-xs font-black uppercase tracking-[0.18em] ${popupTone.text}`}>
                  Notificacao
                </div>
                <h2 className="mt-2 text-xl font-black text-foreground">{settings.popupTitle}</h2>
              </div>
              <button
                type="button"
                onClick={dismissPopup}
                className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition hover:text-foreground"
                aria-label="Fechar aviso"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {settings.popupMessage}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {settings.popupButtonLabel && settings.popupButtonUrl && (
                <a
                  href={settings.popupButtonUrl}
                  className="btn-primary-grad inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black"
                >
                  {settings.popupButtonLabel}
                  <ExternalLink className="size-4" />
                </a>
              )}
              <button
                type="button"
                onClick={dismissPopup}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-foreground transition hover:border-neon-cyan/35"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function applyRuntimeHead(settings: SiteContentSettings) {
  if (typeof document === "undefined") return;
  document.title = settings.shareTitle;
  upsertMeta("name", "description", settings.shareDescription);
  upsertMeta("property", "og:title", settings.shareTitle);
  upsertMeta("property", "og:description", settings.shareDescription);
  upsertMeta("property", "og:type", "website");
  upsertMeta("name", "twitter:title", settings.shareTitle);
  upsertMeta("name", "twitter:description", settings.shareDescription);
  upsertMeta("name", "twitter:card", settings.shareImageUrl ? "summary_large_image" : "summary");
  if (settings.shareImageUrl) {
    upsertMeta("property", "og:image", absolutizeUrl(settings.shareImageUrl));
    upsertMeta("name", "twitter:image", absolutizeUrl(settings.shareImageUrl));
  }
  if (settings.faviconUrl) {
    upsertLink("icon", settings.faviconUrl);
    upsertLink("apple-touch-icon", settings.faviconUrl);
  }
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

function absolutizeUrl(value: string) {
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}
