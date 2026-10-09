/** `X` or `X.Y`. Strict string form: "3.10" is major 3, minor 10. */
export interface Sequence {
  major: number;
  minor: number | null;
}

/** A negative level runs before the turn, a positive level after it, "ALT" is the alt skill. */
export type Overdrive = "ALT" | number | null;

export interface GameRound {
  /** Label for console output only. */
  label: string;
  position: number;
  swap: boolean;
  sequence: Sequence | null;
  targetPosition: number | null;
  execute: boolean;
  overdrive: Overdrive;
}

const toBool = (v: string | undefined) => (v ?? "").trim().toUpperCase() === "TRUE";

function parseInteger(v: string | undefined): number | null {
  const s = (v ?? "").trim();
  if (s === "" || Number.isNaN(Number(s))) return null;
  return Math.trunc(Number(s));
}

function parseSequence(v: string | undefined): Sequence | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec((v ?? "").trim());
  return m ? { major: Number(m[1]), minor: m[2] === undefined ? null : Number(m[2]) } : null;
}

function parseOverdrive(v: string | undefined): Overdrive {
  if ((v ?? "").trim().toUpperCase() === "ALT") return "ALT";
  const n = parseInteger(v);
  return n !== null && n >= -3 && n <= 3 && n !== 0 ? n : null;
}

/** Builds a round from one CSV record (all fields are strings; blanks are empty strings). */
export function parseGameRound(row: Record<string, string>): GameRound {
  const position = parseInteger(row.position);
  if (position === null) {
    throw new Error(`Invalid position in row: ${JSON.stringify(row)}`);
  }
  return {
    label: (row.round_number ?? "").trim(),
    position,
    swap: toBool(row.swap_flag),
    sequence: parseSequence(row.skill_swap_sequence),
    targetPosition: parseInteger(row.skill_target_position),
    execute: toBool(row.execute),
    overdrive: parseOverdrive(row.overdrive_level),
  };
}

export function describeRound(r: GameRound): string {
  const od = r.overdrive ? `OD:${r.overdrive}` : "OD:None";
  const pos = r.position === 0 ? "Pos:Skip" : `Pos:${r.position}`;
  const seq = r.sequence ? `Seq:${r.sequence.major}${r.sequence.minor === null ? "" : "." + r.sequence.minor}` : "Seq:None";
  const tgt = r.targetPosition ? `Target:${r.targetPosition}` : "";
  return `[ ${r.label.padEnd(10)} ]: ${od.padEnd(8)} │ ${pos.padEnd(8)} │ ${(r.swap ? "SWAP" : "SKILL").padEnd(5)} │ ${seq.padEnd(8)} │ ${
    tgt.padEnd(8)
  } │ ${(r.execute ? "EXECUTE" : "").padEnd(7)}`;
}
