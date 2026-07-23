import { SniperLogoMark } from "@/components/brand/SniperLogoMark";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#050816]">
      <div className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <SniperLogoMark className="h-10 w-auto max-w-[170px]" />
          <div className="text-[12px] text-[#7F8BA5]">
            © {new Date().getFullYear()} Sniper BO IA. Todos os direitos reservados.
          </div>
        </div>

        <div className="mt-6 space-y-2 text-[12px] leading-5 text-[#7F8BA5]">
          <p>
            <span className="mr-1 rounded-md border border-rose-300/30 bg-[#451A24] px-1.5 py-0.5 text-[10px] font-bold text-[#FFF7F8]">
              18+
            </span>
            Proibido para menores de 18 anos.
          </p>
          <p>Ministério da Fazenda adverte: Apostar pode causar dependência.</p>
          <p>Aposta não é investimento.</p>
          <p className="pt-2 text-[#7F8BA5]/80">
            O Sniper BO IA é uma ferramenta de análise e estudo. Não existe garantia de resultados.
          </p>
        </div>
      </div>
    </footer>
  );
}
