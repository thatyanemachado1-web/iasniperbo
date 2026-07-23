const STEPS = [
  {
    n: "01",
    title: "Observe dados e contexto",
    desc: "Acompanhe informações históricas e atualizações disponíveis na plataforma.",
  },
  {
    n: "02",
    title: "Valide sua estratégia",
    desc: "Compare o comportamento da estratégia em diferentes amostras e períodos históricos.",
  },
  {
    n: "03",
    title: "Monitore padrões",
    desc: "Salve estratégias e acompanhe padrões observados em tempo real.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative bg-[#080D1A]">
      <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <header className="mb-10 text-center">
          <h2 className="text-2xl font-black tracking-tight text-[#F7F8FC] sm:text-3xl lg:text-4xl">
            Como a plataforma funciona
          </h2>
          <p className="mt-3 text-[15px] text-[#B6C0D3]">
            Da criação da estratégia ao acompanhamento dos dados.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.n}
              className="rounded-3xl border border-white/[0.08] bg-[#0D1425] p-7 transition hover:border-white/[0.16]"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7F8BA5]">
                Passo {step.n}
              </div>
              <h3 className="mt-3 text-xl font-black tracking-tight text-[#F7F8FC]">
                {step.title}
              </h3>
              <p className="mt-3 text-[14px] leading-6 text-[#B6C0D3]">{step.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
