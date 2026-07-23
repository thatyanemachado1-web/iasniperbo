import {
  Activity,
  BookMarked,
  History,
  LineChart,
  MessageCircle,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: LineChart,
    title: "Validação histórica",
    desc: "Analise estratégias utilizando diferentes períodos e tamanhos de amostra.",
  },
  {
    icon: Activity,
    title: "Monitoramento em tempo real",
    desc: "Acompanhe atualizações, comportamentos e mudanças observadas pela plataforma.",
  },
  {
    icon: Sparkles,
    title: "Padrões observados",
    desc: "Identifique recorrências e consulte o contexto histórico associado a cada padrão.",
  },
  {
    icon: BookMarked,
    title: "Estratégias salvas",
    desc: "Organize, edite e acompanhe estratégias em um único ambiente.",
  },
  {
    icon: MessageCircle,
    title: "Central Telegram",
    desc: "Conecte suas salas e escolha quais análises podem gerar avisos informativos.",
  },
  {
    icon: History,
    title: "Histórico de análises",
    desc: "Consulte registros anteriores e acompanhe a evolução das estratégias monitoradas.",
  },
];

export function PlatformFeatures() {
  return (
    <section className="relative mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
      <header className="mb-10 max-w-3xl">
        <h2 className="text-2xl font-black tracking-tight text-[#F7F8FC] sm:text-3xl lg:text-4xl">
          Ferramentas para analisar com mais contexto
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-[#B6C0D3]">
          Recursos integrados para validar estratégias, acompanhar comportamentos e organizar suas
          análises.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="group rounded-3xl border border-white/[0.08] bg-[#0D1425] p-6 transition hover:border-white/[0.16] hover:bg-[#111A2F]"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(19,200,255,0.14),rgba(133,84,255,0.14))] text-[#13C8FF]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-[17px] font-bold text-[#F7F8FC]">{feature.title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-[#B6C0D3]">{feature.desc}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
