import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("UI generates no random display values and guards duplicate Flips", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random/);
  assert.match(source, /flipping\.current/);
  assert.match(source, /saveDay\(nextDay\)/);
});

test("reels present mutually exclusive stops and keep state codes in the Ledger", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.doesNotMatch(source, /OPEN · CONSTRAINED|LAST · LAST CONSTRAINED/);
  assert.match(source, /options=\{\["OPEN", "CONSTRAINED"\]\}/);
  assert.match(source, /options=\{\["LAST SIDE", "LAST CONSTRAINED SIDE"\]\}/);
  assert.match(source, /strip\.animate\(\[/);
  assert.match(source, /length: 32/);
  assert.doesNotMatch(styles, /@keyframes reel-roll|\.reel\.is-braking[\s\S]{0,100}animation-duration/);
  assert.doesNotMatch(source, /\{result\.mode\}\{result\.side|\{state\.mode\}[AB]/);
  assert.doesNotMatch(source, /π =|P\(O\)|P\(L\)/);
  assert.match(source, /const longLabels = options\.some\(\(option\) => option\.length > 9\)/);
  assert.match(styles, /\.reel--long \.reel__value,[\s\S]*\.reel--compound \.reel__value/);
  assert.match(styles, /container-type: inline-size/);
});

test("neither Coin reveals its realized stop before its own spin", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /const conditionDisplay = phase === "load" \? "READY" : gateValue/);
  assert.match(source, /const referenceDisplay = \["reference-spin", "reference-brake", "reference-land", "invert", "resolved"\]\.includes\(phase\)[\s\S]*\? referenceValue[\s\S]*: "READY"/);
  assert.match(source, /label="Memory selected"[\s\S]*value=\{referenceDisplay\}/);
});

test("upcoming Null is declared before Flip and never enters the Coin result sequence", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /function NextDayPreflight/);
  assert.match(source, /Declare known structural unavailability before Flip/);
  assert.match(source, /const flipped = prepareDay\(active\.map[\s\S]*nullCodes\)/);
  assert.match(source, /results: live\.map/);
  assert.match(source, /predeclaredNulls:/);
  assert.match(source, /current\.predeclared \|\| current\.nulled === nulled/);
});

test("Wager builder exposes only the canonical constructors and variables", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../src/model.js", import.meta.url), "utf8");
  for (const form of [
    "DO X / DO NOT DO X",
    "X THROUGH Y / X THROUGH Z",
    "X AT MOST Y / X AT LEAST Y",
    "X BEFORE Y / X AFTER Y",
  ]) assert.match(model, new RegExp(form.replaceAll("/", "\\/")));
  assert.match(model, /`DO NOT DO \$\{act\}`/);
  const placeholders = [...source.matchAll(/placeholder="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(placeholders)].sort(), ["X", "Y", "Z"]);
  assert.doesNotMatch(source, /Use exact wording|is-bypassed/);
});

test("Rule and outcome UI retain the simulation and actual Side definitions", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /function RuleSurface/);
  assert.match(source, /simulate\(p, 365\)/);
  assert.match(source, /sideText\(wager, side\)/);
  assert.match(source, /Condition Coin/);
  assert.match(source, /Coin as agent/);
  assert.match(source, /binomialDistribution/);
});

test("Flip commitment uses a physical Coin gesture and remains accessible and skippable", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /function TossToFlip/);
  assert.match(source, /function PhysicalCoin/);
  assert.match(source, /function CoinGlyph/);
  assert.match(source, /role="slider"/);
  assert.match(source, /aria-orientation="vertical"/);
  assert.match(source, /progressRef\.current >= 82/);
  assert.match(source, /aria-valuetext/);
  assert.match(source, /Reveal all/);
  assert.match(source, /results\.length >= 12/);
  assert.match(source, /!active\.length && !currentWagers\.length && !event/);
  assert.doesNotMatch(source, /className="flip-button"/);
});

test("system state and Side semantics have separate visual and storage channels", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(styles, /day-wager--open[\s\S]{0,100}border-width: 1px/);
  assert.match(styles, /day-wager--constrained[\s\S]{0,100}border-style: double/);
  assert.match(styles, /--side-a: #eba9f5/);
  assert.match(styles, /--side-b: #5afafa/);
  assert.doesNotMatch(source, /Coin 1|Coin 2|First Coin|Second Coin/i);
});

test("Wager surfaces distinguish unresolved, resolved, and excluded states", async () => {
  const styles = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(styles, /\.side-control \{[\s\S]*?background: transparent/);
  assert.match(styles, /\.side-control--a\.is-selected,\s*\.locked-resolution--a \{[\s\S]*?border-color: var\(--side-a\)[\s\S]*?background: var\(--side-a-soft\)/);
  assert.match(styles, /\.side-control--b\.is-selected,\s*\.locked-resolution--b \{[\s\S]*?border-color: var\(--side-b\)[\s\S]*?background: var\(--side-b-soft\)/);
  assert.match(styles, /\.side-control:not\(:disabled\):hover[\s\S]*?transform: translateY\(-1px\)/);
});

test("an Open choice recesses its mutually excluded Side", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.match(source, /state\.side === "A" \? "is-selected" : state\.side \? "is-excluded"/);
  assert.match(source, /state\.side === "B" \? "is-selected" : state\.side \? "is-excluded"/);
  assert.match(source, /aria-pressed=\{state\.side === "A"\}/);
  assert.match(source, /aria-pressed=\{state\.side === "B"\}/);
  assert.match(source, /disabled=\{state\.side === "A"\}/);
  assert.match(source, /disabled=\{state\.side === "B"\}/);
  assert.match(styles, /\.side-control\.is-excluded \{[\s\S]*?background: var\(--metal\)[\s\S]*?box-shadow: inset/);
});

test("Ledger presents newest days first without reversing stored memory", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /const displayLedger = useMemo\([\s\S]*\[\.\.\.ledger\]\.sort\(\(left, right\) => right\.day - left\.day\)/);
  assert.match(source, /\{displayLedger\.map\(\(record\) =>/);
  assert.match(source, /memory\(ledger, selectedWager\.code\)/);
  assert.match(source, /aria-sort="descending"/);
});

test("Wager geometry presents each defined Side once without a redundant shared axis", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Shared X|wager-geometry__axis|activeSide/);
  assert.doesNotMatch(styles, /wager-geometry__axis/);
  assert.match(source, /wager-geometry__side wager-geometry__side--a/);
  assert.match(source, /wager-geometry__side wager-geometry__side--b/);
});

test("every authored Wager string has a shared, enforced length policy", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../src/model.js", import.meta.url), "utf8");
  const inputs = [...source.matchAll(/<input[\s\S]*?\/>/g)].map((match) => match[0]);
  assert.equal(inputs.length, 10);
  inputs.forEach((input) => assert.match(input, /maxLength=\{TEXT_LIMITS\./));
  assert.match(model, /situation: 72/);
  assert.match(model, /term: 72/);
  assert.match(source, /value\.slice\(0, limit\)/);
  assert.match(model, /normalizeAuthoredText/);
});

test("Wager errors are textual, field-bound, and focus the first invalid input", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /validateWagerDraft\(draft, existingCodes, initialWager\?\.code\)/);
  assert.match(source, /<form className="builder" onSubmit=\{submit\} noValidate>/);
  assert.match(source, /role=\{error \? "alert" : undefined\}/);
  assert.match(source, /querySelector\("\[aria-invalid='true'\]"\)\?\.focus\(\)/);
  assert.match(source, /required[\s\S]{0,80}aria-invalid/);
  assert.match(source, /No definition has changed; no revision is required\./);
});

test("the four primary objects are unique and canonical writes are guarded", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const navigation = source.match(/const NAVIGATION = \[([\s\S]*?)\];/)?.[1] || "";
  assert.equal((navigation.match(/id:/g) || []).length, 4);
  for (const id of ["wager", "coin", "ledger", "rule"]) {
    assert.equal((navigation.match(new RegExp(`id: "${id}"`, "g")) || []).length, 1);
  }
  assert.match(source, /Refusing to store an invalid Wager/);
  assert.match(source, /Refusing to store an invalid Ledger Day/);
  assert.match(source, /Refusing to store an invalid active Day/);
});

test("retired visual mechanisms and obsolete rule diagrams are absent", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
  for (const obsolete of ["flip-button", "coin-rule-grid", "mechanism-flow", "final-silence", "rule-button"]) {
    assert.doesNotMatch(`${source}\n${styles}`, new RegExp(obsolete));
  }
});

test("Wager identity and Side definitions are canonical while memory registers stay referential", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /function WagerIdentity/);
  assert.match(source, /function SideContent/);
  assert.match(source, /function MemorySlot/);
  const memoryPair = source.match(/<div className="memory-pair">([\s\S]*?)<\/div>\s*<div className="memory-panel__definitions">/)?.[1];
  assert.ok(memoryPair);
  assert.doesNotMatch(memoryPair, /SideDefinition|sideText/);
  assert.match(memoryPair, /MemorySlot label="Last Side"/);
  assert.match(memoryPair, /MemorySlot label="Last Constrained Side"/);
});
