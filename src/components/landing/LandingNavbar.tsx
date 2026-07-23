import { SniperLogoMark } from "@/components/brand/SniperLogoMark";

interface LandingNavbarProps {
  onLogin: () => void;
  onRegister: () => void;
  hideRegister?: boolean;
}

export function LandingNavbar({ onLogin, onRegister, hideRegister = false }: LandingNavbarProps) {
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-12">
      <SniperLogoMark className="h-10 w-auto max-w-[160px] sm:h-12 sm:max-w-[200px]" />
      <nav className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onLogin}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-[#F7F8FC] transition hover:border-white/20 hover:bg-white/[0.08] sm:px-5 sm:text-sm"
        >
          Entrar
        </button>
        {!hideRegister && (
          <button
            type="button"
            onClick={onRegister}
            className="rounded-xl bg-[linear-gradient(90deg,#13C8FF_0%,#258BFF_45%,#8554FF_100%)] px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,139,255,0.6)] transition hover:brightness-110 sm:px-5 sm:text-sm"
          >
            Cadastro
          </button>
        )}
      </nav>
    </header>
  );
}
