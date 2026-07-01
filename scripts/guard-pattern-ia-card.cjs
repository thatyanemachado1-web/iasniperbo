const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const files = {
  patternCard: path.join(root, "src", "components", "patternMiner", "PatternMinerMiniCard.tsx"),
  neuralCard: path.join(root, "src", "components", "dashboard", "LeituraNeuralMiniCard.tsx"),
};

const checks = [
  {
    file: files.patternCard,
    label: "Pattern IA card component",
    snippets: [
      "export function PatternMinerMiniCard({",
      'className="h-full rounded-xl border-neon-cyan/35 p-3"',
      'className="min-w-0 text-base font-black leading-tight">Padr\u00f5es IA</div>',
      "const monitoringAlert = findLiveMonitoringAlert(snapshot);",
      "function PatternLiveStatusHeader({",
      'isUsingRealData ? "monitorando ao vivo" : "aguardando feed real"',
      "function MonitoringPatternBlock({",
      "<PatternSequence sequence={strategy.sequence} compact showSideLetters={false} />",
      "function LivePatternStatusBlock({ alert }: { alert: PatternMinerAlert })",
      "ENTRADA CONFIRMADA",
      "function WaitingConfirmedEntryBlock({ isUsingRealData }: { isUsingRealData: boolean })",
      "Analisando padroes",
      "Aguardando nova Entrada Confirmada. Os padroes em formacao seguem abaixo.",
      "function MiniScoreboard({ snapshot }: { snapshot: PatternMinerSnapshot })",
      "Placar IA",
      "function MiniFormationList({ strategies }: { strategies: PatternMinerStrategy[] })",
      "Em formacao",
      "Padrao IA",
      "strategy.red_count <= 2",
      "accuracy >= 99.995",
      "strategy.totalValidated >= 2",
      "strategy.occurrences >= 3",
      "Bloqueia acima de 2 reds.",
      "Pronto para virar Entrada Confirmada no sinal atual.",
      "function findLiveMonitoringAlert(snapshot: PatternMinerSnapshot)",
      "alert.progress >= 1",
      "Boolean(strategy.signal_id)",
      'to="/app/padroes"',
    ],
  },
  {
    file: files.neuralCard,
    label: "Neural number token approved visual",
    snippets: [
      "function NeuralNumberToken({",
      "compactNumberTokenLabel(label)",
      "inline-grid size-5 shrink-0 place-items-center rounded-full border font-black leading-none tabular-nums",
      'compactLabel.length > 1 ? "text-[10px]" : "text-[12px]"',
      "numberTokenClass(side)",
      "{compactLabel}",
    ],
  },
];

let failed = false;

for (const check of checks) {
  const source = fs.readFileSync(check.file, "utf8");
  const missing = check.snippets.filter((snippet) => !source.includes(snippet));

  if (missing.length) {
    failed = true;
    console.error(`\n[pattern-card-lock] ${check.label} changed: ${path.relative(root, check.file)}`);
    for (const snippet of missing) {
      console.error(`  - missing: ${snippet}`);
    }
  }
}

if (failed) {
  console.error(
    "\n[pattern-card-lock] Build blocked. The approved Pattern IA card is locked. Update this guard only when the user asks to change the definitive card.",
  );
  process.exit(1);
}

console.log("[pattern-card-lock] Approved Pattern IA card is locked.");
