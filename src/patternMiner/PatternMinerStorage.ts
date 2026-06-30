import type { Round } from "@/types/dashboard";
import type { PatternMinerStoredBank } from "@/types/patternMiner";

const STORAGE_KEY = "sniper_pattern_miner_bank_v1";
const MAX_BANK_ROUNDS = 50000;

export class PatternMinerStorage {
  read(): PatternMinerStoredBank {
    const empty = buildEmptyBank();
    if (typeof window === "undefined") return empty;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as Partial<PatternMinerStoredBank>;
      if (!Array.isArray(parsed.rounds)) return empty;
      const rounds = parsed.rounds.map(normalizeStoredRound).filter(Boolean) as Round[];
      return {
        rounds: rounds.slice(-MAX_BANK_ROUNDS),
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : empty.createdAt,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : empty.updatedAt,
      };
    } catch {
      return empty;
    }
  }

  ingest(latestRounds: Round[]) {
    const bank = this.read();
    const updatedAt = new Date().toISOString();
    const byId = new Map<number, Round>();

    for (const round of bank.rounds) byId.set(round.id, round);
    for (const round of latestRounds.map(normalizeStoredRound).filter(Boolean) as Round[]) {
      byId.set(round.id, round);
    }

    const rounds = Array.from(byId.values())
      .sort((a, b) => a.id - b.id)
      .slice(-MAX_BANK_ROUNDS);
    const nextBank: PatternMinerStoredBank = {
      rounds,
      createdAt: bank.createdAt,
      updatedAt,
    };

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBank));
      } catch {
        return nextBank;
      }
    }

    return nextBank;
  }
}

function buildEmptyBank(): PatternMinerStoredBank {
  const now = new Date().toISOString();
  return {
    rounds: [],
    createdAt: now,
    updatedAt: now,
  };
}

function isStoredRound(value: unknown): value is Round {
  return Boolean(normalizeStoredRound(value));
}

function normalizeStoredRound(value: unknown): Round | null {
  if (!value || typeof value !== "object") return null;
  const round = value as Partial<Round>;
  const id = typeof round.id === "number" ? round.id : Number(round.id);
  const bankerScore = typeof round.bankerScore === "number"
    ? round.bankerScore
    : Number(round.bankerScore);
  const playerScore = typeof round.playerScore === "number"
    ? round.playerScore
    : Number(round.playerScore);
  const tieMultiplier =
    typeof round.tieMultiplier === "number" && Number.isFinite(round.tieMultiplier)
      ? round.tieMultiplier
      : undefined;

  if (!Number.isFinite(id) || !Number.isInteger(id)) return null;
  if (!Number.isFinite(bankerScore) || !Number.isFinite(playerScore)) return null;
  if (round.result !== "B" && round.result !== "P" && round.result !== "T") return null;
  if (typeof round.time !== "string") return null;

  return {
    id: Math.trunc(id),
    result: round.result,
    bankerScore,
    playerScore,
    tieMultiplier,
    time: round.time,
  };
}
