export const STORAGE_KEYS = Object.freeze({
  wagers: "atdu2-w",
  ledger: "atdu2-l",
  day: "atdu2-d",
  nextNull: "atdu2-n",
});

export const WAGER_STRUCTURES = Object.freeze([
  Object.freeze({ key: "NOT", form: "DO X / DO NOT DO X", label: "Enactment", description: "One shared act; enactment or positive non-enactment." }),
  Object.freeze({ key: "BIFURCATION", form: "X THROUGH Y / X THROUGH Z", label: "Route", description: "One shared consequence; two distinct routes." }),
  Object.freeze({ key: "ASYMPTOTE", form: "X AT MOST Y / X AT LEAST Y", label: "Range", description: "One shared measure; two orientations around one reference." }),
  Object.freeze({ key: "PRECEDENCE", form: "X BEFORE Y / X AFTER Y", label: "Temporal relation", description: "One shared act; two orientations around one anchor." }),
]);

export const TEXT_LIMITS = Object.freeze({ code: 2, situation: 72, term: 72, side: 168 });
const STRUCTURE_KEYS = new Set(WAGER_STRUCTURES.map(({ key }) => key));

function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function positiveInteger(value, fallback = 1) { return Number.isInteger(value) && value > 0 ? value : fallback; }

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
    })
    .join("");
  return withoutControls.replace(/\s+/gu, " ").trim().slice(0, limit);
}

function comparableText(value) { return normalizeAuthoredText(value).toLocaleLowerCase(); }

export function generatedSides(draft) {
  const type = draft?.type;
  if (type === "NOT") {
    const act = normalizeAuthoredText(draft.act);
    return { a: act ? `DO ${act}` : "", b: act ? `DO NOT DO ${act}` : "" };
  }
  if (type === "BIFURCATION") {
    const consequence = normalizeAuthoredText(draft.consequence);
    const routeA = normalizeAuthoredText(draft.routeA);
    const routeB = normalizeAuthoredText(draft.routeB);
    return {
      a: consequence && routeA ? `${consequence} THROUGH ${routeA}` : "",
      b: consequence && routeB ? `${consequence} THROUGH ${routeB}` : "",
    };
  }
  if (type === "ASYMPTOTE") {
    const measure = normalizeAuthoredText(draft.measure);
    const reference = normalizeAuthoredText(draft.boundary);
    return {
      a: measure && reference ? `${measure} AT MOST ${reference}` : "",
      b: measure && reference ? `${measure} AT LEAST ${reference}` : "",
    };
  }
  if (type === "PRECEDENCE") {
    const act = normalizeAuthoredText(draft.act);
    const anchor = normalizeAuthoredText(draft.anchor);
    return {
      a: act && anchor ? `${act} BEFORE ${anchor}` : "",
      b: act && anchor ? `${act} AFTER ${anchor}` : "",
    };
  }
  return { a: "", b: "" };
}

export function schemaFromDraft(draft) {
  if (draft?.type === "NOT") return { act: normalizeAuthoredText(draft.act) };
  if (draft?.type === "BIFURCATION") return {
    consequence: normalizeAuthoredText(draft.consequence),
    routeA: normalizeAuthoredText(draft.routeA),
    routeB: normalizeAuthoredText(draft.routeB),
  };
  if (draft?.type === "ASYMPTOTE") return {
    measure: normalizeAuthoredText(draft.measure),
    reference: normalizeAuthoredText(draft.boundary),
  };
  if (draft?.type === "PRECEDENCE") return {
    act: normalizeAuthoredText(draft.act),
    anchor: normalizeAuthoredText(draft.anchor),
  };
  return {};
}

export function validateWagerDraft(draft, existingCodes = [], originalCode = null) {
  const code = normalizeCode(draft?.code);
  const name = normalizeAuthoredText(draft?.name, TEXT_LIMITS.situation);
  const type = draft?.type;
  const sides = generatedSides(draft);
  const errors = {};
  if (!code) errors.code = "Enter a one- or two-character code using letters or numbers.";
  if (code && code !== normalizeCode(originalCode) && existingCodes.some((candidate) => normalizeCode(candidate) === code)) errors.code = "That code is already in use.";
  if (!name) errors.name = "Describe the bounded situation in which this Wager exists.";
  if (!STRUCTURE_KEYS.has(type)) errors.type = "Select one canonical Wager structure.";
  if (type === "NOT") {
    if (!normalizeAuthoredText(draft.act)) errors.act = "Enter the shared act, X.";
  } else if (type === "BIFURCATION") {
    if (!normalizeAuthoredText(draft.consequence)) errors.consequence = "Enter the shared consequence, X.";
    if (!normalizeAuthoredText(draft.routeA)) errors.routeA = "Enter the first route, Y.";
    if (!normalizeAuthoredText(draft.routeB)) errors.routeB = "Enter the second route, Z.";
    if (!errors.routeA && !errors.routeB && comparableText(draft.routeA) === comparableText(draft.routeB)) {
      errors.routeA = "Y and Z must be distinct routes.";
      errors.routeB = "Y and Z must be distinct routes.";
    }
  } else if (type === "ASYMPTOTE") {
    if (!normalizeAuthoredText(draft.measure)) errors.measure = "Enter the shared measure, X.";
    if (!normalizeAuthoredText(draft.boundary)) errors.boundary = "Enter the shared reference, Y.";
  } else if (type === "PRECEDENCE") {
    if (!normalizeAuthoredText(draft.act)) errors.act = "Enter the shared act or event, X.";
    if (!normalizeAuthoredText(draft.anchor)) errors.anchor = "Enter the shared temporal anchor, Y.";
  }
  const valid = Object.keys(errors).length === 0 && Boolean(sides.a && sides.b);
  return {
    valid, errors, sides,
    wager: valid ? { code, name, type, a: sides.a, b: sides.b, schema: schemaFromDraft(draft), retired: false } : null,
  };
}

function draftFromSchema(value) {
  const schema = value.schema;
  return {
    code: value.code, name: value.name, type: value.type,
    act: schema.act, consequence: schema.consequence, routeA: schema.routeA, routeB: schema.routeB,
    measure: schema.measure, boundary: schema.reference ?? schema.boundary, anchor: schema.anchor,
  };
}

export function sanitizeWager(value) {
  if (!isRecord(value)) return null;
  const code = storedCode(value.code);
  const name = normalizeAuthoredText(value.name, TEXT_LIMITS.situation);
  const type = value.type;
  if (!code || !name || !STRUCTURE_KEYS.has(type)) return null;
  if (isRecord(value.schema)) {
    const validated = validateWagerDraft(draftFromSchema({ ...value, code, name }));
    if (!validated.valid) return null;
    return { ...validated.wager, revision: positiveInteger(value.revision), retired: value.retired === true };
  }
  const a = normalizeAuthoredText(value.a, TEXT_LIMITS.side);
  const b = normalizeAuthoredText(value.b, TEXT_LIMITS.side);
  if (!a || !b || comparableText(a) === comparableText(b)) return null;
  return { code, name, type, a, b, revision: positiveInteger(value.revision), retired: value.retired === true };
}

function sanitizeDefinition(value, expectedCode) {
  if (!isRecord(value)) return null;
  const sanitized = sanitizeWager({ ...value, code: expectedCode, retired: false });
  return sanitized ? snapshotWager(sanitized) : null;
}

function sanitizeEntry(value) {
  if (!isRecord(value)) return null;
  if (value.null === true) return { null: true };
  if (["O", "C"].includes(value.mode) && ["A", "B"].includes(value.side)) return { mode: value.mode, side: value.side };
  return null;
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

export function parseStored(raw, fallback) {
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

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
    if (isRecord(candidate.definitions)) {
      Object.keys(entries).forEach((code) => {
        if (!Object.hasOwn(candidate.definitions, code)) return;
        const definition = sanitizeDefinition(candidate.definitions[code], code);
        if (definition) definitions[code] = definition;
        else invalidDefinition = true;
      });
    }
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
  Object.entries(value).forEach(([rawCode, isNull]) => {
    const code = storedCode(rawCode);
    if (code && isNull === true) hydrated[code] = true;
  });
  return hydrated;
}

export function updateWager(wagers, code, changes) {
  return wagers.map((wager) => wager.code === code ? { ...wager, ...changes, code: wager.code } : wager);
}

export function snapshotWager(wager) {
  const sanitized = sanitizeWager(wager);
  if (!sanitized) throw new TypeError("Cannot snapshot an invalid Wager");
  return { code: sanitized.code, name: sanitized.name, type: sanitized.type, a: sanitized.a, b: sanitized.b, revision: sanitized.revision };
}

export function sameWagerDefinition(left, right) {
  if (!left || !right) return false;
  return ["code", "name", "type", "a", "b"].every((key) => left[key] === right[key]) && JSON.stringify(left.schema || null) === JSON.stringify(right.schema || null);
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
