import { deriveSides, snapshotWager } from "./model.js";

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
// A Wager declared Null before the Flip has no mode, Side, or Coin toss:
//   { nulled: true, predeclared: true }
//
// Rules implemented:
//   Flip One  — environmental: Open or Constrained, fair.
//   Flip Two  — constrained only: heads inverts Last, tails inverts
//               Last Constrained.
//   Seeding   — the first constrained step resolves by authored Side, remains
//               constrained, and initializes both memories without a Reference.
//   Null      — either side unavailable, or the wager not live: no memory
//               update, no weight. The current day must be fully reconciled
//               (every live wager: a side or null) before the next flip.

const rnd = (() => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  }
  return Math.random;
})();

export const coin = (random = rnd) => random() < 0.5;

const isSide = (side) => side === "A" || side === "B";
const isMode = (mode) => mode === "O" || mode === "C";

function assertUniqueCodes(codes) {
  if (!Array.isArray(codes) || codes.some((code) => typeof code !== "string" || !code)) {
    throw new TypeError("Wager codes must be non-empty strings");
  }
  if (new Set(codes).size !== codes.length) throw new Error("Wager codes must be unique");
}

export function invert(side) {
  if (side === "A") return "B";
  if (side === "B") return "A";
  throw new TypeError("A Side must be A or B");
}

export function applyEntry(mem, entry) {
  if (!entry || entry.null === true) return { ...mem };
  if ("null" in entry) throw new TypeError("Invalid Null entry");
  if (!isMode(entry.mode) || !isSide(entry.side)) throw new TypeError("Invalid Ledger entry");
  return {
    L: entry.side,
    K: entry.mode === "C" ? entry.side : mem.K,
  };
}

// Memory references derived from the ledger — computed, never stored.
export function memory(ledger, code) {
  let L = null; // Last: most recent resolved side
  let K = null; // Last Constrained: most recent constrained-resolved side
  for (const day of ledger) {
    if (!day?.entries || typeof day.entries !== "object") throw new TypeError("Invalid Ledger Day");
    const entry = day.entries[code];
    if (!entry || entry.null) continue;
    ({ L, K } = applyEntry({ L, K }, entry));
  }
  return { L, K };
}

// One wager, one step. Reference metadata is presentation-only: it exposes
// the exact derivation without changing the transition rule or Ledger.
export function flipWager(mem, toss = coin) {
  if (!mem || (mem.L !== null && !isSide(mem.L)) || (mem.K !== null && !isSide(mem.K)) || (mem.K && !mem.L)) {
    throw new TypeError("Invalid Wager memory");
  }
  if (toss()) {
    return {
      mode: "O",
      side: null,
      seed: false,
      reference: null,
      referenceSide: null,
    };
  }

  if (mem.K == null) {
    return {
      mode: "C",
      side: null,
      seed: true,
      reference: null,
      referenceSide: null,
    };
  }

  const reference = toss() ? "L" : "K";
  const referenceSide = mem[reference];

  return {
    mode: "C",
    side: invert(referenceSide),
    seed: false,
    reference,
    referenceSide,
  };
}

// Flip a full day for the given wager codes.
export function flipDay(codes, ledger, toss = coin) {
  assertUniqueCodes(codes);
  const wagers = {};
  for (const code of codes) {
    const result = flipWager(memory(ledger, code), toss);
    wagers[code] = { ...result, nulled: false };
  }
  return wagers;
}

// Reconciliation: every wager in the day carries a side or a null.
export function reconciled(day) {
  if (!day) return true;
  if (!day.wagers || typeof day.wagers !== "object") return false;
  return Object.values(day.wagers).every((wager) => wager?.nulled === true || isSide(wager?.side));
}

export function unresolvedCount(day) {
  if (!day) return 0;
  if (!day.wagers || typeof day.wagers !== "object") return 0;
  return Object.values(day.wagers).filter(
    (wager) => wager?.nulled !== true && !isSide(wager?.side),
  ).length;
}

// Commit the day to the ledger. Returns a new ledger; never mutates.
export function entryFromWager(wager) {
  if (wager?.nulled === true) return { null: true };
  if (!isMode(wager?.mode) || !isSide(wager?.side)) {
    throw new Error("Cannot record an unresolved Wager");
  }
  return { mode: wager.mode, side: wager.side };
}

// Prepare a Day from the upcoming availability declaration. Predeclared Null
// Wagers enter the Day without consuming either Coin process.
export function prepareDay(codes, ledger, nullCodes = [], toss = coin) {
  assertUniqueCodes(codes);
  assertUniqueCodes(nullCodes);
  const nullSet = new Set(nullCodes);
  if (nullCodes.some((code) => !codes.includes(code))) throw new Error("Null codes must identify a Wager in the Day");
  const liveCodes = codes.filter((code) => !nullSet.has(code));
  const wagers = flipDay(liveCodes, ledger, toss);
  for (const code of codes) {
    if (nullSet.has(code)) {
      wagers[code] = {
        mode: null,
        side: null,
        seed: false,
        reference: null,
        referenceSide: null,
        nulled: true,
        predeclared: true,
      };
    }
  }
  return wagers;
}

export function notation(entry) {
  return entry?.null === true ? "∅" : `${entry.mode}${entry.side}`;
}

export function commitDay(day, ledger) {
  if (!day || !Number.isInteger(day.day) || day.day < 1 || !day.wagers || typeof day.wagers !== "object") {
    throw new TypeError("Cannot record an invalid Day");
  }
  if (!reconciled(day)) throw new Error("Cannot record an unresolved Wager");
  const lastDay = Math.max(0, ...ledger.map((record) => record.day));
  if (day.day <= lastDay) throw new Error("Ledger Days must be appended in ascending order");
  const entries = {};
  const definitions = {};
  for (const [code, wager] of Object.entries(day.wagers)) {
    entries[code] = entryFromWager(wager);
    if (wager.definition) definitions[code] = { ...wager.definition };
  }
  const record = { day: day.day, date: day.date, entries };
  if (Object.keys(definitions).length) record.definitions = definitions;
  return [...ledger, record];
}

export function nextDayNumber(ledger, day = null) {
  const lastRecorded = Math.max(0, ...ledger.map((record) => Number.isInteger(record?.day) ? record.day : 0));
  return Math.max(lastRecorded, Number.isInteger(day?.day) ? day.day : 0) + 1;
}

// One irreversible nightly transaction. All semantic results are generated once
// and returned with the Ledger commit and reveal receipt for one atomic write.
export function commitAndPrepareNight({ wagers, ledger, day, nextNull = {} }, toss = coin, now = () => new Date().toISOString()) {
  if (!Array.isArray(wagers) || !Array.isArray(ledger) || !nextNull || typeof nextNull !== "object") {
    throw new TypeError("Cannot prepare an invalid nightly state");
  }
  const active = wagers.filter((wager) => !wager.retired);
  if (active.some((wager) => wager.needsRebind)) throw new Error("Rebind legacy Wagers before the next Flip");
  const nextLedger = day ? commitDay(day, ledger) : ledger;
  const nullCodes = active.filter((wager) => nextNull[wager.code]).map((wager) => wager.code);
  const flipped = prepareDay(active.map((wager) => wager.code), nextLedger, nullCodes, toss);
  active.forEach((wager) => {
    flipped[wager.code] = { ...flipped[wager.code], definition: snapshotWager(wager) };
  });
  const dayNumber = nextDayNumber(nextLedger, day);
  const nextDay = active.length ? { day: dayNumber, date: now(), wagers: flipped } : null;
  return {
    ledger: nextLedger,
    day: nextDay,
    nextNull: {},
    pendingReveal: nextDay ? { day: dayNumber, closingDay: day?.day ?? null } : null,
    closingDay: day ? nextLedger.at(-1) : null,
    results: active.filter((wager) => !nextNull[wager.code]).map((wager) => ({ code: wager.code, ...flipped[wager.code] })),
    predeclaredNulls: active.filter((wager) => nextNull[wager.code]).map((wager) => ({ code: wager.code, definition: flipped[wager.code].definition })),
  };
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
    if (entry.null === true) {
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

export function simulate(p, steps, random = rnd) {
  if (typeof p !== "number" || p < 0 || p > 1) throw new RangeError("Open Side probability must be between 0 and 1");
  if (!Number.isInteger(steps) || steps < 1) throw new RangeError("Simulation steps must be a positive integer");
  let L = null;
  let K = null;
  let a = 0;
  let n = 0;
  const series = [];

  for (let t = 1; t <= steps; t += 1) {
    let mode;
    let side;
    let reference = null;
    if (coin(random)) {
      mode = "O";
      side = random() < p ? "A" : "B";
    } else {
      mode = "C";
      if (K == null) {
        side = random() < p ? "A" : "B";
      } else {
        reference = coin(random) ? "L" : "K";
        const referenceSide = reference === "L" ? L : K;
        side = invert(referenceSide);
      }
    }
    L = side;
    if (mode === "C") K = side;
    n += 1;
    if (side === "A") a += 1;
    series.push({ t, mode, reference, side, pi: a / n });
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
    const sides = deriveSides(wager);
    lines.push(
      `  ${wager.code}  ${wager.scope}  r${wager.revision || 1}${wager.retired ? "  (retired)" : ""}`,
    );
    lines.push(`      A: ${sides.a}`);
    lines.push(`      B: ${sides.b}`);
  }
  lines.push("");
  lines.push("Days (newest first):");
  const codes = [...new Set([
    ...wagers.map((wager) => wager.code),
    ...ledger.flatMap((day) => Object.keys(day.entries)),
  ])];
  for (const day of [...ledger].sort((left, right) => right.day - left.day)) {
    const parts = codes
      .filter((code) => day.entries[code])
      .map((code) => {
        const entry = day.entries[code];
        const revision = day.definitions?.[code]?.revision;
        const suffix = revision ? ` r${revision}` : "";
        return entry.null === true ? `${code} null${suffix}` : `${code} ${entry.mode}:${entry.side}${suffix}`;
      });
    const date = day.date ? day.date.slice(0, 10) : "";
    lines.push(
      `  ${String(day.day).padStart(3, "0")}  ${date}  ${parts.join("   ")}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
