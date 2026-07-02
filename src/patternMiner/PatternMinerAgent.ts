import type { Round } from "@/types/dashboard";
import type { PatternMinerConfig, PatternMinerSnapshot } from "@/types/patternMiner";
import { PatternMinerEngine, type PatternMinerRuntimeContext } from "@/patternMiner/PatternMinerEngine";
import { PatternMinerStorage } from "@/patternMiner/PatternMinerStorage";

export class PatternMinerAgent {
  private engine: PatternMinerEngine;
  private storage: PatternMinerStorage;

  constructor(config: Partial<PatternMinerConfig> = {}) {
    this.engine = new PatternMinerEngine(config);
    this.storage = new PatternMinerStorage();
  }

  scan(latestRounds: Round[], context: PatternMinerRuntimeContext = {}): PatternMinerSnapshot {
    const bank = this.storage.ingest(latestRounds);
    return this.engine.analyze(bank.rounds, context);
  }

  findPatterns(rounds: Round[], context: PatternMinerRuntimeContext = {}) {
    return this.engine.analyze(rounds, context).strategies;
  }

  updateRanking(rounds: Round[], context: PatternMinerRuntimeContext = {}) {
    return this.engine.analyze(rounds, context).ranking;
  }

  detectPatternsInFormation(rounds: Round[], context: PatternMinerRuntimeContext = {}) {
    const snapshot = this.engine.analyze(rounds, context);
    return [...snapshot.entryAlerts, ...snapshot.formingAlerts];
  }
}
