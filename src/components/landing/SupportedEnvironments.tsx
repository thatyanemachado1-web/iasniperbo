const ENVIRONMENTS = [
  { name: "Bac Bo", image: "/login-games/bacbo-live.png", status: "Disponível", available: true },
  { name: "Football Studio", image: "/login-games/football-studio.png", status: "Em breve", available: false },
  { name: "Roleta", image: "/login-games/roleta-wheel.png", status: "Em breve", available: false },
];

export function SupportedEnvironments() {
  return (
    <section className="relative mx-auto w-full max-w-[1280px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
      <header className="mb-8 text-center">
        <h2 className="text-2xl font-black tracking-tight text-[#F7F8FC] sm:text-3xl">
          Ambientes disponíveis
        </h2>
        <p className="mt-2 text-sm text-[#7F8BA5]">
          Ambientes onde a plataforma opera sua camada de análise.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {ENVIRONMENTS.map((env) => (
          <article
            key={env.name}
            className="flex flex-col items-center gap-4 rounded-3xl border border-white/[0.08] bg-[#0D1425] p-6 text-center transition hover:border-white/[0.14]"
          >
            <div className="flex h-24 w-full items-center justify-center">
              <img
                src={env.image}
                alt={env.name}
                loading="lazy"
                className="max-h-20 w-auto object-contain opacity-90"
              />
            </div>
            <div>
              <div className="text-base font-bold text-[#F7F8FC]">{env.name}</div>
              <div
                className={`mt-1 text-[11px] font-bold uppercase tracking-widest ${
                  env.available ? "text-[#13C8FF]" : "text-[#7F8BA5]"
                }`}
              >
                {env.status}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
