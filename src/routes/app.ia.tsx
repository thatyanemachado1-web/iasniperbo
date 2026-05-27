import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { BrainAI } from "@/components/brand/BrainAI";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Send, Mic } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/ia")({
  component: IAPage,
});

type Msg = { from: "ia" | "user"; text: string; locked?: boolean };

const initial: Msg[] = [
  { from: "ia", text: "Olá, sou o Assistente IA. Posso explicar a leitura da mesa, o sinal atual, o Tie Alert e o placar." },
  { from: "user", text: "Como está a mesa agora?" },
  { from: "ia", text: "A mesa está em observação. Última rodada: Banker 7 contra Player 4. Existe Tie Alert estatístico ativo em paralelo." },
  { from: "ia", text: "Resposta completa disponível no Premium.", locked: true },
];

const quick = ["Tem entrada?", "Tem Tie Alert?", "Mostrar placar", "Última rodada", "Explicar decisão"];

function IAPage() {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");

  function send(t: string) {
    if (!t.trim()) return;
    setMsgs((m) => [
      ...m,
      { from: "user", text: t },
      { from: "ia", text: "Leitura completa da engine disponível no Premium.", locked: true },
    ]);
    setText("");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-[calc(100vh-10rem)] lg:h-[calc(100vh-7rem)]">
      <GlassCard className="flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <BrainAI size={36} speaking />
            <div>
              <div className="text-sm font-semibold">Assistente IA</div>
              <div className="text-[10px] text-success uppercase tracking-widest">Online</div>
            </div>
          </div>
          <AppBadge tone="purple" pulse>Acompanhando mesa</AppBadge>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.from === "user"
                    ? "btn-primary-grad rounded-br-sm"
                    : "glass rounded-bl-sm"
                } ${m.locked ? "border border-gold/40 text-gold" : ""}`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-[11px] px-2.5 py-1 rounded-full glass hover:text-neon-cyan"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(text); }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-2.5">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite sua pergunta..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button type="button" className="text-neon-cyan"><Mic className="size-4" /></button>
            </div>
            <button type="submit" className="size-11 btn-primary-grad rounded-xl flex items-center justify-center">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </GlassCard>

      <GlassCard className="relative hidden lg:flex flex-col items-center text-center overflow-hidden">
        <NeuralLines cx={50} cy={32} count={12} opacity={0.5} reach={1.15} />
        <div className="relative">
          <BrainAI size={140} speaking />
        </div>
        <div className="relative mt-3 text-sm">Estou acompanhando a mesa em tempo real.</div>
        <div className="relative mt-1 text-[11px] text-muted-foreground">
          Toque em uma pergunta rápida ou descreva sua dúvida.
        </div>
      </GlassCard>
    </div>
  );
}