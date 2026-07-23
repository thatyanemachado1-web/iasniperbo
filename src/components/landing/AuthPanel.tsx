import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  UserPlus,
  X,
} from "lucide-react";
import {
  AccessApiError,
  AccessApiTimeoutError,
  checkClientAccess,
  registerClient,
  saveAccessSession,
  validateLoginAccess,
  type ClientAccess,
} from "@/lib/accessApi";
import {
  COUNTRY_DIAL_OPTIONS,
  DEFAULT_COUNTRY_DIAL,
  buildInternationalPhone,
  detectCountryDialOptionFromPhone,
  digitsOnly,
  maskPhoneForCountry,
  stripCountryCodeFromPhone,
  validatePhoneForCountry,
} from "@/lib/phone";
import { readUserSession } from "@/lib/userSession";

const LOGIN_REQUEST_TIMEOUT_MS = 20_000;

interface AuthPanelProps {
  open: boolean;
  mode: "login" | "register";
  onClose: () => void;
  onSwitchMode: (mode: "login" | "register") => void;
  salesClosed: boolean;
}

export function AuthPanel({ open, mode, onClose, onSwitchMode, salesClosed }: AuthPanelProps) {
  const navigate = useNavigate();
  const savedUser = readUserSession();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [prefillEmail, setPrefillEmail] = useState(savedUser.email || "");
  const [selectedCountryId, setSelectedCountryId] = useState(DEFAULT_COUNTRY_DIAL.id);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const selectedCountry =
    COUNTRY_DIAL_OPTIONS.find((option) => option.id === selectedCountryId) ?? DEFAULT_COUNTRY_DIAL;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) setNotice("");
  }, [open, mode]);

  if (!open) return null;

  function canEnterWhenSalesClosed(access: ClientAccess) {
    return (
      access.approved ||
      access.access_mode === "full" ||
      access.role === "owner" ||
      access.role === "admin"
    );
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    setPrefillEmail(email);
    try {
      const access = await checkClientAccess(email, password, LOGIN_REQUEST_TIMEOUT_MS);
      if (!access.registered) {
        setNotice(
          salesClosed
            ? "Vagas encerradas no momento."
            : "E-mail ainda não cadastrado. Faça seu cadastro para continuar.",
        );
        return;
      }
      const validated = validateLoginAccess(access);
      if (!validated.ok) {
        setNotice(validated.message);
        return;
      }
      if (salesClosed && !canEnterWhenSalesClosed(validated.access)) {
        setNotice("Vagas encerradas. Apenas clientes ativos conseguem entrar.");
        return;
      }
      try {
        saveAccessSession(validated.access, email);
      } catch {
        setNotice("Login feito, mas não foi possível salvar sua sessão. Tente novamente.");
        return;
      }
      await navigate({ to: "/app", replace: true });
    } catch (err) {
      setNotice(resolveLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salesClosed) {
      setNotice("Vagas encerradas no momento.");
      return;
    }
    setLoading(true);
    setNotice("");
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("full_name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const passwordConfirm = String(data.get("password_confirm") || "");
    setPrefillEmail(email);
    if (password.length < 4) {
      setNotice("A senha precisa ter pelo menos 4 caracteres.");
      setLoading(false);
      return;
    }
    if (password !== passwordConfirm) {
      setNotice("As senhas não conferem.");
      setLoading(false);
      return;
    }
    const phoneDigits = digitsOnly(whatsappPhone);
    if (!validatePhoneForCountry(phoneDigits, selectedCountry)) {
      setNotice(`Informe um WhatsApp válido para ${selectedCountry.country}.`);
      setLoading(false);
      return;
    }
    try {
      const access = await registerClient(
        {
          full_name: fullName,
          email,
          password,
          phone: phoneDigits,
          phone_full: buildInternationalPhone(selectedCountry.code, phoneDigits),
          city: String(data.get("city") || "").trim(),
          country: selectedCountry.country,
          country_code: selectedCountry.code,
        },
        LOGIN_REQUEST_TIMEOUT_MS,
      );
      const validated = validateLoginAccess(access);
      if (!validated.ok) {
        setNotice(validated.message);
        return;
      }
      try {
        saveAccessSession(validated.access, email);
      } catch {
        setNotice("Cadastro concluído, mas não foi possível salvar sua sessão.");
        return;
      }
      await navigate({ to: "/app", replace: true });
    } catch (err) {
      setNotice(resolveLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function changeCountry(nextId: string) {
    const next =
      COUNTRY_DIAL_OPTIONS.find((option) => option.id === nextId) ?? DEFAULT_COUNTRY_DIAL;
    setSelectedCountryId(next.id);
    setWhatsappPhone((current) => maskPhoneForCountry(current, next));
  }

  function changeWhatsapp(value: string) {
    const detected = detectCountryDialOptionFromPhone(value);
    if (detected) {
      setSelectedCountryId(detected.id);
      setWhatsappPhone(maskPhoneForCountry(stripCountryCodeFromPhone(value, detected), detected));
      return;
    }
    setWhatsappPhone(maskPhoneForCountry(value, selectedCountry));
  }

  const isLogin = mode === "login";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isLogin ? "Entrar" : "Cadastro"}
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#020617]/85 backdrop-blur-md p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0D1425] p-6 shadow-[0_40px_100px_-20px_rgba(37,139,255,0.35)] sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#B6C0D3] transition hover:bg-white/[0.1] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex gap-1 rounded-2xl border border-white/[0.08] bg-[#080D1A] p-1">
          <button
            type="button"
            onClick={() => onSwitchMode("login")}
            className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
              isLogin
                ? "bg-[linear-gradient(90deg,#13C8FF,#8554FF)] text-white"
                : "text-[#B6C0D3] hover:text-white"
            }`}
          >
            Entrar
          </button>
          {!salesClosed && (
            <button
              type="button"
              onClick={() => onSwitchMode("register")}
              className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                !isLogin
                  ? "bg-[linear-gradient(90deg,#13C8FF,#8554FF)] text-white"
                  : "text-[#B6C0D3] hover:text-white"
              }`}
            >
              Cadastro
            </button>
          )}
        </div>

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-xl font-black tracking-tight text-[#F7F8FC]">Entrar</h2>
            <Field
              icon={<Mail className="h-4 w-4" />}
              label="E-mail"
              name="email"
              type="email"
              placeholder="voce@email.com"
              defaultValue={prefillEmail}
            />
            <Field
              icon={<KeyRound className="h-4 w-4" />}
              label="Senha"
              name="password"
              type="password"
              placeholder="Sua senha"
            />
            {notice && <NoticeBox message={notice} />}
            <SubmitButton loading={loading} label="Entrar" />
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <h2 className="text-xl font-black tracking-tight text-[#F7F8FC]">Cadastro</h2>
            <Field
              icon={<UserPlus className="h-4 w-4" />}
              label="Nome completo"
              name="full_name"
              placeholder="Seu nome"
              defaultValue={savedUser.name || ""}
            />
            <Field
              icon={<Mail className="h-4 w-4" />}
              label="E-mail"
              name="email"
              type="email"
              placeholder="voce@email.com"
              defaultValue={prefillEmail}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CountryField
                icon={<MapPin className="h-4 w-4" />}
                selectedId={selectedCountryId}
                onChange={changeCountry}
              />
              <PhoneField
                icon={<Phone className="h-4 w-4" />}
                countryCode={selectedCountry.code}
                value={whatsappPhone}
                onChange={changeWhatsapp}
                placeholder="WhatsApp"
              />
            </div>
            <Field
              icon={<MapPin className="h-4 w-4" />}
              label="Cidade"
              name="city"
              placeholder="Sua cidade"
            />
            <Field
              icon={<KeyRound className="h-4 w-4" />}
              label="Senha"
              name="password"
              type="password"
              placeholder="Mínimo 4 caracteres"
            />
            <Field
              icon={<KeyRound className="h-4 w-4" />}
              label="Confirmar senha"
              name="password_confirm"
              type="password"
              placeholder="Repita a senha"
            />
            {notice && <NoticeBox message={notice} />}
            <SubmitButton loading={loading} label="Criar cadastro" />
          </form>
        )}
      </div>
    </div>
  );
}

function NoticeBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-[13px] leading-5 text-amber-200">
      {message}
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#13C8FF_0%,#258BFF_45%,#8554FF_100%)] px-6 py-3.5 text-[13px] font-black uppercase tracking-wider text-white shadow-[0_18px_45px_-18px_rgba(37,139,255,0.65)] transition hover:brightness-110 disabled:opacity-60"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

function resolveLoginErrorMessage(error: unknown) {
  if (error instanceof AccessApiTimeoutError) return error.message;
  if (error instanceof AccessApiError) {
    if (error.status === 401) return error.message || "E-mail ou senha incorretos.";
    if (error.status === 503)
      return error.message || "Servidor indisponível no momento. Tente novamente.";
    return error.message || "Não foi possível validar seu acesso.";
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Não foi possível validar seu acesso.";
}

function Field({
  icon,
  label,
  name,
  placeholder,
  type = "text",
  defaultValue,
}: {
  icon: ReactNode;
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
}) {
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);
  const inputType = isPassword && showPassword ? "text" : type;
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7F8BA5]">
        {label}
      </span>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#080D1A] px-3.5 py-3 focus-within:border-[#258BFF]/60 focus-within:shadow-[0_0_0_3px_rgba(37,139,255,0.15)] transition">
        <span className="text-[#13C8FF]">{icon}</span>
        <input
          name={name}
          type={inputType}
          required
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#F7F8FC] outline-none placeholder:text-[#7F8BA5]"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#B6C0D3] hover:bg-white/[0.06] hover:text-white"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </label>
  );
}

function CountryField({
  icon,
  selectedId,
  onChange,
}: {
  icon: ReactNode;
  selectedId: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7F8BA5]">País</span>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#080D1A] px-3.5 py-3">
        <span className="text-[#13C8FF]">{icon}</span>
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#F7F8FC] outline-none"
        >
          {COUNTRY_DIAL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} className="bg-[#0D1425]">
              {option.flag} {option.country} ({option.code})
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function PhoneField({
  icon,
  countryCode,
  value,
  onChange,
  placeholder,
}: {
  icon: ReactNode;
  countryCode: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#7F8BA5]">
        WhatsApp
      </span>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#080D1A] px-3.5 py-3 focus-within:border-[#258BFF]/60">
        <span className="text-[#13C8FF]">{icon}</span>
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-bold text-[#13C8FF]">
          {countryCode}
        </span>
        <input
          type="tel"
          inputMode="tel"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#F7F8FC] outline-none placeholder:text-[#7F8BA5]"
        />
      </div>
    </label>
  );
}
