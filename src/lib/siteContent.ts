export type AnnouncementTone = "info" | "success" | "warning" | "danger";

export interface SiteContentSettings {
  shareTitle: string;
  shareDescription: string;
  shareImageUrl: string;
  faviconUrl: string;
  bannerEnabled: boolean;
  bannerTitle: string;
  bannerMessage: string;
  bannerTone: AnnouncementTone;
  popupEnabled: boolean;
  popupTitle: string;
  popupMessage: string;
  popupTone: AnnouncementTone;
  popupButtonLabel: string;
  popupButtonUrl: string;
  popupAudience: string;
  popupId: string;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_SITE_CONTENT_SETTINGS: SiteContentSettings = {
  shareTitle: "SNIPER BO IA - Painel operacional com IA",
  shareDescription:
    "Painel operacional BAC BO com leitura estatística e assistente IA em tempo real.",
  shareImageUrl: "/sniper-icon.svg",
  faviconUrl: "/sniper-icon.svg",
  bannerEnabled: false,
  bannerTitle: "Aviso importante",
  bannerMessage: "",
  bannerTone: "info",
  popupEnabled: false,
  popupTitle: "Aviso importante",
  popupMessage: "",
  popupTone: "info",
  popupButtonLabel: "",
  popupButtonUrl: "",
  popupAudience: "all",
  popupId: "initial",
  updatedAt: "",
  updatedBy: "",
};

export function normalizeSiteContentSettings(
  value: unknown,
  fallback: SiteContentSettings = DEFAULT_SITE_CONTENT_SETTINGS,
): SiteContentSettings {
  const record = readRecord(value);
  return {
    shareTitle: readText(record.shareTitle) || fallback.shareTitle,
    shareDescription: readText(record.shareDescription) || fallback.shareDescription,
    shareImageUrl: hasOwn(record, "shareImageUrl")
      ? normalizeAssetUrl(record.shareImageUrl) || DEFAULT_SITE_CONTENT_SETTINGS.shareImageUrl
      : fallback.shareImageUrl,
    faviconUrl: hasOwn(record, "faviconUrl")
      ? normalizeAssetUrl(record.faviconUrl) || DEFAULT_SITE_CONTENT_SETTINGS.faviconUrl
      : fallback.faviconUrl,
    bannerEnabled:
      typeof record.bannerEnabled === "boolean" ? record.bannerEnabled : fallback.bannerEnabled,
    bannerTitle: readText(record.bannerTitle) || fallback.bannerTitle,
    bannerMessage: hasOwn(record, "bannerMessage")
      ? readText(record.bannerMessage)
      : fallback.bannerMessage,
    bannerTone: normalizeAnnouncementTone(record.bannerTone, fallback.bannerTone),
    popupEnabled:
      typeof record.popupEnabled === "boolean" ? record.popupEnabled : fallback.popupEnabled,
    popupTitle: readText(record.popupTitle) || fallback.popupTitle,
    popupMessage: hasOwn(record, "popupMessage")
      ? readText(record.popupMessage)
      : fallback.popupMessage,
    popupTone: normalizeAnnouncementTone(record.popupTone, fallback.popupTone),
    popupButtonLabel: hasOwn(record, "popupButtonLabel")
      ? readText(record.popupButtonLabel)
      : fallback.popupButtonLabel,
    popupButtonUrl: hasOwn(record, "popupButtonUrl")
      ? normalizeAssetUrl(record.popupButtonUrl)
      : fallback.popupButtonUrl,
    popupAudience: normalizeAudience(record.popupAudience) || fallback.popupAudience,
    popupId: readText(record.popupId) || fallback.popupId,
    updatedAt: readText(record.updatedAt) || readText(record.updated_at) || fallback.updatedAt,
    updatedBy: readText(record.updatedBy) || readText(record.updated_by) || fallback.updatedBy,
  };
}

export function normalizeAnnouncementTone(
  value: unknown,
  fallback: AnnouncementTone = "info",
): AnnouncementTone {
  const tone = String(value || "").trim().toLowerCase();
  return tone === "success" || tone === "warning" || tone === "danger" || tone === "info"
    ? tone
    : fallback;
}

export function normalizeAssetUrl(value: unknown) {
  const text = readText(value);
  if (!text) return "";
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  if (/^https?:\/\//i.test(text)) return text;
  return "";
}

function normalizeAudience(value: unknown) {
  const audience = String(value || "").trim().toLowerCase();
  return ["all", "premium", "trial", "expired"].includes(audience) ? audience : "";
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readText(value: unknown) {
  return String(value || "").trim().slice(0, 1200);
}
