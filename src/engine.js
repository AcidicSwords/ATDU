// ATDU engine — pure functions, no UI.
// Implements the canonical two-flip specification.
//
// Ledger: append-only array of days.
//   day = { day: <int>, date: <ISO string>, entries: { [code]: entry } }
//   entry = { mode: 'O'|'C', side: 'A'|'B' }   — a resolved step
//         | { null: true }                      — a null step (recorded for
//           reconciliation; no memory update, no statistical weight)
//
// Day state (mutable until the flip commits it):
//   { day, date, wagers: { [code]: { mode, side, seed, nulled,
//     reference, referenceSide } } }
//
// Rules implemented:
//   Flip One  — environmental: Open or Constrained, fair.
//   Flip Two  — constrained only: heads inverts Last, tails inverts
//               Last Constrained.
//   Seeding   — a constrained step whose reference does not exist resolves
//               open and is recorded as constrained (initializes memory).
//   Null      — either side unavailable, or the wager not live: no memory
//               update, no weight. The current day must be fully reconciled
//               (every live wager: a side or null) before the next flip.

const rnd = (() => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  }
  return Math.random;
})();

export const coin = () => rnd() < 0.5;

export const invert = (side) => (side === "A" ? "B" : "A");

// Memory references derived from the ledger — computed, never stored.
export function memory(ledger, code) {
  let L = null; // Last: most recent resolved side
  let K = null; // Last Constrained: most recent constrained-resolved side
  for (const day of ledger) {
    const entry = day.entries[code];
    if (!entry || entry.null) continue;
    L = entry.side;
    if (entry.mode === "C") K = entry.side;
  }
  return { L, K };
}

// One wager, one step. Reference metadata is presentation-only: it exposes
// the exact derivation without changing the transition rule or Ledger.
export function flipWager(mem) {
  if (coin()) {
    return {
      mode: "O",
      side: null,
      seed: false,
      reference: null,
      referenceSide: null,
    };
  }

  const reference = coin() ? "L" : "K";
  const referenceSide = mem[reference];

  if (referenceSide == null) {
    return {
      mode: "C",
      side: null,
      seed: true,
      reference,
      referenceSide: null,
    };
  }

  return {
    mode: "C",
    side: invert(referenceSide),
    seed: false,
    reference,
    referenceSide,
  };
}

// Flip a full day for the given wager codes.
export function flipDay(codes, ledger) {
  const wagers = {};
  for (const code of codes) {
    const result = flipWager(memory(ledger, code));
    wagers[code] = { ...result, nulled: false };
  }
  return wagers;
}

// Reconciliation: every wager in the day carries a side or a null.
export function reconciled(day) {
  if (!day) return true;
  return Object.values(day.wagers).every((wager) => wager.nulled || wager.side);
}

export function unresolvedCount(day) {
  if (!day) return 0;
  return Object.values(day.wagers).filter(
    (wager) => !wager.nulled && !wager.side,
  ).length;
}

// Commit the day to the ledger. Returns a new ledger; never mutates.
export function commitDay(day, ledger) {
  const entries = {};
  for (const [code, wager] of Object.entries(day.wagers)) {
    entries[code] = wager.nulled
      ? { null: true }
      : { mode: wager.mode, side: wager.side };
  }
  return [...ledger, { day: day.day, date: day.date, entries }];
}

// ── Arithmetic ────────────────────────────────────────────────────────────
// p = P(side A | Open). π = P(side A) overall.
// π = (2 + 3p) / 7, bounded 2/7 ≤ π ≤ 5/7.

export const PI_MIN = 2 / 7;
export const PI_MAX = 5 / 7;
export const piTheory = (p) => (2 + 3 * p) / 7;

export function stats(ledger, code) {
  let n = 0;
  let a = 0;
  let nO = 0;
  let aO = 0;
  let nC = 0;
  let nNull = 0;
  const series = [];

  for (const day of ledger) {
    const entry = day.entries[code];
    if (!entry) continue;
    if (entry.null) {
      nNull += 1;
      continue;
    }
    n += 1;
    if (entry.side === "A") a += 1;
    if (entry.mode === "O") {
      nO += 1;
      if (entry.side === "A") aO += 1;
    } else {
      nC += 1;
    }
    series.push({ day: day.day, mode: entry.mode, side: entry.side, pi: a / n });
  }

  return {
    n,
    nO,
    nC,
    nNull,
    pHat: nO ? aO / nO : null,
    piHat: n ? a / n : null,
    series,
  };
}

// ── Simulation ────────────────────────────────────────────────────────────
// The rule is deterministic; the coin is uniform; p parameterizes open
// resolution. Seeding follows the same first-constrained-resolves-open rule.

export function simulate(p, steps) {
  let L = null;
  let K = null;
  let a = 0;
  let n = 0;
  const series = [];

  for (let t = 1; t <= steps; t += 1) {
    let mode;
    let side;
    if (coin()) {
      mode = "O";
      side = rnd() < p ? "A" : "B";
    } else {
      mode = "C";
      const referenceSide = coin() ? L : K;
      side = referenceSide == null
        ? (rnd() < p ? "A" : "B")
        : invert(referenceSide);
    }
    L = side;
    if (mode === "C") K = side;
    n += 1;
    if (side === "A") a += 1;
    series.push({ t, mode, side, pi: a / n });
  }

  return series;
}

// ── Export ────────────────────────────────────────────────────────────────

export function exportText(wagers, ledger) {
  const lines = [];
  lines.push("ATDU LEDGER");
  lines.push("");
  lines.push("Wagers:");
  for (const wager of wagers) {
    lines.push(
      `  ${wager.code}  ${wager.name}${wager.retired ? "  (retired)" : ""}`,
    );
    lines.push(`      A: ${wager.a}`);
    lines.push(`      B: ${wager.b}`);
  }
  lines.push("");
  lines.push("Days:");
  const codes = wagers.map((wager) => wager.code);
  for (const day of ledger) {
    const parts = codes
      .filter((code) => day.entries[code])
      .map((code) => {
        const entry = day.entries[code];
        return entry.null ? `${code} null` : `${code} ${entry.mode}:${entry.side}`;
      });
    const date = day.date ? day.date.slice(0, 10) : "";
    lines.push(
      `  ${String(day.day).padStart(3, "0")}  ${date}  ${parts.join("   ")}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
