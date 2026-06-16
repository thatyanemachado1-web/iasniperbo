export type CountryDialOption = {
  id: string;
  flag: string;
  country: string;
  code: string;
  minDigits: number;
  maxDigits: number;
};

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { id: "BR", flag: "🇧🇷", country: "Brasil", code: "+55", minDigits: 10, maxDigits: 11 },
  { id: "PT", flag: "🇵🇹", country: "Portugal", code: "+351", minDigits: 9, maxDigits: 9 },
  { id: "US", flag: "🇺🇸", country: "Estados Unidos", code: "+1", minDigits: 10, maxDigits: 10 },
  { id: "CA", flag: "🇨🇦", country: "Canadá", code: "+1", minDigits: 10, maxDigits: 10 },
  { id: "MX", flag: "🇲🇽", country: "México", code: "+52", minDigits: 10, maxDigits: 10 },
  { id: "AR", flag: "🇦🇷", country: "Argentina", code: "+54", minDigits: 10, maxDigits: 11 },
  { id: "CL", flag: "🇨🇱", country: "Chile", code: "+56", minDigits: 9, maxDigits: 9 },
  { id: "CO", flag: "🇨🇴", country: "Colômbia", code: "+57", minDigits: 10, maxDigits: 10 },
  { id: "PE", flag: "🇵🇪", country: "Peru", code: "+51", minDigits: 9, maxDigits: 9 },
  { id: "PY", flag: "🇵🇾", country: "Paraguai", code: "+595", minDigits: 9, maxDigits: 9 },
  { id: "UY", flag: "🇺🇾", country: "Uruguai", code: "+598", minDigits: 8, maxDigits: 9 },
  { id: "ES", flag: "🇪🇸", country: "Espanha", code: "+34", minDigits: 9, maxDigits: 9 },
  { id: "GB", flag: "🇬🇧", country: "Reino Unido", code: "+44", minDigits: 10, maxDigits: 11 },
  { id: "FR", flag: "🇫🇷", country: "França", code: "+33", minDigits: 9, maxDigits: 9 },
  { id: "DE", flag: "🇩🇪", country: "Alemanha", code: "+49", minDigits: 7, maxDigits: 12 },
  { id: "IT", flag: "🇮🇹", country: "Itália", code: "+39", minDigits: 8, maxDigits: 11 },
  { id: "CV", flag: "🇨🇻", country: "Cabo Verde", code: "+238", minDigits: 7, maxDigits: 7 },
  { id: "AO", flag: "🇦🇴", country: "Angola", code: "+244", minDigits: 9, maxDigits: 9 },
  { id: "MZ", flag: "🇲🇿", country: "Moçambique", code: "+258", minDigits: 9, maxDigits: 9 },
];

export const DEFAULT_COUNTRY_DIAL = COUNTRY_DIAL_OPTIONS[0];

export function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeCountryCode(value: unknown) {
  const digits = digitsOnly(value);
  return digits ? `+${digits}` : "";
}

export function findCountryDialOption(country?: string, countryCode?: string) {
  const normalizedCountry = normalizeText(country);
  const normalizedCode = normalizeCountryCode(countryCode);
  return (
    COUNTRY_DIAL_OPTIONS.find((option) => normalizeText(option.country) === normalizedCountry) ||
    COUNTRY_DIAL_OPTIONS.find((option) => option.id.toLowerCase() === String(country || "").toLowerCase()) ||
    COUNTRY_DIAL_OPTIONS.find((option) => option.code === normalizedCode) ||
    DEFAULT_COUNTRY_DIAL
  );
}

export function maskPhoneForCountry(value: unknown, option: CountryDialOption) {
  const digits = digitsOnly(value).slice(0, option.maxDigits);
  if (option.id === "BR") return maskBrazilPhone(digits);
  if (option.code === "+1") return maskNorthAmericaPhone(digits);
  return groupNationalPhone(digits);
}

export function validatePhoneForCountry(value: unknown, option: CountryDialOption) {
  const digits = digitsOnly(value);
  return digits.length >= option.minDigits && digits.length <= option.maxDigits;
}

export function detectCountryDialOptionFromPhone(value: unknown) {
  const raw = String(value ?? "");
  if (!/[+＋]/.test(raw)) return null;
  const digits = digitsOnly(raw);
  return (
    [...COUNTRY_DIAL_OPTIONS]
      .sort((a, b) => digitsOnly(b.code).length - digitsOnly(a.code).length)
      .find((option) => digits.startsWith(digitsOnly(option.code))) || null
  );
}

export function stripCountryCodeFromPhone(value: unknown, option: CountryDialOption) {
  const digits = digitsOnly(value);
  const codeDigits = digitsOnly(option.code);
  return digits.startsWith(codeDigits) ? digits.slice(codeDigits.length) : digits;
}

export function buildInternationalPhone(countryCode: string, phone: unknown) {
  const code = normalizeCountryCode(countryCode);
  const digits = digitsOnly(phone);
  return code && digits ? `${code}${digits}` : "";
}

export function formatPhoneDisplay(phone: unknown, countryCode?: string) {
  const parsed = parsePhoneParts(phone, countryCode);
  if (!parsed.digits) return "";
  const option = findCountryDialOption(undefined, parsed.code);
  const masked = maskPhoneForCountry(parsed.digits, option);
  return [parsed.code, masked].filter(Boolean).join(" ");
}

export function getInternationalPhoneDigits(phone: unknown, countryCode?: string) {
  const parsed = parsePhoneParts(phone, countryCode);
  const codeDigits = digitsOnly(parsed.code);
  return codeDigits && parsed.digits ? `${codeDigits}${parsed.digits}` : "";
}

export function buildWhatsAppUrl(phone: unknown, countryCode?: string, message?: string) {
  const digits = getInternationalPhoneDigits(phone, countryCode);
  if (!digits) return "";
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function buildRemarketingMessage(name?: string) {
  const firstName = String(name || "").trim().split(/\s+/)[0] || "tudo bem";
  return `Oi ${firstName}, tudo bem? Vi seu cadastro no Sniper BO IA e posso te ajudar a liberar seu acesso Premium. Quer que eu te mande as opções?`;
}

function parsePhoneParts(phone: unknown, countryCode?: string) {
  const raw = String(phone ?? "").trim();
  let digits = digitsOnly(raw);
  let code = normalizeCountryCode(countryCode);

  if (code) {
    const codeDigits = digitsOnly(code);
    if (digits.startsWith(codeDigits) && digits.length > codeDigits.length + 5) {
      digits = digits.slice(codeDigits.length);
    }
    return { code, digits };
  }

  if (raw.startsWith("+")) {
    const match = [...COUNTRY_DIAL_OPTIONS]
      .sort((a, b) => digitsOnly(b.code).length - digitsOnly(a.code).length)
      .find((option) => digits.startsWith(digitsOnly(option.code)));
    if (match) {
      const codeDigits = digitsOnly(match.code);
      return { code: match.code, digits: digits.slice(codeDigits.length) };
    }
  }

  return { code, digits };
}

function maskBrazilPhone(digits: string) {
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function maskNorthAmericaPhone(digits: string) {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function groupNationalPhone(digits: string) {
  if (digits.length <= 4) return digits;
  const parts: string[] = [];
  let index = 0;
  while (index < digits.length) {
    const remaining = digits.length - index;
    const size = remaining > 8 ? 3 : remaining > 4 ? 4 : remaining;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  return parts.join(" ");
}

function normalizeText(value?: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
