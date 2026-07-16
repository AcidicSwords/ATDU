import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appUrl = new URL("../src/App.jsx", import.meta.url);
const cssUrl = new URL("../src/App.css", import.meta.url);
const modelUrl = new URL("../src/model.js", import.meta.url);
const engineUrl = new URL("../src/engine.js", import.meta.url);

test("four primary surfaces and a secondary Rules utility are unique", async () => {
  const source = await readFile(appUrl, "utf8");
  for (const entry of [
    '{ id: "wager", label: "Wagers" }',
    '{ id: "today", label: "Today" }',
    '{ id: "coin", label: "Coin" }',
    '{ id: "ledger", label: "Ledger" }',
  ]) assert.equal(source.split(entry).length - 1, 1);
  assert.match(source, /className="rules-button"[\s\S]*?>Rules</);
  assert.doesNotMatch(source, /id: "rule"/);
});

test("startup routing follows pending receipt, active Wagers, and reconciliation", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /if \(state\.pendingReveal\) return "coin"/);
  assert.match(source, /if \(!state\.wagers\.some[\s\S]*?return "wager"/);
  assert.match(source, /state\.day && !reconciled\(state\.day\)[\s\S]*?return "today"/);
});

test("Wager composition uses Scope, canonical variables, and Bind", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /label="Scope"/);
  assert.match(source, /Active only while both readings are available\./);
  assert.match(source, /"Bind Wager"/);
  assert.match(source, /variables: variablesFromDraft\(draft\)/);
  assert.doesNotMatch(source, /placeholder="(morning|work|exercise|email|friend)/i);
});

test("canonical Wagers store variables and derive Side readings", async () => {
  const model = await readFile(modelUrl, "utf8");
  assert.match(model, /export function deriveSides/);
  assert.match(model, /const candidate = \{ code, scope, constructor, variables \}/);
  assert.match(model, /wager: valid \? \{ \.\.\.candidate, revision: 1, retired: false \}/);
  assert.doesNotMatch(model, /wager: valid[\s\S]{0,180}\ba:/);
  assert.match(model, /legacySides[\s\S]*needsRebind: true/);
});

test("v3 state owns one authoritative storage key and legacy read keys", async () => {
  const model = await readFile(modelUrl, "utf8");
  const source = await readFile(appUrl, "utf8");
  assert.match(model, /state: "atdu3-state"/);
  assert.match(model, /legacyWagers: "atdu2-w"/);
  assert.match(source, /hydrateAppState\(parseStored\(await storageGet\(STORAGE_KEYS\.state\)/);
  assert.match(source, /migrateLegacyState\(\{ wagers, ledger, day, nextNull \}\)/);
  assert.doesNotMatch(source, /storageSet\(STORAGE_KEYS\.legacy/);
});

test("nightly semantics persist before theatrical state is shown", async () => {
  const source = await readFile(appUrl, "utf8");
  const engine = await readFile(engineUrl, "utf8");
  assert.match(engine, /export function commitAndPrepareNight/);
  assert.match(engine, /pendingReveal: nextDay \? \{ day: dayNumber, closingDay:/);
  assert.match(source, /await commitNight\(night\);\s*setEvent/);
  assert.match(source, /await storageSet\(STORAGE_KEYS\.state, JSON\.stringify\(next\)\)/);
  assert.match(source, /if \(!persisted\) throw/);
});

test("refresh resumes at the fixed Tomorrow Ticket without rerolling", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /const resumedEvent = pendingReveal && day && !event/);
  assert.match(source, /initialPhase=\{resumedEvent \? "settle" : null\}/);
  assert.match(source, /acknowledgeReveal\(\)/);
});

test("Today is plain and final reconciliation routes automatically to Coin", async () => {
  const source = await readFile(appUrl, "utf8");
  const today = source.slice(source.indexOf("function TodaySurface"), source.indexOf("function NextDayPreflight"));
  assert.match(today, /you decide/i);
  assert.match(today, /Coin’s decisions are already fixed/);
  assert.match(today, /if \(reconciled\(nextDay\)\) window\.requestAnimationFrame\(goCoin\)/);
  assert.doesNotMatch(today, /spin|jackpot|reward|streak/i);
});

test("operational Coin language is plain while channel terms remain exact elsewhere", async () => {
  const source = await readFile(appUrl, "utf8");
  const event = source.slice(source.indexOf("function FlipEvent"), source.indexOf("function DayWager"));
  assert.match(event, /You decide/);
  assert.match(event, /Coin decide/);
  assert.match(event, /MOST RECENT COIN-DECIDED SIDE/);
  assert.doesNotMatch(event, />Open condition|>Constrained condition|Environmental condition|>Agent</);
  const ledger = source.slice(source.indexOf("function LedgerSurface"), source.indexOf("const SIMULATION_POLICIES"));
  assert.match(ledger, /Open/);
  assert.match(ledger, /Constrained/);
});

test("each reel exposes only its two mutually exclusive stops", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /options=\{\["YOU", "COIN"\]\}/);
  assert.match(source, /options=\{\["MOST RECENT SIDE", "MOST RECENT COIN-DECIDED SIDE"\]\}/);
  assert.equal(source.split('options={["YOU", "COIN"]}').length - 1, 1);
  assert.equal(source.split('options={["MOST RECENT SIDE", "MOST RECENT COIN-DECIDED SIDE"]}').length - 1, 1);
});

test("neither Coin reveals its realized stop before spinning", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /conditionDisplay = phase === "load" \? "READY" : gateValue/);
  assert.match(source, /referenceDisplay = \["reference-spin"[\s\S]*?\? referenceValue\s*: "READY"/);
  assert.doesNotMatch(source, /value=\{gateValue\}/);
  assert.doesNotMatch(source, /value=\{referenceValue\}/);
});

test("the Coin gesture remains physical, keyboard operable, guarded, and skippable", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /role="slider"/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /\["Enter", " "\]/);
  assert.match(source, /flipping\.current/);
  assert.match(source, /Show ticket/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("Null before Coin bypasses generation and Null today remains neutral", async () => {
  const source = await readFile(appUrl, "utf8");
  const engine = await readFile(engineUrl, "utf8");
  assert.match(engine, /const liveCodes = codes\.filter/);
  assert.match(engine, /mode: null,[\s\S]*predeclared: true/);
  assert.match(source, /Null today/);
  assert.match(source, /Null before Coin/);
  assert.doesNotMatch(source, /failed|refused|disobeyed/i);
});

test("visual depth has one meaning across Today", async () => {
  const styles = await readFile(cssUrl, "utf8");
  assert.match(styles, /\.side-control \{[\s\S]*?background: transparent/);
  assert.match(styles, /\.side-control--a\.is-selected,\s*\.locked-resolution--a \{[\s\S]*?background: var\(--side-a-soft\)/);
  assert.match(styles, /\.side-control--b\.is-selected,\s*\.locked-resolution--b \{[\s\S]*?background: var\(--side-b-soft\)/);
  assert.match(styles, /\.side-control\.is-excluded \{[\s\S]*?background: var\(--metal\)[\s\S]*?box-shadow: inset/);
});

test("Side neutrality uses equal geometry and two non-valued accents", async () => {
  const styles = await readFile(cssUrl, "utf8");
  assert.match(styles, /--side-a: #eba9f5/);
  assert.match(styles, /--side-b: #5afafa/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styles, /--side-a: (red|green)|--side-b: (red|green)/i);
});

test("long content and twenty-item surfaces use bounded responsive grids", async () => {
  const styles = await readFile(cssUrl, "utf8");
  const model = await readFile(modelUrl, "utf8");
  assert.match(model, /scope: 72/);
  assert.match(model, /term: 72/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /\.day-board--plain[\s\S]*?grid-template-columns: repeat\(2/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.day-board--plain[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
});

test("Ledger stays newest-first and preserves compact codes", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /\[\.\.\.ledger\]\.sort\(\(left, right\) => right\.day - left\.day\)/);
  assert.match(source, /notation\(entry\)/);
  assert.match(source, /Last Constrained Side/);
});

test("Rules retain both fair distributions, the chain, and convergence", async () => {
  const source = await readFile(appUrl, "utf8");
  const rules = source.slice(source.indexOf("function RuleSurface"), source.indexOf("const NAVIGATION"));
  assert.match(rules, /Condition Coin/);
  assert.match(rules, /Coin as agent/);
  assert.match(rules, /½ Open · ½ Constrained/);
  assert.match(rules, /Chain convergence across five Open policies/);
  assert.match(rules, /Null/);
  assert.doesNotMatch(rules, /success rate|adherence|winning Side|streak|recommendation/i);
});

test("production copy contains no gambling value structure", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.doesNotMatch(source, /credits?|payout|jackpot|payline|near miss|house advantage|reroll|winning Side/i);
});
