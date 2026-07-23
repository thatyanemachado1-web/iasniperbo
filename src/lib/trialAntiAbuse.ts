export const TRIAL_PHONE_MIN_DIGITS = 8;
export const TRIAL_PHONE_MAX_DIGITS = 15;
export const TRIAL_DEVICE_COOKIE_NAME = "sb_trial_device";
export const TRIAL_DEVICE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
export const TRIAL_DEFAULT_IP_DAILY_GRANT_LIMIT = 3;

export const TRIAL_ANTI_ABUSE_REASON = {
  invalidEmail: "invalid_email",
  invalidPhone: "invalid_phone",
  emailAlreadyClaimed: "email_already_claimed",
  deviceAlreadyClaimed: "device_already_claimed",
  phoneAlreadyClaimed: "phone_already_claimed",
  ipDailyLimitReached: "ip_daily_limit_reached",
  storageUnavailable: "storage_unavailable",
} as const;

export type TrialAntiAbuseReason =
  (typeof TRIAL_ANTI_ABUSE_REASON)[keyof typeof TRIAL_ANTI_ABUSE_REASON];

const TRIAL_ANTI_ABUSE_REASON_VALUES = new Set<string>(Object.values(TRIAL_ANTI_ABUSE_REASON));

const TRIAL_ANTI_ABUSE_ADMIN_MESSAGES: Readonly<Record<TrialAntiAbuseReason, string>> = {
  invalid_email: "E-mail invalido para concessao do teste gratuito.",
  invalid_phone: "Telefone invalido para concessao do teste gratuito.",
  email_already_claimed: "Teste gratuito ja utilizado por este e-mail canonico.",
  device_already_claimed: "Teste gratuito ja utilizado neste dispositivo.",
  phone_already_claimed: "Teste gratuito ja utilizado por este telefone.",
  ip_daily_limit_reached: "Limite diario de testes gratuitos atingido para esta rede.",
  storage_unavailable:
    "Armazenamento antifraude indisponivel; teste gratuito nao concedido por seguranca.",
};

const TRIAL_ALREADY_USED_PUBLIC_MESSAGE =
  "O teste gratuito ja foi utilizado. Entre na conta existente ou escolha um plano para continuar.";

/**
 * Produces the stable, case-insensitive representation used before provider-specific canonicalization.
 * It deliberately does not remove internal whitespace or provider-specific aliases.
 */
export function normalizeTrialEmail(value: unknown) {
  return normalizeCompatibilityText(value).trim().toLowerCase();
}

/**
 * Canonicalizes aliases only for Gmail/Googlemail, whose dot and plus-tag behavior is well known.
 * Other providers keep their local part intact because those characters may identify different mailboxes.
 */
export function canonicalizeTrialEmail(value: unknown) {
  const normalized = normalizeTrialEmail(value);
  const parts = splitEmailAddress(normalized);
  if (!parts) return normalized;

  const { localPart, domain } = parts;
  if (domain !== "gmail.com" && domain !== "googlemail.com") return normalized;

  const gmailLocalPart = localPart.split("+", 1)[0]?.replace(/\./g, "") || "";
  return gmailLocalPart ? `${gmailLocalPart}@gmail.com` : normalized;
}

/** Lightweight validation for the unquoted addresses accepted by the registration UI. */
export function isValidTrialEmail(value: unknown) {
  const normalized = normalizeTrialEmail(value);
  if (!normalized || normalized.length > 254) return false;

  const parts = splitEmailAddress(normalized);
  if (!parts) return false;
  const { localPart, domain } = parts;

  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return false;
  }
  if (hasUnsafeEmailCharacter(localPart) || hasUnsafeEmailCharacter(domain)) return false;
  if (
    domain.length > 253 ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  )
    return false;

  return domain.split(".").every((label) => {
    return Boolean(label) && label.length <= 63 && !label.startsWith("-") && !label.endsWith("-");
  });
}

/**
 * Converts an international phone to digits suitable for hashing. A leading international `00` is removed.
 * This function normalizes but does not hide invalid input; use isValidTrialPhoneDigits before granting a trial.
 */
export function normalizeTrialPhoneDigits(value: unknown) {
  const normalized = normalizeCompatibilityText(value).trim();
  let digits = normalized.replace(/\D/g, "");
  if (startsWithInternationalDialPrefix(normalized) && digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  return digits;
}

export function isValidTrialPhoneDigits(value: unknown) {
  const digits = normalizeTrialPhoneDigits(value);
  return (
    digits.length >= TRIAL_PHONE_MIN_DIGITS &&
    digits.length <= TRIAL_PHONE_MAX_DIGITS &&
    /^[1-9]\d+$/.test(digits)
  );
}

/** Returns normalized E.164-ish digits, or an empty string when the input is invalid. */
export function canonicalizeTrialPhone(value: unknown) {
  const digits = normalizeTrialPhoneDigits(value);
  return isValidTrialPhoneDigits(digits) ? digits : "";
}

/**
 * Combines a country calling code with a national number. If the phone is explicitly international (`+` or
 * `00`), it is used as-is, preventing an accidental duplicated country code.
 */
export function buildTrialE164Digits(countryCallingCode: unknown, nationalPhone: unknown) {
  const rawPhone = normalizeCompatibilityText(nationalPhone).trim();
  if (rawPhone.startsWith("+") || startsWithInternationalDialPrefix(rawPhone)) {
    return canonicalizeTrialPhone(rawPhone);
  }

  const countryDigits = normalizeTrialPhoneDigits(countryCallingCode);
  if (!/^[1-9]\d{0,2}$/.test(countryDigits)) return "";

  const nationalDigits = rawPhone.replace(/\D/g, "");
  if (!nationalDigits) return "";
  return canonicalizeTrialPhone(`${countryDigits}${nationalDigits}`);
}

export function isTrialAntiAbuseReason(value: unknown): value is TrialAntiAbuseReason {
  return TRIAL_ANTI_ABUSE_REASON_VALUES.has(String(value || ""));
}

/** Specific text intended for internal audit fields and the admin panel. */
export function trialAntiAbuseAdminMessage(reason: TrialAntiAbuseReason) {
  return TRIAL_ANTI_ABUSE_ADMIN_MESSAGES[reason];
}

/** Generic text for clients; it does not reveal which identity signal matched. */
export function trialAntiAbusePublicMessage(reason: TrialAntiAbuseReason) {
  if (reason === TRIAL_ANTI_ABUSE_REASON.invalidEmail)
    return "Informe um e-mail valido para continuar.";
  if (reason === TRIAL_ANTI_ABUSE_REASON.invalidPhone)
    return "Informe um telefone valido para continuar.";
  if (reason === TRIAL_ANTI_ABUSE_REASON.storageUnavailable) {
    return "Nao foi possivel validar o teste gratuito agora. Tente novamente ou escolha um plano para continuar.";
  }
  return TRIAL_ALREADY_USED_PUBLIC_MESSAGE;
}

function normalizeCompatibilityText(value: unknown) {
  return String(value ?? "").normalize("NFKC");
}

function splitEmailAddress(value: string) {
  const separator = value.indexOf("@");
  if (separator <= 0 || separator !== value.lastIndexOf("@") || separator === value.length - 1)
    return null;
  return {
    localPart: value.slice(0, separator),
    domain: value.slice(separator + 1),
  };
}

function hasUnsafeEmailCharacter(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) || 0;
    return /\s/u.test(character) || codePoint <= 0x1f || codePoint === 0x7f;
  });
}

function startsWithInternationalDialPrefix(value: string) {
  return value.replace(/^[\s(]*/, "").startsWith("00");
}
