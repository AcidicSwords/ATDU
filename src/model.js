export const APP_STATE_VERSION = 3;

export const STORAGE_KEYS = Object.freeze({
  state: "atdu3-state",
  legacyWagers: "atdu2-w",
  legacyLedger: "atdu2-l",
  legacyDay: "atdu2-d",
  legacyNextNull: "atdu2-n",
});

export const WAGER_STRUCTURES = Object.freeze([
  Object.freeze({ key: "NOT", form: "DO X / DO NOT DO X", label: "Enactment", description: "One shared act; enactment or positive non-enactment." }),
  Object.freeze({ key: "BIFURCATION", form: "X THROUGH Y / X THROUGH Z", label: "Route", description: "One shared consequence; two distinct routes." }),
  Object.freeze({ key: "ASYMPTOTE", form: "X AT MOST Y / X AT LEAST Y", label: "Range", description: "One shared measure; two orientations around one reference." }),
  Object.freeze({ key: "PRECEDENCE", form: "X BEFORE Y / X AFTER Y", label: "Precedence", description: "One shared event; two orientations around one anchor." }),
]);

export const TEXT_LIMITS = Object.freeze({ code: 2, scope: 72, situation: 72, term: 72, side: 168 });
const CONSTRUCTORS = new Set(WAGER_STRUCTURES.map(({ key }) => key));

function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function positiveInteger(value, fallback = 1) { return Number.isInteger(value) && value > 0 ? value : fallback; }
function nonNegativeInteger(value, fallback = 0) { return Number.isInteger(value) && value >= 0 ? value : fallback; }

export function normalizeCode(value) {
  return String(value ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TEXT_LIMITS.code);
}

function storedCode(value) {
  const normalized = String(value ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.length >= 1 && normalized.length <= TEXT_LIMITS.code ? normalized : "";
}

export function normalizeAuthoredText(value, limit = TEXT_LIMITS.term) {
  const withoutControls = [...String(value ?? "").normalize("NFKC")]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint < 32 || codePoint === 127 ? " " : character;
    }).join("");
  return withoutControls.replace(/\s+/gu, " ").trim().slice(0, limit);
}

function comparableText(value) { return normalizeAuthoredText(value).toLocaleLowerCase(); }
function constructorOf(value) {
  if (typeof value?.constructor === "string") return value.constructor;
  return typeof value?.type === "string" ? value.type : "";
}
function variablesOf(value) { return isRecord(value?.variables) ? value.variables : isRecord(value?.schema) ? value.schema : {}; }

export function variablesFromDraft(draft) {
  const constructor = constructorOf(draft);
  const source = variablesOf(draft);
  const read = (key, fallbackKey = key) => normalizeAuthoredText(source[key] ?? draft?.[fallbackKey]);
  if (constructor === "NOT") return { act: read("act") };
  if (constructor === "BIFURCATION") return { consequence: read("consequence"), routeA: read("routeA"), routeB: read("routeB") };
  if (constructor === "ASYMPTOTE") return {
    measure: read("measure"),
    reference: normalizeAuthoredText(source.reference ?? source.boundary ?? draft?.reference ?? draft?.boundary),
  };
  if (constructor === "PRECEDENCE") return { act: read("act"), anchor: read("anchor") };
  return {};
}

export const schemaFromDraft = variablesFromDraft;

export function deriveSides(definition) {
  if (isRecord(definition?.legacySides)) return {
    a: normalizeAuthoredText(definition.legacySides.A, TEXT_LIMITS.side),
    b: normalizeAuthoredText(definition.legacySides.B, TEXT_LIMITS.side),
  };
  const constructor = constructorOf(definition);
  const variables = variablesFromDraft({ ...definition, constructor });
  if (constructor === "NOT") return { a: variables.act ? `DO ${variables.act}` : "", b: variables.act ? `DO NOT DO ${variables.act}` : "" };
  if (constructor === "BIFURCATION") return {
    a: variables.consequence && variables.routeA ? `${variables.consequence} THROUGH ${variables.routeA}` : "",
    b: variables.consequence && variables.routeB ? `${variables.consequence} THROUGH ${variables.routeB}` : "",
  };
  if (constructor === "ASYMPTOTE") return {
    a: variables.measure && variables.reference ? `${variables.measure} AT MOST ${variables.reference}` : "",
    b: variables.measure && variables.reference ? `${variables.measure} AT LEAST ${variables.reference}` : "",
  };
  if (constructor === "PRECEDENCE") return {
    a: variables.act && variables.anchor ? `${variables.act} BEFORE ${variables.anchor}` : "",
    b: variables.act && variables.anchor ? `${variables.act} AFTER ${variables.anchor}` : "",
  };
  return { a: "", b: "" };
}

export const generatedSides = deriveSides;

export function validateWagerDraft(draft, existingCodes = [], originalCode = null) {
  const code = normalizeCode(draft?.code);
  const scope = normalizeAuthoredText(draft?.scope ?? draft?.name, TEXT_LIMITS.scope);
  const constructor = constructorOf(draft);
  const variables = variablesFromDraft({ ...draft, constructor });
  const errors = {};
  if (!code) errors.code = "Enter a one- or two-character code using letters or numbers.";
  if (code && code !== normalizeCode(originalCode) && existingCodes.some((candidate) => normalizeCode(candidate) === code)) errors.code = "That code is already in use.";
  if (!scope) errors.scope = "Describe the bounded scope in which this Wager exists.";
  if (!CONSTRUCTORS.has(constructor)) errors.constructor = "Select one canonical Wager structure.";
  if (constructor === "NOT") {
    if (!variables.act) errors.act = "Enter the shared act, X.";
  } else if (constructor === "BIFURCATION") {
    if (!variables.consequence) errors.consequence = "Enter the shared consequence, X.";
    if (!variables.routeA) errors.routeA = "Enter the first route, Y.";
    if (!variables.routeB) errors.routeB = "Enter the second route, Z.";
    if (variables.routeA && variables.routeB && comparableText(variables.routeA) === comparableText(variables.routeB)) {
      errors.routeA = "Y and Z must be distinct routes.";
      errors.routeB = "Y and Z must be distinct routes.";
    }
  } else if (constructor === "ASYMPTOTE") {
    if (!variables.measure) errors.measure = "Enter the shared measure, X.";
    if (!variables.reference) errors.reference = "Enter the shared reference, Y.";
  } else if (constructor === "PRECEDENCE") {
    if (!variables.act) errors.act = "Enter the shared act or event, X.";
    if (!variables.anchor) errors.anchor = "Enter the shared temporal anchor, Y.";
  }
  const candidate = { code, scope, constructor, variables };
  const sides = deriveSides(candidate);
  if (sides.a.length > TEXT_LIMITS.side || sides.b.length > TEXT_LIMITS.side) errors.variables = "The complete Side readings are too long.";
  const valid = Object.keys(errors).length === 0 && Boolean(sides.a && sides.b);
  return { valid, errors, sides, wager: valid ? { ...candidate, revision: 1, retired: false } : null };
}

function splitPair(a, aToken, b, bToken) {
  const aIndex = a.indexOf(aToken);
  const bIndex = b.indexOf(bToken);
  if (aIndex <= 0 || bIndex <= 0) return null;
  return { aLeft: a.slice(0, aIndex), bLeft: b.slice(0, bIndex), aRight: a.slice(aIndex + aToken.length), bRight: b.slice(bIndex + bToken.length) };
}

export function parseLegacySides(constructor, rawA, rawB) {
  const a = normalizeAuthoredText(rawA, TEXT_LIMITS.side);
  const b = normalizeAuthoredText(rawB, TEXT_LIMITS.side);
  if (!a || !b || comparableText(a) === comparableText(b)) return null;
  if (constructor === "NOT" && a.startsWith("DO ") && b.startsWith("DO NOT DO ")) {
    const act = a.slice(3);
    if (b === `DO NOT DO ${act}`) return { act };
  }
  if (constructor === "BIFURCATION") {
    const pair = splitPair(a, " THROUGH ", b, " THROUGH ");
    if (pair && pair.aLeft === pair.bLeft && pair.aRight !== pair.bRight) return { consequence: pair.aLeft, routeA: pair.aRight, routeB: pair.bRight };
  }
  if (constructor === "ASYMPTOTE") {
    const pair = splitPair(a, " AT MOST ", b, " AT LEAST ");
    if (pair && pair.aLeft === pair.bLeft && pair.aRight === pair.bRight) return { measure: pair.aLeft, reference: pair.aRight };
  }
  if (constructor === "PRECEDENCE") {
    const pair = splitPair(a, " BEFORE ", b, " AFTER ");
    if (pair && pair.aLeft === pair.bLeft && pair.aRight === pair.bRight) return { act: pair.aLeft, anchor: pair.aRight };
  }
  return null;
}

export function sanitizeWager(value) {
  if (!isRecord(value)) return null;
  const code = storedCode(value.code);
  const scope = normalizeAuthoredText(value.scope ?? value.name, TEXT_LIMITS.scope);
  const constructor = constructorOf(value);
  if (!code || !scope || !CONSTRUCTORS.has(constructor)) return null;
  const revision = positiveInteger(value.revision);
  const retired = value.retired === true;
  if (isRecord(value.variables) || isRecord(value.schema)) {
    const validation = validateWagerDraft({ code, scope, constructor, variables: variablesOf(value) });
    return validation.valid ? { ...validation.wager, revision, retired } : null;
  }
  const rawA = value.legacySides?.A ?? value.a;
  const rawB = value.legacySides?.B ?? value.b;
  const parsed = parseLegacySides(constructor, rawA, rawB);
  if (parsed) return { code, scope, constructor, variables: parsed, revision, retired };
  const legacySides = { A: normalizeAuthoredText(rawA, TEXT_LIMITS.side), B: normalizeAuthoredText(rawB, TEXT_LIMITS.side) };
  if (!legacySides.A || !legacySides.B || comparableText(legacySides.A) === comparableText(legacySides.B)) return null;
  return { code, scope, constructor, legacySides, needsRebind: true, revision, retired };
}

function sanitizeDefinition(value, expectedCode) {
  if (!isRecord(value)) return null;
  const sanitized = sanitizeWager({ ...value, code: expectedCode, retired: false });
  return sanitized ? snapshotWager(sanitized) : null;
}

function sanitizeEntry(value) {
  if (!isRecord(value)) return null;
  if (value.null === true) return { null: true };
  return ["O", "C"].includes(value.mode) && ["A", "B"].includes(value.side) ? { mode: value.mode, side: value.side } : null;
}

function sanitizeDayState(value, expectedCode) {
  if (!isRecord(value)) return null;
  const definition = value.definition ? sanitizeDefinition(value.definition, expectedCode) : null;
  if (value.definition && !definition) return null;
  if (value.predeclared === true) {
    if (value.nulled !== true) return null;
    return { mode: null, side: null, seed: false, reference: null, referenceSide: null, nulled: true, predeclared: true, ...(definition ? { definition } : {}) };
  }
  if (!["O", "C"].includes(value.mode)) return null;
  const side = ["A", "B"].includes(value.side) ? value.side : null;
  const seed = value.seed === true;
  if (value.mode === "O" && seed) return null;
  if (value.mode === "C" && !seed && !side) return null;
  const reference = ["L", "K"].includes(value.reference) ? value.reference : null;
  const referenceSide = ["A", "B"].includes(value.referenceSide) ? value.referenceSide : null;
  if (reference && (!referenceSide || !side || side === referenceSide)) return null;
  return { mode: value.mode, side, seed, reference, referenceSide, nulled: value.nulled === true, ...(definition ? { definition } : {}) };
}

export function parseStored(raw, fallback) { if (raw == null) return fallback; try { return JSON.parse(raw); } catch { return fallback; } }

export function hydrateWagers(value) {
  if (!Array.isArray(value)) return [];
  const byCode = new Map();
  value.forEach((candidate) => {
    const wager = sanitizeWager(candidate);
    if (!wager) return;
    const current = byCode.get(wager.code);
    if (!current || wager.revision > current.revision) byCode.set(wager.code, wager);
  });
  return [...byCode.values()];
}

export function hydrateLedger(value) {
  if (!Array.isArray(value)) return [];
  const byDay = new Map();
  value.forEach((candidate) => {
    if (!isRecord(candidate) || !Number.isInteger(candidate.day) || candidate.day < 1 || !isRecord(candidate.entries)) return;
    const entries = {};
    Object.entries(candidate.entries).forEach(([rawCode, rawEntry]) => {
      const code = storedCode(rawCode);
      const entry = sanitizeEntry(rawEntry);
      if (code && entry && !entries[code]) entries[code] = entry;
    });
    if (!Object.keys(entries).length || byDay.has(candidate.day)) return;
    const definitions = {};
    let invalidDefinition = false;
    if (isRecord(candidate.definitions)) Object.keys(entries).forEach((code) => {
      if (!Object.hasOwn(candidate.definitions, code)) return;
      const definition = sanitizeDefinition(candidate.definitions[code], code);
      if (definition) definitions[code] = definition;
      else invalidDefinition = true;
    });
    if (invalidDefinition) return;
    byDay.set(candidate.day, {
      day: candidate.day,
      date: typeof candidate.date === "string" ? candidate.date.slice(0, 64) : "",
      entries,
      ...(Object.keys(definitions).length ? { definitions } : {}),
    });
  });
  return [...byDay.values()].sort((left, right) => left.day - right.day);
}

export function hydrateDay(value) {
  if (!isRecord(value) || !Number.isInteger(value.day) || value.day < 1 || !isRecord(value.wagers)) return null;
  const wagers = {};
  for (const [rawCode, rawState] of Object.entries(value.wagers)) {
    const code = storedCode(rawCode);
    const state = sanitizeDayState(rawState, code);
    if (!code || !state || wagers[code]) return null;
    wagers[code] = state;
  }
  if (!Object.keys(wagers).length) return null;
  return { day: value.day, date: typeof value.date === "string" ? value.date.slice(0, 64) : "", wagers };
}

export function hydrateNextNull(value) {
  if (!isRecord(value)) return {};
  const hydrated = {};
  Object.entries(value).forEach(([rawCode, isNull]) => { const code = storedCode(rawCode); if (code && isNull === true) hydrated[code] = true; });
  return hydrated;
}

export function updateWager(wagers, code, changes) { return wagers.map((wager) => wager.code === code ? { ...wager, ...changes, code: wager.code } : wager); }

export function snapshotWager(wager) {
  const sanitized = sanitizeWager(wager);
  if (!sanitized) throw new TypeError("Cannot snapshot an invalid Wager");
  return {
    code: sanitized.code,
    scope: sanitized.scope,
    constructor: sanitized.constructor,
    ...(sanitized.variables ? { variables: { ...sanitized.variables } } : { legacySides: { ...sanitized.legacySides }, needsRebind: true }),
    revision: sanitized.revision,
  };
}

export function sameWagerDefinition(left, right) {
  if (!left || !right) return false;
  const normalize = (value) => { const snapshot = snapshotWager(value); delete snapshot.revision; return snapshot; };
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export function snapshotDay(day, wagers) {
  if (!day) return null;
  const currentByCode = new Map(wagers.map((wager) => [wager.code, wager]));
  return {
    ...day,
    wagers: Object.fromEntries(Object.entries(day.wagers).map(([code, state]) => [
      code,
      state.definition || !currentByCode.has(code) ? state : { ...state, definition: snapshotWager(currentByCode.get(code)) },
    ])),
  };
}

function sanitizePendingReveal(value, day, ledger) {
  if (!isRecord(value) || !day || value.day !== day.day) return null;
  const closingDay = value.closingDay == null ? null : positiveInteger(value.closingDay, null);
  if (closingDay != null && !ledger.some((record) => record.day === closingDay)) return null;
  return { day: day.day, closingDay };
}

export function createEmptyAppState() {
  return { version: APP_STATE_VERSION, revision: 0, wagers: [], ledger: [], day: null, nextNull: {}, pendingReveal: null };
}

export function hydrateAppState(value) {
  if (!isRecord(value) || value.version !== APP_STATE_VERSION) return null;
  const wagers = hydrateWagers(value.wagers);
  const ledger = hydrateLedger(value.ledger);
  const day = snapshotDay(hydrateDay(value.day), wagers);
  const activeCodes = new Set(wagers.filter((wager) => !wager.retired).map((wager) => wager.code));
  const nextNull = Object.fromEntries(Object.entries(hydrateNextNull(value.nextNull)).filter(([code]) => activeCodes.has(code)));
  return {
    version: APP_STATE_VERSION,
    revision: nonNegativeInteger(value.revision),
    wagers,
    ledger,
    day,
    nextNull,
    pendingReveal: sanitizePendingReveal(value.pendingReveal, day, ledger),
  };
}

export function migrateLegacyState({ wagers, ledger, day, nextNull }) {
  return hydrateAppState({
    ...createEmptyAppState(),
    wagers: parseStored(wagers, []),
    ledger: parseStored(ledger, []),
    day: parseStored(day, null),
    nextNull: parseStored(nextNull, {}),
  });
}
