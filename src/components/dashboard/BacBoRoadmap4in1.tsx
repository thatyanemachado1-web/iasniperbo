import "./BacBoRoadmap4in1.css";

export type RoadmapResult = {
  id: string;
  side: "PLAYER" | "BANKER" | "TIE";
};

type Mark = { id: string; row: number; column: number; color: "blue" | "red"; tieCount?: number };

const BIG_ROWS = 6;
const BIG_COLUMNS = 42;
const BIG_RESERVED_COLUMNS = 4;
const DERIVED_COLUMNS = 28;
const DERIVED_RESERVED_MINI_COLUMNS = 4;

export function BacBoRoadmap4in1({ results }: { results: RoadmapResult[] }) {
  const bigRoad = buildBigRoad(results);
  const bigEye = buildDerivedRoad(bigRoad, 1, "eye");
  const small = buildDerivedRoad(bigRoad, 2, "small");
  const cockroach = buildDerivedRoad(bigRoad, 3, "cockroach");

  return (
    <div className="bacbo-roadmap-4in1-scroll">
      <div className="bacbo-roadmap-4in1" aria-label="Roadmap 4 em 1 do Bac Bo">
        <RoadGrid className="bacbo-roadmap-4in1__big" rows={6} columns={42} marks={bigRoad} kind="big" />
        <div className="bacbo-roadmap-4in1__derived">
          <RoadGrid className="bacbo-road-grid--derived" rows={8} columns={28} marks={bigEye} kind="eye" />
          <RoadGrid className="bacbo-road-grid--derived" rows={8} columns={28} marks={small} kind="small" />
          <RoadGrid className="bacbo-road-grid--derived" rows={8} columns={28} marks={cockroach} kind="cockroach" />
        </div>
      </div>
    </div>
  );
}

function RoadGrid({ rows, columns, marks, kind, className = "" }: {
  rows: number; columns: number; marks: Mark[]; kind: "big" | "eye" | "small" | "cockroach"; className?: string;
}) {
  const byCell = new Map(marks.map((mark) => [`${mark.row}:${mark.column}`, mark]));
  return (
    <div className={`bacbo-road-grid ${className}`} style={{ "--road-rows": rows, "--road-columns": columns } as React.CSSProperties}>
      {Array.from({ length: rows * columns }, (_, index) => {
        const row = index % rows;
        const column = Math.floor(index / rows);
        const mark = byCell.get(`${row}:${column}`);
        return <span key={`${row}-${column}`} className="bacbo-road-grid__cell" style={{ gridRow: row + 1, gridColumn: column + 1 }}>
          {mark ? (
            <i className={`bacbo-road-mark bacbo-road-mark--${kind} bacbo-road-mark--${mark.color}${mark.tieCount ? " has-tie" : ""}`}>
              {kind === "big" && (mark.tieCount ?? 0) > 1 ? <b className="bacbo-road-mark__tie-count">{mark.tieCount}</b> : null}
            </i>
          ) : null}
        </span>;
      })}
    </div>
  );
}

function buildBigRoad(results: RoadmapResult[]): Mark[] {
  const marks: Mark[] = [];
  const occupied = new Set<string>();
  let column = -1;
  let row = 0;
  let lastMain: "PLAYER" | "BANKER" | null = null;
  let tailColumn = -1;
  let tieCount = 0;
  let dragonTail = false;

  for (const result of results) {
    if (result.side === "TIE") {
      tieCount += 1;
      if (marks.length) marks[marks.length - 1].tieCount = (marks[marks.length - 1].tieCount ?? 0) + 1;
      continue;
    }
    const changed = lastMain !== result.side;
    if (changed) {
      column = tailColumn + 1;
      row = 0;
      tieCount = 0;
      dragonTail = false;
    } else {
      const nextRow = row + 1;
      if (!dragonTail && nextRow < BIG_ROWS && !occupied.has(`${nextRow}:${column}`)) {
        row = nextRow;
      } else {
        dragonTail = true;
        column += 1;
      }
    }
    if (column >= BIG_COLUMNS - BIG_RESERVED_COLUMNS) {
      for (const mark of marks) mark.column -= 1;
      column -= 1;
      tailColumn -= 1;
      occupied.clear();
      for (const mark of marks) if (mark.column >= 0) occupied.add(`${mark.row}:${mark.column}`);
    }
    const mark: Mark = { id: result.id, row, column, color: result.side === "PLAYER" ? "blue" : "red" };
    marks.push(mark);
    occupied.add(`${row}:${column}`);
    tailColumn = Math.max(tailColumn, column);
    lastMain = result.side;
  }
  return marks.filter((mark) => mark.column >= 0 && mark.column < BIG_COLUMNS);
}

function buildDerivedRoad(bigRoad: Mark[], offset: number, kind: string): Mark[] {
  const occupancy = new Set(bigRoad.map((mark) => `${mark.row}:${mark.column}`));
  const columnHeights = new Map<number, number>();
  for (const mark of bigRoad) {
    columnHeights.set(mark.column, Math.max(columnHeights.get(mark.column) ?? 0, mark.row + 1));
  }
  const signals: Array<{ id: string; color: "blue" | "red" }> = [];
  for (const mark of bigRoad) {
    if (mark.column < offset + 1) continue;
    let color: "blue" | "red";
    if (mark.row === 0) {
      const previousHeight = columnHeights.get(mark.column - 1) ?? 0;
      const comparisonHeight = columnHeights.get(mark.column - offset - 1) ?? 0;
      color = previousHeight === comparisonHeight ? "red" : "blue";
    } else {
      const referenceColumn = mark.column - offset;
      const sameRow = occupancy.has(`${mark.row}:${referenceColumn}`);
      const previousRow = occupancy.has(`${mark.row - 1}:${referenceColumn}`);
      color = sameRow === previousRow ? "red" : "blue";
    }
    signals.push({ id: `${kind}-${mark.id}`, color });
  }
  return flowDerived(signals);
}

function flowDerived(signals: Array<{ id: string; color: "blue" | "red" }>): Mark[] {
  const marks: Mark[] = [];
  let column = -1;
  let row = 0;
  let last: "blue" | "red" | null = null;
  const occupied = new Set<string>();
  for (const signal of signals) {
    if (signal.color !== last) { column += 1; row = 0; }
    else if (row < 7 && !occupied.has(`${row + 1}:${column}`)) row += 1;
    else column += 1;
    if (column >= DERIVED_COLUMNS - DERIVED_RESERVED_MINI_COLUMNS) {
      for (const mark of marks) mark.column -= 1;
      column -= 1;
      occupied.clear();
      for (const mark of marks) if (mark.column >= 0) occupied.add(`${mark.row}:${mark.column}`);
    }
    marks.push({ id: signal.id, row, column, color: signal.color });
    occupied.add(`${row}:${column}`);
    last = signal.color;
  }
  return marks.filter((mark) => mark.column >= 0 && mark.column < DERIVED_COLUMNS - DERIVED_RESERVED_MINI_COLUMNS);
}
