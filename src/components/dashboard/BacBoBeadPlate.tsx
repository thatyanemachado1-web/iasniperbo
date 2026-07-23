import "./BacBoBeadPlate.css";
import { useState } from "react";

export type BacBoResult = {
  id: string;
  side: "BANKER" | "PLAYER" | "TIE";
  value: number;
  slot?: number;
  time?: string | null;
  tieMultiplier?: number | null;
};

const ROWS = 6;
const COLUMNS = 26;
const CAPACITY = ROWS * COLUMNS;

export function BacBoBeadPlate({ results }: { results: BacBoResult[] }) {
  const [displayMode, setDisplayMode] = useState<"numbers" | "sides">("numbers");
  const resultsBySlot = new Map<number, BacBoResult>();
  for (const [index, result] of results.entries()) {
    const slot = Number.isInteger(result.slot) ? Number(result.slot) : index;
    if (slot >= 0 && slot < CAPACITY) resultsBySlot.set(slot, result);
  }

  return (
    <div className="bacbo-bead-plate-shell">
      <div className="bacbo-bead-plate-toggle" aria-label="Formato das bolinhas">
        <button
          type="button"
          className={displayMode === "numbers" ? "is-active" : ""}
          onClick={() => setDisplayMode("numbers")}
        >
          123
        </button>
        <button
          type="button"
          className={displayMode === "sides" ? "is-active" : ""}
          onClick={() => setDisplayMode("sides")}
        >
          P B T
        </button>
      </div>
      <div className="bacbo-bead-plate-scroll" aria-label="Historico numerico real do Bac Bo">
        <div className="bacbo-bead-plate" role="grid" aria-rowcount={ROWS} aria-colcount={COLUMNS}>
        {Array.from({ length: CAPACITY }, (_, index) => {
          const result = resultsBySlot.get(index);
          const row = index % ROWS;
          const column = Math.floor(index / ROWS);

          return (
            <div
              key={result?.id ?? `empty-${index}`}
              className="bacbo-bead-plate__cell"
              role="gridcell"
              style={{ gridRow: row + 1, gridColumn: column + 1 }}
            >
              {result ? (
                <span
                  className={`bacbo-bead-plate__ball bacbo-bead-plate__ball--${result.side.toLowerCase()}`}
                  title={`${result.side} ${result.value}`}
                >
                  {displayMode === "numbers" ? result.value : sideToken(result.side)}
                </span>
              ) : null}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function sideToken(side: BacBoResult["side"]) {
  if (side === "BANKER") return "B";
  if (side === "PLAYER") return "P";
  return "T";
}
