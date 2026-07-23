interface FinalCTAProps {
  onCta: () => void;
}

export function FinalCTA({ onCta }: FinalCTAProps) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(37,139,255,0.18), transparent 65%), radial-gradient(ellipse 40% 60% at 70% 50%, rgba(133,84,255,0.16), transparent 70%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-[1000px] px-5 py-20 text-center sm:px-8 sm:py-24 lg:px-12">
        <h2 className="text-3xl font-black tracking-tight text-[#F7F8FC] sm:text-4xl lg:text-5xl">
          Transforme dados em contexto.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#B6C0D3]">
          Conheça uma plataforma criada para análise, validação histórica e monitoramento com
          inteligência artificial.
        </p>
        <button
          type="button"
          onClick={onCta}
          className="mt-8 inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#13C8FF_0%,#258BFF_45%,#8554FF_100%)] px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-[0_18px_45px_-15px_rgba(37,139,255,0.65)] transition hover:brightness-110"
        >
          Conhecer a plataforma
        </button>
      </div>
    </section>
  );
}
