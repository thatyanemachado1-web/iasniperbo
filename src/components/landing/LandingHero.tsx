import notebookImg from "@/assets/hero-notebook.png";

interface LandingHeroProps {
  onPrimary: () => void;
  onSecondary: () => void;
}

export function LandingHero({ onPrimary, onSecondary }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 75% 40%, rgba(37,139,255,0.16), transparent 60%), radial-gradient(ellipse 45% 45% at 80% 65%, rgba(133,84,255,0.14), transparent 65%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[47fr_53fr] lg:gap-14 lg:px-12 lg:py-24">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B6C0D3] sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#13C8FF] shadow-[0_0_10px_rgba(19,200,255,0.9)]" />
            Plataforma de análise baseada em IA
          </span>

          <h1 className="mt-6 text-[42px] font-black leading-[0.98] tracking-[-0.02em] text-[#F7F8FC] sm:text-[56px] lg:text-[64px]">
            ANÁLISE ANTES
            <br />
            DA DECISÃO.
          </h1>

          <p className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-transparent bg-clip-text bg-[linear-gradient(90deg,#13C8FF,#8554FF)]">
            Mais contexto. Menos achismo.
          </p>

          <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#B6C0D3] sm:text-base">
            O Sniper BO IA reúne ferramentas de análise, validação histórica e monitoramento em
            tempo real para auxiliar no estudo de estratégias com base em dados e contexto
            operacional.
          </p>

          <p className="mt-3 max-w-xl text-[14px] leading-6 text-[#7F8BA5]">
            Crie estratégias, valide comportamentos históricos e acompanhe dados em tempo real com
            apoio da inteligência artificial.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onPrimary}
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#13C8FF_0%,#258BFF_45%,#8554FF_100%)] px-6 py-3.5 text-[13px] font-black uppercase tracking-wider text-white shadow-[0_18px_45px_-15px_rgba(37,139,255,0.65)] transition hover:brightness-110 sm:text-sm"
            >
              Conhecer a plataforma
            </button>
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-3.5 text-[13px] font-bold uppercase tracking-wider text-[#F7F8FC] transition hover:border-white/25 hover:bg-white/[0.08] sm:text-sm"
            >
              Já sou cliente
            </button>
          </div>
        </div>

        <div className="relative min-w-0">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(37,139,255,0.35), transparent 65%), radial-gradient(ellipse 40% 40% at 60% 70%, rgba(133,84,255,0.28), transparent 70%)",
              filter: "blur(10px)",
            }}
          />
          <img
            src={notebookImg}
            alt="Notebook exibindo painel de análise do Sniper BO IA"
            width={1600}
            height={1200}
            className="relative mx-auto w-full max-w-[720px] drop-shadow-[0_40px_80px_rgba(19,40,90,0.55)]"
          />
        </div>
      </div>
    </section>
  );
}
