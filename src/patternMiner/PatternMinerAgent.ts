import type { Round } from "@/types/dashboard";
import type { PatternMinerConfig, PatternMinerSnapshot } from "@/types/patternMiner";
import { PatternMinerEngine } from "@/patternMiner/PatternMinerEngine";
import { PatternMinerStorage } from "@/patternMiner/PatternMinerStorage";

export class PatternMinerAgent {
  private engine: PatternMinerEngine;
  private storage: PatternMinerStorage;

  constructor(config: Partial<PatternMinerConfig> = {}) {
    this.engine = new PatternMinerEngine(config);
    this.storage = new PatternMinerStorage();
  }

  scan(latestRounds: Round[]): PatternMinerSnapshot {
    const bank = this.storage.ingest(latestRounds);
    return this.engine.analyze(bank.rounds);
  }

  findPatterns(rounds: Round[]) {
    return this.engine.analyze(rounds).strategies;
  }

  updateRanking(rounds: Round[]) {
    return this.engine.analyze(rounds).ranking;
  }

  detectPatternsInFormation(rounds: Round[]) {
    const snapshot = this.engine.analyze(rounds);
    return [...snapshot.entryAlerts, ...snapshot.formingAlerts];
  }
}
