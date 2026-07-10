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
//   { day, date, wagers: { [code]: { mode, side, seed, nulled } } }
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

export const invert = (s) => (s === "A" ? "B" : "A");

// Memory references derived from the ledger — computed, never stored.
export function memory(ledger, code) {
  let L = null; // Last: most recent resolved side
  let K = null; // Last Constrained: most recent constrained-resolved side
  for (const day of ledger) {
    const e = day.entries[code];
    if (!e || e.null) continue;
    L = e.side;
    if (e.mode === "C") K = e.side;
  }
  return { L, K };
}

// One wager, one step.
export function flipWager(mem) {
  if (coin()) return { mode: "O", side: null, seed: false };
  const ref = coin() ? mem.L : mem.K;
  if (ref == null) return { mode: "C", side: null, seed: true };
  return { mode: "C", side: invert(ref), seed: false };
}

// Flip a full day for the given wager codes.
export function flipDay(codes, ledger) {
  const wagers = {};
  for (const code of codes) {
    const f = flipWager(memory(ledger, code));
    wagers[code] = { mode: f.mode, side: f.side, seed: f.seed, nulled: false };
  }
  return wagers;
}

// Reconciliation: every wager in the day carries a side or a null.
export function reconciled(day) {
  if (!day) return true;
  return Object.values(day.wagers).every((w) => w.nulled || w.side);
}

export function unresolvedCount(day) {
  if (!day) return 0;
  return Object.values(day.wagers).filter((w) => !w.nulled && !w.side).length;
}

// Commit the day to the ledger. Returns a new ledger; never mutates.
export function commitDay(day, ledger) {
  const entries = {};
  for (const [code, w] of Object.entries(day.wagers)) {
    entries[code] = w.nulled ? { null: true } : { mode: w.mode, side: w.side };
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
  let n = 0, a = 0, nO = 0, aO = 0, nC = 0, nNull = 0;
  const series = [];
  for (const day of ledger) {
    const e = day.entries[code];
    if (!e) continue;
    if (e.null) { nNull++; continue; }
    n++;
    if (e.side === "A") a++;
    if (e.mode === "O") { nO++; if (e.side === "A") aO++; }
    else nC++;
    series.push({ day: day.day, mode: e.mode, side: e.side, pi: a / n });
  }
  return {
    n, nO, nC, nNull,
    pHat: nO ? aO / nO : null,
    piHat: n ? a / n : null,
    series,
  };
}

// ── Simulation ────────────────────────────────────────────────────────────
// The rule is deterministic; the coin is uniform; p parameterizes open
// resolution. Seeding follows the same first-constrained-resolves-open rule.

export function simulate(p, steps) {
  let L = null, K = null, a = 0, n = 0;
  const series = [];
  for (let t = 1; t <= steps; t++) {
    let mode, side;
    if (coin()) {
      mode = "O";
      side = rnd() < p ? "A" : "B";
    } else {
      mode = "C";
      const ref = coin() ? L : K;
      side = ref == null ? (rnd() < p ? "A" : "B") : invert(ref);
    }
    L = side;
    if (mode === "C") K = side;
    n++;
    if (side === "A") a++;
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
  for (const w of wagers) {
    lines.push(
      `  ${w.code}  ${w.name}${w.retired ? "  (retired)" : ""}`
    );
    lines.push(`      A: ${w.a}`);
    lines.push(`      B: ${w.b}`);
  }
  lines.push("");
  lines.push("Days:");
  const codes = wagers.map((w) => w.code);
  for (const day of ledger) {
    const parts = codes
      .filter((c) => day.entries[c])
      .map((c) => {
        const e = day.entries[c];
        return e.null ? `${c} null` : `${c} ${e.mode}:${e.side}`;
      });
    const date = day.date ? day.date.slice(0, 10) : "";
    lines.push(`  ${String(day.day).padStart(3, "0")}  ${date}  ${parts.join("   ")}`);
  }
  lines.push("");
  return lines.join("\n");
}
