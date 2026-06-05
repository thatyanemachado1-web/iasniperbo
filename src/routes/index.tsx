import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  BrainCircuit,
  Crown,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Waves,
  Zap,
} from "lucide-react";
import { BrainAI } from "@/components/brand/BrainAI";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { SniperLogoMark } from "@/components/brand/SniperLogoMark";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { checkClientAccess, getSalesSettings, registerClient, saveAccessSession, type ClientAccess } from "@/lib/accessApi";
import {
  COUNTRY_DIAL_OPTIONS,
  DEFAULT_COUNTRY_DIAL,
  buildInternationalPhone,
  digitsOnly,
  maskPhoneForCountry,
  validatePhoneForCountry,
} from "@/lib/phone";
import { readUserSession } from "@/lib/userSession";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "SNIPER BO IA - Acesso operacional" },
      {
        name: "description",
        content:
          "Painel operacional com cadastro controlado, leitura estatística em tempo real e acesso VIP liberado pelo administrador.",
      },
      { property: "og:title", content: "SNIPER BO IA" },
      {
        property: "og:description",
        content: "Acesso operacional com cadastro, checkout, demo limitado e liberação VIP.",
      },
    ],
  }),
});

const WAITLIST_URL = "https://chat.whatsapp.com/Gw6qhCXXtyeDrukSxlM71u?mode=gi_t";

const moduleCards = [
  { icon: BrainCircuit, label: "Leitura Neural", desc: "Detecta números pagantes em tempo real." },
  { icon: Waves, label: "Análise de Surf", desc: "Identifica força, quebra e retomada da mesa." },
  { icon: Bell, label: "Detector de Empates", desc: "Enxerga pressão de Tie antes da maioria." },
  { icon: TrendingUp, label: "Tendências da Mesa", desc: "Mostra a direção do jogo com mais clareza." },
  { icon: Target, label: "Entradas com Contexto", desc: "Cruza leitura, tendência e momento operacional." },
  { icon: Shield, label: "Gestão de Risco", desc: "Ajuda a evitar decisões por emoção." },
];

const hudCards = [
  { icon: Target, label: "Número Pagante Ativo", position: "left-0 top-8", delay: "0s" },
  { icon: Activity, label: "Análise em Tempo Real", position: "right-0 top-16", delay: "0.8s" },
  { icon: Bell, label: "Pressão de Tie", position: "left-3 bottom-24", delay: "1.4s" },
  { icon: TrendingUp, label: "Tendência da Mesa", position: "right-4 bottom-20", delay: "2.1s" },
  { icon: Radio, label: "Contexto Operacional", position: "left-1/2 top-[78%] -translate-x-1/2", delay: "2.8s" },
];

const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const size = 2 + ((i * 7) % 4);
  const left = (i * 37) % 100;
  const delay = (i * 0.7) % 10;
  const duration = 14 + ((i * 3) % 16);
  return { size, left, delay, duration, key: i };
});

function LoginPage() {
  const savedUser = readUserSession();
  const loginCardRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingAccess, setPendingAccess] = useState<ClientAccess | null>(null);
  const [salesClosed, setSalesClosed] = useState<boolean | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState(DEFAULT_COUNTRY_DIAL.id);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const selectedCountry =
    COUNTRY_DIAL_OPTIONS.find((option) => option.id === selectedCountryId) ?? DEFAULT_COUNTRY_DIAL;

  useEffect(() => {
    let active = true;
    getSalesSettings()
      .then((settings) => {
        if (active) setSalesClosed(settings.salesClosed);
      })
      .catch(() => {
        if (active) setSalesClosed(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    setPendingAccess(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    try {
      const access = await checkClientAccess(email, password);
      if (!access.registered) {
        if (!salesClosed) setMode("register");
        setNotice(
          salesClosed
            ? "Vagas encerradas no momento. Entre na fila de espera para a próxima abertura."
            : "E-mail ainda não cadastrado. Faça seu cadastro para continuar.",
        );
        return;
      }
      if (salesClosed && !canEnterWhenSalesClosed(access)) {
        setNotice("Vagas encerradas. Somente clientes Premium com acesso ativo conseguem entrar na plataforma.");
        return;
      }
      saveAccessSession(access, email);
      window.location.href = "/app";
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Não foi possível validar seu acesso.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salesClosed) {
      setNotice("Vagas encerradas no momento. Entre na fila de espera para a próxima abertura.");
      return;
    }
    setLoading(true);
    setNotice("");
    setPendingAccess(null);
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("full_name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const passwordConfirm = String(data.get("password_confirm") || "");
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
      const access = await registerClient({
        full_name: fullName,
        email,
        password,
        phone: phoneDigits,
        phone_full: buildInternationalPhone(selectedCountry.code, phoneDigits),
        city: String(data.get("city") || "").trim(),
        country: selectedCountry.country,
        country_code: selectedCountry.code,
      });
      saveAccessSession(access, email);
      window.location.href = "/app";
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  function enterDemo() {
    if (!pendingAccess) return;
    saveAccessSession(pendingAccess);
    window.location.href = "/app";
  }

  function goCheckout() {
    if (salesClosed) {
      setNotice("Vagas encerradas no momento. Entre na fila de espera para a próxima abertura.");
      return;
    }
    if (pendingAccess) saveAccessSession(pendingAccess);
    window.location.href = "/app/planos";
  }

  function requestAccess() {
    if (salesClosed) {
      window.location.href = WAITLIST_URL;
      return;
    }
    goCheckout();
  }

  function focusLogin() {
    setMode("login");
    window.setTimeout(() => {
      loginCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  }

  function changeCountry(nextId: string) {
    const nextCountry =
      COUNTRY_DIAL_OPTIONS.find((option) => option.id === nextId) ?? DEFAULT_COUNTRY_DIAL;
    setSelectedCountryId(nextCountry.id);
    setWhatsappPhone((current) => maskPhoneForCountry(current, nextCountry));
  }

  function changeWhatsapp(value: string) {
    setWhatsappPhone(maskPhoneForCountry(value, selectedCountry));
  }

  if (salesClosed === null) {
    return <SalesAccessLoading />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-75"
        style={{ backgroundImage: "url('/assets/dark-tech-bg.png')" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.68) 48%, rgba(2,6,23,0.9) 100%), radial-gradient(circle at 30% 35%, rgba(0,229,255,0.2), transparent 38%), radial-gradient(circle at 76% 20%, rgba(168,85,247,0.22), transparent 34%)",
        }}
      />
      <div className="absolute inset-0 scan-grid opacity-[0.12] pointer-events-none" />
      <div className="absolute -left-28 top-20 size-[24rem] rounded-full bg-neon-purple/20 blur-3xl" />
      <div className="absolute -right-28 bottom-10 size-[24rem] rounded-full bg-neon-blue/20 blur-3xl" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {PARTICLES.map((p) => (
          <span
            key={p.key}
            className="particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              bottom: -8,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 hidden lg:block pointer-events-none">
        <NeuralLines cx={42} cy={48} count={14} opacity={0.34} reach={1.05} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-5 sm:px-6 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <SniperLogoMark className="h-14 w-auto max-w-[220px] sm:h-16 sm:max-w-[280px] drop-shadow-[0_0_24px_rgba(0,229,255,0.24)]" />
          <AppBadge tone={salesClosed ? "red" : "purple"}>
            {salesClosed ? "Vagas limitadas" : "Acesso premium"}
          </AppBadge>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] lg:gap-10 lg:py-10">
          <div className="min-w-0">
            <div className="grid items-center gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.8fr)]">
              <div className="order-1">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-neon-purple/35 bg-neon-purple/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan shadow-[0_0_22px_rgba(168,85,247,0.18)]">
                  <Zap className="size-3.5 shrink-0" />
                  <span className="truncate">Tecnologia que analisa. Inteligência que antecipa.</span>
                </div>

                <h1 className="mt-5 max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Chega de entrar no escuro.
                </h1>
                <p className="mt-4 max-w-2xl text-xl font-black uppercase leading-tight text-gradient-brand sm:text-3xl">
                  O Sniper BO IA lê a mesa antes da maioria.
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Enquanto a maioria aposta no impulso, o SNIPER BO IA cruza leitura neural, tendência, surf e risco para entregar contexto operacional em tempo real.
                </p>
                <p className="mt-3 max-w-xl text-sm text-slate-400">
                  Dados não eliminam risco. Mas reduzem o achismo antes da decisão.
                </p>
              </div>

              <HeroBrainShowcase className="order-2 xl:row-span-2" />

              <div className="order-3 flex flex-col gap-3 sm:flex-row xl:-mt-8">
                <button
                  type="button"
                  onClick={requestAccess}
                  className="btn-primary-grad group relative min-h-12 flex-1 overflow-hidden rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-wide glow-purple"
                >
                  <span className="absolute inset-0 shine opacity-60 pointer-events-none" />
                  <span className="relative">Quero acesso ao Sniper BO IA</span>
                </button>
                <button
                  type="button"
                  onClick={focusLogin}
                  className="min-h-12 flex-1 rounded-2xl border border-neon-cyan/40 bg-black/35 px-5 py-3 text-sm font-black uppercase tracking-wide text-neon-cyan shadow-[0_0_22px_rgba(0,229,255,0.1)] transition hover:border-neon-cyan/70 hover:bg-neon-cyan/10"
                >
                  Já sou cliente premium
                </button>
              </div>
            </div>

            <div className="mt-7 flex gap-3 overflow-x-auto pb-3 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
              {moduleCards.map((card) => (
                <div
                  key={card.label}
                  className="glass min-w-[225px] rounded-2xl border-neon-purple/20 p-4 transition hover:border-neon-purple/50 hover:shadow-[0_0_24px_rgba(168,85,247,0.18)]"
                >
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-neon-cyan/30 bg-neon-cyan/10">
                    <card.icon className="size-5 text-neon-cyan" />
                  </div>
                  <div className="text-sm font-black text-white">{card.label}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-neon-purple/30 bg-black/45 p-5 shadow-[0_0_34px_rgba(168,85,247,0.12)] backdrop-blur-xl">
              <p className="text-lg font-black uppercase leading-tight text-white sm:text-2xl">
                Sem leitura, você reage. O mercado não perdoa.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                A maioria entra no impulso. Quem tem contexto sabe quando esperar.
              </p>
            </div>
          </div>

          <aside ref={loginCardRef} className="w-full max-w-md justify-self-center lg:justify-self-end">
            <GlassCard className="rounded-[2rem] border-neon-purple/35 bg-background/80 p-5 shadow-[0_0_44px_rgba(168,85,247,0.18)] sm:p-7">
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-neon-purple/80 to-transparent" />
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10">
                <LockKeyhole className="size-6 text-neon-cyan" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black text-white">{mode === "register" && !salesClosed ? "Criar cadastro" : "Acesso Premium"}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {mode === "register" && !salesClosed
                    ? "Cadastre seus dados para solicitar acesso ao SNIPER BO IA."
                    : "Entre com sua conta para acessar o painel do SNIPER BO IA."}
                </p>
              </div>

              <div className={`mt-5 mb-4 grid rounded-2xl border border-border/70 bg-secondary/35 p-1 ${salesClosed ? "grid-cols-1" : "grid-cols-2"}`}>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-xl py-2 text-xs font-black uppercase transition ${mode === "login" || salesClosed ? "btn-primary-grad" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Entrar
                </button>
                {!salesClosed && (
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={`rounded-xl py-2 text-xs font-black uppercase transition ${mode === "register" ? "btn-primary-grad" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Cadastro
                  </button>
                )}
              </div>

              {mode === "login" || salesClosed ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <LoginField icon={<Mail className="size-4" />} label="E-mail" name="email" type="email" defaultValue={savedUser.email} placeholder="seu@email.com" />
                  <LoginField icon={<ShieldCheck className="size-4" />} label="Senha" name="password" type="password" placeholder="sua senha" />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary-grad group relative flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-sm font-black uppercase tracking-wide glow-blue disabled:opacity-60"
                  >
                    <span className="absolute inset-0 shine opacity-60 pointer-events-none" />
                    {loading ? <Loader2 className="relative size-4 animate-spin" /> : <ShieldCheck className="relative size-4" />}
                    <span className="relative">Entrar no painel</span>
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setNotice("Para recuperar sua senha, fale com o suporte oficial.")}
                      className="text-slate-400 transition hover:text-neon-cyan"
                    >
                      Esqueci minha senha
                    </button>
                    <a href={WAITLIST_URL} target="_blank" rel="noreferrer" className="text-neon-cyan transition hover:text-neon-blue">
                      Suporte oficial
                    </a>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <LoginField icon={<UserPlus className="size-4" />} label="Nome completo" name="full_name" placeholder="Nome completo" />
                  <LoginField icon={<Mail className="size-4" />} label="E-mail" name="email" type="email" defaultValue={savedUser.email} placeholder="seu@email.com" />
                  <LoginField icon={<KeyRound className="size-4" />} label="Criar senha" name="password" type="password" placeholder="mínimo 4 caracteres" />
                  <LoginField icon={<ShieldCheck className="size-4" />} label="Confirmar senha" name="password_confirm" type="password" placeholder="repita sua senha" />
                  <CountryDialField
                    icon={<Radio className="size-4" />}
                    selectedId={selectedCountry.id}
                    onChange={changeCountry}
                  />
                  <WhatsAppField
                    icon={<Phone className="size-4" />}
                    countryCode={selectedCountry.code}
                    value={whatsappPhone}
                    onChange={changeWhatsapp}
                    placeholder={selectedCountry.id === "BR" ? "67 99230-8362" : "número sem DDI"}
                  />
                  <input type="hidden" name="country" value={selectedCountry.country} />
                  <input type="hidden" name="country_code" value={selectedCountry.code} />
                  <input type="hidden" name="phone_full" value={buildInternationalPhone(selectedCountry.code, whatsappPhone)} />
                  <LoginField icon={<MapPin className="size-4" />} label="Cidade" name="city" placeholder="Cidade" />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary-grad group relative flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-sm font-black uppercase tracking-wide glow-blue disabled:opacity-60"
                  >
                    <span className="absolute inset-0 shine opacity-60 pointer-events-none" />
                    {loading ? <Loader2 className="relative size-4 animate-spin" /> : <UserPlus className="relative size-4" />}
                    <span className="relative">Cadastrar e continuar</span>
                  </button>
                </form>
              )}

              {notice && (
                <div className="mt-4 flex gap-2 rounded-2xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {pendingAccess && !salesClosed && (
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={goCheckout}
                    className="btn-gold-grad inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black glow-gold"
                  >
                    <Crown className="size-4" /> Ir para checkout
                  </button>
                  <button
                    type="button"
                    onClick={enterDemo}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10 px-3 py-3 text-xs font-black text-neon-cyan"
                  >
                    <Sparkles className="size-4" /> Entrar no demo
                  </button>
                </div>
              )}

              <div className="mt-5 border-t border-border/60 pt-4 text-center text-[11px] text-slate-400">
                Acesso exclusivo para clientes ativos.
                {!salesClosed && (
                  <span>
                    {" "}A partir de <span className="font-semibold text-gold">R$ 297/mês</span>.
                  </span>
                )}
              </div>
            </GlassCard>

            <GlassCard className="mt-4 rounded-3xl border-warning/30 bg-black/55 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-warning/35 bg-warning/10">
                  <Crown className="size-5 text-warning" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Vagas limitadas</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Liberamos novas vagas apenas em períodos específicos. Quando fechar, não sabemos quando abriremos novamente.
                  </p>
                </div>
              </div>
              <a
                href={WAITLIST_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-warning/40 bg-warning/10 px-4 text-xs font-black uppercase tracking-wide text-warning transition hover:bg-warning/15"
              >
                Entrar na fila de espera
              </a>
            </GlassCard>
          </aside>
        </section>

        <footer className="relative z-10 pb-4 text-center text-[11px] leading-5 text-slate-500">
          O SNIPER BO IA é uma ferramenta de leitura e análise operacional. Não existe garantia de lucro. Use sempre gestão de banca e responsabilidade.
        </footer>
      </main>
    </div>
  );
}

function HeroBrainShowcase({ className = "" }: { className?: string }) {
  return (
    <div className={`relative mx-auto h-[300px] w-full max-w-[440px] sm:h-[360px] ${className}`}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-neon-cyan/10 via-neon-purple/10 to-transparent blur-3xl" />
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 scale-[0.78] items-center justify-center sm:scale-100">
        <div className="absolute size-[320px] rounded-full border border-neon-blue/20 animate-orbit-slow sm:size-[390px]" />
        <div className="absolute size-[380px] rounded-full border border-neon-purple/20 border-dashed animate-orbit-reverse sm:size-[460px]" />
        <BrainAI size={320} speaking />
      </div>
      <div className="absolute inset-x-8 bottom-6 hidden h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent sm:block" />
      {hudCards.map((card) => (
        <div
          key={card.label}
          className={`landing-hud-card absolute hidden min-w-[150px] items-center gap-2 rounded-2xl border border-neon-cyan/30 bg-black/55 px-3 py-2 shadow-[0_0_24px_rgba(0,229,255,0.12)] backdrop-blur-xl sm:flex ${card.position}`}
          style={{ animationDelay: card.delay }}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10">
            <card.icon className="size-4 text-neon-cyan" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wide text-white">{card.label}</span>
        </div>
      ))}
    </div>
  );
}

function SalesAccessLoading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 py-10">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: "url('/assets/dark-tech-bg.png')" }}
      />
      <div className="absolute inset-0 bg-background/80" />
      <div className="relative w-full max-w-sm rounded-3xl border border-neon-cyan/30 bg-background/75 p-6 text-center shadow-[0_0_40px_rgba(0,229,255,0.12)] backdrop-blur-xl">
        <div className="mx-auto mb-4 flex justify-center">
          <BrainAI size={92} speaking />
        </div>
        <SniperLogoMark className="mx-auto h-12 w-auto max-w-[220px] drop-shadow-[0_0_22px_rgba(0,229,255,0.25)]" />
        <div className="mt-2 text-xl font-black text-white">Verificando acesso</div>
        <div className="mt-2 text-xs text-muted-foreground">Sincronizando status de vagas...</div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary/70">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-purple animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function canEnterWhenSalesClosed(access: ClientAccess) {
  return (
    access.approved ||
    access.access_mode === "full" ||
    access.role === "owner" ||
    access.role === "admin"
  );
}

function LoginField({
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
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
        <span className="text-neon-cyan">{icon}</span>
        <input
          name={name}
          type={type}
          required
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </label>
  );
}

function CountryDialField({
  icon,
  selectedId,
  onChange,
}: {
  icon: ReactNode;
  selectedId: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">País</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
        <span className="text-neon-cyan">{icon}</span>
        <select
          value={selectedId}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
        >
          {COUNTRY_DIAL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.flag} {option.country} ({option.code})
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function WhatsAppField({
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
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">WhatsApp</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
        <span className="text-neon-cyan">{icon}</span>
        <span className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/10 px-2 py-1 text-xs font-black text-neon-cyan">
          {countryCode}
        </span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </label>
  );
}
