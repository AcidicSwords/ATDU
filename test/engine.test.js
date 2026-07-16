import test from "node:test";
import assert from "node:assert/strict";
import {
  PI_MAX, PI_MIN, applyEntry, commitAndPrepareNight, commitDay, entryFromWager,
  exportText, flipDay, flipWager, invert, memory, nextDayNumber, notation,
  piTheory, prepareDay, reconciled, simulate, unresolvedCount,
} from "../src/engine.js";
import {
  APP_STATE_VERSION, STORAGE_KEYS, createEmptyAppState, deriveSides, hydrateAppState,
  hydrateDay, hydrateLedger, hydrateNextNull, hydrateWagers, migrateLegacyState,
  normalizeAuthoredText, parseLegacySides, parseStored, sameWagerDefinition,
  snapshotDay, snapshotWager, updateWager, validateWagerDraft,
} from "../src/model.js";

const makeWager = (code = "W1", revision = 1) => ({
  code,
  scope: `Scope ${code}`,
  constructor: "NOT",
  variables: { act: `act ${code}` },
  revision,
  retired: false,
});

const ledger = [
  { day: 1, date: "2026-01-01T00:00:00.000Z", entries: { W1: { mode: "C", side: "A" }, W2: { mode: "C", side: "B" } } },
  { day: 2, date: "2026-01-02T00:00:00.000Z", entries: { W1: { mode: "O", side: "B" }, W2: { null: true } } },
];

function tosses(...values) {
  let index = 0;
  const toss = () => {
    assert.ok(index < values.length, "unexpected toss");
    return values[index++];
  };
  toss.count = () => index;
  return toss;
}

test("inversion is binary, symmetric, and closed", () => {
  assert.equal(invert("A"), "B");
  assert.equal(invert("B"), "A");
  for (const side of ["A", "B"]) assert.equal(invert(invert(side)), side);
  assert.throws(() => invert("preferred"), /Side must be A or B/);
});

test("Ledger entries retain only channel and Side", () => {
  for (const [mode, side, expected] of [["O", "A", "OA"], ["O", "B", "OB"], ["C", "A", "CA"], ["C", "B", "CB"]]) {
    const entry = entryFromWager({ mode, side, nulled: false });
    assert.deepEqual(entry, { mode, side });
    assert.equal(notation(entry), expected);
  }
});

test("memory follows channel while Null changes nothing", () => {
  assert.deepEqual(memory(ledger, "W1"), { L: "B", K: "A" });
  assert.deepEqual(memory(ledger, "W2"), { L: "B", K: "B" });
  const start = { L: "A", K: "B" };
  assert.deepEqual(applyEntry(start, { mode: "O", side: "B" }), { L: "B", K: "B" });
  assert.deepEqual(applyEntry(start, { mode: "C", side: "A" }), { L: "A", K: "A" });
  assert.deepEqual(applyEntry(start, { null: true }), start);
  assert.equal(notation({ null: true }), "∅");
});

test("first Constrained remains C without inventing history", () => {
  const toss = tosses(false);
  assert.deepEqual(flipWager({ L: "A", K: null }, toss), {
    mode: "C", side: null, seed: true, reference: null, referenceSide: null,
  });
  assert.equal(toss.count(), 1);
});

test("initialized Constrained events select either memory fairly and invert it", () => {
  for (const L of ["A", "B"]) for (const K of ["A", "B"]) {
    assert.equal(flipWager({ L, K }, tosses(false, true)).side, invert(L));
    assert.equal(flipWager({ L, K }, tosses(false, false)).side, invert(K));
  }
});

test("each Wager consumes independent Coin tosses", () => {
  const toss = tosses(true, false, true);
  const day = flipDay(["W1", "W2"], ledger, toss);
  assert.equal(day.W1.mode, "O");
  assert.equal(day.W2.mode, "C");
  assert.equal(day.W2.reference, "L");
  assert.equal(toss.count(), 3);
});

test("pre-Coin Null bypasses both processes and never changes memory", () => {
  const toss = tosses(true);
  const wagers = prepareDay(["W1", "W2"], ledger, ["W2"], toss);
  assert.equal(toss.count(), 1);
  assert.equal(wagers.W2.predeclared, true);
  assert.equal(wagers.W2.mode, null);
  wagers.W1.side = "A";
  const recorded = commitDay({ day: 3, date: "", wagers }, ledger);
  assert.deepEqual(recorded.at(-1).entries.W2, { null: true });
  assert.deepEqual(memory(recorded, "W2"), memory(ledger, "W2"));
});

test("all four constructors derive two readings from one variable source", () => {
  assert.deepEqual(deriveSides({ constructor: "NOT", variables: { act: "x" } }), { a: "DO x", b: "DO NOT DO x" });
  assert.deepEqual(deriveSides({ constructor: "BIFURCATION", variables: { consequence: "x", routeA: "y", routeB: "z" } }), { a: "x THROUGH y", b: "x THROUGH z" });
  assert.deepEqual(deriveSides({ constructor: "ASYMPTOTE", variables: { measure: "x", reference: "y" } }), { a: "x AT MOST y", b: "x AT LEAST y" });
  assert.deepEqual(deriveSides({ constructor: "PRECEDENCE", variables: { act: "x", anchor: "y" } }), { a: "x BEFORE y", b: "x AFTER y" });
});

test("canonical validation normalizes identity and rejects an invalid contrast", () => {
  const route = validateWagerDraft({
    code: " r1! ", scope: " bounded   scope ", constructor: "BIFURCATION",
    consequence: "shared consequence", routeA: "first route", routeB: "second route",
  });
  assert.equal(route.valid, true);
  assert.deepEqual(route.wager, {
    code: "R1", scope: "bounded scope", constructor: "BIFURCATION",
    variables: { consequence: "shared consequence", routeA: "first route", routeB: "second route" },
    revision: 1, retired: false,
  });
  assert.equal("a" in route.wager, false);
  assert.equal("b" in route.wager, false);
  const invalid = validateWagerDraft({ ...route.wager, code: "R2", variables: { consequence: "x", routeA: "same", routeB: " SAME " } });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.routeA, /distinct routes/);
  assert.equal(normalizeAuthoredText(" x\u0000  y "), "x y");
});

test("legacy grammar is parsed losslessly and malformed pairs are quarantined", () => {
  assert.deepEqual(parseLegacySides("NOT", "DO x", "DO NOT DO x"), { act: "x" });
  assert.deepEqual(parseLegacySides("ASYMPTOTE", "x AT MOST y", "x AT LEAST y"), { measure: "x", reference: "y" });
  const migrated = hydrateWagers([
    { code: "LX", name: "Legacy", type: "NOT", a: "DO x", b: "DO NOT DO x" },
    { code: "L2", name: "Legacy two", type: "NOT", a: "A", b: "B" },
  ]);
  assert.deepEqual(migrated[0].variables, { act: "x" });
  assert.equal(migrated[1].needsRebind, true);
  assert.deepEqual(deriveSides(migrated[1]), { a: "A", b: "B" });
});

test("v2 keys migrate into one valid v3 state", () => {
  const state = migrateLegacyState({
    wagers: JSON.stringify([makeWager("W1")]),
    ledger: JSON.stringify(ledger),
    day: null,
    nextNull: JSON.stringify({ W1: true, XX: true }),
  });
  assert.equal(state.version, APP_STATE_VERSION);
  assert.equal(state.wagers.length, 1);
  assert.deepEqual(state.nextNull, { W1: true });
  assert.deepEqual(STORAGE_KEYS, {
    state: "atdu3-state", legacyWagers: "atdu2-w", legacyLedger: "atdu2-l",
    legacyDay: "atdu2-d", legacyNextNull: "atdu2-n",
  });
});

test("AppState hydration preserves a pending fixed reveal receipt", () => {
  const definition = snapshotWager(makeWager("W1"));
  const state = hydrateAppState({
    ...createEmptyAppState(),
    day: { day: 3, date: "", wagers: { W1: { mode: "O", side: null, seed: false, reference: null, referenceSide: null, nulled: false, definition } } },
    pendingReveal: { day: 3, closingDay: 2 },
    ledger,
    wagers: [makeWager("W1")],
  });
  assert.deepEqual(state.pendingReveal, { day: 3, closingDay: 2 });
  assert.equal(hydrateAppState({ ...state, pendingReveal: { day: 4, closingDay: 2 } }).pendingReveal, null);
});

test("nightly transaction records, generates, snapshots, and receipts once", () => {
  const wagers = [makeWager("W1"), makeWager("W2")];
  const today = { day: 3, date: "", wagers: {
    W1: { mode: "O", side: "A", nulled: false, definition: snapshotWager(wagers[0]) },
    W2: { mode: "C", side: "B", nulled: false, definition: snapshotWager(wagers[1]) },
  } };
  const toss = tosses(true);
  const night = commitAndPrepareNight({ wagers, ledger, day: today, nextNull: { W2: true } }, toss, () => "fixed");
  assert.equal(toss.count(), 1);
  assert.equal(night.ledger.at(-1).day, 3);
  assert.equal(night.day.day, 4);
  assert.equal(night.day.date, "fixed");
  assert.equal(night.day.wagers.W2.predeclared, true);
  assert.deepEqual(night.pendingReveal, { day: 4, closingDay: 3 });
  assert.equal("a" in night.day.wagers.W1.definition, false);
  assert.equal("variables" in night.day.wagers.W1.definition, true);
});

test("legacy active Wagers cannot enter a new Coin event", () => {
  const legacy = hydrateWagers([{ code: "LX", name: "Legacy", type: "NOT", a: "A", b: "B" }]);
  assert.throws(() => commitAndPrepareNight({ wagers: legacy, ledger: [], day: null, nextNull: {} }), /Rebind legacy/);
});

test("Day snapshots and Ledger records retain historical definitions", () => {
  const revision1 = makeWager("W1", 1);
  const day = snapshotDay({ day: 1, date: "", wagers: { W1: { mode: "O", side: "A", nulled: false } } }, [revision1]);
  const revision2 = { ...revision1, scope: "Changed scope", variables: { act: "changed" }, revision: 2 };
  assert.deepEqual(day.wagers.W1.definition, snapshotWager(revision1));
  assert.notDeepEqual(day.wagers.W1.definition, snapshotWager(revision2));
  const recorded = commitDay(day, []);
  revision1.variables.act = "mutated";
  assert.equal(recorded[0].definitions.W1.variables.act, "act W1");
});

test("definition equality ignores lifecycle metadata but not meaning", () => {
  const base = makeWager("W1");
  assert.equal(sameWagerDefinition(base, { ...base, revision: 9, retired: true }), true);
  assert.equal(sameWagerDefinition(base, { ...base, scope: "changed" }), false);
  assert.deepEqual(updateWager([base], "W1", { code: "XX", scope: "changed" })[0].code, "W1");
});

test("hydration rejects incoherent Days and keeps Ledger chronological", () => {
  assert.equal(hydrateDay({ day: 2, wagers: { X: { mode: "C", side: "A", reference: "L", referenceSide: "A" } } }), null);
  assert.equal(hydrateDay({ day: 2, wagers: { X: { predeclared: true, nulled: false } } }), null);
  const records = hydrateLedger([
    { day: 3, entries: { X: { mode: "O", side: "A" } } },
    { day: 1, entries: { X: { null: true } } },
    { day: 3, entries: { X: { mode: "C", side: "B" } } },
  ]);
  assert.deepEqual(records.map(({ day }) => day), [1, 3]);
  assert.deepEqual(hydrateNextNull({ W1: true, W2: false, W3: "true" }), { W1: true });
});

test("append-only and input guards hold at every boundary", () => {
  const unresolved = { day: 3, date: "", wagers: { W1: { mode: "O", side: null, nulled: false } } };
  assert.equal(reconciled(unresolved), false);
  assert.equal(unresolvedCount(unresolved), 1);
  assert.throws(() => commitDay(unresolved, ledger), /unresolved Wager/);
  assert.throws(() => commitDay({ ...unresolved, day: 2, wagers: { W1: { mode: "O", side: "A" } } }, ledger), /ascending order/);
  assert.throws(() => flipDay(["W1", "W1"], ledger), /unique/);
  assert.throws(() => prepareDay(["W1"], ledger, ["W2"]), /identify a Wager/);
  assert.throws(() => flipWager({ L: null, K: "A" }), /Invalid Wager memory/);
});

test("twenty Wagers remain independent and bounded", () => {
  const codes = Array.from({ length: 20 }, (_, index) => `W${index}`);
  const toss = tosses(...Array(20).fill(true));
  const day = flipDay(codes, [], toss);
  assert.equal(Object.keys(day).length, 20);
  assert.equal(toss.count(), 20);
});

test("simulation and convergence bounds remain unchanged", () => {
  assert.equal(piTheory(0), PI_MIN);
  assert.equal(piTheory(0.5), 0.5);
  assert.equal(piTheory(1), PI_MAX);
  assert.throws(() => simulate(1.1, 10), /between 0 and 1/);
  assert.throws(() => simulate(0.5, 0), /positive integer/);
});

test("export derives readings and lists newest days first", () => {
  const text = exportText([makeWager("W1")], [...ledger, { day: 3, date: "", entries: { W1: { mode: "O", side: "A" }, HX: { null: true } } }]);
  assert.match(text, /A: DO act W1/);
  assert.ok(text.indexOf("003") < text.indexOf("002"));
  assert.match(text, /HX null/);
  assert.equal(nextDayNumber(ledger, { day: 8 }), 9);
  assert.deepEqual(parseStored("broken", []), []);
});
