import { useState } from "react";
import { Bot, Send, ShieldCheck } from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { requestLocalAiCommentary } from "@/lib/localAiApi";
import type { AdaptiveStrategySnapshot } from "@/types/adaptiveStrategy";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type Props = {
  adaptiveSnapshot?: AdaptiveStrategySnapshot;
};

const quickQuestions = [
  "Por que nao teve entrada ainda?",
  "Qual o risco atual?",
  "O Surf esta ativo?",
  "O numero pagante esta forte?",
  "Tem risco de Tie?",
  "O que a IA esta vendo agora?",
];

export function LocalAiChatCard({ adaptiveSnapshot }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Estou pronto para explicar a leitura real da mesa. As entradas continuam vindo dos modulos internos.",
    },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask(question: string) {
    const clean = question.trim();
    if (!clean || loading) return;
    setLoading(true);
    setError("");
    setMessages((current) => [...current, { role: "user", text: clean }]);
    setText("");
    try {
      const response = await requestLocalAiCommentary({
        event: "chat",
        question: clean,
        adaptiveSnapshot,
      });
      setMessages((current) => [...current, { role: "assistant", text: response.commentary }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao consultar IA local.";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Mesa em observacao. A IA local nao respondeu agora, entao vou manter apenas a leitura dos modulos internos.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassCard className="p-0">
      <div className="border-b border-border/60 p-4">
        <SectionTitle
          title="Assistente IA Local"
          subtitle="Ollama/Qwen explica as decisoes; nao decide entradas."
          right={<AppBadge tone="green">Local</AppBadge>}
        />
      </div>
      <div className="max-h-[360px] space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-flex max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                message.role === "user"
                  ? "btn-primary-grad rounded-br-sm"
                  : "border border-border/60 bg-secondary/35 rounded-bl-sm"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-secondary/35 px-3.5 py-2.5 text-sm">
            <Bot className="size-4 text-neon-cyan" />
            Analisando dados reais da mesa...
          </div>
        )}
      </div>
      <div className="border-t border-border/60 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {quickQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => void ask(question)}
              className="rounded-full border border-neon-cyan/20 bg-secondary/30 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-neon-cyan"
            >
              {question}
            </button>
          ))}
        </div>
        {error && (
          <div className="mb-3 rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
            {error}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(text);
          }}
          className="flex items-center gap-2"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/60 bg-background/35 px-3 py-2.5">
            <ShieldCheck className="size-4 shrink-0 text-neon-cyan" />
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Pergunte sobre entrada, risco, surf, pagante ou Tie..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="inline-flex size-11 items-center justify-center rounded-xl btn-primary-grad disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Enviar pergunta"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </GlassCard>
  );
}
