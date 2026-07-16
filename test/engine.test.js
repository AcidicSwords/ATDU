import test from "node:test";
import assert from "node:assert/strict";
import {
  PI_MAX, PI_MIN, applyEntry, commitDay, entryFromWager, flipDay, flipWager,
  exportText, invert, memory, nextDayNumber, notation, piTheory, prepareDay,
  reconciled, simulate, unresolvedCount,
} from "../src/engine.js";
import {
  STORAGE_KEYS, generatedSides, hydrateDay, hydrateLedger, hydrateNextNull,
  hydrateWagers, normalizeAuthoredText, parseStored, sameWagerDefinition,
  snapshotDay, snapshotWager, updateWager, validateWagerDraft,
} from "../src/model.js";

const ledger = [
  { day: 1, date: "2026-01-01T00:00:00.000Z", entries: {
    W1: { mode: "C", side: "A" }, W2: { mode: "C", side: "B" },
  } },
  { day: 2, date: "2026-01-02T00:00:00.000Z", entries: {
    W1: { mode: "O", side: "B" }, W2: { null: true },
  } },
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

test("1-3: inversion is binary, symmetric, and closed", () => {
  assert.equal(invert("A"), "B");
  assert.equal(invert("B"), "A");
  for (const side of ["A", "B"]) assert.equal(invert(invert(side)), side);
  assert.throws(() => invert("preferred"), /Side must be A or B/);
});

test("4-7, 23: canonical entries retain channel and Side", () => {
  for (const [mode, side, expected] of [
    ["O", "A", "OA"], ["O", "B", "OB"], ["C", "A", "CA"], ["C", "B", "CB"],
  ]) {
    const entry = entryFromWager({ mode, side, nulled: false });
    assert.deepEqual(entry, { mode, side });
    assert.equal(notation(entry), expected);
  }
});

test("8-9: memory updates follow the resolution channel", () => {
  const start = { L: "A", K: "B" };
  assert.deepEqual(applyEntry(start, { mode: "O", side: "B" }), { L: "B", K: "B" });
  assert.deepEqual(applyEntry(start, { mode: "C", side: "A" }), { L: "A", K: "A" });
});

test("10-11: first Constrained stays C with no invented Reference", () => {
  const toss = tosses(false);
  const result = flipWager({ L: "A", K: null }, toss);
  assert.deepEqual(result, {
    mode: "C", side: null, seed: true, reference: null, referenceSide: null,
  });
  assert.equal(toss.count(), 1);
  assert.equal(notation(entryFromWager({ ...result, side: "B", nulled: false })), "CB");
});

test("12-13: Last and Last Constrained retain distinct history", () => {
  assert.deepEqual(memory(ledger, "W1"), { L: "B", K: "A" });
  assert.deepEqual(memory(ledger, "W2"), { L: "B", K: "B" });
});

test("14-15, 25: Null changes no memory and infers no Side", () => {
  const start = { L: "A", K: "B" };
  const entry = entryFromWager({ mode: "O", side: "A", nulled: true });
  assert.deepEqual(entry, { null: true });
  assert.equal(notation(entry), "∅");
  assert.deepEqual(applyEntry(start, entry), start);
  assert.equal(entry.mode, undefined);
  assert.equal(entry.side, undefined);
});

test("16: Wager editing preserves code and history", () => {
  const before = structuredClone(ledger);
  const wagers = [{ code: "W1", name: "Old", a: "A", b: "B" }];
  assert.deepEqual(updateWager(wagers, "W1", { code: "XX", name: "New" }), [
    { code: "W1", name: "New", a: "A", b: "B" },
  ]);
  assert.deepEqual(ledger, before);
});

test("17: Wagers consume independent Gate and Reference tosses", () => {
  const toss = tosses(true, false, true);
  const day = flipDay(["W1", "W2"], ledger, toss);
  assert.equal(day.W1.mode, "O");
  assert.equal(day.W2.mode, "C");
  assert.equal(day.W2.reference, "L");
  assert.equal(toss.count(), 3);
});

test("18-20: generated results serialize and present without reroll or mutation", () => {
  const toss = tosses(false, false);
  const wagers = flipDay(["W1"], ledger, toss);
  const day = { day: 3, date: "2026-01-03T00:00:00.000Z", wagers };
  const snapshot = structuredClone(day);
  assert.deepEqual(hydrateDay(parseStored(JSON.stringify(day), null)), snapshot);
  assert.equal(toss.count(), 2);
  assert.equal(notation(entryFromWager({ ...wagers.W1, nulled: false })), "CB");
  assert.deepEqual(day, snapshot);
});

test("21: legacy storage hydrates without destructive migration", () => {
  const legacy = [{ code: "LX", name: "Legacy", a: "A", b: "B", type: "NOT" }];
  assert.deepEqual(hydrateWagers(parseStored(JSON.stringify(legacy), [])), [
    { ...legacy[0], revision: 1, retired: false },
  ]);
  assert.deepEqual(hydrateLedger(ledger), ledger);
  assert.deepEqual(STORAGE_KEYS, { wagers: "atdu2-w", ledger: "atdu2-l", day: "atdu2-d", nextNull: "atdu2-n" });
  assert.deepEqual(hydrateNextNull({ W1: true, W2: false, W3: "true" }), { W1: true });
  assert.deepEqual(hydrateNextNull([]), {});
});

test("pre-Flip Null bypasses both Coins and enters the Day already reconciled", () => {
  const toss = tosses(true);
  const wagers = prepareDay(["W1", "W2"], ledger, ["W2"], toss);
  assert.equal(toss.count(), 1);
  assert.deepEqual(wagers.W1, {
    mode: "O", side: null, seed: false, reference: null, referenceSide: null, nulled: false,
  });
  assert.deepEqual(wagers.W2, {
    mode: null, side: null, seed: false, reference: null, referenceSide: null,
    nulled: true, predeclared: true,
  });
  assert.equal(unresolvedCount({ wagers }), 1);

  wagers.W1.side = "A";
  const recorded = commitDay({ day: 3, date: "", wagers }, ledger);
  assert.deepEqual(recorded.at(-1).entries.W2, { null: true });
  assert.deepEqual(memory(recorded, "W2"), memory(ledger, "W2"));

  const noToss = tosses();
  const allNull = prepareDay(["W1", "W2"], ledger, ["W1", "W2"], noToss);
  assert.equal(noToss.count(), 0);
  assert.equal(reconciled({ wagers: allNull }), true);
});

test("22: all four initialized states invert either Reference", () => {
  for (const L of ["A", "B"]) for (const K of ["A", "B"]) {
    assert.equal(flipWager({ L, K }, tosses(false, true)).side, invert(L));
    assert.equal(flipWager({ L, K }, tosses(false, false)).side, invert(K));
  }
});

test("24: engine data carries mechanism, never valuation", () => {
  const result = flipWager({ L: "A", K: "B" }, tosses(false, true));
  assert.deepEqual(Object.keys(result).sort(), ["mode", "reference", "referenceSide", "seed", "side"]);
  for (const key of ["preferred", "score", "success"]) assert.equal(key in result, false);
});

test("commit is append-only and rejects unresolved Wagers", () => {
  const unresolved = { day: 3, date: "", wagers: { W1: { mode: "O", side: null, nulled: false } } };
  assert.throws(() => commitDay(unresolved, ledger), /unresolved Wager/);
  assert.equal(reconciled(unresolved), false);
  assert.equal(unresolvedCount(unresolved), 1);
  const complete = { ...unresolved, wagers: { W1: { mode: "O", side: "A", nulled: false } } };
  const next = commitDay(complete, ledger);
  assert.equal(ledger.length, 2);
  assert.equal(next.length, 3);
  assert.equal(notation(next.at(-1).entries.W1), "OA");
});

test("active and recorded days retain immutable Wager definitions across revisions", () => {
  const revision1 = {
    code: "W1", name: "Original situation", type: "NOT", a: "DO X", b: "DO NOT DO X",
    revision: 1, schema: { act: "X" }, retired: false,
  };
  const day = snapshotDay({
    day: 1,
    date: "2026-01-01T00:00:00.000Z",
    wagers: { W1: { mode: "O", side: "A", nulled: false } },
  }, [revision1]);
  const revision2 = { ...revision1, name: "Revised situation", a: "DO Y", b: "DO NOT DO Y", revision: 2 };

  assert.deepEqual(day.wagers.W1.definition, snapshotWager(revision1));
  assert.notDeepEqual(day.wagers.W1.definition, snapshotWager(revision2));
  assert.equal(day.wagers.W1.definition.schema, undefined);

  const recorded = commitDay(day, []);
  revision1.name = "Mutated outside";
  day.wagers.W1.definition.name = "Mutated active day";
  assert.equal(recorded[0].definitions.W1.name, "Original situation");
  assert.deepEqual(recorded[0].entries.W1, { mode: "O", side: "A" });
});

test("snapshot migration preserves existing day definitions and absent legacy codes", () => {
  const preserved = { code: "W1", name: "Bound", type: "NOT", a: "A", b: "B", revision: 1 };
  const day = snapshotDay({
    day: 2,
    wagers: {
      W1: { mode: "C", side: "B", definition: preserved },
      OLD: { mode: "O", side: "A" },
    },
  }, [{ ...preserved, name: "Current", revision: 2 }]);
  assert.equal(day.wagers.W1.definition, preserved);
  assert.equal(day.wagers.OLD.definition, undefined);
});

test("probability invariant keeps its declared bounds", () => {
  assert.equal(piTheory(0), PI_MIN);
  assert.equal(piTheory(0.5), 0.5);
  assert.equal(piTheory(1), PI_MAX);
});

test("canonical Wager validation owns normalization, grammar, uniqueness, and bounds", () => {
  const route = validateWagerDraft({
    code: " r1! ", name: "  bounded   situation  ", type: "BIFURCATION",
    consequence: "shared consequence", routeA: "first route", routeB: "second route",
  });
  assert.equal(route.valid, true);
  assert.deepEqual(route.wager, {
    code: "R1", name: "bounded situation", type: "BIFURCATION",
    a: "shared consequence THROUGH first route",
    b: "shared consequence THROUGH second route",
    schema: { consequence: "shared consequence", routeA: "first route", routeB: "second route" },
    retired: false,
  });

  const sameRoute = validateWagerDraft({
    code: "R2", name: "situation", type: "BIFURCATION",
    consequence: "x", routeA: "A   route", routeB: " a route ",
  });
  assert.equal(sameRoute.valid, false);
  assert.match(sameRoute.errors.routeA, /distinct routes/);
  assert.equal(validateWagerDraft({ ...route.wager, code: "R1" }, ["R1"]).valid, false);
  assert.equal(normalizeAuthoredText(" x\u0000  y "), "x y");
  assert.equal(normalizeAuthoredText("x".repeat(100)).length, 72);

  assert.deepEqual(generatedSides({ type: "NOT", act: "x" }), { a: "DO x", b: "DO NOT DO x" });
  assert.deepEqual(generatedSides({ type: "ASYMPTOTE", measure: "x", boundary: "y" }), { a: "x AT MOST y", b: "x AT LEAST y" });
  assert.deepEqual(generatedSides({ type: "PRECEDENCE", act: "x", anchor: "y" }), { a: "x BEFORE y", b: "x AFTER y" });
});

test("hydration admits only coherent canonical records and restores chronological order", () => {
  const canonical = {
    code: "X", name: "situation", type: "NOT", a: "tampered", b: "tampered",
    schema: { act: " act  " }, revision: 2,
  };
  const hydrated = hydrateWagers([
    null,
    { code: "X", name: "older", type: "NOT", a: "A", b: "B", revision: 1 },
    canonical,
    { code: "BAD", name: "invalid code", type: "NOT", a: "A", b: "B" },
    { code: "Q", name: "same sides", type: "NOT", a: "A", b: " a " },
  ]);
  assert.deepEqual(hydrated, [{
    code: "X", name: "situation", type: "NOT", a: "DO act", b: "DO NOT DO act",
    schema: { act: "act" }, revision: 2, retired: false,
  }]);

  const records = hydrateLedger([
    { day: 3, entries: { X: { mode: "O", side: "A" }, Q: { side: "A" } } },
    { day: 1, date: "date", entries: { X: { null: true } } },
    { day: 3, entries: { X: { mode: "C", side: "B" } } },
    { day: 2, entries: {} },
  ]);
  assert.deepEqual(records.map((record) => record.day), [1, 3]);
  assert.deepEqual(records[1].entries, { X: { mode: "O", side: "A" } });

  assert.equal(hydrateDay({ day: 2, wagers: { X: { mode: "C", side: "A", reference: "L", referenceSide: "A" } } }), null);
  assert.equal(hydrateDay({ day: 2, wagers: { X: { predeclared: true, nulled: false } } }), null);
});

test("definition equality prevents redundant revisions without collapsing real change", () => {
  const base = {
    code: "X", name: "situation", type: "NOT", a: "DO x", b: "DO NOT DO x",
    schema: { act: "x" }, revision: 1, retired: false,
  };
  assert.equal(sameWagerDefinition(base, { ...base, revision: 9, retired: true }), true);
  assert.equal(sameWagerDefinition(base, { ...base, name: "changed" }), false);
});

test("Day and export boundaries preserve append-only, newest-first trace semantics", () => {
  assert.equal(nextDayNumber(ledger), 3);
  assert.equal(nextDayNumber(ledger, { day: 8 }), 9);
  assert.throws(
    () => commitDay({ day: 2, date: "", wagers: { W1: { mode: "O", side: "A" } } }, ledger),
    /ascending order/,
  );
  assert.throws(() => flipDay(["W1", "W1"], ledger), /unique/);
  assert.throws(() => prepareDay(["W1"], ledger, ["W2"]), /identify a Wager/);
  assert.throws(() => applyEntry({ L: null, K: null }, { mode: "X", side: "A" }), /Invalid Ledger entry/);
  assert.throws(() => applyEntry({ L: null, K: null }, { null: "true" }), /Invalid Null entry/);
  assert.throws(() => flipWager({ L: null, K: "A" }), /Invalid Wager memory/);
  assert.throws(() => simulate(1.1, 10), /between 0 and 1/);
  assert.throws(() => simulate(0.5, 0), /positive integer/);

  const text = exportText([{ code: "W1", name: "one", a: "A", b: "B" }], [
    ...ledger,
    { day: 3, date: "", entries: { W1: { mode: "O", side: "A" }, HX: { null: true } } },
  ]);
  assert.ok(text.indexOf("003") < text.indexOf("002"));
  assert.match(text, /HX null/);
});

test("an invalid historical definition cannot masquerade as current wording", () => {
  const corrupted = hydrateLedger([{
    day: 1,
    entries: { X: { mode: "O", side: "A" } },
    definitions: { X: { code: "X", name: "broken", type: "NOT", a: "", b: "" } },
  }]);
  assert.deepEqual(corrupted, []);
});
