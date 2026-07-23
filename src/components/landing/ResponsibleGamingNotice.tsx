export function ResponsibleGamingNotice() {
  return (
    <aside
      role="note"
      aria-label="Aviso sobre apostas responsáveis"
      className="relative z-20 min-h-[10svh] w-full overflow-hidden border-y border-white/[0.08] bg-[#070B16]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(25,197,255,0.05),rgba(123,77,255,0.06),rgba(7,11,22,1))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(25,197,255,0.34),rgba(123,77,255,0.3),transparent)]"
      />

      <div className="relative mx-auto flex min-h-[10svh] w-full max-w-[1280px] flex-col items-center justify-center gap-4 px-[18px] py-6 text-center sm:px-6 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-6 md:px-8 md:py-5 md:text-left lg:px-12">
        <div className="flex items-center gap-4">
          <span className="inline-flex min-h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl border border-rose-300/35 bg-[#451A24] px-3 text-xl font-extrabold leading-none text-[#FFF7F8] shadow-[0_12px_30px_rgba(69,26,36,0.22)]">
            18+
          </span>
          <span aria-hidden="true" className="hidden text-base text-white/20 md:inline">
            |
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-6 text-[#F7F8FC] sm:text-base">
            Proibido para menores de 18 anos.
          </p>
          <p className="mt-1 text-[13px] font-medium leading-5 text-[#B7C2D5] sm:text-sm">
            Ministério da Fazenda adverte: Apostar pode causar dependência.
          </p>
        </div>

        <p className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-[13px] font-bold leading-5 text-[#D8DEEA] sm:text-sm md:w-auto md:max-w-[260px]">
          Aposta não é investimento.
        </p>
      </div>
    </aside>
  );
}
