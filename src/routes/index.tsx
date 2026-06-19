import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
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
  X,
} from "lucide-react";
import { BrainAI } from "@/components/brand/BrainAI";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { SniperLogoMark } from "@/components/brand/SniperLogoMark";
import { GlassCard } from "@/components/ui-app/GlassCard";
import {
  checkClientAccess,
  createPublicBillingCheckout,
  getBillingPlans,
  getSalesSettings,
  registerClient,
  saveAccessSession,
  type BillingPlan,
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

const WAITLIST_URL = "https://wa.me/5567992308362";
const LOGIN_BOOTSTRAP_FALLBACK_MS = 3500;

const landingFallbackPlans: BillingPlan[] = [
  {
    id: "vip",
    name: "VIP",
    description: "Acesso mensal ao painel operacional.",
    amount: 297,
    currency: "BRL",
    durationDays: 30,
    checkoutEnabled: false,
    checkoutProvider: "",
    features: ["Painel ao vivo", "Sinais protegidos", "Surf, Tie e numero pagante"],
  },
  {
    id: "premium",
    name: "Premium",
    description: "Acesso mensal com recursos completos.",
    amount: 497,
    currency: "BRL",
    durationDays: 30,
    checkoutEnabled: false,
    checkoutProvider: "",
    features: ["Tudo do VIP", "Narracao IA", "Leituras completas"],
  },
];

const hudCards = [
  { icon: Target, label: "Número Pagante Ativo", position: "left-0 top-8", delay: "0s" },
  { icon: Activity, label: "Análise em Tempo Real", position: "right-0 top-16", delay: "0.8s" },
  { icon: Bell, label: "Pressão de Tie", position: "left-3 bottom-24", delay: "1.4s" },
  { icon: TrendingUp, label: "Tendência da Mesa", position: "right-4 bottom-20", delay: "2.1s" },
  { icon: Radio, label: "Contexto Operacional", position: "left-1/2 top-[78%] -translate-x-1/2", delay: "2.8s" },
];

const FEATURE_SLIDES = [
  {
    image: "/login-banners/1.png",
    title: "Validador de Estratégias",
    summary: "Monte seu padrão, valide no histórico real e saiba se vale salvar.",
    body:
      "Ajuda quando você tem uma ideia de entrada, mas não quer apostar no achismo. Você monta a sequência, escolhe entrada, gale e proteção no empate, e vê o desempenho real antes de usar dinheiro na mesa.",
  },
  {
    image: "/login-banners/2.png",
    title: "Leitura Neural + Número Pagante",
    summary: "Mostra quais números estão puxando Player, Banker ou Tie agora.",
    body:
      "Serve para você entender a força da mesa antes da entrada. A leitura mostra se o número está pagando no lado natural, no oposto ou no pós-empate, com placar de SG, G1, RED e sequência.",
  },
  {
    image: "/login-banners/3.png",
    title: "Surf Analyzer",
    summary: "Ajuda a saber se a tendência ainda tem força ou se pode quebrar.",
    body:
      "Quando a mesa está surfando em uma cor, essa ferramenta organiza a leitura para você não seguir movimento cansado. Ela mostra continuidade, risco de quebra e contexto dos painéis Big Road, Big Eye, Small Road e Cockroach.",
  },
  {
    image: "/login-banners/4.png",
    title: "Radar de Empates",
    summary: "Identifica pressão de Tie, multiplicadores e números que puxam empate.",
    body:
      "Ajuda você a enxergar quando o empate começa a ganhar força na mesa. Mostra os multiplicadores pegos no dia, os números que mais puxaram Tie e quando o cenário merece atenção.",
  },
  {
    image: "/login-banners/5.png",
    title: "Padrões de IA",
    summary: "Mostra formações repetidas e padrões que estão quase confirmando.",
    body:
      "É para quem não quer ficar horas caçando sequência manualmente. A IA procura padrões recorrentes, mostra o que falta completar e aponta a leitura provável quando existe amostra real.",
  },
  {
    image: "/login-banners/6.png",
    title: "Calendário de Temperatura do Mercado",
    summary: "Mostra se o mercado está bom por mês, semana, dia, hora e minuto.",
    body:
      "Ajuda você a escolher melhor o momento de operar. Antes de entrar, você consulta se aquele período está muito bom, operável ou ruim, evitando forçar entrada em janela fria.",
  },
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
  const plansCardRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingAccess, setPendingAccess] = useState<ClientAccess | null>(null);
  const [prefillEmail, setPrefillEmail] = useState(savedUser.email || "");
  const [salesClosed, setSalesClosed] = useState<boolean | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>(landingFallbackPlans);
  const [checkoutLeadName, setCheckoutLeadName] = useState(savedUser.name || "");
  const [checkoutLeadEmail, setCheckoutLeadEmail] = useState(savedUser.email || "");
  const [selectedCountryId, setSelectedCountryId] = useState(DEFAULT_COUNTRY_DIAL.id);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const slide = FEATURE_SLIDES[slideIndex];
  const selectedCountry =
    COUNTRY_DIAL_OPTIONS.find((option) => option.id === selectedCountryId) ?? DEFAULT_COUNTRY_DIAL;

  useEffect(() => {
    let active = true;
    const fallbackTimer = window.setTimeout(() => {
      if (active) setSalesClosed((current) => current ?? false);
    }, LOGIN_BOOTSTRAP_FALLBACK_MS);
    getSalesSettings()
      .then((settings) => {
        if (active) setSalesClosed(settings.salesClosed);
      })
      .catch(() => {
        if (active) setSalesClosed(false);
      });
    getBillingPlans()
      .then((loadedPlans) => {
        if (active && loadedPlans.length) setPlans(loadedPlans);
      })
      .catch(() => {
        if (active) setPlans(landingFallbackPlans);
      });
    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % FEATURE_SLIDES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  function goSlide(direction: -1 | 1) {
    setSlideIndex((current) => (current + direction + FEATURE_SLIDES.length) % FEATURE_SLIDES.length);
  }
  const paidPlans = [...plans]
    .filter((plan) => plan.id !== "free")
    .sort((a, b) => {
      const order = new Map([["vip", 0], ["premium", 1]]);
      return (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99);
    });

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    setPendingAccess(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    setPrefillEmail(email);
    setCheckoutLeadEmail(email);
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
      const message = err instanceof Error ? err.message : "Não foi possível validar seu acesso.";
      if (!salesClosed && shouldOpenRegisterForPasswordSetup(message)) {
        setMode("register");
      }
      setNotice(message);
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
    setPrefillEmail(email);
    setCheckoutLeadEmail(email);
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
    if (pendingAccess) {
      saveAccessSession(pendingAccess);
      window.location.href = "/app/planos";
      return;
    }
    setNotice("Escolha um plano abaixo e informe seu e-mail para abrir o checkout.");
    plansCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function startDirectCheckout(plan: BillingPlan) {
    if (plan.id === "free") return;
    if (salesClosed) {
      setNotice("Vagas encerradas no momento. Entre na fila de espera para a próxima abertura.");
      return;
    }
    const email = checkoutLeadEmail.trim().toLowerCase();
    const fullName = checkoutLeadName.trim();
    if (!isValidCheckoutEmail(email)) {
      setNotice("Informe um e-mail válido para abrir o checkout.");
      plansCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!plan.checkoutEnabled) {
      setNotice("Checkout deste plano ainda não está configurado.");
      return;
    }
    setNotice("");
    setCheckoutLoadingPlan(plan.id);
    try {
      const checkout = await createPublicBillingCheckout(plan.id, {
        email,
        full_name: fullName,
      });
      window.location.href = checkout.checkout_url;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Não foi possível abrir o checkout.");
      setCheckoutLoadingPlan("");
    }
  }

  function requestAccess() {
    if (salesClosed) {
      window.location.href = WAITLIST_URL;
      return;
    }
    setMode("register");
    setAuthPanelOpen(true);
  }

  function focusLogin() {
    setMode("login");
    setAuthPanelOpen(true);
  }

  function focusRegister() {
    if (salesClosed) {
      window.location.href = WAITLIST_URL;
      return;
    }
    setMode("register");
    setAuthPanelOpen(true);
  }

  function changeCountry(nextId: string) {
    const nextCountry =
      COUNTRY_DIAL_OPTIONS.find((option) => option.id === nextId) ?? DEFAULT_COUNTRY_DIAL;
    setSelectedCountryId(nextCountry.id);
    setWhatsappPhone((current) => maskPhoneForCountry(current, nextCountry));
  }

  function changeWhatsapp(value: string) {
    const detectedCountry = detectCountryDialOptionFromPhone(value);
    if (detectedCountry) {
      setSelectedCountryId(detectedCountry.id);
      setWhatsappPhone(maskPhoneForCountry(stripCountryCodeFromPhone(value, detectedCountry), detectedCountry));
      return;
    }
    setWhatsappPhone(maskPhoneForCountry(value, selectedCountry));
  }

  if (salesClosed === null) {
    return <SalesAccessLoading />;
  }

  return (
    <div className="landing-safe relative min-h-screen overflow-hidden bg-[#020617] text-white">
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
      <div className="absolute -left-28 top-20 hidden size-[24rem] rounded-full bg-neon-purple/20 blur-3xl sm:block" />
      <div className="absolute -right-28 bottom-10 hidden size-[24rem] rounded-full bg-neon-blue/20 blur-3xl sm:block" />

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

      <main className="landing-safe-inner relative z-10 mx-auto flex min-h-screen flex-col px-5 py-5 sm:px-6 lg:px-10">
        <header className="flex min-w-0 items-center justify-between gap-3">
          <SniperLogoMark className="h-12 w-auto max-w-[170px] min-w-0 sm:h-16 sm:max-w-[280px] drop-shadow-[0_0_24px_rgba(0,229,255,0.24)]" />
          <div className="flex items-center gap-2">
            <div className="hidden min-w-[230px] grid-cols-2 rounded-2xl border border-neon-cyan/25 bg-black/35 p-1 shadow-[0_0_22px_rgba(0,229,255,0.1)] backdrop-blur-xl lg:grid">
              <button
                type="button"
                onClick={focusLogin}
                className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wide text-neon-cyan transition hover:bg-neon-cyan/10"
              >
                Entrar
              </button>
              {!salesClosed && (
                <button
                  type="button"
                  onClick={focusRegister}
                  className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wide text-neon-purple transition hover:bg-neon-purple/10"
                >
                  Cadastro
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="grid min-w-0 flex-1 items-center gap-8 py-8 lg:grid-cols-1 lg:gap-10 lg:py-10">
          <div className="min-w-0">
            <div className="grid min-w-0 items-center gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(520px,1.18fr)]">
              <div className="order-1 min-w-0">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-neon-purple/35 bg-neon-purple/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan shadow-[0_0_22px_rgba(168,85,247,0.18)]">
                  <Zap className="size-3.5 shrink-0" />
                  <span className="truncate">Tecnologia que analisa. Inteligência que antecipa.</span>
                </div>

                <h1 className="landing-title mt-5 max-w-3xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
                  NÃO É SORTE. É MÉTODO.
                </h1>
                <p className="landing-subtitle mt-4 max-w-2xl font-black uppercase leading-tight text-gradient-brand sm:text-3xl">
                  Crie suas próprias estratégias, valide no histórico e leia a mesa em tempo real com o Sniper BO IA.
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Enquanto a maioria aposta no impulso, o SNIPER BO IA cruza leitura neural, tendência, surf e risco para entregar contexto operacional em tempo real.
                </p>
                <p className="mt-3 max-w-xl text-sm text-slate-400">
                  Dados não eliminam risco. Mas reduzem o achismo antes da decisão.
                </p>
              </div>

              <LandingFeatureCarousel
                className="order-2 xl:row-span-2"
                slide={slide}
                slideIndex={slideIndex}
                onSelect={setSlideIndex}
                onStep={goSlide}
              />

              <div className="order-3 flex min-w-0 flex-col gap-3 sm:flex-row xl:-mt-8">
                <button
                  type="button"
                  onClick={requestAccess}
                  className="btn-primary-grad group relative min-h-12 w-full flex-1 overflow-hidden rounded-2xl px-5 py-3 text-center text-sm font-black uppercase tracking-wide glow-purple"
                >
                  <span className="absolute inset-0 shine opacity-60 pointer-events-none" />
                  <span className="relative">Quero acesso ao Sniper BO IA</span>
                </button>
                <button
                  type="button"
                  onClick={focusLogin}
                  className="min-h-12 w-full flex-1 rounded-2xl border border-neon-cyan/40 bg-black/35 px-5 py-3 text-center text-sm font-black uppercase tracking-wide text-neon-cyan shadow-[0_0_22px_rgba(0,229,255,0.1)] transition hover:border-neon-cyan/70 hover:bg-neon-cyan/10"
                >
                  Já sou cliente premium
                </button>
              </div>
            </div>


            <div className="mt-6 min-w-0 rounded-3xl border border-neon-purple/30 bg-black/45 p-5 shadow-[0_0_34px_rgba(168,85,247,0.12)] backdrop-blur-xl">
              <p className="text-lg font-black uppercase leading-tight text-white sm:text-2xl">
                Sem leitura, você reage. O mercado não perdoa.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                A maioria entra no impulso. Quem tem contexto sabe quando esperar.
              </p>
            </div>
          </div>

          {authPanelOpen && (
            <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
              <button
                type="button"
                aria-label="Fechar acesso"
                className="absolute inset-0 cursor-default"
                onClick={() => setAuthPanelOpen(false)}
              />
              <aside ref={loginCardRef} className="relative z-10 max-h-[92vh] min-w-0 w-full max-w-md overflow-y-auto rounded-t-[2rem] sm:max-w-lg sm:rounded-[2rem]">
            <GlassCard className="max-w-full rounded-[2rem] border-neon-purple/35 bg-background/80 p-5 shadow-[0_0_44px_rgba(168,85,247,0.18)] sm:p-7">
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
                  <LoginField icon={<Mail className="size-4" />} label="E-mail" name="email" type="email" defaultValue={prefillEmail} placeholder="seu@email.com" />
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
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => window.open(WAITLIST_URL, "_blank", "noopener,noreferrer")}
                      className="text-slate-400 transition hover:text-neon-cyan"
                    >
                      Recuperar senha
                    </button>
                    <a href={WAITLIST_URL} target="_blank" rel="noreferrer" className="text-neon-cyan transition hover:text-neon-blue">
                      Suporte oficial
                    </a>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <LoginField icon={<UserPlus className="size-4" />} label="Nome completo" name="full_name" placeholder="Nome completo" />
                  <LoginField key={`register-email-${prefillEmail}`} icon={<Mail className="size-4" />} label="E-mail" name="email" type="email" defaultValue={prefillEmail} placeholder="seu@email.com" />
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
                    className="btn-gold-grad inline-flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-xs font-black glow-gold"
                  >
                    <Crown className="size-4" /> Ir para checkout
                  </button>
                  <button
                    type="button"
                    onClick={enterDemo}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10 px-3 py-3 text-center text-xs font-black text-neon-cyan"
                  >
                    <Sparkles className="size-4" /> Entrar no demo
                  </button>
                </div>
              )}

              {!salesClosed && (
                <div
                  ref={plansCardRef}
                  className="mt-5 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/35 bg-gold/15">
                      <Crown className="size-5 text-gold" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black uppercase text-white">Comprar agora</div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Veja os planos e abra o checkout sem precisar entrar no painel.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={checkoutLeadName}
                      onChange={(event) => setCheckoutLeadName(event.target.value)}
                      placeholder="Nome"
                      className="min-h-11 rounded-xl border border-border/70 bg-background/70 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-gold/70"
                    />
                    <input
                      value={checkoutLeadEmail}
                      onChange={(event) => setCheckoutLeadEmail(event.target.value)}
                      placeholder="Email para compra"
                      type="email"
                      inputMode="email"
                      className="min-h-11 rounded-xl border border-border/70 bg-background/70 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-gold/70"
                    />
                  </div>

                  <div className="mt-3 grid gap-2">
                    {paidPlans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => startDirectCheckout(plan)}
                        disabled={checkoutLoadingPlan === plan.id || !plan.checkoutEnabled}
                        className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-black/35 px-3 py-3 text-left transition hover:border-gold/60 hover:bg-gold/10 disabled:cursor-wait disabled:opacity-70"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black uppercase text-white">{plan.name}</span>
                            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black uppercase text-gold">
                              {formatMoney(plan.amount, plan.currency)}/mês
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {plan.features.slice(0, 3).map((feature) => (
                              <span key={feature} className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                <Check className="size-3 text-gold" />
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gold px-3 py-2 text-[11px] font-black uppercase text-black">
                          {checkoutLoadingPlan === plan.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Crown className="size-3.5" />
                          )}
                          Checkout
                        </span>
                      </button>
                    ))}
                  </div>
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

            <GlassCard className="mt-4 max-w-full rounded-3xl border-warning/30 bg-black/55 p-4">
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

              <button
                type="button"
                onClick={() => setAuthPanelOpen(false)}
                aria-label="Fechar"
                className="absolute right-3 top-3 z-20 inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-black/55 text-slate-300 transition hover:border-neon-cyan/50 hover:text-neon-cyan"
              >
                <X className="size-4" />
              </button>
              </aside>
            </div>
          )}
        </section>

        <div className="fixed inset-x-3 bottom-3 z-[70] grid grid-cols-2 gap-2 rounded-2xl border border-neon-cyan/25 bg-background/88 p-2 shadow-[0_0_28px_rgba(0,229,255,0.18)] backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={focusLogin}
            className="min-h-11 rounded-xl border border-neon-cyan/35 bg-neon-cyan/10 text-xs font-black uppercase tracking-wide text-neon-cyan"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={requestAccess}
            className="btn-primary-grad min-h-11 rounded-xl text-xs font-black uppercase tracking-wide"
          >
            Comprar agora
          </button>
        </div>

        <LandingToolsSection />
        <LandingBenefitsSection />
        <LandingHowItWorksSection />
        <LandingPlanSection onCta={requestAccess} />
        <LandingFinalCta onCta={requestAccess} />

        <footer className="relative z-10 pb-4 pt-8 text-center text-[11px] leading-5 text-slate-500">
          <div className="mx-auto mb-4 flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <SniperLogoMark className="h-10 w-auto max-w-[180px] opacity-90" />
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <a href="#ferramentas" className="hover:text-neon-cyan">Ferramentas</a>
              <a href="#como-funciona" className="hover:text-neon-cyan">Como Funciona</a>
              <a href="#planos" className="hover:text-neon-cyan">Planos</a>
              <a href={WAITLIST_URL} target="_blank" rel="noreferrer" className="hover:text-neon-cyan">Suporte</a>
            </div>
          </div>
          O SNIPER BO IA é uma ferramenta de leitura e análise operacional. Não existe garantia de lucro. Use sempre gestão de banca e responsabilidade.
          <div className="mt-2 text-[10px] text-slate-600">© {new Date().getFullYear()} SNIPER BO IA. Todos os direitos reservados.</div>
        </footer>
      </main>
    </div>
  );
}

const landingTools = [
  { icon: Target, title: "VALIDADOR DE PADRÕES / ESTRATÉGIAS", desc: "Teste combinações, valide entradas no histórico e descubra quais padrões tiveram melhor desempenho." },
  { icon: BrainCircuit, title: "LEITURA NEURAL", desc: "Analisa o comportamento da mesa e entrega uma leitura mais objetiva para apoiar sua tomada de decisão." },
  { icon: Bell, title: "RADAR DE EMPATES", desc: "Identifica pressão de Tie e destaca momentos em que o empate ganha força na mesa." },
  { icon: Waves, title: "SURF ANALYZER", desc: "Mostra tendência, continuidade, esticamento e risco de virada para você ler o fluxo do jogo." },
  { icon: Sparkles, title: "BUSCA DE PADRÕES IA", desc: "Encontra repetições e estruturas recorrentes para revelar oportunidades com apoio da inteligência artificial." },
];

function LandingToolsSection() {
  return (
    <section id="ferramentas" className="relative z-10 mt-4 scroll-mt-20 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan">
          <Sparkles className="size-3.5" /> Ferramentas
        </div>
        <h2 className="mt-4 text-3xl font-black uppercase leading-tight text-white sm:text-4xl">
          A plataforma completa do <span className="text-gradient-brand">Sniper BO IA</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
          Ferramentas visuais, validação de padrões e leitura avançada da mesa em uma única interface.
        </p>
      </div>
      <div className="mx-auto mt-8 grid max-w-6xl gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {landingTools.map((tool) => (
          <div key={tool.title} className="glass group min-w-0 rounded-2xl border-neon-purple/20 p-5 transition hover:-translate-y-0.5 hover:border-neon-purple/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.18)]">
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 transition group-hover:bg-neon-cyan/15">
              <tool.icon className="size-5 text-neon-cyan" />
            </div>
            <div className="text-sm font-black uppercase tracking-wide text-white">{tool.title}</div>
            <p className="mt-2 text-xs leading-6 text-slate-400">{tool.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const landingBenefits = [
  { icon: Activity, title: "LEITURA EM TEMPO REAL", desc: "Dados atualizados a cada segundo." },
  { icon: Sparkles, title: "FERRAMENTAS EXCLUSIVAS", desc: "Recursos únicos para decisões melhores." },
  { icon: Shield, title: "INTERFACE PROFISSIONAL", desc: "Design limpo, intuitivo e poderoso." },
  { icon: TrendingUp, title: "ANÁLISE VISUAL INTELIGENTE", desc: "Transforme dados em vantagem real." },
];

function LandingBenefitsSection() {
  return (
    <section className="relative z-10 py-8">
      <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {landingBenefits.map((b) => (
          <div key={b.title} className="glass rounded-2xl border-neon-cyan/15 p-4 text-center transition hover:border-neon-cyan/40">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-neon-cyan/30 bg-neon-cyan/10">
              <b.icon className="size-5 text-neon-cyan" />
            </div>
            <div className="text-xs font-black uppercase tracking-wide text-white">{b.title}</div>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const landingSteps = [
  { n: "01", title: "Observe a leitura da mesa", desc: "Acompanhe os dados e sinais visuais em tempo real." },
  { n: "02", title: "Valide padrões", desc: "Use o validador e a IA para confirmar estratégias antes de entrar." },
  { n: "03", title: "Tome decisões com clareza", desc: "Entre com mais confiança usando múltiplas ferramentas de análise." },
];

function LandingHowItWorksSection() {
  return (
    <section id="como-funciona" className="relative z-10 scroll-mt-20 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-purple/30 bg-neon-purple/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan">
          <Zap className="size-3.5" /> Como Funciona
        </div>
        <h2 className="mt-4 text-3xl font-black uppercase leading-tight text-white sm:text-4xl">
          Três passos para operar com <span className="text-gradient-brand">método</span>
        </h2>
      </div>
      <div className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-3">
        {landingSteps.map((step) => (
          <div key={step.n} className="glass relative overflow-hidden rounded-2xl border-neon-purple/20 p-6 transition hover:border-neon-purple/50">
            <div className="absolute -right-2 -top-4 text-7xl font-black text-neon-purple/10">{step.n}</div>
            <div className="relative">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">Passo {step.n}</div>
              <div className="mt-2 text-lg font-black text-white">{step.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LandingPlanSection({ onCta }: { onCta: () => void }) {
  return (
    <section id="planos" className="relative z-10 scroll-mt-20 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-black/70 via-black/60 to-neon-purple/10 p-8 text-center shadow-[0_0_40px_rgba(212,175,55,0.18)] backdrop-blur-xl sm:p-10">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10">
            <Crown className="size-7 text-gold" />
          </div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-gold">Plano em destaque</div>
          <h3 className="mt-2 text-2xl font-black uppercase text-white sm:text-3xl">PLANO SNIPER BO IA</h3>
          <div className="mt-5 flex items-end justify-center gap-2">
            <span className="text-5xl font-black text-white sm:text-6xl">R$297</span>
            <span className="pb-2 text-sm text-slate-400">/mês</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Hoje no valor promocional. Após hoje, <span className="text-gold">R$497</span>.
          </p>
          <ul className="mx-auto mt-6 grid max-w-md gap-2 text-left">
            {["Acesso completo ao painel operacional","Validador de padrões e estratégias","Leitura Neural e Surf Analyzer","Radar de Empates e Busca de Padrões IA"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                <Check className="size-4 shrink-0 text-gold" /> {f}
              </li>
            ))}
          </ul>
          <button type="button" onClick={onCta} className="btn-gold-grad relative mt-7 inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-wide text-black glow-gold">
            <Crown className="size-4" /> Quero acessar
          </button>
        </div>
      </div>
    </section>
  );
}

function LandingFinalCta({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative z-10 py-12">
      <div className="mx-auto max-w-4xl rounded-3xl border border-neon-purple/30 bg-black/55 p-8 text-center shadow-[0_0_40px_rgba(168,85,247,0.18)] backdrop-blur-xl sm:p-12">
        <h2 className="text-2xl font-black uppercase leading-tight text-white sm:text-4xl">
          Pare de operar no escuro.<br />
          <span className="text-gradient-brand">Use método, leitura e validação ao seu favor.</span>
        </h2>
        <button type="button" onClick={onCta} className="btn-primary-grad relative mt-6 inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl px-8 py-3 text-sm font-black uppercase tracking-wide glow-purple">
          <span className="absolute inset-0 shine opacity-60 pointer-events-none" />
          <ShieldCheck className="relative size-4" />
          <span className="relative">Acessar agora</span>
        </button>
      </div>
    </section>
  );
}

function HeroBrainShowcase({ className = "" }: { className?: string }) {
  return (
    <div className={`relative mx-auto h-[260px] w-full max-w-[440px] overflow-hidden sm:h-[360px] ${className}`}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-neon-cyan/10 via-neon-purple/10 to-transparent blur-3xl" />
      <div className="absolute left-1/2 top-1/2 flex max-w-full -translate-x-1/2 -translate-y-1/2 scale-[0.62] items-center justify-center sm:scale-100">
        <div className="absolute size-[300px] rounded-full border border-neon-blue/20 animate-orbit-slow sm:size-[390px]" />
        <div className="absolute size-[340px] rounded-full border border-neon-purple/20 border-dashed animate-orbit-reverse sm:size-[460px]" />
        <BrainAI size={300} speaking />
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

function LandingFeatureCarousel({
  className = "",
  slide,
  slideIndex,
  onSelect,
  onStep,
}: {
  className?: string;
  slide: (typeof FEATURE_SLIDES)[number];
  slideIndex: number;
  onSelect: (index: number) => void;
  onStep: (direction: -1 | 1) => void;
}) {
  return (
    <GlassCard className={`overflow-hidden rounded-[2rem] border-neon-cyan/25 bg-background/70 p-3 shadow-[0_0_44px_rgba(0,229,255,0.14)] ${className}`}>
      <div className="relative overflow-hidden rounded-2xl border border-neon-cyan/20 bg-black/35">
        <img
          src={slide.image}
          alt={slide.title}
          className="aspect-[16/10] h-full w-full object-cover object-center"
          draggable={false}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent p-4 xl:hidden">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-neon-cyan">{slide.title}</div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-border/70 bg-secondary/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan">
            Ferramenta {slideIndex + 1}/{FEATURE_SLIDES.length}
          </span>
          <span className="rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-black uppercase text-neon-cyan">
            Saiba mais
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">{slide.title}</h2>
        <p className="mt-2 text-sm font-semibold text-neon-cyan">{slide.summary}</p>
        <p className="mt-3 text-sm leading-6 text-slate-400">{slide.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {FEATURE_SLIDES.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`Ver ${item.title}`}
                className={`h-2 rounded-full transition-all ${index === slideIndex ? "w-8 bg-neon-cyan" : "w-2 bg-slate-500/50 hover:bg-neon-cyan/70"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label="Banner anterior"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-border/70 bg-secondary/50 text-slate-300 hover:border-neon-cyan/50 hover:text-neon-cyan"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label="Próximo banner"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-border/70 bg-secondary/50 text-slate-300 hover:border-neon-cyan/50 hover:text-neon-cyan"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function SalesAccessLoading() {
  return (
    <div className="landing-safe relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-5 py-10">
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

function isValidCheckoutEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shouldOpenRegisterForPasswordSetup(message: string) {
  const normalized = message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return normalized.includes("conta encontrada sem senha") || normalized.includes("crie sua senha");
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(amount);
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
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <label className="block min-w-0">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
        <span className="text-neon-cyan">{icon}</span>
        <input
          name={name}
          type={inputType}
          required
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-neon-cyan/75 transition hover:bg-neon-cyan/10 hover:text-neon-cyan"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
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
    <label className="block min-w-0">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">País</span>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
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
    <label className="block min-w-0">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">WhatsApp</span>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
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
